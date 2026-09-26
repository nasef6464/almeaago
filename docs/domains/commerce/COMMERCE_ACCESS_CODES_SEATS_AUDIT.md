# Commerce Access Code / School Seat Audit

Status: **TESTED / MERGED**

## Scope
This checkpoint continues Commerce after the trusted Checkout/Discount/Provider ledger with:
- normalized activation/access codes.
- idempotent learner redemption.
- explicit seat assignment for seat-capped school Entitlements.
- learner Checkout redemption UI.
- platform-admin access-code and seat controls.

## Access-code authority
An access code references one canonical active paid Package/Membership Product.
The code stores no copied package scope arrays.
Redemption:
- normalizes the code server-side.
- locks the code row and canonical Package row transactionally, so seat-capacity checks remain serialized even when different codes target the same Package.
- enforces active lifecycle, start/expiry window and max uses.
- is unique per code + user.
- creates one Commerce Entitlement with source_type=access_code.
- increments usage only in the same transaction as the Entitlement and redemption ledger.
- derives expiry from the earlier of code expiry and Package validityDays.
- enforces seat capacity for capped packages.

A school-scoped code never mutates Organizations membership. The user must already have an active membership returned by the Organizations-owned membership projection.

## Explicit school seats
Unlimited school Packages may continue school-level inheritance.
A Package with seat_capacity does not grant broad membership inheritance.

For a capped school Entitlement:
- the admin assigns an explicit existing school member.
- Commerce locks the school Entitlement before capacity calculation.
- active seat count must remain below seat_capacity.
- assignment creates a user Entitlement with source_type=school_contract.
- the seat row references both school Entitlement and generated user Entitlement.
- duplicate active assignment is idempotent.
- revoke atomically revokes the seat and its user Entitlement.
- assignment/revoke are transaction-scoped Operations audit events.

## Boundary decision
Legacy behavior that silently attached a student to a school during access-code redemption is intentionally not copied.
Organizations remains authoritative for school membership; Commerce consumes only its active-school-ID projection.

## Verification checkpoint
- PR #57 merged to `main` from exact tested head `4dead20ea2f6480d3c854a52176462987ed0cdf7`.
- squash merge commit: `386023ebbfd73613df65727ead7491c146f9d2ff`.
- Database CI `36243759206`: PASS — apply, schema verification, rollback, re-apply.
- Backend CI `36243759164`: PASS — module lock, sqlc compile, gofmt, go vet, go test.
- Frontend CI `36243759193`: PASS — TypeScript typecheck and production build.
- Frontend E2E `36243759203`: PASS — learner activation-code redemption plus existing trusted Checkout/admin and Commerce foundation flows.
- browser evidence artifact `content-browser-evidence` id `10906349191`.
- the first E2E attempt failed because an older Commerce foundation test did not mock the new bounded access-code directory; the mock was aligned without weakening behavior.
- an additional concurrency hardening commit changed redemption locking from code-only to code + Package-row locking before the final exact-head run.

## Deferred
- provider-specific SDK/API session creation.
- trainer payout/revenue share.
- refunds/chargebacks beyond the provider-event foundation.
- Assessment entitlement consumption.
