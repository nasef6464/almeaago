# Commerce Revenue / Trainer Payout Ledger Audit

Status: **TESTED / MERGED**

## Source evidence
The Commerce blueprint requires finance truth to separate:
- gross sale.
- provider fee.
- discount.
- platform share.
- trainer share.
- payout status.

It also explicitly says estimated revenue must not be presented as fact without a source ledger.

Legacy and current Content both carry an admin-controlled `revenueSharePercentage` on trainer-owned content. The target Course model also has canonical ownership (`owner_type`, `owner_user_id`) and the revenue-share percentage.

## Boundary decision
Commerce owns sale/payment/revenue/payout state.
Content owns Course ownership and the configured trainer revenue policy.

Checkout calls a narrow Content boundary at purchase creation and snapshots:
- Course ID.
- trainer user ID only when the Course is teacher-owned.
- configured revenue-share percentage, including a deliberate missing-policy state.

Commerce does not join Content tables directly and does not let a trainer set their own revenue percentage.

## Actual-sale ledger
Migration `000032_commerce_revenue_payout_ledger` adds immutable-at-checkout revenue policy snapshot fields to PaymentRequest and a normalized `commerce_revenue_entries` ledger.

A revenue entry is created only when the PaymentRequest reaches `paid` through an existing trusted path:
- evidence-backed platform-admin manual approval, or
- verified provider paid webhook with exact amount/currency matching.

It is unique per PaymentRequest, so retries and duplicate provider events cannot create duplicate sale revenue.

Facts copied from the trusted PaymentRequest:
- gross amount.
- discount amount.
- actual paid amount.
- currency.
- Product / buyer.
- snapshotted Course/trainer/policy when applicable.

No historical revenue rows are backfilled because applying today's trainer policy to an old sale would invent history.

## Trainer policy scope
This slice recognizes a trainer beneficiary only for a Course whose canonical Content owner is a teacher.

- platform-owned Course: revenue allocation is `not_applicable`.
- teacher-owned Course with missing percentage: `policy_missing`; no payout amount is invented.
- teacher-owned Course with configured percentage: allocation begins `pending`.

An assigned teacher on platform-owned content is not silently treated as the revenue beneficiary.

Package/Membership trainer allocation is deliberately not inferred because the blueprint does not define how one sale should be divided among multiple underlying trainers/content owners.

## No estimated money
The stored revenue percentage is policy/provenance, not an automatic payout formula.

The blueprint does not define whether the percentage is applied before/after discount, provider fee, tax, or other settlement adjustments. Therefore this slice does not compute trainer share automatically.

A platform admin may record an actual allocation only with:
- provider fee in integer minor units.
- trainer share in integer minor units.
- platform share in integer minor units.
- explicit settlement evidence.
- exact optimistic revision.

The database requires:

`provider fee + trainer share + platform share = trusted paid amount`.

This prevents the previous legacy-style estimated dashboard arithmetic from becoming financial truth.

## Payout
After allocation:
- positive trainer share => `payout_status=pending`.
- zero trainer share => `not_applicable`.
- a platform admin may mark a positive trainer share paid only with payout evidence and optimistic revision.
- Commerce records who marked it paid and when.

This slice records payout evidence; it does not execute a bank/provider money transfer.

## Audit / concurrency
- allocation and payout rows are locked before mutation.
- revision is checked optimistically.
- allocation and payout mutations write Operations audit events.
- PaymentRequest -> RevenueEntry is idempotent by unique PaymentRequest ID.

## UI
Commerce admin loads a bounded revenue ledger and shows:
- gross / discount / paid actual sale amounts.
- snapshotted trainer and policy percentage.
- allocation and payout statuses.
- actual provider/trainer/platform amounts only after evidence-backed allocation.

The UI states that shares are not estimates and validates the exact arithmetic before sending the command. Server/database validation remains authoritative.

## Deferred
- provider-specific payment-session SDK/API creation.
- refunds/chargebacks and their reversal effects on revenue/payout.
- automatic provider-fee ingestion.
- a business-rule formula that derives trainer share from the configured percentage.
- package/membership multi-trainer allocation policy.
- external payout-provider money transfer.

## Verification checkpoint
- PR #60 merged from exact tested head `8ed34950b19594bc07b7d02db05cd8fff353ac05`.
- squash merge commit: `c2e3555215ee17d6b193d12d270ff518169a9398`.
- Database CI `36251701308`: PASS — apply/schema verification/rollback/re-apply.
- Backend CI `36251701292`: PASS — module lock/sqlc/gofmt/vet/tests.
- Frontend CI `36251701283`: PASS — typecheck/build.
- Frontend E2E `36251701284`: PASS — all 30 browser tests including factual trainer allocation and payout evidence.
- browser evidence artifact `content-browser-evidence` id `10910000402`, digest `sha256:7023d14206c488693fbc91659f095dbe16c48d034da1f9d94bacf70704d5b900`.
- initial Backend failure was gofmt-only and the initial browser failure was an ambiguous locator after a successful allocation; both were corrected without weakening behavior, then all four gates passed on the final head.
