"""Migrate legacy PATH_A/B/C scenario dicts into V2 composable timelines.

The legacy model encodes a path as a template id (PATH_A/B/C) plus top-level
company/school/VA selectors. V2 encodes it as a service exit plus an ordered
list of month-resolution blocks with per-block company/school references. This
module performs that structural conversion so existing seeds and saved scenarios
carry forward without hand-editing.

Timing note: seed exits use year-end months for clean alignment with the legacy
annual boundaries; users set precise months in the Path Builder.
"""

from __future__ import annotations

from typing import Any

from .schema_v2 import Block, RetirementAssumptions, ScenarioV2, ServiceExit

DEFAULT_PROGRAM_DURATION_MONTHS = 60
DEFAULT_GAP_MONTHS = 12


def _program_duration_months(program_id: str | None, reference_tables: dict[str, list[dict[str, Any]]] | None) -> int:
    if not program_id or not reference_tables:
        return DEFAULT_PROGRAM_DURATION_MONTHS
    for program in reference_tables.get("phd_programs", []):
        if program.get("id") == program_id:
            years = program.get("durationYears")
            if years:
                return int(round(float(years) * 12))
    return DEFAULT_PROGRAM_DURATION_MONTHS


def _common_fields(legacy: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": legacy["id"],
        "name": legacy.get("name", legacy["id"]),
        "displayName": legacy.get("displayName"),
        "colorToken": legacy.get("colorToken"),
        "notes": legacy.get("notes", ""),
        "displayOrder": legacy.get("displayOrder", 0),
        "selectedVaRatingId": str(legacy.get("selectedVaRatingId", "30")),
        "useVa": bool(legacy.get("useVa", True)),
        "useGiBill": bool(legacy.get("useGiBill", True)),
        "overrides": dict(legacy.get("overrides", {})),
        "retirement": RetirementAssumptions().to_dict(),
    }


def migrate_legacy_scenario(
    legacy: dict[str, Any],
    profile: dict[str, Any],
    reference_tables: dict[str, list[dict[str, Any]]] | None = None,
) -> ScenarioV2:
    """Convert a legacy scenario dict into a validated-shape ScenarioV2."""
    template = legacy.get("pathTemplateId")
    separation_year = int(profile.get("plannedSeparationYear", 2027))
    retirement_year = int(profile.get("retirementEligibleYear", 2034))
    program_id = legacy.get("selectedPhdProgramId")
    program_months = _program_duration_months(program_id, reference_tables)

    common = _common_fields(legacy)

    if template == "PATH_A":
        exit = ServiceExit(type="military_retirement", year=retirement_year, month=12)
        blocks = [
            Block(id="grad_school", type="grad_school", duration_months=program_months, program_id=program_id),
            Block(id="research", type="research_career", career_profile_id=legacy.get("selectedEmployerId")),
        ]
    elif template == "PATH_B":
        exit = ServiceExit(type="separation", year=separation_year, month=12)
        blocks = [
            Block(id="tech", type="tech_career", career_profile_id=legacy.get("selectedCompanyId")),
        ]
    elif template == "PATH_C":
        exit = ServiceExit(type="separation", year=separation_year, month=12)
        blocks = [
            Block(id="gap", type="gap", duration_months=DEFAULT_GAP_MONTHS),
            Block(id="grad_school", type="grad_school", duration_months=program_months, program_id=program_id),
            Block(id="research", type="research_career", career_profile_id=legacy.get("selectedEmployerId")),
        ]
    else:
        # Unknown/custom template: a bare separation with a single terminal gap.
        exit = ServiceExit(type="separation", year=separation_year, month=12)
        blocks = [Block(id="gap", type="gap")]

    data = {**common, "serviceExit": exit.to_dict(), "blocks": [b.to_dict() for b in blocks]}
    return ScenarioV2.from_dict(data)


def migrate_legacy_scenarios(
    legacy_scenarios: list[dict[str, Any]],
    profile: dict[str, Any],
    reference_tables: dict[str, list[dict[str, Any]]] | None = None,
) -> list[ScenarioV2]:
    return [migrate_legacy_scenario(item, profile, reference_tables) for item in legacy_scenarios]
