# Reporting / Operations Integrated Parity Certification

Status: **FINAL DOCUMENTATION GATE CANDIDATE**

## Source basis
Re-audited against:
- V2 `main` baseline `7b571db33cadd10c0c7ecc4b265070a45864385a`;
- latest read-only legacy checkpoint `637a205e3c005602cd34ba6f729d6642796384ea`;
- V2 Blueprint reporting/operations/release acceptance contracts;
- legacy production-closure, release-hardening, health/readiness, deployment-identity, disaster-recovery and performance evidence documents.

## Existing trusted V2 foundation
The merged Reporting / Operations foundation already provides:
- role-scoped bounded overview/results over canonical Organizations/Assessment/Learning truth;
- separate school aggregate/detail/export permissions;
- self-only student reports and no parent access through the generic reporting facade;
- direct CSV export that fails closed above 5000 rows and never exposes answer-level data;
- platform-admin-only bounded immutable audit reads;
- PostgreSQL/Redis dependency readiness plus bounded notification/audit/classroom/AI counts;
- explicit backup/restore external-proof state rather than fabricated readiness;
- reversible reporting/audit read indexes and responsive reporting/operations UIs.

## Source-backed integrated additions

### Date-scoped reporting without widening authority
Legacy result analytics support date filters. V2 now accepts optional `dateFrom` / `dateTo` date-only filters for:
- overview;
- paginated results;
- direct CSV export.

The same normalized UTC range is applied after role/school/class/teacher scope resolution. `dateTo` is inclusive at the API surface and converted to an exclusive next-day UTC bound internally. Invalid/inverted ranges fail closed. The date filter does not grant export/detail authority and does not change the 5000-row direct-download cap.

The responsive reporting UI exposes the same date range for learner and staff/admin views, and makes clear that the range is shared by overview, result list and CSV.

### Release identity is not release certification
Legacy production closure repeatedly distinguishes exact deployed SHA proof from application health. V2 Operations now surfaces:
- runtime environment;
- optional deployment provider label;
- optional `APP_RELEASE_SHA`;
- release identity proof state;
- an explicit release-evidence matrix.

A configured SHA is labeled `declared`, not `verified`. No runtime environment variable can by itself prove that Vercel/Render/staging/production actually serves that SHA.

### Explicit release evidence matrix
Operations now keeps these release evidence classes visible:
- release identity;
- observability;
- backup/restore;
- performance/load;
- repository/deployment governance.

Possible evidence states deliberately distinguish configuration from proof. Sentry/OTel configuration can become `configured_not_verified`; live ingestion/alerting remains external proof. Backup/restore, production-equivalent load and governance remain `external_proof_required` until independently supplied.

The release decision is:
- `blocked_internal_readiness` when PostgreSQL/Redis readiness is blocked;
- otherwise `internal_ready_external_evidence_pending`.

It never returns `production_ready`.

## Configuration contract
Deployment may provide:
- `APP_RELEASE_SHA`;
- `DEPLOYMENT_PROVIDER`;
- `SENTRY_DSN`;
- `OTEL_EXPORTER_OTLP_ENDPOINT`.

Only non-secret booleans/labels and the commit SHA are exposed to the platform-admin Operations surface. Secret credential values are never returned.

## Deliberate non-claims
This certification does not invent or claim:
- a successful dated PostgreSQL/R2 restore drill;
- achieved RPO/RTO;
- production p50/p95/p99 or 500/1000-user capacity;
- live Sentry/OTel ingestion or alert routing from configuration alone;
- GitHub branch protection/ruleset state from inside the application;
- a verified Vercel/Render deployment identity from a declared environment variable;
- retention/anonymization/legal purge policy;
- async export above 5000 rows;
- custom BI/report-builder semantics.

Those remain external/policy evidence for the later release-certification sweep.

## Required closure
The final documentation-inclusive head must pass Database CI, Backend CI, Frontend CI and Frontend E2E on the same exact SHA. Browser evidence must cover:
- self-scoped mobile reporting with date filtering and no answer-key leakage;
- admin Operations release-evidence center with a declared SHA that is visibly not treated as certification;
- explicit backup/restore and other external evidence gaps.

Latest legacy must be re-checked immediately before merge. Status remains **TESTED**, not `PARITY_PROVEN`, unless all release evidence classes are independently satisfied.


## Green implementation checkpoint
Implementation head `ef3079a150ffd1517f8d21290fd5cffd8a00dbca` passed all four required gates on the same exact SHA:
- Database CI `36411007939`.
- Backend CI `36411007954`.
- Frontend CI `36411007943`.
- Frontend E2E `36411007956` — 68/68.
- browser evidence artifact `10964670878`, digest `sha256:204c0779120e2ff7fb2dd8bdbb10c7ef7fd92c9bd950cc898a0b5a9dec2a2207`.

The browser evidence proves:
- learner mobile reporting remains self-scoped and answer-key safe while an optional date range is applied to both overview/results and CSV;
- the Operations center exposes a declared staging release SHA without calling it verified;
- observability configuration is visibly `configured_not_verified`;
- backup/restore, performance and governance stay explicit external evidence gaps.

CI convergence preserved behavior. Backend initially found only Go formatting drift in three changed files. E2E initially found an ambiguous locator because the intentionally repeated `external_proof_required` state now appears across multiple release-evidence cards; the backup proof received an explicit test id rather than removing or weakening any evidence state.

## Final same-domain legacy delta re-check
Legacy advanced from `637a205e3c005602cd34ba6f729d6642796384ea` to `851f28ec34504179cbbaf87f5e0642282c01b6d6`. The one-commit PLAN 7 delta changes only:
- the platform-v3 handover workflow;
- PLAN 7 AI live-certification evidence;
- an AI certification smoke contract;
- the AI failover contract script.

It changes no Reporting route/read model/export, Operations readiness/audit/runtime surface, backup/restore implementation, deployment identity contract or reporting UI. No Reporting / Operations behavior is imported from this delta.
