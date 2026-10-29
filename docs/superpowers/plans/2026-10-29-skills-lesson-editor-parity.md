# Skills Lesson Editor Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Follow RED→GREEN and check exact-head CI.

**Goal:** Restore original create/edit lesson operations from independent subskill cards without duplicating canonical content logic.

**Architecture:** Render the existing `LessonEditorPanel` from `SkillsAdminPage`. Feed its path/subject and a required subskill ID, lock that context and preserve the existing Go write contract; refresh the linked lesson list on save.

**Tech Stack:** React 19, TypeScript, Vite, Go content API (unchanged), PostgreSQL (unchanged), node parity tests, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-29-skills-lesson-editor-parity-design.md`

## Global Constraints

- `almeaacodax@bf7281f` read-only is the visible behavior authority; independent Skills Center remains separate from Paths Center.
- Only target `almeaago` changes. Keep current Go authorization, CSRF, workflow and optimistic concurrency; no source or production writes.
- Do not claim whole-platform UI parity without matched real-browser screenshot evidence.

## Review Focus

1. Skill preselection must survive async taxonomy bootstrap; E2E create.
2. Cannot create/edit a lesson in another subject from a subskill; scope locked in editor and on server.
3. Save failure retains edited values for retry; E2E rejection.
4. Approved/archived lesson remains Go read-only; existing authorization unchanged.
5. Content Editor from its normal route retains optional skill selection; existing E2E suite.

### Task 1 — Canonical editor with required initial skill

**Files:** `apps/web/src/features/content/components/LessonEditorPanel.tsx` and focused tests.

**Interfaces:** Add optional `initialSkillIds?: string[]` and `requiredSkillIds?: string[]` props; existing consumers remain compatible.

- [ ] Add failing regression test for a create flow with preselected subskill and a normal unpinned editor.
- [ ] Run targeted test and observe missing-preselection failure (RED).
- [ ] Initialize skill IDs from props, wait for taxonomy before filtering, pin required checkbox and include required ID in submitted create/update payload. Do not wipe draft on fetch errors.
- [ ] Run targeted test and existing parity suite (GREEN).

### Task 2 — Original create/edit controls in subskill card

**Files:** `apps/web/src/features/taxonomy/pages/SkillsAdminPage.tsx`; `apps/web/tests/e2e/admin-skills-separation.spec.ts`; `scripts/parity/admin-skills-separation.test.mjs`.

**Interfaces:** Use `LessonEditorPanel` directly with target subskill, optional lesson ID, target scope and callback; no new routes or APIs.

- [ ] Add failing UI/behavior test for “إضافة درس جديد”/“تعديل الدرس” with the expanded subskill, including retry after failed save.
- [ ] Observe RED on current code.
- [ ] Render anchored editor for create/edit; preserve open subskill and refresh list on success. Match original controls and existing workflow lock.
- [ ] Run parity/build/E2E and verify final GitHub CI for exact PR SHA; keep PR draft. Record evidence and remaining visual/PG gap.
