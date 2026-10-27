# SCHOOL-005B: School Director Assessment Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkboxes for tracking.

**Goal:** Let an authorized school director create and immediately publish a class-scoped or explicitly whole-school test solely from approved questions, atomically, without publishing to the public platform.

**Architecture:** Keep the Node-compatible school-access HTTP route, authorizing with existing `requireDirectorCapability` before a dedicated school assessment write repository. A single PostgreSQL transaction checks school/target/path/subject/question versions, then inserts an approved, published school-owned assessment, its version/questions and one explicit assignment. Read cards from SCHOOL-005A supply the immediate feedback. Do not grant the existing global assessment writing service to school_admin.

**Tech Stack:** Go 1.27, pgx v5, PostgreSQL, Chi, React/TypeScript, Playwright, GitHub four checks.

**Spec:** `docs/migration/09_SCHOOL_005_ASSESSMENTS_CONTRACT_AR.md`, especially the original Node `createSchoolDirectorAssessment` in `almeaacodax/server/src/modules/schools/application/schoolDirectorWorkspace.ts`.

## Global constraints

- SCHOOL-005A merged to `main` at `0c1701a883c793c71aa4912149ca21058895f566`.
- Source Node remains read-only; do not modify any live production database.
- Require school_admin, exact active school membership, `SCHOOL_ASSESSMENTS_MANAGE`, active `SCHOOL_ASSESSMENTS` module, and valid UUID.
- `targetScope='class'` must refer to an active class of this school. `targetScope='school'` uses `targets_entire_school=true` with no required `classId`. Neither may cross schools.
- All source questions must exist at an actual current version and have `workflow_status='approved'`; enforce exact selected path/subject relationship on the server. Deduplicate IDs deterministically and reject an empty set.
- Create approved and published test with `owner_type='school'`, `owner_school_id=selected school`, and no public platform placement. Never turn off approval checking to make a test pass.
- Atomicity: no assessment may exist without its required version, questions, assignment, and audit event; failure rolls back all rows.
- Prevent double-click/network retry duplicates using a stable client idempotency token with server-side durable uniqueness and payload fingerprint; reuse identical token and input returns the original assessment, changed input conflicts.
- No school-level assessment can expose results or commands until SCHOOL-005C separately implements per-assessment authorization.
- Treat `access_type`, version publications, and correct-answer readiness per actual schema constraints. Do not create mock quizzes under school director paths.

## Review focus

1. Previously approved question gets revoked between picker and submit → server rejects and transaction writes no orphan assessment.
2. Question from other path/subject looks valid by ID → reject, don't coerce silently.
3. Student can request `targetScope='school'` or class from another school → 403/400, zero writes.
4. Duplicate request token with identical/different payload (including reordered IDs) → return same ID or conflict deterministically.
5. Browser changes A→B→A during pending create → never confirm/update with old school's result.

---

### Task 1: Approved school assessment creation input contract (TDD)

**Files:** `internal/organizations/domain/director_assessments.go`, `internal/organizations/application/director_assessments_create.go`, `internal/organizations/application/director_assessments_create_test.go`.

**Interfaces:** `DirectorAssessmentCreate{Title,ClassID,TargetScope,PathID,SubjectID,QuestionIDs,RequestKey}` and `Service.DirectorCreateAssessment(ctx,actor,schoolID,input)` return `{AssessmentID,Title,ClassID,TargetScope}`.

- [ ] RED: invalid role/school/permission/module, blank title, invalid path ID, no questions, invalid targetScope, class-without-classId, duplicates normalized in stable order, invalid request key.
- [ ] GREEN: strictly normalize/validate before delegation; apply `requireDirectorCapability`; keep schoolID server-validated, never adopt client-provided owner.
- [ ] Run Go application and HTTP tests, commit.

### Task 2: Transactional PostgreSQL write and deduplication

**Files:** new additive migration for idempotency (`migrations/000043_*` if still unused), `internal/organizations/repository/postgres/director_assessments_create.go`, real PostgreSQL integration tests and `.github/workflows/database.yml`.

**Interfaces:** repository `DirectorCreateAssessment(ctx,actorID,schoolID,input)`; all SQL in a single serializable/locked transaction with rollback-on-error. Reuse `assessments`, `assessment_versions`, `assessment_version_questions`, `assessment_assignments`, `assessment_assignment_classes`, `targets_entire_school`, audit writer. ID fields and target group map to SCHOOL-005A read model.

- [ ] RED on actual migrated public schema: invalid path/subject, unapproved/revoked/wrong-path questions, stale class, all-school branch, duplicate token, duplicate questions, no rows on failed transaction.
- [ ] GREEN: validate refs with `FOR SHARE`/appropriate locks, choose real current question version, publish version after insert, append exactly one assignment and audit event, use idempotency key with fingerprint.
- [ ] Verify `go test ./internal/organizations/repository/postgres -run '^TestDirectorCreateAssessmentPostgres$' -v` in Database CI, plus negative constraints; commit.

### Task 3: Node-compatible HTTP API

**Files:** `internal/organizations/transport/http/legacy_handler.go`, `legacy_director_core.go`, and tests.

**Interface:** `POST /api/school-access/director/schools/{schoolId}/academic/assessments`, body `{title, classId, targetScope, pathId, subjectId, questionIds}`, idempotency key header; response 201 with `{assessment:{assessmentId,title,classId,targetScope}}` and safe 409 duplicate conflict.

- [ ] RED 201 success, 400 invalid selection, 403 wrong school/module/permission, CSRF denial, no same-school-wide inference from empty class.
- [ ] GREEN with server context and transaction, `go test ./internal/organizations/transport/http/...`; commit.

### Task 4: Legacy-compatible question picker and creation UI

**Files:** `apps/web/src/features/organizations/pages/SchoolDirectorDashboardPage.tsx`, separate picker form component, `organizations-client.ts`, E2E tests.

- [ ] RED: school/class mode selection, only approved bank questions, image-based content, form validation; reject hidden module and stale A→B→A response; full 360/390/430/768/1024/1366/1440/1920 responsive.
- [ ] GREEN: source-aligned form, real bank query and submission only; after create refresh authorized list and overview, no fake edit/results actions; commit.

### Task 5: Acceptance and evidence

- [ ] All four CI gates on same SHA, Database CI real migrations, Playwright screenshots and browser fallback.
- [ ] PR review/merge after verified checks, update migration execution ledger. Keep SCHOOL-005C/D visibly pending.
