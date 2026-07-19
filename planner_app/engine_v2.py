"""Composable V2 projection engine — timeline resolution layer.

Stage 3 keystone: turn a resolved V2 timeline into the per-year, month-prorated
segments the money layer consumes. Each projection year is split into one or more
segments (a year that straddles a block boundary yields two), and every segment
carries the activity/service vocabulary the income logic already understands
(active_duty, grad_school, tech_career, research_career, gap, retire), plus the
"years in activity" and "years since service exit" counters that drive
compensation growth and benefit COLAs.

The money layer (income, benefits, taxes, retirement ledger) is wired on top of
this in the subsequent steps; this module is pure timeline math and is fully
unit-tested on its own.
"""

from __future__ import annotations

from dataclasses import dataclass

from .schema_v2 import (
    ScenarioV2,
    abs_month,
    active_months_in_year,
    resolve_timeline,
)

ACTIVE_DUTY_TYPES = ("active_duty_separate", "active_duty_retire")


@dataclass
class YearSegment:
    block_id: str
    block_type: str
    months: int  # months of this projection year covered by the block (1..12)
    activity_type: str
    service_status: str
    phase_id: str
    phase_label: str
    years_in_activity: int
    years_since_exit: int
    career_profile_id: str | None = None
    program_id: str | None = None
    location_id: str | None = None

    @property
    def fraction(self) -> float:
        return self.months / 12.0


def _block_state(block_type: str, exit_type: str) -> tuple[str, str, str, str]:
    """Map a resolved block type to (activity_type, service_status, phase_id, phase_label)."""
    if block_type in ACTIVE_DUTY_TYPES:
        return "active_duty", "active_duty", "active_duty", "Active Duty"

    retired = exit_type == "military_retirement"
    service_status = "military_retired" if retired else "separated"
    prefix = "Retired + " if retired else ""

    if block_type == "grad_school":
        return "grad_school", service_status, "retired_phd" if retired else "phd_only", f"{prefix}Grad School"
    if block_type == "tech_career":
        return "tech_career", service_status, "tech_career", f"{prefix}Tech Career"
    if block_type == "research_career":
        return "research_career", service_status, "retired_research" if retired else "research_only", f"{prefix}Research Career"
    if block_type == "retire":
        return "retire", service_status, "retired_drawdown", f"{prefix}Retirement".strip()
    return "gap", service_status, "gap_year", f"{prefix}Gap".strip() or "Gap Year"


def resolve_year_segments(
    scenario: ScenarioV2,
    profile: dict,
    year_index: int,
) -> list[YearSegment]:
    """Split one projection year into month-prorated segments across active blocks."""
    resolved = resolve_timeline(profile, scenario)
    base_year = int(profile["baseYear"])
    exit = scenario.service_exit
    exit_year_index = abs_month(exit.year, exit.month, base_year) // 12
    exit_type = exit.type

    segments: list[YearSegment] = []
    for block in resolved:
        months = active_months_in_year(block, year_index)
        if months <= 0:
            continue
        activity_type, service_status, phase_id, phase_label = _block_state(block.type, exit_type)
        block_start_year_index = block.start_month_index // 12
        years_in_activity = max(year_index - block_start_year_index, 0)
        years_since_exit = max(year_index - exit_year_index, 0) if service_status == "military_retired" else 0
        segments.append(
            YearSegment(
                block_id=block.id,
                block_type=block.type,
                months=months,
                activity_type=activity_type,
                service_status=service_status,
                phase_id=phase_id,
                phase_label=phase_label,
                years_in_activity=years_in_activity,
                years_since_exit=years_since_exit,
                career_profile_id=block.career_profile_id,
                program_id=block.program_id,
                location_id=block.location_id,
            )
        )
    return segments


def dominant_segment(segments: list[YearSegment]) -> YearSegment:
    """The segment covering the most months of the year (the year's headline phase)."""
    return max(segments, key=lambda seg: seg.months)


# ---------------------------------------------------------------------------
# Money layer — V2 projection with month proration and a real retirement
# lifecycle (account ledger, drawdown, Social Security, RMDs, Medicare-at-65,
# real-dollars deflator). Consumes the segment resolver above.
# ---------------------------------------------------------------------------

from .engine import (  # reuse legacy building blocks that remain correct
    _category_field_map,
    _domain_lookup,
    _empty_expense_breakdown,
    _manual_asset_amount_any,
    _military_schedule_row,
    _ref_lookup,
    _round,
    _value,
)
from .manual_finance import flatten_manual_finance_group
from .models import YearProjection
from .reference_data import REFERENCE_DOMAINS, hydrate_military_reference_domains
from .reference_v2 import merge_v2_reference_domains
from .schema_v2 import completed_service_years

INVESTED_ACCOUNTS = ("brokerage", "rothIra", "tspRoth", "trad401k")


def _rule(domains: dict, rule_id: str, field: str = "valuePercent", default: float = 0.0) -> float:
    for domain in ("benefit_rules", "v2_benefit_rules"):
        record = _domain_lookup(domains, domain, rule_id)
        if record is not None and record.get(field) is not None:
            return float(record[field])
    return default


def _military_pay_for_year(domains: dict, calendar_year: int) -> dict[str, float]:
    """Base pay / BAH / BAS for a calendar year, extrapolating beyond the schedule."""
    row = _military_schedule_row(domains, calendar_year)
    if row:
        return {
            "basePay": float(row.get("basePayAnnual", 0) or 0),
            "bah": float(row.get("bahAnnual", 0) or 0),
            "bas": float(row.get("basAnnual", 0) or 0),
            "grade": row.get("projectedPayGradeNumeric"),
            "yos": int(row.get("yearsOfService", 0) or 0),
        }
    schedule = domains.get("military_compensation_projection_view", [])
    if not schedule:
        return {"basePay": 0.0, "bah": 0.0, "bas": 0.0, "grade": None, "yos": 0}
    last = max(schedule, key=lambda item: int(item.get("calendarYear", 0) or 0))
    last_year = int(last.get("calendarYear", calendar_year))
    growth = _rule(domains, "military_raise_default", default=0.025)
    factor = (1 + growth) ** max(calendar_year - last_year, 0)
    return {
        "basePay": float(last.get("basePayAnnual", 0) or 0) * factor,
        "bah": float(last.get("bahAnnual", 0) or 0) * factor,
        "bas": float(last.get("basAnnual", 0) or 0) * factor,
        "grade": last.get("projectedPayGradeNumeric"),
        "yos": int(last.get("yearsOfService", 0) or 0) + max(calendar_year - last_year, 0),
    }


def derive_high3_pension(domains: dict, profile: dict, exit_year: int, exit_month: int) -> dict[str, float]:
    """High-3 pension at retirement: avg of final 36 months' base pay x 2.5% x years served."""
    years_served = completed_service_years(profile, exit_year, exit_month)
    multiplier_per_year = _rule(domains, "retirement_multiplier_per_year", default=0.025)
    high3_avg = sum(_military_pay_for_year(domains, year)["basePay"] for year in range(exit_year - 2, exit_year + 1)) / 3.0
    annual = high3_avg * multiplier_per_year * years_served
    return {"annualAtRetirement": annual, "high3Average": high3_avg, "yearsServed": years_served,
            "multiplier": multiplier_per_year * years_served}


def _career_profile(reference_tables: dict, profile_id: str | None) -> dict | None:
    return (
        _ref_lookup(reference_tables, "tech_companies", profile_id)
        or _ref_lookup(reference_tables, "research_employers", profile_id)
    )


def salary_for_year(career_profile: dict, years_in_role: int) -> float:
    """Piecewise year-in-role compensation; falls back to the single growth rate."""
    base = float(career_profile.get("baseSalary", 0) or 0)
    segments = career_profile.get("compSegments") or []
    if not segments:
        growth = float(career_profile.get("growthRate", 0) or 0)
        return base * ((1 + growth) ** years_in_role)
    salary = base
    for year in range(years_in_role):
        rate = None
        for seg in segments:
            if float(seg.get("fromYearInRole", 0)) <= year <= float(seg.get("toYearInRole", 10_000)):
                rate = float(seg.get("annualGrowthRate", 0))
                break
        if rate is None:
            rate = float(career_profile.get("growthRate", 0) or 0)
        salary *= 1 + rate
    return salary


def _segment_location_id(segment: YearSegment, domains: dict, default_location: str) -> str | None:
    if segment.location_id:
        return segment.location_id
    if segment.activity_type == "grad_school" and segment.program_id:
        program = _domain_lookup(domains, "programs", segment.program_id)
        if program:
            return program.get("locationId")
    if segment.activity_type in ("tech_career", "research_career") and segment.career_profile_id:
        mapping = _domain_lookup(domains, "career_locations", segment.career_profile_id)
        if mapping:
            return mapping.get("locationId")
    return default_location


def _blended_expense_breakdown(
    expense_items: list[dict],
    cost_profile: dict | None,
    growth: float,
    year_index: int,
    override_total_monthly: float | None,
    post_service: bool,
) -> dict[str, float]:
    """Living expenses for one segment.

    Active duty: your Manual Finance numbers ARE your life (on-base housing,
    BAH situation) — the location layer is ignored. Post-service with researched
    location data: the location's market costs REPLACE the overlapping manual
    categories (no double counting); manual-only categories (gifts, anything
    the location doesn't cover) still apply.
    """
    category_map = _category_field_map()
    manual = _empty_expense_breakdown()
    for item in expense_items:
        key = category_map.get(item.get("category") or item.get("sectionId"), "miscellaneous")
        manual[key] += float(item.get("amountMonthly", 0))

    location = _empty_expense_breakdown()
    if cost_profile:
        for key in location:
            location[key] = float(cost_profile.get(f"{key}Monthly", 0) or 0)
        location["healthcareOutOfPocket"] = float(cost_profile.get("healthcareOutOfPocketMonthly", 0) or 0)

    has_location_data = post_service and any(v > 0 for v in location.values())
    monthly = (
        {key: (location[key] if location[key] > 0 else manual[key]) for key in manual}
        if has_location_data
        else manual
    )

    total_monthly = sum(monthly.values()) or 1.0
    scale = (override_total_monthly / total_monthly) if override_total_monthly is not None else 1.0
    return {key: _value(amount * scale * 12, growth, year_index) for key, amount in monthly.items()}


def _segment_tax_profile(segment: YearSegment, domains: dict, salary_annualized: float) -> dict:
    if segment.activity_type == "active_duty":
        return _domain_lookup(domains, "tax_profiles", "active_duty_default") or {}
    if segment.activity_type == "grad_school":
        program = _domain_lookup(domains, "programs", segment.program_id) if segment.program_id else None
        profile_id = (program or {}).get("taxProfileId") or "phd_ca"
        return _domain_lookup(domains, "tax_profiles", profile_id) or {}
    if segment.activity_type in ("tech_career", "research_career"):
        threshold = _rule(domains, "high_income_salary_threshold", field="valueNumber", default=200000)
        profile_id = "civilian_mid_default_ca" if salary_annualized < threshold else "civilian_high_default"
        return _domain_lookup(domains, "tax_profiles", profile_id) or {}
    if segment.activity_type == "retire":
        return _domain_lookup(domains, "retirement_tax_profiles", "retirement_income_default") or {}
    if segment.service_status == "military_retired":
        return _domain_lookup(domains, "tax_profiles", "retirement_transition_default") or {}
    return {"id": "gap_year_tax_free", "federalRate": 0.0, "stateRate": 0.0}


def _segment_healthcare(segment: YearSegment, domains: dict, age: int) -> tuple[float, str]:
    """Annualized healthcare cost for the segment (before proration) and its profile id."""
    medicare = _domain_lookup(domains, "medicare_profiles", "medicare_baseline") or {}
    medicare_age = int(medicare.get("startAge", 65))

    if segment.activity_type == "active_duty":
        return 0.0, "active_duty_covered"
    if segment.service_status == "military_retired":
        profile = _domain_lookup(domains, "healthcare_profiles", "tricare_select_retiree") or {}
        cost = float(profile.get("annualCost", 0)) * (1 + float(profile.get("inflationRate", 0))) ** segment.years_since_exit
        return cost, "tricare_select_retiree"
    if segment.activity_type == "grad_school":
        return 0.0, "university_funded_healthcare"
    # Civilian: employer plan (or marketplace during gaps), replaced by Medicare at 65.
    if age >= medicare_age:
        years_on_medicare = age - medicare_age
        cost = float(medicare.get("annualCost", 0)) * (1 + float(medicare.get("inflationRate", 0))) ** years_on_medicare
        return cost, "medicare_baseline"
    profile_id = "marketplace_gap_year" if segment.activity_type in ("gap", "retire") else "civilian_employer_plan"
    profile = _domain_lookup(domains, "healthcare_profiles", profile_id) or {}
    cost = float(profile.get("annualCost", 0)) * (1 + float(profile.get("inflationRate", 0))) ** segment.years_in_activity
    return cost, profile_id


def _contribution_policy_id(activity_type: str) -> str:
    if activity_type == "active_duty":
        return "military_retirement_contribution"
    if activity_type in ("tech_career", "research_career"):
        return "civilian_retirement_contribution"
    return "phd_retirement_contribution"


def _account_for_destination(destination_id: str | None) -> str:
    if destination_id == "tsp":
        return "tspRoth"
    if destination_id == "401k":
        return "trad401k"
    if destination_id == "roth_ira":
        return "rothIra"
    return "brokerage"


def _ss_annual(scenario: ScenarioV2, domains: dict, age: int) -> float:
    ret = scenario.retirement
    if not ret.social_security_enabled or ret.ss_fra_monthly <= 0 or age < ret.ss_claim_age:
        return 0.0
    factor_record = _domain_lookup(domains, "ss_claim_factors", f"ss_claim_{int(ret.ss_claim_age)}") or {"factor": 1.0}
    cola = _rule(domains, "ss_cola_default", default=0.025)
    years_claimed = age - int(ret.ss_claim_age)
    return ret.ss_fra_monthly * 12 * float(factor_record["factor"]) * ((1 + cola) ** years_claimed)


def _ss_taxable_portion(ss_annual: float, other_gross: float, domains: dict) -> float:
    """Simplified IRS provisional-income inclusion (0% / 50% / 85%), capped at 85%."""
    if ss_annual <= 0:
        return 0.0
    thresholds = _domain_lookup(domains, "ss_taxation_thresholds", "ss_tax_single") or {}
    lower = float(thresholds.get("lowerThreshold", 25000))
    upper = float(thresholds.get("upperThreshold", 34000))
    cap = float(thresholds.get("maxInclusion", 0.85))
    provisional = other_gross + 0.5 * ss_annual
    if provisional <= lower:
        return 0.0
    if provisional <= upper:
        return 0.5 * ss_annual
    return cap * ss_annual


def _rmd_for_age(domains: dict, age: int, trad_balance: float) -> float:
    record = _domain_lookup(domains, "rmd_divisors", f"rmd_{age}")
    if not record or trad_balance <= 0:
        return 0.0
    return trad_balance / float(record["divisor"])


def project_scenario_v2(
    scenario: ScenarioV2 | dict,
    planner_profile: dict,
    reference_tables: dict,
    manual_inputs: dict,
    reference_domains: dict | None = None,
) -> tuple[list[dict], dict]:
    """Project a composable V2 scenario with the full retirement lifecycle."""
    if isinstance(scenario, dict):
        scenario = ScenarioV2.from_dict(scenario)
    domains = merge_v2_reference_domains(
        hydrate_military_reference_domains(reference_domains or REFERENCE_DOMAINS, planner_profile)
    )

    base_year = int(planner_profile["baseYear"])
    start_age = int(planner_profile["startAge"])
    projection_years = int(planner_profile["projectionYears"])
    default_location = planner_profile.get("defaultLocationId", "sacramento_ca")

    expense_inputs = flatten_manual_finance_group(manual_inputs.get("expenses", []))
    asset_inputs = flatten_manual_finance_group(manual_inputs.get("assets", []))
    override_living_monthly = scenario.overrides.get("monthlyLivingExpenses")

    growth_policy = _domain_lookup(domains, "investment_policies", "portfolio_growth_core") or {}
    return_rate = float(growth_policy.get("annualReturnRate", 0.07))
    surplus_rate = float(growth_policy.get("surplusInvestmentRate", 0.2))
    withdrawal_rate = float(growth_policy.get("withdrawalRate", 0.04))
    inflation = _rule(domains, "inflation_general_default", default=0.025)
    va_cola = _rule(domains, "va_cola", default=0.028)
    capital_gains_rate = _rule(domains, "capital_gains_rate_default", default=0.15)
    match_rate_default = _rule(domains, "employer_match_effective_default", default=0.04)
    gi_months_total = int(_rule(domains, "gi_bill_usage_default", field="valueNumber", default=36))

    # --- Opening account ledger from Manual Finance assets --------------------
    accounts = {
        "cash": (
            _manual_asset_amount_any(asset_inputs, ["asset_checking", "checking_accounts"])
            + _manual_asset_amount_any(asset_inputs, ["asset_savings", "savings_accounts"])
        ),
        "brokerage": _manual_asset_amount_any(asset_inputs, ["asset_brokerage", "stocks_bonds"]),
        "rothIra": _manual_asset_amount_any(asset_inputs, ["asset_roth_ira", "ira_pensions"]),
        "tspRoth": _manual_asset_amount_any(asset_inputs, ["asset_tsp", "tsp"]),
        "trad401k": 0.0,
    }
    brokerage_basis = accounts["brokerage"]
    cash_floor = accounts["cash"]  # preserve the starting reserve as the floor

    exit = scenario.service_exit
    is_military_retirement = exit.type == "military_retirement"
    pension_info = derive_high3_pension(domains, planner_profile, exit.year, exit.month) if is_military_retirement else None
    pension_cola = float((_domain_lookup(domains, "pension_profiles", "high_3_path_a") or {}).get("colaRate", 0.028))
    va = _domain_lookup(domains, "va_disability", scenario.selected_va_rating_id)

    gi_months_remaining = gi_months_total if scenario.use_gi_bill else 0
    withdrawal_age = float(scenario.retirement.withdrawal_age_years)

    rows: list[YearProjection] = []
    totals = {"gross": 0.0, "taxFree": 0.0, "taxes": 0.0, "healthcare": 0.0, "netCf": 0.0,
              "match": 0.0, "unfunded": 0.0, "pensionPaid": 0.0, "ssPaid": 0.0}
    depletion_age: int | None = None
    pension_start_year: int | None = None
    ss_start_year: int | None = None

    for year_index in range(projection_years):
        calendar_year = base_year + year_index
        age = start_age + year_index
        segments = resolve_year_segments(scenario, planner_profile, year_index)
        lead = dominant_segment(segments)

        gross = 0.0
        tax_free = 0.0
        taxes = 0.0
        healthcare = 0.0
        living = 0.0
        contributions_by_account: dict[str, float] = {key: 0.0 for key in accounts}
        employer_match = 0.0
        income_breakdown: dict[str, Any] = {
            "militaryBasePay": 0.0, "militaryBah": 0.0, "militaryBas": 0.0, "pension": 0.0,
            "salaryBase": 0.0, "phdStipend": 0.0, "vaCompensation": 0.0,
            "giBillHousing": 0.0, "giBillBooks": 0.0, "socialSecurity": 0.0,
            "bonusPlaceholder": 0.0, "rsuPlaceholder": 0.0,
        }
        expense_breakdown_total: dict[str, float] = {}
        federal_tax = 0.0
        state_tax = 0.0
        segments_meta: list[dict[str, Any]] = []

        post_exit = any(seg.service_status != "active_duty" for seg in segments)

        for seg in segments:
            f = seg.fraction
            seg_gross = 0.0
            seg_tax_free = 0.0
            salary_annualized = 0.0

            if seg.activity_type == "active_duty":
                pay = _military_pay_for_year(domains, calendar_year)
                seg_gross = pay["basePay"] * f
                seg_tax_free = (pay["bah"] + pay["bas"]) * f
                income_breakdown["militaryBasePay"] += pay["basePay"] * f
                income_breakdown["militaryBah"] += pay["bah"] * f
                income_breakdown["militaryBas"] += pay["bas"] * f
            else:
                # Pension (military retirement only), with COLA from the exit year.
                if is_military_retirement and pension_info:
                    pension_annual = pension_info["annualAtRetirement"] * ((1 + pension_cola) ** seg.years_since_exit)
                    seg_gross += pension_annual * f
                    income_breakdown["pension"] += pension_annual * f
                    if pension_start_year is None:
                        pension_start_year = calendar_year
                # VA disability for any post-service segment.
                if scenario.use_va and va:
                    years_since_service = max(calendar_year - exit.year, 0)
                    va_annual = float(va.get("annual", 0)) * ((1 + va_cola) ** years_since_service)
                    seg_tax_free += va_annual * f
                    income_breakdown["vaCompensation"] += va_annual * f

                if seg.activity_type == "grad_school":
                    program = _domain_lookup(domains, "programs", seg.program_id) if seg.program_id else None
                    stipend = float((program or {}).get("stipendAnnual", 0) or 0)
                    seg_gross += stipend * f
                    income_breakdown["phdStipend"] += stipend * f
                    if gi_months_remaining > 0 and program:
                        benefit = _domain_lookup(domains, "gi_bill_benefits", program.get("giBillBenefitId"))
                        if benefit:
                            months_used = min(seg.months, gi_months_remaining)
                            gi_months_remaining -= months_used
                            mha = float(benefit.get("monthlyHousingAllowance", 0)) * months_used
                            books = float(benefit.get("booksSuppliesAnnual", 0)) * (months_used / 12.0)
                            seg_tax_free += mha + books
                            income_breakdown["giBillHousing"] += mha
                            income_breakdown["giBillBooks"] += books
                elif seg.activity_type in ("tech_career", "research_career"):
                    career = _career_profile(reference_tables, seg.career_profile_id) or {}
                    salary_annualized = salary_for_year(career, seg.years_in_activity)
                    seg_gross += salary_annualized * f
                    income_breakdown["salaryBase"] += salary_annualized * f
                    income_breakdown["bonusPlaceholder"] += salary_annualized * float(career.get("bonusPct", 0) or 0) * f
                    income_breakdown["rsuPlaceholder"] += float(career.get("annualRsu", 0) or 0) * f
                    match_rate = float(career.get("employerMatchRate", match_rate_default) or match_rate_default)
                    employer_match += salary_annualized * match_rate * f

            # Taxes for this segment (flat effective rates on taxable gross).
            tax_profile = _segment_tax_profile(seg, domains, salary_annualized)
            federal_tax += seg_gross * float(tax_profile.get("federalRate", 0) or 0)
            state_rate = float(tax_profile.get("stateRate", 0) or 0)
            if seg.activity_type == "retire":
                override_rate = scenario.overrides.get("retirementStateTaxRate")
                if isinstance(override_rate, (int, float)):
                    state_rate = float(override_rate)
            state_tax += seg_gross * state_rate

            # Healthcare + living expenses for this segment's location.
            seg_health, _health_id = _segment_healthcare(seg, domains, age)
            healthcare += seg_health * f
            location_id = _segment_location_id(seg, domains, default_location)
            location = _domain_lookup(domains, "locations", location_id)
            cost_profile = _domain_lookup(domains, "location_cost_profiles", (location or {}).get("costProfileId"))
            expense_growth = float((cost_profile or {}).get("annualGrowthRate", 0) or 0) or _rule(domains, "living_expense_growth_default", default=0.03)
            seg_expenses = _blended_expense_breakdown(
                expense_inputs, cost_profile, expense_growth, year_index,
                float(override_living_monthly) if override_living_monthly is not None else None,
                post_service=seg.activity_type != "active_duty",
            )
            for key, value in seg_expenses.items():
                expense_breakdown_total[key] = expense_breakdown_total.get(key, 0.0) + value * f
            living += sum(seg_expenses.values()) * f

            # Contributions for this segment.
            policy = _domain_lookup(domains, "investment_policies", _contribution_policy_id(seg.activity_type)) or {}
            contribution = float(policy.get("annualContribution", 0) or 0) * f
            if seg.activity_type == "retire":
                contribution = 0.0
            account_key = _account_for_destination(policy.get("destinationId"))
            contributions_by_account[account_key] += contribution

            gross += seg_gross
            tax_free += seg_tax_free
            segments_meta.append({
                "blockId": seg.block_id, "type": seg.block_type, "months": seg.months,
                "phaseLabel": seg.phase_label, "activityType": seg.activity_type,
            })

        # Social Security (independent of blocks once claimed).
        ss_annual = _ss_annual(scenario, domains, age) if post_exit else 0.0
        if ss_annual > 0:
            ss_taxable = _ss_taxable_portion(ss_annual, gross, domains)
            gross += ss_taxable
            tax_free += ss_annual - ss_taxable
            income_breakdown["socialSecurity"] = ss_annual
            retirement_fed = float((_domain_lookup(domains, "retirement_tax_profiles", "retirement_income_default") or {}).get("federalRate", 0.12))
            federal_tax += ss_taxable * retirement_fed
            totals["ssPaid"] += ss_annual
            if ss_start_year is None:
                ss_start_year = calendar_year

        retirement_contributions = sum(contributions_by_account.values())
        taxes = federal_tax + state_tax
        net_cash_flow = gross + tax_free - taxes - healthcare - living - retirement_contributions
        surplus_invested = max(net_cash_flow, 0.0) * surplus_rate

        # --- Ledger update ---------------------------------------------------
        growth_by_account = {key: (accounts[key] * return_rate if key != "cash" else 0.0) for key in accounts}
        for key, value in growth_by_account.items():
            accounts[key] += value
        for key, value in contributions_by_account.items():
            accounts[key] += value
        accounts["trad401k"] += employer_match
        accounts["brokerage"] += surplus_invested
        brokerage_basis += surplus_invested

        # Cover any deficit; in retirement also honor fixed-annual withdrawals.
        deficit = max(-net_cash_flow, 0.0) - surplus_invested if net_cash_flow < 0 else 0.0
        in_retire_block = any(seg.activity_type == "retire" for seg in segments)
        if in_retire_block and scenario.retirement.withdrawal_policy == "fixed_annual":
            deficit = max(deficit, float(scenario.retirement.fixed_annual_withdrawal))

        withdrawals = {"cash": 0.0, "brokerage": 0.0, "trad401k": 0.0, "tspRoth": 0.0, "rothIra": 0.0, "taxesOnWithdrawals": 0.0}
        unfunded = 0.0
        rmd_amount = 0.0

        if deficit > 0:
            need = deficit
            take_cash = min(max(accounts["cash"] - cash_floor, 0.0), need)
            accounts["cash"] -= take_cash
            withdrawals["cash"] = take_cash
            need -= take_cash

            if need > 0 and accounts["brokerage"] > 0:
                gain_fraction = max(1 - (brokerage_basis / accounts["brokerage"] if accounts["brokerage"] else 1.0), 0.0)
                effective_tax = gain_fraction * capital_gains_rate
                gross_needed = need / max(1 - effective_tax, 1e-9)
                take = min(accounts["brokerage"], gross_needed)
                tax_on_sale = take * effective_tax
                accounts["brokerage"] -= take
                brokerage_basis = max(brokerage_basis - take * (1 - gain_fraction), 0.0)
                withdrawals["brokerage"] = take
                withdrawals["taxesOnWithdrawals"] += tax_on_sale
                need -= take - tax_on_sale

            if need > 0 and age >= withdrawal_age:
                retirement_tax = _domain_lookup(domains, "retirement_tax_profiles", "retirement_income_default") or {}
                trad_rate = float(retirement_tax.get("federalRate", 0.12)) + float(retirement_tax.get("stateRate", 0.07))
                gross_needed = need / max(1 - trad_rate, 1e-9)
                take = min(accounts["trad401k"], gross_needed)
                accounts["trad401k"] -= take
                withdrawals["trad401k"] = take
                withdrawals["taxesOnWithdrawals"] += take * trad_rate
                need -= take * (1 - trad_rate)

                for roth_key in ("tspRoth", "rothIra"):
                    if need <= 0:
                        break
                    take = min(accounts[roth_key], need)
                    accounts[roth_key] -= take
                    withdrawals[roth_key] = take
                    need -= take

            if need > 1e-6:
                unfunded = need
                totals["unfunded"] += need
                if depletion_age is None and sum(accounts[key] for key in INVESTED_ACCOUNTS) <= 1.0:
                    depletion_age = age

        # RMDs on traditional balances from age 73 (withdraw max(spending, RMD)).
        if age >= 73:
            rmd_amount = _rmd_for_age(domains, age, accounts["trad401k"])
            extra_rmd = max(rmd_amount - withdrawals["trad401k"], 0.0)
            if extra_rmd > 0:
                take = min(accounts["trad401k"], extra_rmd)
                retirement_tax = _domain_lookup(domains, "retirement_tax_profiles", "retirement_income_default") or {}
                trad_rate = float(retirement_tax.get("federalRate", 0.12)) + float(retirement_tax.get("stateRate", 0.07))
                accounts["trad401k"] -= take
                after_tax = take * (1 - trad_rate)
                accounts["brokerage"] += after_tax  # reinvest unused after-tax RMD proceeds
                brokerage_basis += after_tax
                withdrawals["trad401k"] += take
                withdrawals["taxesOnWithdrawals"] += take * trad_rate

        portfolio = sum(accounts.values())
        totals["gross"] += gross
        totals["taxFree"] += tax_free
        totals["taxes"] += taxes + withdrawals["taxesOnWithdrawals"]
        totals["healthcare"] += healthcare
        totals["netCf"] += net_cash_flow
        totals["match"] += employer_match
        totals["pensionPaid"] += income_breakdown["pension"]

        real_factor = 1.0 / ((1 + inflation) ** year_index)
        expense_breakdown_total["healthcareProgramCost"] = healthcare
        expense_breakdown_total["livingExpensesTotal"] = living

        rows.append(
            YearProjection(
                scenario_id=scenario.id,
                year_index=year_index,
                calendar_year=calendar_year,
                age=age,
                phase_id=lead.phase_id,
                phase_label=lead.phase_label,
                service_status=lead.service_status,
                activity_type=lead.activity_type,
                gross_income=gross,
                tax_free_income=tax_free,
                taxes=taxes,
                healthcare_cost=healthcare,
                living_expenses=living,
                retirement_savings=retirement_contributions,
                net_cash_flow=net_cash_flow,
                portfolio=portfolio,
                positive_surplus_invested=surplus_invested,
                income_breakdown=income_breakdown,
                expense_breakdown=expense_breakdown_total,
                tax_breakdown={"federalTax": federal_tax, "stateTax": state_tax,
                               "withdrawalTax": withdrawals["taxesOnWithdrawals"],
                               "totalTaxes": taxes + withdrawals["taxesOnWithdrawals"]},
                savings_breakdown={"retirementSavings": retirement_contributions,
                                   "surplusInvested": surplus_invested,
                                   "employerMatch": employer_match},
                investment_breakdown={"contributions": {**contributions_by_account,
                                                        "employerMatch": employer_match,
                                                        "totalContributions": retirement_contributions + surplus_invested + employer_match},
                                      "growth": {"assumedReturnRate": return_rate,
                                                 "portfolioGrowth": sum(growth_by_account.values())}},
                portfolio_breakdown={"accounts": dict(accounts),
                                     "summary": {"investedPortfolio": sum(accounts[key] for key in INVESTED_ACCOUNTS),
                                                 "totalInvestableAssets": portfolio,
                                                 "brokerageCostBasis": brokerage_basis}},
                account_balances=dict(accounts),
                retirement_income={"pension": income_breakdown["pension"],
                                   "socialSecurity": income_breakdown["socialSecurity"],
                                   "vaCompensation": income_breakdown["vaCompensation"]},
                withdrawals=withdrawals,
                employer_match=employer_match,
                rmd_amount=rmd_amount,
                unfunded_spending=unfunded,
                real_dollar_factor=real_factor,
                segments_meta=segments_meta,
            )
        )

    milestone_rows = []
    for milestone in planner_profile.get("milestones", []):
        idx = int(milestone["yearIndex"])
        if 0 <= idx < len(rows):
            row = rows[idx]
            milestone_rows.append({
                "label": milestone["label"], "yearIndex": idx, "calendarYear": row.calendar_year,
                "age": row.age, "portfolio": _round(row.portfolio),
                "withdrawalAt4Pct": _round(row.portfolio * withdrawal_rate),
            })

    final_row = rows[-1]
    metrics = {
        "finalPortfolio": _round(final_row.portfolio),
        "finalPortfolioReal": _round(final_row.portfolio * final_row.real_dollar_factor),
        "totalGrossIncome": _round(totals["gross"]),
        "totalTaxFreeIncome": _round(totals["taxFree"]),
        "totalTaxes": _round(totals["taxes"]),
        "totalHealthcareCost": _round(totals["healthcare"]),
        "totalNetCashFlow": _round(totals["netCf"]),
        "totalEmployerMatch": _round(totals["match"]),
        "totalUnfundedSpending": _round(totals["unfunded"]),
        "lifetimePensionValue": _round(totals["pensionPaid"]),
        "lifetimeSocialSecurity": _round(totals["ssPaid"]),
        "pensionStartYear": pension_start_year,
        "ssStartYear": ss_start_year,
        "withdrawalEligibleYear": base_year + max(int(withdrawal_age - start_age + 0.999), 0),
        "depletionAge": depletion_age,
        "milestones": milestone_rows,
    }
    return [row.as_dict() for row in rows], metrics


def compare_scenarios_v2(results: dict[str, dict], baseline_id: str | None = None) -> dict:
    """Comparison layer: sustained breakeven + biggest direct cash-flow driver."""
    ids = list(results.keys())
    if not ids:
        return {"baselineScenarioId": None, "comparisons": []}
    baseline_id = baseline_id if baseline_id in results else ids[0]
    base = results[baseline_id]

    driver_fields = [
        ("totalIncome", "Total income", 1),
        ("taxes", "Taxes", -1),
        ("healthcareCost", "Healthcare", -1),
        ("livingExpenses", "Living costs", -1),
        ("employerMatch", "Employer match", 1),
    ]

    comparisons = []
    for scenario_id in ids:
        if scenario_id == baseline_id:
            continue
        candidate = results[scenario_id]
        base_rows = base["projection"]
        cand_rows = candidate["projection"]

        # Sustained breakeven: first year the candidate-minus-baseline portfolio
        # delta turns >= 0 and never goes negative again.
        breakeven_year = None
        deltas = [c["portfolio"] - b["portfolio"] for b, c in zip(base_rows, cand_rows)]
        for idx, delta in enumerate(deltas):
            if delta >= 0 and all(d >= 0 for d in deltas[idx:]):
                breakeven_year = cand_rows[idx]["calendarYear"]
                break

        cumulative: dict[str, float] = {}
        for field_key, label, sign in driver_fields:
            base_total = sum(float(row.get(field_key, 0) or 0) for row in base_rows)
            cand_total = sum(float(row.get(field_key, 0) or 0) for row in cand_rows)
            cumulative[label] = sign * (cand_total - base_total)
        biggest_driver = max(cumulative.items(), key=lambda item: abs(item[1]))

        comparisons.append({
            "baselineScenarioId": baseline_id,
            "scenarioId": scenario_id,
            "finalPortfolioDelta": _round(candidate["metrics"]["finalPortfolio"] - base["metrics"]["finalPortfolio"]),
            "finalPortfolioRealDelta": _round(candidate["metrics"].get("finalPortfolioReal", 0) - base["metrics"].get("finalPortfolioReal", 0)),
            "totalTaxesDelta": _round(candidate["metrics"]["totalTaxes"] - base["metrics"]["totalTaxes"]),
            "healthcareCostDelta": _round(candidate["metrics"]["totalHealthcareCost"] - base["metrics"]["totalHealthcareCost"]),
            "breakevenYear": breakeven_year,
            "biggestDriver": {"label": biggest_driver[0], "cumulativeDelta": _round(biggest_driver[1])},
            "drivers": {label: _round(value) for label, value in cumulative.items()},
        })
    return {"baselineScenarioId": baseline_id, "comparisons": comparisons}
