/* Finances: the personal baseline. Two kinds of rows:
   - Manual items (yours): directly editable, feed the engine.
   - Sourced items (reference-backed, e.g. military pay): pre-filled from the
     live projection, locked here, with a link to the source that drives them. */

import { useState } from "react";
import { useAppState, useDispatch, fmtMoney } from "../state/store";

const BUCKETS: { id: string; label: string; amountKey: string; unit: string }[] = [
  { id: "income", label: "Monthly income", amountKey: "amountMonthly", unit: "/mo" },
  { id: "expenses", label: "Monthly expenses", amountKey: "amountMonthly", unit: "/mo" },
  { id: "assets", label: "Assets", amountKey: "amount", unit: "" },
  { id: "debts", label: "Debts", amountKey: "amount", unit: "" },
];

/* Reference-backed items: where their value actually comes from, and how to
   compute the current monthly figure from the year-0 projection row. */
const SOURCED: Record<string, { source: string; href: string; monthly: (row0: any) => number }> = {
  monthly_base_pay: {
    source: "Military pay schedule",
    href: "#assumptions",
    monthly: (r) => (r?.incomeBreakdown?.militaryBasePay ?? 0) / 12,
  },
  bah_housing: {
    source: "Military pay schedule (BAH)",
    href: "#assumptions",
    monthly: (r) => (r?.incomeBreakdown?.militaryBah ?? 0) / 12,
  },
  bas: {
    source: "Military pay schedule (BAS)",
    href: "#assumptions",
    monthly: (r) => (r?.incomeBreakdown?.militaryBas ?? 0) / 12,
  },
};

export function Finances() {
  const { manualInputs, results } = useAppState();
  const dispatch = useDispatch();
  const [bucket, setBucket] = useState("expenses");
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});

  if (!manualInputs) {
    return (
      <header className="screen-head">
        <h2>Finances</h2>
        <p>Loading…</p>
      </header>
    );
  }

  const config = BUCKETS.find((b) => b.id === bucket)!;
  const sections: any[] = manualInputs[bucket] ?? [];
  const row0 = results?.scenarios?.[0]?.projection?.[0];

  function updateItem(sectionId: string, itemId: string, value: number) {
    const next = {
      ...manualInputs,
      [bucket]: sections.map((section) =>
        section.id !== sectionId
          ? section
          : {
              ...section,
              items: section.items.map((item: any) =>
                item.id === itemId ? { ...item, [config.amountKey]: value } : item,
              ),
            },
      ),
    };
    dispatch({ type: "setManualInputs", manualInputs: next });
  }

  function isSourced(item: any): boolean {
    return item.entryMode === "reference_backed_hidden" || SOURCED[item.id] !== undefined;
  }

  function sourcedValue(item: any): number | null {
    const entry = SOURCED[item.id];
    if (!entry) return null;
    return entry.monthly(row0);
  }

  const manualTotal = sections.reduce(
    (sum, section) =>
      sum +
      section.items.reduce(
        (s: number, item: any) => (isSourced(item) ? s : s + (Number(item[config.amountKey]) || 0)),
        0,
      ),
    0,
  );

  return (
    <>
      <header className="screen-head">
        <h2>Finances</h2>
        <p>
          Your baseline. <strong>Editable rows are yours</strong> and feed every projection directly.{" "}
          <strong>Locked rows are computed from reference data</strong> (military pay tables, benefit rules) —
          edit them at their source, not here.
        </p>
      </header>

      <div className="row" style={{ marginBottom: 14 }}>
        <div className="toggle" role="group" aria-label="Bucket">
          {BUCKETS.map((b) => (
            <button key={b.id} className={bucket === b.id ? "on" : ""} onClick={() => setBucket(b.id)}>
              {b.label}
            </button>
          ))}
        </div>
        <span className="notice" style={{ marginLeft: "auto", fontFamily: "var(--font-mono)" }}>
          Manual total: {fmtMoney(manualTotal)}
          {config.unit}
        </span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        {sections.map((section) => {
          const important = section.items.filter(
            (item: any) =>
              (Number(item[config.amountKey]) || 0) !== 0 ||
              isSourced(item) ||
              item.isCustom ||
              String(item.id).startsWith("migrated_"),
          );
          const expanded = showAll[section.id];
          const items = expanded ? section.items : important.length ? important : section.items.slice(0, 4);
          const hiddenCount = section.items.length - items.length;
          return (
            <section className="card" key={section.id}>
              <h3>{section.label}</h3>
              {items.map((item: any) => {
                if (isSourced(item)) {
                  const computed = sourcedValue(item);
                  const meta = SOURCED[item.id];
                  return (
                    <div className="row between" key={item.id} style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 12.5, flex: 1 }}>
                        {item.label}
                        <span className="override-badge" title="Computed from reference data — locked here">
                          sourced
                        </span>
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 12.5,
                          color: "var(--ink-2)",
                          textAlign: "right",
                        }}
                      >
                        {computed !== null && row0 ? fmtMoney(computed) + "/mo" : "—"}
                        <br />
                        <a
                          href={meta?.href ?? "#assumptions"}
                          style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--font-ui)" }}
                        >
                          {meta?.source ?? "Reference data"} →
                        </a>
                      </span>
                    </div>
                  );
                }
                return (
                  <div className="row between" key={item.id} style={{ marginBottom: 6 }}>
                    <label htmlFor={`${section.id}-${item.id}`} style={{ fontSize: 12.5, flex: 1 }}>
                      {String(item.id).startsWith("migrated_") ? `${item.label} (baseline)` : item.label}
                    </label>
                    <input
                      id={`${section.id}-${item.id}`}
                      type="number"
                      style={{ width: 110 }}
                      value={Number(item[config.amountKey]) || 0}
                      onChange={(e) => updateItem(section.id, item.id, Number(e.target.value))}
                    />
                  </div>
                );
              })}
              {hiddenCount > 0 && !expanded && (
                <button className="small" onClick={() => setShowAll({ ...showAll, [section.id]: true })}>
                  Show {hiddenCount} more field{hiddenCount > 1 ? "s" : ""}
                </button>
              )}
              {expanded && (
                <button className="small" onClick={() => setShowAll({ ...showAll, [section.id]: false })}>
                  Show fewer
                </button>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
