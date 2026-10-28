# P1 — Arabic-Indic national-ID login: source-to-Go regression

**Date:** 2026-10-28. **Legacy source:** `nasef6464/almeaacodax@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`. **Go base:** `nasef6464/almeaago@935998650d2183bd9a8c95c154384ff4754b3197`. **Branch:** `fix/identity-arabic-indic-login-20261028`. **State:** PARTIAL until exact-head CI; not all-role identity parity.

## Proven contract and defect

Legacy `server/src/modules/auth/http/authSchemas.ts` defines `toAsciiDigits` with `/[٠-٩]/g`; `nationalIdLoginSchema` applies it before `/^[12]\\d{9}$/`. `server/src/routes/auth.routes.ts` registers `POST /api/auth/login/national-id` and looks up the normalized national ID in Mongo `UserModel`.

Go's `internal/identity/transport/http/handler.go` registers `POST /login/national-id` mounted at `/api/v1/auth` by `internal/platform/httpserver/server.go`. Before this change `internal/identity/application/service.go::LoginNationalID` trimmed but did not normalize Arabic-Indic numerals, so the ASCII-only regex rejected valid Legacy input before PostgreSQL lookup. Independently, `apps/web/src/features/auth/utils/identify-login-input.ts` and `AuthModal.tsx` used `/\\D/g` to extract ASCII digits, discarding the same input and failing to select national-ID login.

**Vertical trace:** Arabic-Indic ID in React login modal → `identifyLoginInput` + `normalizeArabicIndicDigits` → `AuthModal.submitLogin` → `authClient.loginNationalId` → `POST /api/v1/auth/login/national-id` → `identityhttp.Handler.loginNationalID` → `application.Service.LoginNationalID` → `Repository.UserByNationalID` → PostgreSQL `users.national_id`. This slice changes only canonicalization before lookup and the visual recognition hint; it does not modify the auth session, CSRF, account status, password validation, roles, or SQL.

The helper intentionally converts **only** U+0660–U+0669 (matching the source). Persian U+06F0–U+06F9 remain invalid; accepting additional digit scripts would be a separate policy change. Phone login and account identity writes are outside this slice.

## Tests and evidence

The tests were committed before the fix; early test-only CI runs were canceled by the repository's concurrency policy as subsequent commits arrived. Therefore a failed RED execution has **not** been observed and must not be claimed. Exact-head GREEN is required below.

- `internal/identity/application/national_id_digits_test.go`: repository-spy tests for ASCII, Arabic-Indic, mixed, padded national IDs; rejects invalid prefix, Persian digits and lengths before SQL lookup. No credentials or real students.
- `scripts/parity/identity-login-digits.test.mjs`: source-compatible numeral conversion and React smart-input classification. Wired into `.github/workflows/frontend.yml`.
- `apps/web/tests/e2e/auth-arabic-indic.spec.ts`: Chromium UI assertion and screenshot at **390×844**, **768×1024**, **1366×768**, checking RTL and the national-ID hint. These use a mocked signed-out `/me` endpoint; screenshots are Go-only, not Legacy-vs-Go visual certification.
- Backend CI and Frontend CI are required for the exact final PR head; Frontend E2E runs because an E2E test file changed. Database CI is still a required merge gate by repository policy even though no SQL changed. Record run URLs and conclusions in PR after completion.

## Adjacent P0 identity route inventory (not a parity claim)

A direct literal method/path extraction of `authRouter.get/post/patch/delete` from the pinned Legacy auth router yields **33** explicit registrations; `router.Get/Post/Patch/Delete` in the pinned Go identity handler yields **26**. **22** method/path strings match literally; **24** match after normalizing only `:id` versus `{id}` parameter syntax. The remaining **9** Legacy routes include trainer directory/performance, `me/preferences`, `me/purchase`, `me/redeem-access-code`, and parent link/unlink/linked-students. They belong to Reporting/Learning/Commerce/Parents/Organizations or remain to be verified there, not automatically absent from Go. Two Go-only aliases (`/csrf`, `/email/resend`) coexist with Legacy-compatible names. This is scoped to these two handler files, not a complete API inventory. See `docs/domains/identity/IDENTITY_CLOSURE_AUDIT.md` and `docs/migration/19_API_MOUNTS_AND_ASSESSMENT_OWNERSHIP_AR.md`.

**Remaining candidate:** Legacy generic `POST /api/auth/login` can detect a national ID in its email field, while Go's generic `Login` currently looks up email only. Verify which Legacy UI calls this before changing the generic API. Live provider smoke, cookie cross-browser behavior, full DB staging identity fixtures, and 8-viewport original-vs-Go screenshots are still UNKNOWN. Do not equate green tests for this slice with whole-platform parity.

**Safety:** No legacy/production writes, migrations, RBAC changes, payment actions, or deployment. PR-only changes; `main` protected by the normal review and CI gates.
