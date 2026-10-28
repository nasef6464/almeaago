# SCHOOL-005C — assessment results and management parity (27 Oct 2026)

Source of truth: `almeaacodax` Node school assessment workflow. Target: `almeaago` Go/PostgreSQL. Source is **read-only**. Base: merged SCHOOL-005B `b643159`.

## Observed Node contract

- `DirectorAssessmentCards`: open **النتائج والإدارة** per assessment, load operation-scoped server context, show summary / students / subject and skills tabs, clone, publish/hide, remind absent learners, reopen deadlines. It locks content after publication or submissions.
- `schoolAssessmentManagementPolicy`: recompute staff identity and scope from persistence; school-admin access is bound to explicit school and active contractual module. Never rely on browser-provided group IDs or roles.
- `schoolAssessmentReport`: target audience is counted separately from the latest **school assessment** result per learner; response has `coverage.complete=false`, `started=null` because legacy started-attempt evidence is incomplete; subject/skill aggregates require persisted evidence.
- `schoolAssessmentLearners`: filter `all/completed/not_completed/needs_support`, page and search; detailed learner results require `SCHOOL_REPORTS_DETAILED_VIEW` **and** `SCHOOL_INTELLIGENCE`.

## Existing Go footprint and gaps

- SCHOOL-005A: a school-scoped assessment list, correct classroom/whole-school assignments.
- SCHOOL-005B: transactional creation from approved bank, retry idempotency, student-targeting repair.
- Missing: per-assessment result context/summary, paginated learner statuses and detail, commands, secure edit/clone, UI management panel and pixel-level cross-device comparison.

## Controlled order

### 005C-1: accurate aggregate summary (this branch)

1. Test role, school, permission and active module checks; no public staff-data route.
2. Query Postgres for the *current active target audience* across explicit whole-school, class and student assignments; intersect every target with active school student membership; deduplicate multiple assignments.
3. Join the latest submitted **assigned** result per student and this assessment/school. Exclude private practice, attempts from other schools, and unsent attempts. Produce targeted, completed, incomplete, mean, pass rate, high and low.
4. Mark incomplete evidence honestly: `started=null`, subject/skill breakdown arrays empty and coverage missing evidence; do not infer scores from attempts or invent analysis.
5. Add authenticated school-scoped API and a useful responsive director summary panel with explicit loading/error states; verify stale selected school/assessment cannot flash report from another school.
6. Go unit/integration, frontend build, Playwright E2E, GitHub checks. Review and merge only on clean CI.

### 005C-2 (next)

- Detailed learner roster paginated, statuses, support filter; require `SCHOOL_REPORTS_DETAILED_VIEW` with `SCHOOL_INTELLIGENCE`, exact audience scope, no answer-key exposure.

### 005C-3 (next)

- Management context, clone, publish/hide, reminders, deadlines, editing locks and full test matrix. The Node command policy is the acceptance reference.

### 005D (next)

- Browser-verified side-by-side visual and interaction comparison on widths 360/390/768/1024/1440/1920, Arabic RTL/font/math/image presentation, keyboard/accessibility, and real media rendering. No parity claim until measured.

## Non-negotiable safeguards

- Never write Mongo or production Postgres data during this development phase.
- Never conflate `school_id` with an implicit whole-school assignment.
- Never count a student outside active current membership even if historically targeted.
- Never count several submitted attempts from the same learner more than once.
- Keep migration additive and the Node production service intact.
