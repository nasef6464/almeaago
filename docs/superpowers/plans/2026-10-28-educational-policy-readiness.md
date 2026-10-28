# Educational Policy & Complete Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve ALMEAA's full-platform educational logic as an executable Go contract and prevent mastery readiness from silently ignoring skills after the first page.

**Architecture:** Source-controlled pedagogical charter links the existing Node rules and the current Go domain owners. A small additive change to the Go `learning` application aggregates all bounded pages for the requested learner/path/subject; it retains the existing deterministic readiness formula, authentication, JSON DTO, and persistence shape.

**Tech Stack:** Go, chi, PostgreSQL, React/TypeScript (unchanged), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-28-platform-pedagogical-policy-design.md`

## Global Constraints

- Compare Legacy `bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7` against the Go base; keep both repositories' latest `main` SHA in evidence.
- One canonical question; no client-owned scoring or AI-owned mastery.
- Role/school/subject/path scope remains server-side; cross-scope result remains denied.
- No schema, production data, payment, API, or score threshold changes in this batch.
- A report covering only part of the eligible progress rows must fail closed, not pretend to be exhaustive.
- No whole-platform `PARITY_PROVEN` claim from this narrow batch.

## Review Focus

1. More than 100 progress rows in one path: second page included in `totalSkills`, `totalEvidence`, readiness score and decision — `TestReadinessIncludesAllScopedPages`.
2. Repeated empty page with `hasMore=true`: return error without spinning — `TestReadinessRejectsEmptyContinuation`.
3. A repository that claims more than 100 pages: return an explicit incomplete-snapshot error — `TestReadinessRejectsTruncatedScope`.
4. A second subject or path cannot enter the requested actor scope — `TestReadinessIncludesAllScopedPages` asserts exact repository query values per page.
5. An error on page 2 must not return a confident partial score — `TestReadinessPropagatesLaterPageFailure`.

---

### Task 1: Complete Scoped Mastery Readiness

**Files:**
- Modify: `internal/learning/application/service.go` (`Readiness`)
- Modify: `internal/learning/application/service_test.go` (`repoStub` plus focused cases)

**Interfaces:**
- Consumes: `Repository.ListSkillProgress(ctx, userID, pathID, subjectID, page, limit) (learning.SkillProgressPage,error)`; page has `Items`, `HasMore`.
- Produces: unchanged `Service.Readiness(ctx, actor, pathID, subjectID) (learning.MasteryReadiness,error)`; new `ErrIncompleteReadiness` sentinel for unreliably partial reads.

- [x] **Step 1: Write tests first** — `TestReadinessIncludesAllScopedPages` with first page 100 skills, second page 1 skill; `TestReadinessRejectsEmptyContinuation`, `TestReadinessRejectsTruncatedScope`, and `TestReadinessPropagatesLaterPageFailure`. Assert caller/subject scope every time, complete count, and sentinel/error.
- [x] **Step 2: Verify RED** — Run `env GOCACHE=/tmp/almeaa-go-cache-settings GOMODCACHE=/tmp/almeaa-gopath-settings/pkg/mod GOPATH=/tmp/almeaa-gopath-settings /tmp/almeaa-go-toolchain-20261028/go/bin/go test ./internal/learning/application -run 'TestReadiness' -count=1`; observed four behavioral FAILs on first-page-only code.
- [x] **Step 3: Implement** `Readiness` bounded pagination. Query page 1..100 at limit 100, append each `Items`, honor cancellation and repository error, stop at `!HasMore`, and return `ErrIncompleteReadiness` for empty continuation or more than 100 pages. Do not change the readiness formula.
- [x] **Step 4: Verify GREEN** — same focused command; observed PASS.
- [x] **Step 5: Regressions** — `go test ./internal/learning/...` PASS; `go test ./...` PASS outside sandbox for loopback-enabled `httptest` (inside restricted sandbox socket creation is denied).
- [x] **Step 6: Commit** — exact files only; commit `8839ceb` `fix(learning): include full scoped evidence in readiness` (will be rebased to current remote main before PR).

### Task 2: Replace School-First Program With Dependency-Led Platform Execution

**Files:**
- Modify: `docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md`
- Create: `docs/superpowers/specs/2026-10-28-platform-pedagogical-policy-design.md`
- Create: this plan

**Interfaces:**
- Consumes: canonical Legacy educational docs, Go domains, current branch proof.
- Produces: an order that begins with product policy, roles, canonical data and cross-layer contracts; school is one of several workstreams.

- [x] **Step 1: Record** current source/Go SHA and explicit observed evidence; do not promote planned behavior to tested behavior.
- [x] **Step 2: Update** P0/P1/P2 gates to cross-platform dependencies and record completed school work as integrated slices, not first-principles architecture.
- [x] **Step 3: Check** all affected docs paths exist (`test -f`) and verify diff/status; expected only intended changes.
- [ ] **Step 4: Commit** exact doc files with message `docs: establish ALMEAA educational architecture contract`.

### Task 3: CI & Handoff

**Files:** no product files beyond Tasks 1–2.

**Interfaces:** Produce focused PR against current Go `main` with exact-head test/CI evidence; leave protected branch and production untouched until relevant checks pass.

- [ ] **Step 1: Verify** `git diff --check`, focused Go domain tests, and architecture scope.
- [ ] **Step 2: Push** branch / create a PR, never force `main` and never upload secrets.
- [ ] **Step 3: Verify** Backend/Database/Frontend/Frontend E2E workflows on the exact PR head; report exceptions truthfully.
- [ ] **Step 4: Record** SHA, PR, test outcomes, verified vs not-proven and the next platform-first milestone in the migration checkpoint.

## Pre-flight Interface Check

Task 1 changes only the application's composition of existing repository pages; it does not alter repository method signatures, the HTTP endpoint, or `MasteryReadinessFrom`. Task 2 documents that behavioral contract for any future user-facing screen. No cross-task type mismatch is expected.
