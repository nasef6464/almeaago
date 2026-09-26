# Commerce Tap Payment-Link Audit

Status: **TESTED / MERGED**

## Evidence
Legacy ALMEAA had a provider-specific Tap initiation path using server-trusted amount/target, `POST https://api.tap.company/v2/charges`, a returned redirect URL/charge ID, and Tap-specific webhook handling. Archived handoff records say live closure remained dependent on Tap credentials and a sandbox transaction.

Current Tap documentation confirms the Charges API is `POST /v2/charges/`, hosted redirect flows return a payment URL, `reference.idempotent` is recommended for duplicate protection, and webhook authenticity uses the provider `hashstring` calculation over canonical charge fields.

## Boundary
- Commerce owns PaymentRequest, discount reservation, provider-session state, provider-event ledger, Entitlement grant and revenue creation.
- Tap adapter owns only provider HTTP request/response and Tap hashstring verification.
- Browser never sends authoritative price, amount, currency or product name to Tap.
- provider secrets remain server-only environment variables.

## Payment-link lifecycle
- new gateway mode: `payment_link`.
- current slice supports Tap hosted card payment only.
- Checkout creates the normal trusted PaymentRequest first.
- Tap receives amount/currency/product/user data only from that server-owned snapshot.
- `reference.transaction`, `reference.order` and `reference.idempotent` all correlate to PaymentRequest ID.
- Tap session ID + redirect URL are persisted only after a valid `INITIATED` provider response.
- provider initiation failure marks the PaymentRequest failed and releases any reserved discount.
- duplicate checkout idempotency cannot create a second local PaymentRequest.

## Webhook
`POST /api/v1/commerce/webhooks/tap`:
- reads raw JSON.
- verifies Tap `hashstring` with the server-only secret API key.
- supports final Charge statuses only.
- maps `CAPTURED` to paid, `CANCELLED` to cancelled, and documented terminal failures to failed.
- then reuses the canonical provider-event ledger.
- exact provider, final amount and currency must still match before Entitlement grant.
- provider events remain idempotent.
- trusted paid transition still creates the factual revenue ledger from PR #60.

## Configuration
- `COMMERCE_PAYMENT_GATEWAY_MODE=payment_link`
- `COMMERCE_PAYMENT_PROVIDER_CODE=tap`
- `TAP_SECRET_KEY` (or legacy-compatible `TAP_API_KEY`)
- `TAP_WEBHOOK_URL` — public API Tap callback URL.
- `TAP_REDIRECT_URL` optional; defaults to `WEB_ORIGIN/checkout`.

No secret values belong in Git.

## Currency scope
This provider slice accepts SAR and EGP because the preserved legacy Tap/payment presets are SA/EG and the current Commerce minor-unit/UI convention is two decimal places. Other currencies fail closed until their minor-unit/provider rules are explicitly modeled.

## Deferred
- live Tap sandbox proof because credentials/account access are external.
- Tap refunds/chargebacks and revenue reversal.
- additional payment providers.
- provider fee ingestion from settlement APIs.

## Verification checkpoint
- PR #61 merged from exact tested head `8928c20bffcb293c931c599430cb92b9bd9bff56`.
- squash merge commit: `a26586c4bf89cdfa37dd7dd0b26306f4e2533f1a`.
- Database CI `36252943842`: PASS — apply/schema verification/rollback/re-apply.
- Backend CI `36252943838`: PASS — module lock/sqlc/gofmt/vet/tests including Tap adapter + hashstring coverage.
- Frontend CI `36252943811`: PASS — typecheck/build.
- Frontend E2E `36252943750`: PASS — trusted Tap redirect Checkout plus existing browser journeys.
- browser evidence artifact `content-browser-evidence` id `10909912571`, digest `sha256:a853919f1f7d6af2b8e0205f4eab869c1ec840da942669c156fa0103f1f2e3e6`.
- initial Backend runs exposed escaped struct tags and gofmt deltas in the new provider adapter; they were corrected without weakening behavior, then all four gates reran green on the final head.
