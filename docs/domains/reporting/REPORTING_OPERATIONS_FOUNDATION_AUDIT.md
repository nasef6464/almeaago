# Reporting / Operations Foundation Audit

Status: **TESTED / MERGED**

## Sources reviewed
This slice is grounded in:
- `docs/blueprint/17_UI_SCREEN_WORKFLOW_MAP_AR.md`: student, school/supervisor and platform reporting surfaces plus the Operations/Admin center.
- `docs/blueprint/18_MODULE_API_BOUNDARY_MAP_AR.md`: Reporting owns read models/aggregates/exports and does not own business-state mutation; Operations owns audit/readiness/backups/telemetry/integration evidence.
- `docs/architecture/DATABASE_SCALE_QUERY_BUDGET_AR.md`: bounded dashboard reads, no full-database bootstraps, no N+1 report loops and background handling for genuinely large exports.
- `docs/architecture/DATA_GROWTH_PLAN_AR.md`: results/evidence/audit logs are growth-sensitive facts and require indexed bounded access.
- legacy scoped report analytics/export and admin audit-log routes were used as behavioral evidence, not copied as a Mongo schema.

## Reporting ownership
Reporting is a read-only composition boundary. It does not create a second score, mastery, school-membership or assignment authority.

Current endpoints:
- `GET /api/v1/reports/overview`
- `GET /api/v1/reports/results`
- `GET /api/v1/reports/results.csv`

The overview uses explicit read budgets:
- students: default 500, max 1000.
- recent results: default 2000, max 5000.
- recent attempts/evidence: default 3000, max 5000.

When a student population exceeds the bounded overview sample, the response returns the exact scope student count separately from the sampled count and marks `isTruncated`. Result/average cards are explicitly presented as sample facts in that case. Paginated result detail and export resolve authorization independently over the full allowed scope rather than silently pretending that the overview sample is complete.

## Reporting authorization
- Student: own result scope only.
- Platform admin: platform report or an explicitly selected school/class.
- School admin: active school membership plus `SCHOOL_REPORTS_AGGREGATE_VIEW`; detail and export require their dedicated permissions.
- Supervisor: canonical active supervisor school/class scope. A class-scoped supervisor is not widened to the full school.
- Teacher: active teacher school membership and active teaching assignment; result evidence must match assigned class/subject boundaries.
- Parent is intentionally not admitted to this generic endpoint; the Parents phase has its separate linked-child facade.

School reports include only Assessment facts with a canonical school assignment/session context and a current active school student membership. Platform self-study attempts are not blended into school analytics.

Result DTOs and CSV contain summary facts only. Learner answers, question text, correct options and answer keys are not included.

## Direct export boundary
Direct CSV export is limited to 5000 result rows and fails closed with HTTP 413 above that cap. The code does not silently truncate a file and does not invent an object-storage/background export contract. A larger asynchronous export job remains a separate future design if measured demand requires it.

Teacher/supervisor export authority is not inferred. School-admin export requires `SCHOOL_REPORTS_EXPORT`.

## Operations ownership
Operations exposes:
- `GET /api/v1/operations/audit`
- `GET /api/v1/operations/readiness`

Both are platform-admin only.

The audit reader is bounded and filterable by exact action/status/resource/actor. The audit ledger remains immutable from this UI; this slice adds no mutation/delete endpoint.

The readiness view reads:
- PostgreSQL and Redis health.
- notification pending/retrying/failed counts.
- blocked/failed audit counts for the previous 24 hours.
- current live classroom count.
- enabled AI provider count.
- whether deployment-owned integrations are configured.

It never returns provider secrets.

## Backup / restore truth
No dated verified restore drill is present in application evidence. The API therefore returns:
- `backupRestoreProof = external_proof_required`.
- a detail saying deployment infrastructure must provide dated restore evidence.
- at best `ready_with_notes` while dependencies are healthy; it does not claim unconditional release readiness.

No retention duration, backup schedule, off-site storage policy or restore success is invented by this slice.

## Database support
Migration `000038_reporting_operations_indexes` adds indexes for:
- default chronological audit review.
- audit status/action review.
- recent Assessment result sampling.
- scoped recent mastery evidence.

The migration remains additive and fully reversible.

## Frontend
- `/reports` provides the role-scoped reporting experience.
- `/admin-dashboard/reports` exposes the same reporting read model in the admin shell.
- `/admin-dashboard/operations` exposes readiness/integration evidence and bounded audit history.
- the admin sidebar links both workspaces.
- responsive layouts and explicit loading/error/empty/truncation/evidence-gap states are implemented.

## Deliberate non-claims / remaining boundaries
This batch does **not** claim:
- PARITY_PROVEN or production load proof.
- background exports above 5000 rows.
- verified backup/restore, off-site storage or disaster-recovery drill.
- exact retention/anonymization/legal purge durations.
- external provider credential success.
- full platform observability/APM/Sentry certification.
- custom BI/report-builder semantics.
- that sampled overview averages are full-population metrics when `isTruncated=true`.

These require production evidence, explicit policy or a separately specified workflow.

## Verification checkpoint
- PR #67 exact tested head: `08fe59c45b565c0f95fcdd9e26de273a22552d85`.
- squash merge commit: `93be0a938a7d06f2052475d030ebbc8b5d06b962`.
- Database CI `36306943000`: PASS — all migrations apply, reporting/operations indexes verified, every migration rolled back, then all migrations re-applied.
- Backend CI `36306943053`: PASS — module lock, sqlc compile, gofmt, go vet and all Go tests.
- Frontend CI `36306942943`: PASS — typecheck and production build.
- Frontend E2E `36306943040`: PASS — complete 45-test browser suite including self-scoped student reporting and Operations evidence-gap behavior.
- browser evidence artifact `content-browser-evidence` id `10928135095`, digest `sha256:d64c8774633136511b88f76336a4940979726d7c5bc90ff339f4adb42aa22078`.
- early Backend gates exposed gofmt/source corruption and a helper-name collision; UUIDv7 and optional teacher UUID filtering were also hardened. Initial E2E failures were selector false positives only. All corrections retained the intended authorization/data behavior, then all four gates reran green on the exact final head.


## Integrated re-certification checkpoint
The global release-certification sweep re-audited this foundation against legacy production-closure/release-hardening evidence. Two internal gaps were selected without converting external proof into application truth:

1. Reporting now supports optional date-scoped overview/results/CSV using one normalized UTC range after canonical authorization resolution. This restores a source-backed analytics filter while preserving all read/export caps and secrecy boundaries.
2. Operations now exposes declared release identity and a release-evidence matrix that explicitly separates configuration from certification. A runtime SHA is `declared`, observability configuration is at most `configured_not_verified`, and backup/restore, production load and governance remain `external_proof_required`.

The application still cannot certify its own external deployment, restore drill, provider control plane or production load by assertion.
