# Student assessment placement scope/retry — implementation checkpoint (2026-10-29)

**Owner:** student/learning. **PR:** #176 (Draft). **Source authority:** `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7` (read only). **Go baseline:** `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.

## Acceptance slice and scope

Student → `/assessments` → choose path/subject/slot/course → GET available placements → start authorized placement → attempt route → return and start another permitted attempt. Preserve existing controls and visual layout; do not invent new controls. This slice addresses three frontend state integrity defects without changing Go assessment/scoring, entitlement, RBAC, migrations, payment or shared headers.

1. **Scope failure:** a failed request after switching path/subject must not display the previous scope's rows or misleading empty-success text. Clear old rows and pagination before fetching, reject aborted responses, distinguish failed read from a legitimate empty page.
2. **Dependent context:** changing path/subject/slot clears stale course/topic IDs immediately, and resets pagination. Aborted learning-space responses must not repopulate a previous course selector. Reject invalid slot query values.
3. **Start idempotency:** keep the same `startKey` across ambiguous network failure/retry, but remove it only after the server confirms a successful attempt start, so a later permitted attempt gets a fresh key. Guard concurrent start clicks. Server remains authoritative for access and attempts.

The existing endpoint is `GET /api/v1/assessment-placements/available` and the start command is `POST /api/v1/assessment-placements/:placementId/start` with CSRF. Existing Go/PostgreSQL implementation is reused without edits. The browser tests use mocked HTTP, **not** a real Go/PostgreSQL journey.

## Test evidence and limitations

- Test-first commit `8ae8106` added three Playwright cases. Later test update `28f3d2a` covers failed-start retry and 390/820/1440 error-state screenshots.
- Frontend implementation commit `ec2e986` changes only `AssessmentAvailabilityPage.tsx`; test file is dedicated and unowned by other active PRs.
- CI: exact-head Backend, Frontend, Database and Browser outcomes must be read from PR #176 **after** the final commit. No test is labelled PASS before completion.
- RED proof: test-first E2E run was started, but may be cancelled by later branch commits. If cancelled or blocked during dependency installation, record **NOT PROVEN**, not RED.
- Screenshots: target Go screenshots from Playwright are not paired with an authenticated Legacy runtime on the same fixtures; **visual parity remains NOT PROVEN**.
- Real database authorization/entitlement, attempted restart/resume and historical maxAttempts require a separate isolated HTTP→Go→PostgreSQL test; current frontend fix does not certify those server contracts.
- PR #161 review media, #163 course progress, #168 foundation learning space, #171 student dashboard and #158 shared navigation/test files are not edited.

## Acceptance matrix

| Evidence | Status until exact-head CI |
| --- | --- |
| Old inventory hidden on failed new-scope read | IMPLEMENTED / TEST PENDING |
| Course/topic context reset and stale response ignored | IMPLEMENTED / TEST PENDING |
| Failed start retries same key; confirmed start rotates | IMPLEMENTED / TEST PENDING |
| Browser RTL 390/820/1440 screenshots | TEST PENDING; no Legacy pair |
| Go/PostgreSQL isolated student placement integration | PARTIAL (unchanged server, not executed here) |
| Whole Legacy ↔ Go student journey parity | NOT PROVEN |

**Next:** inspect exact-head CI and test logs, fix failures without weakening assertions, obtain paired Legacy/Go screenshots, and test two consecutive allowed starts against isolated Go/PostgreSQL with actual entitlement/attempt records. No merge, deploy or cutover in this slice.
