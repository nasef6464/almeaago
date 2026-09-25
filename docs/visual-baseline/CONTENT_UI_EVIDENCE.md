# Content UI Browser Evidence

Status: **VISUAL_CHECKPOINT_GREEN / MERGED**

This checkpoint covers the representative Content administration surfaces needed to close the current React cutover batch. It is not a claim that every ALMEAA screen is globally parity-proven.

## Exact browser checkpoint

Representative visual alignment implementation:
- visual alignment commit `9c92769f6c64c3815782d65f75aed9c1fe548778`.
- final PR #38 head `84723eb593749bab0c3a33a3fb090539b2e3f315`.
- final Frontend CI run `36163606394`: PASS (TypeScript typecheck + Vite production build).
- final Frontend E2E run `36163606469`: PASS (4/4).
- final browser evidence artifact `10875624297`.
- PR #38 merge commit `8133e36b09621bc58c8bf0180cf65fe34ab2c3c3`.

The merge used the exact tested head SHA guard; GitHub would have rejected the merge if the branch moved.

## Legacy comparison basis

The legacy repository deep-premerge run `36148975277` produced artifact `platform-v3-deep-premerge-36148975277` (artifact id `10871551058`). The actual legacy admin shell was inspected at:

- `ui-audit-exhaustive/deep-premerge-roles-36148975277/admin/desktop-_admin-dashboard_tab_paths.png`
- `ui-audit-exhaustive/deep-premerge-roles-36148975277/admin/mobile-_admin-dashboard_tab_paths.png`

Builder structure was compared against the exact legacy React sources:

- `dashboards/admin/AdvancedCourseBuilder.tsx`
- `dashboards/admin/builders/UnifiedLessonBuilder.tsx`
- `dashboards/admin/LessonsManager.tsx`
- `dashboards/admin/FoundationManager.tsx`
- `dashboards/admin/LibraryManager.tsx`

## Resolved representative discrepancies

The cutover now preserves the main legacy visual hierarchy while retaining the redesigned backend contracts:

- Admin desktop uses the legacy-style white top bar, platform branding, right-side administration navigation, gray workspace and role-switch affordance.
- Admin mobile uses the legacy-style compact top bar and hamburger navigation instead of the generic public site header.
- Course editing uses the legacy Master Builder frame: gray header with close action, explicit `تعديل الدورة (Master Builder)`, underline curriculum/settings tabs, gray scroll/work area and white module cards.
- The Course curriculum heading is aligned to `باني المناهج (Curriculum Builder)`.
- Lesson create/edit uses the legacy Unified Lesson Builder modal pattern: dark/backdrop overlay, centered white rounded panel, gray header, close action, scrollable body and separated save footer.
- Course lesson placement preserves the legacy free-preview concept using normalized `isPreview` placement state rather than a copied lesson access blob.
- Foundation placements and Course modules reference canonical Lesson/Library IDs rather than duplicating content payloads.

## Deterministic browser checks

Playwright verifies:

- desktop admin shell + bounded Content list + real Course curriculum builder.
- mobile Content navigation + Lesson-builder reachability.
- teacher sends no broad Course list request before an exact path+subject is selected.
- Foundation resolves relational Lesson and Library placements without copying payloads.
- representative desktop and mobile screenshots are emitted as the `content-browser-evidence` artifact.

The browser API is mocked deterministically, so this gate does not require Vercel, Render, PostgreSQL, R2, Google OAuth or WhatsApp credentials.

## Intentional architectural non-parity

The following legacy behaviors are not copied into Content because their authority belongs elsewhere or requires a safer contract:

- Assessment placements -> Assessment domain, referencing canonical IDs.
- learner entitlement/access -> Commerce/Access, not a local Content `accessControl` blob.
- Media/R2 asset picking -> Media UI; binary bytes stay browser -> R2 and never proxy through Go.
- bulk XLSX import/export -> restore only with bounded server-side preview/validation and explicit limits, not browser-side full-inventory loading.
- in-video question authoring -> Question Bank/Assessment integration, not duplicated question state inside Content.
- direct editing of approved content -> remains fail-closed until the versioning/product policy is finalized.

## Workflow behavior

`.github/workflows/frontend-e2e.yml` is path-limited to meaningful Content/App/test files and may also be manually dispatched. This keeps Actions usage bounded while ensuring UI-source changes now re-run the browser gate automatically.
