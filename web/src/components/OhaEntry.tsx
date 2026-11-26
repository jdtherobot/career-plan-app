/* Inline "official rate missing" chip for a duty station. It names the exact
   grade / dependency rows the projection needed, and for OHA it opens a small
   form that tells you precisely what to type into the DTMO calculator and
   takes the three figures it returns (rent, utility, MIHA — local currency).
   Saving writes the same overrides as Assumptions → Duty stations. */

import { useEffect, useRef, useState } from "react";
import { useAppState, useDispatch, fmtMoney } from "../state/store";

export interface MissingRate {
  kind: "OHA" | "COLA" | "BAH";
  grade: string;
  dependents: boolean;
  years: number[];
}

const MISSING_RE = /^(OHA|COLA|BAH) for (\S+) (with|without) dependents at /;

/* Missing official rows hit by the rows a station covers, from the engine's line notes. */
export function missingRates(rows: any[]): MissingRate[] {
  const found = new Map<string, MissingRate>();
  for (const row of rows) {
    for (const key of ["oha", "cola", "bah"]) {
      for (const note of row.lines?.[key]?.notes ?? []) {
        const m = String(note).match(MISSING_RE);
        if (!m) continue;
        const id = `${m[1]}|${m[2]}|${m[3]}`;
        const item = found.get(id) ?? { kind: m[1] as MissingRate["kind"], grade: m[2], dependents: m[3] === "with", years: [] };
        if (!item.years.includes(row.calendarYear)) item.years.push(row.calendarYear);
        found.set(id, item);
      }
    }
  }
  return [...found.values()];
}

function yearSpan(years: number[]): string {
  const sorted = [...years].sort((a, b) => a - b);
  return sorted.length > 1 ? `${sorted[0]}–${sorted[sorted.length - 1]}` : String(sorted[0] ?? "");
}

const OHA_CALCULATOR = "https://www.travel.dod.mil/Allowances/Overseas-Housing-Allowance/";
const FIELDS: [string, string][] = [
  ["rentLocal", "OHA rental allowance"],
  ["uaLocal", "Utility / recurring maintenance"],
  ["mihaLocal", "Move-in housing allowance (MIHA)"],
];

export function MissingRateChip({ locationId, missing }: { locationId: string; missing: MissingRate[] }) {
  const { bootstrap, referenceOverrides } = useAppState();
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const station = (bootstrap?.referenceDomains?.overseas_allowances ?? []).find((s: any) => s.id === locationId);
  const ohaMissing = missing.filter((m) => m.kind === "OHA");
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const label = missing.map((m) => `${m.kind} ${m.grade} ${m.dependents ? "w/ deps" : "w/o deps"} (${yearSpan(m.years)})`).join(" · ");
  const editable = !!station && ohaMissing.length > 0;
  const currency = station?.currency ?? "USD";
  const roe = Number(station?.roeLocalPerUsd) || 1;
  const rowId = (m: MissingRate) => `${locationId}:${m.grade}:${m.dependents ? "with" : "without"}`;
  const key = (m: MissingRate, field: string) => `${rowId(m)}|${field}`;

  function save(m: MissingRate) {
    const entries = FIELDS.map(([field]) => [field, values[key(m, field)]] as const).filter(([, v]) => v !== undefined && v !== "");
    if (!entries.length || entries.some(([, v]) => Number.isNaN(Number(v)))) return;
    const id = rowId(m);
    const next = referenceOverrides.filter((o) => !(o.domain === "oha_rates" && o.id === id && entries.some(([f]) => f === o.field)));
    for (const [field, v] of entries) {
      next.push({
        domain: "oha_rates",
        id,
        field,
        value: Number(v),
        original: null,
        reason: `DTMO OHA calculator, ${station?.dtmoLocality ?? locationId}, ${m.grade} ${m.dependents ? "with" : "without"} dependents`,
        at: new Date().toISOString(),
      });
    }
    dispatch({ type: "setOverrides", overrides: next });
    setOpen(false);
  }

  return (
    <span className="missing-wrap" ref={wrapRef}>
      {editable ? (
        <button className="missing-chip as-button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)} title="Enter the DTMO figure">
          Rate missing: {label} — enter ▸
        </button>
      ) : (
        <span className="missing-chip" title="No official DTMO rate is loaded for this grade / dependency status, so it pays $0. Enter the DTMO figure in Assumptions → Duty stations.">
          Rate missing: {label}
        </span>
      )}
      {open && editable && (
        <div className="oha-pop" role="dialog" aria-label="Enter official OHA">
          {ohaMissing.map((m) => (
            <div key={rowId(m)} className="oha-pop-row">
              <p className="oha-pop-title">
                OHA · {m.grade} {m.dependents ? "with" : "without"} dependents · needed {yearSpan(m.years)}
              </p>
              <ol className="oha-steps">
                <li>
                  Open the{" "}
                  <a href={OHA_CALCULATOR} target="_blank" rel="noreferrer">
                    DTMO OHA calculator ↗
                  </a>
                </li>
                <li>
                  Country <strong>{(station?.dtmoLocality ?? "").split(" - ")[0] || station?.label}</strong>, location{" "}
                  <strong>{station?.dtmoLocality ?? station?.label}</strong>
                </li>
                <li>
                  Grade <strong>{m.grade}</strong>, <strong>{m.dependents ? "with" : "without"} dependents</strong>, latest pay period
                </li>
                <li>Copy the three LOCAL CURRENCY figures below ({currency}).</li>
              </ol>
              <div className="oha-fields">
                {FIELDS.map(([field, text]) => {
                  const v = values[key(m, field)] ?? "";
                  const usd = v !== "" && !Number.isNaN(Number(v)) ? Number(v) / roe : null;
                  return (
                    <label key={field} className="oha-field">
                      <span>{text}</span>
                      <span className="oha-input">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          placeholder={currency}
                          value={v}
                          onChange={(e) => setValues({ ...values, [key(m, field)]: e.target.value })}
                        />
                        <span className="notice">{usd === null ? currency : `≈ ${fmtMoney(usd)}`}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                <span className="notice" style={{ marginRight: "auto" }}>
                  ROE {roe} {currency}/USD
                </span>
                <button className="small" onClick={() => setOpen(false)}>Cancel</button>
                <button className="small primary" disabled={!values[key(m, "rentLocal")]} onClick={() => save(m)}>
                  Save OHA
                </button>
              </div>
            </div>
          ))}
          {missing.some((m) => m.kind !== "OHA") && (
            <p className="notice" style={{ marginTop: 6 }}>Other missing rates can be entered in Assumptions → Duty stations.</p>
          )}
        </div>
      )}
    </span>
  );
}
