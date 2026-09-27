# Current Working Set

## Current phase
Cross-domain parity / release certification.

## Foundation gate
GREEN.

## Completed certification checkpoints
- Identity/Auth internal parity — **TESTED** in PR #69.
- Organizations / Schools / Classes internal parity — **TESTED** in PR #70.
- Taxonomy internal parity — **TESTED** in PR #71.

Taxonomy evidence in the current checkpoint:
- public active-only `core|compact|full` bootstrap preserved.
- authenticated platform-admin lifecycle bootstrap includes active/inactive/archived hierarchy.
- real responsive `/admin-dashboard/taxonomy` workspace.
- path/level/subject/main-sub-skill create, edit and lifecycle controls.
- stable codes/IDs and no destructive Taxonomy delete.
- target hierarchy remains normalized; legacy Section is not recreated.
- teacher persona does not issue the admin bootstrap; server admin authorization remains independent.
- Database + Backend + Frontend + Frontend E2E exact-head gates.
- deterministic Taxonomy desktop/mobile screenshots.
- direct legacy-runtime side-by-side screenshot comparison remains external visual evidence and is not treated as a CI pass.

## Next allowed code areas
Question Bank / Media parity only, plus narrowly required shared test/documentation files:
- internal/questionbank/**
- internal/media/**
- Question Bank / Media-owned migrations or queries only when an actual gap is proven
- apps/web Question Bank/admin/media surfaces required by the parity audit
- targeted Question Bank / Media E2E/visual evidence
- docs/domains/questionbank/**
- docs/domains/media/**
- docs/CURRENT_STATE.md
- docs/PARITY_MATRIX.md
- docs/WORKING_SET.md

## Guardrails
- Start Question Bank / Media parity from current `main` at/after Taxonomy merge `7dd71d75043e39304d340607f84246e7a0b4d525`.
- `nasef6464/almeaacodax` remains read-only behavioral/visual reference.
- Taxonomy owns path/level/subject/skill hierarchy; Question Bank stores relational classification links, not copied hierarchy truth.
- Media owns asset lifecycle/binary storage; Question Bank stores asset references only.
- Do not invent new question types, moderation policy, import semantics or media lifecycle rules absent from source evidence.
- No production go-live claim from CI alone.

## Next exact action
Audit Question Bank / Media against the parity matrix and legacy observable authoring/filter/import/visual workflows, select the first bounded internal gap, implement only source-backed corrections, then require Database + Backend + Frontend + E2E on the exact documentation-inclusive head before merge.
