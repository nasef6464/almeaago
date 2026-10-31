# Student dashboard click-through — current-main reconciliation (2026-10-30)

## Scope and authority
- Legacy read-only: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`.
- Go integration base inspected: `82f4bd53b0c2292d508d4ac4706725d3588bad10`.
- PR #123 is **test coverage only**, not a learner UI or backend feature. This update deliberately discards the PR's stale 2026-10-02 status-document additions and preserves all current main implementation/tests.

## User journey under test
A signed-in student opens the mobile dashboard navigation and clicks each existing destination: assessments, saved questions, study plans, assessment results, reports and notifications. The test verifies route, heading, no placeholder, and no horizontal overflow at 390px. It returns to dashboard between destinations. Existing Go routes and clients are reused without changing scoring, authorization or persistence.

## Evidence and limitations
- Browser E2E file: `apps/web/tests/e2e/content-learning-space.spec.ts`, added click-through case only. HTTP responses are mocked, so this is **PARTIAL** browser-navigation evidence, not a Go/PostgreSQL persistence certificate.
- The current dashboard/route headings were inspected in the Go source before restoring the test. Legacy↔Go paired screenshots for 390/820/1440 with identical data and role are **NOT PROVEN**.
- Backend CI, Frontend CI, Database CI and Frontend E2E must all be green on the final PR HEAD before Ready/merge; re-check current main afterward. No production deployment or Legacy writes.

## Next acceptance step
Exercise the same navigation with authenticated Go/PostgreSQL data, reload/back and failure states, and capture paired Legacy/Go screenshots before marking full parity VERIFIED. The test-only PR must never be represented as whole student-journey closure.
