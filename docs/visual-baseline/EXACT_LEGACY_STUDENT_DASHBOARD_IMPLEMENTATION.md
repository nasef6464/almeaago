# Exact Legacy Student Dashboard — UI-4 Implementation Certificate

Status: **IMPLEMENTATION CANDIDATE — FINAL FOUR-GATE EXACT-HEAD VERIFICATION PENDING**

## Identity
- UI phase: UI-4 Learner workspace.
- Protected surface: `/dashboard`.
- Legacy source checkpoint: `db0c09da042f8ef3ef76b5b1baa298042799e0d4`.
- Legacy source: `pages/Dashboard.tsx` student sidebar/menu shell and `OverviewTab`.
- V2 base: UI-3 closure merge `347201c87fb73e380e7de7f9b059df991ed30ab7`.
- Change type: **PRESENTATION / NAVIGATION TRANSPLANT**.
- Backend/schema/auth/RBAC changes: **NO**.

## Legacy source audited
The student menu/navigation and Overview sections were read before implementation. Source-backed elements restored include:
- student identity block and `لوحة تحكم الطالب` label;
- grouped navigation cards for learning, exams, tools and support;
- mobile bottom-left drawer control;
- `مرحباً يا بطل! 👋` welcome strip;
- `خطوتك اليوم` hierarchy;
- compact learner journey cards and notification/reporting entry states.

## V2 routing truth retained
Only implemented V2 destinations are linked:
- `/learning`;
- `/plan`;
- `/reports`;
- `/assessments`;
- `/assessment-assignments`;
- `/assessment-results`;
- `/review`;
- `/classroom/join`;
- `/notifications`.

Legacy-only tabs that have no canonical V2 route are not recreated as dead links.

## No fabricated learner state
The legacy dashboard contained richer store-derived streak, assigned-quiz and smart-skill summaries. This slice does not invent those facts from the browser:
- no streak counter is fabricated;
- no recommendation or mastery number is synthesized;
- no notification count is guessed;
- destination pages continue to own and fetch their server-authoritative data.

The today-focus strip therefore acts as a source-backed navigation hierarchy, not a false live metric.

## Responsive / regression evidence
Updated Playwright coverage certifies:
- 390px learner dashboard;
- mobile drawer open state and all grouped navigation sections;
- links only to implemented V2 learner routes;
- no horizontal overflow;
- 1440px persistent desktop sidebar;
- student identity visibility;
- mobile and desktop screenshots.

## Merge gate
Do not mark this slice complete until one documentation-inclusive SHA passes Database CI, Backend CI, Frontend CI and Frontend E2E on the same commit, followed by a latest legacy re-check.

## Next UI-4 work
After this dashboard slice closes, continue with the remaining learner notification/reporting entry-state parity identified by the authoritative working set without reopening closed UI-3 surfaces.
