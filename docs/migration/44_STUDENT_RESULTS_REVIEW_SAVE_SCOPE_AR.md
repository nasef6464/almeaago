# STUDENT-RESULTS-REVIEW-SCOPE-SAVE-03 — 2026-10-29

## Boundaries and sources
- Legacy source (read only): `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`; `pages/Results.tsx`, `hooks/useStudentResultHistory.ts`, and `docs/product/STUDENT_JOURNEY_PHILOSOPHY_AR.md`.
- Go main baseline: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Branch: `fix/student-results-review-scope-save-20261029-run3`; Draft PR #180.
- Ownership: only `AssessmentResultsPage.tsx`, its new E2E test, and this checkpoint. Do not touch #161/#163/#168/#171/#176 or shared tests/CI.

## Proven defect in the Go source before change
- A failed `PUT /api/v1/review/questions/:questionId/saved` set the same `error` state as failed result reads. `if (error) return ...` replaced the *entire result and review page* with error text. The question, save action, review filters, and navigation disappeared; retry was impossible without leaving/reloading.
- Result detail was stored without an attempt/user key; a route/actor switch could temporarily render the previous attempt before the new effect settled.
- Review filter was not reset on attempt change.
- Canonical saved-for-review is per **question and learner**, not per attempt. Do **not** clear successful saved state when the same learner opens another attempt containing the same question.

## Correction
- Separate read failure from save failure; failed save remains inline with the existing question and save action available for retry. No new card, navigation, counter, or permanent section.
- Guard late save completions by active learner+attempt context, reset pending/error/filter state on context switch, and reset locally cached saved flags on learner switch.
- Tag loaded detail with learner+attempt context so a new route does not render old attempt details.
- Preserve existing Go HTTP client, Go application/repository, PostgreSQL tables, RBAC, entitlement, scoring, and canonical question IDs; no schema change.

## Test-first checkpoint
- Test-only commit `28152b8740f894178af6c0c294cd0b3c5975d817`; five Playwright tests for failed save/retry/reload, same-question global save, and RTL 390/820/1440. Subsequent test commit corrected a mistaken expectation: global saved review **must** remain saved across attempts of the same learner.
- RED must be marked **NOT PROVEN** until a completed failing E2E run exists. A cancelled workflow is not a RED proof.
- GREEN requires the exact final SHA Frontend/E2E results. The four CI gates are reported separately; path-filtered absent jobs are **NOT RUN**, not PASS.
- Browser tests mock HTTP; they do not prove PostgreSQL writes or visual parity with Legacy.

## Actor → action → HTTP → consumer
Student → result detail → `GET /api/v1/assessment-attempts/:id/review` → existing assessment read → result UI.
Student → save for review → `PUT /api/v1/review/questions/:questionId/saved` with CSRF → existing learning review persistence → question review library. This slice changes the consumer only.
Failure → error remains visible inline while result/question/save control stay available. Retry → same canonical question ID, no extra local question copy.

## Remaining acceptance
- Paired Legacy↔Go screenshots at 390/820/1440 with same actor, data, state and RTL: **NOT PROVEN**.
- Real browser → Go → isolated PostgreSQL save/reload/review-library journey and unauthorized actor denial: **PARTIAL**; browser fixture alone cannot certify it.
- Complete results UI parity (summary/analysis/review/history, media and video/training/support actions) remains **PARTIAL**. In particular the Go result screen currently displays image asset IDs as placeholders; coordinate with #161 media owner before importing shared media components.
- No merge, deployment, cutover, Legacy write, or production write.

Next: complete exact-head CI and inspect E2E artifacts, then implement the media/answer review consumer only after resolving shared component ownership with #161, and run the real PostgreSQL journey with a test account.
