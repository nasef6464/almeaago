# ADMIN-TAXONOMY-FAIL-02 — stage create: pointer hit-testing and failed-save draft (2026-10-30)

## Immutable references and single-writer ownership
- Legacy read-only: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`.
- Go base: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- UI owner **#160**: `TaxonomyAdminPage.tsx`; this PR never edits it.
- #199 already covers failed-save path/subject/path-edit. **#160 already covers Skills Center sub-skill failed save and keeps that editor independent**; do not duplicate those tests. This PR tests only the **missing stage-create flow**.
- No header, school, student, scoring, payments, RBAC, schema or production changes.

## Two independent failures evidenced in CI on initial HEAD
The initial browser run `41013392524` on `175002e10633e160212b599a8bc0bff10689157f` produced 12 failures, 136 passes, 3 skips. Log analysis:
1. Stage-create button's **real pointer click** is intercepted by the adjacent material-code input. Playwright logs repeatedly show `<input aria-label="كود المادة الجديدة"> ... intercepts pointer events`. This is a layout/hit-testing defect, not a server failure; check `lg:grid-cols-2` and `sm:grid-cols-[1fr_1fr_auto]` and min-width/overflow of both cards. Do not use `force: true` as a parity fix.
2. Sub-skill code was reset after HTTP 409/503 in **main's old combined taxonomy page**. This behavior is already addressed by #160's independent `SkillsAdminPage.tsx::saveSkill()` and its existing test. The obsolete skill tests were removed from this PR to avoid testing a component that #160 replaces.

## Actor → action → HTTP → Go → PostgreSQL → consumer
Admin selects a path, fills stage code/name, and clicks `إنشاء المرحلة`:
- Real pointer must hit the stage-create button at 390, 820 and 1440 RTL, without adjacent inputs intercepting it.
- `POST /api/v1/taxonomy/admin/levels` with CSRF returns 409 or 503: error visible; both code/name preserved; no success notice; no auto retry; existing tree unchanged.
- Explicit second click and HTTP 201: draft clears, server bootstrap reflects the new stage, and browser reload still shows it.
- Follow-up real PostgreSQL evidence required: `levels` insert, rollback on failure, audit only on success, admin vs non-admin auth/CSRF and learner visibility. Mocked HTTP does not prove storage.
- Paired Legacy↔Go screenshots at 390/820/1440 with same actor/data/states remain required.

## Independent RED tests
`apps/web/tests/e2e/admin-taxonomy-stage-failed-save.spec.ts`:
- 3 widths × 2 HTTP failures × 2 test modes = **12 cases**.
- Mode A: genuine Playwright pointer click; catches overlapping layout and then tests draft/retry.
- Mode B: `dispatchEvent('click')` isolates draft-retention logic despite overlapping layout. **Mode B is never UI-clickability evidence.**
- No production files are changed. Expected RED until #160 owner fixes the layout and failure-safe stage draft. No weakening assertions/skips.
- Frontend, Backend and Database green on an unrelated test-only head do not certify UI parity.

## Required owner fix
Inside **#160** only, make `run()` return explicit success, clear stage draft only after 2xx, preserve inputs on 409/503, and fix the overlapping responsive grid so the real button is reachable. Rerun #199 and this PR's 12 cases on the same combined code. Maintain Skills Center separate from paths. A stacked/merged acceptance decision requires exact-head CI and real PostgreSQL + paired visual proof; no merge/deploy in this checkpoint.

**Status:** PARTIAL / RED acceptance; implementation blocked by file ownership, not by lack of a known root cause.
