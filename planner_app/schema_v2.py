"""V2 scenario/timeline schema: composable, month-resolution career paths.

The engine's current path model is hardcoded to PATH_A/B/C. This module defines
the replacement: a service profile plus an ordered list of contiguous blocks
(work / grad school / gap / retire) with month-level boundaries, derived start
and end from block order and duration, and *validation rather than silent
coercion* of invalid timelines.

This module is pure structure + validation + timeline resolution. It performs no
reference-data lookups and computes no dollars — the engine (Stage 3) consumes a
resolved timeline to attach benefits and money.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

BLOCK_TYPES = ("tech_career", "research_career", "grad_school", "gap", "retire")
WORK_BLOCK_TYPES = ("tech_career", "research_career")
EXIT_TYPES = ("military_retirement", "separation")
MIN_RETIREMENT_SERVICE_YEARS = 20
BASE_MONTH = 1  # projections start in January of the base year


def abs_month(year: int, month: int, base_year: int) -> int:
    """Absolute month index from the projection start (Jan of base_year = 0)."""
    return (year - base_year) * 12 + (month - BASE_MONTH)


def month_to_year_month(index: int, base_year: int) -> tuple[int, int]:
    year = base_year + (index + (BASE_MONTH - 1)) // 12
    month = (index + (BASE_MONTH - 1)) % 12 + 1
    return year, month


@dataclass
class ServiceExit:
    type: str  # "military_retirement" | "separation"
    year: int
    month: int = 12  # last full active-duty month; default end-of-year

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ServiceExit":
        return cls(type=data.get("type", ""), year=int(data["year"]), month=int(data.get("month", 12)))

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "year": self.year, "month": self.month}


@dataclass
class Block:
    id: str
    type: str
    duration_months: int | None = None  # None only for the horizon-filling terminal block
    career_profile_id: str | None = None
    program_id: str | None = None
    location_id: str | None = None
    overrides: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Block":
        duration = data.get("durationMonths")
        if duration is None and data.get("durationYears") is not None:
            duration = int(data["durationYears"]) * 12
        return cls(
            id=data.get("id", ""),
            type=data.get("type", ""),
            duration_months=int(duration) if duration is not None else None,
            career_profile_id=data.get("careerProfileId"),
            program_id=data.get("programId"),
            location_id=data.get("locationId"),
            overrides=dict(data.get("overrides", {})),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "durationMonths": self.duration_months,
            "careerProfileId": self.career_profile_id,
            "programId": self.program_id,
            "locationId": self.location_id,
            "overrides": self.overrides,
        }


@dataclass
class RetirementAssumptions:
    social_security_enabled: bool = True
    ss_fra_monthly: float = 0.0
    ss_claim_age: int = 67
    withdrawal_age_years: float = 59.5
    withdrawal_policy: str = "cover_gap"  # or "fixed_annual"
    fixed_annual_withdrawal: float = 0.0

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "RetirementAssumptions":
        data = data or {}
        return cls(
            social_security_enabled=bool(data.get("socialSecurityEnabled", True)),
            ss_fra_monthly=float(data.get("ssFraMonthly", 0.0) or 0.0),
            ss_claim_age=int(data.get("ssClaimAge", 67) or 67),
            withdrawal_age_years=float(data.get("withdrawalAgeYears", 59.5) or 59.5),
            withdrawal_policy=data.get("withdrawalPolicy", "cover_gap") or "cover_gap",
            fixed_annual_withdrawal=float(data.get("fixedAnnualWithdrawal", 0.0) or 0.0),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "socialSecurityEnabled": self.social_security_enabled,
            "ssFraMonthly": self.ss_fra_monthly,
            "ssClaimAge": self.ss_claim_age,
            "withdrawalAgeYears": self.withdrawal_age_years,
            "withdrawalPolicy": self.withdrawal_policy,
            "fixedAnnualWithdrawal": self.fixed_annual_withdrawal,
        }


@dataclass
class ScenarioV2:
    id: str
    name: str
    service_exit: ServiceExit
    blocks: list[Block] = field(default_factory=list)
    retirement: RetirementAssumptions = field(default_factory=RetirementAssumptions)
    display_name: str | None = None
    color_token: str | None = None
    notes: str = ""
    display_order: int = 0
    enabled: bool = True
    selected_va_rating_id: str = "30"
    use_va: bool = True
    use_gi_bill: bool = True
    overrides: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ScenarioV2":
        return cls(
            id=data["id"],
            name=data.get("name", data["id"]),
            service_exit=ServiceExit.from_dict(data["serviceExit"]),
            blocks=[Block.from_dict(block) for block in data.get("blocks", [])],
            retirement=RetirementAssumptions.from_dict(data.get("retirement", {})),
            display_name=data.get("displayName"),
            color_token=data.get("colorToken"),
            notes=data.get("notes", ""),
            display_order=int(data.get("displayOrder", 0) or 0),
            enabled=bool(data.get("enabled", True)),
            selected_va_rating_id=str(data.get("selectedVaRatingId", "30")),
            use_va=bool(data.get("useVa", True)),
            use_gi_bill=bool(data.get("useGiBill", True)),
            overrides=dict(data.get("overrides", {})),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "serviceExit": self.service_exit.to_dict(),
            "blocks": [block.to_dict() for block in self.blocks],
            "retirement": self.retirement.to_dict(),
            "displayName": self.display_name,
            "colorToken": self.color_token,
            "notes": self.notes,
            "displayOrder": self.display_order,
            "enabled": self.enabled,
            "selectedVaRatingId": self.selected_va_rating_id,
            "useVa": self.use_va,
            "useGiBill": self.use_gi_bill,
            "overrides": self.overrides,
        }


@dataclass
class ResolvedBlock:
    id: str
    type: str
    start_month_index: int
    end_month_index: int  # inclusive
    start_year: int
    start_month: int
    end_year: int
    end_month: int
    career_profile_id: str | None = None
    program_id: str | None = None
    location_id: str | None = None
    overrides: dict[str, Any] = field(default_factory=dict)

    @property
    def duration_months(self) -> int:
        return self.end_month_index - self.start_month_index + 1


def _horizon_months(profile: dict[str, Any]) -> int:
    return int(profile["projectionYears"]) * 12


def _entry_abs_month(profile: dict[str, Any]) -> int:
    return abs_month(
        int(profile["serviceEntryYear"]),
        int(profile.get("serviceEntryMonth", 1)),
        int(profile["baseYear"]),
    )


def completed_service_years(profile: dict[str, Any], exit_year: int, exit_month: int) -> float:
    base_year = int(profile["baseYear"])
    exit_abs = abs_month(exit_year, exit_month, base_year)
    months = exit_abs - _entry_abs_month(profile) + 1
    return months / 12.0


def validate_scenario(profile: dict[str, Any], scenario: ScenarioV2) -> list[str]:
    """Return a list of actionable validation errors (empty means valid)."""
    errors: list[str] = []
    base_year = int(profile["baseYear"])
    horizon = _horizon_months(profile)
    exit = scenario.service_exit

    if exit.type not in EXIT_TYPES:
        errors.append(f"Service exit type must be one of {EXIT_TYPES}, got '{exit.type}'.")
    if not (1 <= exit.month <= 12):
        errors.append(f"Separation month must be 1–12, got {exit.month}.")
    exit_abs = abs_month(exit.year, exit.month, base_year)
    if exit_abs < 0:
        errors.append(f"Separation ({exit.year}-{exit.month:02d}) is before the projection start ({base_year}).")
    if exit_abs > horizon - 1:
        errors.append(f"Separation ({exit.year}-{exit.month:02d}) is after the projection horizon.")

    if exit.type == "military_retirement":
        served = completed_service_years(profile, exit.year, exit.month)
        if served < MIN_RETIREMENT_SERVICE_YEARS:
            errors.append(
                f"Military retirement needs {MIN_RETIREMENT_SERVICE_YEARS} years of service; "
                f"only {served:.1f} completed by {exit.year}-{exit.month:02d}."
            )

    retire_indexes = [i for i, block in enumerate(scenario.blocks) if block.type == "retire"]
    if len(retire_indexes) > 1:
        errors.append("A path may contain at most one retire block.")
    if retire_indexes and retire_indexes[0] != len(scenario.blocks) - 1:
        errors.append("The retire block must be the final block in the path.")

    for position, block in enumerate(scenario.blocks):
        is_terminal = position == len(scenario.blocks) - 1
        if block.type not in BLOCK_TYPES:
            errors.append(f"Block '{block.id or position}' has unknown type '{block.type}'.")
        if block.type in WORK_BLOCK_TYPES and not block.career_profile_id:
            errors.append(f"{block.type} block '{block.id or position}' needs a company/employer selection.")
        if block.type == "grad_school" and not block.program_id:
            errors.append(f"Grad-school block '{block.id or position}' needs a school selection.")
        if not is_terminal:
            if block.duration_months is None or block.duration_months <= 0:
                errors.append(f"Block '{block.id or position}' needs a positive duration in whole months.")
        elif block.duration_months is not None and block.duration_months <= 0:
            errors.append(
                f"Block '{block.id or position}' needs a positive duration (or leave it unset to run to the horizon)."
            )

    # Contiguous tiling from the first post-service month. Every block may carry
    # a duration; a final block without one runs to the horizon, and a final
    # block WITH one leaves the remainder to an implicit retirement.
    cursor = exit_abs + 1
    for position, block in enumerate(scenario.blocks):
        is_terminal = position == len(scenario.blocks) - 1
        if is_terminal and block.duration_months is None:
            if cursor > horizon - 1:
                errors.append("Blocks extend beyond the projection horizon; shorten a duration.")
            break
        if block.duration_months and block.duration_months > 0:
            cursor += block.duration_months
            if cursor > horizon:
                errors.append("Blocks extend beyond the projection horizon; shorten a duration.")
                break

    return errors


def resolve_timeline(profile: dict[str, Any], scenario: ScenarioV2) -> list[ResolvedBlock]:
    """Resolve a scenario into contiguous month-indexed blocks.

    The synthetic leading active-duty block runs from the projection start to
    the service-exit month. Post-service blocks tile contiguously. A final
    block without a duration runs to the horizon; a final block WITH a duration
    ends when it says, and the remaining years become an implicit retirement
    (living off assets). Raises ValueError if the scenario is invalid.
    """
    errors = validate_scenario(profile, scenario)
    if errors:
        raise ValueError("; ".join(errors))

    base_year = int(profile["baseYear"])
    horizon = _horizon_months(profile)
    exit = scenario.service_exit
    exit_abs = abs_month(exit.year, exit.month, base_year)

    resolved: list[ResolvedBlock] = []

    active_type = "active_duty_retire" if exit.type == "military_retirement" else "active_duty_separate"
    resolved.append(_make_resolved("active_duty", active_type, 0, exit_abs, base_year))

    cursor = exit_abs + 1
    last_index = len(scenario.blocks) - 1
    for position, block in enumerate(scenario.blocks):
        if position == last_index and block.duration_months is None:
            end = horizon - 1
        else:
            end = min(cursor + int(block.duration_months) - 1, horizon - 1)
        resolved.append(
            _make_resolved(
                block.id or f"block_{position + 1}",
                block.type,
                cursor,
                end,
                base_year,
                career_profile_id=block.career_profile_id,
                program_id=block.program_id,
                location_id=block.location_id,
                overrides=block.overrides,
            )
        )
        cursor = end + 1

    # Timeline ends before the horizon: the remaining years are retirement.
    if cursor <= horizon - 1:
        resolved.append(_make_resolved("implicit_retire", "retire", cursor, horizon - 1, base_year))

    return resolved


def _make_resolved(
    block_id: str,
    block_type: str,
    start_index: int,
    end_index: int,
    base_year: int,
    *,
    career_profile_id: str | None = None,
    program_id: str | None = None,
    location_id: str | None = None,
    overrides: dict[str, Any] | None = None,
) -> ResolvedBlock:
    start_year, start_month = month_to_year_month(start_index, base_year)
    end_year, end_month = month_to_year_month(end_index, base_year)
    return ResolvedBlock(
        id=block_id,
        type=block_type,
        start_month_index=start_index,
        end_month_index=end_index,
        start_year=start_year,
        start_month=start_month,
        end_year=end_year,
        end_month=end_month,
        career_profile_id=career_profile_id,
        program_id=program_id,
        location_id=location_id,
        overrides=dict(overrides or {}),
    )


def active_months_in_year(block: ResolvedBlock, year_index: int) -> int:
    """How many months of the given projection year (0-based) this block covers."""
    year_start = year_index * 12
    year_end = year_start + 11
    overlap_start = max(block.start_month_index, year_start)
    overlap_end = min(block.end_month_index, year_end)
    return max(overlap_end - overlap_start + 1, 0)
