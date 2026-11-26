/* Grad-school block: pick a real degree offering (school → level → program),
   the VA benefit that pays for it, and any outside funding — then see what the
   school costs and what pays for it, straight from the computed projection. */

import { fmtMoney, useDollars } from "../state/store";

const LEVELS: { id: string; label: string }[] = [
  { id: "masters", label: "Master's" },
  { id: "phd", label: "PhD / doctoral" },
  { id: "combined", label: "Master's + PhD" },
];

const BENEFITS: { id: string; label: string; hint: string }[] = [
  { id: "gi_bill", label: "GI Bill", hint: "Post-9/11: housing (MHA) + books; tuition in full at public schools, up to the cap at private/foreign." },
  { id: "vre", label: "VR&E", hint: "Ch. 31: tuition, fees and books in full; monthly subsistence at the Post-9/11 rate. Doesn't use GI Bill months." },
  { id: "none", label: "None", hint: "Pay your own way — tuition is out of pocket and no VA housing." },
];

const COUNTRY_LABEL: Record<string, string> = { US: "United States", JP: "Japan", GB: "United Kingdom" };

interface Props {
  block: any;
  scenario: any;
  programs: any[];
  locations: any[];
  entry: any | undefined;
  blockRows: any[]; // projection rows this block covers
  onChange: (patch: any) => void;
}

/* Sum a line over the block's years; money is converted per year (Real
   2026$ or nominal) before summing, months are not. */
function sumLine(rows: any[], id: string, key: "value" | "months" = "value", factor: (row: any) => number = () => 1): number {
  return rows.reduce((s, r) => s + (r.lines?.[id]?.[key] ?? 0) * (key === "value" ? factor(r) : 1), 0);
}

export function GradBlockEditor({ block, scenario, programs, locations, blockRows, onChange }: Props) {
  const dollars = useDollars();
  const offerings = programs.filter((p) => !p.legacy && p.institutionId);
  const current = programs.find((p) => p.id === block.programId);
  const offering = current?.legacy ? programs.find((p) => p.id === current.offeringId) : current;
  const institutions = [...new Map(offerings.map((o) => [o.institutionId, o])).values()];
  const instId = offering?.institutionId ?? institutions[0]?.institutionId;
  const instOfferings = offerings.filter((o) => o.institutionId === instId);
  const levels = LEVELS.filter((l) => instOfferings.some((o) => o.level === l.id));
  const level = offering?.level ?? levels[0]?.id;
  const levelOfferings = instOfferings.filter((o) => o.level === level);
  const benefit = block.benefit ?? (scenario.useGiBill ? "gi_bill" : "none");
  const approved = offering?.vaApprovalStatus === "approved";
  const assume = !!block.overrides?.assumeVaApproved;

  const pick = (o: any) => {
    if (!o) return;
    onChange({
      programId: o.id,
      durationMonths: Math.round((o.durationYearsDefault ?? 2) * 12),
      fundingSourceId: null,
    });
  };

  const byCountry = new Map<string, any[]>();
  for (const inst of institutions) {
    const list = byCountry.get(inst.country) ?? [];
    list.push(inst);
    byCountry.set(inst.country, list);
  }

  // Money read back from the computed projection for this block's years.
  const f = dollars.factor;
  const tuition = sumLine(blockRows, "tuitionFees", "value", f);
  const paid = sumLine(blockRows, "tuitionPaid", "value", f);
  const stipend = sumLine(blockRows, "stipend", "value", f);
  const housingMonths = benefit === "vre" ? sumLine(blockRows, "vreSubsistence", "months") : sumLine(blockRows, "giHousing", "months");
  const housing = benefit === "vre" ? sumLine(blockRows, "vreSubsistence", "value", f) : sumLine(blockRows, "giHousing", "value", f);
  const books = sumLine(blockRows, "giBooks", "value", f);
  const blockMonths = block.durationMonths ?? 0;
  const loc = locations.find((l) => l.id === offering?.locationId);
  const fundedYears = offering?.fundedYears;

  return (
    <div className="grad-editor">
      <div className="grad-pick">
        <div style={{ minWidth: 200, flex: 1.2 }}>
          <label className="field" htmlFor={`inst-${block.id}`}>School</label>
          <select
            id={`inst-${block.id}`}
            value={instId}
            onChange={(e) => {
              const list = offerings.filter((o) => o.institutionId === e.target.value);
              pick(list.find((o) => o.level === level) ?? list[0]);
            }}
          >
            {[...byCountry.entries()].map(([country, list]) => (
              <optgroup key={country} label={COUNTRY_LABEL[country] ?? country}>
                {list.map((inst) => <option key={inst.institutionId} value={inst.institutionId}>{inst.institution}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="field">Degree</label>
          <div className="toggle" role="group" aria-label="Degree level">
            {levels.map((l) => (
              <button
                key={l.id}
                className={l.id === level ? "on" : ""}
                aria-pressed={l.id === level}
                onClick={() => pick(instOfferings.find((o) => o.level === l.id))}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <label className="field" htmlFor={`prog-${block.id}`}>Program</label>
      <select id={`prog-${block.id}`} value={offering?.id ?? ""} onChange={(e) => pick(offerings.find((o) => o.id === e.target.value))}>
        {levelOfferings.map((o) => <option key={o.id} value={o.id}>{o.programName}</option>)}
      </select>
      {offering && (
        <p className="notice" style={{ margin: "4px 0 0" }}>
          {loc?.label ?? offering.locationId} · standard {offering.durationYearsDefault} yr
          {offering.typicalDurationYears && offering.typicalDurationYears !== offering.durationYearsDefault ? ` (typically ${offering.typicalDurationYears})` : ""}
          {offering.englishTaught && offering.englishTaught !== "yes" ? ` · English-taught: ${offering.englishTaught}` : ""}
          {blockMonths && offering.durationYearsDefault && Math.round(offering.durationYearsDefault * 12) !== blockMonths ? (
            <>
              {" · "}
              <button className="linkish" onClick={() => onChange({ durationMonths: Math.round(offering.durationYearsDefault * 12) })}>
                reset to {offering.durationYearsDefault} yr
              </button>
            </>
          ) : null}
          {offering.url ? (
            <>
              {" · "}
              <a href={offering.url} target="_blank" rel="noreferrer noopener">program page ↗</a>
            </>
          ) : null}
        </p>
      )}

      <div className="grad-pick" style={{ marginTop: 4 }}>
        <div>
          <label className="field">Paid for with</label>
          <div className="toggle" role="group" aria-label="Education benefit">
            {BENEFITS.map((b) => (
              <button key={b.id} className={benefit === b.id ? "on" : ""} aria-pressed={benefit === b.id} title={b.hint} onClick={() => onChange({ benefit: b.id })}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label className="field" htmlFor={`fund-${block.id}`}>Stipend / funding</label>
          <select
            id={`fund-${block.id}`}
            value={block.fundingSourceId ?? ""}
            onChange={(e) => onChange({ fundingSourceId: e.target.value || null })}
          >
            <option value="">
              {offering?.stipendAnnual
                ? `Program funding — ${fmtMoney(offering.stipendAnnual)}/yr${fundedYears ? `, ${fundedYears} yrs` : ""}`
                : "No program stipend (typical for this degree)"}
            </option>
            {(offering?.fundingSources ?? []).map((src: any) => (
              <option key={src.id} value={src.id}>
                {src.label} — {fmtMoney(src.stipendAnnual)}/yr{src.years ? `, ${src.years} yrs` : ""} (if awarded)
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="notice" style={{ margin: "4px 0 0" }}>{BENEFITS.find((b) => b.id === benefit)?.hint}</p>

      {offering && !approved && benefit !== "none" && (
        <div className="va-warning" role="note">
          <strong>VA approval not confirmed.</strong> Foreign programs must be VA-approved (the school requests it) before the
          {benefit === "vre" ? " VR&E" : " GI Bill"} can pay — so this pays $0 unless you assume approval.
          <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
            <input
              type="checkbox"
              checked={assume}
              onChange={(e) => onChange({ overrides: { ...(block.overrides ?? {}), assumeVaApproved: e.target.checked } })}
            />
            Assume it gets approved (what-if)
          </label>
        </div>
      )}

      {blockRows.length > 0 && (
        <div className="school-money" aria-label="School money over this block">
          <div>
            <span>Tuition &amp; fees</span>
            <strong>{fmtMoney(tuition, true)}</strong>
            <em>{tuition === 0 ? (offering?.tuitionWaived ? "waived while funded" : "none") : "whole block"}</em>
          </div>
          <div>
            <span>VA pays school</span>
            <strong>{fmtMoney(paid, true)}</strong>
            <em>{tuition > 0 ? `you pay ${fmtMoney(Math.max(tuition - paid, 0), true)}` : "—"}</em>
          </div>
          <div>
            <span>{benefit === "vre" ? "Subsistence" : "Housing (MHA)"}</span>
            <strong>{housingMonths ? `${fmtMoney(housing / housingMonths)}/mo` : "—"}</strong>
            <em>{housingMonths ? `${Math.round(housingMonths)} of ${blockMonths} mo paid` : benefit === "none" ? "no benefit" : "not paid"}</em>
          </div>
          <div>
            <span>Stipend</span>
            <strong>{fmtMoney(stipend, true)}</strong>
            <em>{books ? `+ ${fmtMoney(books, true)} books` : "taxable"}</em>
          </div>
        </div>
      )}
      {offering?.estimatedFields?.length ? (
        <p className="notice" style={{ margin: "6px 0 0" }}>Estimated: {offering.estimatedFields.join("; ")}. Edit in Assumptions → programs.</p>
      ) : null}
    </div>
  );
}
