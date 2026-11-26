"""Social Security retirement benefit from SSA's own formula — no manual entry.

1. Covered earnings by year: military basic pay (past years rebuilt from the
   DFAS 2026 table and the official annual pay raises; future years from the
   projection) and civilian salary, each capped at that year's taxable maximum.
2. Wage-index each year's earnings to the year you turn 60 (SSA's national
   average wage index; projected forward at its 2014–2025 average growth).
3. AIME = the highest 35 indexed years / 420, rounded down to the dollar.
4. PIA = 90% / 32% / 15% of AIME across the bend points for the year you turn
   62 (1979 bend points x AWI(62-2) / AWI(1977)), rounded down to the dime.
5. COLAs from 62 to the claim year; then the early/delayed claiming factor.

All official inputs come from SSA's annual Federal Register notices
(data_social_security.json); see Sources → Official documents.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

_PATH = Path(__file__).resolve().parent / "data_social_security.json"
_cache: dict[str, Any] | None = None

# Typical USAF enlisted progression used for past years only when no past
# promotions are entered (months after service entry). Editable in the
# Path Builder's Promotions list.
DEFAULT_PAST_PATH = [("E-1", 0), ("E-2", 6), ("E-3", 16), ("E-4", 36), ("E-5", 54), ("E-6", 96)]


def load() -> dict[str, Any]:
    global _cache
    if _cache is None:
        _cache = json.loads(_PATH.read_text(encoding="utf-8")) if _PATH.exists() else {}
    return _cache


def awi(year: int) -> float:
    data = load()
    table = {int(k): float(v) for k, v in data["averageWageIndex"].items()}
    last = max(table)
    if year <= last:
        return table.get(year, table[min(table)])
    return table[last] * (1 + data["projection"]["wageGrowth"]) ** (year - last)


def taxable_maximum(year: int) -> float:
    data = load()
    table = {int(k): float(v) for k, v in data["taxableMaximum"].items()}
    if year in table:
        return table[year]
    if year < min(table):
        return table[min(table)]
    # SSA's formula: 60,600 x AWI(year-2) / AWI(1992), rounded to the nearest $300.
    return round(60600 * awi(year - 2) / 22935.42 / 300) * 300


def cola_factor(from_year: int, to_year: int) -> float:
    """Product of COLAs effective in January of each year in (from_year, to_year]."""
    data = load()
    table = {int(k): float(v) for k, v in data["colaPercentByYear"].items()}
    factor = 1.0
    for year in range(from_year + 1, to_year + 1):
        pct = table.get(year)
        factor *= 1 + (pct / 100 if pct is not None else data["projection"]["cola"])
    return factor


def bend_points(eligibility_year: int) -> tuple[int, int]:
    data = load()
    b1, b2 = data["bendPoints1979"]
    ratio = awi(eligibility_year - 2) / float(data["averageWageIndex1977"])
    return round(b1 * ratio), round(b2 * ratio)


def pia_from_earnings(earnings: dict[int, float], birth_year: int) -> dict[str, Any]:
    data = load()
    index_year = birth_year + 60
    eligibility_year = birth_year + 62
    indexed = []
    for year, amount in earnings.items():
        capped = min(max(amount, 0.0), taxable_maximum(year))
        factor = awi(index_year) / awi(year) if year < index_year else 1.0
        indexed.append((capped * factor, year))
    top = sorted(indexed, reverse=True)[:35]
    aime = math.floor(sum(v for v, _ in top) / 420)
    b1, b2 = bend_points(eligibility_year)
    f1, f2, f3 = data["piaFactors"]
    raw = f1 * min(aime, b1) + f2 * max(min(aime, b2) - b1, 0) + f3 * max(aime - b2, 0)
    pia = math.floor(raw * 10) / 10
    return {
        "aime": aime, "pia": pia, "bendPoints": [b1, b2], "eligibilityYear": eligibility_year,
        "indexYear": index_year, "yearsCounted": len([v for v, _ in top if v > 0]),
        "topYears": sorted(y for v, y in top if v > 0),
    }


def claim_factor(domains: dict, claim_age: int) -> float:
    for row in domains.get("ss_claim_factors", []):
        if int(row.get("claimAge", 0)) == int(claim_age):
            return float(row.get("factor", 1.0))
    return 1.0


def monthly_at_claim(earnings: dict[int, float], birth_year: int, claim_age: int, domains: dict) -> dict[str, Any]:
    """Nominal monthly benefit in the first year of claiming, with the details."""
    result = pia_from_earnings(earnings, birth_year)
    claim_year = birth_year + claim_age
    pia_at_claim = result["pia"] * cola_factor(result["eligibilityYear"], claim_year)
    factor = claim_factor(domains, claim_age)
    result.update({
        "claimAge": claim_age, "claimYear": claim_year, "claimFactor": factor,
        "piaAtClaimYear": round(pia_at_claim, 2),
        "monthlyAtClaim": round(math.floor(pia_at_claim * factor), 2),  # SSA rounds the benefit down to the dollar
    })
    return result


def _pay_index(year: int, grade: str = "", month: int = 12) -> float:
    """Ratio of a year's basic pay table to the 2026 table, from the official raises
    (plus the April 2025 junior-enlisted increase for E-1–E-4)."""
    data = load()
    raises = {int(k): float(v) for k, v in data["militaryPayRaisePercent"].items()}
    factor = 1.0
    for y in range(year + 1, 2027):
        factor /= 1 + raises.get(y, 0.0) / 100
    extra = data.get("juniorEnlisted2025ExtraRaise") or {}
    if grade in extra.get("grades", []) and (year < 2025 or (year == 2025 and month < 4)):
        factor /= 1 + float(extra.get("percent", 0)) / 100
    return factor


def past_military_earnings(pay_data: dict, profile: dict, through_year: int) -> tuple[dict[int, float], list[dict]]:
    """Basic pay by calendar year from service entry up to (not including) `through_year`.

    Rebuilt from the DFAS 2026 table at the grade and years of service held each
    month, scaled to that year by the official annual pay raises. Uses the
    profile's past promotions; otherwise a typical enlisted progression to the
    current grade (marked as assumed)."""
    service = profile.get("serviceProfile") or {}
    entry_year = int(service.get("serviceEntryYear", profile.get("serviceEntryYear", 2014)))
    entry_month = int(service.get("serviceEntryMonth", 2))
    entries = []
    for item in service.get("gradeHistory") or []:
        if item.get("grade") and item.get("year"):
            entries.append((int(item["year"]), int(item.get("month") or 1), str(item["grade"])))
    entries.sort()
    current = str(service.get("payGrade", "E-7"))
    order = ["E-1", "E-2", "E-3", "E-4", "E-5", "E-6", "E-7", "E-8", "E-9"]
    # Grades below the earliest one on record (or below the current grade when
    # nothing is recorded) follow a typical enlisted progression — marked assumed.
    earliest = entries[0] if entries else None
    target_grade = earliest[2] if earliest else current
    target = order.index(target_grade) if target_grade in order else 6
    before = (earliest[0], earliest[1]) if earliest else (through_year, 1)
    assumed = []
    for grade, months in DEFAULT_PAST_PATH:
        if order.index(grade) >= target:
            break
        total = entry_month - 1 + months
        y, m = entry_year + total // 12, total % 12 + 1
        if (y, m) < before:
            entries.append((y, m, grade))
            assumed.append({"grade": grade, "year": y, "month": m})
    entries.sort()
    earnings: dict[int, float] = {}
    for year in range(entry_year, through_year):
        total = 0.0
        for month in range(1, 13):
            if (year, month) < (entry_year, entry_month):
                continue
            grade = None
            for y, m, g in entries:
                if (y, m) <= (year, month):
                    grade = g
            grade = grade or current
            months_served = (year - entry_year) * 12 + (month - entry_month)
            yos = months_served // 12
            brackets = pay_data.get("basicPayMonthly", {}).get(grade, {})
            best = None
            for key, value in brackets.items():
                floor = 0 if key == "<2" else int(key)
                if floor <= yos and (best is None or floor >= best[0]):
                    best = (floor, float(value))
            total += (best[1] if best else 0.0) * _pay_index(year, grade, month)
        if total > 0:
            earnings[year] = round(total, 2)
    return earnings, assumed
