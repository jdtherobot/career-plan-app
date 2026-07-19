/* Export: Excel + standalone HTML of exactly the paths on screen, plus JSON
   backup of your local data (and clear-local-data). */

import { useRef, useState } from "react";
import { EMBEDDED, bytesToB64 } from "../embedded";
import { exportXlsxBase64 } from "../engine/client";
import { buildReportHtml } from "../report/buildReport";
import { buildPayload, clearLocalData, exportStateJson, useAppState, useDispatch } from "../state/store";

// Assembled at runtime so the literal never appears inside the bundled JS —
// the template must contain exactly one occurrence (its placeholder script).
const STATE_PLACEHOLDER = ["/*__EMBEDDED_", "STATE__*/"].join("");

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportScreen() {
  const state = useAppState();
  const dispatch = useDispatch();
  const { results } = state;
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function doXlsx() {
    if (!results) return;
    setBusy("xlsx");
    setMessage(null);
    try {
      const meta = { generatedAt: new Date().toISOString(), realDollars: state.realDollars };
      const b64 = await exportXlsxBase64(results, buildPayload(state), meta);
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      download(
        "career_plan_advisor_workbook.xlsx",
        new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      );
      setMessage("Advisor workbook downloaded — cover, comparison, and full annual detail per path.");
    } catch (error) {
      setMessage(`Export failed: ${error}`);
    } finally {
      setBusy(null);
    }
  }

  async function doAppExport() {
    if (!results || !state.bootstrap) return;
    setBusy("app");
    setMessage(null);
    try {
      const base = import.meta.env.BASE_URL;
      const [tplResp, zipResp] = await Promise.all([
        fetch(`${base}app-template.html`),
        fetch(`${base}planner_app.zip?v=${__BUILD_ID__}`),
      ]);
      if (!tplResp.ok)
        throw new Error(
          "single-file template not found — run `npm run build:full` locally, or export from the deployed site",
        );
      if (!zipResp.ok) throw new Error(`planner_app.zip fetch failed (${zipResp.status})`);
      const template = await tplResp.text();
      if (!template.includes(STATE_PLACEHOLDER)) throw new Error("template is missing its state placeholder");
      const bundle = {
        version: 1,
        exportedAt: new Date().toISOString(),
        inputHash: results.inputHash,
        payload: buildPayload(state),
        results,
        bootstrap: state.bootstrap,
        uiPrefs: {
          theme: state.theme,
          chartsEnabled: state.chartsEnabled,
          realDollars: state.realDollars,
          panelBrightness: state.panelBrightness,
        },
        zipB64: bytesToB64(new Uint8Array(await zipResp.arrayBuffer())),
      };
      // <-escape every "<" so the JSON can never terminate the script tag.
      const json = JSON.stringify(bundle).replace(/</g, "\\u003c");
      const html = template
        .replace(STATE_PLACEHOLDER, `window.__EMBEDDED__=${json};`)
        .replace(
          "<title>Career Plan Codex</title>",
          `<title>Career Plan Codex — snapshot ${bundle.exportedAt.slice(0, 10)}</title>`,
        );
      download("career_plan_app.html", new Blob([html], { type: "text/html" }));
      setMessage(
        "App exported — one file with every screen and your data, viewable anywhere offline. Editing inside it needs internet once to load the engine.",
      );
    } catch (error) {
      setMessage(`Export failed: ${error}`);
    } finally {
      setBusy(null);
    }
  }

  function doHtml() {
    if (!results) return;
    setBusy("html");
    setMessage(null);
    try {
      const html = buildReportHtml(state);
      download("career_plan_report.html", new Blob([html], { type: "text/html" }));
      setMessage("Report downloaded — the dashboard and explorer as one self-contained page.");
    } catch (error) {
      setMessage(`Export failed: ${error}`);
    } finally {
      setBusy(null);
    }
  }

  function doBackup() {
    download("career_plan_backup.json", new Blob([exportStateJson(state)], { type: "application/json" }));
    setMessage("Backup saved. Import it on any machine to restore your plan.");
  }

  async function doImport(file: File) {
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (!data.scenarios || !data.manualInputs) throw new Error("Not a Career Plan backup file.");
      dispatch({
        type: "replaceAll",
        payload: {
          profile: data.plannerProfile,
          scenarios: data.scenarios,
          manualInputs: data.manualInputs,
          baselineId: data.baselineId ?? data.scenarios[0]?.id ?? null,
          referenceOverrides: data.referenceOverrides ?? [],
        },
      });
      setMessage("Backup imported — projections recomputing now.");
    } catch (error) {
      setMessage(`Import failed: ${error}`);
    }
  }

  return (
    <>
      <header className="screen-head">
        <h2>Export</h2>
        <p>Exports recompute from exactly what's on your Dashboard and embed the same input hash.</p>
      </header>

      {message && <div className="callout">{message}</div>}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <section className="card">
          <h3>Interactive app (single file)</h3>
          <p className="sub">
            The entire app — all seven screens, charts, and your data — as one HTML file. Views offline anywhere;
            editing inside it recomputes via the online engine. Contains your plan data, so share deliberately.
          </p>
          <button className="primary" onClick={doAppExport} disabled={!results || busy !== null || !!EMBEDDED}>
            {busy === "app" ? "Building…" : "Download app .html"}
          </button>
          {EMBEDDED && (
            <p className="notice" style={{ marginTop: 8 }}>
              This is already an exported snapshot — re-export from the live site.
            </p>
          )}
        </section>

        <section className="card">
          <h3>Advisor workbook (Excel)</h3>
          <p className="sub">Cover, comparison with drivers &amp; milestones, and a full annual cash-flow sheet per path.</p>
          <button className="primary" onClick={doXlsx} disabled={!results || busy !== null}>
            {busy === "xlsx" ? "Building…" : "Download .xlsx"}
          </button>
          {busy === "xlsx" && <p className="notice" style={{ marginTop: 8 }}>First export loads the spreadsheet library (~5s).</p>}
        </section>

        <section className="card">
          <h3>Dashboard report (HTML)</h3>
          <p className="sub">
            The dashboard and projection explorer as one page — cards, every chart, ribbons, and each path's annual
            table, styled exactly like the app.
          </p>
          <button className="primary" onClick={doHtml} disabled={!results || busy !== null}>
            {busy === "html" ? "Building…" : "Download .html"}
          </button>
        </section>

        <section className="card">
          <h3>Backup &amp; restore</h3>
          <p className="sub">Your data lives only in this browser. Back it up as JSON; restore anywhere.</p>
          <div className="row">
            <button onClick={doBackup}>Export backup</button>
            <button onClick={() => fileRef.current?.click()}>Import backup</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
            />
          </div>
          <div style={{ marginTop: 14, borderTop: "1px solid var(--line-2)", paddingTop: 10 }}>
            <button
              className="danger small"
              onClick={() => {
                if (window.confirm("Erase all locally saved data and reload with defaults?")) clearLocalData();
              }}
            >
              Clear my local data
            </button>
          </div>
        </section>
      </div>

      {results && (
        <p className="notice" style={{ marginTop: 16, fontFamily: "var(--font-mono)" }}>
          input hash {results.inputHash}
        </p>
      )}
    </>
  );
}
