# PUBLIC-HERO-GALLERY-LEGACY-PARITY — 2026-10-30

## Fixed reference and scope

- Read-only source: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`, `pages/Landing.tsx` lines 586–609.
- Target baseline: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- Owner: public visitor hero presentation helper, `apps/web/src/features/presentation/homepageHero.ts`. No header, footer, homepage page JSX, admin, learner, school, auth, scoring, payment, database schema or production data changed.
- Original gallery rule: use the saved `galleryImages` only if it is an array with at least one entry; within that array only nonempty string entries are rendered, excluding the primary image. An empty or non-array gallery falls back to the existing platform presets in order. An array with invalid entries alone does **not** invoke preset fallback.
- Go baseline incorrectly invoked `.forEach` on truthy non-array values and `.trim()` on non-string elements, causing a React rendering exception instead of the original hero.

## User journey and acceptance

Guest opens `/` → GET `/api/v1/content/homepage-settings` → presentation hook → heroGallery → gallery controls → next image → reload → `/about` → browser back. Saved homepage settings originate from the existing content Go/PostgreSQL contract, but the nine browser cases in this slice deliberately mock HTTP to exercise historical malformed payloads. **They are not evidence of real PostgreSQL persistence.**

Nine Chromium acceptance cases cover malformed non-array values, mixed arrays and valid explicit arrays at 390/820/1440 RTL. Assert hero survives, correct fallback/explicit count, next image, no horizontal overflow, reload and browser back. Save Go-only screenshots in test artifacts. Do not claim paired Legacy↔Go screenshots from these captures.

## Evidence gates

- RED-only source checkpoint: `dc1ced537d74e2a855eb0b6fd4181bc86a25ca4c`, PR #228 (evidence only, never merge).
- GREEN implementation in PR #227; final SHA and CI runs to be recorded after checks finish.
- Required: Backend CI, Frontend CI, Database CI, Frontend E2E at the exact final SHA. Backend/Database gates cover regression health, **not** a live gallery persistence journey.
- Remaining P0: original `/courses` route (#209 RED), landing path cards and CTAs (#201/#166), header hierarchy (#159), footer (#178), and actual paired source/Go screenshots. Full public parity remains PARTIAL.

## Ownership

This branch is the sole writer of `homepageHero.ts` and its new test. It does not modify #159/#160/#161/#162/#163 or the owned homepage page JSX in #166. No merge, deployment, production/Legacy writes or RBAC/scoring/payments change.
