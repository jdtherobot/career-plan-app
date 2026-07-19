/* Composition charts for ONE path — the stacked/multi-part views that can't
   overlay multiple paths. Lives at the bottom of the Explorer, driven by the
   path selected there. */

import { useAppState, CAT_COLORS, NEGATIVE_COLORS } from "../state/store";
import { Bars, LineChart, StackedArea, type Series } from "./Chart";

function deflate(row: any, value: number, real: boolean): number {
  return real ? value * (row.realDollarFactor ?? 1) : value;
}

export function CompositionPanel({ entry }: { entry: any }) {
  const { theme, realDollars } = useAppState();
  const cat = CAT_COLORS[theme];
  const unit = realDollars ? "real 2026$" : "nominal";

  const series = (defs: { id: string; name: string; color: string; metric: (row: any) => number }[]): Series[] =>
    defs.map((d) => ({
      id: d.id,
      name: d.name,
      color: d.color,
      points: entry.projection.map((row: any) => ({
        x: row.calendarYear,
        y: deflate(row, d.metric(row), realDollars),
      })),
    }));

  const sections = [
    {
      title: "Income vs expenses",
      sub: "Total income against total expenses for this path",
      node: (
        <LineChart
          series={series([
            { id: "inc", name: "Total income", color: cat[2], metric: (r) => r.totalIncome },
            { id: "out", name: "Total expenses", color: cat[0], metric: (r) => r.taxes + r.healthcareCost + r.livingExpenses },
          ])}
          yLabel={`Per year, ${unit}`}
        />
      ),
    },
    {
      title: "Income composition",
      sub: "Where the money comes from each year",
      node: (
        <StackedArea
          series={series([
            { id: "mil", name: "Military pay", color: cat[5], metric: (r) => r.incomeBreakdown.militaryBasePay + r.incomeBreakdown.militaryBah + r.incomeBreakdown.militaryBas },
            { id: "pension", name: "Pension", color: cat[0], metric: (r) => r.incomeBreakdown.pension },
            { id: "salary", name: "Salary", color: cat[4], metric: (r) => r.incomeBreakdown.salaryBase },
            { id: "stipend", name: "Stipend", color: cat[3], metric: (r) => r.incomeBreakdown.phdStipend },
            { id: "va", name: "VA + GI Bill", color: cat[2], metric: (r) => r.incomeBreakdown.vaCompensation + r.incomeBreakdown.giBillHousing + r.incomeBreakdown.giBillBooks },
            { id: "ss", name: "Social Security", color: cat[1], metric: (r) => r.incomeBreakdown.socialSecurity ?? 0 },
          ])}
          yLabel={`Income/yr, ${unit}`}
        />
      ),
    },
    {
      title: "Expense composition",
      sub: "Living costs, healthcare, and taxes",
      node: (
        <StackedArea
          series={series([
            { id: "housing", name: "Housing", color: cat[0], metric: (r) => r.expenseBreakdown.housing ?? 0 },
            { id: "food", name: "Food", color: cat[2], metric: (r) => r.expenseBreakdown.food ?? 0 },
            { id: "transport", name: "Transport + utilities", color: cat[3], metric: (r) => (r.expenseBreakdown.transportation ?? 0) + (r.expenseBreakdown.utilities ?? 0) },
            { id: "other", name: "Other living", color: cat[5], metric: (r) => Math.max((r.livingExpenses ?? 0) - (r.expenseBreakdown.housing ?? 0) - (r.expenseBreakdown.food ?? 0) - (r.expenseBreakdown.transportation ?? 0) - (r.expenseBreakdown.utilities ?? 0), 0) },
            { id: "health", name: "Healthcare", color: cat[1], metric: (r) => r.healthcareCost },
            { id: "taxes", name: "Taxes", color: cat[4], metric: (r) => r.taxes },
          ])}
          yLabel={`Expenses/yr, ${unit}`}
        />
      ),
    },
    {
      title: "Savings by account",
      sub: "TSP · Roth IRA · brokerage · 401(k) · cash",
      node: (
        <StackedArea
          series={series([
            { id: "cash", name: "Cash", color: cat[0], metric: (r) => r.accountBalances?.cash ?? 0 },
            { id: "brokerage", name: "Brokerage", color: cat[1], metric: (r) => r.accountBalances?.brokerage ?? 0 },
            { id: "tsp", name: "TSP (Roth)", color: cat[2], metric: (r) => r.accountBalances?.tspRoth ?? 0 },
            { id: "roth", name: "Roth IRA", color: cat[3], metric: (r) => r.accountBalances?.rothIra ?? 0 },
            { id: "401k", name: "Trad 401(k)", color: cat[4], metric: (r) => r.accountBalances?.trad401k ?? 0 },
          ])}
          yLabel={`Balances, ${unit}`}
        />
      ),
    },
    {
      title: "Savings put away",
      sub: "Contributions + employer match + surplus invested",
      node: (
        <Bars
          series={series([
            { id: "contrib", name: "Retirement contributions", color: cat[2], metric: (r) => r.retirementSavings },
            { id: "match", name: "Employer match", color: cat[4], metric: (r) => r.employerMatch ?? 0 },
            { id: "surplus", name: "Surplus invested", color: cat[1], metric: (r) => r.positiveSurplusInvested },
          ])}
          yLabel={`Saved/yr, ${unit}`}
          negativeColor={NEGATIVE_COLORS[theme]}
        />
      ),
    },
    {
      title: "Retirement income sources",
      sub: "Pension, Social Security, VA, account withdrawals",
      node: (
        <StackedArea
          series={series([
            { id: "pension", name: "Pension", color: cat[0], metric: (r) => r.retirementIncome?.pension ?? 0 },
            { id: "ss", name: "Social Security", color: cat[4], metric: (r) => r.retirementIncome?.socialSecurity ?? 0 },
            { id: "va", name: "VA", color: cat[2], metric: (r) => r.retirementIncome?.vaCompensation ?? 0 },
            { id: "wd", name: "Account withdrawals", color: cat[1], metric: (r) => (r.withdrawals?.brokerage ?? 0) + (r.withdrawals?.trad401k ?? 0) + (r.withdrawals?.tspRoth ?? 0) + (r.withdrawals?.rothIra ?? 0) + (r.withdrawals?.cash ?? 0) },
          ])}
          yLabel={`Income/yr, ${unit}`}
        />
      ),
    },
  ];

  return (
    <section style={{ marginTop: 24 }}>
      <p className="section-h">Path composition · {entry.scenarioName}</p>
      <p className="notice" style={{ margin: "0 0 12px" }}>
        These views break one path into its parts — switch paths above and they follow.
      </p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>
        {sections.map((section) => (
          <section className="card" key={section.title}>
            <h3>{section.title}</h3>
            <p className="sub">{section.sub}</p>
            {section.node}
          </section>
        ))}
      </div>
    </section>
  );
}
