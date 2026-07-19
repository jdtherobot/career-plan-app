"""Tests for the V2 composable timeline schema, validation, and resolution."""

from __future__ import annotations

import unittest

from planner_app.schema_v2 import (
    ScenarioV2,
    active_months_in_year,
    completed_service_years,
    month_to_year_month,
    resolve_timeline,
    validate_scenario,
)

PROFILE = {
    "baseYear": 2026,
    "serviceEntryYear": 2014,
    "serviceEntryMonth": 1,
    "projectionYears": 51,
    "startAge": 36,
}


def make_scenario(**overrides) -> ScenarioV2:
    data = {
        "id": "s",
        "name": "Test",
        "serviceExit": {"type": "separation", "year": 2027, "month": 12},
        "blocks": [{"id": "b1", "type": "tech_career", "careerProfileId": "GENERIC_IC"}],
    }
    data.update(overrides)
    return ScenarioV2.from_dict(data)


class TimelineResolutionTest(unittest.TestCase):
    def test_separation_path_resolves_active_duty_then_career(self) -> None:
        scenario = make_scenario()
        resolved = resolve_timeline(PROFILE, scenario)
        self.assertEqual([b.type for b in resolved], ["active_duty_separate", "tech_career"])
        active, career = resolved
        self.assertEqual((active.start_month_index, active.end_month_index), (0, 23))
        self.assertEqual((active.end_year, active.end_month), (2027, 12))
        self.assertEqual((career.start_year, career.start_month), (2028, 1))
        self.assertEqual(career.end_month_index, 51 * 12 - 1)  # terminal fills horizon

    def test_military_retirement_phd_research(self) -> None:
        scenario = make_scenario(
            serviceExit={"type": "military_retirement", "year": 2034, "month": 12},
            blocks=[
                {"id": "phd", "type": "grad_school", "programId": "STAN-CS-PHD", "durationMonths": 60},
                {"id": "rs", "type": "research_career", "careerProfileId": "CONSERVATIVE"},
            ],
        )
        resolved = resolve_timeline(PROFILE, scenario)
        self.assertEqual([b.type for b in resolved], ["active_duty_retire", "grad_school", "research_career"])
        _, phd, rs = resolved
        self.assertEqual((phd.start_year, phd.start_month), (2035, 1))
        self.assertEqual(phd.duration_months, 60)
        self.assertEqual((phd.end_year, phd.end_month), (2039, 12))
        self.assertEqual((rs.start_year, rs.start_month), (2040, 1))

    def test_gap_then_phd_then_research(self) -> None:
        scenario = make_scenario(
            blocks=[
                {"id": "gap", "type": "gap", "durationMonths": 12},
                {"id": "phd", "type": "grad_school", "programId": "STAN-CS-PHD", "durationMonths": 60},
                {"id": "rs", "type": "research_career", "careerProfileId": "CONSERVATIVE"},
            ],
        )
        resolved = resolve_timeline(PROFILE, scenario)
        self.assertEqual([b.type for b in resolved], ["active_duty_separate", "gap", "grad_school", "research_career"])


class ValidationTest(unittest.TestCase):
    def test_valid_scenario_has_no_errors(self) -> None:
        self.assertEqual(validate_scenario(PROFILE, make_scenario()), [])

    def test_military_retirement_before_20_years_rejected(self) -> None:
        scenario = make_scenario(serviceExit={"type": "military_retirement", "year": 2027, "month": 12})
        errors = validate_scenario(PROFILE, scenario)
        self.assertTrue(any("20 years" in e for e in errors), errors)

    def test_retire_block_must_be_last(self) -> None:
        scenario = make_scenario(
            blocks=[
                {"id": "r", "type": "retire"},
                {"id": "t", "type": "tech_career", "careerProfileId": "GENERIC_IC"},
            ],
        )
        errors = validate_scenario(PROFILE, scenario)
        self.assertTrue(any("final block" in e for e in errors), errors)

    def test_grad_school_requires_program(self) -> None:
        scenario = make_scenario(blocks=[{"id": "p", "type": "grad_school"}])
        errors = validate_scenario(PROFILE, scenario)
        self.assertTrue(any("school selection" in e for e in errors), errors)

    def test_work_block_requires_career_profile(self) -> None:
        scenario = make_scenario(blocks=[{"id": "t", "type": "tech_career"}])
        errors = validate_scenario(PROFILE, scenario)
        self.assertTrue(any("company/employer" in e for e in errors), errors)

    def test_non_terminal_block_needs_duration(self) -> None:
        scenario = make_scenario(
            blocks=[
                {"id": "gap", "type": "gap"},
                {"id": "t", "type": "tech_career", "careerProfileId": "GENERIC_IC"},
            ],
        )
        errors = validate_scenario(PROFILE, scenario)
        self.assertTrue(any("positive duration" in e for e in errors), errors)

    def test_over_tiling_beyond_horizon_rejected(self) -> None:
        scenario = make_scenario(
            blocks=[
                {"id": "gap", "type": "gap", "durationMonths": 12 * 60},
                {"id": "t", "type": "tech_career", "careerProfileId": "GENERIC_IC"},
            ],
        )
        errors = validate_scenario(PROFILE, scenario)
        self.assertTrue(any("horizon" in e for e in errors), errors)

    def test_resolve_timeline_raises_on_invalid(self) -> None:
        scenario = make_scenario(serviceExit={"type": "military_retirement", "year": 2027, "month": 12})
        with self.assertRaises(ValueError):
            resolve_timeline(PROFILE, scenario)


class MonthMathTest(unittest.TestCase):
    def test_month_to_year_month_roundtrip(self) -> None:
        self.assertEqual(month_to_year_month(0, 2026), (2026, 1))
        self.assertEqual(month_to_year_month(23, 2026), (2027, 12))
        self.assertEqual(month_to_year_month(24, 2026), (2028, 1))

    def test_completed_service_years(self) -> None:
        self.assertAlmostEqual(completed_service_years(PROFILE, 2033, 12), 20.0, places=2)
        self.assertLess(completed_service_years(PROFILE, 2027, 11), 20.0)

    def test_active_months_in_year(self) -> None:
        scenario = make_scenario()
        active, career = resolve_timeline(PROFILE, scenario)
        self.assertEqual(active_months_in_year(active, 1), 12)  # 2027 fully active
        self.assertEqual(active_months_in_year(career, 1), 0)   # career starts 2028
        self.assertEqual(active_months_in_year(career, 2), 12)  # 2028 fully career


if __name__ == "__main__":
    unittest.main()
