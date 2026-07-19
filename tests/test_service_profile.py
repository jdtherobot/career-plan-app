"""Tests: any-rank/TAFMS/location service profile drives standard 2026 pay."""

from __future__ import annotations

import copy
import unittest

from planner_app.engine_v2 import project_scenario_v2
from planner_app.reference_data import REFERENCE_DOMAINS, hydrate_military_reference_domains
from planner_app.reference_v2 import load_military_pay_2026
from planner_app.schema_v2 import ScenarioV2
from planner_app.seed_data import MANUAL_CASHFLOW_SEED, PLANNER_PROFILE, REFERENCE_TABLES

PAY = load_military_pay_2026()


def profile_with(service: dict) -> dict:
    profile = copy.deepcopy(PLANNER_PROFILE)
    profile["serviceProfile"] = service
    profile["serviceEntryYear"] = service.get("serviceEntryYear", profile["serviceEntryYear"])
    return profile


def schedule_row(profile: dict, year: int) -> dict:
    domains = hydrate_military_reference_domains(REFERENCE_DOMAINS, profile)
    return next(r for r in domains["military_compensation_projection_view"] if r["calendarYear"] == year)


class ServiceProfileHydrationTest(unittest.TestCase):
    def test_data_file_complete(self) -> None:
        self.assertEqual(len(PAY["basicPayMonthly"]), 27)
        self.assertGreater(PAY["basicPayMonthly"]["O-10"]["30"], PAY["basicPayMonthly"]["E-9"]["30"])
        self.assertEqual(len([v for v in PAY["bah"].values() if v]), 13)

    def test_e5_2026_matches_dfas_table(self) -> None:
        row = schedule_row(profile_with({"payGrade": "E-5", "serviceEntryYear": 2020, "serviceEntryMonth": 6,
                                         "dependents": True, "dutyLocationId": "sacramento_ca"}), 2026)
        # Entered mid-2020 → 6 completed YOS in 2026 → E-5 over-6 bracket.
        self.assertAlmostEqual(row["basePayAnnual"], PAY["basicPayMonthly"]["E-5"]["6"] * 12, delta=1)
        self.assertAlmostEqual(row["bahAnnual"], PAY["bah"]["sacramento_ca"]["withDependents"]["E-5"] * 12, delta=1)
        self.assertAlmostEqual(row["basAnnual"], PAY["basMonthly"]["enlisted"] * 12, delta=1)

    def test_officer_gets_officer_bas_and_o7_bah_cap(self) -> None:
        row = schedule_row(profile_with({"payGrade": "O-9", "serviceEntryYear": 2000,
                                         "dependents": False, "dutyLocationId": "pittsburgh_pa"}), 2026)
        self.assertAlmostEqual(row["basAnnual"], PAY["basMonthly"]["officer"] * 12, delta=1)
        self.assertAlmostEqual(row["bahAnnual"], PAY["bah"]["pittsburgh_pa"]["withoutDependents"]["O-7"] * 12, delta=1)

    def test_future_years_compound_the_raise(self) -> None:
        profile = profile_with({"payGrade": "E-5", "serviceEntryYear": 2024, "dutyLocationId": "seattle_wa"})
        r2026 = schedule_row(profile, 2026)
        r2028 = schedule_row(profile, 2028)
        # 2028 = (bracket may also step 2→4 YOS) — at minimum the raise applies.
        self.assertGreater(r2028["basePayAnnual"], r2026["basePayAnnual"] * 1.04)

    def test_overseas_location_falls_back_to_metro_average(self) -> None:
        row = schedule_row(profile_with({"payGrade": "E-6", "serviceEntryYear": 2016,
                                         "dependents": True, "dutyLocationId": "tokyo_jp"}), 2026)
        self.assertAlmostEqual(row["bahAnnual"], PAY["bah"]["us_metro_average"]["withDependents"]["E-6"] * 12, delta=1)

    def test_full_projection_runs_with_custom_profile(self) -> None:
        profile = profile_with({"payGrade": "E-5", "serviceEntryYear": 2020, "serviceEntryMonth": 6,
                                "dependents": True, "dutyLocationId": "sacramento_ca"})
        scenario = ScenarioV2.from_dict({
            "id": "visitor", "name": "Visitor path",
            "serviceExit": {"type": "separation", "year": 2030, "month": 6},
            "blocks": [{"id": "t", "type": "tech_career", "careerProfileId": "GENERIC_IC"}],
        })
        rows, metrics = project_scenario_v2(scenario, profile, REFERENCE_TABLES, MANUAL_CASHFLOW_SEED, REFERENCE_DOMAINS)
        self.assertEqual(len(rows), profile["projectionYears"])
        row0 = rows[0]
        self.assertAlmostEqual(row0["incomeBreakdown"]["militaryBasePay"], PAY["basicPayMonthly"]["E-5"]["6"] * 12, delta=1)
        self.assertGreater(metrics["finalPortfolio"], 0)

    def test_absent_service_profile_keeps_seeded_e7_schedule(self) -> None:
        row = schedule_row(copy.deepcopy(PLANNER_PROFILE), 2026)
        self.assertAlmostEqual(row["basePayAnnual"], 5591.70 * 12, delta=1)  # seeded E-7 @12 — golden-locked path


if __name__ == "__main__":
    unittest.main()
