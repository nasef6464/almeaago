# Assessment Result / Review Audit

Status: **TESTED / MERGED**

## Scope
This checkpoint extends the already-merged learner attempt core with post-submit, learner-owned result history and review presentation.

## Canonical routes
- `GET /api/v1/assessment-attempts/results?page=&limit=`
- `GET /api/v1/assessment-attempts/{attemptId}/review`

The existing submission/result route remains:
- `GET /api/v1/assessment-attempts/{attemptId}/result`

## Security invariants
- student role only.
- every list row is constrained by `assessment_results.student_id`.
- detail requires the authenticated student to own the submitted result.
- `allow_question_review=false` returns no question rows, not merely a hidden frontend panel.
- `show_answers=false` omits `correctOptionIndex`.
- `show_explanations=false` omits explanation, hint and solving strategy.
- pre-submit attempt APIs remain learner-safe and unchanged; answer keys/private explanations never enter the attempt payload.
- correctness is read only from server-scored `assessment_answers.is_correct`.

## Query / resource invariants
- history defaults to 20 and caps at 100 rows.
- history uses `limit + 1` + `hasMore`; no exact count is required.
- page number is bounded to avoid unbounded offset work.
- result detail is separate from history so normal history never hydrates questions/options.
- detail loads all exact-version question rows in one query and all exact-version options in one query; it does not perform per-question option queries.
- Question Bank identity is reused by `question_id + question_version`; no question or media copies are created.
- deterministic attempt option ordering is preserved for review when randomization was enabled.

## Learner UX
- responsive `/assessment-results` history.
- responsive `/assessment-results/{attemptId}` detail.
- review filters: all, wrong, unanswered, marked for review.
- the in-attempt review flag is persisted through the existing autosave contract after an answer exists.
- when result-report presentation is disabled, the detail UI records completion without rendering the detailed score block.

## Deliberately deferred
This batch does not create:
- Learning mastery or ReviewCard side effects.
- remediation sessions.
- AI / Question Assistant integration.
- Realtime classroom/session review.
- Commerce entitlement logic.

Those remain separate domain batches. This checkpoint is a read/presentation slice over canonical Assessment + Question Bank state.


## Verification checkpoint
- exact tested PR head: `fb3f897b9a3c764d3784dbd49103ee65391082e6`.
- Backend CI `36209979752`: PASS.
- Frontend CI `36209979648`: PASS.
- Frontend E2E `36209979850`: PASS.
- browser evidence artifact: `10894539327`.
- PR #46 merged to `main` as `0fabf767557806d17012fb8456c3696698b97b0c`.
