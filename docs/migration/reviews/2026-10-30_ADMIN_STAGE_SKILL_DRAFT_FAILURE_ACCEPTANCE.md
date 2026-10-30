# ADMIN-TAXONOMY-FAIL-02 — original stage/sub-skill create draft retention (2026-10-30)

## Immutable references / ownership
- Legacy source: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7` (read only).
- Go base: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Admin UI owner: **#160**, including `TaxonomyAdminPage.tsx`; this test PR does not edit it.
- Existing RED draft tests: **#199** covers path, subject and path-edit; the present tests cover the *missing stage and sub-skill* cases and 409 in addition to 503.
- Skills center stays independent from path/subject management. No header, student, school, scoring, payments or RBAC changes.

## Actor → action → HTTP → Go → PostgreSQL → consumer
1. Admin selects the original path and enters **new stage** code/name, or selects a subject and enters a **sub-skill** code/name/description/kind/parent main skill.
2. Submit through `POST /api/v1/taxonomy/admin/levels` or `POST /api/v1/taxonomy/admin/skills` with CSRF.
3. On 503 or 409: show the server failure, **do not clear the form**, do not mark success, do not mutate the existing tree, and do not issue an implicit retry.
4. On an explicit second click and 201: clear only the successful form, reload the bootstrap from the server, and display the newly persisted row. A browser reload must still display the stage/skill. For a sub-skill, preserve its original parent link and kind.
5. Actual persistence must be confirmed in a follow-up **real PostgreSQL** test: `levels` / `skills` insert and public/admin bootstrap, rollback on failed request, audit record only on success, admin auth/CSRF and unauthorized denial.
6. Compare Legacy↔Go paired screenshots at 390/820/1440 RTL with the same role/data and failure/success states. The tests in this PR use mocked HTTP and therefore do **not** prove PostgreSQL or visual parity.

## Code-root cause (source inspection, not browser verdict)
In current `TaxonomyAdminPage.tsx`, `run()` catches failures but returns no success/failure signal. `createLevel()` and `createSkill()` reset their draft state unconditionally after `await run(...)`. This can lose unsaved text and the sub-skill's parent/kind on HTTP 409/503. Same pattern exists in other create/edit actions; owner #160 must fix them together without changing the original UI.

## Tests
`apps/web/tests/e2e/admin-taxonomy-stage-skill-failed-save.spec.ts`:
- 3 widths × 2 failure statuses × 2 original create actions = **12 tests**.
- First request is mocked 409/503; second request is 201; reload re-reads the mutated mock bootstrap.
- Expected initially **RED** until owner #160 implements failure-safe drafts; do not loosen assertions, skip or falsely mark GREEN.
- This PR adds no production files; exact-HEAD CI and browser trace determine RED evidence. Go/DB/Frontend gates, even if green, are not evidence of this browser contract.

## Status
**PARTIAL / RED PENDING CI** at authoring. This is an independently owned acceptance-test slice, **not** an implemented fix of the UI or complete end-to-end parity. Handoff: owner #160 must return an explicit success result from `run()`, reset forms/close editors only after success, and re-run #199 plus this PR's tests before the integration owner can accept. Preserve the new test file as a single-writer asset; do not duplicate it.
