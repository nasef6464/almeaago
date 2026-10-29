# SCHOOL DIRECTOR — Original student table parity RED contract (2026-10-30)

## Source of truth and ownership
- Read-only Legacy: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`, `dashboards/SchoolDirectorDashboard.tsx` lines 152–158 and `components/DisplayListControls.tsx`.
- Target main baseline: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Director page implementation is owned by PR #172; overview/header tests are in #205; navigation is owned by #198; parent dashboard is owned by #162. This PR **does not edit those files** and must not be merged as a parity certificate.
- No scoring, payments, RBAC, assessment engine, production or Legacy writes.

## Proven source/target difference (static code)
1. Legacy uses a semantic HTML `table`, with four headers in this order: `الطالب`, `الحالة`, `الفصل`, `عمليات مفوضة`; Go uses responsive `article` cards and a div-based header.
2. Legacy wraps the table in `overflow-x-auto` with `min-w-[860px]` on small viewports; Go hides its column labels below `lg`.
3. Legacy renders `students.slice(0, studentRows.limit)` with `useDisplayLimit(12, [selectedSchoolId, search])` and `DisplayListControls` (`عرض المزيد` / `عرض أقل`); Go renders all returned students and has no corresponding controls.
4. Go inserts `عدد الطلاب في القائمة: {studentTotal}`, absent from the original student section.

## RED acceptance tests
`apps/web/tests/e2e/school-director-students-legacy-table-red.spec.ts` adds nine browser tests (three scenarios at 390/820/1440 RTL):
- Semantic table, original headers/order, no invented count, and horizontal scroll on 390.
- Initial 12/14 students, show more 14/14, show less 12/14.
- Inline edit remains within the table; cancel restores the original row without persisting the draft.

Fixtures use the same mocked director role and 14 school students across all viewports. These tests are **mocked UI contract evidence**, not paired Legacy↔Go screenshots and not Go/PostgreSQL proof. The `test-results` screenshots capture only Go; pair them with real Legacy at the same role/data/viewport before declaring visual parity.

## Owner handoff
PR #172 should restore the original table and `DisplayListControls` behavior without altering permission checks, school scope, request/response contract, or student mutations. Preserve the existing fail-closed protections. Check permission-gated edit/move/activate actions, search, empty/error/loading, failed save draft, back/reload and school switch separately.

After implementation, prove RED→GREEN on the exact head SHA, run Backend/Frontend/Database/Browser CI, and run an isolated real HTTP→Go→PostgreSQL school membership/class/assignment test. Do not treat this RED-only PR as functional completion.

## Delivery status
- Source/target difference: VERIFIED from inspected code.
- New browser tests: WRITTEN; runtime RED/GREEN depends on CI.
- Actual code correction: BLOCKED by #172 file ownership.
- Real PostgreSQL and paired screenshots: NOT PROVEN.
