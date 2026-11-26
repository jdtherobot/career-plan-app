/* Home: side-by-side path cards, biggest-driver + breakeven callout, the
   chart library, and the service-ribbon timelines. */

import { useState } from "react";
import { useAppState, useDispatch, fmtMoney, pathColor, visiblePaths } from "../state/store";
import { ChartsPanel } from "../components/ChartsPanel";
import { Ribbon, RibbonScale } from "../components/Ribbon";
import { MissingRatesBanner } from "../components/OhaEntry";

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

/* Eye toggle on each path card: is this path drawn on the charts and
   compared in the notes? Any path can be hidden, as long as one stays shown. */
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8z" />
      {open ? <circle cx="8" cy="8" r="2" fill="currentColor" /> : <path d="M2.5 13.5l11-11" />}
    </svg>
  );
}

function PathVisibilityToggle({ entry, shown, lastShown }: { entry: any; shown: boolean; lastShown: boolean }) {
  const dispatch = useDispatch();
  const tip = lastShown
    ? "Shown on charts — at least one path stays visible"
    : shown
      ? "Shown on charts and comparisons — click to hide"
      : "Hidden from charts and comparisons — click to show";
  return (
    <button
      className={`path-vis${shown ? " on" : ""}${lastShown ? " locked" : ""}`}
      aria-pressed={shown}
      aria-disabled={lastShown}
      aria-label={`${entry.scenarioName}: ${tip}`}
      data-tip={tip}
      onClick={() => !lastShown && dispatch({ type: "setPathVisible", id: entry.scenarioId, visible: !shown })}
    >
      <EyeIcon open={shown} />
    </button>
  );
}

function PathCard({ entry, index, baseline, shown, lastShown }: { entry: any; index: number; baseline: boolean; shown: boolean; lastShown: boolean }) {
  const { realDollars, theme, results } = useAppState();
  const dispatch = useDispatch();
  const [expanded, setExpanded] = useState(false);
  const m = entry.metrics;
  const s = longTermStats(entry, realDollars);
  const hash8 = results?.inputHash?.slice(0, 8) ?? "";
  const unit = realDollars ? "real 2026$" : "nominal";
  return (
    <article className={`card path-card${shown ? "" : " path-hidden"}`}>
      <h3 className="path-card-title">
        <span className="pathdot" style={{ background: pathColor(index, theme) }} />
        <span className="path-card-name" title={entry.scenarioName}>{entry.scenarioName}</span>
        <PathVisibilityToggle entry={entry} shown={shown} lastShown={lastShown} />
      </h3>
      <div className="path-card-body">
      <p className="headline">{fmtMoney(s.netWorthAtRet, true)}</p>
      <p className="headline-unit">
        {unit} at retirement{s.retIsProxy ? " (65)" : ""} · {s.retYear}
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
          {/* Always present (even when "none") so every card's rows line up. */}
          <tr>
            <td style={m.depletionAge ? { color: "var(--danger)" } : {}}>Money runs out</td>
            <td style={m.depletionAge ? { color: "var(--danger)" } : {}}>{m.depletionAge ? `age ${m.depletionAge}` : "never"}</td>
          </tr>
          <tr>
            <td style={m.totalUnfundedSpending > 0 ? { color: "var(--danger)" } : {}}>Unfunded spending</td>
            <td style={m.totalUnfundedSpending > 0 ? { color: "var(--danger)" } : {}}>
              {m.totalUnfundedSpending > 0 ? fmtMoney(m.totalUnfundedSpending, true) : "none"}
            </td>
          </tr>
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
      <div className="path-card-actions">
        <button className="small" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Less ▲" : "More ▼"}
        </button>
        <button
          className={`small${baseline ? " is-baseline" : ""}`}
          disabled={baseline}
          title={baseline ? "Other paths are compared against this one" : "Compare the other paths against this one"}
          onClick={() => dispatch({ type: "setBaseline", id: entry.scenarioId })}
        >
          {baseline ? "Baseline ✓" : "Set as baseline"}
        </button>
        <a className="small" href="#paths" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginLeft: "auto" }}>
          Edit →
        </a>
      </div>
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
  const shown = visiblePaths(scenarios, state.hiddenPathIds, baselineId);
  const shownIds = new Set(shown.map(({ entry }) => entry.scenarioId));
  const baselineName = scenarios.find((s) => s.scenarioId === baselineId)?.scenarioName;
  const visibleComparisons = (comparison.comparisons as any[]).filter((item) => shownIds.has(item.scenarioId));

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

      <MissingRatesBanner scenarios={scenarios} />

      <div className="grid paths">
        {scenarios.map((entry, i) => (
          <PathCard
            key={entry.scenarioId}
            entry={entry}
            index={i}
            baseline={entry.scenarioId === baselineId}
            shown={shownIds.has(entry.scenarioId)}
            lastShown={shownIds.size === 1 && shownIds.has(entry.scenarioId)}
          />
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
            {shown.map(({ entry }) => (
              <Ribbon key={entry.scenarioId} label={entry.scenarioName} projection={entry.projection} />
            ))}
            <RibbonScale projection={scenarios[0]?.projection ?? []} />
          </>
        )}
      </section>

      {visibleComparisons.length > 0 && (
        <p className="compare-head">
          Compared with baseline <strong>{baselineName}</strong>
          {shownIds.has(baselineId) ? "" : " (hidden from charts)"} · {visibleComparisons.length} of{" "}
          {scenarios.length - 1} other path{scenarios.length - 1 === 1 ? "" : "s"} shown — use the eye on a path card to
          add or drop one, or “Set as baseline” to change the anchor.
        </p>
      )}
      {visibleComparisons.map((item: any) => {
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
