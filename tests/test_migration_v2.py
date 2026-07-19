"""Tests: legacy A/B/C scenarios migrate into valid V2 timelines."""

from __future__ import annotations

import unittest

from planner_app.migration_v2 import migrate_legacy_scenario, migrate_legacy_scenarios
from planner_app.schema_v2 import resolve_timeline, validate_scenario
from planner_app.seed_data import PLANNER_PROFILE, REFERENCE_TABLES, SCENARIO_SEEDS

LEGACY = {seed["id"]: seed for seed in SCENARIO_SEEDS}


class MigrationTest(unittest.TestCase):
    def test_all_seeds_migrate_to_valid_timelines(self) -> None:
        migrated = migrate_legacy_scenarios(SCENARIO_SEEDS, PLANNER_PROFILE, REFERENCE_TABLES)
        self.assertEqual(len(migrated), 3)
        for scenario in migrated:
            with self.subTest(scenario=scenario.id):
                self.assertEqual(validate_scenario(PLANNER_PROFILE, scenario), [])
                self.assertTrue(resolve_timeline(PLANNER_PROFILE, scenario))

    def test_path_a_military_retirement_phd_research(self) -> None:
        scenario = migrate_legacy_scenario(LEGACY["scenario_path_a"], PLANNER_PROFILE, REFERENCE_TABLES)
        self.assertEqual(scenario.service_exit.type, "military_retirement")
        self.assertEqual(scenario.service_exit.year, 2034)
        self.assertEqual([b.type for b in scenario.blocks], ["grad_school", "research_career"])
        self.assertEqual(scenario.blocks[0].program_id, "STAN-CS-PHD")
        self.assertEqual(scenario.blocks[0].duration_months, 60)  # 5-year program
        self.assertEqual(scenario.blocks[1].career_profile_id, "CONSERVATIVE")

    def test_path_b_separation_tech(self) -> None:
        scenario = migrate_legacy_scenario(LEGACY["scenario_path_b"], PLANNER_PROFILE, REFERENCE_TABLES)
        self.assertEqual(scenario.service_exit.type, "separation")
        self.assertEqual(scenario.service_exit.year, 2027)
        self.assertEqual([b.type for b in scenario.blocks], ["tech_career"])
        self.assertEqual(scenario.blocks[0].career_profile_id, "GENERIC_IC")

    def test_path_c_gap_phd_research(self) -> None:
        scenario = migrate_legacy_scenario(LEGACY["scenario_path_c"], PLANNER_PROFILE, REFERENCE_TABLES)
        self.assertEqual(scenario.service_exit.type, "separation")
        self.assertEqual([b.type for b in scenario.blocks], ["gap", "grad_school", "research_career"])
        self.assertEqual(scenario.blocks[0].duration_months, 12)

    def test_carries_metadata(self) -> None:
        scenario = migrate_legacy_scenario(LEGACY["scenario_path_a"], PLANNER_PROFILE, REFERENCE_TABLES)
        self.assertEqual(scenario.color_token, "sage")
        self.assertEqual(scenario.selected_va_rating_id, "30")
        self.assertTrue(scenario.use_gi_bill)
        self.assertEqual(scenario.display_name, "Path A")


if __name__ == "__main__":
    unittest.main()
