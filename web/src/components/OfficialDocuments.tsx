/* Official documents behind the numbers — open the stored copy, see the exact
   values the planner takes from it — plus the formulas, worked through with
   the real figures, so anyone (you or an advisor) can retrace the math. */

import { useEffect } from "react";
import { useAppState } from "../state/store";

const ROE = 0.7239; // GBP per USD, DTMO effective 2026-07-01 (dtmo-oha-gb001)

function usd(gbp: number): string {
  return `$${(gbp / ROE).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function OfficialDocuments() {
  const { bootstrap } = useAppState();
  const docs: any[] = bootstrap?.officialSources ?? [];
  const base = import.meta.env.BASE_URL;

  // Deep link: #sources:doc-id scrolls to that document.
  useEffect(() => {
    const go = () => {
      const target = window.location.hash.split(":")[1];
      if (target) document.getElementById(`doc-${target}`)?.scrollIntoView({ block: "start" });
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [docs.length]);

  if (!docs.length) return null;
  const retrieved = docs.filter((d) => d.status === "retrieved");
  const pending = docs.filter((d) => d.status !== "retrieved");

  return (
    <>
      <p className="section-h" style={{ marginTop: 0 }}>Official documents</p>
      <p className="notice" style={{ margin: "-4px 0 10px", maxWidth: 760 }}>
        The tables the planner's military and VA numbers come from, stored with the app. Open a document to check it,
        and expand “Values used” to see exactly what the planner reads from it.
      </p>
      <div className="doc-grid">
        {retrieved.map((d) => (
          <article className="card doc-card" key={d.id} id={`doc-${d.id}`}>
            <p className="doc-agency">{d.agency}</p>
            <h3>{d.title}</h3>
            {d.detail && <p className="sub">{d.detail}</p>}
            <dl className="doc-meta">
              <div><dt>Effective</dt><dd>{d.effective ?? "—"}</dd></div>
              <div><dt>Retrieved</dt><dd>{d.retrieved} · {d.retrievedBy}</dd></div>
              <div><dt>SHA-256</dt><dd className="mono" title={d.sha256}>{String(d.sha256).slice(0, 16)}…</dd></div>
            </dl>
            <div className="row" style={{ gap: 8, margin: "8px 0" }}>
              <a className="doc-btn" href={`${base}sources/${d.file}`} target="_blank" rel="noreferrer">Open document ↗</a>
              <a className="doc-btn" href={`${base}sources/${d.file}`} download>Download</a>
              <a className="doc-link" href={d.officialUrl} target="_blank" rel="noreferrer noopener">official page ↗</a>
            </div>
            <details>
              <summary>Values used ({d.values?.length ?? 0})</summary>
              <table className="kv">
                <tbody>
                  {(d.values ?? []).map((v: any) => (
                    <tr key={v.label}><td>{v.label}</td><td>{v.value}</td></tr>
                  ))}
                </tbody>
              </table>
              {d.feeds?.length ? <p className="notice" style={{ marginTop: 6 }}>Feeds: {d.feeds.join(" · ")}</p> : null}
            </details>
          </article>
        ))}
      </div>
      {pending.length > 0 && (
        <div className="doc-pending">
          <p className="section-h" style={{ margin: "14px 0 6px" }}>Not yet attached</p>
          {pending.map((d) => (
            <div key={d.id} id={`doc-${d.id}`} className="doc-pending-row">
              <span className="missing-chip">pending</span>
              <div>
                <strong>{d.title}</strong> <span className="notice">— {d.agency}</span>
                <p className="notice" style={{ margin: "2px 0 0" }}>{d.statusNote}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="section-h">How it's calculated</p>
      <div className="card calc-card">
        <div className="calc-row">
          <h4>Overseas Housing Allowance (OHA)</h4>
          <p>
            OHA reimburses <strong>actual rent, up to the DTMO rental allowance</strong> for your grade and locality. You keep
            nothing above your rent, so the planner shows OHA as income equal to rent (capped) and rent as an expense — they
            net to $0 unless rent is above the cap.
          </p>
          <code>OHA = min(rent, rental allowance) · USD = GBP ÷ rate of exchange</code>
          <p className="calc-example">
            RAF Alconbury (GB001), E-7 without dependents: £1,627.20 ÷ {ROE} = <strong>{usd(1627.2)}</strong>/mo cap. Planner
            rent there: 2-bed ≈ £1,050 → OHA pays £1,050; net housing cost $0. <a href="#sources:dtmo-oha-gb001">Document</a>
          </p>
        </div>
        <div className="calc-row">
          <h4>Utility allowance &amp; move-in (MIHA)</h4>
          <p>Flat amounts paid with OHA, converted the same way. MIHA is paid once, in your first month at the station.</p>
          <p className="calc-example">
            £623.25 ÷ {ROE} = <strong>{usd(623.25)}</strong>/mo utilities · £502.00 ÷ {ROE} = <strong>{usd(502)}</strong> once.
          </p>
        </div>
        <div className="calc-row">
          <h4>Overseas COLA</h4>
          <p>DTMO's method: spendable income for your grade, years of service and dependents × (locality index − 100) ÷ 100.</p>
          <code>COLA = spendable income × (index − 100) ÷ 100</code>
          <p className="calc-example">Pays $0 until DTMO's index and spendable-income tables are attached (see “Not yet attached”).</p>
        </div>
        <div className="calc-row">
          <h4>BAH (stateside)</h4>
          <p>A straight lookup: Military Housing Area × grade × with/without dependents. Paid in cash whatever your rent is.</p>
        </div>
        <div className="calc-row">
          <h4>Later years</h4>
          <p>
            Official rates apply from their effective date. For future years the planner carries them forward — BAH and COLA
            with the military pay raise, OHA and utilities with local rents — and labels those years as projected.
          </p>
        </div>
        <div className="calc-row">
          <h4>GI Bill &amp; VR&amp;E</h4>
          <p>
            GI Bill pays tuition in full at public schools and up to <strong>$30,908.34</strong>/yr at private and foreign schools,
            a housing allowance (school ZIP BAH for an E-5 with dependents; <strong>$2,396</strong>/mo at foreign schools), and up
            to $1,000/yr for books. VR&amp;E pays tuition and books in full and a subsistence allowance at the same Post-9/11 rate.{" "}
            <a href="#sources:va-post911-2026-27">Document</a>
          </p>
        </div>
      </div>
    </>
  );
}
