# تصحيح ملزم: استعادة واجهة ALMEAA كاملة

قرار المالك بتاريخ 2026-10-28 يلغي أي اجتهاد يعيد تنظيم الواجهة. المرجع جميع صفحات وأدوار أحدث Legacy main، لا لوحة الإدارة فقط. الحرية داخل Backend، والتصميم وسير العمل الأصليان معتمدان مسبقًا.

## نقطة الانطلاق التاريخية — محدثة بلقطة الاستلام أدناه
- Legacy read-only: bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7.
- Target base: 3167b1b5dd59257e146a231b9c5a0cbc1c684d79 (#149).
- الجرد الخام القابل لإعادة التشغيل: `node scripts/parity/screen-inventory.mjs ../legacy-readonly --summary`.
- `baselines/2026-10-28-screen-discovery.json`: 306 ملف JSX/TSX في مجلدات واجهة المصدر و64 في الهدف؛ 2582 و578 وسم تحكم على الترتيب. هذه أعداد مواضع كود وليست أعداد شاشات أو وظائف مفقودة. يشمل المصدر مكونات مشتركة، ولا يجوز طرح العددين لاستخراج نسبة تطابق.
- المولد التفصيلي يعرض المواقع وأسطر المسارات والروابط والإجراءات والنماذج والاستيرادات ومرشحات API؛ snapshot المحفوظ مختصر ويحمل المسارات وأعداد المواضع لكل ملف. القيم الديناميكية، الأدوار، علاقة الأوامر بالخادم، والحالات تحتاج تتبعًا يدويًا؛ الحالة الافتراضية UNKNOWN. هذا جرد اكتشاف واسع وليس الجرد السلوكي الشامل المكتمل.

## الفجوات المثبتة وترتيب التنفيذ
| الأولوية | الفجوة | الدليل | الحالة |
|---|---|---|---|
| P0 عام | إخفاء المسار السابع وما بعده بحد 6 غير موجود بالأصل | Landing.tsx displayedHomepagePaths مقابل PublicLandingPage.tsx slice(0,6) | VERIFIED لإزالة الحد فقط في#150؛ بقية إعدادات الإظهار ليست مثبتة |
| P0 عام | إعدادات homepage ديناميكية مقابل قيم افتراضية ثابتة | Landing.tsx getHomepageSettings؛ شهادة PUBLIC_USER_WORKSPACE_VISUAL_PARITY تستثني الإعدادات | MISSING في الشريحة السابقة؛ يلزم trace واجهة/Go |
| P0 إدارة | مساحة المسار/المادة الأصلية مقابل taxonomy CRUD مجمع | dashboards/admin/PathsManager.tsx مقابل features/taxonomy/pages/TaxonomyAdminPage.tsx | PARTIAL؛ لم تقارن جميع الحالات |
| P0/P1 جميع الأدوار | بقية الوظائف والتفاعلات واللقطات | الجرد الخام ومراجع visual baseline القديمة | UNKNOWN؛ ليس ادعاء غياب |

## الدفعات والاعتماد
1. تثبيت القرار في AGENTS والسياسة والخطة؛ اكتشاف جميع الصفحات والمكونات، ثم ربط الدور/URL/action/state/API وقاعدة البيانات. لا يثبت اسم URL أي وظيفة.
2. P0 public: إعدادات الهوية والهيدر والفوتر والمنزل والكتالوج ثم الدخول؛ أصل مقابل هدف بنفس البيانات، 390/820/1440. اختبار scope وvisibility قبل ربط العرض حتى لا تُكشف مسارات محجوبة.
3. بحسب تقرير المالك الأحدث: استعادة مساحة إدارة المسار والمادة الأصلية كوحدة متكاملة، ثم اختبار أثرها على ساحة الطالب؛ حفظ context عند الرجوع وإعادة التحميل.
4. مراجعة الطالب وساحات التعلم والدورة/المشغل ثم السؤال/المحاولة/النتيجة/المراجعة، وتصحيح الفروق المثبتة؛ لا تغيير scoring/access/payments.
5. الإدارة ثم جميع أدوار P1، دون إسقاط أي مركز أصلي.

كل دفعة: اختبار فاشل على فرق مثبت → إصلاح → اختبار الأوامر والعلاقات والحفظ ورفض الصلاحيات → screenshots متكافئة → PR مركز → البوابات الأربع على SHA النهائي. البيانات المولدة في اختبار عرض لا تثبت تكامل Go/PostgreSQL. لا نشر إنتاجي ضمن هذا العمل.

## حدود أدلة جولة الاكتشاف الأولى — تاريخية
لا توجد هنا شهادة بصرية للأصل مقابل الهدف، ولا جرد يدوي نهائي لكل زر، ولا شهادة تكامل جديدة مع PostgreSQL. لا نسبة تطابق محسوبة. نتائج اختبار المتصفح وCI تسجل كما حدثت ولا تُخفى أعطال البيئة.


## نتيجة التحقق في جولة الاكتشاف الأولى — تاريخية
- اختبارات أدوات parity: 15 PASS؛ TypeScript typecheck: PASS.
- محاولتا تشغيل Chromium المحلي انتهتا SIGTRAP قبل أي assertions؛ ليستا RED مثبتًا لخلل المنتج، ولا توجد screenshots ناجحة.
- رُفعت الاختبارات أولًا في PR #150 عند b6e87e4f2a673b78df19c2d82cf0e473487e5206 لتشغيل المتصفح في CI، قبل تعديل عرض المسارات.
- لا دمج ولا نشر. الجرد التفصيلي لكل دور وحالة والتكافؤ البصري للمنصة ما زالا غير مكتملين.

- RED مثبت في CI 40736913275 على b6e87e4: 117 PASS، ثلاث حالات جديدة FAIL لأن المسار الثامن لا يوجد عند 390/820/1440. أُزيل حد الستة بعد فحص السجل.
- المراجعة المستقلة طلبت قابلية إعادة توليد snapshot؛ أضيف summarize/--summary بعد اختبار فاشل ثم ناجح. regex يكتشف مرشحات فقط وقد يطابق comments/strings؛ لا يغطي APIs خارج ملفات JSX/TSX.
- الإصلاح يغير عرض قائمة server-returned فقط؛ لا يمنح صلاحيات ولا يثبت featured/visibility parity أو الصفحة كاملة.

## مصالحة تقرير المالك والعمل الجاري — 2026-10-28

لقطة تاريخية قبل دمج#152: Legacy main `bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`؛ Go main `671fbadfb3cbeec8110ac16d7e49796bb768705c`. فرع التنفيذ الحالي `fix/persisted-platform-fonts`، PR#152؛ كاتب تنفيذ واحد ومراجع مستقل للقراءة فقط. حفظت التغييرات في commits؛ لم تحذف التغييرات السابقة في public-restoration أو بقية worktrees. هذه مصالحة أولية للوظائف المجمعة؛ الجرد السلوكي التفصيلي لكل إجراء ما زال PARTIAL.

| الأصل | الموجود في Go | الدليل الحالي | الفجوة الفعلية والحالة | الإجراء |
|---|---|---|---|---|
| عرض جميع المسارات المختارة بالرئيسية | أزيل حد الستة | #150 واختبارات 8 مسارات على 3 مقاسات | VERIFIED لإزالة الحد فقط؛ إعداد featured/visibility ما زال MISSING | حفظ الإصلاح، استكمال عقد الإعدادات |
| فوتر MainLayout المشترك | نفس JSX وروابطه بصفحات عامة محددة | #151، SSR و123 E2E في الدفعة السابقة | VERIFIED للمكوّن/روابطه؛ الصور المقترنة للصفحة الكاملة UNKNOWN | عدم إعادة تنفيذه |
| إدارة الخطوط وحفظها وتطبيقها عامًا | PR#152: مكوّن المصدر + FontService + PostgreSQL | SSR/normalization/CSS وGo محلي PASS؛ جلسة حقيقية وGo/PostgreSQL وصور مكوّن مقترنة عند3مقاسات نجحت على c91bdda | VERIFIED في نطاق المكوّن والحفظ المحدد؛ الصفحة الكاملة والموقع العام PARTIAL | إنهاء الدفعة المحفوظة، دون إعادة فرع/بناء |
| إعدادات homepage والهوية والهيدر وروابطه | محتوى/تنقل ثابت وأجزاء مطابقة | مقارنة presentation routes بالمصدر و#151 | MISSING للتخزين/الإدارة الديناميكية؛ بقية البصري PARTIAL | أول شريحة تالية في الموقع العام |
| بطاقات ومساحة المسار والمادة | TaxonomyAdminPage مع CRUD مستقل عن content/assessment | PathsManager.tsx وPathsManager/* مقابل صفحة Go | PARTIAL: كيانات موجودة، الرحلة الأصلية غير مستعادة | استعادة الرحلة كوحدة بعد الموقع العام، لا استبدال Backend |
| الطالب وساحة التعلم والدورات/المشغل | StudentDashboardPage وLearningSpacePage وCourseLearningPage وخدمات Go | CURRENT_STATE، أقسام UI-3/UI-4 وشهادات سابقة | PARTIAL: سابق التنفيذ لا يثبت كل الحالة/الدور/الروابط الحالية | reuse ثم اختبار فروق الأصل بنفس البيانات |
| الاختبارات والنتائج والمراجعة والخطط | assessment/learning/reporting وصفحات النتائج والمراجعة | CURRENT_STATE، CI سابق، #148/#149 للإصلاحات المحددة | PARTIAL للتكافؤ؛ إصلاحات سلامة الأدلة محفوظة | لا تغيير scoring؛ مقارنة رحلة المصدر كاملة |
| مدارس/معلم/مشرف/ولي أمر | دومينات organizations/parents/realtime وصفحات الأدوار | CURRENT_STATE UI-5 وشهادات محددة | PARTIAL: الصلاحيات والرحلات المستعادة سابقًا محفوظة، الحصر الشامل UNKNOWN | فحص الدلتا حسب المصفوفة |
| التجارة/الإشعارات/AI/العمليات | دومينات وخدمات وصفحات قائمة | CURRENT_STATE المراحل السابقة | PARTIAL: تنفيذ قائم وليس شهادة كل واجهات الأصل | لا إعادة بناء أو تغيير سلطات ضمن العرض |
| قراءة تعريف اختبار المدرسة | PR#144 مفتوح على base قديم | GitHub head ef48f25e، ليس مدمجًا في main | UNKNOWN حتى مقارنة patch بأحدث main؛ لا يفترض أنه مفقود/جاهز | حفظ الفرع، لا merge شامل أو مزاحمة الدفعة |
| click-through رحلة الطالب | PR#123 مفتوح على base قديم | GitHub head e2f59072 | UNKNOWN لتوافق الاختبارات/الوثائق مع أحدث main | مقارنة قبل أي إعادة تطبيق، لا دمج شهادة قديمة |
| صور كل شاشة بنفس الحالة/البيانات/الدور | أدلة CI سابقة جزئية وصور Go | لا أزواج Runtime كاملة في هذه الجلسة | UNKNOWN للتطابق 100% | جمع أزواج حقيقية؛ لا حساب نسبة من عدد الملفات أو SSR |

## شريحة قبول الخطوط السابقة — مدمجة بنطاق محدود

ملفات: `features/presentation/*` و`content/{domain,application,repository/postgres,transport/http}/fonts*` وmigration000044. الإثبات المطلوب: مدير يسجل بجلسة حقيقية، يغير الخط/الحجم/اللون، يحفظ، يعيد التحميل، يزور صفحة عامة ويرجع؛ PostgreSQL يحتفظ بالقيمة؛ غير المدير/بلا جلسة/بلاCSRF مرفوض؛ reset معاينة حتى الحفظ؛ رفع خط محفوظ؛ mobile/tablet/desktop؛ CI على SHA النهائي. لا نسمي استجابات Playwright المحاكية دليل تكامل.

المراجع الأصلية والسياسات حاكمة بما فيها 25 مهارة رئيسية/95 فرعية للقدرات الكمي المعتمد، وربط Topic الثابت وروابط الفيديو/التدريب/الدعم دون تشغيل تلقائي، وفصل membership/assignment/entitlement وسجلات المحاولات. لا يغير إصلاح العرض أيًا منها.


## الاستلام الحالي وفق التقرير الهندسي المستقل

**تاريخ المصالحة:** 2026-10-28 بتوقيت الرياض. Legacy main `bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`؛ Go main `98d5cd519455e0775cf6b868f7c6e388ef4ef739` من fetch فعلي. التقرير محفوظ حرفيًا في `reviews/ALMEAA_GO_INDEPENDENT_ENGINEERING_HANDOFF_AR_2026-10-28.md`، تابع للخطة03. اللقطات أعلاه تاريخية؛ هذا القسم يحكم حالة الاستلام.

- #150 و#151 محفوظان. #152 **MERGED**، وليس PR جاريًا. رأسه النهائي المختبر `a17ad3480c0fc289564576435ac8572a1dbf1552`؛ merge `98d5cd51`؛ 130 E2E حسب سجل PR، ورحلة DB مستقلة وصور المكوّن بحدودها في28. لا ننسب نتائج CI القديمة إلى تعديل وثائق جديد أو إلى التطبيق كله.
- #123 **OPEN** عند `e2f5907218110fe240f40416d70e0031f4e13495`، و#144 **OPEN** عند `ef48f25edb1e656a2a6555721fbfd2c9e32b9a09`. هذه حالة GitHub المفحوصة؛ دمجهما أو إسقاط محتواهما غير معتمد قبل مقارنة دلتا أحدث main.
- ملاحظة FileReader المتزامنة في الخطوط **DEFERRED**، موروثة وموثقة في#152؛ لا تستخدم لتوسيع الدفعة الحالية أو الادعاء بأن الرفع كامل الحالات مثبت.
- **الخطوة التالية:** homepage/header/brand/navigation المحفوظة من المدير إلى الزائر؛ بعدها إدارة المسار/المادة حتى الطالب. لا فتح كاتب ثان أو نقل الإنتاج.

### سجل الإجراءات الحالي — تتبع فعلي من الكود، وليس شهادة متصفح

المصدر في الصفوف التالية `bf7281fc` والهدف `98d5cd51`. المقاسات المطلوبة 390/820/1440. جميع حالات runtime/visual غير المنفذة في هذه المصالحة UNKNOWN. `MISSING` يعني غياب القدرة المحددة في الملفات/التسجيلات المفحوصة؛ لا يعني غياب كل الدومين.

| screen_id / الدور / الرابط | الأصل: الملف والإجراء والحالة | Go الحالي / HTTP / المالك / التخزين | الحكم والدليل / التالي |
|---|---|---|---|
| PUB-ADMIN-01 / admin / `/admin-dashboard#/admin-dashboard?tab=homepage` | `HomepageManager.tsx`: load/edit/save/preview؛ loading/error/saving/success | لا manager ولا homepage endpoint في presentation API أو content management routes المفحوصة؛ content يملك الخطوط فعلًا، لا تخزين homepage مثبت | MISSING في هذا العقد؛ استعادة المكوّن عبر adapter وربطه بخدمة content واحدة، لا CRUD بديل |
| PUB-BRAND-01 / guest+roles / جميع صفحات الهيدر | `Header.tsx`: brand.logoUrl/logoAlt/logoText/logoAccentText | `LegacySiteHeader.tsx` يكتب النص ثابتًا؛ لا GET homepage؛ storage UNKNOWN | GAP_PROVEN بالكود للهوية الديناميكية؛ حفظ ثم GET الزائر ثم reload وصور |
| PUB-NAV-01 / guest+roles / الهيدر | `Header.tsx::navigationMenu`: visible/order/label/showAutoPaths/moreLabel وscope ومرحلة/مسار فرعي | الهيدر الحالي taxonomyCore + أول4مسارات وأول8/10مواد؛ لا settings consumer | GAP_PROVEN بالكود، E2E UNKNOWN؛ استعادة الترتيب والظهور والسياق، لا إزالة حدود عمياء بلا عقد المصدر |
| PUB-HERO-01 / guest / `/` | `Landing.tsx`: hero/CTA/gallery/colors وقراءة getHomepageSettings | `PublicLandingPage.tsx`: محتوى ثابت وحالة عرض محلية؛ لا homepage read | MISSING للقراءة المحفوظة؛ تحديد defaults/clear/autoRotate وصور وجميع CTA |
| PUB-FEATURED-01 / admin→guest / homepage→`/` | `HomepageManager.tsx` يختار featuredPathIds/courseIds/articleLessonIds؛ Landing يقرأها | taxonomy/content قائمان؛ لا عقد حفظ featured في endpoint settings مفحوص | MISSING في settings، الإتاحة UNKNOWN؛ علاقات مراجع constrained وإظهار المسموح فقط، لا مصدر سلطة آخر |
| PUB-SAVE-01 / admin / homepage | `handleSave`: PATCH ثم تحديث state/cache/event؛ فشل عادي يبقي المسودة، فشل auth يعالج الجلسة | لا action مقابل بعد؛ إعادة استخدام جلسة/CSRF الحالية | MAPPED؛ browser save/error/retry واحتفاظ المدخلات لازمان قبل TESTED |
| PUB-READ-01 / guest / homepage GET | `contentPresentationRoutes.ts` GET يقرأ/ينشئ default؛ PATCH requireAuth/admin + Zod ثم `$set` للحقول العلوية | endpoint الحالي fonts فقط؛ خدمة homepage/جدولها غير موجودين في نطاق content المفحوص | MAPPED؛ اختبر omission/false/empty/nested replacement قبل كتابة parser؛ GET Go يمكن أن يعرض default بلا mutation |
| PUB-REFRESH-01 / admin→guest / Back/Reload | `taxonomyContentApi.ts` يمسح/يحدّث cache ويطلق `almeaa:homepage-settings-updated` | bootstrap الخطوط مثال محفوظ؛ لا bootstrap homepage مقابل | MISSING لهذا العقد؛ لا تسمح لـGET قديم بإلغاء save أحدث، واختبر التنقل والفشل |
| PATH-ADMIN-01 / admin / إدارة المسارات | `PathsManager.tsx` بطاقات ثم مساحة المسار/المادة وتبويباتهما | `TaxonomyAdminPage.tsx` شجرة CRUD؛ taxonomy domain/API/storage قائمان | PARTIAL؛ بوابة2: reuse الدومين واستعادة الرحلة، لا إغلاق حتى أثر الطالب |
| PATH-SAVE-01 / admin / create/edit taxonomy | الأصل يحافظ على مسودة فشل الحفظ بحسب التقرير | `run` يمتص catch ثم create/edit callers يمسحون المسودة؛ API taxonomy موجود | GAP_PROVEN بمسار الكود؛ Browser reproduction UNKNOWN؛ RED ثم إصلاح داخل شريحة بوابة2 |
| LEARN-ACTIONS-01 / student / `/category/:pathId` | التقرير يرصد تفاصيل topic وفتح library والتحكم بالتبويبات | `LearningSpacePage.tsx` فجوات التقرير تحتاج تحديث trace والتشغيل على الرأس الحالي | PARTIAL/NEEDS E2E؛ لا نعيد وصف تقرير أقدم على أنه فحص متصفح حديث؛ مع بوابة2/3 |

### صيغة الجرد التفصيلي الملزمة

`screen_id | role | URL | legacy_SHA/file | Go_SHA/file | viewport | state | action/control | expected legacy behavior | actual Go behavior | HTTP/DTO | Go module/service | PostgreSQL table/relation | auth/entitlement | evidence/tests | verdict | priority | owner | next step`

الجدول أعلاه ملخص إجراءات مثبتة من ملفات، لا بديل عن صف لكل control/state في الجرد الكامل. الكاتب التنفيذي مسؤول ملء trace المحدد قبل كود كل شريحة. يحافظ على الأدلة السابقة؛ لا يعيد مسح المنصة في كل دورة. الحالات: loading/loaded/empty/error/forbidden/locked/free/dialog/search/filter/saved/back/reload/deep-link/mobile/keyboard/RTL/retry.

تدرج الإثبات: UNKNOWN → MAPPED → GAP_PROVEN → IMPLEMENTED → TESTED → VISUAL_VERIFIED → ROLE_DATA_PARITY_VERIFIED → PARITY_PROVEN. أوصاف MISSING/PARTIAL/BLOCKED تصف التغطية/المانع، ولا تمنح شهادة. سبب BLOCKED وخطوته التالية يسجلان صراحة.

### قرارات هندسية داخلية تحافظ على العقد

- content يملك إعدادات العرض؛ taxonomy يملك المسار/المادة/المهارة؛ content يملك topic/lesson؛ questionbank السؤال/نسخته؛ assessment المحاولة/التصحيح؛ learning الإتقان؛ reporting التحليل؛ commerce الاستحقاق. لا نسخ لحقائق هذه الموديولات في singleton settings.
- لا اختيار schema عشوائيًا: حقول العرض والقيم المتداخلة تفحص أمام عقد المصدر؛ قوائم featured مراجع كيانات، فتحتاج تحقق علاقات وقيودًا وفهارس مناسبة، وترتيبًا ثابتًا واختبارات حذف/إخفاء. لا migrations إنتاجية؛ لا رقم migration جديد قبل فحص آخر main.
- خطأ تحميل أو حفظ لا يصبح نجاحًا صامتًا. القيم الافتراضية لها مصدر معروف، والإحصاء الديناميكي لا يخترع. مشاركة renderer/CSS مع المصدر توثق كدليل مكوّن محدود؛ صور تطبيق Go وحدها لا تثبت الأصل.
- مقارنة same-role/data/viewport/DPR/browser/fonts، مع screenshots للحالات المهمة؛ CI الأربع على رأس PR النهائي. لا إغلاق الشريحة من جرد أو وثيقة أو MERGED وحده.

### تحقق دفعة المصالحة

أُعيدت اختبارات fonts الأربعة وfooter الاثنين وscreen-inventory الثلاثة محليًا: 9 PASS. هذا تحقق سلامة العقود المحفوظة قبل تحديث الوثائق، وليس اختبار homepage أو PostgreSQL جديدًا. لم تغير هذه الدفعة كود المنتج، ولم تصور صفحات جديدة، ولم تنشر. PR/SHA وCI لتعديل الوثائق تسجل في طلب الدمج، وتقرأ حيًا قبل أي دمج. الجرد الكامل والتكافؤ الكلي يبقيان PARTIAL/UNKNOWN.
