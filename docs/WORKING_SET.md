# Current Working Set

## Current phase
Cross-domain parity / release certification.

## Foundation gate
GREEN.

## Completed certification checkpoints
- Identity/Auth internal parity — **TESTED** in PR #69.
- Organizations / Schools / Classes internal parity — **TESTED** in PR #70.
- Taxonomy internal parity — **TESTED** in PR #71.
- Question Bank / Media internal parity — **TESTED** in PR #72.

Question Bank / Media evidence in the current checkpoint:
- real responsive `/admin-dashboard/questions` staff workspace.
- bounded server-side filters and coverage; no browser-wide question inventory load.
- canonical Taxonomy path/subject/main-sub skill authoring.
- exact current-version review/workflow controls and no destructive delete UI.
- browser SHA-256 + presign + direct object PUT + server completion verification; Go never receives question image bytes.
- platform-admin V2 import surface remains dry-run-first and server-preflight authoritative.
- teacher UI omits admin-only import actions.
- Database + Backend + Frontend + Frontend E2E exact-head gates.
- deterministic Question Bank desktop and teacher-mobile screenshots.
- live R2/CDN deployment smoke and direct legacy-runtime side-by-side screenshot comparison remain external evidence; neither is treated as a CI pass.

## Next allowed code areas
Foundation learning / Content parity only, plus narrowly required shared test/documentation files:
- internal/content/**
- internal/learning/** only where the audited Foundation learning flow proves an owner-domain gap
- Content-owned migrations / queries only when an actual gap is proven
- apps/web Content/Foundation/Learning surfaces required by the parity audit
- targeted Content/Foundation E2E/visual evidence
- docs/domains/content/**
- docs/domains/learning/**
- docs/CURRENT_STATE.md
- docs/PARITY_MATRIX.md
- docs/WORKING_SET.md

## Guardrails
- Start Foundation learning / Content parity from current `main` only after PR #72 merges.
- `nasef6464/almeaacodax` remains read-only behavioral/visual reference.
- Taxonomy owns hierarchy IDs; Content stores references only.
- Question Bank owns question/version truth; Content does not embed question payloads.
- Media owns binary asset lifecycle; Content stores asset references only.
- Commerce owns entitlement/access truth; Content publication/visibility must not become a second purchase authority.
- Do not invent approved-content editing/versioning policy that remains explicitly unresolved.
- No production go-live claim from CI alone.

## Next exact action
Audit Foundation learning / Content against the parity matrix and legacy observable course/lesson/foundation/library learner + admin workflows, select the first bounded internal gap, implement only source-backed corrections, then require Database + Backend + Frontend + E2E on the exact documentation-inclusive head before merge.
