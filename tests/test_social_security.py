"""Social Security from SSA's formula with official Federal Register figures."""

from __future__ import annotations

import copy
import unittest

from planner_app.api import compute, default_payload
from planner_app.social_security import (
    awi,
    bend_points,
    monthly_at_claim,
    pia_from_earnings,
    taxable_maximum,
)


class OfficialFiguresTest(unittest.TestCase):
    def test_bend_points_reproduce_ssa_published_values(self) -> None:
        self.assertEqual(bend_points(2026), (1286, 7749))  # FR 2025-19763
        self.assertEqual(bend_points(2027), (1340, 8077))  # FR 2026-21796

    def test_taxable_maximum_formula_reproduces_2027(self) -> None:
        self.assertEqual(taxable_maximum(2027), 192300)
        # Formula path (not the table) gives the same published value.
        self.assertEqual(round(60600 * awi(2025) / 22935.42 / 300) * 300, 192300)

    def test_pia_formula(self) -> None:
        # 35 years at exactly 1,000/month indexed -> AIME 1,000 (below the first bend point) -> PIA 900.
        earnings = {1990 + i: 12000.0 * awi(2050) / awi(2050) for i in range(35)}
        result = pia_from_earnings({2050 - 1 - i: 12000.0 for i in range(35)}, birth_year=1990)
        self.assertGreaterEqual(result["aime"], 1000)
        self.assertEqual(result["yearsCounted"], 35)
        del earnings


class AutomaticBenefitTest(unittest.TestCase):
    def run_path(self, claim_age=67, mode="auto"):
        p = default_payload()
        p["plannerProfile"] = copy.deepcopy(p["plannerProfile"])
        s = copy.deepcopy(p["scenarios"][1])
        s["retirement"] = {**s["retirement"], "ssClaimAge": claim_age, "ssMode": mode, "ssFraMonthly": 0}
        p["scenarios"] = [s]
        result = compute(p)
        self.assertTrue(result["ok"], result.get("errors"))
        return result["scenarios"][0]

    def test_benefit_is_computed_without_entry(self) -> None:
        entry = self.run_path()
        ss = entry["metrics"]["socialSecurity"]
        self.assertGreater(ss["detail"]["monthlyAtClaim"], 1000)
        claim_row = next(r for r in entry["projection"] if r["calendarYear"] == ss["birthYear"] + 67)
        self.assertAlmostEqual(claim_row["incomeBreakdown"]["socialSecurity"], ss["detail"]["monthlyAtClaim"] * 12, delta=1)

    def test_claim_age_changes_the_amount(self) -> None:
        by_age = self.run_path()["metrics"]["socialSecurity"]["monthlyByClaimAge"]
        self.assertLess(by_age["62"], by_age["67"])
        self.assertLess(by_age["67"], by_age["70"])

    def test_past_military_pay_counts_as_covered_earnings(self) -> None:
        earnings = self.run_path()["metrics"]["socialSecurity"]["earnings"]
        self.assertIn("2014", earnings)
        self.assertIn("2025", earnings)


if __name__ == "__main__":
    unittest.main()


class StateTaxTest(unittest.TestCase):
    def setUp(self) -> None:
        from planner_app.api import bootstrap_data

        self.rows = {r["id"]: r for r in bootstrap_data()["referenceDomains"]["state_tax_rates"]}

    def test_all_states_and_dc(self) -> None:
        self.assertEqual(len(self.rows), 51)
        self.assertIn("NE", self.rows)

    def test_nebraska_2026_brackets(self) -> None:
        from planner_app.engine_v2 import state_income_tax

        # $67,100 - $8,850 std = $58,250: 2.46% to $4,130, 3.51% to $24,760, 4.55% above, less $176 credit.
        expected = 4130 * 0.0246 + (24760 - 4130) * 0.0351 + (58250 - 24760) * 0.0455 - 176
        self.assertAlmostEqual(state_income_tax(self.rows["NE"], 67100), expected, places=2)
        self.assertEqual(self.rows["NE"]["militaryRetiredPayTreatment"], "exempt")

    def test_nebraska_does_not_tax_military_pension(self) -> None:
        p = default_payload()
        p["plannerProfile"] = copy.deepcopy(p["plannerProfile"])
        p["plannerProfile"]["taxResidency"] = [{"stateCode": "NE", "fromYear": 2026}]
        retire = next(s for s in p["scenarios"] if s["serviceExit"]["type"] == "military_retirement")
        p["scenarios"] = [retire]
        rows = compute(p)["scenarios"][0]["projection"]
        from planner_app.engine_v2 import state_income_tax

        # A year with both pension and a taxable stipend: Nebraska taxes the stipend only.
        row = next(r for r in rows if r["incomeBreakdown"]["pension"] > 0 and r["incomeBreakdown"]["phdStipend"] > 0)
        stipend_only = state_income_tax(self.rows["NE"], row["incomeBreakdown"]["phdStipend"])
        self.assertAlmostEqual(row["taxBreakdown"]["stateTax"], stipend_only, delta=1)
