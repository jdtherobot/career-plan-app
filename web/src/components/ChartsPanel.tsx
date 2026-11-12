/* Dashboard chart library. Line view compares paths (one line per path);
   bar view breaks one path's total into colour-coded categories per year so
   each income stream, benefit and expense shows exactly when it applies. */

import { useEffect, useRef, useState } from "react";
import { useAppState, useDispatch, pathColor, fmtMoney, NEGATIVE_COLORS } from "../state/store";
import { Bars, LineChart, type Series } from "./Chart";
import { CHART_STACKS, phaseLabel } from "./stacks";

type ChartView = "line" | "bars";

function readView(id: string): ChartView {
  try {
    return localStorage.getItem(`cpc-chart-view-${id}`) === "bars" ? "bars" : "line";
  } catch {
    return "line";
  }
}

function writeView(id: string, view: ChartView): void {
  try {
    localStorage.setItem(`cpc-chart-view-${id}`, view);
  } catch {
    /* view simply doesn't persist */
  }
}

interface ChartDef {
  id: string;
  title: string;
  sub: string;
  metric: (row: any) => number;
}

interface BreakdownRow {
  label: string;
  metric: (row: any) => number;
  signed?: boolean; // rendered with a leading − (it subtracts from the total)
}

/* What the MORE panel lists for each chart — the streams behind the line,
   one column per path, locked to the crosshair year. */
const BREAKDOWNS: Record<string, BreakdownRow[]> = {
  net_cf: [
    { label: "Total income", metric: (r) => r.totalIncome },
    { label: "Taxes", metric: (r) => r.taxes, signed: true },
    { label: "Healthcare", metric: (r) => r.healthcareCost, signed: true },
    { label: "Living expenses", metric: (r) => r.livingExpenses, signed: true },
    { label: "Contributions", metric: (r) => r.retirementSavings, signed: true },
    { label: "Net cash flow", metric: (r) => r.netCashFlow },
  ],
  portfolio: [
    { label: "Cash", metric: (r) => r.accountBalances?.cash ?? 0 },
    { label: "Brokerage", metric: (r) => r.accountBalances?.brokerage ?? 0 },
    { label: "TSP (Roth)", metric: (r) => r.accountBalances?.tspRoth ?? 0 },
    { label: "Roth IRA", metric: (r) => r.accountBalances?.rothIra ?? 0 },
    { label: "Trad 401(k)", metric: (r) => r.accountBalances?.trad401k ?? 0 },
    { label: "Total", metric: (r) => r.portfolio },
  ],
  income: [
    { label: "Military base pay", metric: (r) => r.incomeBreakdown.militaryBasePay },
    { label: "BAH + BAS", metric: (r) => r.incomeBreakdown.militaryBah + r.incomeBreakdown.militaryBas },
    { label: "Pension", metric: (r) => r.incomeBreakdown.pension },
    { label: "Salary", metric: (r) => r.incomeBreakdown.salaryBase },
    { label: "Stipend", metric: (r) => r.incomeBreakdown.phdStipend },
    { label: "VA disability", metric: (r) => r.incomeBreakdown.vaCompensation },
    { label: "GI Bill", metric: (r) => r.incomeBreakdown.giBillHousing + r.incomeBreakdown.giBillBooks },
    { label: "Social Security", metric: (r) => r.incomeBreakdown.socialSecurity ?? 0 },
    { label: "Total", metric: (r) => r.totalIncome },
  ],
  spending: [
    { label: "Taxes", metric: (r) => r.taxes },
    { label: "Healthcare", metric: (r) => r.healthcareCost },
    { label: "Housing", metric: (r) => r.expenseBreakdown.housing ?? 0 },
    { label: "Food", metric: (r) => r.expenseBreakdown.food ?? 0 },
    { label: "Transport + utilities", metric: (r) => (r.expenseBreakdown.transportation ?? 0) + (r.expenseBreakdown.utilities ?? 0) },
    { label: "Other living", metric: (r) => Math.max((r.livingExpenses ?? 0) - (r.expenseBreakdown.housing ?? 0) - (r.expenseBreakdown.food ?? 0) - (r.expenseBreakdown.transportation ?? 0) - (r.expenseBreakdown.utilities ?? 0), 0) },
    { label: "Total", metric: (r) => r.taxes + r.healthcareCost + r.livingExpenses },
  ],
  savings: [
    { label: "Contributions", metric: (r) => r.retirementSavings },
    { label: "Employer match", metric: (r) => r.employerMatch ?? 0 },
    { label: "Surplus invested", metric: (r) => r.positiveSurplusInvested },
    { label: "Total", metric: (r) => r.retirementSavings + (r.employerMatch ?? 0) + r.positiveSurplusInvested },
  ],
  taxes: [
    { label: "Federal", metric: (r) => r.taxBreakdown?.federalTax ?? 0 },
    { label: "State", metric: (r) => r.taxBreakdown?.stateTax ?? 0 },
    { label: "On withdrawals", metric: (r) => r.withdrawals?.taxesOnWithdrawals ?? 0 },
    { label: "Total", metric: (r) => r.taxes + (r.withdrawals?.taxesOnWithdrawals ?? 0) },
  ],
  retirement_income: [
    { label: "Pension", metric: (r) => r.retirementIncome?.pension ?? 0 },
    { label: "Social Security", metric: (r) => r.retirementIncome?.socialSecurity ?? 0 },
    { label: "VA", metric: (r) => r.retirementIncome?.vaCompensation ?? 0 },
    { label: "Withdrawals", metric: (r) => (r.withdrawals?.brokerage ?? 0) + (r.withdrawals?.trad401k ?? 0) + (r.withdrawals?.tspRoth ?? 0) + (r.withdrawals?.rothIra ?? 0) + (r.withdrawals?.cash ?? 0) },
  ],
};

export const CHART_DEFS: ChartDef[] = [
  {
    id: "net_cf",
    title: "Net cash flow",
    sub: "Income minus all expenses, per path — above zero you're saving, below you're drawing down",
    metric: (r) => r.netCashFlow,
  },
  {
    id: "portfolio",
    title: "Net worth over time",
    sub: "Total investable assets per path",
    metric: (r) => r.portfolio,
  },
  {
    id: "income",
    title: "Total income",
    sub: "Pay, benefits, pension, and Social Security per path (account withdrawals not counted)",
    metric: (r) => r.totalIncome,
  },
  {
    id: "spending",
    title: "Total expenses",
    sub: "Taxes + healthcare + living costs per path",
    metric: (r) => r.taxes + r.healthcareCost + r.livingExpenses,
  },
  {
    id: "savings",
    title: "Savings put away",
    sub: "Contributions + employer match + surplus invested, per path",
    metric: (r) => r.retirementSavings + (r.employerMatch ?? 0) + r.positiveSurplusInvested,
  },
  {
    id: "taxes",
    title: "Taxes",
    sub: "Annual taxes per path",
    metric: (r) => r.taxes + (r.withdrawals?.taxesOnWithdrawals ?? 0),
  },
  {
    id: "healthcare",
    title: "Healthcare cost",
    sub: "Annual healthcare per path",
    metric: (r) => r.healthcareCost,
  },
  {
    id: "retirement_income",
    title: "Retirement income",
    sub: "Pension + Social Security + VA + account withdrawals, per path",
    metric: (r) =>
      (r.retirementIncome?.pension ?? 0) +
      (r.retirementIncome?.socialSecurity ?? 0) +
      (r.retirementIncome?.vaCompensation ?? 0) +
      (r.withdrawals?.brokerage ?? 0) +
      (r.withdrawals?.trad401k ?? 0) +
      (r.withdrawals?.tspRoth ?? 0) +
      (r.withdrawals?.rothIra ?? 0) +
      (r.withdrawals?.cash ?? 0),
  },
];

const KNOWN_IDS = new Set(CHART_DEFS.map((d) => d.id));

function deflate(row: any, value: number, real: boolean): number {
  return real ? value * (row.realDollarFactor ?? 1) : value;
}

/* Multi-select dropdown: check charts on/off; closes on the trigger or any
   outside click. At least one chart always stays selected (store-enforced). */
function ChartPicker({
  enabled,
  onChange,
}: {
  enabled: string[];
  onChange: (charts: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div className="chart-picker" ref={wrapRef}>
      <button aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen(!open)}>
        Charts · {enabled.length} selected {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="chart-picker-menu" role="listbox" aria-label="Visible charts">
          {CHART_DEFS.map((def) => {
            const on = enabled.includes(def.id);
            const isLastOn = on && enabled.length === 1;
            return (
              <label key={def.id} className={isLastOn ? "locked" : ""} title={isLastOn ? "At least one chart stays visible" : def.sub}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={isLastOn}
                  onChange={() =>
                    onChange(on ? enabled.filter((c) => c !== def.id) : [...enabled, def.id])
                  }
                />
                {def.title}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ChartsPanel() {
  const state = useAppState();
  const dispatch = useDispatch();
  const { results, realDollars, theme, chartsEnabled } = state;
  if (!results) return null;

  const scenarios: any[] = results.scenarios;
  const unit = realDollars ? "real 2026$" : "nominal";
  const enabled = chartsEnabled.filter((id) => KNOWN_IDS.has(id));
  const active = enabled.length ? enabled : ["net_cf"];

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
    <section style={{ marginTop: 16 }}>
      <div className="card" style={{ marginBottom: 12, overflow: "visible" }}>
        <div className="row between">
          <div>
            <h3 style={{ margin: 0 }}>Compare the paths</h3>
            <p className="sub" style={{ margin: "2px 0 0" }}>
              Line: one line per path. Bars: one path's total split by category, year by year.
            </p>
          </div>
          <ChartPicker
            enabled={active}
            onChange={(charts) => dispatch({ type: "setChartsEnabled", charts })}
          />
        </div>
      </div>

      {CHART_DEFS.filter((def) => active.includes(def.id)).map((def) => (
        <ChartCard
          key={def.id}
          def={def}
          scenarios={scenarios}
          series={compareSeries(def.metric)}
          unit={unit}
          realDollars={realDollars}
          theme={theme}
        />
      ))}
    </section>
  );
}

/* One comparison chart + an optional MORE panel: the streams behind the line,
   one column per path, locked to the crosshair year (defaults to the horizon). */
function ChartCard({
  def,
  scenarios,
  series,
  unit,
  realDollars,
  theme,
}: {
  def: ChartDef;
  scenarios: any[];
  series: Series[];
  unit: string;
  realDollars: boolean;
  theme: "light" | "dark";
}) {
  const [more, setMore] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [view, setView] = useState<ChartView>(() => readView(def.id));
  const [barPathId, setBarPathId] = useState<string | null>(null);
  const breakdown = BREAKDOWNS[def.id];
  const stack = CHART_STACKS[def.id];
  const lastIdx = (scenarios[0]?.projection.length ?? 1) - 1;
  const idx = hoverIdx ?? lastIdx;
  const year = scenarios[0]?.projection[idx]?.calendarYear;
  const barEntry = scenarios.find((e) => e.scenarioId === barPathId) ?? scenarios[0];
  const barIndex = Math.max(scenarios.indexOf(barEntry), 0);
  const barSeries: Series[] = stack && barEntry
    ? stack.parts.map((part) => ({
        id: part.id,
        name: part.name,
        color: part.color,
        hatch: part.hatch,
        points: barEntry.projection.map((row: any) => ({
          x: row.calendarYear,
          y: deflate(row, part.metric(row), realDollars),
        })),
      }))
    : [];
  const chooseView = (next: ChartView) => {
    setView(next);
    writeView(def.id, next);
  };

  return (
    <section className="card" style={{ marginBottom: 14 }}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>
          <button
            className="collapse-toggle"
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand ${def.title}` : `Collapse ${def.title}`}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? "▸" : "▾"}
          </button>
          {def.title}
        </h3>
        {!collapsed && (
          <div className="row" style={{ gap: 10 }}>
            {stack && (
              <div className="toggle" role="group" aria-label={`${def.title} view`}>
                <button className={view === "line" ? "on" : ""} aria-pressed={view === "line"} onClick={() => chooseView("line")}>
                  Line
                </button>
                <button className={view === "bars" ? "on" : ""} aria-pressed={view === "bars"} onClick={() => chooseView("bars")}>
                  Bars
                </button>
              </div>
            )}
            {breakdown && (
              <button className="chart-more-toggle" aria-expanded={more} onClick={() => setMore(!more)}>
                {more ? "less ◂" : "more ▸"}
              </button>
            )}
          </div>
        )}
      </div>
      {collapsed ? null : (
        <>
      <p className="sub">
        {view === "bars" && stack
          ? `${barEntry?.scenarioName ?? ""}: each bar is one year, split into its parts`
          : def.sub}
      </p>
      {view === "bars" && stack && scenarios.length > 1 && (
        <div className="toggle" role="group" aria-label="Path shown in bars" style={{ marginBottom: 8, flexWrap: "wrap" }}>
          {scenarios.map((entry, i) => (
            <button
              key={entry.scenarioId}
              className={i === barIndex ? "on" : ""}
              aria-pressed={i === barIndex}
              onClick={() => setBarPathId(entry.scenarioId)}
            >
              <span className="pathdot" style={{ background: pathColor(i, theme), display: "inline-block", marginRight: 5, width: 8, height: 8 }} />
              {entry.scenarioName}
            </button>
          ))}
        </div>
      )}
      <div className="chart-split">
        <div>
          {view === "bars" && stack ? (
            <Bars
              series={barSeries}
              height={300}
              yLabel={`${def.title}, ${unit}`}
              totalLabel={stack.totalLabel}
              negativeColor={NEGATIVE_COLORS[theme]}
              tipLabel={(i) => phaseLabel(barEntry?.projection[i])}
              onHoverIndex={more ? setHoverIdx : undefined}
            />
          ) : (
            <LineChart
              series={series}
              yLabel={`${def.title}, ${unit}`}
              onHoverIndex={more ? setHoverIdx : undefined}
              tipLabel={(i) => `Age ${scenarios[0]?.projection[i]?.age ?? ""}`}
            />
          )}
        </div>
        {more && breakdown && (
          <aside className="chart-more" aria-label={`${def.title} breakdown by path`}>
            <div className="chart-more-year">
              {year}
              <span>{hoverIdx === null ? "horizon — hover the chart" : "following cursor"}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th />
                  {scenarios.map((entry, i) => (
                    <th key={entry.scenarioId} title={entry.scenarioName}>
                      <span className="pathdot" style={{ background: pathColor(i, theme), width: 8, height: 8, display: "inline-block" }} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row) => (
                  <tr key={row.label} className={/^(Total|Net cash flow)$/.test(row.label) ? "total" : ""}>
                    <td>{row.signed ? `− ${row.label}` : row.label}</td>
                    {scenarios.map((entry) => {
                      const projRow = entry.projection[idx];
                      const raw = projRow ? row.metric(projRow) : 0;
                      const value = projRow && realDollars ? raw * (projRow.realDollarFactor ?? 1) : raw;
                      return (
                        <td key={entry.scenarioId}>
                          {Math.abs(value) < 0.5 ? "—" : fmtMoney(value, true)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </aside>
        )}
      </div>
        </>
      )}
    </section>
  );
}
