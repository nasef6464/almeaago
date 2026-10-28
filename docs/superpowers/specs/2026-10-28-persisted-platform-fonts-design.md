# Persisted platform fonts restoration

Owner-approved contract: latest Legacy UI is the design; restore it without redesign. Source bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7; target base 671fbadfb3cbeec8110ac16d7e49796bb768705c.

Reuse PlatformFontsManager, PlatformFontBootstrap and platformFonts.ts from Legacy. Adapt only auth/client imports to existing Go session/CSRF. Restore admin section `platform-fonts` and its original label/icon after homepage settings in the existing shell; the homepage entry is still missing and is not invented here. Preserve controls, defaults, preview/reset/save/upload and error/loading copy. Public bootstrap applies persisted configuration on every route. This does not certify parity of the surrounding admin shell.

Store a singleton JSONB document owned by content in PostgreSQL, using atomic top-level PATCH merge. Public GET /api/v1/content/platform-font-settings; admin-only PATCH with existing authentication and CSRF. Match Legacy family defaults (omitted family resets to tajawal), omitted optional fields retained, empty strings clear overrides, nested upload defaults and source validation bounds. Strip unknown metadata as source Zod does. No auth/scoring/payment changes. Custom font names must be escaped in generated CSS; data URLs are restricted to the original font MIME/base64 contract.

Alternatives: static-only variables cannot persist edits; copying Mongo dependencies violates the target architecture. Reusing source presentation over a focused Go service and JSONB singleton is the chosen engineering approach under the owner's delegated backend scope.

Acceptance: failing tests before implementation; real Go/PostgreSQL HTTP roundtrip and rejected mutations; browser preview/save/reload/navigation/reset/upload/errors at 390/820/1440; actual session-backed frontend→Go→PostgreSQL test on isolated CI database. Source JSX/utility provenance retained. No 100% visual claim without paired same-state runtime screenshots. Homepage settings/navigation/brand remain MISSING; whole platform PARTIAL.
