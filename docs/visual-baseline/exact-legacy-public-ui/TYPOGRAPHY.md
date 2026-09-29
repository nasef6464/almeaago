# Typography Audit Report: Legacy vs V2 Baseline

## 1. Font Family Verification

- **Primary Font:** `Tajawal` (Google Fonts Arabic geometric sans-serif)
- **Fallback Font Stack:** `Tajawal, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Computed Font Family on DOM:**
  - Legacy `body`: `Tajawal, Tajawal, sans-serif`
  - V2 `body`: `Tajawal, Tajawal, ui-sans-serif, system-ui, sans-serif`
  - Computed Status: **LOADED & ACTIVE** on both platforms.

---

## 2. Weights in Active Use

| Font Weight Token | Numeric Weight | Legacy Use Cases | V2 Use Cases |
|---|---|---|---|
| `Light` | `300` | Subtitle notes, subtle meta indicators | In bundle |
| `Regular` | `400` | Body text, card descriptions, footers | Body text, footer notes |
| `Medium` | `500` | Article excerpts, test quote text | Card text |
| `Bold` | `700` | Navigation items, badges, card authors | Navigation links, badges |
| `Extrabold` | `800` | Section subheadings, stat numbers | Section subheadings |
| `Black` | `900` | Hero H1, Section H2, Primary CTAs, Logo | Hero H1, Section H2, CTAs |

---

## 3. Computed Typography Metrics Across Viewports

### Desktop (1440px)

| Element / Selector | Font Size | Font Weight | Line Height | Color | Spacing / Tracking |
|---|---|---|---|---|---|
| **Hero H1** | `72px` (`text-7xl`) | `900` | `85px` (`1.18`) | `rgb(17, 24, 39)` + Gradient | `tracking-tight` (`-0.025em`) |
| **Hero Paragraph** | `20px` (`text-xl`) | `400` | `32.5px` (`leading-relaxed`) | `rgb(75, 85, 99)` | `max-w-2xl mx-0` |
| **Section H2** | `36px` (`text-4xl`) | `900` | `40px` (`leading-tight`) | `rgb(17, 24, 39)` | `mb-4 tracking-tight` |
| **Section Subtitle** | `16px` (`text-base`) | `400` | `24px` | `rgb(107, 114, 128)` | `max-w-2xl mx-auto` |
| **Card Title (H3)** | `18px` (`text-lg`) | `900` | `28px` | `rgb(15, 23, 42)` | `mb-1.5` |
| **Card Body (P)** | `12px` (`text-xs`) | `400` | `18px` (`leading-relaxed`) | `rgb(100, 116, 139)` | `line-clamp-3` |
| **Navigation Links** | `14px` (`text-sm`) | `700` | `20px` | `rgb(55, 65, 81)` | `hover:text-indigo-600` |
| **Primary CTA Button** | `18px` (`text-lg`) | `900` | `28px` | `rgb(255, 255, 255)` | `px-8 py-4 rounded-2xl` |
| **Secondary CTA Button** | `18px` (`text-lg`) | `700` | `28px` | `rgb(31, 41, 55)` | `px-8 py-4 rounded-2xl` |
| **Footer Links** | `14px` (`text-sm`) | `500` | `20px` | `rgb(107, 114, 128)` | `hover:text-gray-900` |

---

### Tablet (820px)

| Element / Selector | Font Size | Font Weight | Line Height | Color | Spacing / Tracking |
|---|---|---|---|---|---|
| **Hero H1** | `48px` (`text-5xl`) | `900` | `56px` (`1.16`) | `rgb(17, 24, 39)` + Gradient | `tracking-tight` |
| **Hero Paragraph** | `18px` (`text-lg`) | `400` | `28px` | `rgb(75, 85, 99)` | `text-center mx-auto` |
| **Section H2** | `30px` (`text-3xl`) | `900` | `36px` | `rgb(17, 24, 39)` | `mb-3` |
| **Card Title (H3)** | `18px` (`text-lg`) | `900` | `26px` | `rgb(15, 23, 42)` | `mb-1.5` |
| **Primary CTA Button** | `16px` (`text-base`) | `900` | `24px` | `rgb(255, 255, 255)` | `px-6 py-3.5` |
| **Navigation** | `14px` (`text-sm`) | `700` | `20px` | `rgb(55, 65, 81)` | `compact header` |

---

### Mobile (390px)

| Element / Selector | Font Size | Font Weight | Line Height | Color | Spacing / Tracking |
|---|---|---|---|---|---|
| **Hero H1** | `36px` (`text-4xl`) | `900` | `42px` (`1.17`) | `rgb(17, 24, 39)` + Gradient | `tracking-tight` |
| **Hero Paragraph** | `16px` (`text-base`) | `400` | `26px` | `rgb(75, 85, 99)` | `text-center` |
| **Section H2** | `24px` (`text-2xl`) | `900` | `32px` | `rgb(17, 24, 39)` | `mb-2 text-center` |
| **Card Title (H3)** | `16px` (`text-base`) | `900` | `24px` | `rgb(15, 23, 42)` | `mb-1` |
| **Primary CTA Button** | `16px` (`text-base`) | `900` | `24px` | `rgb(255, 255, 255)` | `w-full py-3.5 text-center` |
| **Secondary CTA Button**| `16px` (`text-base`) | `700` | `24px` | `rgb(31, 41, 55)` | `w-full py-3.5 text-center` |
| **Mobile Drawer Nav** | `16px` (`text-base`) | `700` | `24px` | `rgb(31, 41, 55)` | `py-3 px-4 border-b` |

---

## 4. Typography Observations & Parity Guidelines

1. **Heading Weight Consistency:** Legacy headings strictly apply weight `900` (`font-black`) to `h1` and `h2`, creating a distinctive, authoritative modern look that distinguishes platform branding from generic educational sites.
2. **Text Gradients:** The word "المئة في" in the Hero title utilizes CSS `background-clip: text` with a 3-stop gradient: `from-blue-600 via-indigo-600 to-purple-600` (`#2563eb` -> `#4f46e5` -> `#9333ea`).
3. **Arabic Punctuation & Quotes:** Quotes in the testimonials section use decorative oversized English quote marks (`Quote` icon at 52px) as visual accents while rendering Arabic text in RTL inside curly quotation marks (`"..."`).
