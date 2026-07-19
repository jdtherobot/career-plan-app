# V2 engine delta report — intentional corrections vs. legacy

Comparing the legacy engine's golden fixtures (`tests/fixtures/golden/`) against
the V2 composable engine (`planner_app/engine_v2.py`) running the same seeded
A/B/C scenarios (migrated to V2 timelines via `planner_app/migration_v2.py`).
Every difference below is a **deliberate correction**, not drift; the legacy
engine remains untouched and golden-locked.

## Headline numbers

| Metric | Path A | Path B | Path C |
|---|---|---|---|
| Final portfolio (nominal) — legacy | $19,985,526 | $14,815,829 | $18,299,555 |
| Final portfolio (nominal) — V2 | $22,416,533 | $17,770,115 | $20,953,485 |
| Final portfolio (**real 2026$**) — V2 | $6,521,916 | $5,170,076 | $6,096,253 |
| Lifetime healthcare — legacy | $14,563 | $1,591,028 | $991,749 |
| Lifetime healthcare — V2 | $15,376 | **$364,428** | **$256,644** |
| Employer match — V2 (new) | $718,980 | $686,224 | $968,109 |
| Pension paid — legacy → V2 | $3,547,962 → $3,744,273 | 0 | 0 |

## Corrections, cause by cause

1. **Medicare at 65 (largest correction).** Legacy compounded civilian healthcare
   at 8%/yr for the full horizon ($3,000 → ~$130K/yr by 2076 — not real). V2
   switches civilian coverage to a Medicare premium baseline at 65. Path B
   lifetime healthcare falls $1.59M → $364K; C falls $992K → $257K. This
   **shrinks Path A's healthcare advantage** — the honest number.
2. **Employer 401(k) match (new income).** 4% effective match on civilian salary
   accrues to a real traditional-401k balance. Adds ~$0.7–1.0M of contributions
   per civilian-heavy path (before growth). Legacy ignored it entirely.
3. **Derived High-3 pension.** Legacy used a static $43,596/yr. V2 derives from
   the projected pay schedule (avg of final 36 months' base pay × 2.5% ×
   completed years, per DFAS High-3): with the E-8 promotion in the schedule and
   21.0 actual years (Feb 2014 → Dec 2034), pension is modestly higher.
4. **Retirement-transition blend removed.** Legacy modeled a 75/25 blended
   "transition year." V2 uses month-precise boundaries instead: active duty
   through the exit month; pension from the next month. The blend hack is gone.
5. **Unified VA COLA base.** Legacy used inconsistent exponents per phase
   (`years_in_phd + 1`, `years_in_role + 6`, …). V2 compounds uniformly from the
   service-exit year.
6. **GI Bill is a real 36-month ledger.** Consumed by school blocks wherever
   they fall (legacy used hardcoded year windows). Same 3 school years for A/C
   seeds, but now correct for any custom timeline.
7. **Real accounts, not a blended number.** Cash / brokerage (+cost basis) /
   Roth IRA / Roth TSP / traditional 401k are tracked individually; cash holds
   at its reserve floor and does not earn the 7% equity return (legacy grew
   everything, including cash, at 7%).
8. **Retirement lifecycle exists.** Withdrawal eligibility at the configured age
   (default 59½), drawdown ordering (income → cash above floor → brokerage →
   traditional → Roth), Social Security with claim-age factors + simplified
   provisional-income taxation, and RMDs from 73 with after-tax reinvestment.
   Legacy had none of this (portfolio only ever grew).
9. **Taxes on withdrawals + capital gains.** Traditional withdrawals are taxed
   at the retirement profile rate; brokerage sales realize proportional gains at
   15%. Slightly raises lifetime taxes on all paths.
10. **Real-dollars deflator.** Every row carries `realDollarFactor` (2.5%
    inflation); metrics include `finalPortfolioReal`.

## Why nominal finals went *up* despite honest corrections

The added employer match (~$0.7–1.0M contributed, compounding at 7%) and Path
B/C's healthcare relief outweigh the new withdrawal taxes and the cash-floor
drag. The **comparison story tightens**: Path A's advantage over B narrows in
real terms — exactly the effect an honest healthcare model should have.

## Verification

- Full suite: `python3 -m unittest discover -s tests` → **88 tests, OK**
  (37 legacy + golden guard + schema/migration/resolver/money suites).
- Ledger invariants: no negative balances anywhere; exact cash-flow identity on
  accumulation years; GI Bill ≤ 36 months; benefits only after eligibility.

## Round 2 addendum (2026-07-19): researched location costs

Full cost-of-living data (15 locations, 9 categories each, 2+ sources per rent
figure, metro CPI growth rates) was researched and merged —
`docs/research/location_costs_2026.json` → `planner_app/data_location_costs.json`.

**New expense model:** active-duty years use the Manual Finance baseline (your
actual on-base situation). Post-service segments use the segment location's
researched market costs, which REPLACE overlapping manual categories (no double
counting); personal-only categories (gifts, custom items) still apply. School
blocks price at the program's city; work blocks price at the employer's city
via the new `career_locations` mapping (Microsoft→Redmond, Google/DeepMind→
Mountain View, NVIDIA/Intel→Santa Clara, Anthropic/startups→San Francisco,
generic→US metro average).

Impact on seeded paths (real 2026$ at horizon): B $5.17M→$4.39M,
C $6.10M→$4.84M. Previous figures implicitly assumed on-base-priced living for
life — this correction is large and honest. Verified by
`tests/test_location_costs.py` (7 tests: replacement not addition, per-location
differentiation, gifts stay personal, active-duty unchanged).
