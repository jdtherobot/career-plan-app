"""Tests: V2 exports open correctly and match the compute() result."""

from __future__ import annotations

import io
import json
import unittest

from openpyxl import load_workbook

from planner_app.api import compute, default_payload
from planner_app.exporters_v2 import (
    build_comparison_html,
    build_comparison_workbook,
    export_comparison_xlsx_b64,
)


class ExporterV2Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.result = compute(default_payload())

    def test_workbook_has_comparison_and_per_path_sheets(self) -> None:
        data = build_comparison_workbook(self.result)
        wb = load_workbook(io.BytesIO(data))
        self.assertEqual(wb.sheetnames[0], "Comparison")
        self.assertEqual(len(wb.sheetnames), 1 + len(self.result["scenarios"]))
        comparison = wb["Comparison"]
        self.assertEqual(comparison.cell(row=1, column=2).value, "Path A")
        # Final portfolio row matches the metrics exactly.
        final_row = 2  # first metric row
        self.assertAlmostEqual(
            comparison.cell(row=final_row, column=2).value,
            self.result["scenarios"][0]["metrics"]["finalPortfolio"],
        )

    def test_annual_sheet_matches_projection(self) -> None:
        data = build_comparison_workbook(self.result)
        wb = load_workbook(io.BytesIO(data))
        sheet = wb["Path A"]
        first = self.result["scenarios"][0]["projection"][0]
        self.assertEqual(sheet.cell(row=2, column=1).value, first["calendarYear"])
        self.assertAlmostEqual(sheet.cell(row=2, column=14).value, first["portfolio"])
        self.assertEqual(sheet.max_row, 1 + len(self.result["scenarios"][0]["projection"]))

    def test_b64_wrapper_roundtrips(self) -> None:
        import base64
        payload = export_comparison_xlsx_b64(json.dumps(self.result))
        wb = load_workbook(io.BytesIO(base64.b64decode(payload)))
        self.assertIn("Comparison", wb.sheetnames)

    def test_html_contains_paths_hash_and_tables(self) -> None:
        html = build_comparison_html(self.result)
        for entry in self.result["scenarios"]:
            self.assertIn(entry["scenarioName"], html)
        self.assertIn(self.result["inputHash"], html)
        self.assertIn("annual detail", html)
        self.assertIn("not financial advice", html)


if __name__ == "__main__":
    unittest.main()
