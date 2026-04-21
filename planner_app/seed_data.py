from __future__ import annotations

from typing import Any

from .manual_finance import LEGACY_MANUAL_BASELINE, migrate_legacy_manual_inputs
from .reference_data import REFERENCE_DOMAINS, build_compatibility_reference_tables


REFERENCE_TABLES: dict[str, list[dict[str, Any]]] = build_compatibility_reference_tables(REFERENCE_DOMAINS)


PLANNER_PROFILE: dict[str, Any] = {
    "baseYear": 2026,
    "startAge": 36,
    "projectionYears": 51,
    "projectionEndYear": 2076,
    "serviceEntryYear": 2014,
    "plannedSeparationYear": 2027,
    "retirementEligibleYear": 2034,
    "retirementSystem": "High-3",
    "milestones": [
        {"label": "Today", "yearIndex": 0},
        {"label": "Separation", "yearIndex": 2},
        {"label": "Retirement", "yearIndex": 8},
        {"label": "Age 50", "yearIndex": 14},
        {"label": "Age 59.5", "yearIndex": 23},
        {"label": "Age 66", "yearIndex": 30},
        {"label": "Age 70", "yearIndex": 34},
        {"label": "Age 73", "yearIndex": 37},
        {"label": "Age 80", "yearIndex": 44},
        {"label": "Age 86", "yearIndex": 50},
    ],
}


PATH_TEMPLATES: list[dict[str, Any]] = [
    {
        "id": "PATH_A",
        "name": "Stay Military -> Retire -> PhD -> Research Scientist",
        "kind": "military_retire_phd_research",
        "defaultCompanyId": None,
        "defaultEmployerId": "CONSERVATIVE",
        "defaultVaRatingId": "30",
        "defaultPhdProgramId": "STAN-CS-PHD",
    },
    {
        "id": "PATH_B",
        "name": "Separate -> Immediate Tech Career",
        "kind": "immediate_tech",
        "defaultCompanyId": "GENERIC_IC",
        "defaultEmployerId": None,
        "defaultVaRatingId": "30",
        "defaultPhdProgramId": None,
    },
    {
        "id": "PATH_C",
        "name": "Separate -> Gap Year -> PhD -> Research Scientist",
        "kind": "gap_year_phd_research",
        "defaultCompanyId": None,
        "defaultEmployerId": "CONSERVATIVE",
        "defaultVaRatingId": "30",
        "defaultPhdProgramId": "STAN-CS-PHD",
    },
    {
        "id": "PATH_CUSTOM",
        "name": "Custom timeline path",
        "kind": "custom_timeline",
        "defaultCompanyId": None,
        "defaultEmployerId": None,
        "defaultVaRatingId": "30",
        "defaultPhdProgramId": None,
    },
]


SCENARIO_SEEDS: list[dict[str, Any]] = [
    {
        "id": "scenario_path_a",
        "name": "Path A Baseline",
        "displayName": "Path A",
        "pathTemplateId": "PATH_A",
        "colorToken": "sage",
        "isLoaded": True,
        "displayOrder": 0,
        "selectedCompanyId": None,
        "selectedEmployerId": "CONSERVATIVE",
        "selectedVaRatingId": "30",
        "selectedPhdProgramId": "STAN-CS-PHD",
        "useVa": True,
        "useGiBill": True,
        "notes": "Baseline military-retirement path seeded from v5.2 prompt.",
        "overrides": {},
    },
    {
        "id": "scenario_path_b",
        "name": "Path B Baseline",
        "displayName": "Path B",
        "pathTemplateId": "PATH_B",
        "colorToken": "amber",
        "isLoaded": True,
        "displayOrder": 1,
        "selectedCompanyId": "GENERIC_IC",
        "selectedEmployerId": None,
        "selectedVaRatingId": "30",
        "selectedPhdProgramId": None,
        "useVa": True,
        "useGiBill": False,
        "notes": "Baseline immediate-tech path seeded from v5.2 prompt.",
        "overrides": {},
    },
    {
        "id": "scenario_path_c",
        "name": "Path C Baseline",
        "displayName": "Path C",
        "pathTemplateId": "PATH_C",
        "colorToken": "azure",
        "isLoaded": True,
        "displayOrder": 2,
        "selectedCompanyId": None,
        "selectedEmployerId": "CONSERVATIVE",
        "selectedVaRatingId": "30",
        "selectedPhdProgramId": "STAN-CS-PHD",
        "useVa": True,
        "useGiBill": True,
        "notes": "Baseline gap-year-to-PhD path seeded from v5.2 prompt.",
        "overrides": {},
    },
]


GAP_FLAGS: list[dict[str, Any]] = [
    {"id": "social_security", "title": "Social Security not modeled", "impact": "Civilian-heavy paths are likely understated in late retirement years.", "status": "open"},
    {"id": "drawdown", "title": "Portfolio drawdown income not modeled", "impact": "Portfolio continues compounding without retirement spending behavior.", "status": "open"},
    {"id": "rmds", "title": "RMDs not modeled", "impact": "Traditional retirement account taxation after age 73 is omitted.", "status": "open"},
    {"id": "employer_match", "title": "Employer match not modeled", "impact": "Tech and research scenarios understate total retirement accumulation.", "status": "open"},
    {"id": "va_healthcare_threshold", "title": "VA healthcare threshold not modeled", "impact": "50%+ disability ratings may reduce healthcare costs more than shown.", "status": "open"},
    {"id": "housing_wealth", "title": "Homeownership path not modeled", "impact": "Rent-only scenarios omit a major long-term wealth lever.", "status": "open"},
    {"id": "return_sensitivity", "title": "Return sensitivity bands not modeled", "impact": "The app currently uses a single deterministic portfolio return.", "status": "open"},
]


MANUAL_CASHFLOW_SEED: dict[str, list[dict[str, Any]]] = migrate_legacy_manual_inputs(LEGACY_MANUAL_BASELINE)
