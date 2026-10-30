# Learning evidence serialization implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Implement inline with one independent final branch review.

**Goal:** Preserve every committed assessment/review contribution in learner skill progress under concurrent requests.
**Architecture:** Serialize the two evidence-writing transactions per canonical student UUID before any evidence/card locks; aggregate only after the earlier transaction commits. Use PostgreSQL transaction advisory locks, released on commit/rollback. No process-local locks or schema migration.
**Tech Stack:** Go, pgx, PostgreSQL 18; existing Database CI.
**Spec:** ../specs/2026-10-28-platform-pedagogical-policy-design.md sections 2, 4 and 10 (real evidence, idempotency, trustworthy mastery). Source bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7; Go base 9359986.

## Global Constraints
- Source read-only; no production writes, thresholds, rounding, API, UI or grading changes.
- Latest main only; preserve other worktrees and school work.
- Lock order: student evidence lock before card/evidence/progress writes; both writers participate.
- Use an isolated schema copied from migrated tables for integration tests; never truncate public tables.

## Review Focus
- Assessment/assessment, assessment/review and review/review must preserve both contributions.
- Retries must not double evidence or return conflict for identical review submissions.
- Waiting cancellation must roll back without orphan evidence or locks.
- Different students must proceed independently.
- UUID spellings must resolve to the same lock; lock release must survive rollback/errors.

### Task 1: Reproduce and repair lost evidence aggregates
**Files:** internal/learning/repository/postgres/{evidence_serialization_integration_test.go,evidence_lock.go,repository.go,review_practice.go}; .github/workflows/database.yml; docs/migration/24_LEARNING_EVIDENCE_SERIALIZATION_AR.md.
**Interfaces:** Existing ApplyAssessmentEvidence and ApplyReviewAnswer; new internal lockStudentEvidenceTx(context.Context, pgx.Tx, string) error.
- [x] Write PostgreSQL tests using a controlled BEFORE INSERT progress trigger and observed lock waits, forcing overlapping aggregates without sleeps as correctness evidence. Assert 2 evidence rows, progress evidence_count=2, attempts=2, mastery=50, status=average, correct action; retry unchanged. Include identical review retry, cancellation, foreign-student independence.
- [x] Run integration test against PostgreSQL 18. Expected RED: stale evidence_count=1 or retry conflict before fix. Record actual failure.
- [x] Add shared transaction lock before either writer reads/writes; canonicalize student via PostgreSQL UUID cast; explicit READ COMMITTED for fresh post-wait reads. Expected GREEN: all integration cases pass.
- [x] Wire same test into existing Database CI; run gofmt, go test ./..., source oracle, integration repeated run, go vet. Expected PASS, with skipped DB tests distinguished from executed tests.
- [ ] Independent whole-branch review, fix concrete blockers via RED/GREEN, document decisions and limits, focused commit/PR, exact-head CI before merge.
