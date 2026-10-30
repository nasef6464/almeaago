# STUDENT-DIRECTED-ASSIGNMENT-ERROR-01 — directed learner assignment read failure and source parity

## Authority and ownership
- Read-only source: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`, `pages/Dashboard.tsx`, assignedQuizzes section: Arabic heading `الاختبارات الموجهة لك`, visible quiz-type badge, no English `DIRECTED ASSESSMENTS` header and no raw version `vN` badge.
- Target base: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Owner: student/learning, isolated `AssessmentAssignmentsPage.tsx`; does not edit #161 review images, #163 course/player, #168 foundation, #196 attempt, #200 acceptance, or #158 shared assessment test.
- This is a narrow **PARTIAL** slice, not a whole-school or whole-student UI parity certificate. A separate directed-assignments route is not the original Dashboard's embedded layout; further paired comparison is needed before declaring full parity.

## Actor → UI → HTTP → Go → PostgreSQL → consumer
- Student enters `/assessment-assignments`, after `/api/v1/auth/me` role check.
- `GET /api/v1/assessment-assignments/mine?page=1&limit=30` → `assessmentAssignmentClient.mine` → `AssignmentService.Learner` (requires student) → `ListLearnerAssignments` in PostgreSQL.
- PostgreSQL filters active/published/visible assignment, open time window, explicit user/class/school audience and active membership, then returns title, attempt count, max attempts, `canStart`.
- Student's explicit start button → CSRF → `POST /api/v1/assessment-assignments/{assignmentId}/start` with a session startKey → `AssignmentService.Start` → PostgreSQL `StartAssigned` (audience checked again, idempotent startKey) → canonical `/assessment-attempts/{id}`.
- No scoring, entitlement, assignment, membership or RBAC authority changed.

## Failure and parity correction
- **Before:** failed GET could show the error **and** the empty-inventory message, wrongly implying zero assignments. Rows/error also were not reset at a new fetch boundary.
- **After:** failed GET clears rows and displays only the error; an actual successful empty response alone displays `لا توجد تكليفات اختبار فعالة الآن.`. Role change clears cached rows. Aborted reads cannot overwrite newer state.
- Removed the English `DIRECTED ASSESSMENTS` label and raw `v{assessmentVersion}` badge, which have no counterparts in the inspected source card. Did not add buttons, counters, navigation or auto-start.
- Existing start button and same startKey on a 503 retry are preserved; no optimistic success or navigation before the server returns an attempt.

## Test and evidence boundaries
- New Playwright scenarios at **390/820/1440 RTL**: failed GET not confused with empty, technical badges absent, failed start retains button and retry uses the same idempotency key then navigates.
- Browser fixtures mock HTTP. They do **not** certify a real session or real Go/PostgreSQL end-to-end persistence.
- Existing Go `internal/assessment/application/assignment_service.go` and PostgreSQL `internal/assessment/repository/postgres/assignment_repository.go` were read for trace, not modified. No new PostgreSQL integration test in this slice.
- Original-vs-Go paired same-role/data screenshots: **NOT PROVEN**. Current tests prove functional behavior of the specific error/label cases only.
- Test-first commit `534c32aba10ba3b4c8168db0dda31f7a17c14261` initially had a malformed escaped regex, causing browser test discovery to fail. Fixed in `328dce88d6c3da3da24cdfb63484ae0dbf5adbb1`. A test discovery error is not RED proof; inspect the second run separately.
- Implementation commit `7177e2a992fb25c7c1c38a2fcab02be43e028be5`. CI and final SHA must be verified independently.

## Remaining
1. Compare entire original Dashboard assignedQuizzes layout vs Go at all widths with identical student/assignments and correct quiz type, due date, completion state, links and buttons. Do not silently invent a substitute.
2. Verify full browser → Go HTTP → PostgreSQL with an isolated real student and real assignment; include 403/503, revoked audience, repeated startKey, back/reload and attempt state. No production writes.
3. Reconcile stale shared test expectations through the owner of #158 if any, not by weakening parity.
4. Keep Draft PR and do not merge/deploy/cut over without owner review and full acceptance.
