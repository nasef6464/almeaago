# Dashboard Visual Parity / Responsive Polish

Status: **CANDIDATE — dashboard-only visual refinement; exact-head four-gate CI pending.**

## Product direction

The public/general site presentation is intentionally left unchanged in this batch. The requested focus is the control-panel experience itself: dashboards, their navigation, forms, metrics, tables/cards and internal actions.

The accepted visual baseline remains the legacy ALMEAA product, but this batch has explicit product approval to make dashboard-only refinements when they are clearer, calmer and easier to use without changing domain behavior. These refinements are therefore intentional UX changes, not silent parity drift.

Primary requirement: the same dashboard work must remain usable on mobile, tablet and desktop.

## Baseline evidence

Legacy dashboard references are retained in the existing deep-premerge artifact `10871551058`, including:
- `ui-audit-exhaustive/deep-premerge-roles-36148975277/admin/desktop-_admin-dashboard_tab_paths.png`
- `ui-audit-exhaustive/deep-premerge-roles-36148975277/admin/mobile-_admin-dashboard_tab_paths.png`
- `ui-audit-exhaustive/deep-premerge-report-actions-36148975277/admin/desktop-reports-actions.png`
- `ui-audit-exhaustive/deep-premerge-supervisor-school-36148975277/desktop-supervisor-overview.png`
- `ui-audit-exhaustive/deep-premerge-question-editor-36148975277/question-list-inline-media.png`

V2 already had deterministic desktop/mobile screenshots for Content, Question Bank, Taxonomy, Operations, School Director, Smart Classroom, AI and other domain surfaces. This batch extends that evidence to dashboard-specific tablet checkpoints.

## Dashboard changes in this batch

### Shared admin shell
- replaces decorative placeholder bars in the top navigation with the actual active dashboard section;
- keeps the legacy-style right administration rail, but separates working routes from future/migrating sections;
- future sections are collapsed under **أقسام قيد النقل** by default instead of competing visually with active tools;
- makes the desktop rail sticky and bounds the mobile drawer to the viewport;
- exposes the active section name in the mobile/tablet content header;
- increases internal content padding progressively without changing the public site shell.

### Question Bank
- summary metrics use a denser two-column mobile / three-column tablet / six-column desktop layout;
- filters avoid a cramped four-column tablet arrangement;
- the question list becomes touch-friendly cards on mobile while retaining the dense table on larger screens;
- no Question Bank ownership, workflow, import, Media or Taxonomy contract changes.

### School Director
- overview metrics use two columns on phones and four on larger screens;
- add-student controls avoid a five-column tablet squeeze;
- student roster uses cards through tablet widths and the full table only on desktop;
- delegated class/status/edit controls remain available in the responsive card layout;
- no school authority or permission boundary changes.

### Other control panels
- Taxonomy metrics use two mobile columns rather than one long stack;
- Assessment filters stay two-column through tablet and expand only on wide desktop;
- Notifications cards use tighter mobile spacing while preserving all campaign/template controls.

## Responsive acceptance

Deterministic Playwright coverage verifies:
- 390px mobile dashboard layout has no page-level horizontal overflow;
- the mobile admin drawer exposes active routes first and keeps unfinished routes collapsed;
- 820px tablet Question Bank stays readable without horizontal page overflow;
- 820px populated School Director dashboard uses the responsive roster card treatment without horizontal page overflow;
- existing 1440px dashboard journeys continue to use the full desktop information density.

Horizontal scrolling remains allowed only inside explicitly bounded data regions where a wide desktop table is the intentional control; the page itself must not overflow.

## Non-goals

This batch does not redesign the public site, landing/auth flow, learner learning-space presentation, assessment runner, checkout or projector experience.

It also does not claim live-provider/staging proof, production-equivalent load, dated backup/restore or final production certification.

## Closure rule

Change this document to **TESTED / MERGED** only after the same final documentation-inclusive implementation SHA passes:
- Database CI
- Backend CI
- Frontend CI
- Frontend E2E

Then re-check the latest legacy delta, merge the implementation PR, and close with an independent documentation PR that itself passes all four gates.

`PARITY_PROVEN` remains prohibited until the remaining external release-evidence phases are complete.
