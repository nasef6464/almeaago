# SCHOOL-005A School Director Assessment Listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task. Each code slice follows RED→GREEN TDD.

**Goal:** A permission-scoped school-director assessment listing that reflects school/class/individual audiences without granting access to an unrelated school's private assessments.

**Architecture:** Keep the existing `/api/school-access` compatibility adapter for the React director dashboard; put school-authorized assessment read logic behind `organizations/application` and a narrowly scoped PostgreSQL query. Persist explicit whole-school targeting instead of inferring it from `assessment_assignments.school_id`. The assessment scoring engine remains owned by `internal/assessment`.

**Tech Stack:** Go 1.27, pgx/PostgreSQL migrated schema, Chi HTTP, React/TypeScript, Playwright, existing four GitHub checks.

**Spec:** `docs/migration/09_SCHOOL_005_ASSESSMENTS_CONTRACT_AR.md`; this plan delivers **005A only**; 005B–D stay separate changes.

## Global Constraints

- Source Node code and live databases remain read-only; work only in `almeaago` feature branch.
- `school_admin` role **and** active school membership **and** `SCHOOL_ASSESSMENTS_MANAGE` **and** active `SCHOOL_ASSESSMENTS` module are required on the requested school.
- `assessment_assignments.school_id` is scope, not whole-school audience. Existing class and student assignments must not silently become school-wide.
- An assessment outside the target audience and a private draft owned by another school must not be returned, regardless of who created it.
- Explicit targeting is authoritatively checked in Go/SQL; React must never decide the viewer's scope.
- `dueDate` is only one value in Node, whereas PG can have multiple assignment windows; do not invent a universal due date; document any lost/multi-window mapping.
- Do not render edit/publish/clone/results buttons until SCHOOL-005C supports their actual APIs and policies.
- Every task uses actual migrated public schema for SQL tests, plus 403/404 cases and same-SHA four CI checks.

## Review Focus

1. School-wide school_id without a whole-school audience flag: negative DB test in Task 2.
2. Class in school A erroneously attached to assignment with school_id B: reject/count only valid school-class relationships in Task 2.
3. Individual target no longer actively enrolled: verify membership scoping in Task 2.
4. Director switches schools while an API response is delayed A→B→A: browser test in Task 4.
5. Contract module expired while permission still exists: service-level and HTTP denial in Tasks 1 and 3.

---

### Task 1: School-specific authorization contract

**Files:**
- Modify: `internal/organizations/application/director_core.go`
- Test: `internal/organizations/application/director_core_test.go`

**Interfaces:**
- Consumes `Repository.SchoolContexts(ctx, actor.ID)` and `org.SchoolContext.{SchoolID,Role,Permissions,Modules}`.
- Produces `func (s *Service) requireDirectorCapability(ctx context.Context, actor identity.User, schoolID, permission string, module org.SchoolModule) error`.

- [ ] **RED:** tests with valid and invalid UUID, missing school-admin role, wrong school, revoked membership, permission without module and module without permission; `SCHOOL_ASSESSMENTS_MANAGE` + `SCHOOL_ASSESSMENTS` succeeds only together.
- [ ] **Verify RED:** `go test ./internal/organizations/application -run TestDirectorAssessmentCapability -count=1` fails on absent method/incorrect behavior.
- [ ] **GREEN:** read trusted contexts, match exact `schoolID`, role, permission, module; return `ErrInvalidInput` for malformed UUID, `ErrForbidden` for unauthorized; do not trust form/query-provided permissions.
- [ ] **Verify GREEN:** same command passes; `go test ./internal/organizations/application/...` passes.
- [ ] **Commit:** `feat(school): gate school assessment access by scope and contract`.

### Task 2: Explicit audience storage and query

**Files:**
- Create: `migrations/0000XX_assessment_school_audience.up.sql`, `.down.sql` (pick next **unused** migration ordinal with read-only listing).
- Create: `internal/reporting/repository/postgres/director_assessments.go`.
- Test: `internal/reporting/repository/postgres/director_assessments_integration_test.go`.
- Modify: `internal/reporting/repository/postgres/director_overview.go` and its integration test to count explicit whole-school assignments without cross-school leakage.
- Modify: `internal/organizations/domain/director_core.go` (DTO for `{assessments,classes}`), `internal/organizations/application/director_core.go` (directory interface).

**Interfaces:**
- Produces `DirectorAssessments(ctx context.Context, schoolID string) (org.DirectorAssessmentWorkspace, error)` on scoped directory.
- `DirectorAssessmentWorkspace` exposes Node-compatible item IDs, title, subject, publication; `classes` are scoped active classes; `targetGroupIds` are only explicitly recorded group audiences; ambiguous `dueDate` stays null until defined.

- [ ] **RED migration check:** create fixture using `assessment_assignments.school_id=A` but no explicit class/user/school audience; assessment must not appear. Include class A, class B misattached, direct student in A/in B, published vs own draft, two matching assignments (deduplicate), no records, expired membership.
- [ ] **Verify RED:** integration suite on migrated public schema fails for absent `targets_entire_school` / query; no shadow table named like a production table.
- [ ] **GREEN:** additive `assessment_assignments.targets_entire_school boolean NOT NULL DEFAULT false` and constraint requiring `school_id IS NOT NULL` when true; query explicit target union plus narrowly owned private drafts, order newest-first, limit 100, `EXISTS` to avoid duplicates, bind school ID in SQL. Never `OR owner_school_id=$1` for every published school assessment.
- [ ] **Verify GREEN:** `go test ./internal/reporting/repository/postgres -run TestDirectorAssessments -count=1`, migration up/down on a disposable DB; no user data modified.
- [ ] **Commit:** `feat(school): persist explicit school assessment audience and scoped listing`.

### Task 3: Authorized HTTP endpoint

**Files:**
- Modify: `internal/organizations/transport/http/legacy_handler.go`, `legacy_director_core.go`.
- Test: `internal/organizations/transport/http/legacy_director_core_test.go`.

**Interfaces:**
- Consumes Tasks 1–2 service `DirectorAcademicAssessments(...)` that calls capability check then directory query.
- Produces `GET /api/school-access/director/schools/{schoolId}/academic/assessments` JSON `{assessments:[...],classes:[...]}`.

- [ ] **RED:** 200 expected with exact JSON keys for authorized A; 403 wrong school/role/expired module; 400 invalid UUID; list empty is 200 not a false 404.
- [ ] **GREEN:** authenticate, call only scoped service, marshal source-compatible card shape, never accept user-supplied school scope except route ID validated in service.
- [ ] **Verify:** Go application/HTTP suite, backend CI, database CI.
- [ ] **Commit:** `feat(school): expose director academic assessment list API`.

### Task 4: Source-aligned read-only director section

**Files:**
- Modify: `apps/web/src/features/organizations/components/SchoolDirectorSectionNav.tsx`, `apps/web/src/features/organizations/api/organizations-client.ts`, `apps/web/src/features/organizations/pages/SchoolDirectorDashboardPage.tsx`.
- Test: `apps/web/tests/e2e/organizations-director.spec.ts`.

**Interfaces:**
- Consumes Task 3 API; adds `assessments` section in `التعلم والمتابعة` group; shown only with `SCHOOL_ASSESSMENTS_MANAGE` + `SCHOOL_ASSESSMENTS`.

- [ ] **RED:** permission+module required; count from actual list; school switching and stale response isolation; list items with status; no unauthorized editor buttons; widths 360–1920 without horizontal scroll.
- [ ] **GREEN:** cards/source labels/colors and limited list, loading and error states; no fake CRUD, no stale previous school data, no arbitrary `schoolId` query.
- [ ] **Verify:** `npm run build`, `npm run e2e` locally if Chromium available, four CI workflows on the same remote HEAD.
- [ ] **Commit:** `feat(school): expose scoped assessment cards in school director dashboard`.

### Task 5: Independent review and evidence

**Files:**
- Modify: `docs/migration/09_SCHOOL_005_ASSESSMENTS_CONTRACT_AR.md` execution status.
- Create: `docs/migration/10_SCHOOL_005A_EXECUTION_LOG_AR.md`.

- [ ] Review auth/SQL/React crossing school boundaries and the explicit whole-school target flag; independently verify tests against the actual migrations.
- [ ] Collect `go test`, Frontend CI, Backend CI, Database CI, E2E green HEAD and screenshot evidence; label Node comparison `PENDING` until same-fixture screenshots checked.
- [ ] PR/merge only after all required green gates; log exact commit and remaining 005B–D.
