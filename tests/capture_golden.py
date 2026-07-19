"""Capture golden-master projections for the seeded A/B/C scenarios.

This freezes the CURRENT engine's output as a regression baseline before the
composable-engine rewrite. Re-run with `python3 tests/capture_golden.py` to
regenerate after an *intentional* behavior change (and record the diff in the
delta report).

The fixtures are consumed by tests/test_golden.py, which fails if the engine
output drifts from the captured baseline without a deliberate regeneration.
"""

from __future__ import annotations

import copy
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from planner_app.engine import compare_scenarios, project_scenario
from planner_app.reference_data import REFERENCE_DOMAINS
from planner_app.seed_data import (
    MANUAL_CASHFLOW_SEED,
    PLANNER_PROFILE,
    REFERENCE_TABLES,
    SCENARIO_SEEDS,
)

GOLDEN_DIR = Path(__file__).resolve().parent / "fixtures" / "golden"


def _canonical(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def compute_input_hash() -> str:
    """Deterministic hash of every input the projection depends on."""
    digest = hashlib.sha256()
    digest.update(_canonical(SCENARIO_SEEDS).encode("utf-8"))
    digest.update(_canonical(PLANNER_PROFILE).encode("utf-8"))
    digest.update(_canonical(REFERENCE_TABLES).encode("utf-8"))
    digest.update(_canonical(REFERENCE_DOMAINS).encode("utf-8"))
    digest.update(_canonical(MANUAL_CASHFLOW_SEED).encode("utf-8"))
    return digest.hexdigest()


def build_golden() -> dict[str, object]:
    projections_by_scenario: dict[str, dict[str, object]] = {}
    scenarios: dict[str, object] = {}
    for seed in SCENARIO_SEEDS:
        scenario = copy.deepcopy(seed)
        projection, metrics = project_scenario(
            scenario,
            PLANNER_PROFILE,
            REFERENCE_TABLES,
            MANUAL_CASHFLOW_SEED,
            REFERENCE_DOMAINS,
        )
        scenarios[seed["id"]] = {"projection": projection, "metrics": metrics}
        projections_by_scenario[seed["id"]] = {"projection": projection, "metrics": metrics}
    comparison = compare_scenarios(projections_by_scenario)
    return {
        "inputHash": compute_input_hash(),
        "scenarios": scenarios,
        "comparison": comparison,
    }


def write_golden() -> Path:
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    golden = build_golden()
    manifest = {"inputHash": golden["inputHash"], "scenarioIds": sorted(golden["scenarios"].keys())}
    (GOLDEN_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (GOLDEN_DIR / "comparison.json").write_text(json.dumps(golden["comparison"], indent=2) + "\n", encoding="utf-8")
    for scenario_id, payload in golden["scenarios"].items():
        (GOLDEN_DIR / f"{scenario_id}.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return GOLDEN_DIR


if __name__ == "__main__":
    path = write_golden()
    golden = build_golden()
    print(f"Golden fixtures written to {path}")
    print(f"Input hash: {golden['inputHash']}")
    for scenario_id, payload in golden["scenarios"].items():
        final = payload["metrics"]["finalPortfolio"]
        years = len(payload["projection"])
        print(f"  {scenario_id}: {years} years, final portfolio ${final:,.0f}")
