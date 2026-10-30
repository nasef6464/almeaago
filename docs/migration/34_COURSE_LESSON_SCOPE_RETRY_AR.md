# ALMEAA Go — course lesson scope, failed save and retry (2026-10-29)

**Batch:** COURSE-LESSON-SCOPE-01 — Draft PR #163, branch codex/course-lesson-scope-retry-20261029.
**Source authority:** Legacy almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7.
**Target base:** Go almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb.
**Owner contract:** docs/migration/OWNER_BATCH_DELIVERY_CONTRACT_AR.md; subordinate to plan03/26.

## Functional gap and acceptance

The original course player selects a lesson before rendering its body and keeps lesson progress scoped to that course/lesson. The Go player previously retained the prior lesson's detail and progress while fetching the next selection. Its completion button used that stale detail.id; a failed next-lesson GET could therefore leave a visible and writable previous lesson. A delayed video save could replace the new lesson's displayed progress. There was no in-place retry for a failed lesson GET.

**Acceptance for this slice:** for a student in an allowed course, switching from lesson A to B never exposes A's body/completion while B is pending or failed; retry B without losing selection; failed completion preserves the same lesson and allows a retry; successful completion is re-read after reload; a late A video write never overwrites B's progress. Test 390/820/1440 responsive RTL. Reused lessons in distinct courses and distinct students must have independent PostgreSQL progress. No auto-completion from video position.

## Actor → screen/action → HTTP → Go → PostgreSQL → consumer

| Layer | Existing component / bounded correction |
|---|---|
| Legacy source | pages/CourseView.tsx + components/CoursePlayer.tsx: active lesson, lesson navigation, scoped progress; this is behavioral guidance, **not** a paired runtime visual certificate |
| Student UI | apps/web/src/features/learning/pages/CourseLearningPage.tsx: scope key courseId:lessonId, clear old detail/progress, validate both responses, loading/error/retry, reject stale asynchronous write result, keep explicit completion |
| HTTP | Existing GET /api/v1/learning-spaces/courses/{courseId}/lessons/{lessonId}, GET /api/v1/learning-progress/lessons/{lessonId}?contextType=course&courseId=..., PUT .../video, POST .../complete |
| Go application | internal/learning/application/lesson_progress.go: validate repository-returned course, lesson and context on GET, save video and complete; reject mismatches rather than exposing unrelated progress |
| Go storage | internal/learning/repository/postgres/lesson_progress.go: unchanged scoped SQL and transactions; no schema change |
| PostgreSQL | lesson_progress unique by student + lesson + context + course/topic; lesson_video_progress keyed to scoped progress row |
| Consumer | Player body, resume label, completed badge, complete action and reload |

## Tests and evidence

- Browser apps/web/tests/e2e/course-lesson-scope-retry.spec.ts: three viewport journeys for A→B, failed lesson GET, retry, failed completion POST, successful retry, reload and selected B; separate delayed A video save test. Browser HTTP fixtures are **mocked**, so they prove UI state transitions only.
- Go internal/learning/application/lesson_progress_test.go::TestLessonProgressRejectsRepositoryResponseFromOtherCourse: wrong-course repository response rejected for GET, video save and complete.
- PostgreSQL internal/learning/repository/postgres/lesson_progress_scope_integration_test.go::TestLessonProgressContextIsolationPostgres: real PostgreSQL 18 with session-local tables copying migrated schema constraints; one canonical lesson in two courses and another learner; positions and completion remain isolated. No production data inserted.
- Dedicated .github/workflows/lesson-progress-context.yml runs all migrations in isolated CI PostgreSQL and executes the integration test. Backend/Database/Frontend/E2E CI results must be checked on the **final PR head** before marking them verified.
- Initial RED test commit 8da750aca0a6ae79eed1c76daf6f7dad0a67dffc; its E2E workflow was cancelled by subsequent pushes, so **RED failure was not captured**. Do not misreport a passing RED→GREEN history.

## Limits and follow-up

**PARTIAL until CI and browser evidence:** no real authenticated Go HTTP → PostgreSQL browser journey yet; no paired same-role/data Legacy-vs-Go screenshots; source course player has additional tabs/discussions/files/interactive-video behaviors outside this slice. Existing CI success is not full platform parity. This PR must remain draft, with no merge/deploy/cutover. Avoid overlapping header PR #159, independent Skills Center #160, review media #161 and parent scope #162.

**Next concrete execution:** inspect final-head four gates plus dedicated PostgreSQL gate, repair any failures, then run real-session HTTP→PostgreSQL course completion with a reusable lesson placed in two courses, and paired 390/820/1440 screenshots before certifying visual parity.
