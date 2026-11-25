"""Grad-school money: stipends, tuition, and the two VA education benefits.

Post-9/11 GI Bill (Ch. 33) — 36 months:
  * Tuition & fees paid to the school: in full at public schools (in-state rate
    for veterans), up to the national cap per academic year at private and
    foreign schools. A full tuition waiver means there is nothing to pay.
  * Monthly housing allowance (school-ZIP E-5 w/dep BAH; a flat national rate
    for foreign schools) and up to $1,000/yr for books — tax-free cash.
VR&E (Ch. 31):
  * Tuition, fees, books and required supplies paid in full (no cap).
  * Monthly subsistence: the Post-9/11 rate (same as the MHA above) when the
    veteran is Post-9/11 eligible; otherwise the Ch. 31 table.
  * Up to 48 months, less any GI Bill months already used. VR&E months do not
    reduce the GI Bill's 36.
Both pay only while enrolled; the planner assumes full-time, year-round
enrollment for the months a grad block covers. Stipends are taxable; VA
payments are not.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .engine import _domain_lookup
from .lines import YearLines

_EDU_PATH = Path(__file__).resolve().parent / "data_education_benefits_2026.json"
_edu_cache: dict[str, Any] | None = None


def load_education_rules() -> dict[str, Any]:
    global _edu_cache
    if _edu_cache is None:
        _edu_cache = json.loads(_EDU_PATH.read_text(encoding="utf-8")) if _EDU_PATH.exists() else {}
    return _edu_cache.get("rules", {})


def _funding_source(program: dict[str, Any] | None, source_id: str | None) -> dict[str, Any] | None:
    if not program or not source_id:
        return None
    for source in program.get("fundingSources") or []:
        if source.get("id") == source_id:
            return source
    return None


def stipend_for(program: dict[str, Any] | None, segment: Any) -> tuple[bool, float]:
    """(funded_this_year, annual stipend) for a grad segment.

    A program funds its first `fundedYears` years (None = every year of the
    block) at `stipendAnnual`. An optional outside funding source chosen on the
    block (e.g. MEXT) replaces it for that source's years.
    """
    if not program:
        return False, 0.0
    year_in = int(segment.years_in_activity)
    source = _funding_source(program, getattr(segment, "funding_source_id", None))
    if source:
        years = source.get("years")
        if years is None or year_in < float(years):
            return True, float(source.get("stipendAnnual", 0) or 0)
    funded_years = program.get("fundedYears")
    stipend = float(program.get("stipendAnnual", 0) or 0)
    if stipend <= 0:
        return False, 0.0
    if funded_years is None or year_in < float(funded_years):
        return True, stipend
    return False, 0.0


def benefit_choice(segment: Any, scenario: Any) -> str:
    return segment.benefit or ("gi_bill" if scenario.use_gi_bill else "none")


def _vre_ch31_rate(rules: dict[str, Any], dependents: bool) -> float:
    table = rules.get("vreCh31FullTimeMonthly") or {}
    return float(table.get("oneDependent" if dependents else "noDependents", 0) or 0)


def apply_education(
    year_lines: YearLines,
    segment: Any,
    program: dict[str, Any] | None,
    domains: dict,
    rules: dict[str, Any],
    ledger: dict[str, float],
    scenario: Any,
    dependents: bool,
    funded_this_year: bool,
) -> dict[str, float]:
    """Add tuition, VA payments and housing/subsistence for one grad segment."""
    months = float(segment.months)
    f = months / 12.0
    if not program:
        return ledger

    tuition_annual = float(program.get("tuitionAnnual", 0) or 0) + float(program.get("feesAnnual", 0) or 0)
    source = _funding_source(program, getattr(segment, "funding_source_id", None))
    source_waives = bool(source and source.get("waivesTuition")) and funded_this_year
    waived = (bool(program.get("tuitionWaived")) and funded_this_year) or source_waives
    tuition_line = year_lines.get("tuitionFees")
    if waived:
        tuition_annual = 0.0
        tuition_line.note("Tuition is waived while the program funds you.")
    if tuition_annual > 0:
        year_lines.add("tuitionFees", tuition_annual * f, months)
    admission = 0.0 if source_waives else float(program.get("admissionFee", 0) or 0)
    if admission > 0 and int(segment.years_in_activity) == 0:  # the block's first year
        year_lines.add("tuitionFees", admission, months)
        tuition_line.note(f"Includes the one-time admission fee (${admission:,.0f}) in the first year.")
        tuition_annual += admission / max(f, 1e-9)  # so the VA coverage below includes it

    benefit = benefit_choice(segment, scenario)
    record = _domain_lookup(domains, "gi_bill_benefits", program.get("giBillBenefitId")) if program.get("giBillBenefitId") else None
    approved = bool(record) and float((record or {}).get("vaProgramApproved", 1) or 0) >= 1
    assumed = bool((getattr(segment, "block_overrides", None) or {}).get("assumeVaApproved"))
    if assumed and not approved:
        approved = True
        target = "giHousing" if benefit_choice(segment, scenario) == "gi_bill" else "vreSubsistence"
        year_lines.get(target).note("VA approval is ASSUMED for this program (not confirmed) — the school must be approved before you enroll.")
    foreign = (record or {}).get("deliveryMode") == "foreign_school" or program.get("schoolType") == "foreign"
    mha = float((record or {}).get("monthlyHousingAllowance", 0) or 0)
    if foreign and not mha:
        mha = float(rules.get("foreignMhaMonthly", 0) or 0)

    if benefit == "none":
        return ledger
    if not approved:
        target = "giHousing" if benefit == "gi_bill" else "vreSubsistence"
        year_lines.get(target).note("Program is not VA-approved — no VA education benefit pays here.")
        return ledger

    if benefit == "gi_bill":
        months_used = min(months, ledger["giRemaining"])
        if months_used <= 0:
            year_lines.get("giHousing").note("GI Bill entitlement (36 months) is used up.")
            return ledger
        ledger = {**ledger, "giRemaining": ledger["giRemaining"] - months_used, "giUsed": ledger["giUsed"] + months_used}
        year_lines.add("giHousing", mha * months_used, months_used).note(
            "Flat foreign-school housing rate." if foreign else "Housing allowance for the school's ZIP code (E-5 with-dependents BAH).")
        books_cap = float(rules.get("booksAnnualCap", 1000) or 1000)
        books = float((record or {}).get("booksSuppliesAnnual", books_cap) or books_cap)
        year_lines.add("giBooks", min(books, books_cap) * months_used / 12.0, months_used)
        if tuition_annual > 0:
            public = program.get("schoolType") == "public"
            cap = None if public else float(rules.get("tuitionCapPrivateForeignAnnual", 0) or 0)
            cost = tuition_annual * months_used / 12.0
            paid = cost if cap is None else min(cost, cap * months_used / 12.0)
            line = year_lines.add("tuitionPaid", paid, months_used)
            year_lines.tuition_cover.append({"months": months_used, "capAnnual": cap})
            if cap is None:
                line.note("Public school: the GI Bill pays in-state tuition and fees in full.")
                tuition_line.status = "covered"
            else:
                line.note(f"Private/foreign school: the GI Bill pays up to ${cap:,.0f} per academic year.")
                tuition_line.status = "covered" if paid >= cost - 0.5 else "partial"
        if months_used < months:
            year_lines.get("giHousing").note("GI Bill entitlement runs out partway through this year.")
        return ledger

    # VR&E: up to the 48-month cap less GI Bill months already used.
    cap_months = float(rules.get("vreEntitlementMonths", 48) or 48)
    available = max(cap_months - ledger["giUsed"] - ledger["vreUsed"], 0.0)
    months_used = min(months, available)
    if months_used <= 0:
        year_lines.get("vreSubsistence").note("VR&E entitlement (48 months, less GI Bill months used) is used up.")
        return ledger
    ledger = {**ledger, "vreUsed": ledger["vreUsed"] + months_used}
    if rules.get("vreSubsistenceDefault", "p911_rate") == "p911_rate" and mha > 0:
        rate = mha
        note = "Paid at the Post-9/11 rate (the school's GI Bill housing rate)."
    else:
        rate = _vre_ch31_rate(rules, dependents)
        note = "Paid at the Chapter 31 full-time rate."
    year_lines.add("vreSubsistence", rate * months_used, months_used).note(note)
    if tuition_annual > 0:
        cost = tuition_annual * months_used / 12.0
        year_lines.add("tuitionPaid", cost, months_used).note("VR&E pays tuition, fees and books in full.")
        year_lines.tuition_cover.append({"months": months_used, "capAnnual": None})
        tuition_line.status = "covered"
    year_lines.get("vreSubsistence").note("VR&E needs an employment handicap finding and a rehab plan that requires this degree.")
    if months_used < months:
        year_lines.get("vreSubsistence").note("VR&E entitlement runs out partway through this year.")
    return ledger
