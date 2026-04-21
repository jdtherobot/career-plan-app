from __future__ import annotations

from typing import Any

from .database import coerce_legacy_path_template_id
from .manual_finance import flatten_manual_finance_group
from .models import YearProjection
from .reference_data import REFERENCE_DOMAINS, hydrate_military_reference_domains


def _ref_lookup(reference_tables: dict[str, list[dict[str, Any]]], category: str, item_id: str | None) -> dict[str, Any] | None:
    if not item_id:
        return None
    for item in reference_tables.get(category, []):
        if item["id"] == item_id:
            return item
    return None


def _domain_lookup(reference_domains: dict[str, list[dict[str, Any]]], domain: str, item_id: str | None) -> dict[str, Any] | None:
    if not item_id:
        return None
    for item in reference_domains.get(domain, []):
        if item["id"] == item_id:
            return item
    return None


def _domain_find(reference_domains: dict[str, list[dict[str, Any]]], domain: str, predicate) -> dict[str, Any] | None:
    for item in reference_domains.get(domain, []):
        if predicate(item):
            return item
    return None


def _military_schedule_row(reference_domains: dict[str, list[dict[str, Any]]], calendar_year: int) -> dict[str, Any] | None:
    return _domain_find(
        reference_domains,
        "military_compensation_projection_view",
        lambda item: int(item.get("calendarYear", -1) or -1) == calendar_year,
    )


def _latest_enabled_promotion(reference_domains: dict[str, list[dict[str, Any]]], calendar_year: int) -> dict[str, Any] | None:
    eligible = [
        item
        for item in reference_domains.get("military_promotion_schedule", [])
        if float(item.get("enabledFlag", 0) or 0) >= 0.5 and int(item.get("promotionYear", 0) or 0) <= calendar_year
    ]
    if not eligible:
        return None
    return sorted(eligible, key=lambda item: (int(item.get("promotionYear", 0) or 0), int(item.get("slotOrder", 0) or 0)))[-1]


def _reference_target(domain: str, item_id: str | None) -> str | None:
    if not item_id:
        return None
    return f"reference-{domain}-{item_id}"


def _value(base: float, growth: float, years: int) -> float:
    return base * ((1 + growth) ** years)


def _round(value: float) -> float:
    return round(value, 2)


def _manual_lookup(items: list[dict[str, Any]], item_id: str) -> dict[str, Any] | None:
    for item in items:
        if item.get("id") == item_id:
            return item
    return None


def _manual_assets_total(items: list[dict[str, Any]]) -> float:
    excluded_ids = {"vehicles_motorcycles_boats", "asset_vehicle"}
    return sum(float(item.get("amount", 0)) for item in items if item.get("id") not in excluded_ids)


def _manual_asset_amount(items: list[dict[str, Any]], item_id: str) -> float:
    item = _manual_lookup(items, item_id)
    return float(item.get("amount", 0)) if item else 0.0


def _manual_asset_amount_any(items: list[dict[str, Any]], item_ids: list[str]) -> float:
    for item_id in item_ids:
        amount = _manual_asset_amount(items, item_id)
        if amount:
            return amount
    return 0.0


def _build_source_ref(
    source_type: str,
    label: str,
    *,
    screen: str | None = None,
    target_id: str | None = None,
    description: str | None = None,
    navigable: bool = True,
) -> dict[str, Any]:
    return {
        "type": source_type,
        "label": label,
        "screen": screen,
        "targetId": target_id,
        "description": description or "",
        "navigable": navigable and bool(screen and target_id),
    }


def dedupe_source_refs(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for item in items:
        key = f"{item.get('screen', '')}|{item.get('targetId', '')}|{item.get('label', '')}"
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def _category_field_map() -> dict[str, str]:
    return {
        "housing": "housing",
        "utilities": "utilities",
        "transportation": "transportation",
        "food": "food",
        "insurance": "insurance",
        "healthcare": "healthcareOutOfPocket",
        "personal": "personal",
        "entertainment": "entertainment",
        "gifts": "gifts",
        "miscellaneous": "miscellaneous",
    }


def _empty_expense_breakdown() -> dict[str, float]:
    return {
        "housing": 0.0,
        "utilities": 0.0,
        "transportation": 0.0,
        "food": 0.0,
        "insurance": 0.0,
        "healthcareOutOfPocket": 0.0,
        "personal": 0.0,
        "entertainment": 0.0,
        "gifts": 0.0,
        "miscellaneous": 0.0,
    }


def _build_two_layer_expense_breakdown(
    expense_items: list[dict[str, Any]],
    location_cost_profile: dict[str, Any] | None,
    annual_growth_rate: float,
    year_index: int,
    override_total_monthly: float | None,
) -> dict[str, float]:
    breakdown_monthly = _empty_expense_breakdown()
    category_key_map = _category_field_map()

    for item in expense_items:
        key = category_key_map.get(item.get("category") or item.get("sectionId"), "miscellaneous")
        breakdown_monthly[key] += float(item.get("amountMonthly", 0))

    if location_cost_profile:
        breakdown_monthly["housing"] += float(location_cost_profile.get("housingMonthly", 0))
        breakdown_monthly["utilities"] += float(location_cost_profile.get("utilitiesMonthly", 0))
        breakdown_monthly["transportation"] += float(location_cost_profile.get("transportationMonthly", 0))
        breakdown_monthly["food"] += float(location_cost_profile.get("foodMonthly", 0))
        breakdown_monthly["insurance"] += float(location_cost_profile.get("insuranceMonthly", 0))
        breakdown_monthly["healthcareOutOfPocket"] += float(location_cost_profile.get("healthcareOutOfPocketMonthly", 0))
        breakdown_monthly["personal"] += float(location_cost_profile.get("personalMonthly", 0))
        breakdown_monthly["entertainment"] += float(location_cost_profile.get("entertainmentMonthly", 0))
        breakdown_monthly["gifts"] += float(location_cost_profile.get("giftsMonthly", 0))
        breakdown_monthly["miscellaneous"] += float(location_cost_profile.get("miscellaneousMonthly", 0))

    total_monthly = sum(breakdown_monthly.values()) or 1.0
    scale = (override_total_monthly / total_monthly) if override_total_monthly is not None else 1.0
    return {
        key: _value(amount * scale * 12, annual_growth_rate, year_index)
        for key, amount in breakdown_monthly.items()
    }


def _build_formula_meta(
    gross_income: float,
    tax_free_income: float,
    taxes_paid: float,
    healthcare_cost: float,
    living_expenses: float,
    retirement_savings: float,
    net_cash_flow: float,
    portfolio: float,
    prior_portfolio: float,
    investment_growth: float,
    positive_surplus_invested: float,
    income_breakdown: dict[str, float],
    tax_breakdown: dict[str, float],
    expense_breakdown: dict[str, float],
    savings_breakdown: dict[str, float],
    investment_breakdown: dict[str, Any],
    portfolio_breakdown: dict[str, Any],
) -> dict[str, Any]:
    income_components = [
        ("Base Pay", income_breakdown["militaryBasePay"]),
        ("Pension", income_breakdown["pension"]),
        ("Civilian Salary", income_breakdown["salaryBase"]),
        ("Grad School Stipend", income_breakdown["phdStipend"]),
    ]
    tax_free_components = [
        ("BAH", income_breakdown["militaryBah"]),
        ("BAS", income_breakdown["militaryBas"]),
        ("VA Compensation", income_breakdown["vaCompensation"]),
        ("GI Bill MHA", income_breakdown["giBillHousing"]),
        ("GI Bill Books & Supplies", income_breakdown["giBillBooks"]),
    ]
    return {
        "grossIncome": {
            "title": "Gross Income",
            "value": gross_income,
            "expression": "Gross Income = sum of taxable compensation components",
            "lines": [{"label": label, "value": value} for label, value in income_components if value],
        },
        "taxFreeIncome": {
            "title": "Tax-Free Income",
            "value": tax_free_income,
            "expression": "Tax-Free Income = sum of tax-free compensation components",
            "lines": [{"label": label, "value": value} for label, value in tax_free_components if value],
        },
        "totalIncome": {
            "title": "Total Income",
            "value": gross_income + tax_free_income,
            "expression": "Total Income = Gross Income + Tax-Free Income",
            "lines": [
                {"label": "Gross Income", "value": gross_income},
                {"label": "Tax-Free Income", "value": tax_free_income},
            ],
        },
        "livingExpenses": {
            "title": "Living Expenses",
            "value": living_expenses,
            "expression": "Living Expenses = Manual Finance carryover + location cost defaults, scaled by annual growth",
            "lines": [
                {"label": "Housing", "value": expense_breakdown["housing"]},
                {"label": "Utilities", "value": expense_breakdown["utilities"]},
                {"label": "Transportation", "value": expense_breakdown["transportation"]},
                {"label": "Food", "value": expense_breakdown["food"]},
                {"label": "Insurance", "value": expense_breakdown["insurance"]},
                {"label": "Healthcare Out-of-Pocket", "value": expense_breakdown["healthcareOutOfPocket"]},
                {"label": "Personal", "value": expense_breakdown["personal"]},
                {"label": "Entertainment", "value": expense_breakdown["entertainment"]},
                {"label": "Gifts", "value": expense_breakdown["gifts"]},
                {"label": "Miscellaneous", "value": expense_breakdown["miscellaneous"]},
            ],
        },
        "taxes": {
            "title": "Taxes",
            "value": taxes_paid,
            "expression": "Total Taxes = Federal Tax + State Tax",
            "lines": [
                {"label": "Federal Tax", "value": tax_breakdown["federalTax"]},
                {"label": "State Tax", "value": tax_breakdown["stateTax"]},
            ],
        },
        "retirementSavings": {
            "title": "Retirement Contributions",
            "value": retirement_savings,
            "expression": "Retirement Contributions = policy-based annual contribution for the active phase",
            "lines": [{"label": "Retirement Contributions", "value": retirement_savings}],
        },
        "positiveSurplusInvested": {
            "title": "Taxable Contributions",
            "value": positive_surplus_invested,
            "expression": "Taxable Contributions = max(Net Cash Flow, 0) × surplus investment rate",
            "lines": [
                {"label": "Positive Net Cash Flow", "value": max(net_cash_flow, 0.0)},
                {"label": "Taxable Contributions", "value": positive_surplus_invested},
            ],
        },
        "totalContributions": {
            "title": "Total Contributions",
            "value": investment_breakdown["contributions"]["totalContributions"],
            "expression": "Total Contributions = Retirement Contributions + Taxable Contributions",
            "lines": [
                {"label": "Retirement Contributions", "value": investment_breakdown["contributions"]["retirementContributions"]},
                {"label": "Taxable Contributions", "value": investment_breakdown["contributions"]["taxableContributions"]},
            ],
        },
        "portfolioGrowth": {
            "title": "Portfolio Growth",
            "value": investment_growth,
            "expression": "Portfolio Growth = Prior Portfolio × assumed return rate",
            "lines": [
                {"label": "Prior Portfolio", "value": prior_portfolio},
                {"label": "Assumed Return Rate", "value": investment_breakdown["growth"]["assumedReturnRate"], "kind": "percent"},
                {"label": "Portfolio Growth", "value": investment_growth},
            ],
        },
        "netCashFlow": {
            "title": "Net Cash Flow",
            "value": net_cash_flow,
            "expression": "Net Cash Flow = Total Income - Taxes - Healthcare - Living Expenses - Investment Contributions",
            "lines": [
                {"label": "Total Income", "value": gross_income + tax_free_income},
                {"label": "Taxes", "value": -taxes_paid},
                {"label": "Healthcare", "value": -healthcare_cost},
                {"label": "Living Expenses", "value": -living_expenses},
                {"label": "Retirement Contributions", "value": -retirement_savings},
            ],
        },
        "portfolio": {
            "title": "Portfolio",
            "value": portfolio,
            "expression": "Portfolio = Prior Portfolio + Portfolio Growth + Retirement Contributions + Taxable Contributions",
            "lines": [
                {"label": "Prior Portfolio", "value": prior_portfolio},
                {"label": "Portfolio Growth", "value": investment_growth},
                {"label": "Retirement Contributions", "value": savings_breakdown["retirementSavings"]},
                {"label": "Taxable Contributions", "value": savings_breakdown["surplusInvested"]},
            ],
        },
        "investedPortfolio": {
            "title": "Invested Portfolio",
            "value": portfolio_breakdown["summary"]["investedPortfolio"],
            "expression": "Invested Portfolio = Total Investable Assets - Cash Reserve",
            "lines": [
                {"label": "Total Investable Assets", "value": portfolio_breakdown["summary"]["totalInvestableAssets"]},
                {"label": "Cash Reserve", "value": -portfolio_breakdown["accounts"]["cashReserve"]},
            ],
        },
        "totalInvestableAssets": {
            "title": "Total Investable Assets",
            "value": portfolio_breakdown["summary"]["totalInvestableAssets"],
            "expression": "Total Investable Assets = Invested Portfolio + Cash Reserve",
            "lines": [
                {"label": "Invested Portfolio", "value": portfolio_breakdown["summary"]["investedPortfolio"]},
                {"label": "Cash Reserve", "value": portfolio_breakdown["accounts"]["cashReserve"]},
            ],
        },
    }


def _timeline_defaults(reference_domains: dict[str, list[dict[str, Any]]], path_id: str) -> dict[str, Any]:
    return _domain_find(reference_domains, "path_timeline_defaults", lambda item: item.get("pathId") == path_id) or {}


def _benefit_rule(reference_domains: dict[str, list[dict[str, Any]]], rule_id: str) -> dict[str, Any]:
    return _domain_lookup(reference_domains, "benefit_rules", rule_id) or {}


def _retirement_policy(reference_domains: dict[str, list[dict[str, Any]]], policy_id: str) -> dict[str, Any]:
    return _domain_lookup(reference_domains, "investment_policies", policy_id) or {}


def _destination_policy(reference_domains: dict[str, list[dict[str, Any]]], destination_id: str | None) -> dict[str, Any] | None:
    return _domain_lookup(reference_domains, "investment_policies", destination_id)


def _resolve_location_id(
    timeline: dict[str, Any],
    phase_id: str,
    effective_date: str,
    program: dict[str, Any] | None,
) -> str | None:
    location_plan = timeline.get("locationPlan", [])
    matching = [
        item
        for item in location_plan
        if item.get("phaseId") == phase_id and item.get("effectiveStart", "") <= effective_date
    ]
    if matching:
        selected = sorted(matching, key=lambda item: item.get("effectiveStart", ""))[-1]
        if selected.get("locationStrategy") == "selected_program":
            return program.get("locationId") if program else None
        return selected.get("locationId")
    return program.get("locationId") if program and phase_id in {"retired_phd", "phd_only"} else timeline.get("defaultResearchLocationId")


def _resolve_tax_profile(reference_domains: dict[str, list[dict[str, Any]]], profile_id: str) -> dict[str, Any]:
    return _domain_lookup(reference_domains, "tax_profiles", profile_id) or {}


def _resolve_healthcare_profile(reference_domains: dict[str, list[dict[str, Any]]], profile_id: str) -> dict[str, Any]:
    return _domain_lookup(reference_domains, "healthcare_profiles", profile_id) or {}


def _resolve_gi_bill_benefit(reference_domains: dict[str, list[dict[str, Any]]], program: dict[str, Any] | None) -> dict[str, Any] | None:
    if not program:
        return None
    return _domain_lookup(reference_domains, "gi_bill_benefits", program.get("giBillBenefitId"))


def _resolve_cost_profile(reference_domains: dict[str, list[dict[str, Any]]], location_id: str | None) -> dict[str, Any] | None:
    location = _domain_lookup(reference_domains, "locations", location_id)
    if not location:
        return None
    return _domain_lookup(reference_domains, "location_cost_profiles", location.get("costProfileId"))


def _resolve_career_profile(reference_tables: dict[str, list[dict[str, Any]]], scenario: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    company = _ref_lookup(reference_tables, "tech_companies", scenario.get("selectedCompanyId"))
    employer = _ref_lookup(reference_tables, "research_employers", scenario.get("selectedEmployerId"))
    return company, employer


def _program_duration_years(program: dict[str, Any] | None, reference_tables: dict[str, list[dict[str, Any]]], scenario: dict[str, Any]) -> int:
    if program and program.get("durationYears") not in ("", None):
        return int(program.get("durationYears", 5) or 5)
    program_table = _ref_lookup(reference_tables, "phd_programs", scenario.get("selectedPhdProgramId"))
    return int(program_table.get("durationYears", 5) or 5) if program_table else 5


def _resolved_timeline_blocks(
    path_timeline: dict[str, Any],
    planner_profile: dict[str, Any],
    program_duration_years: int,
) -> list[dict[str, Any]]:
    horizon_year = int(planner_profile.get("projectionEndYear", 2076))
    raw_blocks = list(path_timeline.get("blocks") or [])
    resolved = []
    valid_starts = []
    for block in raw_blocks:
        start_year = block.get("startYear")
        if isinstance(start_year, int):
            valid_starts.append(start_year)
        else:
            try:
                valid_starts.append(int(start_year))
            except (TypeError, ValueError):
                valid_starts.append(None)

    for index, block in enumerate(raw_blocks):
        start_year = valid_starts[index]
        if start_year is None:
            continue
        next_start_year = next((year for year in valid_starts[index + 1 :] if isinstance(year, int)), None)
        block_type = block.get("type")
        if block_type == "grad_school":
            end_year = start_year + program_duration_years - 1
        elif block_type == "retire":
            end_year = horizon_year
        else:
            end_year = (next_start_year - 1) if isinstance(next_start_year, int) else horizon_year
        resolved.append(
            {
                "id": block.get("id") or f"timeline_block_{index + 1}",
                "type": block_type,
                "startYear": start_year,
                "endYear": min(end_year, horizon_year),
            }
        )
    return resolved


def _location_timeline_for_scenario(
    reference_domains: dict[str, list[dict[str, Any]]],
    scenario: dict[str, Any],
    service_exit_type: str | None,
) -> dict[str, Any]:
    path_id = scenario.get("pathTemplateId")
    if path_id in {"PATH_A", "PATH_B", "PATH_C"}:
        timeline = _timeline_defaults(reference_domains, path_id)
        if timeline:
            return timeline
    fallback_path_id = "PATH_A" if service_exit_type == "military_retirement" else "PATH_C"
    return _timeline_defaults(reference_domains, fallback_path_id)


def _legacy_year_state(path_id: str, year_index: int, timeline: dict[str, Any]) -> dict[str, Any]:
    phase_id, phase_label = determine_phase(path_id, year_index, timeline)
    if phase_id == "active_duty":
        return {
            "phaseId": phase_id,
            "phaseLabel": phase_label,
            "serviceStatus": "active_duty",
            "activityType": "active_duty",
            "yearsSinceRetirement": 0,
            "yearsInActivity": 0,
        }
    if phase_id == "retirement_transition":
        return {
            "phaseId": phase_id,
            "phaseLabel": phase_label,
            "serviceStatus": "military_retired",
            "activityType": "retirement_transition",
            "yearsSinceRetirement": 0,
            "yearsInActivity": 0,
        }
    if phase_id == "retired_phd":
        transition_year = int(timeline.get("retirementTransitionYearIndex", 8))
        return {
            "phaseId": phase_id,
            "phaseLabel": phase_label,
            "serviceStatus": "military_retired",
            "activityType": "grad_school",
            "yearsSinceRetirement": max(year_index - transition_year, 0),
            "yearsInActivity": max(year_index - (transition_year + 1), 0),
        }
    if phase_id == "retired_research":
        transition_year = int(timeline.get("retirementTransitionYearIndex", 8))
        phd_end = int(timeline.get("phdEndYearIndex", 13))
        return {
            "phaseId": phase_id,
            "phaseLabel": phase_label,
            "serviceStatus": "military_retired",
            "activityType": "research_career",
            "yearsSinceRetirement": max(year_index - transition_year, 0),
            "yearsInActivity": max(year_index - (phd_end + 1), 0),
        }
    if phase_id == "tech_career":
        active_end = int(timeline.get("activeDutyEndYearIndex", 1))
        return {
            "phaseId": phase_id,
            "phaseLabel": phase_label,
            "serviceStatus": "separated",
            "activityType": "tech_career",
            "yearsSinceRetirement": 0,
            "yearsInActivity": max(year_index - (active_end + 1), 0),
        }
    if phase_id == "phd_only":
        gap_year = int(timeline.get("gapYearIndex", 2))
        return {
            "phaseId": phase_id,
            "phaseLabel": phase_label,
            "serviceStatus": "separated",
            "activityType": "grad_school",
            "yearsSinceRetirement": 0,
            "yearsInActivity": max(year_index - (gap_year + 1), 0),
        }
    if phase_id == "research_only":
        phd_end = int(timeline.get("phdEndYearIndex", 7))
        return {
            "phaseId": phase_id,
            "phaseLabel": phase_label,
            "serviceStatus": "separated",
            "activityType": "research_career",
            "yearsSinceRetirement": 0,
            "yearsInActivity": max(year_index - (phd_end + 1), 0),
        }
    gap_year = int(timeline.get("gapYearIndex", 2))
    return {
        "phaseId": phase_id,
        "phaseLabel": phase_label,
        "serviceStatus": "separated",
        "activityType": "gap",
        "yearsSinceRetirement": 0,
        "yearsInActivity": max(year_index - gap_year, 0),
    }


def _resolve_year_state(
    path_timeline: dict[str, Any],
    planner_profile: dict[str, Any],
    calendar_year: int,
    program_duration_years: int,
) -> dict[str, Any]:
    service_exit = path_timeline.get("serviceExit") or {}
    service_exit_type = service_exit.get("type")
    service_exit_year = service_exit.get("year")
    resolved_blocks = _resolved_timeline_blocks(path_timeline, planner_profile, program_duration_years)

    if service_exit_type not in {"military_retirement", "separation"} or not isinstance(service_exit_year, int):
        return {
            "phaseId": "gap_year",
            "phaseLabel": "Route Incomplete",
            "serviceStatus": "inactive",
            "activityType": "gap",
            "yearsSinceRetirement": 0,
            "yearsInActivity": 0,
            "block": None,
            "resolvedBlocks": resolved_blocks,
        }

    if service_exit_type == "separation":
        if calendar_year <= service_exit_year:
            return {
                "phaseId": "active_duty",
                "phaseLabel": "Active Duty",
                "serviceStatus": "active_duty",
                "activityType": "active_duty",
                "yearsSinceRetirement": 0,
                "yearsInActivity": 0,
                "block": None,
                "resolvedBlocks": resolved_blocks,
            }
    else:
        if calendar_year < service_exit_year:
            return {
                "phaseId": "active_duty",
                "phaseLabel": "Active Duty",
                "serviceStatus": "active_duty",
                "activityType": "active_duty",
                "yearsSinceRetirement": 0,
                "yearsInActivity": 0,
                "block": None,
                "resolvedBlocks": resolved_blocks,
            }
        if calendar_year == service_exit_year:
            return {
                "phaseId": "retirement_transition",
                "phaseLabel": "Retirement Transition",
                "serviceStatus": "military_retired",
                "activityType": "retirement_transition",
                "yearsSinceRetirement": 0,
                "yearsInActivity": 0,
                "block": None,
                "resolvedBlocks": resolved_blocks,
            }

    service_status = "military_retired" if service_exit_type == "military_retirement" else "separated"
    active_block = next(
        (block for block in resolved_blocks if block["startYear"] <= calendar_year <= block["endYear"]),
        None,
    )
    years_since_retirement = max(calendar_year - service_exit_year, 0) if service_status == "military_retired" else 0

    if active_block:
        block_type = active_block["type"]
        years_in_activity = max(calendar_year - active_block["startYear"], 0)
        if block_type == "grad_school":
            return {
                "phaseId": "retired_phd" if service_status == "military_retired" else "phd_only",
                "phaseLabel": "Retired + Grad School" if service_status == "military_retired" else "Grad School",
                "serviceStatus": service_status,
                "activityType": "grad_school",
                "yearsSinceRetirement": years_since_retirement,
                "yearsInActivity": years_in_activity,
                "block": active_block,
                "resolvedBlocks": resolved_blocks,
            }
        if block_type == "tech_career":
            return {
                "phaseId": "tech_career",
                "phaseLabel": "Retired + Tech Career" if service_status == "military_retired" else "Tech Career",
                "serviceStatus": service_status,
                "activityType": "tech_career",
                "yearsSinceRetirement": years_since_retirement,
                "yearsInActivity": years_in_activity,
                "block": active_block,
                "resolvedBlocks": resolved_blocks,
            }
        if block_type == "research_career":
            return {
                "phaseId": "retired_research" if service_status == "military_retired" else "research_only",
                "phaseLabel": "Retired + Research Career" if service_status == "military_retired" else "Research Career",
                "serviceStatus": service_status,
                "activityType": "research_career",
                "yearsSinceRetirement": years_since_retirement,
                "yearsInActivity": years_in_activity,
                "block": active_block,
                "resolvedBlocks": resolved_blocks,
            }
        return {
            "phaseId": "gap_year",
            "phaseLabel": "Retired",
            "serviceStatus": service_status,
            "activityType": "retire",
            "yearsSinceRetirement": years_since_retirement,
            "yearsInActivity": years_in_activity,
            "block": active_block,
            "resolvedBlocks": resolved_blocks,
        }

    gap_start_year = service_exit_year + 1
    for block in resolved_blocks:
        if block["startYear"] > calendar_year:
            break
        gap_start_year = block["endYear"] + 1

    return {
        "phaseId": "gap_year",
        "phaseLabel": "Retired Gap" if service_status == "military_retired" else "Gap Year",
        "serviceStatus": service_status,
        "activityType": "gap",
        "yearsSinceRetirement": years_since_retirement,
        "yearsInActivity": max(calendar_year - gap_start_year, 0),
        "block": None,
        "resolvedBlocks": resolved_blocks,
    }


def _resolve_phase_profiles(
    reference_domains: dict[str, list[dict[str, Any]]],
    phase_id: str,
    scenario: dict[str, Any],
    program: dict[str, Any] | None,
    location_id: str | None,
    service_status: str | None = None,
    activity_type: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    if phase_id == "active_duty":
        return (
            _resolve_tax_profile(reference_domains, "active_duty_default"),
            _resolve_healthcare_profile(reference_domains, "active_duty_covered"),
            _retirement_policy(reference_domains, "military_retirement_contribution"),
        )
    if phase_id == "retirement_transition":
        return (
            _resolve_tax_profile(reference_domains, "retirement_transition_default"),
            _resolve_healthcare_profile(reference_domains, "tricare_select_retiree"),
            _retirement_policy(reference_domains, "phd_retirement_contribution"),
        )
    if phase_id in {"retired_phd", "phd_only"}:
        return (
            _resolve_tax_profile(reference_domains, program.get("taxProfileId") if program else "phd_ca"),
            _resolve_healthcare_profile(reference_domains, program.get("healthcareProfileId") if program else "university_funded_healthcare"),
            _retirement_policy(reference_domains, "phd_retirement_contribution"),
        )
    if phase_id == "gap_year":
        if service_status == "military_retired":
            return (
                _resolve_tax_profile(reference_domains, "retirement_transition_default"),
                _resolve_healthcare_profile(reference_domains, "tricare_select_retiree"),
                _retirement_policy(reference_domains, "phd_retirement_contribution"),
            )
        return (
            {"id": "gap_year_tax_free", "label": "Gap year tax-free profile", "federalRate": 0.0, "stateRate": 0.0},
            _resolve_healthcare_profile(reference_domains, "marketplace_gap_year"),
            _retirement_policy(reference_domains, "phd_retirement_contribution"),
        )
    if phase_id == "tech_career":
        threshold = _benefit_rule(reference_domains, "high_income_salary_threshold").get("valueNumber", 200000)
        default_profile_id = "civilian_mid_default_ca"
        return (
            _resolve_tax_profile(reference_domains, default_profile_id if scenario.get("_salaryForTax", 0.0) < threshold else "civilian_high_default"),
            _resolve_healthcare_profile(reference_domains, "tricare_select_retiree" if service_status == "military_retired" else "civilian_employer_plan"),
            _retirement_policy(reference_domains, "civilian_retirement_contribution"),
        )
    return (
        _resolve_tax_profile(reference_domains, "civilian_high_default"),
        _resolve_healthcare_profile(reference_domains, "tricare_select_retiree" if phase_id == "retired_research" else "civilian_employer_plan"),
        _retirement_policy(reference_domains, "civilian_retirement_contribution"),
    )


def project_scenario(
    scenario: dict[str, Any],
    planner_profile: dict[str, Any],
    reference_tables: dict[str, list[dict[str, Any]]],
    manual_inputs: dict[str, list[dict[str, Any]]],
    reference_domains: dict[str, list[dict[str, Any]]] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    reference_domains = hydrate_military_reference_domains(reference_domains or REFERENCE_DOMAINS, planner_profile)
    path_id = coerce_legacy_path_template_id(scenario.get("pathTemplateId"), scenario.get("pathTimeline"), scenario)
    scenario = {**scenario, "pathTemplateId": path_id}
    projection_years = planner_profile["projectionYears"]
    base_year = planner_profile["baseYear"]
    start_age = planner_profile["startAge"]

    expense_inputs = flatten_manual_finance_group(manual_inputs.get("expenses", []))
    asset_inputs = flatten_manual_finance_group(manual_inputs.get("assets", []))
    override_living_monthly = scenario.get("overrides", {}).get("monthlyLivingExpenses")
    starting_portfolio = scenario.get("overrides", {}).get("startingPortfolio", _manual_assets_total(asset_inputs))
    pension_profile = _domain_lookup(reference_domains, "pension_profiles", "high_3_path_a") or {}
    va = _domain_lookup(reference_domains, "va_disability", scenario.get("selectedVaRatingId"))
    va_cola_rate = float(_benefit_rule(reference_domains, "va_cola").get("valuePercent", 0.028))
    growth_policy = _retirement_policy(reference_domains, "portfolio_growth_core")
    timeline = _timeline_defaults(reference_domains, path_id)

    company, employer = _resolve_career_profile(reference_tables, scenario)
    program = _domain_lookup(reference_domains, "programs", scenario.get("selectedPhdProgramId"))
    program_duration_years = _program_duration_years(program, reference_tables, scenario)
    gi_bill_benefit = _resolve_gi_bill_benefit(reference_domains, program)

    starting_tsp = _manual_asset_amount_any(asset_inputs, ["asset_tsp", "tsp"])
    starting_roth_ira = _manual_asset_amount_any(asset_inputs, ["asset_roth_ira", "ira_pensions"])
    starting_brokerage = _manual_asset_amount_any(asset_inputs, ["asset_brokerage", "stocks_bonds"])
    starting_cash_reserve = (
        _manual_asset_amount_any(asset_inputs, ["asset_checking", "checking_accounts"])
        + _manual_asset_amount_any(asset_inputs, ["asset_savings", "savings_accounts"])
    )

    yearly_rows: list[YearProjection] = []
    prior_portfolio = starting_portfolio
    total_gross = 0.0
    total_tax_free = 0.0
    total_taxes = 0.0
    total_healthcare = 0.0
    total_net_cash_flow = 0.0

    for year_index in range(projection_years):
        calendar_year = base_year + year_index
        age = start_age + year_index
        year_state = _legacy_year_state(path_id, year_index, timeline)
        phase_id = year_state["phaseId"]
        phase_label = year_state["phaseLabel"]
        service_status = year_state["serviceStatus"]
        activity_type = year_state["activityType"]
        years_since_retirement = int(year_state.get("yearsSinceRetirement", 0) or 0)
        years_in_activity = int(year_state.get("yearsInActivity", 0) or 0)
        effective_date = f"{calendar_year}-12-31"
        location_id = _resolve_location_id(timeline, phase_id, effective_date, program)
        location_cost_profile = _resolve_cost_profile(reference_domains, location_id)
        expense_growth = float(location_cost_profile.get("annualGrowthRate", _benefit_rule(reference_domains, "living_expense_growth_default").get("valuePercent", 0.03))) if location_cost_profile else float(_benefit_rule(reference_domains, "living_expense_growth_default").get("valuePercent", 0.03))

        gross_income = 0.0
        tax_free_income = 0.0
        healthcare_cost = 0.0
        retirement_savings = 0.0
        income_breakdown = {
            "salary": {
                "basePay": 0.0,
                "bah": 0.0,
                "bas": 0.0,
                "pension": 0.0,
                "civilianBase": 0.0,
                "other": 0.0,
            },
            "va": {"compensation": 0.0},
            "giBill": {"mha": 0.0, "booksSupplies": 0.0, "other": 0.0},
            "gradSchool": {"stipend": 0.0, "other": 0.0},
            "military": {
                "projectedPayGrade": "—",
                "yearsOfService": 0,
                "raisePercent": 0.0,
                "totalComp": 0.0,
            },
            "militaryBasePay": 0.0,
            "militaryBah": 0.0,
            "militaryBas": 0.0,
            "pension": 0.0,
            "salaryBase": 0.0,
            "phdStipend": 0.0,
            "vaCompensation": 0.0,
            "giBillHousing": 0.0,
            "giBillBooks": 0.0,
            "bonusPlaceholder": 0.0,
            "rsuPlaceholder": 0.0,
            "grossIncomeTotal": 0.0,
            "taxFreeIncomeTotal": 0.0,
            "totalIncomeTotal": 0.0,
        }
        source_refs: dict[str, Any] = {}

        if activity_type == "active_duty":
            military_schedule = _military_schedule_row(reference_domains, calendar_year) or {}
            base_pay_record = _domain_lookup(reference_domains, "military_pay_rates", military_schedule.get("basePaySourceId"))
            bah_record = _domain_lookup(reference_domains, "military_pay_rates", military_schedule.get("bahSourceId"))
            bas_record = _domain_lookup(reference_domains, "military_pay_rates", military_schedule.get("basSourceId"))
            raise_schedule_row = _domain_lookup(reference_domains, "military_raise_schedule", f"mil_raise_{military_schedule.get('raiseSourceYear')}") if military_schedule.get("raiseSourceYear") else None
            latest_promotion = _latest_enabled_promotion(reference_domains, calendar_year)

            income_breakdown["militaryBasePay"] = float(military_schedule.get("basePayAnnual", 0) or 0)
            income_breakdown["militaryBah"] = float(military_schedule.get("bahAnnual", 0) or 0)
            income_breakdown["militaryBas"] = float(military_schedule.get("basAnnual", 0) or 0)
            income_breakdown["salary"]["basePay"] = income_breakdown["militaryBasePay"]
            income_breakdown["salary"]["bah"] = income_breakdown["militaryBah"]
            income_breakdown["salary"]["bas"] = income_breakdown["militaryBas"]
            income_breakdown["military"]["projectedPayGrade"] = f"E-{int(military_schedule.get('projectedPayGradeNumeric', 0) or 0)}" if military_schedule.get("projectedPayGradeNumeric") else "—"
            income_breakdown["military"]["yearsOfService"] = int(military_schedule.get("yearsOfService", 0) or 0)
            income_breakdown["military"]["raisePercent"] = float(military_schedule.get("raisePercent", 0) or 0)
            income_breakdown["military"]["totalComp"] = float(military_schedule.get("totalMilitaryCompAnnual", 0) or 0)
            gross_income = income_breakdown["militaryBasePay"]
            tax_free_income = income_breakdown["militaryBah"] + income_breakdown["militaryBas"]
            tax_profile, healthcare_profile, contribution_policy = _resolve_phase_profiles(reference_domains, phase_id, scenario, program, location_id, service_status, activity_type)
            healthcare_cost = float(healthcare_profile.get("annualCost", 0))
            retirement_savings = float(contribution_policy.get("annualContribution", 0))
            if base_pay_record:
                source_refs["militaryBasePay"] = [
                    _build_source_ref("reference-data", base_pay_record["label"], screen="reference", target_id=_reference_target("military_pay_rates", base_pay_record["id"]), description="Active-duty base pay is resolved from the military pay-rate schedule.")
                ]
                if raise_schedule_row:
                    source_refs["militaryBasePay"].append(
                        _build_source_ref("reference-data", raise_schedule_row["label"], screen="reference", target_id=_reference_target("military_raise_schedule", raise_schedule_row["id"]), description="Future-year military base pay growth is applied from the annual military raise schedule.")
                    )
                if latest_promotion:
                    source_refs["militaryBasePay"].append(
                        _build_source_ref("reference-data", latest_promotion["label"], screen="reference", target_id=_reference_target("military_promotion_schedule", latest_promotion["id"]), description="Projected promotions change the military pay-grade used for the base-pay ladder.")
                    )
            if bah_record:
                source_refs["militaryBah"] = [
                    _build_source_ref("reference-data", bah_record["label"], screen="reference", target_id=_reference_target("military_pay_rates", bah_record["id"]), description="BAH is resolved from the military pay-rate schedule using the active duty location plan.")
                ]
                if raise_schedule_row:
                    source_refs["militaryBah"].append(
                        _build_source_ref("reference-data", raise_schedule_row["label"], screen="reference", target_id=_reference_target("military_raise_schedule", raise_schedule_row["id"]), description="Future-year BAH growth is currently estimated from the military raise schedule until explicit yearly BAH rows are populated.")
                    )
            if bas_record:
                source_refs["militaryBas"] = [
                    _build_source_ref("reference-data", bas_record["label"], screen="reference", target_id=_reference_target("military_pay_rates", bas_record["id"]), description="BAS is resolved from the military pay-rate schedule.")
                ]
                if raise_schedule_row:
                    source_refs["militaryBas"].append(
                        _build_source_ref("reference-data", raise_schedule_row["label"], screen="reference", target_id=_reference_target("military_raise_schedule", raise_schedule_row["id"]), description="Future-year BAS growth is currently estimated from the military raise schedule until explicit yearly BAS rows are populated.")
                    )
            source_refs["militaryProjectedGrade"] = [
                _build_source_ref("reference-data", "Current service profile", screen="reference", target_id=_reference_target("military_service_profile", "active_duty_service_profile"), description="The current grade and service-time starting point come from the military service profile.")
            ]
            if latest_promotion:
                source_refs["militaryProjectedGrade"].append(
                    _build_source_ref("reference-data", latest_promotion["label"], screen="reference", target_id=_reference_target("military_promotion_schedule", latest_promotion["id"]), description="Enabled promotion rows change the projected pay grade in later active-duty years.")
                )
            source_refs["militaryYearsOfService"] = [
                _build_source_ref("reference-data", "Current service profile", screen="reference", target_id=_reference_target("military_service_profile", "active_duty_service_profile"), description="TAFMS progression starts from the military service profile and advances one year at a time.")
            ]
            if raise_schedule_row:
                source_refs["militaryRaiseSchedule"] = [
                    _build_source_ref("reference-data", raise_schedule_row["label"], screen="reference", target_id=_reference_target("military_raise_schedule", raise_schedule_row["id"]), description="The military raise schedule is applied to years without a newer explicit table row.")
                ]

        elif activity_type == "retirement_transition":
            tax_profile, healthcare_profile, contribution_policy = _resolve_phase_profiles(reference_domains, phase_id, scenario, program, location_id, service_status, activity_type)
            military_schedule = _military_schedule_row(reference_domains, calendar_year) or {}
            base_pay_record = _domain_lookup(reference_domains, "military_pay_rates", military_schedule.get("basePaySourceId"))
            raise_schedule_row = _domain_lookup(reference_domains, "military_raise_schedule", f"mil_raise_{military_schedule.get('raiseSourceYear')}") if military_schedule.get("raiseSourceYear") else None
            latest_promotion = _latest_enabled_promotion(reference_domains, calendar_year)
            active_component = float(military_schedule.get("basePayAnnual", 0) or 0)
            pension_component = float(pension_profile.get("annualAtRetirement", 0))
            income_breakdown["militaryBasePay"] = active_component * float(pension_profile.get("transitionBlendActive", 0))
            income_breakdown["pension"] = pension_component * float(pension_profile.get("transitionBlendPension", 0))
            income_breakdown["salary"]["basePay"] = income_breakdown["militaryBasePay"]
            income_breakdown["salary"]["pension"] = income_breakdown["pension"]
            income_breakdown["military"]["projectedPayGrade"] = f"E-{int(military_schedule.get('projectedPayGradeNumeric', 0) or 0)}" if military_schedule.get("projectedPayGradeNumeric") else "—"
            income_breakdown["military"]["yearsOfService"] = int(military_schedule.get("yearsOfService", 0) or 0)
            income_breakdown["military"]["raisePercent"] = float(military_schedule.get("raisePercent", 0) or 0)
            income_breakdown["military"]["totalComp"] = float(military_schedule.get("totalMilitaryCompAnnual", 0) or 0)
            gross_income = income_breakdown["militaryBasePay"] + income_breakdown["pension"]
            healthcare_cost = float(healthcare_profile.get("annualCost", 0))
            retirement_savings = float(contribution_policy.get("annualContribution", 0))
            if scenario.get("useVa", True) and va:
                income_breakdown["vaCompensation"] = float(va.get("annual", 0))
                income_breakdown["va"]["compensation"] = income_breakdown["vaCompensation"]
                tax_free_income += income_breakdown["vaCompensation"]
                source_refs["vaCompensation"] = [_build_source_ref("reference-data", va["label"], screen="reference", target_id=_reference_target("va_disability", va["id"]), description="VA compensation is resolved from the selected disability rating.")]
            if base_pay_record:
                source_refs["militaryBasePay"] = [_build_source_ref("reference-data", base_pay_record["label"], screen="reference", target_id=_reference_target("military_pay_rates", base_pay_record["id"]))]
            source_refs["militaryProjectedGrade"] = [
                _build_source_ref("reference-data", "Current service profile", screen="reference", target_id=_reference_target("military_service_profile", "active_duty_service_profile"), description="The current grade and service-time starting point come from the military service profile.")
            ]
            if latest_promotion:
                source_refs["militaryProjectedGrade"].append(
                    _build_source_ref("reference-data", latest_promotion["label"], screen="reference", target_id=_reference_target("military_promotion_schedule", latest_promotion["id"]), description="Enabled promotion rows change the projected pay grade in later active-duty years.")
                )
            source_refs["militaryYearsOfService"] = [
                _build_source_ref("reference-data", "Current service profile", screen="reference", target_id=_reference_target("military_service_profile", "active_duty_service_profile"), description="TAFMS progression starts from the military service profile and advances one year at a time.")
            ]
            if raise_schedule_row:
                source_refs["militaryRaiseSchedule"] = [
                    _build_source_ref("reference-data", raise_schedule_row["label"], screen="reference", target_id=_reference_target("military_raise_schedule", raise_schedule_row["id"]), description="The military raise schedule is applied to years without a newer explicit table row.")
                ]
            source_refs["pension"] = [_build_source_ref("reference-data", pension_profile.get("label", "Pension profile"), screen="reference", target_id=_reference_target("pension_profiles", pension_profile.get("id")), description="Retirement transition income uses the pension profile blends.")]

        elif activity_type == "grad_school" and service_status == "military_retired":
            tax_profile, healthcare_profile, contribution_policy = _resolve_phase_profiles(reference_domains, phase_id, scenario, program, location_id, service_status, activity_type)
            income_breakdown["pension"] = _value(float(pension_profile.get("annualAtRetirement", 0)), float(pension_profile.get("colaRate", 0)), years_since_retirement)
            income_breakdown["phdStipend"] = float(program.get("stipendAnnual", 0) if program else 0)
            income_breakdown["salary"]["pension"] = income_breakdown["pension"]
            income_breakdown["gradSchool"]["stipend"] = income_breakdown["phdStipend"]
            gross_income = income_breakdown["pension"] + income_breakdown["phdStipend"]
            healthcare_cost = _value(float(healthcare_profile.get("annualCost", 0)), float(healthcare_profile.get("inflationRate", 0)), years_since_retirement)
            retirement_savings = float(contribution_policy.get("annualContribution", 0))
            if scenario.get("useVa", True) and va:
                income_breakdown["vaCompensation"] = _value(float(va.get("annual", 0)), va_cola_rate, years_since_retirement)
                income_breakdown["va"]["compensation"] = income_breakdown["vaCompensation"]
                tax_free_income += income_breakdown["vaCompensation"]
                source_refs["vaCompensation"] = [_build_source_ref("reference-data", va["label"], screen="reference", target_id=_reference_target("va_disability", va["id"]))]
            if scenario.get("useGiBill", True) and gi_bill_benefit and years_since_retirement <= 3:
                income_breakdown["giBillHousing"] = float(gi_bill_benefit.get("monthlyHousingAllowance", 0)) * 12
                income_breakdown["giBillBooks"] = float(gi_bill_benefit.get("booksSuppliesAnnual", 0))
                income_breakdown["giBill"]["mha"] = income_breakdown["giBillHousing"]
                income_breakdown["giBill"]["booksSupplies"] = income_breakdown["giBillBooks"]
                tax_free_income += income_breakdown["giBillHousing"] + income_breakdown["giBillBooks"]
                source_refs["giBillHousing"] = [_build_source_ref("reference-data", gi_bill_benefit["label"], screen="reference", target_id=_reference_target("gi_bill_benefits", gi_bill_benefit["id"]), description="GI Bill MHA is resolved from the selected benefit record, not the school record.")]
                source_refs["giBillBooks"] = source_refs["giBillHousing"]
            source_refs["pension"] = [_build_source_ref("reference-data", pension_profile.get("label", "Pension profile"), screen="reference", target_id=_reference_target("pension_profiles", pension_profile.get("id")))]
            if program:
                source_refs["phdStipend"] = [_build_source_ref("reference-data", program["label"], screen="reference", target_id=_reference_target("programs", program["id"]), description="PhD stipend is resolved from the program record imported from the workbook.")]

        elif activity_type == "research_career" and service_status == "military_retired":
            years_in_role = years_in_activity
            research_profile = employer or {"baseSalary": 220000, "growthRate": 0.04, "bonusPct": 0.1, "annualRsu": 30000}
            income_breakdown["pension"] = _value(float(pension_profile.get("annualAtRetirement", 0)), float(pension_profile.get("colaRate", 0)), years_since_retirement)
            income_breakdown["salaryBase"] = _value(float(research_profile.get("baseSalary", 0)), float(research_profile.get("growthRate", 0)), years_in_role)
            income_breakdown["salary"]["pension"] = income_breakdown["pension"]
            income_breakdown["salary"]["civilianBase"] = income_breakdown["salaryBase"]
            income_breakdown["bonusPlaceholder"] = income_breakdown["salaryBase"] * float(research_profile.get("bonusPct", 0))
            income_breakdown["rsuPlaceholder"] = _value(float(research_profile.get("annualRsu", 0)), float(research_profile.get("growthRate", 0)), years_in_role)
            income_breakdown["salary"]["other"] = income_breakdown["bonusPlaceholder"] + income_breakdown["rsuPlaceholder"]
            gross_income = income_breakdown["pension"] + income_breakdown["salaryBase"]
            tax_profile, healthcare_profile, contribution_policy = _resolve_phase_profiles(reference_domains, phase_id, scenario, program, location_id, service_status, activity_type)
            healthcare_cost = _value(float(healthcare_profile.get("annualCost", 0)), float(healthcare_profile.get("inflationRate", 0)), years_since_retirement)
            retirement_savings = float(contribution_policy.get("annualContribution", 0))
            if scenario.get("useVa", True) and va:
                income_breakdown["vaCompensation"] = _value(float(va.get("annual", 0)), va_cola_rate, years_since_retirement)
                income_breakdown["va"]["compensation"] = income_breakdown["vaCompensation"]
                tax_free_income += income_breakdown["vaCompensation"]
                source_refs["vaCompensation"] = [_build_source_ref("reference-data", va["label"], screen="reference", target_id=_reference_target("va_disability", va["id"]))]
            source_refs["pension"] = [_build_source_ref("reference-data", pension_profile.get("label", "Pension profile"), screen="reference", target_id=_reference_target("pension_profiles", pension_profile.get("id")))]
            if employer:
                source_refs["salaryBase"] = [_build_source_ref("reference-data", employer["label"], screen="reference", target_id=_reference_target("career_comp_profiles", employer["id"]), description="Research salary is resolved from the selected career compensation profile.")]
                source_refs["salaryOther"] = source_refs["salaryBase"]

        elif activity_type == "tech_career":
            years_in_role = years_in_activity
            tech_profile = company or {"baseSalary": 117638, "growthRate": 0.04, "bonusPct": 0.1, "annualRsu": 20000}
            income_breakdown["salaryBase"] = _value(float(tech_profile.get("baseSalary", 0)), float(tech_profile.get("growthRate", 0)), years_in_role)
            income_breakdown["salary"]["civilianBase"] = income_breakdown["salaryBase"]
            income_breakdown["bonusPlaceholder"] = income_breakdown["salaryBase"] * float(tech_profile.get("bonusPct", 0))
            income_breakdown["rsuPlaceholder"] = _value(float(tech_profile.get("annualRsu", 0)), float(tech_profile.get("growthRate", 0)), years_in_role)
            income_breakdown["salary"]["other"] = income_breakdown["bonusPlaceholder"] + income_breakdown["rsuPlaceholder"]
            if service_status == "military_retired":
                income_breakdown["pension"] = _value(float(pension_profile.get("annualAtRetirement", 0)), float(pension_profile.get("colaRate", 0)), years_since_retirement)
                income_breakdown["salary"]["pension"] = income_breakdown["pension"]
                gross_income = income_breakdown["pension"] + income_breakdown["salaryBase"]
                source_refs["pension"] = [_build_source_ref("reference-data", pension_profile.get("label", "Pension profile"), screen="reference", target_id=_reference_target("pension_profiles", pension_profile.get("id")))]
            else:
                gross_income = income_breakdown["salaryBase"]
            scenario["_salaryForTax"] = gross_income
            tax_profile, healthcare_profile, contribution_policy = _resolve_phase_profiles(reference_domains, phase_id, scenario, program, location_id, service_status, activity_type)
            healthcare_cost = _value(float(healthcare_profile.get("annualCost", 0)), float(healthcare_profile.get("inflationRate", 0)), years_in_role)
            retirement_savings = float(contribution_policy.get("annualContribution", 0))
            if scenario.get("useVa", True) and va:
                growth_years = years_since_retirement if service_status == "military_retired" else years_in_role
                income_breakdown["vaCompensation"] = _value(float(va.get("annual", 0)), va_cola_rate, growth_years)
                income_breakdown["va"]["compensation"] = income_breakdown["vaCompensation"]
                tax_free_income += income_breakdown["vaCompensation"]
                source_refs["vaCompensation"] = [_build_source_ref("reference-data", va["label"], screen="reference", target_id=_reference_target("va_disability", va["id"]))]
            if company:
                source_refs["salaryBase"] = [_build_source_ref("reference-data", company["label"], screen="reference", target_id=_reference_target("career_comp_profiles", company["id"]), description="Tech salary is resolved from the selected career compensation profile.")]
                source_refs["salaryOther"] = source_refs["salaryBase"]

        elif activity_type in {"gap", "retire"}:
            tax_profile, healthcare_profile, contribution_policy = _resolve_phase_profiles(reference_domains, phase_id, scenario, program, location_id, service_status, activity_type)
            if service_status == "military_retired":
                income_breakdown["pension"] = _value(float(pension_profile.get("annualAtRetirement", 0)), float(pension_profile.get("colaRate", 0)), years_since_retirement)
                income_breakdown["salary"]["pension"] = income_breakdown["pension"]
                gross_income = income_breakdown["pension"]
                healthcare_cost = _value(float(healthcare_profile.get("annualCost", 0)), float(healthcare_profile.get("inflationRate", 0)), years_since_retirement)
                source_refs["pension"] = [_build_source_ref("reference-data", pension_profile.get("label", "Pension profile"), screen="reference", target_id=_reference_target("pension_profiles", pension_profile.get("id")))]
            else:
                healthcare_cost = float(healthcare_profile.get("annualCost", 0))
            retirement_savings = float(contribution_policy.get("annualContribution", 0))
            if scenario.get("useVa", True) and va:
                va_growth_years = years_since_retirement if service_status == "military_retired" else years_in_activity
                income_breakdown["vaCompensation"] = _value(float(va.get("annual", 0)), va_cola_rate, va_growth_years)
                income_breakdown["va"]["compensation"] = income_breakdown["vaCompensation"]
                tax_free_income += income_breakdown["vaCompensation"]
                source_refs["vaCompensation"] = [_build_source_ref("reference-data", va["label"], screen="reference", target_id=_reference_target("va_disability", va["id"]))]

        elif activity_type == "grad_school":
            years_in_phd = years_in_activity
            tax_profile, healthcare_profile, contribution_policy = _resolve_phase_profiles(reference_domains, phase_id, scenario, program, location_id, service_status, activity_type)
            income_breakdown["phdStipend"] = float(program.get("stipendAnnual", 0) if program else 0)
            income_breakdown["gradSchool"]["stipend"] = income_breakdown["phdStipend"]
            gross_income = income_breakdown["phdStipend"]
            healthcare_cost = float(healthcare_profile.get("annualCost", 0))
            retirement_savings = float(contribution_policy.get("annualContribution", 0))
            if scenario.get("useVa", True) and va:
                income_breakdown["vaCompensation"] = _value(float(va.get("annual", 0)), va_cola_rate, years_in_phd + 1)
                income_breakdown["va"]["compensation"] = income_breakdown["vaCompensation"]
                tax_free_income += income_breakdown["vaCompensation"]
                source_refs["vaCompensation"] = [_build_source_ref("reference-data", va["label"], screen="reference", target_id=_reference_target("va_disability", va["id"]))]
            if scenario.get("useGiBill", True) and gi_bill_benefit and years_in_phd <= 2:
                income_breakdown["giBillHousing"] = float(gi_bill_benefit.get("monthlyHousingAllowance", 0)) * 12
                income_breakdown["giBillBooks"] = float(gi_bill_benefit.get("booksSuppliesAnnual", 0))
                income_breakdown["giBill"]["mha"] = income_breakdown["giBillHousing"]
                income_breakdown["giBill"]["booksSupplies"] = income_breakdown["giBillBooks"]
                tax_free_income += income_breakdown["giBillHousing"] + income_breakdown["giBillBooks"]
                source_refs["giBillHousing"] = [_build_source_ref("reference-data", gi_bill_benefit["label"], screen="reference", target_id=_reference_target("gi_bill_benefits", gi_bill_benefit["id"]), description="GI Bill MHA is resolved from the selected benefit record, not the school record.")]
                source_refs["giBillBooks"] = source_refs["giBillHousing"]
            if program:
                source_refs["phdStipend"] = [_build_source_ref("reference-data", program["label"], screen="reference", target_id=_reference_target("programs", program["id"]), description="PhD stipend is resolved from the program record imported from the workbook.")]

        else:  # research_only
            years_in_role = years_in_activity
            research_profile = employer or {"baseSalary": 220000, "growthRate": 0.04, "bonusPct": 0.1, "annualRsu": 30000}
            income_breakdown["salaryBase"] = _value(float(research_profile.get("baseSalary", 0)), float(research_profile.get("growthRate", 0)), years_in_role)
            income_breakdown["salary"]["civilianBase"] = income_breakdown["salaryBase"]
            income_breakdown["bonusPlaceholder"] = income_breakdown["salaryBase"] * float(research_profile.get("bonusPct", 0))
            income_breakdown["rsuPlaceholder"] = _value(float(research_profile.get("annualRsu", 0)), float(research_profile.get("growthRate", 0)), years_in_role)
            income_breakdown["salary"]["other"] = income_breakdown["bonusPlaceholder"] + income_breakdown["rsuPlaceholder"]
            gross_income = income_breakdown["salaryBase"]
            tax_profile, healthcare_profile, contribution_policy = _resolve_phase_profiles(reference_domains, phase_id, scenario, program, location_id, service_status, activity_type)
            healthcare_cost = _value(float(healthcare_profile.get("annualCost", 0)), float(healthcare_profile.get("inflationRate", 0)), years_in_role)
            retirement_savings = float(contribution_policy.get("annualContribution", 0))
            if scenario.get("useVa", True) and va:
                income_breakdown["vaCompensation"] = _value(float(va.get("annual", 0)), va_cola_rate, years_in_role + 6)
                income_breakdown["va"]["compensation"] = income_breakdown["vaCompensation"]
                tax_free_income += income_breakdown["vaCompensation"]
                source_refs["vaCompensation"] = [_build_source_ref("reference-data", va["label"], screen="reference", target_id=_reference_target("va_disability", va["id"]))]
            if employer:
                source_refs["salaryBase"] = [_build_source_ref("reference-data", employer["label"], screen="reference", target_id=_reference_target("career_comp_profiles", employer["id"]), description="Research salary is resolved from the selected career compensation profile.")]
                source_refs["salaryOther"] = source_refs["salaryBase"]

        federal_rate = float(tax_profile.get("federalRate", 0))
        state_rate = float(tax_profile.get("stateRate", 0))
        expense_breakdown = _build_two_layer_expense_breakdown(
            expense_inputs,
            location_cost_profile,
            expense_growth,
            year_index,
            float(override_living_monthly) if override_living_monthly is not None else None,
        )
        living_expenses = sum(expense_breakdown.values())
        taxable_base = max(gross_income, 0.0)
        federal_tax = max(taxable_base * federal_rate, 0.0)
        state_tax = max(taxable_base * state_rate, 0.0)
        taxes_paid = federal_tax + state_tax
        positive_surplus_invested = max(gross_income + tax_free_income - taxes_paid - healthcare_cost - living_expenses - retirement_savings, 0.0) * float(growth_policy.get("surplusInvestmentRate", 0))
        net_cash_flow = gross_income + tax_free_income - taxes_paid - healthcare_cost - living_expenses - retirement_savings
        investment_growth = prior_portfolio * float(growth_policy.get("annualReturnRate", 0))
        portfolio = prior_portfolio + investment_growth + retirement_savings + positive_surplus_invested

        income_breakdown["grossIncomeTotal"] = gross_income
        income_breakdown["taxFreeIncomeTotal"] = tax_free_income
        income_breakdown["totalIncomeTotal"] = gross_income + tax_free_income
        expense_breakdown["healthcareProgramCost"] = healthcare_cost
        expense_breakdown["livingExpensesTotal"] = living_expenses
        tax_breakdown = {
            "federalTax": federal_tax,
            "stateTax": state_tax,
            "totalTaxes": taxes_paid,
            "federal": federal_tax,
            "state": state_tax,
            "total": taxes_paid,
        }
        savings_breakdown = {
            "retirementSavings": retirement_savings,
            "surplusInvested": positive_surplus_invested,
            "savingsTotal": retirement_savings + positive_surplus_invested,
        }

        contribution_policy_id = (
            "military_retirement_contribution"
            if phase_id == "active_duty"
            else "civilian_retirement_contribution"
            if phase_id in {"tech_career", "retired_research", "research_only"}
            else "phd_retirement_contribution"
        )
        contribution_policy = _retirement_policy(reference_domains, contribution_policy_id)
        retirement_destination_id = contribution_policy.get("destinationId")
        retirement_destination = _destination_policy(reference_domains, retirement_destination_id)
        brokerage_destination = _destination_policy(reference_domains, "brokerage")

        investment_breakdown = {
            "contributions": {
                "tsp": retirement_savings if retirement_destination_id == "tsp" else 0.0,
                "401k": retirement_savings if retirement_destination_id == "401k" else 0.0,
                "rothIra": retirement_savings if retirement_destination_id == "roth_ira" else 0.0,
                "brokerage": positive_surplus_invested,
                "other": 0.0,
                "retirementContributions": retirement_savings,
                "taxableContributions": positive_surplus_invested,
                "totalContributions": retirement_savings + positive_surplus_invested,
            },
            "growth": {
                "portfolioGrowth": investment_growth,
                "assumedReturnRate": float(growth_policy.get("annualReturnRate", 0)),
            },
        }

        cash_reserve = starting_cash_reserve
        invested_portfolio = max(portfolio - cash_reserve, 0.0)
        tsp_proxy = max(starting_tsp + investment_breakdown["contributions"]["tsp"] + investment_breakdown["contributions"]["401k"], 0.0)
        roth_proxy = max(starting_roth_ira + investment_breakdown["contributions"]["rothIra"], 0.0)
        brokerage_proxy = max(starting_brokerage + investment_breakdown["contributions"]["brokerage"], 0.0)
        proxy_total = max(tsp_proxy + roth_proxy + brokerage_proxy, 1.0)
        portfolio_breakdown = {
            "accounts": {
                "tsp401k": invested_portfolio * (tsp_proxy / proxy_total),
                "rothIra": invested_portfolio * (roth_proxy / proxy_total),
                "brokerage": invested_portfolio * (brokerage_proxy / proxy_total),
                "cashReserve": cash_reserve,
            },
            "summary": {
                "investedPortfolio": invested_portfolio,
                "totalInvestableAssets": portfolio,
            },
        }

        source_refs["livingExpenses"] = [
            _build_source_ref("manual-group", "Manual Finance expenses", screen="finance", target_id="manual-bucket-expenses", description="Living expenses start with the user-owned Manual Finance entries."),
        ]
        if location_cost_profile:
            source_refs["livingExpenses"].append(
                _build_source_ref(
                    "reference-data",
                    location_cost_profile["label"],
                    screen="reference",
                    target_id=_reference_target("location_cost_profiles", location_cost_profile["id"]),
                    description="Location cost profiles provide the additive reference layer for expenses.",
                )
            )
        if override_living_monthly is not None:
            source_refs.setdefault("livingExpensesOverride", []).append(
                _build_source_ref("path-selector", "Living expense override", screen="path-editor", target_id="path-editor-field-monthlyLivingExpenses", description="The path-level living expense override rescales the combined expense baseline."),
            )
        if healthcare_profile:
            source_refs["healthcareCost"] = [
                _build_source_ref("reference-data", healthcare_profile["label"], screen="reference", target_id=_reference_target("healthcare_profiles", healthcare_profile["id"]), description="Healthcare cost is resolved from the active healthcare profile."),
            ]
        if tax_profile.get("id"):
            source_refs["taxes"] = [
                _build_source_ref("reference-data", tax_profile["label"], screen="reference", target_id=_reference_target("tax_profiles", tax_profile["id"]), description="Federal and state rates are resolved from the active tax profile."),
            ]
        source_refs["portfolio"] = [
            _build_source_ref("manual-group", "Manual Finance assets", screen="finance", target_id="manual-bucket-assets", description="Starting portfolio comes from Manual Finance assets excluding the vehicle."),
            _build_source_ref("reference-data", growth_policy["label"], screen="reference", target_id=_reference_target("investment_policies", growth_policy["id"]), description="Portfolio growth and surplus investment rate come from the core investment policy."),
        ]
        source_refs["portfolioGrowth"] = [
            _build_source_ref("reference-data", growth_policy["label"], screen="reference", target_id=_reference_target("investment_policies", growth_policy["id"]), description="Annual portfolio growth is resolved from the core investment policy."),
        ]
        source_refs["assumedReturnRate"] = source_refs["portfolioGrowth"]
        contribution_refs = []
        if contribution_policy.get("id"):
            contribution_refs.append(
                _build_source_ref("reference-data", contribution_policy["label"], screen="reference", target_id=_reference_target("investment_policies", contribution_policy["id"]), description="Retirement contribution defaults are resolved from the phase contribution policy.")
            )
        if retirement_destination:
            contribution_refs.append(
                _build_source_ref("reference-data", retirement_destination["label"], screen="reference", target_id=_reference_target("investment_policies", retirement_destination["id"]), description="Retirement contributions route to the destination record defined by the active contribution policy.")
            )
        source_refs["retirementContributions"] = contribution_refs
        source_refs["taxableContributions"] = [
            _build_source_ref("reference-data", growth_policy["label"], screen="reference", target_id=_reference_target("investment_policies", growth_policy["id"]), description="Taxable contribution sizing comes from the surplus investment rate in the core investment policy."),
        ]
        if brokerage_destination:
            source_refs["taxableContributions"].append(
                _build_source_ref("reference-data", brokerage_destination["label"], screen="reference", target_id=_reference_target("investment_policies", brokerage_destination["id"]), description="Positive surplus routes to the brokerage destination record."),
            )
        source_refs["totalContributions"] = dedupe_source_refs(source_refs["retirementContributions"] + source_refs["taxableContributions"])
        source_refs["investedPortfolio"] = source_refs["portfolio"]
        source_refs["totalInvestableAssets"] = source_refs["portfolio"]

        formula_meta = _build_formula_meta(
            gross_income,
            tax_free_income,
            taxes_paid,
            healthcare_cost,
            living_expenses,
            retirement_savings,
            net_cash_flow,
            portfolio,
            prior_portfolio,
            investment_growth,
            positive_surplus_invested,
            income_breakdown,
            tax_breakdown,
            expense_breakdown,
            savings_breakdown,
            investment_breakdown,
            portfolio_breakdown,
        )

        row = YearProjection(
            scenario_id=scenario["id"],
            year_index=year_index,
            calendar_year=calendar_year,
            age=age,
            phase_id=phase_id,
            phase_label=phase_label,
            service_status=service_status,
            activity_type=activity_type,
            gross_income=gross_income,
            tax_free_income=tax_free_income,
            taxes=taxes_paid,
            healthcare_cost=healthcare_cost,
            living_expenses=living_expenses,
            retirement_savings=retirement_savings,
            net_cash_flow=net_cash_flow,
            portfolio=portfolio,
            positive_surplus_invested=positive_surplus_invested,
            income_breakdown=income_breakdown,
            expense_breakdown=expense_breakdown,
            tax_breakdown=tax_breakdown,
            savings_breakdown=savings_breakdown,
            investment_breakdown=investment_breakdown,
            portfolio_breakdown=portfolio_breakdown,
            formula_meta=formula_meta,
            source_refs=source_refs,
        )
        yearly_rows.append(row)
        prior_portfolio = portfolio
        total_gross += gross_income
        total_tax_free += tax_free_income
        total_taxes += taxes_paid
        total_healthcare += healthcare_cost
        total_net_cash_flow += net_cash_flow

    milestone_rows = []
    for milestone in planner_profile["milestones"]:
        year_row = yearly_rows[milestone["yearIndex"]]
        milestone_rows.append(
            {
                "label": milestone["label"],
                "yearIndex": milestone["yearIndex"],
                "calendarYear": year_row.calendar_year,
                "age": year_row.age,
                "portfolio": _round(year_row.portfolio),
                "withdrawalAt4Pct": _round(year_row.portfolio * float(growth_policy.get("withdrawalRate", 0.04))),
            }
        )

    final_portfolio = yearly_rows[-1].portfolio
    metrics = {
        "finalPortfolio": _round(final_portfolio),
        "totalGrossIncome": _round(total_gross),
        "totalTaxFreeIncome": _round(total_tax_free),
        "totalTaxes": _round(total_taxes),
        "totalHealthcareCost": _round(total_healthcare),
        "totalNetCashFlow": _round(total_net_cash_flow),
        "lifetimePensionValue": _round(calculate_lifetime_pension(scenario, planner_profile, reference_domains)),
        "milestones": milestone_rows,
    }

    return [row.as_dict() for row in yearly_rows], metrics


def determine_phase(path_id: str, year_index: int, timeline: dict[str, Any] | None = None) -> tuple[str, str]:
    timeline = timeline or {}
    if path_id == "PATH_A":
        active_end = int(timeline.get("activeDutyEndYearIndex", 7))
        transition_year = int(timeline.get("retirementTransitionYearIndex", 8))
        phd_end = int(timeline.get("phdEndYearIndex", 13))
        if year_index <= active_end:
            return "active_duty", "Active Duty"
        if year_index == transition_year:
            return "retirement_transition", "Retirement Transition"
        if year_index <= phd_end:
            return "retired_phd", "Retired + PhD"
        return "retired_research", "Retired + Research Scientist"

    if path_id == "PATH_B":
        active_end = int(timeline.get("activeDutyEndYearIndex", 1))
        if year_index <= active_end:
            return "active_duty", "Active Duty"
        return "tech_career", "CS / Tech Career"

    active_end = int(timeline.get("activeDutyEndYearIndex", 1))
    gap_year = int(timeline.get("gapYearIndex", 2))
    phd_end = int(timeline.get("phdEndYearIndex", 7))
    if year_index <= active_end:
        return "active_duty", "Active Duty"
    if year_index == gap_year:
        return "gap_year", "Gap Year"
    if year_index <= phd_end:
        return "phd_only", "PhD"
    return "research_only", "Research Scientist"


def calculate_lifetime_pension(
    path_source: str | dict[str, Any],
    planner_profile: dict[str, Any],
    reference_domains: dict[str, list[dict[str, Any]]] | None = None,
) -> float:
    if isinstance(path_source, dict):
        path_id = coerce_legacy_path_template_id(path_source.get("pathTemplateId"), path_source.get("pathTimeline"), path_source)
        if path_id != "PATH_A":
            return 0.0
    elif path_source != "PATH_A":
        return 0.0
    reference_domains = reference_domains or REFERENCE_DOMAINS
    pension_profile = _domain_lookup(reference_domains, "pension_profiles", "high_3_path_a") or {}
    retirement_years = planner_profile["projectionEndYear"] - planner_profile["retirementEligibleYear"] + 1
    cola = float(pension_profile.get("colaRate", 0))
    annual = float(pension_profile.get("annualAtRetirement", 0))
    if cola == 0:
        return annual * retirement_years
    return annual * (((1 + cola) ** retirement_years) - 1) / cola


def compare_scenarios(projections_by_scenario: dict[str, dict[str, Any]]) -> dict[str, Any]:
    scenario_ids = list(projections_by_scenario.keys())
    comparisons = []
    if not scenario_ids:
        return {"comparisons": comparisons}

    baseline_id = scenario_ids[0]
    baseline_projection = projections_by_scenario[baseline_id]["projection"]
    baseline_metrics = projections_by_scenario[baseline_id]["metrics"]

    for scenario_id in scenario_ids[1:]:
        current_projection = projections_by_scenario[scenario_id]["projection"]
        current_metrics = projections_by_scenario[scenario_id]["metrics"]
        breakeven_year = None
        cumulative_advantage = 0.0
        for base_row, current_row in zip(baseline_projection, current_projection):
            cumulative_advantage = base_row["portfolio"] - current_row["portfolio"]
            if breakeven_year is None and cumulative_advantage <= 0:
                breakeven_year = base_row["calendarYear"]
        comparisons.append(
            {
                "baselineScenarioId": baseline_id,
                "scenarioId": scenario_id,
                "finalPortfolioDelta": _round(baseline_metrics["finalPortfolio"] - current_metrics["finalPortfolio"]),
                "totalIncomeDelta": _round(
                    (baseline_metrics["totalGrossIncome"] + baseline_metrics["totalTaxFreeIncome"])
                    - (current_metrics["totalGrossIncome"] + current_metrics["totalTaxFreeIncome"])
                ),
                "healthcareCostDelta": _round(baseline_metrics["totalHealthcareCost"] - current_metrics["totalHealthcareCost"]),
                "breakevenYear": breakeven_year,
                "cumulativeAdvantage": _round(cumulative_advantage),
            }
        )
    return {"comparisons": comparisons}
