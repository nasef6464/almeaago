# Consistent bounded readiness Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Read all measured readiness skills from one PostgreSQL statement snapshot.
**Architecture:** Reuse ListSkillProgress(page=1, limit=10000), which already fetches limit+1 and exposes HasMore. Reject overflow; retain scope/duplicate validation and deterministic scoring. The SQL statement has one MVCC snapshot; no transaction/schema/API changes are needed.
**Tech Stack:** Go, PostgreSQL, GitHub Actions.
**Spec:** docs/superpowers/specs/2026-10-28-platform-pedagogical-policy-design.md; docs/migration/20_READINESS_PAGE_INTEGRITY_AR.md.

## Global Constraints
- Same learner/path/subject authority, score formula, DTO and 10000-row maximum.
- No legacy or production writes, schema changes, or full parity claim.
- Existing progress-list pagination remains unchanged.

## Review Focus
1. Single statement must include skill 101 without any continuation read.
2. Exactly 10000 rows succeeds; an overflow fails without partial readiness.
3. Duplicate or foreign scoped rows remain rejected.
4. Errors/cancellation cannot produce a successful score.
5. Path-wide subjects remain distinct; empty scope returns needs_measurement.

### Task 1: Single-statement scoped readiness
**Files:** internal/learning/application/service.go; service_test.go; docs/migration/21_READINESS_SINGLE_QUERY_AR.md; migration checkpoint 17.
**Interfaces:** Unchanged Repository.ListSkillProgress and Service.Readiness signatures.
- [x] Write failing tests: one query includes 101 skills and exact normalized scope; overflow/cap/empty/error/cancel; adapt previous multi-page regression fixtures to single statement without weakening duplicate/scope assertions.
- [x] Run go test ./internal/learning/application -run TestReadiness -count=1. Expected: new single-query behavior fails on paginated baseline.
- [x] Replace bounded multi-query traversal with one limit=10000 query; reject HasMore or >10000 rows; preserve validation and context checks.
- [x] Run go test ./internal/learning/... and go test ./...; expected PASS, record any actual environmental limitations.
- [ ] Record actor-to-DB trace, baseline and limits; exact files only commit, final branch review, draft PR and exact-head CI evidence.
