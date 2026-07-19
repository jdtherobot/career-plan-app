"""Golden-master regression guard for the projection engine.

Locks the current engine output for the seeded A/B/C scenarios. Refactors that
are meant to preserve behavior (e.g. Stage 2 V2 migration, Stage 5 Pyodide
parity) must keep this green. When a change is *intentional*, regenerate with
`python3 tests/capture_golden.py` and record the diff in the delta report.
"""

from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from planner_app.engine import compare_scenarios, project_scenario
from planner_app.reference_data import REFERENCE_DOMAINS
from planner_app.seed_data import (
    MANUAL_CASHFLOW_SEED,
    PLANNER_PROFILE,
    REFERENCE_TABLES,
    SCENARIO_SEEDS,
)
from tests.capture_golden import build_golden, compute_input_hash

GOLDEN_DIR = Path(__file__).resolve().parent / "fixtures" / "golden"


def _canonical(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


class GoldenProjectionTest(unittest.TestCase):
    def setUp(self) -> None:
        if not (GOLDEN_DIR / "manifest.json").exists():
            self.skipTest("Golden fixtures missing; run python3 tests/capture_golden.py")
        self.manifest = json.loads((GOLDEN_DIR / "manifest.json").read_text(encoding="utf-8"))

    def test_input_hash_matches(self) -> None:
        self.assertEqual(
            compute_input_hash(),
            self.manifest["inputHash"],
            "Projection inputs changed; regenerate golden fixtures if this was intentional.",
        )

    def test_each_scenario_matches_golden(self) -> None:
        for seed in SCENARIO_SEEDS:
            with self.subTest(scenario=seed["id"]):
                fixture = json.loads((GOLDEN_DIR / f"{seed['id']}.json").read_text(encoding="utf-8"))
                projection, metrics = project_scenario(
                    copy.deepcopy(seed),
                    PLANNER_PROFILE,
                    REFERENCE_TABLES,
                    MANUAL_CASHFLOW_SEED,
                    REFERENCE_DOMAINS,
                )
                self.assertEqual(_canonical(projection), _canonical(fixture["projection"]))
                self.assertEqual(_canonical(metrics), _canonical(fixture["metrics"]))

    def test_comparison_matches_golden(self) -> None:
        fixture = json.loads((GOLDEN_DIR / "comparison.json").read_text(encoding="utf-8"))
        self.assertEqual(_canonical(build_golden()["comparison"]), _canonical(fixture))


if __name__ == "__main__":
    unittest.main()
