"""Official documents ship with the app and match the numbers the engine uses."""

from __future__ import annotations

import hashlib
import json
import unittest
from pathlib import Path

from planner_app.api import bootstrap_data

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "official_sources" / "manifest.json").read_text(encoding="utf-8"))


class OfficialSourcesTest(unittest.TestCase):
    def test_retrieved_files_exist_and_match_checksums(self) -> None:
        for doc in MANIFEST["documents"]:
            if doc["status"] != "retrieved":
                continue
            data = (ROOT / "official_sources" / doc["file"]).read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(), doc["sha256"], doc["id"])

    def test_pending_documents_explain_why(self) -> None:
        for doc in MANIFEST["documents"]:
            if doc["status"] != "retrieved":
                self.assertTrue(doc.get("statusNote"), doc["id"])

    def test_engine_uses_the_dtmo_oha_document_values(self) -> None:
        domains = bootstrap_data()["referenceDomains"]
        row = next(r for r in domains["oha_rates"] if r["id"] == "raf_alconbury_uk:E-7:without")
        self.assertEqual((row["rentLocal"], row["uaLocal"], row["mihaLocal"]), (1627.20, 623.25, 502.00))
        station = next(r for r in domains["overseas_allowances"] if r["id"] == "raf_alconbury_uk")
        self.assertEqual(station["roeLocalPerUsd"], 0.7239)
        # DTMO's own USD column: 1627.20 / 0.7239 = 2247.82
        self.assertAlmostEqual(1627.20 / station["roeLocalPerUsd"], 2247.82, delta=0.01)

    def test_engine_uses_the_va_document_values(self) -> None:
        text = (ROOT / "official_sources" / "va_post911_gi_bill_rates_2026-27.txt").read_text(encoding="utf-8")
        self.assertIn("$30,908.34", text)
        self.assertIn("$2,396", text)
        rules = json.loads((ROOT / "planner_app" / "data_education_benefits_2026.json").read_text())["rules"]
        self.assertEqual(rules["tuitionCapPrivateForeignAnnual"], 30908.34)
        self.assertEqual(rules["foreignMhaMonthly"], 2396.0)

    def test_bootstrap_exposes_documents(self) -> None:
        ids = [d["id"] for d in bootstrap_data()["officialSources"]]
        self.assertIn("dtmo-oha-gb001", ids)


if __name__ == "__main__":
    unittest.main()
