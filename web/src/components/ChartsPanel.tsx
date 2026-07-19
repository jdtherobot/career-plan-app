/* The chart library: 10 standard financial-planning views, individually
   toggleable. Comparison charts show every path; composition charts show the
   focus path (stacked areas don't overlay well across paths). */

import { useAppState, useDispatch, pathColor, CAT_COLORS, NEGATIVE_COLORS } from "../state/store";
import { Bars, LineChart, StackedArea, type Series } from "./Chart";

interface ChartDef {
  id: string;
  title: string;
  sub: string;
  kind: "compare" | "focus";
}

export const CHART_DEFS: ChartDef[] = [
  { id: "portfolio", title: "Net worth over time", sub: "Total investable assets per path", kind: "compare" },
  { id: "accounts", title: "Savings by account", sub: "TSP · Roth IRA · brokerage · 401(k) · cash", kind: "focus" },
  { id: "income_vs_expenses", title: "Income vs spending", sub: "Total income against total outflow", kind: "focus" },
  { id: "income_comp", title: "Income composition", sub: "Where the money comes from each year", kind: "focus" },
  { id: "expense_comp", title: "Spending composition", sub: "Living costs, healthcare, and taxes", kind: "focus" },
  { id: "savings", title: "Savings put away", sub: "Contributions + employer match + surplus invested", kind: "focus" },
  { id: "net_cf", title: "Net cash flow", sub: "Surplus or deficit each year", kind: "focus" },
  { id: "taxes", title: "Taxes", sub: "Annual taxes per path", kind: "compare" },
  { id: "healthcare", title: "Healthcare cost", sub: "Annual healthcare per path", kind: "compare" },
  { id: "retirement_income", title: "Retirement income sources", sub: "Pension, Social Security, VA, withdrawals", kind: "focus" },
];

function deflate(row: any, value: number, real: boolean): number {
  return real ? value * (row.realDollarFactor ?? 1) : value;
}

export function ChartsPanel() {
  const state = useAppState();
  const dispatch = useDispatch();
  const { results, realDollars, theme, chartsEnabled, focusPathId } = state;
  if (!results) return null;

  const scenarios: any[] = results.scenarios;
  const focus = scenarios.find((s) => s.scenarioId === focusPathId) ?? scenarios[0];
  const cat = CAT_COLORS[theme];
  const unit = realDollars ? "real 2026$" : "nominal";

  const compareSeries = (metric: (row: any) => number): Series[] =>
    scenarios.map((entry, i) => ({
      id: entry.scenarioId,
      name: entry.scenarioName,
      color: pathColor(i, theme),
      points: entry.projection.map((row: any) => ({ x: row.calendarYear, y: deflate(row, metric(row), realDollars) })),
    }));

  const focusSeries = (defs: { id: string; name: string; color: string; metric: (row: any) => number }[]): Series[] =>
    defs.map((d) => ({
      id: d.id,
      name: d.name,
      color: d.color,
      points: focus.projection.map((row: any) => ({ x: row.calendarYear, y: deflate(row, d.metric(row), realDollars) })),
    }));

  function render(def: ChartDef) {
    switch (def.id) {
      case "portfolio":
        return <LineChart series={compareSeries((r) => r.portfolio)} yLabel={`Portfolio, ${unit}`} />;
      case "taxes":
        return <LineChart series={compareSeries((r) => r.taxes + (r.withdrawals?.taxesOnWithdrawals ?? 0))} yLabel={`Taxes/yr, ${unit}`} />;
      case "healthcare":
        return <LineChart series={compareSeries((r) => r.healthcareCost)} yLabel={`Healthcare/yr, ${unit}`} />;
      case "accounts":
        return (
          <StackedArea
            series={focusSeries([
              { id: "cash", name: "Cash", color: cat[0], metric: (r) => r.accountBalances?.cash ?? 0 },
              { id: "brokerage", name: "Brokerage", color: cat[1], metric: (r) => r.accountBalances?.brokerage ?? 0 },
              { id: "tsp", name: "TSP (Roth)", color: cat[2], metric: (r) => r.accountBalances?.tspRoth ?? 0 },
              { id: "roth", name: "Roth IRA", color: cat[3], metric: (r) => r.accountBalances?.rothIra ?? 0 },
              { id: "401k", name: "Trad 401(k)", color: cat[4], metric: (r) => r.accountBalances?.trad401k ?? 0 },
            ])}
            yLabel={`Balances, ${unit}`}
          />
        );
      case "income_vs_expenses":
        return (
          <LineChart
            series={focusSeries([
              { id: "inc", name: "Total income", color: cat[2], metric: (r) => r.totalIncome },
              { id: "out", name: "Total outflow", color: cat[0], metric: (r) => r.taxes + r.healthcareCost + r.livingExpenses },
            ])}
            yLabel={`Per year, ${unit}`}
          />
        );
      case "income_comp":
        return (
          <StackedArea
            series={focusSeries([
              { id: "mil", name: "Military pay", color: cat[5], metric: (r) => r.incomeBreakdown.militaryBasePay + r.incomeBreakdown.militaryBah + r.incomeBreakdown.militaryBas },
              { id: "pension", name: "Pension", color: cat[0], metric: (r) => r.incomeBreakdown.pension },
              { id: "salary", name: "Salary", color: cat[1], metric: (r) => r.incomeBreakdown.salaryBase },
              { id: "stipend", name: "Stipend", color: cat[3], metric: (r) => r.incomeBreakdown.phdStipend },
              { id: "va", name: "VA + GI Bill", color: cat[2], metric: (r) => r.incomeBreakdown.vaCompensation + r.incomeBreakdown.giBillHousing + r.incomeBreakdown.giBillBooks },
              { id: "ss", name: "Social Security", color: cat[4], metric: (r) => r.incomeBreakdown.socialSecurity ?? 0 },
            ])}
            yLabel={`Income/yr, ${unit}`}
          />
        );
      case "expense_comp":
        return (
          <StackedArea
            series={focusSeries([
              { id: "housing", name: "Housing", color: cat[0], metric: (r) => r.expenseBreakdown.housing ?? 0 },
              { id: "food", name: "Food", color: cat[2], metric: (r) => r.expenseBreakdown.food ?? 0 },
              { id: "transport", name: "Transport + utilities", color: cat[3], metric: (r) => (r.expenseBreakdown.transportation ?? 0) + (r.expenseBreakdown.utilities ?? 0) },
              { id: "other", name: "Other living", color: cat[5], metric: (r) => Math.max((r.livingExpenses ?? 0) - (r.expenseBreakdown.housing ?? 0) - (r.expenseBreakdown.food ?? 0) - (r.expenseBreakdown.transportation ?? 0) - (r.expenseBreakdown.utilities ?? 0), 0) },
              { id: "health", name: "Healthcare", color: cat[1], metric: (r) => r.healthcareCost },
              { id: "taxes", name: "Taxes", color: cat[4], metric: (r) => r.taxes },
            ])}
            yLabel={`Spending/yr, ${unit}`}
          />
        );
      case "savings":
        return (
          <Bars
            series={focusSeries([
              { id: "contrib", name: "Retirement contributions", color: cat[2], metric: (r) => r.retirementSavings },
              { id: "match", name: "Employer match", color: cat[4], metric: (r) => r.employerMatch ?? 0 },
              { id: "surplus", name: "Surplus invested", color: cat[1], metric: (r) => r.positiveSurplusInvested },
            ])}
            yLabel={`Saved/yr, ${unit}`}
            negativeColor={NEGATIVE_COLORS[theme]}
          />
        );
      case "net_cf":
        return (
          <Bars
            series={focusSeries([{ id: "ncf", name: "Net cash flow", color: cat[2], metric: (r) => r.netCashFlow }])}
            yLabel={`Net CF/yr, ${unit}`}
            negativeColor={NEGATIVE_COLORS[theme]}
          />
        );
      case "retirement_income":
        return (
          <StackedArea
            series={focusSeries([
              { id: "pension", name: "Pension", color: cat[0], metric: (r) => r.retirementIncome?.pension ?? 0 },
              { id: "ss", name: "Social Security", color: cat[4], metric: (r) => r.retirementIncome?.socialSecurity ?? 0 },
              { id: "va", name: "VA", color: cat[2], metric: (r) => r.retirementIncome?.vaCompensation ?? 0 },
              { id: "wd", name: "Account withdrawals", color: cat[1], metric: (r) => (r.withdrawals?.brokerage ?? 0) + (r.withdrawals?.trad401k ?? 0) + (r.withdrawals?.tspRoth ?? 0) + (r.withdrawals?.rothIra ?? 0) + (r.withdrawals?.cash ?? 0) },
            ])}
            yLabel={`Income/yr, ${unit}`}
          />
        );
      default:
        return null;
    }
  }

  const anyFocusChart = chartsEnabled.some((id) => CHART_DEFS.find((d) => d.id === id)?.kind === "focus");

  return (
    <section style={{ marginTop: 16 }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row between">
          <h3 style={{ margin: 0 }}>Charts</h3>
          {anyFocusChart && (
            <div className="row">
              <label className="field" style={{ margin: 0 }}>Focus path</label>
              <select
                style={{ width: "auto" }}
                value={focus.scenarioId}
                onChange={(e) => dispatch({ type: "setFocusPath", id: e.target.value })}
              >
                {scenarios.map((s) => (
                  <option key={s.scenarioId} value={s.scenarioId}>{s.scenarioName}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          {CHART_DEFS.map((def) => {
            const on = chartsEnabled.includes(def.id);
            return (
              <button
                key={def.id}
                className="small"
                aria-pressed={on}
                style={on ? { background: "var(--ink)", color: "var(--card)", borderColor: "var(--ink)" } : {}}
                onClick={() =>
                  dispatch({
                    type: "setChartsEnabled",
                    charts: on ? chartsEnabled.filter((c) => c !== def.id) : [...chartsEnabled, def.id],
                  })
                }
              >
                {def.title}
              </button>
            );
          })}
        </div>
      </div>

      {CHART_DEFS.filter((def) => chartsEnabled.includes(def.id)).map((def) => (
        <section className="card" style={{ marginBottom: 14 }} key={def.id}>
          <h3>
            {def.title}
            {def.kind === "focus" && <span className="sub" style={{ marginLeft: 8, display: "inline" }}>— {focus.scenarioName}</span>}
          </h3>
          <p className="sub">{def.sub}</p>
          {render(def)}
        </section>
      ))}
    </section>
  );
}
