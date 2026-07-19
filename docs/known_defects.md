# Known engine defects (baseline before rewrite)

Captured at Stage 1 against the current engine (`planner_app/engine.py`) with the
seeded A/B/C scenarios. Golden fixtures in `tests/fixtures/golden/` freeze this
(defective) behavior so refactors that should preserve behavior stay honest, and
so the Stage 2–4 "intentional corrections" delta report has a reference point.

Baseline sanity check (seeded scenarios, current engine):

| Path | Final portfolio (2076, nominal) | Lifetime healthcare | Notes |
|---|---|---|---|
| A (mil → PhD → research) | $19,985,526 | $14,563 | grows forever; no drawdown |
| B (separate → tech) | $14,815,829 | (civilian) | |
| C (separate → gap → PhD) | $18,299,555 | (civilian) | |

The implausible ~$15–20M portfolios and the $14.5K lifetime healthcare are the
artifacts below, not real results.

## Defects

1. **Composable engine is dead code.** `project_scenario` (engine.py:788) calls the hardcoded `_legacy_year_state` (PATH_A/B/C). The composable `_resolve_year_state` (engine.py:555) is never called; custom timelines are coerced back to A/B/C via `coerce_legacy_path_template_id`. → *Stage 3.*
2. **No retirement drawdown or income turn-on.** Portfolio only grows: `portfolio = prior + growth + retirement_savings + surplus` (engine.py:1106). No withdrawals, no depletion, accounts never pay out. → *Stage 4.*
3. **Pension hardcoded to PATH_A.** `calculate_lifetime_pension` returns 0 unless PATH_A (engine.py:1352); eligibility is not derived from actual completed service (20-year rule). → *Stage 3.*
4. **Accounts are cosmetic.** TSP/Roth/401k are a proportional split of one blended portfolio (engine.py:1162–1173) — not real balances, no cost basis, no per-account contribution history. → *Stage 4.*
5. **Healthcare compounds unbounded.** Civilian healthcare inflates ~8%/yr to age 86 with no Medicare cap at 65 — distorts the headline healthcare differential. → *Stage 4 (Medicare-at-65).*
6. **Nominal-only.** No inflation adjustment; 2076 figures are hard to interpret. → *Stage 4 (real-dollars deflator).*
7. **No Social Security, RMDs, or employer 401k match.** All absent. → *Stage 4.*
8. **Annual-only timeline.** No month-level block boundaries; mid-year separation (Nov) approximated; `_legacy_year_state` uses fixed year-index windows. → *Stage 2/3 (month proration).*
9. **Compensation is a single exponential.** `_value(base, growth, years)` compounds one rate indefinitely (e.g., engine.py:1000); a 20-year tenure grows base at a flat rate forever. → *Stage 3 (piecewise year-in-role segments).*
10. **GI Bill uses hardcoded year windows.** `years_since_retirement <= 3` / `years_in_phd <= 2` (engine.py:961, 1057) instead of a 36-month budget ledger that follows school blocks wherever they fall. → *Stage 3 (GI Bill ledger).*
11. **Retirement-location tax not modeled.** The retire phase has no location/state; pension + withdrawals aren't taxed by residence state. → *Stage 4.*
12. **VA healthcare threshold not wired.** 50%+/100% rating → reduced/free VA healthcare is captured in reference notes but never applied to healthcare cost. → *Stage 4 (if in scope) / documented gap.*

## What the golden fixtures guarantee

- Stage 2 (V2 migration): A/B/C expressed as V2 timelines should reproduce these numbers, proving the migration preserves behavior before any intentional correction.
- Stage 5 (Pyodide): in-browser results must equal native Python exactly.
- Stages 3–4: these fixtures will intentionally change; regenerate via `python3 tests/capture_golden.py` and record the diff in the delta report.
