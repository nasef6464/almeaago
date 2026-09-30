# Exact Legacy Learner Reports — UI-3 Implementation Certificate

Status: **IMPLEMENTATION CANDIDATE — FINAL FOUR-GATE EXACT-HEAD VERIFICATION PENDING**

## Identity
- UI phase: UI-3 Learning experience parity.
- Protected surface: `/reports` learner view.
- Legacy source checkpoint: `77761835d464687283f7ca9d65f43799ccd43962`.
- Legacy sources read before implementation:
  - `pages/Reports.tsx`;
  - `pages/Reports/reportDomain.ts`;
  - `pages/Reports/studentAnalyticsViewModel.ts`;
  - `pages/Reports/studentSkillTaxonomy.ts`;
  - `pages/Reports/recommendationViewModel.ts`.
- V2 base merge: `c7f38824caec537d0903f6a732af378b321e52fa` (PR #110 closure).
- Change type: **PRESENTATION / INTERACTION TRANSPLANT**.
- Backend/schema/auth/RBAC changes: **NO**.

## Legacy contract transplanted
The student Reports surface restores the recognizable learner vocabulary and hierarchy:
- dashboard return and `تقارير الأداء` heading;
- learner path/subject report scope;
- month / quarter / all-period shortcuts plus custom range;
- emerald quick-read summary;
- performance/pass/weak-skill headline cards;
- `المهارات التي تبدأ بها` mastery-priority rows;
- latest-results list with direct result-detail navigation.

The existing staff/admin Reporting UI is intentionally left unchanged by this UI-3 learner slice.

## V2 authority retained
All report facts continue to come from the canonical bounded Reporting API:
- student self-scope is enforced on the server;
- path/subject/date values are filters only, never an authorization source;
- overview sampling/truncation remains explicit;
- CSV reuses the same server query scope;
- no answer-level data or answer key is requested or rendered;
- mastery is not recomputed in React.

## Latest-legacy canonicalization
Legacy `77761835...` tightened student skill routing:
- nested subskills are normalized into a canonical taxonomy index;
- Results/Reports share a single recommendation resolver;
- subskills may not fall back to legacy title/`topic_sub_*` heuristics.

The V2 Reporting contract currently exposes weak-skill identity/mastery/evidence, but not a canonical Content recommendation target. This implementation therefore **does not invent Foundation lesson/quiz links in the browser**. It presents the server-owned weak-skill facts and offers only generic navigation such as the Study Plan.

## Responsive / regression evidence
Updated Playwright coverage certifies:
- 390px learner report;
- 820px learner report;
- path + subject filters are sent to Reporting API;
- custom date range applies to overview and CSV;
- weak-skill and latest-result summaries render;
- answer-key / answer-level data is absent.

## Merge gate
Do not mark complete until the same final documentation-inclusive SHA passes:
- Database CI;
- Backend CI;
- Frontend CI;
- Frontend E2E.

Then re-check latest legacy before merge.

## Sequence
This is the final listed protected UI-3 surface. After merge, read CURRENT_STATE / PARITY_MATRIX / WORKING_SET and continue from the first incomplete next UI phase without reopening closed UI-3 slices.
