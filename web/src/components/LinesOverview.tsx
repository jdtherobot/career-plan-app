/* Every income and cost line on one path, with this year's monthly amount, a
   sparkline over the whole horizon, an "edited" badge, and a button that opens
   the year-by-year editor. */

import { useState } from "react";
import { fmtMoney, usePathColor, useAppState } from "../state/store";
import { lineLabel } from "./planHelpers";
import { YearDrawer } from "./YearDrawer";

const GROUP_ORDER = ["Military pay", "Work", "School", "Retirement & VA", "Living", "Health", "Household"];

function Spark({ values, highlight }: { values: number[]; highlight: boolean }) {
  const w = 120, h = 24;
  const max = Math.max(...values, 1);
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / Math.max(values.length - 1, 1)) * w).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke={highlight ? "var(--gold)" : "var(--ink-2)"} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function LinesOverview() {
  const state = useAppState();
  const { scenarios, results, bootstrap, profile } = state;
  const colorOf = usePathColor();
  const [pathId, setPathId] = useState<string | null>(state.focusPathId ?? scenarios[0]?.id ?? null);
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const lineDefs: any[] = bootstrap?.lineDefs ?? [];
  const scenario = scenarios.find((s) => s.id === pathId) ?? scenarios[0];
  const entry = results?.scenarios?.find((s: any) => s.scenarioId === scenario?.id);
  if (!scenario || !entry) return null;
  const rows: any[] = entry.projection;
  const baseRow = rows[0];

  const ids = new Set<string>();
  for (const row of rows) for (const id of Object.keys(row.lines ?? {})) ids.add(id);
  const all = [...ids].map((id) => {
    const def = lineDefs.find((d) => d.id === id);
    const values = rows.map((r) => r.lines?.[id]?.value ?? 0);
    return {
      id,
      def,
      group: def?.group ?? "Household",
      kind: def?.kind ?? "expense",
      label: lineLabel(id, lineDefs, profile),
      values,
      total: values.reduce((a, b) => a + b, 0),
      now: baseRow?.lines?.[id]?.months ? baseRow.lines[id].value / baseRow.lines[id].months : 0,
      firstYear: rows.find((r) => (r.lines?.[id]?.value ?? 0) > 0.5)?.calendarYear,
      edited: Object.keys(scenario.lineOverrides?.[id] ?? {}).length,
    };
  });
  const visible = showAll ? all : all.filter((l) => l.total > 0.5 || l.edited);
  const groups = GROUP_ORDER.map((g) => ({ group: g, items: visible.filter((l) => l.group === g) })).filter((g) => g.items.length);

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="row between">
        <div>
          <h3 style={{ margin: 0 }}>Year by year</h3>
          <p className="sub" style={{ margin: "2px 0 0" }}>
            Every amount the plan uses, calculated for each year from where you are and what you're doing. Open any line
            to see and change individual years — rent at a new station, tuition, a raise.
          </p>
        </div>
        <div className="toggle" role="group" aria-label="Path">
          {scenarios.map((s) => (
            <button key={s.id} className={s.id === scenario.id ? "on" : ""} aria-pressed={s.id === scenario.id} onClick={() => setPathId(s.id)}>
              <span className="pathdot" style={{ background: colorOf(s.id), display: "inline-block", marginRight: 5, width: 8, height: 8 }} />
              {s.displayName || s.name}
            </button>
          ))}
        </div>
      </div>
      <div className="lines-grid">
        {groups.map((g) => (
          <div key={g.group} className="lines-group">
            <p className="section-h" style={{ margin: "14px 0 4px" }}>{g.group}</p>
            {g.items.map((l) => (
              <button key={l.id} className={`line-tile${l.edited ? " edited" : ""}`} onClick={() => setOpen(l.id)} aria-label={`${l.label}: edit year by year`}>
                <span className="lt-label">
                  {l.label}
                  {l.edited > 0 && <span className="override-badge">edited · {l.edited} yr{l.edited > 1 ? "s" : ""}</span>}
                </span>
                <span className="lt-now">
                  {l.now ? `${fmtMoney(l.now)}/mo` : l.firstYear ? `from ${l.firstYear}` : "—"}
                </span>
                <Spark values={l.values} highlight={l.edited > 0} />
                <span className="lt-go" aria-hidden>▸</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <button className="small" style={{ marginTop: 10 }} onClick={() => setShowAll(!showAll)}>
        {showAll ? "Hide lines that are always $0" : "Show every line"}
      </button>
      {open && <YearDrawer lineId={open} initialPathId={scenario.id} onClose={() => setOpen(null)} />}
    </section>
  );
}
