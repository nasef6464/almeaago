# Packages, Memberships, & Hybrid Access Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a best-in-class Packages & Memberships system for Almeaago (`almeaago`), featuring 4 tiered memberships (Free, Foundation, Excellence, VIP Diamond), an interactive public Pricing & Comparison page, a student header membership badge, school-sponsored entitlement inheritance with hybrid union (B2B + B2C), and bulk voucher/discount management.

**Architecture:** Unified `EffectiveAccessResolver` calculating permissions as the union of School B2B contract entitlements, individual B2C purchases, and redeemed vouchers. React 19 frontend with Tailwind CSS glassmorphic cards, billing cycle toggle (Monthly, Term, Annual), interactive feature matrix, and Go backend integration with PostgreSQL `commerce_entitlements` and `school_contracts`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide icons, Go 1.24, PostgreSQL, Vite.

**Spec:** [`docs/superpowers/specs/2026-11-10-packages-memberships-and-hybrid-access-design.md`](file:///c:/almeaago/almeaago/docs/superpowers/specs/2026-11-10-packages-memberships-and-hybrid-access-design.md)

## Global Constraints
- Strictly preserve school-sponsored entitlements: school students never get locked out of licensed school paths.
- Hybrid union: individual purchases supplement and upgrade school entitlements (`school_entitlements ∪ individual_entitlements`).
- Currency is Saudi Riyal (SAR / ر.س) formatted with standard Arabic locale `ar-SA`.
- High conversion RTL typography with dark/emerald/amber/indigo glassmorphic aesthetic.
- Zero breaking changes to existing `commerceClient` endpoints.

## Review Focus
1. Student affiliated with a school with only Qudurat: must access Qudurat for free and be able to purchase Tahsili or VIP Diamond individually without losing school affiliation.
2. Annual billing toggle must correctly calculate and display the 35% discount badge and update all tier cards instantly.
3. Access code redemption on the pricing page must immediately grant entitlement without page reload.
4. Student membership badge in header must show school name if school-sponsored, or tier name with remaining days counter.
5. Inactive or expired memberships must gracefully fall back to Free Starter tier without throwing exceptions.

---

### Task 1: Membership Tiers & Effective Access Engine Types
**Files:**
- Create: `apps/web/src/features/commerce/api/membership-types.ts`
- Test: `scratch/test_membership_matrix.mjs`

**Interfaces:**
- Produces: `MembershipTierId`, `BillingCycle`, `MembershipTier`, `EffectiveEntitlement`, `resolveEffectiveAccess()`, `MEMBERSHIP_TIERS`

- [ ] **Step 1: Write the failing contract test**
Create `scratch/test_membership_matrix.mjs` testing tier definitions, savings calculations, and hybrid union resolution.

- [ ] **Step 2: Run test to verify it fails**
Run: `node scratch/test_membership_matrix.mjs`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `apps/web/src/features/commerce/api/membership-types.ts`**
Define the 4 tiers (`free_starter`, `smart_foundation`, `golden_excellence`, `diamond_vip`), feature matrices, prices, and `resolveEffectiveAccess()`.

- [ ] **Step 4: Run test to verify it passes**
Run: `node scratch/test_membership_matrix.mjs`
Expected: PASS.

---

### Task 2: Student Membership Badge & Header Indicator
**Files:**
- Create: `apps/web/src/features/commerce/components/StudentMembershipBadge.tsx`
- Modify: `apps/web/src/features/public/components/Navigation.tsx`
- Test: `scratch/test_membership_badge_contracts.mjs`

**Interfaces:**
- Consumes: `resolveEffectiveAccess` from `membership-types.ts`, `useAuth`
- Produces: `<StudentMembershipBadge />`

- [ ] **Step 1: Write the failing contract test**
Create `scratch/test_membership_badge_contracts.mjs` testing badge label rendering for school students, VIP members, and free users.

- [ ] **Step 2: Run test to verify it fails**
Run: `node scratch/test_membership_badge_contracts.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement `StudentMembershipBadge.tsx` and integrate into Navigation**
Build badge with dropdown popover showing remaining days, active benefits, and upgrade CTA.

- [ ] **Step 4: Run test to verify it passes**
Run: `node scratch/test_membership_badge_contracts.mjs`
Expected: PASS.

---

### Task 3: Public Pricing & Membership Showcase Page
**Files:**
- Create: `apps/web/src/features/commerce/pages/PricingPlansPage.tsx`
- Modify: `apps/web/src/App.tsx` (wire `/pricing` and `/memberships` routes)
- Test: `scratch/test_pricing_page_contracts.mjs`

**Interfaces:**
- Consumes: `MEMBERSHIP_TIERS`, `commerceClient`, `useAuth`
- Produces: `<PricingPlansPage />`

- [ ] **Step 1: Write the contract test for pricing page logic**
Test tier price calculations across monthly, term (3 months), and annual cycles with discount application.

- [ ] **Step 2: Run test to verify failure**
Run: `node scratch/test_pricing_page_contracts.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement `PricingPlansPage.tsx` and wire routes**
Build glassmorphic tier cards, billing cycle switch, interactive comparison matrix, school code redemption box, and FAQs.

- [ ] **Step 4: Run test to verify pass**
Run: `node scratch/test_pricing_page_contracts.mjs`
Expected: PASS.

---

### Task 4: Commerce Admin B2B & B2C Package Management Suite
**Files:**
- Modify: `apps/web/src/features/commerce/pages/CommerceAdminPage.tsx`
- Test: `scratch/test_admin_package_suite.mjs`

**Interfaces:**
- Consumes: `commerceClient`, `organizationsClient`
- Produces: Bulk voucher generator, tier-scoped package creator, CSV voucher exporter

- [ ] **Step 1: Write test for admin package management helpers**
Create test validating bulk code generation, expiration formatting, and CSV serialization.

- [ ] **Step 2: Run test to verify failure**
Run: `node scratch/test_admin_package_suite.mjs`
Expected: FAIL.

- [ ] **Step 3: Update `CommerceAdminPage.tsx`**
Add package tier presets, multi-use voucher bulk generator, and export to CSV.

- [ ] **Step 4: Run test to verify pass**
Run: `node scratch/test_admin_package_suite.mjs`
Expected: PASS.

---

### Task 5: End-to-End Suite Verification
**Files:**
- Create: `scratch/verify_membership_hybrid_suite.mjs`

- [ ] **Step 1: Run comprehensive verification script across all 5 tasks**
Execute tests covering hybrid access union, pricing math, voucher redemption, badge rendering, and route integration.
- [ ] **Step 2: Verify zero TypeScript errors and clean git status**
Run contract tests and confirm 100% success.

