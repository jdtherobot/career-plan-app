/* Builds the single-page HTML report: ReportView rendered to static markup,
   wrapped in a shell that inlines the app's full stylesheet so the file looks
   exactly like the live site (theme, panel brightness, charts included). */

import { renderToStaticMarkup } from "react-dom/server";
import css from "../theme.css?inline";
import { StaticStateProvider, type AppState } from "../state/store";
import { ReportView } from "./ReportView";

/* Report-only layout: no app shell/sidebar, natural page scroll, printable. */
const REPORT_CSS = `
.report{max-width:1240px;margin:0 auto;padding:28px 28px 56px}
.report .table-scroll{overflow-x:auto;max-height:none}
.report-annual{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin:12px 0}
.report-annual summary{cursor:pointer;font-weight:600;font-size:14px}
.report-annual .table-scroll{margin-top:10px}
.report-footer{color:var(--ink-3);font-size:12px;margin-top:32px;border-top:1px solid var(--line-2);padding-top:12px}
@media print{.report{max-width:none;padding:0}}
`;

export function buildReportHtml(state: AppState): string {
  const generatedAt = new Date().toISOString().slice(0, 10);
  const markup = renderToStaticMarkup(
    <StaticStateProvider state={state}>
      <ReportView generatedAt={generatedAt} />
    </StaticStateProvider>,
  );
  // Same mapping as applyPanelBrightness (store.tsx), inlined on the root.
  const mix = (2 + (Math.min(Math.max(state.panelBrightness, 0), 100) / 100) * 12).toFixed(1);
  return `<!doctype html>
<html lang="en" data-theme="${state.theme}" style="--panel-mix:${mix}%">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Career Plan Codex — report ${generatedAt}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Space+Grotesk:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${css}</style>
<style>${REPORT_CSS}</style>
</head>
<body>${markup}</body>
</html>`;
}
