/* Assumptions & Reference: public-knowledge tables, locked by default.
   Editing requires an explicit override (new value + reason + confirm);
   overridden cells are badged and revertible. */

import { useState } from "react";
import { useAppState, useDispatch } from "../state/store";

const DOMAIN_GROUPS: { title: string; note: string; domains: { id: string; label: string; fields: string[] }[] }[] = [
  {
    title: "Compensation catalogs",
    note: "levels.fyi-sourced comp used by work blocks.",
    domains: [
      { id: "tech_companies", label: "Tech companies", fields: ["baseSalary", "bonusPct", "annualRsu", "growthRate"] },
      { id: "research_employers", label: "Research employers", fields: ["baseSalary", "bonusPct", "annualRsu", "growthRate"] },
      { id: "phd_programs", label: "PhD programs", fields: ["stipendAnnual", "giBillBahMonthly", "estimatedRentMonthly"] },
    ],
  },
  {
    title: "Locations & living costs",
    note: "Researched 2026 cost-of-living. School blocks use the program's city; work blocks use the employer's city.",
    domains: [
      { id: "location_cost_profiles", label: "Living costs by location", fields: ["housingMonthly", "foodMonthly", "utilitiesMonthly", "transportationMonthly", "annualGrowthRate"] },
      { id: "career_locations", label: "Employer → location", fields: ["locationId"] },
    ],
  },
  {
    title: "Benefits & rates",
    note: "Military, VA, and benefit rules.",
    domains: [
      { id: "va_disability", label: "VA disability rates", fields: ["monthly", "annual"] },
      { id: "benefit_rules", label: "Benefit rules", fields: ["valuePercent", "valueNumber"] },
      { id: "v2_benefit_rules", label: "Lifecycle rules", fields: ["valuePercent", "valueNumber"] },
    ],
  },
  {
    title: "Taxes, healthcare & retirement",
    note: "Effective-rate profiles and lifecycle tables.",
    domains: [
      { id: "tax_profiles", label: "Tax profiles", fields: ["federalRate", "stateRate"] },
      { id: "healthcare_profiles", label: "Healthcare profiles", fields: ["annualCost", "inflationRate"] },
      { id: "retirement_tax_profiles", label: "Retirement taxes", fields: ["federalRate", "stateRate"] },
      { id: "medicare_profiles", label: "Medicare", fields: ["annualCost", "inflationRate", "startAge"] },
      { id: "ss_claim_factors", label: "Social Security claim factors", fields: ["factor"] },
      { id: "investment_policies", label: "Investment policies", fields: ["annualReturnRate", "surplusInvestmentRate", "annualContribution"] },
    ],
  },
];

interface DialogState {
  domain: string;
  recordId: string;
  recordLabel: string;
  field: string;
  original: any;
}

export function Assumptions() {
  const { bootstrap, referenceOverrides } = useAppState();
  const dispatch = useDispatch();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");

  if (!bootstrap) {
    return (
      <header className="screen-head">
        <h2>Assumptions &amp; Reference</h2>
        <p>Loading…</p>
      </header>
    );
  }

  const catalogs: Record<string, any[]> = { ...bootstrap.referenceDomains, ...bootstrap.referenceTables };

  function findOverride(domain: string, id: string, field: string) {
    return referenceOverrides.find((o) => o.domain === domain && o.id === id && o.field === field);
  }

  function commitOverride() {
    if (!dialog) return;
    const value = Number(newValue);
    if (Number.isNaN(value)) return;
    const next = referenceOverrides.filter(
      (o) => !(o.domain === dialog.domain && o.id === dialog.recordId && o.field === dialog.field),
    );
    next.push({
      domain: dialog.domain,
      id: dialog.recordId,
      field: dialog.field,
      value,
      original: dialog.original,
      reason,
      at: new Date().toISOString(),
    });
    dispatch({ type: "setOverrides", overrides: next });
    setDialog(null);
    setNewValue("");
    setReason("");
  }

  function revert(domain: string, id: string, field: string) {
    dispatch({
      type: "setOverrides",
      overrides: referenceOverrides.filter((o) => !(o.domain === domain && o.id === id && o.field === field)),
    });
  }

  return (
    <>
      <header className="screen-head">
        <h2>Assumptions &amp; Reference</h2>
        <p>
          Public-knowledge data is locked by design — click the lock on any value to override it deliberately.
          Overrides are badged, kept with your reason, and revertible. Your own finances live in Finances.
        </p>
      </header>

      {referenceOverrides.length > 0 && (
        <div className="callout">
          <strong>{referenceOverrides.length} active override{referenceOverrides.length > 1 ? "s" : ""}.</strong>{" "}
          Projections use your overridden values; originals are preserved below.
        </div>
      )}

      {DOMAIN_GROUPS.map((group) => (
        <section key={group.title}>
          <p className="section-h">{group.title}</p>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
            {group.domains.map((domain) => {
              const rows = catalogs[domain.id] ?? [];
              if (!rows.length) return null;
              return (
                <div className="card" key={domain.id}>
                  <h3>{domain.label}</h3>
                  <p className="sub">{group.note}</p>
                  <div className="table-scroll" style={{ maxHeight: 300, overflowY: "auto", border: "none" }}>
                    <table className="data">
                      <thead>
                        <tr>
                          <th>Record</th>
                          {domain.fields.map((f) => <th key={f}>{f}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((record: any) => (
                          <tr key={record.id}>
                            <td style={{ maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }}>{record.label ?? record.id}</td>
                            {domain.fields.map((field) => {
                              const override = findOverride(domain.id, record.id, field);
                              const raw = override ? override.value : record[field];
                              const display =
                                raw === null || raw === undefined
                                  ? "—"
                                  : typeof raw === "number" && Math.abs(raw) < 1
                                    ? `${(raw * 100).toFixed(1)}%`
                                    : typeof raw === "number"
                                      ? raw.toLocaleString()
                                      : String(raw);
                              return (
                                <td key={field}>
                                  {display}
                                  {override ? (
                                    <>
                                      <span className="override-badge" title={`was ${override.original} — ${override.reason}`}>edited</span>
                                      <button className="lock-btn" onClick={() => revert(domain.id, record.id, field)} title="Revert to source value">↺</button>
                                    </>
                                  ) : (
                                    record[field] !== undefined && (
                                      <button
                                        className="lock-btn"
                                        title="Locked reference value — click to override"
                                        onClick={() => {
                                          setDialog({
                                            domain: domain.id,
                                            recordId: record.id,
                                            recordLabel: record.label ?? record.id,
                                            field,
                                            original: record[field],
                                          });
                                          setNewValue(String(record[field] ?? ""));
                                        }}
                                      >
                                        🔒
                                      </button>
                                    )
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {dialog && (
        <div className="dialog-backdrop" onClick={() => setDialog(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>Override a locked value</h3>
            <p className="sub">
              {dialog.recordLabel} · <code>{dialog.field}</code> — source value <strong>{String(dialog.original)}</strong>.
              This is public reference data; override only if you have better information.
            </p>
            <label className="field">New value</label>
            <input type="number" step="any" value={newValue} onChange={(e) => setNewValue(e.target.value)} autoFocus />
            <label className="field">Why are you overriding it?</label>
            <input
              type="text"
              value={reason}
              placeholder="Updated 2027 BAH tables"
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
              <button onClick={() => setDialog(null)}>Cancel</button>
              <button className="primary" disabled={!reason.trim() || newValue === ""} onClick={commitOverride}>
                Apply override
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
