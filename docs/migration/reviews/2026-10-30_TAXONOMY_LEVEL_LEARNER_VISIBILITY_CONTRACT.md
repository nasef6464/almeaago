# Taxonomy admin → learner visibility: level status read contract (2026-10-30)

## Authority and scope

- Legacy reference (read-only): `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`.
- Go baseline: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Execution: Draft PR #202; independent of #160's `TaxonomyAdminPage.tsx`, `SkillsAdminPage.tsx`, lesson CRUD/link/unlink, #199's RED Playwright contract, and the header.
- Scope: one PostgreSQL-backed visibility inconsistency. No new UI controls, no scoring, payment, RBAC, migration, production data or Legacy writes.

## Exact mismatch

`internal/taxonomy/repository/postgres/repository.go` already hides a subject in `PublicBootstrap` when the subject's optional level is inactive/archived. But `ValidateMasteryGoalScope` and `ValidateStudyPlanScope` accepted the same hidden subject when the path and subject remained active.

**RED observed** in [Database CI 40965283585](https://github.com/nasef6464/almeaago/actions/runs/40965283585), PostgreSQL 18, after all migrations:

```
level=inactive learner goal=true study plan=true; public visibility=false
```

The test uses PostgreSQL temporary shadow tables copied from migrated public schemas, with a single session. No persistent data is inserted. It exercises the repository methods used by the learner goal/study-plan consumers and compares them with the public taxonomy read.

## Minimal fix and behavior contract

- An active subject with an active path and **no level** remains eligible.
- An active subject under an **active** level remains eligible.
- If the manager marks that level **inactive** or **archived**, public bootstrap hides the subject and both learner validators reject explicit selection.
- Reactivating the level restores both public visibility and learner eligibility.
- A mixed study-plan selection containing one hidden subject is rejected rather than partially accepted.
- Path-only goals and empty-subject study plans keep their existing semantics; cross-path subjects remain rejected.
- No change to the taxonomy write contract, skill tree ownership, scoring or authorization policy.

**Trace:** admin level status update (existing `PATCH /api/v1/taxonomy/admin/levels/{id}`) → taxonomy level status in PostgreSQL → public `GET /api/v1/taxonomy/bootstrap` visibility → taxonomy `ValidateMasteryGoalScope`/`ValidateStudyPlanScope` → learner goal/plan application services. The automated test verifies the PostgreSQL repository leg, not an authenticated end-to-end HTTP/browser flow.

## Verification and limits

- Test: `go test ./internal/taxonomy/repository/postgres -run '^TestTaxonomyLearnerScopeFollowsLevelVisibilityPostgres$' -count=1 -v` with `DATABASE_URL` and migrated PostgreSQL.
- Database CI now runs this contract whenever `internal/taxonomy/**` changes.
- Backend/Frontend/Database/Browser CI results must be read from the **final PR head**, not from an earlier branch or another PR.
- **VERIFIED** only after final database GREEN: active/inactive/archived/reactivated level consistency and the negative scopes tested above.
- **PARTIAL:** UI-level admin save → HTTP → learner page refresh, role-specific permissions, stale cache invalidation, and actual learner consumer screenshots.
- **NOT PROVEN:** original-vs-Go paired 390/820/1440 RTL screenshots with the same user/data/state; all admin dashboard and independent Skills Center parity.
- **BLOCKED from UI parity certification:** #160 owns the admin pages, #199 has 9 RED failed-save browser cases; do not alter their files or claim that this backend fix resolves those failures.

## Next owner handoff

1. #160 owner: preserve all draft fields and the edit dialog after 503, convert #199's nine tests to GREEN; keep independent Skills Center separate from paths.
2. Student owner: test that an inactive-level subject disappears from student path/subject selection and is rejected by goal/study-plan writes, then reappears on reactivation after refresh, with Go/PostgreSQL and auth.
3. Public/header owner: do not infer that these scope validators authorize a new UI link or change menu visibility; keep Legacy routing/order as authority.
4. Capture paired Legacy↔Go screenshots at 390/820/1440 RTL and verify keyboard, back, reload, empty, loading, 403, 503 and save retry for the complete admin→student journey.
