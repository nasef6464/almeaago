# Exact Legacy Study Plan — UI-3 Implementation Certificate

Status: **IMPLEMENTATION CANDIDATE — FINAL FOUR-GATE EXACT-HEAD VERIFICATION PENDING**

## Identity
- UI phase: UI-3 Learning experience parity.
- Protected surface: `/plan`.
- Legacy source checkpoint: `9f01b5fb603313247a4e4133e7a72d9b80dcfa4b`.
- Legacy file: `pages/Plan.tsx`.
- V2 base merge: `5f565454ddd34868d18391951a4a59a7838bf109` (PR #107 closure).
- Change type: **PRESENTATION / INTERACTION TRANSPLANT**.
- Backend/schema/auth/RBAC changes: **NO**.

## Legacy source audited
The protected legacy Plan surface was read before implementation. The transplanted contract includes:
- `خططي` learner header and dashboard return affordance;
- path-first master switch using large path cards;
- collapsible create/edit settings;
- emerald subject selection and indigo course selection vocabulary;
- temporal plan inputs, skip-completed behavior and off-day controls;
- indigo/purple active-plan hero with completion progress;
- today/week/all timeline;
- per-day progress headers and compact task cards.

## V2 authority retained
The transplant intentionally does not restore legacy client authority:
- Study Plan list/detail/create/update/delete remain canonical V2 endpoints.
- unsafe writes remain CSRF protected.
- updates remain optimistic-concurrency protected by the current plan revision.
- the server remains responsible for generated plan items.
- Course discovery remains lazy and exact-subject scoped through the V2 Learning Space projection; no broad browser bootstrap is reintroduced.
- student scope and school-intervention ownership remain current V2 truth.

## Responsive / regression evidence
Updated Playwright coverage keeps:
- 390px learner create -> generated schedule -> archive journey;
- exact lazy Course-read assertion;
- optimistic archive revision assertion;
- school-intervention visibility on the learner Plan surface;
- screenshot capture after the mobile journey.

The current implementation/test checkpoint is `e0172be7794b895bd4fe9c46a5ff1c90a47c71b1`. Documentation commits follow it and are part of the required final exact-head gate.

## Merge gate
Do not mark this slice complete until one documentation-inclusive SHA passes:
- Database CI;
- Backend CI;
- Frontend CI;
- Frontend E2E.

Then re-check latest legacy `almeaacodax` before merge.

## Next protected surfaces
After `/plan` closes:
1. learner `/assessments`;
2. assessment results;
3. `/reports`.
