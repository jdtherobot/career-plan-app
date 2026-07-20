# Website prompt — add "Launch app →" to the Career Plan project page

Paste everything inside the fenced block into a Claude session working on the
website repo (`jdtherobot.github.io`).

````markdown
Add a prominent "Launch app →" button for the Career Plan planner to the existing
project page at /projects/career-plan-app, matching site conventions exactly.

**Context.** The planner is a separate repo — github.com/jdtherobot/career-plan-app
(lowercase; recently renamed from Career-Plan-app) — deployed via GitHub Pages at
https://britt.gg/career-plan-app/ (project pages inherit the site's custom domain
from CNAME). The Python projection engine runs entirely in the browser via Pyodide;
there is no backend, and anything a visitor enters stays in their own browser
(IndexedDB). The public build ships sanitized demo data with a rank/TAFMS/location
service-profile picker; JD runs his real data locally only.

**Edit 1 — src/content/projects.ts.** Add an optional `liveUrl` field to the
Project type and set it on the career-plan-app entry. Current type:

```ts
export type Project = {
  slug: string
  title: string
  tagline: string
  github: string
  tags: string[]
  docs: ProjectDoc[]
}
```

Current entry (also fix the `github` URL casing to the renamed lowercase repo):

```ts
{
  slug: 'career-plan-app',
  title: 'Career Plan Codex',
  tagline:
    'A deterministic 50-year career-path financial planner that runs entirely in the browser via Pyodide.',
  github: 'https://github.com/jdtherobot/Career-Plan-app',
  tags: ['React', 'TypeScript', 'Pyodide'],
  docs: [{ docSlug: 'overview', title: 'Overview', file: 'README.md' }],
},
```

Add `liveUrl?: string` to the type, and on this entry set
`liveUrl: 'https://britt.gg/career-plan-app/'` and
`github: 'https://github.com/jdtherobot/career-plan-app'`.

**Edit 2 — src/pages/ProjectPage.tsx.** The header actions row currently renders
an outline GitHub button followed by tags:

```tsx
<div className="rv" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
  <Button href={project.github} variant="outline" target="_blank" rel="noreferrer noopener">
    View on GitHub →
  </Button>
  {project.tags.map((t) => (<Tag key={t}>{t}</Tag>))}
</div>
```

When `project.liveUrl` exists, render a primary Button FIRST in this row:

```tsx
{project.liveUrl && (
  <Button href={project.liveUrl} variant="primary" target="_blank" rel="noreferrer noopener">
    Launch app →
  </Button>
)}
```

The existing Button component (src/components/Button.tsx) already supports this:
`variant?: 'primary' | 'outline'`, renders `<a>` when `href` is set, and primary is
`background: var(--gold)` with `color: var(--btn-text)` (carbon ink, 7.8:1, identical
in day/night modes). This follows the design system's core rule — gold is a material,
not an ink: primary buttons are gold FILL with carbon text. Use the component as-is;
do not invent new styles.

Optional: on the Landing project card (src/pages/Landing.tsx, the `PROJECTS.map`
grid — each card is a plain `<Link>` ending with
`<span className="stencil">Read the writeup →</span>`), you may add a second subtle
stencil-style "Launch →" affordance for projects with `liveUrl`. Keep it stencil
class (not a Button) and don't let it fight the card's Link navigation. Skip it if
it complicates the card.

**Edit 3 — refresh src/content/readmes/career-plan-app/README.md** (the baked local
doc rendered on the project page). Rewrite it as a visitor-facing overview (drop the
repo-internal dev/deploy sections) covering:
- In-browser Python engine via Pyodide — no backend, no account; visitor data stays in their browser
- Live app: https://britt.gg/career-plan-app/
- 129 passing Python tests (unit, golden-master, schema/migration, exporter, and
  money-invariant suites). Do NOT claim native↔Pyodide parity is tested — the
  fixture ships but the browser-side assertion is not wired up.
- Composable month-level path builder — assemble any sequence of career segments
- Full retirement lifecycle: High-3 pension, 36-month GI Bill ledger, Social Security
  with claim-age factors, RMDs, Medicare at 65, account-level drawdown
- Researched cost-of-living reference data
- Public build ships a sanitized demo profile with a rank/TAFMS/location
  service-profile picker; include "download and run locally with your own data" instructions
- End with, verbatim: "Deterministic planning estimate with simplified effective-rate
  taxes — not financial advice."

**Acceptance checks:**
1. /projects/career-plan-app shows the gold "Launch app →" button in the header; it opens https://britt.gg/career-plan-app/ in a new tab.
2. Other project pages unchanged (no button when `liveUrl` is absent).
3. Matches site look in day + night modes at mobile and desktop widths (the actions row already flex-wraps).
4. `npm run build` passes.
````
