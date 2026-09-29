# Exact Legacy Public UI Transplant — UI-1 / UI-2 Certificate

Status: **TESTED / MERGED**

Authoritative plan:
`docs/visual-baseline/EXACT_LEGACY_UI_TRANSPLANT_PLAN.md`

Baseline evidence:
`docs/visual-baseline/exact-legacy-public-ui/`

## Scope

This batch implements the first two active phases:

- **UI-1 Shared visual foundation**
- **UI-2 Public landing exact transplant**

It replaces the simplified V2 public presentation with a source-backed transplant taken directly from the read-only legacy frontend, while keeping the current V2 backend/domain contracts authoritative.

## Source evidence used

Legacy repository: `nasef6464/almeaacodax`

Visual/source snapshot captured by evidence PR #100:
`57ba4e8ad5550bbb00b09a82221afcab138bd597`

Latest legacy re-check for this implementation:
`b93923cfdb1cd5bcb9bbb51e35422d1f9d52b400`

The delta from the screenshot/source snapshot to the latest legacy head changes Dashboard/Reports/skill-mastery files only. It does **not** change:
- `pages/Landing.tsx`
- `components/Header.tsx`
- `components/MainLayout.tsx`
- `data/defaultArticles.ts`
- the public Landing image set used here.

Primary source files read directly during implementation:
- `pages/Landing.tsx`
- `components/Header.tsx`
- `components/MainLayout.tsx`
- `data/defaultArticles.ts`

Antigravity evidence remains a measurement/checkpoint aid; the implementation presentation was taken from the legacy source itself rather than reconstructed only from screenshots.

## Presentation transplanted

The V2 public surface now restores the legacy presentation contract for:

- Tajawal-first typography and `max-w-7xl` geometry.
- legacy-compatible sticky public header and full-screen mobile navigation.
- legacy hero geometry:
  - `pt-12 pb-24`
  - 4xl/5xl/6xl/7xl responsive headline scale
  - `leading-[1.18]`
  - amber primary action treatment
  - source-backed multi-image gallery
  - auto rotation
  - hover pause
  - previous/next controls
  - pagination dots
  - thumbnail strip
  - floating hero overlays.
- dedicated dark statistics/capability ribbon.
- source-backed Taxonomy path cards from the public V2 taxonomy bootstrap.
- legacy course-card-shaped public presentation area.
- source-backed built-in article cards and in-place article reader modal.
- legacy split Why Choose composition and six feature cards.
- complete Daylight/Neon showcase switcher.
- legacy dark testimonial atmosphere with glass cards.
- richer multi-column public footer.
- reduced-motion-safe equivalents of the legacy floating/blob motion.

## Runtime assets copied into V2

The following legacy runtime assets were copied into `apps/web/public/images/` so V2 does not depend on a legacy deployment:

- `daylight-ai-tutor.webp`
- `daylight-celebration-100.webp`
- `daylight-school-arena.webp`
- `qudrat-champion.webp`
- `tahsili-excellence.webp`
- `mock-exam-simulation.webp`
- `ai-smart-tutor.webp`
- `score-celebration.webp`
- `classroom-arena.webp`

The five previously copied legacy landing assets remain reused:
- `homepage-hero-boy-platform.webp`
- `smart-learning-tablet.webp`
- `daylight-qudrat-math.webp`
- `daylight-tahsili-science.webp`
- `daylight-mock-simulation.webp`

## V2 backend / data boundary

No Go, PostgreSQL, Redis, migration, auth, RBAC, scoring, Commerce, Assessment, Media, AI or owner-domain contract changed.

The frontend follows:

```
legacy-looking presentation
        ↓
V2 frontend route/data adapter
        ↓
existing V2 API / auth contract
```

Concrete examples:
- path cards use public `/api/v1/taxonomy/bootstrap?phase=core`;
- learning/assessment/showcase CTAs map to current V2 routes instead of restoring legacy backend routes;
- authenticated dashboard destinations still use the canonical role dashboard resolver.

## Explicit non-fabrication boundaries

The legacy runtime-managed HomepageSettings/PlatformFontSettings owner is **not** fabricated in V2.

Therefore this batch preserves the legacy default visual presentation but does not claim:
- a current V2 HomepageSettings persistence API;
- live admin editing of hero text/colors/gallery;
- legacy marketing announcement ownership.

The old Landing also displayed live-looking public business counters and course price/rating/audience fields that current V2 does not expose through a canonical guest public catalog contract.

To avoid inventing business truth:
- the dark stats ribbon uses public taxonomy-backed counts/capability labels instead of invented student/rating totals;
- the course-shaped cards are explicitly labeled as presentation previews and do not invent price, entitlement or live audience counts;
- real payment/access authority remains Commerce-owned when a real checkout journey begins.

These are intentional data-boundary deviations, not redesign choices.

## Browser / E2E evidence

Pre-documentation candidate:
`671ac48b76507bc204f0b9200e0f66021fffbe46`

Passed:
- Frontend CI: run `36613429864`
- Frontend E2E: run `36613429627` — **76/76**

E2E artifact:
- ID `11054736391`
- SHA256 `436ca62d619095a196b5c9dbe416dd51cf7e1a213aeb5937d7fd9604397c4c9a`

Browser evidence includes:
- public Landing 1440 desktop;
- public Landing 820 tablet;
- public Landing 390 mobile;
- mobile navigation-open behavior;
- no-horizontal-overflow assertions;
- Daylight → Neon interactive switch;
- existing Student/Admin/Supervisor regression coverage.

## Remaining exact-UI sequence

After the documentation-inclusive implementation SHA passes all four required gates and this PR merges:

1. separate closure-doc PR records the final implementation evidence;
2. start **UI-3 Learning experience parity**;
3. preserve the invested legacy Learning interfaces by direct source transplant over V2 Learning/Content APIs;
4. then proceed through learner workspace, role workspaces, control panels, public/auth completeness and final cross-page visual certification.

This certificate does **not** claim `PARITY_PROVEN`.


## Final implementation closure

PR #102 final documentation-inclusive head:
`092e6031814311145fb8de94e2109bfef042bc8d`

Required gates on that exact head:
- Database CI `36614045042` — PASS
- Backend CI `36614044782` — PASS
- Frontend CI `36614045115` — PASS
- Frontend E2E `36614044693` — PASS (**76/76**)

Final browser evidence artifact:
- ID `11053883839`
- SHA256 `76a0c7184ba0192b7b906d07138005feecd1305c8916779545737372109c9515`

Final pre-merge legacy re-check:
`b93923cfdb1cd5bcb9bbb51e35422d1f9d52b400`

No newer legacy delta existed at merge time.

PR #102 squash merge:
`9e60ec3fd2de52c07d999c6ffb51309035d0f4c9`

Closure status: **TESTED / MERGED**, not `PARITY_PROVEN`.
The next active phase is **UI-3 Learning experience parity**.
