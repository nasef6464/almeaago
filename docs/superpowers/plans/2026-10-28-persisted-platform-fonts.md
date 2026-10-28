# Persisted platform fonts implementation plan

Subordinate slice of the single active `docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md`; not a competing master plan.

> **For agentic workers:** Use superpowers:executing-plans inline. Tests precede implementation.

**Goal:** Restore original font editor and persisted global font application.
**Architecture:** Source React presentation, content FontService, PostgreSQL singleton; current identity auth/CSRF.
**Tech Stack:** React/Vite, Go/chi/pgx, PostgreSQL18, Playwright.
**Spec:** ../specs/2026-10-28-persisted-platform-fonts-design.md

## Global constraints
Latest source read-only; no production, permissions, scoring or payment changes. No new workflow; final exact-head four gates. Preserve unrelated worktrees.

## Review focus
- Missing optional fields retained and four family defaults match source, concurrent disjoint updates not lost.
- Malformed/oversized data URLs and CSS name escaping; maximum two uploaded fonts fit body limit.
- Non-admin, missing session and missing CSRF cannot persist edits.
- Delayed bootstrap cannot overwrite a successful save; failed save never reports success.
- Reset is preview until saved; reload reads persisted state, public navigation retains fonts.

### Task 1: Go persisted contract
Files: internal/content/{domain/fonts.go,application/fonts.go,repository/postgres/fonts.go,transport/http/fonts.go}; migrations/000044_platform_font_settings.{up,down}.sql; tests alongside domain, HTTP and repository. Wire management.go and cmd/api/main.go.
Interfaces: FontSettings map[string]any; ParseFontPatch(map[string]any); FontService.Get(ctx), Patch(ctx,identity.User,map[string]any); repository GetFontSettings/PatchFontSettings.
- [x] Write domain cases (family defaults, omissions, clear, invalid enum/size/weight/color/font upload/null).
- [x] Run go test ./internal/content/...; expected RED missing contract.
- [x] Implement validation, singleton defaults, atomic SQL merge, admin/CSRF HTTP; max body 1500000 bytes and reject trailing JSON.
- [x] Run content tests; expected PASS. Real PostgreSQL tests roundtrip/defaults/atomic merge and failure persistence; CI step in database.yml.
- [x] Commit focused Go files and docs.

### Task 2: Restore presentation and prove end-to-end behavior
Files: apps/web/src/features/presentation/{types.ts,platformFonts.ts,api.ts,PlatformFontBootstrap.tsx,PlatformFontsManager.tsx,PlatformFontsPage.tsx}; app/App.tsx; content shell; tests/e2e/platform-fonts.spec.ts; scripts/parity/platform-fonts.test.mjs; original baselines.
Interfaces: api.getPlatformFontSettings(), updatePlatformFontSettings(settings,csrf); shared event platform-font-settings-updated.
- [x] Write runtime source contract and browser regression cases; run source contract to RED (component missing).
- [x] Reuse source editor and font utility with adapter, global bootstrap and role guard. Preserve original JSX. Escape CSS names and prevent late bootstrap overwrite.
- [x] Build and source contract tests PASS; browser 390/820/1440 preview/save/reload/reset/upload/errors/screenshots.
- [x] Add real identity session + Go HTTP + PostgreSQL browser journey to Database CI, using isolated test user and test-only server. No routed/mocked font responses in that journey.
- [x] Commit; independent review and resolve important findings with reproductions; final full suites and four CI gates exact SHA; record evidence/limits and PR.

## Execution ledger
- Task1: domain contract RED (missing ParseFontPatch) → GREEN; content suite and full local Go suite PASS. PostgreSQL/browser verification remains pending CI.
- Task2: source utility contract RED (missing component) → GREEN; normalization/options, complete editor SSR (loading/loaded), CSS escaping3/3PASS; buildPASS. Local ChromiumSIGTRAP blocks browser execution before tests; CI required.
- Final independent review: no important/critical code defects in c8834fd. UTF-16 discrepancy reproduced RED and fixed GREEN; CI presentation path filters repaired. Inherited FileReader closure race is recorded as a deferred minor in migration28; no unapproved presentation redesign.
- Owner report reconciled into the existing plan03, matrix26, CURRENT_STATE and AGENTS; no new competing master plan. Preserved open stale PR123/144 and unrelated worktrees without merging or deleting.

- Final runtime verification at c91bdda: all four gates PASS; real session/Go/PostgreSQL browser journey and paired pinned-source-component images PASS390/820/1440. Full old-application shell/role screenshots are still out of this bounded certificate. See migration28 and the live PR#152 for final documentation-inclusive SHA and merge result.
