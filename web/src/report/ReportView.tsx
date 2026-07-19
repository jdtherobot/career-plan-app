/* Static single-page report: the Dashboard's path cards, ribbons, callouts,
   and full chart library, then the Explorer's per-path annual tables and
   composition charts. Rendered with renderToStaticMarkup — every component
   here must paint completely on first render (no effects, no dead buttons). */

import { LineChart, type Series } from "../components/Chart";
import { CHART_DEFS } from "../components/ChartsPanel";
import { CompositionPanel } from "../components/CompositionPanel";
import { Ribbon, RibbonScale } from "../components/Ribbon";
import { longTermStats } from "../screens/Dashboard";
import { fmtMoney, pathColor, useAppState } from "../state/store";

function deflate(row: any, value: number, real: boolean): number {
  return real ? value * (row.realDollarFactor ?? 1) : value;
}

/* Path card with every detail visible — the live card's collapsed rows are
   simply always shown here. */
function StaticPathCard({ entry, index, baseline, realDollars, theme, hash8 }: any) {
  const m = entry.metrics;
  const s = longTermStats(entry, realDollars);
  const unit = realDollars ? "real 2026$" : "nominal";
  return (
    <article className="card">
      <h3>
        <span className="pathdot" style={{ background: pathColor(index, theme) }} />
        {entry.scenarioName}
        {baseline && (
          <span className="override-badge" style={{ background: "var(--line-2)", color: "var(--ink-2)" }}>
            baseline
          </span>
        )}
      </h3>
      <p className="sub">{entry.scenario.notes || "Custom path"}</p>
      <p className="headline">
        {fmtMoney(s.netWorthAtRet, true)}
        <span className="unit">
          {unit} at retirement{s.retIsProxy ? " (65)" : ""} · {s.retYear}
        </span>
      </p>
      <table className="kv">
        <tbody>
          <tr><td>Net worth in 20 yrs ({s.plus20Year})</td><td>{fmtMoney(s.netWorthPlus20, true)}</td></tr>
          <tr><td>Sustainable draw at retirement</td><td>{fmtMoney(s.sustainableIncome, true)}/yr</td></tr>
          <tr><td>Guaranteed income (pension·SS·VA)</td><td>{fmtMoney(s.guaranteedIncome, true)}/yr</td></tr>
          <tr>
            <td>Retirement spending covered</td>
            <td style={s.replacement !== null && s.replacement < 1 ? { color: "var(--danger)" } : {}}>
              {s.replacement === null ? "—" : `${Math.round(s.replacement * 100)}%`}
            </td>
          </tr>
          <tr><td>Avg savings rate (next 20 yrs)</td><td>{Math.round(s.savingsRate * 100)}%</td></tr>
          {m.depletionAge && <tr><td style={{ color: "var(--danger)" }}>Depletes at age</td><td>{m.depletionAge}</td></tr>}
          {m.totalUnfundedSpending > 0 && (
            <tr><td style={{ color: "var(--danger)" }}>Unfunded spending</td><td>{fmtMoney(m.totalUnfundedSpending, true)}</td></tr>
          )}
          <tr><td>Pension starts</td><td>{m.pensionStartYear ?? "never"}</td></tr>
          <tr><td>Social Security starts</td><td>{m.ssStartYear ?? "—"}</td></tr>
          <tr><td>Withdrawals eligible</td><td>{m.withdrawalEligibleYear}</td></tr>
          <tr><td>Lifetime taxes</td><td>{fmtMoney(m.totalTaxes, true)}</td></tr>
          <tr><td>Lifetime healthcare</td><td>{fmtMoney(m.totalHealthcareCost, true)}</td></tr>
          <tr><td>Employer match (lifetime)</td><td>{fmtMoney(m.totalEmployerMatch, true)}</td></tr>
          <tr><td>Pension paid (lifetime)</td><td>{fmtMoney(m.lifetimePensionValue, true)}</td></tr>
          <tr><td>Net worth at 86 (real)</td><td>{fmtMoney(s.finalReal, true)}</td></tr>
          <tr><td>Net worth at 86 (nominal)</td><td>{fmtMoney(s.finalNominal, true)}</td></tr>
        </tbody>
      </table>
      <span className="stencil">{`PATH.${String(index + 1).padStart(2, "0")} · ${hash8}`}</span>
    </article>
  );
}

/* Annual detail columns — the Explorer's key numbers in one wide table. */
const REPORT_COLUMNS: { label: string; value: (r: any) => any }[] = [
  { label: "Phase", value: (r) => r.phaseLabel },
  { label: "Gross", value: (r) => fmtMoney(r.grossIncome, true) },
  { label: "Tax-free", value: (r) => fmtMoney(r.taxFreeIncome, true) },
  { label: "Total income", value: (r) => fmtMoney(r.totalIncome, true) },
  { label: "Taxes", value: (r) => fmtMoney(r.taxes, true) },
  { label: "Healthcare", value: (r) => fmtMoney(r.healthcareCost, true) },
  { label: "Living", value: (r) => fmtMoney(r.livingExpenses, true) },
  { label: "Contrib.", value: (r) => fmtMoney(r.retirementSavings, true) },
  { label: "Match", value: (r) => fmtMoney(r.employerMatch ?? 0, true) },
  { label: "Net CF", value: (r) => fmtMoney(r.netCashFlow, true) },
  {
    label: "W/D",
    value: (r) =>
      fmtMoney(
        (r.withdrawals?.brokerage ?? 0) +
          (r.withdrawals?.trad401k ?? 0) +
          (r.withdrawals?.tspRoth ?? 0) +
          (r.withdrawals?.rothIra ?? 0) +
          (r.withdrawals?.cash ?? 0),
        true,
      ),
  },
  { label: "Unfunded", value: (r) => fmtMoney(r.unfundedSpending ?? 0, true) },
  { label: "Portfolio", value: (r) => fmtMoney(r.portfolio, true) },
  { label: "Portfolio (real)", value: (r) => fmtMoney((r.portfolio ?? 0) * (r.realDollarFactor ?? 1), true) },
];

export function ReportView({ generatedAt }: { generatedAt: string }) {
  const state = useAppState();
  const { results, theme, realDollars } = state;
  if (!results) return null;

  const scenarios: any[] = results.scenarios;
  const comparison = results.comparison;
  const baselineId = comparison.baselineScenarioId;
  const hash8 = results.inputHash?.slice(0, 8) ?? "";
  const unit = realDollars ? "real 2026$" : "nominal";

  const compareSeries = (metric: (row: any) => number): Series[] =>
    scenarios.map((entry, i) => ({
      id: entry.scenarioId,
      name: entry.scenarioName,
      color: pathColor(i, theme),
      points: entry.projection.map((row: any) => ({
        x: row.calendarYear,
        y: deflate(row, metric(row), realDollars),
      })),
    }));

  return (
    <main className="report">
      <header className="screen-head">
        <h2>Career Plan Codex — full report</h2>
        <p>
          Deterministic 50-year comparison · generated {generatedAt} · charts in {unit} · input hash{" "}
          <span style={{ fontFamily: "var(--font-mono)" }}>{hash8}</span>
        </p>
      </header>

      <div className="grid paths">
        {scenarios.map((entry, i) => (
          <StaticPathCard
            key={entry.scenarioId}
            entry={entry}
            index={i}
            baseline={entry.scenarioId === baselineId}
            realDollars={realDollars}
            theme={theme}
            hash8={hash8}
          />
        ))}
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Path breakdowns</h3>
        <p className="sub">Each ribbon is one path — segment width is time spent in that phase.</p>
        {scenarios.map((entry) => (
          <Ribbon key={entry.scenarioId} label={entry.scenarioName} projection={entry.projection} />
        ))}
        <RibbonScale projection={scenarios[0]?.projection ?? []} />
      </section>

      {comparison.comparisons.map((item: any) => {
        const candidate = scenarios.find((s) => s.scenarioId === item.scenarioId);
        const base = scenarios.find((s) => s.scenarioId === baselineId);
        const delta = realDollars ? item.finalPortfolioRealDelta : item.finalPortfolioDelta;
        const ahead = delta >= 0 ? candidate?.scenarioName : base?.scenarioName;
        return (
          <div className="callout" key={item.scenarioId}>
            <strong>
              {candidate?.scenarioName} vs {base?.scenarioName}:
            </strong>{" "}
            {ahead} finishes ahead by {fmtMoney(Math.abs(delta), true)} ({realDollars ? "real" : "nominal"}). Biggest
            driver: {item.biggestDriver.label.toLowerCase()} ({fmtMoney(item.biggestDriver.cumulativeDelta, true)}{" "}
            cumulative). Breakeven: {item.breakevenYear ?? "never"}.
          </div>
        );
      })}

      <section style={{ marginTop: 16 }}>
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Compare the paths</h3>
          <p className="sub" style={{ margin: "2px 0 0" }}>
            One line per path on every chart. Per-path composition follows below.
          </p>
        </div>
        {CHART_DEFS.map((def) => (
          <section className="card" style={{ marginBottom: 14 }} key={def.id}>
            <h3 style={{ margin: 0 }}>{def.title}</h3>
            <p className="sub">{def.sub}</p>
            <LineChart series={compareSeries(def.metric)} yLabel={`${def.title}, ${unit}`} />
          </section>
        ))}
      </section>

      <p className="section-h" style={{ marginTop: 28 }}>
        Projection explorer — every year, every number
      </p>
      {scenarios.map((entry, i) => (
        <details key={entry.scenarioId} open={i === 0} className="report-annual">
          <summary>
            <span className="pathdot" style={{ background: pathColor(i, theme), display: "inline-block", marginRight: 6 }} />
            {entry.scenarioName} — annual detail (nominal)
          </summary>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Age</th>
                  {REPORT_COLUMNS.map((c) => (
                    <th key={c.label}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entry.projection.map((row: any) => (
                  <tr key={row.calendarYear}>
                    <td>{row.calendarYear}</td>
                    <td>{row.age}</td>
                    {REPORT_COLUMNS.map((c) => (
                      <td key={c.label}>{c.value(row)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}

      {scenarios.map((entry) => (
        <CompositionPanel key={entry.scenarioId} entry={entry} />
      ))}

      <footer className="report-footer">
        Input hash <span style={{ fontFamily: "var(--font-mono)" }}>{results.inputHash}</span> · Planning estimate with
        simplified effective-rate taxes — not financial advice. Generated by Career Plan Codex.
      </footer>
    </main>
  );
}
