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


def official_row(domains: dict, domain: str, location_id: str | None, grade: str, dependents: bool) -> dict[str, Any] | None:
    """The exact grade + dependency row — no nearest-grade substitution."""
    for row in domains.get(domain, []):
        if row.get("locationId") == location_id and row.get("grade") == grade and bool(row.get("dependents")) == dependents:
            return row
    return None


def _value(row: dict[str, Any] | None, field: str) -> float | None:
    if not row:
        return None
    value = row.get(field)
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def bah_monthly(pay_data: dict[str, Any], location_id: str | None, grade: str, dependents: bool) -> float | None:
    """BAH for the exact MHA/grade/dependency status, or None when no rate is loaded.
    No fallback to another location or grade: a missing rate is reported, not guessed."""
    entry = (pay_data.get("bah", {}) or {}).get(location_id or "")
    if not entry:
        return None
    rates = entry.get("withDependents" if dependents else "withoutDependents", {}) or {}
    value = rates.get(grade)
    return float(value) if value is not None else None


def official_cola_monthly(domains: dict, station: dict, grade: str, yos: int, dependents: bool) -> tuple[float | None, str]:
    """Monthly OCONUS COLA from DTMO's tables, or (None, reason).

    DTMO method: annual compensation (by grade and years of service) picks a
    spendable-income band; annual COLA = spendable income x (index - 100) / 100,
    paid monthly. A per-grade value entered in Assumptions (overseas_cola)
    takes precedence."""
    index = station.get("colaIndex")
    if index is None:
        return None, "no DTMO COLA index for this locality"
    comp_rows = [r for r in domains.get("cola_annual_compensation", []) if r.get("grade") == grade]
    if not comp_rows:
        return None, "DTMO annual compensation table not attached"
    eligible = [r for r in comp_rows if int(r.get("yos", 0)) <= yos] or comp_rows[:1]
    compensation = float(max(eligible, key=lambda r: int(r.get("yos", 0)))["annualCompensation"])
    deps = 1 if dependents else 0
    for band in domains.get("cola_spendable_income", []):
        low, high = band.get("compensationLow") or 0, band.get("compensationHigh")
        if compensation >= low and (high is None or compensation <= high):
            spendable = float(band[f"spendable{deps}Dependents"])
            return spendable * (float(index) - 100.0) / 100.0 / 12.0, "DTMO tables"
    return None, "compensation outside the spendable income table"


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
    yos: int = 0,
) -> dict[str, Any]:
    """Monthly allowances for one station (USD). Official rates apply in their
    data year; later years are projected forward at the military raise (BAH,
    COLA) or the location's cost growth (OHA, UA). Anything without an
    official rate is listed in `missing` and pays $0."""
    raise_factor = (1 + raise_rate) ** max(years_from_data, 0)
    cost_factor = (1 + cost_growth) ** max(years_from_data, 0)
    dep_text = "with dependents" if dependents else "without dependents"
    result: dict[str, Any] = {
        "overseas": False, "bah": 0.0, "ohaCap": 0.0, "ua": 0.0, "cola": 0.0, "miha": 0.0,
        "onBase": housing == "on_base", "missing": [], "notes": [], "currency": "USD", "roe": 1.0,
    }
    station = next((row for row in domains.get("overseas_allowances", []) if row.get("id") == location_id), None)
    if station or is_overseas(location, location_id):
        result["overseas"] = True
        place = (location or {}).get("label") or location_id
        if not station:
            result["missing"].append(f"No official OHA/COLA rates are loaded for {place}.")
            return result
        roe = float(station.get("roeLocalPerUsd") or 1.0)  # local currency per USD
        result["currency"] = station.get("currency", "USD")
        result["roe"] = roe
        cola = _value(official_row(domains, "overseas_cola", location_id, grade, dependents), "monthlyUsd")
        if cola is None:
            cola, reason = official_cola_monthly(domains, station, grade, yos, dependents)
        else:
            reason = "entered in Assumptions"
        if cola is None:
            result["missing"].append(f"COLA for {grade} {dep_text} at {station.get('dtmoLocality') or place} ({reason})")
        else:
            result["cola"] = cola * raise_factor
        if housing != "on_base":
            oha = official_row(domains, "oha_rates", location_id, grade, dependents)
            rent_cap = _value(oha, "rentLocal")
            if rent_cap is None:
                result["missing"].append(f"OHA for {grade} {dep_text} at {station.get('dtmoLocality') or place}")
            else:
                result["ohaCap"] = rent_cap / roe * cost_factor
                result["ua"] = (_value(oha, "uaLocal") or 0.0) / roe * cost_factor
                result["miha"] = (_value(oha, "mihaLocal") or 0.0) / roe * cost_factor
                result["ohaCapOfficialLocal"] = rent_cap
                result["projected"] = years_from_data > 0
                result["source"] = f"DTMO, effective {station.get('ratesEffective')}; see Sources → Official documents"
        return result
    if housing != "on_base":
        bah = bah_monthly(pay_data, location_id, grade, dependents)
        if bah is None:
            place = (location or {}).get("label") or location_id
            result["missing"].append(f"BAH for {grade} {dep_text} at {place}")
        else:
            result["bah"] = bah * raise_factor
    return result
