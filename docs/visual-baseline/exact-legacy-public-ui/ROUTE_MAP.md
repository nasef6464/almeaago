# Route Map and Call-to-Action (CTA) Inventory

This document maps all links, CTAs, navigation triggers, and interactive routes present in the legacy `almeaacodax` public landing page and its shared layout headers/footers, comparing them against the available routes in `almeaago` (V2).

---

## 1. Top Navigation Bar (Header)

| Element / Text | Legacy Href / Action | Expected V2 Destination | Equivalent V2 Route Exists? | Notes |
| :--- | :--- | :--- | :---: | :--- |
| **Brand Logo & Title** | `/` | `/` | **YES** | Navigates to home page. |
| **الرئيسية** (Home) | `/` | `/` | **YES** | Primary home link. |
| **المسارات التلقائية** (e.g. القدرات العامة) | `/category/:pathId` | `/learning` (or `/category/:pathId`) | **PARTIAL** | V2 has `/learning`. Does not have `/category/:id` public catalog page; maps conceptually to `/learning`. |
| **المستويات داخل المسار** (e.g. أول ثانوي) | `/category/:pathId?level=:levelId` | `/learning` | **PARTIAL** | Handled in V2 inside `/learning` workspace. |
| **المواد الدراسية** (e.g. كمي / لفظي) | `/category/:pathId?subject=:subjectId` | `/learning` | **PARTIAL** | Handled in V2 inside `/learning` workspace. |
| **اختبارات محاكية [للمسار]** | `/category/:pathId?tab=mock-exams` | `/assessments` | **YES** | V2 assessment availability page. |
| **عروض وباقات [للمسار]** | `/category/:pathId?tab=packages` | `/checkout` | **PARTIAL** | V2 offers `/checkout`. |
| **اختبارات محاكية** (Top Nav) | `/mock-exams` | `/assessments` | **YES** | V2 assessment catalog. |
| **العضويات / الباقات** (أخرى -> العضويات) | `/pricing` | `/checkout` | **NO** | V2 does not have a dedicated public `/pricing` landing route. |
| **المدونة** (أخرى -> المدونة) | `/blog` | N/A | **NO** | V2 does not currently have a `/blog` route. |
| **زر البحث** (Search Icon) | Opens `SearchModal` (Ctrl+K) | Search modal | **NO** | V2 does not yet have a global search modal on landing. |
| **سلة المشتريات** (Cart Icon) | `/cart` | `/checkout` | **PARTIAL** | V2 uses `/checkout` directly. |
| **تسجيل الدخول** (Login CTA) | Opens `isLoginModalOpen` or `/login` | `/login` (opens `AuthModal`) | **YES** | V2 has full AuthModal on `/login`. |
| **إنشاء حساب** (Signup CTA) | Opens `isLoginModalOpen` in signup mode | `/signup` (opens `AuthModal`) | **YES** | V2 has full AuthModal on `/signup`. |
| **حسابي -> لوحة التحكم** | `/dashboard` (or role-specific) | `/dashboard` | **YES** | When authenticated. |
| **حسابي -> دوراتي** | `/dashboard?tab=my-courses` | `/learning` | **YES** | Navigates to student learning area. |
| **حسابي -> اختباراتي** | `/my-quizzes` | `/assessment-results` | **YES** | Shows quiz history / attempts. |
| **حسابي -> الشهادات والإنجازات** | `/achievements` | `/dashboard` | **PARTIAL** | Achievements widget is in student dashboard. |
| **حسابي -> الملف الشخصي** | `/profile` | `/dashboard` | **PARTIAL** | Profile settings in V2. |
| **تسجيل الخروج** (Logout) | `logout()` -> redirect to `/?auth=login` | Auth state clear | **YES** | Clears session. |

---

## 2. Hero Section

| Element / Text | Legacy Href / Action | Expected V2 Destination | Equivalent V2 Route Exists? | Notes |
| :--- | :--- | :--- | :---: | :--- |
| **Announcement Banner Pill** | `activeAnnouncement.ctaUrl` (dynamic) | Depends on announcement | **YES** | e.g. `/checkout` or external link. |
| **Banner Close Button** | Local state dismiss (`setDismissedBannerAdId`) | In-memory / session dismiss | **YES** | UI dismissal only. |
| **Primary CTA** ("ابدأ التدريب مجانًا") | `homepageSettings.hero.primaryCtaLink` (`/dashboard`) | `/dashboard` | **YES** | Prompts login if unauthenticated, otherwise enters dashboard. |
| **Secondary CTA** ("تصفح مساحة التعلم" / "تصفح الدورات") | `homepageSettings.hero.secondaryCtaLink` (`/courses`) | `/learning` | **PARTIAL** | V2 uses `/learning` for course space instead of `/courses`. |
| **Tertiary CTA** (Optional) | `homepageSettings.hero.tertiaryCtaLink` | Dynamic target | **YES** | Usually anchor `#paths`. |
| **Floating Badge 1** (Rating: `4.9 ⭐`) | Smooth scroll `#testimonials` | `#testimonials` | **YES** | Anchor jump. |
| **Floating Badge 2** (Progress: `85%`) | Smooth scroll `#paths` | `#paths` | **YES** | Anchor jump. |
| **Floating Badge 3** (Achievement: `A+`) | Smooth scroll `#why-choose` | `#why-choose` | **YES** | Anchor jump. |
| **Floating Badge 4** (Students: `+15,000`) | Smooth scroll `#testimonials` | `#testimonials` | **YES** | Anchor jump. |
| **Hero Gallery Thumbnails** | Changes active hero image state (0..N) | In-page interactive state | **YES** | Image carousel switcher. |
| **Hero Next / Prev Arrows** | Cycles active hero image | In-page interactive state | **YES** | Carousel controls. |

---

## 3. Educational Paths Section ("كل ما تحتاجه للتفوق")

| Element / Text | Legacy Href / Action | Expected V2 Destination | Equivalent V2 Route Exists? | Notes |
| :--- | :--- | :--- | :---: | :--- |
| **بطاقة مسار القدرات** | `/category/p_qudrat` | `/learning` | **PARTIAL** | Navigates to path learning space. |
| **بطاقة مسار التحصيلي** | `/category/p_tahsili` | `/learning` | **PARTIAL** | Navigates to path learning space. |
| **بطاقة مسار نافس** | `/category/p_nafes` | `/learning` | **PARTIAL** | Navigates to path learning space. |
| **أي بطاقة مسار مخصصة** | `/category/:pathId` | `/learning` | **PARTIAL** | Dynamic based on active taxonomy. |

---

## 4. Featured Courses Section ("الدورات المميزة")

| Element / Text | Legacy Href / Action | Expected V2 Destination | Equivalent V2 Route Exists? | Notes |
| :--- | :--- | :--- | :---: | :--- |
| **رابط عرض الكل** | `/courses` | `/learning` | **PARTIAL** | Public courses catalog. |
| **زر معاينة الدورة** (Eye Icon) | `/course/:courseId` | `/learning/courses/:courseId` | **YES** | Course details view. |
| **زر شراء الدورة** (Cart / Enroll Icon) | `/course/:courseId?buy=1` | `/checkout` | **YES** | Initiates checkout for course. |

---

## 5. Featured Articles Section ("مقالات واستراتيجيات قياس")

| Element / Text | Legacy Href / Action | Expected V2 Destination | Equivalent V2 Route Exists? | Notes |
| :--- | :--- | :--- | :---: | :--- |
| **رابط استعرض جميع المقالات** | `/blog` | N/A | **NO** | No blog index in V2. |
| **بطاقة المقال** | Opens `ArticleReaderModal(article)` | In-place reading modal | **YES** | Modal opens in-page without navigation. |

---

## 6. Why Choose Section ("لماذا يختار الطلاب منصة المئة؟")

| Element / Text | Legacy Href / Action | Expected V2 Destination | Equivalent V2 Route Exists? | Notes |
| :--- | :--- | :--- | :---: | :--- |
| **زر ابدأ رحلة التفوق الآن** | `/dashboard` | `/dashboard` | **YES** | Primary registration / onboarding funnel. |

---

## 7. Showcase Pillars Section ("محطات التفوق الذكي في منصة المئة")

| Element / Text | Legacy Href / Action | Expected V2 Destination | Equivalent V2 Route Exists? | Notes |
| :--- | :--- | :--- | :---: | :--- |
| **تبويب الاستوديو النهاري** | In-page tab toggle (`pack: 'daylight'`) | Local state change | **YES** | Client-side tab toggle. |
| **تبويب النمط السيبراني** | In-page tab toggle (`pack: 'neon'`) | Local state change | **YES** | Client-side tab toggle. |
| **محطة بطل القدرات** | `/category/p_qudrat` | `/learning` | **PARTIAL** | Path learning space. |
| **محطة شعلة التحصيلي** | `/category/p_tahsili` | `/learning` | **PARTIAL** | Path learning space. |
| **محطة محاكاة قياس** | `/mock-exams` | `/assessments` | **YES** | Mock exams assessment catalog. |
| **محطة المساعد الذكي AI** | `/dashboard` | `/dashboard` | **YES** | Directs to interactive student dashboard. |
| **محطة طريق الـ 100%** | `/pricing` | `/checkout` | **PARTIAL** | Subscriptions / checkout funnel. |
| **محطة حلبة الفصول والمدارس** | `/admin-dashboard?tab=schools` | `/school-teacher-dashboard` or `/admin-dashboard/classroom` | **YES** | School and classroom hub. |

---

## 8. Footer

| Element / Text | Legacy Href / Action | Expected V2 Destination | Equivalent V2 Route Exists? | Notes |
| :--- | :--- | :--- | :---: | :--- |
| **من نحن** (About) | `/about` | `/about` | **YES** | Static info page. |
| **تواصل معنا** (Contact) | `/contact` | `/contact` | **YES** | Static info page. |
| **الأسئلة الشائعة** (FAQ) | `/faq` | `/faq` | **YES** | Static info page. |
| **سياسة الخصوصية** (Privacy) | `/privacy` | `/privacy` | **YES** | Static info page. |
| **الشروط والأحكام** (Terms) | `/terms` | `/terms` | **YES** | Static info page. |
| **WhatsApp Floating Widget** | `https://wa.me/:number?text=...` | External WhatsApp link | **YES** | External contact link. |

---

## 9. Authentication Modals (Login / Signup)

| Element / Text | Legacy Href / Action | Expected V2 Destination | Equivalent V2 Route Exists? | Notes |
| :--- | :--- | :--- | :---: | :--- |
| **نسيت كلمة المرور؟** | `/forgot-password` | `/forgot-password` | **YES** | V2 has `/forgot-password`. |
| **رابط الشروط في التسجيل** | `/terms` | `/terms` | **YES** | Static info page. |
| **رابط الخصوصية في التسجيل** | `/privacy` | `/privacy` | **YES** | Static info page. |
| **المتابعة باستخدام جوجل** | `signInWithGoogle()` | OAuth initiation | **YES** | Firebase / Google OAuth handler. |
| **الدخول بواتساب / OTP** | OTP trigger via phone | WhatsApp / SMS OTP flow | **PARTIAL** | Depends on backend OTP provider. |

---

## Summary of Route Parity Gaps

1. **Missing Public Routes in V2:**
   - `/blog`: Legacy has blog articles archive; V2 currently has no public blog route.
   - `/pricing`: Legacy has dedicated pricing comparison page; V2 currently routes pricing intents to `/checkout`.
   - `/category/:pathId`: Legacy has full public path landing pages (`GenericPathPage`); V2 combines this into `/learning`.
2. **Fully Matched Routes:**
   - `/` (Home)
   - `/dashboard` (Student Dashboard)
   - `/about`, `/contact`, `/faq`, `/privacy`, `/terms` (Static Pages)
   - `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` (Auth Pages & Modals)
   - `/checkout` (Commerce / Payment)
   - `/assessments` (Mock Exams / Quizzes)
   - `/school-teacher-dashboard`, `/supervisor-dashboard`, `/school-director-dashboard`, `/admin-dashboard`
