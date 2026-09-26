# Commerce Entitlement Foundation Audit

Status: **TESTED / MERGED**

## Legacy contract verified
The source system confirms:
- Course is an independent sellable product.
- Package is a bundle/entitlement scope and must never be passed as a Course.
- package content scopes include courses, foundation, banks, tests, mock exams, library and global/all membership.
- AccessGrant is the canonical grant ledger with active/revoked/expired lifecycle, source identity, expiry and idempotency.
- Payment approval must derive product/price/access from server state, not browser-supplied price or package arrays.
- school/package capacity is a separate business rule; a positive seat cap cannot imply unlimited school inheritance.
- payment webhooks require signature/idempotency and are not part of this foundation slice.

## V2 ownership
Commerce owns:
- product identity and price.
- package/membership definition and relational package scopes.
- entitlement/access-grant lifecycle.
- access decision reason.

Content owns Course/lesson lifecycle and never stores price or entitlement arrays.
Taxonomy owns Path/Subject validity.
Organizations owns active school membership.
Payment provider secrets/events remain outside this slice.

## Schema
Migration `000028_commerce_entitlement_foundation` adds:
- `commerce_products`
- `commerce_packages`
- `commerce_package_items`
- `commerce_entitlements`

Money is stored as integer minor units + ISO-style 3-letter currency, not floating point.

Existing Courses are backfilled as explicit **free** Course products only to preserve the already-live V2 learner behavior during staged cutover. New Courses without a Commerce product fail closed for non-preview delivery until an admin configures Commerce.

## Product rules
- Course product targets exactly one canonical Course.
- Package/membership products do not masquerade as Courses.
- Product type and Course target are immutable after creation.
- free products must have zero price.
- Course product creation requires an approved + published + visible canonical Course.
- package path/subject/course scopes are validated through Content/Taxonomy interfaces.
- package item collections are bounded to 200 items.

## Entitlements
The first mutation surface is platform-admin manual grant/revoke only.
A grant has:
- user OR school subject, never both.
- canonical product.
- source `admin_manual`.
- unique idempotency key.
- start/optional expiry.
- active/revoked/expired lifecycle.
- optimistic revision on revoke.
- transaction-scoped Operations audit.

PaymentRequest, provider webhook, discount and access-code grant creation are deliberately deferred and cannot be forged through this API.

## School boundary
Commerce asks Organizations only for active School IDs of the authenticated user.
It does not query membership tables itself.

Unlimited school package entitlements may be inherited by active school members.
A package with a positive `seat_capacity` does **not** automatically unlock for every school member. It requires a later explicit per-user seat/grant flow, preventing seat-cap bypass during this foundation phase.

Organizations remains owner of future SchoolContract lifecycle.

## Course access resolution
For an authenticated Course request:
1. Content resolves the canonical approved/published/visible Course scope.
2. Commerce resolves the active Course product.
3. free product => allow.
4. paid product => search active, non-expired user grants, then eligible school grants.
5. a package/membership grant may match Course, Path, Subject, `courses`, or `all`.
6. unconfigured Course => deny non-preview content.
7. preview lesson => may be delivered without paid entitlement.
8. non-preview Lesson detail is enforced server-side; the React lock is not the security boundary.

Normal access checks are bounded point/EXISTS queries and do not scan user arrays or hydrate package inventories.

## UI checkpoint
- new admin route `/admin-dashboard/commerce`.
- existing Course products can be switched free/paid with server-owned price.
- package creation is available for broad content-type/all scope in the initial UI.
- manual user/school entitlement grant/revoke is exposed to platform admin.
- Course learner UI displays Commerce denial independently from Content `isLocked`.
- preview stays available while paid content remains locked.

## Deferred
- PaymentRequest/cart/checkout.
- discount code lifecycle.
- payment-provider settings/secrets.
- signed webhook event ledger.
- access-code redemption and seat assignment.
- trainer revenue ledger/payouts.
- Assessment entitlement consumption.
- pricing marketplace visual parity.

Those are separate Commerce batches and must reuse this product/entitlement authority rather than adding access arrays to User/Content/Assessment.


## Verification checkpoint
- exact tested PR head: `186aab81e0df34cadad18b1d2c52df2e1384f0f9`.
- Database CI `36236809132`: PASS.
- Backend CI `36236809185`: PASS.
- Frontend CI `36236809255`: PASS.
- Frontend E2E `36236809141`: PASS.
- browser evidence artifact: `10903659884`.
- PR #55 merged to `main` as `d0daabcadcdfc8bdd7768d2691641b62becde174`.
