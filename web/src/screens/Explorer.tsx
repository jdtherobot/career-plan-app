/* Projection Explorer: the full year-by-year table with per-year expandable
   breakdowns (income components, accounts, withdrawals). Power-user view. */

import { Fragment, useState } from "react";
import { useAppState, fmtMoney, pathColor } from "../state/store";

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
    { key: "incomeBreakdown.pension", label: "Pension" },
    { key: "incomeBreakdown.salaryBase", label: "Salary" },
    { key: "incomeBreakdown.phdStipend", label: "Stipend" },
    { key: "incomeBreakdown.vaCompensation", label: "VA" },
    { key: "incomeBreakdown.giBillHousing", label: "GI Bill" },
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

export function Explorer() {
  const { results, theme } = useAppState();
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [columnSet, setColumnSet] = useState("Overview");
  const [expanded, setExpanded] = useState<number | null>(null);

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
          {scenarios.map((s, i) => (
            <button
              key={s.scenarioId}
              className={s.scenarioId === active.scenarioId ? "on" : ""}
              onClick={() => setScenarioId(s.scenarioId)}
            >
              <span className="pathdot" style={{ background: pathColor(i, theme), display: "inline-block", marginRight: 5, width: 8, height: 8 }} />
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

      <div className="table-scroll" style={{ maxHeight: "70vh", overflowY: "auto" }}>
        <table className="data">
          <thead>
            <tr>
              <th>Year</th>
              <th>Age</th>
              {columns.map((c) => <th key={c.key}>{c.label}</th>)}
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
                  {columns.map((c) => <td key={c.key}>{cell(row, c.key)}</td>)}
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
    </>
  );
}
