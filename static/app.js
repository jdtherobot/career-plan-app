const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const SLOT_CONFIGS = [
  { slotId: "slot_a", label: "Path A", colorToken: "sage" },
  { slotId: "slot_b", label: "Path B", colorToken: "amber" },
  { slotId: "slot_c", label: "Path C", colorToken: "azure" },
];

const METRIC_LABELS = {
  phaseLabel: "Phase",
  grossIncome: "Gross Income",
  taxFreeIncome: "Tax-Free Income",
  totalIncome: "Total Income",
  taxes: "Taxes",
  healthcareCost: "Healthcare",
  livingExpenses: "Living Expenses",
  netCashFlow: "Net Cash Flow",
  portfolio: "Portfolio",
  cumulativeNetCashFlow: "Cumulative Cash Flow",
};

const LEGACY_PATH_TEMPLATE_IDS = ["PATH_A", "PATH_B", "PATH_C"];
const LEGACY_PATH_TEMPLATE_FALLBACKS = {
  PATH_A: "Stay Military -> Retire -> PhD -> Research Scientist",
  PATH_B: "Separate -> Immediate Tech Career",
  PATH_C: "Separate -> Gap Year -> PhD -> Research Scientist",
};

function createSyntheticAggregateColumn({
  key,
  label,
  formulaKey,
  components,
  kind = "currency",
  sourceKeys = [],
  expression,
}) {
  return {
    key,
    label,
    kind,
    formulaKey,
    cellRole: "aggregate",
    components,
    sourceKeys,
    expression: expression || `${label} = sum of selected subsection values.`,
  };
}

const EXPLORER_SECTION_DEFS = {
  phase: {
    label: "Phase / Context",
    tone: "neutral",
    standardColumns: ["phaseLabel"],
    totalColumns: ["phaseLabel"],
    modeOptions: ["std", "off"],
    groups: [
      {
        key: "context",
        label: "Context",
        columns: [
          { key: "phaseLabel", label: "Phase", path: "phaseLabel", kind: "text" },
        ],
      },
    ],
  },
  income: {
    label: "Income",
    tone: "income",
    standardColumns: ["income.section.total", "grossIncome", "taxFreeIncome"],
    totalColumns: ["income.section.total"],
    modeOptions: ["std", "total", "all", "off", "custom"],
    groups: [
      {
        key: "sectionTotal",
        label: "Section Total",
        columns: [
          { key: "income.section.total", label: "Income Total", path: "totalIncome", kind: "currency", formulaKey: "totalIncome", sourceKey: "totalIncomeTotal", cellRole: "aggregate" },
        ],
      },
      {
        key: "salary",
        label: "Salary",
        columns: [
          createSyntheticAggregateColumn({
            key: "income.salary.total",
            label: "Salary Total",
            formulaKey: "incomeSalaryTotal",
            sourceKeys: ["militaryBasePay", "militaryBah", "militaryBas", "pension", "salaryBase", "salaryOther"],
            expression: "Salary Total = sum of military, pension, and civilian salary components in this subsection.",
            components: [
              { label: "Base Pay", path: "incomeBreakdown.salary.basePay" },
              { label: "BAH", path: "incomeBreakdown.salary.bah" },
              { label: "BAS", path: "incomeBreakdown.salary.bas" },
              { label: "Pension", path: "incomeBreakdown.salary.pension" },
              { label: "Civilian Salary", path: "incomeBreakdown.salary.civilianBase" },
              { label: "Other Salary", path: "incomeBreakdown.salary.other" },
            ],
          }),
          { key: "income.salary.basePay", label: "Base Pay", path: "incomeBreakdown.salary.basePay", kind: "currency", sourceKey: "militaryBasePay" },
          { key: "income.salary.bah", label: "BAH", path: "incomeBreakdown.salary.bah", kind: "currency", sourceKey: "militaryBah" },
          { key: "income.salary.bas", label: "BAS", path: "incomeBreakdown.salary.bas", kind: "currency", sourceKey: "militaryBas" },
          { key: "income.salary.pension", label: "Pension", path: "incomeBreakdown.salary.pension", kind: "currency", sourceKey: "pension" },
          { key: "income.salary.civilianBase", label: "Civilian Salary", path: "incomeBreakdown.salary.civilianBase", kind: "currency", sourceKey: "salaryBase" },
          { key: "income.salary.other", label: "Other Salary", path: "incomeBreakdown.salary.other", kind: "currency", sourceKey: "salaryOther" },
        ],
      },
      {
        key: "militarySchedule",
        label: "Military Schedule",
        columns: [
          createSyntheticAggregateColumn({
            key: "income.military.total",
            label: "Military Comp Total",
            formulaKey: "incomeMilitaryTotal",
            sourceKeys: ["militaryBasePay", "militaryBah", "militaryBas", "militaryProjectedGrade", "militaryYearsOfService", "militaryRaiseSchedule"],
            expression: "Military Comp Total = Base Pay + BAH + BAS for the resolved active-duty military schedule row.",
            components: [
              { label: "Base Pay", path: "incomeBreakdown.militaryBasePay" },
              { label: "BAH", path: "incomeBreakdown.militaryBah" },
              { label: "BAS", path: "incomeBreakdown.militaryBas" },
            ],
          }),
          { key: "income.military.grade", label: "Projected Grade", path: "incomeBreakdown.military.projectedPayGrade", kind: "text", sourceKey: "militaryProjectedGrade" },
          { key: "income.military.tafms", label: "TAFMS", path: "incomeBreakdown.military.yearsOfService", kind: "number", sourceKey: "militaryYearsOfService" },
          { key: "income.military.raise", label: "Raise Used", path: "incomeBreakdown.military.raisePercent", kind: "percent", sourceKey: "militaryRaiseSchedule" },
          { key: "income.military.basePay", label: "Base Pay", path: "incomeBreakdown.militaryBasePay", kind: "currency", sourceKey: "militaryBasePay" },
          { key: "income.military.bah", label: "BAH", path: "incomeBreakdown.militaryBah", kind: "currency", sourceKey: "militaryBah" },
          { key: "income.military.bas", label: "BAS", path: "incomeBreakdown.militaryBas", kind: "currency", sourceKey: "militaryBas" },
        ],
      },
      {
        key: "vaBenefits",
        label: "VA Benefits",
        columns: [
          createSyntheticAggregateColumn({
            key: "income.va.total",
            label: "VA Benefits Total",
            formulaKey: "incomeVaTotal",
            sourceKeys: ["vaCompensation"],
            expression: "VA Benefits Total = annual VA compensation for the selected rating.",
            components: [
              { label: "VA Compensation", path: "incomeBreakdown.va.compensation" },
            ],
          }),
          { key: "income.va.compensation", label: "VA Compensation", path: "incomeBreakdown.va.compensation", kind: "currency", sourceKey: "vaCompensation" },
        ],
      },
      {
        key: "giBillBenefits",
        label: "GI Bill Benefits",
        columns: [
          createSyntheticAggregateColumn({
            key: "income.giBill.total",
            label: "GI Bill Benefits Total",
            formulaKey: "incomeGiBillTotal",
            sourceKeys: ["giBillHousing", "giBillBooks", "giBillOther"],
            expression: "GI Bill Benefits Total = sum of GI Bill housing, books, and other support.",
            components: [
              { label: "GI Bill MHA", path: "incomeBreakdown.giBill.mha" },
              { label: "GI Bill Books & Supplies", path: "incomeBreakdown.giBill.booksSupplies" },
              { label: "Other GI Bill", path: "incomeBreakdown.giBill.other" },
            ],
          }),
          { key: "income.giBill.mha", label: "GI Bill MHA", path: "incomeBreakdown.giBill.mha", kind: "currency", sourceKey: "giBillHousing" },
          { key: "income.giBill.booksSupplies", label: "GI Bill Books & Supplies", path: "incomeBreakdown.giBill.booksSupplies", kind: "currency", sourceKey: "giBillBooks" },
          { key: "income.giBill.other", label: "Other GI Bill", path: "incomeBreakdown.giBill.other", kind: "currency", sourceKey: "giBillOther" },
        ],
      },
      {
        key: "gradSchoolBenefits",
        label: "Grad School Benefits",
        columns: [
          createSyntheticAggregateColumn({
            key: "income.gradSchool.total",
            label: "Grad School Benefits Total",
            formulaKey: "incomeGradSchoolTotal",
            sourceKeys: ["phdStipend", "gradSchoolOther"],
            expression: "Grad School Benefits Total = stipend plus any additional school support.",
            components: [
              { label: "Grad School Stipend", path: "incomeBreakdown.gradSchool.stipend" },
              { label: "Other School Support", path: "incomeBreakdown.gradSchool.other" },
            ],
          }),
          { key: "income.gradSchool.stipend", label: "Grad School Stipend", path: "incomeBreakdown.gradSchool.stipend", kind: "currency", sourceKey: "phdStipend" },
          { key: "income.gradSchool.other", label: "Other School Support", path: "incomeBreakdown.gradSchool.other", kind: "currency", sourceKey: "gradSchoolOther" },
        ],
      },
      {
        key: "totals",
        label: "Totals",
        columns: [
          { key: "grossIncome", label: "Gross Income", path: "grossIncome", kind: "currency", formulaKey: "grossIncome", cellRole: "aggregate" },
          { key: "taxFreeIncome", label: "Tax-Free Income", path: "taxFreeIncome", kind: "currency", formulaKey: "taxFreeIncome", cellRole: "aggregate" },
          { key: "totalIncome", label: "Total Income", path: "totalIncome", kind: "currency", formulaKey: "totalIncome", cellRole: "aggregate" },
        ],
      },
    ],
  },
  expenses: {
    label: "Expenses",
    tone: "expenses",
    standardColumns: ["expenses.section.total", "livingExpenses", "healthcareCost"],
    totalColumns: ["expenses.section.total"],
    modeOptions: ["std", "total", "all", "off", "custom"],
    groups: [
      {
        key: "sectionTotal",
        label: "Section Total",
        columns: [
          createSyntheticAggregateColumn({
            key: "expenses.section.total",
            label: "Expenses Total",
            formulaKey: "expensesSectionTotal",
            sourceKeys: ["livingExpenses", "healthcareCost"],
            expression: "Expenses Total = living expenses plus healthcare costs.",
            components: [
              { label: "Living Expenses Total", path: "livingExpenses" },
              { label: "Healthcare", path: "healthcareCost" },
            ],
          }),
        ],
      },
      {
        key: "healthcare",
        label: "Healthcare",
        columns: [
          createSyntheticAggregateColumn({
            key: "expense.healthcare.total",
            label: "Healthcare Total",
            formulaKey: "healthcareCostTotal",
            sourceKeys: ["healthcareCost"],
            expression: "Healthcare Total = annual healthcare costs for this projection row.",
            components: [
              { label: "Healthcare", path: "healthcareCost" },
            ],
          }),
          { key: "healthcareCost", label: "Healthcare", path: "healthcareCost", kind: "currency", sourceKey: "healthcareCost", cellRole: "aggregate" },
        ],
      },
      {
        key: "categories",
        label: "Living Expense Categories",
        columns: [
          { key: "livingExpenses", label: "Living Expenses Total", path: "livingExpenses", kind: "currency", formulaKey: "livingExpenses", sourceKey: "livingExpenses", cellRole: "aggregate" },
          { key: "expense.housing", label: "Housing", path: "expenseBreakdown.housing", kind: "currency", sourceKey: "housing" },
          { key: "expense.utilities", label: "Utilities", path: "expenseBreakdown.utilities", kind: "currency", sourceKey: "utilities" },
          { key: "expense.transportation", label: "Transportation", path: "expenseBreakdown.transportation", kind: "currency", sourceKey: "transportation" },
          { key: "expense.food", label: "Food", path: "expenseBreakdown.food", kind: "currency", sourceKey: "food" },
          { key: "expense.insurance", label: "Insurance", path: "expenseBreakdown.insurance", kind: "currency", sourceKey: "insurance" },
          { key: "expense.healthcareOutOfPocket", label: "Healthcare Out-of-Pocket", path: "expenseBreakdown.healthcareOutOfPocket", kind: "currency", sourceKey: "healthcareOutOfPocket" },
          { key: "expense.personal", label: "Personal", path: "expenseBreakdown.personal", kind: "currency", sourceKey: "personal" },
          { key: "expense.entertainment", label: "Entertainment", path: "expenseBreakdown.entertainment", kind: "currency", sourceKey: "entertainment" },
          { key: "expense.gifts", label: "Gifts", path: "expenseBreakdown.gifts", kind: "currency", sourceKey: "gifts" },
          { key: "expense.miscellaneous", label: "Miscellaneous", path: "expenseBreakdown.miscellaneous", kind: "currency", sourceKey: "miscellaneous" },
        ],
      },
    ],
  },
  taxes: {
    label: "Taxes",
    tone: "taxes",
    standardColumns: ["taxes.section.total", "tax.federal", "tax.state"],
    totalColumns: ["taxes.section.total"],
    modeOptions: ["std", "total", "all", "off", "custom"],
    groups: [
      {
        key: "sectionTotal",
        label: "Section Total",
        columns: [
          { key: "taxes.section.total", label: "Taxes Total", path: "taxes", kind: "currency", formulaKey: "taxes", sourceKey: "taxes", cellRole: "aggregate" },
        ],
      },
      {
        key: "taxes",
        label: "Taxes",
        columns: [
          { key: "taxes.group.total", label: "Taxes Group Total", path: "taxes", kind: "currency", formulaKey: "taxes", sourceKey: "taxes", cellRole: "aggregate" },
          { key: "tax.federal", label: "Federal Tax", path: "taxBreakdown.federal", kind: "currency", sourceKey: "taxes" },
          { key: "tax.state", label: "State Tax", path: "taxBreakdown.state", kind: "currency", sourceKey: "taxes" },
        ],
      },
    ],
  },
  investments: {
    label: "Investments",
    tone: "investments",
    standardColumns: ["investments.section.total", "investments.contributions.total", "investments.growth.portfolioGrowth"],
    totalColumns: ["investments.section.total"],
    modeOptions: ["std", "total", "all", "off", "custom"],
    groups: [
      {
        key: "sectionTotal",
        label: "Section Total",
        columns: [
          createSyntheticAggregateColumn({
            key: "investments.section.total",
            label: "Investments Total",
            formulaKey: "investmentsSectionTotal",
            sourceKeys: ["retirementContributions", "taxableContributions", "portfolioGrowth"],
            expression: "Investments Total = total contributions plus portfolio growth for the year.",
            components: [
              { label: "Total Contributions", path: "investmentBreakdown.contributions.totalContributions" },
              { label: "Portfolio Growth", path: "investmentBreakdown.growth.portfolioGrowth" },
            ],
          }),
        ],
      },
      {
        key: "contributions",
        label: "Contributions",
        columns: [
          { key: "investments.contributions.tsp", label: "TSP", path: "investmentBreakdown.contributions.tsp", kind: "currency", sourceKey: "retirementContributions" },
          { key: "investments.contributions.401k", label: "401(k)", path: "investmentBreakdown.contributions.401k", kind: "currency", sourceKey: "retirementContributions" },
          { key: "investments.contributions.rothIra", label: "Roth IRA", path: "investmentBreakdown.contributions.rothIra", kind: "currency", sourceKey: "retirementContributions" },
          { key: "investments.contributions.brokerage", label: "Brokerage", path: "investmentBreakdown.contributions.brokerage", kind: "currency", sourceKey: "taxableContributions" },
          { key: "investments.contributions.other", label: "Other", path: "investmentBreakdown.contributions.other", kind: "currency", sourceKey: "retirementContributions" },
          { key: "investments.contributions.retirement", label: "Retirement Contributions", path: "investmentBreakdown.contributions.retirementContributions", kind: "currency", formulaKey: "retirementSavings", sourceKey: "retirementContributions", cellRole: "aggregate" },
          { key: "investments.contributions.taxable", label: "Taxable Contributions", path: "investmentBreakdown.contributions.taxableContributions", kind: "currency", formulaKey: "positiveSurplusInvested", sourceKey: "taxableContributions", cellRole: "aggregate" },
          { key: "investments.contributions.total", label: "Total Contributions", path: "investmentBreakdown.contributions.totalContributions", kind: "currency", formulaKey: "totalContributions", sourceKey: "totalContributions", cellRole: "aggregate" },
        ],
      },
      {
        key: "growth",
        label: "Growth",
        columns: [
          createSyntheticAggregateColumn({
            key: "investments.growth.total",
            label: "Growth Total",
            formulaKey: "portfolioGrowth",
            sourceKeys: ["portfolioGrowth", "assumedReturnRate"],
            expression: "Growth Total = annual portfolio growth under the assumed return rate.",
            components: [
              { label: "Portfolio Growth", path: "investmentBreakdown.growth.portfolioGrowth" },
            ],
          }),
          { key: "investments.growth.portfolioGrowth", label: "Portfolio Growth", path: "investmentBreakdown.growth.portfolioGrowth", kind: "currency", formulaKey: "portfolioGrowth", sourceKey: "portfolioGrowth", cellRole: "aggregate" },
          { key: "investments.growth.assumedReturnRate", label: "Assumed Return Rate", path: "investmentBreakdown.growth.assumedReturnRate", kind: "percent", sourceKey: "assumedReturnRate" },
        ],
      },
    ],
  },
  cashflow: {
    label: "Cash Flow",
    tone: "neutral",
    standardColumns: ["netCashFlow"],
    totalColumns: ["cashflow.section.total"],
    modeOptions: ["std", "total", "all", "off", "custom"],
    groups: [
      {
        key: "sectionTotal",
        label: "Section Total",
        columns: [
          { key: "cashflow.section.total", label: "Cash Flow Total", path: "netCashFlow", kind: "currency", formulaKey: "netCashFlow", cellRole: "aggregate" },
        ],
      },
      {
        key: "cashflow",
        label: "Cash Flow",
        columns: [
          { key: "cashflow.group.total", label: "Cash Flow Group Total", path: "netCashFlow", kind: "currency", formulaKey: "netCashFlow", cellRole: "aggregate" },
          { key: "netCashFlow", label: "Net Cash Flow", path: "netCashFlow", kind: "currency", formulaKey: "netCashFlow", cellRole: "aggregate" },
        ],
      },
    ],
  },
  portfolio: {
    label: "Portfolio",
    tone: "portfolio",
    standardColumns: ["portfolio.section.total", "portfolio.summary.investedPortfolio", "portfolio.accounts.cashReserve"],
    totalColumns: ["portfolio.section.total"],
    modeOptions: ["std", "total", "all", "off", "custom"],
    groups: [
      {
        key: "sectionTotal",
        label: "Section Total",
        columns: [
          { key: "portfolio.section.total", label: "Portfolio Total", path: "portfolioBreakdown.summary.totalInvestableAssets", kind: "currency", formulaKey: "totalInvestableAssets", sourceKey: "totalInvestableAssets", cellRole: "aggregate" },
        ],
      },
      {
        key: "accounts",
        label: "Accounts",
        columns: [
          createSyntheticAggregateColumn({
            key: "portfolio.accounts.total",
            label: "Accounts Total",
            formulaKey: "portfolioAccountsTotal",
            sourceKeys: ["totalInvestableAssets"],
            expression: "Accounts Total = sum of all portfolio account balances in this row.",
            components: [
              { label: "TSP / 401(k)", path: "portfolioBreakdown.accounts.tsp401k" },
              { label: "Roth IRA", path: "portfolioBreakdown.accounts.rothIra" },
              { label: "Brokerage", path: "portfolioBreakdown.accounts.brokerage" },
              { label: "Cash Reserve", path: "portfolioBreakdown.accounts.cashReserve" },
            ],
          }),
          { key: "portfolio.accounts.tsp401k", label: "TSP / 401(k)", path: "portfolioBreakdown.accounts.tsp401k", kind: "currency", sourceKey: "investedPortfolio" },
          { key: "portfolio.accounts.rothIra", label: "Roth IRA", path: "portfolioBreakdown.accounts.rothIra", kind: "currency", sourceKey: "investedPortfolio" },
          { key: "portfolio.accounts.brokerage", label: "Brokerage", path: "portfolioBreakdown.accounts.brokerage", kind: "currency", sourceKey: "investedPortfolio" },
          { key: "portfolio.accounts.cashReserve", label: "Cash Reserve", path: "portfolioBreakdown.accounts.cashReserve", kind: "currency", sourceKey: "totalInvestableAssets" },
        ],
      },
      {
        key: "summary",
        label: "Summary",
        columns: [
          { key: "portfolio.summary.total", label: "Summary Total", path: "portfolioBreakdown.summary.totalInvestableAssets", kind: "currency", formulaKey: "totalInvestableAssets", sourceKey: "totalInvestableAssets", cellRole: "aggregate" },
          { key: "portfolio.summary.investedPortfolio", label: "Invested Portfolio", path: "portfolioBreakdown.summary.investedPortfolio", kind: "currency", formulaKey: "investedPortfolio", sourceKey: "investedPortfolio", cellRole: "aggregate" },
          { key: "portfolio.summary.totalInvestableAssets", label: "Total Investable Assets", path: "portfolioBreakdown.summary.totalInvestableAssets", kind: "currency", formulaKey: "totalInvestableAssets", sourceKey: "totalInvestableAssets", cellRole: "aggregate" },
        ],
      },
    ],
  },
};

const EXPLORER_SECTION_ORDER = ["phase", "income", "expenses", "taxes", "investments", "cashflow", "portfolio"];
const EXPLORER_ALL_SECTIONS_KEY = "__all_sections__";
const EXPLORER_FINANCIAL_SECTION_KEYS = ["income", "expenses", "taxes", "investments", "cashflow", "portfolio"];
const EXPLORER_SECTION_MODE_OPTIONS = {
  std: "STANDARD",
  total: "TOTAL",
  all: "ALL",
  off: "OFF",
  custom: "CUSTOM",
};

function buildExplorerCustomVisibility() {
  return Object.fromEntries(
    EXPLORER_SECTION_ORDER.map((sectionKey) => {
      const section = EXPLORER_SECTION_DEFS[sectionKey];
      const standard = new Set(section.standardColumns || []);
      const visibility = {};
      section.groups.flatMap((group) => group.columns).forEach((column) => {
        visibility[column.key] = standard.has(column.key);
      });
      return [sectionKey, visibility];
    }),
  );
}

const METRIC_GROUPS = {
  wealth: {
    label: "Wealth",
    tone: "wealth",
    metrics: ["portfolio"],
  },
  income: {
    label: "Income",
    tone: "income",
    metrics: ["totalIncome", "grossIncome", "taxFreeIncome", "netCashFlow"],
  },
  expenses: {
    label: "Expenses",
    tone: "expenses",
    metrics: ["livingExpenses", "healthcareCost"],
  },
  taxes: {
    label: "Taxes",
    tone: "taxes",
    metrics: ["taxes"],
  },
  comparison: {
    label: "Comparison",
    tone: "comparison",
    metrics: ["cumulativeNetCashFlow"],
  },
  custom: {
    label: "Custom",
    tone: "custom",
    metrics: [],
  },
};

const COLOR_STYLES = {
  sage: "#2f7d5c",
  amber: "#c46a1c",
  azure: "#1f6fb8",
  plum: "#8b5ac2",
  slate: "#4f6177",
};

const GROUP_COLOR_STYLES = {
  income: ["#2f7d5c", "#4c9b78", "#78b999", "#9fd1b8"],
  expenses: ["#c46a1c", "#d98a47", "#b55716", "#e8b383"],
  wealth: ["#1f6fb8", "#4b90d0", "#7ab1e0"],
  taxes: ["#8b5ac2", "#a374d1", "#6f42a5"],
  comparison: ["#4f6177", "#72839a", "#39485b"],
  custom: ["#1f2a36", "#637282"],
};

const METRIC_STYLES = {
  portfolio: { color: "#1f6fb8", fillAlpha: 0 },
  cumulativeNetCashFlow: { color: "#4f6177", fillAlpha: 0 },
  totalIncome: { color: "#2f7d5c", fillAlpha: 0.14 },
  grossIncome: { color: "#4c9b78", fillAlpha: 0.1 },
  taxFreeIncome: { color: "#9fd1b8", fillAlpha: 0.18 },
  netCashFlow: { color: "#1f6fb8", fillAlpha: 0.08 },
  livingExpenses: { color: "#c46a1c", fillAlpha: 0.12 },
  healthcareCost: { color: "#d98a47", fillAlpha: 0.16 },
  taxes: { color: "#8b5ac2", fillAlpha: 0.12 },
};

const METRIC_GROUP_BY_METRIC = Object.fromEntries(
  Object.entries(METRIC_GROUPS)
    .filter(([groupKey]) => groupKey !== "custom")
    .flatMap(([groupKey, config]) => config.metrics.map((metric) => [metric, groupKey])),
);

const WIDGET_VIEW_PRESETS = {
  wealth: { label: "Wealth", tone: "wealth", defaultMetrics: ["portfolio"], inlineMetrics: ["portfolio"] },
  income: { label: "Income", tone: "income", defaultMetrics: ["totalIncome"], inlineMetrics: ["totalIncome", "grossIncome", "taxFreeIncome", "netCashFlow"] },
  expenses: { label: "Expenses", tone: "expenses", defaultMetrics: ["livingExpenses"], inlineMetrics: ["livingExpenses", "healthcareCost"] },
  taxes: { label: "Taxes", tone: "taxes", defaultMetrics: ["taxes"], inlineMetrics: ["taxes"] },
  comparison: { label: "Comparison", tone: "comparison", defaultMetrics: ["cumulativeNetCashFlow"], inlineMetrics: ["cumulativeNetCashFlow"] },
  custom: { label: "Custom", tone: "custom", defaultMetrics: ["totalIncome", "taxFreeIncome"], inlineMetrics: [] },
};

const DEFAULT_WIDGETS = [
  { id: "widget_wealth", title: "Net Worth Trajectory", viewMode: "wealth", metrics: ["portfolio"], size: "1x2" },
  { id: "widget_cash", title: "Net Cash Flow Over Time", viewMode: "income", metrics: ["netCashFlow"], size: "1x2" },
  { id: "widget_income", title: "Income Composition", viewMode: "income", metrics: ["totalIncome"], size: "1x2" },
  { id: "widget_expenses", title: "Expense Composition", viewMode: "expenses", metrics: ["livingExpenses"], size: "1x2" },
  { id: "widget_compare", title: "Scenario Delta", viewMode: "comparison", metrics: ["cumulativeNetCashFlow"], size: "1x2" },
];

const DASHBOARD_V4_CHARTS = [
  {
    id: "v4_portfolio",
    title: "Investment Portfolio Growth",
    subtitle: "Projected portfolio trajectory across the selected horizon.",
    viewMode: "wealth",
    metrics: ["portfolio"],
    size: "1x1",
  },
  {
    id: "v4_cashflow",
    title: "Annual Net Cash Flow",
    subtitle: "Gross income plus tax-free income minus taxes, healthcare, living expenses, and retirement savings.",
    viewMode: "income",
    metrics: ["netCashFlow"],
    size: "1x1",
  },
  {
    id: "v4_gross",
    title: "Annual Gross Income",
    subtitle: "Taxable salary, pension, and stipend income by year.",
    viewMode: "income",
    metrics: ["grossIncome"],
    size: "1x1",
  },
  {
    id: "v4_taxfree",
    title: "Tax-Free Income",
    subtitle: "VA disability, GI Bill BAH, BAH/BAS, and other tax-free sources where applicable.",
    viewMode: "income",
    metrics: ["taxFreeIncome"],
    size: "1x1",
  },
  {
    id: "v4_cumulative",
    title: "Cumulative Cash Flow",
    subtitle: "Running total of annual net cash flow over the selected horizon.",
    viewMode: "comparison",
    metrics: ["cumulativeNetCashFlow"],
    size: "2x2",
  },
  {
    id: "v4_taxes",
    title: "Annual Taxes Paid",
    subtitle: "Tax burden by path and year at the current assumptions.",
    viewMode: "taxes",
    metrics: ["taxes"],
    size: "1x1",
  },
  {
    id: "v4_health",
    title: "Healthcare Costs",
    subtitle: "Healthcare cost differences across military, school, and civilian phases.",
    viewMode: "expenses",
    metrics: ["healthcareCost"],
    size: "1x1",
  },
];

const COLOR_SEQUENCE = ["sage", "amber", "azure", "plum", "slate"];

const TEST_VISUAL_DESIGNS = [
  {
    id: "analyst_core",
    nickname: "Analyst Core",
    summary: "A compact analyst workstation that prioritizes comparative reading and quick scenario scanning.",
  },
  {
    id: "story_stack",
    nickname: "Story Stack",
    summary: "A headline-first narrative layout that answers the top planning question before exposing supporting detail.",
  },
  {
    id: "strict_tufte",
    nickname: "Strict Tufte",
    summary: "A restrained, high data-ink interpretation with minimal ornament and direct analytical focus.",
  },
  {
    id: "codex_signature",
    nickname: "Codex Signature",
    summary: "A balanced original design that stays calm and information-rich while keeping the most useful context visible.",
  },
];

const CHART_INTERACTION = {
  minVisibleRows: 4,
  wheelZoomStep: 1,
  manualZoomStep: 2,
  manualPanStep: 1,
  panPixelsPerIndexFactor: 5.2,
};

const THEME_STORAGE_KEY = "career-plan-theme";
const EXPLORER_CUSTOM_VISIBILITY_STORAGE_KEY = "career-plan-explorer-custom-visibility-v1";
const REFERENCE_ADVANCED_STORAGE_KEY = "career-plan-reference-advanced-v1";
const REFERENCE_TABLE_HEIGHTS_STORAGE_KEY = "career-plan-reference-table-heights-v1";
const REFERENCE_COLUMN_WIDTHS_STORAGE_KEY = "career-plan-reference-column-widths-v1";
const REFERENCE_COLUMN_VISIBILITY_STORAGE_KEY = "career-plan-reference-column-visibility-v1";
const REFERENCE_FIT_MODES_STORAGE_KEY = "career-plan-reference-fit-modes-v1";
const shellRuntimeInfo = window.__plannerShellRuntime || null;

const state = {
  bootstrap: null,
  savedScenarios: [],
  workspaceSlots: [],
  previewResults: {},
  activeScreen: "dashboard-v4",
  editorSlotId: "slot_a",
  horizonYearIndex: 19,
  widgets: [],
  standaloneCharts: {},
  themePreference: readStoredTheme(),
  dashboardV4: {
    visualsHorizonYearIndex: 19,
    highlightsHorizonYearIndex: 19,
    highlightsSelectedSlotIds: [],
    charts: [],
    preview: {
      selectedSlotIds: [],
      mode: "values",
      metrics: ["phaseLabel", "totalIncome", "netCashFlow", "portfolio"],
      implicitBaselineFromSelection: true,
    },
  },
  dashboardV2Settings: {
    selectedSlotIds: [],
    focusSlotId: "slot_a",
  },
  dashboardSections: {
    order: ["visuals", "projections"],
    collapsed: {
      visuals: false,
      projections: false,
    },
  },
  previewSettings: {
    selectedSlotIds: [],
    mode: "values",
    baselineSlotId: "slot_a",
    metrics: ["phaseLabel", "totalIncome", "netCashFlow", "portfolio"],
  },
  explorerSettings: {
    selectedSlotIds: [],
    mode: "values",
    baselineSlotId: "slot_a",
    sectionOrder: [...EXPLORER_SECTION_ORDER],
    sectionModeByKey: Object.fromEntries(EXPLORER_SECTION_ORDER.map((key) => [key, key === "phase" ? "off" : "std"])),
    customVisibilityBySection: buildExplorerCustomVisibility(),
    savedCustomVisibilityBySection: readStoredExplorerCustomVisibility(),
    openSectionKey: null,
    openSectionAnchor: null,
    openModePickerKey: null,
    openModePickerAnchor: null,
    openGroupKeysBySection: Object.fromEntries(EXPLORER_SECTION_ORDER.map((key) => [key, []])),
    sizingMode: "fit-content",
    columnWidths: {},
  },
  referenceSettings: {
    filtersByDomain: {},
    showAdvanced: readStoredReferenceAdvanced(),
    tableHeights: readStoredReferenceTableHeights(),
    columnWidthsByDomain: readStoredReferenceColumnWidths(),
    visibleColumnsByDomain: readStoredReferenceColumnVisibility(),
    fitModeByDomain: readStoredReferenceFitModes(),
    openColumnsDomain: null,
    activeEditCell: null,
  },
  sourcesSettings: {
    filter: "",
    selectedReferenceId: null,
    exactReferenceId: null,
    focusedReferenceIds: [],
  },
  draggingWidgetId: null,
  pendingHighlightTarget: null,
  runtimeInfo: shellRuntimeInfo,
  runtimeMismatch: false,
};

let explorerHoverTimer = null;
let explorerResizeState = null;
let explorerDismissHandlersBound = false;
let referenceResizeObserver = null;
let referenceResizeState = null;
let referenceDismissHandlersBound = false;

const screens = [...document.querySelectorAll(".screen")];
const navLinks = [...document.querySelectorAll(".nav-link")];
const screenRenderers = {
  dashboard: renderDashboard,
  "dashboard-v4": renderDashboardV4,
  "dashboard-v2": renderDashboardV2,
  "dashboard-v3": renderDashboardV3,
  "path-editor": renderPathEditor,
  finance: renderManualFinance,
  explorer: renderProjectionExplorer,
  "test-lab": renderTestLab,
  insights: renderInsights,
  reference: renderReferenceData,
  sources: renderSources,
  gaps: renderGapTracker,
};

bindNavigation();
bindThemeToggle();
document.getElementById("refreshBtn").addEventListener("click", () => loadPreviewResults());
window.addEventListener("beforeunload", (event) => {
  if (hasDirtyWorkspace()) {
    event.preventDefault();
    event.returnValue = "";
  }
});
window.addEventListener("scroll", () => {
  document.getElementById("topShell").classList.toggle("compact", window.scrollY > 36);
});

await loadBootstrap();
initializeWorkspace();
state.activeScreen = resolveScreenId(getScreenFromHash() || state.activeScreen);
await loadPreviewResults();

function bindNavigation() {
  const nav = document.querySelector(".top-nav");
  if (!nav) return;
  nav.addEventListener("click", (event) => {
    const button = event.target.closest(".nav-link");
    if (!button) return;
    if (!button.dataset.screen) return;
    event.preventDefault();
    switchScreen(button.dataset.screen);
  });
  document.addEventListener("click", (event) => {
    const dropdown = document.getElementById("developmentNav");
    if (!dropdown) return;
    if (dropdown.contains(event.target)) return;
    dropdown.removeAttribute("open");
  });
  window.addEventListener("hashchange", () => {
    switchScreen(getScreenFromHash(), { updateHash: false });
  });
}

function bindThemeToggle() {
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      state.themePreference = button.dataset.themeToggle;
      writeStoredTheme(state.themePreference);
      renderApp();
    });
  });
}

function getScreenFromHash() {
  const value = window.location.hash.replace(/^#/, "").trim();
  return value || "dashboard-v4";
}

function resolveScreenId(nextScreen) {
  if (nextScreen === "path-editor" && !getEditorSlot()?.loaded) {
    return "dashboard-v4";
  }
  return screenRenderers[nextScreen] ? nextScreen : "dashboard-v4";
}

function syncScreenHash(screenId) {
  const nextHash = `#${screenId}`;
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}

function switchScreen(nextScreen, options = {}) {
  const resolvedScreen = resolveScreenId(nextScreen);
  state.activeScreen = resolvedScreen;
  if (options.updateHash !== false) {
    syncScreenHash(resolvedScreen);
  }
  renderApp();
}

async function loadBootstrap() {
  const response = await fetch("/api/bootstrap");
  state.bootstrap = await response.json();
  state.savedScenarios = [...state.bootstrap.scenarios];
  state.runtimeInfo = state.bootstrap.runtimeInfo || state.runtimeInfo;
  state.runtimeMismatch = Boolean(
    shellRuntimeInfo?.buildId
    && state.runtimeInfo?.buildId
    && shellRuntimeInfo.buildId !== state.runtimeInfo.buildId,
  );
}

function initializeWorkspace() {
  state.workspaceSlots = SLOT_CONFIGS.map((config, index) => {
    const sourceScenario = state.savedScenarios[index] ?? null;
    return createWorkspaceSlot(config, sourceScenario);
  });
  syncSelectionState();
  state.widgets = DEFAULT_WIDGETS.map((widget) => hydrateWidget(widget));
  initializeDashboardV4();
}

function initializeDashboardV4() {
  state.dashboardV4.visualsHorizonYearIndex = state.horizonYearIndex;
  state.dashboardV4.highlightsHorizonYearIndex = state.horizonYearIndex;
  state.dashboardV4.highlightsSelectedSlotIds = buildDefaultHighlightsSelection();
  state.dashboardV4.charts = DASHBOARD_V4_CHARTS.map((chart) => createDashboardV4Chart(chart));
  state.dashboardV4.preview.selectedSlotIds = [...getLoadedSlots().map((slot) => slot.slotId)];
  state.explorerSettings.customVisibilityBySection = sanitizeExplorerCustomVisibility(state.explorerSettings.savedCustomVisibilityBySection);
}

function createWorkspaceSlot(config, scenario) {
  if (!scenario) {
    return {
      slotId: config.slotId,
      slotLabel: config.label,
      colorToken: config.colorToken,
      loaded: false,
      collapsedOnDashboard: false,
      hiddenFromVisuals: false,
      showInPreview: false,
      optionsOpen: false,
      showSummary: false,
      dirty: false,
      sourceScenarioId: null,
      title: "",
      titleTouched: false,
      titleEditing: false,
      draft: null,
      originalFingerprint: null,
    };
  }

  const draft = normalizeScenarioForWorkspace(structuredClone(scenario), config);
  return {
    slotId: config.slotId,
    slotLabel: config.label,
    colorToken: scenario.colorToken || config.colorToken,
    loaded: true,
    collapsedOnDashboard: false,
    hiddenFromVisuals: false,
    showInPreview: true,
    optionsOpen: false,
    showSummary: false,
    dirty: false,
    sourceScenarioId: scenario.id,
    title: scenario.displayName || scenario.name || config.label,
    titleTouched: false,
    titleEditing: false,
    draft,
    originalFingerprint: scenarioFingerprint(draft),
  };
}

function normalizeScenarioForWorkspace(scenario, config) {
  const normalized = {
    ...scenario,
    displayName: scenario.displayName || scenario.name || config.label,
    colorToken: scenario.colorToken || config.colorToken,
    isLoaded: true,
    displayOrder: 0,
  };
  normalized.pathTemplateId = normalizeLegacyPathTemplateId(normalized.pathTemplateId);
  applyPathDependencies({ draft: normalized });
  normalized.routeSummary = buildRouteSummary(normalized);
  return normalized;
}

function createDashboardV4Chart(config) {
  const chart = hydrateWidget({
    id: config.id,
    title: config.title,
    viewMode: config.viewMode,
    metrics: config.metrics,
    size: config.size,
    defaultEndIndex: state.dashboardV4.visualsHorizonYearIndex,
  });
  chart.subtitle = config.subtitle;
  chart.maxHorizonIndex = state.dashboardV4.visualsHorizonYearIndex;
  chart.selectedSlotIds = [...getWidgetEligibleSlots().map((slot) => slot.slotId)];
  clampWidgetViewport(chart);
  return chart;
}

async function loadPreviewResults() {
  const scenarios = getProjectableSlots().map((slot) => serializeSlotForPreview(slot));
  if (!scenarios.length) {
    state.previewResults = {};
    renderApp();
    return;
  }

  const response = await fetch("/api/projection-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarios }),
  });
  const payload = await response.json();
  state.previewResults = Object.fromEntries(payload.scenarios.map((item) => [item.scenarioId, item]));
  renderApp();
}

function renderApp() {
  renderChromeState();
  renderAllScreens();
  screens.forEach((screen) => {
    screen.classList.toggle("is-visible", screen.id === state.activeScreen);
  });
}

function renderCurrentScreen() {
  renderChromeState();
  renderScreen(state.activeScreen);
  screens.forEach((screen) => {
    screen.classList.toggle("is-visible", screen.id === state.activeScreen);
  });
}

function renderChromeState() {
  syncThemeState();
  navLinks.forEach((link) => {
    const shouldActivate = link.dataset.screen === state.activeScreen
      || (link.dataset.screen === "dashboard-v4" && state.activeScreen === "dashboard-v4");
    link.classList.toggle("is-active", shouldActivate);
  });
  const developmentNav = document.getElementById("developmentNav");
  if (developmentNav) {
    const isDevelopmentScreen = ["dashboard", "dashboard-v2", "dashboard-v3", "test-lab", "insights"].includes(state.activeScreen);
    developmentNav.classList.toggle("is-active", isDevelopmentScreen);
    if (!isDevelopmentScreen) {
      developmentNav.removeAttribute("open");
    }
  }
  renderRuntimeChrome();
}

function renderRuntimeChrome() {
  const badge = document.getElementById("runtimeBadge");
  const banner = document.getElementById("runtimeBanner");
  const runtime = state.runtimeInfo;
  if (badge) {
    if (!runtime) {
      badge.hidden = true;
    } else {
      const shortBuild = String(runtime.buildId || "dev").slice(0, 7);
      const urlLabel = runtime.serverUrl || `http://127.0.0.1:${runtime.activePort || "?"}`;
      const preferredUrl = `http://127.0.0.1:${runtime.preferredPort || "8000"}`;
      badge.hidden = false;
      badge.classList.toggle("is-warning", Boolean(runtime.fallbackInUse));
      badge.textContent = runtime.fallbackInUse
        ? `Fallback runtime ${urlLabel} · preferred ${preferredUrl} · build ${shortBuild}`
        : `${urlLabel} · build ${shortBuild}`;
    }
  }
  if (banner) {
    const runtimeUrl = runtime?.serverUrl || `http://127.0.0.1:${runtime?.activePort || "8000"}`;
    const preferredUrl = `http://127.0.0.1:${runtime?.preferredPort || "8000"}`;
    if (!state.runtimeMismatch && !runtime?.fallbackInUse) {
      banner.hidden = true;
      banner.innerHTML = "";
    } else {
      banner.hidden = false;
      banner.classList.toggle("is-warning", Boolean(runtime?.fallbackInUse));
      banner.innerHTML = runtime?.fallbackInUse
        ? `
          <div class="runtime-banner-copy">
            <strong>Preferred port unavailable.</strong>
            <span>The planner is running on <strong>${escapeHtml(runtimeUrl)}</strong> instead of preferred <strong>${escapeHtml(preferredUrl)}</strong>.</span>
          </div>
          <div class="runtime-banner-actions">
            <a class="ghost" href="${escapeHtml(runtimeUrl)}" target="_blank" rel="noreferrer">Open active runtime</a>
            ${state.runtimeMismatch ? `<button type="button" class="ghost" id="runtimeReloadBtn">Reload</button>` : ""}
          </div>
        `
        : `
          <div class="runtime-banner-copy">
            <span>New build detected. Reload this page to use the current runtime.</span>
          </div>
          <div class="runtime-banner-actions">
            <button type="button" class="ghost" id="runtimeReloadBtn">Reload</button>
          </div>
        `;
      banner.querySelector("#runtimeReloadBtn")?.addEventListener("click", () => window.location.reload());
    }
  }
}

function syncThemeState() {
  const body = document.body;
  const effectiveTheme = getEffectiveTheme();
  body.dataset.theme = effectiveTheme;
  body.dataset.screen = state.activeScreen;
  const disableLight = state.activeScreen === "dashboard-v3";
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    const isActive = button.dataset.themeToggle === state.themePreference;
    button.classList.toggle("is-active", isActive);
    const isDisabled = disableLight && button.dataset.themeToggle === "light";
    button.disabled = isDisabled;
    button.classList.toggle("is-disabled", isDisabled);
  });
}

function getEffectiveTheme() {
  return state.activeScreen === "dashboard-v3" ? "dark" : state.themePreference;
}

function readStoredTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function writeStoredTheme(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Local-only preference persistence should fail safely.
  }
}

function buildDefaultHighlightsSelection() {
  return getProjectableSlots().slice(0, 3).map((slot) => slot.slotId);
}

function buildDefaultExplorerCustomVisibility() {
  return buildExplorerCustomVisibility();
}

function sanitizeExplorerCustomVisibility(stored) {
  const fallback = buildDefaultExplorerCustomVisibility();
  const sanitized = {};
  EXPLORER_SECTION_ORDER.forEach((sectionKey) => {
    const columns = getExplorerAllColumns(sectionKey);
    const current = stored && typeof stored === "object" ? stored[sectionKey] : null;
    sanitized[sectionKey] = {};
    columns.forEach((column) => {
      if (current && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, column.key)) {
        sanitized[sectionKey][column.key] = current[column.key] !== false;
      } else {
        sanitized[sectionKey][column.key] = fallback[sectionKey]?.[column.key] !== false;
      }
    });
  });
  return sanitized;
}

function readStoredExplorerCustomVisibility() {
  try {
    const stored = window.localStorage.getItem(EXPLORER_CUSTOM_VISIBILITY_STORAGE_KEY);
    if (!stored) return buildDefaultExplorerCustomVisibility();
    return sanitizeExplorerCustomVisibility(JSON.parse(stored));
  } catch {
    return buildDefaultExplorerCustomVisibility();
  }
}

function writeStoredExplorerCustomVisibility(visibility) {
  try {
    window.localStorage.setItem(
      EXPLORER_CUSTOM_VISIBILITY_STORAGE_KEY,
      JSON.stringify(sanitizeExplorerCustomVisibility(visibility)),
    );
  } catch {
    // Local-only preference persistence should fail safely.
  }
}

function readStoredReferenceAdvanced() {
  try {
    return window.localStorage.getItem(REFERENCE_ADVANCED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStoredReferenceAdvanced(value) {
  try {
    window.localStorage.setItem(REFERENCE_ADVANCED_STORAGE_KEY, String(Boolean(value)));
  } catch {
    // Local-only preference persistence should fail safely.
  }
}

function readStoredReferenceTableHeights() {
  try {
    const stored = window.localStorage.getItem(REFERENCE_TABLE_HEIGHTS_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredReferenceTableHeights(value) {
  try {
    window.localStorage.setItem(REFERENCE_TABLE_HEIGHTS_STORAGE_KEY, JSON.stringify(value || {}));
  } catch {
    // Local-only preference persistence should fail safely.
  }
}

function readStoredReferenceColumnWidths() {
  try {
    const stored = window.localStorage.getItem(REFERENCE_COLUMN_WIDTHS_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredReferenceColumnWidths(value) {
  try {
    window.localStorage.setItem(REFERENCE_COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(value || {}));
  } catch {
    // Local-only preference persistence should fail safely.
  }
}

function readStoredReferenceColumnVisibility() {
  try {
    const stored = window.localStorage.getItem(REFERENCE_COLUMN_VISIBILITY_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredReferenceColumnVisibility(value) {
  try {
    window.localStorage.setItem(REFERENCE_COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(value || {}));
  } catch {
    // Local-only preference persistence should fail safely.
  }
}

function readStoredReferenceFitModes() {
  try {
    const stored = window.localStorage.getItem(REFERENCE_FIT_MODES_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredReferenceFitModes(value) {
  try {
    window.localStorage.setItem(REFERENCE_FIT_MODES_STORAGE_KEY, JSON.stringify(value || {}));
  } catch {
    // Local-only preference persistence should fail safely.
  }
}

function renderAllScreens() {
  Object.keys(screenRenderers).forEach((screenId) => {
    renderScreen(screenId);
  });
}

function renderScreen(screenId) {
  const renderer = screenRenderers[screenId];
  const screen = document.getElementById(screenId);
  if (!renderer || !screen) return;
  try {
    renderer();
    screen.dataset.renderStatus = "ready";
    maybeApplyPendingHighlight(screenId);
  } catch (error) {
    console.error(`Failed to render screen "${screenId}"`, error);
    screen.dataset.renderStatus = "error";
    screen.innerHTML = `
      <article class="panel">
        <p class="panel-eyebrow">Screen Error</p>
        <h3>We could not render this section.</h3>
        <p class="support-copy">The navigation is still active. Try another section or refresh the planner.</p>
      </article>
    `;
  }
}

function renderDashboard() {
  syncSelectionState();
  const dashboard = document.getElementById("dashboard");
  const orderedSections = state.dashboardSections.order.map((sectionKey) => renderDashboardSection(sectionKey));
  dashboard.innerHTML = `
    <div class="dashboard-stack">
      ${renderWorkspacePanel({
        eyebrow: "Dashboard v1",
        title: "Loaded path workspace",
        copy: "Hide minimizes a path card only. Hide from visuals removes it from chart availability until you turn it back on. Edit still opens the dedicated Path Editor tab inside this app.",
        toolbarCopy: "The compact shelf stays attached to the main row so hidden paths remain visible without interrupting the main work area.",
      })}

      ${orderedSections.join("")}
    </div>
  `;

  bindWorkspacePanelEvents(dashboard);
  if (dashboard.querySelector("#horizonSelect")) {
    dashboard.querySelector("#horizonSelect").value = String(state.horizonYearIndex);
    dashboard.querySelector("#horizonSelect").addEventListener("change", (event) => {
      state.horizonYearIndex = Number(event.target.value);
      state.widgets.forEach((widget) => resetWidgetViewport(widget));
      renderDashboardWithTransition();
    });
  }
  if (dashboard.querySelector("#previewModeSelect")) {
    dashboard.querySelector("#previewModeSelect").addEventListener("change", () => {
      state.previewSettings.mode = dashboard.querySelector("#previewModeSelect").value;
      renderDashboard();
    });
  }
  if (dashboard.querySelector("#previewBaselineSelect")) {
    dashboard.querySelector("#previewBaselineSelect").addEventListener("change", () => {
      state.previewSettings.baselineSlotId = dashboard.querySelector("#previewBaselineSelect").value;
      renderDashboard();
    });
  }
  dashboard.querySelectorAll("[data-add-widget]").forEach((button) => {
    button.addEventListener("click", () => {
      addWidget();
      renderDashboardWithTransition();
    });
  });

  bindDashboardSlotEvents(dashboard);
  bindDashboardSectionEvents(dashboard);
  bindWidgetEvents(dashboard);
  drawDashboardWidgets();
}

function renderDashboardV4() {
  syncSelectionState();
  const dashboard = document.getElementById("dashboard-v4");
  const previewSettings = state.dashboardV4.preview;
  dashboard.innerHTML = `
    <div class="dashboard-v4-shell dashboard-compare-shell">
      ${renderWorkspacePanel({
        title: "Path Workspace",
        toolbarCopy: "These options update live across visuals, projections, and other pages.",
        shellClass: "dashboard-v4-workspace",
      })}

      <article class="dashboard-v4-horizon-band dashboard-v4-horizon-band-centered">
        <div class="dashboard-v4-line-copy">Set the default horizon for all visuals.</div>
        <div class="dashboard-v4-horizon-control">
          <select id="dashboardV4GlobalHorizon">${buildHorizonOptions(state.dashboardV4.visualsHorizonYearIndex)}</select>
        </div>
      </article>

      <section class="dashboard-v4-chart-grid">
        ${state.dashboardV4.charts.map((chart) => renderDashboardV4Chart(chart)).join("")}
      </section>

      <article class="dashboard-v4-horizon-band compact-line highlights">
        <div class="dashboard-v4-line-copy">Quick highlights</div>
        <div class="dashboard-v4-line-controls">
          ${renderDashboardV4HighlightsPathPicker()}
          <div class="dashboard-v4-horizon-control">
            <select id="dashboardV4HighlightHorizon">${buildHorizonOptions(state.dashboardV4.highlightsHorizonYearIndex)}</select>
          </div>
        </div>
      </article>

      <section class="dashboard-v4-highlight-grid">
        ${renderDashboardV4Highlights()}
      </section>

      <article class="dashboard-v4-preview">
        <div class="section-panel-head">
          <div class="section-title-block">
            <p class="panel-eyebrow">Projection Preview</p>
            <h3>Live side-by-side projection table</h3>
          </div>
        </div>
        <div class="dashboard-v4-preview-controls">
          <div class="field compact-field">
            <label>Preview Mode</label>
            <select id="dashboardV4PreviewMode">
              <option value="values" ${previewSettings.mode === "values" ? "selected" : ""}>Pure Values</option>
              <option value="delta" ${previewSettings.mode === "delta" ? "selected" : ""}>Gain / Loss vs First Path</option>
            </select>
          </div>
          <div class="dashboard-v4-inline-group">
            <span class="dashboard-v4-inline-label">Paths</span>
            <div class="chip-row compact">
              ${getLoadedSlots().map((slot) => renderDashboardV4PreviewToggle(slot, previewSettings.selectedSlotIds.includes(slot.slotId))).join("")}
            </div>
          </div>
          <div class="dashboard-v4-inline-group">
            <span class="dashboard-v4-inline-label">Metrics</span>
            <div class="chip-row compact">
              ${renderMetricToggles(previewSettings.metrics, ["phaseLabel", "totalIncome", "netCashFlow", "portfolio"], "dashboard-v4-preview-metric")}
            </div>
          </div>
        </div>
        ${renderProjectionTable({ ...previewSettings, rowHorizonYearIndex: state.dashboardV4.visualsHorizonYearIndex })}
      </article>
    </div>
  `;

  bindWorkspacePanelEvents(dashboard);
  bindDashboardSlotEvents(dashboard);
  bindDashboardV4Events(dashboard);
  drawDashboardV4Charts();
}

function renderWorkspacePanel(options = {}) {
  const expandedSlots = getLoadedSlots().filter((slot) => !slot.collapsedOnDashboard);
  const compactSlots = getLoadedSlots().filter((slot) => slot.collapsedOnDashboard);
  return `
    <article class="panel shared-path-shell ${options.shellClass || ""}">
      <div class="panel-header">
        <div>
          ${options.eyebrow ? `<p class="panel-eyebrow">${options.eyebrow}</p>` : ""}
          <h3>${options.title || "Loaded path workspace"}</h3>
          ${options.copy ? `<p class="support-copy">${options.copy}</p>` : ""}
        </div>
      </div>
      <div class="path-toolbar ${options.toolbarClass || ""}">
        <div class="support-copy">${options.toolbarCopy || ""}</div>
        <button class="secondary" data-add-path="true">Add Path</button>
      </div>
      <div class="path-strip-stack shared">
        ${compactSlots.length ? `
          <div class="compact-strip-shell">
            <div class="compact-strip-header">
              <p class="panel-eyebrow">Compact Shelf</p>
            </div>
            <div class="compact-strip">
              ${compactSlots.map((slot) => renderCompactSlot(slot)).join("")}
            </div>
          </div>
        ` : ""}
        <section class="path-strip">
          ${expandedSlots.map((slot) => renderWorkspaceSlot(slot)).join("")}
        </section>
      </div>
    </article>
  `;
}

function renderDashboardV2() {
  renderComparisonDashboard("dashboard-v2", "v2");
}

function renderDashboardV3() {
  renderComparisonDashboard("dashboard-v3", "v3");
}

function renderComparisonDashboard(screenId, variant) {
  syncSelectionState();
  const dashboard = document.getElementById(screenId);
  const loadedSlots = getLoadedSlots();
  const selectedSlots = loadedSlots.filter((slot) => state.dashboardV2Settings.selectedSlotIds.includes(slot.slotId));
  const visibleSlots = selectedSlots.filter((slot) => state.previewResults[slot.slotId]);
  const focusSlot = visibleSlots.find((slot) => slot.slotId === state.dashboardV2Settings.focusSlotId)
    || selectedSlots.find((slot) => slot.slotId === state.dashboardV2Settings.focusSlotId)
    || visibleSlots[0]
    || loadedSlots[0]
    || null;
  const ids = buildComparisonDashboardIds(variant);
  const config = getComparisonDashboardConfig(variant);

  dashboard.innerHTML = `
    <div class="dashboard-v2-shell dashboard-compare-shell is-${variant}">
      <article class="dashboard-v2-header dashboard-compare-header">
        <div>
          <p class="panel-eyebrow">${config.eyebrow}</p>
          <h2 class="dashboard-v2-title">${config.title}</h2>
          <p class="support-copy">${config.copy}</p>
        </div>
        <div class="dashboard-v2-updated">${config.updatedLabel}</div>
      </article>

      <article class="dashboard-v2-controls dashboard-compare-controls">
        <div class="dashboard-v2-control-group">
          <label for="${ids.horizonSelect}">Horizon</label>
          <select id="${ids.horizonSelect}">${buildHorizonOptions()}</select>
        </div>
        <div class="dashboard-v2-control-group dashboard-v2-path-group">
          <label>Paths shown</label>
          <div class="dashboard-v2-toggle-row">
            ${loadedSlots.map((slot) => `
              <button class="dashboard-v2-path-toggle ${slot.colorToken} ${state.dashboardV2Settings.selectedSlotIds.includes(slot.slotId) ? "is-active" : "is-inactive"}" data-comparison-slot-toggle="${slot.slotId}">
                <span class="legend-swatch" style="background:${COLOR_STYLES[slot.colorToken] || COLOR_STYLES.slate}"></span>
                ${escapeHtml(getPathDisplayName(slot))}
              </button>
            `).join("")}
          </div>
        </div>
        <div class="dashboard-v2-control-group">
          <label for="${ids.focusSelect}">Focus Path</label>
          <select id="${ids.focusSelect}">${buildDashboardV2SlotOptions(focusSlot?.slotId)}</select>
        </div>
        <div class="dashboard-v2-control-group">
          <label for="${ids.schoolSelect}">Grad School</label>
          <select id="${ids.schoolSelect}" ${focusSlot?.loaded ? "" : "disabled"}>
            <option value="">None</option>
            ${buildOptions(state.bootstrap.referenceTables.phd_programs, focusSlot?.draft?.selectedPhdProgramId, "id", "label")}
          </select>
        </div>
        <div class="dashboard-v2-control-group">
          <label for="${ids.employerSelect}">Research Employer</label>
          <select id="${ids.employerSelect}" ${focusSlot?.loaded ? "" : "disabled"}>
            <option value="">None</option>
            ${buildOptions(state.bootstrap.referenceTables.research_employers, focusSlot?.draft?.selectedEmployerId, "id", "label")}
          </select>
        </div>
        <div class="dashboard-v2-control-group">
          <label for="${ids.companySelect}">Tech Company</label>
          <select id="${ids.companySelect}" ${focusSlot?.loaded ? "" : "disabled"}>
            <option value="">None</option>
            ${buildOptions(state.bootstrap.referenceTables.tech_companies, focusSlot?.draft?.selectedCompanyId, "id", "label")}
          </select>
        </div>
        <div class="dashboard-v2-control-group">
          <label for="${ids.vaSelect}">VA Disability</label>
          <select id="${ids.vaSelect}" ${focusSlot?.loaded ? "" : "disabled"}>${buildOptions(state.bootstrap.referenceTables.va_disability, focusSlot?.draft?.selectedVaRatingId, "id", "label")}</select>
        </div>
      </article>

      <section class="dashboard-v2-scenario-grid">
        ${selectedSlots.length ? selectedSlots.map((slot) => renderDashboardV2ScenarioCard(slot)).join("") : `<article class="panel"><p class="support-copy">Select at least one loaded path to populate ${config.eyebrow}.</p></article>`}
      </section>

      <section class="dashboard-v2-kpi-grid">
        ${renderDashboardV2Kpis(visibleSlots, focusSlot, variant)}
      </section>

      <article class="dashboard-v2-timeline">
        <div class="panel-header">
          <div>
            <p class="panel-eyebrow">Life Phase Timeline</p>
            <h3>Projected route progression</h3>
          </div>
        </div>
        <div class="dashboard-v2-timeline-stack">
          ${visibleSlots.length ? visibleSlots.map((slot) => renderDashboardV2TimelineRow(slot)).join("") : `<div class="notice">Choose enough path details to generate projections.</div>`}
        </div>
      </article>

      <div class="dashboard-v2-chart-grid">
        ${renderDashboardV2ChartCard(ids.portfolio, "Investment Portfolio Growth", "Projected portfolio trajectory across the selected horizon.", visibleSlots)}
        ${renderDashboardV2ChartCard(ids.cashflow, "Annual Net Cash Flow", "Gross income plus tax-free income minus taxes, healthcare, living expenses, and retirement savings.", visibleSlots)}
        ${renderDashboardV2ChartCard(ids.gross, "Annual Gross Income", "Taxable salary, pension, and stipend income by year.", visibleSlots)}
        ${renderDashboardV2ChartCard(ids.taxFree, "Tax-Free Income", "VA disability, GI Bill BAH, BAH/BAS, and other tax-free sources where applicable.", visibleSlots)}
      </div>

      <article class="dashboard-v2-chart-card full-span">
        <div class="dashboard-v2-card-head">
          <div>
            <h3>Cumulative Cash Flow</h3>
            <p class="chart-sub">Running total of annual net cash flow over the selected horizon.</p>
          </div>
          ${renderDashboardV2Legend(visibleSlots)}
        </div>
        <div class="dashboard-v2-chart-wrap large"><canvas id="${ids.cumulative}"></canvas></div>
      </article>

      <div class="dashboard-v2-chart-grid">
        ${renderDashboardV2ChartCard(ids.taxes, "Annual Taxes Paid", "Tax burden by path and year at the current assumptions.", visibleSlots)}
        ${renderDashboardV2ChartCard(ids.health, "Healthcare Costs", "Healthcare cost differences across military, school, and civilian phases.", visibleSlots)}
      </div>

      <article class="dashboard-v2-table">
        <div class="panel-header">
          <div>
            <p class="panel-eyebrow">Path Comparison Summary</p>
            <h3>Horizon snapshot and cumulative totals</h3>
          </div>
        </div>
        ${renderDashboardV2ComparisonTable(visibleSlots)}
      </article>

      <article class="dashboard-v2-footer">
        <p>${config.footer}</p>
      </article>
    </div>
  `;

  const horizonSelect = dashboard.querySelector(`#${ids.horizonSelect}`);
  if (horizonSelect) {
    horizonSelect.value = String(state.horizonYearIndex);
    horizonSelect.addEventListener("change", (event) => {
      state.horizonYearIndex = Number(event.target.value);
      state.widgets.forEach((widget) => resetWidgetViewport(widget));
      renderApp();
    });
  }

  dashboard.querySelectorAll("[data-comparison-slot-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleArrayMember(state.dashboardV2Settings.selectedSlotIds, button.dataset.comparisonSlotToggle);
      if (!state.dashboardV2Settings.selectedSlotIds.length) {
        state.dashboardV2Settings.selectedSlotIds = [...getLoadedSlots().map((slot) => slot.slotId)];
      }
      renderApp();
    });
  });

  const focusSelect = dashboard.querySelector(`#${ids.focusSelect}`);
  if (focusSelect) {
    focusSelect.addEventListener("change", () => {
      state.dashboardV2Settings.focusSlotId = focusSelect.value;
      renderApp();
    });
  }

  bindDashboardV2DraftControl(dashboard, `#${ids.schoolSelect}`, focusSlot, "selectedPhdProgramId");
  bindDashboardV2DraftControl(dashboard, `#${ids.employerSelect}`, focusSlot, "selectedEmployerId");
  bindDashboardV2DraftControl(dashboard, `#${ids.companySelect}`, focusSlot, "selectedCompanyId");
  bindDashboardV2DraftControl(dashboard, `#${ids.vaSelect}`, focusSlot, "selectedVaRatingId");

  drawDashboardV2Charts(visibleSlots, variant);
}

function buildComparisonDashboardIds(variant) {
  const suffix = variant === "v3" ? "V3" : "V2";
  return {
    horizonSelect: `dashboard${suffix}HorizonSelect`,
    focusSelect: `dashboard${suffix}FocusSlot`,
    schoolSelect: `dashboard${suffix}SchoolSelect`,
    employerSelect: `dashboard${suffix}EmployerSelect`,
    companySelect: `dashboard${suffix}CompanySelect`,
    vaSelect: `dashboard${suffix}VaSelect`,
    portfolio: `dashboard${suffix}Portfolio`,
    cashflow: `dashboard${suffix}Cashflow`,
    gross: `dashboard${suffix}Gross`,
    taxFree: `dashboard${suffix}TaxFree`,
    cumulative: `dashboard${suffix}Cumulative`,
    taxes: `dashboard${suffix}Taxes`,
    health: `dashboard${suffix}Health`,
  };
}

function getComparisonDashboardConfig(variant) {
  const updatedLabel = variant === "v3"
    ? "Current workspace data · reference-inspired dark board"
    : `Local workspace data · ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  if (variant === "v3") {
    return {
      eyebrow: "Dashboard v3",
      title: "50-year financial projection board",
      copy: "This dark experimental board leans into the reference dashboard style: compact analyst controls, stronger KPI scanning, timeline-first storytelling, and richer hover feedback on the visuals.",
      updatedLabel,
      footer: "Dashboard v3 uses the live planner workspace, but presents it in a denser, darker, reference-inspired board so we can compare this style against Dashboard and Dashboard v2.",
    };
  }
  return {
    eyebrow: "Dashboard v2",
    title: "Experimental long-range comparison board",
    copy: "This version is inspired by your reference dashboard: compact controls, fast KPI scanning, phase timelines, side-by-side charts, and a comparison table built from the current planner workspace.",
    updatedLabel,
    footer: "Dashboard v2 uses the same saved paths, draft state, and projection engine as the main planner. The focus-path selectors above update the currently loaded workspace path directly so you can compare this layout against the primary dashboard.",
  };
}

function bindDashboardV2DraftControl(root, selector, slot, field) {
  const input = root.querySelector(selector);
  if (!input || !slot?.loaded || !slot.draft) return;
  input.addEventListener("change", async () => {
    slot.draft[field] = input.value || null;
    markSlotDirty(slot, field);
    await loadPreviewResults();
  });
}

function renderDashboardV2ScenarioCard(slot) {
  const result = state.previewResults[slot.slotId];
  const programLabel = labelForReference("phd_programs", slot.draft?.selectedPhdProgramId) || "None";
  const employerLabel = labelForReference("research_employers", slot.draft?.selectedEmployerId) || "None";
  const companyLabel = labelForReference("tech_companies", slot.draft?.selectedCompanyId) || "None";
  const vaLabel = labelForReference("va_disability", slot.draft?.selectedVaRatingId) || "0%";
  return `
    <article class="dashboard-v2-scenario-card">
      <div class="dashboard-v2-card-head">
        <div>
          <p class="panel-eyebrow">${slot.slotLabel}</p>
          <h3>${escapeHtml(slot.title || "New Path")}</h3>
        </div>
        <span class="dashboard-v2-pill ${slot.colorToken}">${result ? formatCompactCurrency(result.metrics.finalPortfolio) : "Pending"}</span>
      </div>
      <div class="dashboard-v2-scenario-list">
        <div class="dashboard-v2-scenario-row">
          <span>Route</span>
          <div class="dashboard-v2-scenario-value">${renderPathSummary(buildSlotSummaryLine(slot), { compact: true })}</div>
        </div>
        <div class="dashboard-v2-scenario-row"><span>Grad School</span><strong>${escapeHtml(programLabel)}</strong></div>
        <div class="dashboard-v2-scenario-row"><span>Research Employer</span><strong>${escapeHtml(employerLabel)}</strong></div>
        <div class="dashboard-v2-scenario-row"><span>Tech Company</span><strong>${escapeHtml(companyLabel)}</strong></div>
        <div class="dashboard-v2-scenario-row"><span>VA Disability</span><strong>${escapeHtml(vaLabel)}</strong></div>
      </div>
    </article>
  `;
}

function renderDashboardV2Kpis(slots, focusSlot, variant) {
  if (!slots.length) {
    return `<article class="panel"><p class="support-copy">Projectable paths will populate KPI comparisons here.</p></article>`;
  }

  const cards = [
    buildDashboardV2MetricCard("Portfolio at Horizon", slots, (slot) => state.previewResults[slot.slotId].metrics.finalPortfolio, true),
    buildDashboardV2MetricCard("Cumulative Gross Income", slots, (slot) => state.previewResults[slot.slotId].metrics.totalGrossIncome, true),
    buildDashboardV2MetricCard("Cumulative Tax-Free Income", slots, (slot) => state.previewResults[slot.slotId].metrics.totalTaxFreeIncome, true),
    buildDashboardV2MetricCard("Cumulative Taxes", slots, (slot) => state.previewResults[slot.slotId].metrics.totalTaxes, false),
    buildDashboardV2MetricCard("Cumulative Healthcare", slots, (slot) => state.previewResults[slot.slotId].metrics.totalHealthcareCost, false),
    buildDashboardV2MetricCard("Cumulative Net Cash Flow", slots, (slot) => state.previewResults[slot.slotId].metrics.totalNetCashFlow, true),
  ];

  if (variant === "v3" && focusSlot && state.previewResults[focusSlot.slotId]) {
    slots
      .filter((slot) => slot.slotId !== focusSlot.slotId)
      .forEach((slot) => {
        cards.push(buildDashboardV2BreakevenCard(slot, focusSlot));
      });
  }

  return cards.join("");
}

function buildDashboardV2MetricCard(title, slots, resolver, highGood) {
  const values = slots.map((slot) => ({ slot, value: resolver(slot) || 0 }));
  const winner = [...values].sort((left, right) => highGood ? right.value - left.value : left.value - right.value)[0];
  return `
    <article class="dashboard-v2-kpi-card">
      <p class="panel-eyebrow">${title}</p>
      <div class="dashboard-v2-kpi-value">${formatCompactCurrency(winner.value)}</div>
      <div class="dashboard-v2-kpi-sub">${escapeHtml(getPathDisplayName(winner.slot))}</div>
      <div class="dashboard-v2-kpi-detail">
        ${values.map(({ slot, value }) => `<span><strong>${escapeHtml(getPathDisplayName(slot))}</strong> ${formatCompactCurrency(value)}</span>`).join("")}
      </div>
    </article>
  `;
}

function buildDashboardV2BreakevenCard(slot, baselineSlot) {
  const overtakeYear = findCumulativeOvertakeYear(slot.slotId, baselineSlot.slotId);
  return `
    <article class="dashboard-v2-kpi-card">
      <p class="panel-eyebrow">${escapeHtml(getPathDisplayName(slot))} vs ${escapeHtml(getPathDisplayName(baselineSlot))}</p>
      <div class="dashboard-v2-kpi-value">${overtakeYear || "Not Yet"}</div>
      <div class="dashboard-v2-kpi-sub">Cumulative cash flow overtake year</div>
      <div class="dashboard-v2-kpi-detail">
        <span><strong>${escapeHtml(getPathDisplayName(slot))}</strong> overtakes ${escapeHtml(getPathDisplayName(baselineSlot))} when cumulative net cash flow turns favorable.</span>
      </div>
    </article>
  `;
}

function findCumulativeOvertakeYear(slotId, baselineSlotId) {
  const slotResult = state.previewResults[slotId];
  const baselineResult = state.previewResults[baselineSlotId];
  if (!slotResult || !baselineResult) return null;
  const slotSeries = buildCumulativeSeries(slotResult.projection);
  const baselineSeries = buildCumulativeSeries(baselineResult.projection);
  for (let index = 0; index <= state.horizonYearIndex; index += 1) {
    if ((slotSeries[index] ?? -Infinity) > (baselineSeries[index] ?? Infinity)) {
      return slotResult.projection[index]?.calendarYear || null;
    }
  }
  return null;
}

function renderDashboardV2TimelineRow(slot) {
  const result = state.previewResults[slot.slotId];
  if (!result) {
    return `<div class="notice">${escapeHtml(getPathDisplayName(slot))} needs a valid path before the timeline can render.</div>`;
  }
  const segments = buildPhaseSegments(result.projection);
  return `
    <div class="dashboard-v2-timeline-row">
      <div class="dashboard-v2-timeline-label">
        <span class="dashboard-v2-path-name">${escapeHtml(getPathDisplayName(slot))}</span>
        ${renderPathSummary(buildSlotSummaryLine(slot), { className: "dashboard-v2-path-summary", compact: true })}
      </div>
      <div class="dashboard-v2-timeline-bar">
        ${segments.map((segment) => `
          <div class="dashboard-v2-timeline-segment ${phaseToneClass(segment.phaseId)}" style="flex:${segment.length}">
            <span class="seg-title">${segment.phaseLabel}</span>
            <span class="seg-years">${segment.startYear}–${segment.endYear}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function buildPhaseSegments(projection) {
  if (!projection.length) return [];
  const segments = [];
  projection.forEach((row) => {
    const current = segments[segments.length - 1];
    if (!current || current.phaseId !== row.phaseId) {
      segments.push({
        phaseId: row.phaseId,
        phaseLabel: row.phaseLabel,
        startYear: row.calendarYear,
        endYear: row.calendarYear,
        length: 1,
      });
      return;
    }
    current.endYear = row.calendarYear;
    current.length += 1;
  });
  return segments;
}

function phaseToneClass(phaseId) {
  if (phaseId === "active_duty" || phaseId === "retirement_transition") return "tone-military";
  if (phaseId === "retired_phd" || phaseId === "phd_only") return "tone-phd";
  if (phaseId === "retired_research" || phaseId === "research_only") return "tone-research";
  if (phaseId === "tech_career") return "tone-tech";
  return "tone-gap";
}

function renderDashboardV2ChartCard(canvasId, title, subtitle, slots) {
  return `
    <article class="dashboard-v2-chart-card">
      <div class="dashboard-v2-card-head">
        <div>
          <h3>${title}</h3>
          <p class="chart-sub">${subtitle}</p>
        </div>
        ${renderDashboardV2Legend(slots)}
      </div>
      <div class="dashboard-v2-chart-wrap"><canvas id="${canvasId}"></canvas></div>
    </article>
  `;
}

function renderDashboardV2Legend(slots) {
  if (!slots.length) return `<div class="muted-text">No visible paths.</div>`;
  return `
    <div class="dashboard-v2-legend">
      ${slots.map((slot) => `
        <span class="dashboard-v2-legend-item">
          <span class="legend-swatch" style="background:${COLOR_STYLES[slot.colorToken] || COLOR_STYLES.slate}"></span>
          ${escapeHtml(getPathDisplayName(slot))}
        </span>
      `).join("")}
    </div>
  `;
}

function drawDashboardV2Charts(slots, variant) {
  const ids = buildComparisonDashboardIds(variant);
  bindStandaloneComparisonChart(ids.portfolio, slots, "portfolio", { fill: true });
  bindStandaloneComparisonChart(ids.cashflow, slots, "netCashFlow");
  bindStandaloneComparisonChart(ids.gross, slots, "grossIncome");
  bindStandaloneComparisonChart(ids.taxFree, slots, "taxFreeIncome", { fill: true });
  bindStandaloneComparisonChart(ids.cumulative, slots, "cumulativeNetCashFlow", { fill: true, height: 360 });
  bindStandaloneComparisonChart(ids.taxes, slots, "taxes");
  bindStandaloneComparisonChart(ids.health, slots, "healthcareCost");
}

function renderDashboardV4Chart(chart) {
  return `
    <article class="dashboard-v4-chart-card" data-v4-chart-id="${chart.id}" data-size="${chart.size}">
      <div class="dashboard-v4-chart-head">
        <div class="dashboard-v4-chart-copy">
          <p class="panel-eyebrow">Visual</p>
          <h3>${chart.title}</h3>
          <p class="chart-sub">${chart.subtitle}</p>
        </div>
        <div class="dashboard-v4-chart-top-controls">
          <div class="field compact-field dashboard-v4-chart-horizon-field">
            <label for="dashboardV4Horizon-${chart.id}">Horizon</label>
            <select id="dashboardV4Horizon-${chart.id}" data-v4-chart-horizon="${chart.id}">${buildHorizonOptions(chart.maxHorizonIndex)}</select>
          </div>
          <div class="dashboard-v4-size-controls" role="group" aria-label="Chart size">
            ${["1x1", "1x2", "2x2"].map((size) => `
              <button
                class="ghost dashboard-v4-size-toggle ${chart.size === size ? "is-active" : ""}"
                data-v4-chart-size="${chart.id}"
                data-size="${size}"
                title="${size}"
              >
                <span class="dashboard-v4-size-glyph size-${size.replace("x", "-")}"></span>
              </button>
            `).join("")}
          </div>
        </div>
      </div>
      <div class="dashboard-v4-chart-wrap">
        <canvas id="dashboardV4Canvas-${chart.id}"></canvas>
      </div>
      <div class="dashboard-v4-chart-footer">
        <div class="dashboard-v4-chart-toolbar">
          <div class="dashboard-v4-zoom-controls">
            <button class="ghost dashboard-v4-mini" data-v4-chart-zoom="${chart.id}" data-step="-1" title="Zoom out">-</button>
            <button class="ghost dashboard-v4-mini" data-v4-chart-reset="${chart.id}" title="Reset timeline">0</button>
            <button class="ghost dashboard-v4-mini" data-v4-chart-zoom="${chart.id}" data-step="1" title="Zoom in">+</button>
          </div>
          <div class="dashboard-v4-legend">
            ${renderDashboardV4Legend(chart)}
          </div>
        </div>
        ${renderDashboardV4Scrollbar(chart)}
      </div>
    </article>
  `;
}

function renderDashboardV4Legend(chart) {
  const visibleSlots = getWidgetEligibleSlots();
  if (!visibleSlots.length) return `<div class="muted-text">No paths currently available for visuals.</div>`;
  return visibleSlots.map((slot) => `
    <button
      class="legend-chip ${chart.selectedSlotIds.includes(slot.slotId) ? "is-active" : "is-inactive"} ${chart.hoverSlotId === slot.slotId ? "is-hovered" : ""}"
      data-v4-chart-legend="${chart.id}"
      data-slot-id="${slot.slotId}"
      title="${escapeHtml(slot.slotLabel)}"
    >
      <span class="legend-swatch" style="background:${COLOR_STYLES[slot.colorToken] || COLOR_STYLES.slate}"></span>
      ${escapeHtml(getPathDisplayName(slot))}
    </button>
  `).join("");
}

function buildDashboardV4HighlightsSelectionLabel() {
  const selectedSlots = getProjectableSlots().filter((slot) => state.dashboardV4.highlightsSelectedSlotIds.includes(slot.slotId));
  if (!selectedSlots.length) return "Select paths";
  if (selectedSlots.length === 1) return getPathDisplayName(selectedSlots[0]);
  return `${selectedSlots.length} paths selected`;
}

function renderDashboardV4HighlightsPathPicker() {
  const selectedCount = state.dashboardV4.highlightsSelectedSlotIds.length;
  return `
    <details class="picker-menu dashboard-v4-picker">
      <summary>
        <span>Paths</span>
        <strong>${escapeHtml(buildDashboardV4HighlightsSelectionLabel())}</strong>
        <em>${selectedCount}/3</em>
      </summary>
      <div class="picker-menu-panel">
        ${getProjectableSlots().map((slot) => {
          const isSelected = state.dashboardV4.highlightsSelectedSlotIds.includes(slot.slotId);
          const disableUnchecked = !isSelected && selectedCount >= 3;
          return `
            <label class="picker-check-row ${disableUnchecked ? "is-disabled" : ""}">
              <input
                type="checkbox"
                data-dashboard-v4-highlight-slot="${slot.slotId}"
                ${isSelected ? "checked" : ""}
                ${disableUnchecked ? "disabled" : ""}
              />
              <span class="picker-check-copy">
                <span class="picker-swatch ${slot.colorToken}"></span>
                <span>${escapeHtml(getPathDisplayName(slot))}</span>
              </span>
            </label>
          `;
        }).join("") || `<div class="muted-text">Projectable paths will appear here.</div>`}
      </div>
    </details>
  `;
}

function renderDashboardV4Scrollbar(chart) {
  const maxIndex = getChartMaxIndex(chart);
  const visibleLength = Math.max(CHART_INTERACTION.minVisibleRows, chart.viewEndIndex - chart.viewStartIndex + 1);
  const maxStart = Math.max(0, maxIndex - visibleLength + 1);
  if (maxStart <= 0) return "";
  return `
    <div class="dashboard-v4-scrollbar-row">
      <input
        class="dashboard-v4-scrollbar"
        type="range"
        min="0"
        max="${maxStart}"
        step="1"
        value="${chart.viewStartIndex}"
        data-v4-chart-scroll="${chart.id}"
      />
    </div>
  `;
}

function renderDashboardV4Highlights() {
  const slots = getProjectableSlots().filter(
    (slot) => state.dashboardV4.highlightsSelectedSlotIds.includes(slot.slotId) && state.previewResults[slot.slotId],
  );
  if (!slots.length) {
    return `<article class="panel"><p class="support-copy">Select one or more projectable paths to populate quick highlights.</p></article>`;
  }
  const horizonIndex = state.dashboardV4.highlightsHorizonYearIndex;
  const horizonYear = getHorizonRows()[horizonIndex]?.calendarYear || "Selected Year";
  const cards = [
    { title: `Portfolio at ${horizonYear}`, metricKey: "portfolio", highGood: true },
    { title: "Cumulative Gross Income", metricKey: "grossIncome", highGood: true },
    { title: "Cumulative Tax-Free Income", metricKey: "taxFreeIncome", highGood: true },
    { title: "Cumulative Taxes", metricKey: "taxes", highGood: false },
    { title: "Cumulative Healthcare", metricKey: "healthcareCost", highGood: false },
    { title: "Cumulative Net Cash Flow", metricKey: "netCashFlow", highGood: true },
  ];
  return cards.map((card) => renderDashboardV4HighlightCard(card, slots, horizonIndex)).join("");
}

function renderDashboardV4HighlightCard(card, slots, horizonIndex) {
  const comparisons = slots.map((slot) => ({
    slot,
    value: valueAtHighlightHorizon(slot.slotId, card.metricKey, horizonIndex),
  }));
  const cardTone = [...comparisons].sort((left, right) => card.highGood ? right.value - left.value : left.value - right.value)[0]?.slot?.colorToken || "slate";
  return `
    <article class="dashboard-v4-highlight-card ${cardTone}">
      <p class="dashboard-v4-highlight-title">${escapeHtml(card.title)}</p>
      <div class="dashboard-v4-highlight-list">
        ${comparisons.map(({ slot, value }) => `
          <div class="dashboard-v4-highlight-row">
            <span class="dashboard-v4-highlight-name">${escapeHtml(getPathDisplayName(slot))}</span>
            <strong class="dashboard-v4-highlight-number">${formatCompactCurrency(value)}</strong>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function valueAtHighlightHorizon(slotId, metricKey, horizonIndex) {
  const result = state.previewResults[slotId];
  if (!result?.projection?.length) return 0;
  const boundedIndex = Math.max(0, Math.min(horizonIndex, result.projection.length - 1));
  if (metricKey === "portfolio") {
    return result.projection[boundedIndex]?.portfolio ?? 0;
  }
  return result.projection
    .slice(0, boundedIndex + 1)
    .reduce((total, row) => total + (row[metricKey] ?? 0), 0);
}

function renderDashboardV4PreviewToggle(slot, active) {
  const suffix = [
    slot.collapsedOnDashboard ? "hidden card" : null,
    slot.hiddenFromVisuals ? "not in visuals" : null,
  ].filter(Boolean).join(" · ");
  return `<button class="tag ${slot.colorToken} ${active ? "active" : ""}" data-dashboard-v4-preview-toggle="${slot.slotId}" title="${escapeHtml(slot.slotLabel)}">${escapeHtml(getPathDisplayName(slot))}${suffix ? ` (${suffix})` : ""}</button>`;
}

function bindStandaloneComparisonChart(canvasId, slots, metric, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const chartState = getStandaloneChartState(canvasId);
  const draw = () => {
    const series = buildComparisonSeries(slots, metric, options);
    drawLineChart(
      canvas,
      series,
      chartState,
      prepareStandaloneCanvas(canvas, options.height || 300),
      { rows: getHorizonRows().slice(0, state.horizonYearIndex + 1), visualTheme: getChartTheme() },
    );
  };
  draw();
  canvas.addEventListener("mousemove", (event) => handleStandaloneChartPointerMove(chartState, canvas, event, draw));
  canvas.addEventListener("mouseleave", () => handleStandaloneChartPointerLeave(chartState, draw));
}

function getStandaloneChartState(chartId) {
  if (!state.standaloneCharts[chartId]) {
    state.standaloneCharts[chartId] = {
      id: chartId,
      viewStartIndex: 0,
      viewEndIndex: state.horizonYearIndex,
      hoverIndex: null,
      hoverCanvasY: null,
      hoverSlotId: null,
    };
  }
  state.standaloneCharts[chartId].viewStartIndex = 0;
  state.standaloneCharts[chartId].viewEndIndex = state.horizonYearIndex;
  return state.standaloneCharts[chartId];
}

function handleStandaloneChartPointerMove(chartState, canvas, event, draw) {
  const rect = canvas.getBoundingClientRect();
  const rows = getHorizonRows().slice(0, state.horizonYearIndex + 1);
  if (!rows.length) return;
  const dpr = window.devicePixelRatio || 1;
  const logicalWidth = canvas.width / dpr;
  const logicalHeight = canvas.height / dpr;
  const ratioX = logicalWidth / rect.width;
  const ratioY = logicalHeight / rect.height;
  const x = (event.clientX - rect.left) * ratioX;
  const y = (event.clientY - rect.top) * ratioY;
  const paddingLeft = 56;
  const paddingRight = 26;
  const chartWidth = logicalWidth - paddingLeft - paddingRight;
  const relativeX = Math.max(0, Math.min(chartWidth, x - paddingLeft));
  chartState.hoverIndex = Math.round((relativeX / Math.max(chartWidth, 1)) * Math.max(rows.length - 1, 0));
  chartState.hoverCanvasY = y;
  draw();
}

function handleStandaloneChartPointerLeave(chartState, draw) {
  chartState.hoverIndex = null;
  chartState.hoverCanvasY = null;
  chartState.hoverSlotId = null;
  draw();
}

function buildComparisonSeries(slots, metric, options = {}) {
  return slots.map((slot) => {
    const result = state.previewResults[slot.slotId];
    const pathName = getPathDisplayName(slot);
    if (!result) return null;
    const values = metric === "cumulativeNetCashFlow"
      ? buildCumulativeSeries(result.projection)
      : result.projection.map((row) => row[metric]);
    return {
      label: pathName,
      slotId: slot.slotId,
      slotLabel: pathName,
      pathTitle: pathName,
      color: COLOR_STYLES[slot.colorToken] || COLOR_STYLES.slate,
      values: values.slice(0, state.horizonYearIndex + 1),
      fillAlpha: options.fill ? 0.08 : 0,
      lineWidth: 2.4,
    };
  }).filter(Boolean);
}

function renderDashboardV2ComparisonTable(slots) {
  if (!slots.length) {
    return `<div class="notice">Choose at least one projectable path to populate this summary table.</div>`;
  }
  const metrics = [
    { label: "Final Portfolio", key: "finalPortfolio", highGood: true },
    { label: "Cumulative Gross Income", key: "totalGrossIncome", highGood: true },
    { label: "Cumulative Tax-Free Income", key: "totalTaxFreeIncome", highGood: true },
    { label: "Cumulative Taxes Paid", key: "totalTaxes", highGood: false },
    { label: "Cumulative Healthcare", key: "totalHealthcareCost", highGood: false },
    { label: "Cumulative Net Cash Flow", key: "totalNetCashFlow", highGood: true },
    { label: "Final Year Net Cash Flow", projectionKey: "netCashFlow", highGood: true },
  ];
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="text-align:left">Metric</th>
            ${slots.map((slot) => `<th>${escapeHtml(getPathDisplayName(slot))}</th>`).join("")}
            <th>Best</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.map((metric) => renderDashboardV2TableRow(metric, slots)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderDashboardV2TableRow(metric, slots) {
  const values = slots.map((slot) => {
    const result = state.previewResults[slot.slotId];
    const value = metric.projectionKey
      ? result?.projection?.[state.horizonYearIndex]?.[metric.projectionKey] ?? 0
      : result?.metrics?.[metric.key] ?? 0;
    return { slot, value };
  });
  const winner = [...values].sort((left, right) => metric.highGood ? right.value - left.value : left.value - right.value)[0];
  return `
    <tr>
      <td>${renderTableCellClip(metric.label)}</td>
      ${values.map(({ slot, value }) => `<td class="${winner.slot.slotId === slot.slotId ? "td-best" : ""}" style="color:${COLOR_STYLES[slot.colorToken] || COLOR_STYLES.slate}">${renderTableCellClip(currency.format(value))}</td>`).join("")}
      <td>${renderTableCellClip(getPathDisplayName(winner.slot))}</td>
    </tr>
  `;
}

function buildDashboardV2SlotOptions(selectedSlotId) {
  return getLoadedSlots().map((slot) => `
    <option value="${slot.slotId}" ${slot.slotId === selectedSlotId ? "selected" : ""}>
      ${escapeHtml(getPathDisplayName(slot))}
    </option>
  `).join("");
}

function renderDashboardSection(sectionKey) {
  if (sectionKey === "visuals") return renderVisualsSection();
  return renderProjectionsSection();
}

function renderVisualsSection() {
  const collapsed = state.dashboardSections.collapsed.visuals;
  return `
    <article class="panel dashboard-section" data-dashboard-section="visuals">
      <div class="section-panel-head">
        <div class="section-title-block">
          <p class="panel-eyebrow">Visuals</p>
          <h3>Decision-first comparison charts</h3>
        </div>
        <div class="section-actions">
          <button class="ghost section-action" data-section-move="visuals" data-direction="up">↑</button>
          <button class="ghost section-action" data-section-move="visuals" data-direction="down">↓</button>
          <button class="ghost section-action" data-section-toggle="visuals">${collapsed ? "Expand" : "Collapse"}</button>
        </div>
      </div>
      ${collapsed ? "" : `
        <div class="widget-toolbar compact">
          <div class="widget-toolbar-copy">
            <p class="support-copy">Each widget should answer one question clearly. Use the grouped controls to keep comparisons readable instead of stacking too many line variants at once.</p>
          </div>
          <div class="widget-controls">
            <div class="field compact-field">
              <label for="horizonSelect">Horizon</label>
              <select id="horizonSelect">${buildHorizonOptions()}</select>
            </div>
            <button class="secondary" data-add-widget="true">Add Widget</button>
          </div>
        </div>
        <div id="widgetGrid" class="widget-grid">
          ${state.widgets.map((widget) => renderWidget(widget)).join("")}
        </div>
      `}
    </article>
  `;
}

function renderProjectionsSection() {
  const collapsed = state.dashboardSections.collapsed.projections;
  return `
    <article class="panel dashboard-section" data-dashboard-section="projections">
      <div class="section-panel-head">
        <div class="section-title-block">
          <p class="panel-eyebrow">Projection Preview</p>
          <h3>Compact scenario table</h3>
        </div>
        <div class="section-actions">
          <button class="ghost section-action" data-section-move="projections" data-direction="up">↑</button>
          <button class="ghost section-action" data-section-move="projections" data-direction="down">↓</button>
          <button class="ghost section-action" data-section-toggle="projections">${collapsed ? "Expand" : "Collapse"}</button>
        </div>
      </div>
      ${collapsed ? "" : `
        <div class="preview-controls">
          <div class="section-control-row">
            <div class="control-panel">
              <div class="field compact-field">
                <label>Preview Mode</label>
                <select id="previewModeSelect">
                  <option value="values" ${state.previewSettings.mode === "values" ? "selected" : ""}>Pure Values</option>
                  <option value="delta" ${state.previewSettings.mode === "delta" ? "selected" : ""}>Gain / Loss vs Path</option>
                </select>
              </div>
              <div class="field compact-field">
                <label for="previewBaselineSelect">Preview Baseline</label>
                <select id="previewBaselineSelect">${buildSlotOptions(state.previewSettings.baselineSlotId)}</select>
              </div>
            </div>
          </div>
          <div class="chip-row">
            ${getLoadedSlots().map((slot) => renderPreviewToggle(slot, state.previewSettings.selectedSlotIds.includes(slot.slotId))).join("")}
          </div>
          <div class="chip-row">
            ${renderMetricToggles(state.previewSettings.metrics, ["phaseLabel", "totalIncome", "netCashFlow", "portfolio"], "preview-metric")}
          </div>
        </div>
        ${renderProjectionTable(state.previewSettings)}
      `}
    </article>
  `;
}

function renderWorkspaceSlot(slot) {
  if (!slot.loaded) {
    return `
      <article class="empty-slot">
        <div>
          <p class="slot-label">${slot.slotLabel}</p>
          <div class="slot-title">No path loaded</div>
          <p class="muted-text">Load a saved path into this workspace slot.</p>
        </div>
        <div class="button-row">
          <button class="secondary" data-load-slot="${slot.slotId}">Load</button>
        </div>
      </article>
    `;
  }

  const result = state.previewResults[slot.slotId];
  const total = result ? currency.format(result.metrics.finalPortfolio) : "Pending";
  const editTooltip = "Opens this path in a dedicated editor view.";
  return `
    <article class="path-card ${slot.hiddenFromVisuals ? "is-hidden-from-visuals" : ""}" data-slot-card="${slot.slotId}">
      <div class="path-card-top">
        <div class="slot-head">
          <p class="slot-label">${slot.slotLabel}</p>
          ${slot.titleEditing
            ? `<input class="slot-title-input" type="text" data-slot-title-input="${slot.slotId}" value="${escapeHtml(slot.title || "New Path")}" />`
            : `<button class="slot-title slot-title-button" data-slot-title-trigger="${slot.slotId}" title="Click to rename this path">${escapeHtml(slot.title || "New Path")}</button>`}
        </div>
        <div class="slot-total">Path total: ${total}</div>
        <div class="slot-status"><strong>${slot.hiddenFromVisuals ? "Hidden from visuals" : "In visuals"}</strong></div>
        ${renderPathSummary(buildSlotSummaryLine(slot), { className: "workspace-path-summary", compact: true })}
      </div>

      <div class="button-row">
        <button class="secondary" data-toggle-options="${slot.slotId}">Options</button>
        <button class="primary" data-edit-slot="${slot.slotId}" title="${editTooltip}">Edit</button>
        <button class="ghost" data-collapse-slot="${slot.slotId}">Hide</button>
        <button class="ghost" data-visual-slot="${slot.slotId}">${slot.hiddenFromVisuals ? "Show in Visuals" : "Hide from Visuals"}</button>
        <button class="ghost" data-remove-slot="${slot.slotId}">Remove</button>
        <button class="ghost" data-load-slot="${slot.slotId}">Load</button>
        <button class="ghost" data-save-slot="${slot.slotId}">Save</button>
      </div>

      <div class="options-box ${slot.optionsOpen ? "is-open" : ""}">
        <div class="mini-grid">
          <div class="field">
            <label>Path Title</label>
            <input type="text" data-slot-title="${slot.slotId}" value="${escapeHtml(slot.title)}" />
          </div>
          <div class="field">
            <label>Path Type</label>
            ${renderTimelineBuilder(slot)}
          </div>
          ${renderTimelineDependentFields(slot)}
        </div>
        <div class="toggle-row">
          ${renderTagButton(slot, "useVa", slot.draft.useVa, "VA Benefits")}
          ${renderTagButton(slot, "useGiBill", slot.draft.useGiBill, "GI Bill")}
          <button class="tag ${slot.colorToken} ${slot.showSummary ? "active" : ""}" data-toggle-summary="${slot.slotId}">Show Summary</button>
        </div>
      </div>

      <div class="summary-box ${slot.showSummary ? "is-open" : ""}">
        ${renderPathSummary(slot.draft.routeSummary || buildRouteSummary(slot.draft), { compact: true })}
      </div>
    </article>
  `;
}

function renderCompactSlot(slot) {
  return `
    <article class="compact-path-card">
      <span class="dot ${slot.colorToken}"></span>
      <div>
        <div class="slot-label">${slot.slotLabel}</div>
        <div class="compact-title">${escapeHtml(slot.title || "New Path")}</div>
      </div>
      <div class="button-row tight">
        <button class="ghost" data-show-slot="${slot.slotId}">Show</button>
        <button class="ghost" data-edit-slot="${slot.slotId}" title="Opens this path in a dedicated editor view.">Edit</button>
      </div>
    </article>
  `;
}

function renderTagButton(slot, field, isActive, label) {
  return `<button class="tag ${slot.colorToken} ${isActive ? "active" : ""}" data-toggle-flag="${slot.slotId}" data-flag="${field}">${label} ${isActive ? "On" : "Off"}</button>`;
}

function bindWorkspacePanelEvents(root) {
  bindElements(root, "[data-add-path]", "click", () => {
    openAddPathModal();
  });
}

function bindDashboardSlotEvents(root) {
  bindTimelineBuilderEvents(root);
  root.querySelectorAll("[data-slot-title-trigger]").forEach((button) => {
    button.addEventListener("click", () => {
      state.workspaceSlots.forEach((slot) => {
        slot.titleEditing = slot.slotId === button.dataset.slotTitleTrigger;
      });
      renderCurrentScreen();
    });
  });
  root.querySelectorAll("[data-slot-title-input]").forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitSlotTitleEdit(input.dataset.slotTitleInput, input.value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelSlotTitleEdit(input.dataset.slotTitleInput);
      }
    });
    input.addEventListener("blur", () => {
      commitSlotTitleEdit(input.dataset.slotTitleInput, input.value);
    });
  });
  root.querySelectorAll("[data-load-slot]").forEach((button) => {
    button.addEventListener("click", () => requestLoadIntoSlot(button.dataset.loadSlot));
  });
  root.querySelectorAll("[data-save-slot]").forEach((button) => {
    button.addEventListener("click", () => saveSlot(button.dataset.saveSlot));
  });
  root.querySelectorAll("[data-remove-slot]").forEach((button) => {
    button.addEventListener("click", () => requestRemoveSlot(button.dataset.removeSlot));
  });
  root.querySelectorAll("[data-collapse-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = getSlot(button.dataset.collapseSlot);
      slot.collapsedOnDashboard = true;
      slot.optionsOpen = false;
      renderDashboardWithTransition();
    });
  });
  root.querySelectorAll("[data-show-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = getSlot(button.dataset.showSlot);
      slot.collapsedOnDashboard = false;
      renderDashboardWithTransition();
    });
  });
  root.querySelectorAll("[data-visual-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = getSlot(button.dataset.visualSlot);
      slot.hiddenFromVisuals = !slot.hiddenFromVisuals;
      syncSelectionState();
      renderDashboardWithTransition();
    });
  });
  root.querySelectorAll("[data-edit-slot]").forEach((button) => {
    button.addEventListener("click", () => openPathEditor(button.dataset.editSlot));
  });
  root.querySelectorAll("[data-toggle-options]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = getSlot(button.dataset.toggleOptions);
      slot.optionsOpen = !slot.optionsOpen;
      renderDashboardWithTransition();
    });
  });
  root.querySelectorAll("[data-slot-title]").forEach((input) => {
    input.addEventListener("change", async () => {
      const slot = getSlot(input.dataset.slotTitle);
      slot.title = input.value.trim();
      slot.titleTouched = true;
      slot.draft.displayName = slot.title || "New Path";
      markSlotDirty(slot, "title");
      await loadPreviewResults();
    });
  });
  root.querySelectorAll("[data-slot-field]").forEach((input) => {
    input.addEventListener("change", async () => {
      const slot = getSlot(input.dataset.slotField);
      slot.draft[input.dataset.field] = input.value || null;
      applyPathDependencies(slot);
      markSlotDirty(slot, input.dataset.field);
      await loadPreviewResults();
    });
  });
  root.querySelectorAll("[data-toggle-flag]").forEach((button) => {
    button.addEventListener("click", async () => {
      const slot = getSlot(button.dataset.toggleFlag);
      const field = button.dataset.flag;
      slot.draft[field] = !slot.draft[field];
      markSlotDirty(slot, field);
      await loadPreviewResults();
    });
  });
  root.querySelectorAll("[data-toggle-summary]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = getSlot(button.dataset.toggleSummary);
      slot.showSummary = !slot.showSummary;
      renderCurrentScreen();
    });
  });
  root.querySelectorAll("[data-preview-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleArrayMember(state.previewSettings.selectedSlotIds, button.dataset.previewToggle);
      if (!state.previewSettings.selectedSlotIds.length) {
        state.previewSettings.selectedSlotIds = getLoadedSlots().map((slot) => slot.slotId);
      }
      renderCurrentScreen();
    });
  });
  root.querySelectorAll("[data-preview-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleArrayMember(state.previewSettings.metrics, button.dataset.previewMetric);
      if (!state.previewSettings.metrics.length) {
        state.previewSettings.metrics = ["phaseLabel", "totalIncome", "netCashFlow", "portfolio"];
      }
      renderCurrentScreen();
    });
  });

  const activeTitleInput = root.querySelector("[data-slot-title-input]");
  if (activeTitleInput) {
    activeTitleInput.focus();
    activeTitleInput.select();
  }
}

function bindTimelineBuilderEvents(root) {
  return root;
}

function bindDashboardSectionEvents(root) {
  root.querySelectorAll("[data-section-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.sectionToggle;
      state.dashboardSections.collapsed[key] = !state.dashboardSections.collapsed[key];
      renderDashboardWithTransition();
    });
  });
  root.querySelectorAll("[data-section-move]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.sectionMove;
      const direction = button.dataset.direction;
      moveSection(key, direction);
      renderDashboardWithTransition();
    });
  });
}

function bindDashboardV4Events(root) {
  const globalHorizon = root.querySelector("#dashboardV4GlobalHorizon");
  if (globalHorizon) {
    globalHorizon.addEventListener("change", () => {
      const nextIndex = Number(globalHorizon.value);
      state.dashboardV4.visualsHorizonYearIndex = nextIndex;
      state.dashboardV4.charts.forEach((chart) => {
        chart.maxHorizonIndex = nextIndex;
        resetWidgetViewport(chart);
      });
      renderCurrentScreen();
    });
  }

  const highlightHorizon = root.querySelector("#dashboardV4HighlightHorizon");
  if (highlightHorizon) {
    highlightHorizon.addEventListener("change", () => {
      state.dashboardV4.highlightsHorizonYearIndex = Number(highlightHorizon.value);
      renderCurrentScreen();
    });
  }

  bindElements(root, "[data-dashboard-v4-highlight-slot]", "change", (input) => {
    const slotId = input.dataset.dashboardV4HighlightSlot;
    const selected = state.dashboardV4.highlightsSelectedSlotIds;
    if (input.checked) {
      if (!selected.includes(slotId) && selected.length < 3) {
        selected.push(slotId);
      }
    } else if (selected.includes(slotId) && selected.length > 1) {
      state.dashboardV4.highlightsSelectedSlotIds = selected.filter((id) => id !== slotId);
    }
    renderCurrentScreen();
  });

  bindElements(root, "[data-v4-chart-horizon]", "change", (input) => {
    const chart = getDashboardV4Chart(input.dataset.v4ChartHorizon);
    chart.maxHorizonIndex = Number(input.value);
    resetWidgetViewport(chart);
    renderCurrentScreen();
  });
  bindElements(root, "[data-v4-chart-zoom]", "click", (button) => {
    const chart = getDashboardV4Chart(button.dataset.v4ChartZoom);
    stepWidgetZoom(chart, Number(button.dataset.step));
    renderCurrentScreen();
  });
  bindElements(root, "[data-v4-chart-reset]", "click", (button) => {
    const chart = getDashboardV4Chart(button.dataset.v4ChartReset);
    resetWidgetViewport(chart);
    renderCurrentScreen();
  });
  bindElements(root, "[data-v4-chart-size]", "click", (button) => {
    const chart = getDashboardV4Chart(button.dataset.v4ChartSize);
    chart.size = button.dataset.size;
    renderCurrentScreen();
  });
  bindElements(root, "[data-v4-chart-scroll]", "input", (input) => {
    const chart = getDashboardV4Chart(input.dataset.v4ChartScroll);
    const currentLength = Math.max(CHART_INTERACTION.minVisibleRows, chart.viewEndIndex - chart.viewStartIndex + 1);
    const maxStart = Math.max(0, getChartMaxIndex(chart) - currentLength + 1);
    const nextStart = Math.max(0, Math.min(Number(input.value), maxStart));
    chart.viewStartIndex = nextStart;
    chart.viewEndIndex = Math.min(getChartMaxIndex(chart), nextStart + currentLength - 1);
    drawDashboardV4Charts();
  });
  bindElements(root, "[data-v4-chart-legend]", "click", (button) => {
    const chart = getDashboardV4Chart(button.dataset.v4ChartLegend);
    toggleArrayMember(chart.selectedSlotIds, button.dataset.slotId);
    renderCurrentScreen();
  });
  bindElements(root, "[data-dashboard-v4-preview-toggle]", "click", (button) => {
    toggleArrayMember(state.dashboardV4.preview.selectedSlotIds, button.dataset.dashboardV4PreviewToggle);
    if (!state.dashboardV4.preview.selectedSlotIds.length) {
      state.dashboardV4.preview.selectedSlotIds = [...getLoadedSlots().map((slot) => slot.slotId)];
    }
    renderCurrentScreen();
  });
  bindElements(root, "[data-dashboard-v4-preview-metric]", "click", (button) => {
    toggleArrayMember(state.dashboardV4.preview.metrics, button.dataset.dashboardV4PreviewMetric);
    if (!state.dashboardV4.preview.metrics.length) {
      state.dashboardV4.preview.metrics = ["phaseLabel", "totalIncome", "netCashFlow", "portfolio"];
    }
    renderCurrentScreen();
  });

  const previewMode = root.querySelector("#dashboardV4PreviewMode");
  if (previewMode) {
    previewMode.addEventListener("change", () => {
      state.dashboardV4.preview.mode = previewMode.value;
      renderCurrentScreen();
    });
  }

  root.querySelectorAll("canvas[id^='dashboardV4Canvas-']").forEach((canvas) => {
    const chartId = canvas.id.replace("dashboardV4Canvas-", "");
    const chart = getDashboardV4Chart(chartId);
    canvas.addEventListener("mousemove", (event) => handleWidgetPointerMove(chart, canvas, event));
    canvas.addEventListener("mouseleave", () => handleWidgetPointerLeave(chart, canvas));
  });
}

function renderWidget(widget) {
  const viewConfig = getWidgetViewConfig(widget);
  const visibleSlots = getWidgetEligibleSlots();
  const legend = renderWidgetLegend(widget);
  return `
    <article
      class="widget-card"
      data-widget-id="${widget.id}"
      data-size="${widget.size}"
      draggable="true"
    >
      ${renderWidgetHeader(widget, viewConfig)}
      ${renderWidgetControlStrip(widget, viewConfig)}
      ${renderWidgetClarityNote(widget)}
      <div class="widget-chart" data-widget-chart="${widget.id}">
        <canvas id="canvas-${widget.id}"></canvas>
      </div>
      <div class="widget-legend">${legend}</div>
    </article>
  `;
}

function renderWidgetHeader(widget, viewConfig) {
  return `
    <div class="widget-head">
      <div class="widget-head-main">
        <span class="widget-eyebrow-inline">Widget</span>
        <h3 class="widget-title" title="${escapeHtml(widget.title)}">${widget.title}</h3>
        <span class="widget-mode-pill group-${viewConfig.tone}">${viewConfig.label}</span>
      </div>
      <div class="button-row widget-mini-actions">
        <button class="ghost widget-tool" data-widget-pan="${widget.id}" data-step="-1" title="Pan earlier"><</button>
        <button class="ghost widget-tool" data-widget-zoom="${widget.id}" data-step="-1" title="Zoom out">-</button>
        <button class="ghost widget-tool" data-widget-reset="${widget.id}" title="Reset timeline">0</button>
        <button class="ghost widget-tool" data-widget-zoom="${widget.id}" data-step="1" title="Zoom in">+</button>
        <button class="ghost widget-tool" data-widget-pan="${widget.id}" data-step="1" title="Pan later">></button>
        <button class="ghost widget-tool wide" data-cycle-size="${widget.id}" title="Resize widget">${widget.size}</button>
        <button class="ghost widget-tool" data-remove-widget="${widget.id}" title="Remove widget">x</button>
      </div>
    </div>
  `;
}

function renderWidgetControlStrip(widget, viewConfig) {
  return `
    <div class="widget-meta">
      <div class="widget-control-strip">
        <div class="field widget-inline-field">
          <label>View</label>
          <select class="widget-select" data-widget-view-select="${widget.id}">
            ${Object.entries(WIDGET_VIEW_PRESETS).map(([viewKey, config]) => `
              <option value="${viewKey}" ${widget.viewMode === viewKey ? "selected" : ""}>${config.label}</option>
            `).join("")}
          </select>
        </div>
        ${widget.viewMode === "custom"
          ? renderCustomMetricGroups(widget)
          : renderPresetMetricToggles(widget, viewConfig)}
      </div>
    </div>
  `;
}

function renderWidgetMenu(label, count, content, tone = "slate") {
  return `
    <details class="widget-menu group-${tone}">
      <summary>${label} <span>${count}</span></summary>
      <div class="widget-menu-panel">${content}</div>
    </details>
  `;
}

function renderPresetMetricToggles(widget, viewConfig) {
  return `
    <div class="widget-inline-metrics">
      ${viewConfig.inlineMetrics.map((metric) => `
        <button
          class="metric-pill group-${viewConfig.tone} ${widget.metrics.includes(metric) ? "active" : ""}"
          data-widget-metric-toggle="${widget.id}"
          data-metric="${metric}"
        >
          ${METRIC_LABELS[metric]}
        </button>
      `).join("")}
    </div>
  `;
}

function renderCustomMetricGroups(widget) {
  return `
    <div class="widget-inline-groups">
      ${Object.entries(METRIC_GROUPS)
        .filter(([groupKey]) => groupKey !== "custom")
        .map(([groupKey, config]) => {
          const activeCount = config.metrics.filter((metric) => widget.metrics.includes(metric)).length;
          return renderWidgetMenu(
            config.label,
            activeCount,
            config.metrics.map((metric) => `
              <label class="widget-check-row">
                <input type="checkbox" data-widget-metric-toggle="${widget.id}" data-metric="${metric}" ${widget.metrics.includes(metric) ? "checked" : ""} />
                <span>${METRIC_LABELS[metric]}</span>
              </label>
            `).join(""),
            config.tone,
          );
        }).join("")}
    </div>
  `;
}

function bindWidgetEvents(root) {
  const widgetGrid = root.querySelector("#widgetGrid");
  if (!widgetGrid) return;

  widgetGrid.querySelectorAll("[data-widget-id]").forEach((card) => {
    card.addEventListener("dragstart", () => {
      state.draggingWidgetId = card.dataset.widgetId;
      card.classList.add("is-dragging");
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("is-dragging");
      state.draggingWidgetId = null;
    });
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      moveWidget(state.draggingWidgetId, card.dataset.widgetId);
      renderDashboardWithTransition();
    });
  });

  bindElements(root, "[data-widget-view-select]", "change", (input) => {
    const widget = getWidget(input.dataset.widgetViewSelect);
    applyWidgetViewMode(widget, input.value);
    resetWidgetViewport(widget);
    renderCurrentScreen();
  });
  bindElements(root, "[data-widget-legend-slot]", "click", (button) => {
    const widget = getWidget(button.dataset.widgetLegendSlot);
    toggleArrayMember(widget.selectedSlotIds, button.dataset.slotId);
    if (!widget.selectedSlotIds.length) {
      widget.selectedSlotIds = [...getWidgetEligibleSlots().map((slot) => slot.slotId)];
    }
    renderCurrentScreen();
  });
  bindElements(root, "[data-widget-metric-toggle]", "click", (element) => {
    const widget = getWidget(element.dataset.widgetMetricToggle);
    const metric = element.dataset.metric;
    const metricList = getWidgetMetricOptions(widget);
    if (!metricList.includes(metric)) return;
    if (widget.viewMode !== "custom" && metricList.length === 1) {
      widget.metrics = widget.metrics.includes(metric) ? [] : [metric];
    } else {
      toggleArrayMember(widget.metrics, metric);
    }
    if (!widget.metrics.length) {
      widget.metrics = [...getWidgetViewConfig(widget).defaultMetrics];
    }
    renderCurrentScreen();
  });
  bindElements(root, "[data-widget-zoom]", "click", (button) => {
    const widget = getWidget(button.dataset.widgetZoom);
    stepWidgetZoom(widget, Number(button.dataset.step));
    renderCurrentScreen();
  });
  bindElements(root, "[data-widget-pan]", "click", (button) => {
    const widget = getWidget(button.dataset.widgetPan);
    stepWidgetPan(widget, Number(button.dataset.step));
    renderCurrentScreen();
  });
  bindElements(root, "[data-widget-reset]", "click", (button) => {
    const widget = getWidget(button.dataset.widgetReset);
    resetWidgetViewport(widget);
    renderCurrentScreen();
  });
  bindElements(root, "[data-cycle-size]", "click", (button) => {
    const widget = getWidget(button.dataset.cycleSize);
    widget.size = nextWidgetSize(widget.size);
    renderDashboardWithTransition();
  });
  bindElements(root, "[data-remove-widget]", "click", (button) => {
    state.widgets = state.widgets.filter((widget) => widget.id !== button.dataset.removeWidget);
    renderDashboardWithTransition();
  });
  root.querySelectorAll("canvas[id^='canvas-']").forEach((canvas) => {
    const widgetId = canvas.id.replace("canvas-", "");
    const widget = getWidget(widgetId);
    canvas.addEventListener("mousemove", (event) => handleWidgetPointerMove(widget, canvas, event));
    canvas.addEventListener("mouseleave", () => handleWidgetPointerLeave(widget, canvas));
    canvas.addEventListener("wheel", (event) => handleWidgetWheel(widget, canvas, event), { passive: false });
    canvas.addEventListener("mousedown", (event) => handleWidgetPanStart(widget, canvas, event));
  });
  window.onmouseup = () => {
    state.widgets.forEach((widget) => {
      widget.isPanning = false;
    });
  };
  window.onmousemove = (event) => {
    state.widgets.filter((widget) => widget.isPanning).forEach((widget) => {
      const canvas = document.getElementById(`canvas-${widget.id}`);
      if (canvas) handleWidgetPanMove(widget, canvas, event);
    });
  };
}

function bindElements(root, selector, eventName, handler) {
  root.querySelectorAll(selector).forEach((element) => {
    element.addEventListener(eventName, (event) => handler(element, event));
  });
}

function drawDashboardWidgets() {
  state.widgets.forEach((widget) => {
    const canvas = document.getElementById(`canvas-${widget.id}`);
    drawWidgetChart(canvas, widget);
  });
}

function drawDashboardV4Charts() {
  state.dashboardV4.charts.forEach((chart) => {
    const canvas = document.getElementById(`dashboardV4Canvas-${chart.id}`);
    drawWidgetChart(canvas, chart);
  });
}

function drawWidgetChart(canvas, widget) {
  if (!canvas) return;
  const geometry = prepareCanvas(canvas, widget);
  const series = getWidgetSeries(widget);
  drawLineChart(canvas, series, widget, geometry, { visualTheme: getChartTheme() });
  syncWidgetLegendState(widget);
}

function getChartTheme() {
  if (getEffectiveTheme() === "dark") {
    return {
      background: "#121722",
      emptyText: "#93a0b5",
      grid: "rgba(255, 255, 255, 0.09)",
      axisText: "#93a0b5",
      crosshair: "rgba(255, 255, 255, 0.34)",
      tooltipBg: "rgba(8, 12, 19, 0.96)",
      tooltipText: "#edf1f7",
      tooltipMuted: "rgba(237, 241, 247, 0.72)",
    };
  }
  return {
    background: "#fffaf1",
    emptyText: "#637282",
    grid: "rgba(31, 42, 54, 0.1)",
    axisText: "#637282",
    crosshair: "rgba(31, 42, 54, 0.35)",
    tooltipBg: "rgba(31, 42, 54, 0.92)",
    tooltipText: "#fffaf1",
    tooltipMuted: "rgba(255, 250, 241, 0.72)",
  };
}

function drawLineChart(canvas, series, widget = null, geometry = null, options = {}) {
  const { context, width, height } = geometry || prepareCanvas(canvas, widget);
  const padding = { top: 18, right: 18, bottom: 30, left: 58 };
  const viewRows = options.rows || getWidgetRows(widget);
  const visualTheme = options.visualTheme || getChartTheme();
  context.clearRect(0, 0, width, height);
  context.fillStyle = visualTheme.background;
  context.fillRect(0, 0, width, height);

  if (!series.length || !viewRows.length) {
    context.fillStyle = visualTheme.emptyText;
    context.font = "15px Avenir Next";
    context.fillText("Select paths and metrics to display this widget.", padding.left, height / 2);
    return;
  }

  const allValues = series.flatMap((item) => item.values);
  const minValue = Math.min(...allValues, 0);
  const maxValue = Math.max(...allValues, 1);
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const hoverState = widget && widget.hoverIndex !== null
    ? getWidgetHoverState(widget, series, { padding, chartHeight, height, minValue, maxValue })
    : null;

  if (widget) {
    widget.hoverSlotId = hoverState?.slotId || null;
  }

  for (let index = 0; index <= 4; index += 1) {
    const y = padding.top + (chartHeight / 4) * index;
    context.strokeStyle = visualTheme.grid;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
  }

  const orderedSeries = hoverState
    ? [...series].sort((left, right) => Number(left.slotId === hoverState.slotId) - Number(right.slotId === hoverState.slotId))
    : series;

  orderedSeries.forEach((item) => {
    const isActiveSlot = !hoverState || item.slotId === hoverState.slotId;
    if (item.fillAlpha) {
      context.save();
      context.fillStyle = applyAlpha(item.color, isActiveSlot ? item.fillAlpha : Math.min(0.04, item.fillAlpha));
      context.beginPath();
      item.values.forEach((value, rowIndex) => {
        const x = padding.left + (chartWidth / Math.max(item.values.length - 1, 1)) * rowIndex;
        const normalized = (value - minValue) / (maxValue - minValue || 1);
        const y = height - padding.bottom - normalized * chartHeight;
        if (rowIndex === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.lineTo(padding.left + chartWidth, height - padding.bottom);
      context.lineTo(padding.left, height - padding.bottom);
      context.closePath();
      context.fill();
      context.restore();
    }

    context.save();
    context.strokeStyle = isActiveSlot ? item.color : applyAlpha(item.color, 0.22);
    context.lineWidth = isActiveSlot ? (item.lineWidth || 2.25) + (hoverState ? 0.45 : 0) : 1.55;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.setLineDash([]);
    context.beginPath();
    item.values.forEach((value, rowIndex) => {
      const x = padding.left + (chartWidth / Math.max(item.values.length - 1, 1)) * rowIndex;
      const normalized = (value - minValue) / (maxValue - minValue || 1);
      const y = height - padding.bottom - normalized * chartHeight;
      if (rowIndex === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    context.restore();
  });

  context.fillStyle = visualTheme.axisText;
  context.font = "11px Avenir Next";
  viewRows.forEach((row, index) => {
    const frequency = Math.max(1, Math.ceil(viewRows.length / 6));
    if (index % frequency !== 0 && index !== viewRows.length - 1) return;
    const x = padding.left + (chartWidth / Math.max(viewRows.length - 1, 1)) * index;
    context.fillText(String(row.calendarYear), x - 14, height - 10);
  });

  for (let index = 0; index <= 4; index += 1) {
    const value = maxValue - ((maxValue - minValue) / 4) * index;
    const y = padding.top + (chartHeight / 4) * index;
    context.fillStyle = visualTheme.axisText;
    context.fillText(formatCompactCurrency(value), 8, y + 3);
  }

  if (widget && widget.hoverIndex !== null && widget.hoverIndex < viewRows.length) {
    drawWidgetCrosshair(context, widget, series, viewRows, { width, height, padding, chartWidth, chartHeight, minValue, maxValue }, hoverState, visualTheme);
  }
}

function renderProjectionTable(settings) {
  syncSelectionState();
  const selectedSlots = getLoadedSlots().filter((slot) => settings.selectedSlotIds.includes(slot.slotId));
  const rowEndIndex = settings.rowHorizonYearIndex ?? state.horizonYearIndex;
  const rows = getHorizonRows().slice(0, rowEndIndex + 1);
  const implicitBaselineSlot = settings.implicitBaselineFromSelection
    ? selectedSlots.find((slot) => state.previewResults[slot.slotId])
    : null;
  const baselineResult = implicitBaselineSlot
    ? state.previewResults[implicitBaselineSlot.slotId]
    : state.previewResults[settings.baselineSlotId];
  if (!selectedSlots.length) {
    return `<div class="notice">Select at least one loaded path to populate this comparison table.</div>`;
  }
  if (!rows.length) {
    return `<div class="notice">Choose enough path details to generate projections for this table.</div>`;
  }
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th rowspan="2">Year</th>
            <th rowspan="2">Age</th>
            ${selectedSlots.map((slot) => `
              <th colspan="${settings.metrics.length}" class="path-group-start path-header-cell path-header-${slot.colorToken}">
                <div class="table-cell-stack">
                  ${renderTableCellClip(getPathDisplayName(slot))}
                  ${renderPathSummary(buildSlotSummaryLine(slot), { compact: true })}
                </div>
              </th>
            `).join("")}
          </tr>
          <tr>
            ${selectedSlots.map(() => settings.metrics.map((metric) => `<th>${METRIC_LABELS[metric]}</th>`).join("")).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map((sharedRow, rowIndex) => `
            <tr>
              <td>${renderTableCellClip(sharedRow.calendarYear)}</td>
              <td>${renderTableCellClip(sharedRow.age)}</td>
              ${selectedSlots.map((slot) => renderProjectionCells(slot, settings, rowIndex, baselineResult)).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderProjectionCells(slot, settings, rowIndex, baselineResult) {
  const result = state.previewResults[slot.slotId];
  if (!result) return settings.metrics.map(() => `<td class="path-group-start">${renderTableCellClip("—")}</td>`).join("");
  const row = result.projection[rowIndex];
  const baselineRow = baselineResult?.projection?.[rowIndex];
  return settings.metrics.map((metric, index) => {
    const isFirst = index === 0 ? "path-group-start" : "";
    const value = row[metric];
    if (settings.mode === "delta" && baselineRow && typeof value === "number") {
      const delta = value - baselineRow[metric];
      const cls = delta > 0 ? "delta-pos" : delta < 0 ? "delta-neg" : "";
      return `<td class="${isFirst} ${cls}">${renderTableCellClip(formatDelta(delta))}</td>`;
    }
    return `<td class="${isFirst}">${renderTableCellClip(formatMetricValue(metric, value))}</td>`;
  }).join("");
}

function renderPreviewToggle(slot, active) {
  const suffix = [
    slot.collapsedOnDashboard ? "hidden card" : null,
    slot.hiddenFromVisuals ? "not in visuals" : null,
  ].filter(Boolean).join(" · ");
  return `<button class="tag ${slot.colorToken} ${active ? "active" : ""}" data-preview-toggle="${slot.slotId}" title="${escapeHtml(slot.slotLabel)}">${escapeHtml(getPathDisplayName(slot))}${suffix ? ` (${suffix})` : ""}</button>`;
}

function renderMetricToggles(activeMetrics, allowedMetrics, datasetName) {
  return allowedMetrics.map((metric) => `
    <button class="tag slate ${activeMetrics.includes(metric) ? "active" : ""}" data-${datasetName}="${metric}">
      ${METRIC_LABELS[metric]}
    </button>
  `).join("");
}

function renderWidgetClarityNote(widget) {
  const selectedProjectableSlots = getWidgetEligibleSlots().filter((slot) => widget.selectedSlotIds.includes(slot.slotId));
  if (!widget.metrics.length) {
    return `<div class="widget-note">Blank slate: pick one grouped metric to answer a specific question.</div>`;
  }
  if (widget.metrics.length > 1 && selectedProjectableSlots.length > 1) {
    return `<div class="widget-note">For clarity, multi-metric views focus on the first visible path only.</div>`;
  }
  return "";
}

function renderPathEditor() {
  const editor = document.getElementById("path-editor");
  const slot = getEditorSlot();
  if (!slot || !slot.loaded) {
    editor.innerHTML = `
      <article class="panel">
        <p class="panel-eyebrow">Path Editor</p>
        <h3>Select a loaded path to edit</h3>
        <p class="support-copy">Use the dashboard path cards and click <strong>Edit</strong> to open a dedicated deep-edit page for one path.</p>
      </article>
    `;
    return;
  }

  const result = state.previewResults[slot.slotId];
  editor.innerHTML = `
    <div class="editor-stack">
      <article class="panel">
        <div class="panel-header">
          <div>
            <p class="panel-eyebrow">${slot.slotLabel}</p>
            <h2 class="path-editor-title">${escapeHtml(slot.title || "New Path")}</h2>
            <div class="support-copy">${renderPathSummary(slot.draft.routeSummary || buildRouteSummary(slot.draft), { compact: true })}</div>
          </div>
          <div class="button-row">
            <button class="secondary" id="backToDashboardBtn">Back to Dashboard</button>
            <button class="ghost" id="loadEditorPathBtn">Load Saved Path</button>
            <button class="ghost" id="saveEditorPathBtn">Save Current Path</button>
          </div>
        </div>
      </article>

      <div class="editor-layout">
        <article class="panel">
          <div class="editor-stats">
            <div class="stat-card">
              <p class="muted-label">At Current Horizon</p>
              <div class="editor-summary-list">
                <div class="mini-stat-row">
                  <span>Projected total</span>
                  <strong>${result ? currency.format(result.metrics.finalPortfolio) : "—"}</strong>
                </div>
                <div class="mini-stat-row">
                  <span>Total taxes</span>
                  <strong>${result ? currency.format(result.metrics.totalTaxes) : "—"}</strong>
                </div>
                <div class="mini-stat-row">
                  <span>Healthcare</span>
                  <strong>${result ? currency.format(result.metrics.totalHealthcareCost) : "—"}</strong>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-eyebrow">Deep Edit</p>
              <h3>Route, assumptions, and notes</h3>
            </div>
          </div>
          <div class="mini-grid">
            <div class="field" id="path-editor-field-displayName" data-source-target="path-editor-field-displayName">
              <label>Path Title</label>
              <input id="editorTitleInput" value="${escapeHtml(slot.title)}" />
            </div>
            <div class="field" id="path-editor-field-pathTemplateId" data-source-target="path-editor-field-pathTemplateId">
              <label>Path Type</label>
              ${renderTimelineBuilder(slot, { editor: true })}
            </div>
            ${renderTimelineDependentFields(slot, { editor: true })}
            <div class="field" id="path-editor-field-monthlyLivingExpenses" data-source-target="path-editor-field-monthlyLivingExpenses">
              <label>Monthly Living Expenses Override</label>
              <input id="editorLivingOverride" type="number" step="0.01" value="${slot.draft.overrides?.monthlyLivingExpenses ?? ""}" />
            </div>
            <div class="field" id="path-editor-field-colorToken" data-source-target="path-editor-field-colorToken">
              <label>Color</label>
              <select id="editorColorSelect">
                ${["sage", "amber", "azure", "plum", "slate"].map((token) => `<option value="${token}" ${slot.draft.colorToken === token ? "selected" : ""}>${token}</option>`).join("")}
              </select>
            </div>
            <div class="field full-span" id="path-editor-field-notes" data-source-target="path-editor-field-notes">
              <label>Notes</label>
              <textarea id="editorNotesInput">${escapeHtml(slot.draft.notes || "")}</textarea>
            </div>
          </div>
          <div class="toggle-row">
            <button class="tag ${slot.colorToken} ${slot.draft.useVa ? "active" : ""}" data-editor-toggle="useVa">VA Benefits ${slot.draft.useVa ? "On" : "Off"}</button>
            <button class="tag ${slot.colorToken} ${slot.draft.useGiBill ? "active" : ""}" data-editor-toggle="useGiBill">GI Bill ${slot.draft.useGiBill ? "On" : "Off"}</button>
          </div>
        </article>
      </div>
    </div>
  `;

  editor.querySelector("#backToDashboardBtn").addEventListener("click", () => {
    switchScreen("dashboard-v4");
  });
  editor.querySelector("#loadEditorPathBtn").addEventListener("click", () => requestLoadIntoSlot(slot.slotId));
  editor.querySelector("#saveEditorPathBtn").addEventListener("click", () => saveSlot(slot.slotId));
  editor.querySelector("#editorTitleInput").addEventListener("change", async (event) => {
    slot.title = event.target.value.trim();
    slot.titleTouched = true;
    slot.draft.displayName = slot.title || "New Path";
    markSlotDirty(slot, "title");
    await loadPreviewResults();
  });
  const editorPathTemplateSelect = editor.querySelector("#editorPathTemplateSelect");
  if (editorPathTemplateSelect) {
    editorPathTemplateSelect.addEventListener("change", async (event) => {
      slot.draft.pathTemplateId = event.target.value || "PATH_A";
      applyPathDependencies(slot);
      markSlotDirty(slot, "pathTemplateId");
      await loadPreviewResults();
    });
  }
  const editorSchoolSelect = editor.querySelector("#editorSchoolSelect");
  if (editorSchoolSelect) {
    editorSchoolSelect.addEventListener("change", async (event) => {
      slot.draft.selectedPhdProgramId = event.target.value || null;
      applyPathDependencies(slot);
      markSlotDirty(slot, "selectedPhdProgramId");
      await loadPreviewResults();
    });
  }
  const editorEmployerSelect = editor.querySelector("#editorEmployerSelect");
  if (editorEmployerSelect) {
    editorEmployerSelect.addEventListener("change", async (event) => {
      slot.draft.selectedEmployerId = event.target.value || null;
      markSlotDirty(slot, "selectedEmployerId");
      await loadPreviewResults();
    });
  }
  const editorCompanySelect = editor.querySelector("#editorCompanySelect");
  if (editorCompanySelect) {
    editorCompanySelect.addEventListener("change", async (event) => {
      slot.draft.selectedCompanyId = event.target.value || null;
      markSlotDirty(slot, "selectedCompanyId");
      await loadPreviewResults();
    });
  }
  const editorVaSelect = editor.querySelector("#editorVaSelect");
  if (editorVaSelect) {
    editorVaSelect.addEventListener("change", async (event) => {
      slot.draft.selectedVaRatingId = event.target.value;
      markSlotDirty(slot, "selectedVaRatingId");
      await loadPreviewResults();
    });
  }
  editor.querySelector("#editorLivingOverride").addEventListener("change", async (event) => {
    const value = event.target.value;
    slot.draft.overrides = slot.draft.overrides || {};
    if (value === "") delete slot.draft.overrides.monthlyLivingExpenses;
    else slot.draft.overrides.monthlyLivingExpenses = Number(value);
    markSlotDirty(slot, "monthlyLivingExpenses");
    await loadPreviewResults();
  });
  editor.querySelector("#editorColorSelect").addEventListener("change", async (event) => {
    slot.colorToken = event.target.value;
    slot.draft.colorToken = event.target.value;
    markSlotDirty(slot, "colorToken");
    await loadPreviewResults();
  });
  editor.querySelector("#editorNotesInput").addEventListener("change", async (event) => {
    slot.draft.notes = event.target.value;
    markSlotDirty(slot, "notes");
    await loadPreviewResults();
  });
  editor.querySelectorAll("[data-editor-toggle]").forEach((button) => {
    button.addEventListener("click", async () => {
      const field = button.dataset.editorToggle;
      slot.draft[field] = !slot.draft[field];
      markSlotDirty(slot, field);
      await loadPreviewResults();
    });
  });
}

function renderManualFinance() {
  const finance = document.getElementById("finance");
  const manual = state.bootstrap.manualCashflowInputs || { income: [], expenses: [], assets: [], debts: [] };
  finance.innerHTML = `
    <div class="reference-shell finance-sheet-shell">
      <article class="panel">
        <div class="panel-header">
          <div>
            <p class="panel-eyebrow">Manual Finance</p>
            <h3>Editable workbook-style finance sheets</h3>
            <p class="support-copy">These are your user-owned planning inputs. Edit any line item inline, add your own custom rows inside each section, and save when you want the dashboard and projections to refresh.</p>
          </div>
        </div>
        <div class="reference-summary-strip">
          <span class="reference-chip">4 buckets</span>
          <span class="reference-chip">${countManualFinanceItems(manual)} line items</span>
          <span class="reference-chip">Inline edit + custom rows</span>
          <span class="reference-chip">Optional source linking</span>
        </div>
      </article>
      ${renderManualBucket("income", manual.income || [])}
      ${renderManualBucket("expenses", manual.expenses || [])}
      ${renderManualBucket("assets", manual.assets || [])}
      ${renderManualBucket("debts", manual.debts || [])}
      <article class="panel finance-save-panel">
        <button id="saveManualFinanceBtn" class="primary">Save Manual Finance</button>
      </article>
    </div>
  `;
  ensureManualFinanceVisibility(finance, manual);

  const updateManualField = (input) => {
    const item = findManualFinanceItem(input.dataset.bucket, input.dataset.sectionId, input.dataset.itemId);
    if (!item) return;
    const field = input.dataset.manualField;
    if (field === "amountMonthly" || field === "amount") item[field] = Number(input.value || 0);
    else item[field] = input.value;
  };
  bindElements(finance, "[data-manual-field]", "input", updateManualField);
  bindElements(finance, "[data-manual-field]", "change", (input) => {
    updateManualField(input);
    if (state.activeScreen === "finance") renderManualFinance();
  });
  bindElements(finance, "[data-manual-add-item]", "click", (button) => {
    addManualFinanceItem(button.dataset.bucket, button.dataset.sectionId);
    if (state.activeScreen === "finance") renderManualFinance();
  });
  bindElements(finance, "[data-manual-delete-item]", "click", (button) => {
    deleteManualFinanceItem(button.dataset.bucket, button.dataset.sectionId, button.dataset.itemId);
    if (state.activeScreen === "finance") renderManualFinance();
  });
  bindElements(finance, "[data-manual-source-ref]", "click", (button) => {
    openSourcesForReferencedValue(button.dataset.manualSourceRef);
  });
  finance.querySelector("#saveManualFinanceBtn").addEventListener("click", saveManualFinance);
  bindReferenceResizeObservers(finance);
}

function renderProjectionExplorer() {
  syncSelectionState();
  const explorer = document.getElementById("explorer");
  explorer.innerHTML = `
    <div class="explorer-grid">
      <article class="panel full-span explorer-shell">
        <div class="panel-header explorer-header">
          <div>
            <p class="panel-eyebrow">Projection Explorer</p>
            <h3>Detailed saved-path comparison</h3>
            <p class="support-copy">This page now uses saved path names, grouped breakdown sections, formula explainers, and direct source tracing so the projection math is easier to audit.</p>
          </div>
          <div class="explorer-top-actions">
            <button class="ghost explorer-fit-button ${state.explorerSettings.sizingMode === "fit-screen" ? "is-active" : ""}" data-explorer-fit="fit-screen" title="Fit visible columns to screen">Fit Screen</button>
            <button class="ghost explorer-fit-button ${state.explorerSettings.sizingMode === "fit-content" ? "is-active" : ""}" data-explorer-fit="fit-content" title="Size columns to content">Fit Contents</button>
          </div>
        </div>
        <div class="preview-controls explorer-controls">
          <div class="chip-row">
            ${getLoadedSlots().map((slot) => `
              <button class="tag ${slot.colorToken} ${state.explorerSettings.selectedSlotIds.includes(slot.slotId) ? "active" : ""}" data-explorer-slot="${slot.slotId}">
                ${escapeHtml(getPathDisplayName(slot))}
              </button>
            `).join("")}
          </div>
          <div class="control-panel explorer-control-panel">
            <div class="field compact-field">
              <label>Mode</label>
              <select id="explorerModeSelect">
                <option value="values" ${state.explorerSettings.mode === "values" ? "selected" : ""}>Pure Values</option>
                <option value="delta" ${state.explorerSettings.mode === "delta" ? "selected" : ""}>Gain / Loss vs Path</option>
              </select>
            </div>
            <div class="field compact-field">
              <label>Baseline</label>
              <select id="explorerBaselineSelect">${buildSlotOptions(state.explorerSettings.baselineSlotId)}</select>
            </div>
            <div class="muted-text explorer-sizing-note">Drag section chips to reorder groups. Use the mode pill beside each section title to pick a visibility preset, then open the section to edit custom selections. Drag column handles to resize.</div>
          </div>
          <div class="explorer-section-anchor">
            <div class="explorer-section-row">
              ${renderExplorerSectionChips()}
            </div>
            ${renderExplorerModePicker(state.explorerSettings.openModePickerKey)}
            ${renderExplorerSectionPopover(state.explorerSettings.openSectionKey)}
          </div>
        </div>
        ${renderProjectionExplorerTable()}
      </article>
    </div>
  `;

  bindProjectionExplorerEvents(explorer);
}

function renderExplorerSectionChips() {
  const globalMode = getExplorerGlobalSectionsMode();
  const globalChip = `
    <div
      class="explorer-section-chip explorer-section-chip-global ${state.explorerSettings.openModePickerKey === EXPLORER_ALL_SECTIONS_KEY ? "is-open" : ""}"
      draggable="false"
      data-explorer-section-chip="${EXPLORER_ALL_SECTIONS_KEY}"
    >
      <span class="explorer-chip-button explorer-chip-label" title="Change all financial sections at once">All Sections</span>
      <button class="ghost explorer-section-mode-button explorer-section-mode-button-global" data-explorer-section-mode-toggle="${EXPLORER_ALL_SECTIONS_KEY}" title="Choose a mode for all financial sections">${formatExplorerSectionModeLabel(globalMode, EXPLORER_ALL_SECTIONS_KEY)}</button>
    </div>
  `;
  const sectionChips = state.explorerSettings.sectionOrder.map((sectionKey) => {
    const section = EXPLORER_SECTION_DEFS[sectionKey];
    const mode = getExplorerSectionDisplayState(sectionKey);
    const hasPopup = sectionHasExplorerPopup(sectionKey);
    return `
      <div
        class="explorer-section-chip ${state.explorerSettings.openSectionKey === sectionKey || state.explorerSettings.openModePickerKey === sectionKey ? "is-open" : ""}"
        draggable="true"
        data-explorer-section-chip="${sectionKey}"
      >
        <button class="explorer-chip-button" data-explorer-section-open="${sectionKey}" data-explorer-popup-enabled="${hasPopup ? "true" : "false"}" title="${section.label}: ${formatExplorerSectionModeLabel(mode, sectionKey)}">${section.label}</button>
        <button class="ghost explorer-section-mode-button" data-explorer-section-mode-toggle="${sectionKey}" title="Choose section visibility mode">${formatExplorerSectionModeLabel(mode, sectionKey)}</button>
      </div>
    `;
  }).join("");
  return `${globalChip}${sectionChips}`;
}

function renderExplorerModePicker(sectionKey) {
  if (!sectionKey) return "";
  if (!isExplorerModeControlKey(sectionKey)) return "";
  const mode = getExplorerSectionDisplayState(sectionKey);
  const options = getExplorerSectionModeOptions(sectionKey);
  const anchor = getExplorerModePickerAnchorLayout();
  return `
    <div class="explorer-mode-picker" data-explorer-mode-picker="true" style="left:${anchor.left}px;width:${anchor.width}px;">
      ${options.map((option) => `
        <button
          class="ghost explorer-mode-option ${option === mode ? "is-active" : ""}"
          type="button"
          data-explorer-section-mode-select="${sectionKey}:${option}"
        >
          ${formatExplorerSectionModeLabel(option, sectionKey)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderExplorerSectionPopover(sectionKey) {
  if (!sectionKey) return "";
  const section = EXPLORER_SECTION_DEFS[sectionKey];
  if (!section || !sectionHasExplorerPopup(sectionKey)) return "";
  const mode = getExplorerSectionDisplayState(sectionKey);
  const customVisibility = state.explorerSettings.customVisibilityBySection[sectionKey] || {};
  const openGroupKeys = state.explorerSettings.openGroupKeysBySection[sectionKey] || [];
  const anchor = getExplorerPopoverAnchorLayout();
  const totalColumn = getExplorerSectionTotalColumn(sectionKey);
  const totalEnabled = totalColumn ? customVisibility[totalColumn.key] !== false : false;
  const popoverGroups = getExplorerSectionPopoverGroups(sectionKey);
  return `
    <div class="explorer-section-popover" data-explorer-popover="true" style="left:${anchor.left}px;width:${anchor.width}px;">
      <div class="explorer-section-popover-header">
        <strong>${section.label}</strong>
        <span class="explorer-section-mode explorer-section-mode-inline" aria-hidden="true">Mode: ${formatExplorerSectionModeLabel(mode, sectionKey)}</span>
      </div>
      <div class="explorer-section-popover-body">
        ${totalColumn ? `
          <div class="explorer-total-toggle-shell">
            <button class="ghost explorer-total-toggle ${totalEnabled ? "is-active" : ""}" type="button" data-explorer-total-toggle="${sectionKey}">
              Total
            </button>
          </div>
        ` : ""}
        <div class="explorer-custom-groups">
          ${popoverGroups.map((group) => {
            const groupEnabled = group.columns.every((column) => customVisibility[column.key] !== false);
            const expanded = openGroupKeys.includes(group.key);
            const isExpandable = group.columns.length > 1;
            const singleColumn = group.columns[0] || null;
            return `
              <div class="explorer-custom-group">
                <div class="explorer-custom-group-header">
                  ${isExpandable ? `
                    <button class="ghost explorer-group-expand explorer-compact-button ${expanded ? "is-active" : ""}" data-explorer-group-expand="${sectionKey}:${group.key}">
                      <span>${expanded ? "−" : "+"}</span>
                      <span>${group.label}</span>
                    </button>
                    <button class="ghost explorer-compact-button ${groupEnabled ? "is-active" : ""}" data-explorer-group-toggle="${sectionKey}:${group.key}">
                      ${groupEnabled ? "On" : "Off"}
                    </button>
                  ` : `
                    <button class="ghost explorer-direct-toggle explorer-compact-button ${groupEnabled ? "is-active" : ""}" type="button" data-explorer-column-toggle="${sectionKey}:${singleColumn.key}">
                      ${singleColumn.label}
                    </button>
                  `}
                </div>
                ${isExpandable && expanded ? `
                  <div class="explorer-custom-columns">
                    ${group.columns.map((column) => `
                      <button class="ghost explorer-column-toggle explorer-compact-button ${customVisibility[column.key] !== false ? "is-active" : ""}" data-explorer-column-toggle="${sectionKey}:${column.key}">
                        ${column.label}
                      </button>
                    `).join("")}
                  </div>
                ` : ""}
              </div>
            `;
          }).join("")}
        </div>
      </div>
    </div>
  `;
}

function getExplorerSectionTotalColumn(sectionKey) {
  const totalKey = EXPLORER_SECTION_DEFS[sectionKey]?.totalColumns?.[0];
  if (!totalKey) return null;
  return getExplorerAllColumns(sectionKey).find((column) => column.key === totalKey) || null;
}

function getExplorerSectionPopoverGroups(sectionKey) {
  const section = EXPLORER_SECTION_DEFS[sectionKey];
  if (!section) return [];
  return (section.groups || [])
    .filter((group) => group.key !== "sectionTotal")
    .map((group) => {
      if (sectionKey === "income" && group.key === "totals") {
        return {
          ...group,
          columns: group.columns.filter((column) => column.key !== "totalIncome"),
        };
      }
      return group;
    })
    .filter((group) => (group.columns || []).length > 0);
}

function getExplorerVisibleSections() {
  return state.explorerSettings.sectionOrder
    .map((sectionKey) => ({
      key: sectionKey,
      ...EXPLORER_SECTION_DEFS[sectionKey],
      columns: getExplorerSectionColumns(sectionKey),
    }))
    .filter((section) => section.columns.length);
}

function getExplorerSectionColumns(sectionKey) {
  const section = EXPLORER_SECTION_DEFS[sectionKey];
  if (!section) return [];
  const mode = state.explorerSettings.sectionModeByKey[sectionKey] || "std";
  const allColumns = getExplorerAllColumns(sectionKey);
  let selectedKeys = [];
  if (mode === "all") {
    selectedKeys = allColumns.map((column) => column.key);
  } else if (mode === "total") {
    selectedKeys = [...(section.totalColumns || section.standardColumns || [])];
  } else if (mode === "off") {
    selectedKeys = [];
  } else if (mode === "custom") {
    const customVisibility = state.explorerSettings.customVisibilityBySection[sectionKey] || {};
    selectedKeys = allColumns.filter((column) => customVisibility[column.key] !== false).map((column) => column.key);
  } else {
    selectedKeys = [...section.standardColumns];
  }
  const columnMap = Object.fromEntries(allColumns.map((column) => [column.key, column]));
  return selectedKeys.map((key) => ({ ...columnMap[key], sectionKey, tone: section.tone })).filter(Boolean);
}

function getExplorerAllColumns(sectionKey) {
  const section = EXPLORER_SECTION_DEFS[sectionKey];
  return section ? section.groups.flatMap((group) => group.columns) : [];
}

function getExplorerSectionDisplayState(sectionKey) {
  if (sectionKey === EXPLORER_ALL_SECTIONS_KEY) return getExplorerGlobalSectionsMode();
  return state.explorerSettings.sectionModeByKey[sectionKey] || "std";
}

function getExplorerSectionModeOptions(sectionKey) {
  if (sectionKey === EXPLORER_ALL_SECTIONS_KEY) return ["std", "total", "all", "off", "custom"];
  return EXPLORER_SECTION_DEFS[sectionKey]?.modeOptions || ["std", "all", "off", "custom"];
}

function formatExplorerSectionModeLabel(mode, sectionKey = null) {
  if (sectionKey === "phase") {
    return mode === "off" ? "OFF" : "ON";
  }
  if (sectionKey === EXPLORER_ALL_SECTIONS_KEY && mode === "mixed") {
    return "MIXED";
  }
  return EXPLORER_SECTION_MODE_OPTIONS[mode] || String(mode || "").toUpperCase();
}

function isExplorerModeControlKey(sectionKey) {
  return sectionKey === EXPLORER_ALL_SECTIONS_KEY || Boolean(EXPLORER_SECTION_DEFS[sectionKey]);
}

function getExplorerGlobalSectionsMode() {
  const modes = EXPLORER_FINANCIAL_SECTION_KEYS.map((sectionKey) => state.explorerSettings.sectionModeByKey[sectionKey] || "std");
  if (!modes.length) return "std";
  return modes.every((mode) => mode === modes[0]) ? modes[0] : "mixed";
}

function cloneExplorerSectionVisibility(sectionKey, visibility) {
  const allColumns = getExplorerAllColumns(sectionKey);
  const nextVisibility = {};
  allColumns.forEach((column) => {
    nextVisibility[column.key] = visibility?.[column.key] !== false;
  });
  return nextVisibility;
}

function buildExplorerStandardVisibility(sectionKey) {
  const section = EXPLORER_SECTION_DEFS[sectionKey];
  const standard = new Set(section?.standardColumns || []);
  return Object.fromEntries(getExplorerAllColumns(sectionKey).map((column) => [column.key, standard.has(column.key)]));
}

function persistExplorerCustomVisibility() {
  writeStoredExplorerCustomVisibility(state.explorerSettings.savedCustomVisibilityBySection);
}

function setExplorerCustomVisibility(sectionKey, nextVisibility) {
  const cloned = cloneExplorerSectionVisibility(sectionKey, nextVisibility);
  state.explorerSettings.customVisibilityBySection[sectionKey] = cloned;
  state.explorerSettings.savedCustomVisibilityBySection[sectionKey] = cloneExplorerSectionVisibility(sectionKey, cloned);
  persistExplorerCustomVisibility();
}

function setExplorerSectionMode(sectionKey, mode) {
  if (sectionKey === EXPLORER_ALL_SECTIONS_KEY) {
    EXPLORER_FINANCIAL_SECTION_KEYS.forEach((financialSectionKey) => {
      setExplorerSectionMode(financialSectionKey, mode);
    });
    return;
  }
  if (mode === "custom") {
    const saved = state.explorerSettings.savedCustomVisibilityBySection[sectionKey] || buildExplorerStandardVisibility(sectionKey);
    state.explorerSettings.customVisibilityBySection[sectionKey] = cloneExplorerSectionVisibility(sectionKey, saved);
  }
  state.explorerSettings.sectionModeByKey[sectionKey] = mode;
}

function sectionHasExplorerPopup(sectionKey) {
  const section = EXPLORER_SECTION_DEFS[sectionKey];
  if (!section) return false;
  const meaningfulGroups = (section.groups || []).filter((group) => (group.columns || []).length > 0);
  if (meaningfulGroups.length > 1) return true;
  return meaningfulGroups.some((group) => (group.columns || []).length > 1);
}

function getExplorerPopoverAnchorLayout() {
  const anchor = state.explorerSettings.openSectionAnchor;
  const fallbackWidth = 320;
  if (!anchor) return { left: 0, width: fallbackWidth };
  return {
    left: Math.max(0, anchor.left || 0),
    width: Math.max(220, anchor.width || fallbackWidth),
  };
}

function getExplorerModePickerAnchorLayout() {
  const anchor = state.explorerSettings.openModePickerAnchor;
  const fallbackWidth = 132;
  if (!anchor) return { left: 0, width: fallbackWidth };
  return {
    left: Math.max(0, anchor.left || 0),
    width: Math.max(116, anchor.width || fallbackWidth),
  };
}

function measureExplorerPopoverAnchor(button) {
  if (!(button instanceof Element)) return { left: 0, width: 320 };
  const chip = button.closest("[data-explorer-section-chip]");
  const anchorContainer = button.closest(".explorer-section-anchor");
  if (!chip || !anchorContainer) return { left: 0, width: 320 };
  const chipRect = chip.getBoundingClientRect();
  const anchorRect = anchorContainer.getBoundingClientRect();
  const maxWidth = Math.min(320, Math.max(window.innerWidth - 32, 220), Math.max(anchorRect.width - 8, 220));
  const idealLeft = (chipRect.left - anchorRect.left) + (chipRect.width / 2) - (maxWidth / 2);
  const clampedLeft = Math.max(0, Math.min(idealLeft, Math.max(anchorRect.width - maxWidth, 0)));
  return { left: clampedLeft, width: maxWidth };
}

function measureExplorerModePickerAnchor(button) {
  if (!(button instanceof Element)) return { left: 0, width: 132 };
  const chip = button.closest("[data-explorer-section-chip]");
  const anchorContainer = button.closest(".explorer-section-anchor");
  if (!chip || !anchorContainer) return { left: 0, width: 132 };
  const buttonRect = button.getBoundingClientRect();
  const anchorRect = anchorContainer.getBoundingClientRect();
  const width = Math.max(116, buttonRect.width);
  const left = Math.max(0, Math.min(buttonRect.left - anchorRect.left, Math.max(anchorRect.width - width, 0)));
  return { left, width };
}

function renderProjectionExplorerTable() {
  const selectedSlots = getLoadedSlots().filter((slot) => state.explorerSettings.selectedSlotIds.includes(slot.slotId) && state.previewResults[slot.slotId]);
  const visibleSections = getExplorerVisibleSections();
  const columns = visibleSections.flatMap((section) => section.columns);
  const rowLimit = Math.min(state.horizonYearIndex, Math.max(getHorizonRows().length - 1, 0));
  const rows = getHorizonRows().slice(0, rowLimit + 1);
  if (!selectedSlots.length) {
    return `<div class="notice">Select at least one loaded path to populate this comparison table.</div>`;
  }
  if (!columns.length) {
    return `<div class="notice">Turn on at least one explorer section to show the projection grid.</div>`;
  }
  const fitScreen = state.explorerSettings.sizingMode === "fit-screen";
  const fitContents = state.explorerSettings.sizingMode === "fit-content";
  return `
    <div class="table-wrap explorer-table-wrap ${fitScreen ? "is-fit-screen" : ""} ${fitContents ? "is-fit-content" : ""}">
      <table class="explorer-table">
        ${renderExplorerColgroup(columns, selectedSlots)}
        <thead>
          <tr>
            <th rowspan="3" class="sticky-shared explorer-shared-header explorer-shared-year">Year</th>
            <th rowspan="3" class="sticky-shared explorer-shared-header explorer-shared-age">Age</th>
            ${selectedSlots.map((slot) => `
              <th colspan="${columns.length}" class="path-group-start path-header-cell path-header-${slot.colorToken}">
                <div class="table-cell-stack">
                  ${renderTableCellClip(getPathDisplayName(slot))}
                  ${renderPathSummary(buildSlotSummaryLine(slot), { compact: true })}
                </div>
              </th>
            `).join("")}
          </tr>
          <tr>
            ${selectedSlots.map(() => visibleSections.map((section) => `
              <th colspan="${section.columns.length}" class="explorer-section-header tone-${section.tone}">
                ${section.label}
              </th>
            `).join("")).join("")}
          </tr>
          <tr>
            ${selectedSlots.map(() => columns.map((column) => `
              <th class="explorer-column-header" data-explorer-column-header="${column.key}">
                <span>${column.label}</span>
                <span class="explorer-resize-handle" data-explorer-resize="${column.key}" title="Resize column"></span>
              </th>
            `).join("")).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map((sharedRow, rowIndex) => `
            <tr>
              <td class="sticky-shared explorer-shared-cell explorer-shared-year">${renderTableCellClip(sharedRow.calendarYear)}</td>
              <td class="sticky-shared explorer-shared-cell explorer-shared-age">${renderTableCellClip(sharedRow.age)}</td>
              ${selectedSlots.map((slot) => renderProjectionExplorerRowCells(slot, columns, rowIndex)).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderExplorerColgroup(columns, selectedSlots) {
  const manualWidths = state.explorerSettings.columnWidths || {};
  const metricCols = selectedSlots.flatMap(() => columns.map((column) => {
    const width = manualWidths[column.key];
    return `<col data-explorer-col-key="${column.key}" ${width ? `style="width:${width}px"` : ""} />`;
  }));
  return `
    <colgroup>
      <col style="width:88px" />
      <col style="width:72px" />
      ${metricCols.join("")}
    </colgroup>
  `;
}

function renderProjectionExplorerRowCells(slot, columns, rowIndex) {
  const result = state.previewResults[slot.slotId];
  if (!result) return columns.map(() => `<td class="path-group-start">${renderTableCellClip("—")}</td>`).join("");
  const row = result.projection[rowIndex];
  const baselineResult = state.previewResults[state.explorerSettings.baselineSlotId];
  const baselineRow = baselineResult?.projection?.[rowIndex];
  return columns.map((column, index) => {
    const isFirst = index === 0 ? "path-group-start" : "";
    const value = getExplorerColumnValue(row, column);
    const baselineValue = baselineRow ? getExplorerColumnValue(baselineRow, column) : null;
    const toneClass = getExplorerCellToneClass(column, value);
    const canExplain = column.kind !== "text";
    const hoverable = canExplain && Boolean(column.formulaKey || column.cellRole === "aggregate");
    if (state.explorerSettings.mode === "delta" && typeof value === "number" && typeof baselineValue === "number") {
      const delta = value - baselineValue;
      const cls = delta > 0 ? "delta-pos" : delta < 0 ? "delta-neg" : "";
      return `
        <td
          class="${isFirst} ${cls} explorer-cell ${toneClass}"
          data-explorer-cell="true"
          data-slot-id="${slot.slotId}"
          data-row-index="${rowIndex}"
          data-column-key="${column.key}"
          data-hoverable="${hoverable ? "true" : "false"}"
        >
          ${renderTableCellClip(formatDelta(delta, column.kind))}
        </td>
      `;
    }
    return `
      <td
        class="${isFirst} explorer-cell ${toneClass}"
        data-explorer-cell="true"
        data-slot-id="${slot.slotId}"
        data-row-index="${rowIndex}"
        data-column-key="${column.key}"
        data-hoverable="${hoverable ? "true" : "false"}"
      >
        ${renderTableCellClip(formatExplorerValue(column, value))}
      </td>
    `;
  }).join("");
}

function getExplorerColumnValue(row, column) {
  if (column.components?.length) {
    return column.components.reduce((total, component) => total + Number(readPathValue(row, component.path) ?? 0), 0);
  }
  return readPathValue(row, column.path);
}

function readPathValue(object, path) {
  return String(path).split(".").reduce((current, key) => (current == null ? current : current[key]), object);
}

function formatExplorerValue(column, value) {
  if (column.kind === "text") return value ?? "—";
  if (column.kind === "percent") return `${((value ?? 0) * 100).toFixed(1)}%`;
  return currency.format(value ?? 0);
}

function getExplorerCellToneClass(column, value) {
  if (state.explorerSettings.mode !== "values" || column.kind === "text") return "";
  if (column.key === "grossIncome" || column.key === "netCashFlow") return "tone-neutral";
  if (column.key === "portfolio" || column.sectionKey === "portfolio" || column.sectionKey === "investments") return "tone-savings";
  if (column.sectionKey === "income") return "tone-income";
  if (column.sectionKey === "expenses" || column.sectionKey === "taxes") return "tone-expense";
  return "";
}

function bindProjectionExplorerEvents(root) {
  bindExplorerDismissHandlers();

  root.querySelectorAll("[data-explorer-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleArrayMember(state.explorerSettings.selectedSlotIds, button.dataset.explorerSlot);
      if (!state.explorerSettings.selectedSlotIds.length) {
        state.explorerSettings.selectedSlotIds = getLoadedSlots().map((slot) => slot.slotId);
      }
      renderProjectionExplorer();
    });
  });

  root.querySelector("#explorerModeSelect")?.addEventListener("change", () => {
    state.explorerSettings.mode = root.querySelector("#explorerModeSelect").value;
    renderProjectionExplorer();
  });
  root.querySelector("#explorerBaselineSelect")?.addEventListener("change", () => {
    state.explorerSettings.baselineSlotId = root.querySelector("#explorerBaselineSelect").value;
    renderProjectionExplorer();
  });

  root.querySelectorAll("[data-explorer-fit]").forEach((button) => {
    button.addEventListener("click", () => {
      state.explorerSettings.sizingMode = button.dataset.explorerFit;
      if (state.explorerSettings.sizingMode !== "manual") {
        state.explorerSettings.columnWidths = {};
      }
      renderProjectionExplorer();
    });
  });

  root.querySelectorAll("[data-explorer-section-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const sectionKey = button.dataset.explorerSectionOpen;
      state.explorerSettings.openModePickerKey = null;
      state.explorerSettings.openModePickerAnchor = null;
      if (!sectionHasExplorerPopup(sectionKey)) {
        state.explorerSettings.openSectionKey = null;
        state.explorerSettings.openSectionAnchor = null;
        renderProjectionExplorer();
        return;
      }
      if (state.explorerSettings.openSectionKey === sectionKey) {
        state.explorerSettings.openSectionKey = null;
        state.explorerSettings.openSectionAnchor = null;
      } else {
        state.explorerSettings.openSectionKey = sectionKey;
        state.explorerSettings.openSectionAnchor = measureExplorerPopoverAnchor(button);
        state.explorerSettings.openGroupKeysBySection[sectionKey] = [];
      }
      renderProjectionExplorer();
    });
  });

  root.querySelectorAll("[data-explorer-section-mode-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const sectionKey = button.dataset.explorerSectionModeToggle;
      if (state.explorerSettings.openModePickerKey === sectionKey) {
        state.explorerSettings.openModePickerKey = null;
        state.explorerSettings.openModePickerAnchor = null;
      } else {
        state.explorerSettings.openModePickerKey = sectionKey;
        state.explorerSettings.openModePickerAnchor = measureExplorerModePickerAnchor(button);
        state.explorerSettings.openSectionKey = null;
        state.explorerSettings.openSectionAnchor = null;
      }
      renderProjectionExplorer();
    });
  });
  root.querySelectorAll("[data-explorer-section-mode-select]").forEach((button) => {
    button.addEventListener("click", () => {
      const [sectionKey, mode] = button.dataset.explorerSectionModeSelect.split(":");
      setExplorerSectionMode(sectionKey, mode);
      state.explorerSettings.openModePickerKey = null;
      state.explorerSettings.openModePickerAnchor = null;
      if (mode === "custom" && sectionKey !== EXPLORER_ALL_SECTIONS_KEY) {
        state.explorerSettings.openSectionKey = sectionHasExplorerPopup(sectionKey) ? sectionKey : null;
        state.explorerSettings.openSectionAnchor = state.explorerSettings.openSectionKey
          ? measureExplorerPopoverAnchor(document.querySelector(`[data-explorer-section-open="${sectionKey}"]`))
          : null;
        state.explorerSettings.openGroupKeysBySection[sectionKey] = [];
      } else {
        state.explorerSettings.openSectionKey = null;
        state.explorerSettings.openSectionAnchor = null;
      }
      renderProjectionExplorer();
    });
  });
  root.querySelectorAll("[data-explorer-total-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const sectionKey = button.dataset.explorerTotalToggle;
      const totalColumn = getExplorerSectionTotalColumn(sectionKey);
      if (!totalColumn) return;
      const current = cloneExplorerSectionVisibility(sectionKey, state.explorerSettings.customVisibilityBySection[sectionKey]);
      current[totalColumn.key] = !(current[totalColumn.key] !== false);
      setExplorerCustomVisibility(sectionKey, current);
      setExplorerSectionMode(sectionKey, "custom");
      state.explorerSettings.openSectionKey = sectionHasExplorerPopup(sectionKey) ? sectionKey : null;
      renderProjectionExplorer();
    });
  });
  root.querySelectorAll("[data-explorer-group-expand]").forEach((button) => {
    button.addEventListener("click", () => {
      const [sectionKey, groupKey] = button.dataset.explorerGroupExpand.split(":");
      const openGroups = new Set(state.explorerSettings.openGroupKeysBySection[sectionKey] || []);
      if (openGroups.has(groupKey)) openGroups.delete(groupKey);
      else openGroups.add(groupKey);
      state.explorerSettings.openGroupKeysBySection[sectionKey] = [...openGroups];
      renderProjectionExplorer();
    });
  });
  root.querySelectorAll("[data-explorer-group-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const [sectionKey, groupKey] = button.dataset.explorerGroupToggle.split(":");
      const section = EXPLORER_SECTION_DEFS[sectionKey];
      const group = section.groups.find((item) => item.key === groupKey);
      const current = cloneExplorerSectionVisibility(sectionKey, state.explorerSettings.customVisibilityBySection[sectionKey]);
      const allSelected = group.columns.every((column) => current[column.key] !== false);
      group.columns.forEach((column) => {
        current[column.key] = !allSelected;
      });
      setExplorerCustomVisibility(sectionKey, current);
      setExplorerSectionMode(sectionKey, "custom");
      state.explorerSettings.openSectionKey = sectionHasExplorerPopup(sectionKey) ? sectionKey : null;
      renderProjectionExplorer();
    });
  });
  root.querySelectorAll("[data-explorer-column-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const [sectionKey, columnKey] = button.dataset.explorerColumnToggle.split(":");
      const current = cloneExplorerSectionVisibility(sectionKey, state.explorerSettings.customVisibilityBySection[sectionKey]);
      current[columnKey] = !(current[columnKey] !== false);
      setExplorerCustomVisibility(sectionKey, current);
      setExplorerSectionMode(sectionKey, "custom");
      state.explorerSettings.openSectionKey = sectionHasExplorerPopup(sectionKey) ? sectionKey : null;
      renderProjectionExplorer();
    });
  });
  root.querySelectorAll("[data-explorer-section-chip]").forEach((chip) => {
    chip.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/plain", chip.dataset.explorerSectionChip);
    });
    chip.addEventListener("dragover", (event) => event.preventDefault());
    chip.addEventListener("drop", (event) => {
      event.preventDefault();
      const sourceKey = event.dataTransfer?.getData("text/plain");
      const targetKey = chip.dataset.explorerSectionChip;
      const order = [...state.explorerSettings.sectionOrder];
      const sourceIndex = order.indexOf(sourceKey);
      const targetIndex = order.indexOf(targetKey);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
      const [moved] = order.splice(sourceIndex, 1);
      order.splice(targetIndex, 0, moved);
      state.explorerSettings.sectionOrder = order;
      renderProjectionExplorer();
    });
  });

  root.querySelectorAll("[data-explorer-resize]").forEach((handle) => {
    handle.addEventListener("mousedown", (event) => beginExplorerColumnResize(handle.dataset.explorerResize, event));
  });

  root.querySelectorAll("[data-explorer-cell]").forEach((cell) => {
    cell.addEventListener("click", () => {
      openExplorerCellExplainer(cell.dataset.slotId, Number(cell.dataset.rowIndex), cell.dataset.columnKey);
    });
    cell.addEventListener("mouseenter", (event) => {
      if (cell.dataset.hoverable !== "true") return;
      scheduleExplorerHover(cell, event);
    });
    cell.addEventListener("mousemove", (event) => {
      if (cell.dataset.hoverable !== "true") return;
      scheduleExplorerHover(cell, event);
    });
    cell.addEventListener("mouseleave", hideExplorerHover);
  });
}

function bindExplorerDismissHandlers() {
  if (explorerDismissHandlersBound) return;
  explorerDismissHandlersBound = true;
  document.addEventListener("mousedown", (event) => {
    if (state.activeScreen !== "explorer") return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".explorer-section-anchor")) return;
    const hadOpenUi = Boolean(state.explorerSettings.openSectionKey || state.explorerSettings.openModePickerKey);
    if (!hadOpenUi) return;
    state.explorerSettings.openSectionKey = null;
    state.explorerSettings.openSectionAnchor = null;
    state.explorerSettings.openModePickerKey = null;
    state.explorerSettings.openModePickerAnchor = null;
    renderProjectionExplorer();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || state.activeScreen !== "explorer") return;
    const hadOpenUi = Boolean(state.explorerSettings.openSectionKey || state.explorerSettings.openModePickerKey);
    if (!hadOpenUi) return;
    state.explorerSettings.openSectionKey = null;
    state.explorerSettings.openSectionAnchor = null;
    state.explorerSettings.openModePickerKey = null;
    state.explorerSettings.openModePickerAnchor = null;
    renderProjectionExplorer();
  });
}

function beginExplorerColumnResize(columnKey, event) {
  event.preventDefault();
  const currentWidth = state.explorerSettings.columnWidths[columnKey] || 124;
  state.explorerSettings.sizingMode = "manual";
  explorerResizeState = { columnKey, startX: event.clientX, startWidth: currentWidth };
  window.addEventListener("mousemove", handleExplorerResizeMove);
  window.addEventListener("mouseup", handleExplorerResizeEnd, { once: true });
}

function handleExplorerResizeMove(event) {
  if (!explorerResizeState) return;
  const nextWidth = Math.max(76, explorerResizeState.startWidth + (event.clientX - explorerResizeState.startX));
  state.explorerSettings.columnWidths[explorerResizeState.columnKey] = nextWidth;
  document.querySelectorAll(`[data-explorer-col-key="${explorerResizeState.columnKey}"]`).forEach((column) => {
    column.style.width = `${nextWidth}px`;
  });
}

function handleExplorerResizeEnd() {
  window.removeEventListener("mousemove", handleExplorerResizeMove);
  explorerResizeState = null;
  renderProjectionExplorer();
}

function scheduleExplorerHover(cell, event) {
  hideExplorerHover();
  const clientX = event.clientX;
  const clientY = event.clientY;
  explorerHoverTimer = window.setTimeout(() => {
    const slot = getSlot(cell.dataset.slotId);
    const rowIndex = Number(cell.dataset.rowIndex);
    const column = getExplorerVisibleSections().flatMap((section) => section.columns).find((item) => item.key === cell.dataset.columnKey);
    const row = slot ? state.previewResults[slot.slotId]?.projection?.[rowIndex] : null;
    if (!slot || !column || !row) return;
    showExplorerHover(slot, row, column, clientX, clientY);
  }, 1000);
}

function hideExplorerHover() {
  if (explorerHoverTimer) {
    window.clearTimeout(explorerHoverTimer);
    explorerHoverTimer = null;
  }
  document.getElementById("explorerHoverCard")?.remove();
}

function showExplorerHover(slot, row, column, clientX, clientY) {
  const modalRoot = document.getElementById("modalRoot");
  const existing = document.getElementById("explorerHoverCard");
  if (existing) existing.remove();
  const meta = row.formulaMeta?.[column.formulaKey]
    || (column.components?.length ? buildExplorerFallbackFormula(row, column) : null);
  if (!meta) return;
  const card = document.createElement("div");
  card.id = "explorerHoverCard";
  card.className = "explorer-hover-card";
  card.innerHTML = `
    <div class="explorer-hover-title">${escapeHtml(getPathDisplayName(slot))}</div>
    <div class="explorer-hover-subtitle">${row.calendarYear} · Age ${row.age} · ${column.label}</div>
    <div class="explorer-hover-expression">${escapeHtml(meta.expression || "")}</div>
    <div class="explorer-hover-lines">
      ${(meta.lines || []).map((line) => `
        <div class="explorer-hover-line">
          <span>${escapeHtml(line.label)}</span>
          <strong>${formatFormulaLineValue(line)}</strong>
        </div>
      `).join("")}
    </div>
  `;
  modalRoot.appendChild(card);
  card.style.left = `${Math.min(window.innerWidth - 280, clientX + 18)}px`;
  card.style.top = `${Math.min(window.innerHeight - 200, clientY + 18)}px`;
}

const EXPLAINER_DONUT_FORMULA_KEYS = new Set([
  "grossIncome",
  "taxFreeIncome",
  "totalIncome",
  "incomeMilitaryTotal",
  "incomeVaTotal",
  "incomeGiBillTotal",
  "incomeGradSchoolTotal",
  "taxes",
  "totalContributions",
  "investedPortfolio",
  "totalInvestableAssets",
]);

const EXPLAINER_BAR_FORMULA_KEYS = new Set([
  "livingExpenses",
  "incomeSalaryTotal",
  "expensesSectionTotal",
  "investmentsSectionTotal",
]);

const EXPLAINER_WATERFALL_FORMULA_KEYS = new Set([
  "netCashFlow",
  "portfolio",
]);

function openExplorerCellExplainer(slotId, rowIndex, columnKey) {
  const slot = getSlot(slotId);
  const row = state.previewResults[slotId]?.projection?.[rowIndex];
  const column = getExplorerVisibleSections().flatMap((section) => section.columns).find((item) => item.key === columnKey);
  if (!slot || !row || !column) return;
  const meta = row.formulaMeta?.[column.formulaKey] || buildExplorerFallbackFormula(row, column);
  const visualModel = buildExplorerVisualModel(column, meta);
  const sources = hydrateExplorerExplainerSources(buildExplorerExplainerSources(slot, row, column));
  const groupedSourceReferenceIds = [...new Set(sources.flatMap((source) => source.referenceIds || []))];
  const modalRoot = document.getElementById("modalRoot");
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal explorer-explainer-modal">
        <div>
          <p class="panel-eyebrow">Projection Explainer</p>
          <h3>${escapeHtml(getPathDisplayName(slot))} · ${row.calendarYear} · ${column.label}</h3>
          <p class="support-copy">${escapeHtml(meta.expression || "This value is derived from the current projection row.")}</p>
        </div>
        <div class="explainer-panel explainer-summary-panel">
          <div class="explainer-summary-head">
            <div>
              <p class="panel-eyebrow">Resolved Value</p>
              <div class="explainer-value">${formatExplorerValue(column, getExplorerColumnValue(row, column))}</div>
            </div>
            <span class="explainer-visual-pill">${escapeHtml(visualModel.familyLabel)}</span>
          </div>
          ${renderExplorerExplainerVisual(visualModel, column)}
          <div class="explainer-lines">
            ${renderExplorerExplainerLines(visualModel)}
          </div>
        </div>
        <div class="explainer-panel explainer-sources-panel">
          <div class="explainer-sources-head">
            <div class="explainer-sources-title">
              <p class="panel-eyebrow">Sources</p>
              <h4>Linked evidence and jump points</h4>
            </div>
            <button
              class="reference-source-button explainer-source-parent-button"
              type="button"
              data-explainer-all-sources
              ${groupedSourceReferenceIds.length ? "" : "disabled"}
              title="${groupedSourceReferenceIds.length ? "View all linked citations on the Sources page" : "No Sources-page citations are linked for this explainer"}"
            >ⓘ</button>
          </div>
          <p class="support-copy">The group icon opens the Sources page for all citations shown here. Each card keeps its own citation icon and any direct jump back to the originating editor or record.</p>
          <div class="explainer-sources">
            ${sources.length ? sources.map((source, index) => `
              <article class="explainer-source-card">
                <div class="explainer-source-card-head">
                  <strong>${escapeHtml(source.label)}</strong>
                  <button
                    class="reference-source-button"
                    type="button"
                    data-explainer-source-focus="${index}"
                    ${source.referenceIds.length ? "" : "disabled"}
                    title="${source.referenceIds.length ? "View linked citation details on the Sources page" : "No Sources-page citation is linked for this source"}"
                  >ⓘ</button>
                </div>
                ${source.description ? `<div class="muted-text">${escapeHtml(source.description)}</div>` : ""}
                <div class="explainer-source-card-actions">
                  ${source.navigable ? `<button class="ghost" type="button" data-explainer-source-nav="${index}">${escapeHtml(source.deepLinkLabel)}</button>` : `<span class="muted-text">Modeled constant</span>`}
                </div>
              </article>
            `).join("") : `<div class="muted-text">No linked source entries are available for this value.</div>`}
          </div>
        </div>
        <div class="modal-actions">
          <button class="ghost" id="closeExplorerExplainerBtn">Close</button>
        </div>
      </div>
    </div>
  `;
  modalRoot.querySelector(".modal-backdrop")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      modalRoot.innerHTML = "";
    }
  });
  modalRoot.querySelector("#closeExplorerExplainerBtn")?.addEventListener("click", () => {
    modalRoot.innerHTML = "";
  });
  modalRoot.querySelector("[data-explainer-all-sources]")?.addEventListener("click", () => {
    if (groupedSourceReferenceIds.length) openSourcesForReferencedValues(groupedSourceReferenceIds);
  });
  modalRoot.querySelectorAll("[data-explainer-source-focus]").forEach((button) => {
    button.addEventListener("click", () => {
      const source = sources[Number(button.dataset.explainerSourceFocus)];
      if (source?.referenceIds?.length) openSourcesForReferencedValues(source.referenceIds);
    });
  });
  modalRoot.querySelectorAll("[data-explainer-source-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const source = sources[Number(button.dataset.explainerSourceNav)];
      if (source) navigateToSource(source, slot);
    });
  });
}

function buildExplorerFallbackFormula(row, column) {
  if (column.components?.length) {
    return {
      title: column.label,
      value: getExplorerColumnValue(row, column),
      expression: column.expression || `${column.label} = sum of the displayed components.`,
      lines: column.components.map((component) => ({
        label: component.label,
        value: Number(readPathValue(row, component.path) ?? 0),
        kind: component.kind || "currency",
      })),
    };
  }
  return {
    title: column.label,
    value: getExplorerColumnValue(row, column),
    expression: "This value comes directly from the projected yearly breakdown.",
    lines: [{ label: column.label, value: getExplorerColumnValue(row, column) }],
  };
}

function formatFormulaLineValue(line) {
  if (line?.kind === "percent") {
    return `${((line.value ?? 0) * 100).toFixed(1)}%`;
  }
  return currency.format(line?.value ?? 0);
}

function buildExplorerVisualModel(column, meta) {
  const tone = getExplorerExplainerTone(column);
  const normalizedLines = (meta.lines || []).map((line, index) => normalizeExplorerVisualLine(line, index, tone, column)).filter(Boolean);
  const family = chooseExplorerVisualFamily(column, normalizedLines);
  const chartLines = getExplorerChartLinesForFamily(family, normalizedLines);
  const totalForShares = Math.abs(chartLines.reduce((sum, line) => sum + Math.max(line.value, 0), 0));
  const displayLines = family === "bar"
    ? [...chartLines].sort((left, right) => right.absValue - left.absValue)
    : chartLines;
  return {
    family,
    familyLabel: {
      donut: "Part-to-whole",
      bar: "Category compare",
      waterfall: "Bridge view",
      stat: "Resolved stat",
    }[family] || "Resolved stat",
    tone,
    totalValue: Number(meta.value ?? 0),
    displayLines: displayLines.map((line) => ({
      ...line,
      share: totalForShares > 0 && line.value > 0 ? line.value / totalForShares : null,
    })),
    steps: family === "waterfall" ? buildExplorerWaterfallSteps(displayLines, Number(meta.value ?? 0), column.label) : [],
  };
}

function normalizeExplorerVisualLine(line, index, tone, column) {
  const rawValue = Number(line?.value ?? 0);
  if (!Number.isFinite(rawValue)) return null;
  return {
    label: line?.label || `Line ${index + 1}`,
    value: rawValue,
    absValue: Math.abs(rawValue),
    kind: line?.kind || column.kind || "currency",
    color: getExplorerExplainerColor(index, tone),
  };
}

function chooseExplorerVisualFamily(column, lines) {
  const key = column.formulaKey;
  const hasNonCurrencyLines = lines.some((line) => line.kind === "percent");
  const currencyLines = lines.filter((line) => line.kind !== "percent");
  const positiveLines = currencyLines.filter((line) => line.value > 0);
  const mixedSigns = currencyLines.some((line) => line.value < 0) && currencyLines.some((line) => line.value > 0);
  if (EXPLAINER_WATERFALL_FORMULA_KEYS.has(key)) return "waterfall";
  if (EXPLAINER_DONUT_FORMULA_KEYS.has(key) && positiveLines.length >= 2 && positiveLines.length <= 5) return "donut";
  if (EXPLAINER_BAR_FORMULA_KEYS.has(key) && currencyLines.length >= 2) return "bar";
  if (hasNonCurrencyLines) return "stat";
  if (currencyLines.length <= 1) return "stat";
  if (mixedSigns) return "waterfall";
  if (positiveLines.length >= 2 && positiveLines.length <= 5) return "donut";
  if (positiveLines.length > 1) return "bar";
  return "stat";
}

function getExplorerChartLinesForFamily(family, lines) {
  if (family === "waterfall") return lines.filter((line) => line.kind !== "percent");
  if (family === "donut") return lines.filter((line) => line.kind !== "percent" && line.value > 0);
  if (family === "bar") return lines.filter((line) => line.kind !== "percent" && line.absValue > 0);
  return lines;
}

function buildExplorerWaterfallSteps(lines, totalValue, totalLabel) {
  if (!lines.length) return [];
  const [firstLine, ...deltaLines] = lines;
  const steps = [{
    label: firstLine.label,
    start: 0,
    end: firstLine.value,
    value: firstLine.value,
    role: "start",
    color: firstLine.color,
  }];
  let runningTotal = firstLine.value;
  deltaLines.forEach((line) => {
    const nextTotal = runningTotal + line.value;
    steps.push({
      label: line.label,
      start: runningTotal,
      end: nextTotal,
      value: line.value,
      role: line.value >= 0 ? "increase" : "decrease",
      color: line.value >= 0 ? line.color : "#b54d4d",
    });
    runningTotal = nextTotal;
  });
  steps.push({
    label: totalLabel,
    start: 0,
    end: totalValue,
    value: totalValue,
    role: "total",
    color: getExplorerExplainerColor(0, "neutral"),
  });
  return steps;
}

function renderExplorerExplainerVisual(model, column) {
  if (model.family === "donut") return renderExplorerDonutVisual(model, column);
  if (model.family === "bar") return renderExplorerBarVisual(model);
  if (model.family === "waterfall") return renderExplorerWaterfallVisual(model);
  return renderExplorerStatVisual(model, column);
}

function renderExplorerDonutVisual(model, column) {
  const size = 184;
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return `
    <div class="explainer-visual-shell donut">
      <div class="explainer-donut-wrap">
        <svg class="explainer-donut-chart" viewBox="0 0 ${size} ${size}" aria-hidden="true">
          <circle class="explainer-donut-track" cx="${size / 2}" cy="${size / 2}" r="${radius}"></circle>
          ${model.displayLines.map((line) => {
    const dash = circumference * Math.max(line.share || 0, 0);
    const segment = `
              <circle
                class="explainer-donut-segment"
                cx="${size / 2}"
                cy="${size / 2}"
                r="${radius}"
                stroke="${line.color}"
                stroke-dasharray="${dash} ${Math.max(circumference - dash, 0)}"
                stroke-dashoffset="${-offset}"
              ></circle>
            `;
    offset += dash;
    return segment;
  }).join("")}
        </svg>
        <div class="explainer-donut-center">
          <span>${formatExplorerValue(column, model.totalValue)}</span>
          <small>Total</small>
        </div>
      </div>
    </div>
  `;
}

function renderExplorerBarVisual(model) {
  const maxValue = Math.max(...model.displayLines.map((line) => line.absValue), 1);
  return `
    <div class="explainer-visual-shell">
      <div class="explainer-bar-list">
        ${model.displayLines.map((line) => `
          <div class="explainer-bar-row">
            <div class="explainer-bar-copy">
              <span>${escapeHtml(line.label)}</span>
              <strong>${formatFormulaLineValue(line)}</strong>
            </div>
            <div class="explainer-bar-track">
              <div class="explainer-bar-fill" style="width:${Math.max((line.absValue / maxValue) * 100, 4)}%; background:${line.color}"></div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderExplorerWaterfallVisual(model) {
  const extents = model.steps.reduce((range, step) => ({
    min: Math.min(range.min, step.start, step.end, 0),
    max: Math.max(range.max, step.start, step.end, 0),
  }), { min: 0, max: 0 });
  const span = Math.max(extents.max - extents.min, 1);
  const zeroPct = ((0 - extents.min) / span) * 100;
  return `
    <div class="explainer-visual-shell">
      <div class="explainer-waterfall-list">
        ${model.steps.map((step) => {
    const left = ((Math.min(step.start, step.end) - extents.min) / span) * 100;
    const width = Math.max((Math.abs(step.end - step.start) / span) * 100, 3);
    return `
            <div class="explainer-waterfall-row">
              <div class="explainer-waterfall-copy">
                <span>${escapeHtml(step.label)}</span>
                <strong>${formatFormulaLineValue(step)}</strong>
              </div>
              <div class="explainer-waterfall-track">
                <span class="explainer-waterfall-zero" style="left:${zeroPct}%"></span>
                <div class="explainer-waterfall-bar is-${step.role}" style="left:${left}%; width:${width}%; background:${step.color}"></div>
              </div>
            </div>
          `;
  }).join("")}
      </div>
    </div>
  `;
}

function renderExplorerStatVisual(model, column) {
  const leadLine = model.displayLines[0];
  return `
    <div class="explainer-visual-shell stat">
      <div class="explainer-stat-band" style="--explainer-stat-accent:${leadLine?.color || getExplorerExplainerColor(0, model.tone)}">
        <span>${formatExplorerValue(column, model.totalValue)}</span>
        <small>${escapeHtml(leadLine?.label || column.label)}</small>
      </div>
    </div>
  `;
}

function renderExplorerExplainerLines(model) {
  if (!model.displayLines.length) return `<div class="muted-text">No additional formula lines for this value.</div>`;
  return model.displayLines.map((line) => `
    <div class="explainer-line">
      <div class="explainer-line-copy">
        <span class="explainer-line-swatch" style="background:${line.color}"></span>
        <span>${escapeHtml(line.label)}</span>
      </div>
      <div class="explainer-line-metrics">
        ${line.share != null ? `<span class="muted-text">${Math.round(line.share * 100)}%</span>` : ""}
        <strong>${formatFormulaLineValue(line)}</strong>
      </div>
    </div>
  `).join("");
}

function getExplorerExplainerTone(column) {
  if (column.key === "portfolio" || column.sectionKey === "portfolio" || column.sectionKey === "investments") return "savings";
  if (column.sectionKey === "income") return "income";
  if (column.sectionKey === "expenses" || column.sectionKey === "taxes") return "expense";
  return "neutral";
}

function getExplorerExplainerColor(index, tone) {
  const palettes = {
    income: ["#2d6a4f", "#40916c", "#52b788", "#74c69d", "#95d5b2"],
    savings: ["#245c9c", "#3b82c4", "#5aa6e5", "#86bff0", "#b5d5f7"],
    expense: ["#b86423", "#d17a2c", "#e69a41", "#c44c4c", "#8f4814"],
    neutral: ["#55667d", "#6b7d94", "#8196af", "#9fb0c4", "#bcc9d7"],
  };
  const palette = palettes[tone] || palettes.neutral;
  return palette[index % palette.length];
}

function buildExplorerExplainerSources(slot, row, column) {
  const sourceRefs = row.sourceRefs || {};
  const gather = (...keys) => dedupeSourceRefs(keys.flatMap((key) => sourceRefs[key] || []));
  const livingExpenseOverrideSource = slot.draft?.overrides?.monthlyLivingExpenses
    ? [_buildSourceRef("path-selector", "Living expense override", "path-editor", "path-editor-field-monthlyLivingExpenses", "This path override replaces the Manual Finance living-expense base before category scaling.")]
    : [];
  const startingPortfolioOverrideSource = slot.draft?.overrides?.startingPortfolio
    ? [{ type: "modeled-override", label: "Starting portfolio override", screen: null, targetId: null, description: "This path uses an explicit starting portfolio override, but there is not yet a dedicated editor field for it.", navigable: false }]
    : [];
  const compensationTargetId = row.activityType === "tech_career" ? "path-editor-field-selectedCompanyId" : "path-editor-field-selectedEmployerId";
  const compensationLabel = row.activityType === "tech_career" ? "Selected tech company" : "Selected research employer";
  const pathSourceMap = {
    salaryBase: _buildSourceRef(
      "path-selector",
      compensationLabel,
      "path-editor",
      compensationTargetId,
      "This path setting selects which compensation reference row is used.",
    ),
    phdStipend: _buildSourceRef("path-selector", "Selected grad school", "path-editor", "path-editor-field-selectedPhdProgramId", "The selected PhD program determines stipend and GI Bill housing values."),
    giBillHousing: _buildSourceRef("path-selector", "Selected grad school", "path-editor", "path-editor-field-selectedPhdProgramId", "The selected PhD program determines GI Bill housing values."),
    giBillBooks: _buildSourceRef("path-selector", "Selected grad school", "path-editor", "path-editor-field-selectedPhdProgramId", "GI Bill support depends on the current path and selected program."),
    vaCompensation: _buildSourceRef("path-selector", "Selected VA rating", "path-editor", "path-editor-field-selectedVaRatingId", "The selected VA disability rating determines annual compensation."),
    salaryOther: _buildSourceRef("path-selector", compensationLabel, "path-editor", compensationTargetId, "Bonus and RSU placeholders depend on the selected employer or company."),
  };
  const expenseFallbackMap = {
    housing: _buildSourceRef("manual-input", "Housing", "finance", "manual-expenses-expense_housing", "Manual Finance expense entry."),
    utilities: _buildSourceRef("manual-input", "Utilities", "finance", "manual-expenses-expense_utilities", "Manual Finance expense entry."),
    transportation: _buildSourceRef("manual-input", "Transportation", "finance", "manual-expenses-expense_transport", "Manual Finance expense entry."),
    food: _buildSourceRef("manual-input", "Food", "finance", "manual-expenses-expense_food", "Manual Finance expense entry."),
    insurance: _buildSourceRef("manual-input", "Insurance", "finance", "manual-expenses-expense_insurance", "Manual Finance expense entry."),
    healthcareOutOfPocket: _buildSourceRef("manual-input", "Healthcare OOP", "finance", "manual-expenses-expense_healthcare", "Manual Finance expense entry."),
    personal: _buildSourceRef("manual-input", "Personal", "finance", "manual-expenses-expense_personal", "Manual Finance expense entry."),
    entertainment: _buildSourceRef("manual-input", "Entertainment", "finance", "manual-expenses-expense_entertainment", "Manual Finance expense entry."),
    gifts: _buildSourceRef("manual-input", "Gifts", "finance", "manual-expenses-expense_gifts", "Manual Finance expense entry."),
    miscellaneous: _buildSourceRef("manual-input", "Miscellaneous", "finance", "manual-expenses-expense_misc", "Manual Finance expense entry."),
  };
  if (column.formulaKey === "incomeMilitaryTotal") return gather("militaryBasePay", "militaryBah", "militaryBas", "militaryProjectedGrade", "militaryYearsOfService", "militaryRaiseSchedule");
  if (column.formulaKey === "grossIncome") return gather("militaryBasePay", "pension", "salaryBase", "phdStipend");
  if (column.formulaKey === "taxFreeIncome") return gather("militaryBah", "militaryBas", "vaCompensation", "giBillHousing", "giBillBooks");
  if (column.formulaKey === "totalIncome") return gather("militaryBasePay", "pension", "salaryBase", "phdStipend", "militaryBah", "militaryBas", "vaCompensation", "giBillHousing", "giBillBooks");
  if (column.formulaKey === "livingExpenses") return dedupeSourceRefs([...livingExpenseOverrideSource, ...gather("livingExpenses")]);
  if (column.formulaKey === "taxes") return gather("taxes");
  if (column.formulaKey === "retirementSavings") return gather("retirementSavings");
  if (column.formulaKey === "positiveSurplusInvested") return gather("taxableContributions");
  if (column.formulaKey === "totalContributions") return gather("retirementContributions", "taxableContributions");
  if (column.formulaKey === "portfolioGrowth") return gather("portfolioGrowth", "assumedReturnRate");
  if (column.formulaKey === "netCashFlow") return dedupeSourceRefs([...livingExpenseOverrideSource, ...gather("livingExpenses", "healthcareCost", "taxes", "retirementSavings", "militaryBasePay", "pension", "salaryBase", "phdStipend", "militaryBah", "militaryBas", "vaCompensation", "giBillHousing", "giBillBooks")]);
  if (column.formulaKey === "portfolio") return dedupeSourceRefs([...startingPortfolioOverrideSource, ...gather("portfolio")]);
  if (column.formulaKey === "investedPortfolio") return gather("investedPortfolio");
  if (column.formulaKey === "totalInvestableAssets") return gather("totalInvestableAssets");
  if (column.sourceKeys?.length) {
    const extras = column.sourceKeys.flatMap((key) => [
      ...(pathSourceMap[key] ? [pathSourceMap[key]] : []),
      ...(expenseFallbackMap[key] ? [expenseFallbackMap[key]] : []),
    ]);
    return dedupeSourceRefs([...extras, ...gather(...column.sourceKeys)]);
  }
  if (column.sourceKey && sourceRefs[column.sourceKey]?.length) {
    const extras = pathSourceMap[column.sourceKey] ? [pathSourceMap[column.sourceKey]] : [];
    return dedupeSourceRefs([...extras, ...(sourceRefs[column.sourceKey] || [])]);
  }
  if (column.sourceKey && expenseFallbackMap[column.sourceKey]) return [expenseFallbackMap[column.sourceKey]];
  return [];
}

function _buildSourceRef(type, label, screen, targetId, description) {
  return { type, label, screen, targetId, description, navigable: Boolean(screen && targetId) };
}

function dedupeSourceRefs(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.screen || ""}|${item.targetId || ""}|${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hydrateExplorerExplainerSources(sources) {
  return (sources || []).map((source) => {
    const referenceIds = getReferencedValueIdsForSource(source);
    return {
      ...source,
      referenceIds,
      deepLinkLabel: getExplorerSourceDeepLinkLabel(source),
    };
  });
}

function getExplorerSourceDeepLinkLabel(source) {
  if (!source?.navigable) return "";
  if (source.screen === "path-editor") return "Open setting";
  if (source.screen === "reference") return "Open record";
  if (source.screen === "finance") return "Open finance";
  return "Open source";
}

function getReferencedValueIdsForSource(source) {
  if (!source || source.screen !== "reference" || !source.targetId) return [];
  const parsedTarget = parseReferenceTargetId(source.targetId);
  if (!parsedTarget) return [];
  return (state.bootstrap.referencedValues || [])
    .filter((item) => item.targetDomain === parsedTarget.domain && item.targetRecordId === parsedTarget.recordId)
    .map((item) => item.id);
}

function parseReferenceTargetId(targetId) {
  const match = String(targetId || "").match(/^reference-([a-z_]+)-(.+)$/);
  if (!match) return null;
  return { domain: match[1], recordId: match[2] };
}

function navigateToSource(source, slot) {
  if (!source?.screen || !source?.targetId) return;
  if (source.screen === "path-editor") {
    state.editorSlotId = slot.slotId;
  }
  state.pendingHighlightTarget = { screenId: source.screen, targetId: source.targetId };
  switchScreen(source.screen);
  document.getElementById("modalRoot").innerHTML = "";
}

function maybeApplyPendingHighlight(screenId) {
  if (!state.pendingHighlightTarget || state.pendingHighlightTarget.screenId !== screenId) return;
  const { targetId } = state.pendingHighlightTarget;
  requestAnimationFrame(() => {
    flashSourceTarget(targetId);
  });
}

function flashSourceTarget(targetId) {
  const target = document.getElementById(targetId) || document.querySelector(`[data-source-target="${targetId}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("source-flash");
  window.setTimeout(() => target.classList.remove("source-flash"), 1800);
  state.pendingHighlightTarget = null;
}

function renderInsights() {
  const insights = document.getElementById("insights");
  const loadedSlots = getWidgetEligibleSlots();
  insights.innerHTML = `
    <div class="insights-grid">
      <article class="panel">
        <div class="panel-header">
          <div>
            <p class="panel-eyebrow">Insight</p>
            <h3>Portfolio overview</h3>
          </div>
        </div>
        <div class="widget-chart"><canvas id="insightPortfolioCanvas" width="900" height="320"></canvas></div>
      </article>
      <article class="panel">
        <div class="panel-header">
          <div>
            <p class="panel-eyebrow">Insight</p>
            <h3>Cost comparison</h3>
          </div>
        </div>
        <div class="widget-chart"><canvas id="insightCostCanvas" width="900" height="320"></canvas></div>
      </article>
      <article class="panel full-span">
        <div class="panel-header">
          <div>
            <p class="panel-eyebrow">Loaded Paths</p>
            <h3>Totals at the selected horizon</h3>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Path</th><th>Route</th><th>Total</th><th>Taxes</th><th>Healthcare</th></tr>
            </thead>
            <tbody>
              ${loadedSlots.map((slot) => {
                const result = state.previewResults[slot.slotId];
                return `
                  <tr>
                    <td>${renderTableCellClip(getPathDisplayName(slot))}</td>
                    <td><div class="table-cell-shell">${renderPathSummary(buildSlotSummaryLine(slot), { compact: true })}</div></td>
                    <td>${renderTableCellClip(result ? currency.format(result.metrics.finalPortfolio) : "—")}</td>
                    <td>${renderTableCellClip(result ? currency.format(result.metrics.totalTaxes) : "—")}</td>
                    <td>${renderTableCellClip(result ? currency.format(result.metrics.totalHealthcareCost) : "—")}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  `;

  drawLineChart(document.getElementById("insightPortfolioCanvas"), buildInsightSeries("portfolio"));
  drawLineChart(document.getElementById("insightCostCanvas"), buildInsightSeries("healthcareCost"));
}

function renderReferenceData() {
  const reference = document.getElementById("reference");
  const domains = state.bootstrap.referenceDomains || {};
  const sections = state.bootstrap.referenceSections || [];
  const totalOverrides = (state.bootstrap.referenceOverrides || []).length;
  const totalRecords = Object.values(domains).reduce((sum, items) => sum + items.length, 0);
  reference.innerHTML = `
    <div class="reference-shell">
      <article class="panel reference-hero">
        <div class="panel-header">
          <div>
            <p class="panel-eyebrow">Protected Backend</p>
            <h3>Reference data sheets</h3>
            <p class="support-copy">These tables hold the static planner assumptions: military pay, VA disability, GI Bill, taxes, healthcare, programs, locations, and investment rules. Relationships stay locked here, while editable numeric overrides remain clearly marked inline.</p>
          </div>
          <label class="reference-toggle">
            <input type="checkbox" data-reference-advanced-toggle ${state.referenceSettings.showAdvanced ? "checked" : ""} />
            <span>Show advanced fields</span>
          </label>
        </div>
        <div class="reference-summary-strip">
          <span class="reference-chip">${sections.length} sections</span>
          <span class="reference-chip">${totalRecords} records</span>
          <span class="reference-chip">${totalOverrides} active overrides</span>
          <span class="reference-chip">Workbook-backed programs</span>
          <span class="reference-chip">Effective-date aware defaults</span>
        </div>
      </article>
      ${sections.map((section) => renderReferenceSection(section)).join("")}
    </div>
  `;
  ensureReferenceVisibility(reference);

  bindReferenceInteractions(reference);
}

function renderSources() {
  const root = document.getElementById("sources");
  const values = filterReferencedValues();
  ensureReferencedValueSelection(values);
  const totalValues = (state.bootstrap.referencedValues || []).length;
  const totalDocuments = (state.bootstrap.sourceDocuments || []).length;
  const focusState = getSourcesFocusState();
  const hasFocus = focusState !== "all";
  root.innerHTML = `
    <div class="reference-shell">
      <article class="panel reference-hero">
        <div class="panel-header">
          <div>
            <p class="panel-eyebrow">Sources</p>
            <h3>Referenced values and their supporting links</h3>
            <p class="support-copy">Each row represents one planner value and the links used to verify it. The structure is ready now even where field-level citations are still placeholders awaiting research.</p>
          </div>
        </div>
        <div class="reference-summary-strip">
          <span class="reference-chip">${totalValues} referenced values</span>
          <span class="reference-chip">${totalDocuments} documents</span>
          <span class="reference-chip">${getSourcesFocusSummaryLabel(values.length)}</span>
        </div>
      </article>

      <article class="panel full-span reference-section-panel">
        <div class="panel-header">
          <div>
            <p class="panel-eyebrow">Referenced Values</p>
            <h3>Data sources</h3>
          </div>
          <div class="reference-domain-badges">
            ${focusState === "single" ? `<span class="reference-badge">Focused on one data point</span>` : ""}
            ${focusState === "set" ? `<span class="reference-badge">Focused on ${values.length} data points</span>` : ""}
          </div>
        </div>
        <div class="reference-domain-toolbar">
          <input
            class="reference-filter-input"
            data-sources-filter
            type="search"
            placeholder="Filter referenced values"
            value="${escapeHtml(state.sourcesSettings.filter || "")}"
          />
          <div class="reference-usage-strip">
            ${hasFocus ? `<button class="ghost" data-sources-clear-focus>Clear focus</button>` : ""}
          </div>
        </div>
        ${renderReferencedValuesTable(values)}
      </article>
    </div>
  `;

  bindSourcesInteractions(root);
}

function renderGapTracker() {
  const gaps = document.getElementById("gaps");
  gaps.innerHTML = `
    <div class="gap-grid">
      ${state.bootstrap.gapFlags.map((gap) => `
        <article class="panel gap-card">
          <p class="panel-eyebrow">Open Model Gap</p>
          <h3>${gap.title}</h3>
          <p class="support-copy">${gap.impact}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function buildInsightSeries(metric) {
  return getWidgetEligibleSlots().map((slot) => {
    const result = state.previewResults[slot.slotId];
    return {
      label: getPathDisplayName(slot),
      color: COLOR_STYLES[slot.colorToken] || COLOR_STYLES.slate,
      pattern: [],
      values: result ? result.projection.slice(0, state.horizonYearIndex + 1).map((row) => row[metric]) : [],
    };
  });
}

function renderReferenceSection(section) {
  return `
    <article class="panel full-span reference-section-panel">
      <div class="panel-header">
        <div>
          <p class="panel-eyebrow">Reference Section</p>
          <h3>${escapeHtml(section.title)}</h3>
          <p class="support-copy">${escapeHtml(section.description || "")}</p>
        </div>
      </div>
      <div class="reference-section-stack">
        ${(section.domains || []).map((domain) => renderReferenceDomainPanel(domain)).join("")}
      </div>
    </article>
  `;
}

function renderReferenceDomainPanel(domain) {
  const metadata = state.bootstrap.referenceFieldMetadata?.[domain] || {};
  const allRecords = state.bootstrap.referenceDomains?.[domain] || [];
  const records = filterReferenceRecords(domain);
  const overrides = (state.bootstrap.referenceOverrides || []).filter((item) => item.domain === domain);
  const filterActive = Boolean((state.referenceSettings.filtersByDomain[domain] || "").trim());
  return `
    <article class="panel reference-domain-panel" data-reference-domain-panel="${domain}">
      <div class="panel-header">
        <div>
          <p class="panel-eyebrow">${escapeHtml(domain.replaceAll("_", " "))}</p>
          <h3>${escapeHtml(metadata.label || domain.replaceAll("_", " "))}</h3>
        </div>
        <div class="reference-domain-badges">
          <span class="reference-badge">${records.length} shown</span>
          <span class="reference-badge">${allRecords.length} total</span>
          <span class="reference-badge">${overrides.length} overrides</span>
        </div>
      </div>
      <div class="reference-domain-toolbar">
        <div class="reference-domain-toolbar-top">
          <input
            class="reference-filter-input"
            data-reference-filter="${domain}"
            type="search"
            placeholder="Filter ${escapeHtml((metadata.label || domain).toLowerCase())}"
            value="${escapeHtml(state.referenceSettings.filtersByDomain[domain] || "")}"
          />
          ${renderReferenceLayoutControls(domain)}
        </div>
        <div class="reference-usage-strip">
          ${(metadata.usedBy || []).map((label) => `<span class="reference-usage-badge">Used by ${escapeHtml(label)}</span>`).join("")}
        </div>
      </div>
      <div data-reference-domain-content="${domain}">
        ${renderReferenceDomainContent(domain, records, filterActive)}
      </div>
    </article>
  `;
}

function renderReferenceDomainContent(domain, items, filterActive) {
  if (!items.length) {
    return filterActive
      ? `<div class="notice">No records match this filter.</div>`
      : renderReferenceFailurePanel(domain, "This domain is populated in the backend, but no rows were available to render.");
  }
  try {
    return renderReferenceTable(domain, items);
  } catch (error) {
    console.error(`Reference renderer failed for domain "${domain}". Falling back to plain table.`, error);
    return renderPlainReferenceTable(domain, items, "Rich renderer failed. Showing plain values instead.");
  }
}

function renderReferenceTable(domain, items) {
  const columns = getReferenceColumns(domain);
  const showRowReset = getVisibleEditableFields(domain).length > 0;
  const fitMode = getReferenceFitMode(domain);
  return `
    <div
      class="table-wrap reference-table-wrap reference-table-shell ${fitMode === "fit-screen" ? "is-fit-screen" : "is-fit-content"}"
      data-reference-resizable="${domain}"
      data-reference-table-kind="rich"
      style="height: ${getReferenceTableHeight(domain)}px"
    >
      <table>
        ${renderReferenceColgroup(domain, columns, showRowReset)}
        <thead>
          <tr>
            ${columns.map((column) => `
              <th class="reference-column-header" data-reference-column-header="${domain}:${column.field}">
                <span>${escapeHtml(column.label)}</span>
                <span class="reference-resize-handle" data-reference-resize-domain="${domain}" data-reference-resize-field="${column.field}" title="Resize column"></span>
              </th>
            `).join("")}
            ${showRowReset ? "<th>Row Override</th>" : ""}
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr
              id="reference-${domain}-${item.id}"
              data-source-target="reference-${domain}-${item.id}"
            >
              ${columns.map((column) => `<td>${renderReferenceCell(domain, item, column)}</td>`).join("")}
              ${showRowReset ? `<td>${renderReferenceRowResetCell(domain, item)}</td>` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPlainReferenceTable(domain, items, message = "") {
  const columns = getReferenceColumns(domain);
  const fitMode = getReferenceFitMode(domain);
  return `
    <div class="render-failure-panel render-failure-panel-inline ${message ? "has-message" : ""}">
      ${message ? `<p class="support-copy">${escapeHtml(message)}</p>` : ""}
    </div>
    <div
      class="table-wrap reference-table-wrap reference-table-shell ${fitMode === "fit-screen" ? "is-fit-screen" : "is-fit-content"}"
      data-reference-resizable="${domain}"
      data-reference-table-kind="fallback"
      style="height: ${getReferenceTableHeight(domain)}px"
    >
      <table>
        ${renderReferenceColgroup(domain, columns)}
        <thead>
          <tr>
            ${columns.map((column) => `
              <th class="reference-column-header" data-reference-column-header="${domain}:${column.field}">
                <span>${escapeHtml(column.label)}</span>
                <span class="reference-resize-handle" data-reference-resize-domain="${domain}" data-reference-resize-field="${column.field}" title="Resize column"></span>
              </th>
            `).join("")}
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr id="reference-${domain}-${item.id}" data-source-target="reference-${domain}-${item.id}">
              ${columns.map((column) => `<td>${renderPlainReferenceCell(domain, item, column)}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPlainReferenceCell(domain, record, column) {
  return renderStaticReferenceCell(domain, record, column);
}

function renderReferenceFailurePanel(domain, message) {
  const metadata = state.bootstrap.referenceFieldMetadata?.[domain] || {};
  return `
    <div class="render-failure-panel">
      <p class="panel-eyebrow">Reference Render Guard</p>
      <h4>${escapeHtml(metadata.label || humanizeToken(domain))}</h4>
      <p class="support-copy">${escapeHtml(message)}</p>
    </div>
  `;
}

function ensureReferenceVisibility(root) {
  const sections = state.bootstrap.referenceSections || [];
  sections.forEach((section) => {
    (section.domains || []).forEach((domain) => {
      const allRecords = state.bootstrap.referenceDomains?.[domain] || [];
      const filteredRecords = filterReferenceRecords(domain);
      const filterActive = Boolean((state.referenceSettings.filtersByDomain[domain] || "").trim());
      const content = root.querySelector(`[data-reference-domain-content="${domain}"]`);
      if (!content) {
        console.error(`Missing reference domain container for ${domain}`);
        return;
      }
      if (!filteredRecords.length) {
        if (!filterActive && allRecords.length) {
          console.error(`Reference domain ${domain} has backend rows but no visible filtered rows.`);
          content.innerHTML = renderPlainReferenceTable(domain, allRecords, "No rows were visible after render, so a plain table is shown instead.");
        }
        return;
      }
      const visibleRows = content.querySelectorAll("tbody tr").length;
      if (visibleRows === 0) {
        console.error(`Reference domain ${domain} rendered zero visible rows. Falling back to plain table.`);
        content.innerHTML = renderPlainReferenceTable(domain, filteredRecords, "The richer editor did not produce visible rows, so this plain sheet view is being shown instead.");
      }
    });
  });
}

function renderReferencedValuesTable(values) {
  if (!values.length) {
    return `<div class="notice">No referenced values match this filter yet. The Sources structure is ready even where citations have not been populated.</div>`;
  }
  return `
    <div
      class="table-wrap reference-table-wrap reference-table-shell"
      data-reference-resizable="sources_values"
      style="height: ${getReferenceTableHeight("sources_values")}px"
    >
      <table>
        <thead>
          <tr>
            <th>Page</th>
            <th>Section</th>
            <th>Field / Line Item</th>
            <th>Current Value</th>
            <th>Research Note</th>
            <th>Source Links</th>
            <th>Verified</th>
            <th>Evidence</th>
            <th>Confidence</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${values.map((item) => `
            <tr
              id="referenced-value-${item.id}"
              data-source-target="referenced-value-${item.id}"
              data-referenced-value-select="${item.id}"
              class="${item.id === state.sourcesSettings.selectedReferenceId ? "is-selected" : ""}"
            >
              <td>${renderTableCellClip(item.page || "Reference Data")}</td>
              <td>${renderTableCellClip(item.section || "Reference Data")}</td>
              <td>
                <div class="reference-cell-stack table-cell-stack">
                  ${renderTableCellClip(item.fieldLineItem)}
                  <span class="reference-inline-tag" title="${escapeHtml(item.sourceCount ? `${item.sourceCount} source${item.sourceCount === 1 ? "" : "s"}` : "No linked sources yet")}">${escapeHtml(item.sourceCount ? `${item.sourceCount} source${item.sourceCount === 1 ? "" : "s"}` : "No linked sources yet")}</span>
                </div>
              </td>
              <td>${renderTableCellClip(formatReferenceValueByKind(item.currentValue, item.valueKind))}</td>
              <td>${renderTableCellClip(item.researchNote || "No research note yet.")}</td>
              <td>${renderSourceLinksCell(item.sourceLinks || [])}</td>
              <td><span class="reference-badge tone-verification">${escapeHtml(formatVerificationStatus(item.verificationStatus))}</span></td>
              <td>${renderTableCellClip(item.evidenceTier ? humanizeToken(item.evidenceTier) : "—")}</td>
              <td>${renderTableCellClip(item.confidence ? humanizeToken(item.confidence) : "—")}</td>
              <td><span class="reference-inline-tag">${escapeHtml(formatPlaceholderStatus(item.status))}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function bindReferenceInteractions(root) {
  bindReferenceDismissHandlers();
  bindElements(root, "[data-reference-filter]", "input", (input) => {
    state.referenceSettings.filtersByDomain[input.dataset.referenceFilter] = input.value;
    if (state.activeScreen === "reference") renderReferenceData();
  });
  bindElements(root, "[data-reference-advanced-toggle]", "change", (input) => {
    state.referenceSettings.showAdvanced = input.checked;
    writeStoredReferenceAdvanced(state.referenceSettings.showAdvanced);
    if (state.activeScreen === "reference") renderReferenceData();
  });
  bindElements(root, "[data-reference-fit]", "click", (button) => {
    const [domain, mode] = button.dataset.referenceFit.split(":");
    persistReferenceFitMode(domain, mode);
    if (state.activeScreen === "reference") renderReferenceData();
  });
  bindElements(root, "[data-reference-columns-toggle]", "click", (button) => {
    const domain = button.dataset.referenceColumnsToggle;
    state.referenceSettings.openColumnsDomain = state.referenceSettings.openColumnsDomain === domain ? null : domain;
    if (state.activeScreen === "reference") renderReferenceData();
  });
  bindElements(root, "[data-reference-column-toggle]", "click", (button) => {
    const [domain, field] = button.dataset.referenceColumnToggle.split(":");
    toggleReferenceColumnVisibility(domain, field);
    if (state.activeScreen === "reference") renderReferenceData();
  });
  bindElements(root, "[data-reference-layout-reset]", "click", (button) => {
    resetReferenceLayout(button.dataset.referenceLayoutReset);
    if (state.activeScreen === "reference") renderReferenceData();
  });
  bindReferenceCellInteractions(root);
  bindElements(root, "[data-reference-row-reset]", "click", async (button) => {
    const [domain, recordId] = button.dataset.referenceRowReset.split(":");
    await resetReferenceRow(domain, recordId);
  });
  bindElements(root, "[data-reference-resize-field]", "mousedown", (handle, event) => {
    beginReferenceColumnResize(handle.dataset.referenceResizeDomain, handle.dataset.referenceResizeField, event);
  });
  const activeInput = state.referenceSettings.activeEditCell
    ? root.querySelector(`[data-reference-override-input="${state.referenceSettings.activeEditCell}"]`)
    : null;
  activeInput?.focus();
  if (activeInput && typeof activeInput.select === "function") activeInput.select();
  bindReferenceResizeObservers(root);
}

function bindReferenceCellInteractions(root) {
  bindElements(root, "[data-reference-edit-activate]", "click", (button) => {
    state.referenceSettings.activeEditCell = button.dataset.referenceEditActivate;
    if (state.activeScreen === "reference") renderReferenceData();
  });
  bindElements(root, "[data-reference-override-save]", "click", async (button) => {
    const [domain, recordId, field] = button.dataset.referenceOverrideSave.split(":");
    const input = root.querySelector(`[data-reference-override-input="${button.dataset.referenceOverrideSave}"]`);
    const kind = state.bootstrap.referenceFieldMetadata?.[domain]?.editableFields?.[field]?.kind || "number";
    const value = normalizeReferenceEditableValue(input.value, kind);
    state.referenceSettings.activeEditCell = null;
    await saveReferenceOverride(domain, recordId, field, value);
  });
  bindElements(root, "[data-reference-override-reset]", "click", async (button) => {
    if (button.disabled) return;
    const [domain, recordId, field] = button.dataset.referenceOverrideReset.split(":");
    state.referenceSettings.activeEditCell = null;
    await saveReferenceOverride(domain, recordId, field, null, true);
  });
  bindElements(root, "[data-reference-edit-cancel]", "click", () => {
    closeActiveReferenceEditCell();
  });
  bindElements(root, "[data-reference-override-input]", "keydown", async (input, event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const [domain, recordId, field] = input.dataset.referenceOverrideInput.split(":");
      const kind = state.bootstrap.referenceFieldMetadata?.[domain]?.editableFields?.[field]?.kind || "number";
      const value = normalizeReferenceEditableValue(input.value, kind);
      state.referenceSettings.activeEditCell = null;
      await saveReferenceOverride(domain, recordId, field, value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeActiveReferenceEditCell();
    }
  });
  bindElements(root, "[data-reference-source-value]", "click", (button) => {
    openSourcesForReferencedValue(button.dataset.referenceSourceValue);
  });
}

function bindSourcesInteractions(root) {
  bindElements(root, "[data-sources-filter]", "input", (input) => {
    state.sourcesSettings.filter = input.value;
    clearSourcesFocus({ preserveFilter: true });
    if (state.activeScreen === "sources") renderSources();
  });
  bindElements(root, "[data-sources-clear-focus]", "click", () => {
    clearSourcesFocus();
    if (state.activeScreen === "sources") renderSources();
  });
  bindElements(root, "[data-referenced-value-select]", "click", (row) => {
    state.sourcesSettings.selectedReferenceId = row.dataset.referencedValueSelect;
    if (state.activeScreen === "sources") renderSources();
  });
  bindReferenceResizeObservers(root);
}

function filterReferenceRecords(domain) {
  const records = state.bootstrap.referenceDomains?.[domain] || [];
  const metadata = state.bootstrap.referenceFieldMetadata?.[domain] || {};
  const filter = (state.referenceSettings.filtersByDomain[domain] || "").trim().toLowerCase();
  if (!filter) return records;
  const fields = metadata.filterFields || ["id", "label"];
  return records.filter((record) => fields.some((field) => String(record[field] ?? "").toLowerCase().includes(filter)));
}

function getReferenceColumns(domain) {
  const columns = getReferenceAllColumns(domain);
  const visibility = getReferenceColumnVisibility(domain);
  const filtered = columns.filter((column) => visibility[column.field] !== false);
  return filtered.length ? filtered : columns.slice(0, 1);
}

function getVisibleEditableFields(domain) {
  const editable = state.bootstrap.referenceFieldMetadata?.[domain]?.editableFields || {};
  return getReferenceColumns(domain)
    .map((column) => column.field)
    .filter((field) => Object.prototype.hasOwnProperty.call(editable, field));
}

function renderReferenceCell(domain, record, column) {
  const editable = state.bootstrap.referenceFieldMetadata?.[domain]?.editableFields || {};
  const token = `${domain}:${record.id}:${column.field}`;
  if (editable[column.field] && state.referenceSettings.activeEditCell === token) {
    return renderEditableReferenceCell(domain, record, column, editable[column.field]);
  }
  if (editable[column.field]) {
    return renderCompactEditableReferenceCell(domain, record, column, editable[column.field]);
  }
  return renderStaticReferenceCell(domain, record, column);
}

function rerenderReferenceCellByToken(token) {
  const [domain, recordId, field] = token.split(":");
  if (!domain || !recordId || !field) return false;
  const cell = document.querySelector(`[data-reference-override-input="${token}"]`)?.closest("td")
    || document.querySelector(`[data-reference-inline-editor="${token}"]`)?.closest("td")
    || document.querySelector(`[data-reference-edit-activate="${token}"]`)?.closest("td");
  const record = (state.bootstrap.referenceDomains?.[domain] || []).find((item) => item.id === recordId);
  const column = getReferenceAllColumns(domain).find((item) => item.field === field);
  if (!cell || !record || !column) return false;
  cell.innerHTML = renderReferenceCell(domain, record, column);
  bindReferenceCellInteractions(cell);
  const activeInput = cell.querySelector(`[data-reference-override-input="${token}"]`);
  activeInput?.focus();
  if (activeInput && typeof activeInput.select === "function") activeInput.select();
  return true;
}

function closeActiveReferenceEditCell({ rerenderAll = false } = {}) {
  const token = state.referenceSettings.activeEditCell;
  if (!token) return;
  state.referenceSettings.activeEditCell = null;
  if (rerenderAll || !rerenderReferenceCellByToken(token)) {
    if (state.activeScreen === "reference") renderReferenceData();
  }
}

function renderStaticReferenceCell(domain, record, column) {
  const title = getReferenceValueTitle(domain, record, column);
  const sourceButton = renderReferenceSourceButton(domain, record, column.field);
  return `
    <div class="reference-compact-cell">
      <div class="reference-cell-primary">
        <span class="reference-cell-text" title="${escapeHtml(title)}">${renderReferenceValueHtml(domain, record, column)}</span>
        ${sourceButton}
      </div>
    </div>
  `;
}

function renderCompactEditableReferenceCell(domain, record, column, definition) {
  const token = `${domain}:${record.id}:${column.field}`;
  const hasOverride = Object.prototype.hasOwnProperty.call(record.activeOverrides || {}, column.field);
  const title = getReferenceValueTitle(domain, record, column);
  const sourceButton = renderReferenceSourceButton(domain, record, column.field);
  return `
    <div class="reference-compact-cell">
      <button class="reference-cell-activate" data-reference-edit-activate="${token}" title="Edit ${escapeHtml(column.label)}">
        <span class="reference-cell-text ${hasOverride ? "is-overridden" : ""}" title="${escapeHtml(title)}">${renderReferenceValueHtml(domain, record, column)}</span>
      </button>
      ${sourceButton ? `<div class="reference-cell-actions">${sourceButton}</div>` : ""}
    </div>
  `;
}

function renderEditableReferenceCell(domain, record, column, definition) {
  const currentValue = record[column.field];
  const baselineValue = record.baselineValues?.[column.field] ?? currentValue;
  const hasOverride = Object.prototype.hasOwnProperty.call(record.activeOverrides || {}, column.field);
  const token = `${domain}:${record.id}:${column.field}`;
  const sourceButton = renderReferenceSourceButton(domain, record, column.field);
  return `
    <div class="reference-inline-editor" data-reference-inline-editor="${token}">
      <div class="reference-inline-editor-head">
        <span class="reference-inline-tag compact-tag">Baseline ${escapeHtml(formatReferenceValueByKind(baselineValue, definition.kind))}</span>
        ${sourceButton}
      </div>
      <div class="reference-inline-editor-controls">
        ${renderReferenceEditableControl(token, currentValue, definition.kind)}
        <button class="secondary" data-reference-override-save="${token}">Save</button>
        <button class="ghost" data-reference-override-reset="${token}" ${hasOverride ? "" : "disabled"}>Reset</button>
        <button class="ghost" data-reference-edit-cancel="${token}">Close</button>
      </div>
    </div>
  `;
}

function renderReferenceEditableControl(token, currentValue, kind) {
  if (kind === "paygrade") {
    return `
      <select class="reference-override-input" data-reference-override-input="${token}">
        ${Array.from({ length: 9 }, (_, index) => index + 1).map((grade) => `
          <option value="${grade}" ${Number(currentValue || 0) === grade ? "selected" : ""}>E-${grade}</option>
        `).join("")}
      </select>
    `;
  }
  if (kind === "boolean_flag") {
    const enabled = Number(currentValue || 0) >= 0.5;
    return `
      <select class="reference-override-input" data-reference-override-input="${token}">
        <option value="1" ${enabled ? "selected" : ""}>Enabled</option>
        <option value="0" ${enabled ? "" : "selected"}>Disabled</option>
      </select>
    `;
  }
  if (kind === "dependents_flag") {
    const withDependents = Number(currentValue || 0) >= 0.5;
    return `
      <select class="reference-override-input" data-reference-override-input="${token}">
        <option value="1" ${withDependents ? "selected" : ""}>With Dependents</option>
        <option value="0" ${withDependents ? "" : "selected"}>Without Dependents</option>
      </select>
    `;
  }
  if (kind === "year") {
    const startYear = new Date().getFullYear();
    return `
      <select class="reference-override-input" data-reference-override-input="${token}">
        ${Array.from({ length: 12 }, (_, index) => startYear + index).map((year) => `
          <option value="${year}" ${Number(currentValue || 0) === year ? "selected" : ""}>${year}</option>
        `).join("")}
      </select>
    `;
  }
  return `
    <input
      class="reference-override-input"
      data-reference-override-input="${token}"
      type="number"
      step="${kind === "percent" ? "0.1" : "0.01"}"
      value="${escapeHtml(String(formatReferenceEditableValue(currentValue, kind)))}"
    />
  `;
}

function renderReferenceRowResetCell(domain, record) {
  const activeFields = getRowOverrideFields(domain, record);
  if (!activeFields.length) return `<span class="reference-inline-tag">Static</span>`;
  return `
    <div class="reference-row-reset-cell">
      <span class="reference-inline-tag">${activeFields.length} active</span>
      <button class="ghost" data-reference-row-reset="${domain}:${record.id}">Reset row</button>
    </div>
  `;
}

function getRowOverrideFields(domain, record) {
  const visibleEditableFields = new Set(getVisibleEditableFields(domain));
  return Object.keys(record.activeOverrides || {}).filter((field) => visibleEditableFields.has(field));
}

function renderReferenceSourceButton(domain, record, field) {
  const referencedValue = findReferencedValue(domain, record.id, field);
  if (!referencedValue) return "";
  return `<button class="reference-source-button" data-reference-source-value="${referencedValue.id}" title="View data sources for ${escapeHtml(referencedValue.fieldLineItem)}">ⓘ</button>`;
}

function renderReferenceValueHtml(domain, record, column) {
  const rawValue = resolveReferenceDisplayValue(domain, record, column.field);
  if (column.kind === "status") {
    return `<span class="reference-badge tone-verification">${escapeHtml(formatVerificationStatus(rawValue))}</span>`;
  }
  if (column.field === "websiteUrl" && rawValue) {
    return `<a href="${escapeHtml(rawValue)}" target="_blank" rel="noreferrer">${escapeHtml(rawValue)}</a>`;
  }
  if (column.kind === "json" && rawValue) {
    return `<code class="reference-inline-code">${escapeHtml(JSON.stringify(rawValue))}</code>`;
  }
  return escapeHtml(formatReferenceValueByKind(rawValue, column.kind));
}

function getReferenceValueTitle(domain, record, column) {
  const rawValue = resolveReferenceDisplayValue(domain, record, column.field);
  if (column.kind === "status") return formatVerificationStatus(rawValue);
  return formatReferenceValueByKind(rawValue, column.kind);
}

function resolveReferenceDisplayValue(domain, record, field) {
  const value = record[field];
  if (value === null || value === undefined || value === "") return value;
  if (["startingPayGradeNumeric", "targetPayGradeNumeric", "fromPayGradeNumeric", "projectedPayGradeNumeric"].includes(field)) {
    return `E-${Number(value || 0)}`;
  }
  if (field === "withDependentsFlag") {
    return Number(value || 0) >= 0.5 ? "With Dependents" : "Without Dependents";
  }
  if (field === "enabledFlag") {
    return Number(value || 0) >= 0.5 ? "Enabled" : "Disabled";
  }
  if (field === "locationId" || field === "defaultResearchLocationId") {
    return lookupReferenceDomainLabel("locations", value);
  }
  if (field === "giBillBenefitId") {
    return lookupReferenceDomainLabel("gi_bill_benefits", value);
  }
  if (field === "healthcareProfileId") {
    return lookupReferenceDomainLabel("healthcare_profiles", value);
  }
  if (field === "taxProfileId") {
    return lookupReferenceDomainLabel("tax_profiles", value);
  }
  if (field === "costProfileId") {
    return lookupReferenceDomainLabel("location_cost_profiles", value);
  }
  if (field === "destinationId") {
    return lookupCompatibilityLabel("investment_destinations", value);
  }
  if (["basePaySourceId", "bahSourceId", "basSourceId"].includes(field)) {
    return lookupReferenceDomainLabel("military_pay_rates", value);
  }
  if (field === "pathId") {
    const path = (state.bootstrap.pathTemplates || []).find((item) => item.id === value);
    return path?.name || value;
  }
  if (field === "component") {
    return { base_pay: "Base Pay", bah: "BAH", bas: "BAS" }[value] || humanizeToken(value);
  }
  if (field === "deliveryMode") return humanizeToken(value);
  if (field === "eligibilityReason") {
    return {
      location_based_mha: "Location-based housing allowance",
      international_rate_pending_research: "International rate pending research",
    }[value] || humanizeToken(value);
  }
  if (field === "profileType") {
    return {
      tech_company: "Tech company",
      research_employer: "Research employer",
    }[value] || humanizeToken(value);
  }
  if (field === "recordType") return humanizeToken(value);
  if (field === "coverageKind") return humanizeToken(value);
  if (field === "phaseKind") return humanizeToken(value);
  if (field === "ruleType") return humanizeToken(value);
  if (field === "dependencyStatus") return humanizeToken(value);
  if (field === "taxStatus") return humanizeToken(value);
  if (field === "researchTier") return humanizeToken(value);
  if (field === "greStatus") return humanizeToken(value);
  if (field === "regionType") return humanizeToken(value);
  if (field === "countryCode") return { US: "United States", UK: "United Kingdom", JP: "Japan" }[value] || value;
  return value;
}

function lookupReferenceDomainLabel(domain, recordId) {
  const record = (state.bootstrap.referenceDomains?.[domain] || []).find((item) => item.id === recordId);
  return record?.label || record?.schoolName || recordId || "—";
}

function lookupCompatibilityLabel(category, itemId) {
  const record = (state.bootstrap.referenceTables?.[category] || []).find((item) => item.id === itemId);
  return record?.label || itemId || "—";
}

function findReferencedValue(domain, recordId, field) {
  return (state.bootstrap.referencedValues || []).find(
    (item) => item.targetDomain === domain && item.targetRecordId === recordId && item.targetField === field,
  ) || null;
}

function openSourcesForReferencedValue(referenceId) {
  openSourcesForReferencedValues([referenceId]);
}

function openSourcesForReferencedValues(referenceIds) {
  const uniqueReferenceIds = [...new Set((referenceIds || []).filter(Boolean))];
  if (!uniqueReferenceIds.length) return;
  state.sourcesSettings.focusedReferenceIds = uniqueReferenceIds;
  state.sourcesSettings.exactReferenceId = uniqueReferenceIds.length === 1 ? uniqueReferenceIds[0] : null;
  state.sourcesSettings.selectedReferenceId = uniqueReferenceIds[0];
  state.sourcesSettings.filter = "";
  state.pendingHighlightTarget = { screenId: "sources", targetId: `referenced-value-${uniqueReferenceIds[0]}` };
  document.getElementById("modalRoot").innerHTML = "";
  switchScreen("sources");
}

function clearSourcesFocus(options = {}) {
  state.sourcesSettings.focusedReferenceIds = [];
  state.sourcesSettings.exactReferenceId = null;
  if (!options.preserveFilter) {
    state.sourcesSettings.filter = "";
  }
}

function getSourcesFocusState() {
  const focusedCount = state.sourcesSettings.focusedReferenceIds?.length || 0;
  if (focusedCount > 1) return "set";
  if (focusedCount === 1 || state.sourcesSettings.exactReferenceId) return "single";
  return "all";
}

function getSourcesFocusSummaryLabel(focusedVisibleCount = 0) {
  const focusState = getSourcesFocusState();
  if (focusState === "single") return "Focused data point";
  if (focusState === "set") return `Focused set (${focusedVisibleCount} values)`;
  return "All data points";
}

function filterReferencedValues() {
  const values = state.bootstrap.referencedValues || [];
  const focusedIds = state.sourcesSettings.focusedReferenceIds || [];
  if (focusedIds.length) {
    const focusedSet = new Set(focusedIds);
    return values.filter((item) => focusedSet.has(item.id));
  }
  if (state.sourcesSettings.exactReferenceId) {
    return values.filter((item) => item.id === state.sourcesSettings.exactReferenceId);
  }
  const filter = (state.sourcesSettings.filter || "").trim().toLowerCase();
  if (!filter) return values;
  return values.filter((item) => [
    item.page,
    item.section,
    item.fieldLineItem,
    item.friendlyTargetLabel,
    item.fieldLabel,
    item.researchNote,
    item.verificationStatus,
    item.status,
    item.evidenceTier,
    item.confidence,
    item.estimateRationale,
  ].some((value) => String(value || "").toLowerCase().includes(filter)));
}

function ensureReferencedValueSelection(filteredValues) {
  if (filteredValues.some((item) => item.id === state.sourcesSettings.selectedReferenceId)) return;
  state.sourcesSettings.selectedReferenceId = filteredValues[0]?.id || null;
}

function renderSourceLinksCell(sourceLinks) {
  if (!sourceLinks.length) return renderTableCellClip("No linked sources yet.", { className: "muted-text" });
  return `
    <div class="source-link-list">
      ${sourceLinks.map((link) => `
        <div class="source-link-item">
          ${link.url
    ? `<a class="table-cell-clip" href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer" title="${escapeHtml(link.title || link.publisher || "Open source")}">${escapeHtml(link.title || link.publisher || "Open source")}</a>`
    : renderTableCellClip(link.title || link.publisher || "Source record")}
          ${renderTableCellClip([link.publisher, humanizeToken(link.sourceType || "")].filter(Boolean).join(" · ") || "Supporting source", { className: "muted-text" })}
          ${link.noteExcerpt ? renderTableCellClip(link.noteExcerpt, { className: "muted-text" }) : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function bindReferenceResizeObservers(root) {
  if (referenceResizeObserver) referenceResizeObserver.disconnect();
  referenceResizeObserver = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      const domain = entry.target.dataset.referenceResizable;
      if (!domain) return;
      persistReferenceTableHeight(domain, Math.round(entry.target.getBoundingClientRect().height));
    });
  });
  root.querySelectorAll("[data-reference-resizable]").forEach((element) => {
    referenceResizeObserver.observe(element);
  });
}

function persistReferenceTableHeight(domain, height) {
  if (!height || height < 180) return;
  state.referenceSettings.tableHeights[domain] = height;
  writeStoredReferenceTableHeights(state.referenceSettings.tableHeights);
}

function getReferenceTableHeight(domain) {
  return Math.max(240, Number(state.referenceSettings.tableHeights?.[domain] || 360));
}

function getReferenceFitMode(domain) {
  return state.referenceSettings.fitModeByDomain?.[domain] || "fit-screen";
}

function persistReferenceFitMode(domain, mode) {
  state.referenceSettings.fitModeByDomain[domain] = mode;
  writeStoredReferenceFitModes(state.referenceSettings.fitModeByDomain);
}

function getReferenceAllColumns(domain) {
  const metadata = state.bootstrap.referenceFieldMetadata?.[domain] || {};
  const columns = [...(metadata.visibleColumns || [])];
  if (state.referenceSettings.showAdvanced) columns.push(...(metadata.advancedColumns || []));
  return columns;
}

function getReferenceColumnWidth(domain, field) {
  const width = state.referenceSettings.columnWidthsByDomain?.[domain]?.[field];
  return width ? Number(width) : null;
}

function persistReferenceColumnWidth(domain, field, width) {
  state.referenceSettings.columnWidthsByDomain[domain] = {
    ...(state.referenceSettings.columnWidthsByDomain[domain] || {}),
    [field]: width,
  };
  writeStoredReferenceColumnWidths(state.referenceSettings.columnWidthsByDomain);
}

function persistReferenceColumnVisibility(domain, visibility) {
  state.referenceSettings.visibleColumnsByDomain[domain] = visibility;
  writeStoredReferenceColumnVisibility(state.referenceSettings.visibleColumnsByDomain);
}

function getReferenceColumnVisibility(domain) {
  return state.referenceSettings.visibleColumnsByDomain?.[domain] || {};
}

function resetReferenceLayout(domain) {
  delete state.referenceSettings.columnWidthsByDomain[domain];
  delete state.referenceSettings.visibleColumnsByDomain[domain];
  delete state.referenceSettings.fitModeByDomain[domain];
  writeStoredReferenceColumnWidths(state.referenceSettings.columnWidthsByDomain);
  writeStoredReferenceColumnVisibility(state.referenceSettings.visibleColumnsByDomain);
  writeStoredReferenceFitModes(state.referenceSettings.fitModeByDomain);
  state.referenceSettings.openColumnsDomain = null;
}

function toggleReferenceColumnVisibility(domain, field) {
  const available = getReferenceAllColumns(domain);
  const current = { ...getReferenceColumnVisibility(domain) };
  const nextValue = current[field] === false;
  const enabledCount = available.filter((column) => current[column.field] !== false).length;
  if (!nextValue && enabledCount <= 1) return;
  current[field] = nextValue;
  persistReferenceColumnVisibility(domain, current);
}

function renderReferenceColgroup(domain, columns, includeRowReset = false) {
  return `
    <colgroup>
      ${columns.map((column) => {
        const width = getReferenceColumnWidth(domain, column.field);
        return `<col data-reference-col-key="${domain}:${column.field}" ${width ? `style="width:${width}px"` : ""} />`;
      }).join("")}
      ${includeRowReset ? `<col style="width: 118px" />` : ""}
    </colgroup>
  `;
}

function renderReferenceLayoutControls(domain) {
  const fitMode = getReferenceFitMode(domain);
  const columns = getReferenceAllColumns(domain);
  const activeCount = columns.filter((column) => getReferenceColumnVisibility(domain)[column.field] !== false).length;
  return `
    <div class="reference-layout-controls" data-reference-columns-anchor="${domain}">
      <button class="ghost reference-layout-button ${fitMode === "fit-screen" ? "is-active" : ""}" data-reference-fit="${domain}:fit-screen">Fit Screen</button>
      <button class="ghost reference-layout-button ${fitMode === "fit-content" ? "is-active" : ""}" data-reference-fit="${domain}:fit-content">Fit Content</button>
      <button class="ghost reference-layout-button ${state.referenceSettings.openColumnsDomain === domain ? "is-active" : ""}" data-reference-columns-toggle="${domain}">Columns (${activeCount}/${columns.length})</button>
      <button class="ghost reference-layout-button" data-reference-layout-reset="${domain}">Reset Layout</button>
      ${state.referenceSettings.openColumnsDomain === domain ? renderReferenceColumnsPopover(domain, columns) : ""}
    </div>
  `;
}

function renderReferenceColumnsPopover(domain, columns) {
  const visibility = getReferenceColumnVisibility(domain);
  return `
    <div class="reference-columns-popover">
      ${columns.map((column) => `
        <button class="ghost reference-column-toggle ${visibility[column.field] !== false ? "is-active" : ""}" data-reference-column-toggle="${domain}:${column.field}">
          ${escapeHtml(column.label)}
        </button>
      `).join("")}
    </div>
  `;
}

function beginReferenceColumnResize(domain, field, event) {
  event.preventDefault();
  const currentWidth = getReferenceColumnWidth(domain, field) || 132;
  referenceResizeState = { domain, field, startX: event.clientX, startWidth: currentWidth };
  window.addEventListener("mousemove", handleReferenceResizeMove);
  window.addEventListener("mouseup", handleReferenceResizeEnd, { once: true });
}

function handleReferenceResizeMove(event) {
  if (!referenceResizeState) return;
  const nextWidth = Math.max(72, referenceResizeState.startWidth + (event.clientX - referenceResizeState.startX));
  persistReferenceColumnWidth(referenceResizeState.domain, referenceResizeState.field, nextWidth);
  document.querySelectorAll(`[data-reference-col-key="${referenceResizeState.domain}:${referenceResizeState.field}"]`).forEach((column) => {
    column.style.width = `${nextWidth}px`;
  });
}

function handleReferenceResizeEnd() {
  window.removeEventListener("mousemove", handleReferenceResizeMove);
  referenceResizeState = null;
  if (state.activeScreen === "reference") renderReferenceData();
}

function bindReferenceDismissHandlers() {
  if (referenceDismissHandlersBound) return;
  referenceDismissHandlersBound = true;
  document.addEventListener("mousedown", (event) => {
    if (state.activeScreen !== "reference") return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    let shouldRender = false;
    if (state.referenceSettings.openColumnsDomain && !target.closest("[data-reference-columns-anchor]")) {
      state.referenceSettings.openColumnsDomain = null;
      shouldRender = true;
    }
    const activeEditorToken = state.referenceSettings.activeEditCell;
    if (activeEditorToken) {
      const activeEditor = document.querySelector(`[data-reference-inline-editor="${activeEditorToken}"]`);
      if (!(activeEditor instanceof Element) || !activeEditor.contains(target)) {
        closeActiveReferenceEditCell();
      }
    }
    if (shouldRender) renderReferenceData();
  });
  document.addEventListener("keydown", (event) => {
    if (state.activeScreen !== "reference") return;
    if (event.key === "Escape" && state.referenceSettings.openColumnsDomain) {
      state.referenceSettings.openColumnsDomain = null;
      renderReferenceData();
      return;
    }
    if (event.key === "Escape" && state.referenceSettings.activeEditCell) {
      closeActiveReferenceEditCell();
    }
  });
}

async function resetReferenceRow(domain, recordId) {
  const record = (state.bootstrap.referenceDomains?.[domain] || []).find((item) => item.id === recordId);
  if (!record) return;
  const fields = getRowOverrideFields(domain, record);
  if (!fields.length) return;
  const results = await Promise.all(fields.map((field) => postReferenceOverride({ domain, recordId, field, reset: true })));
  const failed = results.find((result) => !result.ok);
  if (failed) {
    window.alert(failed.error || "Unable to reset one or more overrides.");
    return;
  }
  await loadBootstrap();
  await loadPreviewResults();
  if (state.activeScreen === "reference") renderReferenceData();
}

function referenceFieldDefinition(domain, field) {
  const metadata = state.bootstrap.referenceFieldMetadata?.[domain] || {};
  const columns = [...(metadata.visibleColumns || []), ...(metadata.advancedColumns || [])];
  const column = columns.find((item) => item.field === field);
  if (column) return column;
  if (metadata.editableFields?.[field]) return { field, ...metadata.editableFields[field] };
  return { field, label: humanizeToken(field) };
}

function formatReferenceFieldLabel(domain, field) {
  return referenceFieldDefinition(domain, field)?.label || humanizeToken(field);
}

function formatReferenceValueByKind(value, kind) {
  if (value === null || value === undefined || value === "") return "—";
  if (kind === "currency") return currency.format(Number(value || 0));
  if (kind === "percent") return `${(Number(value || 0) * 100).toFixed(1)}%`;
  if (kind === "paygrade") return String(value);
  if (kind === "boolean_flag" || kind === "dependents_flag") return String(value);
  if (kind === "year") return String(value);
  if (kind === "number") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(value);
  }
  if (kind === "date") return String(value);
  if (kind === "json") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatReferenceEditableValue(value, kind) {
  if (kind === "paygrade" || kind === "boolean_flag" || kind === "dependents_flag" || kind === "year") {
    return String(Number(value || 0));
  }
  if (kind === "percent") return ((Number(value || 0) * 1000) / 10).toFixed(1);
  return Number(value || 0).toFixed(2).replace(/\.00$/, "");
}

function normalizeReferenceEditableValue(value, kind) {
  const numeric = Number(value || 0);
  const safeNumeric = Number.isFinite(numeric) ? numeric : 0;
  if (kind === "percent") return safeNumeric / 100;
  if (kind === "paygrade" || kind === "boolean_flag" || kind === "dependents_flag" || kind === "year") return Math.round(safeNumeric);
  return safeNumeric;
}

function formatVerificationStatus(value) {
  return String(value || "unverified")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPlaceholderStatus(value) {
  return humanizeToken(value);
}

function humanizeToken(value) {
  return String(value || "")
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderTableCellClip(value, options = {}) {
  const text = value == null || value === "" ? "—" : String(value);
  const className = options.className ? ` ${options.className}` : "";
  const title = options.title == null ? text : String(options.title);
  return `<span class="table-cell-clip${className}" title="${escapeHtml(title)}">${escapeHtml(text)}</span>`;
}

function countManualFinanceItems(manual) {
  return ["income", "expenses", "assets", "debts"].reduce(
    (bucketSum, bucket) => bucketSum + getRenderableManualSections(bucket, manual[bucket] || [])
      .reduce((sectionSum, section) => sectionSum + getVisibleManualSectionItems(bucket, section).length, 0),
    0,
  );
}

function getManualBucketConfig(bucket) {
  return {
    income: {
      eyebrow: "Income",
      title: "Income",
      support: "Manual-only income inputs. Reference-driven military pay and benefits stay on the Reference Data page.",
      amountField: "amountMonthly",
      amountLabel: "Monthly",
      totalLabel: "Annual",
      monthly: true,
    },
    expenses: {
      eyebrow: "Expenses",
      title: "Expenses",
      support: "Monthly spending rows grouped the way the workbook is structured.",
      amountField: "amountMonthly",
      amountLabel: "Monthly",
      totalLabel: "Annual",
      monthly: true,
    },
    assets: {
      eyebrow: "Assets",
      title: "Assets",
      support: "Current balances for savings, real estate, and personal property.",
      amountField: "amount",
      amountLabel: "Current Balance",
      totalLabel: "Section Total",
      monthly: false,
    },
    debts: {
      eyebrow: "Debt",
      title: "Debt",
      support: "Sparse debt tracking. Empty template rows stay out of the way until you actually need them.",
      amountField: "amount",
      amountLabel: "Current Balance",
      totalLabel: "Section Total",
      monthly: false,
    },
  }[bucket];
}

function getManualSectionDisplayMode(section) {
  return section?.displayMode || "visible_when_empty";
}

function getManualItemEntryMode(item) {
  return item?.entryMode || "manual_only";
}

function getManualItemDisplayMode(item) {
  return item?.displayMode || "visible_when_empty";
}

function getVisibleManualSectionItems(bucket, section) {
  const amountField = getManualBucketConfig(bucket).amountField;
  return [...(section.items || [])].filter((item) => {
    if (getManualItemEntryMode(item) === "reference_backed_hidden") return false;
    if (item.isCustom) return true;
    if (getManualItemDisplayMode(item) === "show_only_if_used") {
      return Number(item?.[amountField] || 0) !== 0;
    }
    return true;
  });
}

function getRenderableManualSections(bucket, sections) {
  return (sections || []).filter((section) => {
    const visibleItems = getVisibleManualSectionItems(bucket, section);
    return getManualSectionDisplayMode(section) !== "show_only_if_used" || visibleItems.length > 0;
  });
}

function renderManualBucket(bucket, sections) {
  const config = getManualBucketConfig(bucket);
  const renderableSections = getRenderableManualSections(bucket, sections);
  const visibleRowCount = renderableSections.reduce((sum, section) => sum + getVisibleManualSectionItems(bucket, section).length, 0);
  return `
    <article class="panel full-span reference-section-panel" id="manual-bucket-${bucket}" data-source-target="manual-bucket-${bucket}">
      <div class="panel-header">
        <div>
          <p class="panel-eyebrow">${escapeHtml(config.eyebrow)}</p>
          <h3>${escapeHtml(config.title)}</h3>
          <p class="support-copy">${escapeHtml(config.support)}</p>
        </div>
        <div class="reference-domain-badges">
          <span class="reference-badge">${renderableSections.length} sections</span>
          <span class="reference-badge">${visibleRowCount} visible rows</span>
        </div>
      </div>
      <div class="manual-bucket-stack">
        ${renderableSections.length ? renderableSections.map((section) => renderManualSection(bucket, section)).join("") : `<div class="render-failure-panel"><p class="panel-eyebrow">${escapeHtml(config.title)}</p><p class="support-copy">No manual rows are currently visible in this bucket. Saved hidden compatibility rows are still preserved.</p></div>`}
      </div>
    </article>
  `;
}

function renderManualSection(bucket, section) {
  const config = getManualBucketConfig(bucket);
  const items = getSortedManualSectionItems(getVisibleManualSectionItems(bucket, section), config.amountField);
  const summary = summarizeManualSection(items, config.amountField, config.monthly);
  const total = items.reduce((sum, item) => sum + Number(item[config.amountField] || 0), 0);
  const annualTotal = config.monthly ? total * 12 : total;
  const emptyState = !items.length ? `
    <div class="manual-section-empty">
      <span class="muted-text">No visible rows yet. Add a custom row when you need this section.</span>
    </div>
  ` : "";
  return `
    <article class="panel manual-section-panel" id="manual-section-${bucket}-${section.id}" data-source-target="manual-section-${bucket}-${section.id}">
      <div class="manual-section-header">
        <div>
          <p class="panel-eyebrow">${escapeHtml(config.title)}</p>
          <h4>${escapeHtml(section.label)}</h4>
        </div>
        <div class="manual-section-actions">
          <span class="reference-inline-tag">${summary.totalRows} rows</span>
          <span class="reference-inline-tag">${summary.nonZeroRows} non-zero</span>
          <span class="reference-inline-tag">${currency.format(summary.sectionTotal)}</span>
          <button class="secondary" data-manual-add-item data-bucket="${bucket}" data-section-id="${section.id}">Add Custom Row</button>
        </div>
      </div>
      <div class="manual-section-summary">
        <span>Total rows: <strong>${summary.totalRows}</strong></span>
        <span>Non-zero rows: <strong>${summary.nonZeroRows}</strong></span>
        <span>Section total: <strong>${currency.format(summary.sectionTotal)}</strong></span>
        ${config.monthly ? `<span>Annualized: <strong>${currency.format(summary.annualizedTotal)}</strong></span>` : ""}
      </div>
      <div data-manual-section-content="${bucket}:${section.id}">
      ${emptyState}
      ${items.length ? `
      <div
        class="table-wrap reference-table-wrap reference-table-shell"
        data-reference-resizable="manual_${bucket}_${section.id}"
        style="height: ${getReferenceTableHeight(`manual_${bucket}_${section.id}`)}px"
      >
        <table>
          <thead>
            <tr>
              <th>Field / Line Item</th>
              <th>Notes</th>
              <th>${escapeHtml(config.amountLabel)}</th>
              ${config.monthly ? "<th>Annual</th>" : ""}
              <th>Data Sources</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item) => renderManualItemRow(bucket, section, item)).join("")}
            <tr class="manual-total-row">
              <td>${renderTableCellClip(`${section.label} Total`)}</td>
              <td>${renderTableCellClip("—")}</td>
              <td>${renderTableCellClip(currency.format(total))}</td>
              ${config.monthly ? `<td>${renderTableCellClip(currency.format(annualTotal))}</td>` : ""}
              <td>${renderTableCellClip("—")}</td>
              <td>${renderTableCellClip("—")}</td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : ""}
      </div>
    </article>
  `;
}

function renderManualItemRow(bucket, section, item) {
  const config = getManualBucketConfig(bucket);
  const amount = Number(item[config.amountField] || 0);
  const annualValue = config.monthly ? amount * 12 : null;
  const isImportedCarryover = String(item.id || "").startsWith("migrated_");
  return `
    <tr
      id="manual-item-${bucket}-${section.id}-${item.id}"
      data-source-target="manual-item-${bucket}-${section.id}-${item.id}"
      data-manual-item-row="true"
    >
      <td>
        <div class="manual-sheet-label">
          <input
            class="manual-sheet-input"
            data-manual-field="label"
            data-bucket="${bucket}"
            data-section-id="${section.id}"
            data-item-id="${item.id}"
            type="text"
            value="${escapeHtml(item.label || "")}"
          />
          ${item.sourceRefId ? `<button class="reference-source-button" data-manual-source-ref="${escapeHtml(item.sourceRefId)}" title="View data sources for ${escapeHtml(item.label || "this value")}">ⓘ</button>` : ""}
          ${isImportedCarryover ? `<span class="reference-inline-tag">Imported</span>` : item.isCustom ? `<span class="reference-inline-tag">Custom</span>` : `<span class="reference-inline-tag">Default</span>`}
        </div>
      </td>
      <td>
        <input
          class="manual-sheet-input"
          data-manual-field="notes"
          data-bucket="${bucket}"
          data-section-id="${section.id}"
          data-item-id="${item.id}"
          type="text"
          value="${escapeHtml(item.notes || "")}"
          placeholder="Notes"
        />
      </td>
      <td>
        <input
          class="manual-sheet-input manual-sheet-input-number"
          data-manual-field="${config.amountField}"
          data-bucket="${bucket}"
          data-section-id="${section.id}"
          data-item-id="${item.id}"
          type="number"
          step="0.01"
          value="${escapeHtml(String(amount))}"
        />
      </td>
      ${config.monthly ? `<td>${renderTableCellClip(currency.format(annualValue || 0))}</td>` : ""}
      <td>${item.sourceRefId ? `<span class="reference-inline-tag" title="Linked">Linked</span>` : renderTableCellClip("None", { className: "muted-text" })}</td>
      <td>${item.isCustom ? `<button class="ghost" data-manual-delete-item data-bucket="${bucket}" data-section-id="${section.id}" data-item-id="${item.id}">Delete</button>` : renderTableCellClip("Fixed row", { className: "muted-text" })}</td>
    </tr>
  `;
}

function getSortedManualSectionItems(section, amountField) {
  return [...(section || [])].sort((left, right) => {
    const leftAmount = Number(left?.[amountField] || 0);
    const rightAmount = Number(right?.[amountField] || 0);
    const leftPriority = leftAmount ? 1 : 0;
    const rightPriority = rightAmount ? 1 : 0;
    if (rightPriority !== leftPriority) return rightPriority - leftPriority;
    if (Boolean(right.isCustom) !== Boolean(left.isCustom)) return Number(Boolean(right.isCustom)) - Number(Boolean(left.isCustom));
    return Number(left.sortOrder || 0) - Number(right.sortOrder || 0);
  });
}

function summarizeManualSection(items, amountField, monthly) {
  const sectionTotal = items.reduce((sum, item) => sum + Number(item?.[amountField] || 0), 0);
  const nonZeroRows = items.filter((item) => Number(item?.[amountField] || 0) !== 0).length;
  return {
    totalRows: items.length,
    nonZeroRows,
    sectionTotal,
    annualizedTotal: monthly ? sectionTotal * 12 : sectionTotal,
  };
}

function ensureManualFinanceVisibility(root, manual) {
  const buckets = ["income", "expenses", "assets", "debts"];
  buckets.forEach((bucket) => {
    getRenderableManualSections(bucket, manual[bucket] || []).forEach((section) => {
      const content = root.querySelector(`[data-manual-section-content="${bucket}:${section.id}"]`);
      if (!content) {
        console.error(`Missing manual finance section container for ${bucket}:${section.id}`);
        return;
      }
      const renderedRows = content.querySelectorAll("[data-manual-item-row]").length;
      const visibleItems = getVisibleManualSectionItems(bucket, section);
      if (visibleItems.length > 0 && renderedRows === 0) {
        console.error(`Manual finance section ${bucket}:${section.id} has stored items but rendered zero visible rows.`);
        content.innerHTML = renderManualSectionFailure(bucket, section);
      }
    });
  });
}

function renderManualSectionFailure(bucket, section) {
  return `
    <div class="render-failure-panel">
      <p class="panel-eyebrow">Manual Finance Render Guard</p>
      <h4>${escapeHtml(section.label)}</h4>
      <p class="support-copy">This section has stored data in the backend, but no visible workbook rows were rendered. Refresh the page, and if this persists, the section payload for <code>${escapeHtml(bucket)}:${escapeHtml(section.id)}</code> needs inspection.</p>
    </div>
  `;
}

function findManualFinanceSection(bucket, sectionId) {
  return (state.bootstrap.manualCashflowInputs?.[bucket] || []).find((section) => section.id === sectionId) || null;
}

function findManualFinanceItem(bucket, sectionId, itemId) {
  return findManualFinanceSection(bucket, sectionId)?.items?.find((item) => item.id === itemId) || null;
}

function addManualFinanceItem(bucket, sectionId) {
  const section = findManualFinanceSection(bucket, sectionId);
  if (!section) return;
  const config = getManualBucketConfig(bucket);
  const nextOrder = Math.max(-1, ...(section.items || []).map((item) => Number(item.sortOrder || 0))) + 1;
  const item = {
    id: `custom_${crypto.randomUUID().slice(0, 8)}`,
    label: "Custom Item",
    notes: "",
    isCustom: true,
    sortOrder: nextOrder,
    sourceRefId: null,
    entryMode: "manual_only",
    displayMode: "visible_when_empty",
  };
  item[config.amountField] = 0;
  section.items = [...(section.items || []), item];
}

function deleteManualFinanceItem(bucket, sectionId, itemId) {
  const section = findManualFinanceSection(bucket, sectionId);
  if (!section) return;
  section.items = (section.items || []).filter((item) => !(item.id === itemId && item.isCustom));
}

function formatReferenceCategoryName(category) {
  const map = {
    tech_companies: "Tech companies",
    research_employers: "Research employers",
    va_disability: "VA disability ratings",
    phd_programs: "PhD programs",
    military_base_pay_rates: "Military base pay rates",
    military_bah_rates: "Military BAH rates",
    military_bas_rates: "Military BAS rates",
    investment_destinations: "Investment destinations",
  };
  return map[category] || category.replaceAll("_", " ");
}

function buildHorizonOptions(selectedValue = state.horizonYearIndex) {
  return [
    [9, "10 years"],
    [19, "20 years"],
    [29, "30 years"],
    [39, "40 years"],
    [49, "50 years"],
  ]
    .map(([value, label]) => `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${label}</option>`)
    .join("");
}

function buildSlotOptions(selected) {
  const options = getProjectableSlots()
    .map((slot) => `<option value="${slot.slotId}" ${slot.slotId === selected ? "selected" : ""}>${escapeHtml(getPathDisplayName(slot))}</option>`)
    .join("");
  return options || `<option value="">No loaded paths</option>`;
}

function buildOptions(items, selectedValue, valueKey, labelKey) {
  return items
    .map((item) => `<option value="${item[valueKey]}" ${String(item[valueKey]) === String(selectedValue) ? "selected" : ""}>${item[labelKey]}</option>`)
    .join("");
}

function isLegacyPathTemplateId(templateId) {
  return LEGACY_PATH_TEMPLATE_IDS.includes(templateId);
}

function normalizeLegacyPathTemplateId(templateId) {
  return isLegacyPathTemplateId(templateId) ? templateId : "PATH_A";
}

function coerceLegacyPathTemplateId(scenario) {
  const currentTemplateId = scenario?.pathTemplateId;
  if (isLegacyPathTemplateId(currentTemplateId)) return currentTemplateId;

  const rawTimeline = scenario?.pathTimeline || {};
  const serviceExitType = rawTimeline?.serviceExit?.type || null;
  const blocks = Array.isArray(rawTimeline?.blocks) ? rawTimeline.blocks : [];
  const hasGradOrResearch = blocks.some((block) => ["grad_school", "research_career"].includes(block?.type))
    || Boolean(scenario?.selectedPhdProgramId || scenario?.selectedEmployerId);
  const hasTechOnly = (
    blocks.length > 0
      ? blocks.every((block) => block?.type === "tech_career")
      : Boolean(scenario?.selectedCompanyId && !hasGradOrResearch)
  );

  if (serviceExitType === "military_retirement") return "PATH_A";
  if (serviceExitType === "separation") return hasTechOnly && !hasGradOrResearch ? "PATH_B" : "PATH_C";
  if (hasTechOnly && !hasGradOrResearch) return "PATH_B";
  if (hasGradOrResearch) return "PATH_C";
  return "PATH_A";
}

function getLegacyPathTemplates() {
  const bootstrapTemplates = (state.bootstrap?.pathTemplates || []).filter((item) => isLegacyPathTemplateId(item.id));
  if (bootstrapTemplates.length) return bootstrapTemplates;
  return LEGACY_PATH_TEMPLATE_IDS.map((id) => ({ id, name: LEGACY_PATH_TEMPLATE_FALLBACKS[id] }));
}

function getPathTemplateName(templateId) {
  const match = getLegacyPathTemplates().find((item) => item.id === templateId);
  return match?.name || LEGACY_PATH_TEMPLATE_FALLBACKS[templateId] || "Choose a path type";
}

function templateUsesGradSchool(templateId) {
  return ["PATH_A", "PATH_C"].includes(templateId);
}

function templateUsesResearch(templateId) {
  return ["PATH_A", "PATH_C"].includes(templateId);
}

function templateUsesTech(templateId) {
  return templateId === "PATH_B";
}

function getLoadedSlots() {
  return state.workspaceSlots.filter((slot) => slot.loaded);
}

function getProjectableSlots() {
  return getLoadedSlots().filter((slot) => slotCanProject(slot));
}

function getWidgetEligibleSlots() {
  return getProjectableSlots().filter((slot) => !slot.hiddenFromVisuals);
}

function getSlot(slotId) {
  return state.workspaceSlots.find((slot) => slot.slotId === slotId);
}

function getEditorSlot() {
  return getSlot(state.editorSlotId);
}

function getWidget(widgetId) {
  return state.widgets.find((widget) => widget.id === widgetId);
}

function getDashboardV4Chart(chartId) {
  return state.dashboardV4.charts.find((chart) => chart.id === chartId);
}

function getHorizonRows() {
  const firstResult = Object.values(state.previewResults)[0];
  return firstResult?.projection ?? [];
}

function getPathDisplayName(slot) {
  return slot?.title?.trim() || slot?.draft?.displayName || slot?.displayName || slot?.name || slot?.slotLabel || "New Path";
}

function getSavedScenarioDisplayName(scenario) {
  return scenario?.displayName?.trim() || scenario?.name?.trim() || "Saved Path";
}

function getSavedScenarioSummary(scenario) {
  return scenario?.routeSummary?.trim() || "No route summary yet.";
}

function parsePathSummary(summaryText) {
  const normalized = String(summaryText || "").trim();
  if (!normalized) {
    return { routeText: "No route summary yet.", detailSteps: [] };
  }
  const [routePart, detailPart] = normalized.split("·").map((part) => part.trim());
  return {
    routeText: routePart || normalized,
    detailSteps: detailPart ? detailPart.split("->").map((step) => step.trim()).filter(Boolean) : [],
  };
}

function classifyPathSummaryDetail(detail) {
  const label = String(detail || "").trim();
  if (!label) return "neutral";
  const references = state.bootstrap?.referenceTables || {};
  const labelSansYears = label.replace(/\s+\d{4}(?:-\d{4})?$/, "").trim();
  if ((references.phd_programs || []).some((item) => item.label === labelSansYears)) return "school";
  if ((references.research_employers || []).some((item) => item.label === labelSansYears)) return "research";
  if ((references.tech_companies || []).some((item) => item.label === labelSansYears)) return "tech";
  if (/\b(retire|separate|gap year|transition|active duty)\b/i.test(label) || /\b\d{4}\b/.test(label)) return "status";
  return "neutral";
}

function renderPathSummary(summaryText, options = {}) {
  const { routeText, detailSteps } = parsePathSummary(summaryText);
  const classes = ["path-summary", options.compact ? "compact" : "", options.className || ""].filter(Boolean).join(" ");
  return `
    <div class="${classes}">
      <div class="path-summary-route">${escapeHtml(routeText)}</div>
      ${detailSteps.length ? `
        <div class="path-summary-details">
          ${detailSteps.map((detail) => `
            <span class="path-summary-chip tone-${classifyPathSummaryDetail(detail)}">${escapeHtml(detail)}</span>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderSavedScenarioOption(scenario, actionAttributes) {
  const actionAttrs = Object.entries(actionAttributes)
    .map(([key, value]) => `${key}="${escapeHtml(String(value))}"`)
    .join(" ");
  return `
    <button class="saved-item" ${actionAttrs}>
      <div class="saved-item-copy">
        <div class="saved-item-title">${escapeHtml(getSavedScenarioDisplayName(scenario))}</div>
        ${renderPathSummary(getSavedScenarioSummary(scenario), { className: "saved-item-summary", compact: true })}
      </div>
      <span class="dot ${scenario.colorToken || "slate"}"></span>
    </button>
  `;
}

function getChartMaxIndex(chart) {
  const availableMax = Math.max(0, getHorizonRows().length - 1);
  return Math.max(0, Math.min(chart?.maxHorizonIndex ?? state.horizonYearIndex, availableMax));
}

function buildCumulativeSeries(projection) {
  let running = 0;
  return projection.map((row) => {
    running += row.netCashFlow;
    return running;
  });
}

const TIMELINE_BLOCK_LABELS = {
  grad_school: "Grad School",
  tech_career: "Tech Career",
  research_career: "Research Career",
  retire: "Retire",
};

function defaultServiceExitYear(exitType) {
  if (exitType === "military_retirement") return Number(state.bootstrap?.plannerProfile?.retirementEligibleYear ?? 2034);
  if (exitType === "separation") return Number(state.bootstrap?.plannerProfile?.plannedSeparationYear ?? 2027);
  return null;
}

function emptyPathTimeline() {
  return {
    version: 1,
    serviceExit: { type: null, year: null },
    blocks: [],
  };
}

function legacyPathTimeline(templateId) {
  if (templateId === "PATH_A") {
    return {
      version: 1,
      serviceExit: { type: "military_retirement", year: defaultServiceExitYear("military_retirement") },
      blocks: [
        { id: "legacy_grad_school", type: "grad_school", startYear: 2035 },
        { id: "legacy_research_career", type: "research_career", startYear: 2040 },
      ],
    };
  }
  if (templateId === "PATH_B") {
    return {
      version: 1,
      serviceExit: { type: "separation", year: defaultServiceExitYear("separation") },
      blocks: [{ id: "legacy_tech_career", type: "tech_career", startYear: 2028 }],
    };
  }
  if (templateId === "PATH_C") {
    return {
      version: 1,
      serviceExit: { type: "separation", year: defaultServiceExitYear("separation") },
      blocks: [
        { id: "legacy_grad_school", type: "grad_school", startYear: 2029 },
        { id: "legacy_research_career", type: "research_career", startYear: 2034 },
      ],
    };
  }
  return null;
}

function normalizePathTimeline(pathTimeline, pathTemplateId) {
  if (!pathTimeline) return legacyPathTimeline(pathTemplateId) || emptyPathTimeline();
  const serviceExit = pathTimeline.serviceExit || {};
  const serviceExitType = serviceExit.type || null;
  return {
    version: 1,
    serviceExit: {
      type: serviceExitType,
      year: defaultServiceExitYear(serviceExitType),
    },
    blocks: (pathTimeline.blocks || [])
      .filter((block) => TIMELINE_BLOCK_LABELS[block?.type])
      .map((block, index) => {
        const parsedStartYear = Number.parseInt(block.startYear, 10);
        return {
          id: block.id || `timeline_block_${index + 1}`,
          type: block.type,
          startYear: Number.isFinite(parsedStartYear) ? parsedStartYear : null,
        };
      }),
  };
}

function timelineUsesBlock(pathTimeline, blockType) {
  return (pathTimeline?.blocks || []).some((block) => block.type === blockType);
}

function timelineProgramDurationYears(scenario) {
  const program = state.bootstrap?.referenceTables?.phd_programs?.find((item) => item.id === scenario?.selectedPhdProgramId);
  return Number(program?.durationYears || 5);
}

function validatePathTimeline(scenario) {
  const pathTimeline = normalizePathTimeline(scenario?.pathTimeline, scenario?.pathTemplateId);
  const errors = [];
  const resolvedBlocks = [];
  const serviceExitType = pathTimeline.serviceExit?.type;
  const serviceExitYear = pathTimeline.serviceExit?.year;
  const gradDurationYears = timelineProgramDurationYears(scenario);

  if (!serviceExitType) {
    errors.push("Choose Military Retirement or Separation first.");
  }

  let seenGradSchool = false;
  let seenRetire = false;
  let previousEndYear = Number.isFinite(serviceExitYear) ? serviceExitYear : null;

  pathTimeline.blocks.forEach((block, index) => {
    if (block.type === "grad_school") {
      if (seenGradSchool) errors.push("Only one Grad School block is supported right now.");
      seenGradSchool = true;
    }
    if (block.type === "retire") {
      if (seenRetire) errors.push("Only one Retire block is allowed.");
      if (index !== pathTimeline.blocks.length - 1) errors.push("Retire must be the final block.");
      seenRetire = true;
    }

    if (!Number.isFinite(block.startYear)) {
      errors.push(`Enter a valid start year for ${TIMELINE_BLOCK_LABELS[block.type]}.`);
      return;
    }
    if (Number.isFinite(previousEndYear) && block.startYear <= previousEndYear) {
      errors.push(`${TIMELINE_BLOCK_LABELS[block.type]} must start after ${previousEndYear}.`);
    }

    const endYear = block.type === "grad_school" ? block.startYear + gradDurationYears - 1 : block.startYear;
    resolvedBlocks.push({ ...block, endYear });
    previousEndYear = endYear;
  });

  return {
    isValid: Boolean(serviceExitType) && errors.length === 0,
    errors,
    pathTimeline,
    resolvedBlocks,
  };
}

function timelineServiceExitLabel(pathTimeline) {
  const serviceExit = pathTimeline?.serviceExit || {};
  if (serviceExit.type === "military_retirement") {
    return serviceExit.year ? `Military Retirement ${serviceExit.year}` : "Military Retirement";
  }
  if (serviceExit.type === "separation") {
    return serviceExit.year ? `Separation ${serviceExit.year}` : "Separation";
  }
  return null;
}

function timelineBlockSummaryLabel(block, scenario) {
  if (block.type === "grad_school") {
    const label = labelForReference("phd_programs", scenario.selectedPhdProgramId) || TIMELINE_BLOCK_LABELS[block.type];
    const endYear = block.startYear + timelineProgramDurationYears(scenario) - 1;
    return Number.isFinite(block.startYear) ? `${label} ${block.startYear}-${endYear}` : label;
  }
  if (block.type === "tech_career") {
    const label = labelForReference("tech_companies", scenario.selectedCompanyId) || TIMELINE_BLOCK_LABELS[block.type];
    return Number.isFinite(block.startYear) ? `${label} ${block.startYear}` : label;
  }
  if (block.type === "research_career") {
    const label = labelForReference("research_employers", scenario.selectedEmployerId) || TIMELINE_BLOCK_LABELS[block.type];
    return Number.isFinite(block.startYear) ? `${label} ${block.startYear}` : label;
  }
  return Number.isFinite(block.startYear) ? `Retire ${block.startYear}` : "Retire";
}

function buildSlotSummaryLine(slot) {
  if (!slot.draft) return "No path loaded.";
  return slot.draft.routeSummary || buildRouteSummary(slot.draft);
}

function buildRouteSummary(scenario) {
  if (!scenario) return "No route summary yet.";
  return getPathTemplateName(normalizeLegacyPathTemplateId(scenario.pathTemplateId));
}

function labelForReference(category, id) {
  const item = state.bootstrap.referenceTables[category].find((entry) => entry.id === id);
  return item?.label || null;
}

function applyPathDependencies(slot) {
  const draft = slot?.draft;
  if (!draft) return;
  const pathTemplateId = normalizeLegacyPathTemplateId(draft.pathTemplateId);
  draft.pathTemplateId = pathTemplateId;
  if (!draft.selectedVaRatingId) draft.selectedVaRatingId = "30";

  if (templateUsesTech(pathTemplateId)) {
    if (!slot.draft.selectedCompanyId) slot.draft.selectedCompanyId = "GENERIC_IC";
  } else {
    slot.draft.selectedCompanyId = null;
  }

  if (templateUsesResearch(pathTemplateId)) {
    if (!slot.draft.selectedEmployerId) slot.draft.selectedEmployerId = "CONSERVATIVE";
  } else {
    slot.draft.selectedEmployerId = null;
  }

  if (templateUsesGradSchool(pathTemplateId)) {
    if (!slot.draft.selectedPhdProgramId) slot.draft.selectedPhdProgramId = "STAN-CS-PHD";
  } else {
    slot.draft.selectedPhdProgramId = null;
    slot.draft.useGiBill = false;
  }
}

function timelineAvailableNextBlocks(pathTimeline) {
  const normalized = normalizePathTimeline(pathTimeline);
  if (!normalized.serviceExit?.type) return [];
  if (timelineUsesBlock(normalized, "retire")) return [];
  const blocks = ["tech_career", "research_career"];
  if (!timelineUsesBlock(normalized, "grad_school")) blocks.push("grad_school");
  blocks.push("retire");
  return blocks;
}

function renderTimelineBuilder(slot, options = {}) {
  const { editor = false } = options;
  const pathTemplateId = normalizeLegacyPathTemplateId(slot.draft.pathTemplateId);
  const optionsMarkup = getLegacyPathTemplates()
    .map((item) => `<option value="${item.id}" ${item.id === pathTemplateId ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
    .join("");

  if (editor) {
    return `<select id="editorPathTemplateSelect">${optionsMarkup}</select>`;
  }
  return `<select data-slot-field="${slot.slotId}" data-field="pathTemplateId">${optionsMarkup}</select>`;
}

function renderTimelineDependentFields(slot, options = {}) {
  const { editor = false } = options;
  const pathTemplateId = normalizeLegacyPathTemplateId(slot.draft.pathTemplateId);
  const fields = [];

  if (templateUsesGradSchool(pathTemplateId)) {
    fields.push(editor
      ? `
        <div class="field" id="path-editor-field-selectedPhdProgramId" data-source-target="path-editor-field-selectedPhdProgramId">
          <label>Grad School</label>
          <select id="editorSchoolSelect">
            <option value="">None</option>
            ${buildOptions(state.bootstrap.referenceTables.phd_programs, slot.draft.selectedPhdProgramId, "id", "label")}
          </select>
        </div>
      `
      : `
        <div class="field">
          <label>Grad School</label>
          <select data-slot-field="${slot.slotId}" data-field="selectedPhdProgramId">
            <option value="">None</option>
            ${buildOptions(state.bootstrap.referenceTables.phd_programs, slot.draft.selectedPhdProgramId, "id", "label")}
          </select>
        </div>
      `);
  }

  if (templateUsesResearch(pathTemplateId)) {
    fields.push(editor
      ? `
        <div class="field" id="path-editor-field-selectedEmployerId" data-source-target="path-editor-field-selectedEmployerId">
          <label>Research Employer</label>
          <select id="editorEmployerSelect">
            <option value="">None</option>
            ${buildOptions(state.bootstrap.referenceTables.research_employers, slot.draft.selectedEmployerId, "id", "label")}
          </select>
        </div>
      `
      : `
        <div class="field">
          <label>Research Employer</label>
          <select data-slot-field="${slot.slotId}" data-field="selectedEmployerId">
            <option value="">None</option>
            ${buildOptions(state.bootstrap.referenceTables.research_employers, slot.draft.selectedEmployerId, "id", "label")}
          </select>
        </div>
      `);
  }

  if (templateUsesTech(pathTemplateId)) {
    fields.push(editor
      ? `
        <div class="field" id="path-editor-field-selectedCompanyId" data-source-target="path-editor-field-selectedCompanyId">
          <label>Tech Company</label>
          <select id="editorCompanySelect">
            <option value="">None</option>
            ${buildOptions(state.bootstrap.referenceTables.tech_companies, slot.draft.selectedCompanyId, "id", "label")}
          </select>
        </div>
      `
      : `
        <div class="field">
          <label>Tech Company</label>
          <select data-slot-field="${slot.slotId}" data-field="selectedCompanyId">
            <option value="">None</option>
            ${buildOptions(state.bootstrap.referenceTables.tech_companies, slot.draft.selectedCompanyId, "id", "label")}
          </select>
        </div>
      `);
  }

  fields.push(editor
    ? `
      <div class="field" id="path-editor-field-selectedVaRatingId" data-source-target="path-editor-field-selectedVaRatingId">
        <label>VA Disability</label>
        <select id="editorVaSelect">${buildOptions(state.bootstrap.referenceTables.va_disability, slot.draft.selectedVaRatingId, "id", "label")}</select>
      </div>
    `
    : `
      <div class="field">
        <label>VA Disability</label>
        <select data-slot-field="${slot.slotId}" data-field="selectedVaRatingId">${buildOptions(state.bootstrap.referenceTables.va_disability, slot.draft.selectedVaRatingId, "id", "label")}</select>
      </div>
    `);

  return fields.join("");
}

function markSlotDirty(slot, reason) {
  if (!slot.titleTouched && reason !== "title" && slot.title === (slot.draft.displayName || slot.slotLabel)) {
    slot.title = "New Path";
    slot.draft.displayName = slot.title;
  }
  slot.draft.routeSummary = buildRouteSummary(slot.draft);
  slot.dirty = slot.originalFingerprint !== scenarioFingerprint(slot.draft);
}

function commitSlotTitleEdit(slotId, nextValue) {
  const slot = getSlot(slotId);
  if (!slot || !slot.loaded) return;
  const normalizedTitle = nextValue.trim() || "New Path";
  slot.title = normalizedTitle;
  slot.titleTouched = true;
  slot.titleEditing = false;
  if (slot.draft) {
    slot.draft.displayName = normalizedTitle;
    slot.draft.routeSummary = buildRouteSummary(slot.draft);
  }
  markSlotDirty(slot, "title");
  renderApp();
}

function cancelSlotTitleEdit(slotId) {
  const slot = getSlot(slotId);
  if (!slot) return;
  slot.titleEditing = false;
  renderCurrentScreen();
}

async function openPathEditor(slotId) {
  state.editorSlotId = slotId;
  switchScreen("path-editor");
}

function requestLoadIntoSlot(slotId) {
  const slot = getSlot(slotId);
  if (slot.loaded && slot.dirty) {
    return showUnsavedModal(slot, () => openLoadModal(slotId));
  }
  openLoadModal(slotId);
}

function requestRemoveSlot(slotId) {
  const slot = getSlot(slotId);
  if (!slot.loaded) return;
  if (slot.dirty) {
    return showUnsavedModal(slot, () => unloadSlot(slotId));
  }
  unloadSlot(slotId);
}

function unloadSlot(slotId) {
  const slot = getSlot(slotId);
  state.workspaceSlots = state.workspaceSlots.filter((item) => item.slotId !== slotId);
  state.previewSettings.selectedSlotIds = state.previewSettings.selectedSlotIds.filter((id) => id !== slotId);
  state.explorerSettings.selectedSlotIds = state.explorerSettings.selectedSlotIds.filter((id) => id !== slotId);
  state.dashboardV4.preview.selectedSlotIds = state.dashboardV4.preview.selectedSlotIds.filter((id) => id !== slotId);
  if (state.editorSlotId === slotId) state.editorSlotId = getLoadedSlots()[0]?.slotId ?? "slot_a";
  syncSelectionState();
  loadPreviewResults();
}

function openLoadModal(slotId) {
  const modalRoot = document.getElementById("modalRoot");
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div>
          <p class="panel-eyebrow">Load Saved Path</p>
          <h3>Replace ${getSlot(slotId).slotLabel}</h3>
          <p class="support-copy">Loading a path changes only this workspace slot. Stored scenarios are not deleted.</p>
        </div>
        <div class="saved-list">
          ${state.savedScenarios.map((scenario) => renderSavedScenarioOption(scenario, {
            "data-load-saved-into-slot": slotId,
            "data-scenario-id": scenario.id,
          })).join("")}
        </div>
        <div class="modal-actions">
          <button class="ghost" id="closeModalBtn">Cancel</button>
        </div>
      </div>
    </div>
  `;

  modalRoot.querySelectorAll("[data-load-saved-into-slot]").forEach((button) => {
    button.addEventListener("click", async () => {
      const scenario = state.savedScenarios.find((item) => item.id === button.dataset.scenarioId);
      const slot = getSlot(slotId);
      const config = configForSlot(slot);
      Object.assign(slot, createWorkspaceSlot(config, scenario));
      state.previewSettings.selectedSlotIds = uniqueSlotIds([...state.previewSettings.selectedSlotIds, slotId]);
      state.explorerSettings.selectedSlotIds = uniqueSlotIds([...state.explorerSettings.selectedSlotIds, slotId]);
      state.editorSlotId = slotId;
      syncSelectionState();
      modalRoot.innerHTML = "";
      await loadPreviewResults();
    });
  });
  modalRoot.querySelector("#closeModalBtn").addEventListener("click", () => {
    modalRoot.innerHTML = "";
  });
}

async function saveSlot(slotId) {
  const slot = getSlot(slotId);
  if (!slot.loaded || !slot.draft) return;
  if (!slotCanProject(slot)) {
    window.alert("Choose a valid path type before saving.");
    return;
  }

  if (!slot.sourceScenarioId) {
    return saveSlotAsNew(slotId);
  }

  const payload = {
    ...serializeScenarioForSave(slot),
    id: slot.sourceScenarioId,
  };
  await fetch("/api/scenario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await reloadAfterSave(slotId, slot.sourceScenarioId);
}

async function saveSlotAsNew(slotId) {
  const slot = getSlot(slotId);
  const suggestedName = slot.title || "New Path";
  const newName = window.prompt("Save this path as a new saved path", suggestedName);
  if (!newName) return;
  const newId = `scenario_${crypto.randomUUID().slice(0, 8)}`;
  const payload = {
    ...serializeScenarioForSave(slot),
    id: newId,
    name: newName,
    displayName: newName,
  };
  await fetch("/api/scenario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await reloadAfterSave(slotId, newId);
}

async function reloadAfterSave(slotId, savedScenarioId) {
  await loadBootstrap();
  const savedScenario = state.savedScenarios.find((item) => item.id === savedScenarioId);
  const slot = getSlot(slotId);
  const config = configForSlot(slot);
  Object.assign(slot, createWorkspaceSlot(config, savedScenario));
  state.editorSlotId = slotId;
  syncSelectionState();
  await loadPreviewResults();
}

function showUnsavedModal(slot, onDiscard) {
  const modalRoot = document.getElementById("modalRoot");
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div>
          <p class="panel-eyebrow">Unsaved Changes</p>
          <h3>${slot.slotLabel} has unsaved edits</h3>
          <p class="support-copy">Save to the current path, save as a new path, or discard these edits before this path leaves the workspace.</p>
        </div>
        <div class="modal-actions">
          <button class="primary" id="saveCurrentDraftBtn">Save Current Path</button>
          <button class="secondary" id="saveNewDraftBtn">Save as New Path</button>
          <button class="ghost" id="discardDraftBtn">Discard Changes</button>
          <button class="ghost" id="cancelDraftBtn">Cancel</button>
        </div>
      </div>
    </div>
  `;

  modalRoot.querySelector("#saveCurrentDraftBtn").addEventListener("click", async () => {
    await saveSlot(slot.slotId);
    modalRoot.innerHTML = "";
    onDiscard();
  });
  modalRoot.querySelector("#saveNewDraftBtn").addEventListener("click", async () => {
    await saveSlotAsNew(slot.slotId);
    modalRoot.innerHTML = "";
    onDiscard();
  });
  modalRoot.querySelector("#discardDraftBtn").addEventListener("click", () => {
    modalRoot.innerHTML = "";
    onDiscard();
  });
  modalRoot.querySelector("#cancelDraftBtn").addEventListener("click", () => {
    modalRoot.innerHTML = "";
  });
}

function serializeScenarioForSave(slot) {
  const scenario = structuredClone(slot.draft);
  const pathTemplateId = normalizeLegacyPathTemplateId(scenario.pathTemplateId);
  return {
    id: slot.sourceScenarioId || scenario.id,
    name: slot.title || slot.slotLabel,
    displayName: slot.title || slot.slotLabel,
    pathTemplateId,
    enabled: true,
    notes: scenario.notes || "",
    colorToken: slot.colorToken,
    isLoaded: true,
    displayOrder: state.workspaceSlots.findIndex((item) => item.slotId === slot.slotId),
    selectedCompanyId: scenario.selectedCompanyId || null,
    selectedEmployerId: scenario.selectedEmployerId || null,
    selectedVaRatingId: scenario.selectedVaRatingId || "30",
    selectedPhdProgramId: scenario.selectedPhdProgramId || null,
    useVa: scenario.useVa ?? true,
    useGiBill: scenario.useGiBill ?? true,
    overrides: scenario.overrides || {},
  };
}

function serializeSlotForPreview(slot) {
  return {
    ...serializeScenarioForSave(slot),
    id: slot.slotId,
    name: slot.slotLabel,
    displayName: slot.title || slot.slotLabel,
  };
}

function addWidget() {
  const nextIndex = state.widgets.length + 1;
  const groups = Object.keys(WIDGET_VIEW_PRESETS).filter((groupKey) => groupKey !== "custom");
  const viewMode = groups[nextIndex % groups.length];
  state.widgets.push(hydrateWidget({
    id: `widget_${crypto.randomUUID().slice(0, 8)}`,
    title: `Widget ${nextIndex}`,
    viewMode,
    metrics: [...WIDGET_VIEW_PRESETS[viewMode].defaultMetrics],
    size: "1x2",
  }));
}

function hydrateWidget(widget) {
  const viewMode = widget.viewMode || widget.metricGroup || "wealth";
  const viewConfig = WIDGET_VIEW_PRESETS[viewMode] || WIDGET_VIEW_PRESETS.wealth;
  const hydrated = {
    ...widget,
    viewMode,
    selectedSlotIds: [...getWidgetEligibleSlots().map((slot) => slot.slotId)],
    knownSlotIds: [...getWidgetEligibleSlots().map((slot) => slot.slotId)],
    metrics: widget.metrics?.length ? [...widget.metrics] : [...viewConfig.defaultMetrics],
    defaultEndIndex: widget.defaultEndIndex ?? widget.maxHorizonIndex ?? state.horizonYearIndex,
    viewStartIndex: 0,
    viewEndIndex: state.horizonYearIndex,
    hoverIndex: null,
    hoverCanvasY: null,
    hoverSlotId: null,
    isPanning: false,
    panAnchorX: null,
    panAnchorStart: 0,
    panAnchorEnd: state.horizonYearIndex,
  };
  clampWidgetViewport(hydrated);
  return hydrated;
}

function resetWidgetViewport(widget) {
  const maxIndex = getChartMaxIndex(widget);
  widget.viewStartIndex = 0;
  widget.viewEndIndex = maxIndex;
  widget.hoverIndex = null;
  widget.hoverCanvasY = null;
  widget.hoverSlotId = null;
  clampWidgetViewport(widget);
}

function getWidgetViewConfig(widget) {
  return WIDGET_VIEW_PRESETS[widget.viewMode] || WIDGET_VIEW_PRESETS.wealth;
}

function getWidgetMetricOptions(widget) {
  if (widget.viewMode === "custom") {
    return Object.entries(METRIC_GROUPS)
      .filter(([groupKey]) => groupKey !== "custom")
      .flatMap(([, config]) => config.metrics);
  }
  return [...getWidgetViewConfig(widget).inlineMetrics];
}

function applyWidgetViewMode(widget, nextViewMode) {
  widget.viewMode = nextViewMode;
  widget.metrics = [...getWidgetViewConfig(widget).defaultMetrics];
}

function clampWidgetViewport(widget) {
  const maxIndex = getChartMaxIndex(widget);
  widget.viewStartIndex = Math.max(0, Math.min(widget.viewStartIndex ?? 0, maxIndex));
  if ((widget.viewStartIndex ?? 0) === 0 && (widget.viewEndIndex ?? 0) === 0 && maxIndex > 0) {
    widget.viewEndIndex = Math.min(widget.defaultEndIndex ?? maxIndex, maxIndex);
  }
  widget.viewEndIndex = Math.max(widget.viewStartIndex, Math.min(widget.viewEndIndex ?? maxIndex, maxIndex));
}

function getWidgetRows(widget) {
  const rows = getHorizonRows().slice(0, getChartMaxIndex(widget) + 1);
  if (!widget) return rows;
  clampWidgetViewport(widget);
  return rows.slice(widget.viewStartIndex, widget.viewEndIndex + 1);
}

function getWidgetSeries(widget) {
  const visibleSelectedSlots = getWidgetEligibleSlots().filter((slot) => widget.selectedSlotIds.includes(slot.slotId));
  const slots = widget.metrics.length > 1 && visibleSelectedSlots.length > 1 ? [visibleSelectedSlots[0]] : visibleSelectedSlots;
  const startIndex = widget.viewStartIndex ?? 0;
  const endIndex = (widget.viewEndIndex ?? state.horizonYearIndex) + 1;
  const series = [];

  widget.metrics.forEach((metric) => {
    slots.forEach((slot) => {
      const result = state.previewResults[slot.slotId];
      const pathName = getPathDisplayName(slot);
      if (!result) return;
      const values = metric === "cumulativeNetCashFlow"
        ? buildCumulativeSeries(result.projection)
        : result.projection.map((row) => row[metric]);
      const compareAcrossPaths = widget.metrics.length <= 1;
      const style = METRIC_STYLES[metric] || { color: COLOR_STYLES.slate, fillAlpha: 0.08 };
      const color = compareAcrossPaths ? COLOR_STYLES[slot.colorToken] || COLOR_STYLES.slate : style.color;
      series.push({
        slotId: slot.slotId,
        slotLabel: pathName,
        pathTitle: pathName,
        label: `${pathName} · ${METRIC_LABELS[metric]}`,
        color,
        metric,
        tone: METRIC_GROUP_BY_METRIC[metric],
        fillAlpha: compareAcrossPaths ? 0 : style.fillAlpha,
        lineWidth: compareAcrossPaths ? 2.5 : 2.15,
        values: values.slice(startIndex, endIndex),
      });
    });
  });

  return series;
}

function renderWidgetLegend(widget) {
  const visibleSlots = getWidgetEligibleSlots();
  if (!visibleSlots.length) return `<div class="muted-text">No paths currently available for visuals.</div>`;
  return visibleSlots.map((slot) => `
    <button
      class="legend-chip ${widget.selectedSlotIds.includes(slot.slotId) ? "is-active" : "is-inactive"} ${widget.hoverSlotId === slot.slotId ? "is-hovered" : ""}"
      data-widget-legend-slot="${widget.id}"
      data-slot-id="${slot.slotId}"
      title="${escapeHtml(slot.slotLabel)}"
    >
      <span class="legend-swatch" style="background:${COLOR_STYLES[slot.colorToken] || COLOR_STYLES.slate}"></span>
      ${escapeHtml(getPathDisplayName(slot))}
    </button>
  `).join("");
}

function handleWidgetPointerMove(widget, canvas, event) {
  if (widget.isPanning) return;
  const rect = canvas.getBoundingClientRect();
  const rows = getWidgetRows(widget);
  if (!rows.length) return;
  const dpr = window.devicePixelRatio || 1;
  const logicalWidth = canvas.width / dpr;
  const logicalHeight = canvas.height / dpr;
  const ratioX = logicalWidth / rect.width;
  const ratioY = logicalHeight / rect.height;
  const x = (event.clientX - rect.left) * ratioX;
  const y = (event.clientY - rect.top) * ratioY;
  const paddingLeft = 56;
  const paddingRight = 26;
  const chartWidth = logicalWidth - paddingLeft - paddingRight;
  const relativeX = Math.max(0, Math.min(chartWidth, x - paddingLeft));
  const hoveredIndex = Math.round((relativeX / Math.max(chartWidth, 1)) * Math.max(rows.length - 1, 0));
  widget.hoverIndex = hoveredIndex;
  widget.hoverCanvasY = y;
  drawWidgetChart(canvas, widget);
}

function handleWidgetPointerLeave(widget, canvas) {
  widget.hoverIndex = null;
  widget.hoverCanvasY = null;
  widget.hoverSlotId = null;
  drawWidgetChart(canvas, widget);
}

function handleWidgetWheel(widget, canvas, event) {
  if (!event.ctrlKey) {
    return;
  }
  event.preventDefault();
  const rows = getWidgetRows(widget);
  if (!rows.length) return;
  const currentLength = Math.max(2, widget.viewEndIndex - widget.viewStartIndex + 1);
  const direction = event.deltaY > 0 ? 1 : -1;
  const maxIndex = getChartMaxIndex(widget);
  const nextLength = Math.max(
    CHART_INTERACTION.minVisibleRows,
    Math.min(maxIndex + 1, currentLength + direction * CHART_INTERACTION.wheelZoomStep),
  );
  const rect = canvas.getBoundingClientRect();
  const logicalWidth = canvas.width / (window.devicePixelRatio || 1);
  const ratio = logicalWidth / rect.width;
  const x = (event.clientX - rect.left) * ratio;
  const anchorRatio = Math.max(0, Math.min(1, (x - 56) / Math.max(logicalWidth - 82, 1)));
  const anchorIndex = widget.viewStartIndex + Math.round(anchorRatio * Math.max(currentLength - 1, 0));
  let nextStart = Math.round(anchorIndex - anchorRatio * Math.max(nextLength - 1, 0));
  nextStart = Math.max(0, Math.min(nextStart, maxIndex - nextLength + 1));
  widget.viewStartIndex = nextStart;
  widget.viewEndIndex = Math.min(maxIndex, nextStart + nextLength - 1);
  drawWidgetChart(canvas, widget);
}

function handleWidgetPanStart(widget, canvas, event) {
  if (event.button !== 0) return;
  widget.isPanning = true;
  widget.panAnchorX = event.clientX;
  widget.panAnchorStart = widget.viewStartIndex;
  widget.panAnchorEnd = widget.viewEndIndex;
}

function handleWidgetPanMove(widget, canvas, event) {
  if (!widget.isPanning) return;
  const rect = canvas.getBoundingClientRect();
  const currentLength = Math.max(2, widget.panAnchorEnd - widget.panAnchorStart + 1);
  const pixelsPerIndex = (rect.width / Math.max(currentLength, 1)) * CHART_INTERACTION.panPixelsPerIndexFactor;
  const deltaIndices = Math.round((event.clientX - widget.panAnchorX) / Math.max(pixelsPerIndex, 1));
  let nextStart = widget.panAnchorStart - deltaIndices;
  nextStart = Math.max(0, Math.min(nextStart, getChartMaxIndex(widget) - currentLength + 1));
  widget.viewStartIndex = nextStart;
  widget.viewEndIndex = Math.min(getChartMaxIndex(widget), nextStart + currentLength - 1);
  drawWidgetChart(canvas, widget);
}

function stepWidgetZoom(widget, step) {
  const currentLength = Math.max(CHART_INTERACTION.minVisibleRows, widget.viewEndIndex - widget.viewStartIndex + 1);
  const maxIndex = getChartMaxIndex(widget);
  const nextLength = Math.max(
    CHART_INTERACTION.minVisibleRows,
    Math.min(maxIndex + 1, currentLength + step * CHART_INTERACTION.manualZoomStep),
  );
  const centerIndex = widget.viewStartIndex + Math.floor(currentLength / 2);
  let nextStart = centerIndex - Math.floor(nextLength / 2);
  nextStart = Math.max(0, Math.min(nextStart, maxIndex - nextLength + 1));
  widget.viewStartIndex = nextStart;
  widget.viewEndIndex = Math.min(maxIndex, nextStart + nextLength - 1);
}

function stepWidgetPan(widget, step) {
  const currentLength = Math.max(CHART_INTERACTION.minVisibleRows, widget.viewEndIndex - widget.viewStartIndex + 1);
  const maxIndex = getChartMaxIndex(widget);
  let nextStart = widget.viewStartIndex + step * CHART_INTERACTION.manualPanStep;
  nextStart = Math.max(0, Math.min(nextStart, maxIndex - currentLength + 1));
  widget.viewStartIndex = nextStart;
  widget.viewEndIndex = Math.min(maxIndex, nextStart + currentLength - 1);
}

function getWidgetHoverState(widget, series, geometry) {
  const { padding, chartHeight, height, minValue, maxValue } = geometry;
  const hoverIndex = Math.max(0, Math.min(widget.hoverIndex, (series[0]?.values.length || 1) - 1));
  const targetY = widget.hoverCanvasY ?? (padding.top + chartHeight / 2);
  let nearest = null;

  series.forEach((item) => {
    const value = item.values[hoverIndex];
    const normalized = (value - minValue) / (maxValue - minValue || 1);
    const y = height - padding.bottom - normalized * chartHeight;
    const distance = Math.abs(y - targetY);
    if (!nearest || distance < nearest.distance) {
      nearest = { ...item, y, distance };
    }
  });

  return nearest;
}

function syncWidgetLegendState(widget) {
  document.querySelectorAll(`[data-widget-legend-slot="${widget.id}"], [data-v4-chart-legend="${widget.id}"]`).forEach((element) => {
    const isActive = widget.selectedSlotIds.includes(element.dataset.slotId);
    const isHovered = widget.hoverSlotId === element.dataset.slotId;
    element.classList.toggle("is-active", isActive);
    element.classList.toggle("is-inactive", !isActive);
    element.classList.toggle("is-hovered", isHovered);
  });
}

function drawWidgetCrosshair(context, widget, series, rows, geometry, hoverState, visualTheme = getChartTheme()) {
  const { width, padding, chartWidth, chartHeight, minValue, maxValue } = geometry;
  const hoverIndex = Math.max(0, Math.min(widget.hoverIndex, rows.length - 1));
  const x = padding.left + (chartWidth / Math.max(rows.length - 1, 1)) * hoverIndex;

  context.save();
  context.strokeStyle = visualTheme.crosshair;
  context.setLineDash([6, 6]);
  context.beginPath();
  context.moveTo(x, padding.top);
  context.lineTo(x, padding.top + chartHeight);
  context.stroke();
  context.restore();

  const tooltipLines = series.map((item) => {
    const value = item.values[hoverIndex];
    return {
      text: `${item.label}: ${formatCompactCurrency(value)}`,
      active: item.slotId === hoverState?.slotId,
      color: item.color,
      value,
    };
  });
  series.forEach((item) => {
    const value = item.values[hoverIndex];
    const normalized = (value - minValue) / (maxValue - minValue || 1);
    const y = padding.top + chartHeight - normalized * chartHeight;
    context.save();
    const isActiveSlot = !hoverState || item.slotId === hoverState.slotId;
    context.fillStyle = isActiveSlot ? item.color : applyAlpha(item.color, 0.28);
    context.beginPath();
    context.arc(x, y, isActiveSlot ? 5.4 : 3.6, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });

  const tooltipWidth = 230;
  const tooltipXRaw = x > width * 0.62 ? x - tooltipWidth - 14 : x + 14;
  const tooltipX = Math.max(12, Math.min(tooltipXRaw, width - tooltipWidth - 12));
  const tooltipY = padding.top + 12;
  const tooltipHeight = 42 + tooltipLines.length * 18;
  context.fillStyle = visualTheme.tooltipBg;
  roundRect(context, tooltipX, tooltipY, tooltipWidth, tooltipHeight, 12);
  context.fill();
  context.fillStyle = hoverState?.color || visualTheme.tooltipText;
  context.font = "600 12px Avenir Next";
  context.fillText(
    hoverState ? (hoverState.pathTitle || hoverState.slotLabel) : "Visible paths",
    tooltipX + 12,
    tooltipY + 18,
  );
  context.fillStyle = visualTheme.tooltipText;
  context.font = "12px Avenir Next";
  context.fillText(`${rows[hoverIndex].calendarYear} · Age ${rows[hoverIndex].age}`, tooltipX + 12, tooltipY + 36);
  tooltipLines.forEach((line, index) => {
    context.fillStyle = line.active ? visualTheme.tooltipText : visualTheme.tooltipMuted;
    context.font = line.active ? "600 12px Avenir Next" : "12px Avenir Next";
    context.fillText(line.text, tooltipX + 12, tooltipY + 54 + index * 18);
  });
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function slotCanProject(slot) {
  return Boolean(slot.loaded && slot.draft && isLegacyPathTemplateId(slot.draft.pathTemplateId));
}

function moveSection(sectionKey, direction) {
  const list = state.dashboardSections.order;
  const index = list.indexOf(sectionKey);
  if (index < 0) return;
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= list.length) return;
  [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
}

function renderDashboardWithTransition() {
  if (typeof document.startViewTransition === "function") {
    document.startViewTransition(() => {
      renderCurrentScreen();
    });
    return;
  }
  renderCurrentScreen();
}

function configForSlot(slot) {
  return {
    slotId: slot.slotId,
    label: getPathDisplayName(slot),
    colorToken: slot.colorToken,
  };
}

function createBlankScenario(config) {
  const scenario = {
    id: `draft_${crypto.randomUUID().slice(0, 8)}`,
    name: config.label,
    displayName: "New Path",
    pathTemplateId: "PATH_A",
    enabled: true,
    notes: "",
    colorToken: config.colorToken,
    isLoaded: true,
    displayOrder: state.workspaceSlots.length,
    selectedCompanyId: null,
    selectedEmployerId: "CONSERVATIVE",
    selectedVaRatingId: "30",
    selectedPhdProgramId: "STAN-CS-PHD",
    useVa: true,
    useGiBill: true,
    overrides: {},
  };
  applyPathDependencies({ draft: scenario });
  scenario.routeSummary = buildRouteSummary(scenario);
  return scenario;
}

function nextDynamicSlotConfig() {
  const index = state.workspaceSlots.length;
  const letter = String.fromCharCode(65 + index);
  return {
    slotId: `slot_${crypto.randomUUID().slice(0, 8)}`,
    label: `Path ${letter}`,
    colorToken: COLOR_SEQUENCE[index % COLOR_SEQUENCE.length],
  };
}

function createEmptyWorkspaceSlot() {
  const config = nextDynamicSlotConfig();
  const scenario = createBlankScenario(config);
  const slot = createWorkspaceSlot(config, scenario);
  slot.title = "New Path";
  slot.sourceScenarioId = null;
  slot.originalFingerprint = scenarioFingerprint(slot.draft);
  return slot;
}

function prepareCanvas(canvas, widget) {
  const context = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const parentWidth = Math.max(320, Math.floor(canvas.parentElement?.clientWidth || 960));
  const logicalHeight = widget.size === "2x2" ? 460 : 360;
  if (canvas.width !== Math.floor(parentWidth * dpr) || canvas.height !== Math.floor(logicalHeight * dpr)) {
    canvas.width = Math.floor(parentWidth * dpr);
    canvas.height = Math.floor(logicalHeight * dpr);
    canvas.style.width = `${parentWidth}px`;
    canvas.style.height = `${logicalHeight}px`;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.imageSmoothingEnabled = true;
  return { context, width: parentWidth, height: logicalHeight, dpr };
}

function applyAlpha(hexColor, alpha) {
  const safe = hexColor.replace("#", "");
  const normalized = safe.length === 3 ? safe.split("").map((value) => `${value}${value}`).join("") : safe;
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function openAddPathModal() {
  const modalRoot = document.getElementById("modalRoot");
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div>
          <p class="panel-eyebrow">Add Path</p>
          <h3>Add a saved path or start a new blank one</h3>
          <p class="support-copy">A new path box appears in the workspace without deleting or replacing any stored scenario data.</p>
        </div>
        <div class="modal-actions">
          <button class="primary" id="createEmptyPathBtn">Create New Blank Path</button>
          <button class="ghost" id="closeAddPathModalBtn">Cancel</button>
        </div>
        <div class="saved-list">
          ${state.savedScenarios.map((scenario) => renderSavedScenarioOption(scenario, {
            "data-add-saved-scenario": scenario.id,
          })).join("")}
        </div>
      </div>
    </div>
  `;

  modalRoot.querySelector("#createEmptyPathBtn").addEventListener("click", async () => {
    const slot = createEmptyWorkspaceSlot();
    state.workspaceSlots.push(slot);
    state.previewSettings.selectedSlotIds = uniqueSlotIds([...state.previewSettings.selectedSlotIds, slot.slotId]);
    state.explorerSettings.selectedSlotIds = uniqueSlotIds([...state.explorerSettings.selectedSlotIds, slot.slotId]);
    state.dashboardV2Settings.selectedSlotIds = uniqueSlotIds([...state.dashboardV2Settings.selectedSlotIds, slot.slotId]);
    state.dashboardV4.preview.selectedSlotIds = uniqueSlotIds([...state.dashboardV4.preview.selectedSlotIds, slot.slotId]);
    state.editorSlotId = slot.slotId;
    modalRoot.innerHTML = "";
    renderDashboardWithTransition();
  });
  modalRoot.querySelector("#closeAddPathModalBtn").addEventListener("click", () => {
    modalRoot.innerHTML = "";
  });
  modalRoot.querySelectorAll("[data-add-saved-scenario]").forEach((button) => {
    button.addEventListener("click", async () => {
      const scenario = state.savedScenarios.find((item) => item.id === button.dataset.addSavedScenario);
      const config = nextDynamicSlotConfig();
      const slot = createWorkspaceSlot(config, scenario);
      state.workspaceSlots.push(slot);
      state.previewSettings.selectedSlotIds = uniqueSlotIds([...state.previewSettings.selectedSlotIds, slot.slotId]);
      state.explorerSettings.selectedSlotIds = uniqueSlotIds([...state.explorerSettings.selectedSlotIds, slot.slotId]);
      state.dashboardV2Settings.selectedSlotIds = uniqueSlotIds([...state.dashboardV2Settings.selectedSlotIds, slot.slotId]);
      state.dashboardV4.preview.selectedSlotIds = uniqueSlotIds([...state.dashboardV4.preview.selectedSlotIds, slot.slotId]);
      syncSelectionState();
      modalRoot.innerHTML = "";
      await loadPreviewResults();
    });
  });
}

function renderTestLab() {
  const lab = document.getElementById("test-lab");
  const slots = getTestVisualSlots();
  const lead = slots[0] ?? null;
  lab.innerHTML = `
    <div class="test-lab-grid">
      <article class="panel">
        <div class="panel-header">
          <div>
            <p class="panel-eyebrow">Sandbox</p>
            <h3>Test Visuals</h3>
            <p class="support-copy">These are read-only design experiments driven by the current live planner projections. They do not edit dashboard widgets, path drafts, or saved scenarios.</p>
          </div>
        </div>
      </article>
      ${TEST_VISUAL_DESIGNS.map((design) => renderTestVisualSection(design, slots, lead)).join("")}
    </div>
  `;
  drawTestVisualCharts(slots);
}

function renderTestVisualSection(design, slots, lead) {
  if (design.id === "analyst_core") {
    return `
      <article class="panel test-visual-section analyst-core">
        <div class="test-visual-header">
          <div>
            <p class="panel-eyebrow">Analyst Core</p>
            <h3>${design.nickname}</h3>
            <p class="support-copy">${design.summary}</p>
          </div>
          <div class="test-visual-note">Question: Which loaded path produces the strongest long-range wealth result with the cleanest year-by-year comparison?</div>
        </div>
        <div class="test-summary-row">
          ${slots.map((item) => `
            <div class="test-summary-card">
              <span class="legend-swatch" style="background:${COLOR_STYLES[item.slot.colorToken] || COLOR_STYLES.slate}"></span>
              <div>
                <div class="slot-label">${escapeHtml(getPathDisplayName(item.slot))}</div>
                <strong>${formatCompactCurrency(item.result.metrics.finalPortfolio)}</strong>
              </div>
            </div>
          `).join("")}
        </div>
        <div class="test-visual-chart-block">
          <canvas id="test-analyst-line"></canvas>
        </div>
        <div class="test-visual-bars">
          ${renderTestBarRows(slots, "finalPortfolio")}
        </div>
      </article>
    `;
  }

  if (design.id === "story_stack") {
    return `
      <article class="panel test-visual-section story-stack">
        <div class="test-visual-header">
          <div>
            <p class="panel-eyebrow">Story Stack</p>
            <h3>${design.nickname}</h3>
            <p class="support-copy">${design.summary}</p>
          </div>
          <div class="test-story-lead">${buildStoryLead(slots, lead)}</div>
        </div>
        <div class="test-visual-chart-block">
          <canvas id="test-story-line"></canvas>
        </div>
        <div class="test-story-grid">
          <div class="test-story-card">
            <p class="panel-eyebrow">Takeaway</p>
            <h4>${lead ? `${escapeHtml(getPathDisplayName(lead.slot))} leads the long-horizon outcome.` : "Load paths to compare."}</h4>
            <p class="support-copy">This version prioritizes the headline first, then shows the supporting trajectory underneath.</p>
          </div>
          <div class="test-story-card">
            <p class="panel-eyebrow">Waterfall</p>
            <canvas id="test-story-waterfall"></canvas>
          </div>
        </div>
      </article>
    `;
  }

  if (design.id === "strict_tufte") {
    return `
      <article class="panel test-visual-section strict-tufte">
        <div class="test-visual-header">
          <div>
            <p class="panel-eyebrow">Strict Tufte</p>
            <h3>${design.nickname}</h3>
            <p class="support-copy">${design.summary}</p>
          </div>
          <div class="test-visual-note">Question: What does the planner show with the least ornament possible?</div>
        </div>
        <div class="test-visual-chart-block minimal">
          <canvas id="test-tufte-line"></canvas>
        </div>
        <div class="test-visual-bars minimal">
          ${renderTestBarRows(slots, "totalNetCashFlow")}
        </div>
      </article>
    `;
  }

  return `
    <article class="panel test-visual-section codex-signature">
      <div class="test-visual-header">
        <div>
          <p class="panel-eyebrow">Codex Signature</p>
          <h3>${design.nickname}</h3>
          <p class="support-copy">${design.summary}</p>
        </div>
        <div class="test-visual-note">Question: How can a calm dashboard keep the most useful metrics, trend context, and ranking in view together?</div>
      </div>
      <div class="test-signature-grid">
        <div class="test-visual-chart-block">
          <canvas id="test-signature-line"></canvas>
        </div>
        <div class="test-signature-side">
          ${slots.map((item) => `
            <div class="test-signature-card">
              <div class="slot-label">${escapeHtml(getPathDisplayName(item.slot))}</div>
              <strong>${formatCompactCurrency(item.result.metrics.finalPortfolio)}</strong>
              <div class="muted-text">Net cash: ${formatCompactCurrency(item.result.metrics.totalNetCashFlow)}</div>
            </div>
          `).join("")}
        </div>
      </div>
    </article>
  `;
}

function getTestVisualSlots() {
  return getProjectableSlots()
    .map((slot) => ({ slot, result: state.previewResults[slot.slotId] }))
    .filter((item) => item.result)
    .sort((left, right) => right.result.metrics.finalPortfolio - left.result.metrics.finalPortfolio);
}

function renderTestBarRows(slotResults, metricKey) {
  if (!slotResults.length) return `<div class="notice">Load projectable paths to populate this design.</div>`;
  const maxValue = Math.max(...slotResults.map((item) => item.result.metrics[metricKey] || 0), 1);
  return slotResults.map((item) => `
    <div class="test-bar-row">
      <div class="test-bar-label">${escapeHtml(getPathDisplayName(item.slot))}</div>
      <div class="test-bar-track">
        <div class="test-bar-fill" style="width:${((item.result.metrics[metricKey] || 0) / maxValue) * 100}%; background:${COLOR_STYLES[item.slot.colorToken] || COLOR_STYLES.slate}"></div>
      </div>
      <div class="test-bar-value">${formatCompactCurrency(item.result.metrics[metricKey] || 0)}</div>
    </div>
  `).join("");
}

function buildStoryLead(slotResults, lead) {
  if (!lead || slotResults.length < 2) {
    return "Load at least two projectable paths to generate the narrative comparison.";
  }
  const runnerUp = slotResults[1];
  const spread = lead.result.metrics.finalPortfolio - runnerUp.result.metrics.finalPortfolio;
  return `${escapeHtml(getPathDisplayName(lead.slot))} finishes ahead by ${formatCompactCurrency(spread)} at the current horizon.`;
}

function drawTestVisualCharts(slotResults) {
  drawTestLineCanvas("test-analyst-line", slotResults, "portfolio", { minimal: false, fill: true });
  drawTestLineCanvas("test-story-line", slotResults, "netCashFlow", { minimal: false, fill: false });
  drawTestWaterfallCanvas("test-story-waterfall", slotResults[0]);
  drawTestLineCanvas("test-tufte-line", slotResults, "portfolio", { minimal: true, fill: false });
  drawTestLineCanvas("test-signature-line", slotResults, "portfolio", { minimal: false, fill: true });
}

function drawTestLineCanvas(canvasId, slotResults, metric, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const geometry = prepareStandaloneCanvas(canvas, options.minimal ? 240 : 290);
  const rows = getHorizonRows().slice(0, state.horizonYearIndex + 1);
  const series = slotResults.map((item) => ({
    label: getPathDisplayName(item.slot),
    color: COLOR_STYLES[item.slot.colorToken] || COLOR_STYLES.slate,
    values: (metric === "cumulativeNetCashFlow"
      ? buildCumulativeSeries(item.result.projection)
      : item.result.projection.map((row) => row[metric])).slice(0, state.horizonYearIndex + 1),
    fillAlpha: options.fill ? 0.08 : 0,
    lineWidth: options.minimal ? 1.5 : 2.3,
  }));
  drawLineChart(canvas, series, { hoverIndex: null }, geometry);
  if (options.minimal) {
    geometry.context.fillStyle = "#1f2a36";
    geometry.context.font = "12px Avenir Next";
    series.forEach((item, index) => {
      geometry.context.fillText(item.label, 18 + index * 92, 18);
    });
  }
}

function drawTestWaterfallCanvas(canvasId, leadItem) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !leadItem) return;
  const { context, width, height } = prepareStandaloneCanvas(canvas, 220);
  const stages = [
    { label: "Income", value: leadItem.result.metrics.totalGrossIncome, color: GROUP_COLOR_STYLES.income[0] },
    { label: "Taxes", value: -leadItem.result.metrics.totalTaxes, color: GROUP_COLOR_STYLES.taxes[0] },
    { label: "Health", value: -leadItem.result.metrics.totalHealthcareCost, color: GROUP_COLOR_STYLES.expenses[1] },
    { label: "Net", value: leadItem.result.metrics.totalNetCashFlow, color: GROUP_COLOR_STYLES.wealth[0] },
  ];
  const values = stages.map((stage) => stage.value);
  const maxAbs = Math.max(...values.map((value) => Math.abs(value)), 1);
  const barWidth = 60;
  const gap = 22;
  stages.forEach((stage, index) => {
    const normalized = Math.abs(stage.value) / maxAbs;
    const barHeight = normalized * 120;
    const x = 24 + index * (barWidth + gap);
    const y = stage.value >= 0 ? 150 - barHeight : 150;
    context.fillStyle = stage.color;
    context.fillRect(x, y, barWidth, barHeight);
    context.fillStyle = "#1f2a36";
    context.font = "11px Avenir Next";
    context.fillText(stage.label, x, 192);
  });
}

function prepareStandaloneCanvas(canvas, logicalHeight) {
  const context = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const logicalWidth = Math.max(320, Math.floor(canvas.parentElement?.clientWidth || 960));
  if (canvas.width !== Math.floor(logicalWidth * dpr) || canvas.height !== Math.floor(logicalHeight * dpr)) {
    canvas.width = Math.floor(logicalWidth * dpr);
    canvas.height = Math.floor(logicalHeight * dpr);
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.imageSmoothingEnabled = true;
  context.clearRect(0, 0, logicalWidth, logicalHeight);
  return { context, width: logicalWidth, height: logicalHeight, dpr };
}

function moveWidget(sourceId, targetId) {
  if (!sourceId || sourceId === targetId) return;
  const sourceIndex = state.widgets.findIndex((widget) => widget.id === sourceId);
  const targetIndex = state.widgets.findIndex((widget) => widget.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return;
  const [widget] = state.widgets.splice(sourceIndex, 1);
  state.widgets.splice(targetIndex, 0, widget);
}

function nextWidgetSize(size) {
  if (size === "1x1") return "1x2";
  if (size === "1x2") return "2x2";
  return "1x1";
}

function uniqueSlotIds(ids) {
  return [...new Set(ids)];
}

function syncSelectionState() {
  const loadedSlotIds = getLoadedSlots().map((slot) => slot.slotId);
  const projectableSlotIds = getProjectableSlots().map((slot) => slot.slotId);
  const fallbackSlotId = loadedSlotIds[0] ?? "slot_a";
  const baselineFallbackSlotId = projectableSlotIds[0] ?? fallbackSlotId;

  state.editorSlotId = loadedSlotIds.includes(state.editorSlotId) ? state.editorSlotId : fallbackSlotId;

  state.previewSettings.selectedSlotIds = state.previewSettings.selectedSlotIds.filter((id) => loadedSlotIds.includes(id));
  state.explorerSettings.selectedSlotIds = state.explorerSettings.selectedSlotIds.filter((id) => loadedSlotIds.includes(id));
  state.dashboardV2Settings.selectedSlotIds = state.dashboardV2Settings.selectedSlotIds.filter((id) => loadedSlotIds.includes(id));
  state.dashboardV4.preview.selectedSlotIds = state.dashboardV4.preview.selectedSlotIds.filter((id) => loadedSlotIds.includes(id));
  state.dashboardV4.highlightsSelectedSlotIds = uniqueSlotIds(
    state.dashboardV4.highlightsSelectedSlotIds.filter((id) => projectableSlotIds.includes(id)),
  ).slice(0, 3);

  if (!state.previewSettings.selectedSlotIds.length) {
    state.previewSettings.selectedSlotIds = [...loadedSlotIds];
  }
  if (!state.explorerSettings.selectedSlotIds.length) {
    state.explorerSettings.selectedSlotIds = [...loadedSlotIds];
  }
  if (!state.dashboardV2Settings.selectedSlotIds.length) {
    state.dashboardV2Settings.selectedSlotIds = [...loadedSlotIds];
  }
  if (!state.dashboardV4.preview.selectedSlotIds.length) {
    state.dashboardV4.preview.selectedSlotIds = [...loadedSlotIds];
  }
  if (!state.dashboardV4.highlightsSelectedSlotIds.length) {
    state.dashboardV4.highlightsSelectedSlotIds = buildDefaultHighlightsSelection();
  }
  if (!loadedSlotIds.includes(state.dashboardV2Settings.focusSlotId)) {
    state.dashboardV2Settings.focusSlotId = loadedSlotIds[0] ?? "slot_a";
  }

  if (!projectableSlotIds.includes(state.previewSettings.baselineSlotId)) {
    state.previewSettings.baselineSlotId = baselineFallbackSlotId;
  }
  if (!projectableSlotIds.includes(state.explorerSettings.baselineSlotId)) {
    state.explorerSettings.baselineSlotId = baselineFallbackSlotId;
  }

  state.explorerSettings.savedCustomVisibilityBySection = sanitizeExplorerCustomVisibility(
    state.explorerSettings.savedCustomVisibilityBySection,
  );
  state.explorerSettings.customVisibilityBySection = sanitizeExplorerCustomVisibility(
    state.explorerSettings.customVisibilityBySection,
  );

  state.widgets.forEach((widget) => {
    widget.selectedSlotIds = widget.selectedSlotIds.filter((slotId) => projectableSlotIds.includes(slotId) && !getSlot(slotId)?.hiddenFromVisuals);
    if (!widget.selectedSlotIds.length) {
      widget.selectedSlotIds = [...getWidgetEligibleSlots().map((slot) => slot.slotId)];
    }
    widget.metrics = widget.metrics.filter((metric) => getWidgetMetricOptions(widget).includes(metric));
    if (!widget.metrics.length) {
      widget.metrics = [...getWidgetViewConfig(widget).defaultMetrics];
    }
    clampWidgetViewport(widget);
  });

  state.dashboardV4.charts.forEach((chart) => {
    const validSlotIds = projectableSlotIds.filter((slotId) => !getSlot(slotId)?.hiddenFromVisuals);
    const newSlotIds = validSlotIds.filter((slotId) => !(chart.knownSlotIds || []).includes(slotId));
    chart.selectedSlotIds = chart.selectedSlotIds.filter((slotId) => validSlotIds.includes(slotId));
    chart.selectedSlotIds = uniqueSlotIds([...chart.selectedSlotIds, ...newSlotIds]);
    chart.knownSlotIds = [...validSlotIds];
    if (!chart.selectedSlotIds.length && validSlotIds.length) {
      chart.selectedSlotIds = [...validSlotIds];
    }
    chart.metrics = chart.metrics.filter((metric) => getWidgetMetricOptions(chart).includes(metric));
    if (!chart.metrics.length) {
      chart.metrics = [...getWidgetViewConfig(chart).defaultMetrics];
    }
    chart.maxHorizonIndex = Math.min(chart.maxHorizonIndex ?? state.dashboardV4.visualsHorizonYearIndex, getChartMaxIndex(chart));
    clampWidgetViewport(chart);
  });
}

function toggleArrayMember(list, value) {
  const index = list.indexOf(value);
  if (index >= 0) list.splice(index, 1);
  else list.push(value);
}

function formatMetricValue(metric, value) {
  if (metric === "phaseLabel") return value ?? "—";
  return currency.format(value ?? 0);
}

function formatCompactCurrency(value) {
  if (Math.abs(value) >= 1000000) {
    return `${value < 0 ? "-" : ""}$${(Math.abs(value) / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${value < 0 ? "-" : ""}$${Math.round(Math.abs(value) / 1000)}k`;
  }
  return currency.format(value ?? 0);
}

function formatDelta(value, kind = "currency") {
  if (kind === "percent") {
    const sign = value > 0 ? "+" : "";
    return `${sign}${(value * 100).toFixed(1)} pts`;
  }
  const rounded = Math.round(value);
  if (rounded > 0) return `+${currency.format(rounded)}`;
  return currency.format(rounded);
}

function formatReferenceCell(value) {
  if (typeof value === "number" && value >= 1000) return currency.format(value);
  if (typeof value === "number" && value > 0 && value < 1) return `${Math.round(value * 1000) / 10}%`;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value ?? "—";
}

function scenarioFingerprint(scenario) {
  return JSON.stringify({
    displayName: scenario.displayName,
    pathTemplateId: normalizeLegacyPathTemplateId(scenario.pathTemplateId),
    selectedCompanyId: scenario.selectedCompanyId,
    selectedEmployerId: scenario.selectedEmployerId,
    selectedVaRatingId: scenario.selectedVaRatingId,
    selectedPhdProgramId: scenario.selectedPhdProgramId,
    useVa: scenario.useVa,
    useGiBill: scenario.useGiBill,
    notes: scenario.notes,
    colorToken: scenario.colorToken,
    overrides: scenario.overrides || {},
  });
}

function hasDirtyWorkspace() {
  return state.workspaceSlots.some((slot) => slot.loaded && slot.dirty);
}

async function saveManualFinance() {
  await fetch("/api/manual-inputs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state.bootstrap.manualCashflowInputs),
  });
  await loadBootstrap();
  await loadPreviewResults();
}

async function postReferenceOverride(payload) {
  const response = await fetch("/api/reference-overrides", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  return {
    ok: response.ok && body.ok !== false,
    error: body.error,
    payload: body,
  };
}

async function saveReferenceOverride(domain, recordId, field, value, reset = false) {
  const result = await postReferenceOverride({ domain, recordId, field, value, reset });
  if (!result.ok) {
    window.alert(result.error || "Unable to save that override.");
    return;
  }
  await loadBootstrap();
  await loadPreviewResults();
  if (state.activeScreen === "reference") renderReferenceData();
  if (state.activeScreen === "sources") renderSources();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
