# Commerce Access Code / School Seat Audit

Status: **IMPLEMENTED — CI REQUIRED BEFORE MERGE**

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
- locks the code row transactionally.
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

## Required merge gates
- Database apply/schema verification/rollback/re-apply.
- Backend module lock/sqlc/gofmt/vet/tests.
- Frontend typecheck/build.
- Frontend Playwright with learner activation-code evidence plus existing Checkout/admin flows.

## Deferred
- provider-specific SDK/API session creation.
- trainer payout/revenue share.
- refunds/chargebacks beyond the provider-event foundation.
- Assessment entitlement consumption.
