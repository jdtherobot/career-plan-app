/* Home: side-by-side path cards, biggest-driver + breakeven callout, the
   portfolio chart (real/nominal), and the service-ribbon timelines. */

import { useAppState, useDispatch, fmtMoney, pathColor } from "../state/store";
import { ChartsPanel } from "../components/ChartsPanel";
import { Ribbon, RibbonScale } from "../components/Ribbon";

function PathCard({ entry, index, baseline }: { entry: any; index: number; baseline: boolean }) {
  const { realDollars, theme } = useAppState();
  const dispatch = useDispatch();
  const m = entry.metrics;
  const headline = realDollars ? m.finalPortfolioReal : m.finalPortfolio;
  return (
    <article className="card">
      <h3>
        <span className="pathdot" style={{ background: pathColor(index, theme) }} />
        {entry.scenarioName}
        {baseline && <span className="override-badge" style={{ background: "var(--line-2)", color: "var(--ink-2)" }}>baseline</span>}
      </h3>
      <p className="sub">{entry.scenario.notes || "Custom path"}</p>
      <p className="headline">
        {fmtMoney(headline, true)}
        <span className="unit">{realDollars ? "real 2026$" : "nominal"} at horizon</span>
      </p>
      <table className="kv">
        <tbody>
          <tr><td>Lifetime taxes</td><td>{fmtMoney(m.totalTaxes, true)}</td></tr>
          <tr><td>Lifetime healthcare</td><td>{fmtMoney(m.totalHealthcareCost, true)}</td></tr>
          <tr><td>Employer match</td><td>{fmtMoney(m.totalEmployerMatch, true)}</td></tr>
          <tr><td>Pension starts</td><td>{m.pensionStartYear ?? "never"}</td></tr>
          <tr><td>Social Security</td><td>{m.ssStartYear ?? "—"}</td></tr>
          <tr><td>Withdrawals eligible</td><td>{m.withdrawalEligibleYear}</td></tr>
          {m.depletionAge && <tr><td style={{ color: "var(--danger)" }}>Depletes at age</td><td>{m.depletionAge}</td></tr>}
          {m.totalUnfundedSpending > 0 && (
            <tr><td style={{ color: "var(--danger)" }}>Unfunded spending</td><td>{fmtMoney(m.totalUnfundedSpending, true)}</td></tr>
          )}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 10 }}>
        {!baseline && (
          <button className="small" onClick={() => dispatch({ type: "setBaseline", id: entry.scenarioId })}>
            Set as baseline
          </button>
        )}
        <a className="small" href="#paths" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
          Edit path →
        </a>
      </div>
    </article>
  );
}

export function Dashboard() {
  const state = useAppState();
  const dispatch = useDispatch();
  const { results, realDollars, errors, engineStatus } = state;

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

      {comparison.comparisons.map((item: any) => {
        const candidate = scenarios.find((s) => s.scenarioId === item.scenarioId);
        const base = scenarios.find((s) => s.scenarioId === baselineId);
        const delta = realDollars ? item.finalPortfolioRealDelta : item.finalPortfolioDelta;
        const ahead = delta >= 0 ? candidate?.scenarioName : base?.scenarioName;
        return (
          <div className="callout" key={item.scenarioId}>
            <strong>{candidate?.scenarioName} vs {base?.scenarioName}:</strong>{" "}
            {ahead} finishes ahead by {fmtMoney(Math.abs(delta), true)} ({realDollars ? "real" : "nominal"}).
            Biggest driver: {item.biggestDriver.label.toLowerCase()} ({fmtMoney(item.biggestDriver.cumulativeDelta, true)} cumulative).
            {" "}Breakeven: {item.breakevenYear ?? "never"}.
          </div>
        );
      })}

      <ChartsPanel />

      <section className="card" style={{ marginTop: 16 }}>
        <h3>Life-phase timelines</h3>
        <p className="sub">Each ribbon is one path — segment width is time spent in that phase.</p>
        {scenarios.map((entry) => (
          <Ribbon key={entry.scenarioId} label={entry.scenarioName} projection={entry.projection} />
        ))}
        <RibbonScale projection={scenarios[0]?.projection ?? []} />
      </section>
    </>
  );
}
