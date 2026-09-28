# Commerce Integrated Parity Certification

Status: **TESTED / MERGED**

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

## Green implementation checkpoint
Implementation head `b91d52d4c0f064e22c56b2a79dc1ebb1e1c1c89a` passed all four gates on the same SHA:
- Database CI `36377159108`.
- Backend CI `36377159129`.
- Frontend CI `36377159131`.
- Frontend E2E `36377159115` — 65/65.
- browser evidence artifact `10950974252`, digest `sha256:e762bf8490e7b87f66531252624fa38430a5edd6f301edde2d4dea7ee66e62a0`.

The new browser journey proves a platform admin can:
1. select a canonical School for an activation code;
2. select School -> Class -> active Student for a capped seat;
3. send only the selected student ID to Commerce;
4. issue no Organizations membership mutation from the Commerce UI.

## Final same-domain legacy delta re-check
The latest legacy commit remains `20a77c62fd2db4ef891a574241f4cfd6946011de`. Its changed files are Question Bank/Tahsili import identity, media-presign and question-presentation/pilot files; no Commerce, payment, package, access-code, school-commerce, revenue or reversal contract changed. No additional Commerce behavior is copied from that delta.

## Final certification evidence
Final documentation-inclusive PR #80 head `01b8df818d74e7a6a0ee1ba647f1e11da6875dae` passed all four required gates on that exact SHA:
- Database CI `36377437385`.
- Backend CI `36377437374`.
- Frontend CI `36377437343`.
- Frontend E2E `36377437469` — 65/65.
- browser evidence artifact `10951730943`, digest `sha256:5434e2ffa1df40bb8df4ba92d766fe7c249dcf248e244703b8f6e68ac9043667`.

PR #80 squash-merged to `main` as `de89512d4599f76ebc75365c9556fcbf94ee09d3`.

Commerce remains **TESTED**, not `PARITY_PROVEN`. Live Tap sandbox/provider evidence, direct legacy-runtime visual proof, partial-refund/clawback policy, and Package multi-trainer allocation remain explicit external/UNKNOWN evidence.
