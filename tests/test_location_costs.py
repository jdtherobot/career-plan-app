"""Tests: researched location cost-of-living drives living expenses by
school/company location, without double-counting the manual baseline."""

from __future__ import annotations

import unittest

from planner_app.engine_v2 import project_scenario_v2
from planner_app.migration_v2 import migrate_legacy_scenarios
from planner_app.reference_data import REFERENCE_DOMAINS, hydrate_military_reference_domains
from planner_app.reference_v2 import load_location_costs, merge_v2_reference_domains
from planner_app.schema_v2 import ScenarioV2
from planner_app.seed_data import (
    MANUAL_CASHFLOW_SEED,
    PLANNER_PROFILE,
    REFERENCE_TABLES,
    SCENARIO_SEEDS,
)

MIGRATED = {s.id: s for s in migrate_legacy_scenarios(SCENARIO_SEEDS, PLANNER_PROFILE, REFERENCE_TABLES)}
RESEARCH = load_location_costs()["locations"]


def project(scenario):
    return project_scenario_v2(scenario, PLANNER_PROFILE, REFERENCE_TABLES, MANUAL_CASHFLOW_SEED, REFERENCE_DOMAINS)


def find_year(rows, year):
    return next(r for r in rows if r["calendarYear"] == year)


class ResearchDataTest(unittest.TestCase):
    def test_all_15_locations_loaded_with_full_categories(self) -> None:
        self.assertEqual(len(RESEARCH), 15)
        for loc_id, data in RESEARCH.items():
            self.assertGreater(data["housingMonthly"], 0, loc_id)
            self.assertGreater(data["foodMonthly"], 0, loc_id)
            self.assertGreaterEqual(len(data["sources"]), 2, loc_id)

    def test_merged_domains_contain_new_employer_locations(self) -> None:
        domains = merge_v2_reference_domains(hydrate_military_reference_domains(REFERENCE_DOMAINS, PLANNER_PROFILE))
        location_ids = {loc["id"] for loc in domains["locations"]}
        for loc_id in ("redmond_wa", "mountain_view_ca", "santa_clara_ca", "san_francisco_ca", "us_metro_average"):
            self.assertIn(loc_id, location_ids)
        profile = next(p for p in domains["location_cost_profiles"] if p["locationId"] == "stanford_ca")
        self.assertEqual(profile["housingMonthly"], RESEARCH["stanford_ca"]["housingMonthly"])
        self.assertTrue(profile["sourceUrl"])


class ExpenseModelTest(unittest.TestCase):
    def test_active_duty_uses_manual_baseline_only(self) -> None:
        rows, _ = project(MIGRATED["scenario_path_a"])
        row0 = rows[0]  # 2026, active duty in Sacramento
        # Manual seed totals ~$2,394/mo; researched Sacramento market is ~$3,520/mo.
        self.assertLess(row0["livingExpenses"], 2394 * 12 * 1.05)
        self.assertAlmostEqual(row0["expenseBreakdown"]["housing"], 500 * 12, delta=60)

    def test_grad_school_uses_program_location_costs(self) -> None:
        rows, _ = project(MIGRATED["scenario_path_a"])  # Stanford PhD from 2035
        row = find_year(rows, 2035)
        stanford_housing_now = RESEARCH["stanford_ca"]["housingMonthly"] * 12
        # Grown by the location growth rate over 9 years, it must far exceed the $500 manual rent.
        self.assertGreater(row["expenseBreakdown"]["housing"], stanford_housing_now)
        self.assertGreater(row["livingExpenses"], row["expenseBreakdown"]["housing"])

    def test_company_location_drives_work_block_expenses(self) -> None:
        base = ScenarioV2.from_dict({
            "id": "loc_test", "name": "loc",
            "serviceExit": {"type": "separation", "year": 2027, "month": 12},
            "blocks": [{"id": "t", "type": "tech_career", "careerProfileId": "GOOG_SWE"}],
        })
        cheap = ScenarioV2.from_dict({
            **base.to_dict(), "id": "loc_test2",
            "blocks": [{"id": "t", "type": "tech_career", "careerProfileId": "INTEL_IC"}],
        })
        rows_mv, _ = project(base)     # Mountain View
        rows_sc, _ = project(cheap)    # Santa Clara
        mv_2030 = find_year(rows_mv, 2030)["livingExpenses"]
        sc_2030 = find_year(rows_sc, 2030)["livingExpenses"]
        self.assertGreater(mv_2030, sc_2030)  # Mountain View > Santa Clara
        # And both far above the on-base manual baseline.
        self.assertGreater(sc_2030, 2394 * 12)

    def test_no_double_counting_of_overlapping_categories(self) -> None:
        rows, _ = project(MIGRATED["scenario_path_b"])  # GENERIC_IC → us_metro_average
        row = find_year(rows, 2028)  # year_index 2 → two years of growth applied
        metro = RESEARCH["us_metro_average"]
        growth = metro["annualGrowthRate"]
        expected_housing = metro["housingMonthly"] * 12 * (1 + growth) ** 2  # replaces, not adds to, manual $500
        self.assertAlmostEqual(row["expenseBreakdown"]["housing"], expected_housing, delta=expected_housing * 0.02)

    def test_gifts_stay_personal(self) -> None:
        rows, _ = project(MIGRATED["scenario_path_b"])
        row = find_year(rows, 2028)
        growth = RESEARCH["us_metro_average"]["annualGrowthRate"]
        self.assertAlmostEqual(row["expenseBreakdown"]["gifts"], 300 * 12 * (1 + growth) ** 2, delta=40)


if __name__ == "__main__":
    unittest.main()
