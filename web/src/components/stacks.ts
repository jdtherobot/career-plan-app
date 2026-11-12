/* Category stacks: how each chart's total splits into parts, shared by the
   Dashboard bar view and the Explorer composition charts so a category keeps
   its colour everywhere. Each stack's parts sum to the chart's line metric. */

import { STACK_COLORS } from "../state/store";

export interface StackPart {
  id: string;
  name: string;
  color: string;
  metric: (row: any) => number;
  hatch?: boolean;
}

const C = STACK_COLORS;
const ib = (r: any) => r.incomeBreakdown ?? {};
const wd = (r: any) => r.withdrawals ?? {};

/* Every income source, kept separate so benefit timing is visible:
   pay and allowances, pension, salary, stipend, VA, GI Bill, Social Security. */
export const INCOME_PARTS: StackPart[] = [
  { id: "milPay", name: "Military base pay", color: C[0], metric: (r) => ib(r).militaryBasePay ?? 0 },
  { id: "allowances", name: "BAH + BAS", color: C[1], metric: (r) => (ib(r).militaryBah ?? 0) + (ib(r).militaryBas ?? 0) },
  { id: "pension", name: "Military pension", color: C[2], metric: (r) => ib(r).pension ?? 0 },
  { id: "salary", name: "Civilian salary", color: C[3], metric: (r) => ib(r).salaryBase ?? 0 },
  { id: "stipend", name: "Grad stipend", color: C[4], metric: (r) => ib(r).phdStipend ?? 0 },
  { id: "va", name: "VA disability", color: C[5], metric: (r) => ib(r).vaCompensation ?? 0 },
  { id: "gi", name: "GI Bill housing + books", color: C[6], metric: (r) => (ib(r).giBillHousing ?? 0) + (ib(r).giBillBooks ?? 0) },
  { id: "ss", name: "Social Security", color: C[7], metric: (r) => ib(r).socialSecurity ?? 0 },
];

/* Outflows drawn below zero; hatched because they reuse the first hues. */
export const OUTFLOW_PARTS: StackPart[] = [
  { id: "taxes", name: "Taxes", color: C[0], hatch: true, metric: (r) => -r.taxes },
  { id: "health", name: "Healthcare", color: C[1], hatch: true, metric: (r) => -r.healthcareCost },
  { id: "living", name: "Living expenses", color: C[2], hatch: true, metric: (r) => -r.livingExpenses },
  { id: "contrib", name: "Retirement contributions", color: C[3], hatch: true, metric: (r) => -r.retirementSavings },
];

export const SPENDING_PARTS: StackPart[] = [
  { id: "taxes", name: "Taxes", color: C[0], metric: (r) => r.taxes },
  { id: "health", name: "Healthcare", color: C[1], metric: (r) => r.healthcareCost },
  { id: "housing", name: "Housing", color: C[2], metric: (r) => r.expenseBreakdown?.housing ?? 0 },
  { id: "food", name: "Food", color: C[3], metric: (r) => r.expenseBreakdown?.food ?? 0 },
  { id: "transport", name: "Transport + utilities", color: C[4], metric: (r) => (r.expenseBreakdown?.transportation ?? 0) + (r.expenseBreakdown?.utilities ?? 0) },
  {
    id: "other", name: "Other living", color: C[5],
    metric: (r) => Math.max((r.livingExpenses ?? 0) - (r.expenseBreakdown?.housing ?? 0) - (r.expenseBreakdown?.food ?? 0) - (r.expenseBreakdown?.transportation ?? 0) - (r.expenseBreakdown?.utilities ?? 0), 0),
  },
];

export const ACCOUNT_PARTS: StackPart[] = [
  { id: "cash", name: "Cash", color: C[0], metric: (r) => r.accountBalances?.cash ?? 0 },
  { id: "brokerage", name: "Brokerage", color: C[1], metric: (r) => r.accountBalances?.brokerage ?? 0 },
  { id: "tsp", name: "TSP (Roth)", color: C[2], metric: (r) => r.accountBalances?.tspRoth ?? 0 },
  { id: "roth", name: "Roth IRA", color: C[3], metric: (r) => r.accountBalances?.rothIra ?? 0 },
  { id: "401k", name: "Trad 401(k)", color: C[4], metric: (r) => r.accountBalances?.trad401k ?? 0 },
];

export const SAVINGS_PARTS: StackPart[] = [
  { id: "contrib", name: "Retirement contributions", color: C[0], metric: (r) => r.retirementSavings },
  { id: "match", name: "Employer match", color: C[1], metric: (r) => r.employerMatch ?? 0 },
  { id: "surplus", name: "Surplus invested", color: C[2], metric: (r) => r.positiveSurplusInvested },
];

export const TAX_PARTS: StackPart[] = [
  { id: "federal", name: "Federal", color: C[0], metric: (r) => r.taxBreakdown?.federalTax ?? 0 },
  { id: "state", name: "State", color: C[1], metric: (r) => r.taxBreakdown?.stateTax ?? 0 },
  { id: "withdrawal", name: "On withdrawals", color: C[2], metric: (r) => wd(r).taxesOnWithdrawals ?? 0 },
];

export const HEALTHCARE_PARTS: StackPart[] = [
  { id: "health", name: "Healthcare", color: C[0], metric: (r) => r.healthcareCost },
];

/* Order validated as its own adjacent set (pension · withdrawals · VA · SS). */
export const RETIREMENT_INCOME_PARTS: StackPart[] = [
  { id: "pension", name: "Military pension", color: C[2], metric: (r) => r.retirementIncome?.pension ?? 0 },
  {
    id: "withdrawals", name: "Account withdrawals", color: C[0],
    metric: (r) => (wd(r).brokerage ?? 0) + (wd(r).trad401k ?? 0) + (wd(r).tspRoth ?? 0) + (wd(r).rothIra ?? 0) + (wd(r).cash ?? 0),
  },
  { id: "va", name: "VA disability", color: C[5], metric: (r) => r.retirementIncome?.vaCompensation ?? 0 },
  { id: "ss", name: "Social Security", color: C[7], metric: (r) => r.retirementIncome?.socialSecurity ?? 0 },
];

/* Bar-view stack for each Dashboard chart id. */
export const CHART_STACKS: Record<string, { parts: StackPart[]; totalLabel: string }> = {
  net_cf: { parts: [...INCOME_PARTS, ...OUTFLOW_PARTS], totalLabel: "Net cash flow" },
  portfolio: { parts: ACCOUNT_PARTS, totalLabel: "Total" },
  income: { parts: INCOME_PARTS, totalLabel: "Total income" },
  spending: { parts: SPENDING_PARTS, totalLabel: "Total expenses" },
  savings: { parts: SAVINGS_PARTS, totalLabel: "Total saved" },
  taxes: { parts: TAX_PARTS, totalLabel: "Total taxes" },
  healthcare: { parts: HEALTHCARE_PARTS, totalLabel: "Healthcare" },
  retirement_income: { parts: RETIREMENT_INCOME_PARTS, totalLabel: "Total" },
};

/* Tooltip context line: age and the phase(s) active that year. */
export function phaseLabel(row: any): string {
  if (!row) return "";
  const segs: any[] = row.segments ?? [];
  const phases = segs.length > 1 ? segs.map((s) => `${s.phaseLabel} (${s.months} mo)`).join(" → ") : row.phaseLabel;
  return `Age ${row.age} · ${phases}`;
}
