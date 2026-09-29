# Exact Legacy Public UI Parity Baseline

```text
LEGACY SHA:
57ba4e8ad5550bbb00b09a82221afcab138bd597

V2 SHA:
a1a6c2ad5a414b12812fd4a8c1d573b6fec3fd66

LEGACY URL USED:
http://localhost:3000

V2 URL USED:
http://localhost:5173

BROWSER:
Chromium / Playwright Engine (Headless)

VIEWPORTS:
390 / 820 / 1440

PUBLIC UI EXACT MATCH:
NO

EVIDENCE STATUS:
COMPLETE
```

---

## Overview

This directory contains the complete **Evidence and Reference Baseline Pack** created to guide the exact 1-to-1 visual and interactive transplantation of the legacy public user interface (`almeaacodax`) into the new Go/React platform (`almeaago`).

### Operating Guidelines Enforced During Baseline Generation:
- **Zero Source Code Changes in `almeaago`**: No edits were made to `apps/`, `cmd/`, `internal/`, `migrations/`, `api/`, `go.mod`, or `package.json`.
- **Legacy Repository is Strictly Read-Only**: `almeaacodax` was cloned and executed locally without any modifications, commits, or pushes.
- **Full Parity Artifacts**: Precise DOM measurements, typography computations, responsive layout dimensions, dynamic props catalog, asset matrix, and route tables were systematically extracted using automated browser instrumentation.

---

## Directory Contents

### Detailed Specification Reports

1. [**`MEASUREMENTS.md`**](file:///c:/almeaago/almeaago/docs/visual-baseline/exact-legacy-public-ui/MEASUREMENTS.md)
   - Layout widths, main container max-widths, section paddings, card sizes, border radiuses, and grid specifications across Desktop (1440px), Tablet (820px), and Mobile (390px).

2. [**`SECTION_INVENTORY.md`**](file:///c:/almeaago/almeaago/docs/visual-baseline/exact-legacy-public-ui/SECTION_INVENTORY.md)
   - Top-to-bottom inventory of all 10 visual sections in `almeaacodax/pages/Landing.tsx` and layout shells:
     1. Announcement Pill Banner
     2. Hero Section & Interactive Showcase (with 4 floating KPI cards)
     3. Compact Live Stats & Counters Bar
     4. Educational Paths Section (`OrganicCard`)
     5. Featured Courses Section
     6. Featured Articles & Strategies Section (`ArticleReaderModal`)
     7. Why Choose Section (SaaS metrics + 6 Feature cards)
     8. Showcase Pillars (Daylight 3D vs. Cyberpunk Neon tab switcher)
     9. Testimonials Section (Glassmorphism success stories)
     10. Site Header & Footer

3. [**`ASSET_INVENTORY.md`**](file:///c:/almeaago/almeaago/docs/visual-baseline/exact-legacy-public-ui/ASSET_INVENTORY.md)
   - Matrix of all 28 images, icons, and illustrations used on the landing page, documenting their filenames, paths, display contexts, and parity status in V2.

4. [**`TYPOGRAPHY.md`**](file:///c:/almeaago/almeaago/docs/visual-baseline/exact-legacy-public-ui/TYPOGRAPHY.md)
   - Computed typography measurements including font family (`Tajawal`), weights (400, 700, 900), font sizes, line heights, letter spacing, and gradient color stops for Hero, Sections, Cards, Buttons, Navigation, and Footer across all three viewports.

5. [**`DYNAMIC_BEHAVIOR.md`**](file:///c:/almeaago/almeaago/docs/visual-baseline/exact-legacy-public-ui/DYNAMIC_BEHAVIOR.md)
   - Exhaustive audit of all dynamic and configurable behaviors: `HomepageSettings` schema, API data sources, fallback states, carousel rotation timers, hover animations, modal triggers, and admin customizability.

6. [**`DIFF_REPORT.md`**](file:///c:/almeaago/almeaago/docs/visual-baseline/exact-legacy-public-ui/DIFF_REPORT.md)
   - Exact side-by-side pixel and structural comparison between legacy and V2 across every section, categorizing differences into `MISSING_IN_V2`, `EXTRA_IN_V2`, `SIZE_MISMATCH`, `TYPOGRAPHY_MISMATCH`, `COLOR_MISMATCH`, and `DYNAMIC_BEHAVIOR_MISSING`.

7. [**`ROUTE_MAP.md`**](file:///c:/almeaago/almeaago/docs/visual-baseline/exact-legacy-public-ui/ROUTE_MAP.md)
   - Complete mapping of all legacy links, buttons, CTAs, and navigation triggers to their respective V2 destinations and parity availability.

8. **`measurements_extracted.json`**
   - Raw JSON capture of all browser-computed styles and DOM rects directly extracted from headless Chromium.

---

## Screenshots Directory (`screenshots/`)

Contains **26 high-resolution PNG captures**:

### Viewport Pair Comparisons (Legacy vs. V2)

| Viewport | Legacy Viewport Screenshot | Legacy Full Page Screenshot | V2 Viewport Screenshot | V2 Full Page Screenshot |
| :--- | :--- | :--- | :--- | :--- |
| **Desktop 1440x1200** | `legacy_home_desktop_1440.png` | `legacy_home_desktop_1440_full.png` | `v2_home_desktop_1440.png` | `v2_home_desktop_1440_full.png` |
| **Tablet 820x1180** | `legacy_home_tablet_820.png` | `legacy_home_tablet_820_full.png` | `v2_home_tablet_820.png` | `v2_home_tablet_820_full.png` |
| **Mobile 390x844** | `legacy_home_mobile_390.png` | `legacy_home_mobile_390_full.png` | `v2_home_mobile_390.png` | `v2_home_mobile_390_full.png` |

### Legacy Interaction States

- **Header Normal**: `legacy_header_normal.png`
- **Header After Scroll**: `legacy_header_scrolled.png`
- **Mobile Menu Open**: `legacy_mobile_menu_open.png`
- **Hero Section**: `legacy_hero.png`
- **Hero CTA Hover**: `legacy_hero_cta_hover.png`
- **Courses Section**: `legacy_courses_section.png`
- **Features Section**: `legacy_features.png`
- **Live Stats Bar**: `legacy_stats.png`
- **Testimonials Section**: `legacy_testimonials.png`
- **Articles Section**: `legacy_articles.png`
- **Pricing & Showcase Section**: `legacy_pricing_cta.png`
- **Footer**: `legacy_footer.png`
- **Login Modal**: `legacy_login_modal.png`
- **Signup Modal**: `legacy_signup_modal.png`
