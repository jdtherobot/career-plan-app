/* Year-by-year editor for one line (rent, BAH, tuition…): the engine's
   calculated monthly amount for every year, an editable "yours" column, and
   tools to fill forward, grow by a rate, reset, and copy to other paths.
   Edits are per path and stored as monthly amounts in that year's dollars. */

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtMoney, pathColor, useAppState, useDispatch } from "../state/store";
import { lineLabel } from "./planHelpers";

const STATUS_LABEL: Record<string, { label: string; tone: string; title: string }> = {
  covered: { label: "covered", tone: "ok", title: "Paid for by an allowance or benefit — nets to $0" },
  partial: { label: "partly covered", tone: "warn", title: "An allowance or benefit pays part of this" },
  quarters: { label: "gov't quarters", tone: "ok", title: "Provided while living on base" },
  estimate: { label: "estimate", tone: "warn", title: "Based on estimated reference data" },
};

function whereLabel(row: any): string {
  const segs: any[] = row?.segments ?? [];
  if (!segs.length) return row?.phaseLabel ?? "";
  const parts = segs.map((s) => {
    // Short place name: "RAF Alconbury / Molesworth, UK" → "RAF Alconbury, UK".
    const full = s.locationLabel ? String(s.locationLabel).split(" (")[0] : "";
    const where = full.includes(" / ") ? `${full.split(" / ")[0]}${full.includes(",") ? "," + full.split(",").pop() : ""}` : full;
    const what = s.activityType === "active_duty" ? (s.housing === "on_base" ? "on base" : "") : s.phaseLabel;
    return [where, what].filter(Boolean).join(" · ");
  });
  return [...new Set(parts)].join(" → ");
}

export function YearDrawer({ lineId, initialPathId, onClose }: { lineId: string; initialPathId?: string | null; onClose: () => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const { scenarios, results, bootstrap, theme, profile } = state;
  const lineDefs: any[] = bootstrap?.lineDefs ?? [];
  const def = lineDefs.find((d) => d.id === lineId);
  const [pathId, setPathId] = useState<string>(initialPathId ?? state.focusPathId ?? scenarios[0]?.id);
  const [hideNa, setHideNa] = useState(true);
  const [growPct, setGrowPct] = useState(3);
  const [anchorYear, setAnchorYear] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scenario = scenarios.find((s) => s.id === pathId) ?? scenarios[0];
  const entry = results?.scenarios?.find((s: any) => s.scenarioId === scenario?.id);
  const overrides: Record<string, number> = useMemo(() => scenario?.lineOverrides?.[lineId] ?? {}, [scenario, lineId]);
  const editable = def?.editable !== false;

  // Esc closes; focus stays inside the drawer while it's open.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("button, input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        const focusable = [...panelRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select, a[href]")];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [onClose]);

  const rows = useMemo(() => {
    return (entry?.projection ?? []).map((row: any) => {
      const line = row.lines?.[lineId];
      const months = line?.months ?? 0;
      const calcMonthly = months ? line.calc / months : 0;
      const valueMonthly = months ? line.value / months : 0;
      const override = overrides[String(row.calendarYear)];
      return {
        year: row.calendarYear as number,
        age: row.age as number,
        where: whereLabel(row),
        months,
        calcMonthly,
        valueMonthly,
        override: typeof override === "number" ? override : null,
        status: line?.status as string | undefined,
        notes: (line?.notes ?? []) as string[],
        applies: months > 0,
      };
    });
  }, [entry, lineId, overrides]);

  const shown = hideNa ? rows.filter((r: any) => r.applies || r.status) : rows;
  const editedCount = Object.keys(overrides).length;

  function setOverrides(next: Record<string, number>, targetIds: string[] = [scenario.id]) {
    dispatch({
      type: "setScenarios",
      scenarios: scenarios.map((s) => {
        if (!targetIds.includes(s.id)) return s;
        const all = { ...(s.lineOverrides ?? {}) };
        const merged = s.id === scenario.id ? next : { ...(all[lineId] ?? {}), ...next };
        if (Object.keys(merged).length) all[lineId] = merged;
        else delete all[lineId];
        return { ...s, lineOverrides: all };
      }),
    });
  }

  function setYear(year: number, value: number | null) {
    const next = { ...overrides };
    if (value === null || Number.isNaN(value)) delete next[String(year)];
    else next[String(year)] = value;
    setOverrides(next);
  }

  function fillForward(fromYear: number, grow: number) {
    const start = rows.find((r: any) => r.year === fromYear);
    if (!start) return;
    const base = start.override ?? start.calcMonthly;
    const next = { ...overrides };
    for (const r of rows) {
      if (r.year < fromYear || !r.applies) continue;
      next[String(r.year)] = Math.round(base * (1 + grow) ** (r.year - fromYear));
    }
    setOverrides(next);
  }

  const anchor = anchorYear ?? shown.find((r: any) => r.applies)?.year ?? null;
  const others = scenarios.filter((s) => s.id !== scenario?.id);
  const lifetimeDelta = rows.reduce((sum: number, r: any) => sum + (r.override !== null ? (r.valueMonthly - r.calcMonthly) * r.months : 0), 0);

  // Mini chart: calculated vs yours, monthly, over the years the line applies.
  const chart = useMemo(() => {
    const pts = rows.filter((r: any) => r.applies);
    if (pts.length < 2) return null;
    const w = 520, h = 70, pad = 4;
    const max = Math.max(...pts.flatMap((r: any) => [r.calcMonthly, r.valueMonthly]), 1);
    const x0 = rows[0].year, x1 = rows[rows.length - 1].year;
    const sx = (y: number) => pad + ((y - x0) / Math.max(x1 - x0, 1)) * (w - pad * 2);
    const sy = (v: number) => h - pad - (v / max) * (h - pad * 2);
    const path = (key: "calcMonthly" | "valueMonthly") =>
      pts.map((r: any, i: number) => `${i ? "L" : "M"}${sx(r.year).toFixed(1)},${sy(r[key]).toFixed(1)}`).join(" ");
    return { w, h, calc: path("calcMonthly"), value: path("valueMonthly"), max };
  }, [rows]);

  const label = lineLabel(lineId, lineDefs, profile);

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" ref={panelRef}>
        <header className="drawer-head">
          <div>
            <p className="drawer-eyebrow">{def?.group ?? "Household"} · year by year</p>
            <h3 id="drawer-title">{label}</h3>
          </div>
          <button className="small" onClick={onClose} aria-label="Close">✕</button>
        </header>
        {def?.help && <p className="drawer-help">{def.help}</p>}

        <div className="drawer-paths" role="group" aria-label="Path">
          {scenarios.map((s, i) => (
            <button key={s.id} className={s.id === scenario?.id ? "on" : ""} aria-pressed={s.id === scenario?.id} onClick={() => setPathId(s.id)}>
              <span className="pathdot" style={{ background: pathColor(i, theme), display: "inline-block", marginRight: 6, width: 8, height: 8 }} />
              {s.displayName || s.name}
              {s.lineOverrides?.[lineId] ? <span className="edit-dot" aria-label="has edits" /> : null}
            </button>
          ))}
        </div>

        {chart && (
          <div className="drawer-chart">
            <svg viewBox={`0 0 ${chart.w} ${chart.h}`} preserveAspectRatio="none" role="img" aria-label={`Calculated vs your ${label} by year`}>
              <path d={chart.calc} fill="none" stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
              <path d={chart.value} fill="none" stroke="var(--gold)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="drawer-legend">
              <span><i className="lg-calc" /> calculated</span>
              <span><i className="lg-yours" /> with your edits</span>
              <span style={{ marginLeft: "auto" }}>peak {fmtMoney(chart.max)}/mo</span>
            </div>
          </div>
        )}

        {editable && (
          <div className="drawer-tools">
            <label className="notice" htmlFor="anchor-year">From</label>
            <select id="anchor-year" value={anchor ?? ""} onChange={(e) => setAnchorYear(Number(e.target.value))} style={{ width: 90 }}>
              {rows.filter((r: any) => r.applies).map((r: any) => <option key={r.year} value={r.year}>{r.year}</option>)}
            </select>
            <button className="small" disabled={anchor === null} onClick={() => anchor !== null && fillForward(anchor, 0)} title="Copy this year's monthly amount to every later year">
              Fill forward
            </button>
            <span className="grow">
              <button className="small" disabled={anchor === null} onClick={() => anchor !== null && fillForward(anchor, growPct / 100)} title="Grow from this year by a yearly rate">
                Grow
              </button>
              <input type="number" step={0.5} value={growPct} onChange={(e) => setGrowPct(Number(e.target.value))} aria-label="Yearly growth percent" />
              <span className="notice">%/yr</span>
            </span>
            <span style={{ flex: 1 }} />
            {others.length > 0 && editedCount > 0 && (
              <button className="small" onClick={() => setOverrides(overrides, others.map((o) => o.id))} title="Apply these edits to every other path (years that exist there)">
                Copy to other paths
              </button>
            )}
            <button className="small danger" disabled={!editedCount} onClick={() => setOverrides({})}>Reset all</button>
          </div>
        )}

        <div className="drawer-summary">
          <span>{editedCount ? `${editedCount} year${editedCount > 1 ? "s" : ""} edited` : "Showing calculated values — type in “Yours” to change a year"}</span>
          {editedCount > 0 && <span>lifetime change {lifetimeDelta >= 0 ? "+" : "−"}{fmtMoney(Math.abs(lifetimeDelta), true)}</span>}
          <label className="notice" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={hideNa} onChange={(e) => setHideNa(e.target.checked)} />
            only years it applies
          </label>
        </div>

        <div className="drawer-table" role="region" aria-label="Years" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col">Where / phase</th>
                <th scope="col" className="num">Calculated</th>
                <th scope="col" className="num">Yours /mo</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r: any, idx: number) => {
                const status = r.status ? STATUS_LABEL[r.status] : null;
                // A note is shown when it changes, not repeated on every year.
                const prevNote = idx > 0 ? shown[idx - 1].notes[0] : undefined;
                const note = r.notes[0] && r.notes[0] !== prevNote ? r.notes[0] : null;
                return (
                  <tr key={r.year} className={`${r.override !== null ? "edited" : ""}${!r.applies ? " na" : ""}`} onFocus={() => r.applies && setAnchorYear(r.year)}>
                    <td className="yr">
                      {r.year}
                      <span>age {r.age}</span>
                    </td>
                    <td className="where">
                      <span>{r.where}</span>
                      {(status || note || (r.applies && r.months < 12)) && (
                        <span className="row-notes" title={r.notes.join("\n") || undefined}>
                          {status && <span className={`chip ${status.tone}`} title={status.title}>{status.label}</span>}
                          {r.applies && r.months < 12 && <span className="chip">{Math.round(r.months)} mo</span>}
                          {note && <span className="note">{note}</span>}
                        </span>
                      )}
                    </td>
                    <td className="num">{r.applies ? `${fmtMoney(r.calcMonthly)}` : <span className="na-text">n/a</span>}</td>
                    <td className="num yours">
                      {r.applies && editable ? (
                        <span className="yours-cell">
                          <input
                            type="number"
                            inputMode="decimal"
                            aria-label={`${label} per month in ${r.year}`}
                            placeholder={String(Math.round(r.calcMonthly))}
                            value={r.override ?? ""}
                            onChange={(e) => setYear(r.year, e.target.value === "" ? null : Number(e.target.value))}
                          />
                          {r.override !== null && (
                            <button className="lock-btn" onClick={() => setYear(r.year, null)} aria-label={`Reset ${r.year} to calculated`} title="Back to calculated">↺</button>
                          )}
                        </span>
                      ) : r.applies ? (
                        fmtMoney(r.valueMonthly)
                      ) : (
                        <span className="na-text" title="This line doesn't apply this year (e.g. a different phase or location)">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!shown.length && (
                <tr>
                  <td colSpan={4} className="na-text" style={{ padding: 16 }}>This line doesn't apply to any year on this path.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="drawer-foot">Monthly amounts in each year's own dollars (nominal). Blank = use the calculation. Edits apply to this path only.</p>
      </div>
    </div>
  );
}
