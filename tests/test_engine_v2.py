"""Tests for the V2 engine timeline-resolution layer (per-year segments)."""

from __future__ import annotations

import unittest

from planner_app.engine_v2 import dominant_segment, resolve_year_segments
from planner_app.migration_v2 import migrate_legacy_scenario
from planner_app.schema_v2 import ScenarioV2
from planner_app.seed_data import PLANNER_PROFILE, REFERENCE_TABLES, SCENARIO_SEEDS

LEGACY = {seed["id"]: seed for seed in SCENARIO_SEEDS}


def single(scenario: ScenarioV2, year_index: int):
    segments = resolve_year_segments(scenario, PLANNER_PROFILE, year_index)
    assert len(segments) == 1, f"expected one segment, got {len(segments)}"
    return segments[0]


class PathAStateTest(unittest.TestCase):
    def setUp(self) -> None:
        self.scenario = migrate_legacy_scenario(LEGACY["scenario_path_a"], PLANNER_PROFILE, REFERENCE_TABLES)

    def test_active_duty_through_exit_year(self) -> None:
        self.assertEqual(single(self.scenario, 0).activity_type, "active_duty")
        self.assertEqual(single(self.scenario, 8).activity_type, "active_duty")  # exit is Dec 2034

    def test_phd_after_retirement(self) -> None:
        seg = single(self.scenario, 9)  # 2035
        self.assertEqual(seg.activity_type, "grad_school")
        self.assertEqual(seg.service_status, "military_retired")
        self.assertEqual(seg.phase_id, "retired_phd")
        self.assertEqual(seg.years_in_activity, 0)

    def test_research_with_pension_cola_counter(self) -> None:
        seg = single(self.scenario, 14)  # 2040
        self.assertEqual(seg.activity_type, "research_career")
        self.assertEqual(seg.service_status, "military_retired")
        self.assertEqual(seg.years_since_exit, 6)  # exit year index 8 -> 14-8


class PathBCStateTest(unittest.TestCase):
    def test_path_b_tech_after_separation(self) -> None:
        scenario = migrate_legacy_scenario(LEGACY["scenario_path_b"], PLANNER_PROFILE, REFERENCE_TABLES)
        self.assertEqual(single(scenario, 1).activity_type, "active_duty")
        seg = single(scenario, 2)
        self.assertEqual(seg.activity_type, "tech_career")
        self.assertEqual(seg.service_status, "separated")

    def test_path_c_gap_phd_research(self) -> None:
        scenario = migrate_legacy_scenario(LEGACY["scenario_path_c"], PLANNER_PROFILE, REFERENCE_TABLES)
        self.assertEqual(single(scenario, 2).activity_type, "gap")
        self.assertEqual(single(scenario, 3).phase_id, "phd_only")
        self.assertEqual(single(scenario, 8).activity_type, "research_career")


class ProrationTest(unittest.TestCase):
    def test_mid_year_separation_splits_year(self) -> None:
        scenario = ScenarioV2.from_dict(
            {
                "id": "mid",
                "name": "Mid-year",
                "serviceExit": {"type": "separation", "year": 2027, "month": 6},
                "blocks": [{"id": "tech", "type": "tech_career", "careerProfileId": "GENERIC_IC"}],
            }
        )
        segments = resolve_year_segments(scenario, PLANNER_PROFILE, 1)  # 2027 straddles the boundary
        self.assertEqual(len(segments), 2)
        by_type = {seg.activity_type: seg.months for seg in segments}
        self.assertEqual(by_type["active_duty"], 6)
        self.assertEqual(by_type["tech_career"], 6)
        self.assertEqual(sum(seg.months for seg in segments), 12)
        self.assertAlmostEqual(sum(seg.fraction for seg in segments), 1.0, places=6)

    def test_dominant_segment_picks_majority(self) -> None:
        scenario = ScenarioV2.from_dict(
            {
                "id": "mid",
                "name": "Mid-year",
                "serviceExit": {"type": "separation", "year": 2027, "month": 3},
                "blocks": [{"id": "tech", "type": "tech_career", "careerProfileId": "GENERIC_IC"}],
            }
        )
        segments = resolve_year_segments(scenario, PLANNER_PROFILE, 1)
        self.assertEqual(dominant_segment(segments).activity_type, "tech_career")  # 9 of 12 months


if __name__ == "__main__":
    unittest.main()
