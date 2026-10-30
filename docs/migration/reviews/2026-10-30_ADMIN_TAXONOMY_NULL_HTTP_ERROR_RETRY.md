# Admin taxonomy HTTP failure / retry — isolated parity repair

**Date:** 2026-10-30. **Legacy main (read-only):** `bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`. **Go main at branch creation:** `98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.

## Ownership and exact contract

- **PR #160** owns `TaxonomyAdminPage.tsx`, the independent `SkillsAdminPage.tsx`, lesson create/edit/link/unlink, and their visual parity. This PR does **not** change those files.
- **PR #199** owns the still-RED failed-create/edit draft-retention contract; **PR #206** owns the missing original Skills Center controls. Neither is claimed complete.
- This independent slice owns only `apps/web/src/features/taxonomy/api/taxonomy-admin-client.ts` and a new Playwright contract file.
- A server `503` with JSON `null` previously led to `body.message` on null and surfaced an English JavaScript TypeError. The fix preserves the **existing** Arabic fallback `تعذر تنفيذ طلب التصنيف`, while keeping valid server-provided messages. It adds no UI, endpoint, state machine, or authority.

## Actor → screen → HTTP → Go → PostgreSQL → consumer

Admin → existing taxonomy path/subject/skill status selector → `PATCH /api/v1/taxonomy/admin/{paths|subjects|skills}/:id` with CSRF → existing taxonomy HTTP service → existing taxonomy PostgreSQL repository → admin bootstrap reload. **No backend/SQL changes.** The new browser suite mocks HTTP; it verifies error/retry control behavior and CSRF/payload continuity, **not** a real PostgreSQL write. A separate isolated PostgreSQL acceptance run is still required for this full chain.

## Reproduction and acceptance

New `apps/web/tests/e2e/admin-taxonomy-null-error-retry.spec.ts`: 9 scenarios (3 entity types × 390/820/1440 RTL) verify first PATCH 503 with `null` body, Arabic error, unchanged status, second explicit PATCH with the same CSRF and payload, successful state refresh, and browser reload. Two further cases check a server-supplied Arabic error and malformed JSON fallback. No invented buttons or layout changes.

- **RED test-only commit:** `fe94d52df619cd92e827bc09eb6d1107a472b159`; browser run: https://github.com/nasef6464/almeaago/actions/runs/40990913208 (check final outcome; a later push may cancel an in-flight run).
- **Fix commit:** `a0296199558b60c5ae68fcc1ef4d31e9cb9e4c69`; browser checks and four CI gates must be read from the final PR head, not assumed from older runs.

## Verdict and remaining work

**IMPLEMENTED / PARTIAL.** Narrow error-handling fix is implemented; exact-head CI/browser evidence pending at documentation commit time. Real Go/PostgreSQL persistence, admin failed-create/edit draft retention (#199), missing Skills Center controls (#206), original path/subject workspace and same-role/data paired Legacy↔Go screenshots at 390/820/1440 remain **NOT PROVEN**. Keep skills independent of paths and do not modify Legacy, production, RBAC, scoring, payments, or deployment.
