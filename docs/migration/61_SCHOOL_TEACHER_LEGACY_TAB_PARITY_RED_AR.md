# School teacher exact Legacy navigation — RED acceptance checkpoint (2026-10-30)

- Legacy source: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`, `dashboards/SchoolTeacherDashboard.tsx`, `components/DashboardSectionNav.tsx`.
- Go baseline: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`, `apps/web/src/features/organizations/pages/TeacherWorkspacePage.tsx`.
- Owner: #165 owns the teacher workspace file and existing scope tests. This PR **does not modify** that file, #162 parent files, #172 director files, any RBAC, assessment/scoring, or production data.

## Proven source-code gap

Legacy has five collapsible navigation groups, eight in-page tabs, the exact Arabic labels in the new test, and a `?tab=` URL synchronized on selection/back/reload. Go currently uses direct links to generic routes, a different label/order, an invented “رادار فجوات الفصول” link, and a disabled certificate entry in place of the original certificate tab. The original also contains real tab content (learning evidence, classroom, preparation, reports, skills radar, assessments, certificates). Restoring labels alone is **not** functional parity.

## RED acceptance

`apps/web/tests/e2e/schools-teacher-legacy-tab-parity-red.spec.ts` asserts grouped labels, exact action order, absence of invented labels, RTL overflow at 390/820/1440, and `?tab=assessments` with reload/back. It captures Go-only screenshots before assertions; no paired Legacy runtime screenshot is available. Browser failures are **expected evidence**, not passing parity.

## Handoff and ownership

#165 should integrate the source grouping and real in-page tab content with the existing school switcher, preserving its school/assignment isolation, failure retry, and teacher authorization. Do not copy fake cards, invent routes, or weaken selectors. Run RED→GREEN on that owner's branch, verify real HTTP→Go→PostgreSQL classroom/assignment consumption and permission failure, then capture paired Legacy↔Go screenshots with the same role/data/state at 390/820/1440. This checkpoint remains PARTIAL/BLOCKED until those checks pass.

No merge, deployment, cutover, scoring, payment, or RBAC changes.
