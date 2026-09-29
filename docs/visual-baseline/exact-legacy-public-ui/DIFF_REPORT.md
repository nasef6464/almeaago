# Pixel & Architecture Diff Report: Legacy vs V2

Direct side-by-side comparison of DOM measurements, styles, layout geometry, and missing capabilities between the Legacy platform (`almeaacodax`) and V2 (`almeaago`).

---

## 1. Section-by-Section Metric Comparison (Desktop 1440px)

### HEADER
- **Old Width:** `1440px` (Container `1280px` / `max-w-7xl`)
- **New Width:** `1440px` (Container `1280px` / `max-w-7xl`)
- **Old Height:** `81px` (`h-20` + `1px` border)
- **New Height:** `81px` (`h-20` + `1px` border)
- **Old Font:** `Tajawal, Tajawal, ui-sans-serif, system-ui`
- **New Font:** `Tajawal, Tajawal, Tajawal, ui-sans-serif, system-ui, sans-serif`
- **Old Spacing:** `gap-8` (`32px`) navigation links, `px-4 sm:px-6 lg:px-8` container
- **New Spacing:** `gap-6` (`24px`) navigation links, `px-4 sm:px-6 lg:px-8` container
- **Old Header Actions:** Logo + Navigation Links + Cart Icon (`ShoppingCart`) + Dark Mode Toggle + Auth buttons.
- **New Header Actions:** Logo + Navigation Links + Auth button ("تسجيل الدخول").

### HERO SECTION
- **Old Width:** `1440px` (Outer wrapper), Content grid: `1216px`
- **New Width:** `1440px` (Outer wrapper), Content grid: `1216px`
- **Old Height:** `584px` container (`pt-12 pb-24`)
- **New Height:** `583px` container
- **Old Font (H1):** `font-size: 72px` (`text-7xl`), `font-weight: 900`, `line-height: 85px` (`1.18`), `margin-bottom: 24px`
- **New Font (H1):** `font-size: 60px` (`text-6xl`), `font-weight: 900`, `line-height: 60px` (`1.0`), `margin-top: 20px`
- **Old Spacing:** `pt-12 pb-24` (`padding: 48px 0px 96px`), `gap-10 lg:gap-12` between text and media
- **New Spacing:** `pt-8 pb-16`, `gap-8`
- **Old Media Frame:** 
  - Size: `aspect-[3/2] sm:aspect-[3/2]` inside `max-w-lg` (`512px`)
  - Border & Shadow: `border-4 border-white`, `shadow-2xl`
  - Interactive Gallery: Auto-rotation, pause on hover, arrows, pagination dots, interactive thumbnail strip (`56x38px` per thumb).
  - Floating Elements: 4 dynamic cards (Rating `4.9/5`, Progress `88%`, `A+` Badge, Achievement `+15 درجة`).
- **New Media Frame:**
  - Size: `w-full max-w-md aspect-video`
  - Static single image without thumbnail strip or floating interactive overlays.

### STATS / METRICS BAR
- **Old Status:** Full-width high-contrast banner (`bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950`) with SVG particle grid and 4 live counter cards (`+15,000 طالب متفوق`, `4.9 ⭐ تقييم المنصة`, `12+ دورة معتمدة`, `3,000+ سؤال وتمرين`).
- **New Status:** Inlined within Why Choose cards or missing dedicated dark metric bar.

### COURSES SECTION
- **Old Status:** Present on landing (`py-20 bg-white`), displaying top 3 featured courses with prices, discounts, ratings, student counters, and dual action buttons ("معاينة", "شراء").
- **New Status:** Not rendered on V2 landing page (links to `/learning` instead).

### ARTICLES SECTION
- **Old Status:** Present on landing (`py-20 bg-slate-50`), displaying 3 educational strategy articles with reading time, category chips, author info, and direct reading modal (`ArticleReaderModal`).
- **New Status:** Not rendered on V2 landing page.

### WHY CHOOSE / FEATURES SECTION
- **Old Width:** `1440px` (Container `1216px`)
- **New Width:** `1440px` (Container `1216px`)
- **Old Height:** `688px`
- **New Height:** `520px`
- **Old Structure:** Split view (`lg:w-5/12` trust metrics + 3 checklist guarantees vs `lg:w-7/12` 6 high-conversion feature cards).
- **New Structure:** Centered heading with 6 grid cards (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`).

### SHOWCASE PILLARS SECTION
- **Old Status:** Present (`py-20 bg-gradient-to-b from-white via-indigo-50/30 to-white`), with interactive Day/Night mode tab switcher (`☀️ استوديو المئة النهاري 3D` vs `🌙 النمط السيبراني الليلي`) showcasing 6 cards with badges, subtitles, descriptions, and CTA links.
- **New Status:** Present in simplified format (4 cards displayed statically without Day/Night switcher or full text descriptions).

### TESTIMONIALS SECTION
- **Old Width:** `1440px` (Dark navy gradient `bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-950 text-white`)
- **New Width:** `1440px` (Light gray background `bg-white / bg-gray-50`)
- **Old Height:** `460px`
- **New Height:** `340px`
- **Old Card Style:** Glassmorphism (`bg-white/[0.07] backdrop-blur-xl border-white/10`), decorative large quote watermark, degree chip (e.g. `99% قدرات` with `Trophy`), 5 gold stars, student avatar with green verification badge.
- **New Card Style:** Light border cards (`border-gray-100 bg-white`).

### FOOTER
- **Old Width:** `1440px`, Height: `320px` (Rich 4-column footer with brand statement, quick links, contact info, newsletter, social links, copyright).
- **New Width:** `1440px`, Height: `101px` (Compact single-row footer with 5 horizontal links and copyright).

---

## 2. Parity Discrepancy Breakdown

### MISSING_IN_V2
1. **Interactive Hero Carousel:** Auto-rotating image slideshow with hover freeze, arrow buttons, pagination dots, and thumbnail navigation strip.
2. **Floating Hero Overlay Cards:** Rating card (`4.9/5`), Progress card (`جاهزية 88%`), `A+` badge, and Achievement strip (`+15 درجة`).
3. **Announcement Pill Banner:** Active promotional banner at top of Hero with pulse animation and dismiss trigger.
4. **Dedicated Dark Stats Bar:** High-contrast live counter ribbon (`4.9 ⭐`, `15,000+`, etc.).
5. **Featured Courses Section:** Top courses display with price badges, ratings, and checkout links.
6. **Featured Articles Section:** Measurement and strategy articles grid with `ArticleReaderModal`.
7. **Pillars Day/Night Switcher:** Interactive tab button toggling between Daylight 3D and Neon Cyber showcase packs.
8. **Dark Testimonials Atmosphere:** Premium dark gradient styling with glassmorphism cards and degree achievement badges.
9. **Rich Multi-column Footer:** Comprehensive footer with about text, categories, contact channels, and legal links.

### EXTRA_IN_V2
1. Simplified placeholder text and condensed feature cards.

### SIZE_MISMATCH
- **Hero H1:** Legacy is `72px` (`text-7xl`); V2 is `60px` (`text-6xl`).
- **Hero Vertical Padding:** Legacy is `pt-12 pb-24` (`144px` total); V2 is `pt-8 pb-16` (`96px` total).
- **Page Total Height:** Legacy full DOM is `5528px`; V2 current DOM is `3607px` (due to missing courses, articles, and dark stats bar).

### TYPOGRAPHY_MISMATCH
- **Weights:** Legacy relies on `font-black` (`900`) for all primary headings, giving bold visual hierarchy; V2 uses `font-bold` (`700`) on several titles.
- **Line Heights:** Legacy H1 has `leading-[1.18]` (`85px`) allowing multiline Arabic text to breathe without collision; V2 H1 is tighter at `leading-none` or `leading-tight`.

### COLOR_MISMATCH
- **Hero Background:** Legacy has gentle multi-color blob ambient illumination (`amber-200/40`, `blue-200/40`, `purple-200/40`); V2 is a plain linear gradient.
- **Testimonials Section:** Legacy is rich dark navy (`indigo-950`); V2 is white/light gray.
- **Stats Bar:** Legacy is dark slate/indigo (`slate-950 via-indigo-950`); V2 is absent.

### SPACING_MISMATCH
- Legacy sections consistently employ `py-20` (`80px` top and bottom) creating clean breathing space between dense educational content; V2 uses smaller or varying paddings (`py-12` / `py-16`).

### DYNAMIC_BEHAVIOR_MISSING
- Dynamic retrieval of `HomepageSettings` from database.
- Ability to toggle sections or adjust text/colors from the Admin Dashboard.
- Live calculation of student counts and asset statistics from PostgreSQL.
