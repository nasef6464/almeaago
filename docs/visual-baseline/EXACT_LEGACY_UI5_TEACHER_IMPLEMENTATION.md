# Exact Legacy UI-5 Teacher Workspace — Implementation Certificate

Status: **IMPLEMENTATION CANDIDATE — EXACT-HEAD FOUR-GATE VERIFICATION PENDING**

## Identity
- Phase: UI-5 role workspaces — Teacher first.
- Protected route: `/school-teacher-dashboard`.
- Exact legacy source read first: `almeaacodax/dashboards/SchoolTeacherDashboard.tsx` at legacy main `5fe7a49af0241ec7532a1678fb68e616631a837a`.
- V2 base: UI-4 closure main `ee15f91a2eb3f8d1c1b70371389c4983fd2128e7`.

## Source-backed gap fixed
Legacy teacher root is a role workspace with a school identity block and navigation for overview, smart classroom, prepared questions, reports/skills, assessments and certificates. V2 previously routed the teacher root directly into Smart Classroom. This slice restores the recognizable teacher workspace shell and keeps Smart Classroom at `/school-teacher-dashboard/classroom`.

## Authority retained
- Organizations `teacher-workspace` remains the only source for active school/assignment/student-count scope.
- Classroom remains owner of realtime sessions/questions/attendance/presentation.
- Reporting and Assessment remain owner-domain destinations; no report, score or assessment facts are synthesized in the workspace.
- No backend/schema/auth/RBAC change.
- Legacy-only certificate mutation is not fabricated; its navigation state remains visibly unavailable until a canonical V2 owner flow exists.

## Responsive evidence
Playwright covers 390px and 1440px teacher workspace states, school/assignment projection, legacy navigation vocabulary and horizontal-overflow bounds.

## Merge gate
Database CI + Backend CI + Frontend CI + Frontend E2E must pass on the same documentation-inclusive SHA, then latest legacy must be re-checked before merge.

## Regression correction
The pre-existing Classroom E2E previously entered the teacher root because that root used to alias Smart Classroom. With the restored source-backed workspace, the test now targets the canonical `/school-teacher-dashboard/classroom` route. Classroom behavior itself is unchanged.
