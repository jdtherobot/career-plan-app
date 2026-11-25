"""Import the official rate tables in official_sources/ into the planner's data.

Run after dropping in a new year's files:

    python3 scripts/import_official_rates.py          # write data + manifest
    python3 scripts/import_official_rates.py --check  # fail if anything is stale

Sources (all stored verbatim in official_sources/):
  * DTMO BAH ASCII rate file (zip)           -> BAH for every planner MHA, every grade
  * DFAS basic pay, enlisted (PDF)            -> verifies/replaces enlisted basic pay
  * DTMO COLA indices (xls)                   -> overseas COLA index per locality
  * DTMO COLA spendable income table (PDF)    -> spendable income by compensation band
  * DTMO COLA annual compensation table       -> grade x YOS -> compensation band
                                                 (COLA is only computed once present)

Needs `pdftotext` (poppler-utils) and `xlrd` (pip install xlrd) — import-time
only; the app itself reads the JSON this writes.
"""

from __future__ import annotations

import hashlib
import io
import json
import re
import subprocess
import sys
import zipfile
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "official_sources"
PAY_JSON = ROOT / "planner_app" / "data_military_pay_2026.json"
OVERSEAS_JSON = ROOT / "planner_app" / "data_overseas_2026.json"
COLA_JSON = ROOT / "planner_app" / "data_cola_2026.json"
MANIFEST = SRC / "manifest.json"

BAH_ZIP = SRC / "dtmo_BAH-ASCII-2026.zip"
PAY_PDF = SRC / "dfas_basic_pay_enlisted_2026.pdf"
COLA_XLS = SRC / "dtmo_cola_indices_2026-11-01.xls"
SPENDABLE_PDF = SRC / "dtmo_cola_spendable_income_2026-02-01.pdf"
ANNUAL_COMP_CSV = SRC / "cola_annual_compensation_2026_reconstructed.csv"

# DTMO ASCII-FILE-FORMAT.pdf column order after the MHA code.
BAH_GRADES = ["E-1", "E-2", "E-3", "E-4", "E-5", "E-6", "E-7", "E-8", "E-9",
              "W-1", "W-2", "W-3", "W-4", "W-5", "O-1E", "O-2E", "O-3E",
              "O-1", "O-2", "O-3", "O-4", "O-5", "O-6", "O-7"]
YOS_COLUMNS = ["<2", "2", "3", "4", "6", "8", "10", "12", "14", "16", "18",
               "20", "22", "24", "26", "28", "30", "32", "34", "36", "38", "40"]
# Overseas planner stations -> DTMO COLA locality code.
COLA_LOCALITIES = {"raf_alconbury_uk": "GB001"}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pdf_text(path: Path) -> str:
    return subprocess.run(["pdftotext", "-layout", str(path), "-"], check=True,
                          capture_output=True, text=True).stdout


# ---------------------------------------------------------------- BAH -----
def import_bah(pay: dict) -> dict:
    with zipfile.ZipFile(BAH_ZIP) as zf:
        def table(name: str) -> dict[str, list[float]]:
            rows = {}
            for line in zf.read(name).decode("ascii").splitlines():
                parts = line.strip().split(",")
                if len(parts) >= 1 + len(BAH_GRADES):
                    rows[parts[0]] = [float(v) for v in parts[1:1 + len(BAH_GRADES)]]
            return rows
        with_deps, without = table("bahw26.txt"), table("bahwo26.txt")
        names = dict(
            line.split(";", 1) for line in zf.read("mhanames26.txt").decode("latin-1").splitlines() if ";" in line
        )
    changed = []
    for location_id, entry in pay["bah"].items():
        if not entry or not entry.get("mha"):
            continue
        mha = entry["mha"]
        if mha not in with_deps:
            raise SystemExit(f"MHA {mha} ({location_id}) not in the DTMO BAH file")
        new_w = dict(zip(BAH_GRADES, with_deps[mha]))
        new_wo = dict(zip(BAH_GRADES, without[mha]))
        for grade in BAH_GRADES:
            for label, old_tbl, new in (("with", entry.get("withDependents", {}), new_w),
                                        ("without", entry.get("withoutDependents", {}), new_wo)):
                if grade in old_tbl and abs(float(old_tbl[grade]) - new[grade]) > 0.005:
                    changed.append(f"{location_id} {grade} {label}: {old_tbl[grade]} -> {new[grade]}")
        entry.update({
            "mhaName": names.get(mha, entry.get("mhaName", "")).strip(),
            "withDependents": new_w,
            "withoutDependents": new_wo,
            "source": "DTMO 2026 BAH rate file (BAH-ASCII-2026.zip: bahw26.txt / bahwo26.txt)",
            "sourceDocument": "dtmo-bah-2026",
            "verificationStatus": "official",
        })
    pay["bah"].pop("us_metro_average", None)  # a derived average, not a DTMO rate
    return {"changed": changed}


# ---------------------------------------------------------- basic pay -----
def import_enlisted_pay(pay: dict) -> dict:
    text = pdf_text(PAY_PDF)
    if "Effective January 1, 2026" not in text:
        raise SystemExit("DFAS pay PDF is not the January 1, 2026 table")
    rows: dict[str, list[float]] = {}
    pending: str | None = None
    for line in text.splitlines():
        grade = re.search(r"\b(E-[1-9])\b", line)
        if grade:
            pending = grade.group(1)
        amounts = [float(a.replace(",", "")) for a in re.findall(r"\b\d{1,2},\d{3}\.\d{2}\b", line)]
        if pending and len(amounts) >= 5:
            rows.setdefault(pending, []).extend(amounts)
            pending = None
    table: dict[str, dict[str, float]] = {}
    for grade, values in rows.items():
        # E-8/E-9 start at higher YOS: the PDF leaves the early columns blank.
        first = len(YOS_COLUMNS) - len(values)
        table[grade] = {YOS_COLUMNS[first + i]: v for i, v in enumerate(values)}
    if table.get("E-7", {}).get("12") != 5591.70:
        raise SystemExit(f"DFAS parse check failed: E-7 over 12 = {table.get('E-7', {}).get('12')}")
    changed = []
    for grade, columns in table.items():
        old = pay["basicPayMonthly"].get(grade, {})
        for column, value in columns.items():
            if column in old and abs(float(old[column]) - value) > 0.005:
                changed.append(f"{grade} {column}: {old[column]} -> {value}")
        pay["basicPayMonthly"][grade] = {**old, **columns}
    pay.setdefault("verification", {})["enlistedBasicPay"] = {
        "status": "official", "sourceDocument": "dfas-pay-2026",
        "note": "Enlisted basic pay verified against the DFAS table effective January 1, 2026.",
    }
    pay["verification"]["officerWarrantBasicPay"] = {
        "status": "unverified",
        "note": "Officer and warrant tables not yet attached; values are from a copy of the DFAS table.",
    }
    return {"changed": changed}


# ------------------------------------------------------------- COLA -------
def excel_date(serial: float) -> str:
    return (date(1899, 12, 30) + timedelta(days=int(serial))).isoformat()


def import_cola() -> dict:
    import xlrd

    book = xlrd.open_workbook(str(COLA_XLS))
    sheet = book.sheet_by_index(0)
    effective_header = str(sheet.cell_value(0, 0))
    indices = {}
    for r in range(sheet.nrows):
        country, locality, code, footnote, index, eff = (sheet.row_values(r) + [""] * 6)[:6]
        if code in COLA_LOCALITIES.values():
            indices[code] = {
                "country": country, "locality": locality, "index": float(index),
                "effective": excel_date(float(eff)) if isinstance(eff, float) else str(eff),
                "footnote": footnote,
            }
    notes = {}
    for r in range(sheet.nrows):
        cell = str(sheet.cell_value(r, 0))
        m = re.match(r"(\d+)/\s+(.*)", cell)
        if m:
            notes[m.group(1)] = m.group(2).strip()
    for code, rec in indices.items():
        fn = str(rec.pop("footnote") or "").split(".")[0]
        if fn in notes:
            rec["note"] = notes[fn]

    # Spendable income: compensation band -> income by number of dependents (0..5+).
    bands = []
    for line in pdf_text(SPENDABLE_PDF).splitlines():
        money = [int(m.replace(",", "")) for m in re.findall(r"\$([\d,]+)", line)]
        if len(money) < 6:
            continue
        if "≥" in line or ">=" in line:
            low, high, incomes = money[0], None, money[1:7]
        elif "≤" in line or "<=" in line:
            low, high, incomes = 0, money[0], money[1:7]
        else:
            low, high, incomes = money[0], money[1], money[2:8]
        bands.append({"compensationLow": low, "compensationHigh": high, "spendableIncome": incomes})
    if not bands or bands[0]["spendableIncome"][0] != 61650:
        raise SystemExit("Spendable income parse check failed")

    # Annual compensation by grade and YOS column (reconstructed table; see the CSV header).
    comp_rows = []
    if ANNUAL_COMP_CSV.exists():
        import csv

        lines = [l for l in ANNUAL_COMP_CSV.read_text(encoding="utf-8").splitlines() if not l.startswith("#")]
        for rec in csv.DictReader(lines):
            without, with_deps = int(rec["annual_compensation_without_dependents"]), int(rec["annual_compensation_with_dependents"])
            if without <= 0 and with_deps <= 0:
                continue  # grade not held at this many years of service
            yos = 0 if rec["yos_column"] == "<2" else int(rec["yos_column"])
            comp_rows.append({
                "id": f"{rec['grade']}:{rec['yos_column']}", "label": f"{rec['grade']} · over {rec['yos_column']} YOS",
                "grade": rec["grade"], "yos": yos,
                "withoutDependents": without, "withDependents": with_deps,
                "verificationStatus": "reconstructed",
                "sourceLabel": "DTMO 2026 COLA annual compensation table (reconstructed, cross-checked)",
                "sourceUrl": "",
            })
    annual_comp = {"file": ANNUAL_COMP_CSV.name, "rows": len(comp_rows), "status": "reconstructed"} if comp_rows else None

    data = {
        "indicesFile": COLA_XLS.name, "indicesHeader": effective_header,
        "indices": {station: indices.get(code) for station, code in COLA_LOCALITIES.items()},
        "spendableIncomeFile": SPENDABLE_PDF.name, "spendableIncomeEffective": "2026-02-01",
        "spendableIncome": bands,
        "annualCompensation": annual_comp,
        "annualCompensationRows": comp_rows,
        "method": "Annual COLA = spendable income x (index - 100) / 100; daily rate = annual / 360 carried to five "
                  "decimals (FMR Table 68-9); a 30-day month pays 30 x the daily rate. "
                  "Spendable income is looked up by annual compensation (DTMO annual compensation table, "
                  "by grade and years of service) and number of dependents.",
    }
    return data


# ----------------------------------------------------------- manifest -----
DOCS = [
    {"id": "dtmo-bah-2026", "file": BAH_ZIP.name, "agency": "Defense Travel Management Office (DTMO)",
     "title": "2026 Basic Allowance for Housing rate files (all MHAs, all grades)",
     "detail": "DTMO's BAH ASCII download: bahw26.txt (with dependents), bahwo26.txt (without), MHA names, ZIP→MHA map.",
     "officialUrl": "https://www.travel.dod.mil/Allowances/Basic-Allowance-for-Housing/BAH-Rate-Lookup",
     "effective": "2026-01-01", "feeds": ["BAH at every stateside duty station and school city"]},
    {"id": "dfas-pay-2026", "file": PAY_PDF.name, "agency": "Defense Finance and Accounting Service (DFAS)",
     "title": "Basic Pay — Enlisted, effective January 1, 2026",
     "detail": "DFAS enlisted pay table (page saved as PDF). Officer and warrant tables not yet attached.",
     "officialUrl": "https://www.dfas.mil/MilitaryMembers/payentitlements/Pay-Tables/Basic-Pay/EM/",
     "effective": "2026-01-01", "feeds": ["Enlisted basic pay (E-1 to E-9, all years of service)", "High-3 pension"]},
    {"id": "dtmo-cola-indices", "file": COLA_XLS.name, "agency": "Defense Travel Management Office (DTMO)",
     "title": "Overseas COLA indexes, changes effective 1 November 2026",
     "effective": "2026-11-01",
     "officialUrl": "https://www.travel.dod.mil/Allowances/Overseas-Cost-of-Living-Allowance/Overseas-COLA-Tables",
     "feeds": ["Overseas COLA index for each overseas station"]},
    {"id": "dtmo-cola-spendable", "file": SPENDABLE_PDF.name, "agency": "Defense Travel Management Office (DTMO)",
     "title": "COLA average annual spendable income table, effective February 1, 2026",
     "officialUrl": "https://www.travel.dod.mil/Allowances/Overseas-Cost-of-Living-Allowance/Overseas-COLA-Tables",
     "effective": "2026-02-01", "feeds": ["Overseas COLA (spendable income by compensation and dependents)"]},
]


def update_manifest(results: dict, cola: dict) -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    by_id = {d["id"]: d for d in manifest["documents"]}
    gb = cola["indices"].get("raf_alconbury_uk") or {}
    values = {
        "dtmo-bah-2026": [
            {"label": f"{e['mhaName']} ({e['mha']}) · E-7", "value": f"${e['withoutDependents']['E-7']:,.2f} without / ${e['withDependents']['E-7']:,.2f} with dependents"}
            for e in {e["mha"]: e for e in results["pay"]["bah"].values() if e and e.get("mha")}.values()
        ],
        "dfas-pay-2026": [
            {"label": f"E-7 over {c} years", "value": f"${results['pay']['basicPayMonthly']['E-7'][c]:,.2f}/mo"}
            for c in ("10", "12", "14", "16", "18", "20")
        ],
        "dtmo-cola-indices": [
            {"label": f"{gb.get('country')} — {gb.get('locality')} (GB001)", "value": f"index {gb.get('index'):.0f}, effective {gb.get('effective')}"},
        ] + ([{"label": "Locality includes", "value": gb["note"]}] if gb.get("note") else []),
        "dtmo-cola-spendable": [
            {"label": f"Annual compensation {'≥ $' + format(b['compensationLow'], ',') if b['compensationHigh'] is None else ('≤ $' + format(b['compensationHigh'], ',') if b['compensationLow'] == 0 else '$' + format(b['compensationLow'], ',') + '–$' + format(b['compensationHigh'], ','))}",
             "value": f"${b['spendableIncome'][0]:,} (0 dependents) · ${b['spendableIncome'][1]:,} (1)"}
            for b in cola["spendableIncome"][-6:]
        ],
    }
    for doc in DOCS:
        entry = by_id.get(doc["id"], {})
        entry.update({**doc, "status": "retrieved", "retrieved": "2026-11-25",
                      "retrievedBy": "Official file supplied by the plan owner (downloaded from the agency site)",
                      "sha256": sha256(SRC / doc["file"]), "values": values.get(doc["id"], [])})
        entry.pop("statusNote", None)
        by_id[doc["id"]] = entry
    # The old placeholders this replaces.
    by_id.pop("dtmo-cola-gb001", None)
    if ANNUAL_COMP_CSV.exists():
        e7 = [r for r in cola["annualCompensationRows"] if r["grade"] == "E-7" and r["yos"] in (10, 12, 14, 16)]
        by_id["dtmo-cola-annual-comp"] = {
            "id": "dtmo-cola-annual-comp", "agency": "Defense Travel Management Office (DTMO) — reconstructed",
            "title": "COLA annual compensation table, effective January 1, 2026 (FMR Vol. 7A, ch. 68, Table 68-8)",
            "detail": ("DTMO's file couldn't be downloaded from this environment, so this table was rebuilt and verified: "
                       "values transcribed from a published calculator that cites DTMO's 2026 tables; that source's "
                       "spendable-income table matches DTMO's official PDF in all 210 cells; every row minus official "
                       "DFAS basic pay and BAS leaves a smooth BAH + tax-advantage amount (DoD's RMC definition); and "
                       "grade levels agree with DoD's 2026 average RMC (CRS IF10532)."),
            "officialUrl": "https://www.travel.dod.mil/Allowances/Overseas-Cost-of-Living-Allowance/Overseas-COLA-Tables",
            "effective": "2026-01-01", "retrieved": "2026-11-25", "retrievedBy": "Reconstructed and cross-checked (see detail)",
            "file": ANNUAL_COMP_CSV.name, "sha256": sha256(ANNUAL_COMP_CSV), "status": "reconstructed",
            "values": [{"label": f"E-7 over {r['yos']} years", "value": f"${r['withoutDependents']:,} without / ${r['withDependents']:,} with dependents"} for r in e7],
            "feeds": ["Overseas COLA (which spendable-income row applies)"],
        }
    else:
        by_id["dtmo-cola-annual-comp"] = {
            "id": "dtmo-cola-annual-comp", "agency": "Defense Travel Management Office (DTMO)",
            "title": "COLA annual compensation table (by grade and years of service), 2026",
            "officialUrl": "https://www.travel.dod.mil/Allowances/Overseas-Cost-of-Living-Allowance/Overseas-COLA-Tables",
            "status": "not_retrieved",
            "statusNote": "Needed to place each grade/years-of-service in a spendable-income band. Overseas COLA pays $0 "
                          "(flagged 'official rate missing') until it is attached; the index and spendable income tables are in.",
            "feeds": ["Overseas COLA"],
        }
    order = ["dtmo-oha-gb001", "dtmo-bah-2026", "dfas-pay-2026", "dtmo-cola-indices", "dtmo-cola-spendable",
             "va-post911-2026-27", "dtmo-cola-annual-comp"]
    manifest["documents"] = [by_id[i] for i in order if i in by_id] + [d for i, d in by_id.items() if i not in order]
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    check = "--check" in sys.argv
    pay = json.loads(PAY_JSON.read_text(encoding="utf-8"))
    bah = import_bah(pay)
    enlisted = import_enlisted_pay(pay)
    cola = import_cola()
    outputs = {
        PAY_JSON: json.dumps(pay, indent=2) + "\n",
        COLA_JSON: json.dumps(cola, indent=2, ensure_ascii=False) + "\n",
    }
    if check:
        stale = [p.name for p, text in outputs.items() if not p.exists() or p.read_text(encoding="utf-8") != text]
        if stale:
            raise SystemExit(f"Out of date — run scripts/import_official_rates.py: {', '.join(stale)}")
        print("Official data is up to date.")
        return
    for path, text in outputs.items():
        path.write_text(text, encoding="utf-8")
    update_manifest({"pay": pay}, cola)
    print(f"BAH: {len(bah['changed'])} value(s) changed from the previous copy")
    for line in bah["changed"][:20]:
        print("   ", line)
    print(f"Enlisted basic pay: {len(enlisted['changed'])} value(s) changed")
    for line in enlisted["changed"][:20]:
        print("   ", line)
    gb = cola["indices"]["raf_alconbury_uk"]
    print(f"COLA index GB001: {gb['index']} effective {gb['effective']}; {len(cola['spendableIncome'])} spendable bands;"
          f" annual compensation rows: {len(cola['annualCompensationRows'])}")


if __name__ == "__main__":
    main()
