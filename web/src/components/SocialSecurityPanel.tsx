/* Social Security, worked out from SSA's formula and this path's own earnings —
   pick the age you start collecting and the monthly amount follows. An SSA
   statement figure can replace the estimate if you have one. */

import { fmtMoney } from "../state/store";

const AGES = [62, 63, 64, 65, 66, 67, 68, 69, 70];

interface Props {
  retirement: any;
  entry: any | undefined; // this path's computed results
  onChange: (patch: any) => void;
}

export function SocialSecurityPanel({ retirement, entry, onChange }: Props) {
  const ss = entry?.metrics?.socialSecurity;
  const mode = retirement.ssMode === "statement" ? "statement" : "auto";
  const claimAge = Number(retirement.ssClaimAge ?? 67);
  const rows: any[] = entry?.projection ?? [];
  // Today's dollars: deflate by the projection's own inflation factor for that year.
  const realFactor = (year: number) => rows.find((r) => r.calendarYear === year)?.realDollarFactor ?? null;
  const birthYear: number | undefined = ss?.birthYear;
  const todays = (age: number, nominal: number) => {
    if (!birthYear) return null;
    const f = realFactor(birthYear + age);
    return f ? nominal * f : null;
  };
  const byAge: Record<string, number> = ss?.monthlyByClaimAge ?? {};
  const detail = ss?.detail;
  const chosen = byAge[String(claimAge)];

  return (
    <div className="ss-panel">
      <label className="field" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="checkbox"
          checked={retirement.socialSecurityEnabled}
          onChange={(e) => onChange({ socialSecurityEnabled: e.target.checked })}
        />
        Social Security
      </label>
      {retirement.socialSecurityEnabled && (
        <>
          <label className="field">Start collecting at</label>
          <div className="ss-ages" role="radiogroup" aria-label="Social Security claim age">
            {AGES.map((age) => {
              const nominal = byAge[String(age)];
              const real = nominal ? todays(age, nominal) : null;
              return (
                <button
                  key={age}
                  role="radio"
                  aria-checked={age === claimAge}
                  className={age === claimAge ? "on" : ""}
                  onClick={() => onChange({ ssClaimAge: age })}
                  title={nominal ? `${fmtMoney(nominal)}/mo in ${birthYear ? birthYear + age : ""} dollars` : undefined}
                >
                  <span className="ss-age">{age}</span>
                  {mode === "auto" && real ? <span className="ss-amt">${(real / 1000).toFixed(1)}K</span> : null}
                </button>
              );
            })}
          </div>

          {mode === "auto" ? (
            chosen ? (
              <div className="ss-result">
                <div>
                  <strong>{fmtMoney(todays(claimAge, chosen) ?? chosen)}</strong>
                  <span>/mo in today's dollars</span>
                </div>
                <p className="notice" style={{ margin: "2px 0 0" }}>
                  {fmtMoney(chosen)}/mo when it starts in {birthYear ? birthYear + claimAge : "—"}, then rising with COLAs.
                  {claimAge < 67 ? ` Claiming before 67 permanently reduces it (×${detail?.claimFactor ?? ""}).` : ""}
                  {claimAge > 67 ? ` Waiting past 67 adds delayed credits (×${detail?.claimFactor ?? ""}).` : ""}
                </p>
                {detail && (
                  <details className="ss-how">
                    <summary>How it's figured</summary>
                    <p>
                      SSA's formula on this path's earnings: military basic pay and civilian salary each year (capped at that
                      year's taxable maximum), wage-indexed to age 60. Your highest {detail.yearsCounted} years average{" "}
                      <strong>{fmtMoney(detail.aime)}</strong>/mo (AIME). Benefit at full retirement age (PIA) = 90% of the first{" "}
                      {fmtMoney(detail.bendPoints?.[0])} + 32% up to {fmtMoney(detail.bendPoints?.[1])} + 15% above ={" "}
                      <strong>{fmtMoney(detail.pia)}</strong>/mo in {detail.eligibilityYear} (the year you turn 62).
                    </p>
                    {ss?.assumedPastGrades?.length ? (
                      <p>
                        Past service pay assumes a typical progression (
                        {ss.assumedPastGrades.map((g: any) => `${g.grade} ${g.year}`).join(", ")}). Add your actual past
                        promotions above to refine it.
                      </p>
                    ) : null}
                    <p>
                      Grad stipends aren't Social Security wages, so school years add no credit. Sources: SSA's Federal
                      Register notices — <a href="#sources:ssa-determinations">Sources → Official documents</a>.
                    </p>
                  </details>
                )}
              </div>
            ) : (
              <p className="notice">Calculating…</p>
            )
          ) : (
            <div>
              <label className="field" htmlFor="ss-statement">Monthly at full retirement age (67), from your SSA statement</label>
              <input
                id="ss-statement"
                type="number"
                min={0}
                step={10}
                value={retirement.ssFraMonthly}
                onChange={(e) => onChange({ ssFraMonthly: Number(e.target.value) })}
              />
              <p className="notice" style={{ margin: "4px 0 0" }}>
                Find it at <a href="https://www.ssa.gov/myaccount/" target="_blank" rel="noreferrer noopener">ssa.gov/myaccount</a> (in
                today's dollars).
              </p>
            </div>
          )}
          <button className="linkish" style={{ marginTop: 6 }} onClick={() => onChange({ ssMode: mode === "auto" ? "statement" : "auto" })}>
            {mode === "auto" ? "Use my SSA statement instead" : "Back to the automatic estimate"}
          </button>
        </>
      )}
    </div>
  );
}
