# Landing Page Section Inventory (Ordered from Top to Bottom)

Source File Reference: `almeaacodax/pages/Landing.tsx` (Total Lines: 1,502)

---

## 1. Announcement Pill Banner

- **Section Name:** `AnnouncementPillBanner`
- **Source Lines:** `Landing.tsx:632-665`
- **Visible Title:** Dynamic from active announcement (`activeAnnouncement.title`) e.g. "خصم خاص على باقة التفوق السنوية"
- **Visible Subtitle:** N/A (single inline pill)
- **Images Used:** None (uses `Megaphone`, `X`, `ArrowLeft` Lucide icons)
- **Data Source:** `announcementAds` store/API (`state.announcementAds`)
- **Dynamic/Static:** Dynamic (falls back to hidden if dismissed or no active ads)
- **Interactive Behavior:** 
  - Dismiss button (`X` icon) stores dismissed ID in session/local state (`dismissedBannerAdId`).
  - Ping beacon animation (`animate-ping`).
  - Hover border brightness effect.
- **Route / CTA:** Dynamic link (`activeAnnouncement.ctaUrl`, label: `activeAnnouncement.ctaLabel || 'تفاصيل'`)
- **Depends on HomepageSettings:** No (managed via Announcements/Marketing system)
- **Depends on API:** Yes (fetch active announcement ads)
- **Mobile Behavior:** Centered on mobile (`justify-center lg:justify-start`), text truncates gracefully with ellipsis.

---

## 2. Hero Section & Interactive Showcase

- **Section Name:** `HeroSection`
- **Source Lines:** `Landing.tsx:624-915`
- **Visible Title:** `حقق المئة في اختباراتك` (Prefix: "حقق", Highlight: "المئة في", Suffix: "اختباراتك")
- **Visible Subtitle:** "رحلة تعليمية ذكية تجمع بين التدريب المكثف، الشروحات التفاعلية، والتحليل الدقيق لنقاط ضعفك لضمان أعلى الدرجات."
- **Images Used:**
  - Primary Hero Image: `/images/homepage-hero-boy-platform.webp`
  - Gallery presets:
    - `/images/smart-learning-tablet.webp`
    - `/images/daylight-qudrat-math.webp`
    - `/images/daylight-tahsili-science.webp`
    - `/images/daylight-mock-simulation.webp`
    - `/images/daylight-ai-tutor.webp`
    - `/images/daylight-celebration-100.webp`
    - `/images/daylight-school-arena.webp`
    - Neon pack images (`qudrat-champion.webp`, `tahsili-excellence.webp`, `mock-exam-simulation.webp`, `ai-smart-tutor.webp`)
- **Data Source:** `homepageSettings.hero` with fallback to `defaultHomepageSettings.hero`
- **Dynamic/Static:** Fully configurable via admin settings (texts, colors, rotate intervals, gallery images)
- **Interactive Behavior:**
  - Auto-rotating gallery images (every 6s by default, configurable 3-60s).
  - Hover freeze (`onMouseEnter` / `onMouseLeave`).
  - Next/Prev arrows (`ChevronLeft`, `ChevronRight`).
  - Direct thumbnail bar: clicking any thumb jumps directly to that image.
  - Floating Card 1 (Rating): Click scrolls smoothly to `#testimonials`.
  - Floating Card 2 (Progress): Click scrolls smoothly to `#paths`.
  - Floating Card 3 (A+): Click scrolls smoothly to `#why-choose`.
  - Floating Card 4 (Achievement): Click scrolls smoothly to `#testimonials`.
- **Route / CTA:**
  - Primary CTA: Link to `/dashboard` (or `primaryCtaLink`), label: "ابدأ التدريب مجاناً" (`Zap` icon)
  - Secondary CTA: Link to `/courses` (or `secondaryCtaLink`), label: "تصفح مساحة التعلم" (`BookOpen` icon)
  - Optional Tertiary CTA
- **Depends on HomepageSettings:** Yes (hero title, colors, images, rotate interval, CTA links)
- **Depends on API:** No (uses defaults immediately if API offline)
- **Mobile Behavior:** Stacks vertically (text top, image bottom), buttons expand to full width (`w-full`), floating badges reposition with safe margins.

---

## 3. Compact Live Stats & Counters Bar

- **Section Name:** `LiveStatsBar`
- **Source Lines:** `Landing.tsx:917-965`
- **Visible Title:** Dynamic counters e.g. `+15,000`, `4.9 ⭐`, `12+`, `3,000+`
- **Visible Subtitle:** Labels e.g. "طالب متفوق", "تقييم المنصة", "دورة معتمدة", "سؤال وتمرين"
- **Images Used:** None (SVG particle dot grid background `radial-gradient(#6366f1 1.5px, transparent 1.5px)`)
- **Data Source:** Computed from active platform state or manual admin overrides (`homepageSettings.stats`)
- **Dynamic/Static:** Dynamic (can calculate live from `publishedCourses.length`, `totalStudents`, etc. or manual value)
- **Interactive Behavior:** Hover glow card with scale (`group-hover:scale-110`), number color highlights.
- **Route / CTA:** None (informative metrics bar)
- **Depends on HomepageSettings:** Yes (`homepageSettings.stats`)
- **Depends on API:** Yes (computed from live course and student counts)
- **Mobile Behavior:** 2x2 grid (`grid-cols-2 lg:grid-cols-4`), compact padding (`py-3.5 px-3`).

---

## 4. Educational Paths ("كل ما تحتاجه للتفوق")

- **Section Name:** `EducationalPathsSection`
- **Source Lines:** `Landing.tsx:967-988`, `OrganicCard:1330-1426`
- **Visible Title:** `كل ما تحتاجه للتفوق`
- **Visible Subtitle:** "نقدم لك أدوات تعليمية متكاملة تغطي كافة جوانب التدريب والتقييم."
- **Images Used:** Dynamic path icons (`BookOpen`, `Target`, `Award`, or uploaded custom path icons)
- **Data Source:** `paths` store/API (`state.paths`), filterable by `homepageSettings.featuredPathIds`
- **Dynamic/Static:** Dynamic (renders all active paths e.g. القدرات العامة, التحصيلي العلمي, نافس)
- **Interactive Behavior:** `OrganicCard` with 4 selectable visual styles (`modern`, `minimal`, `playful`, `organic`), interactive lift (`hover:-translate-y-2.5 hover:scale-[1.02]`), animated arrow icon.
- **Route / CTA:** Direct link to `/category/:pathId` or `/learning?path=:pathId`
- **Depends on HomepageSettings:** Yes (`featuredPathIds`)
- **Depends on API:** Yes (`/api/v1/paths` / taxonomy bootstrap)
- **Mobile Behavior:** Single column stack (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).

---

## 5. Featured Courses Section ("الدورات المميزة")

- **Section Name:** `FeaturedCoursesSection`
- **Source Lines:** `Landing.tsx:990-1046`
- **Visible Title:** `الدورات المميزة` (`sectionTexts.featuredCoursesTitle`)
- **Visible Subtitle:** "اختر من بين أفضل الدورات التعليمية المتخصصة" (`sectionTexts.featuredCoursesSubtitle`)
- **Images Used:** Course thumbnails (`course.thumbnail`)
- **Data Source:** `courses` store/API (`state.courses`), sorted by audience + rating or `featuredCourseIds`
- **Dynamic/Static:** Dynamic
- **Interactive Behavior:**
  - Image zoom on hover (`group-hover:scale-110`).
  - Price pill with discount strikethrough.
  - Quick action buttons: "معاينة" (Eye) and "شراء" (ShoppingCart).
- **Route / CTA:** 
  - Section header link: `/courses` ("عرض الكل")
  - Card links: `/course/:id` and `/course/:id?buy=1`
- **Depends on HomepageSettings:** Yes (`featuredCourseIds`, section titles)
- **Depends on API:** Yes (`courses` endpoint)
- **Mobile Behavior:** Responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`), card buttons stay side-by-side (`grid-cols-2`).

---

## 6. Featured Articles & Strategies Section ("مقالات واستراتيجيات قياس")

- **Section Name:** `FeaturedArticlesSection`
- **Source Lines:** `Landing.tsx:1048-1111`, `ArticleReaderModal:1321-1325`
- **Visible Title:** `مقالات واستراتيجيات قياس` (`sectionTexts.featuredArticlesTitle`)
- **Visible Subtitle:** "أحدث النصائح والتوجيهات لتطوير مهاراتك في الاختبارات"
- **Images Used:** None (rich card layout with category tags, reading time, author avatar info)
- **Data Source:** `lessons` (text lessons marked for platform) or `DEFAULT_PLATFORM_ARTICLES` (10 curated articles)
- **Dynamic/Static:** Dynamic with fallback to built-in curated article data
- **Interactive Behavior:** Clicking any article opens `ArticleReaderModal` directly in-place without page reload.
- **Route / CTA:** Link to `/blog` ("استعرض جميع المقالات")
- **Depends on HomepageSettings:** Yes (`featuredArticleLessonIds`, section titles)
- **Depends on API:** Falls back gracefully to `DEFAULT_PLATFORM_ARTICLES`
- **Mobile Behavior:** Single column card stack, modal opens full-screen on mobile.

---

## 7. Why Choose Section ("لماذا يختار الطلاب منصة المئة؟")

- **Section Name:** `WhyChooseSection`
- **Source Lines:** `Landing.tsx:1113-1211`, `FeatureCard:1428-1458`
- **Visible Title:** `لماذا يختار الطلاب منصة المئة؟` (`sectionTexts.whyChooseTitle`)
- **Visible Subtitle:** "نحن لا نقدم مجرد دورات، بل نقدم نظاماً تعليمياً متكاملاً يساعدك على الفهم العميق، التدريب المستمر، وتحليل الأداء بطريقة بسيطة وفعالة."
- **Images Used:** Icons (`Video`, `Users`, `BarChart`, `ShoppingCart`, `Award`, `Book`, `Check`, `Sparkles`)
- **Data Source:** Static layout + dynamic customizable text props in `sectionTexts`
- **Dynamic/Static:** Static structure with dynamic text overrides
- **Interactive Behavior:** 
  - 2 SaaS Trust KPI Boxes (`+25 درجة`, `98.4%`).
  - 3 Verified Checkmark bullet guarantees.
  - 6 Feature Cards with colored badges and hover translation (`hover:-translate-y-1.5`).
- **Route / CTA:** Link to `/dashboard` ("ابدأ رحلة التفوق الآن")
- **Depends on HomepageSettings:** Yes (`sectionTexts.whyChooseTitle`, `sectionTexts.whyChooseDescription`)
- **Depends on API:** No
- **Mobile Behavior:** Stacks text overview on top, 6 feature cards in single column on mobile (`sm:grid-cols-2`).

---

## 8. Showcase Pillars ("محطات التفوق الذكي في منصة المئة")

- **Section Name:** `ShowcasePillarsSection`
- **Source Lines:** `Landing.tsx:1213-1299`
- **Visible Title:** `محطات التفوق الذكي في منصة المئة`
- **Visible Subtitle:** "منهجية متكاملة تبدأ من التأسيس النظري المتقن وتنتهي بتحقيق الدرجة الكاملة والقبول في أرقى الجامعات."
- **Images Used:**
  - 6 Daylight 3D images: `smart-learning-tablet.webp`, `daylight-qudrat-math.webp`, `daylight-tahsili-science.webp`, `daylight-mock-simulation.webp`, `daylight-ai-tutor.webp`, `daylight-celebration-100.webp`
  - 6 Neon Dark images: `qudrat-champion.webp`, `tahsili-excellence.webp`, `mock-exam-simulation.webp`, `ai-smart-tutor.webp`
- **Data Source:** `PLATFORM_DAYLIGHT_IMAGES` and `PLATFORM_SHOWCASE_IMAGES` arrays
- **Dynamic/Static:** Interactive tabbed view
- **Interactive Behavior:**
  - Tab Switcher: `☀️ استوديو المئة النهاري 3D` vs `🌙 النمط السيبراني الليلي`.
  - Hover zoom on 3D images (`group-hover:scale-105`).
  - Cards show badges, subtitles, descriptions, and animated CTA arrow buttons.
- **Route / CTA:** Links to `/dashboard`, `/category/p_qudrat`, `/category/p_tahsili`, `/mock-exams`, `/pricing`, `/admin-dashboard?tab=schools`
- **Depends on HomepageSettings:** No (built-in presentation assets)
- **Depends on API:** No
- **Mobile Behavior:** Single column card stack, tab buttons wrap neatly on smaller screens.

---

## 9. Testimonials Section ("قصص نجاح نعتز بها")

- **Section Name:** `TestimonialsSection`
- **Source Lines:** `Landing.tsx:1301-1319`, `TestimonialCard:1460-1501`
- **Visible Title:** `قصص نجاح نعتز بها` (`sectionTexts.testimonialsTitle`)
- **Visible Subtitle:** "انضم لآلاف الطلاب الذين حققوا أحلامهم معنا"
- **Images Used:** Student avatar images e.g. Unsplash portraits or local avatars
- **Data Source:** `testimonials` store/API (`state.testimonials`) with default fallback testimonials
- **Dynamic/Static:** Dynamic with default fallback
- **Interactive Behavior:**
  - Large decorative quote icon (`Quote` icon).
  - Degree badge with `Trophy` icon (e.g. `99% قدرات`, `98% تحصيلي`).
  - 5 Gold Stars.
  - "تجربة موثقة" badge with checkmark.
- **Route / CTA:** None
- **Depends on HomepageSettings:** Yes (`testimonialsTitle`, `testimonialsSubtitle`)
- **Depends on API:** Falls back to default testimonials if API empty
- **Mobile Behavior:** Single column card stack (`grid-cols-1 md:grid-cols-3`).

---

## 10. Site Header & Footer

- **Source Lines:** `components/Header.tsx`, `components/Footer.tsx`
- **Header:** Sticky top bar with logo, nav links (`الرئيسية`, `المسارات`, `لماذا المئة؟`, `من نحن`, `الأسئلة الشائعة`), role switcher, dark mode toggle, and login/signup buttons.
- **Footer:** Brand mission statement, quick navigation links, contact info, copyright `جميع الحقوق محفوظة منصة المئة`.
