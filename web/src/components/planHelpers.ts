/* Shared helpers for the path builder and year-by-year editor. */

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* Standard DFAS 2026 pay grades (researched, all-grade table). */
export const PAY_GRADES = [
  "E-1", "E-2", "E-3", "E-4", "E-5", "E-6", "E-7", "E-8", "E-9",
  "W-1", "W-2", "W-3", "W-4", "W-5",
  "O-1", "O-2", "O-3", "O-1E", "O-2E", "O-3E",
  "O-4", "O-5", "O-6", "O-7", "O-8", "O-9", "O-10",
];

export const STATE_NAMES: Record<string, string> = {
  AK: "Alaska", AZ: "Arizona", CA: "California", CO: "Colorado", FL: "Florida", GA: "Georgia",
  IL: "Illinois", MA: "Massachusetts", NC: "North Carolina", NH: "New Hampshire", NJ: "New Jersey",
  NV: "Nevada", NY: "New York", OR: "Oregon", PA: "Pennsylvania", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", VA: "Virginia", WA: "Washington", WY: "Wyoming",
};

export interface LocationGroup {
  label: string;
  items: any[];
}

export function isOverseasLocation(loc: any): boolean {
  return !!loc && (loc.countryCode ?? "US").toUpperCase() !== "US";
}

/* Locations grouped for pickers: duty stations first (stateside, then
   overseas), then every other city. */
export function groupLocations(locations: any[], forStations: boolean): LocationGroup[] {
  const bases = locations.filter((l) => l.regionType === "military_base");
  const overseasBases = locations.filter((l) => l.regionType === "military_base_overseas");
  const rest = locations.filter((l) => !String(l.regionType ?? "").startsWith("military_base") && l.id !== "us_metro_average");
  const stateside = rest.filter((l) => !isOverseasLocation(l));
  const abroad = rest.filter((l) => isOverseasLocation(l));
  const groups: LocationGroup[] = forStations
    ? [
        { label: "Stateside bases", items: bases },
        { label: "Overseas bases", items: overseasBases },
        { label: "Other US cities", items: stateside },
        { label: "Other international cities", items: abroad },
      ]
    : [
        { label: "US cities", items: stateside },
        { label: "International", items: abroad },
        { label: "Bases", items: [...bases, ...overseasBases] },
      ];
  return groups.filter((g) => g.items.length);
}

export function locationLabel(locations: any[], id: string | null | undefined): string {
  return locations.find((l) => l.id === id)?.label ?? id ?? "—";
}

/* "Jan 2026" style month label from an absolute month index (0 = Jan of base year). */
export function monthLabel(index: number, baseYear: number): string {
  const year = baseYear + Math.floor(index / 12);
  return `${MONTHS[((index % 12) + 12) % 12]} ${year}`;
}

export function exitMonthIndex(scenario: any, baseYear: number): number {
  return (scenario.serviceExit.year - baseYear) * 12 + (scenario.serviceExit.month - 1);
}

/* Month ranges each station covers, mirroring the engine's resolver. */
export function stationRanges(stations: any[], exitIndex: number): { start: number; end: number; clipped: boolean }[] {
  let cursor = 0;
  return stations.map((s, i) => {
    const last = i === stations.length - 1;
    const start = cursor;
    if (start > exitIndex) return { start, end: start - 1, clipped: true };
    const end = last || s.durationMonths == null ? exitIndex : Math.min(cursor + Number(s.durationMonths) - 1, exitIndex);
    cursor = end + 1;
    return { start, end, clipped: false };
  });
}

export function yearsMonths(months: number | null | undefined): string {
  if (months == null) return "until exit";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} yr` : "", m ? `${m} mo` : ""].filter(Boolean).join(" ") || "0 mo";
}

/* Monthly value of a line in a projection row (0 when it doesn't apply). */
export function lineMonthly(row: any, lineId: string): number {
  const line = row?.lines?.[lineId];
  if (!line || !line.months) return 0;
  return line.value / line.months;
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function lineLabel(lineId: string, lineDefs: any[], profile: any): string {
  const def = lineDefs.find((d) => d.id === lineId);
  if (def) return def.label;
  if (lineId.startsWith("hh:")) {
    const [, memberId, costId] = lineId.split(":");
    const member = (profile?.household ?? []).find((m: any) => m.id === memberId);
    const cost = (member?.costs ?? []).find((c: any) => c.id === costId);
    return `${member?.name ?? "Household"} · ${cost?.label ?? "cost"}`;
  }
  return lineId;
}

