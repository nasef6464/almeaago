# Assessment Learner Attempt Core Contract

Scope: learner self-start for a published visible Assessment, exact-version question delivery, autosave/resume, idempotent submit, server-owned scoring and result projection.

## Routes
- POST /api/v1/assessments/{id}/attempts — body: {startKey}
- GET /api/v1/assessment-attempts/{id}
- PUT /api/v1/assessment-attempts/{id}/answers/{questionId} — CSRF, autosave one answer
- POST /api/v1/assessment-attempts/{id}/submit — body: {submissionKey}, CSRF
- GET /api/v1/assessment-attempts/{id}/result

## Invariants
- student role only; an attempt is readable/writable only by its student.
- start uses the Assessment published_version, never current draft state.
- Assessment must be approved, published and visible.
- startKey and submissionKey are bounded idempotency keys; retries return the same attempt/result.
- attempt number and max-attempt checks are transactionally serialized on the Assessment row.
- expiry is server-owned from version time_limit_seconds.
- only exact assessment question versions are served/scored.
- learner question payload never includes correct option, explanation, hint, strategy, reviewer/source/AI metadata.
- option order may be deterministic per attempt; canonical option indexes remain the answer identity.
- autosave only accepts a question/version belonging to the attempt and never accepts client correctness.
- submit locks the attempt, scores from canonical question_versions.correct_option_index, writes answer correctness and exactly one result in one transaction.
- current core is auto-scored: a published version containing a question without correct_option_index cannot start.
- score is points-weighted; counts remain question counts.
- result is unavailable before submit.
- no Learning mastery/review side effects, Commerce entitlement, Realtime session orchestration or AI in this batch.
- start/submit are audited transactionally; autosave is intentionally not audit-event amplified.
