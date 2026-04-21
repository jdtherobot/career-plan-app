# Career Plan Codex

A local-first interactive financial planner built with Python, SQLite, and a browser frontend. The app rebuilds the spreadsheet planner as a structured projection engine with saved scenario forks, editable finance inputs, charts, tables, and CSV/XLSX export.

## Run locally

```bash
python3 app.py
```

Then open `http://127.0.0.1:8000`.

## Test

```bash
python3 -m unittest discover -s tests
```

## Reference research workflow

Export the workbook, prompt, and CSV package used to research Reference Data:

```bash
python3 app.py export-reference-research
```

This exports or refreshes:

- `output/spreadsheet/reference_research.xlsx`
- `output/spreadsheet/reference_research_claims.csv`
- `output/spreadsheet/reference_research_conflicts.csv` (created if missing and preserved if it already exists)
- `output/spreadsheet/reference_research_claims_resolved.csv`
- `output/spreadsheet/reference_research_review_queue.csv`
- `output/spreadsheet/reference_research_multi_agent_prompt.txt`

For multi-agent work:

- `reference_research_claims.csv` is the accepted-state working file
- `reference_research_conflicts.csv` is the append-only disagreement and review log
- `reference_research_claims_resolved.csv` is the derived import-ready file
- `reference_research_review_queue.csv` is the derived unresolved/stale review queue
- `reference_research_multi_agent_prompt.txt` is the reusable handoff prompt to send with the CSV package

Only edit `reference_research_claims.csv` and `reference_research_conflicts.csv`. Do not directly edit the resolved or review-queue CSVs.

Reconcile accepted reviewer decisions from the conflict log into an import-ready resolved CSV:

```bash
python3 app.py reconcile-reference-research
```

This emits:

- `output/spreadsheet/reference_research_claims_resolved.csv`
- `output/spreadsheet/reference_research_review_queue.csv`

Import a filled workbook or CSV back into the planner:

```bash
python3 app.py import-reference-research output/spreadsheet/reference_research.xlsx
```

After multi-agent review, the file to upload back into the app is:

- `output/spreadsheet/reference_research_claims_resolved.csv`

## What is included

- SQLite-backed local persistence in `planner.db`
- Seeded reference data from the planner breakdown prompt
- Deterministic multi-path projection engine
- Guided scenario builder plus manual finance editing
- Projection explorer, comparison studio, reference data view, and gap tracker
- CSV and XLSX export for per-scenario projections
- XLSX/CSV export-import workflow for Reference Data research claims and source citations
