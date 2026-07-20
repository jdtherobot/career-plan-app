# web/

The React + TypeScript + Vite front end for the Career Plan financial planner.

This directory is not meant to be used standalone — it depends on a data bundle
and engine zip generated from the Python side. See the
[project README](../README.md) for setup and
[ENGINEERING.md](../ENGINEERING.md) for architecture.

```bash
# from the repo root first — generates the data bundle + engine zip:
python3 scripts/export_web_data.py

# then here:
npm install && npm run dev      # http://localhost:5173
npm run build:full              # full production build
npm run lint                    # oxlint
```

Key locations:

- `src/screens/` — the seven screens (`Paths.tsx` is the Path Builder)
- `src/engine/` — the Pyodide Blob worker and its client
- `src/state/` — IndexedDB-backed store
- `src/report/` — static HTML report renderer (`react-dom/server`)
