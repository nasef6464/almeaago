# ADMIN-PATH-STAGE-ORIGINAL-MODAL — source-backed RED contract (2026-10-30)

## Immutable references
- Legacy: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7` — read-only.
- Go base: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.
- **Legacy authority**: `dashboards/admin/PathsManager.tsx` lines ~1265–1280 and ~2062–2116.
- Go owner: **PR #160**, `TaxonomyAdminPage.tsx`. This PR adds only an independent test file and this handoff; no owner files touched.
- #199 covers path/subject/edit failed-save; #160 already covers independent Skills Center sub-skill retry. No duplication. Skills center remains separate.

## Actual source contract — not a Go redesign
In the original **selected path workspace → المراحل الدراسية** tab, the action is **«إضافة مرحلة دراسية»**, not an inline `كود المرحلة الجديدة` + `اسم المرحلة الجديدة` grid. Clicking it opens a centered modal with:
- contextual `مسار [اسم المسار] / المراحل الدراسية`, title **«إضافة مرحلة دراسية»**;
- **«اسم المرحلة»** text input and **«أيقونة المرحلة الدراسية»** picker/upload/clear;
- **«إلغاء»** and **«إضافة»** actions; edit mode uses the same modal with **«حفظ التعديلات»**.
- On cancel the modal closes without creating a stage. No new buttons, counters, code inputs or re-grouping may be introduced to replace this flow.

Go main and PR #160 currently show an **invented inline stage form** with code/name and `إنشاء المرحلة` inside a two-card grid. This is a **source-proven UI parity gap**, regardless of whether CRUD works. The implementation must adapt the Go API to the original modal, including any internal stable code generation, without showing an invented code field. Do not silently change server identifiers or persist unrelated data.

## Separate pointer obstruction found in the initial exploratory RED
Browser CI `41013392524` on `175002e10633e160212b599a8bc0bff10689157f`: 12 FAIL, 136 PASS, 3 SKIP. Stage's **current Go-only** `إنشاء المرحلة` button was intercepted by the adjacent material-code input (Playwright log: `<input aria-label="كود المادة الجديدة"> ... intercepts pointer events`). The old combined Go skill form also reset its draft after 409/503, but #160 already replaces it with a failure-safe independent Skills Center. Both interim tests were removed from the final PR: **we must not lock the invented inline form into acceptance**. The pointer issue remains evidence of current Go defect, but disappears if the owner correctly restores the original modal.

## Acceptance tests and state trace
`apps/web/tests/e2e/admin-legacy-stage-modal-parity-red.spec.ts` has **9 cases** (3 original flows × 390/820/1440 RTL):
1. Selected path stage action and **absence** of invented inline stage code/create controls.
2. Modal title, name, icon picker, cancel/add, and cancel closes without persistence.
3. Admin → stage modal → name/icon → POST `/api/v1/taxonomy/admin/levels` → simulated HTTP 503 retains modal/draft → explicit retry 201 → bootstrap reload displays saved stage.

Mocked HTTP does **not** prove Go/PostgreSQL. Follow-up: real session+CSRF+role denial, PostgreSQL `levels` insert/audit, failed write rollback, read/reload, same-role/data paired Legacy↔Go images at 390/820/1440 including dialog/error/success states. API adapter must preserve the stable stage identity and avoid hidden server-side behavior changes.

## Owner handoff
#160 must restore the original **path card → path workspace → stages tab → stage modal** rather than merely fixing the current inline form's overlap. Keep Skills Center separate. Rerun #199, #206, #160 tests, and this PR's RED cases; no skipped/relaxed assertions. No main merge, deployment, cutover, scoring/payments/RBAC or Legacy/production writes.

**Status: PARTIAL / RED pending final exact-head CI.** Test-only acceptance and source-level discovery; full runtime/visual and real DB parity remain unproved.
