"""Tests: the single-file app template is self-contained and injectable.

The template only exists after `npm run build && npm run build:single`; these
tests skip when it is absent (e.g. Python-only CI runs) so the native suite
stays runnable without a web toolchain.
"""

from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "web" / "dist" / "app-template.html"
PLACEHOLDER = "/*__EMBEDDED_STATE__*/"

# Hosts the exported file is allowed to reach (fonts + the Pyodide runtime),
# plus inert string constants that never become requests.
ALLOWED_HOSTS = {
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "cdn.jsdelivr.net",
    "britt.gg",  # header links back to the owner's site (navigation, not assets)
    "www.w3.org",  # SVG xmlns namespace identifiers
    "react.dev",  # React's minified-error documentation URLs
}


@unittest.skipUnless(TEMPLATE.exists(), "app-template.html not built (run npm run build:full)")
class SingleFileTemplateTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.html = TEMPLATE.read_text(encoding="utf-8")

    def test_placeholder_present_exactly_once(self) -> None:
        self.assertEqual(self.html.count(PLACEHOLDER), 1)
        self.assertIn("window.__EMBEDDED__=null;" + PLACEHOLDER, self.html)

    def test_no_local_asset_references_remain(self) -> None:
        self.assertNotRegex(self.html, r'src="[^"]*/assets/')
        self.assertNotRegex(self.html, r'href="[^"]*/assets/')
        self.assertNotIn('rel="stylesheet" crossorigin href=', self.html)

    def test_only_expected_external_hosts(self) -> None:
        hosts = {
            re.match(r"https?://([^/]+)", url).group(1)
            for url in re.findall(r'https?://[^"\'\s\\)]+', self.html)
        }
        self.assertLessEqual(hosts, ALLOWED_HOSTS, f"unexpected external hosts: {hosts - ALLOWED_HOSTS}")

    def test_size_budget(self) -> None:
        self.assertLess(TEMPLATE.stat().st_size, 900_000, "template exceeded its size budget")

    def test_state_injection_contract(self) -> None:
        """Synthesize an export exactly the way ExportScreen does and verify it
        stays parseable — pins the escaping rules without a browser."""
        from planner_app.api import bootstrap_data, compute, default_payload

        payload = default_payload()
        bundle = {
            "version": 1,
            "exportedAt": "2026-07-19T00:00:00Z",
            "payload": payload,
            "results": compute(payload),
            "bootstrap": bootstrap_data(),
            "uiPrefs": {"theme": "dark", "chartsEnabled": ["net_cf"], "realDollars": True, "panelBrightness": 25},
            "zipB64": "UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==",  # empty zip stand-in
        }
        injected_json = json.dumps(bundle).replace("<", "\\u003c")
        exported = self.html.replace(PLACEHOLDER, f"window.__EMBEDDED__={injected_json};")

        self.assertNotIn(PLACEHOLDER, exported)
        # The document's script structure must survive the injection: the payload
        # may not introduce any new tag-opening sequence.
        self.assertEqual(exported.count("<script"), self.html.count("<script"))
        self.assertEqual(exported.count("</script"), self.html.count("</script"))
        # And the embedded JSON must round-trip.
        match = re.search(r"window\.__EMBEDDED__=(\{.*?\});</script>", exported, re.DOTALL)
        self.assertIsNotNone(match)
        recovered = json.loads(match.group(1))
        self.assertEqual(recovered["results"]["inputHash"], bundle["results"]["inputHash"])


if __name__ == "__main__":
    unittest.main()
