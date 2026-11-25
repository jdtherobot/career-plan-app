/* Active duty, station by station: where you're stationed for how long, on or
   off base. Drives BAH stateside and OHA + utility allowance + COLA overseas.
   A path with no stations uses the profile's current duty station throughout. */

import { useState } from "react";
import { fmtMoney } from "../state/store";
import {
  exitMonthIndex,
  groupLocations,
  isOverseasLocation,
  lineMonthly,
  locationLabel,
  monthLabel,
  stationRanges,
  uid,
} from "./planHelpers";

interface Props {
  scenario: any;
  scenarios: any[];
  profile: any;
  locations: any[];
  entry: any | undefined; // this path's computed results
  onChange: (stations: any[]) => void;
  onCopy: (targetIds: string[], stations: any[]) => void;
}

const DEFAULT_PCS_MONTHS = 36;

export function StationTimeline({ scenario, scenarios, profile, locations, entry, onChange, onCopy }: Props) {
  const [copyOpen, setCopyOpen] = useState(false);
  const baseYear = profile?.baseYear ?? 2026;
  const exitIdx = exitMonthIndex(scenario, baseYear);
  const currentId = profile?.serviceProfile?.dutyLocationId ?? "sacramento_ca";
  const explicit: any[] = scenario.stations ?? [];
  const implicit = explicit.length === 0;
  const stations = implicit
    ? [{ id: "current", locationId: currentId, durationMonths: null, housing: "off_base" }]
    : explicit;
  const ranges = stationRanges(stations, exitIdx);
  const groups = groupLocations(locations, true);
  const totalMonths = exitIdx + 1;

  const commit = (next: any[]) => {
    // The last station always runs to the exit; keep earlier ones dated.
    const cleaned = next.map((s, i) => ({
      ...s,
      durationMonths: i === next.length - 1 ? null : s.durationMonths ?? DEFAULT_PCS_MONTHS,
    }));
    onChange(cleaned);
  };
  const materialize = () => stations.map((s) => (s.id === "current" ? { ...s, id: uid("st") } : s));
  const patch = (i: number, p: any) => commit(materialize().map((s, j) => (j === i ? { ...s, ...p } : s)));
  const remove = (i: number) => commit(materialize().filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const next = materialize();
    const t = i + dir;
    if (t < 0 || t >= next.length) return;
    [next[i], next[t]] = [next[t], next[i]];
    commit(next);
  };
  const addPcs = () => {
    const next = materialize();
    // The previous last station gets a real duration so the new one has room.
    const used = ranges.slice(0, -1).reduce((sum, r) => sum + (r.end - r.start + 1), 0);
    const room = Math.max(totalMonths - used, 1);
    next[next.length - 1] = { ...next[next.length - 1], durationMonths: Math.max(Math.min(DEFAULT_PCS_MONTHS, room - 1), 1) };
    next.push({ id: uid("st"), locationId: "raf_alconbury_uk", durationMonths: null, housing: "off_base" });
    commit(next);
  };

  /* What a station pays, read back from the computed projection (first year
     the station covers fully, else its first year). */
  function stationSummary(index: number): { text: string; missing: string[]; source?: string } | null {
    if (!entry || implicit) return null;
    const id = `active_duty:${stations[index].id}`;
    const rows = entry.projection.filter((r: any) => (r.segments ?? []).some((s: any) => s.blockId === id));
    if (!rows.length) return null;
    const row = rows.find((r: any) => (r.segments ?? []).some((s: any) => s.blockId === id && s.months === 12)) ?? rows[0];
    const missing = ["bah", "oha", "cola"]
      .filter((k) => row.lines?.[k]?.status === "missing_official_rate")
      .map((k) => k.toUpperCase());
    const bah = lineMonthly(row, "bah");
    const ua = lineMonthly(row, "ua");
    const cola = lineMonthly(row, "cola");
    const ohaNote: string = (row.lines?.oha?.notes ?? []).find((n: string) => n.startsWith("OHA reimburses")) ?? "";
    const cap = ohaNote.match(/rental allowance: ([A-Z]{3} [\d,.]+)/)?.[1];
    const source = ohaNote.match(/\((DTMO[^)]*)\)/)?.[1];
    const parts: string[] = [];
    if (stations[index].housing === "on_base") parts.push("Gov't quarters");
    if (bah) parts.push(`BAH ${fmtMoney(bah)}/mo`);
    if (cap) parts.push(`OHA rent cap ${cap}/mo`);
    const projected = ohaNote.includes("projected");
    if (ua) parts.push(`UA ${fmtMoney(ua)}`);
    if (cola) parts.push(`COLA ${fmtMoney(cola)}`);
    return { text: parts.join(" · "), missing, source: source && projected ? `${source}; later years projected with local rents` : source };
  }

  const others = scenarios.filter((s) => s.id !== scenario.id);

  return (
    <div className="card station-card" style={{ marginBottom: 12 }}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>Active duty · where you're stationed</h3>
        <div className="row" style={{ gap: 6 }}>
          {others.length > 0 && !implicit && (
            <div className="chart-picker">
              <button className="small" aria-expanded={copyOpen} onClick={() => setCopyOpen(!copyOpen)}>
                Copy to… {copyOpen ? "▲" : "▼"}
              </button>
              {copyOpen && (
                <div className="chart-picker-menu" role="menu">
                  {others.map((o) => (
                    <button
                      key={o.id}
                      className="small"
                      style={{ display: "block", width: "100%", textAlign: "left", border: "none" }}
                      onClick={() => {
                        onCopy([o.id], explicit);
                        setCopyOpen(false);
                      }}
                    >
                      {o.displayName || o.name}
                    </button>
                  ))}
                  <button
                    className="small"
                    style={{ display: "block", width: "100%", textAlign: "left", border: "none", borderTop: "1px solid var(--line)" }}
                    onClick={() => {
                      onCopy(others.map((o) => o.id), explicit);
                      setCopyOpen(false);
                    }}
                  >
                    All other paths
                  </button>
                </div>
              )}
            </div>
          )}
          <button className="small" onClick={addPcs}>+ PCS</button>
        </div>
      </div>
      <p className="sub" style={{ marginTop: 4 }}>
        Stations run back to back from {monthLabel(0, baseYear)}; the last one lasts until you leave
        ({monthLabel(exitIdx, baseYear)}). Stateside pays BAH; overseas pays OHA (your rent, up to a cap), a utility
        allowance and COLA.
      </p>

      {/* Timeline bar */}
      <div className="station-bar" role="img" aria-label={`Station timeline: ${stations.map((s, i) => `${locationLabel(locations, s.locationId)} ${monthLabel(ranges[i].start, baseYear)} to ${monthLabel(ranges[i].end, baseYear)}`).join("; ")}`}>
        {stations.map((s, i) => {
          const r = ranges[i];
          if (r.clipped) return null;
          const width = ((r.end - r.start + 1) / totalMonths) * 100;
          const loc = locations.find((l) => l.id === s.locationId);
          const overseas = isOverseasLocation(loc);
          return (
            <div
              key={s.id}
              className={`station-seg${overseas ? " overseas" : ""}${s.housing === "on_base" ? " on-base" : ""}`}
              style={{ width: `${width}%` }}
              title={`${loc?.label ?? s.locationId} · ${monthLabel(r.start, baseYear)} – ${monthLabel(r.end, baseYear)}`}
            >
              <span>{loc?.label?.split(" (")[0] ?? s.locationId}</span>
            </div>
          );
        })}
      </div>
      <div className="station-scale">
        <span>{baseYear}</span>
        <span>exit {monthLabel(exitIdx, baseYear)}</span>
      </div>

      {stations.map((s, i) => {
        const r = ranges[i];
        const last = i === stations.length - 1;
        const loc = locations.find((l) => l.id === s.locationId);
        const overseas = isOverseasLocation(loc);
        const summary = stationSummary(i);
        return (
          <div className={`station-row${r.clipped ? " clipped" : ""}`} key={s.id}>
            <div className="station-num" aria-hidden>{i + 1}</div>
            <div className="station-fields">
              <div className="station-loc">
                <label className="field" htmlFor={`st-loc-${s.id}`}>
                  {implicit ? "Current duty station" : i === 0 ? "Station (now)" : `PCS ${i}`}
                </label>
                <select id={`st-loc-${s.id}`} value={s.locationId} onChange={(e) => patch(i, { locationId: e.target.value })}>
                  {groups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.items.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="station-dur">
                <label className="field" htmlFor={`st-yr-${s.id}`}>How long</label>
                {last ? (
                  <div className="station-until">until exit · {Math.max(r.end - r.start + 1, 0) >= 12 ? `${Math.floor((r.end - r.start + 1) / 12)} yr ` : ""}{(r.end - r.start + 1) % 12 ? `${(r.end - r.start + 1) % 12} mo` : ""}</div>
                ) : (
                  <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                    <input
                      id={`st-yr-${s.id}`}
                      type="number"
                      min={0}
                      max={40}
                      style={{ width: 58 }}
                      value={Math.floor((s.durationMonths ?? 0) / 12)}
                      onChange={(e) => patch(i, { durationMonths: Math.max(Number(e.target.value) * 12 + ((s.durationMonths ?? 0) % 12), 1) })}
                      aria-label="Years"
                    />
                    <span className="notice">yr</span>
                    <input
                      type="number"
                      min={0}
                      max={11}
                      style={{ width: 50 }}
                      value={(s.durationMonths ?? 0) % 12}
                      onChange={(e) => patch(i, { durationMonths: Math.max(Math.floor((s.durationMonths ?? 0) / 12) * 12 + Number(e.target.value), 1) })}
                      aria-label="Months"
                    />
                    <span className="notice">mo</span>
                  </div>
                )}
              </div>
              <div className="station-housing">
                <label className="field">Housing</label>
                <div className="toggle" role="group" aria-label="Housing">
                  <button className={s.housing !== "on_base" ? "on" : ""} aria-pressed={s.housing !== "on_base"} onClick={() => patch(i, { housing: "off_base" })}>
                    Off base
                  </button>
                  <button className={s.housing === "on_base" ? "on" : ""} aria-pressed={s.housing === "on_base"} onClick={() => patch(i, { housing: "on_base" })}>
                    On base
                  </button>
                </div>
              </div>
            </div>
            <div className="station-meta">
              <span className="station-when">
                {r.clipped ? "starts after you leave — shorten an earlier station" : `${monthLabel(r.start, baseYear)} – ${monthLabel(r.end, baseYear)}`}
              </span>
              {overseas && <span className="tag">Overseas</span>}
              {summary && summary.text && (
                <span className="station-pay" title={summary.source}>
                  {summary.text}
                  {summary.source && <span className="notice"> — {summary.source}</span>}
                </span>
              )}
              {summary && summary.missing.length > 0 && (
                <span className="missing-chip" title="No official DTMO rate is loaded for this grade / dependency status, so it pays $0. Enter the DTMO figure in Assumptions → Duty stations.">
                  Official rate missing: {summary.missing.join(", ")}
                </span>
              )}
              {implicit && <span className="notice">Same station for this whole path. Add a PCS to build a timeline.</span>}
              {!implicit && (
                <span className="row" style={{ gap: 4, marginLeft: "auto" }}>
                  <button className="small" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move station ${i + 1} earlier`}>↑</button>
                  <button className="small" onClick={() => move(i, 1)} disabled={last} aria-label={`Move station ${i + 1} later`}>↓</button>
                  <button className="small danger" onClick={() => remove(i)} aria-label={`Remove station ${i + 1}`}>✕</button>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
