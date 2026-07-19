/* Export: Excel + standalone HTML of exactly the paths on screen, plus JSON
   backup of your local data (and clear-local-data). */

import { useRef, useState } from "react";
import { exportHtml, exportXlsxBase64 } from "../engine/client";
import { clearLocalData, exportStateJson, useAppState, useDispatch } from "../state/store";

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
      const b64 = await exportXlsxBase64(results);
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      download(
        "career_path_comparison.xlsx",
        new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      );
      setMessage("Excel workbook downloaded — one Comparison sheet plus a yearly sheet per path.");
    } catch (error) {
      setMessage(`Export failed: ${error}`);
    } finally {
      setBusy(null);
    }
  }

  async function doHtml() {
    if (!results) return;
    setBusy("html");
    setMessage(null);
    try {
      const html = await exportHtml(results);
      download("career_path_comparison.html", new Blob([html], { type: "text/html" }));
      setMessage("Standalone HTML downloaded — open it anywhere, no app needed.");
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
          <h3>Excel workbook</h3>
          <p className="sub">Comparison sheet + one annual-detail sheet per path. Share with anyone.</p>
          <button className="primary" onClick={doXlsx} disabled={!results || busy !== null}>
            {busy === "xlsx" ? "Building…" : "Download .xlsx"}
          </button>
          {busy === "xlsx" && <p className="notice" style={{ marginTop: 8 }}>First export loads the spreadsheet library (~5s).</p>}
        </section>

        <section className="card">
          <h3>Standalone HTML</h3>
          <p className="sub">A single self-contained page with cards, callouts, and annual tables.</p>
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
