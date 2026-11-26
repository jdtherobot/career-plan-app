# Career Plan App — notes for Claude sessions

Personal 50-year career/financial planner comparing military-retirement vs.
separation paths (grad school, tech, research). Python engine (`planner_app/`)
runs in the browser via Pyodide; React/Vite UI in `web/`. Background:
`ENGINEERING.md`; usage: `README.md`.

## Shipping (read first)
- The live site (britt.gg/career-plan-app) deploys from **`main`** via
  `.github/workflows/deploy.yml` (GitHub Pages) on every push. Work on a
  branch is NOT live until merged.
- The owner wants finished work live: commit on the session branch, open a PR
  to `main`, merge it, and confirm the deploy run succeeded. Say plainly if
  something is only on a branch.
- Before pushing: `python3 -m pytest -q tests`, `python3 tests/capture_golden.py`
  when projections change on purpose (review the diff), `python3 scripts/export_web_data.py`,
  `cd web && npx tsc -b && npx oxlint && npm run build`. Verify UI changes in
  Playwright against `npx vite preview --port 4173`.

## Data sources and network
- DTMO (travel.dod.mil / defensetravel.dod.mil) **blocks cloud containers**
  (Akamai 403), so official OHA/COLA lookups must come from the owner as
  screenshots. Ask once, precisely (country, location code, grade, with/without
  dependents) — and only for rows the plan actually needs.
- FRED CSV (`fred.stlouisfed.org/graph/fredgraph.csv?id=SERIES`) works for BLS
  CPI series; the BLS API is often rate-limited. tricare.mil, cms.gov, kff.org
  are reachable.
- Military allowances are official values only — never estimated
  (`data_overseas_2026.json` policy). Loaded: Alconbury GB001 E-7 *without*
  dependents (rent £1,627.20, UA £623.25, MIHA £502, ROE 0.7239, eff. 2026-07-01).
  `scripts/import_official_rates.py --check` needs `xlrd` + `pdftotext`.

## Modeling decisions (owner-approved, Nov 2026)
- **OHA:** off-base overseas rent = the full DTMO OHA rate, so OHA and rent net
  to $0; UA is paid on top and the surplus is kept. A missing official row holds
  OHA and rent at $0 (`pending_official_rate`) and appears in the dashboard
  banner with inline entry.
- **Dependents:** household timeline (default: single until 2034, then one
  dependent). A dependent gives family health coverage; with-dependent
  BAH/OHA/COLA apply only if the member is marked `livesWithYou` (default off —
  the owner expects to be unaccompanied at Alconbury).
- **Healthcare:** TRICARE Group A (owner entered pre-2018): Select fee until 65,
  then TRICARE For Life = Medicare Part B only. Separated: employer worker
  share (KFF), unsubsidized marketplace when not working, Part B + Medigap/Part D
  at 65.
- **Growth rates** live in `reference_v2.py` → `v2_benefit_rules`
  (editable in Assumptions → Lifecycle rules), each sourced: per-category
  living-expense growth from 20-yr BLS CPI history; market wage growth 3.5%
  (ECI) — offers/stipends are in 2026 dollars and indexed to the start year;
  military raise 3.5%; one retiree COLA 2.5% for pension/VA/SS; tuition 3%.
  The owner chose to **keep wage growth at 3.5%** (real wage growth ~1%/yr), so
  the same job starting later shows a slightly higher real salary — expected,
  not a bug.
- **Salaries:** the 13 presets (`reference_data.py` `_build_career_profiles`)
  are new-grad (tech) / new-PhD (research) base pay with sources; raises 5.5%
  (yrs 0-4), 4.5% (5-9), 3.5% after. Bonus/RSU are reference only (not income).
  Blocks can override starting salary ($/yr, today's dollars) and raise %.
- **Dashboard UI:** eye toggle per path card (any path can be hidden; one stays
  shown); cards drag to reorder (that is the plan's path order everywhere);
  each path keeps a stable `colorSlot`; chart order set in the Charts dropdown;
  Explorer columns fixed and resizable.

## Working with the owner
- Do the research and data gathering yourself; ask for something only when it
  is truly blocked, and say exactly what and why in one message.
- Explain choices in plain language with a clear recommendation.
- Report honestly what is live vs. not; list what was and wasn't done.
