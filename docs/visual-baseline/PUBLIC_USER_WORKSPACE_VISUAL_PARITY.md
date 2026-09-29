# Public Site + User Workspace Visual Migration Certificate

## Status
**IMPLEMENTED — FINAL EXACT-HEAD CERTIFICATION PENDING**

This certificate covers the public-site and root-workspace presentation gap discovered by opening the V2 runtime locally. It is not a production-readiness certificate and does not make a `PARITY_PROVEN` claim.

## Source baseline
- implementation repository: `nasef6464/almeaago`;
- implementation base after PR #97: `f4f481b58e09aad37b2d113e30de5e7c2a6c9f8d`;
- read-only legacy checkpoint: `cc359e5fb77e4a1fbb77e86d6fd986bf555878de`;
- legacy sources reviewed: `pages/Landing.tsx`, `pages/StaticInfoPage.tsx`, `components/Header.tsx`, `utils/platformFonts.ts`, `styles/main.css`, `index.html`, and `server/src/modules/content/presentation/platformPresentationDefaults.ts`;
- V2 workflow contract reviewed: `docs/blueprint/17_UI_SCREEN_WORKFLOW_MAP_AR.md`.

## Implemented presentation parity
### Public landing
The temporary V2 placeholder is removed. The root page now uses the legacy-supported Platform identity and defaults:
- badge: `المنصة الأولى للقدرات والتحصيلي`;
- hero title: `حقق المئة في اختباراتك`;
- source-backed hero description and primary CTA;
- learning/Qudrat/Tahsili/assessment showcase;
- `لماذا يختار الطلاب منصة المئة؟` section with the source-backed description;
- source-backed testimonial heading and default testimonial copy;
- closing CTA and public footer.

The landing images used by this slice are copied into `apps/web/public/images` from the read-only legacy repository. V2 therefore does not hotlink its runtime identity to the legacy deployment.

### Typography
The previous V2 CSS named Tajawal as a fallback without loading it. V2 now loads Tajawal weights 300, 400, 500, 700, 800 and 900 and sets platform body, heading, navigation and button font variables to Tajawal by default, matching the legacy typography baseline.

### Public routing
Source-backed public information pages are restored for About, Contact, FAQ, Privacy and Terms. Unknown paths return an explicit 404 instead of the generic `الصفحة قيد النقل` screen. Signed-out navigation is kept on public destinations; private learning/report links are exposed after authentication.

### Root workspaces
- `/dashboard`: real Student hub over existing Learning, Assessment, Review, Plan, Results, Reporting, Classroom and Notifications routes.
- `/supervisor-dashboard`: real Supervisor hub reading canonical Organizations contexts and linking to scoped Interventions/Reports/Notifications.
- `/admin-dashboard`: real Admin overview over already-implemented Content, Taxonomy, Question Bank, Assessment, Commerce, Notifications, Smart Classroom, AI, Reporting and Operations screens.
- School Director, Parent and Teacher/Smart-Classroom roots retain their already-implemented domain screens.

No hub fabricates counts, progress or business state merely for visual completeness.

## Responsive/browser evidence
New Playwright coverage verifies:
- public landing at 1440px desktop;
- public landing and mobile navigation at 390px;
- public landing/public-info behavior at 820px;
- no document-level horizontal overflow at those public checkpoints;
- real Student root workspace on mobile;
- real Supervisor and Admin root workspaces.

Pre-documentation implementation candidate `938bba7f1f3351165f85d59afda9ecf096ab7b35`:
- Frontend CI `36540239205`: PASS;
- Frontend E2E `36540239190`: PASS, **76/76**;
- browser artifact `11019869349`;
- artifact digest `sha256:7e583c0182903d44961821948d3a41d33ca8fe99e11087cb295d1769ab645bb8`.

Earlier strict-locator failures were test ambiguity caused by repeated accessible link text in responsive/navigation surfaces; locators were scoped to the intended navigation or main workspace without weakening product assertions.

## Explicit non-claims / deferred evidence
This batch does not claim:
- runtime-editable V2 HomepageSettings / PlatformFontSettings management parity;
- a public anonymous V2 Course catalog where the current server contract requires authentication;
- external/staging provider success;
- deployment identity verification;
- production load/bandwidth certification;
- dated restore/RPO-RTO proof;
- final retention/anonymization/governance closure.

Those items remain separate evidence/work gates. No backend, schema, RBAC, scoring or Commerce truth was changed by this visual slice.

## Final gate rule
PR #98 may merge only after its final documentation-inclusive exact head passes Database CI, Backend CI, Frontend CI and Frontend E2E. The exact final head, four run IDs, final artifact/digest, merge SHA and final legacy delta check are recorded by the independent closure-document PR after the implementation merge.
