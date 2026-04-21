from __future__ import annotations

import argparse
import hashlib
import json
import os
import socket
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from time import time
from urllib.parse import parse_qs, urlparse

from planner_app.database import (
    delete_scenario,
    fetch_bootstrap,
    fetch_projection_payload,
    get_connection,
    initialize_database,
    replace_research_import_bundle,
    row_to_scenario,
    save_manual_inputs,
    save_reference_override,
    save_projection_run,
    save_scenario,
)
from planner_app.engine import compare_scenarios, project_scenario
from planner_app.exporters import export_projection_csv, export_projection_xlsx
from planner_app.research_workbook import (
    build_research_import_bundle,
    ensure_reference_research_conflict_csv,
    load_reference_research_rows,
    load_reference_research_conflict_rows,
    reconcile_reference_research_rows,
    write_reference_research_csv,
    write_reference_research_prompt,
    write_reference_research_review_queue_csv,
    write_reference_research_workbook,
)


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
INDEX_TEMPLATE = STATIC_DIR / "index.html"
RUNTIME_INFO = {
    "buildId": "dev",
    "preferredPort": 8000,
    "activePort": 8000,
    "fallbackInUse": False,
    "serverUrl": "http://127.0.0.1:8000",
    "startedAt": "",
}


class PlannerServer(ThreadingHTTPServer):
    allow_reuse_address = True


class PlannerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/bootstrap":
            return self.handle_bootstrap()
        if parsed.path == "/api/recalculate":
            return self.handle_recalculate()
        if parsed.path == "/api/export":
            return self.handle_export(parsed.query)
        if parsed.path in {"/", "/index.html"}:
            return self.handle_index()
        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/scenario":
            return self.handle_save_scenario()
        if parsed.path == "/api/scenario/commit":
            return self.handle_commit_scenario()
        if parsed.path == "/api/manual-inputs":
            return self.handle_save_manual_inputs()
        if parsed.path == "/api/reference-overrides":
            return self.handle_save_reference_override()
        if parsed.path == "/api/projection-preview":
            return self.handle_projection_preview()
        return self.send_error(HTTPStatus.NOT_FOUND, "Unknown API endpoint")

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/scenario/"):
            scenario_id = parsed.path.rsplit("/", 1)[-1]
            conn = get_connection()
            delete_scenario(conn, scenario_id)
            conn.close()
            return self.json_response({"ok": True})
        return self.send_error(HTTPStatus.NOT_FOUND, "Unknown API endpoint")

    def handle_bootstrap(self) -> None:
        conn = get_connection()
        payload = fetch_bootstrap(conn)
        conn.close()
        payload["runtimeInfo"] = RUNTIME_INFO
        return self.json_response(payload)

    def handle_index(self) -> None:
        html = INDEX_TEMPLATE.read_text(encoding="utf-8")
        html = html.replace("__BUILD_ID__", RUNTIME_INFO["buildId"])
        html = html.replace("__SHELL_RUNTIME__", json.dumps(RUNTIME_INFO))
        raw = html.encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def handle_recalculate(self) -> None:
        conn = get_connection()
        bootstrap = fetch_bootstrap(conn)
        payload = build_projection_payload(bootstrap)
        for scenario_result in payload["scenarios"]:
            save_projection_run(
                conn,
                scenario_result["scenario"]["id"],
                scenario_result["projection"],
                scenario_result["metrics"],
            )
        conn.close()
        return self.json_response(payload)

    def handle_projection_preview(self) -> None:
        conn = get_connection()
        bootstrap = fetch_bootstrap(conn)
        body = self.read_json()
        raw_scenarios = body.get("scenarios") or bootstrap["scenarios"]
        scenarios = [
            row_to_scenario(item, bootstrap["referenceTables"], bootstrap["pathTemplates"])
            if isinstance(item, dict)
            else item
            for item in raw_scenarios
        ]
        payload = build_projection_payload(bootstrap, scenarios)
        conn.close()
        return self.json_response(payload)

    def handle_export(self, query: str) -> None:
        params = parse_qs(query)
        scenario_id = params.get("scenarioId", [None])[0]
        filetype = params.get("type", ["csv"])[0]
        if not scenario_id:
            return self.send_error(HTTPStatus.BAD_REQUEST, "scenarioId is required")
        conn = get_connection()
        payload = fetch_projection_payload(conn, scenario_id)
        conn.close()
        if not payload:
            return self.send_error(HTTPStatus.NOT_FOUND, "Projection not found. Recalculate first.")

        filename = f"{scenario_id}_projection.{filetype}"
        if filetype == "xlsx":
            data = export_projection_xlsx(payload["projection"], payload["metrics"])
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        else:
            data = export_projection_csv(payload["projection"])
            content_type = "text/csv; charset=utf-8"

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def handle_save_scenario(self) -> None:
        body = self.read_json()
        conn = get_connection()
        save_scenario(conn, body)
        bootstrap = fetch_bootstrap(conn)
        conn.close()
        return self.json_response({"ok": True, "scenarios": bootstrap["scenarios"]})

    def handle_commit_scenario(self) -> None:
        body = self.read_json()
        mode = body.get("mode", "overwrite")
        scenario = body["scenario"]
        if mode == "duplicate":
            scenario = {**scenario, "id": body.get("newScenarioId") or scenario["id"], "name": body.get("newScenarioName") or scenario["name"]}
            scenario["displayName"] = body.get("newScenarioName") or scenario.get("displayName") or scenario["name"]
        conn = get_connection()
        save_scenario(conn, scenario)
        bootstrap = fetch_bootstrap(conn)
        conn.close()
        return self.json_response({"ok": True, "scenario": scenario, "scenarios": bootstrap["scenarios"]})

    def handle_save_manual_inputs(self) -> None:
        body = self.read_json()
        conn = get_connection()
        save_manual_inputs(conn, body)
        conn.close()
        return self.json_response({"ok": True})

    def handle_save_reference_override(self) -> None:
        body = self.read_json()
        conn = get_connection()
        try:
            save_reference_override(conn, body)
            bootstrap = fetch_bootstrap(conn)
        except ValueError as exc:
            conn.close()
            return self.json_response({"ok": False, "error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
        conn.close()
        return self.json_response(
            {
                "ok": True,
                "referenceDomains": bootstrap["referenceDomains"],
                "referenceOverrides": bootstrap["referenceOverrides"],
                "referenceTables": bootstrap["referenceTables"],
            }
        )

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length) if length else b"{}"
        return json.loads(raw_body.decode("utf-8"))

    def json_response(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


def build_projection_payload(bootstrap: dict, scenarios: list[dict] | None = None) -> dict:
    active_scenarios = scenarios or bootstrap["scenarios"]
    projections_by_scenario = {}
    ordered_results = []
    for scenario in active_scenarios:
        projection, metrics = project_scenario(
            scenario=scenario,
            planner_profile=bootstrap["plannerProfile"],
            reference_domains=bootstrap["referenceDomains"],
            reference_tables=bootstrap["referenceTables"],
            manual_inputs=bootstrap["manualCashflowInputs"],
        )
        result = {
            "scenarioId": scenario["id"],
            "scenarioName": scenario.get("displayName") or scenario["name"],
            "scenario": scenario,
            "projection": projection,
            "metrics": metrics,
        }
        ordered_results.append(result)
        projections_by_scenario[scenario["id"]] = result
    comparisons = compare_scenarios(projections_by_scenario)
    return {"scenarios": ordered_results, "comparison": comparisons}


def run() -> None:
    initialize_database()
    requested_port = int(os.environ.get("PLANNER_PORT", "8000"))
    host = "127.0.0.1"
    port = find_available_port(host, requested_port)
    RUNTIME_INFO.update(build_runtime_info(host, requested_port, port))
    server = PlannerServer((host, port), PlannerHandler)
    if port != requested_port:
        print(f"Port {requested_port} is already in use. Falling back to http://{host}:{port}")
    else:
        print(f"Financial planner running at http://{host}:{port}")
    server.serve_forever()


def find_available_port(host: str, start_port: int, attempts: int = 25) -> int:
    for port in range(start_port, start_port + attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((host, port))
                return port
            except OSError:
                continue
    raise OSError(f"Unable to find an open port between {start_port} and {start_port + attempts - 1}.")


def build_runtime_info(host: str, preferred_port: int, active_port: int) -> dict[str, object]:
    return {
        "buildId": compute_build_id(),
        "preferredPort": preferred_port,
        "activePort": active_port,
        "fallbackInUse": active_port != preferred_port,
        "serverUrl": f"http://{host}:{active_port}",
        "startedAt": str(int(time())),
    }


def compute_build_id() -> str:
    digest = hashlib.sha1()
    for path in (ROOT / "app.py", STATIC_DIR / "index.html", STATIC_DIR / "app.js", STATIC_DIR / "styles.css"):
        digest.update(path.read_bytes())
    return digest.hexdigest()[:10]


def export_reference_research(
    xlsx_path: Path,
    csv_path: Path,
    conflicts_path: Path,
    resolved_path: Path,
    review_queue_path: Path,
    prompt_path: Path,
) -> None:
    initialize_database()
    conn = get_connection()
    bootstrap = fetch_bootstrap(conn)
    conn.close()
    workbook_path, rows = write_reference_research_workbook(bootstrap=bootstrap, output_path=xlsx_path)
    csv_output = write_reference_research_csv(rows=rows, output_path=csv_path)
    conflict_output = ensure_reference_research_conflict_csv(conflicts_path)
    reconciliation = reconcile_reference_research_rows(
        accepted_rows=rows,
        conflict_rows=load_reference_research_conflict_rows(conflict_output),
    )
    resolved_output = write_reference_research_csv(
        rows=reconciliation["resolved_rows"],
        output_path=resolved_path,
    )
    review_queue_output = write_reference_research_review_queue_csv(
        rows=reconciliation["review_queue_rows"],
        output_path=review_queue_path,
    )
    prompt_output = write_reference_research_prompt(output_path=prompt_path)
    print(f"Exported research workbook to {workbook_path}")
    print(f"Exported research CSV to {csv_output}")
    print(f"Conflict log ready at {conflict_output}")
    print(f"Resolved claims CSV ready at {resolved_output}")
    print(f"Review queue CSV ready at {review_queue_output}")
    print(f"Prompt file ready at {prompt_output}")
    print(f"Included {len(rows)} research claims.")


def import_reference_research(input_path: Path) -> None:
    initialize_database()
    conn = get_connection()
    bootstrap = fetch_bootstrap(conn)
    rows = load_reference_research_rows(input_path)
    bundle = build_research_import_bundle(rows=rows, bootstrap=bootstrap)
    replace_research_import_bundle(
        conn,
        value_overrides=bundle["value_overrides"],
        claim_overrides=bundle["claim_overrides"],
        documents=bundle["documents"],
        claim_documents=bundle["claim_documents"],
    )
    conn.close()
    print(f"Imported research workbook from {input_path}")
    print(f"Applied {len(bundle['value_overrides'])} research value overrides.")
    print(f"Stored {len(bundle['claim_overrides'])} claim research statuses.")
    print(f"Stored {len(bundle['documents'])} research documents and {len(bundle['claim_documents'])} claim-document links.")


def reconcile_reference_research(
    accepted_path: Path,
    conflicts_path: Path,
    resolved_path: Path,
    review_queue_path: Path,
) -> None:
    accepted_rows = load_reference_research_rows(accepted_path)
    conflict_rows = load_reference_research_conflict_rows(conflicts_path)
    reconciliation = reconcile_reference_research_rows(
        accepted_rows=accepted_rows,
        conflict_rows=conflict_rows,
    )
    resolved_output = write_reference_research_csv(
        rows=reconciliation["resolved_rows"],
        output_path=resolved_path,
    )
    conflict_output = ensure_reference_research_conflict_csv(conflicts_path)
    review_queue_output = write_reference_research_review_queue_csv(
        rows=reconciliation["review_queue_rows"],
        output_path=review_queue_path,
    )
    print(f"Reconciled accepted claims from {accepted_path}")
    print(f"Read conflict log from {conflict_output}")
    print(f"Wrote resolved claims CSV to {resolved_output}")
    print(f"Wrote review queue CSV to {review_queue_output}")
    print(f"Applied {len(reconciliation['applied_conflicts'])} accepted conflict decisions.")
    print(f"Queued {len(reconciliation['review_queue_rows'])} unresolved or stale conflicts for review.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Career Plan Codex local app and reference research tools.")
    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("serve", help="Run the local web app.")

    export_parser = subparsers.add_parser("export-reference-research", help="Export the reference research workbook and CSV.")
    export_parser.add_argument(
        "--xlsx",
        default=str(ROOT / "output" / "spreadsheet" / "reference_research.xlsx"),
        help="Path for the exported XLSX workbook.",
    )
    export_parser.add_argument(
        "--csv",
        default=str(ROOT / "output" / "spreadsheet" / "reference_research_claims.csv"),
        help="Path for the exported CSV companion.",
    )
    export_parser.add_argument(
        "--conflicts",
        default=str(ROOT / "output" / "spreadsheet" / "reference_research_conflicts.csv"),
        help="Path for the companion conflict-log CSV. Existing files are preserved.",
    )
    export_parser.add_argument(
        "--resolved",
        default=str(ROOT / "output" / "spreadsheet" / "reference_research_claims_resolved.csv"),
        help="Path for the derived resolved claims CSV.",
    )
    export_parser.add_argument(
        "--review-queue",
        default=str(ROOT / "output" / "spreadsheet" / "reference_research_review_queue.csv"),
        help="Path for the derived unresolved-conflicts review queue CSV.",
    )
    export_parser.add_argument(
        "--prompt",
        default=str(ROOT / "output" / "spreadsheet" / "reference_research_multi_agent_prompt.txt"),
        help="Path for the reusable multi-agent research prompt text file.",
    )

    import_parser = subparsers.add_parser("import-reference-research", help="Import a filled research workbook or CSV.")
    import_parser.add_argument("input_path", help="Path to the research XLSX or CSV file.")

    reconcile_parser = subparsers.add_parser(
        "reconcile-reference-research",
        help="Apply accepted conflict-log decisions to the accepted claims CSV and emit a resolved import-ready CSV.",
    )
    reconcile_parser.add_argument(
        "--claims",
        default=str(ROOT / "output" / "spreadsheet" / "reference_research_claims.csv"),
        help="Path to the accepted-state research claims CSV.",
    )
    reconcile_parser.add_argument(
        "--conflicts",
        default=str(ROOT / "output" / "spreadsheet" / "reference_research_conflicts.csv"),
        help="Path to the append-only research conflict log CSV.",
    )
    reconcile_parser.add_argument(
        "--resolved",
        default=str(ROOT / "output" / "spreadsheet" / "reference_research_claims_resolved.csv"),
        help="Path for the resolved claims CSV emitted by reconciliation.",
    )
    reconcile_parser.add_argument(
        "--review-queue",
        default=str(ROOT / "output" / "spreadsheet" / "reference_research_review_queue.csv"),
        help="Path for the unresolved-conflicts review queue CSV.",
    )

    args = parser.parse_args()
    command = args.command or "serve"
    if command == "serve":
        run()
        return
    if command == "export-reference-research":
        export_reference_research(
            Path(args.xlsx),
            Path(args.csv),
            Path(args.conflicts),
            Path(args.resolved),
            Path(args.review_queue),
            Path(args.prompt),
        )
        return
    if command == "import-reference-research":
        import_reference_research(Path(args.input_path))
        return
    if command == "reconcile-reference-research":
        reconcile_reference_research(
            Path(args.claims),
            Path(args.conflicts),
            Path(args.resolved),
            Path(args.review_queue),
        )
        return
    parser.error(f"Unknown command: {command}")


if __name__ == "__main__":
    main()
