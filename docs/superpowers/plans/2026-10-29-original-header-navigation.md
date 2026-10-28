# Original header and navigation implementation plan

> **For agentic workers:** use superpowers:executing-plans for integration, TDD for each change, and a final independent whole-branch review. Supporting plan under migration03 and OWNER_BATCH_DELIVERY_CONTRACT_AR; no competing roadmap.

**Goal:** restore original header controls and navigation using authoritative Go services, including persisted display settings, original hierarchy/routes and role journeys.
**Architecture:** preserve Go domain ownership. Reuse pinned source Header/ThemeToggle/NotificationBell/SearchModal presentation; adapt transport/auth/catalog data rather than replace their UI. Taxonomy owns path/subject presentation; content owns homepage navigation preferences; commerce/learning/identity/notifications retain business authority.
**Stack:** React/Vite, Go, PostgreSQL, Playwright.
**Spec:** migration03,26 and owner contract; source components/Header.tsx blob c4e45e5d9bd485538036e98f70eac42471a8fa71. Target base main98b0f6d9ad0bba031936d950d087c0bd3d19b7bb, tree1414dc6010850412bfca55035fb306e626a8aadb.

## Constraints and review focus

- Keep source and production read-only; no scoring/entitlement/RBAC decisions in UI adapters.
- Test false/empty/omitted path presentation values, atomic audit failure, inactive/archived parents and subject/level scope.
- Preserve original category query/history, including same-path subject/level changes; do not create a link that silently discards context.
- Test guest/admin/student role changes, logout, drafts after failed save and stale GET after a saved event.
- Notification read actions must retain CSRF and restore state on failure; header count cannot be fabricated.
- Prove full-header images and open/closed menus with controlled data at390/820/1440. Section-only evidence must remain labelled as such.

## Tasks and interfaces

- [ ] Taxonomy: tests RED→GREEN for persisted path/subject display fields, existing JSONB projection and admin inputs; preserve current permission checks. Public bootstrap includes real levels/presentation fields; no made-up data. Ownership: internal/taxonomy plus taxonomy admin frontend only.
- [ ] Header dependencies: source ThemeToggle and NotificationBell with Go notification transport/SSE/auth/CSRF and failure handling. Ownership: new public/header dependency files only; no App or main Header edits.
- [ ] Header integration: failing source navigation/role/render tests, then source Header reuse with explicit auth/catalog/settings adapters. No arbitrary path/subject truncation. Root owns LegacySiteHeader, public/header integration files, homepage editor navigation controls and App.
- [ ] Destination integration: original routes and level/subject/history consumers; trace missing public/cart/search destinations through existing domain owners before implementation. A rendered menu item alone is not an accepted journey.
- [ ] Real integration: manager changes→Go/PostgreSQL→guest/student header, original links→destination→Back/Forward/reload, role denials, transient failures and paired source/header screenshots. Extend Database CI with exact tests, retain existing font/homepage proofs.
- [ ] Whole-branch review, Go/build/parity/E2E/DB verification, four exact-head CI gates, inspect images, record gaps/reuse/changes/evidence/remainder, merge only when accepted. Do not declare full header complete while any dependent action remains unproved.

Parallel work is limited to the two independent owned file groups above. Integration remains a single writer. Reconcile all deltas and test together before publication.
