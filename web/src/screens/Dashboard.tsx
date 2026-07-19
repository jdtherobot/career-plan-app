/* Home: side-by-side path cards, biggest-driver + breakeven callout, the
   chart library, and the service-ribbon timelines. */

import { useState } from "react";
import { useAppState, useDispatch, fmtMoney, pathColor } from "../state/store";
import { ChartsPanel } from "../components/ChartsPanel";
import { Ribbon, RibbonScale } from "../components/Ribbon";

/* Long-horizon planning stats (standard retirement-readiness metrics):
   net worth at +20y and at retirement start, sustainable income (4% rule),
   spending-replacement ratio at retirement, and average savings rate. */
export function longTermStats(entry: any, realDollars: boolean) {
  const rows: any[] = entry.projection;
  const value = (row: any, v: number) => (realDollars ? v * (row.realDollarFactor ?? 1) : v);

  const retRow =
    rows.find((r) => r.activityType === "retire") ??
    rows.find((r) => r.age >= 65) ??
    rows[rows.length - 1];
  const plus20 = rows[20] ?? rows[rows.length - 1];

  const spendAtRet = retRow.taxes + retRow.healthcareCost + retRow.livingExpenses;
  const guaranteed =
    (retRow.retirementIncome?.pension ?? 0) +
    (retRow.retirementIncome?.socialSecurity ?? 0) +
    (retRow.retirementIncome?.vaCompensation ?? 0);
  const sustainable = 0.04 * retRow.portfolio;
  const replacement = spendAtRet > 0 ? (guaranteed + sustainable) / spendAtRet : null;

  const first20 = rows.slice(0, 20);
  const saved = first20.reduce(
    (s, r) => s + r.retirementSavings + (r.employerMatch ?? 0) + r.positiveSurplusInvested,
    0,
  );
  const earned = first20.reduce((s, r) => s + r.totalIncome, 0);

  return {
    retYear: retRow.calendarYear,
    retIsProxy: retRow.activityType !== "retire",
    netWorthAtRet: value(retRow, retRow.portfolio),
    netWorthPlus20: value(plus20, plus20.portfolio),
    plus20Year: plus20.calendarYear,
    sustainableIncome: value(retRow, sustainable),
    guaranteedIncome: value(retRow, guaranteed),
    replacement,
    savingsRate: earned > 0 ? saved / earned : 0,
    finalReal: entry.metrics.finalPortfolioReal,
    finalNominal: entry.metrics.finalPortfolio,
  };
}

function PathCard({ entry, index, baseline }: { entry: any; index: number; baseline: boolean }) {
  const { realDollars, theme, results } = useAppState();
  const dispatch = useDispatch();
  const [expanded, setExpanded] = useState(false);
  const m = entry.metrics;
  const s = longTermStats(entry, realDollars);
  const hash8 = results?.inputHash?.slice(0, 8) ?? "";
  const unit = realDollars ? "real 2026$" : "nominal";
  return (
    <article className="card">
      <h3>
        <span className="pathdot" style={{ background: pathColor(index, theme) }} />
        {entry.scenarioName}
        {baseline && <span className="override-badge" style={{ background: "var(--line-2)", color: "var(--ink-2)" }}>baseline</span>}
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
        </tbody>
      </table>
      {expanded && (
        <table className="kv" style={{ marginTop: 6 }}>
          <tbody>
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
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="small" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Fewer details ▲" : "More details ▼"}
        </button>
        {!baseline && (
          <button className="small" onClick={() => dispatch({ type: "setBaseline", id: entry.scenarioId })}>
            Set as baseline
          </button>
        )}
        <a className="small" href="#paths" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
          Edit path →
        </a>
      </div>
      <span className="stencil">{`PATH.${String(index + 1).padStart(2, "0")} · ${hash8}`}</span>
    </article>
  );
}

export function Dashboard() {
  const state = useAppState();
  const dispatch = useDispatch();
  const { results, realDollars, errors, engineStatus } = state;
  const [breakdownsCollapsed, setBreakdownsCollapsed] = useState(false);
  // Dismissed callouts are keyed by their CONTENT, so any change to the
  // numbers brings them back; refresh clears the set entirely.
  const [dismissedCallouts, setDismissedCallouts] = useState<Set<string>>(new Set());

  if (errors) {
    return (
      <>
        <header className="screen-head">
          <h2>Dashboard</h2>
        </header>
        <div className="error-box">
          <strong>A path needs attention before projections can run:</strong>
          <ul>
            {Object.entries(errors).map(([id, list]) =>
              list.map((e, i) => <li key={`${id}-${i}`}>{id}: {e}</li>),
            )}
          </ul>
          <a href="#paths">Open the Path Builder to fix it →</a>
        </div>
      </>
    );
  }

  if (!results) {
    return (
      <>
        <header className="screen-head">
          <h2>Dashboard</h2>
          <p>
            {engineStatus === "error"
              ? "The in-browser engine failed to load. Check your connection and refresh."
              : "Loading the projection engine in your browser — first visit takes a few seconds; after that it's instant. Nothing you enter leaves this device."}
          </p>
        </header>
      </>
    );
  }

  const scenarios = results.scenarios as any[];
  const comparison = results.comparison;
  const baselineId = comparison.baselineScenarioId;

  return (
    <>
      <header className="screen-head">
        <div className="row between">
          <div>
            <h2>Dashboard</h2>
            <p>Deterministic 50-year comparison. Change anything — it recomputes in your browser.</p>
          </div>
          <div className="toggle" role="group" aria-label="Dollar mode">
            <button className={realDollars ? "on" : ""} onClick={() => dispatch({ type: "setRealDollars", value: true })}>
              Real 2026$
            </button>
            <button className={!realDollars ? "on" : ""} onClick={() => dispatch({ type: "setRealDollars", value: false })}>
              Nominal
            </button>
          </div>
        </div>
      </header>

      <div className="grid paths">
        {scenarios.map((entry, i) => (
          <PathCard key={entry.scenarioId} entry={entry} index={i} baseline={entry.scenarioId === baselineId} />
        ))}
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h3>
          <button
            className="collapse-toggle"
            aria-expanded={!breakdownsCollapsed}
            aria-label={breakdownsCollapsed ? "Expand path breakdowns" : "Collapse path breakdowns"}
            onClick={() => setBreakdownsCollapsed(!breakdownsCollapsed)}
          >
            {breakdownsCollapsed ? "▸" : "▾"}
          </button>
          Path breakdowns
        </h3>
        {!breakdownsCollapsed && (
          <>
            <p className="sub">Each ribbon is one path — segment width is time spent in that phase.</p>
            {scenarios.map((entry) => (
              <Ribbon key={entry.scenarioId} label={entry.scenarioName} projection={entry.projection} />
            ))}
            <RibbonScale projection={scenarios[0]?.projection ?? []} />
          </>
        )}
      </section>

      {comparison.comparisons.map((item: any) => {
        const candidate = scenarios.find((s) => s.scenarioId === item.scenarioId);
        const base = scenarios.find((s) => s.scenarioId === baselineId);
        const delta = realDollars ? item.finalPortfolioRealDelta : item.finalPortfolioDelta;
        const ahead = delta >= 0 ? candidate?.scenarioName : base?.scenarioName;
        const key = [item.scenarioId, baselineId, delta, item.breakevenYear, item.biggestDriver.label, item.biggestDriver.cumulativeDelta].join("|");
        if (dismissedCallouts.has(key)) return null;
        return (
          <div className="callout" key={item.scenarioId}>
            <strong>{candidate?.scenarioName} vs {base?.scenarioName}:</strong>{" "}
            {ahead} finishes ahead by {fmtMoney(Math.abs(delta), true)} ({realDollars ? "real" : "nominal"}).
            Biggest driver: {item.biggestDriver.label.toLowerCase()} ({fmtMoney(item.biggestDriver.cumulativeDelta, true)} cumulative).
            {" "}Breakeven: {item.breakevenYear ?? "never"}.
            <button
              className="callout-x"
              aria-label="Dismiss note (returns if the numbers change)"
              title="Dismiss — returns if the numbers change or on refresh"
              onClick={() => setDismissedCallouts(new Set([...dismissedCallouts, key]))}
            >
              ✕
            </button>
          </div>
        );
      })}

      <ChartsPanel />
    </>
  );
}
