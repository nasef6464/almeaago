# SCHOOL-005C2 Learner Results — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match the Node school assessment learner-list/filter and persisted result detail semantics in Go/PostgreSQL/React without widening school data access.

**Architecture:** An application-level dual-module capability check plus SQL-level actor/audience/result authorization; two read-only endpoints and a lazy tab nested under the existing report dialog. Central-exam enhancements are tracked separately.

**Tech Stack:** Go / pgx / chi, PostgreSQL migrations 000001–000043, React/TypeScript/Vite, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-28-school-assessment-results-parity-design.md`

## Global Constraints

- Match Node roster query and status semantics, not a redesigned workflow.
- Distinguish aggregate-read access from dual-authorized named student evidence.
- Never select another school or generic practice attempt; only latest submitted result.
- No schema or source Node changes; never expose correct answer keys.
- No production data writes. GitHub required CI must pass on same head commit.

## Review Focus

1. Aggregates-only director queries learners → 403, not a student roster.
2. A school member loses the `SCHOOL_INTELLIGENCE` module between app and DB queries → SQL no rows.
3. A student has latest failed and older passed attempt → support filter uses latest failed result.
4. A foreign school or self-practice attempt has a higher score → neither changes visible latest result.
5. Search `%`, `_`, `\\` → treated as literal text, not wildcard control; page total reflects filter before offset.

---

### Task 1: Typed learner result contracts and application authorization

**Files:** `internal/organizations/domain/director_assessments.go`, `internal/organizations/application/director_assessments_report.go`, `internal/organizations/application/service.go`, `internal/organizations/application/service_test_support_test.go`, `internal/organizations/application/director_core_test.go`.

**Interfaces:** produce `DirectorAssessmentLearners(ctx,actor,schoolID,assessmentID,query)` and `DirectorAssessmentLearnerResult(ctx,actor,schoolID,assessmentID,attemptID)`; repository mirrors the two read operations. `DirectorAssessmentLearnerQuery` holds page, limit, status, search; page returns `learners` and `pagination`.

- [ ] Write failing app tests: invalid UUID/status/page/search, aggregate-only denied, `SCHOOL_INTELLIGENCE` absent, detailed-with-both-modules allowed, cross-school denied.
- [ ] Run tests and record the expected failure.
- [ ] Add typed domain, repo/service interface, dual capability and strict input validation.
- [ ] Run focused tests expecting PASS; commit.

### Task 2: Scoped PostgreSQL list and detailed outcome query

**Files:** `internal/organizations/repository/postgres/director_assessments_learners.go`, `internal/organizations/repository/postgres/director_assessments_create_integration_test.go`.

**Interfaces:** returns Task 1's typed domain; one filtered count+bounded page with SQL authorization and a whitelisted detail row. Use current assessment report's targeted CTE semantics.

- [ ] Write failing migrated database integration assertions for `all`, `completed`, `not_completed`, `needs_support`, search/page, latest school attempt, wrong school/module, detail, redaction.
- [ ] Run database test (or identify missing local database and run on Database CI).
- [ ] Implement SQL reads with parameterized filters, literal wildcard escaping, school-scoped audience and latest result.
- [ ] Run focused tests and DB CI; commit.

### Task 3: HTTP endpoints and response/privacy guards

**Files:** `internal/organizations/transport/http/legacy_handler.go`, `internal/organizations/transport/http/legacy_director_core.go`, `internal/organizations/transport/http/legacy_director_core_test.go`.

**Interfaces:** paths from spec; no-store for both; 400 for bad page/status/limit/search, 403 for permissions, 404 for absent foreign result.

- [ ] Write failing HTTP route/shape/authorization tests.
- [ ] Run RED; register GET routes and bounded query parser, return JSON responses.
- [ ] Run GREEN; commit.

### Task 4: Legacy-matching React learner view

**Files:** `apps/web/src/features/organizations/api/organizations-client.ts`, `apps/web/src/features/organizations/components/DirectorAssessmentReportPanel.tsx`, new `DirectorAssessmentLearnersPanel.tsx`, `apps/web/tests/e2e/organizations-director.spec.ts`.

**Interfaces:** report dialog 'الملخص/نتائج الطلاب' tabs; learner status/search/page; detail evidence with saved score/sections/skills; per-school remount and abort.

- [ ] Write failing Playwright E2E test with 390px and 1440px, dual-permission tab, missing-module hidden, status/search paging, detail, stale school-switch protection.
- [ ] Run RED where Chromium available; if local Chromium blocked use GitHub E2E with unchanged healthy fallback.
- [ ] Add typed API, focused components preserving current styling.
- [ ] Run frontend build + E2E; commit.

### Task 5: Checkpoint, review and integration

**Files:** `docs/migration/13_SCHOOL_005C2_LEARNERS_EXECUTION_AR.md` plus relevant target execution ledger.

- [ ] Review the entire diff for accidental information disclosures and exact legacy behavior.
- [ ] Run available Go/frontend suites; push to isolated GitHub branch, open draft PR.
- [ ] Verify all four required CI checks against the exact PR head. Fix failures without weakening tests.
- [ ] Mark ready and merge only on green CI; document merged SHA, what remains to match the full old editor and Classera-style central exam.
