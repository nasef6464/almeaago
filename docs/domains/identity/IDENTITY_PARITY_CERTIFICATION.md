# Identity/Auth Parity Certification

Status: **TESTED — INTERNAL PARITY EVIDENCE GREEN / EXTERNAL EVIDENCE STILL REQUIRED**

## Scope of this certification batch

This batch closes the remaining internal Identity/Auth evidence gaps without inventing external-provider success.

Internal evidence covered:
- legacy-shaped desktop login modal.
- mobile signup modal.
- email/password login request and student redirect.
- registration normalization and password requirements.
- Saudi-phone recognition and WhatsApp OTP send/verify progression with mocked provider boundary.
- generic failed-login error inside the modal.
- forgot-password, reset-password and email-verification journeys.
- token-from-URL reset behavior plus manual verification-token entry.
- screenshot artifacts for desktop login/error, mobile signup/WhatsApp and recovery/verification states.
- backend password upper-bound regression coverage.
- explicit database assertions for Identity security tables, constraints and hot indexes.

## Existing backend/database evidence reconciled

Identity implementation was already merged across PRs #1, #2, #4, #5, #6, #8 and #9.

PR #9 already closed the admin-account Backend/Database implementation gate. This batch does not duplicate those business mutations; it adds cross-cutting parity evidence on the current integrated main line.

## Security/ownership boundaries preserved

- Identity owns credentials, sessions and account state.
- Organizations owns school/class/parent relationships.
- external Google and WhatsApp credentials are deployment/staging evidence, not CI assumptions.
- provider secrets are not introduced into browser tests.
- no raw session, CSRF, OTP or recovery secret is added to persisted application state by this batch.
- browser tests mock network boundaries only; backend/domain tests remain the authority for credential/session security behavior.

## External evidence still required before PARITY_PROVEN

The following cannot be honestly certified from repository CI alone:
- live Google OAuth credential/callback smoke in the target staging environment.
- live WhatsApp delivery credential smoke.
- direct legacy-runtime screenshot capture for side-by-side visual comparison.

The repository already contains the legacy-derived visual contract in `docs/visual-baseline/AUTH_UI_BASELINE.md`. This batch records deterministic screenshots of the new UI so a future environment with the legacy runtime can perform the final side-by-side comparison.

## First integrated exact-head verification

Implementation/evidence head `646c137f5119b4de3bc8174f1685a03ed826571c` passed all four gates:
- Database CI `36308778367`: PASS — full migration apply, Identity schema assertions, rollback and re-apply.
- Backend CI `36308778391`: PASS — module lock, sqlc compile, gofmt, go vet and Go tests.
- Frontend CI `36308778389`: PASS — typecheck and production build.
- Frontend E2E `36308778432`: PASS — **50/50 browser tests**, including all five Auth parity journeys.

Browser evidence:
- artifact `content-browser-evidence` id `10928103825`.
- digest `sha256:df38daf618eb7e9b8c30409f7ce34f01b5cf4ade081e4a480db1e97779051555`.
- captured Auth states include desktop login, desktop login error, mobile signup, mobile WhatsApp OTP and recovery/verification.

The documentation-inclusive final PR head must rerun the same four gates before merge. Exact final-head run IDs are recorded in the PR checkpoint without changing the tested head.
