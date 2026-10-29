# PUBLIC-SHOWCASE-SOURCE-ROUTE-PARITY-03 — 2026-10-29

## Authority and scope
- Read-only source `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`, `pages/Landing.tsx` `PLATFORM_DAYLIGHT_IMAGES` and `PLATFORM_SHOWCASE_IMAGES`.
- Target base `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Draft PR #182; independent owner files: `apps/web/src/features/public/legacy-public-data.ts`, `apps/web/tests/e2e/public-showcase-source-routes.spec.ts`, this checkpoint. No changes to header #159, public homepage course rendering #166, footer #178, admin/student/schools, API, PostgreSQL or scoring/payments/RBAC.

## Proven source-code difference and correction
Original showcase CTA targets were replaced with the generic `/learning` destination for five cards, even though the exact original targets already have routes in Go main:
1. `daylight-tablet`: `/learning` → `/dashboard`.
2. `daylight-qudrat`: `/learning` → `/category/p_qudrat`.
3. `daylight-tahsili`: `/learning` → `/category/p_tahsili`.
4. `qudrat`: `/learning` → `/category/p_qudrat`.
5. `tahsili`: `/learning` → `/category/p_tahsili`.

The actual `App.tsx` main route declarations include `/dashboard` and `/category/:pathId`. This is presentation-route parity only, not a claim that those pages or entitlements are fully migrated. No additional buttons/cards/sections were introduced.

## RED / GREEN and verification
- RED: read the target base file via GitHub and compared all five `id → link` pairs against the current Legacy source. **5 mismatches** on base; test-first E2E commit `02ee0454350017749209b4f258f5c62b29cd39fc`.
- GREEN: read the corrected branch file via GitHub and reran the same five-pair comparison. **5/5 pass** on commit `2139b692f9cd63b8be8e36db8b13484a9a0cf303`.
- Added Playwright coverage for 390/820/1440 RTL: both showcase tabs, exact CTA href, click → route, guest denied learning content, reload, browser back, no horizontal overflow, Go-only screenshots. Browser CI and exact-final-SHA results must be checked after the documentation commit; do not report them as passed before conclusion.
- No live admin → Go → PostgreSQL → visitor journey was executed for this slice; homepage-settings persistence is a separate existing flow, and this change does not touch it.

## Unresolved parity / owner handoff
- Original source links `/mock-exams`, `/pricing` and `/admin-dashboard?tab=schools` are not all independently proven reachable and equivalent on Go main. In particular `App.tsx` main does not declare `/mock-exams` or `/pricing`. PR #158 proposes broad public routes but overlaps #159 and remains unsafe to merge wholesale. Do not silently replace these with unrelated routes or add placeholders; route owner should provide original route contracts and end-to-end evidence first.
- Original featured courses vs invented previews is owned by PR #166; do not duplicate its `PublicLandingPage.tsx` edits.
- Full same-role/data Legacy↔Go screenshot pairs and real API/DB behavior remain **PARTIAL / NOT PROVEN**.
- Next: resolve the three unported showcase destinations with the public route owner, then pair original and Go screenshots for both showcase modes at all three widths and test admin-saved homepage content as guest against isolated PostgreSQL.

## Verdict
- **VERIFIED**: source-level five-route mismatch, correction and isolated five-pair regression check.
- **PARTIAL**: browser integration and responsive visual evidence pending exact-head CI; real persisted settings/visitor flow outside this slice.
- **BLOCKED**: unported original destination routes; no approved public route implementation in this independent branch.
- No merge, deployment, cutover, production/Legacy write, or RBAC/scoring/payment modification.
