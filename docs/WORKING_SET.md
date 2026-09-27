# Current Working Set

## Current phase
Cross-domain parity / release certification.

## Foundation gate
GREEN.

## Completed certification checkpoint
Identity/Auth internal parity — **TESTED** in PR #69.

Evidence in this checkpoint:
- integrated desktop/mobile Auth browser journeys.
- deterministic V2 Auth screenshots.
- Backend + Database + Frontend + Frontend E2E exact-head gates.
- external Google/WhatsApp live proof and direct legacy-runtime screenshot comparison remain explicit external evidence; they are not treated as CI passes.

## Next allowed code areas
Organizations / Schools / Classes parity only, plus narrowly required shared test/documentation files:
- internal/organizations/**
- Organizations-owned migrations / queries when an actual gap is proven
- apps/web Organizations/director/teacher-workspace surfaces required by the parity audit
- targeted Organizations E2E/visual evidence
- docs/domains/organizations/**
- docs/CURRENT_STATE.md
- docs/PARITY_MATRIX.md
- docs/WORKING_SET.md

## Guardrails
- Start from current `main` only after PR #69 merges.
- `nasef6464/almeaacodax` remains read-only behavioral/visual reference.
- Do not invent business rules to convert UNKNOWN/external evidence into a pass.
- Preserve owner-domain boundaries; Identity does not regain Organizations relationship ownership.
- No production go-live claim from CI alone.

## Next exact action
Audit Organizations / Schools / Classes against the parity matrix and legacy observable workflows, select the first bounded internal gap, implement only source-backed corrections, then require Database + Backend + Frontend + E2E on the exact documentation-inclusive head before merge.
