# Current Working Set

## Current phase
Cross-domain parity / release certification.

## Foundation gate
GREEN.

## Completed certification checkpoints
- Identity/Auth internal parity — **TESTED** in PR #69.
- Organizations / Schools / Classes internal parity — **TESTED** in PR #70.

Organizations evidence in the current checkpoint:
- real responsive school-director workspace.
- bounded student/class/teacher delegated operations.
- exact-school context isolation and explicit no-delegation state.
- active contract modules projected into canonical school context.
- optional Organizations-owned delegated tools dual-gated by permission + `SCHOOL_CORE`.
- deterministic director desktop/mobile screenshots.
- Database + Backend + Frontend + Frontend E2E exact-head gates.
- direct legacy-runtime side-by-side screenshot comparison remains external visual evidence and is not treated as a CI pass.

## Next allowed code areas
Taxonomy parity only, plus narrowly required shared test/documentation files:
- internal/taxonomy/**
- Taxonomy-owned migrations / queries when an actual gap is proven
- apps/web Taxonomy/admin surfaces required by the parity audit
- targeted Taxonomy E2E/visual evidence
- docs/domains/taxonomy/**
- docs/CURRENT_STATE.md
- docs/PARITY_MATRIX.md
- docs/WORKING_SET.md

## Guardrails
- Start Taxonomy parity from current `main` at/after Organizations merge `b7a9ae7a7844e187efec714fcec43b382a6ffa2f`.
- `nasef6464/almeaacodax` remains read-only behavioral/visual reference.
- Do not invent taxonomy levels/hierarchies or business rules absent from source evidence.
- Preserve owner-domain boundaries; Content/Question Bank/Assessment consume Taxonomy IDs but do not own Taxonomy hierarchy truth.
- No production go-live claim from CI alone.

## Next exact action
Audit Taxonomy against the parity matrix and legacy observable admin/bootstrap workflows, select the first bounded internal gap, implement only source-backed corrections, then require Database + Backend + Frontend + E2E on the exact documentation-inclusive head before merge.
