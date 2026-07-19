/* Signature element: each path rendered as a service ribbon — one colored
   segment per life phase, width proportional to its share of the horizon. */

const BLOCK_COLORS: Record<string, string> = {
  active_duty: "var(--blk-active)",
  grad_school: "var(--blk-school)",
  tech_career: "var(--blk-tech)",
  research_career: "var(--blk-research)",
  gap: "var(--blk-gap)",
  retire: "var(--blk-retire)",
};

const BLOCK_LABELS: Record<string, string> = {
  active_duty: "Active duty",
  grad_school: "Grad school",
  tech_career: "Tech",
  research_career: "Research",
  gap: "Gap",
  retire: "Retired",
};

export interface RibbonSegment {
  activity: string;
  startYear: number;
  years: number;
}

export function segmentsFromProjection(projection: any[]): RibbonSegment[] {
  const segments: RibbonSegment[] = [];
  for (const row of projection) {
    const activity = row.activityType;
    const last = segments[segments.length - 1];
    if (last && last.activity === activity) last.years += 1;
    else segments.push({ activity, startYear: row.calendarYear, years: 1 });
  }
  return segments;
}

export function Ribbon({ label, projection }: { label: string; projection: any[] }) {
  const segments = segmentsFromProjection(projection);
  const total = projection.length || 1;
  return (
    <div className="ribbon-row">
      <div className="ribbon-label">{label}</div>
      <div className="ribbon" role="img" aria-label={`${label} phase timeline`}>
        {segments.map((seg) => (
          <div
            key={`${seg.activity}-${seg.startYear}`}
            className="seg"
            style={{
              flex: seg.years,
              background: BLOCK_COLORS[seg.activity] ?? "var(--blk-gap)",
            }}
            title={`${BLOCK_LABELS[seg.activity] ?? seg.activity}: ${seg.startYear}–${seg.startYear + seg.years - 1}`}
          >
            {seg.years / total > 0.08 ? BLOCK_LABELS[seg.activity] ?? seg.activity : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export function RibbonScale({ projection }: { projection: any[] }) {
  if (!projection.length) return null;
  const first = projection[0].calendarYear;
  const last = projection[projection.length - 1].calendarYear;
  const mid = Math.round((first + last) / 2);
  return (
    <div className="ribbon-row" aria-hidden="true">
      <div className="ribbon-label" />
      <div className="ribbon-scale">
        <span>{first}</span>
        <span>{mid}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}
