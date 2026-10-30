# ALMEAA Go — STUDY-PLAN-SCOPE-01 (2026-10-29)

## Contract and exact source
- Legacy read-only: `nasef6464/almeaacodax@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`, `pages/Plan.tsx`. Its student plan remains a richer reference; this slice **does not certify complete visual or feature parity**.
- Go base: `nasef6464/almeaago@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Draft PR #164, branch `fix/study-plan-scope-retry-20261029`. Do not merge/deploy/cut over without a separate decision.
- Unrelated active drafts #159 (header), #160 (independent skills), #161 (review media), #162 (parents), #163 (course player), #158 (public header): no files shared.

## Verified source-level gap (before runtime)
`StudyPlanPage.tsx` previously retained `current` after switching active→archived. A failed list/detail GET set only `error`, leaving the previous plan visible under the newly selected status, including its tasks and progress. The empty-plan branch also reset the draft after a retry, and there was no explicit read retry control. This is a **code-derived defect**, not a claim about production reproduction.

## Scoped implementation
- Clear plan, hasPlans and stale read state on path/status changes and before each scoped GET.
- Reject detail responses whose path/status differ from the selected scope; ignore aborted responses.
- Expose an explicit retry for failed list/detail reads; distinguish errors from genuinely empty results.
- Preserve the user's draft when a retry returns no plan, and preserve it on failed create/update; reset it after successful archive/delete.
- Disable path/status switching during an in-flight mutation to prevent an old mutation response being displayed in another scope.
- Do not fetch study plans for non-students. Existing Go authorization remains authoritative.
- Existing HTTP `GET /api/v1/study-plans/?pathId=...&status=...` → Go learning application → PostgreSQL `study_plans` predicates `student_id + path_id + status` is reused unchanged; no new API, schema, RBAC, scoring or payment policy.

## Tests and evidence
- New Playwright test `apps/web/tests/e2e/study-plan-scope-retry.spec.ts`: active→archived failed GET→retry, old plan absent, status-correct detail, screenshots at 390/820/1440; failed POST retains draft→retry→reload.
- New isolated PostgreSQL integration test `internal/learning/repository/postgres/study_plan_scope_integration_test.go`: a TEMP copy of migrated `study_plans` with 4 combinations checks student/path/status isolation. Requires `DATABASE_URL`, otherwise SKIPPED. No production writes.
- Test-first commit `7b8067b30faa8074227b493a07bfeddc708c67f3` was submitted before implementation. Its CI was cancelled by newer commits, so **measured RED is NOT PROVEN**; do not claim a red test result.
- CI final head, outcomes and links are tracked in PR #164. Tests using mocked HTTP do not establish live Go+PostgreSQL end-to-end, nor paired Legacy/Go pixels.

## Remaining work and next executable action
- Run and review Backend, Database, Frontend and E2E on final SHA; fix any failures, retain failure history.
- Validate real student session → HTTP → Go → isolated PostgreSQL create/read/status/archive/reload, with real CSRF and a failed save.
- Paired Legacy/Go same-data/role/viewport screenshots and the larger Legacy Plan functions (sharing, export, smart skills, weekly goals) remain PARTIAL/UNKNOWN. Do not call the full plan page visually equivalent.
- Continue other platform parity only after respecting the single-writer boundaries of open PRs.
