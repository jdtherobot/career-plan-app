"""Duty-station allowances: BAH stateside, OHA + utility allowance + COLA overseas.

Rules modelled (per month at a station):

* Stateside, off base: BAH (MHA x grade x dependents) is cash income. Rent is
  a normal expense; BAH is yours whether rent is above or below it.
* Stateside, on base: no BAH; housing (and utilities) are provided.
* Overseas, off base: OHA reimburses *actual rent up to a ceiling* — it is a
  cap, not a payment, so OHA = min(rent, ceiling) and the member keeps nothing
  above actual rent. A flat utility/recurring-maintenance allowance (UA) and
  overseas COLA are paid on top. No BAH.
* Overseas, on base: COLA only; housing is provided.

Amounts are monthly USD in the data year, escalated by the military raise
(BAH, COLA) or the location's cost growth (OHA ceiling, UA).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_OVERSEAS_PATH = Path(__file__).resolve().parent / "data_overseas_2026.json"
_overseas_cache: dict[str, Any] | None = None


def load_overseas() -> dict[str, Any]:
    global _overseas_cache
    if _overseas_cache is None:
        _overseas_cache = (
            json.loads(_OVERSEAS_PATH.read_text(encoding="utf-8")) if _OVERSEAS_PATH.exists() else {}
        )
    return _overseas_cache


def is_overseas(location: dict[str, Any] | None, location_id: str | None) -> bool:
    if location_id and location_id in (load_overseas().get("stations") or {}):
        return True
    if not location:
        return False
    country = (location.get("countryCode") or "US").upper()
    return country not in ("US", "USA")


def _grade_rate(table: dict[str, Any] | None, grade: str) -> float | None:
    """Rate for a grade, falling back to the nearest listed grade of the same type."""
    if not table:
        return None
    if grade in table and table[grade] is not None:
        return float(table[grade])
    prefix = grade.split("-")[0]
    try:
        number = int("".join(ch for ch in grade.split("-")[-1] if ch.isdigit()) or 0)
    except ValueError:
        number = 0
    candidates = []
    for key, value in table.items():
        if value is None or not key.startswith(prefix + "-"):
            continue
        digits = "".join(ch for ch in key.split("-")[-1] if ch.isdigit())
        if digits:
            candidates.append((abs(int(digits) - number), float(value)))
    if candidates:
        return min(candidates)[1]
    return None


def bah_monthly(pay_data: dict[str, Any], location_id: str | None, grade: str, dependents: bool) -> tuple[float, bool]:
    """(BAH monthly in the data year, is_estimate). Unknown CONUS locations use
    the US metro average and are flagged as an estimate."""
    table = pay_data.get("bah", {}) or {}
    entry = table.get(location_id or "")
    estimate = False
    if not entry:
        entry = table.get("us_metro_average") or {}
        estimate = True
    rates = entry.get("withDependents" if dependents else "withoutDependents", {}) if entry else {}
    rate = _grade_rate(rates, grade if grade in rates else ("O-7" if grade.startswith("O-") and grade not in rates else grade))
    return float(rate or 0.0), estimate


def _grade_rows(domains: dict, domain: str, location_id: str, field: str) -> dict[str, float]:
    return {
        row["grade"]: float(row.get(field) or 0)
        for row in domains.get(domain, [])
        if row.get("locationId") == location_id and row.get(field) is not None
    }


def station_allowances(
    domains: dict,
    pay_data: dict[str, Any],
    location: dict[str, Any] | None,
    location_id: str | None,
    housing: str,
    grade: str,
    dependents: bool,
    years_from_data: int,
    raise_rate: float,
    cost_growth: float,
) -> dict[str, Any]:
    """Monthly allowances for one station (all USD, escalated to the year)."""
    raise_factor = (1 + raise_rate) ** max(years_from_data, 0)
    cost_factor = (1 + cost_growth) ** max(years_from_data, 0)
    result: dict[str, Any] = {
        "overseas": False, "bah": 0.0, "ohaCap": 0.0, "ua": 0.0, "cola": 0.0,
        "onBase": housing == "on_base", "estimate": False, "notes": [],
    }
    station = next((row for row in domains.get("overseas_allowances", []) if row.get("id") == location_id), None)
    if station or is_overseas(location, location_id):
        result["overseas"] = True
        if not station:
            result["estimate"] = True
            result["notes"].append("No researched OHA/COLA data for this location — allowances are $0. Add them in Assumptions.")
            return result
        fx = float(station.get("usdPerLocal") or 1.0)
        dep = "withDependents" if dependents else "withoutDependents"
        cola = _grade_rate(_grade_rows(domains, "overseas_cola", location_id, f"{dep}Usd"), grade)
        result["cola"] = float(cola or 0.0) * raise_factor
        if housing != "on_base":
            ceiling = _grade_rate(_grade_rows(domains, "oha_rent_ceilings", location_id, f"{dep}Local"), grade)
            ua_field = "uaWithDependentsLocal" if dependents else "uaWithoutDependentsLocal"
            result["ohaCap"] = float(ceiling or 0.0) * fx * cost_factor
            result["ua"] = float(station.get(ua_field) or 0.0) * fx * cost_factor
        if station.get("verificationStatus") not in (None, "verified"):
            result["estimate"] = True
        return result
    if housing != "on_base":
        bah, estimate = bah_monthly(pay_data, location_id, grade, dependents)
        result["bah"] = bah * raise_factor
        result["estimate"] = estimate
        if estimate:
            result["notes"].append("No BAH entry for this location — using the US metro average.")
    return result
