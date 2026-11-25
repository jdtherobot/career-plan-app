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
    "beale_afb_ca": "Beale AFB, CA (Yuba City / Marysville)",
    "raf_alconbury_uk": "RAF Alconbury / Molesworth, UK",
    "sendai_jp": "Sendai, Japan",
}

# Extra fields for locations registered from research (countryCode drives the
# overseas-allowance rules; regionType groups the pickers).
LOCATION_META = {
    "beale_afb_ca": {"countryCode": "US", "stateCode": "CA", "regionType": "military_base"},
    "raf_alconbury_uk": {"countryCode": "GB", "regionType": "military_base_overseas"},
    "sendai_jp": {"countryCode": "JP", "regionType": "campus"},
    "redmond_wa": {"countryCode": "US", "stateCode": "WA", "regionType": "metro"},
    "mountain_view_ca": {"countryCode": "US", "stateCode": "CA", "regionType": "metro"},
    "santa_clara_ca": {"countryCode": "US", "stateCode": "CA", "regionType": "metro"},
    "san_francisco_ca": {"countryCode": "US", "stateCode": "CA", "regionType": "metro"},
    "us_metro_average": {"countryCode": "US", "regionType": "metro"},
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
                locations.append({"id": location_id, "label": label, "costProfileId": profile_id,
                                  **LOCATION_META.get(location_id, {})})

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


def grade_history(service: dict[str, Any]) -> list[tuple[int, int, str]]:
    """Sorted (year, month, grade) promotions from serviceProfile.gradeHistory."""
    entries = []
    for item in service.get("gradeHistory") or []:
        if not item.get("grade") or item.get("year") in (None, ""):
            continue
        entries.append((int(item["year"]), int(item.get("month") or 1), str(item["grade"])))
    return sorted(entries)


def grade_at(history: list[tuple[int, int, str]], default: str, year: int, month: int) -> str:
    """Grade in effect in a month: the latest promotion on or before it, else the profile grade."""
    current = default
    for h_year, h_month, h_grade in history:
        if (h_year, h_month) <= (year, month):
            current = h_grade
    return current


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

    history = grade_history(service)

    def bas_for(g: str) -> float:
        return float(pay.get("basMonthly", {}).get("enlisted" if g.startswith("E") else "officer", 0.0))

    rows: list[dict[str, Any]] = []
    for offset in range(46):  # covers any active-duty span to 40+ YOS
        calendar_year = base_year + offset
        yos = calendar_year - entry_year + (1 if entry_month <= 6 else 0) - 1
        yos = max(yos, 0)
        raise_factor = (1 + raise_rate) ** max(calendar_year - 2026, 0)
        # Month by month so a mid-year promotion is paid from its month.
        base_sum = bah_sum = bas_sum = 0.0
        for month in range(1, 13):
            g = grade_at(history, grade, calendar_year, month)
            base_sum += _bracket_pay(pay.get("basicPayMonthly", {}).get(g, {}), yos)
            bah_sum += _bah_for(pay.get("bah", {}), location_id, g, dependents)
            bas_sum += bas_for(g)
        year_grade = grade_at(history, grade, calendar_year, 7)
        grade_numeric = int("".join(ch for ch in year_grade if ch.isdigit()) or 0)
        rows.append(
            {
                "id": f"svc_proj_{calendar_year}",
                "label": f"{year_grade} · {calendar_year} ({yos} YOS)",
                "calendarYear": calendar_year,
                "yearsOfService": yos,
                "projectedPayGradeNumeric": grade_numeric,
                "payGrade": year_grade,
                "raisePercent": raise_rate if calendar_year > 2026 else 0.0,
                "basePayAnnual": round(base_sum * raise_factor, 2),
                "bahAnnual": round(bah_sum * raise_factor, 2),
                "basAnnual": round(bas_sum * raise_factor, 2),
                "totalMilitaryCompAnnual": round((base_sum + bah_sum + bas_sum) * raise_factor, 2),
                "locationId": location_id,
            }
        )
    grade_numeric = int("".join(ch for ch in grade if ch.isdigit()) or 0)

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
    _apply_overseas_research(merged)
    _apply_state_tax_research(merged)
    _apply_program_research(merged)
    return merged


_DATA_DIR = Path(__file__).resolve().parent
_json_cache: dict[str, Any] = {}


def _load_json(name: str) -> dict[str, Any]:
    if name not in _json_cache:
        path = _DATA_DIR / name
        _json_cache[name] = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    return _json_cache[name]


def _apply_overseas_research(merged: dict[str, list[dict[str, Any]]]) -> None:
    """Overseas duty stations as editable rows: one row per station (currency,
    official rate of exchange) plus one OHA row and one COLA row per grade and
    dependency status. Rows without an official DTMO value stay empty
    ("missing") — they are never filled with an estimate."""
    if "overseas_allowances" in merged:
        return
    data = _load_json("data_overseas_2026.json")
    stations: list[dict[str, Any]] = []
    oha_rows: list[dict[str, Any]] = []
    cola_rows: list[dict[str, Any]] = []
    for location_id, entry in (data.get("stations") or {}).items():
        source = (entry.get("sources") or [{}])[0]
        label = entry.get("label", location_id)
        stations.append({
            "id": location_id,
            "label": label,
            "dtmoLocality": entry.get("dtmoLocality"),
            "currency": entry.get("currency", "USD"),
            "roeLocalPerUsd": float(entry.get("roeLocalPerUsd") or 1.0),
            "roeEffective": entry.get("roeEffective"),
            "ratesEffective": entry.get("ratesEffective"),
            "verificationStatus": "official",
            "notes": entry.get("notes", ""),
            "sourceLabel": source.get("title", "DTMO"),
            "sourceUrl": source.get("url", ""),
        })
        for row in entry.get("oha") or []:
            dep = "with" if row.get("dependents") else "without"
            oha_rows.append({
                "id": f"{location_id}:{row['grade']}:{dep}",
                "label": f"{row['grade']} {dep} dependents · {label}",
                "locationId": location_id, "grade": row["grade"], "dependents": bool(row.get("dependents")),
                "rentLocal": row.get("rentLocal"), "uaLocal": row.get("uaLocal"), "mihaLocal": row.get("mihaLocal"),
                "currency": entry.get("currency", "USD"),
                "verificationStatus": row.get("status", "missing"),
                "verifiedOn": row.get("verifiedOn"),
                "notes": row.get("verifiedBy", "No official DTMO value loaded — enter it from the DTMO OHA calculator."),
                "sourceLabel": source.get("title", ""), "sourceUrl": source.get("url", ""),
            })
        for row in entry.get("cola") or []:
            dep = "with" if row.get("dependents") else "without"
            cola_rows.append({
                "id": f"{location_id}:{row['grade']}:{dep}",
                "label": f"{row['grade']} {dep} dependents · {label}",
                "locationId": location_id, "grade": row["grade"], "dependents": bool(row.get("dependents")),
                "monthlyUsd": row.get("monthlyUsd"),
                "verificationStatus": row.get("status", "missing"),
                "notes": entry.get("colaNote", ""),
                "sourceLabel": "DTMO OCONUS COLA calculator",
                "sourceUrl": "https://www.travel.dod.mil/Allowances/Overseas-Cost-of-Living-Allowance/",
            })
    merged["overseas_allowances"] = stations
    merged["oha_rates"] = oha_rows
    merged["overseas_cola"] = cola_rows


def _apply_state_tax_research(merged: dict[str, list[dict[str, Any]]]) -> None:
    if "state_tax_rates" in merged:
        return
    data = _load_json("data_state_tax_2026.json")
    source = (data.get("sources") or [{}])[0]
    rows = []
    for code, entry in sorted((data.get("states") or {}).items()):
        if code.startswith("_") or not isinstance(entry, dict):
            continue
        rows.append({
            "id": code, "label": code, "type": entry.get("type"),
            "effectiveRateAt80k": float(entry.get("effectiveRateAt80k") or 0),
            "effectiveRateAt150k": float(entry.get("effectiveRateAt150k") or 0),
            "militaryRetiredPayExempt": entry.get("militaryRetiredPayExempt", "no"),
            "notes": entry.get("notes", ""),
            "sourceLabel": source.get("title", "State tax research 2026"), "sourceUrl": source.get("url", ""),
        })
    merged["state_tax_rates"] = rows


_OFFERING_FIELDS = (
    "institutionId", "institution", "institutionShort", "programName", "department", "level", "country",
    "schoolType", "durationYearsDefault", "typicalDurationYears", "tuitionAnnual", "tuitionListAnnual",
    "feesAnnual", "tuitionWaived", "admissionFee", "stipendAnnual", "fundedYears", "fundingSource",
    "fundingSources", "healthInsuranceAnnual", "vaApprovalStatus", "vaApprovalEvidence", "englishTaught",
    "url", "confidence", "estimatedFields",
)


def _apply_program_research(merged: dict[str, list[dict[str, Any]]]) -> None:
    """Add the researched degree offerings to `programs` and point the original
    workbook programs at their matching offering (same money, old ids keep working)."""
    data = _load_json("data_programs_2026.json")
    offerings = data.get("offerings") or []
    if not offerings:
        return
    programs = [dict(p) for p in merged.get("programs", [])]
    existing = {p["id"] for p in programs}
    by_id = {o["id"]: o for o in offerings}
    for legacy_id, offering_id in (data.get("legacyProgramIds") or {}).items():
        offering = by_id.get(offering_id)
        for program in programs:
            if program["id"] == legacy_id and offering:
                for key in _OFFERING_FIELDS:
                    if key in offering:
                        program[key] = offering[key]
                program["offeringId"] = offering_id
                program["legacy"] = True
    for offering in offerings:
        if offering["id"] in existing:
            continue
        source = (offering.get("sources") or [{}])[0] if offering.get("sources") else {}
        programs.append({
            **offering,
            "durationYears": offering.get("durationYearsDefault"),
            "sourceLabel": source.get("title", "Program research 2026"),
            "sourceUrl": offering.get("url", ""),
            "verificationStatus": f"researched_{offering.get('confidence', 'medium')}",
        })
    merged["programs"] = programs
    merged["program_duration_defaults"] = [
        {"id": f"{country}:{level}", "country": country, "level": level, "years": years}
        for country, levels in (data.get("defaultDurationsYears") or {}).items()
        for level, years in levels.items()
    ]

    gi_records = [dict(g) for g in merged.get("gi_bill_benefits", [])]
    known = {g["id"] for g in gi_records}
    rules = _load_json("data_education_benefits_2026.json").get("rules", {})
    for gi_id, location_id, label in (
        ("gi_bill_foreign_utokyo", "tokyo_jp", "GI Bill foreign school · The University of Tokyo"),
        ("gi_bill_foreign_tohoku", "sendai_jp", "GI Bill foreign school · Tohoku University"),
    ):
        if gi_id in known:
            continue
        gi_records.append({
            "id": gi_id, "label": label, "locationId": location_id, "deliveryMode": "foreign_school",
            "monthlyHousingAllowance": float(rules.get("foreignMhaMonthly", 2396.0)),
            "booksSuppliesAnnual": float(rules.get("booksAnnualCap", 1000.0)),
            "monthsEligible": 36,
            "tuitionFeesCapAnnual": float(rules.get("tuitionCapPrivateForeignAnnual", 30908.34)),
            "vaProgramApproved": 0,
            "eligibilityReason": "foreign_program_approval_unconfirmed",
            "verificationStatus": "unconfirmed",
            "notes": (
                "Foreign schools must be VA-approved per program, and only the school can request it. No evidence "
                "of approval was found (Nov 2026), so this defaults to 0. Set it to 1 here, or tick 'assume VA "
                "approval' on the grad block, to model the benefit as if approved."
            ),
            "sourceLabel": "VA foreign programs guidance", "sourceUrl": "https://www.va.gov/education/study-at-foreign-schools/",
        })
    merged["gi_bill_benefits"] = gi_records
