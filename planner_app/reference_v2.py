"""Locked reference records added for the V2 retirement lifecycle.

These are public-knowledge parameters (locked by default in the UI, editable
only via an explicit override): Social Security claim-age factors, RMD divisor
table, Medicare premium baseline, employer-match default, capital-gains rate,
and general inflation. Each record carries a source label/URL so the Sources
view and export citations keep working.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_LOCATION_COSTS_PATH = Path(__file__).resolve().parent / "data_location_costs.json"

LOCATION_LABELS = {
    "redmond_wa": "Redmond / Bellevue, WA",
    "mountain_view_ca": "Mountain View, CA",
    "santa_clara_ca": "Santa Clara, CA",
    "san_francisco_ca": "San Francisco, CA",
    "us_metro_average": "US metro average",
}

# Which researched city each employer's compensation applies to. Drives
# location-based living expenses during work blocks.
CAREER_LOCATIONS: list[dict[str, Any]] = [
    {"id": "GENERIC_IC", "label": "Generic Big Tech IC", "locationId": "us_metro_average"},
    {"id": "MSFT_SWE", "label": "Microsoft SWE", "locationId": "redmond_wa"},
    {"id": "GOOG_SWE", "label": "Google SWE", "locationId": "mountain_view_ca"},
    {"id": "NVDA_IC", "label": "NVIDIA IC", "locationId": "santa_clara_ca"},
    {"id": "INTEL_IC", "label": "Intel IC", "locationId": "santa_clara_ca"},
    {"id": "STARTUP_TECH", "label": "Funded startup", "locationId": "san_francisco_ca"},
    {"id": "CONSERVATIVE", "label": "Conservative default", "locationId": "us_metro_average"},
    {"id": "INTEL_LABS", "label": "Intel Labs", "locationId": "santa_clara_ca"},
    {"id": "NEURALINK", "label": "Neuralink", "locationId": "san_francisco_ca"},
    {"id": "MSFT_RESEARCH", "label": "Microsoft Research", "locationId": "redmond_wa"},
    {"id": "DEEPMIND", "label": "Google DeepMind", "locationId": "mountain_view_ca"},
    {"id": "NVDA_RESEARCH", "label": "NVIDIA Research", "locationId": "santa_clara_ca"},
    {"id": "ANTHROPIC", "label": "Anthropic", "locationId": "san_francisco_ca"},
]

_COST_FIELDS = (
    "housingMonthly",
    "utilitiesMonthly",
    "transportationMonthly",
    "foodMonthly",
    "insuranceMonthly",
    "healthcareOutOfPocketMonthly",
    "personalMonthly",
    "entertainmentMonthly",
    "miscellaneousMonthly",
)


def load_location_costs() -> dict[str, Any]:
    if not _LOCATION_COSTS_PATH.exists():
        return {"locations": {}}
    return json.loads(_LOCATION_COSTS_PATH.read_text(encoding="utf-8"))

V2_REFERENCE_DOMAINS: dict[str, list[dict[str, Any]]] = {
    "ss_claim_factors": [
        {"id": f"ss_claim_{age}", "label": f"Social Security claim at {age}", "claimAge": age, "factor": factor,
         "sourceLabel": "SSA retirement planner (born 1960+, FRA 67)", "sourceUrl": "https://www.ssa.gov/benefits/retirement/planner/agereduction.html"}
        for age, factor in [(62, 0.70), (63, 0.75), (64, 0.80), (65, 0.8667), (66, 0.9333), (67, 1.00), (68, 1.08), (69, 1.16), (70, 1.24)]
    ],
    "rmd_divisors": [
        {"id": f"rmd_{age}", "label": f"RMD divisor at {age}", "age": age, "divisor": divisor,
         "sourceLabel": "IRS Uniform Lifetime Table (2022+)", "sourceUrl": "https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs"}
        for age, divisor in [(73, 26.5), (74, 25.5), (75, 24.6), (76, 23.7), (77, 22.9), (78, 22.0), (79, 21.1), (80, 20.2),
                             (81, 19.4), (82, 18.5), (83, 17.7), (84, 16.8), (85, 16.0), (86, 15.2), (87, 14.4), (88, 13.7),
                             (89, 12.9), (90, 12.2)]
    ],
    "medicare_profiles": [
        {"id": "medicare_baseline", "label": "Medicare Part B + supplement baseline", "annualCost": 2820.0, "inflationRate": 0.045,
         "startAge": 65,
         "sourceLabel": "CMS Part B premium (planning estimate)", "sourceUrl": "https://www.medicare.gov/basics/costs/medicare-costs"},
    ],
    "v2_benefit_rules": [
        {"id": "employer_match_effective_default", "label": "Employer 401(k) match (effective rate of salary)", "valuePercent": 0.04,
         "sourceLabel": "Typical 50% match on first 6-8% of salary", "sourceUrl": "https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-401k-and-profit-sharing-plan-contribution-limits"},
        {"id": "capital_gains_rate_default", "label": "Long-term capital gains federal rate", "valuePercent": 0.15,
         "sourceLabel": "IRS Topic 409", "sourceUrl": "https://www.irs.gov/taxtopics/tc409"},
        {"id": "inflation_general_default", "label": "General inflation (real-dollars deflator)", "valuePercent": 0.025,
         "sourceLabel": "Fed 2% target + margin (planning estimate)", "sourceUrl": "https://www.federalreserve.gov/faqs/economy_14400.htm"},
        {"id": "ss_cola_default", "label": "Social Security COLA", "valuePercent": 0.025,
         "sourceLabel": "SSA COLA history (planning estimate)", "sourceUrl": "https://www.ssa.gov/cola/"},
        {"id": "military_raise_default", "label": "Military annual raise beyond schedule", "valuePercent": 0.025,
         "sourceLabel": "Recent ECI-linked raises (planning estimate)", "sourceUrl": "https://www.dfas.mil/MilitaryMembers/payentitlements/Pay-Tables/"},
        {"id": "retirement_multiplier_per_year", "label": "High-3 multiplier per year of service", "valuePercent": 0.025,
         "sourceLabel": "DFAS High-3 retirement plan", "sourceUrl": "https://www.dfas.mil/retiredmilitary/plan/estimate/"},
        {"id": "cash_reserve_floor_months", "label": "Cash reserve floor (months of expenses)", "valueNumber": 6,
         "sourceLabel": "Planning convention", "sourceUrl": ""},
    ],
    "retirement_tax_profiles": [
        {"id": "retirement_income_default", "label": "Retirement income taxes (pension + traditional withdrawals)",
         "federalRate": 0.12, "stateRate": 0.07,
         "sourceLabel": "Effective-rate planning estimate", "sourceUrl": ""},
    ],
    "ss_taxation_thresholds": [
        {"id": "ss_tax_single", "label": "SS provisional-income thresholds (single)", "filingStatus": "single",
         "lowerThreshold": 25000.0, "upperThreshold": 34000.0, "maxInclusion": 0.85,
         "sourceLabel": "IRS Publication 915", "sourceUrl": "https://www.irs.gov/publications/p915"},
    ],
}


def _apply_location_research(merged: dict[str, list[dict[str, Any]]]) -> None:
    """Overlay researched cost-of-living data onto location_cost_profiles and
    register the new employer locations. Mutates `merged` in place (call with
    copied lists)."""
    research = load_location_costs().get("locations", {})
    if not research:
        return

    locations = list(merged.get("locations", []))
    profiles = list(merged.get("location_cost_profiles", []))
    profile_by_location = {p.get("locationId"): p for p in profiles}
    known_location_ids = {loc["id"] for loc in locations}

    for location_id, data in research.items():
        source = (data.get("sources") or [{}])[0]
        cost_fields = {field: float(data.get(field, 0) or 0) for field in _COST_FIELDS}
        base = {
            **cost_fields,
            "giftsMonthly": 0.0,  # location-independent; stays personal
            "annualGrowthRate": float(data.get("annualGrowthRate", 0.03) or 0.03),
            "researchConfidence": data.get("confidence", ""),
            "notes": data.get("notes", ""),
            "sourceLabel": source.get("title", "Location cost research 2026"),
            "sourceUrl": source.get("url", ""),
            "verificationStatus": f"researched_{data.get('confidence', 'medium')}",
        }
        existing = profile_by_location.get(location_id)
        if existing:
            idx = profiles.index(existing)
            profiles[idx] = {**existing, **base}
        else:
            label = LOCATION_LABELS.get(location_id, location_id.replace("_", " ").title())
            profile_id = f"cost_{location_id}"
            profiles.append({
                "id": profile_id,
                "label": f"{label} living costs",
                "locationId": location_id,
                "estimatedRentMonthly": cost_fields["housingMonthly"],
                **base,
            })
            if location_id not in known_location_ids:
                locations.append({"id": location_id, "label": label, "costProfileId": profile_id})

    merged["locations"] = locations
    merged["location_cost_profiles"] = profiles


_MILITARY_PAY_PATH = Path(__file__).resolve().parent / "data_military_pay_2026.json"
_military_pay_cache: dict[str, Any] | None = None


def load_military_pay_2026() -> dict[str, Any]:
    global _military_pay_cache
    if _military_pay_cache is None:
        _military_pay_cache = (
            json.loads(_MILITARY_PAY_PATH.read_text(encoding="utf-8")) if _MILITARY_PAY_PATH.exists() else {}
        )
    return _military_pay_cache


def _bracket_pay(brackets: dict[str, float], yos: float) -> float:
    """Largest YOS bracket <= yos ('<2' counts as 0)."""
    best_key, best_val = None, 0.0
    for key, value in brackets.items():
        floor = 0.0 if key == "<2" else float(key)
        if floor <= yos and (best_key is None or floor >= best_key):
            best_key, best_val = floor, float(value)
    return best_val


def _bah_for(bah_table: dict[str, Any], location_id: str, grade: str, dependents: bool) -> float:
    entry = bah_table.get(location_id) or bah_table.get("us_metro_average") or {}
    if not entry:
        return 0.0
    rates = entry.get("withDependents" if dependents else "withoutDependents", {})
    key = grade if grade in rates else ("O-7" if grade.startswith("O") else grade)
    return float(rates.get(key, 0.0) or 0.0)


def build_service_projection_domains(
    reference_domains: dict[str, list[dict[str, Any]]],
    planner_profile: dict[str, Any],
) -> dict[str, list[dict[str, Any]]]:
    """Projection view for ANY service profile from the full 2026 pay tables.

    Used when planner_profile carries a `serviceProfile` (the public picker /
    a personalized local profile): pay grade held constant (no auto-promotions
    in v1), YOS advances from the entry date, post-2026 years compound at the
    default military raise, BAH follows the selected duty location, BAS by
    enlisted/officer. The seeded E-7 trajectory (promotions, explicit raise
    schedule) remains the default when `serviceProfile` is absent.
    """
    pay = load_military_pay_2026()
    service = planner_profile.get("serviceProfile") or {}
    if not pay or not service:
        return reference_domains

    grade = str(service.get("payGrade", "E-5"))
    entry_year = int(service.get("serviceEntryYear", planner_profile.get("serviceEntryYear", 2020)))
    entry_month = int(service.get("serviceEntryMonth", 1))
    dependents = bool(service.get("dependents", True))
    location_id = service.get("dutyLocationId", "sacramento_ca")

    base_year = int(planner_profile.get("baseYear", 2026))
    raise_rate = 0.025
    for rule in V2_REFERENCE_DOMAINS.get("v2_benefit_rules", []):
        if rule["id"] == "military_raise_default":
            raise_rate = float(rule.get("valuePercent", 0.025))

    brackets = pay.get("basicPayMonthly", {}).get(grade, {})
    bas_monthly = float(
        pay.get("basMonthly", {}).get("enlisted" if grade.startswith("E") else "officer", 0.0)
    )
    grade_numeric = int("".join(ch for ch in grade if ch.isdigit()) or 0)

    rows: list[dict[str, Any]] = []
    for offset in range(46):  # covers any active-duty span to 40+ YOS
        calendar_year = base_year + offset
        yos = calendar_year - entry_year + (1 if entry_month <= 6 else 0) - 1
        yos = max(yos, 0)
        raise_factor = (1 + raise_rate) ** max(calendar_year - 2026, 0)
        base_monthly = _bracket_pay(brackets, yos) * raise_factor
        bah_monthly = _bah_for(pay.get("bah", {}), location_id, grade, dependents) * raise_factor
        rows.append(
            {
                "id": f"svc_proj_{calendar_year}",
                "label": f"{grade} · {calendar_year} ({yos} YOS)",
                "calendarYear": calendar_year,
                "yearsOfService": yos,
                "projectedPayGradeNumeric": grade_numeric,
                "payGrade": grade,
                "raisePercent": raise_rate if calendar_year > 2026 else 0.0,
                "basePayAnnual": round(base_monthly * 12, 2),
                "bahAnnual": round(bah_monthly * 12, 2),
                "basAnnual": round(bas_monthly * raise_factor * 12, 2),
                "totalMilitaryCompAnnual": round((base_monthly + bah_monthly + bas_monthly * raise_factor) * 12, 2),
                "locationId": location_id,
            }
        )

    hydrated = dict(reference_domains)
    hydrated["military_compensation_projection_view"] = rows
    hydrated["military_service_profile"] = [
        {
            "id": "active_duty_service_profile",
            "label": f"Service profile · {grade}, entered {entry_year}",
            "startingPayGradeNumeric": grade_numeric,
            "payGrade": grade,
            "startingYearsOfService": max(base_year - entry_year, 0),
            "withDependentsFlag": 1 if dependents else 0,
            "sourceLabel": "DFAS 2026 pay tables (researched)",
            "sourceUrl": next((s.get("url", "") for s in pay.get("sources", [])), ""),
        }
    ]
    return hydrated


def merge_v2_reference_domains(reference_domains: dict[str, list[dict[str, Any]]]) -> dict[str, list[dict[str, Any]]]:
    """Return reference domains with the V2 records merged in (non-destructive)."""
    merged = dict(reference_domains)
    for domain, rows in V2_REFERENCE_DOMAINS.items():
        if domain not in merged:
            merged[domain] = rows
    if "career_locations" not in merged:
        merged["career_locations"] = CAREER_LOCATIONS
    _apply_location_research(merged)
    return merged
