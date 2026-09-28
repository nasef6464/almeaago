# Commerce Integrated Parity Certification

Status: **CERTIFICATION CANDIDATE**

## Source basis
Audited against the latest read-only legacy checkpoint `20a77c62fd2db4ef891a574241f4cfd6946011de`, the merged Commerce audits, and target blueprint `docs/blueprint/07_CONTENT_COURSES_ACCESS_COMMERCE_AR.md`.

## Integrated scope
The already-merged V2 Commerce stack covers:
- Course products and Package/Membership scopes.
- user/school Entitlements with lifecycle and idempotency.
- server-authoritative Checkout, discount reservation/redemption and signed provider-event ledger.
- access-code redemption and explicit capped-school seat assignment.
- Assessment access consumption through a narrow Commerce boundary.
- Tap hosted payment-link initiation and hashstring-verified final webhook processing.
- factual Course revenue allocation/payout evidence.
- factual full refund/chargeback reversal with access and revenue reversal state.

## Certification correction — school commerce context
Legacy school commerce is school-contextual: school packages, activation codes and seat usage are managed together. V2 already normalized that authority, but the platform-admin UI still required raw IDs for capped-seat assignment and always created access codes without a school scope.

This batch:
- loads active Schools through Organizations.
- allows an activation code to be explicitly scoped to a canonical School or remain global.
- resolves a selected school Entitlement to its canonical School.
- loads that School's active Classes and active Student roster through Organizations.
- assigns a capped seat using the selected canonical Student ID instead of free-text UUID entry.
- does not issue any Organizations membership mutation from Commerce.
- still relies on Commerce server-side checks for active membership, entitlement shape, seat capacity and idempotent grant creation.

## Financial truth / provider boundary
No new financial policy is inferred:
- live Tap sandbox/provider proof remains external.
- partial refunds are not implemented because access/revenue/discount/provider-fee effects are unresolved.
- automatic trainer clawback after a paid payout remains unresolved.
- multi-trainer Package/Membership allocation remains UNKNOWN without an explicit allocation rule.
- external payout execution and provider-fee ingestion are not fabricated from ledger UI.

## Required closure
The final documentation-inclusive head must pass Database CI, Backend CI, Frontend CI and Frontend E2E on the exact same SHA. Browser evidence must include the canonical school-code/seat journey and prove no school-membership mutation is issued by the Commerce UI. Status remains TESTED rather than PARITY_PROVEN without external provider/runtime visual proof.
