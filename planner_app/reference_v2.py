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
