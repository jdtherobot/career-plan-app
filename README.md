# Career Plan — Financial Planner

A deterministic 50-year career-path financial planner that runs **entirely in
your browser**. The Python projection engine executes client-side via Pyodide —
there is no backend and no account, and anything you enter stays in your own
browser and never leaves your device.

**[Launch the app](https://britt.gg/career-plan-app/)**

For how this was built — the five implementations that preceded it and what the
rewrite proved wrong — see [ENGINEERING.md](ENGINEERING.md).

---

## What it does

Compare composable life paths — stay to military retirement → PhD → research ·
separate → tech · separate → gap → PhD, or anything you assemble yourself. You
build a path by stacking career segments in any sequence, and the engine
projects the full financial arc at month-level resolution.

- **Composable month-level path builder** — assemble any sequence of career
  segments and see the projection recompute deterministically.
- **Full retirement lifecycle** — High-3 pension derived from the projected pay
  schedule, VA disability, a 36-month GI Bill ledger, employer 401(k) match,
  Social Security with claim-age factors, RMDs, Medicare at 65, and
  account-level drawdown.
- **Real accounts, not one blended number** — cash, brokerage with cost basis,
  Roth IRA, Roth TSP, and traditional 401(k) tracked individually.
- **Researched reference data** — locked catalogs with sources, so school,
  employer, and location assumptions are grounded rather than guessed.
- **Real-dollar reporting** — 2076 figures shown in 2026 purchasing power.

## The seven screens

| Screen | What it's for |
|---|---|
| **Dashboard** | Side-by-side path comparison and the major differences between them |
| **Path Builder** | Assemble and validate a career timeline block by block |
| **Finances** | Your current accounts, net worth, and monthly cash flow |
| **Explorer** | Annual and phase-level detail for a single path |
| **Assumptions** | Every rate and input, editable, each with its source |
| **Sources** | The full reference catalog with links |
| **Export** | Generate portable reports and workbooks |

## Try it with your own numbers

The public build ships a **sanitized demo profile** with a rank / TAFMS /
location picker, so you can explore realistic projections without entering
anything personal.

Your edits live in your browser's IndexedDB and can be backed up or restored as
JSON from the Export screen. Nothing is uploaded, because there is nowhere to
upload it to.

To run it locally instead:

```bash
git clone https://github.com/jdtherobot/career-plan-app
cd career-plan-app

# Build the data bundle + engine package for the browser
# (re-run after any Python/engine change)
python3 scripts/export_web_data.py

# Start the dev server
cd web && npm install && npm run dev
# open http://localhost:5173
```

Production build (static files in `web/dist/`):

```bash
cd web && npm run build:full
```

## Exports

The Export screen produces three artifacts, all stamped with the same
deterministic input hash as the live dashboard, so an export can always be tied
back to the inputs that produced it.

- **Interactive app (single file)** — `career_plan_app.html`: the entire app —
  all seven screens, charts, your data, precomputed results, and the engine zip
  — in one ~1.3 MB file. Every screen views offline anywhere; editing inside it
  loads Pyodide from CDN (internet required once) and recomputes. Built by
  injecting state into `web/dist/app-template.html`, which
  `scripts/build_single_file.py` produces from a finished build.
- **Advisor workbook (Excel)** — `career_plan_advisor_workbook.xlsx`: cover,
  comparison (deltas, drivers, milestones), current position, a ~36-column
  annual cash-flow sheet per path, native Excel charts, assumptions and
  overrides, and a hyperlinked sources sheet.
- **Dashboard report (HTML)** — `career_plan_report.html`: the Dashboard and
  Explorer rendered to one static page using the real app components via
  `react-dom/server`, with the stylesheet inlined.

A fourth download, `career_plan_backup.json`, handles backup and restore.

## Deploy

Pushing to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which builds and publishes to **GitHub Pages**:

1. `python3 scripts/export_web_data.py` regenerates the data bundle from source.
2. `npm ci && npm run build` in `web/`, with `PAGES_BASE=/career-plan-app/`.
3. `python3 scripts/build_single_file.py` produces the single-file app template.
4. `rm -f web/dist/*.local.json`, then upload and deploy `web/dist`.

The build is pure static files, so `web/dist/` can be served from any static
host if you'd rather not use Pages.

**On personal data in CI:** the runner does a clean checkout and no
`personal_baseline` file is tracked, so the published bundle is the sanitized
demo by construction. The `rm -f` step and the `.local.` filter in
`scripts/export_web_data.py` are redundant safeguards, not the primary
mechanism. Do not add a workflow that publishes from a working tree — that would
bypass all three.

## Engine (Python, `planner_app/`)

- `schema_v2.py` — composable month-resolution timelines + validation
- `engine_v2.py` — V2 projection: segments, proration, benefits, retirement ledger
- `api.py` — the JSON `compute()` interface every runtime calls (native + Pyodide)
- `exporters_v2.py` — advisor-grade XLSX workbook export (input-hashed)
- `reference_data.py` / `reference_v2.py` — locked reference catalogs with sources
- `engine.py` — legacy engine, golden-locked, kept until fully retired

## Test

```bash
python3 -m unittest discover -s tests
```

129 tests, all Python `unittest` — legacy golden-master fixtures, schema and
migration, exporters, location costs, service profile, single-file template, and
financial invariants (no negative balances, cash-flow identity on accumulation
years, GI Bill ≤ 36 months, benefits only after eligibility, deterministic
results). There is currently no JavaScript test runner.

Golden fixtures in `tests/fixtures/golden/` freeze the legacy engine's output;
[`docs/v2_delta_report.md`](docs/v2_delta_report.md) documents every intentional
V2 correction. Regenerate goldens only for deliberate changes:
`python3 tests/capture_golden.py`.

Native-to-Pyodide parity is a property of the architecture — both runtimes
execute the same Python module — but it is **not currently enforced by a test**.
`scripts/export_web_data.py` emits `parity_fixture.json` and `tests/test_api.py`
asserts the native side; the browser-side comparison is not yet wired up.

## Repo map

- `web/` — React + TypeScript + Vite SPA (7 screens; Pyodide blob worker in `web/src/engine/`)
- `planner_app/` — the Python engine (also shipped to the browser as a zip)
- `tests/` — the unittest suite and golden fixtures
- `docs/` — known defects (baseline), V2 delta report, DB schema, research data
- `docs/artifacts/` — preserved development artifacts (see [ENGINEERING.md](ENGINEERING.md))
- `legacy/` — superseded Excel/HTML planners, kept for reference
- `app.py` — legacy local server + reference-research CLI tooling (dev-only)

## License

- **Code** — the engine, application, and scripts are [MIT](LICENSE).
- **Documentation and artifacts** — `README.md`, `ENGINEERING.md`, and
  everything in `docs/artifacts/` are
  [CC BY-NC 4.0](LICENSE-DOCS).

---

Deterministic planning estimate with simplified effective-rate taxes — not
financial advice.
