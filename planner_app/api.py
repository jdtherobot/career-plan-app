"""Pure JSON compute interface — the single entry point for every runtime.

Native Python (tests, CLI, exports) and the browser (Pyodide bridge) all call
`compute()` with the same JSON-shaped payload and get the same JSON-shaped
result, so parity between environments is testable by construction. The
deterministic `inputHash` embedded in results lets the UI and exports detect
drift between what was computed and what is displayed.
"""

from __future__ import annotations

import copy
import hashlib
import json
from typing import Any

from .engine_v2 import compare_scenarios_v2, project_scenario_v2
from .migration_v2 import migrate_legacy_scenarios
from .reference_data import REFERENCE_DOMAINS, hydrate_military_reference_domains
from .reference_v2 import merge_v2_reference_domains
from .schema_v2 import ScenarioV2, validate_scenario
from .seed_data import (
    MANUAL_CASHFLOW_SEED,
    PLANNER_PROFILE,
    REFERENCE_TABLES,
    SCENARIO_SEEDS,
)


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def input_hash(payload: dict[str, Any]) -> str:
    return hashlib.sha256(_canonical(payload).encode("utf-8")).hexdigest()


def default_payload() -> dict[str, Any]:
    """Seed payload: planner profile, migrated V2 scenarios, manual finance."""
    scenarios = migrate_legacy_scenarios(SCENARIO_SEEDS, PLANNER_PROFILE, REFERENCE_TABLES)
    return {
        "plannerProfile": PLANNER_PROFILE,
        "scenarios": [scenario.to_dict() for scenario in scenarios],
        "manualInputs": MANUAL_CASHFLOW_SEED,
        "baselineId": scenarios[0].id if scenarios else None,
    }


def bootstrap_data() -> dict[str, Any]:
    """Everything the frontend needs to render before any computation."""
    domains = merge_v2_reference_domains(
        hydrate_military_reference_domains(REFERENCE_DOMAINS, PLANNER_PROFILE)
    )
    return {
        "plannerProfile": PLANNER_PROFILE,
        "referenceDomains": domains,
        "referenceTables": REFERENCE_TABLES,
        "defaults": default_payload(),
    }


def validate(payload: dict[str, Any]) -> dict[str, Any]:
    """Validate every scenario; returns per-scenario actionable errors."""
    profile = payload.get("plannerProfile") or PLANNER_PROFILE
    errors: dict[str, list[str]] = {}
    for raw in payload.get("scenarios", []):
        try:
            scenario = ScenarioV2.from_dict(raw)
            scenario_errors = validate_scenario(profile, scenario)
        except (KeyError, TypeError, ValueError) as exc:
            scenario_errors = [f"Malformed scenario: {exc}"]
        if scenario_errors:
            errors[raw.get("id", "?")] = scenario_errors
    return {"ok": not errors, "errors": errors}


def apply_reference_overrides(
    overrides: list[dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Apply user overrides ({domain,id,field,value}) to copies of the catalogs.

    Overrides target either a reference domain record or a compatibility-table
    record (tech companies / research employers / phd programs). The originals
    are never mutated — the UI keeps original value + citation for the badge.
    """
    # Merge V2 domains first so overrides can target them too, then deep-copy so
    # module-level catalogs are never mutated.
    domains = copy.deepcopy(merge_v2_reference_domains(REFERENCE_DOMAINS))
    tables = copy.deepcopy(REFERENCE_TABLES)
    for override in overrides or []:
        domain = override.get("domain")
        record_id = override.get("id")
        field = override.get("field")
        value = override.get("value")
        if not domain or not record_id or not field:
            continue
        for catalog in (domains, tables):
            for record in catalog.get(domain, []):
                if record.get("id") == record_id and field in record:
                    record[field] = value
    return domains, tables


def compute(payload: dict[str, Any]) -> dict[str, Any]:
    """Project every enabled scenario in the payload and compare them."""
    profile = payload.get("plannerProfile") or PLANNER_PROFILE
    manual_inputs = payload.get("manualInputs") or MANUAL_CASHFLOW_SEED
    baseline_id = payload.get("baselineId")

    validation = validate(payload)
    if not validation["ok"]:
        return {"ok": False, "errors": validation["errors"], "inputHash": input_hash(payload)}

    domains, tables = apply_reference_overrides(payload.get("referenceOverrides") or [])

    results: dict[str, dict[str, Any]] = {}
    ordered: list[dict[str, Any]] = []
    for raw in payload.get("scenarios", []):
        scenario = ScenarioV2.from_dict(raw)
        if not scenario.enabled:
            continue
        projection, metrics = project_scenario_v2(
            scenario, profile, tables, manual_inputs, domains
        )
        entry = {
            "scenarioId": scenario.id,
            "scenarioName": scenario.display_name or scenario.name,
            "scenario": scenario.to_dict(),
            "projection": projection,
            "metrics": metrics,
        }
        results[scenario.id] = entry
        ordered.append(entry)

    comparison = compare_scenarios_v2(results, baseline_id=baseline_id)
    return {
        "ok": True,
        "scenarios": ordered,
        "comparison": comparison,
        "inputHash": input_hash(payload),
    }


def compute_json(payload_json: str) -> str:
    """String-in/string-out wrapper used by the Pyodide bridge."""
    return json.dumps(compute(json.loads(payload_json)))


def bootstrap_json() -> str:
    return json.dumps(bootstrap_data())
