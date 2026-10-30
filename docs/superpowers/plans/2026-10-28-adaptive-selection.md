# Adaptive recommendation selection

> Execute inline with superpowers:executing-plans; tests before implementation.

Goal: the existing student review recommendation selects the source-policy priority rather than simply minimum mastery.
Spec: docs/superpowers/specs/2026-10-28-platform-pedagogical-policy-design.md; pinned nextBestAction.ts and quizSubmissionSkillProgress.ts are behavior authorities.

Constraints: preserve the item response and student/path/optional-subject ownership; no persisted scoring changes, migration, production or legacy writes. Reuse the isolated adaptive worktree and PR149. Source reads at most 100 progress rows and uses five latest source-event percentages for trend. Preserve the existing recommendation text contract by returning an adaptive Arabic label in the recommendation only; leave stored progress recommendations unchanged.

Review focus: mixed student/path/subject evidence; several questions in one attempt; missing timestamps; tied event times and candidate scores; empty/cancelled/error reads. No production or visual parity certification from fixtures.

## Task 1: server selection and UI projection
- [ ] Add PostgreSQL regression covering source-policy status/evidence/age/trend and scope, run in existing Database CI against original implementation (expected wrong skill).
- [ ] Add source-generated fixed-clock multi-skill oracle and Go domain ranking tests (expected missing ranker), then implement stable ranking with weights 30/15, +18/-6, +12, age/14 capped10 and actions at evidence3/mastery50/80.
- [ ] Replace only WeakestSkillProgress implementation: one snapshot SQL, first100 in existing mastery/time order, per-source-event percentages, latest5 evidence, rank in Go. Keep service/HTTP signatures and add optional action/trend fields to recommendation.
- [ ] Browser regression: recommendation says selected-skill mastery rather than minimum mastery, displays policy action and trend at mobile/tablet/desktop, scope races remain guarded. Add HTTP/database coverage for existing item shape and auth.
- [ ] Run full Go, source oracle, frontend build, required CI on final SHA; fresh whole-branch review, fix important findings, then merge if all gates pass. Record evidence and next scope.
