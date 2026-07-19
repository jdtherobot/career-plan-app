from __future__ import annotations

import copy
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parent.parent
WORKBOOK_PATH = ROOT / "grad_program_tracker_v2_7.xlsx"
XML_NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}

PROGRAM_FINANCIAL_DEFAULTS: dict[str, dict[str, Any]] = {
    "STAN-CS-PHD": {
        "locationId": "stanford_ca",
        "durationYears": 5,
        "stipendAnnual": 57000,
        "estimatedRentMonthly": 2800,
        "giBillBenefitId": "gi_bill_bay_area",
        "healthcareProfileId": "university_funded_healthcare",
        "taxProfileId": "phd_ca",
    },
    "UCB-EECS-PHD": {
        "locationId": "berkeley_ca",
        "durationYears": 5,
        "stipendAnnual": 44000,
        "estimatedRentMonthly": 2600,
        "giBillBenefitId": "gi_bill_bay_area",
        "healthcareProfileId": "university_funded_healthcare",
        "taxProfileId": "phd_ca",
    },
    "MIT-EECS-PHD": {
        "locationId": "cambridge_ma",
        "durationYears": 5,
        "stipendAnnual": 56340,
        "estimatedRentMonthly": 2400,
        "giBillBenefitId": "gi_bill_cambridge_ma",
        "healthcareProfileId": "university_funded_healthcare",
        "taxProfileId": "phd_ma",
    },
    "CMU-SCS-PHD": {
        "locationId": "pittsburgh_pa",
        "durationYears": 5,
        "stipendAnnual": 42900,
        "estimatedRentMonthly": 1200,
        "giBillBenefitId": "gi_bill_pittsburgh_pa",
        "healthcareProfileId": "university_funded_healthcare",
        "taxProfileId": "phd_pa",
    },
    "UW-CSE-PHD": {
        "locationId": "seattle_wa",
        "durationYears": 5,
        "stipendAnnual": 38000,
        "estimatedRentMonthly": 2000,
        "giBillBenefitId": "gi_bill_seattle_wa",
        "healthcareProfileId": "university_funded_healthcare",
        "taxProfileId": "phd_wa",
    },
    "UCD-CS-PHD": {
        "locationId": "davis_ca",
        "durationYears": 5,
        "stipendAnnual": 39800,
        "estimatedRentMonthly": 1400,
        "giBillBenefitId": "gi_bill_davis_ca",
        "healthcareProfileId": "university_funded_healthcare",
        "taxProfileId": "phd_ca",
    },
    "IST-IGPC-MD": {
        "locationId": "tokyo_jp",
        "durationYears": 5,
        "stipendAnnual": 13200,
        "estimatedRentMonthly": 800,
        "giBillBenefitId": "gi_bill_international_placeholder",
        "healthcareProfileId": "university_funded_healthcare",
        "taxProfileId": "phd_international",
    },
    "CAM-CS-PHD": {
        "locationId": "cambridge_uk",
        "durationYears": 5,
        "stipendAnnual": 25200,
        "estimatedRentMonthly": 1600,
        "giBillBenefitId": "gi_bill_international_placeholder",
        "healthcareProfileId": "university_funded_healthcare",
        "taxProfileId": "phd_international",
    },
}

REFERENCE_SECTIONS: list[dict[str, Any]] = [
    {
        "id": "military-benefits",
        "title": "Military & Benefits",
        "description": "Compensation, VA, GI Bill, and path defaults that drive active-duty and retirement modeling.",
        "domains": [
            "military_service_profile",
            "military_compensation_projection_view",
            "military_promotion_schedule",
            "military_promotion_rules",
            "military_raise_schedule",
            "military_pay_rates",
            "va_disability",
            "gi_bill_benefits",
            "benefit_rules",
            "path_timeline_defaults",
        ],
    },
    {
        "id": "grad-programs",
        "title": "Grad Programs & Academic Costs",
        "description": "Workbook-backed program metadata plus the financial records the planner currently uses for PhD modeling.",
        "domains": ["programs"],
    },
    {
        "id": "locations-costs",
        "title": "Locations & Cost of Living",
        "description": "Future-proof place records and additive cost profiles used by the expense resolver.",
        "domains": ["locations", "location_cost_profiles"],
    },
    {
        "id": "healthcare-taxes",
        "title": "Healthcare & Taxes",
        "description": "Phase-specific healthcare and tax assumptions used by projection rows.",
        "domains": ["healthcare_profiles", "tax_profiles"],
    },
    {
        "id": "career-comp",
        "title": "Career Compensation",
        "description": "Tech and research compensation profiles that still feed the path selectors.",
        "domains": ["career_comp_profiles"],
    },
    {
        "id": "investments-growth",
        "title": "Investments & Growth",
        "description": "Contribution defaults, destinations, and portfolio assumptions.",
        "domains": ["investment_policies", "pension_profiles"],
    },
]

REFERENCE_FIELD_METADATA: dict[str, dict[str, Any]] = {
    "programs": {
        "label": "Programs",
        "sectionId": "grad-programs",
        "usedBy": ["Path editor", "Dashboard", "Projection Explorer"],
        "visibleColumns": [
            {"field": "schoolName", "label": "School"},
            {"field": "programName", "label": "Program"},
            {"field": "degreeType", "label": "Degree"},
            {"field": "locationLabel", "label": "Location"},
            {"field": "durationYears", "label": "Duration", "kind": "number"},
            {"field": "stipendAnnual", "label": "Stipend", "kind": "currency", "sourceable": True},
            {"field": "estimatedRentMonthly", "label": "Rent", "kind": "currency", "sourceable": True},
            {"field": "giBillBenefitId", "label": "GI Bill"},
            {"field": "applicationFeeUsd", "label": "Application Fee", "kind": "currency", "sourceable": True},
            {"field": "verificationStatus", "label": "Verified", "kind": "status"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Program ID"},
            {"field": "department", "label": "Department"},
            {"field": "researchTier", "label": "Research Tier"},
            {"field": "healthcareProfileId", "label": "Healthcare Profile"},
            {"field": "taxProfileId", "label": "Tax Profile"},
            {"field": "supplementalFeeAmountUsd", "label": "Supplemental Fee", "kind": "currency", "sourceable": True},
            {"field": "lorCount", "label": "LOR Count", "kind": "number"},
            {"field": "greStatus", "label": "GRE"},
            {"field": "termStart", "label": "Term Start"},
            {"field": "typicalOpenMonth", "label": "Opens"},
            {"field": "typicalDeadlineMonth", "label": "Typical Deadline"},
            {"field": "specialDeadlines", "label": "Special Deadlines"},
            {"field": "websiteUrl", "label": "Website"},
            {"field": "lastVerifiedDate", "label": "Last Verified", "kind": "date"},
            {"field": "fundingNote", "label": "Funding Note"},
            {"field": "researchExperienceExpectation", "label": "Research Expectation"},
            {"field": "notes", "label": "Notes"},
        ],
        "editableFields": {
            "stipendAnnual": {"label": "Annual stipend", "kind": "currency"},
            "estimatedRentMonthly": {"label": "Estimated rent", "kind": "currency"},
            "applicationFeeUsd": {"label": "Application fee", "kind": "currency"},
            "supplementalFeeAmountUsd": {"label": "Supplemental fee", "kind": "currency"},
        },
        "sourceableFields": ["stipendAnnual", "estimatedRentMonthly", "applicationFeeUsd", "supplementalFeeAmountUsd"],
        "filterFields": ["id", "label", "schoolName", "programName", "locationLabel", "department", "degreeType", "greStatus", "notes"],
    },
    "locations": {
        "label": "Locations",
        "sectionId": "locations-costs",
        "usedBy": ["Path defaults", "Program records", "Military compensation"],
        "visibleColumns": [
            {"field": "label", "label": "Place"},
            {"field": "city", "label": "City"},
            {"field": "stateCode", "label": "State / Region"},
            {"field": "countryCode", "label": "Country"},
            {"field": "bahAreaLabel", "label": "BAH Area"},
            {"field": "taxProfileId", "label": "Tax Region"},
            {"field": "costProfileId", "label": "Cost Profile"},
            {"field": "verificationStatus", "label": "Verified", "kind": "status"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Location ID"},
            {"field": "regionType", "label": "Region Type"},
            {"field": "notes", "label": "Notes"},
        ],
        "editableFields": {},
        "sourceableFields": [],
        "filterFields": ["id", "label", "city", "stateCode", "countryCode", "bahAreaLabel", "notes"],
    },
    "location_cost_profiles": {
        "label": "Location cost profiles",
        "sectionId": "locations-costs",
        "usedBy": ["Expense resolver", "Reference page"],
        "visibleColumns": [
            {"field": "label", "label": "Profile"},
            {"field": "locationId", "label": "Location"},
            {"field": "estimatedRentMonthly", "label": "Rent", "kind": "currency", "sourceable": True},
            {"field": "housingMonthly", "label": "Housing", "kind": "currency", "sourceable": True},
            {"field": "utilitiesMonthly", "label": "Utilities", "kind": "currency", "sourceable": True},
            {"field": "foodMonthly", "label": "Food", "kind": "currency", "sourceable": True},
            {"field": "transportationMonthly", "label": "Transport", "kind": "currency", "sourceable": True},
            {"field": "insuranceMonthly", "label": "Insurance", "kind": "currency", "sourceable": True},
            {"field": "healthcareOutOfPocketMonthly", "label": "Healthcare OOP", "kind": "currency", "sourceable": True},
            {"field": "annualGrowthRate", "label": "Growth", "kind": "percent", "sourceable": True},
            {"field": "verificationStatus", "label": "Verified", "kind": "status"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Cost Profile ID"},
            {"field": "personalMonthly", "label": "Personal", "kind": "currency", "sourceable": True},
            {"field": "entertainmentMonthly", "label": "Entertainment", "kind": "currency", "sourceable": True},
            {"field": "giftsMonthly", "label": "Gifts", "kind": "currency", "sourceable": True},
            {"field": "miscellaneousMonthly", "label": "Misc", "kind": "currency", "sourceable": True},
            {"field": "notes", "label": "Notes"},
        ],
        "editableFields": {
            "estimatedRentMonthly": {"label": "Estimated rent", "kind": "currency"},
            "housingMonthly": {"label": "Housing default", "kind": "currency"},
            "utilitiesMonthly": {"label": "Utilities default", "kind": "currency"},
            "transportationMonthly": {"label": "Transportation default", "kind": "currency"},
            "foodMonthly": {"label": "Food default", "kind": "currency"},
            "insuranceMonthly": {"label": "Insurance default", "kind": "currency"},
            "healthcareOutOfPocketMonthly": {"label": "Healthcare OOP default", "kind": "currency"},
            "personalMonthly": {"label": "Personal default", "kind": "currency"},
            "entertainmentMonthly": {"label": "Entertainment default", "kind": "currency"},
            "giftsMonthly": {"label": "Gifts default", "kind": "currency"},
            "miscellaneousMonthly": {"label": "Miscellaneous default", "kind": "currency"},
            "annualGrowthRate": {"label": "Annual growth", "kind": "percent"},
        },
        "sourceableFields": [
            "estimatedRentMonthly",
            "housingMonthly",
            "utilitiesMonthly",
            "transportationMonthly",
            "foodMonthly",
            "insuranceMonthly",
            "healthcareOutOfPocketMonthly",
            "personalMonthly",
            "entertainmentMonthly",
            "giftsMonthly",
            "miscellaneousMonthly",
            "annualGrowthRate",
        ],
        "filterFields": ["id", "label", "locationId", "notes"],
    },
    "military_service_profile": {
        "label": "Military service profile",
        "sectionId": "military-benefits",
        "usedBy": ["Military schedule", "Projection engine"],
        "visibleColumns": [
            {"field": "startingPayGradeNumeric", "label": "Current Grade", "kind": "paygrade"},
            {"field": "startingYearsOfService", "label": "Current TAFMS", "kind": "number"},
            {"field": "startingTimeInGradeYears", "label": "Current TIG", "kind": "number"},
            {"field": "retirementYearsOfService", "label": "Retire At TAFMS", "kind": "number"},
            {"field": "withDependentsFlag", "label": "Dependents", "kind": "dependents_flag"},
            {"field": "verificationStatus", "label": "Verified", "kind": "status"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Profile ID"},
            {"field": "serviceBranch", "label": "Branch"},
            {"field": "notes", "label": "Notes"},
        ],
        "editableFields": {
            "startingPayGradeNumeric": {"label": "Current grade", "kind": "paygrade"},
            "startingYearsOfService": {"label": "Current TAFMS", "kind": "number"},
            "startingTimeInGradeYears": {"label": "Current TIG", "kind": "number"},
            "retirementYearsOfService": {"label": "Retire at TAFMS", "kind": "number"},
            "withDependentsFlag": {"label": "Dependents", "kind": "dependents_flag"},
        },
        "sourceableFields": [],
        "filterFields": ["id", "label", "serviceBranch", "notes"],
    },
    "military_compensation_projection_view": {
        "label": "Military compensation schedule",
        "sectionId": "military-benefits",
        "usedBy": ["Reference page", "Projection Explorer"],
        "visibleColumns": [
            {"field": "calendarYear", "label": "Year", "kind": "number"},
            {"field": "yearsOfService", "label": "TAFMS", "kind": "number"},
            {"field": "projectedPayGradeNumeric", "label": "Projected Grade", "kind": "paygrade"},
            {"field": "basePayAnnual", "label": "Base Pay", "kind": "currency"},
            {"field": "bahAnnual", "label": "BAH", "kind": "currency"},
            {"field": "basAnnual", "label": "BAS", "kind": "currency"},
            {"field": "totalMilitaryCompAnnual", "label": "Total Military Comp", "kind": "currency"},
            {"field": "raisePercent", "label": "Raise", "kind": "percent"},
            {"field": "raiseSourceYear", "label": "Raise Year Used", "kind": "number"},
            {"field": "locationId", "label": "Location"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Schedule Row ID"},
            {"field": "phaseId", "label": "Phase"},
            {"field": "promotionAppliedLabel", "label": "Promotion Applied"},
            {"field": "basePaySourceId", "label": "Base Pay Source"},
            {"field": "bahSourceId", "label": "BAH Source"},
            {"field": "basSourceId", "label": "BAS Source"},
        ],
        "editableFields": {},
        "sourceableFields": [],
        "filterFields": ["calendarYear", "phaseId", "locationId", "promotionAppliedLabel"],
    },
    "military_promotion_schedule": {
        "label": "Military promotion schedule",
        "sectionId": "military-benefits",
        "usedBy": ["Military schedule", "Projection engine"],
        "visibleColumns": [
            {"field": "slotOrder", "label": "Slot", "kind": "number"},
            {"field": "enabledFlag", "label": "Enabled", "kind": "boolean_flag"},
            {"field": "promotionYear", "label": "Promotion Year", "kind": "year"},
            {"field": "targetPayGradeNumeric", "label": "Promote To", "kind": "paygrade"},
            {"field": "fromPayGradeNumeric", "label": "From Grade", "kind": "paygrade"},
            {"field": "projectedYearsOfService", "label": "TAFMS At Promotion", "kind": "number"},
            {"field": "projectedTimeInGradeYears", "label": "TIG At Promotion", "kind": "number"},
            {"field": "validationState", "label": "Planner Check", "kind": "status"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Promotion ID"},
            {"field": "validationMessage", "label": "Validation Message"},
            {"field": "notes", "label": "Notes"},
        ],
        "editableFields": {
            "enabledFlag": {"label": "Enabled", "kind": "boolean_flag"},
            "promotionYear": {"label": "Promotion year", "kind": "year"},
            "targetPayGradeNumeric": {"label": "Promote to grade", "kind": "paygrade"},
        },
        "sourceableFields": [],
        "filterFields": ["slotOrder", "promotionYear", "targetPayGradeNumeric", "validationMessage"],
    },
    "military_promotion_rules": {
        "label": "Military promotion rules",
        "sectionId": "military-benefits",
        "usedBy": ["Promotion validation", "Sources"],
        "visibleColumns": [
            {"field": "fromPayGradeNumeric", "label": "From Grade", "kind": "paygrade"},
            {"field": "toPayGradeNumeric", "label": "To Grade", "kind": "paygrade"},
            {"field": "minYearsOfService", "label": "Min TAFMS", "kind": "number", "sourceable": True},
            {"field": "minTimeInGradeYears", "label": "Min TIG", "kind": "number", "sourceable": True},
            {"field": "verificationStatus", "label": "Verified", "kind": "status"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Rule ID"},
            {"field": "notes", "label": "Notes"},
            {"field": "sourceLabel", "label": "Row Source"},
            {"field": "sourceUrl", "label": "Row Source URL"},
        ],
        "editableFields": {
            "minYearsOfService": {"label": "Minimum TAFMS", "kind": "number"},
            "minTimeInGradeYears": {"label": "Minimum TIG", "kind": "number"},
        },
        "sourceableFields": ["minYearsOfService", "minTimeInGradeYears"],
        "filterFields": ["id", "fromPayGradeNumeric", "toPayGradeNumeric", "notes"],
    },
    "military_raise_schedule": {
        "label": "Military annual raise schedule",
        "sectionId": "military-benefits",
        "usedBy": ["Military schedule", "Projection engine"],
        "visibleColumns": [
            {"field": "calendarYear", "label": "Year", "kind": "number"},
            {"field": "raisePercent", "label": "Raise", "kind": "percent", "sourceable": True},
            {"field": "appliesTo", "label": "Applies To"},
            {"field": "verificationStatus", "label": "Verified", "kind": "status"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Raise ID"},
            {"field": "notes", "label": "Notes"},
            {"field": "sourceLabel", "label": "Row Source"},
            {"field": "sourceUrl", "label": "Row Source URL"},
        ],
        "editableFields": {
            "raisePercent": {"label": "Raise percent", "kind": "percent"},
        },
        "sourceableFields": ["raisePercent"],
        "filterFields": ["id", "calendarYear", "notes"],
    },
    "military_pay_rates": {
        "label": "Military pay rates",
        "sectionId": "military-benefits",
        "usedBy": ["Military schedule", "Projection engine", "Sources"],
        "visibleColumns": [
            {"field": "component", "label": "Pay Type"},
            {"field": "payGrade", "label": "Pay Grade"},
            {"field": "yearsOfService", "label": "TAFMS Bracket", "kind": "number"},
            {"field": "locationId", "label": "Location"},
            {"field": "monthlyRate", "label": "Monthly", "kind": "currency", "sourceable": True},
            {"field": "annualizedRate", "label": "Annual", "kind": "currency"},
            {"field": "tableYear", "label": "Table Year", "kind": "number"},
            {"field": "verificationStatus", "label": "Verified", "kind": "status"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Rate ID"},
            {"field": "serviceBranch", "label": "Branch"},
            {"field": "dependencyStatus", "label": "Dependency Status"},
            {"field": "taxStatus", "label": "Tax Status"},
            {"field": "effectiveStart", "label": "Effective Start", "kind": "date"},
            {"field": "effectiveEnd", "label": "Effective End", "kind": "date"},
            {"field": "notes", "label": "Notes"},
            {"field": "sourceLabel", "label": "Row Source"},
            {"field": "sourceUrl", "label": "Row Source URL"},
        ],
        "editableFields": {
            "monthlyRate": {"label": "Monthly rate", "kind": "currency"},
        },
        "sourceableFields": ["monthlyRate"],
        "filterFields": ["id", "component", "payGrade", "locationId", "tableYear", "notes"],
    },
    "career_comp_profiles": {
        "label": "Career compensation profiles",
        "sectionId": "career-comp",
        "usedBy": ["Path editor", "Dashboard", "Projection Explorer"],
        "visibleColumns": [
            {"field": "label", "label": "Profile"},
            {"field": "profileType", "label": "Track"},
            {"field": "baseSalary", "label": "Base Salary", "kind": "currency", "sourceable": True},
            {"field": "bonusPct", "label": "Bonus", "kind": "percent", "sourceable": True},
            {"field": "annualRsu", "label": "Annual RSU", "kind": "currency", "sourceable": True},
            {"field": "growthRate", "label": "Growth", "kind": "percent", "sourceable": True},
            {"field": "verificationStatus", "label": "Verified", "kind": "status"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Profile ID"},
            {"field": "notes", "label": "Notes"},
            {"field": "sourceLabel", "label": "Row Source"},
            {"field": "sourceUrl", "label": "Row Source URL"},
        ],
        "editableFields": {
            "baseSalary": {"label": "Base salary", "kind": "currency"},
            "bonusPct": {"label": "Bonus percent", "kind": "percent"},
            "annualRsu": {"label": "Annual RSU", "kind": "currency"},
            "growthRate": {"label": "Growth rate", "kind": "percent"},
        },
        "sourceableFields": ["baseSalary", "bonusPct", "annualRsu", "growthRate"],
        "filterFields": ["id", "label", "profileType", "notes"],
    },
    "va_disability": {
        "label": "VA disability",
        "sectionId": "military-benefits",
        "usedBy": ["Path editor", "Dashboard", "Projection Explorer"],
        "visibleColumns": [
            {"field": "label", "label": "Rating"},
            {"field": "monthly", "label": "Monthly", "kind": "currency", "sourceable": True},
            {"field": "annual", "label": "Annual", "kind": "currency", "sourceable": True},
            {"field": "healthcareTier", "label": "Healthcare Tier"},
            {"field": "verificationStatus", "label": "Verified", "kind": "status"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Rating ID"},
            {"field": "priorityGroup", "label": "Priority Group"},
            {"field": "notes", "label": "Notes"},
            {"field": "sourceLabel", "label": "Row Source"},
            {"field": "sourceUrl", "label": "Row Source URL"},
        ],
        "editableFields": {
            "monthly": {"label": "Monthly amount", "kind": "currency"},
            "annual": {"label": "Annual amount", "kind": "currency"},
        },
        "sourceableFields": ["monthly", "annual"],
        "filterFields": ["id", "label", "notes"],
    },
    "gi_bill_benefits": {
        "label": "GI Bill benefits",
        "sectionId": "military-benefits",
        "usedBy": ["Projection engine", "Dashboard", "Projection Explorer"],
        "visibleColumns": [
            {"field": "label", "label": "Benefit"},
            {"field": "locationId", "label": "Applies To"},
            {"field": "deliveryMode", "label": "Delivery"},
            {"field": "monthlyHousingAllowance", "label": "Housing / Month", "kind": "currency", "sourceable": True},
            {"field": "booksSuppliesAnnual", "label": "Books / Year", "kind": "currency", "sourceable": True},
            {"field": "monthsEligible", "label": "Months", "kind": "number", "sourceable": True},
            {"field": "eligibilityReason", "label": "Eligibility Note"},
            {"field": "verificationStatus", "label": "Verified", "kind": "status"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Benefit ID"},
            {"field": "notes", "label": "Notes"},
            {"field": "sourceLabel", "label": "Row Source"},
            {"field": "sourceUrl", "label": "Row Source URL"},
        ],
        "editableFields": {
            "monthlyHousingAllowance": {"label": "Monthly housing allowance", "kind": "currency"},
            "booksSuppliesAnnual": {"label": "Books and supplies", "kind": "currency"},
            "monthsEligible": {"label": "Months eligible", "kind": "number"},
        },
        "sourceableFields": ["monthlyHousingAllowance", "booksSuppliesAnnual", "monthsEligible"],
        "filterFields": ["id", "label", "locationId", "eligibilityReason", "notes"],
    },
    "healthcare_profiles": {
        "label": "Healthcare profiles",
        "sectionId": "healthcare-taxes",
        "usedBy": ["Projection engine", "Projection Explorer"],
        "visibleColumns": [
            {"field": "label", "label": "Plan"},
            {"field": "coverageKind", "label": "Coverage"},
            {"field": "annualCost", "label": "Annual Cost", "kind": "currency", "sourceable": True},
            {"field": "inflationRate", "label": "Inflation", "kind": "percent", "sourceable": True},
            {"field": "verificationStatus", "label": "Verified", "kind": "status"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Healthcare ID"},
            {"field": "notes", "label": "Notes"},
            {"field": "sourceLabel", "label": "Row Source"},
            {"field": "sourceUrl", "label": "Row Source URL"},
        ],
        "editableFields": {
            "annualCost": {"label": "Annual cost", "kind": "currency"},
            "inflationRate": {"label": "Inflation rate", "kind": "percent"},
        },
        "sourceableFields": ["annualCost", "inflationRate"],
        "filterFields": ["id", "label", "coverageKind", "notes"],
    },
    "tax_profiles": {
        "label": "Tax profiles",
        "sectionId": "healthcare-taxes",
        "usedBy": ["Projection engine", "Projection Explorer"],
        "visibleColumns": [
            {"field": "label", "label": "Profile"},
            {"field": "phaseKind", "label": "Phase"},
            {"field": "locationId", "label": "Location"},
            {"field": "federalRate", "label": "Federal", "kind": "percent", "sourceable": True},
            {"field": "stateRate", "label": "State", "kind": "percent", "sourceable": True},
            {"field": "verificationStatus", "label": "Verified", "kind": "status"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Tax Profile ID"},
            {"field": "notes", "label": "Notes"},
        ],
        "editableFields": {
            "federalRate": {"label": "Federal rate", "kind": "percent"},
            "stateRate": {"label": "State rate", "kind": "percent"},
        },
        "sourceableFields": ["federalRate", "stateRate"],
        "filterFields": ["id", "label", "phaseKind", "locationId", "notes"],
    },
    "investment_policies": {
        "label": "Investment policies",
        "sectionId": "investments-growth",
        "usedBy": ["Projection engine", "Dashboard", "Projection Explorer"],
        "visibleColumns": [
            {"field": "label", "label": "Policy"},
            {"field": "recordType", "label": "Type"},
            {"field": "annualReturnRate", "label": "Return", "kind": "percent", "sourceable": True},
            {"field": "monthlyContribution", "label": "Monthly Contribution", "kind": "currency", "sourceable": True},
            {"field": "annualContribution", "label": "Annual Contribution", "kind": "currency", "sourceable": True},
            {"field": "destinationId", "label": "Destination"},
            {"field": "verificationStatus", "label": "Verified", "kind": "status"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Policy ID"},
            {"field": "surplusInvestmentRate", "label": "Surplus Rate", "kind": "percent", "sourceable": True},
            {"field": "withdrawalRate", "label": "Withdrawal Rate", "kind": "percent", "sourceable": True},
            {"field": "accountType", "label": "Account Type"},
            {"field": "taxTreatment", "label": "Tax Treatment"},
            {"field": "contributionType", "label": "Contribution Type"},
            {"field": "notes", "label": "Notes"},
        ],
        "editableFields": {
            "annualReturnRate": {"label": "Annual return rate", "kind": "percent"},
            "surplusInvestmentRate": {"label": "Surplus investment rate", "kind": "percent"},
            "withdrawalRate": {"label": "Withdrawal rate", "kind": "percent"},
            "monthlyContribution": {"label": "Monthly contribution", "kind": "currency"},
            "annualContribution": {"label": "Annual contribution", "kind": "currency"},
        },
        "sourceableFields": ["annualReturnRate", "surplusInvestmentRate", "withdrawalRate", "monthlyContribution", "annualContribution"],
        "filterFields": ["id", "label", "recordType", "destinationId", "notes"],
    },
    "pension_profiles": {
        "label": "Pension profiles",
        "sectionId": "investments-growth",
        "usedBy": ["Projection engine", "Dashboard", "Projection Explorer"],
        "visibleColumns": [
            {"field": "label", "label": "Profile"},
            {"field": "monthlyAtRetirement", "label": "Monthly Pension", "kind": "currency", "sourceable": True},
            {"field": "annualAtRetirement", "label": "Annual Pension", "kind": "currency", "sourceable": True},
            {"field": "colaRate", "label": "COLA", "kind": "percent", "sourceable": True},
            {"field": "transitionBlendActive", "label": "Transition Blend", "kind": "percent", "sourceable": True},
            {"field": "verificationStatus", "label": "Verified", "kind": "status"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Pension ID"},
            {"field": "retirementSystem", "label": "Retirement System"},
            {"field": "transitionBlendPension", "label": "Pension Blend", "kind": "percent", "sourceable": True},
            {"field": "notes", "label": "Notes"},
        ],
        "editableFields": {
            "monthlyAtRetirement": {"label": "Monthly pension", "kind": "currency"},
            "annualAtRetirement": {"label": "Annual pension", "kind": "currency"},
            "colaRate": {"label": "COLA", "kind": "percent"},
            "transitionBlendActive": {"label": "Transition active blend", "kind": "percent"},
            "transitionBlendPension": {"label": "Transition pension blend", "kind": "percent"},
        },
        "sourceableFields": ["monthlyAtRetirement", "annualAtRetirement", "colaRate", "transitionBlendActive", "transitionBlendPension"],
        "filterFields": ["id", "label", "retirementSystem", "notes"],
    },
    "path_timeline_defaults": {
        "label": "Path timeline defaults",
        "sectionId": "military-benefits",
        "usedBy": ["Projection engine", "Path editor"],
        "visibleColumns": [
            {"field": "label", "label": "Path"},
            {"field": "activeDutyEndYearIndex", "label": "Active-Duty End", "kind": "number"},
            {"field": "retirementTransitionYearIndex", "label": "Retirement Transition", "kind": "number"},
            {"field": "phdStartYearIndex", "label": "PhD Start", "kind": "number"},
            {"field": "researchStartYearIndex", "label": "Research Start", "kind": "number"},
            {"field": "defaultResearchLocationId", "label": "Research Location"},
            {"field": "verificationStatus", "label": "Verified", "kind": "status"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Timeline ID"},
            {"field": "pathId", "label": "Path ID"},
            {"field": "careerStartYearIndex", "label": "Career Start", "kind": "number"},
            {"field": "gapYearIndex", "label": "Gap Year", "kind": "number"},
            {"field": "phdEndYearIndex", "label": "PhD End", "kind": "number"},
            {"field": "locationPlan", "label": "Location Plan", "kind": "json"},
            {"field": "notes", "label": "Notes"},
        ],
        "editableFields": {},
        "sourceableFields": [],
        "filterFields": ["id", "label", "pathId", "notes"],
    },
    "benefit_rules": {
        "label": "Benefit rules",
        "sectionId": "military-benefits",
        "usedBy": ["Projection engine", "Reference page"],
        "visibleColumns": [
            {"field": "label", "label": "Rule"},
            {"field": "ruleType", "label": "Type"},
            {"field": "valueNumber", "label": "Numeric Value", "kind": "number", "sourceable": True},
            {"field": "valuePercent", "label": "Percent Value", "kind": "percent", "sourceable": True},
            {"field": "valueText", "label": "Notes"},
            {"field": "verificationStatus", "label": "Verified", "kind": "status"},
        ],
        "advancedColumns": [
            {"field": "id", "label": "Rule ID"},
            {"field": "notes", "label": "Notes"},
        ],
        "editableFields": {
            "valueNumber": {"label": "Numeric value", "kind": "number"},
            "valuePercent": {"label": "Percent value", "kind": "percent"},
        },
        "sourceableFields": ["valueNumber", "valuePercent"],
        "filterFields": ["id", "label", "ruleType", "valueText", "notes"],
    },
}

NON_RESEARCHABLE_REFERENCE_DOMAINS = {
    "military_service_profile",
    "military_compensation_projection_view",
    "military_promotion_schedule",
    "path_timeline_defaults",
}

NON_RESEARCHABLE_REFERENCE_FIELDS = {
    "id",
    "verificationStatus",
    "sourceLabel",
    "sourceUrl",
    "validationState",
    "validationMessage",
    "basePaySourceId",
    "bahSourceId",
    "basSourceId",
    "locationPlan",
}


def _is_default_researchable_field(field: str) -> bool:
    if field in NON_RESEARCHABLE_REFERENCE_FIELDS:
        return False
    if field.endswith("Id"):
        return False
    return True


def _ordered_reference_metadata_fields(metadata: dict[str, Any]) -> list[str]:
    ordered: list[str] = []
    for column in metadata.get("visibleColumns", []) + metadata.get("advancedColumns", []):
        field = column.get("field")
        if field and field not in ordered:
            ordered.append(field)
    return ordered


def _attach_researchable_field_metadata() -> None:
    for domain, metadata in REFERENCE_FIELD_METADATA.items():
        if domain in NON_RESEARCHABLE_REFERENCE_DOMAINS:
            metadata["researchableFields"] = []
            continue
        researchable = [
            field
            for field in _ordered_reference_metadata_fields(metadata)
            if _is_default_researchable_field(field)
        ]
        metadata["researchableFields"] = researchable


_attach_researchable_field_metadata()


def _fallback_field_label(field: str) -> str:
    return (
        field
        .replace("_", " ")
        .replace("Id", " ID")
        .replace("Usd", " USD")
        .title()
    )


def reference_field_definition(domain: str, field: str) -> dict[str, Any]:
    metadata = REFERENCE_FIELD_METADATA.get(domain, {})
    for column in metadata.get("visibleColumns", []):
        if column.get("field") == field:
            return dict(column)
    for column in metadata.get("advancedColumns", []):
        if column.get("field") == field:
            return dict(column)
    if field in metadata.get("editableFields", {}):
        return {"field": field, **metadata["editableFields"][field]}
    return {"field": field, "label": _fallback_field_label(field)}


def sourceable_reference_fields() -> dict[str, set[str]]:
    return {
        domain: set(meta.get("sourceableFields", []))
        for domain, meta in REFERENCE_FIELD_METADATA.items()
    }


def researchable_reference_fields() -> dict[str, set[str]]:
    return {
        domain: set(meta.get("researchableFields", []))
        for domain, meta in REFERENCE_FIELD_METADATA.items()
    }


def is_researchable_reference_field(domain: str, field: str) -> bool:
    return field in researchable_reference_fields().get(domain, set())


def reference_claim_id(domain: str, record_id: str, field: str) -> str:
    return f"auto_claim__{domain}__{record_id}__{field}"


def _serialize_source_snapshot(value: Any) -> str:
    return json.dumps(value)


def deserialize_source_snapshot(value: str | None) -> Any:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def build_auto_source_registry(
    reference_domains: dict[str, list[dict[str, Any]]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    claims: list[dict[str, Any]] = []
    documents: list[dict[str, Any]] = []
    claim_documents: list[dict[str, Any]] = []
    source_fields = researchable_reference_fields()
    document_ids_by_key: dict[tuple[str, str], str] = {}
    section_titles = {section["id"]: section["title"] for section in REFERENCE_SECTIONS}

    for domain, records in reference_domains.items():
        metadata = REFERENCE_FIELD_METADATA.get(domain, {})
        section_id = metadata.get("sectionId", "")
        section_title = section_titles.get(section_id, "")
        fields = source_fields.get(domain, set())
        if not fields:
            continue

        for record in records:
            target_label = record.get("schoolName") or record.get("label") or record.get("programName") or record["id"]
            source_label = str(record.get("sourceLabel") or "").strip()
            source_url = str(record.get("sourceUrl") or "").strip()
            document_id = None
            if source_label or source_url:
                key = (source_label, source_url)
                document_id = document_ids_by_key.get(key)
                if not document_id:
                    document_id = f"auto_doc__{len(document_ids_by_key) + 1}"
                    document_ids_by_key[key] = document_id
                    documents.append(
                        {
                            "id": document_id,
                            "title": source_label or source_url or target_label,
                            "publisher": source_label or section_title or metadata.get("label", domain),
                            "url": source_url,
                            "sourceType": "record_level_placeholder",
                            "publishedDate": "",
                            "accessedDate": record.get("lastVerifiedDate", ""),
                            "notes": "Record-level placeholder source attached until field-level research citations are populated.",
                        }
                    )

            for field in sorted(fields):
                field_meta = reference_field_definition(domain, field)
                claim_id = reference_claim_id(domain, record["id"], field)
                placeholder_status = "record_level_placeholder" if document_id else "source_pending"
                claims.append(
                    {
                        "id": claim_id,
                        "targetDomain": domain,
                        "targetRecordId": record["id"],
                        "targetField": field,
                        "friendlyTargetLabel": target_label,
                        "fieldLabel": field_meta.get("label", _fallback_field_label(field)),
                        "currentValueSnapshot": _serialize_source_snapshot(record.get(field)),
                        "researchNote": f"Research and verify {field_meta.get('label', _fallback_field_label(field)).lower()} for {target_label}.",
                        "verificationStatus": record.get("verificationStatus", "placeholder_pending_research"),
                        "placeholderStatus": placeholder_status,
                        "sectionId": section_id,
                    }
                )
                if document_id:
                    claim_documents.append(
                        {
                            "claimId": claim_id,
                            "documentId": document_id,
                            "role": "supporting",
                            "sortOrder": 0,
                            "noteExcerpt": "Record-level placeholder source reused across sourceable fields for this record.",
                        }
                    )

    return claims, documents, claim_documents


def _column_letters(cell_ref: str) -> str:
    return "".join(char for char in cell_ref if char.isalpha())


def _normalise_relationship_target(target: str) -> str:
    return target.lstrip("/")


def _parse_shared_strings(zf: ZipFile) -> list[str]:
    try:
        root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    values: list[str] = []
    for item in root.findall("main:si", XML_NS):
        values.append("".join(node.text or "" for node in item.iterfind(".//main:t", XML_NS)))
    return values


def _workbook_sheet_map(zf: ZipFile) -> dict[str, str]:
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_map = {
        rel.attrib["Id"]: _normalise_relationship_target(rel.attrib["Target"])
        for rel in rels.findall("rel:Relationship", XML_NS)
    }
    return {
        sheet.attrib["name"]: rel_map[sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]]
        for sheet in workbook.find("main:sheets", XML_NS)
    }


def _cell_value(cell: ET.Element, shared_strings: list[str]) -> Any:
    cell_type = cell.attrib.get("t")
    value = cell.find("main:v", XML_NS)
    if value is None:
        inline = cell.find("main:is", XML_NS)
        if inline is None:
            return ""
        return "".join(node.text or "" for node in inline.iterfind(".//main:t", XML_NS))
    raw = value.text or ""
    if cell_type == "s":
        index = int(raw)
        return shared_strings[index] if index < len(shared_strings) else raw
    if cell_type == "b":
        return raw == "1"
    return raw


def _read_sheet_rows(sheet_name: str) -> list[dict[str, str]]:
    if not WORKBOOK_PATH.exists():
        return []
    with ZipFile(WORKBOOK_PATH) as zf:
        shared_strings = _parse_shared_strings(zf)
        sheet_map = _workbook_sheet_map(zf)
        sheet_path = sheet_map.get(sheet_name)
        if not sheet_path:
            return []
        root = ET.fromstring(zf.read(sheet_path))
        data = root.find("main:sheetData", XML_NS)
        raw_rows: list[dict[str, Any]] = []
        for row in data.findall("main:row", XML_NS) if data is not None else []:
            values: dict[str, Any] = {}
            for cell in row.findall("main:c", XML_NS):
                values[_column_letters(cell.attrib.get("r", ""))] = _cell_value(cell, shared_strings)
            raw_rows.append(values)
        if not raw_rows:
            return []
        header_row = raw_rows[0]
        ordered_columns = sorted(header_row.keys(), key=lambda item: (len(item), item))
        headers = [str(header_row.get(column, column)) for column in ordered_columns]
        rows: list[dict[str, str]] = []
        for raw_row in raw_rows[1:]:
            rows.append({headers[index]: str(raw_row.get(column, "")).strip() for index, column in enumerate(ordered_columns)})
        return rows


def _to_float(value: Any, default: float = 0.0) -> float:
    if value in ("", None):
        return default
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).replace("$", "").replace(",", "").strip())
    except ValueError:
        return default


def _build_program_domain() -> list[dict[str, Any]]:
    workbook_rows = _read_sheet_rows("Programs")
    programs: list[dict[str, Any]] = []
    for row in workbook_rows:
        program_id = row.get("Program ID", "")
        if not program_id:
            continue
        financial_defaults = PROGRAM_FINANCIAL_DEFAULTS.get(program_id, {})
        programs.append(
            {
                "id": program_id,
                "label": row.get("School name", program_id),
                "schoolName": row.get("School name", ""),
                "locationLabel": row.get("Location (City, Country)", ""),
                "locationId": financial_defaults.get("locationId"),
                "department": row.get("Department / School", ""),
                "programName": row.get("Specific program name", ""),
                "degreeType": row.get("Degree type (PhD / Masters / M+PhD)", ""),
                "researchTier": row.get("R1/R2", ""),
                "applicationFeeUsd": _to_float(row.get("Application fee (USD)")),
                "supplementalFeeAmountUsd": _to_float(row.get("Supplemental fee (amount)")),
                "supplementalFeeNotes": row.get("Supplemental fee notes", ""),
                "otherFeesNotes": row.get("Other common fees (notes)", ""),
                "lorCount": int(_to_float(row.get("# of LORs"), 0)),
                "greStatus": row.get("GRE status", ""),
                "minimumGpa": row.get("Minimum GPA (if stated)", ""),
                "researchExperienceExpectation": row.get("Research experience expectation", ""),
                "fundingNote": row.get("Stipend / funding note", ""),
                "termStart": row.get("Term start(s)", ""),
                "typicalOpenMonth": row.get("Typical application open month", ""),
                "typicalDeadlineMonth": row.get("Typical deadline month", ""),
                "specialDeadlines": row.get("Special deadlines (funding / fellowships)", ""),
                "websiteUrl": row.get("Website link", ""),
                "lastVerifiedDate": row.get("Last verified (date)", ""),
                "notes": row.get("Notes", ""),
                "durationYears": int(financial_defaults.get("durationYears", 5) or 5),
                "stipendAnnual": financial_defaults.get("stipendAnnual", 0.0),
                "estimatedRentMonthly": financial_defaults.get("estimatedRentMonthly", 0.0),
                "giBillBenefitId": financial_defaults.get("giBillBenefitId"),
                "healthcareProfileId": financial_defaults.get("healthcareProfileId"),
                "taxProfileId": financial_defaults.get("taxProfileId"),
                "sourceLabel": "Grad tracker workbook · Programs sheet",
                "sourceUrl": "",
                "verificationStatus": "verified_2026_03_22",
                "effectiveStart": "2026-01-01",
                "effectiveEnd": None,
            }
        )
    return programs


def _build_locations() -> list[dict[str, Any]]:
    return [
        {
            "id": "sacramento_ca",
            "label": "Sacramento, CA",
            "city": "Sacramento",
            "stateCode": "CA",
            "countryCode": "US",
            "regionType": "metro",
            "bahAreaLabel": "Sacramento MHA",
            "taxProfileId": "civilian_default_ca",
            "costProfileId": "cost_sacramento_ca",
            "verificationStatus": "seed_default",
            "notes": "Current baseline location before the expected move to Langley.",
        },
        {
            "id": "langley_hampton_roads_va",
            "label": "Langley / Hampton Roads, VA",
            "city": "Hampton Roads",
            "stateCode": "VA",
            "countryCode": "US",
            "regionType": "metro",
            "bahAreaLabel": "Langley AFB / Hampton Roads MHA",
            "taxProfileId": "civilian_default_ca",
            "costProfileId": "cost_langley_hampton_roads_va",
            "verificationStatus": "placeholder_pending_research",
            "notes": "Default active-duty destination beginning April 2027. Cost figures remain placeholders until the research pass.",
        },
        {
            "id": "stanford_ca",
            "label": "Stanford, CA",
            "city": "Stanford",
            "stateCode": "CA",
            "countryCode": "US",
            "regionType": "campus",
            "bahAreaLabel": "Bay Area MHA",
            "taxProfileId": "phd_ca",
            "costProfileId": "cost_stanford_ca",
            "verificationStatus": "seed_default",
            "notes": "Program location imported from the grad tracker workbook.",
        },
        {
            "id": "berkeley_ca",
            "label": "Berkeley, CA",
            "city": "Berkeley",
            "stateCode": "CA",
            "countryCode": "US",
            "regionType": "campus",
            "bahAreaLabel": "Bay Area MHA",
            "taxProfileId": "phd_ca",
            "costProfileId": "cost_berkeley_ca",
            "verificationStatus": "seed_default",
            "notes": "Program location imported from the grad tracker workbook.",
        },
        {
            "id": "cambridge_ma",
            "label": "Cambridge, MA",
            "city": "Cambridge",
            "stateCode": "MA",
            "countryCode": "US",
            "regionType": "campus",
            "bahAreaLabel": "Cambridge / Boston MHA",
            "taxProfileId": "phd_ma",
            "costProfileId": "cost_cambridge_ma",
            "verificationStatus": "seed_default",
            "notes": "Program location imported from the grad tracker workbook.",
        },
        {
            "id": "pittsburgh_pa",
            "label": "Pittsburgh, PA",
            "city": "Pittsburgh",
            "stateCode": "PA",
            "countryCode": "US",
            "regionType": "campus",
            "bahAreaLabel": "Pittsburgh MHA",
            "taxProfileId": "phd_pa",
            "costProfileId": "cost_pittsburgh_pa",
            "verificationStatus": "seed_default",
            "notes": "Program location imported from the grad tracker workbook.",
        },
        {
            "id": "seattle_wa",
            "label": "Seattle, WA",
            "city": "Seattle",
            "stateCode": "WA",
            "countryCode": "US",
            "regionType": "campus",
            "bahAreaLabel": "Seattle MHA",
            "taxProfileId": "phd_wa",
            "costProfileId": "cost_seattle_wa",
            "verificationStatus": "seed_default",
            "notes": "Program location imported from the grad tracker workbook.",
        },
        {
            "id": "davis_ca",
            "label": "Davis, CA",
            "city": "Davis",
            "stateCode": "CA",
            "countryCode": "US",
            "regionType": "campus",
            "bahAreaLabel": "Davis / Sacramento MHA",
            "taxProfileId": "phd_ca",
            "costProfileId": "cost_davis_ca",
            "verificationStatus": "seed_default",
            "notes": "Program location imported from the grad tracker workbook.",
        },
        {
            "id": "tokyo_jp",
            "label": "Tokyo, Japan",
            "city": "Tokyo",
            "stateCode": "",
            "countryCode": "JP",
            "regionType": "international",
            "bahAreaLabel": "International / pending research",
            "taxProfileId": "phd_international",
            "costProfileId": "cost_tokyo_jp",
            "verificationStatus": "placeholder_pending_research",
            "notes": "International GI Bill handling remains a placeholder until the research pass.",
        },
        {
            "id": "cambridge_uk",
            "label": "Cambridge, UK",
            "city": "Cambridge",
            "stateCode": "",
            "countryCode": "GB",
            "regionType": "international",
            "bahAreaLabel": "International / pending research",
            "taxProfileId": "phd_international",
            "costProfileId": "cost_cambridge_uk",
            "verificationStatus": "placeholder_pending_research",
            "notes": "International GI Bill handling remains a placeholder until the research pass.",
        },
    ]


def _build_location_cost_profiles() -> list[dict[str, Any]]:
    def record(profile_id: str, label: str, location_id: str, estimated_rent: float, verification_status: str = "placeholder_pending_research") -> dict[str, Any]:
        return {
            "id": profile_id,
            "label": label,
            "locationId": location_id,
            "estimatedRentMonthly": estimated_rent,
            "housingMonthly": 0.0,
            "utilitiesMonthly": 0.0,
            "transportationMonthly": 0.0,
            "foodMonthly": 0.0,
            "insuranceMonthly": 0.0,
            "healthcareOutOfPocketMonthly": 0.0,
            "personalMonthly": 0.0,
            "entertainmentMonthly": 0.0,
            "giftsMonthly": 0.0,
            "miscellaneousMonthly": 0.0,
            "annualGrowthRate": 0.03,
            "verificationStatus": verification_status,
            "notes": "Additive location defaults are intentionally conservative placeholders until the full research pass is complete.",
            "effectiveStart": "2026-01-01",
            "effectiveEnd": None,
        }

    return [
        record("cost_sacramento_ca", "Sacramento baseline costs", "sacramento_ca", 500, "seed_default"),
        record("cost_langley_hampton_roads_va", "Langley / Hampton Roads costs", "langley_hampton_roads_va", 0),
        record("cost_stanford_ca", "Stanford costs", "stanford_ca", 2800, "seed_default"),
        record("cost_berkeley_ca", "Berkeley costs", "berkeley_ca", 2600, "seed_default"),
        record("cost_cambridge_ma", "Cambridge MA costs", "cambridge_ma", 2400, "seed_default"),
        record("cost_pittsburgh_pa", "Pittsburgh costs", "pittsburgh_pa", 1200, "seed_default"),
        record("cost_seattle_wa", "Seattle costs", "seattle_wa", 2000, "seed_default"),
        record("cost_davis_ca", "Davis costs", "davis_ca", 1400, "seed_default"),
        record("cost_tokyo_jp", "Tokyo costs", "tokyo_jp", 800),
        record("cost_cambridge_uk", "Cambridge UK costs", "cambridge_uk", 1600),
    ]


DFAS_ENLISTED_PAY_URL = "https://www.dfas.mil/MilitaryMembers/payentitlements/Pay-Tables/Basic-Pay/EM/lang/en/"
DFAS_BAS_URL = "https://www.dfas.mil/MilitaryMembers/payentitlements/Pay-Tables/bas/"
DTMO_BAH_URL = "https://www.travel.dod.mil/Allowances/Basic-Allowance-for-Housing/"
DOD_GREEN_BOOK_URL = "https://comptroller.defense.gov/Portals/45/Documents/defbudget/FY2025/fy25_Green_Book.pdf"


def _build_military_service_profile() -> list[dict[str, Any]]:
    return [
        {
            "id": "active_duty_service_profile",
            "label": "Current service profile",
            "serviceBranch": "Air Force",
            "startingPayGradeNumeric": 7,
            "startingYearsOfService": 12,
            "startingTimeInGradeYears": 2,
            "retirementYearsOfService": 20,
            "withDependentsFlag": 1,
            "verificationStatus": "seed_default",
            "notes": "Baseline current military profile. Promotion timing and service progression are resolved from this row plus the promotion schedule.",
        }
    ]


def _military_pay_rate_record(
    item_id: str,
    label: str,
    component: str,
    monthly_rate: float,
    *,
    pay_grade: str | None = None,
    years_of_service: int | None = None,
    dependency_status: str = "n/a",
    location_id: str | None = None,
    table_year: int = 2026,
    effective_start: str = "2026-01-01",
    effective_end: str | None = None,
    tax_status: str = "taxable",
    verification_status: str = "seed_default",
    source_label: str = "DFAS / official military pay tables",
    source_url: str = DFAS_ENLISTED_PAY_URL,
    notes: str = "",
) -> dict[str, Any]:
    return {
        "id": item_id,
        "label": label,
        "component": component,
        "serviceBranch": "Air Force",
        "payGrade": pay_grade,
        "yearsOfService": years_of_service,
        "dependencyStatus": dependency_status,
        "locationId": location_id,
        "tableYear": table_year,
        "monthlyRate": monthly_rate,
        "annualizedRate": monthly_rate * 12,
        "taxStatus": tax_status,
        "effectiveStart": effective_start,
        "effectiveEnd": effective_end,
        "sourceLabel": source_label,
        "sourceUrl": source_url,
        "verificationStatus": verification_status,
        "notes": notes,
    }


def _build_military_pay_rates() -> list[dict[str, Any]]:
    base_pay_rows = [
        ("E-7", 12, 5591.70),
        ("E-7", 14, 5835.00),
        ("E-7", 16, 6000.90),
        ("E-7", 18, 6177.30),
        ("E-7", 20, 6245.70),
        ("E-8", 12, 6061.80),
        ("E-8", 14, 6247.20),
        ("E-8", 16, 6448.20),
        ("E-8", 18, 6811.20),
        ("E-8", 20, 6995.40),
        ("E-9", 12, 7066.50),
        ("E-9", 14, 7263.60),
        ("E-9", 16, 7496.10),
        ("E-9", 18, 7730.70),
        ("E-9", 20, 8105.10),
    ]
    rows = [
        _military_pay_rate_record(
            f"base_pay_{pay_grade.lower()}_{yos}",
            f"{pay_grade} base pay · {yos} YOS bracket",
            "base_pay",
            monthly_rate,
            pay_grade=pay_grade,
            years_of_service=yos,
            notes="2026 DFAS enlisted pay table row. The engine applies annual raise schedule rows to future years when a newer explicit table year is not present.",
        )
        for pay_grade, yos, monthly_rate in base_pay_rows
    ]
    rows.extend(
        [
            _military_pay_rate_record(
                "bah_sacramento_2026",
                "BAH · Sacramento",
                "bah",
                2741.66,
                dependency_status="with_dependents",
                location_id="sacramento_ca",
                effective_end="2027-03-31",
                tax_status="tax_free",
                source_label="DTMO BAH reference page",
                source_url=DTMO_BAH_URL,
                notes="Current baseline BAH through the expected pre-Langley window. This row is currently location-specific rather than full pay-grade ladder data.",
            ),
            _military_pay_rate_record(
                "bah_langley_2026",
                "BAH · Langley / Hampton Roads",
                "bah",
                2810.20,
                dependency_status="with_dependents",
                location_id="langley_hampton_roads_va",
                effective_start="2027-04-01",
                tax_status="tax_free",
                verification_status="placeholder_pending_research",
                source_label="DTMO BAH reference page",
                source_url=DTMO_BAH_URL,
                notes="Planner placeholder for the expected Langley move until the exact rate is verified from the BAH calculator / official local table.",
            ),
            _military_pay_rate_record(
                "bas_enlisted_2026",
                "BAS · Enlisted",
                "bas",
                476.95,
                tax_status="tax_free",
                source_label="DFAS BAS table",
                source_url=DFAS_BAS_URL,
                notes="2026 enlisted BAS rate from DFAS.",
            ),
        ]
    )
    return rows


def _build_military_raise_schedule() -> list[dict[str, Any]]:
    rows = [
        (2027, 0.026, "official_budget_assumption", "DoD Green Book FY2025 pay assumption table", DOD_GREEN_BOOK_URL),
        (2028, 0.026, "official_budget_assumption", "DoD Green Book FY2025 pay assumption table", DOD_GREEN_BOOK_URL),
        (2029, 0.026, "official_budget_assumption", "DoD Green Book FY2025 pay assumption table", DOD_GREEN_BOOK_URL),
        (2030, 0.025, "placeholder_pending_research", "Planner fallback raise schedule", ""),
        (2031, 0.025, "placeholder_pending_research", "Planner fallback raise schedule", ""),
        (2032, 0.025, "placeholder_pending_research", "Planner fallback raise schedule", ""),
        (2033, 0.025, "placeholder_pending_research", "Planner fallback raise schedule", ""),
        (2034, 0.025, "placeholder_pending_research", "Planner fallback raise schedule", ""),
    ]
    return [
        {
            "id": f"mil_raise_{year}",
            "label": f"Military raise schedule · {year}",
            "calendarYear": year,
            "raisePercent": raise_pct,
            "appliesTo": "Military pay tables and baseline BAH/BAS fallback growth",
            "verificationStatus": verification_status,
            "sourceLabel": source_label,
            "sourceUrl": source_url,
            "notes": "Used when a future explicit military table year is not populated yet.",
        }
        for year, raise_pct, verification_status, source_label, source_url in rows
    ]


def _build_military_promotion_rules() -> list[dict[str, Any]]:
    return [
        {
            "id": "promo_rule_e7_to_e8",
            "label": "E-7 to E-8 promotion guardrail",
            "fromPayGradeNumeric": 7,
            "toPayGradeNumeric": 8,
            "minYearsOfService": 16,
            "minTimeInGradeYears": 4,
            "verificationStatus": "placeholder_pending_research",
            "sourceLabel": "Planner promotion guardrail placeholder",
            "sourceUrl": "",
            "notes": "Planner validation rule for the next promotion step. Replace with researched official criteria during the next source pass.",
        },
        {
            "id": "promo_rule_e8_to_e9",
            "label": "E-8 to E-9 promotion guardrail",
            "fromPayGradeNumeric": 8,
            "toPayGradeNumeric": 9,
            "minYearsOfService": 19,
            "minTimeInGradeYears": 3,
            "verificationStatus": "placeholder_pending_research",
            "sourceLabel": "Planner promotion guardrail placeholder",
            "sourceUrl": "",
            "notes": "Planner validation rule for the final enlisted promotion step. Replace with researched official criteria during the next source pass.",
        },
    ]


def _build_military_promotion_schedule() -> list[dict[str, Any]]:
    return [
        {
            "id": "promotion_slot_1",
            "label": "Promotion Slot 1",
            "slotOrder": 1,
            "enabledFlag": 0,
            "promotionYear": 2029,
            "targetPayGradeNumeric": 8,
            "validationState": "seed_default",
            "validationMessage": "Disabled until you choose to enable it.",
            "notes": "First optional projected promotion. Enable it and pick the year you expect to move to the next grade.",
        },
        {
            "id": "promotion_slot_2",
            "label": "Promotion Slot 2",
            "slotOrder": 2,
            "enabledFlag": 0,
            "promotionYear": 2032,
            "targetPayGradeNumeric": 9,
            "validationState": "seed_default",
            "validationMessage": "Disabled until you choose to enable it.",
            "notes": "Second optional projected promotion. The planner validates sequential grade progression and TIG/TIS timing.",
        },
    ]


def _build_career_profiles() -> list[dict[str, Any]]:
    rows = [
        ("tech_company", "GENERIC_IC", "Generic Big Tech IC", 117638, 0.10, 20000, 0.04),
        ("tech_company", "MSFT_SWE", "Microsoft SWE (L62-63)", 175000, 0.15, 90000, 0.04),
        ("tech_company", "GOOG_SWE", "Google SWE (L4-L5)", 190000, 0.15, 110000, 0.04),
        ("tech_company", "NVDA_IC", "NVIDIA IC (IC4-5)", 195000, 0.15, 150000, 0.05),
        ("tech_company", "INTEL_IC", "Intel Grade 7-8", 155000, 0.10, 40000, 0.03),
        ("tech_company", "STARTUP_TECH", "Funded Tech Startup", 140000, 0.05, 40000, 0.05),
        ("research_employer", "CONSERVATIVE", "Conservative Default", 220000, 0.10, 30000, 0.04),
        ("research_employer", "INTEL_LABS", "Intel Labs", 190000, 0.10, 50000, 0.03),
        ("research_employer", "NEURALINK", "Neuralink", 185000, 0.10, 60000, 0.04),
        ("research_employer", "MSFT_RESEARCH", "Microsoft Research", 200000, 0.15, 80000, 0.04),
        ("research_employer", "DEEPMIND", "Google DeepMind", 230000, 0.15, 120000, 0.04),
        ("research_employer", "NVDA_RESEARCH", "NVIDIA Research", 250000, 0.15, 150000, 0.05),
        ("research_employer", "ANTHROPIC", "Anthropic", 400000, 0.00, 100000, 0.05),
    ]
    return [
        {
            "id": item_id,
            "label": label,
            "profileType": profile_type,
            "baseSalary": base_salary,
            "bonusPct": bonus_pct,
            "annualRsu": annual_rsu,
            "growthRate": growth_rate,
            "sourceLabel": "Planner seed default",
            "sourceUrl": "",
            "verificationStatus": "seed_default",
            "notes": "Reference compensation profile used by path selectors.",
        }
        for profile_type, item_id, label, base_salary, bonus_pct, annual_rsu, growth_rate in rows
    ]


def _build_va_disability() -> list[dict[str, Any]]:
    rows = [
        ("0", "0%", 0.00, 0.00, "baseline", "None"),
        ("10", "10%", 180.42, 2165.04, "basic", "Priority Group 3"),
        ("20", "20%", 356.00, 4272.00, "basic", "Priority Group 3"),
        ("30", "30%", 552.47, 6629.64, "basic", "Priority Group 2"),
        ("40", "40%", 795.84, 9550.08, "basic", "Priority Group 2"),
        ("50", "50%", 1132.90, 13594.80, "priority", "Priority Group 1"),
        ("60", "60%", 1435.01, 17220.12, "priority", "Priority Group 1"),
        ("70", "70%", 1808.44, 21701.28, "priority", "Priority Group 1"),
        ("80", "80%", 2102.14, 25225.68, "priority", "Priority Group 1"),
        ("90", "90%", 2362.30, 28347.60, "priority", "Priority Group 1"),
        ("100", "100%", 3938.57, 47262.84, "full", "Priority Group 1"),
    ]
    return [
        {
            "id": item_id,
            "label": label,
            "monthly": monthly,
            "annual": annual,
            "healthcareTier": healthcare_tier,
            "priorityGroup": priority_group,
            "sourceLabel": "Planner seed default",
            "sourceUrl": "",
            "verificationStatus": "seed_default",
            "notes": "VA disability reference row used by the path selectors.",
        }
        for item_id, label, monthly, annual, healthcare_tier, priority_group in rows
    ]


def _build_gi_bill_benefits() -> list[dict[str, Any]]:
    return [
        {
            "id": "gi_bill_bay_area",
            "label": "GI Bill MHA · Bay Area",
            "locationId": "stanford_ca",
            "deliveryMode": "in_person",
            "monthlyHousingAllowance": 4992.0,
            "booksSuppliesAnnual": 1000.0,
            "monthsEligible": 36,
            "eligibilityReason": "location_based_mha",
            "sourceLabel": "Planner seed default",
            "sourceUrl": "",
            "verificationStatus": "seed_default",
            "notes": "Used by Stanford and UC Berkeley. Both stack with the stipend in the current model.",
        },
        {
            "id": "gi_bill_cambridge_ma",
            "label": "GI Bill MHA · Cambridge, MA",
            "locationId": "cambridge_ma",
            "deliveryMode": "in_person",
            "monthlyHousingAllowance": 3513.0,
            "booksSuppliesAnnual": 1000.0,
            "monthsEligible": 36,
            "eligibilityReason": "location_based_mha",
            "sourceLabel": "Planner seed default",
            "sourceUrl": "",
            "verificationStatus": "seed_default",
            "notes": "MIT reference MHA used in the planner baseline.",
        },
        {
            "id": "gi_bill_pittsburgh_pa",
            "label": "GI Bill MHA · Pittsburgh, PA",
            "locationId": "pittsburgh_pa",
            "deliveryMode": "in_person",
            "monthlyHousingAllowance": 1400.0,
            "booksSuppliesAnnual": 1000.0,
            "monthsEligible": 36,
            "eligibilityReason": "location_based_mha",
            "sourceLabel": "Planner seed default",
            "sourceUrl": "",
            "verificationStatus": "seed_default",
            "notes": "CMU reference MHA used in the planner baseline.",
        },
        {
            "id": "gi_bill_seattle_wa",
            "label": "GI Bill MHA · Seattle, WA",
            "locationId": "seattle_wa",
            "deliveryMode": "in_person",
            "monthlyHousingAllowance": 3200.0,
            "booksSuppliesAnnual": 1000.0,
            "monthsEligible": 36,
            "eligibilityReason": "location_based_mha",
            "sourceLabel": "Planner seed default",
            "sourceUrl": "",
            "verificationStatus": "seed_default",
            "notes": "University of Washington reference MHA used in the planner baseline.",
        },
        {
            "id": "gi_bill_davis_ca",
            "label": "GI Bill MHA · Davis, CA",
            "locationId": "davis_ca",
            "deliveryMode": "in_person",
            "monthlyHousingAllowance": 1980.0,
            "booksSuppliesAnnual": 1000.0,
            "monthsEligible": 36,
            "eligibilityReason": "location_based_mha",
            "sourceLabel": "Planner seed default",
            "sourceUrl": "",
            "verificationStatus": "seed_default",
            "notes": "UC Davis reference MHA used in the planner baseline.",
        },
        {
            "id": "gi_bill_international_placeholder",
            "label": "GI Bill international placeholder",
            "locationId": "tokyo_jp",
            "deliveryMode": "international",
            "monthlyHousingAllowance": 0.0,
            "booksSuppliesAnnual": 1000.0,
            "monthsEligible": 36,
            "eligibilityReason": "international_rate_pending_research",
            "sourceLabel": "Placeholder pending research",
            "sourceUrl": "",
            "verificationStatus": "placeholder_pending_research",
            "notes": "This 0 value does not imply ineligibility. It preserves current planner behavior until the international GI Bill rules are researched and verified.",
        },
    ]


def _build_healthcare_profiles() -> list[dict[str, Any]]:
    return [
        {
            "id": "active_duty_covered",
            "label": "Active-duty healthcare",
            "coverageKind": "military_covered",
            "annualCost": 0.0,
            "inflationRate": 0.0,
            "sourceLabel": "Planner seed default",
            "sourceUrl": "",
            "verificationStatus": "seed_default",
            "notes": "Active-duty baseline assumes no direct annual healthcare cost.",
        },
        {
            "id": "tricare_select_retiree",
            "label": "TRICARE Select retiree",
            "coverageKind": "retiree_tricare",
            "annualCost": 182.0,
            "inflationRate": 0.03,
            "sourceLabel": "Planner seed default",
            "sourceUrl": "",
            "verificationStatus": "placeholder_pending_research",
            "notes": "Retiree TRICARE placeholder aligned with the current baseline until the public rate is re-verified.",
        },
        {
            "id": "civilian_employer_plan",
            "label": "Civilian employer plan",
            "coverageKind": "civilian_employer",
            "annualCost": 3000.0,
            "inflationRate": 0.08,
            "sourceLabel": "Planner seed default",
            "sourceUrl": "",
            "verificationStatus": "seed_default",
            "notes": "Employer-sponsored plan baseline used for tech and research phases.",
        },
        {
            "id": "marketplace_gap_year",
            "label": "Marketplace gap-year plan",
            "coverageKind": "gap_year_marketplace",
            "annualCost": 3000.0,
            "inflationRate": 0.0,
            "sourceLabel": "Planner seed default",
            "sourceUrl": "",
            "verificationStatus": "seed_default",
            "notes": "Gap-year health insurance placeholder used by Path C.",
        },
        {
            "id": "university_funded_healthcare",
            "label": "University-funded healthcare",
            "coverageKind": "university_covered",
            "annualCost": 0.0,
            "inflationRate": 0.0,
            "sourceLabel": "Workbook funding note + planner baseline",
            "sourceUrl": "",
            "verificationStatus": "seed_default",
            "notes": "Current model assumes direct healthcare cost is covered during PhD years.",
        },
        {
            "id": "va_full_coverage_placeholder",
            "label": "VA full coverage placeholder",
            "coverageKind": "va_full_coverage",
            "annualCost": 0.0,
            "inflationRate": 0.0,
            "sourceLabel": "Placeholder pending research",
            "sourceUrl": "",
            "verificationStatus": "placeholder_pending_research",
            "notes": "Used to document the future 100% VA healthcare rule without automatically changing current projections.",
        },
    ]


def _build_tax_profiles() -> list[dict[str, Any]]:
    return [
        {
            "id": "active_duty_default",
            "label": "Active-duty default taxes",
            "phaseKind": "active_duty",
            "federalRate": 0.12,
            "stateRate": 0.07,
            "locationId": "sacramento_ca",
            "verificationStatus": "seed_default",
            "notes": "Preserves current active-duty tax behavior.",
        },
        {
            "id": "retirement_transition_default",
            "label": "Retirement transition taxes",
            "phaseKind": "retirement_transition",
            "federalRate": 0.12,
            "stateRate": 0.07,
            "locationId": "langley_hampton_roads_va",
            "verificationStatus": "seed_default",
            "notes": "Preserves current retirement transition tax behavior.",
        },
        {
            "id": "civilian_mid_default_ca",
            "label": "Civilian mid-income default",
            "phaseKind": "civilian_mid_income",
            "federalRate": 0.22,
            "stateRate": 0.07,
            "locationId": "sacramento_ca",
            "verificationStatus": "seed_default",
            "notes": "Used by Path B while salary remains below the high-income threshold.",
        },
        {
            "id": "civilian_high_default",
            "label": "Civilian high-income default",
            "phaseKind": "civilian_high_income",
            "federalRate": 0.24,
            "stateRate": 0.07,
            "locationId": "sacramento_ca",
            "verificationStatus": "seed_default",
            "notes": "Used by research-scientist phases and higher-income tech years.",
        },
        {
            "id": "civilian_default_ca",
            "label": "California default state tax",
            "phaseKind": "location_default",
            "federalRate": 0.0,
            "stateRate": 0.07,
            "locationId": "sacramento_ca",
            "verificationStatus": "seed_default",
            "notes": "Default location-linked state tax profile.",
        },
        {
            "id": "phd_ca",
            "label": "PhD taxes · California",
            "phaseKind": "phd",
            "federalRate": 0.10,
            "stateRate": 0.07,
            "locationId": "stanford_ca",
            "verificationStatus": "seed_default",
            "notes": "Used by Stanford, Berkeley, and Davis.",
        },
        {
            "id": "phd_ma",
            "label": "PhD taxes · Massachusetts",
            "phaseKind": "phd",
            "federalRate": 0.10,
            "stateRate": 0.05,
            "locationId": "cambridge_ma",
            "verificationStatus": "seed_default",
            "notes": "Used by MIT.",
        },
        {
            "id": "phd_pa",
            "label": "PhD taxes · Pennsylvania",
            "phaseKind": "phd",
            "federalRate": 0.10,
            "stateRate": 0.0307,
            "locationId": "pittsburgh_pa",
            "verificationStatus": "seed_default",
            "notes": "Used by CMU.",
        },
        {
            "id": "phd_wa",
            "label": "PhD taxes · Washington",
            "phaseKind": "phd",
            "federalRate": 0.10,
            "stateRate": 0.0,
            "locationId": "seattle_wa",
            "verificationStatus": "seed_default",
            "notes": "Used by the University of Washington.",
        },
        {
            "id": "phd_international",
            "label": "PhD taxes · International placeholder",
            "phaseKind": "phd",
            "federalRate": 0.10,
            "stateRate": 0.0,
            "locationId": "tokyo_jp",
            "verificationStatus": "placeholder_pending_research",
            "notes": "Preserves the current international zero-state-tax assumption until a deeper tax pass is completed.",
        },
    ]


def _build_investment_policies() -> list[dict[str, Any]]:
    return [
        {
            "id": "portfolio_growth_core",
            "label": "Core portfolio growth",
            "recordType": "growth_assumption",
            "annualReturnRate": 0.07,
            "surplusInvestmentRate": 0.20,
            "withdrawalRate": 0.04,
            "monthlyContribution": None,
            "annualContribution": None,
            "destinationId": None,
            "accountType": None,
            "taxTreatment": None,
            "contributionType": None,
            "verificationStatus": "seed_default",
            "notes": "Core portfolio growth assumptions used throughout the model.",
        },
        {
            "id": "military_retirement_contribution",
            "label": "Military retirement contribution",
            "recordType": "contribution_policy",
            "annualReturnRate": None,
            "surplusInvestmentRate": None,
            "withdrawalRate": None,
            "monthlyContribution": 1900.0,
            "annualContribution": 22800.0,
            "destinationId": "tsp",
            "accountType": None,
            "taxTreatment": None,
            "contributionType": None,
            "verificationStatus": "seed_default",
            "notes": "Active-duty retirement contribution default.",
        },
        {
            "id": "civilian_retirement_contribution",
            "label": "Civilian retirement contribution",
            "recordType": "contribution_policy",
            "annualReturnRate": None,
            "surplusInvestmentRate": None,
            "withdrawalRate": None,
            "monthlyContribution": 500.0,
            "annualContribution": 6000.0,
            "destinationId": "401k",
            "accountType": None,
            "taxTreatment": None,
            "contributionType": None,
            "verificationStatus": "seed_default",
            "notes": "Civilian retirement contribution default used by tech and research phases.",
        },
        {
            "id": "phd_retirement_contribution",
            "label": "PhD retirement contribution",
            "recordType": "contribution_policy",
            "annualReturnRate": None,
            "surplusInvestmentRate": None,
            "withdrawalRate": None,
            "monthlyContribution": 0.0,
            "annualContribution": 0.0,
            "destinationId": "roth_ira",
            "accountType": None,
            "taxTreatment": None,
            "contributionType": None,
            "verificationStatus": "seed_default",
            "notes": "No retirement savings are modeled during PhD years in the baseline.",
        },
        {
            "id": "tsp",
            "label": "TSP",
            "recordType": "destination",
            "annualReturnRate": None,
            "surplusInvestmentRate": None,
            "withdrawalRate": None,
            "monthlyContribution": None,
            "annualContribution": None,
            "destinationId": None,
            "accountType": "retirement",
            "taxTreatment": "traditional_or_roth",
            "contributionType": "payroll",
            "verificationStatus": "seed_default",
            "notes": "Primary military retirement destination.",
        },
        {
            "id": "401k",
            "label": "401(k)",
            "recordType": "destination",
            "annualReturnRate": None,
            "surplusInvestmentRate": None,
            "withdrawalRate": None,
            "monthlyContribution": None,
            "annualContribution": None,
            "destinationId": None,
            "accountType": "retirement",
            "taxTreatment": "traditional_or_roth",
            "contributionType": "payroll",
            "verificationStatus": "seed_default",
            "notes": "Primary civilian retirement destination.",
        },
        {
            "id": "roth_ira",
            "label": "Roth IRA",
            "recordType": "destination",
            "annualReturnRate": None,
            "surplusInvestmentRate": None,
            "withdrawalRate": None,
            "monthlyContribution": None,
            "annualContribution": None,
            "destinationId": None,
            "accountType": "retirement",
            "taxTreatment": "roth",
            "contributionType": "manual",
            "verificationStatus": "seed_default",
            "notes": "Roth IRA destination reserved for future routing detail.",
        },
        {
            "id": "brokerage",
            "label": "Brokerage",
            "recordType": "destination",
            "annualReturnRate": None,
            "surplusInvestmentRate": None,
            "withdrawalRate": None,
            "monthlyContribution": None,
            "annualContribution": None,
            "destinationId": None,
            "accountType": "taxable_investment",
            "taxTreatment": "taxable",
            "contributionType": "surplus",
            "verificationStatus": "seed_default",
            "notes": "Default taxable investment destination.",
        },
        {
            "id": "cash_reserve",
            "label": "Cash Reserve",
            "recordType": "destination",
            "annualReturnRate": None,
            "surplusInvestmentRate": None,
            "withdrawalRate": None,
            "monthlyContribution": None,
            "annualContribution": None,
            "destinationId": None,
            "accountType": "cash",
            "taxTreatment": "n/a",
            "contributionType": "reserve",
            "verificationStatus": "seed_default",
            "notes": "Checking and savings held outside invested portfolio growth.",
        },
    ]


def _build_pension_profiles() -> list[dict[str, Any]]:
    return [
        {
            "id": "high_3_path_a",
            "label": "High-3 retirement pension",
            "retirementSystem": "High-3",
            "monthlyAtRetirement": 3633.0,
            "annualAtRetirement": 43596.0,
            "colaRate": 0.028,
            "transitionBlendActive": 0.75,
            "transitionBlendPension": 0.25,
            "verificationStatus": "seed_default",
            "notes": "Current Path A pension baseline.",
        }
    ]


def _build_path_timeline_defaults() -> list[dict[str, Any]]:
    return [
        {
            "id": "timeline_path_a",
            "label": "Path A timeline",
            "pathId": "PATH_A",
            "activeDutyEndYearIndex": 7,
            "retirementTransitionYearIndex": 8,
            "careerStartYearIndex": None,
            "gapYearIndex": None,
            "phdStartYearIndex": 9,
            "phdEndYearIndex": 13,
            "researchStartYearIndex": 14,
            "defaultResearchLocationId": "langley_hampton_roads_va",
            "locationPlan": [
                {"phaseId": "active_duty", "effectiveStart": "2026-01-01", "locationId": "sacramento_ca"},
                {"phaseId": "active_duty", "effectiveStart": "2027-04-01", "locationId": "langley_hampton_roads_va"},
                {"phaseId": "retirement_transition", "effectiveStart": "2034-01-01", "locationId": "langley_hampton_roads_va"},
                {"phaseId": "retired_phd", "effectiveStart": "2035-01-01", "locationStrategy": "selected_program"},
                {"phaseId": "retired_research", "effectiveStart": "2040-01-01", "locationId": "langley_hampton_roads_va"},
            ],
            "verificationStatus": "seed_default",
            "notes": "Default path timing plus the expected April 2027 Langley move.",
        },
        {
            "id": "timeline_path_b",
            "label": "Path B timeline",
            "pathId": "PATH_B",
            "activeDutyEndYearIndex": 1,
            "retirementTransitionYearIndex": None,
            "careerStartYearIndex": 2,
            "gapYearIndex": None,
            "phdStartYearIndex": None,
            "phdEndYearIndex": None,
            "researchStartYearIndex": None,
            "defaultResearchLocationId": "sacramento_ca",
            "locationPlan": [
                {"phaseId": "active_duty", "effectiveStart": "2026-01-01", "locationId": "sacramento_ca"},
                {"phaseId": "tech_career", "effectiveStart": "2028-01-01", "locationId": "sacramento_ca"},
            ],
            "verificationStatus": "seed_default",
            "notes": "Immediate tech path keeps the current default location until a user-specific location selector is added.",
        },
        {
            "id": "timeline_path_c",
            "label": "Path C timeline",
            "pathId": "PATH_C",
            "activeDutyEndYearIndex": 1,
            "retirementTransitionYearIndex": None,
            "careerStartYearIndex": None,
            "gapYearIndex": 2,
            "phdStartYearIndex": 3,
            "phdEndYearIndex": 7,
            "researchStartYearIndex": 8,
            "defaultResearchLocationId": "sacramento_ca",
            "locationPlan": [
                {"phaseId": "active_duty", "effectiveStart": "2026-01-01", "locationId": "sacramento_ca"},
                {"phaseId": "gap_year", "effectiveStart": "2028-01-01", "locationId": "sacramento_ca"},
                {"phaseId": "phd_only", "effectiveStart": "2029-01-01", "locationStrategy": "selected_program"},
                {"phaseId": "research_only", "effectiveStart": "2034-01-01", "locationId": "sacramento_ca"},
            ],
            "verificationStatus": "seed_default",
            "notes": "Gap-year-to-PhD path inherits the selected program location once school begins.",
        },
    ]


def _build_benefit_rules() -> list[dict[str, Any]]:
    return [
        {
            "id": "va_cola",
            "label": "VA compensation COLA",
            "ruleType": "cola_rate",
            "valueNumber": None,
            "valuePercent": 0.028,
            "valueText": "",
            "verificationStatus": "seed_default",
            "notes": "Applied to annual VA compensation after the first year it becomes active.",
        },
        {
            "id": "gi_bill_usage_default",
            "label": "GI Bill usage default",
            "ruleType": "duration_months",
            "valueNumber": 36,
            "valuePercent": None,
            "valueText": "Applies to the first three PhD years in the current annual model.",
            "verificationStatus": "seed_default",
            "notes": "Keeps current 36-month GI Bill logic separate from school records.",
        },
        {
            "id": "living_expense_growth_default",
            "label": "Living expense growth default",
            "ruleType": "growth_rate",
            "valueNumber": None,
            "valuePercent": 0.03,
            "valueText": "",
            "verificationStatus": "seed_default",
            "notes": "Fallback expense growth used when a location cost profile does not override it.",
        },
        {
            "id": "high_income_salary_threshold",
            "label": "High-income salary threshold",
            "ruleType": "threshold",
            "valueNumber": 200000,
            "valuePercent": None,
            "valueText": "Above this salary the high-income civilian federal tax profile is used.",
            "verificationStatus": "seed_default",
            "notes": "Preserves the current tech-career tax threshold.",
        },
        {
            "id": "va_full_healthcare_threshold",
            "label": "VA full healthcare threshold",
            "ruleType": "threshold",
            "valueNumber": 100,
            "valuePercent": None,
            "valueText": "Documents the future automatic healthcare override rule for 100% VA disability.",
            "verificationStatus": "placeholder_pending_research",
            "notes": "Present for structure only; it does not automatically change the current projection results yet.",
        },
    ]


def _pay_grade_label(value: int | float | str | None) -> str:
    if value is None or value == "":
        return "—"
    if isinstance(value, str) and value.upper().startswith("E-"):
        return value.upper()
    return f"E-{int(float(value))}"


def _record_is_active_for_date(record: dict[str, Any], effective_date: str) -> bool:
    start = record.get("effectiveStart") or ""
    end = record.get("effectiveEnd")
    if start and start > effective_date:
        return False
    if end and end < effective_date:
        return False
    return True


def _timeline_defaults(reference_domains: dict[str, list[dict[str, Any]]], path_id: str) -> dict[str, Any]:
    for item in reference_domains.get("path_timeline_defaults", []):
        if item.get("pathId") == path_id:
            return item
    return {}


def _resolve_reference_location_id(
    timeline: dict[str, Any],
    phase_id: str,
    effective_date: str,
) -> str | None:
    location_plan = timeline.get("locationPlan", [])
    matching = [
        item
        for item in location_plan
        if item.get("phaseId") == phase_id and item.get("effectiveStart", "") <= effective_date
    ]
    if not matching:
        return timeline.get("defaultResearchLocationId")
    selected = sorted(matching, key=lambda item: item.get("effectiveStart", ""))[-1]
    return selected.get("locationId")


def _military_service_profile(reference_domains: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    return (reference_domains.get("military_service_profile") or [{}])[0]


def _enabled_promotion_rows(reference_domains: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    return sorted(
        [
            row
            for row in reference_domains.get("military_promotion_schedule", [])
            if float(row.get("enabledFlag", 0) or 0) >= 0.5
        ],
        key=lambda row: (int(row.get("promotionYear", 0) or 0), int(row.get("slotOrder", 0) or 0)),
    )


def _promotion_rule(reference_domains: dict[str, list[dict[str, Any]]], from_grade: int, to_grade: int) -> dict[str, Any] | None:
    for row in reference_domains.get("military_promotion_rules", []):
        if int(row.get("fromPayGradeNumeric", 0) or 0) == from_grade and int(row.get("toPayGradeNumeric", 0) or 0) == to_grade:
            return row
    return None


def validate_military_reference_state(
    reference_domains: dict[str, list[dict[str, Any]]],
    planner_profile: dict[str, Any],
) -> None:
    profile = _military_service_profile(reference_domains)
    start_grade = int(profile.get("startingPayGradeNumeric", 0) or 0)
    start_yos = int(profile.get("startingYearsOfService", 0) or 0)
    start_tig = float(profile.get("startingTimeInGradeYears", 0) or 0)
    retire_yos = int(profile.get("retirementYearsOfService", 20) or 20)
    base_year = int(planner_profile.get("baseYear", 2026))

    if start_grade < 1 or start_grade > 9:
        raise ValueError("Current military pay grade must stay between E-1 and E-9.")
    if retire_yos <= start_yos:
        raise ValueError("Retirement TAFMS must be greater than the current TAFMS year.")

    promotions = _enabled_promotion_rows(reference_domains)
    if len(promotions) > 2:
        raise ValueError("The planner currently supports at most two projected promotions.")

    current_grade = start_grade
    current_grade_start_year = base_year - int(start_tig)
    for promotion in promotions:
        promotion_year = int(promotion.get("promotionYear", 0) or 0)
        target_grade = int(promotion.get("targetPayGradeNumeric", 0) or 0)
        if target_grade > 9:
            raise ValueError("Projected military promotions cannot go beyond E-9.")
        if target_grade != current_grade + 1:
            raise ValueError("Projected military promotions must move one enlisted grade at a time.")
        projected_yos = start_yos + (promotion_year - base_year)
        if projected_yos > retire_yos:
            raise ValueError("A projected promotion cannot happen after the retirement TAFMS year.")
        rule = _promotion_rule(reference_domains, current_grade, target_grade)
        if not rule:
            raise ValueError(f"No promotion rule is configured for {_pay_grade_label(current_grade)} to {_pay_grade_label(target_grade)}.")
        min_yos = int(rule.get("minYearsOfService", 0) or 0)
        min_tig = float(rule.get("minTimeInGradeYears", 0) or 0)
        projected_tig = promotion_year - current_grade_start_year
        if projected_yos < min_yos:
            raise ValueError(
                f"{_pay_grade_label(current_grade)} to {_pay_grade_label(target_grade)} requires at least {min_yos} years of service in the planner rules."
            )
        if projected_tig < min_tig:
            raise ValueError(
                f"{_pay_grade_label(current_grade)} to {_pay_grade_label(target_grade)} requires at least {min_tig:g} years in grade in the planner rules."
            )
        current_grade = target_grade
        current_grade_start_year = promotion_year


def _raise_rows(reference_domains: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    return sorted(reference_domains.get("military_raise_schedule", []), key=lambda row: int(row.get("calendarYear", 0) or 0))


def _resolve_raise_row(reference_domains: dict[str, list[dict[str, Any]]], year: int) -> dict[str, Any] | None:
    rows = _raise_rows(reference_domains)
    if not rows:
        return None
    exact = next((row for row in rows if int(row.get("calendarYear", 0) or 0) == year), None)
    if exact:
        return exact
    earlier = [row for row in rows if int(row.get("calendarYear", 0) or 0) < year]
    return earlier[-1] if earlier else rows[0]


def _rate_candidates(
    reference_domains: dict[str, list[dict[str, Any]]],
    component: str,
    effective_date: str,
) -> list[dict[str, Any]]:
    return [
        row
        for row in reference_domains.get("military_pay_rates", [])
        if row.get("component") == component and _record_is_active_for_date(row, effective_date)
    ]


def resolve_military_rate(
    reference_domains: dict[str, list[dict[str, Any]]],
    component: str,
    *,
    calendar_year: int,
    effective_date: str,
    pay_grade_numeric: int,
    years_of_service: int,
    location_id: str | None,
    dependency_status: str,
) -> dict[str, Any] | None:
    candidates = _rate_candidates(reference_domains, component, effective_date)
    if not candidates:
        return None
    if location_id:
        location_matches = [row for row in candidates if row.get("locationId") == location_id]
        if location_matches:
            candidates = location_matches
        else:
            generic_location_matches = [row for row in candidates if not row.get("locationId")]
            if generic_location_matches:
                candidates = generic_location_matches
    else:
        generic_location_matches = [row for row in candidates if not row.get("locationId")]
        if generic_location_matches:
            candidates = generic_location_matches

    dependency_matches = [row for row in candidates if row.get("dependencyStatus") in {dependency_status, "n/a", None, ""}]
    if dependency_matches:
        candidates = dependency_matches

    pay_grade_label = _pay_grade_label(pay_grade_numeric)
    grade_matches = [row for row in candidates if row.get("payGrade") in {pay_grade_label, None, ""}]
    if grade_matches:
        candidates = grade_matches

    threshold_matches = [row for row in candidates if row.get("yearsOfService") in {None, ""} or int(row.get("yearsOfService", 0) or 0) <= years_of_service]
    if threshold_matches:
        candidates = threshold_matches

    def _sort_key(row: dict[str, Any]) -> tuple[int, int, str]:
        return (
            int(row.get("tableYear", 0) or 0),
            int(row.get("yearsOfService", 0) or 0),
            row.get("effectiveStart", "") or "",
        )

    source_row = sorted(candidates, key=_sort_key)[-1]
    monthly_rate = float(source_row.get("monthlyRate", 0) or 0)
    applied_raise_rows: list[dict[str, Any]] = []
    source_year = int(source_row.get("tableYear", calendar_year) or calendar_year)
    for year in range(source_year + 1, calendar_year + 1):
        raise_row = _resolve_raise_row(reference_domains, year)
        if not raise_row:
            continue
        monthly_rate *= 1 + float(raise_row.get("raisePercent", 0) or 0)
        applied_raise_rows.append(raise_row)

    resolved = copy.deepcopy(source_row)
    resolved["sourceRowId"] = source_row["id"]
    resolved["resolvedMonthlyRate"] = monthly_rate
    resolved["resolvedAnnualizedRate"] = monthly_rate * 12
    resolved["appliedRaiseRows"] = applied_raise_rows
    resolved["raiseSourceYear"] = int(applied_raise_rows[-1]["calendarYear"]) if applied_raise_rows else source_year
    resolved["resolvedPayGrade"] = pay_grade_label
    resolved["resolvedYearsOfService"] = years_of_service
    return resolved


def hydrate_military_reference_domains(
    reference_domains: dict[str, list[dict[str, Any]]],
    planner_profile: dict[str, Any],
) -> dict[str, list[dict[str, Any]]]:
    # A custom service profile (public picker / personalized local profile)
    # builds the projection view from the full 2026 DFAS tables instead of the
    # seeded E-7 trajectory.
    if (planner_profile or {}).get("serviceProfile"):
        from .reference_v2 import build_service_projection_domains

        return build_service_projection_domains(copy.deepcopy(reference_domains), planner_profile)

    hydrated = copy.deepcopy(reference_domains)
    profile = _military_service_profile(hydrated)
    base_year = int(planner_profile.get("baseYear", 2026))
    start_grade = int(profile.get("startingPayGradeNumeric", 7) or 7)
    start_yos = int(profile.get("startingYearsOfService", 12) or 12)
    start_tig = float(profile.get("startingTimeInGradeYears", 2) or 2)
    retire_yos = int(profile.get("retirementYearsOfService", 20) or 20)
    dependency_status = "with_dependents" if float(profile.get("withDependentsFlag", 1) or 0) >= 0.5 else "without_dependents"
    timeline = _timeline_defaults(hydrated, "PATH_A")

    profile["dependencyStatus"] = dependency_status
    profile["startingPayGradeLabel"] = _pay_grade_label(start_grade)

    current_grade = start_grade
    current_grade_start_year = base_year - int(start_tig)
    schedule_rows: list[dict[str, Any]] = []

    promotions = sorted(hydrated.get("military_promotion_schedule", []), key=lambda row: int(row.get("slotOrder", 0) or 0))
    enabled_promotions = _enabled_promotion_rows(hydrated)
    enabled_promotions_by_year = {int(row.get("promotionYear", 0) or 0): row for row in enabled_promotions}

    for row in promotions:
        enabled = float(row.get("enabledFlag", 0) or 0) >= 0.5
        row["fromPayGradeNumeric"] = current_grade
        row["projectedYearsOfService"] = start_yos + (int(row.get("promotionYear", base_year) or base_year) - base_year)
        row["projectedTimeInGradeYears"] = int(row.get("promotionYear", base_year) or base_year) - current_grade_start_year
        if not enabled:
            row["validationState"] = "seed_default"
            row["validationMessage"] = "Disabled until you choose to enable it."
            continue
        target_grade = int(row.get("targetPayGradeNumeric", 0) or 0)
        rule = _promotion_rule(hydrated, current_grade, target_grade)
        row["validationState"] = "verified" if rule else "placeholder_pending_research"
        row["validationMessage"] = (
            "Sequential promotion slot ready."
            if rule
            else f"No promotion rule is configured for {_pay_grade_label(current_grade)} to {_pay_grade_label(target_grade)}."
        )
        current_grade = target_grade
        current_grade_start_year = int(row.get("promotionYear", base_year) or base_year)

    current_grade = start_grade
    for year in range(base_year, base_year + max(retire_yos - start_yos, 0) + 1):
        if year in enabled_promotions_by_year:
            current_grade = int(enabled_promotions_by_year[year].get("targetPayGradeNumeric", current_grade) or current_grade)
        years_of_service = start_yos + (year - base_year)
        phase_id = "active_duty" if years_of_service < retire_yos else "retirement_transition"
        effective_date = f"{year}-12-31"
        location_id = _resolve_reference_location_id(timeline, phase_id, effective_date) or "sacramento_ca"
        base_pay = resolve_military_rate(
            hydrated,
            "base_pay",
            calendar_year=year,
            effective_date=effective_date,
            pay_grade_numeric=current_grade,
            years_of_service=years_of_service,
            location_id=None,
            dependency_status=dependency_status,
        )
        bah = resolve_military_rate(
            hydrated,
            "bah",
            calendar_year=year,
            effective_date=effective_date,
            pay_grade_numeric=current_grade,
            years_of_service=years_of_service,
            location_id=location_id,
            dependency_status=dependency_status,
        )
        bas = resolve_military_rate(
            hydrated,
            "bas",
            calendar_year=year,
            effective_date=effective_date,
            pay_grade_numeric=current_grade,
            years_of_service=years_of_service,
            location_id=None,
            dependency_status=dependency_status,
        )
        raise_row = _resolve_raise_row(hydrated, year)
        promotion_applied = enabled_promotions_by_year.get(year)
        schedule_rows.append(
            {
                "id": f"military_schedule_{year}",
                "label": f"Military schedule · {year}",
                "calendarYear": year,
                "phaseId": phase_id,
                "yearsOfService": years_of_service,
                "projectedPayGradeNumeric": current_grade,
                "basePayAnnual": float(base_pay.get("resolvedAnnualizedRate", 0) if base_pay else 0),
                "bahAnnual": float(bah.get("resolvedAnnualizedRate", 0) if bah else 0),
                "basAnnual": float(bas.get("resolvedAnnualizedRate", 0) if bas else 0),
                "totalMilitaryCompAnnual": float(base_pay.get("resolvedAnnualizedRate", 0) if base_pay else 0)
                + float(bah.get("resolvedAnnualizedRate", 0) if bah else 0)
                + float(bas.get("resolvedAnnualizedRate", 0) if bas else 0),
                "raisePercent": float(raise_row.get("raisePercent", 0) if raise_row else 0),
                "raiseSourceYear": int(raise_row.get("calendarYear", year) if raise_row else year),
                "locationId": location_id,
                "promotionAppliedLabel": promotion_applied["label"] if promotion_applied else "",
                "basePaySourceId": base_pay.get("sourceRowId") if base_pay else None,
                "bahSourceId": bah.get("sourceRowId") if bah else None,
                "basSourceId": bas.get("sourceRowId") if bas else None,
            }
        )

    hydrated["military_compensation_projection_view"] = schedule_rows
    return hydrated


def build_reference_domains() -> dict[str, list[dict[str, Any]]]:
    return {
        "programs": _build_program_domain(),
        "locations": _build_locations(),
        "location_cost_profiles": _build_location_cost_profiles(),
        "military_service_profile": _build_military_service_profile(),
        "military_pay_rates": _build_military_pay_rates(),
        "military_raise_schedule": _build_military_raise_schedule(),
        "military_promotion_rules": _build_military_promotion_rules(),
        "military_promotion_schedule": _build_military_promotion_schedule(),
        "career_comp_profiles": _build_career_profiles(),
        "va_disability": _build_va_disability(),
        "gi_bill_benefits": _build_gi_bill_benefits(),
        "healthcare_profiles": _build_healthcare_profiles(),
        "tax_profiles": _build_tax_profiles(),
        "investment_policies": _build_investment_policies(),
        "pension_profiles": _build_pension_profiles(),
        "path_timeline_defaults": _build_path_timeline_defaults(),
        "benefit_rules": _build_benefit_rules(),
    }


def editable_reference_fields() -> dict[str, set[str]]:
    return {
        domain: set(meta.get("editableFields", {}).keys())
        for domain, meta in REFERENCE_FIELD_METADATA.items()
    }


def apply_reference_overrides(
    reference_domains: dict[str, list[dict[str, Any]]],
    overrides: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    resolved = copy.deepcopy(reference_domains)
    records_by_key = {
        (domain, record["id"]): record
        for domain, records in resolved.items()
        for record in records
    }
    allowed_fields = editable_reference_fields()
    researchable_fields = researchable_reference_fields()

    for override in overrides:
        domain = override.get("domain")
        record_id = override.get("recordId")
        field = override.get("field")
        domain_allowed_fields = allowed_fields.get(domain, set()) | researchable_fields.get(domain, set())
        if field not in domain_allowed_fields:
            continue
        record = records_by_key.get((domain, record_id))
        if not record:
            continue
        baseline_values = record.setdefault("baselineValues", {})
        baseline_values.setdefault(field, record.get(field))
        active_overrides = record.setdefault("activeOverrides", {})
        record[field] = override.get("value")
        active_overrides[field] = override.get("value")
    return resolved


def build_compatibility_reference_tables(reference_domains: dict[str, list[dict[str, Any]]]) -> dict[str, list[dict[str, Any]]]:
    locations = {item["id"]: item for item in reference_domains.get("locations", [])}
    cost_profiles = {item["id"]: item for item in reference_domains.get("location_cost_profiles", [])}
    tax_profiles = {item["id"]: item for item in reference_domains.get("tax_profiles", [])}
    health_profiles = {item["id"]: item for item in reference_domains.get("healthcare_profiles", [])}
    gi_bill_benefits = {item["id"]: item for item in reference_domains.get("gi_bill_benefits", [])}

    phd_programs: list[dict[str, Any]] = []
    for program in reference_domains.get("programs", []):
        tax_profile = tax_profiles.get(program.get("taxProfileId"), {})
        health_profile = health_profiles.get(program.get("healthcareProfileId"), {})
        gi_bill = gi_bill_benefits.get(program.get("giBillBenefitId"), {})
        location = locations.get(program.get("locationId"), {})
        cost_profile = cost_profiles.get(location.get("costProfileId"), {})
        phd_programs.append(
            {
                "id": program["id"],
                "label": program["label"],
                "location": program.get("locationLabel") or location.get("label", ""),
                "stateTaxRate": tax_profile.get("stateRate", 0.0),
                "durationYears": int(program.get("durationYears", 5) or 5),
                "stipendAnnual": program.get("stipendAnnual", 0.0),
                "giBillBahMonthly": gi_bill.get("monthlyHousingAllowance", 0.0),
                "universityHealthCovered": health_profile.get("annualCost", 0.0) == 0.0,
                "estimatedRentMonthly": cost_profile.get("estimatedRentMonthly", program.get("estimatedRentMonthly", 0.0)),
                "applicationFee": program.get("applicationFeeUsd", 0.0),
            }
        )

    military_rows = reference_domains.get("military_pay_rates", [])
    investment_destinations = [record for record in reference_domains.get("investment_policies", []) if record.get("recordType") == "destination"]
    career_rows = reference_domains.get("career_comp_profiles", [])

    return {
        "tech_companies": [
            {
                "id": row["id"],
                "label": row["label"],
                "baseSalary": row["baseSalary"],
                "bonusPct": row["bonusPct"],
                "annualRsu": row["annualRsu"],
                "growthRate": row["growthRate"],
            }
            for row in career_rows
            if row.get("profileType") == "tech_company"
        ],
        "research_employers": [
            {
                "id": row["id"],
                "label": row["label"],
                "baseSalary": row["baseSalary"],
                "bonusPct": row["bonusPct"],
                "annualRsu": row["annualRsu"],
                "growthRate": row["growthRate"],
            }
            for row in career_rows
            if row.get("profileType") == "research_employer"
        ],
        "va_disability": [
            {"id": row["id"], "label": row["label"], "monthly": row["monthly"], "annual": row["annual"]}
            for row in reference_domains.get("va_disability", [])
        ],
        "phd_programs": phd_programs,
        "military_base_pay_rates": [
            {
                "id": row["id"],
                "label": row["label"],
                "effectiveDate": row["effectiveStart"],
                "serviceBranch": row["serviceBranch"],
                "payGrade": row["payGrade"],
                "yearsOfService": row["yearsOfService"],
                "dependencyStatus": row["dependencyStatus"],
                "dutyLocation": locations.get(row.get("locationId"), {}).get("label", ""),
                "monthlyRate": row["monthlyRate"],
                "annualizedRate": row["annualizedRate"],
                "notes": row["notes"],
                "sourceLabel": row["sourceLabel"],
                "sourceUrl": row["sourceUrl"],
                "isDefault": row.get("effectiveEnd") is None,
            }
            for row in military_rows
            if row.get("component") == "base_pay"
        ],
        "military_bah_rates": [
            {
                "id": row["id"],
                "label": row["label"],
                "effectiveDate": row["effectiveStart"],
                "serviceBranch": row["serviceBranch"],
                "payGrade": row["payGrade"],
                "yearsOfService": row["yearsOfService"],
                "dependencyStatus": row["dependencyStatus"],
                "dutyLocation": locations.get(row.get("locationId"), {}).get("label", ""),
                "monthlyRate": row["monthlyRate"],
                "annualizedRate": row["annualizedRate"],
                "notes": row["notes"],
                "sourceLabel": row["sourceLabel"],
                "sourceUrl": row["sourceUrl"],
                "isDefault": row.get("effectiveEnd") is None,
            }
            for row in military_rows
            if row.get("component") == "bah"
        ],
        "military_bas_rates": [
            {
                "id": row["id"],
                "label": row["label"],
                "effectiveDate": row["effectiveStart"],
                "serviceBranch": row["serviceBranch"],
                "payGrade": row["payGrade"],
                "yearsOfService": row["yearsOfService"],
                "dependencyStatus": row["dependencyStatus"],
                "dutyLocation": locations.get(row.get("locationId"), {}).get("label", ""),
                "monthlyRate": row["monthlyRate"],
                "annualizedRate": row["annualizedRate"],
                "notes": row["notes"],
                "sourceLabel": row["sourceLabel"],
                "sourceUrl": row["sourceUrl"],
                "isDefault": row.get("effectiveEnd") is None,
            }
            for row in military_rows
            if row.get("component") == "bas"
        ],
        "investment_destinations": [
            {
                "id": row["id"],
                "label": row["label"],
                "accountType": row["accountType"],
                "taxTreatment": row["taxTreatment"],
                "contributionType": row["contributionType"],
                "defaultUse": row["notes"],
                "notes": row["notes"],
            }
            for row in investment_destinations
        ],
    }


REFERENCE_DOMAINS = build_reference_domains()
