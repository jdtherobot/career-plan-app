/* Finances: the personal baseline. Two kinds of rows:
   - Manual items (yours): directly editable, feed the engine.
   - Sourced items (reference-backed, e.g. military pay): pre-filled from the
     live projection, locked here, with a link to the source that drives them. */

import { useState } from "react";
import { useAppState, useDispatch, fmtMoney } from "../state/store";
import { HouseholdCard } from "../components/HouseholdCard";
import { LinesOverview } from "../components/LinesOverview";
import { YearDrawer } from "../components/YearDrawer";

/* Which year-by-year line each Finances section / sourced row feeds. Sections
   the engine doesn't break out (clothing, pets, …) roll into Miscellaneous. */
const SECTION_LINE: Record<string, string> = {
  housing: "housing", utilities: "utilities", transportation: "transportation", food: "food",
  insurance: "insurance", healthcare: "healthcareOutOfPocket", personal: "personal", gifts: "gifts",
};
const ITEM_LINE: Record<string, string> = {
  monthly_base_pay: "basePay", bah_housing: "bah", bas: "bas", oha: "oha", cola: "cola",
  va_benefits: "va", military_retirement_pay: "pension",
};

function ByYearButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button className="by-year-btn" onClick={onClick} aria-label={`${label}: year by year`} title="Year by year">
      <svg viewBox="0 0 16 12" width="16" height="12" aria-hidden>
        <rect x="1" y="7" width="2.6" height="4" />
        <rect x="5" y="4" width="2.6" height="7" />
        <rect x="9" y="5.5" width="2.6" height="5.5" />
        <rect x="13" y="1" width="2.6" height="10" />
      </svg>
      by year
    </button>
  );
}

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
  const [openLine, setOpenLine] = useState<string | null>(null);

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
          What everything costs and pays, year by year, on each path — calculated from where you are and what
          you're doing, and editable for any year. Below it, <strong>your baseline</strong>: today's numbers, which
          set your costs at your current station. <strong>Locked rows</strong> come from reference data (pay tables,
          benefit rules).
        </p>
      </header>

      <LinesOverview />
      <HouseholdCard />

      <p className="section-h">Your baseline (today)</p>
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
              <div className="row between" style={{ marginBottom: 4 }}>
                <h3 style={{ margin: 0 }}>{section.label}</h3>
                {bucket === "expenses" && (
                  <ByYearButton
                    label={section.label}
                    onClick={() => setOpenLine(SECTION_LINE[section.id] ?? "miscellaneous")}
                  />
                )}
              </div>
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
                        {ITEM_LINE[item.id] && (
                          <>
                            <ByYearButton label={item.label} onClick={() => setOpenLine(ITEM_LINE[item.id])} />{" "}
                          </>
                        )}
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
      {openLine && <YearDrawer lineId={openLine} onClose={() => setOpenLine(null)} />}
    </>
  );
}
