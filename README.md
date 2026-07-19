# Career Plan Codex

A deterministic 50-year career-path financial planner that runs **entirely in
your browser** — the Python projection engine executes client-side via Pyodide,
so there is no backend, no account, and nothing you enter ever leaves your
device.

Built to compare composable life paths (stay to military retirement → PhD →
research · separate → tech · separate → gap → PhD · anything you assemble)
with month-level timing and a full retirement lifecycle: High-3 pension derived
from the pay schedule, VA disability, a 36-month GI Bill ledger, employer
401(k) match, Social Security with claim-age factors and provisional-income
taxation, RMDs, Medicare at 65, account-level drawdown, and a real-dollars
(2026$) view.

## Run the app

```bash
# 1) Refresh the data bundle + engine package for the browser (after any
#    Python/engine change):
python3 scripts/export_web_data.py

# 2) Dev server:
cd web && npm install && npm run dev
# open http://localhost:5173
```

Production build (outputs static files in `web/dist/`):

```bash
cd web && npm run build:full
```

## Deploy (free, static)

The build is pure static files — deploy `web/dist/` anywhere. Cloudflare Pages:

1. Push this repo to GitHub.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the repo.
3. Build command: `cd web && npm ci && npm run build` · Output dir: `web/dist`.
   (Run `python3 scripts/export_web_data.py` locally and commit `web/public/`
   so the CI build doesn't need Python.)
4. Add your custom subdomain under the project's Custom Domains.

The public site ships the seeded demo profile; visitor edits stay in their own
browser (IndexedDB) and can be backed up / restored as JSON from the Export
screen.

## Engine (Python, `planner_app/`)

- `schema_v2.py` — composable month-resolution timelines + validation
- `engine_v2.py` — V2 projection: segments, proration, benefits, retirement ledger
- `api.py` — the JSON compute interface every runtime calls (native + Pyodide)
- `exporters_v2.py` — multi-path XLSX + standalone HTML exports (input-hashed)
- `reference_data.py` / `reference_v2.py` — locked reference catalogs w/ sources
- `engine.py` — legacy engine, golden-locked (see below), kept until fully retired

## Test

```bash
python3 -m unittest discover -s tests
```

Golden-master fixtures (`tests/fixtures/golden/`) freeze the legacy engine's
output; `docs/v2_delta_report.md` documents every intentional V2 correction.
Regenerate goldens only for deliberate changes: `python3 tests/capture_golden.py`.

## Repo map

- `web/` — React + TypeScript + Vite SPA (7 screens; Pyodide worker in `web/public/`)
- `planner_app/` — the Python engine (also shipped to the browser as a zip)
- `tests/` — unit + golden + parity-contract suites
- `docs/` — known defects (baseline), V2 delta report, DB schema
- `legacy/` — the superseded Excel/HTML planners, kept for reference
- `app.py` — legacy local server + reference-research CLI tooling (dev-only)
- `career_goals_context/` — career strategy documents (not app code)

Planning estimate with simplified effective-rate taxes — not financial advice.
