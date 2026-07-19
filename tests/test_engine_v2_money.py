"""Tests for the V2 money layer: income/benefits/taxes (Stage 3) and the
retirement lifecycle ledger (Stage 4)."""

from __future__ import annotations

import unittest

from planner_app.engine_v2 import (
    compare_scenarios_v2,
    derive_high3_pension,
    project_scenario_v2,
    salary_for_year,
)
from planner_app.migration_v2 import migrate_legacy_scenarios
from planner_app.reference_data import REFERENCE_DOMAINS, hydrate_military_reference_domains
from planner_app.reference_v2 import merge_v2_reference_domains
from planner_app.schema_v2 import ScenarioV2
from planner_app.seed_data import (
    MANUAL_CASHFLOW_SEED,
    PLANNER_PROFILE,
    REFERENCE_TABLES,
    SCENARIO_SEEDS,
)

MIGRATED = {s.id: s for s in migrate_legacy_scenarios(SCENARIO_SEEDS, PLANNER_PROFILE, REFERENCE_TABLES)}
DOMAINS = merge_v2_reference_domains(hydrate_military_reference_domains(REFERENCE_DOMAINS, PLANNER_PROFILE))


def project(scenario: ScenarioV2):
    return project_scenario_v2(scenario, PLANNER_PROFILE, REFERENCE_TABLES, MANUAL_CASHFLOW_SEED, REFERENCE_DOMAINS)


def find_year(rows, calendar_year):
    return next(row for row in rows if row["calendarYear"] == calendar_year)


class MigratedPathsRunTest(unittest.TestCase):
    def test_all_migrated_seeds_project_full_horizon(self) -> None:
        for scenario_id, scenario in MIGRATED.items():
            with self.subTest(scenario=scenario_id):
                rows, metrics = project(scenario)
                self.assertEqual(len(rows), PLANNER_PROFILE["projectionYears"])
                self.assertGreater(metrics["finalPortfolio"], 0)
                self.assertIn("finalPortfolioReal", metrics)

    def test_path_a_phase_sequence(self) -> None:
        rows, metrics = project(MIGRATED["scenario_path_a"])
        self.assertEqual(find_year(rows, 2030)["activityType"], "active_duty")
        self.assertEqual(find_year(rows, 2035)["activityType"], "grad_school")
        self.assertEqual(find_year(rows, 2041)["activityType"], "research_career")
        self.assertEqual(metrics["pensionStartYear"], 2035)


class PensionTest(unittest.TestCase):
    def test_high3_derivation_close_to_reference(self) -> None:
        info = derive_high3_pension(DOMAINS, PLANNER_PROFILE, 2034, 12)
        self.assertAlmostEqual(info["yearsServed"], 21.0, delta=0.1)
        # Reference seed says ~$43,596 at 20 years; derived uses actual schedule
        # and real completed years, so it lands nearby but not identical.
        self.assertGreater(info["annualAtRetirement"], 38000)
        self.assertLess(info["annualAtRetirement"], 55000)

    def test_pension_only_for_military_retirement(self) -> None:
        rows_b, metrics_b = project(MIGRATED["scenario_path_b"])
        self.assertEqual(metrics_b["pensionStartYear"], None)
        self.assertEqual(metrics_b["lifetimePensionValue"], 0.0)
        rows_a, metrics_a = project(MIGRATED["scenario_path_a"])
        self.assertGreater(metrics_a["lifetimePensionValue"], 1_000_000)

    def test_pension_grows_with_cola(self) -> None:
        rows, _ = project(MIGRATED["scenario_path_a"])
        p2036 = find_year(rows, 2036)["incomeBreakdown"]["pension"]
        p2046 = find_year(rows, 2046)["incomeBreakdown"]["pension"]
        self.assertGreater(p2046, p2036 * 1.2)


class GiBillLedgerTest(unittest.TestCase):
    def test_gi_bill_limited_to_36_months(self) -> None:
        rows, _ = project(MIGRATED["scenario_path_a"])
        gi_years = [row for row in rows if row["incomeBreakdown"]["giBillHousing"] > 0]
        self.assertEqual(len(gi_years), 3)  # 36 months = 3 school years
        self.assertEqual([row["calendarYear"] for row in gi_years], [2035, 2036, 2037])
        expected_mha = 4992.0 * 12
        self.assertAlmostEqual(gi_years[0]["incomeBreakdown"]["giBillHousing"], expected_mha, delta=1)

    def test_gi_bill_disabled_when_toggled_off(self) -> None:
        scenario = ScenarioV2.from_dict({**MIGRATED["scenario_path_a"].to_dict(), "useGiBill": False})
        rows, _ = project(scenario)
        self.assertTrue(all(row["incomeBreakdown"]["giBillHousing"] == 0 for row in rows))


class ProrationMoneyTest(unittest.TestCase):
    def test_mid_year_separation_blends_income(self) -> None:
        scenario = ScenarioV2.from_dict({
            "id": "mid", "name": "Mid-year",
            "serviceExit": {"type": "separation", "year": 2027, "month": 6},
            "blocks": [{"id": "tech", "type": "tech_career", "careerProfileId": "GENERIC_IC"}],
        })
        rows, _ = project(scenario)
        row = find_year(rows, 2027)
        breakdown = row["incomeBreakdown"]
        self.assertGreater(breakdown["militaryBasePay"], 0)
        self.assertGreater(breakdown["salaryBase"], 0)
        # Military half-year should be roughly half the 2027 schedule base pay.
        self.assertAlmostEqual(breakdown["militaryBasePay"], 68845.0104 / 2, delta=50)
        self.assertAlmostEqual(breakdown["salaryBase"], 117638 / 2, delta=50)


class EmployerMatchTest(unittest.TestCase):
    def test_match_accrues_on_work_years_into_traditional(self) -> None:
        rows, metrics = project(MIGRATED["scenario_path_b"])
        work_row = find_year(rows, 2030)
        self.assertGreater(work_row["employerMatch"], 0)
        self.assertGreater(work_row["accountBalances"]["trad401k"], 0)
        self.assertGreater(metrics["totalEmployerMatch"], 100_000)

    def test_no_match_during_active_duty_or_phd(self) -> None:
        rows, _ = project(MIGRATED["scenario_path_a"])
        self.assertEqual(find_year(rows, 2030)["employerMatch"], 0)
        self.assertEqual(find_year(rows, 2036)["employerMatch"], 0)


class MedicareTest(unittest.TestCase):
    def test_civilian_healthcare_switches_to_medicare_at_65(self) -> None:
        rows, _ = project(MIGRATED["scenario_path_b"])
        pre = find_year(rows, 2054)   # age 64 — civilian employer plan, ~26 yrs of 8% inflation
        post = find_year(rows, 2055)  # age 65 — Medicare baseline
        self.assertGreater(pre["healthcareCost"], 10_000)
        self.assertLess(post["healthcareCost"], pre["healthcareCost"] / 2)

    def test_military_retiree_stays_on_tricare(self) -> None:
        rows, _ = project(MIGRATED["scenario_path_a"])
        row = find_year(rows, 2056)
        self.assertLess(row["healthcareCost"], 1_000)  # TRICARE stays cheap


class RetirementLifecycleTest(unittest.TestCase):
    def make_retiring_scenario(self, fra_monthly=2500.0, claim_age=67) -> ScenarioV2:
        return ScenarioV2.from_dict({
            "id": "retire_path", "name": "Work then retire",
            "serviceExit": {"type": "separation", "year": 2027, "month": 12},
            "blocks": [
                {"id": "tech", "type": "tech_career", "careerProfileId": "GENERIC_IC", "durationMonths": 12 * 27},
                {"id": "retire", "type": "retire"},
            ],
            "retirement": {"socialSecurityEnabled": True, "ssFraMonthly": fra_monthly,
                            "ssClaimAge": claim_age, "withdrawalAgeYears": 59.5},
        })

    def test_social_security_starts_at_claim_age(self) -> None:
        rows, metrics = project(self.make_retiring_scenario())
        self.assertEqual(metrics["ssStartYear"], 2057)  # age 67
        row = find_year(rows, 2057)
        self.assertAlmostEqual(row["incomeBreakdown"]["socialSecurity"], 2500 * 12, delta=1)
        self.assertEqual(find_year(rows, 2056)["incomeBreakdown"]["socialSecurity"], 0)

    def test_early_claim_reduces_benefit(self) -> None:
        _, at67 = project(self.make_retiring_scenario(claim_age=67))
        _, at62 = project(self.make_retiring_scenario(claim_age=62))
        self.assertEqual(at62["ssStartYear"], 2052)
        self.assertLess(
            find_year(project(self.make_retiring_scenario(claim_age=62))[0], 2052)["incomeBreakdown"]["socialSecurity"],
            2500 * 12,
        )

    def test_drawdown_covers_retirement_spending(self) -> None:
        rows, metrics = project(self.make_retiring_scenario())
        retire_row = find_year(rows, 2056)  # retired, pre-SS: deficit covered by accounts
        w = retire_row["withdrawals"]
        total_withdrawn = w["cash"] + w["brokerage"] + w["trad401k"] + w["tspRoth"] + w["rothIra"]
        self.assertGreater(total_withdrawn, 0)
        self.assertEqual(retire_row["unfundedSpending"], 0)

    def test_rmd_applies_from_73(self) -> None:
        rows, _ = project(self.make_retiring_scenario())
        row72 = find_year(rows, 2062)
        row73 = find_year(rows, 2063)
        self.assertEqual(row72["rmd"], 0)
        self.assertGreater(row73["rmd"], 0)
        self.assertGreaterEqual(row73["withdrawals"]["trad401k"], row73["rmd"] * 0.999)

    def test_no_negative_balances_anywhere(self) -> None:
        for scenario in list(MIGRATED.values()) + [self.make_retiring_scenario()]:
            rows, _ = project(scenario)
            for row in rows:
                for key, balance in row["accountBalances"].items():
                    self.assertGreaterEqual(balance, -1e-6, f"{scenario.id} {row['calendarYear']} {key}")

    def test_real_dollar_factor_declines(self) -> None:
        rows, _ = project(MIGRATED["scenario_path_a"])
        self.assertAlmostEqual(rows[0]["realDollarFactor"], 1.0, places=6)
        self.assertLess(rows[-1]["realDollarFactor"], 0.35)


class LedgerIdentityTest(unittest.TestCase):
    def test_cash_flow_identity_on_accumulation_years(self) -> None:
        rows, _ = project(MIGRATED["scenario_path_b"])
        prior_total = None
        for row in rows[:20]:  # pre-73, surplus years: exact identity must hold
            balances = row["accountBalances"]
            total = sum(balances.values())
            if prior_total is not None:
                contrib = row["investmentBreakdown"]["contributions"]["totalContributions"]
                growth = row["investmentBreakdown"]["growth"]["portfolioGrowth"]
                w = row["withdrawals"]
                withdrawn = w["cash"] + w["brokerage"] + w["trad401k"] + w["tspRoth"] + w["rothIra"]
                expected = prior_total + growth + contrib - withdrawn
                self.assertAlmostEqual(total, expected, delta=1.0, msg=f"identity failed {row['calendarYear']}")
            prior_total = total


class ComparisonV2Test(unittest.TestCase):
    def test_comparison_surfaces_driver_and_breakeven(self) -> None:
        results = {}
        for scenario_id, scenario in MIGRATED.items():
            projection, metrics = project(scenario)
            results[scenario_id] = {"projection": projection, "metrics": metrics}
        comparison = compare_scenarios_v2(results, baseline_id="scenario_path_a")
        self.assertEqual(comparison["baselineScenarioId"], "scenario_path_a")
        self.assertEqual(len(comparison["comparisons"]), 2)
        for item in comparison["comparisons"]:
            self.assertIn("biggestDriver", item)
            self.assertIn(item["biggestDriver"]["label"],
                          {"Total income", "Taxes", "Healthcare", "Living costs", "Employer match"})


class PiecewiseCompTest(unittest.TestCase):
    def test_comp_segments_override_flat_growth(self) -> None:
        profile = {"baseSalary": 100000, "growthRate": 0.04,
                   "compSegments": [
                       {"fromYearInRole": 0, "toYearInRole": 2, "annualGrowthRate": 0.10},
                       {"fromYearInRole": 3, "toYearInRole": 100, "annualGrowthRate": 0.03},
                   ]}
        self.assertAlmostEqual(salary_for_year(profile, 0), 100000)
        self.assertAlmostEqual(salary_for_year(profile, 3), 100000 * 1.1**3, delta=1)
        self.assertAlmostEqual(salary_for_year(profile, 5), 100000 * 1.1**3 * 1.03**2, delta=1)

    def test_flat_growth_without_segments(self) -> None:
        profile = {"baseSalary": 100000, "growthRate": 0.04}
        self.assertAlmostEqual(salary_for_year(profile, 10), 100000 * 1.04**10, delta=1)


if __name__ == "__main__":
    unittest.main()
