from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ReferenceOption:
    id: str
    label: str
    category: str
    values: dict[str, Any]


@dataclass
class PhaseDefinition:
    id: str
    label: str
    start_year_index: int
    end_year_index: int
    formula_key: str


@dataclass
class ScenarioFork:
    id: str
    name: str
    path_template_id: str
    path_timeline: dict[str, Any] = field(default_factory=dict)
    enabled: bool = True
    notes: str = ""
    display_name: str | None = None
    route_summary: str | None = None
    color_token: str | None = None
    is_loaded: bool = False
    display_order: int = 0
    selected_company_id: str | None = None
    selected_employer_id: str | None = None
    selected_va_rating_id: str = "30"
    selected_phd_program_id: str | None = None
    use_va: bool = True
    use_gi_bill: bool = True
    overrides: dict[str, Any] = field(default_factory=dict)


@dataclass
class YearProjection:
    scenario_id: str
    year_index: int
    calendar_year: int
    age: int
    phase_id: str
    phase_label: str
    service_status: str
    activity_type: str
    gross_income: float
    tax_free_income: float
    taxes: float
    healthcare_cost: float
    living_expenses: float
    retirement_savings: float
    net_cash_flow: float
    portfolio: float
    positive_surplus_invested: float
    income_breakdown: dict[str, Any] = field(default_factory=dict)
    expense_breakdown: dict[str, Any] = field(default_factory=dict)
    tax_breakdown: dict[str, Any] = field(default_factory=dict)
    savings_breakdown: dict[str, Any] = field(default_factory=dict)
    investment_breakdown: dict[str, Any] = field(default_factory=dict)
    portfolio_breakdown: dict[str, Any] = field(default_factory=dict)
    formula_meta: dict[str, Any] = field(default_factory=dict)
    source_refs: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        total_income = self.gross_income + self.tax_free_income
        return {
            "scenarioId": self.scenario_id,
            "yearIndex": self.year_index,
            "calendarYear": self.calendar_year,
            "age": self.age,
            "phaseId": self.phase_id,
            "phaseLabel": self.phase_label,
            "serviceStatus": self.service_status,
            "activityType": self.activity_type,
            "grossIncome": round(self.gross_income, 2),
            "taxFreeIncome": round(self.tax_free_income, 2),
            "totalIncome": round(total_income, 2),
            "taxes": round(self.taxes, 2),
            "healthcareCost": round(self.healthcare_cost, 2),
            "livingExpenses": round(self.living_expenses, 2),
            "retirementSavings": round(self.retirement_savings, 2),
            "netCashFlow": round(self.net_cash_flow, 2),
            "portfolio": round(self.portfolio, 2),
            "positiveSurplusInvested": round(self.positive_surplus_invested, 2),
            "incomeBreakdown": round_nested(self.income_breakdown),
            "expenseBreakdown": round_nested(self.expense_breakdown),
            "taxBreakdown": round_nested(self.tax_breakdown),
            "savingsBreakdown": round_nested(self.savings_breakdown),
            "investmentBreakdown": round_nested(self.investment_breakdown),
            "portfolioBreakdown": round_nested(self.portfolio_breakdown),
            "formulaMeta": round_nested(self.formula_meta),
            "sourceRefs": self.source_refs,
        }


def round_nested(value: Any) -> Any:
    if isinstance(value, float):
        return round(value, 4 if abs(value) < 1 else 2)
    if isinstance(value, list):
        return [round_nested(item) for item in value]
    if isinstance(value, dict):
        return {key: round_nested(item) for key, item in value.items()}
    return value
