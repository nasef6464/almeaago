# Visual Measurement Report: Legacy vs V2 Baseline

## 1. Environment & Viewport Matrix

| Dimension | Legacy (ALMEAA CODAX) | V2 (ALMEAA Go) | Viewport Ratio |
|---|---|---|---|
| **Desktop** | 1440 x 1200 | 1440 x 1200 | 1.2 : 1 |
| **Tablet** | 820 x 1180 | 820 x 1180 | 0.69 : 1 |
| **Mobile** | 390 x 844 | 390 x 844 | 0.46 : 1 |

---

## 2. Desktop (1440px) Detailed DOM & Style Measurements

### Body & Containers
- **Legacy Body:** `width: 1440px`, `height: 5528px`, `background: rgb(249, 250, 251)` (`bg-gray-50`/`bg-white`), `font-family: Tajawal, Tajawal, sans-serif`.
- **Legacy Max Container:** `max-w-7xl` (`1280px`), centered (`mx-auto`), `padding: 0 1rem` (`px-4 sm:px-6 lg:px-8`).
- **V2 Body:** `width: 1440px`, `height: 4890px`, `background: rgb(255, 255, 255)`, `font-family: Tajawal, Tajawal, ui-sans-serif, system-ui`.
- **V2 Max Container:** `max-w-7xl` (`1280px`), centered (`mx-auto`), `padding: 0 1rem` (`px-4 sm:px-6 lg:px-8`).

### Header
- **Legacy Header:**
  - `height: 81px` (sticky, `top-0`, `z-50`)
  - `background: rgba(255, 255, 255, 0.95)` with backdrop blur `backdrop-blur-md`
  - `border-bottom: 1px solid #f3f4f6` (`border-gray-100`)
  - `box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05)`
  - Inner flex: `max-w-7xl mx-auto h-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between`
  - Logo container: `text-2xl font-black text-amber-500` + subtitle `text-xs font-bold text-gray-400`
  - Nav items: `gap: 2rem (8px on mobile/dropdown)`
  - CTA Button: `height: 42px`, `padding: 10px 16px`, `border-radius: 12px`, `bg-emerald-500`, `text-white font-bold`
- **V2 Header:**
  - `height: 72px` (sticky, `top-0`, `z-50`)
  - `background: rgb(255, 255, 255)`, `border-bottom: 1px solid #f3f4f6`
  - Logo container: `text-xl font-black text-amber-500`

### Hero Section
- **Legacy Hero:**
  - `height: 584px` (container), `padding: 48px 0px 96px` (`pt-12 pb-24`)
  - Background: `bg-gradient-to-b from-indigo-50/70 via-white to-white` with 3 animated blob orbs (`animate-blob`)
  - Grid: `flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-12`
  - Text Column (`lg:w-1/2`):
    - Badge: `padding: 8px 16px`, `border-radius: 9999px`, `bg-blue-50/90`, `border: 1px solid #dbeafe`, pinging beacon dot (`h-2.5 w-2.5 bg-blue-500`)
    - H1: `font-size: 72px` (`text-4xl sm:text-5xl lg:text-6xl xl:text-7xl`), `font-weight: 900`, `line-height: 1.18` (`85px`), `margin-bottom: 24px`
    - Subtitle: `font-size: 20px` (`text-lg sm:text-xl`), `color: rgb(75, 85, 99)`, `line-height: 1.625` (`32.5px`), `max-width: 42rem` (`max-w-2xl`)
    - CTA Group:
      - Primary CTA (`Zap` icon): `padding: 16px 32px`, `font-size: 18px font-black`, `border-radius: 16px` (`rounded-2xl`), `bg-amber-500`, `box-shadow: 0 10px 15px -3px rgba(245, 158, 11, 0.25)`
      - Secondary CTA (`BookOpen` icon): `padding: 16px 32px`, `font-size: 18px font-bold`, `border-radius: 16px`, `border: 1px solid #e5e7eb`, `bg-white`
    - Trust Row: `margin-top: 40px`, 3 items (`CheckCircle` emerald-500, `Star` amber-500), `font-size: 14px font-bold text-gray-500`
  - Image Column (`lg:w-1/2`):
    - Frame: `aspect-[3/2] sm:aspect-[3/2]`, `max-width: 32rem` (`max-w-lg`), `border-radius: 24px` (`rounded-3xl`), `border: 4px solid #ffffff`, `box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25)`
    - Gallery: Auto-rotating with carousel dots + prev/next navigation + interactive thumbnail strip (`56px x 38px` per thumb)
    - 4 Floating Cards:
      1. Rating Badge: `-top-5 -right-4`, `padding: 8px 14px`, `border-radius: 16px`, `shadow-xl`, avatars + `4.9 من 5` + badge `معتمد`
      2. Progress Card: `-bottom-6 -right-6`, `padding: 14px`, `max-width: 215px`, `rounded-2xl`, progress bar (`w-3/4 animate-pulse`), `جاهزية الاختبار 88%`
      3. A+ Badge: `top-14 -left-6`, `padding: 10px`, `rounded-2xl`, `bg-gradient-to-br from-amber-400 to-amber-500`, `A+` + `Sparkles`
      4. Achievement Strip: `bottom-20 -left-6`, `padding: 6px 12px`, `rounded-2xl`, `+15 درجة في القياس`

---

## 3. Tablet (820px) Detailed DOM & Style Measurements

- **Legacy Layout:**
  - Hero flex changes to column layout (`flex-col`), centered alignment.
  - H1 font size scales to `text-5xl` (`48px`).
  - Hero image width expands to `w-full max-w-md mx-auto`.
  - Floating cards adapt: Rating card `-top-3 -right-2`, Progress card `-bottom-4 right-2`.
  - Section grids transition: 3-column grids (`lg:grid-cols-3`) collapse to 2 columns (`md:grid-cols-2`).
  - Stat counters: `grid-cols-2` layout with `padding: 12px 14px`.

---

## 4. Mobile (390px) Detailed DOM & Style Measurements

- **Legacy Layout:**
  - Header: Collapses into top bar with hamburger menu toggle (`button[aria-label="قائمة"]`) and primary compact login CTA.
  - Mobile Menu Drawer: Slide-over or dropdown menu with full navigation routes and user state.
  - H1 font size: `text-4xl` (`36px`), `line-height: 1.2`.
  - Buttons: Full-width stacked buttons (`w-full flex-col sm:flex-row`).
  - Hero image frame: `aspect-[4/3]`, full width with `rounded-2xl`.
  - Thumbnails strip: Horizontally scrollable overflow (`overflow-x-auto`).
  - Cards: Single column (`grid-cols-1`).
  - Horizontal scroll check: `scrollWidth === innerWidth` (Zero overflow).

---

## 5. Spacing, Borders, and Radii Standard Reference

| UI Token | Legacy Value | Tailwind Class | Notes |
|---|---|---|---|
| Card Radius Large | `24px` | `rounded-3xl` | Showcase cards, course cards, hero frame |
| Card Radius Medium | `16px` | `rounded-2xl` | Floating badges, stat boxes, buttons |
| Pill Radius | `9999px` | `rounded-full` | Announcement banner, badges, category chips |
| Section Vertical Padding | `80px` | `py-20` | Paths, courses, articles, features, pillars |
| Hero Vertical Padding | `48px top, 96px bottom` | `pt-12 pb-24` | Gradient transition to white |
| Grid Gaps | `32px` desktop, `16px` mobile | `gap-8`, `sm:gap-6`, `gap-4` | Responsive grid rhythm |
