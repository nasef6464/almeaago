# Whole-platform original UI restoration implementation plan

> **For agentic workers:** Use superpowers:executing-plans for inline execution. Owner has authorized implementation without further design approval; Legacy is the approved design.

**Goal:** Restore every original role, screen, workflow and interaction over the existing Go backend.
**Architecture:** Reuse source presentation and preserve target services; add compatibility adapters only where a proven contract requires them.
**Tech Stack:** React/Vite, Go, PostgreSQL, existing Playwright and GitHub CI.
**Spec:** ../../migration/26_WHOLE_PLATFORM_UI_RESTORATION_AR.md and binding owner correction in AGENTS.md.

## Global constraints
Source and production read-only. No redesign, RBAC/scoring/payments changes, dropped functions or wholesale rebuild. Exact-head CI before merge. 100% is the target, not a current certification.

## Review focus
- Seven or more visible paths must not disappear.
- Hidden content must remain inaccessible; display fixes do not expand access.
- Context survives back/reload and subject switches, including slow responses.
- Same role/data/viewport required for screenshot comparisons.
- Mock presentation tests never establish Go/PostgreSQL persistence.

## Task 1: Bind scope and discover actual UI
Files: AGENTS.md; docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md; scripts/parity/screen-inventory{,.test}.mjs; migration baseline/report.
- [x] Inspect current source/target main and source delivery skills.
- [x] Extract source locations, routes, navigation, controls, handlers, import and API candidates. Mark unresolved roles, dynamic values and runtime behavior UNKNOWN.
- [x] Test scanner and run existing parity suite.
- [ ] Resolve every route/menu/component to role/action/state/API/Go/table; raw discovery is not a completed screen inventory.

## Task 2: First bounded public-site correction
Files: apps/web/src/features/public/pages/PublicLandingPage.tsx; apps/web/tests/e2e/public-user-workspaces-parity.spec.ts.
- [x] Confirm source maps displayedHomepagePaths without six-item truncation.
- [x] Add browser test returning eight paths at 390/820/1440; assert final path, count and no overflow.
- [ ] Observe assertion failure in CI (local Chromium exits SIGTRAP before assertions).
- [ ] Remove only paths.slice(0,6); preserve server scope and ordering.
- [ ] Run typecheck/build, focused tests and exact-head CI; review screenshot artifacts.
- [ ] Record limits: this corrects truncation only; homepage settings, source style and whole-page parity remain PARTIAL.

## Task 3: Complete remaining P0/P1 by proven dependency
- [ ] Public settings and shared layout/auth contracts; compare live source and Go screenshots/states.
- [ ] Student then path/material spaces, course/player, assessment/review/results, admin; retain original workspace grouping.
- [ ] All remaining school/teacher/supervisor/parent/finance/settings/operations interfaces.
Each slice needs a domain-specific plan with exact controls and persistence tests derived from source before editing. All source functions remain in scope; no empty declaration of completion.
