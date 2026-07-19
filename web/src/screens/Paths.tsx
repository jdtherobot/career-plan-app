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

/* Standard DFAS 2026 pay grades (researched, all-grade table). */
const PAY_GRADES = [
  "E-1", "E-2", "E-3", "E-4", "E-5", "E-6", "E-7", "E-8", "E-9",
  "W-1", "W-2", "W-3", "W-4", "W-5",
  "O-1", "O-2", "O-3", "O-1E", "O-2E", "O-3E",
  "O-4", "O-5", "O-6", "O-7", "O-8", "O-9", "O-10",
];

function blockColor(type: string): string {
  return BLOCK_TYPES.find((b) => b.id === type)?.color ?? "var(--blk-gap)";
}

/* Date range each block covers, tiled from the month after service exit.
   Format: year-only when the block aligns to clean calendar years
   ("2035 – 2039"), month+year when it doesn't ("Jun 2028 – May 2033") —
   precision only where it carries information. */
function blockRanges(scenario: any, profile: any): { ranges: string[]; tail: string | null } {
  const baseYear = profile?.baseYear ?? 2026;
  const horizonYear = baseYear + (profile?.projectionYears ?? 51) - 1;
  let cursorY = scenario.serviceExit?.year ?? baseYear;
  let cursorM = scenario.serviceExit?.month ?? 12; // last month of service

  const fmt = (sy: number, sm: number, ey: number, em: number, terminal: boolean): string => {
    const clean = sm === 1 && (terminal || em === 12);
    const start = clean ? `${sy}` : `${MONTHS[sm - 1]} ${sy}`;
    if (terminal) return `${start} → ${horizonYear} (horizon)`;
    if (clean && sy === ey) return `${sy}`;
    const end = clean ? `${ey}` : `${MONTHS[em - 1]} ${ey}`;
    return `${start} – ${end}`;
  };

  const ranges: string[] = (scenario.blocks ?? []).map((block: any, i: number) => {
    const sm = cursorM === 12 ? 1 : cursorM + 1;
    const sy = cursorM === 12 ? cursorY + 1 : cursorY;
    const terminal = i === scenario.blocks.length - 1;
    if (terminal && block.durationMonths == null) {
      cursorY = horizonYear;
      cursorM = 12;
      return fmt(sy, sm, horizonYear, 12, true);
    }
    const duration = Number(block.durationMonths) || 0;
    if (duration <= 0) return "set a duration";
    const endTotal = sy * 12 + (sm - 1) + duration - 1;
    const ey = Math.floor(endTotal / 12);
    const em = (endTotal % 12) + 1;
    cursorY = ey;
    cursorM = em;
    return fmt(sy, sm, ey, em, false);
  });

  // Blocks end before the horizon → the engine fills the rest with retirement.
  let tail: string | null = null;
  if (scenario.blocks?.length && !(cursorY === horizonYear && cursorM === 12) && cursorY <= horizonYear) {
    const tm = cursorM === 12 ? 1 : cursorM + 1;
    const ty = cursorM === 12 ? cursorY + 1 : cursorY;
    const start = tm === 1 ? `${ty}` : `${MONTHS[tm - 1]} ${ty}`;
    tail = `${start} → ${horizonYear}`;
  }
  return { ranges, tail };
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
    const blocks = scenario.blocks.map((b: any) => ({ ...b }));
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    // No run-to-horizon block may sit mid-list after a reorder.
    for (let i = 0; i < blocks.length - 1; i++) {
      if (blocks[i].durationMonths == null) blocks[i].durationMonths = 48;
    }
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
    const blocks = scenario.blocks.map((b: any) => ({ ...b }));
    // Retire must be last: insert before an existing retire block.
    const retireIdx = blocks.findIndex((b: any) => b.type === "retire");
    if (type !== "retire" && retireIdx >= 0) blocks.splice(retireIdx, 0, block);
    else blocks.push(block);
    // A former run-to-horizon terminal needs a real duration once something
    // follows it — give it a visible default the user can adjust.
    for (let i = 0; i < blocks.length - 1; i++) {
      if (blocks[i].durationMonths == null) blocks[i].durationMonths = 48;
    }
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
          <h3>Service profile</h3>
          <p className="sub">Applies to every path — standard 2026 pay tables (DFAS) drive base pay, BAH, and BAS.</p>
          {(() => {
            const svc = state.profile?.serviceProfile ?? {
              payGrade: "E-7",
              serviceEntryYear: state.profile?.serviceEntryYear ?? 2014,
              serviceEntryMonth: 2,
              dependents: true,
              dutyLocationId: "sacramento_ca",
            };
            const locations: any[] = bootstrap.referenceDomains?.locations ?? [];
            const setSvc = (patch: any) => {
              const next = { ...svc, ...patch };
              dispatch({
                type: "setProfile",
                profile: {
                  ...state.profile,
                  serviceEntryYear: next.serviceEntryYear,
                  serviceProfile: next,
                },
              });
            };
            return (
              <>
                <div className="row">
                  <div style={{ flex: 1 }}>
                    <label className="field">Pay grade</label>
                    <select value={svc.payGrade} onChange={(e) => setSvc({ payGrade: e.target.value })}>
                      {PAY_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field">Duty station</label>
                    <select value={svc.dutyLocationId} onChange={(e) => setSvc({ dutyLocationId: e.target.value })}>
                      {locations.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="row">
                  <div style={{ flex: 1 }}>
                    <label className="field">Service entry (TAFMS)</label>
                    <select
                      value={svc.serviceEntryMonth}
                      onChange={(e) => setSvc({ serviceEntryMonth: Number(e.target.value) })}
                    >
                      {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field">Year</label>
                    <input
                      type="number"
                      min={1986}
                      max={2026}
                      value={svc.serviceEntryYear}
                      onChange={(e) => setSvc({ serviceEntryYear: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <label className="field" style={{ marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={svc.dependents}
                    onChange={(e) => setSvc({ dependents: e.target.checked })}
                    style={{ marginRight: 6 }}
                  />
                  With dependents (BAH rate)
                </label>
                {!state.profile?.serviceProfile && (
                  <p className="notice" style={{ marginTop: 6 }}>
                    Using the seeded service trajectory — change any field to switch to the standard pay tables.
                  </p>
                )}
              </>
            );
          })()}

          <p className="section-h">Path settings</p>
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

          {(() => {
            const { ranges, tail } = blockRanges(scenario, state.profile);
            return (
              <>
            {scenario.blocks.map((block: any, index: number) => {
            const isLast = index === scenario.blocks.length - 1;
            return (
              <div className="block-card" key={block.id}>
                <div className="row head between">
                  <span className="row" style={{ gap: 10 }}>
                    <span className="block-type-chip" style={{ background: blockColor(block.type) }}>
                      {BLOCK_TYPES.find((b) => b.id === block.type)?.label ?? block.type}
                    </span>
                    <span className="block-range">{ranges[index]}</span>
                  </span>
                  <div className="row">
                    <button className="small" onClick={() => moveBlock(index, -1)} disabled={index === 0} aria-label="Move up">↑</button>
                    <button className="small" onClick={() => moveBlock(index, 1)} disabled={isLast} aria-label="Move down">↓</button>
                    <button className="small danger" onClick={() => removeBlock(index)}>Remove</button>
                  </div>
                </div>
                <div className="row">
                  <div style={{ width: 190 }}>
                    <label className="field">Duration</label>
                    <div className="row">
                      <input
                        type="number"
                        min={0}
                        max={50}
                        style={{ width: 64 }}
                        value={Math.floor((block.durationMonths ?? 0) / 12)}
                        onChange={(e) => {
                          const months = Number(e.target.value) * 12 + ((block.durationMonths ?? 0) % 12);
                          updateBlock(index, { durationMonths: isLast && months === 0 ? null : months });
                        }}
                        aria-label="Years"
                      />
                      <span className="notice">yr</span>
                      <input
                        type="number"
                        min={0}
                        max={11}
                        style={{ width: 56 }}
                        value={(block.durationMonths ?? 0) % 12}
                        onChange={(e) => {
                          const months = Math.floor((block.durationMonths ?? 0) / 12) * 12 + Number(e.target.value);
                          updateBlock(index, { durationMonths: isLast && months === 0 ? null : months });
                        }}
                        aria-label="Months"
                      />
                      <span className="notice">mo</span>
                    </div>
                    {isLast && (
                      <span className="notice" style={{ fontSize: 10.5 }}>
                        {block.durationMonths == null ? "0 = runs to the horizon" : "ends early → retirement fills the rest"}
                      </span>
                    )}
                  </div>

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
            {tail && (
              <div className="block-card" style={{ opacity: 0.8 }}>
                <div className="row head between">
                  <span className="row" style={{ gap: 10 }}>
                    <span className="block-type-chip" style={{ background: "var(--blk-retire)" }}>
                      Retirement (implicit)
                    </span>
                    <span className="block-range">{tail}</span>
                  </span>
                </div>
                <span className="notice">
                  No blocks cover these years, so the engine models them as retirement — living off pension,
                  benefits, and withdrawals. Add a Retire block if you want to control the withdrawal policy.
                </span>
              </div>
            )}
              </>
            );
          })()}
          {scenario.blocks.length === 0 && (
            <p className="notice">No blocks yet — add what comes after service with the buttons above.</p>
          )}
        </section>
      </div>
    </>
  );
}
