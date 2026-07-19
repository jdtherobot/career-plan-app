"""Tests for the JSON compute interface (native side of the Pyodide parity contract)."""

from __future__ import annotations

import json
import unittest

from planner_app.api import bootstrap_json, compute, compute_json, default_payload, validate


class ApiTest(unittest.TestCase):
    def test_default_payload_computes_three_paths(self) -> None:
        result = compute(default_payload())
        self.assertTrue(result["ok"])
        self.assertEqual(len(result["scenarios"]), 3)
        self.assertEqual(len(result["comparison"]["comparisons"]), 2)
        self.assertIn("inputHash", result)

    def test_input_hash_is_deterministic(self) -> None:
        a = compute(default_payload())
        b = compute(default_payload())
        self.assertEqual(a["inputHash"], b["inputHash"])
        self.assertEqual(
            json.dumps(a["comparison"], sort_keys=True),
            json.dumps(b["comparison"], sort_keys=True),
        )

    def test_invalid_scenario_returns_errors_not_results(self) -> None:
        payload = default_payload()
        payload["scenarios"][0]["serviceExit"] = {"type": "military_retirement", "year": 2027, "month": 12}
        result = compute(payload)
        self.assertFalse(result["ok"])
        self.assertIn("scenario_path_a", result["errors"])
        self.assertTrue(any("20 years" in e for e in result["errors"]["scenario_path_a"]))

    def test_validate_reports_malformed(self) -> None:
        result = validate({"scenarios": [{"id": "broken"}]})
        self.assertFalse(result["ok"])
        self.assertIn("broken", result["errors"])

    def test_json_roundtrip_wrappers(self) -> None:
        result = json.loads(compute_json(json.dumps(default_payload())))
        self.assertTrue(result["ok"])
        bootstrap = json.loads(bootstrap_json())
        self.assertIn("referenceDomains", bootstrap)
        self.assertIn("rmd_divisors", bootstrap["referenceDomains"])
        self.assertIn("defaults", bootstrap)

    def test_baseline_selection_respected(self) -> None:
        payload = default_payload()
        payload["baselineId"] = "scenario_path_b"
        result = compute(payload)
        self.assertEqual(result["comparison"]["baselineScenarioId"], "scenario_path_b")


if __name__ == "__main__":
    unittest.main()
