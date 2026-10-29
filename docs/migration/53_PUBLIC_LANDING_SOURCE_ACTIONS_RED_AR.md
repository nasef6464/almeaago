# ALMEAA V2 — Public landing original actions: RED acceptance checkpoint

**Source (read only):** `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`, `pages/Landing.tsx`.
**Go baseline:** `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
**Scope:** visitor home, path cards, default hero CTAs, empty taxonomy. This is NOT a redesign and is NOT a production deployment.

## Source-proven differences

| Original contract | Go main difference | Owner and safe correction |
| --- | --- | --- |
| Default secondary hero CTA label `تصفح الدورات` and destination `/courses` | `PublicLandingPage.tsx` uses `تصفح مساحة التعلم` and `/learning` | #166 landing owner: restore source label and link. Coordinate missing `/courses` route with navigation owner; do not invent a new destination. |
| Tertiary CTA with nonempty label and empty link defaults to `/courses` | Go uses `/` | #166 landing owner: restore fallback without changing saved nonempty URLs. |
| Path card link from `getPathLink(pathId)` is `/category/:id` | Go `OrganicPathCard` links `/learning?pathId=:id` | #166 landing owner + #159 navigation owner: retain original URL and the current Go learner permission checks. |
| Empty `displayedHomepagePaths` renders an empty grid | Go invents three placeholder path cards with text `يتم تحميل التصنيف من المصدر الخادمي.` even after successful empty GET | #166 landing owner: remove invented cards; retain actual loading/error behavior from source rather than fake content. |
| Source filters `showInHome !== false`, inactive paths for guests, and malformed IDs/names | Go sorts and displays all returned `TaxonomyPath` records without these flags in the current core type | #159 taxonomy/header and #166 landing: agree a single API projection/contract before changing backend or UI. No invented client authority. |

Source file locations: `pages/Landing.tsx` defaultHomepageSettings, `getPathLink`, `homepagePaths`, `displayedHomepagePaths`, and hero CTA JSX. Go locations: `apps/web/src/features/public/pages/PublicLandingPage.tsx` `OrganicPathCard`, `visiblePaths`, hero CTA JSX and `#paths` fallback.

## RED tests / boundaries

New `apps/web/tests/e2e/public-landing-source-actions-red.spec.ts`: 3 source-contract scenarios at **390, 820, 1440px RTL** (9 test cases): saved tertiary blank URL, source default secondary label/URL, category card route/click, no fabricated cards on empty successful taxonomy. Network fixtures mock only auth/taxonomy/homepage/course reads; **not** Go/PostgreSQL integration. These tests intentionally fail on current Go and must turn GREEN through the owning PR. Their presence is not a parity certificate.

**Acceptance to be provided by owners:** route navigation and back/reload, role-based hidden paths and featured order, empty/loading/403/503 behavior, saved settings from admin PATCH → real Go/PostgreSQL → guest GET/reload, plus paired source/Go screenshots with same role/data at 390/820/1440. No silent change to RBAC/scoring/payments. Keep #159 header ownership and #166 landing ownership. This branch writes no files owned by those PRs.

**State:** VERIFIED source-vs-code differences; PARTIAL browser reproduction pending CI; BLOCKED complete functional parity until #166/#159 and /courses route owner resolve their files. Do not merge this RED-only branch as completed product functionality. No Legacy/production writes, merge, publish, or cutover.
