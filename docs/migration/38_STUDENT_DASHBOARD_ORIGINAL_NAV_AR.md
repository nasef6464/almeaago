# STUDENT-DASHBOARD-NAV-LEGACY-01 — 2026-10-29

## Baseline
- Legacy (read only): `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`, `pages/Dashboard.tsx`: `studentMenuItems`, five menu groups, `StudentOverview`, explicit logout.
- Go base: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Independent implementation branch: `fix/student-dashboard-original-navigation-20261029`, draft PR #171.
- Conflicting in-flight PRs: #158 changes shared navigation and parity spec; #159/#160 change same shared E2E spec; #161 review media, #163 course progress, #168 foundation workspace, #164 plans. No edits to their files.

## Code-confirmed difference and correction
- Go's student dashboard displayed invented menu groups `التعلم` and `الدعم والمتابعة`, extra `الإشعارات` and `الفصل الذكي` sidebar destinations, grouped `مساراتي ودوراتي`, and two invented overview card grids. Legacy uses an unlabeled learning strip followed by `رحلتي التعليمية`, `الاختبارات`, `الأدوات`, `الدعم`; distinct original labels and ordering.
- Restored source labels, order, group styling and explicit logout through existing `useAuth.signOut` → `POST /api/v1/auth/logout` with CSRF, failure retention and retry. Removed invented dashboard cards and technical-facing copy. Preserved original fallback `خطوتك اليوم` and `ابدأ القياس`.
- For source destinations not yet ported, the original label is present but non-clickable (`aria-disabled`) rather than lying about a different destination. This is a **PARTIAL functional migration**, not an accepted completion of those controls.

## Evidence and limitations
- New Playwright `apps/web/tests/e2e/student-dashboard-original-menu.spec.ts` asserts exact menu rows and order at 390/820/1440, no invented links/cards, and CSRF logout 503→204 retry.
- Tests mock auth HTTP; they do not prove real Go/PostgreSQL session behavior. No paired Legacy/Go browser screenshots with matching real data, so visual parity remains PARTIAL.
- The existing `apps/web/tests/e2e/public-user-workspaces-parity.spec.ts` contains stale assertions for the invented headings and links; this file is owned by multiple open PRs. Coordination comments were posted on #159 and #160. Do not silently change it from this branch.
- Backend and Database code unchanged. Do not attribute their prior green runs to this branch. Record exact-head Frontend CI and E2E results before marking tests verified.

## Acceptance still open
1. Restore source's dynamic `pendingAssignedQuiz` and skill-based daily action from real scoped data, not a static or guessed recommendation.
2. Port and wire actual `جلساتي`, `المسار الذكي`, `الاختبارات المحاكية`, `بطاقات التذكر`, `سؤال وجواب`, `طلباتي` without unrelated route fallbacks.
3. Restore original student overview's genuine tools, assigned tests and progress cards without fabricated counters.
4. Run real student session → UI → Go → PostgreSQL for each control and logout, including 401/403/CSRF failures and reload.
5. Capture paired source/target screenshots at 390/820/1440 with same role, data, scope and state; reconcile stale shared E2E assertions with its single owner.
6. No merge, production writes, deployment, scoring/RBAC changes or cutover without explicit approval.

Status: **PARTIAL** pending full E2E/visual/data acceptance.