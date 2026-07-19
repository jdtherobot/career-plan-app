"""Export the data bundle + engine package + parity fixture for the web app.

Writes:
- web/public/planner_data.json  — bootstrap reference data + default payload
- web/public/planner_app.zip    — the Python engine package for Pyodide
- web/public/parity_fixture.json — native compute() results the browser
  compares against Pyodide output (Stage 5 parity contract)
"""
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from planner_app.api import bootstrap_data, compute, default_payload  # noqa: E402

OUT = ROOT / "web" / "public"
OUT.mkdir(parents=True, exist_ok=True)

(OUT / "planner_data.json").write_text(json.dumps(bootstrap_data()), encoding="utf-8")

result = compute(default_payload())
parity = {
    "inputHash": result["inputHash"],
    "finalPortfolios": {s["scenarioId"]: s["metrics"]["finalPortfolio"] for s in result["scenarios"]},
    "comparison": result["comparison"],
}
(OUT / "parity_fixture.json").write_text(json.dumps(parity, indent=2), encoding="utf-8")

zip_path = OUT / "planner_app.zip"
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for py in sorted((ROOT / "planner_app").glob("*.py")):
        zf.write(py, f"planner_app/{py.name}")
    for data in sorted((ROOT / "planner_app").glob("*.json")):
        if ".local." in data.name:
            continue  # personal files never ship
        zf.write(data, f"planner_app/{data.name}")
    # The reference loader reads the grad tracker workbook for program data.
    workbook = ROOT / "grad_program_tracker_v2_7.xlsx"
    if workbook.exists():
        zf.write(workbook, "grad_program_tracker_v2_7.xlsx")

print(f"planner_data.json: {(OUT/'planner_data.json').stat().st_size:,} bytes")
print(f"planner_app.zip:   {zip_path.stat().st_size:,} bytes")
print(f"parity fixture:    {result['inputHash'][:16]}…")
