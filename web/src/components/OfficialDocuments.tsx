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
  const retrieved = docs.filter((d) => d.status === "retrieved" || d.status === "reconstructed");
  const pending = docs.filter((d) => d.status === "not_retrieved");

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
            <p className="doc-agency">
              {d.agency}
              {d.status === "reconstructed" && (
                <span className="recon-chip" title="Rebuilt from cross-checked sources because the agency file couldn't be downloaded — see the description">
                  Reconstructed
                </span>
              )}
            </p>
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
          <p>
            DTMO's method: your annual compensation (from DTMO's table, by grade and years of service) picks a row of the
            spendable-income table; the COLA is that spendable income times the locality's index above 100, paid monthly.
          </p>
          <code>daily COLA = spendable income × (index − 100) ÷ 100 ÷ 360 · month = 30 days</code>
          <p className="calc-example">
            Alconbury (GB001) index <strong>130</strong>, effective 2026-07-01 → 30% of spendable income. E-7 over 12 years,
            no dependents: annual compensation <strong>$109,399</strong> → row $105,000–$109,999 → spendable income{" "}
            <strong>$39,330</strong> × 30% = $11,799/yr ÷ 360 = $32.775/day × 30 = <strong>$983.25</strong>/mo (with one
            dependent: $110,911 → $42,560 → $1,064.00/mo). Years of service move you into higher rows over time.{" "}
            <a href="#sources:dtmo-cola-indices">Index file</a> · <a href="#sources:dtmo-cola-spendable">Spendable income</a> ·{" "}
            <a href="#sources:dtmo-cola-annual-comp">Annual compensation</a>
          </p>
        </div>
        <div className="calc-row">
          <h4>BAH (stateside)</h4>
          <p>
            A straight lookup in DTMO's 2026 rate file: Military Housing Area × grade × with/without dependents. Paid in cash
            whatever your rent is. Beale AFB (CA033), E-7: <strong>$2,742</strong>/mo without dependents, $3,150 with.{" "}
            <a href="#sources:dtmo-bah-2026">Document</a>
          </p>
        </div>
        <div className="calc-row">
          <h4>Basic pay</h4>
          <p>
            DFAS table effective January 1, 2026, by grade and cumulative years of service — e.g. E-7 over 12 years{" "}
            <strong>$5,591.70</strong>/mo. <a href="#sources:dfas-pay-2026">Document</a>
          </p>
        </div>
        <div className="calc-row">
          <h4>Social Security</h4>
          <p>
            SSA's own formula, run on each path's earnings — military basic pay (past years rebuilt from the DFAS table and the
            official yearly raises) and civilian salary, each capped at that year's taxable maximum. Each year is wage-indexed
            to age 60; the highest 35 average out to your AIME; your full-retirement benefit (PIA) is 90% / 32% / 15% of the
            AIME across the bend points for the year you turn 62. Claiming earlier or later applies SSA's reduction or delayed
            credits. Grad stipends aren't Social Security wages.
          </p>
          <code>bend points = $180 and $1,085 × wage index(year−2) ÷ $9,779.44</code>
          <p className="calc-example">
            2027 check: $180 × $72,800.33 ÷ $9,779.44 = $1,339.96 → <strong>$1,340</strong> (SSA publishes $1,340).{" "}
            <a href="#sources:ssa-determinations">Document</a>
          </p>
        </div>
        <div className="calc-row">
          <h4>State income tax</h4>
          <p>
            Your state of legal residence's 2026 single-filer brackets on income after its standard deduction and personal
            exemption, less any personal credit. Military retired pay is reduced by the state's exclusion first.
          </p>
          <p className="calc-example">
            Nebraska, $67,100 of basic pay: $67,100 − $8,850 = $58,250 → 2.46% to $4,130 + 3.51% to $24,760 + 4.55% above =
            $2,349.50 − $176 credit = <strong>$2,173.50</strong>. Nebraska excludes 100% of military retired pay.{" "}
            <a href="#sources:taxfoundation-state-2026">Brackets</a> · <a href="#sources:nebraska-military-retirement">Nebraska DOR</a>
          </p>
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
