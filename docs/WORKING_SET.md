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
- final documentation-inclusive exact head `2a98ad4d4e09c8ed7de0ef1cf0c62a5934f4cf88` passed Database `36334351564`, Backend `36334351596`, Frontend `36334351571`, and Frontend E2E `36334351583` (61/61).
- final browser evidence artifact `10936483838`, digest `sha256:43e37c2ae7e81be630662d0b4c94a965e184c3aa92c247353e91edceb76e809a`; PR #72 merged as `d5c23a1ee856af77aac3e047ccb795622d1d0eb7`.
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
- Start Foundation learning / Content parity from current `main`; PR #72 is merged and its final documentation-inclusive exact head is green.
- `nasef6464/almeaacodax` remains read-only behavioral/visual reference.
- Taxonomy owns hierarchy IDs; Content stores references only.
- Question Bank owns question/version truth; Content does not embed question payloads.
- Media owns binary asset lifecycle; Content stores asset references only.
- Commerce owns entitlement/access truth; Content publication/visibility must not become a second purchase authority.
- Do not invent approved-content editing/versioning policy that remains explicitly unresolved.
- No production go-live claim from CI alone.

## Completed certification checkpoint
Foundation learning / Content integrated parity — **TESTED / MERGED** in PR #74. Final exact head `ddf8961c606b8f9d3184997cc655f6be2cf3bae5` passed Frontend CI `36371378688` and Frontend E2E `36371378748` (62/62), artifact `10949426615`; squash merge `2596e564854edf41e296998b0b641161d1d60a16`. Backend/database contracts were unchanged by this UI certification slice.

## Active certification batch
Assessment integrated parity certification is in progress: the missing learner Directed Assignment entry surface now consumes only the server-scoped `assessment-assignments/mine` projection and enters the canonical Attempt runner. Assessment integrated certification final documentation-inclusive head `5f0f3db3d7f40a2659db47f8f85866f73d1383a1` is green: Frontend CI `36372298444`, E2E `36372298458` (64/64), artifact `10949179677`; same-domain legacy delta re-check complete. Ready to merge PR #76.

Assessment certification PR #76 merged as `43e3c98491aad8ee5a0610ced69d751f7c51fa82`.

## Completed certification checkpoint — Review / Adaptive Learning
PR #78 is **TESTED / MERGED**. Final documentation-inclusive head `ba9d44fcd28fc2cfd3759a1a234261dd10e55f96` passed Database `36376123212`, Backend `36376123245`, Frontend `36376123259`, and Frontend E2E `36376123154` (64/64). Browser artifact `10951385237`, digest `sha256:a3a5d19fa8128f122855cb16b9a48e7a709eaaf4674e9ebafd0907d09763b3f7`; squash merge `c21874eeca576241c44fdd08507dfa87dae73121`. Legacy re-check reached `6927f7e6a05447862b4872c5203503fb7296e69c`; its FND26 taxonomy repair did not change Adaptive/Review behavior.

## Active certification batch — Commerce
Start from current `main`. Re-audit products/packages, entitlements, checkout, discounts, access codes, school seats, Tap provider flow, revenue/payout and refund/chargeback behavior against the latest legacy reference. Keep live Tap/provider proof, partial-refund/clawback policy and unspecified multi-trainer allocation explicitly external/UNKNOWN unless source evidence resolves them.
