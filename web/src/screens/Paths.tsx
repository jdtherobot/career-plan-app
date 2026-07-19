/* Path Builder: compose a life path from blocks. Every change recomputes. */

import { useState } from "react";
import { useAppState, useDispatch, pathColor, fmtMoney } from "../state/store";

const BLOCK_TYPES = [
  { id: "tech_career", label: "Tech career", color: "var(--blk-tech)" },
  { id: "research_career", label: "Research career", color: "var(--blk-research)" },
  { id: "grad_school", label: "Grad school", color: "var(--blk-school)" },
  { id: "gap", label: "Gap", color: "var(--blk-gap)" },
  { id: "retire", label: "Retire", color: "var(--blk-retire)" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function blockColor(type: string): string {
  return BLOCK_TYPES.find((b) => b.id === type)?.color ?? "var(--blk-gap)";
}

let blockCounter = 100;

export function Paths() {
  const state = useAppState();
  const dispatch = useDispatch();
  const { scenarios, bootstrap, results, errors, theme } = state;
  const [selectedId, setSelectedId] = useState<string | null>(scenarios[0]?.id ?? null);
  const scenario = scenarios.find((s) => s.id === selectedId) ?? scenarios[0];

  if (!scenario || !bootstrap) {
    return (
      <header className="screen-head">
        <h2>Path Builder</h2>
        <p>Loading…</p>
      </header>
    );
  }

  const programs: any[] = bootstrap.referenceTables.phd_programs ?? [];
  const companies: any[] = bootstrap.referenceTables.tech_companies ?? [];
  const employers: any[] = bootstrap.referenceTables.research_employers ?? [];
  const vaRatings: any[] = bootstrap.referenceTables.va_disability ?? [];
  const scenarioErrors = errors?.[scenario.id] ?? [];
  const metrics = results?.scenarios?.find((s: any) => s.scenarioId === scenario.id)?.metrics;

  function update(patch: any) {
    dispatch({
      type: "setScenarios",
      scenarios: scenarios.map((s) => (s.id === scenario.id ? { ...s, ...patch } : s)),
    });
  }

  function updateExit(patch: any) {
    update({ serviceExit: { ...scenario.serviceExit, ...patch } });
  }

  function updateRetirement(patch: any) {
    update({ retirement: { ...scenario.retirement, ...patch } });
  }

  function updateBlock(index: number, patch: any) {
    const blocks = scenario.blocks.map((b: any, i: number) => (i === index ? { ...b, ...patch } : b));
    update({ blocks });
  }

  function moveBlock(index: number, dir: -1 | 1) {
    const blocks = [...scenario.blocks];
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    update({ blocks });
  }

  function removeBlock(index: number) {
    update({ blocks: scenario.blocks.filter((_: any, i: number) => i !== index) });
  }

  function addBlock(type: string) {
    const block: any = { id: `block_${++blockCounter}`, type, durationMonths: type === "grad_school" ? 60 : 48, overrides: {} };
    if (type === "tech_career") block.careerProfileId = companies[0]?.id;
    if (type === "research_career") block.careerProfileId = employers[0]?.id;
    if (type === "grad_school") block.programId = programs[0]?.id;
    if (type === "retire") block.durationMonths = null;
    const blocks = [...scenario.blocks];
    // Retire must be last: insert before an existing retire block.
    const retireIdx = blocks.findIndex((b: any) => b.type === "retire");
    if (type !== "retire" && retireIdx >= 0) blocks.splice(retireIdx, 0, block);
    else blocks.push(block);
    update({ blocks });
  }

  function addScenario() {
    const id = `scenario_${Date.now().toString(36)}`;
    const clone = JSON.parse(JSON.stringify(scenario));
    clone.id = id;
    clone.name = `${scenario.displayName || scenario.name} copy`;
    clone.displayName = clone.name;
    clone.displayOrder = scenarios.length;
    dispatch({ type: "setScenarios", scenarios: [...scenarios, clone] });
    setSelectedId(id);
  }

  function deleteScenario() {
    if (scenarios.length <= 1) return;
    const remaining = scenarios.filter((s) => s.id !== scenario.id);
    dispatch({ type: "setScenarios", scenarios: remaining });
    setSelectedId(remaining[0]?.id ?? null);
  }

  return (
    <>
      <header className="screen-head">
        <h2>Path Builder</h2>
        <p>
          Set when you leave the service, then stack blocks — work, school, gaps, retirement. Benefits, pension
          eligibility, GI Bill months, and taxes attach automatically.
        </p>
      </header>

      <div className="row" style={{ marginBottom: 16 }}>
        {scenarios.map((s, i) => (
          <button
            key={s.id}
            className={s.id === scenario.id ? "primary" : ""}
            onClick={() => setSelectedId(s.id)}
          >
            <span className="pathdot" style={{ background: pathColor(i, theme), display: "inline-block", marginRight: 6 }} />
            {s.displayName || s.name}
          </button>
        ))}
        <button onClick={addScenario}>+ Duplicate as new path</button>
        {scenarios.length > 1 && (
          <button className="danger" onClick={deleteScenario}>Delete</button>
        )}
      </div>

      {scenarioErrors.length > 0 && (
        <div className="error-box">
          <strong>Fix before this path can compute:</strong>
          <ul>{scenarioErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "minmax(300px, 380px) 1fr", alignItems: "start" }}>
        <section className="card">
          <h3>Path settings</h3>
          <label className="field">Display name</label>
          <input
            type="text"
            value={scenario.displayName ?? scenario.name}
            onChange={(e) => update({ displayName: e.target.value, name: e.target.value })}
          />

          <p className="section-h">Service exit</p>
          <label className="field">How you leave the Air Force</label>
          <select value={scenario.serviceExit.type} onChange={(e) => updateExit({ type: e.target.value })}>
            <option value="separation">Separate (before 20 years)</option>
            <option value="military_retirement">Military retirement (20+ years — pension)</option>
          </select>
          <div className="row">
            <div style={{ flex: 1 }}>
              <label className="field">Last month of service</label>
              <select value={scenario.serviceExit.month} onChange={(e) => updateExit({ month: Number(e.target.value) })}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="field">Year</label>
              <input
                type="number"
                min={2026}
                max={2070}
                value={scenario.serviceExit.year}
                onChange={(e) => updateExit({ year: Number(e.target.value) })}
              />
            </div>
          </div>

          <p className="section-h">Benefits</p>
          <label className="field">VA disability rating</label>
          <select value={scenario.selectedVaRatingId} onChange={(e) => update({ selectedVaRatingId: e.target.value })}>
            {vaRatings.map((r) => <option key={r.id} value={r.id}>{r.label} — {fmtMoney(r.annual)}/yr</option>)}
          </select>
          <div className="row" style={{ marginTop: 8 }}>
            <label style={{ fontSize: 13 }}>
              <input type="checkbox" checked={scenario.useVa} onChange={(e) => update({ useVa: e.target.checked })} /> VA compensation
            </label>
            <label style={{ fontSize: 13 }}>
              <input type="checkbox" checked={scenario.useGiBill} onChange={(e) => update({ useGiBill: e.target.checked })} /> GI Bill (36 mo)
            </label>
          </div>

          <p className="section-h">Retirement income</p>
          <label className="field">Retirement-account withdrawals from age</label>
          <input
            type="number"
            step={0.5}
            min={50}
            max={75}
            value={scenario.retirement.withdrawalAgeYears}
            onChange={(e) => updateRetirement({ withdrawalAgeYears: Number(e.target.value) })}
          />
          <label className="field">
            <input
              type="checkbox"
              checked={scenario.retirement.socialSecurityEnabled}
              onChange={(e) => updateRetirement({ socialSecurityEnabled: e.target.checked })}
              style={{ marginRight: 6 }}
            />
            Social Security
          </label>
          {scenario.retirement.socialSecurityEnabled && (
            <div className="row">
              <div style={{ flex: 1 }}>
                <label className="field">Est. monthly at FRA (67)</label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={scenario.retirement.ssFraMonthly}
                  onChange={(e) => updateRetirement({ ssFraMonthly: Number(e.target.value) })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field">Claim at age</label>
                <select
                  value={scenario.retirement.ssClaimAge}
                  onChange={(e) => updateRetirement({ ssClaimAge: Number(e.target.value) })}
                >
                  {[62, 63, 64, 65, 66, 67, 68, 69, 70].map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          )}

          {metrics && (
            <>
              <p className="section-h">Live preview</p>
              <table className="kv">
                <tbody>
                  <tr><td>Final (real 2026$)</td><td>{fmtMoney(metrics.finalPortfolioReal, true)}</td></tr>
                  <tr><td>Pension starts</td><td>{metrics.pensionStartYear ?? "never"}</td></tr>
                  <tr><td>Lifetime pension</td><td>{fmtMoney(metrics.lifetimePensionValue, true)}</td></tr>
                </tbody>
              </table>
            </>
          )}
        </section>

        <section>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>Blocks after service</h3>
              <div className="row">
                {BLOCK_TYPES.map((b) => (
                  <button key={b.id} className="small" onClick={() => addBlock(b.id)}>+ {b.label}</button>
                ))}
              </div>
            </div>
            <p className="sub" style={{ marginTop: 6 }}>
              Blocks run back-to-back from your exit month. The last block fills the rest of the 50-year horizon.
            </p>
          </div>

          {scenario.blocks.map((block: any, index: number) => {
            const isLast = index === scenario.blocks.length - 1;
            return (
              <div className="block-card" key={block.id}>
                <div className="row head between">
                  <span className="block-type-chip" style={{ background: blockColor(block.type) }}>
                    {BLOCK_TYPES.find((b) => b.id === block.type)?.label ?? block.type}
                  </span>
                  <div className="row">
                    <button className="small" onClick={() => moveBlock(index, -1)} disabled={index === 0} aria-label="Move up">↑</button>
                    <button className="small" onClick={() => moveBlock(index, 1)} disabled={isLast} aria-label="Move down">↓</button>
                    <button className="small danger" onClick={() => removeBlock(index)}>Remove</button>
                  </div>
                </div>
                <div className="row">
                  {!isLast && (
                    <div style={{ width: 170 }}>
                      <label className="field">Duration</label>
                      <div className="row">
                        <input
                          type="number"
                          min={0}
                          max={50}
                          style={{ width: 64 }}
                          value={Math.floor((block.durationMonths ?? 0) / 12)}
                          onChange={(e) =>
                            updateBlock(index, {
                              durationMonths: Number(e.target.value) * 12 + ((block.durationMonths ?? 0) % 12),
                            })
                          }
                          aria-label="Years"
                        />
                        <span className="notice">yr</span>
                        <input
                          type="number"
                          min={0}
                          max={11}
                          style={{ width: 56 }}
                          value={(block.durationMonths ?? 0) % 12}
                          onChange={(e) =>
                            updateBlock(index, {
                              durationMonths: Math.floor((block.durationMonths ?? 0) / 12) * 12 + Number(e.target.value),
                            })
                          }
                          aria-label="Months"
                        />
                        <span className="notice">mo</span>
                      </div>
                    </div>
                  )}
                  {isLast && <span className="notice" style={{ paddingTop: 20 }}>Runs to the end of the horizon</span>}

                  {block.type === "grad_school" && (
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <label className="field">Program</label>
                      <select value={block.programId ?? ""} onChange={(e) => updateBlock(index, { programId: e.target.value })}>
                        {programs.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label} — {fmtMoney(p.stipendAnnual)}/yr stipend
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {block.type === "tech_career" && (
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <label className="field">Company</label>
                      <select value={block.careerProfileId ?? ""} onChange={(e) => updateBlock(index, { careerProfileId: e.target.value })}>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label} — {fmtMoney(c.baseSalary)} base
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {block.type === "research_career" && (
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <label className="field">Employer</label>
                      <select value={block.careerProfileId ?? ""} onChange={(e) => updateBlock(index, { careerProfileId: e.target.value })}>
                        {employers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label} — {fmtMoney(c.baseSalary)} base
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {scenario.blocks.length === 0 && (
            <p className="notice">No blocks yet — add what comes after service with the buttons above.</p>
          )}
        </section>
      </div>
    </>
  );
}
