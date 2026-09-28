# Dashboard Visual Parity / Responsive Polish

Status: **TESTED / MERGED — dashboard visual/responsive implementation closed in PR #95.**

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
- the question list uses one responsive DOM: touch-friendly compact rows/cards on mobile and table-like columns on larger screens, avoiding duplicated hidden markup;
- no Question Bank ownership, workflow, import, Media or Taxonomy contract changes.

### School Director
- overview metrics use two columns on phones and four on larger screens;
- add-student controls avoid a five-column tablet squeeze;
- the student roster uses one responsive DOM that reads as cards/grid on phone/tablet and as a table-like four-column control surface on desktop;
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

## Pre-final exact-head evidence

PR #95 candidate head `a38903f7eb68ca5ca89fe81847587425867c4647` passed all four standard gates before this final evidence note:

- Database CI `36456231779`: success.
- Backend CI `36456231816`: success.
- Frontend CI `36456231895`: success.
- Frontend E2E `36456231890`: success, **71/71** Playwright tests.
- Browser evidence artifact `10986220082`, digest `sha256:cd0ba9e091b8aca8f93820e8406cfc600a2ae3980b00b98082490a59b788c184`.
- Start/final-pre-doc legacy checkpoint is still `983b004d18818166bf97c9096411e2707551a0bd`; no newer legacy delta exists at this checkpoint.
- Implementation `main` remained `604e4dde0090a28e4056922a909301890e3df038` while the candidate was tested, so no base drift existed at this checkpoint.

The first responsive implementation produced duplicated hidden mobile/desktop roster/list markup, which Playwright correctly rejected through strict locators. The implementation was corrected to single responsive DOMs rather than weakening selectors or tests. A later mobile drawer strict-locator failure was also fixed by scoping the assertion to the visible drawer. These failures are not counted as green evidence.

Because this documentation note changes the PR head, the new documentation-inclusive exact head must pass the same four gates again before merge.

## Closure rule

Change this document to **TESTED / MERGED** only after the same final documentation-inclusive implementation SHA passes:
- Database CI
- Backend CI
- Frontend CI
- Frontend E2E

Then re-check the latest legacy delta, merge the implementation PR, and close with an independent documentation PR that itself passes all four gates.

`PARITY_PROVEN` remains prohibited until the remaining external release-evidence phases are complete.

## Implementation closure evidence

PR #95 is **TESTED / MERGED**.

- Final documentation-inclusive implementation head: `a433317689e7b1d72a8c49c72efb6de959bf8556`.
- Database CI `36456757788`: success.
- Backend CI `36456757826`: success.
- Frontend CI `36456757781`: success.
- Frontend E2E `36456757889`: success, **71/71** Playwright tests.
- Browser evidence artifact `10986680576`, digest `sha256:1c734174c2eb76d7eeaddbbf31f11b42d73ae2ccb500093a090ced068e7a87fc`.
- Squash merge: `02cbe52ee69f786b925c50284b4eb864ff2305f1`.
- Final pre-merge legacy re-check: `983b004d18818166bf97c9096411e2707551a0bd`; legacy had not moved.
- `main` had no base drift before the exact-head merge.

This closes the user-requested **dashboard/control-panel visual phase**. The public/general site was intentionally not redesigned. The result is `TESTED / MERGED`, not `PARITY_PROVEN`; live external/staging provider proof, production-equivalent load/bandwidth, dated backup/restore and unresolved policy/release evidence remain separate gates.

This file is part of the required independent documentation-closure PR. That documentation PR must itself pass Database CI, Backend CI, Frontend CI and Frontend E2E before merge.
