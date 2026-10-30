# PUBLIC-DOCUMENT-SEO-01 — Source document / crawler / PWA parity

**Date:** 2026-10-29 (Riyadh)  
**Source:** `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`  
**Target baseline:** `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`  
**PR:** #185, draft, independent branch `fix/public-document-contract-parity-20261029-run3`

## Scope and evidence

Visitor route `/` → HTML head → source SEO/social metadata → PWA manifest → public hero image; crawler `/robots.txt` → original exclusions for private routes. Original evidence: Legacy `index.html`, `public/site.webmanifest`, `public/robots.txt`. Target before change had a minimal title/description and lacked the manifest and robots files. This batch does not modify any rendered card, header, footer, landing section, navigation, pricing, admin, student or school component.

- Reuse the existing Go/Vite public hero image and Google Tajawal loading.
- Restore source description, locale, robots, Open Graph and Twitter metadata; retain target Vite entrypoint, font preconnect and existing Arabic browser title. The original Legacy HTML title is not yet matched: the existing shared public workspace test requires `/منصة المئة/`, and this branch must not edit the header team's shared test.
- Restore source PWA manifest including Arabic RTL, start URL and icon.
- Restore original crawler exclusions. A `robots.txt` directive is crawler guidance, **not** an authorization boundary; Go RBAC remains unchanged.
- E2E `apps/web/tests/e2e/public-document-metadata.spec.ts` checks manifest, image, crawler exclusions and head metadata at 390/820/1440.

## RED → GREEN and gates

Test-first commit `d7489cd68d5a96f2ae8395f3f267aa0e4a439623` added an E2E contract that cannot pass against original Go main (manifest/robots and metadata absent). Six source-level assertions were run against Go main and the branch: **0/6 → 6/6**. On implementation SHA `e4a872d`, browser E2E completed **136 PASS / 3 SKIP / 1 FAIL**: the existing shared `public-user-workspaces-parity.spec.ts` expected the Arabic page title, which the initial exact Legacy title broke. We restored the pre-existing Arabic browser title and retained original Open Graph title; no shared-test edits. Final-head CI must be rechecked.

Backend CI, Frontend CI, Database CI and Frontend E2E are **UNKNOWN** until the final SHA is inspected. A missing/skipped workflow is not a PASS.

## Limits / acceptance remaining

- **PARTIAL:** source-equivalent social metadata and public assets; the HTML browser title remains Arabic (`منصة المئة | قدرات وتحصيلي`) rather than Legacy `ALMEAA CODAX | Qudrat & Tahsili` pending shared identity contract. Browser CI is required before VERIFIED.
- **BLOCKED for production release:** legacy `sitemap.xml` advertises `https://almeaacodax.vercel.app/`; copying it into Go would point crawlers to the wrong host. A verified Go production public origin is required before adding a target sitemap or replacing the source-host absolute Open Graph image URLs.
- **NOT PROVEN:** paired full-page Legacy↔Go screenshots under same runtime/data/role, server-side Go/PostgreSQL integration for admin homepage settings, or full public-site parity. This slice does not touch dynamic settings; earlier homepage work remains the owner.
- **NEXT:** coordinate browser title identity decision with #159 owner, the target public origin and live admin→guest settings proof with the homepage owner; avoid overlap with #159 header, #166 landing, #173 static pages, #178 footer, #182 showcase and broad #158.
