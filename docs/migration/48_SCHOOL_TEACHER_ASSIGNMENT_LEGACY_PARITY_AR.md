# SCHOOL-ASSIGNMENT-LEGACY-REACTIVATION — مدرسة/معلم، 2026-10-29

## المراجع والملكية
- Legacy read-only `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`: `dashboards/school-director/DirectorTeacherAssignments.tsx`, `dashboards/SchoolDirectorDelegatedOperations.tsx`, `server/src/modules/schools/application/schoolDirectorWorkspace.ts`.
- Go implementation baseline `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Draft PR: https://github.com/nasef6464/almeaago/pull/187.
- Independent ownership: only `DirectorTeacherAssignments.tsx`, `assignments.go`, a dedicated E2E test and the existing PostgreSQL assignment integration test. No edits to school director main page owned by #172, parent #162, teacher page #165, supervisor #177, school report #181, or shared #158 tests.

## الفجوة المثبتة — RED
1. Component: Go used an `h3` with invented gray assignment rows, stronger typography and spacing, while the original component uses `h4`, white rows and precise Tailwind classes. Restore the original presentation without adding controls; adapt only Go DTO `class.id/name` to original `classId/className`.
2. Server: the original Node `upsertSchoolDirectorTeachingAssignment` permits stopping an existing assignment after its class disappears but forbids **reactivating** a missing/archived class. Go `Repository.UpsertAssignment` validated active school/class/membership on INSERT, but on INSERT returning zero rows, its fallback UPDATE reactivated the archived assignment without checking those conditions.
3. Real isolated PostgreSQL **RED**: [Database CI #40914155566](https://github.com/nasef6464/almeaago/actions/runs/40914155566) on SHA `367e3a98ea771c820e1a5723edc746c923cb04ed` reported `archived classroom must never be reactivated (Legacy rejects it), got <nil>`. This is an observed database mutation, not an inferred SQL issue.
4. First backend test SHA failed only `gofmt` on the new test fixture (Backend CI #40914155531); the formatting correction was applied. The original test-only E2E run was cancelled by subsequent pushes; it is **not** counted as a proven browser RED.

## التعديل
- Presentation: exact original heading, spacing, list colors, button classes, conflict/empty labels and active-only filtering; no new links/cards.
- PostgreSQL: retain stop of existing orphaned assignment and repeated stop, but require active class in the same live school, active teacher membership and role, and existing subject before fallback UPDATE may set status active. This is the same eligibility already required by the INSERT path, not a new authorization policy.
- New Playwright tests: role-scoped director → teacher → active assignments → failed stop keeps button → retry sends CSRF and HTTP → re-read → reload; archived-class label and absence of inactive rows; 390/820/1440 RTL with Go-only screenshots.
- Real PostgreSQL test: archived reactivation denied with no audit or mutation; archived stop and retry succeed without duplication; cross-school stop denied; valid reactivation succeeds; revoked teacher membership cannot be reactivated. Uses isolated schema and no production data.

## Trace
Director (school membership + SCHOOL_TEACHERS_ASSIGN + SCHOOL_CORE) → original teacher assignment card → `PUT /api/school-access/director/schools/{schoolId}/assignments` (Legacy inactive mapped to Go ended) → organizations service → `Repository.UpsertAssignment` → PostgreSQL `teaching_assignments` + audit → `GET .../teachers` → same active rows on reload. The UI test mocks HTTP; the DB test uses real PostgreSQL. **Combined real browser→Go→PostgreSQL session is NOT PROVEN.**

## حدود الاعتماد
- VERIFIED only after exact-head CI passes: frontend, backend, database, browser and scoped PostgreSQL assertions.
- PARTIAL: full school director form and path→subject picker still differ from Legacy; main page is owned by PR #172 and must be coordinated, not edited here.
- NOT PROVEN: paired Legacy↔Go screenshots at identical role/data 390/820/1440; E2E screenshots are Go only.
- No merge, deployment, cutover, scoring, payments, RBAC policy, or production/Legacy writes.

## التالي
Owner #172 should restore original director teacher form's path→subject catalog selection and status choice, without duplicating this component. Test the entire director save→teacher workspace flow with real Go/PostgreSQL staging and paired Legacy screenshots. Do not claim full role parity from these bounded checks.
