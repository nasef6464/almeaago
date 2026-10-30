# SCHOOL-005C3B Selected Learners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task with RED→GREEN tests, ledger evidence and final review.

**Goal:** Make one central school assessment target selected classes and/or named students with exact school authorization and legacy-shaped Arabic creation workflow.

**Architecture:** Extend the existing `DirectorAssessmentCreate` service, transactional PostgreSQL assignment and request fingerprint; add a separate bounded learner picker under school assessments manager permissions. Reuse existing assessment results/report joins for the audience union; no new schema.

**Tech Stack:** Go/Chi/pgx/PostgreSQL, React/Vite/Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-28-school-assessment-selected-audience-design.md`

## Global Constraints

- Active school, staff admin, `SCHOOL_ASSESSMENTS_MANAGE`, active `SCHOOL_ASSESSMENTS` contract module for all operations.
- Selected class IDs max 50, learner IDs max 200, require at least one target. Do not expose names outside school, answer keys or unrelated personal data.
- Existing school/class/classes creation and results remain unchanged; preserve deterministic idempotency and public platform isolation.
- Selected school ID and audience always server validated, never trust role IDs or school from browser.

## Review Focus

1. IDs from school B in school A request → 404, no assessment write (Task 1 integration).
2. Inactive or staff-only IDs → 404, no assessment write (Task 1 integration).
3. Retried selected audience with reordered duplicate IDs → one assessment (Task 1 service + integration).
4. Access to selector without assessments manage/module → denied, no named leakage (Task 2).
5. School switch during pending learner picker request → no data from previous school visible (Task 3 E2E).

### Task 1: Selected target transaction and idempotency

**Files:**
- Modify `internal/organizations/domain/director_assessments.go`
- Modify `internal/organizations/application/director_assessments_create.go` and `_test.go`
- Modify `internal/organizations/repository/postgres/director_assessments_create.go` and `_integration_test.go`
- Modify `internal/organizations/transport/http/legacy_director_core.go`

**Interfaces:** consumes current `DirectorAssessmentCreate`; produces `TargetScope="selected"`, `StudentIDs []string`, optional `ClassIDs []string`, canonical ordering in application, linked assignment users in DB and stable idempotent return.

- [ ] Write failing unit validation cases for union/duplicates, empty, malformed, cross-mode student IDs; verify RED.
- [ ] Implement service normalization and domain/HTTP input; verify GREEN.
- [ ] Write PostgreSQL integration assertions for selected assignment, union, replays, foreign/inactive/staff users; verify via Database CI (local `DATABASE_URL` if configured).
- [ ] Implement transaction verification/persistence and idempotent response; run Go unit suites.
- [ ] Commit bounded Task 1 changes.

### Task 2: Secure candidate learner picker

**Files:**
- Create `internal/organizations/{application,repository/postgres}/director_assessment_students.go`
- Modify domain interface, service interface, HTTP routing and handler.
- Tests in application/transport/SQL integration.

**Interfaces:** `DirectorAssessmentEligibleStudents(ctx, actor, schoolID, query)` → list of non-PII minimal learner summaries `{studentId,name,className}` with page/total. `GET .../academic/eligible-students` accepts bounded search/page/limit.

- [ ] Write failing service and HTTP authorization/query tests; verify RED.
- [ ] Implement Go service/handler/SQL query with SQL-side school/permission/module recheck; verify GREEN.
- [ ] SQL integration checks active membership only and revocation, no cross-school leak.
- [ ] Commit Task 2.

### Task 3: RTL creator and full regression gates

**Files:**
- Modify `apps/web/src/features/organizations/{api/organizations-client.ts,components/DirectorAssessmentCreator.tsx}`.
- Add Playwright `apps/web/tests/e2e/organizations-director.spec.ts` scenarios.
- Documentation `docs/migration/15_SCHOOL_005C3B_SELECTED_STUDENTS_AR.md`.

**Interfaces:** uses Task 2 candidate endpoint; sends Task 1 `targetScope=selected`, `classIds`, `studentIds`, existing `Idempotency-Key`.

- [ ] Write failing mobile/desktop E2E test for group+selected learners, paging/search and isolated school switch; verify RED.
- [ ] Add lazy picker and chips with stale cancel, submit guard; verify GREEN.
- [ ] Run frontend build, full Playwright, `go test ./...`, `git diff --check`, final branch review.
- [ ] Commit Task 3; publish draft PR, require Backend/Database/Frontend/E2E success for exact head, then review and merge.
