from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from .manual_finance import clone_manual_finance_payload, migrate_legacy_manual_inputs, normalize_manual_finance_payload
from .reference_data import (
    REFERENCE_DOMAINS,
    REFERENCE_FIELD_METADATA,
    REFERENCE_SECTIONS,
    apply_reference_overrides,
    build_auto_source_registry,
    build_compatibility_reference_tables,
    deserialize_source_snapshot,
    editable_reference_fields,
    hydrate_military_reference_domains,
    reference_field_definition,
    researchable_reference_fields,
    validate_military_reference_state,
)
from .seed_data import GAP_FLAGS, MANUAL_CASHFLOW_SEED, PATH_TEMPLATES, PLANNER_PROFILE, SCENARIO_SEEDS


DB_PATH = Path(__file__).resolve().parent.parent / "planner.db"
SCENARIO_COLUMNS = {
    "display_name": "TEXT",
    "color_token": "TEXT",
    "is_loaded": "INTEGER NOT NULL DEFAULT 0",
    "display_order": "INTEGER NOT NULL DEFAULT 0",
    "path_timeline_json": "TEXT DEFAULT ''",
}
REFERENCE_OVERRIDE_COLUMNS = {
    "value_json": "TEXT DEFAULT ''",
}
DEFAULT_COLOR_BY_PATH = {"PATH_A": "sage", "PATH_B": "amber", "PATH_C": "azure", "PATH_CUSTOM": "plum"}
PATH_TIMELINE_BLOCK_TYPES = {"grad_school", "tech_career", "research_career", "retire"}
LEGACY_PATH_TEMPLATE_IDS = {"PATH_A", "PATH_B", "PATH_C"}


def table_columns(conn: sqlite3.Connection, table_name: str) -> set[str]:
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()}


def empty_path_timeline() -> dict[str, Any]:
    return {"version": 1, "serviceExit": {"type": None, "year": None}, "blocks": []}


def coerce_legacy_path_template_id(
    path_template_id: str | None,
    path_timeline: dict[str, Any] | None = None,
    scenario: dict[str, Any] | None = None,
) -> str:
    if path_template_id in LEGACY_PATH_TEMPLATE_IDS:
        return str(path_template_id)

    scenario = scenario or {}
    raw_timeline = path_timeline or scenario.get("pathTimeline") or {}
    service_exit = raw_timeline.get("serviceExit") or {}
    service_exit_type = service_exit.get("type")
    blocks = [block for block in (raw_timeline.get("blocks") or []) if isinstance(block, dict)]
    has_grad_or_research = any(block.get("type") in {"grad_school", "research_career"} for block in blocks) or bool(
        scenario.get("selectedPhdProgramId") or scenario.get("selectedEmployerId")
    )
    has_tech_only = (
        bool(blocks) and all(block.get("type") == "tech_career" for block in blocks)
    ) or bool(scenario.get("selectedCompanyId") and not has_grad_or_research)

    if service_exit_type == "military_retirement":
        return "PATH_A"
    if service_exit_type == "separation":
        return "PATH_B" if has_tech_only and not has_grad_or_research else "PATH_C"
    if has_tech_only and not has_grad_or_research:
        return "PATH_B"
    if has_grad_or_research:
        return "PATH_C"
    return "PATH_A"


def legacy_path_template_name(path_template_id: str, path_templates: list[dict[str, Any]]) -> str:
    for item in path_templates:
        if item.get("id") == path_template_id:
            return item.get("name") or path_template_id
    return path_template_id


def default_service_exit_year(exit_type: str | None, planner_profile: dict[str, Any] | None = None) -> int | None:
    profile = planner_profile or PLANNER_PROFILE
    if exit_type == "military_retirement":
        return int(profile.get("retirementEligibleYear", 2034))
    if exit_type == "separation":
        return int(profile.get("plannedSeparationYear", 2027))
    return None


def build_legacy_path_timeline(path_template_id: str | None, planner_profile: dict[str, Any] | None = None) -> dict[str, Any] | None:
    profile = planner_profile or PLANNER_PROFILE
    if path_template_id == "PATH_A":
        return {
            "version": 1,
            "serviceExit": {"type": "military_retirement", "year": default_service_exit_year("military_retirement", profile)},
            "blocks": [
                {"id": "legacy_grad_school", "type": "grad_school", "startYear": 2035},
                {"id": "legacy_research_career", "type": "research_career", "startYear": 2040},
            ],
        }
    if path_template_id == "PATH_B":
        return {
            "version": 1,
            "serviceExit": {"type": "separation", "year": default_service_exit_year("separation", profile)},
            "blocks": [
                {"id": "legacy_tech_career", "type": "tech_career", "startYear": 2028},
            ],
        }
    if path_template_id == "PATH_C":
        return {
            "version": 1,
            "serviceExit": {"type": "separation", "year": default_service_exit_year("separation", profile)},
            "blocks": [
                {"id": "legacy_grad_school", "type": "grad_school", "startYear": 2029},
                {"id": "legacy_research_career", "type": "research_career", "startYear": 2034},
            ],
        }
    return None


def normalize_path_timeline(
    path_timeline: dict[str, Any] | None,
    path_template_id: str | None = None,
    planner_profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not path_timeline:
        return build_legacy_path_timeline(path_template_id, planner_profile) or empty_path_timeline()

    service_exit = path_timeline.get("serviceExit") or {}
    service_exit_type = service_exit.get("type")
    blocks = []
    for index, block in enumerate(path_timeline.get("blocks") or []):
        block_type = block.get("type")
        if block_type not in PATH_TIMELINE_BLOCK_TYPES:
            continue
        start_year = block.get("startYear")
        try:
            start_year = int(start_year) if start_year not in ("", None) else None
        except (TypeError, ValueError):
            start_year = None
        blocks.append(
            {
                "id": block.get("id") or f"timeline_block_{index + 1}",
                "type": block_type,
                "startYear": start_year,
            }
        )
    return {
        "version": 1,
        "serviceExit": {
            "type": service_exit_type,
            "year": default_service_exit_year(service_exit_type, planner_profile),
        },
        "blocks": blocks,
    }


def sync_path_templates(conn: sqlite3.Connection) -> None:
    conn.executemany(
        """
        INSERT INTO path_templates(path_id, name, payload) VALUES (?, ?, ?)
        ON CONFLICT(path_id) DO UPDATE SET
            name = excluded.name,
            payload = excluded.payload
        """,
        [(item["id"], item["name"], json.dumps(item)) for item in PATH_TEMPLATES],
    )


def _route_title() -> str:
    return "Timeline Path"


def _program_duration_years(references: dict[str, list[dict[str, Any]]], scenario: dict[str, Any]) -> int:
    program = lookup_reference(references, "phd_programs", scenario.get("selectedPhdProgramId"))
    return int(program.get("durationYears", 5) or 5) if program else 5


def _route_block_label(block: dict[str, Any], references: dict[str, list[dict[str, Any]]], scenario: dict[str, Any]) -> str:
    block_type = block.get("type")
    start_year = block.get("startYear")
    school = lookup_reference(references, "phd_programs", scenario.get("selectedPhdProgramId"))
    employer = lookup_reference(references, "research_employers", scenario.get("selectedEmployerId"))
    company = lookup_reference(references, "tech_companies", scenario.get("selectedCompanyId"))
    if block_type == "grad_school":
        duration_years = _program_duration_years(references, scenario)
        end_year = start_year + duration_years - 1 if isinstance(start_year, int) else None
        if isinstance(start_year, int) and isinstance(end_year, int):
            return f"{school['label'] if school else 'Grad School'} {start_year}-{end_year}"
        return school["label"] if school else "Grad School"
    if block_type == "tech_career":
        return f"{company['label'] if company else 'Tech Career'} {start_year}" if isinstance(start_year, int) else (company["label"] if company else "Tech Career")
    if block_type == "research_career":
        return f"{employer['label'] if employer else 'Research Career'} {start_year}" if isinstance(start_year, int) else (employer["label"] if employer else "Research Career")
    return f"Retire {start_year}" if isinstance(start_year, int) else "Retire"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_database() -> None:
    conn = get_connection()
    with conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS app_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS reference_tables (
                category TEXT NOT NULL,
                item_id TEXT NOT NULL,
                label TEXT NOT NULL,
                payload TEXT NOT NULL,
                PRIMARY KEY (category, item_id)
            );

            CREATE TABLE IF NOT EXISTS reference_overrides (
                domain TEXT NOT NULL,
                record_id TEXT NOT NULL,
                field TEXT NOT NULL,
                scope TEXT NOT NULL DEFAULT 'global',
                value REAL NOT NULL,
                value_json TEXT DEFAULT '',
                reason TEXT DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (domain, record_id, field, scope)
            );

            CREATE TABLE IF NOT EXISTS source_claims (
                claim_id TEXT PRIMARY KEY,
                target_domain TEXT NOT NULL,
                target_record_id TEXT NOT NULL,
                target_field TEXT NOT NULL,
                friendly_target_label TEXT NOT NULL,
                field_label TEXT NOT NULL,
                current_value_snapshot TEXT DEFAULT '',
                research_note TEXT DEFAULT '',
                verification_status TEXT DEFAULT 'unverified',
                placeholder_status TEXT DEFAULT 'source_pending',
                section_id TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS source_documents (
                document_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                publisher TEXT DEFAULT '',
                url TEXT DEFAULT '',
                source_type TEXT DEFAULT '',
                published_date TEXT DEFAULT '',
                accessed_date TEXT DEFAULT '',
                notes TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS source_claim_documents (
                claim_id TEXT NOT NULL,
                document_id TEXT NOT NULL,
                role TEXT DEFAULT 'supporting',
                sort_order INTEGER NOT NULL DEFAULT 0,
                note_excerpt TEXT DEFAULT '',
                PRIMARY KEY (claim_id, document_id)
            );

            CREATE TABLE IF NOT EXISTS source_claim_overrides (
                claim_id TEXT PRIMARY KEY,
                research_note TEXT DEFAULT '',
                verification_status TEXT DEFAULT '',
                placeholder_status TEXT DEFAULT '',
                evidence_tier TEXT DEFAULT '',
                confidence TEXT DEFAULT '',
                estimate_rationale TEXT DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS planner_profile (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                payload TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS manual_finance_sections (
                bucket TEXT NOT NULL,
                section_id TEXT NOT NULL,
                label TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_default INTEGER NOT NULL DEFAULT 1,
                payload TEXT NOT NULL,
                PRIMARY KEY (bucket, section_id)
            );

            CREATE TABLE IF NOT EXISTS manual_finance_items (
                bucket TEXT NOT NULL,
                section_id TEXT NOT NULL,
                item_id TEXT NOT NULL,
                label TEXT NOT NULL,
                amount REAL DEFAULT 0,
                amount_monthly REAL DEFAULT 0,
                notes TEXT DEFAULT '',
                is_custom INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                source_ref_id TEXT DEFAULT '',
                payload TEXT NOT NULL,
                PRIMARY KEY (bucket, section_id, item_id)
            );

            CREATE TABLE IF NOT EXISTS manual_cashflow_inputs (
                type TEXT NOT NULL,
                item_id TEXT NOT NULL,
                label TEXT NOT NULL,
                category TEXT NOT NULL,
                amount REAL DEFAULT 0,
                amount_monthly REAL DEFAULT 0,
                notes TEXT DEFAULT '',
                payload TEXT NOT NULL,
                PRIMARY KEY (type, item_id)
            );

            CREATE TABLE IF NOT EXISTS path_templates (
                path_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                payload TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS scenario_forks (
                scenario_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path_template_id TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                notes TEXT DEFAULT '',
                display_name TEXT,
                color_token TEXT,
                is_loaded INTEGER NOT NULL DEFAULT 0,
                display_order INTEGER NOT NULL DEFAULT 0,
                selected_company_id TEXT,
                selected_employer_id TEXT,
                selected_va_rating_id TEXT,
                selected_phd_program_id TEXT,
                use_va INTEGER NOT NULL DEFAULT 1,
                use_gi_bill INTEGER NOT NULL DEFAULT 1,
                overrides TEXT NOT NULL,
                path_timeline_json TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS projection_runs (
                scenario_id TEXT NOT NULL,
                year_index INTEGER NOT NULL,
                payload TEXT NOT NULL,
                PRIMARY KEY (scenario_id, year_index)
            );

            CREATE TABLE IF NOT EXISTS scenario_metrics (
                scenario_id TEXT PRIMARY KEY,
                payload TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS gap_flags (
                gap_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                impact TEXT NOT NULL,
                status TEXT NOT NULL,
                payload TEXT NOT NULL
            );
            """
        )
    migrate_database(conn)
    seed_database(conn)
    backfill_scenario_metadata(conn)
    backfill_seed_defaults(conn)
    conn.close()


def migrate_database(conn: sqlite3.Connection) -> None:
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(scenario_forks)").fetchall()}
    with conn:
        for name, ddl in SCENARIO_COLUMNS.items():
            if name not in columns:
                conn.execute(f"ALTER TABLE scenario_forks ADD COLUMN {name} {ddl}")
        reference_override_columns = table_columns(conn, "reference_overrides")
        for name, ddl in REFERENCE_OVERRIDE_COLUMNS.items():
            if name not in reference_override_columns:
                conn.execute(f"ALTER TABLE reference_overrides ADD COLUMN {name} {ddl}")


def seed_database(conn: sqlite3.Connection) -> None:
    already_seeded = conn.execute("SELECT value FROM app_metadata WHERE key = 'seed_version'").fetchone()
    if already_seeded:
        return

    with conn:
        insert_reference_domains(conn, REFERENCE_DOMAINS)
        conn.execute("INSERT INTO planner_profile(id, payload) VALUES (1, ?)", (json.dumps(PLANNER_PROFILE),))

        sync_path_templates(conn)

        replace_manual_finance(conn, MANUAL_CASHFLOW_SEED)

        conn.executemany(
            """
            INSERT INTO scenario_forks(
                scenario_id, name, path_template_id, enabled, notes, display_name, color_token,
                is_loaded, display_order, selected_company_id, selected_employer_id, selected_va_rating_id,
                selected_phd_program_id, use_va, use_gi_bill, overrides
            ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    item["id"],
                    item["name"],
                    item["pathTemplateId"],
                    item["notes"],
                    item.get("displayName") or item["name"],
                    item.get("colorToken") or DEFAULT_COLOR_BY_PATH.get(item["pathTemplateId"], "plum"),
                    int(item.get("isLoaded", False)),
                    item.get("displayOrder", index),
                    item["selectedCompanyId"],
                    item["selectedEmployerId"],
                    item["selectedVaRatingId"],
                    item["selectedPhdProgramId"],
                    int(item["useVa"]),
                    int(item["useGiBill"]),
                    json.dumps(item["overrides"]),
                )
                for index, item in enumerate(SCENARIO_SEEDS)
            ],
        )

        conn.executemany(
            "INSERT INTO gap_flags(gap_id, title, impact, status, payload) VALUES (?, ?, ?, ?, ?)",
            [(item["id"], item["title"], item["impact"], item["status"], json.dumps(item)) for item in GAP_FLAGS],
        )

        sync_auto_source_registry(conn, REFERENCE_DOMAINS)
        conn.execute("INSERT INTO app_metadata(key, value) VALUES ('seed_version', '5')")


def insert_reference_domains(conn: sqlite3.Connection, reference_domains: dict[str, list[dict[str, Any]]]) -> None:
    conn.execute("DELETE FROM reference_tables")
    conn.executemany(
        "INSERT INTO reference_tables(category, item_id, label, payload) VALUES (?, ?, ?, ?)",
        [
            (domain, item["id"], item.get("label", item["id"]), json.dumps(item))
            for domain, items in reference_domains.items()
            for item in items
        ],
    )


def backfill_scenario_metadata(conn: sqlite3.Connection) -> None:
    seed_map = {item["id"]: item for item in SCENARIO_SEEDS}
    rows = conn.execute("SELECT scenario_id, path_template_id, name, display_name, color_token, is_loaded, display_order FROM scenario_forks").fetchall()
    with conn:
        for index, row in enumerate(rows):
            seed = seed_map.get(row["scenario_id"], {})
            display_name = row["display_name"] or seed.get("displayName") or row["name"]
            if display_name == row["name"] and seed.get("displayName"):
                display_name = seed["displayName"]
            color_token = row["color_token"] or DEFAULT_COLOR_BY_PATH.get(row["path_template_id"], "plum")
            is_loaded = row["is_loaded"]
            if is_loaded is None or (row["scenario_id"] in seed_map and is_loaded == 0 and seed.get("isLoaded")):
                is_loaded = int(seed.get("isLoaded", index < 3))
            display_order = row["display_order"]
            if display_order is None or (row["scenario_id"] in seed_map and display_order == 0 and seed.get("displayOrder", 0) != 0):
                display_order = int(seed.get("displayOrder", index))
            conn.execute(
                """
                UPDATE scenario_forks
                SET display_name = ?, color_token = ?, is_loaded = ?, display_order = ?
                WHERE scenario_id = ?
                """,
                (display_name, color_token, int(is_loaded), int(display_order), row["scenario_id"]),
            )


def backfill_seed_defaults(conn: sqlite3.Connection) -> None:
    with conn:
        conn.execute(
            """
            INSERT INTO planner_profile(id, payload) VALUES (1, ?)
            ON CONFLICT(id) DO UPDATE SET payload = excluded.payload
            """,
            (json.dumps(PLANNER_PROFILE),),
        )

        insert_reference_domains(conn, REFERENCE_DOMAINS)
        sync_path_templates(conn)
        cleanup_reference_overrides(conn)
        sync_auto_source_registry(conn, REFERENCE_DOMAINS)
        ensure_manual_finance_seeded(conn)
        normalize_manual_finance_storage(conn)


def cleanup_reference_overrides(conn: sqlite3.Connection) -> None:
    editable_fields = editable_reference_fields()
    researchable_fields = researchable_reference_fields()
    valid_records = {
        (domain, record["id"])
        for domain, records in REFERENCE_DOMAINS.items()
        for record in records
    }
    rows = conn.execute("SELECT domain, record_id, field, scope FROM reference_overrides").fetchall()
    for row in rows:
        domain = row["domain"]
        record_id = row["record_id"]
        field = row["field"]
        scope = row["scope"]
        allowed_for_scope = set(editable_fields.get(domain, set()))
        if scope == "research_import":
            allowed_for_scope |= set(researchable_fields.get(domain, set()))
        if (domain, record_id) not in valid_records or field not in allowed_for_scope:
            conn.execute(
                "DELETE FROM reference_overrides WHERE domain = ? AND record_id = ? AND field = ? AND scope = ?",
                (domain, record_id, field, scope),
            )


def sync_auto_source_registry(conn: sqlite3.Connection, reference_domains: dict[str, list[dict[str, Any]]]) -> None:
    claims, documents, claim_documents = build_auto_source_registry(reference_domains)
    with conn:
        conn.execute("DELETE FROM source_claim_documents WHERE document_id LIKE 'auto_doc__%'")
        conn.execute("DELETE FROM source_claims WHERE claim_id LIKE 'auto_claim__%'")
        conn.execute("DELETE FROM source_documents WHERE document_id LIKE 'auto_doc__%'")
        conn.executemany(
            """
            INSERT INTO source_claims(
                claim_id, target_domain, target_record_id, target_field, friendly_target_label,
                field_label, current_value_snapshot, research_note, verification_status, placeholder_status, section_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    item["id"],
                    item["targetDomain"],
                    item["targetRecordId"],
                    item["targetField"],
                    item["friendlyTargetLabel"],
                    item["fieldLabel"],
                    item["currentValueSnapshot"],
                    item["researchNote"],
                    item["verificationStatus"],
                    item["placeholderStatus"],
                    item["sectionId"],
                )
                for item in claims
            ],
        )
        conn.executemany(
            """
            INSERT INTO source_documents(
                document_id, title, publisher, url, source_type, published_date, accessed_date, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    item["id"],
                    item["title"],
                    item["publisher"],
                    item["url"],
                    item["sourceType"],
                    item["publishedDate"],
                    item["accessedDate"],
                    item["notes"],
                )
                for item in documents
            ],
        )
        conn.executemany(
            """
            INSERT INTO source_claim_documents(claim_id, document_id, role, sort_order, note_excerpt)
            VALUES (?, ?, ?, ?, ?)
            """,
            [
                (
                    item["claimId"],
                    item["documentId"],
                    item["role"],
                    item["sortOrder"],
                    item["noteExcerpt"],
                )
                for item in claim_documents
            ],
        )


def fetch_legacy_manual_inputs(conn: sqlite3.Connection) -> dict[str, list[dict[str, Any]]]:
    legacy = {"income": [], "expenses": [], "assets": [], "debts": []}
    rows = conn.execute("SELECT * FROM manual_cashflow_inputs ORDER BY type, item_id").fetchall()
    for row in rows:
        group = row["type"]
        key = "debts" if group == "debts" else group
        if key not in legacy:
            continue
        legacy[key].append(json.loads(row["payload"]))
    return legacy


def replace_manual_finance(conn: sqlite3.Connection, payload: dict[str, list[dict[str, Any]]]) -> None:
    conn.execute("DELETE FROM manual_finance_items")
    conn.execute("DELETE FROM manual_finance_sections")
    for bucket, sections in payload.items():
        for section in sections:
            section_payload = {key: value for key, value in section.items() if key != "items"}
            conn.execute(
                """
                INSERT INTO manual_finance_sections(bucket, section_id, label, sort_order, is_default, payload)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    bucket,
                    section["id"],
                    section["label"],
                    int(section.get("order", 0)),
                    int(section.get("isDefault", True)),
                    json.dumps(section_payload),
                ),
            )
            for item in section.get("items", []):
                item_payload = dict(item)
                conn.execute(
                    """
                    INSERT INTO manual_finance_items(
                        bucket, section_id, item_id, label, amount, amount_monthly, notes, is_custom, sort_order, source_ref_id, payload
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        bucket,
                        section["id"],
                        item["id"],
                        item["label"],
                        float(item.get("amount", 0)),
                        float(item.get("amountMonthly", 0)),
                        item.get("notes", ""),
                        int(item.get("isCustom", False)),
                        int(item.get("sortOrder", 0)),
                        item.get("sourceRefId") or "",
                        json.dumps(item_payload),
                    ),
                )


def ensure_manual_finance_seeded(conn: sqlite3.Connection) -> None:
    existing = conn.execute("SELECT COUNT(*) AS count FROM manual_finance_sections").fetchone()
    if existing and existing["count"]:
        return
    legacy = fetch_legacy_manual_inputs(conn)
    payload = migrate_legacy_manual_inputs(legacy) if any(legacy.values()) else clone_manual_finance_payload(MANUAL_CASHFLOW_SEED)
    with conn:
        replace_manual_finance(conn, payload)


def normalize_manual_finance_storage(conn: sqlite3.Connection) -> None:
    existing = conn.execute("SELECT COUNT(*) AS count FROM manual_finance_sections").fetchone()
    if not existing or not existing["count"]:
        return
    current = fetch_manual_finance(conn)
    normalized = normalize_manual_finance_payload(current)
    if json.dumps(current, sort_keys=True) == json.dumps(normalized, sort_keys=True):
        return
    replace_manual_finance(conn, normalized)


def fetch_manual_finance(conn: sqlite3.Connection) -> dict[str, list[dict[str, Any]]]:
    manual = {"income": [], "expenses": [], "assets": [], "debts": []}
    section_rows = conn.execute(
        """
        SELECT bucket, section_id, label, sort_order, is_default, payload
        FROM manual_finance_sections
        ORDER BY bucket, sort_order, section_id
        """
    ).fetchall()
    item_rows = conn.execute(
        """
        SELECT bucket, section_id, item_id, label, amount, amount_monthly, notes, is_custom, sort_order, source_ref_id, payload
        FROM manual_finance_items
        ORDER BY bucket, section_id, sort_order, item_id
        """
    ).fetchall()

    sections_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for row in section_rows:
        bucket = row["bucket"]
        section_payload = json.loads(row["payload"] or "{}")
        section = {
            "id": row["section_id"],
            "label": row["label"],
            "order": row["sort_order"],
            "isDefault": bool(row["is_default"]),
            "items": [],
            **section_payload,
        }
        section["id"] = row["section_id"]
        section["label"] = row["label"]
        section["order"] = row["sort_order"]
        section["isDefault"] = bool(row["is_default"])
        section["items"] = []
        manual.setdefault(bucket, []).append(section)
        sections_by_key[(bucket, row["section_id"])] = section

    for row in item_rows:
        section = sections_by_key.get((row["bucket"], row["section_id"]))
        if not section:
            continue
        item_payload = json.loads(row["payload"] or "{}")
        item = {
            "id": row["item_id"],
            "label": row["label"],
            "notes": row["notes"],
            "isCustom": bool(row["is_custom"]),
            "sortOrder": row["sort_order"],
            "sourceRefId": row["source_ref_id"] or None,
            **item_payload,
        }
        item["id"] = row["item_id"]
        item["label"] = row["label"]
        item["notes"] = row["notes"]
        item["isCustom"] = bool(row["is_custom"])
        item["sortOrder"] = row["sort_order"]
        item["sourceRefId"] = row["source_ref_id"] or None
        if row["bucket"] in {"income", "expenses"}:
            item["amountMonthly"] = float(row["amount_monthly"] or 0)
            item.pop("amount", None)
        else:
            item["amount"] = float(row["amount"] or 0)
            item.pop("amountMonthly", None)
        section["items"].append(item)

    return manual


def fetch_reference_domains(conn: sqlite3.Connection) -> dict[str, list[dict[str, Any]]]:
    reference_rows = conn.execute("SELECT category, payload FROM reference_tables ORDER BY category, item_id").fetchall()
    reference_domains: dict[str, list[dict[str, Any]]] = {}
    for row in reference_rows:
        reference_domains.setdefault(row["category"], []).append(json.loads(row["payload"]))
    return reference_domains


def serialize_reference_override_value(value: Any) -> tuple[float, str]:
    numeric_value = 0.0
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        numeric_value = float(value)
    return numeric_value, json.dumps(value)


def deserialize_reference_override_value(row: sqlite3.Row | dict[str, Any]) -> Any:
    if isinstance(row, sqlite3.Row):
        value_json = row["value_json"] if "value_json" in row.keys() else ""
        numeric_value = row["value"]
    else:
        value_json = row.get("value_json", "")
        numeric_value = row.get("value")
    if value_json:
        try:
            return json.loads(value_json)
        except json.JSONDecodeError:
            return value_json
    return numeric_value


def fetch_reference_overrides(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    override_columns = table_columns(conn, "reference_overrides")
    select_columns = "domain, record_id, field, scope, value, reason, updated_at"
    if "value_json" in override_columns:
        select_columns = "domain, record_id, field, scope, value, value_json, reason, updated_at"
    rows = conn.execute(
        f"""
        SELECT {select_columns}
        FROM reference_overrides
        ORDER BY domain, record_id, field,
            CASE scope
                WHEN 'research_import' THEN 0
                WHEN 'global' THEN 1
                ELSE 2
            END,
            updated_at
        """
    ).fetchall()
    return [
        {
            "domain": row["domain"],
            "recordId": row["record_id"],
            "field": row["field"],
            "scope": row["scope"],
            "value": deserialize_reference_override_value(row),
            "reason": row["reason"],
            "updatedAt": row["updated_at"],
        }
        for row in rows
    ]


def fetch_source_documents(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT document_id, title, publisher, url, source_type, published_date, accessed_date, notes
        FROM source_documents
        ORDER BY title, document_id
        """
    ).fetchall()
    return [
        {
            "id": row["document_id"],
            "title": row["title"],
            "publisher": row["publisher"],
            "url": row["url"],
            "sourceType": row["source_type"],
            "publishedDate": row["published_date"],
            "accessedDate": row["accessed_date"],
            "notes": row["notes"],
        }
        for row in rows
    ]


def fetch_source_claim_documents(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT claim_id, document_id, role, sort_order, note_excerpt
        FROM source_claim_documents
        ORDER BY claim_id, sort_order, document_id
        """
    ).fetchall()
    return [
        {
            "claimId": row["claim_id"],
            "documentId": row["document_id"],
            "role": row["role"],
            "sortOrder": row["sort_order"],
            "noteExcerpt": row["note_excerpt"],
        }
        for row in rows
    ]


def fetch_source_claim_overrides(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT
            claim_id,
            research_note,
            verification_status,
            placeholder_status,
            evidence_tier,
            confidence,
            estimate_rationale,
            updated_at
        FROM source_claim_overrides
        ORDER BY claim_id
        """
    ).fetchall()
    return {
        row["claim_id"]: {
            "claimId": row["claim_id"],
            "researchNote": row["research_note"] or "",
            "verificationStatus": row["verification_status"] or "",
            "placeholderStatus": row["placeholder_status"] or "",
            "evidenceTier": row["evidence_tier"] or "",
            "confidence": row["confidence"] or "",
            "estimateRationale": row["estimate_rationale"] or "",
            "updatedAt": row["updated_at"],
        }
        for row in rows
    }


def fetch_source_claims(
    conn: sqlite3.Connection,
    reference_domains: dict[str, list[dict[str, Any]]],
    source_claim_documents: list[dict[str, Any]],
    source_claim_overrides: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT
            claim_id,
            target_domain,
            target_record_id,
            target_field,
            friendly_target_label,
            field_label,
            current_value_snapshot,
            research_note,
            verification_status,
            placeholder_status,
            section_id
        FROM source_claims
        ORDER BY section_id, target_domain, friendly_target_label, field_label
        """
    ).fetchall()
    records_by_key = {
        (domain, record["id"]): record
        for domain, records in reference_domains.items()
        for record in records
    }
    section_titles = {section["id"]: section["title"] for section in REFERENCE_SECTIONS}
    source_counts: dict[str, int] = {}
    for link in source_claim_documents:
        source_counts[link["claimId"]] = source_counts.get(link["claimId"], 0) + 1

    claims: list[dict[str, Any]] = []
    for row in rows:
        domain = row["target_domain"]
        record_id = row["target_record_id"]
        field = row["target_field"]
        claim_override = source_claim_overrides.get(row["claim_id"], {})
        record = records_by_key.get((domain, record_id))
        field_meta = reference_field_definition(domain, field)
        current_value = deserialize_source_snapshot(row["current_value_snapshot"])
        if record and field in record:
            current_value = record.get(field)
        friendly_target_label = row["friendly_target_label"] or (record.get("label") if record else record_id)
        field_label = row["field_label"] or field_meta.get("label", field)
        research_note = claim_override.get("researchNote") or row["research_note"]
        verification_status = claim_override.get("verificationStatus") or row["verification_status"]
        placeholder_status = claim_override.get("placeholderStatus") or row["placeholder_status"]
        claims.append(
            {
                "id": row["claim_id"],
                "targetDomain": domain,
                "targetRecordId": record_id,
                "targetField": field,
                "friendlyTargetLabel": friendly_target_label,
                "fieldLabel": field_label,
                "dataPointLabel": f"{friendly_target_label} · {field_label}",
                "currentValue": current_value,
                "researchNote": research_note,
                "verificationStatus": verification_status,
                "placeholderStatus": placeholder_status,
                "evidenceTier": claim_override.get("evidenceTier", ""),
                "confidence": claim_override.get("confidence", ""),
                "estimateRationale": claim_override.get("estimateRationale", ""),
                "sectionId": row["section_id"] or REFERENCE_FIELD_METADATA.get(domain, {}).get("sectionId", ""),
                "sectionTitle": section_titles.get(row["section_id"] or REFERENCE_FIELD_METADATA.get(domain, {}).get("sectionId", ""), ""),
                "valueKind": field_meta.get("kind"),
                "sourceCount": source_counts.get(row["claim_id"], 0),
            }
        )
    return claims


def fetch_referenced_values(
    conn: sqlite3.Connection,
    reference_domains: dict[str, list[dict[str, Any]]],
    source_claim_documents: list[dict[str, Any]],
    source_documents: list[dict[str, Any]],
    source_claim_overrides: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT
            claim_id,
            target_domain,
            target_record_id,
            target_field,
            friendly_target_label,
            field_label,
            current_value_snapshot,
            research_note,
            verification_status,
            placeholder_status,
            section_id
        FROM source_claims
        ORDER BY section_id, target_domain, friendly_target_label, field_label
        """
    ).fetchall()
    records_by_key = {
        (domain, record["id"]): record
        for domain, records in reference_domains.items()
        for record in records
    }
    section_titles = {section["id"]: section["title"] for section in REFERENCE_SECTIONS}
    document_map = {document["id"]: document for document in source_documents}
    links_by_claim: dict[str, list[dict[str, Any]]] = {}
    for link in source_claim_documents:
        document = document_map.get(link["documentId"])
        if not document:
            continue
        links_by_claim.setdefault(link["claimId"], []).append(
            {
                "id": document["id"],
                "title": document["title"],
                "publisher": document.get("publisher", ""),
                "url": document.get("url", ""),
                "sourceType": document.get("sourceType", ""),
                "publishedDate": document.get("publishedDate", ""),
                "accessedDate": document.get("accessedDate", ""),
                "notes": document.get("notes", ""),
                "role": link.get("role", "supporting"),
                "noteExcerpt": link.get("noteExcerpt", ""),
                "sortOrder": link.get("sortOrder", 0),
            }
        )
    for items in links_by_claim.values():
        items.sort(key=lambda item: (item.get("sortOrder", 0), item.get("title", "")))

    referenced_values: list[dict[str, Any]] = []
    for row in rows:
        domain = row["target_domain"]
        record_id = row["target_record_id"]
        field = row["target_field"]
        claim_override = source_claim_overrides.get(row["claim_id"], {})
        record = records_by_key.get((domain, record_id))
        field_meta = reference_field_definition(domain, field)
        current_value = deserialize_source_snapshot(row["current_value_snapshot"])
        if record and field in record:
            current_value = record.get(field)
        target_label = row["friendly_target_label"] or (record.get("label") if record else record_id)
        field_label = row["field_label"] or field_meta.get("label", field)
        section_id = row["section_id"] or REFERENCE_FIELD_METADATA.get(domain, {}).get("sectionId", "")
        source_links = links_by_claim.get(row["claim_id"], [])
        research_note = claim_override.get("researchNote") or row["research_note"] or ""
        verification_status = claim_override.get("verificationStatus") or row["verification_status"] or "unverified"
        placeholder_status = claim_override.get("placeholderStatus") or row["placeholder_status"] or "source_pending"
        referenced_values.append(
            {
                "id": row["claim_id"],
                "page": "Reference Data",
                "sectionId": section_id,
                "section": section_titles.get(section_id, "Reference Data"),
                "targetDomain": domain,
                "targetRecordId": record_id,
                "targetField": field,
                "friendlyTargetLabel": target_label,
                "fieldLabel": field_label,
                "fieldLineItem": f"{target_label} · {field_label}",
                "currentValue": current_value,
                "researchNote": research_note,
                "verificationStatus": verification_status,
                "status": placeholder_status,
                "evidenceTier": claim_override.get("evidenceTier", ""),
                "confidence": claim_override.get("confidence", ""),
                "estimateRationale": claim_override.get("estimateRationale", ""),
                "valueKind": field_meta.get("kind"),
                "sourceLinks": source_links,
                "sourceCount": len(source_links),
            }
        )
    return referenced_values


def fetch_bootstrap(conn: sqlite3.Connection) -> dict[str, Any]:
    reference_domains = fetch_reference_domains(conn)
    reference_overrides = fetch_reference_overrides(conn)
    resolved_domains = apply_reference_overrides(reference_domains, reference_overrides)
    resolved_domains = hydrate_military_reference_domains(resolved_domains, PLANNER_PROFILE)
    compatibility_tables = build_compatibility_reference_tables(resolved_domains)
    source_claim_documents = fetch_source_claim_documents(conn)
    source_documents = fetch_source_documents(conn)
    source_claim_overrides = fetch_source_claim_overrides(conn)
    source_claims = fetch_source_claims(conn, resolved_domains, source_claim_documents, source_claim_overrides)
    referenced_values = fetch_referenced_values(conn, resolved_domains, source_claim_documents, source_documents, source_claim_overrides)

    path_templates = [json.loads(row["payload"]) for row in conn.execute("SELECT payload FROM path_templates ORDER BY path_id").fetchall()]
    profile = json.loads(conn.execute("SELECT payload FROM planner_profile WHERE id = 1").fetchone()["payload"])
    raw_scenarios = conn.execute("SELECT * FROM scenario_forks ORDER BY display_order, scenario_id").fetchall()
    scenarios = [row_to_scenario(row, compatibility_tables, path_templates) for row in raw_scenarios]
    gaps = [json.loads(row["payload"]) for row in conn.execute("SELECT payload FROM gap_flags ORDER BY gap_id").fetchall()]
    manual = fetch_manual_finance(conn)

    return {
        "referenceDomains": resolved_domains,
        "referenceTables": compatibility_tables,
        "referenceOverrides": reference_overrides,
        "referenceFieldMetadata": REFERENCE_FIELD_METADATA,
        "referenceSections": REFERENCE_SECTIONS,
        "referencedValues": referenced_values,
        "sourceClaims": source_claims,
        "sourceClaimOverrides": list(source_claim_overrides.values()),
        "sourceDocuments": source_documents,
        "sourceClaimDocuments": source_claim_documents,
        "plannerProfile": profile,
        "pathTemplates": path_templates,
        "scenarios": scenarios,
        "gapFlags": gaps,
        "manualCashflowInputs": manual,
    }


def row_to_scenario(
    row: sqlite3.Row | dict[str, Any],
    references: dict[str, list[dict[str, Any]]] | None = None,
    path_templates: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if isinstance(row, sqlite3.Row):
        row_keys = set(row.keys())
        scenario_id = row["scenario_id"]
        name = row["name"]
        display_name = row["display_name"]
        path_template_id = row["path_template_id"]
        enabled = bool(row["enabled"])
        notes = row["notes"]
        color_token = row["color_token"]
        is_loaded = bool(row["is_loaded"])
        display_order = row["display_order"]
        selected_company_id = row["selected_company_id"]
        selected_employer_id = row["selected_employer_id"]
        selected_va_rating_id = row["selected_va_rating_id"]
        selected_phd_program_id = row["selected_phd_program_id"]
        use_va = bool(row["use_va"])
        use_gi_bill = bool(row["use_gi_bill"])
        overrides = json.loads(row["overrides"] or "{}")
        path_timeline = json.loads(row["path_timeline_json"] or "{}") if "path_timeline_json" in row_keys else {}
    else:
        scenario_id = row.get("id")
        name = row.get("name", scenario_id or "Scenario")
        display_name = row.get("displayName", name)
        path_template_id = row.get("pathTemplateId") or ("PATH_CUSTOM" if row.get("pathTimeline") else None)
        enabled = bool(row.get("enabled", True))
        notes = row.get("notes", "")
        color_token = row.get("colorToken")
        is_loaded = bool(row.get("isLoaded", False))
        display_order = row.get("displayOrder", 0)
        selected_company_id = row.get("selectedCompanyId")
        selected_employer_id = row.get("selectedEmployerId")
        selected_va_rating_id = row.get("selectedVaRatingId")
        selected_phd_program_id = row.get("selectedPhdProgramId")
        use_va = bool(row.get("useVa", True))
        use_gi_bill = bool(row.get("useGiBill", True))
        overrides = row.get("overrides", {})
        path_timeline = row.get("pathTimeline") or {}

    path_template_id = coerce_legacy_path_template_id(path_template_id, path_timeline, {
        "selectedCompanyId": selected_company_id,
        "selectedEmployerId": selected_employer_id,
        "selectedPhdProgramId": selected_phd_program_id,
    })

    scenario = {
        "id": scenario_id,
        "name": name,
        "displayName": display_name,
        "pathTemplateId": path_template_id,
        "enabled": enabled,
        "notes": notes,
        "colorToken": color_token,
        "isLoaded": is_loaded,
        "displayOrder": display_order,
        "selectedCompanyId": selected_company_id,
        "selectedEmployerId": selected_employer_id,
        "selectedVaRatingId": selected_va_rating_id,
        "selectedPhdProgramId": selected_phd_program_id,
        "useVa": use_va,
        "useGiBill": use_gi_bill,
        "overrides": overrides,
        "pathTimeline": {},
    }
    if references and path_templates:
        scenario["routeSummary"] = build_route_summary(scenario, references, path_templates)
        scenario["routeSegments"] = build_route_segments(scenario, references)
    else:
        scenario["routeSummary"] = ""
        scenario["routeSegments"] = []
    return scenario


def build_route_segments(scenario: dict[str, Any], references: dict[str, list[dict[str, Any]]]) -> list[str]:
    _ = references
    return [scenario.get("pathTemplateId")] if scenario.get("pathTemplateId") else []


def build_route_summary(
    scenario: dict[str, Any],
    references: dict[str, list[dict[str, Any]]],
    path_templates: list[dict[str, Any]],
) -> str:
    _ = references
    return legacy_path_template_name(
        coerce_legacy_path_template_id(
            scenario.get("pathTemplateId"),
            scenario.get("pathTimeline"),
            scenario,
        ),
        path_templates,
    )


def lookup_reference(references: dict[str, list[dict[str, Any]]], category: str, item_id: str | None) -> dict[str, Any] | None:
    if not item_id:
        return None
    for item in references.get(category, []):
        if item["id"] == item_id:
            return item
    return None


def upsert_reference_override(
    conn: sqlite3.Connection,
    *,
    domain: str,
    record_id: str,
    field: str,
    value: Any,
    reason: str = "",
    scope: str = "global",
) -> None:
    numeric_value, value_json = serialize_reference_override_value(value)
    override_columns = table_columns(conn, "reference_overrides")
    if "value_json" in override_columns:
        conn.execute(
            """
            INSERT INTO reference_overrides(domain, record_id, field, scope, value, value_json, reason, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(domain, record_id, field, scope) DO UPDATE SET
                value = excluded.value,
                value_json = excluded.value_json,
                reason = excluded.reason,
                updated_at = CURRENT_TIMESTAMP
            """,
            (domain, record_id, field, scope, numeric_value, value_json, reason),
        )
        return
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError("Typed reference overrides require a migrated database with value_json support")
    conn.execute(
        """
        INSERT INTO reference_overrides(domain, record_id, field, scope, value, reason, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(domain, record_id, field, scope) DO UPDATE SET
            value = excluded.value,
            reason = excluded.reason,
            updated_at = CURRENT_TIMESTAMP
        """,
        (domain, record_id, field, scope, float(value), reason),
    )


def clear_research_import_state(conn: sqlite3.Connection) -> None:
    conn.execute("DELETE FROM source_claim_documents WHERE document_id LIKE 'manual_doc__%'")
    conn.execute("DELETE FROM source_documents WHERE document_id LIKE 'manual_doc__%'")
    conn.execute("DELETE FROM source_claim_overrides")
    conn.execute("DELETE FROM reference_overrides WHERE scope = 'research_import'")


def replace_research_import_bundle(
    conn: sqlite3.Connection,
    *,
    value_overrides: list[dict[str, Any]],
    claim_overrides: list[dict[str, Any]],
    documents: list[dict[str, Any]],
    claim_documents: list[dict[str, Any]],
) -> None:
    allowed_fields = researchable_reference_fields()
    valid_records = {
        (domain, record["id"])
        for domain, records in REFERENCE_DOMAINS.items()
        for record in records
    }

    for item in value_overrides:
        domain = item["domain"]
        record_id = item["recordId"]
        field = item["field"]
        if (domain, record_id) not in valid_records:
            raise ValueError(f"Unknown reference record: {domain}.{record_id}")
        if field not in allowed_fields.get(domain, set()):
            raise ValueError(f"{domain}.{field} is not research-importable")

    with conn:
        clear_research_import_state(conn)
        for item in value_overrides:
            upsert_reference_override(
                conn,
                domain=item["domain"],
                record_id=item["recordId"],
                field=item["field"],
                value=item["value"],
                reason=item.get("reason", ""),
                scope="research_import",
            )
        if claim_overrides:
            conn.executemany(
                """
                INSERT INTO source_claim_overrides(
                    claim_id, research_note, verification_status, placeholder_status,
                    evidence_tier, confidence, estimate_rationale, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(claim_id) DO UPDATE SET
                    research_note = excluded.research_note,
                    verification_status = excluded.verification_status,
                    placeholder_status = excluded.placeholder_status,
                    evidence_tier = excluded.evidence_tier,
                    confidence = excluded.confidence,
                    estimate_rationale = excluded.estimate_rationale,
                    updated_at = CURRENT_TIMESTAMP
                """,
                [
                    (
                        item["claimId"],
                        item.get("researchNote", ""),
                        item.get("verificationStatus", ""),
                        item.get("placeholderStatus", ""),
                        item.get("evidenceTier", ""),
                        item.get("confidence", ""),
                        item.get("estimateRationale", ""),
                    )
                    for item in claim_overrides
                ],
            )
        if documents:
            conn.executemany(
                """
                INSERT INTO source_documents(
                    document_id, title, publisher, url, source_type, published_date, accessed_date, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        item["id"],
                        item["title"],
                        item.get("publisher", ""),
                        item.get("url", ""),
                        item.get("sourceType", "manual_research_import"),
                        item.get("publishedDate", ""),
                        item.get("accessedDate", ""),
                        item.get("notes", ""),
                    )
                    for item in documents
                ],
            )
        if claim_documents:
            conn.executemany(
                """
                INSERT INTO source_claim_documents(claim_id, document_id, role, sort_order, note_excerpt)
                VALUES (?, ?, ?, ?, ?)
                """,
                [
                    (
                        item["claimId"],
                        item["documentId"],
                        item.get("role", "supporting"),
                        item.get("sortOrder", 0),
                        item.get("noteExcerpt", ""),
                    )
                    for item in claim_documents
                ],
            )

        candidate_domains = apply_reference_overrides(fetch_reference_domains(conn), fetch_reference_overrides(conn))
        validate_military_reference_state(candidate_domains, PLANNER_PROFILE)


def save_manual_inputs(conn: sqlite3.Connection, payload: dict[str, list[dict[str, Any]]]) -> None:
    normalized_payload = payload
    if payload and payload.get("expenses") and payload["expenses"] and "items" not in payload["expenses"][0]:
        normalized_payload = migrate_legacy_manual_inputs(payload)
    else:
        normalized_payload = normalize_manual_finance_payload(payload)

    with conn:
        replace_manual_finance(conn, normalized_payload)


def save_reference_override(conn: sqlite3.Connection, payload: dict[str, Any]) -> None:
    domain = payload.get("domain")
    record_id = payload.get("recordId")
    field = payload.get("field")
    reason = payload.get("reason", "")
    reset = bool(payload.get("reset"))
    value = payload.get("value")
    if not domain or not record_id or not field:
        raise ValueError("domain, recordId, and field are required")

    allowed = editable_reference_fields()
    if field not in allowed.get(domain, set()):
        raise ValueError(f"{domain}.{field} is not overrideable")
    if reset:
        with conn:
            conn.execute(
                "DELETE FROM reference_overrides WHERE domain = ? AND record_id = ? AND field = ? AND scope = 'global'",
                (domain, record_id, field),
            )
        return
    if not isinstance(value, (int, float)):
        raise ValueError("Override value must be numeric")

    with conn:
        upsert_reference_override(
            conn,
            domain=domain,
            record_id=record_id,
            field=field,
            value=float(value),
            reason=reason,
            scope="global",
        )
        candidate_domains = apply_reference_overrides(fetch_reference_domains(conn), fetch_reference_overrides(conn))
        validate_military_reference_state(candidate_domains, PLANNER_PROFILE)


def save_scenario(conn: sqlite3.Connection, scenario: dict[str, Any]) -> None:
    path_template_id = coerce_legacy_path_template_id(
        scenario.get("pathTemplateId"),
        scenario.get("pathTimeline"),
        scenario,
    )
    raw_path_timeline = scenario.get("pathTimeline") if "pathTimeline" in scenario else None
    with conn:
        conn.execute(
            """
            INSERT INTO scenario_forks(
                scenario_id, name, path_template_id, enabled, notes, display_name, color_token, is_loaded, display_order,
                selected_company_id, selected_employer_id, selected_va_rating_id, selected_phd_program_id, use_va, use_gi_bill, overrides,
                path_timeline_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(scenario_id) DO UPDATE SET
                name = excluded.name,
                path_template_id = excluded.path_template_id,
                enabled = excluded.enabled,
                notes = excluded.notes,
                display_name = excluded.display_name,
                color_token = excluded.color_token,
                is_loaded = excluded.is_loaded,
                display_order = excluded.display_order,
                selected_company_id = excluded.selected_company_id,
                selected_employer_id = excluded.selected_employer_id,
                selected_va_rating_id = excluded.selected_va_rating_id,
                selected_phd_program_id = excluded.selected_phd_program_id,
                use_va = excluded.use_va,
                use_gi_bill = excluded.use_gi_bill,
                overrides = excluded.overrides,
                path_timeline_json = COALESCE(excluded.path_timeline_json, scenario_forks.path_timeline_json)
            """,
            (
                scenario["id"],
                scenario["name"],
                path_template_id,
                int(scenario.get("enabled", True)),
                scenario.get("notes", ""),
                scenario.get("displayName") or scenario["name"],
                scenario.get("colorToken") or DEFAULT_COLOR_BY_PATH.get(path_template_id, "plum"),
                int(scenario.get("isLoaded", False)),
                int(scenario.get("displayOrder", 0)),
                scenario.get("selectedCompanyId"),
                scenario.get("selectedEmployerId"),
                scenario.get("selectedVaRatingId"),
                scenario.get("selectedPhdProgramId"),
                int(scenario.get("useVa", True)),
                int(scenario.get("useGiBill", True)),
                json.dumps(scenario.get("overrides", {})),
                json.dumps(raw_path_timeline) if raw_path_timeline is not None else None,
            ),
        )


def delete_scenario(conn: sqlite3.Connection, scenario_id: str) -> None:
    with conn:
        conn.execute("DELETE FROM projection_runs WHERE scenario_id = ?", (scenario_id,))
        conn.execute("DELETE FROM scenario_metrics WHERE scenario_id = ?", (scenario_id,))
        conn.execute("DELETE FROM scenario_forks WHERE scenario_id = ?", (scenario_id,))


def save_projection_run(conn: sqlite3.Connection, scenario_id: str, projections: list[dict[str, Any]], metrics: dict[str, Any]) -> None:
    with conn:
        conn.execute("DELETE FROM projection_runs WHERE scenario_id = ?", (scenario_id,))
        conn.executemany(
            "INSERT INTO projection_runs(scenario_id, year_index, payload) VALUES (?, ?, ?)",
            [(scenario_id, row["yearIndex"], json.dumps(row)) for row in projections],
        )
        conn.execute(
            """
            INSERT INTO scenario_metrics(scenario_id, payload) VALUES (?, ?)
            ON CONFLICT(scenario_id) DO UPDATE SET payload = excluded.payload
            """,
            (scenario_id, json.dumps(metrics)),
        )


def fetch_projection_payload(conn: sqlite3.Connection, scenario_id: str) -> dict[str, Any] | None:
    rows = conn.execute("SELECT payload FROM projection_runs WHERE scenario_id = ? ORDER BY year_index", (scenario_id,)).fetchall()
    metric_row = conn.execute("SELECT payload FROM scenario_metrics WHERE scenario_id = ?", (scenario_id,)).fetchone()
    if not rows or not metric_row:
        return None
    return {
        "scenarioId": scenario_id,
        "projection": [json.loads(row["payload"]) for row in rows],
        "metrics": json.loads(metric_row["payload"]),
    }
