#!/usr/bin/env python3
"""Build web/dist/app-template.html — the whole SPA as one self-contained file.

Inlines the (single) JS chunk, the stylesheet, and the favicon from a finished
`vite build`, and plants the `/*__EMBEDDED_STATE__*/` placeholder the running
app fills with the user's data at export time (ExportScreen). The template
itself carries no user data, so it is safe to publish with the site.

Run after `npm run build` (wired into `build:full` and the Pages deploy).
"""

from __future__ import annotations

import base64
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "web" / "dist"

PLACEHOLDER = '<script>window.__EMBEDDED__=null;/*__EMBEDDED_STATE__*/</script>'


def main() -> int:
    index = DIST / "index.html"
    if not index.exists():
        print("error: web/dist/index.html not found — run `npm run build` first", file=sys.stderr)
        return 1
    html = index.read_text(encoding="utf-8")

    script_match = re.search(r'<script type="module" crossorigin src="([^"]+)"></script>', html)
    style_match = re.search(r'<link rel="stylesheet" crossorigin href="([^"]+)">', html)
    if not script_match or not style_match:
        print("error: could not locate the built script/style tags in index.html", file=sys.stderr)
        return 1

    js = (DIST / "assets" / Path(script_match.group(1)).name).read_text(encoding="utf-8")
    escapes = js.count("</script")
    if escapes:
        print(f"warning: escaped {escapes} '</script' occurrence(s) inside the JS bundle")
        js = js.replace("</script", "<\\/script")
    html = html.replace(
        script_match.group(0),
        f"{PLACEHOLDER}\n    <script type=\"module\">{js}</script>",
    )

    css = (DIST / "assets" / Path(style_match.group(1)).name).read_text(encoding="utf-8")
    html = html.replace(style_match.group(0), f"<style>{css}</style>")

    icon_match = re.search(r'<link rel="icon" type="image/svg\+xml" href="([^"]+)" />', html)
    if icon_match:
        icon = (DIST / Path(icon_match.group(1)).name).read_bytes()
        data_uri = "data:image/svg+xml;base64," + base64.b64encode(icon).decode("ascii")
        html = html.replace(icon_match.group(1), data_uri)

    out = DIST / "app-template.html"
    out.write_text(html, encoding="utf-8")
    print(f"app-template.html: {out.stat().st_size:,} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
