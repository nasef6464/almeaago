# Exact Legacy UI Transplant — Authoritative Implementation Plan

Status: **ACTIVE PLAN**
Owner repository: `nasef6464/almeaago`
Legacy reference: `nasef6464/almeaacodax` (**READ ONLY**)

## User intent

The final product must preserve the legacy ALMEAA visual experience and interaction model as closely as technically possible while running on the existing ALMEAA Go/V2 architecture.

The target is **not a redesign** and not a simplified reinterpretation.

The target is:

```
Legacy visual/presentation contract
        ↓
V2 frontend presentation adapters
        ↓
Existing V2 API contracts
        ↓
Go + PostgreSQL + Redis + current owner-domain boundaries
```

The user has explicitly invested heavily in the existing interfaces, including learning pages. Those interfaces are treated as product assets to preserve.

## Non-negotiable invariants

1. **Legacy is the visual source of truth.**
   - layout, spacing, widths, typography, hierarchy, images, icons, cards, sections, shadows, radius, RTL behavior, motion, hover states, menus, dialogs and responsive behavior are copied from source evidence where possible.
   - do not replace a source-backed legacy pattern with a new design merely because the new design is cleaner.

2. **V2 backend is the functional source of truth.**
   - do not restore MongoDB, Express, legacy authorization, legacy scoring, legacy payment ownership, or legacy persistence patterns.
   - existing Go/PostgreSQL/Redis/domain boundaries remain authoritative.

3. **Frontend adaptation instead of backend reshaping.**
   - if the legacy component expects a different DTO, introduce a frontend adapter/view model over the canonical V2 client.
   - do not change a backend contract solely to make a legacy component easier to copy.
   - backend work is permitted only when a real source-backed functional gap is independently proven, documented, and approved as a separate domain change.

4. **No patch-stack CSS architecture.**
   - do not preserve the current simplified UI and layer overrides until it looks old.
   - replace or transplant presentation components cleanly.
   - remove superseded presentation code when the replacement is verified.
   - avoid arbitrary `!important`, duplicate desktop/mobile DOMs, or route-specific global CSS hacks.

5. **No silent feature invention.**
   - if the legacy UI depends on behavior that V2 does not own yet (for example runtime HomepageSettings), keep the legacy-looking default presentation and record the dynamic capability as a separate gap.
   - never fake a live backend owner or API.

## Allowed small improvements

Small improvements are allowed only when they preserve the recognizable legacy interface.

Allowed examples:
- accessibility labels/focus states;
- fixing overflow, clipping, broken RTL, touch targets or responsive bugs;
- reducing layout shift;
- image loading/performance improvements that do not change the visible image/crop;
- semantic HTML improvements;
- removing duplicated implementation code while preserving appearance;
- minor consistency fixes where legacy itself is visibly broken.

Not allowed without a separate explicit decision:
- changing the visual language;
- changing section order;
- replacing images merely for taste;
- changing typography scale because another scale appears more modern;
- removing legacy interactions;
- changing desktop density or container width without source evidence.

When uncertain: **match legacy first**.

## Evidence baseline

Evidence PR #100 captured and was merged before implementation.

Baseline evidence directory:
`docs/visual-baseline/exact-legacy-public-ui/`

It contains:
- desktop/tablet/mobile legacy and V2 screenshots;
- DOM/style measurements;
- section inventory;
- asset inventory;
- typography evidence;
- route map;
- dynamic behavior audit;
- detailed diff report.

Legacy screenshot snapshot:
`57ba4e8ad5550bbb00b09a82221afcab138bd597`

Latest legacy re-check before this plan:
`b93923cfdb1cd5bcb9bbb51e35422d1f9d52b400`

The delta after the screenshot snapshot affects Dashboard/Reports/skill-mastery files and does not change the public Landing contract. Re-check the latest legacy head before every implementation merge.

V2 baseline after evidence merge:
`df05ba39343a5c72eca925c167ef5239dd3bfe51`

## Implementation order

### Phase UI-0 — Evidence and operating contract
Status: **DONE**
- capture legacy/V2 public screenshots at 390 / 820 / 1440;
- inventory sections, assets, typography, routes and dynamic behavior;
- establish this plan as the handoff contract.

### Phase UI-1 — Shared visual foundation
Goal: establish reusable legacy-compatible presentation primitives without changing domain behavior.

Scope:
- Tajawal and typography scale;
- page/container widths and spacing tokens;
- legacy-compatible header and mobile navigation;
- legacy-compatible footer;
- buttons, badges, cards, chips and shared section heading patterns;
- auth modal visual shell where shared by public flows;
- required source-backed static assets.

Acceptance:
- header/footer states compared at 390 / 820 / 1440;
- mobile menu behavior preserved;
- no auth/backend contract change;
- no horizontal overflow.

### Phase UI-2 — Public landing exact transplant
Goal: replace the simplified V2 landing with the source-backed legacy landing composition.

Required source-backed presentation:
- announcement/badge treatment;
- hero typography and layout;
- interactive hero gallery/carousel and source-backed overlays;
- stats/metrics ribbon;
- featured learning/course presentation using V2 data where equivalent;
- featured articles/default fallback presentation where a V2 owner is available or a safe static presentation fallback is explicitly documented;
- why-choose layout;
- daylight/neon showcase switcher and complete source-backed asset set;
- legacy testimonial atmosphere;
- rich footer/CTA presentation.

Rules:
- visible values that imply live business truth must come from V2 APIs or be clearly static/default presentation data.
- do not label static demo values as live metrics.
- missing runtime HomepageSettings remains a documented capability gap unless separately implemented with a canonical V2 owner.

### Phase UI-3 — Learning experience parity
Priority: **HIGH**

The learning interfaces are explicitly protected product work.

Audit the corresponding legacy source before each page transplant and preserve its presentation and interaction model while binding to the already-implemented V2 Learning/Content APIs.

Current V2 route families include:
- `/learning`
- `/learning/courses/:courseId`
- `/review`
- `/review/practice`
- `/plan`
- `/assessments`
- `/assessment-assignments`
- assessment attempt/result routes
- `/reports`

For each page:
1. locate exact legacy route/component(s);
2. capture same-size legacy screenshot evidence if not already present;
3. identify all data/interaction dependencies;
4. map each dependency to an existing V2 client/API;
5. add a frontend adapter where DTOs differ;
6. transplant presentation;
7. preserve V2 authorization and owner-domain rules;
8. verify responsive and functional behavior.

Do not simplify learning cards, player layout, result/review composition, progress displays, navigation or study-plan presentation merely to fit the newer component style.

### Phase UI-4 — Learner workspace
Scope:
- student dashboard and its navigation;
- learner notifications/reporting entry states;
- preserve V2 data truth while matching source-backed legacy layout and density.

### Phase UI-5 — Role workspaces
Scope in audited slices:
- Teacher / Smart Classroom;
- Parent;
- School Director;
- Supervisor.

Existing V2 authorization remains server-authoritative. Visual parity must never reintroduce legacy privilege assumptions.

### Phase UI-6 — Admin/control panels
Scope:
- Admin shell;
- Content;
- Taxonomy;
- Question Bank;
- Assessment;
- Commerce;
- Notifications;
- Classroom contracts;
- AI;
- Reports;
- Operations.

The earlier dashboard responsive work remains functional evidence, but visual styling can be transplanted where the legacy source provides a stronger presentation contract.

### Phase UI-7 — Public/static/auth completeness
Scope:
- About / Contact / FAQ / Privacy / Terms;
- login/signup/forgot/reset/verify states;
- public 404;
- legacy route compatibility where justified by route map.

### Phase UI-8 — Cross-page visual certification and cleanup
Before staging:
- remove superseded temporary/simplified presentation code;
- verify no dead duplicate UI is left behind;
- verify exact route ownership and adapters;
- run full browser suite;
- capture deterministic 390 / 820 / 1440 checkpoints;
- compare against legacy source evidence;
- document every intentional remaining visual difference.

Only after this phase returns green do we resume External/Staging Provider Evidence.

## Frontend adapter rule

Preferred flow:

```ts
canonicalV2Response
  -> feature presentation adapter/view model
  -> transplanted legacy-looking component
```

Adapters may:
- rename fields;
- derive purely presentational labels;
- normalize empty/loading states;
- map current route IDs to presentation links;
- compose already-authorized data from the same frontend feature boundary.

Adapters must not:
- invent permissions;
- invent scores/mastery;
- invent prices/entitlements;
- expose hidden answer keys;
- recreate a second business-truth store;
- bypass server scoping.

## Dynamic legacy capabilities

The legacy UI includes dynamic presentation configuration such as HomepageSettings and platform-font controls.

Current rule:
- preserve the legacy default visual result;
- do not pretend that V2 currently has a canonical `/homepage/settings` API if it does not;
- presentation management becomes a separate source-backed V2 capability only if/when implemented intentionally.

Any diagram describing such an endpoint must be labeled **target/future**, not current V2 evidence.

## Asset rule

- copy only source-backed assets required for the transplanted UI;
- keep legacy repository read-only;
- store runtime-required assets in V2 so production does not depend on the legacy deployment;
- preserve original aspect ratio/crop behavior unless a documented responsive fix is required;
- record every copied asset in the visual certificate.

## Verification contract for every implementation slice

Before merge, the same exact documentation-inclusive SHA must pass:
- Database CI;
- Backend CI;
- Frontend CI;
- Frontend E2E.

Frontend E2E must include the changed user journey and meaningful negative/authorization coverage where applicable.

Visual evidence must include the affected breakpoints among:
- 390px phone;
- 820px tablet;
- 1440px desktop.

A green build or HTTP 200 is not visual parity.

## PR / merge discipline

For each official implementation batch:
1. start from latest `main`;
2. fetch latest legacy head;
3. read `docs/CURRENT_STATE.md`, `docs/PARITY_MATRIX.md`, `docs/WORKING_SET.md`, and this plan;
4. audit exact legacy source for the slice;
5. implement only source-backed UI/behavior;
6. add/update E2E and visual evidence;
7. update state/matrix/working-set/certificate;
8. run all four gates on the exact final head;
9. re-check latest legacy delta;
10. merge only when green;
11. use a separate closure-doc PR when required by the project closure discipline.

Never bypass or weaken tests to obtain green.

## Handoff rule for ChatGPT / Codex / Gemini / any future agent

Before doing work, the agent must state:
- current V2 main SHA;
- current legacy main SHA;
- active UI phase from this document;
- first incomplete route/surface;
- whether the intended change is presentation-only or proves a backend gap.

If an agent discovers a new gap, it must update the plan/state docs rather than silently changing direction.

## Definition of success

The site is ready for owner acceptance when:
- the user recognizes the legacy interface rather than a redesign;
- public, learning and role-workspace UI is source-backed and responsive;
- all functional journeys run on V2 APIs/backend;
- no legacy backend/runtime dependency is required;
- no major source-backed interaction is silently missing;
- remaining differences are documented and intentional;
- the exact final heads are green in CI/E2E;
- local owner acceptance can run from current `main`.

After owner acceptance, continue to External/Staging Provider Evidence and the remaining release gates.
