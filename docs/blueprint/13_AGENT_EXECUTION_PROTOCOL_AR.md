# 13 — Agent Execution Protocol

## Mission

Rebuild ALMEAA internally while preserving product behavior described in Product Blueprint V1.

## Absolute first step

Do NOT start Go implementation.

Read all files in `docs/product-blueprint-v1/`.

Then inspect the current code only to:
- verify blueprint statements.
- fill gaps.
- identify conflicts.
- locate exact legacy behavior.

Output `DISCOVERY_GAP_REPORT.md`.

## Truth labels

Every discovery:
- VERIFIED_CURRENT_CODE
- VERIFIED_RUNTIME
- INTENDED_PRODUCT
- PROPOSED_TARGET
- LEGACY_BUG
- UNKNOWN_NEEDS_OWNER

Never merge these labels.

## Workspaces

Old repo/branch is reference only.
New implementation must be isolated in separate repository/branch/worktree.

Do not alter old platform to “make migration easier”.

## Phase 0 — Discovery

Produce:
- complete capability matrix.
- route/API inventory.
- model/entity inventory.
- screen inventory.
- role/scope matrix.
- external integration inventory.
- test inventory.
- known ambiguity list.

Check against blueprint.

## Phase 1 — Target design

Produce:
- ADRs.
- Go package boundaries.
- PostgreSQL ERD.
- OpenAPI conventions.
- security model.
- migration/seed plan.
- observability.
- data retention placeholders.
- performance budget.

No feature code until architecture review passes.

## Phase 2 — Foundation

- repository structure.
- config.
- logging/request IDs.
- health/readiness.
- PostgreSQL/migrations.
- Redis.
- OpenAPI.
- auth/session.
- testing harness.
- Docker/CI.

## Phase 3+ — Domain slices

Recommended order:
1. identity.
2. organizations/schools.
3. taxonomy.
4. content/foundation/courses.
5. question bank/media.
6. assessment.
7. learning/adaptive/review.
8. commerce/access.
9. parents.
10. notifications.
11. smart classroom/realtime.
12. AI.
13. reports/operations.

Can adjust dependencies, but document reason.

## Slice definition

A slice is not closed until:
- schema/migration.
- domain/service.
- repository.
- API.
- React integration.
- permissions.
- unit tests.
- DB integration tests.
- E2E.
- parity matrix.
- docs updated.

## Agent context efficiency

Do not re-read all 1,600+ files every task.

For each task load:
- 00 master.
- relevant domain blueprint.
- target architecture.
- parity contract.
- exact old code references for that capability.

Maintain a `CURRENT_WORKING_SET.md`.

## No hallucinated features

If blueprint/code do not define behavior:
- mark UNKNOWN.
- propose options.
- do not silently choose business policy.

Technical internal implementation can be decided autonomously when it does not alter observable behavior.

## Question invariants

- stable code.
- text/image support.
- taxonomy validation.
- media dedupe.
- no answer exposure.
- no duplication across quizzes/review.
- provenance.
- AI/voice metadata.
- scoped counters.

## Assessment invariants

- definition separate from distribution.
- server scoring.
- attempts idempotent.
- version/snapshot.
- resume.
- audience scope.
- result/review policy.

## School invariants

- cross-school isolation.
- membership != entitlement.
- teaching assignment explicit.
- parent links explicit.
- director permissions delegated.
- hybrid account safe.

## Data/bandwidth invariants

- bounded reads.
- no unbounded user arrays.
- direct object storage.
- jobs for heavy work.
- caching not correctness.
- bytes/tokens measured.

## Review protocol

Use independent QA pass:
- author agent does not solely certify own work.
- QA compares old/new.
- regression/negative tests.
- visual screenshots.

## Commit discipline

Small coherent commits:
- schema.
- service.
- API.
- UI.
- tests/docs if appropriate.

Never mix unrelated domain rewrites.

## Stop conditions

Stop and mark BLOCKED only for:
- missing owner business decision.
- unavailable external credential required for proof.
- irreversible data policy without approval.
- safety/security uncertainty.

Do not stop for ordinary build/test failures; diagnose and repair.

## Final certification

Create:
- FINAL_PARITY_REPORT.md
- FINAL_SECURITY_REPORT.md
- FINAL_PERFORMANCE_REPORT.md
- FINAL_DATA_INTEGRITY_REPORT.md
- FINAL_OPERATIONS_RUNBOOK.md

No cutover until critical parity rows are PARITY_PROVEN.
