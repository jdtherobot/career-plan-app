"""Year-by-year line items: the backbone of the editable schedules.

Every projection year computes a *calculated* annual value for each line below,
then applies the user's per-path overrides (``scenario.lineOverrides``: a monthly
amount per calendar year), then re-derives the lines that depend on another line
(OHA follows rent, school payments follow tuition) before the year's totals are
summed. The engine reports each line's calculated value, final value, how many
months it applied, and a status/note so the UI can show *why* a value is what
it is (e.g. "covered by OHA", "government quarters").
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# kind: income lines add to cash in, expense lines to cash out.
# taxable: taxable income (taxes follow edits to these lines).
# breakdown: the legacy incomeBreakdown / expenseBreakdown key the line feeds.
LINE_DEFS: list[dict[str, Any]] = [
    # --- Active duty -------------------------------------------------------
    {"id": "basePay", "label": "Base pay", "kind": "income", "group": "Military pay", "taxable": True, "breakdown": "militaryBasePay"},
    {"id": "bah", "label": "BAH (housing)", "kind": "income", "group": "Military pay", "breakdown": "militaryBah",
     "help": "Basic Allowance for Housing at a stateside duty station — paid in cash whatever your rent is."},
    {"id": "oha", "label": "OHA (overseas housing)", "kind": "income", "group": "Military pay", "breakdown": "militaryOha",
     "help": "Overseas Housing Allowance reimburses actual rent up to a cap; you keep nothing above your rent, so it nets against Housing."},
    {"id": "ua", "label": "Utility allowance (OHA)", "kind": "income", "group": "Military pay", "breakdown": "militaryUa",
     "help": "OHA utility/recurring-maintenance allowance — a flat monthly amount paid with OHA."},
    {"id": "cola", "label": "Overseas COLA", "kind": "income", "group": "Military pay", "breakdown": "militaryCola",
     "help": "Overseas cost-of-living allowance; varies with grade, years of service, dependents and the exchange rate."},
    {"id": "bas", "label": "BAS (food)", "kind": "income", "group": "Military pay", "breakdown": "militaryBas"},
    {"id": "miha", "label": "MIHA (move-in allowance)", "kind": "income", "group": "Military pay", "breakdown": "militaryMiha",
     "help": "One-time Overseas Move-In Housing Allowance, paid when you set up off-base housing overseas."},
    # --- After service -----------------------------------------------------
    {"id": "pension", "label": "Military pension", "kind": "income", "group": "Retirement & VA", "taxable": True, "breakdown": "pension"},
    {"id": "va", "label": "VA disability", "kind": "income", "group": "Retirement & VA", "breakdown": "vaCompensation"},
    {"id": "salary", "label": "Salary", "kind": "income", "group": "Work", "taxable": True, "breakdown": "salaryBase"},
    {"id": "stipend", "label": "Grad stipend", "kind": "income", "group": "School", "taxable": True, "breakdown": "phdStipend"},
    {"id": "giHousing", "label": "GI Bill housing (MHA)", "kind": "income", "group": "School", "breakdown": "giBillHousing"},
    {"id": "giBooks", "label": "GI Bill books stipend", "kind": "income", "group": "School", "breakdown": "giBillBooks"},
    {"id": "vreSubsistence", "label": "VR&E subsistence", "kind": "income", "group": "School", "breakdown": "vreSubsistence"},
    {"id": "tuitionPaid", "label": "Tuition paid by VA", "kind": "income", "group": "School", "breakdown": "tuitionPaidByVa",
     "help": "Tuition and fees the GI Bill or VR&E pays the school directly. Shown so tuition is visibly accounted for; it nets against Tuition & fees."},
    {"id": "socialSecurity", "label": "Social Security", "kind": "income", "group": "Retirement & VA", "breakdown": "socialSecurity", "editable": False},
    # --- Living costs ------------------------------------------------------
    {"id": "housing", "label": "Housing / rent", "kind": "expense", "group": "Living", "breakdown": "housing"},
    {"id": "utilities", "label": "Utilities", "kind": "expense", "group": "Living", "breakdown": "utilities"},
    {"id": "transportation", "label": "Transportation", "kind": "expense", "group": "Living", "breakdown": "transportation"},
    {"id": "food", "label": "Food", "kind": "expense", "group": "Living", "breakdown": "food"},
    {"id": "insurance", "label": "Insurance", "kind": "expense", "group": "Living", "breakdown": "insurance"},
    {"id": "healthcareOutOfPocket", "label": "Health out-of-pocket", "kind": "expense", "group": "Living", "breakdown": "healthcareOutOfPocket"},
    {"id": "personal", "label": "Personal", "kind": "expense", "group": "Living", "breakdown": "personal"},
    {"id": "entertainment", "label": "Entertainment", "kind": "expense", "group": "Living", "breakdown": "entertainment"},
    {"id": "gifts", "label": "Gifts", "kind": "expense", "group": "Living", "breakdown": "gifts"},
    {"id": "miscellaneous", "label": "Miscellaneous", "kind": "expense", "group": "Living", "breakdown": "miscellaneous"},
    {"id": "tuitionFees", "label": "Tuition & fees", "kind": "expense", "group": "School", "breakdown": "tuitionFees"},
    {"id": "moveIn", "label": "Move-in costs (overseas)", "kind": "expense", "group": "Living", "breakdown": "moveIn",
     "help": "One-time costs of setting up overseas housing; MIHA reimburses them."},
    {"id": "healthcare", "label": "Health coverage (premiums)", "kind": "expense", "group": "Health", "breakdown": "healthcareProgramCost"},
]

LINE_BY_ID = {line["id"]: line for line in LINE_DEFS}
LIVING_LINE_IDS = [line["id"] for line in LINE_DEFS if line["group"] == "Living"]
HOUSEHOLD_PREFIX = "hh:"


@dataclass
class LineYear:
    calc: float = 0.0  # annual, before user edits
    months: float = 0.0  # months of the year the line applies (override = monthly x months)
    status: str | None = None  # covered | quarters | partial | estimate
    notes: list[str] = field(default_factory=list)
    fed_tax: float = 0.0  # tax attributed to this line's calc amount
    state_tax: float = 0.0

    def add(self, amount: float, months: float) -> None:
        self.calc += amount
        self.months = min(self.months + months, 12.0)

    def note(self, text: str) -> None:
        if text and text not in self.notes:
            self.notes.append(text)


class YearLines:
    """Calculated lines for one projection year plus coupling metadata."""

    def __init__(self) -> None:
        self.lines: dict[str, LineYear] = {}
        # OHA coupling: months on OHA and the rent cap (monthly USD) for those months.
        self.oha_months = 0.0
        self.oha_cap_monthly = 0.0
        # School coupling: how much of tuition the VA pays.
        self.tuition_cover: list[dict[str, float]] = []  # {"months", "capAnnual" (None = full)}

    def get(self, line_id: str) -> LineYear:
        if line_id not in self.lines:
            self.lines[line_id] = LineYear()
        return self.lines[line_id]

    def add(self, line_id: str, amount: float, months: float) -> LineYear:
        line = self.get(line_id)
        line.add(amount, months)
        return line


def override_for(overrides: dict[str, dict[str, float]], line_id: str, calendar_year: int) -> float | None:
    by_year = overrides.get(line_id) or {}
    value = by_year.get(str(calendar_year))
    return float(value) if isinstance(value, (int, float)) else None


def resolve_year_lines(
    year_lines: YearLines,
    overrides: dict[str, dict[str, float]],
    calendar_year: int,
    fallback_tax: tuple[float, float],
) -> dict[str, dict[str, Any]]:
    """Apply the user's edits, re-derive coupled lines, and return the final lines.

    Returns {lineId: {calc, value, months, overridden, status, notes, fedTax, stateTax}}
    where calc/value are annual amounts.
    """
    final: dict[str, dict[str, Any]] = {}

    def value_of(line_id: str, line: LineYear) -> tuple[float, bool]:
        edited = override_for(overrides, line_id, calendar_year)
        if edited is None or line.months <= 0:
            return line.calc, False
        return edited * line.months, True

    for line_id, line in year_lines.lines.items():
        value, overridden = value_of(line_id, line)
        final[line_id] = {
            "calc": line.calc,
            "value": value,
            "months": line.months,
            "overridden": overridden,
            "status": line.status,
            "notes": list(line.notes),
        }

    # OHA follows an edited rent (min(rent, cap) for the OHA months) unless OHA
    # itself was edited.
    if year_lines.oha_months > 0 and "oha" in final and not final["oha"]["overridden"]:
        housing = final.get("housing")
        if housing and housing["overridden"]:
            rent_monthly = housing["value"] / max(housing["months"], 1e-9)
            cap = year_lines.oha_cap_monthly
            final["oha"]["value"] = min(rent_monthly, cap) * year_lines.oha_months
            if cap > 0:
                over = rent_monthly > cap + 0.5
                housing["status"] = "partial" if over else "covered"
                housing["notes"] = [
                    f"Your rent is above the OHA cap (${cap:,.0f}/mo) — you pay the difference."
                    if over else "Rent is covered by OHA (up to the cap) — OHA and rent net to $0."
                ]

    # VA school payments follow edited tuition unless edited themselves.
    if year_lines.tuition_cover and "tuitionPaid" in final and not final["tuitionPaid"]["overridden"]:
        tuition = final.get("tuitionFees")
        if tuition and tuition["overridden"]:
            monthly_cost = tuition["value"] / max(tuition["months"], 1e-9)
            paid = 0.0
            for cover in year_lines.tuition_cover:
                cost = monthly_cost * cover["months"]
                cap = cover.get("capAnnual")
                paid += cost if cap is None else min(cost, cap * cover["months"] / 12.0)
            final["tuitionPaid"]["value"] = paid

    # Taxes follow edits to taxable lines.
    for line_id, entry in final.items():
        line = year_lines.lines[line_id]
        definition = LINE_BY_ID.get(line_id, {})
        if not definition.get("taxable"):
            entry["fedTax"] = entry["stateTax"] = 0.0
            continue
        if line.calc > 0:
            scale = entry["value"] / line.calc
            entry["fedTax"] = line.fed_tax * scale
            entry["stateTax"] = line.state_tax * scale
        else:
            entry["fedTax"] = entry["value"] * fallback_tax[0]
            entry["stateTax"] = entry["value"] * fallback_tax[1]
    return final


def household_lines(profile: dict[str, Any], calendar_year: int) -> list[dict[str, Any]]:
    """Household members' cost lines active in a year: [{id, label, monthly, category}]."""
    active: list[dict[str, Any]] = []
    for member in profile.get("household") or []:
        start = member.get("fromYear")
        end = member.get("toYear")
        if start is not None and calendar_year < int(start):
            continue
        if end not in (None, "") and calendar_year > int(end):
            continue
        name = member.get("name") or "Household member"
        for item in member.get("costs") or []:
            monthly = float(item.get("monthly", 0) or 0)
            active.append({
                "id": f"{HOUSEHOLD_PREFIX}{member.get('id')}:{item.get('id')}",
                "label": f"{name} · {item.get('label') or 'Cost'}",
                "monthly": monthly,
                "category": item.get("category") or "miscellaneous",
            })
    return active


def household_has_dependents(profile: dict[str, Any], calendar_year: int, for_allowances: bool = False) -> bool | None:
    """True/False when a household is defined; None when it isn't (use the service flag).

    for_allowances=True counts only dependents marked `livesWithYou` — the
    with-dependent BAH / OHA / COLA rates need them living with you. A
    dependent who doesn't (e.g. stays stateside) still counts for family
    health coverage (for_allowances=False)."""
    members = profile.get("household") or []
    if not members:
        return None
    for member in members:
        start = member.get("fromYear")
        end = member.get("toYear")
        if start is not None and calendar_year < int(start):
            continue
        if end not in (None, "") and calendar_year > int(end):
            continue
        if member.get("dependent", True) and (not for_allowances or member.get("livesWithYou", False)):
            return True
    return False
