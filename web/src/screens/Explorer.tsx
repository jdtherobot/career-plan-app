/* Projection Explorer: the full year-by-year table with per-year expandable
   breakdowns (income components, accounts, withdrawals). Power-user view. */

import { Fragment, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useAppState, fmtMoney, usePathColor } from "../state/store";
import { CompositionPanel } from "../components/CompositionPanel";

const COLUMN_SETS: Record<string, { key: string; label: string }[]> = {
  Overview: [
    { key: "phaseLabel", label: "Phase" },
    { key: "grossIncome", label: "Gross" },
    { key: "taxFreeIncome", label: "Tax-free" },
    { key: "taxes", label: "Taxes" },
    { key: "healthcareCost", label: "Healthcare" },
    { key: "livingExpenses", label: "Living" },
    { key: "netCashFlow", label: "Net CF" },
    { key: "portfolio", label: "Portfolio" },
  ],
  Income: [
    { key: "phaseLabel", label: "Phase" },
    { key: "incomeBreakdown.militaryBasePay", label: "Mil pay" },
    { key: "incomeBreakdown.militaryBah", label: "BAH" },
    { key: "incomeBreakdown.militaryOha", label: "OHA" },
    { key: "incomeBreakdown.militaryCola", label: "COLA" },
    { key: "incomeBreakdown.pension", label: "Pension" },
    { key: "incomeBreakdown.salaryBase", label: "Salary" },
    { key: "incomeBreakdown.phdStipend", label: "Stipend" },
    { key: "incomeBreakdown.vaCompensation", label: "VA" },
    { key: "incomeBreakdown.giBillHousing", label: "GI Bill" },
    { key: "incomeBreakdown.vreSubsistence", label: "VR&E" },
    { key: "incomeBreakdown.tuitionPaidByVa", label: "VA tuition" },
    { key: "incomeBreakdown.socialSecurity", label: "Soc Sec" },
  ],
  Expenses: [
    { key: "expenseBreakdown.housing", label: "Housing" },
    { key: "expenseBreakdown.utilities", label: "Utilities" },
    { key: "expenseBreakdown.transportation", label: "Transport" },
    { key: "expenseBreakdown.food", label: "Food" },
    { key: "expenseBreakdown.insurance", label: "Insurance" },
    { key: "expenseBreakdown.healthcareOutOfPocket", label: "Health OOP" },
    { key: "healthcareCost", label: "Healthcare" },
    { key: "expenseBreakdown.tuitionFees", label: "Tuition" },
    { key: "taxes", label: "Taxes" },
    { key: "livingExpenses", label: "Living total" },
  ],
  Savings: [
    { key: "retirementSavings", label: "Contributions" },
    { key: "employerMatch", label: "Match" },
    { key: "positiveSurplusInvested", label: "Surplus inv." },
    { key: "accountBalances.tspRoth", label: "TSP (Roth)" },
    { key: "accountBalances.rothIra", label: "Roth IRA" },
    { key: "accountBalances.trad401k", label: "Trad 401k" },
    { key: "accountBalances.brokerage", label: "Brokerage" },
  ],
  Accounts: [
    { key: "accountBalances.cash", label: "Cash" },
    { key: "accountBalances.brokerage", label: "Brokerage" },
    { key: "accountBalances.tspRoth", label: "TSP (Roth)" },
    { key: "accountBalances.rothIra", label: "Roth IRA" },
    { key: "accountBalances.trad401k", label: "Trad 401k" },
    { key: "employerMatch", label: "Match" },
    { key: "portfolio", label: "Total" },
  ],
  Retirement: [
    { key: "retirementIncome.pension", label: "Pension" },
    { key: "retirementIncome.socialSecurity", label: "Soc Sec" },
    { key: "withdrawals.brokerage", label: "W/D brokerage" },
    { key: "withdrawals.trad401k", label: "W/D trad" },
    { key: "withdrawals.rothIra", label: "W/D Roth" },
    { key: "rmd", label: "RMD" },
    { key: "unfundedSpending", label: "Unfunded" },
  ],
};

function cell(row: any, key: string): string {
  const value = key.split(".").reduce((acc: any, part) => acc?.[part], row);
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return fmtMoney(value, true);
  return String(value);
}

/* Column widths are fixed (table-layout: fixed) and shared by every path, so
   a column sits in exactly the same place whichever path you look at. Drag a
   header's right edge to resize; double-click it to reset. Saved per column
   set on this device. */
const WIDTHS_KEY = "cpc-explorer-cols";
const MIN_W = 48;
function defaultWidth(key: string): number {
  if (key === "year") return 72;
  if (key === "age") return 56;
  if (key === "phaseLabel") return 220;
  return 112;
}
function loadWidths(): Record<string, Record<string, number>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(WIDTHS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function saveWidths(widths: Record<string, Record<string, number>>) {
  try {
    localStorage.setItem(WIDTHS_KEY, JSON.stringify(widths));
  } catch {
    /* storage unavailable */
  }
}

export function Explorer() {
  const { results } = useAppState();
  const colorOf = usePathColor();
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [columnSet, setColumnSet] = useState("Overview");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [widths, setWidths] = useState(loadWidths);

  if (!results) {
    return (
      <header className="screen-head">
        <h2>Projection Explorer</h2>
        <p>Waiting for the engine…</p>
      </header>
    );
  }

  const scenarios: any[] = results.scenarios;
  const active = scenarios.find((s) => s.scenarioId === scenarioId) ?? scenarios[0];
  const columns = COLUMN_SETS[columnSet];
  const allCols = [{ key: "year", label: "Year" }, { key: "age", label: "Age" }, ...columns];
  const setWidths_ = widths[columnSet] ?? {};
  const widthOf = (key: string) => setWidths_[key] ?? defaultWidth(key);
  const tableWidth = allCols.reduce((sum, c) => sum + widthOf(c.key), 0);
  const setWidth = (key: string, w: number | null) => {
    const forSet = { ...(widths[columnSet] ?? {}) };
    if (w === null) delete forSet[key];
    else forSet[key] = Math.max(MIN_W, Math.round(w));
    const next = { ...widths, [columnSet]: forSet };
    setWidths(next);
    saveWidths(next);
  };
  const startResize = (key: string) => (e: ReactPointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = widthOf(key);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => setWidth(key, startW + ev.clientX - startX);
    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  };
  const resizedCount = Object.keys(setWidths_).length;

  return (
    <>
      <header className="screen-head">
        <h2>Projection Explorer</h2>
        <p>
          Every year, every number. Click a row for its full breakdown. Definitions: <strong>Net CF</strong> = total
          income − taxes − healthcare − living expenses − retirement contributions (can be negative; 20% of any
          positive Net CF is auto-invested as “surplus”). <strong>Living total</strong> = all living-expense
          categories, excluding healthcare and taxes.
        </p>
      </header>

      <div className="row" style={{ marginBottom: 12 }}>
        <div className="toggle" role="group" aria-label="Path">
          {scenarios.map((s) => (
            <button
              key={s.scenarioId}
              className={s.scenarioId === active.scenarioId ? "on" : ""}
              onClick={() => setScenarioId(s.scenarioId)}
            >
              <span className="pathdot" style={{ background: colorOf(s.scenarioId), display: "inline-block", marginRight: 5, width: 8, height: 8 }} />
              {s.scenarioName}
            </button>
          ))}
        </div>
        <div className="toggle" role="group" aria-label="Columns">
          {Object.keys(COLUMN_SETS).map((set) => (
            <button key={set} className={columnSet === set ? "on" : ""} onClick={() => setColumnSet(set)}>
              {set}
            </button>
          ))}
        </div>
      </div>

      <p className="notice" style={{ margin: "0 0 6px" }}>
        Columns stay put across paths. Drag a header edge to resize{resizedCount > 0 && (
          <>
            {" · "}
            <button
              className="small"
              onClick={() => {
                const next = { ...widths };
                delete next[columnSet];
                setWidths(next);
                saveWidths(next);
              }}
            >
              Reset widths
            </button>
          </>
        )}
      </p>
      <div className="table-scroll" style={{ maxHeight: "70vh", overflowY: "auto" }}>
        <table className="data fixed-cols" style={{ width: tableWidth }}>
          <colgroup>
            {allCols.map((c) => <col key={c.key} style={{ width: widthOf(c.key) }} />)}
          </colgroup>
          <thead>
            <tr>
              {allCols.map((c) => (
                <th key={c.key} title={c.label}>
                  <span className="th-label">{c.label}</span>
                  <span
                    className="col-resize"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize ${c.label} column`}
                    title="Drag to resize · double-click to reset"
                    onPointerDown={startResize(c.key)}
                    onDoubleClick={() => setWidth(c.key, null)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {active.projection.map((row: any, index: number) => (
              <Fragment key={row.calendarYear}>
                <tr
                  onClick={() => setExpanded(expanded === index ? null : index)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{row.calendarYear}</td>
                  <td>{row.age}</td>
                  {columns.map((c) => {
                    const text = cell(row, c.key);
                    return <td key={c.key} title={c.key === "phaseLabel" ? text : undefined}>{text}</td>;
                  })}
                </tr>
                {expanded === index && (
                  <tr>
                    <td colSpan={columns.length + 2} style={{ textAlign: "left", background: "var(--paper)", padding: 14 }}>
                      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                        {[
                          ["Income", row.incomeBreakdown],
                          ["Taxes", row.taxBreakdown],
                          ["Accounts", row.accountBalances],
                          ["Withdrawals", row.withdrawals],
                        ].map(([title, data]: any) => (
                          <div key={title}>
                            <strong style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</strong>
                            <table className="kv">
                              <tbody>
                                {Object.entries(data ?? {})
                                  .filter(([, v]) => typeof v === "number" && Math.abs(v as number) > 0.5)
                                  .map(([k, v]) => (
                                    <tr key={k}><td>{k}</td><td>{fmtMoney(v as number, true)}</td></tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <CompositionPanel entry={active} allEntries={scenarios} />
    </>
  );
}
