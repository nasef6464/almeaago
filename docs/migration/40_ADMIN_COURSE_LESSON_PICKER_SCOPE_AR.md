# ADMIN-COURSE-LESSON-PICKER-SCOPE-03 — 2026-10-29

## Authority / ownership
- Legacy (read-only): `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`, `dashboards/admin/AdvancedCourseBuilder.tsx` (course curriculum, filtered same-path/subject lesson picker and module placement).
- Go target base: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- This independent slice changes `apps/web/src/features/content/components/CourseEditorPanel.tsx` and a **new** Playwright spec. It does not touch PR #160 (Skills Center and lesson editor), #167 (foundation/library/create editors), #170 (content list), #159 (header), or any student/school files.
- Scope: existing course curriculum editor; **not** a claim of whole course-builder visual parity. No new controls, tabs, counters, labels or design.

## Proven code gap / acceptance
Original builder scopes the lesson selection to current path/subject and search. Go previously retained a previous search's lesson options and per-module selected lesson when a new search was pending or failed. That permitted a stale lesson selection to be offered for linking, contrary to the current search context.

Required: changing the search immediately invalidates old options/selection; a failed GET cannot leave them available; late/aborted responses cannot repopulate them; a new search recovers without losing the course/module; placement is guarded against an option absent from the current loaded result. Existing course settings save retains draft and skill links on 503 and succeeds on retry/reload.

## Trace
Admin → course list → edit curriculum → search lesson → `GET /api/v1/lessons?page=1&limit=50&pathId=...&subjectId=...&search=...` → existing Go content list service/repository → PostgreSQL-backed lesson catalog → module picker. Linking still uses existing `placeCourseLesson` and revision/CSRF contract. Course settings: `PUT /api/v1/courses/{id}` → existing Go content service/repository → course + skill relations. This change adds no backend API or schema and does not claim to retest the database path.

## Tests
- New `admin-course-lesson-picker-scope.spec.ts`: 390/820/1440 RTL, failed lesson search, stale option/selection removal, next-search recovery and screenshot; save 503 → retained draft → retry → reload, payload retains path/subject/skillIds.
- Test-first commit `eefe25f9ec28fb7dbfe08cc01016871b28eba69c`. A measured RED is **not proven** unless an actual completed failing CI run is linked; avoid interpreting a pending/cancelled run as RED.
- Frontend fix commit `db566ba8ce573d9cd7c8051bb9be7483a757dce3`; test contract method correction `65ebc0eeb1f47a8a14acc8c6cfe85a63768ea9de`.
- CI links and exact-head results belong in PR #175 and must be rechecked after this documentation commit. Browser tests use mocked HTTP, not a real PostgreSQL session.

## Remaining / next
1. Obtain final CI status for Backend/Frontend/Database/E2E and investigate any failed assertions without disabling tests.
2. Paired full-page Legacy↔Go browser screenshots at 390/820/1440 with same role/data are **NOT PROVEN**.
3. Live session admin course settings save → Go HTTP → isolated PostgreSQL → learner course visibility/links remains **PARTIAL**; coordinate API contract with student owner without writing student files.
4. Continue original advanced builder's missing curriculum/quiz/settings functionality separately; no silent new UI or fake parity certification.

No merge, deployment, cutover, production writes, scoring/payment/RBAC changes.
