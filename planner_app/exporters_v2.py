"""V2 exports: multi-path XLSX workbook and standalone HTML comparison.

Both consume a `compute()` result (planner_app.api) so exports always match the
dashboard, and both embed the deterministic input hash to detect drift. Used
natively (tests, CLI) and in the browser via Pyodide (openpyxl installed via
micropip on first use).
"""

from __future__ import annotations

import base64
import io
import json
from typing import Any

ANNUAL_COLUMNS = [
    ("calendarYear", "Year"),
    ("age", "Age"),
    ("phaseLabel", "Phase"),
    ("grossIncome", "Gross income"),
    ("taxFreeIncome", "Tax-free income"),
    ("totalIncome", "Total income"),
    ("taxes", "Taxes"),
    ("healthcareCost", "Healthcare"),
    ("livingExpenses", "Living expenses"),
    ("retirementSavings", "Contributions"),
    ("employerMatch", "Employer match"),
    ("netCashFlow", "Net cash flow"),
    ("unfundedSpending", "Unfunded spending"),
    ("portfolio", "Portfolio"),
]

METRIC_ROWS = [
    ("finalPortfolio", "Final portfolio (nominal)"),
    ("finalPortfolioReal", "Final portfolio (real 2026$)"),
    ("totalGrossIncome", "Lifetime gross income"),
    ("totalTaxFreeIncome", "Lifetime tax-free income"),
    ("totalTaxes", "Lifetime taxes"),
    ("totalHealthcareCost", "Lifetime healthcare"),
    ("totalEmployerMatch", "Lifetime employer match"),
    ("lifetimePensionValue", "Lifetime pension paid"),
    ("lifetimeSocialSecurity", "Lifetime Social Security"),
    ("totalUnfundedSpending", "Unfunded spending"),
    ("pensionStartYear", "Pension starts"),
    ("ssStartYear", "Social Security starts"),
    ("withdrawalEligibleYear", "Retirement withdrawals eligible"),
    ("depletionAge", "Portfolio depletion age"),
]


def build_comparison_workbook(result: dict[str, Any]) -> bytes:
    """One Comparison sheet + one annual sheet per path + Sources."""
    from openpyxl import Workbook
    from openpyxl.styles import Font
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    bold = Font(bold=True)

    ws = wb.active
    ws.title = "Comparison"
    scenarios = result["scenarios"]
    ws.cell(row=1, column=1, value="Metric").font = bold
    for col, entry in enumerate(scenarios, start=2):
        ws.cell(row=1, column=col, value=entry["scenarioName"]).font = bold
    for row_idx, (key, label) in enumerate(METRIC_ROWS, start=2):
        ws.cell(row=row_idx, column=1, value=label)
        for col, entry in enumerate(scenarios, start=2):
            ws.cell(row=row_idx, column=col, value=entry["metrics"].get(key))
    note_row = len(METRIC_ROWS) + 3
    ws.cell(row=note_row, column=1, value=f"Input hash: {result.get('inputHash', '')}")
    for col in range(1, len(scenarios) + 2):
        ws.column_dimensions[get_column_letter(col)].width = 30 if col == 1 else 18

    for entry in scenarios:
        sheet = wb.create_sheet(title=entry["scenarioName"][:31] or entry["scenarioId"][:31])
        for col, (_, header) in enumerate(ANNUAL_COLUMNS, start=1):
            sheet.cell(row=1, column=col, value=header).font = bold
            sheet.column_dimensions[get_column_letter(col)].width = 15
        for row_idx, row in enumerate(entry["projection"], start=2):
            for col, (key, _) in enumerate(ANNUAL_COLUMNS, start=1):
                sheet.cell(row=row_idx, column=col, value=row.get(key))

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def export_comparison_xlsx_b64(result_json: str) -> str:
    """Pyodide-friendly wrapper: JSON string in, base64 XLSX out."""
    return base64.b64encode(build_comparison_workbook(json.loads(result_json))).decode("ascii")


def _fmt(value: Any) -> str:
    if value is None:
        return "—"
    if isinstance(value, (int, float)):
        return f"${value:,.0f}" if abs(value) >= 1000 else f"{value:,.0f}"
    return str(value)


PATH_COLORS = ["#2E8B57", "#B07818", "#2F6D9E", "#7A4E8B"]


def build_comparison_html(result: dict[str, Any]) -> str:
    """Self-contained responsive HTML report of the compared paths."""
    scenarios = result["scenarios"]
    comparison = result.get("comparison", {})

    cards = []
    for idx, entry in enumerate(scenarios):
        color = PATH_COLORS[idx % len(PATH_COLORS)]
        m = entry["metrics"]
        rows = "".join(
            f"<tr><td>{label}</td><td>{_fmt(m.get(key))}</td></tr>"
            for key, label in METRIC_ROWS
        )
        cards.append(
            f"""<section class="card"><h2><span class="dot" style="background:{color}"></span>{entry['scenarioName']}</h2>
            <p class="big">{_fmt(m.get('finalPortfolioReal'))} <span class="muted">real 2026$</span></p>
            <table>{rows}</table></section>"""
        )

    callouts = []
    for item in comparison.get("comparisons", []):
        driver = item.get("biggestDriver", {})
        callouts.append(
            f"<li><strong>{item['scenarioId']}</strong> vs baseline: "
            f"final delta {_fmt(item['finalPortfolioDelta'])} (nominal); "
            f"biggest driver {driver.get('label', '—')} ({_fmt(driver.get('cumulativeDelta'))}); "
            f"breakeven {item.get('breakevenYear') or 'never'}</li>"
        )

    annual_tables = []
    for entry in scenarios:
        head = "".join(f"<th>{header}</th>" for _, header in ANNUAL_COLUMNS)
        body = "".join(
            "<tr>" + "".join(f"<td>{_fmt(row.get(key))}</td>" for key, _ in ANNUAL_COLUMNS) + "</tr>"
            for row in entry["projection"]
        )
        annual_tables.append(
            f"""<details><summary>{entry['scenarioName']} — annual detail</summary>
            <div class="scroll"><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div></details>"""
        )

    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Career path comparison</title>
<style>
body{{font-family:-apple-system,'Public Sans',Segoe UI,sans-serif;margin:0;padding:24px;background:#F7F6F2;color:#1A1D21;line-height:1.5}}
h1{{font-size:26px;margin:0 0 4px}} .sub{{color:#5a5f66;margin:0 0 20px;font-size:14px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-bottom:24px}}
.card{{background:#fff;border:1px solid #e2e0da;border-radius:10px;padding:16px}}
.card h2{{font-size:16px;margin:0 0 6px;display:flex;align-items:center;gap:8px}}
.dot{{width:10px;height:10px;border-radius:50%;display:inline-block}}
.big{{font-size:26px;font-weight:600;margin:4px 0 12px}} .muted{{color:#8a8f96;font-size:13px;font-weight:400}}
table{{width:100%;border-collapse:collapse;font-size:13px}}
td,th{{padding:4px 8px;border-bottom:1px solid #efede8;text-align:right}}
td:first-child,th:first-child{{text-align:left}}
ul{{background:#fff;border:1px solid #e2e0da;border-radius:10px;padding:16px 32px;font-size:14px}}
details{{background:#fff;border:1px solid #e2e0da;border-radius:10px;padding:12px 16px;margin:12px 0}}
summary{{cursor:pointer;font-weight:600;font-size:14px}}
.scroll{{overflow-x:auto;margin-top:8px}} .scroll table{{min-width:900px}}
footer{{color:#8a8f96;font-size:12px;margin-top:24px}}
</style></head><body>
<h1>Career path comparison</h1>
<p class="sub">Deterministic 50-year projection · real (2026$) headline values · generated by Career Plan Codex</p>
<div class="grid">{''.join(cards)}</div>
<ul>{''.join(callouts)}</ul>
{''.join(annual_tables)}
<footer>Input hash {result.get('inputHash', '')} · Planning estimate with simplified effective-rate taxes — not financial advice.</footer>
</body></html>"""


def export_comparison_html(result_json: str) -> str:
    return build_comparison_html(json.loads(result_json))
