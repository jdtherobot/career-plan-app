/* Composition charts for ONE path — the stacked/multi-part views that can't
   overlay multiple paths. Lives at the bottom of the Explorer, driven by the
   path selected there. Every chart can switch between its line/area view and
   a stacked bar per year; a category keeps its colour in both. */

import { useState, type ReactNode } from "react";
import { useAppState, NEGATIVE_COLORS, STACK_COLORS } from "../state/store";
import { Bars, LineChart, StackedArea, type Series } from "./Chart";
import {
  ACCOUNT_PARTS,
  INCOME_PARTS,
  OUTFLOW_PARTS,
  RETIREMENT_INCOME_PARTS,
  SAVINGS_PARTS,
  SPENDING_PARTS,
  phaseLabel,
  type StackPart,
} from "./stacks";

function deflate(row: any, value: number, real: boolean): number {
  return real ? value * (row.realDollarFactor ?? 1) : value;
}

type View = "line" | "bars";

function ViewToggle({ view, onChange, lineLabel, label }: { view: View; onChange: (v: View) => void; lineLabel: string; label: string }) {
  return (
    <div className="toggle" role="group" aria-label={`${label} view`}>
      <button className={view === "line" ? "on" : ""} aria-pressed={view === "line"} onClick={() => onChange("line")}>
        {lineLabel}
      </button>
      <button className={view === "bars" ? "on" : ""} aria-pressed={view === "bars"} onClick={() => onChange("bars")}>
        Bars
      </button>
    </div>
  );
}

export function CompositionPanel({ entry }: { entry: any }) {
  const { theme, realDollars } = useAppState();
  const unit = realDollars ? "real 2026$" : "nominal";
  const [views, setViews] = useState<Record<string, View>>({});
  const tip = (i: number) => phaseLabel(entry.projection[i]);

  const series = (parts: StackPart[]): Series[] =>
    parts.map((d) => ({
      id: d.id,
      name: d.name,
      color: d.color,
      hatch: d.hatch,
      points: entry.projection.map((row: any) => ({
        x: row.calendarYear,
        y: deflate(row, d.metric(row), realDollars),
      })),
    }));

  const sections: {
    id: string;
    title: string;
    sub: string;
    lineLabel: string;
    defaultView: View;
    line: () => ReactNode;
    bars: () => ReactNode;
  }[] = [
    {
      id: "inc_vs_exp",
      title: "Income vs expenses",
      sub: "Total income against total outflows for this path",
      lineLabel: "Lines",
      defaultView: "line",
      line: () => (
        <LineChart
          series={series([
            { id: "inc", name: "Total income", color: STACK_COLORS[2], metric: (r) => r.totalIncome },
            { id: "out", name: "Total expenses", color: STACK_COLORS[0], metric: (r) => r.taxes + r.healthcareCost + r.livingExpenses },
          ])}
          yLabel={`Per year, ${unit}`}
          tipLabel={tip}
        />
      ),
      bars: () => (
        <Bars series={series([...INCOME_PARTS, ...OUTFLOW_PARTS])} yLabel={`Per year, ${unit}`} totalLabel="Net cash flow" tipLabel={tip} height={300} />
      ),
    },
    {
      id: "income",
      title: "Income composition",
      sub: "Where the money comes from each year",
      lineLabel: "Area",
      defaultView: "line",
      line: () => <StackedArea series={series(INCOME_PARTS)} yLabel={`Income/yr, ${unit}`} tipLabel={tip} />,
      bars: () => <Bars series={series(INCOME_PARTS)} yLabel={`Income/yr, ${unit}`} totalLabel="Total income" tipLabel={tip} height={280} />,
    },
    {
      id: "expenses",
      title: "Expense composition",
      sub: "Living costs, healthcare, and taxes",
      lineLabel: "Area",
      defaultView: "line",
      line: () => <StackedArea series={series(SPENDING_PARTS)} yLabel={`Expenses/yr, ${unit}`} tipLabel={tip} />,
      bars: () => <Bars series={series(SPENDING_PARTS)} yLabel={`Expenses/yr, ${unit}`} totalLabel="Total expenses" tipLabel={tip} height={280} />,
    },
    {
      id: "accounts",
      title: "Savings by account",
      sub: "TSP · Roth IRA · brokerage · 401(k) · cash",
      lineLabel: "Area",
      defaultView: "line",
      line: () => <StackedArea series={series(ACCOUNT_PARTS)} yLabel={`Balances, ${unit}`} tipLabel={tip} />,
      bars: () => <Bars series={series(ACCOUNT_PARTS)} yLabel={`Balances, ${unit}`} totalLabel="Total" tipLabel={tip} height={280} />,
    },
    {
      id: "saved",
      title: "Savings put away",
      sub: "Contributions + employer match + surplus invested",
      lineLabel: "Area",
      defaultView: "bars",
      line: () => <StackedArea series={series(SAVINGS_PARTS)} yLabel={`Saved/yr, ${unit}`} tipLabel={tip} />,
      bars: () => (
        <Bars series={series(SAVINGS_PARTS)} yLabel={`Saved/yr, ${unit}`} totalLabel="Total saved" negativeColor={NEGATIVE_COLORS[theme]} tipLabel={tip} height={280} />
      ),
    },
    {
      id: "retirement",
      title: "Retirement income sources",
      sub: "Pension, account withdrawals, VA, Social Security",
      lineLabel: "Area",
      defaultView: "line",
      line: () => <StackedArea series={series(RETIREMENT_INCOME_PARTS)} yLabel={`Income/yr, ${unit}`} tipLabel={tip} />,
      bars: () => <Bars series={series(RETIREMENT_INCOME_PARTS)} yLabel={`Income/yr, ${unit}`} totalLabel="Total" tipLabel={tip} height={280} />,
    },
  ];

  return (
    <section style={{ marginTop: 24 }}>
      <p className="section-h">Path composition · {entry.scenarioName}</p>
      <p className="notice" style={{ margin: "0 0 12px" }}>
        These views break one path into its parts — switch paths above and they follow. Use Bars to see each
        category year by year.
      </p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>
        {sections.map((section) => {
          const view = views[section.id] ?? section.defaultView;
          return (
            <section className="card" key={section.id}>
              <div className="row between">
                <h3 style={{ margin: 0 }}>{section.title}</h3>
                <ViewToggle
                  view={view}
                  label={section.title}
                  lineLabel={section.lineLabel}
                  onChange={(v) => setViews({ ...views, [section.id]: v })}
                />
              </div>
              <p className="sub">{section.sub}</p>
              {view === "bars" ? section.bars() : section.line()}
            </section>
          );
        })}
      </div>
    </section>
  );
}
