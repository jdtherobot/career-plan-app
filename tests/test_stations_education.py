"""Duty-station timeline, overseas allowances, VA education benefits, the
year-by-year line layer, promotions and tax residency."""

from __future__ import annotations

import copy
import unittest

from planner_app.api import compute, default_payload
from planner_app.reference_v2 import load_military_pay_2026

PAY = load_military_pay_2026()


def payload(stations=None, blocks=None, exit_year=2030, overrides=None, profile_patch=None, scenario_patch=None):
    p = default_payload()
    p["plannerProfile"] = copy.deepcopy(p["plannerProfile"])
    p["plannerProfile"]["serviceProfile"] = {
        "payGrade": "E-7", "serviceEntryYear": 2014, "serviceEntryMonth": 2,
        "dependents": False, "dutyLocationId": "beale_afb_ca",
    }
    p["plannerProfile"].update(profile_patch or {})
    s = copy.deepcopy(p["scenarios"][1])
    s["serviceExit"] = {"type": "separation", "year": exit_year, "month": 12}
    s["stations"] = stations or []
    s["blocks"] = blocks or [{"id": "t", "type": "tech_career", "durationMonths": None, "careerProfileId": "GOOG_SWE"}]
    s["lineOverrides"] = overrides or {}
    s.update(scenario_patch or {})
    p["scenarios"] = [s]
    return p


def rows_of(p):
    result = compute(p)
    assert result["ok"], result.get("errors")
    return {row["calendarYear"]: row for row in result["scenarios"][0]["projection"]}


def line(row, line_id, key="value"):
    return row["lines"].get(line_id, {}).get(key, 0.0)


ALCONBURY = [
    {"id": "a", "locationId": "beale_afb_ca", "durationMonths": 12, "housing": "off_base"},
    {"id": "b", "locationId": "raf_alconbury_uk", "durationMonths": None, "housing": "off_base"},
]


class StationTimelineTest(unittest.TestCase):
    def test_stations_split_active_duty_and_pay_bah_then_oha(self) -> None:
        rows = rows_of(payload(ALCONBURY))
        beale_bah = PAY["bah"]["beale_afb_ca"]["withoutDependents"]["E-7"] * 12
        self.assertAlmostEqual(line(rows[2026], "bah"), beale_bah, delta=1)
        self.assertEqual(line(rows[2026], "oha"), 0.0)
        # Overseas: no BAH, OHA + UA + COLA instead.
        self.assertEqual(line(rows[2028], "bah"), 0.0)
        self.assertGreater(line(rows[2028], "oha"), 0)
        self.assertGreater(line(rows[2028], "ua"), 0)
        # COLA from DTMO's tables (index 130, spendable income by compensation band).
        self.assertGreater(line(rows[2028], "cola"), 0)
        self.assertNotEqual(rows[2028]["lines"]["cola"].get("status"), "missing_official_rate")

    def test_oha_nets_to_zero_against_rent_under_the_cap(self) -> None:
        rows = rows_of(payload(ALCONBURY))
        self.assertAlmostEqual(line(rows[2028], "oha"), line(rows[2028], "housing"), delta=1)
        self.assertEqual(rows[2028]["lines"]["housing"]["status"], "covered")

    def test_oha_is_the_full_dtmo_rate_and_all_goes_to_rent(self) -> None:
        stations = [{"id": "a", "locationId": "raf_alconbury_uk", "durationMonths": None, "housing": "off_base"}]
        rows = rows_of(payload(stations, exit_year=2027))
        full = 1627.20 / 0.7239 * 12  # DTMO E-7 w/o deps, $2,247.82/mo
        self.assertAlmostEqual(line(rows[2026], "oha"), full, delta=1)
        self.assertAlmostEqual(line(rows[2026], "housing"), full, delta=1)

    def test_missing_oha_holds_rent_and_oha_at_zero_and_flags_it(self) -> None:
        stations = [{"id": "a", "locationId": "raf_alconbury_uk", "durationMonths": None, "housing": "off_base"}]
        p = payload(stations, exit_year=2027)
        p["plannerProfile"]["serviceProfile"]["dependents"] = True  # E-7 with deps: not loaded
        rows = rows_of(p)
        self.assertEqual(line(rows[2026], "oha"), 0.0)
        self.assertEqual(line(rows[2026], "housing"), 0.0)
        self.assertEqual(rows[2026]["lines"]["housing"]["status"], "pending_official_rate")
        self.assertEqual(rows[2026]["lines"]["oha"]["status"], "missing_official_rate")

    def test_rent_above_cap_costs_the_difference_and_oha_follows_edits(self) -> None:
        rows = rows_of(payload(ALCONBURY, overrides={"housing": {"2028": 5000}}))
        housing = line(rows[2028], "housing")
        oha = line(rows[2028], "oha")
        self.assertAlmostEqual(housing, 60000, delta=1)
        self.assertLess(oha, housing)
        self.assertGreater(oha, 0)
        self.assertEqual(rows[2028]["lines"]["housing"]["status"], "partial")
        # The edit is recorded as overridden, the calculated value is kept.
        self.assertTrue(rows[2028]["lines"]["housing"]["overridden"])
        self.assertNotEqual(line(rows[2028], "housing", "calc"), housing)

    def test_on_base_means_no_housing_allowance_and_no_rent(self) -> None:
        stations = [{"id": "a", "locationId": "beale_afb_ca", "durationMonths": None, "housing": "on_base"}]
        rows = rows_of(payload(stations))
        self.assertEqual(line(rows[2027], "bah"), 0.0)
        self.assertEqual(line(rows[2027], "housing"), 0.0)
        self.assertEqual(rows[2027]["lines"]["housing"]["status"], "quarters")

    def test_mid_year_pcs_prorates_allowances(self) -> None:
        stations = [
            {"id": "a", "locationId": "beale_afb_ca", "durationMonths": 18, "housing": "off_base"},
            {"id": "b", "locationId": "raf_alconbury_uk", "durationMonths": None, "housing": "off_base"},
        ]
        rows = rows_of(payload(stations))
        self.assertAlmostEqual(line(rows[2027], "bah", "months"), 6, delta=0.01)
        self.assertAlmostEqual(line(rows[2027], "oha", "months"), 6, delta=0.01)

    def test_no_stations_keeps_previous_behaviour(self) -> None:
        rows = rows_of(payload([]))
        self.assertGreater(line(rows[2027], "bah"), 0)
        self.assertEqual(line(rows[2027], "oha"), 0.0)

    def test_station_after_exit_is_a_validation_error(self) -> None:
        stations = [
            {"id": "a", "locationId": "beale_afb_ca", "durationMonths": 120, "housing": "off_base"},
            {"id": "b", "locationId": "raf_alconbury_uk", "durationMonths": 12, "housing": "off_base"},
        ]
        result = compute(payload(stations, exit_year=2028))
        self.assertFalse(result["ok"])


class OfficialDtmoRatesTest(unittest.TestCase):
    """Golden values: DTMO OHA calculator, GB001 Alconbury, E-7 without
    dependents, pay period 2026-11-16 (rates and ROE effective 2026-07-01)."""

    ROE = 0.7239  # GBP per USD

    def test_e7_without_dependents_matches_dtmo(self) -> None:
        stations = [{"id": "a", "locationId": "raf_alconbury_uk", "durationMonths": None, "housing": "off_base"}]
        rows = rows_of(payload(stations, exit_year=2027))
        ua_monthly = rows[2026]["lines"]["ua"]["value"] / rows[2026]["lines"]["ua"]["months"]
        self.assertAlmostEqual(ua_monthly, 623.25 / self.ROE, delta=0.01)  # $860.96 per DTMO
        oha_note = " ".join(rows[2026]["lines"]["oha"]["notes"])
        self.assertIn("GBP 1,627.20", oha_note)
        self.assertIn("$2,248", oha_note)  # DTMO shows $2,247.82
        # MIHA once, in the first month at the station, netted by move-in costs.
        self.assertAlmostEqual(rows[2026]["lines"]["miha"]["value"], 502.00 / self.ROE, delta=0.01)  # $693.47
        self.assertAlmostEqual(rows[2026]["lines"]["moveIn"]["value"], rows[2026]["lines"]["miha"]["value"], delta=0.01)
        self.assertNotIn("miha", rows[2027]["lines"])

    def test_grade_without_official_rate_is_flagged_not_estimated(self) -> None:
        stations = [{"id": "a", "locationId": "raf_alconbury_uk", "durationMonths": None, "housing": "off_base"}]
        p = payload(stations, exit_year=2027)
        p["plannerProfile"]["serviceProfile"]["dependents"] = True  # E-7 WITH dependents: not loaded yet
        rows = rows_of(p)
        self.assertEqual(rows[2026]["lines"]["oha"]["value"], 0.0)
        self.assertEqual(rows[2026]["lines"]["oha"]["status"], "missing_official_rate")
        self.assertNotIn("ua", rows[2026]["lines"])

    def test_dependent_not_living_with_you_keeps_single_oha(self) -> None:
        """A dependent from 2034 who doesn't live with you: E-7 without-dependents
        OHA all tour (nothing missing), but family health coverage from 2034."""
        stations = [{"id": "a", "locationId": "raf_alconbury_uk", "durationMonths": None, "housing": "off_base"}]
        member = {"id": "d", "name": "Dependent", "dependent": True, "fromYear": 2034, "costs": []}
        p = payload(stations, exit_year=2034, profile_patch={"household": [member]})
        p["plannerProfile"]["serviceProfile"]["dependents"] = True  # household timeline wins over the flag
        rows = rows_of(p)
        for year in range(2026, 2035):
            self.assertNotEqual(rows[year]["lines"]["oha"].get("status"), "missing_official_rate", year)
            self.assertGreater(rows[year]["lines"]["oha"]["value"], 0, year)

    def test_dependent_living_with_you_uses_with_dependent_oha(self) -> None:
        stations = [{"id": "a", "locationId": "raf_alconbury_uk", "durationMonths": None, "housing": "off_base"}]
        member = {"id": "d", "name": "Dependent", "dependent": True, "fromYear": 2034, "livesWithYou": True, "costs": []}
        rows = rows_of(payload(stations, exit_year=2034, profile_patch={"household": [member]}))
        self.assertNotEqual(rows[2033]["lines"]["oha"].get("status"), "missing_official_rate")
        self.assertEqual(rows[2034]["lines"]["oha"]["status"], "missing_official_rate")
        self.assertTrue(any("E-7 with dependents" in n for n in rows[2034]["lines"]["oha"]["notes"]))

    def test_oha_override_fills_a_missing_row(self) -> None:
        stations = [{"id": "a", "locationId": "raf_alconbury_uk", "durationMonths": None, "housing": "off_base"}]
        p = payload(stations, exit_year=2027)
        p["plannerProfile"]["serviceProfile"]["dependents"] = True
        p["referenceOverrides"] = [
            {"domain": "oha_rates", "id": "raf_alconbury_uk:E-7:with", "field": "rentLocal", "value": 2000.0},
            {"domain": "oha_rates", "id": "raf_alconbury_uk:E-7:with", "field": "uaLocal", "value": 700.0},
        ]
        rows = rows_of(p)
        self.assertNotEqual(rows[2026]["lines"]["oha"].get("status"), "missing_official_rate")
        ua_monthly = rows[2026]["lines"]["ua"]["value"] / rows[2026]["lines"]["ua"]["months"]
        self.assertAlmostEqual(ua_monthly, 700.0 / self.ROE, delta=0.01)

    def test_no_bah_fallback_to_other_locations_or_grades(self) -> None:
        from planner_app.allowances import bah_monthly
        self.assertIsNone(bah_monthly(PAY, "nowhere_base", "E-7", False))
        self.assertIsNone(bah_monthly(PAY, "beale_afb_ca", "O-8", False))  # DTMO BAH tables stop at O-7
        self.assertEqual(bah_monthly(PAY, "beale_afb_ca", "E-7", True), 3150.0)  # DTMO bahw26.txt, CA033
        self.assertEqual(bah_monthly(PAY, "beale_afb_ca", "E-7", False), PAY["bah"]["beale_afb_ca"]["withoutDependents"]["E-7"])


class PromotionAndResidencyTest(unittest.TestCase):
    def test_promotion_raises_base_pay_from_its_month(self) -> None:
        base = rows_of(payload(ALCONBURY))
        p = payload(ALCONBURY)
        p["plannerProfile"]["serviceProfile"]["gradeHistory"] = [{"grade": "E-8", "year": 2028, "month": 7}]
        promoted = rows_of(p)
        self.assertEqual(line(base[2027], "basePay"), line(promoted[2027], "basePay"))
        self.assertGreater(line(promoted[2028], "basePay"), line(base[2028], "basePay"))
        self.assertGreater(line(promoted[2029], "basePay") - line(base[2029], "basePay"),
                           line(promoted[2028], "basePay") - line(base[2028], "basePay"))

    def test_no_income_tax_state_residency_zeroes_state_tax(self) -> None:
        ca = rows_of(payload(ALCONBURY, profile_patch={"taxResidency": [{"stateCode": "CA", "fromYear": 2026}]}))
        tx = rows_of(payload(ALCONBURY, profile_patch={"taxResidency": [{"stateCode": "TX", "fromYear": 2026}]}))
        self.assertGreater(ca[2027]["taxBreakdown"]["stateTax"], 0)
        self.assertEqual(tx[2027]["taxBreakdown"]["stateTax"], 0)


def grad_blocks(program_id, benefit, months=36, assume=False):
    block = {"id": "g", "type": "grad_school", "durationMonths": months, "programId": program_id,
             "benefit": benefit, "overrides": {"assumeVaApproved": True} if assume else {}}
    return [block, {"id": "t", "type": "tech_career", "durationMonths": None, "careerProfileId": "GOOG_SWE"}]


class EducationBenefitTest(unittest.TestCase):
    def test_gi_bill_caps_private_school_tuition(self) -> None:
        rows = rows_of(payload(blocks=grad_blocks("cmu-scs-mscs", "gi_bill", 24)))
        tuition = line(rows[2031], "tuitionFees")
        paid = line(rows[2031], "tuitionPaid")
        grown = 1.03 ** (2031 - 2026)  # tuition and the GI Bill cap grow 3%/yr from 2026
        self.assertAlmostEqual(tuition, 60400 * grown, delta=1)
        self.assertAlmostEqual(paid, 30908.34 * grown, delta=1)
        self.assertEqual(rows[2031]["lines"]["tuitionFees"]["status"], "partial")
        self.assertGreater(line(rows[2031], "giHousing"), 0)

    def test_gi_bill_pays_public_school_in_full(self) -> None:
        rows = rows_of(payload(blocks=grad_blocks("ucdavis-cs-ms", "gi_bill", 24)))
        self.assertAlmostEqual(line(rows[2031], "tuitionPaid"), line(rows[2031], "tuitionFees"), delta=1)

    def test_vre_pays_tuition_in_full_and_keeps_gi_bill_months(self) -> None:
        rows = rows_of(payload(blocks=grad_blocks("cmu-scs-mscs", "vre", 24)))
        self.assertAlmostEqual(line(rows[2031], "tuitionPaid"), line(rows[2031], "tuitionFees"), delta=1)
        self.assertGreater(line(rows[2031], "vreSubsistence"), 0)
        self.assertEqual(line(rows[2031], "giHousing"), 0)

    def test_vre_entitlement_is_reduced_by_gi_bill_months(self) -> None:
        blocks = [
            {"id": "g1", "type": "grad_school", "durationMonths": 36, "programId": "cmu-scs-mscs", "benefit": "gi_bill"},
            {"id": "g2", "type": "grad_school", "durationMonths": 24, "programId": "cmu-scs-mscs", "benefit": "vre"},
            {"id": "t", "type": "tech_career", "durationMonths": None, "careerProfileId": "GOOG_SWE"},
        ]
        rows = rows_of(payload(blocks=blocks))
        vre_months = sum(line(rows[y], "vreSubsistence", "months") for y in range(2034, 2037))
        self.assertAlmostEqual(vre_months, 12, delta=0.01)  # 48 - 36 GI Bill months

    def test_funded_phd_has_no_tuition_and_stipend_only_in_funded_years(self) -> None:
        rows = rows_of(payload(blocks=grad_blocks("stanford-cs-phd", "gi_bill", 72)))
        self.assertEqual(line(rows[2031], "tuitionFees"), 0)
        self.assertGreater(line(rows[2031], "stipend"), 0)
        self.assertGreater(line(rows[2035], "stipend"), 0)
        self.assertEqual(line(rows[2036], "stipend"), 0)  # year 6: beyond 5 funded years

    def test_unconfirmed_foreign_school_pays_nothing_unless_assumed(self) -> None:
        plain = rows_of(payload(blocks=grad_blocks("utokyo-ist-doctoral", "gi_bill")))
        assumed = rows_of(payload(blocks=grad_blocks("utokyo-ist-doctoral", "gi_bill", assume=True)))
        self.assertEqual(line(plain[2031], "giHousing"), 0)
        self.assertGreater(line(assumed[2031], "giHousing"), 0)

    def test_optional_funding_source_adds_stipend(self) -> None:
        blocks = grad_blocks("utokyo-ist-doctoral", "gi_bill")
        rows = rows_of(payload(blocks=blocks))
        self.assertEqual(line(rows[2031], "stipend"), 0)
        blocks[0]["fundingSourceId"] = "mext_japanese_government_scholarship_doc"
        funded = rows_of(payload(blocks=blocks))
        self.assertGreater(line(funded[2031], "stipend"), 0)
        self.assertEqual(line(funded[2031], "tuitionFees"), 0)  # MEXT waives tuition


class BlockSalaryTest(unittest.TestCase):
    def test_starting_salary_and_raise_override_the_preset(self) -> None:
        blocks = [{"id": "t", "type": "tech_career", "durationMonths": None, "careerProfileId": "GOOG_SWE",
                   "overrides": {"salaryStartAnnual": 120000, "salaryGrowthRate": 0.04}}]
        rows = rows_of(payload(blocks=blocks, exit_year=2026))
        start = 120000 * 1.035  # today's-dollar offer, indexed to the 2027 start
        self.assertAlmostEqual(line(rows[2027], "salary"), start, delta=1)
        self.assertAlmostEqual(line(rows[2029], "salary"), start * 1.04 ** 2, delta=1)
        preset = rows_of(payload(exit_year=2026))
        self.assertNotAlmostEqual(line(preset[2027], "salary"), 120000, delta=1)
        self.assertLess(rows[2029]["employerMatch"], preset[2029]["employerMatch"] * 2)


class SalaryStartYearTest(unittest.TestCase):
    def test_same_job_starting_later_starts_higher_by_wage_growth(self) -> None:
        blocks = lambda: [{"id": "t", "type": "research_career", "durationMonths": None, "careerProfileId": "CONSERVATIVE"}]  # noqa: E731
        early = rows_of(payload(blocks=blocks(), exit_year=2027))
        late = rows_of(payload(blocks=blocks(), exit_year=2033))
        first_early, first_late = line(early[2028], "salary"), line(late[2034], "salary")
        self.assertAlmostEqual(first_late / first_early, 1.035 ** 6, delta=1e-6)
        self.assertAlmostEqual(first_early, 150000 * 1.035 ** 2, delta=1)


class LineOverrideTest(unittest.TestCase):
    def test_overrides_flow_into_totals(self) -> None:
        base = rows_of(payload(ALCONBURY))
        edited = rows_of(payload(ALCONBURY, overrides={"food": {"2027": 1000}}))
        delta = line(edited[2027], "food") - line(base[2027], "food")
        self.assertAlmostEqual(edited[2027]["livingExpenses"] - base[2027]["livingExpenses"], delta, delta=1)
        self.assertAlmostEqual(base[2027]["netCashFlow"] - edited[2027]["netCashFlow"], delta, delta=1)

    def test_taxable_income_edit_moves_taxes(self) -> None:
        base = rows_of(payload(ALCONBURY))
        edited = rows_of(payload(ALCONBURY, overrides={"basePay": {"2027": 10000}}))
        self.assertGreater(edited[2027]["taxes"], base[2027]["taxes"])

    def test_household_member_costs_apply_in_their_years(self) -> None:
        household = [{"id": "m1", "name": "Partner", "fromYear": 2028, "toYear": 2029,
                      "costs": [{"id": "ins", "label": "Insurance", "monthly": 200, "category": "insurance"}]}]
        rows = rows_of(payload(ALCONBURY, profile_patch={"household": household}))
        self.assertEqual(line(rows[2027], "hh:m1:ins"), 0)
        self.assertAlmostEqual(line(rows[2028], "hh:m1:ins"), 2400 * 1.045 ** 2, delta=0.01)  # insurance CPI growth
        self.assertEqual(line(rows[2030], "hh:m1:ins"), 0)


if __name__ == "__main__":
    unittest.main()
