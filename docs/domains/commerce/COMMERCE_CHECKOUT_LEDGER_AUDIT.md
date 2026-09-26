# Commerce Checkout / Discount / Provider Ledger Audit

Status: **IN REVIEW**

## Scope
This checkpoint extends the merged Commerce Entitlement Foundation with the first trusted purchase pipeline:
- server-owned PaymentRequest.
- relational discount validation/reservation/redemption.
- manual admin review with evidence.
- signed provider-event ledger.
- learner Checkout UI.

It deliberately does not make Content, Assessment or Learning authoritative for payment state.

## Price authority
The browser may send only:
- `productId`.
- optional `discountCode`.
- `paymentMethod`.
- bounded `idempotencyKey`.

The server re-reads the canonical active/visible paid Product inside the checkout transaction and snapshots:
- Product revision/name.
- original amount in minor units.
- discount amount.
- final amount.
- currency.
- gateway mode/provider.

No client price, amount, currency, product name or entitlement scope is accepted.

## Discount integrity
Discounts are normalized:
- one code row.
- relational scopes: all / exact Product / Product type.
- percentage in basis points or fixed integer minor units.
- lifecycle window and minimum amount.
- optional redemption budget.
- separate reservation/redemption rows tied to PaymentRequest.

Checkout locks the discount row, reserves capacity transactionally, and records the exact code/amount snapshot.
Paid converts reserved → redeemed.
Rejected/cancelled/failed converts reserved → released.
Normal lists use `limit+1/hasMore`; no exact-count path is required.

## PaymentRequest lifecycle
`pending` is created idempotently per user + idempotency key.
A reused key with different Product/payment method/discount is rejected.

No Entitlement is created at request creation.

Manual review:
- platform admin only.
- CSRF required.
- optimistic `expectedRevision`.
- paid requires explicit approval evidence.
- Entitlement grant, discount settlement, PaymentRequest update and Operations audit share one transaction.
- Entitlement idempotency key derives from the PaymentRequest.

## Provider webhook
- route is provider-specific.
- raw body is capped before read.
- HMAC-SHA256 is verified over exact raw body before JSON decode.
- absent `PAYMENT_WEBHOOK_SECRET` returns 503; the handler fails closed.
- signature secret is server-only.
- event uniqueness: provider + eventId.
- raw payload SHA-256 is persisted.
- provider/mode must match the PaymentRequest.
- a paid event must match exact final amount + currency before any grant.
- verified but semantically rejected amount/provider events are retained in the provider-event ledger with a rejection processing result.
- duplicate provider events are idempotently acknowledged without another grant.

## Boundary / grant authority
Commerce remains the only domain that grants purchase Entitlements.
Content consumes a Commerce access decision.
Assessment and Learning receive no provider secret/payment proof.
The current Course lock links to Checkout using Commerce product ID only.

## Deferred
- provider-specific SDK/API session creation.
- access-code redemption.
- explicit school seat assignment.
- trainer payout/revenue share.
- refunds/chargebacks beyond the provider-event foundation.
- Assessment entitlement consumption.

## Required merge gates
- Database apply/schema verification/rollback/re-apply.
- Backend module lock/sqlc/gofmt/vet/tests.
- Frontend typecheck/build.
- Frontend Playwright, including no-client-price Checkout assertion and admin approval flow.
