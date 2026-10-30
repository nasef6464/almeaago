# ALMEAA Go — Public MainLayout footer route parity checkpoint

**Date:** 2026-10-29. **Owner:** public-site team. **Status:** IMPLEMENTED / CI AND PAIRED VISUAL PENDING.

## Exact source and target
- Read-only source `nasef6464/almeaacodax/main`: `bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`.
- Target `nasef6464/almeaago/main` at branch start: `98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Source `app/AppRouteTree.tsx` lines 125–172 wraps `/verify-email`, `/checkout`, `/category/:pathId`, and `/course/:courseId` in `<Layout>`; `components/Layout.tsx` re-exports `MainLayout`; `components/MainLayout.tsx` always renders the five-link footer.
- Target `apps/web/src/app/App.tsx` mounts the same four route families but renders `LegacySiteFooter` only if `showPublicFooter(location.pathname)`; the predicate on main omitted all four.
- `#159` owns header navigation; `#166` owns public homepage courses; `#173` owns static info page content. This slice edits none of their files. `#158` edits shared E2E footer tests; this slice uses a separate new E2E spec.

## Functional slice and exact changes
Actor: guest. Flow: directly enter public verification, checkout, path, or course route → shared footer links visible → open About → back → reload; RTL at 390/820/1440.
- Keep the original footer markup and its five links untouched.
- Extend the route predicate to these **source-proven** routes only, including trailing slashes.
- Continue excluding school/classroom/admin/attempt shells and unsupported nested routes. Do not blanket-enable footer for all Go routes.
- No HTTP/Go/PostgreSQL writes: the source footer is static markup; checkout's payment and entitlement logic is untouched. This does **not** establish end-to-end course, checkout, or email verification parity.

## Tests and evidence
- RED-first contract commit `40d16a6dee1ef8d7537e6fba80dc729d371dda4e` adds route assertions to `scripts/parity/public-footer.test.mjs`; these assertions fail against the previous predicate. Actual CI RED conclusion must be checked separately (run may be cancelled by later pushes).
- GREEN code commit follows; `apps/web/tests/e2e/public-layout-footer-routes.spec.ts` checks footer presence, all five links, navigation, reload and back on four routes at 390/820/1440; snapshots of **Go only**.
- Required exact-head gates: Backend, Frontend, Database, Frontend E2E. Their outcomes are read from GitHub on the final SHA, not inferred from local test design.
- Paired Legacy↔Go screenshots with identical role/data/browser/font are **NOT PROVEN**. Do not claim whole public site parity.

## Remaining
1. Confirm four CI conclusions on final SHA; inspect and fix failing assertions rather than weakening them.
2. Capture paired source/target screenshots at three viewports; inspect full page and footer.
3. Coordinate source-backed dynamic homepage settings and public consumer with presentation owner, without writing admin/learner/school files.
4. Keep Draft PR unmerged, with no production/Legacy writes or cutover.
