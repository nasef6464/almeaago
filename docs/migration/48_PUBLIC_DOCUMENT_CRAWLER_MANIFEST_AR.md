# PUBLIC-DOCUMENT-SEO-01 — Source document / crawler / PWA parity

**Date:** 2026-10-29 (Riyadh)  
**Source:** `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`  
**Target baseline:** `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`  
**PR:** #185, draft, independent branch `fix/public-document-contract-parity-20261029-run3`

## Scope and evidence

Visitor route `/` → HTML head → source SEO/social metadata → PWA manifest → public hero image; crawler `/robots.txt` → original exclusions for private routes. Original evidence: Legacy `index.html`, `public/site.webmanifest`, `public/robots.txt`. Target before change had a minimal title/description and lacked the manifest and robots files. This batch does not modify any rendered card, header, footer, landing section, navigation, pricing, admin, student or school component.

- Reuse the existing Go/Vite public hero image and Google Tajawal loading.
- Restore source document title, description, locale, robots, Open Graph and Twitter metadata; retain target Vite entrypoint and font preconnect.
- Restore source PWA manifest including Arabic RTL, start URL and icon.
- Restore original crawler exclusions. A `robots.txt` directive is crawler guidance, **not** an authorization boundary; Go RBAC remains unchanged.
- E2E `apps/web/tests/e2e/public-document-metadata.spec.ts` checks manifest, image, crawler exclusions and head metadata at 390/820/1440.

## RED → GREEN and gates

Test-first commit `d7489cd68d5a96f2ae8395f3f267aa0e4a439623` added an E2E contract that cannot pass against the original Go main (manifest/robots and metadata absent). This is a source-level expected RED, not a claim of a completed failing CI run; check GitHub Actions for exact-head outcomes. Implementation commits follow on the same isolated branch.

Backend CI, Frontend CI, Database CI and Frontend E2E are **UNKNOWN** until the final SHA is inspected. A missing/skipped workflow is not a PASS.

## Limits / acceptance remaining

- **PARTIAL:** source-equivalent static document and public assets; browser CI is required before VERIFIED.
- **BLOCKED for production release:** legacy `sitemap.xml` advertises `https://almeaacodax.vercel.app/`; copying it into Go would point crawlers to the wrong host. A verified Go production public origin is required before adding a target sitemap or replacing the source-host absolute Open Graph image URLs.
- **NOT PROVEN:** paired full-page Legacy↔Go screenshots under same runtime/data/role, server-side Go/PostgreSQL integration for admin homepage settings, or full public-site parity. This slice does not touch dynamic settings; earlier homepage work remains the owner.
- **NEXT:** coordinate the target public origin and live admin→guest settings proof with the homepage owner; avoid overlap with #159 header, #166 landing, #173 static pages, #178 footer, #182 showcase and broad #158.
