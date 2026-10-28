# ALMEAA Go — Agent execution rules

Read `docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md`, `docs/superpowers/specs/2026-10-28-platform-pedagogical-policy-design.md`, and `docs/migration/17_PLATFORM_POLICY_EXECUTION_CHECKPOINT_AR.md` before work. Read the latest source `nasef6464/almeaacodax` main and its `AGENTS.md` and Master Control as the legacy behavior authority; do not assume old snapshots are current.

Treat `nasef6464/almeaago` as the only implementation repository. Preserve existing Go/PostgreSQL modules and React/Vite UI. Work in focused branches and PRs, with tests first and exact-head GitHub CI before merging. Never bypass main protection, silently change auth/RBAC/scoring/payments, write legacy or production data, or cut over MongoDB without a separate verified backup/reconciliation/restore plan.

Deliver actor → screen/action → HTTP → Go domain/application → PostgreSQL/other services trace and label every comparison VERIFIED, PARTIAL, UNKNOWN, or BLOCKED. A route-name match or green unit test is not functional/visual parity. Keep B2C and B2B, subject/path-scoped mastery, school membership vs teaching assignment vs assessment audience vs entitlement, and the unified assessment lifecycle. Validate desktop/tablet/mobile RTL with actual browser evidence; no visual certification without screenshots. Read `docs/migration/19_API_MOUNTS_AND_ASSESSMENT_OWNERSHIP_AR.md` for school assessment ownership work.

At the end of each safe slice: record exact source/target SHAs, tests, CI links, limitations and next action. Do not claim production readiness from isolated tests.

## Binding owner correction — whole-platform UI restoration (2026-10-28)

ALMEAA V2 = original ALMEAA UI/UX/workflows + new backend. Latest approved
`almeaacodax/main` is the binding visual, interaction and functional contract
for EVERY role and page. No silent redesign, new grouping, moved actions,
omitted tabs, generic replacement tables or changed learning workflow.
Reuse source presentation components where possible; adapt APIs to them.
Never write the source repository or production data.

Execution order: comprehensive screen/action/state/role/relation inventory;
paired same-role/data/viewport screenshots; focused complete correction slices.
P0: public site → student → path/subject learning spaces → courses/player →
assessment/results/review → admin. P1: all remaining roles, school, commerce,
settings and operations. Priority is not permission to omit original functions.
Record PARTIAL/MISSING/BLOCKED/UNKNOWN until evidence proves each contract.
Route counts, a build, mocked E2E or green CI alone cannot establish parity.
Acceptance includes all controls, back navigation, retained scope, persistence
on reload, relationships, RBAC, real Go/PostgreSQL integration, responsive RTL
and loading/empty/error/dialog states. Target 100%; never claim it without
paired runtime evidence. Keep completed backend work; no wholesale rebuild.
