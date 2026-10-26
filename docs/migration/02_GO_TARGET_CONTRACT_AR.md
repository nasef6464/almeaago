# ALMEAA — عقد التنفيذ المستهدف (Go / PostgreSQL)

**الحالة:** IMPLEMENTED FOUNDATION + PARITY GAPS OPEN.  
**المستودع:** `nasef6464/almeaago`, `main@a9d5af976a2aa233fd3a51893afe922d231a15ae` (2026-10-02).  
**المصدر المقارن:** `01_LEGACY_SOURCE_CONTRACT_AR.md` عند Legacy SHA المعلن فيه؛ تجب إعادة فحص الطرفين قبل كل دمج.

## 1. اختيار المعمار الثابت

React + TypeScript + Vite للواجهة، Go API وworker، PostgreSQL للبيانات العلائقية، Redis للعمليات العابرة/التسريع، Cloudflare R2 للملفات الكبيرة، OpenAPI للعقود، WebSocket للحصص، Modular Monolith. لا إعادة كتابة شاملة ولا microservices ولا MongoDB جديد.

خريطة التنفيذ:

| المسؤولية | المالك في Go | الواجهة أو العقد |
|---|---|---|
| Identity/Auth | `internal/identity` | `apps/web/src/features/auth` |
| المدارس والفصول والتكليفات | `internal/organizations` | `features/organizations`, `api/openapi` |
| المهارات والمسارات | `internal/taxonomy` | `features/taxonomy` |
| التأسيس والدروس | `internal/content` | `features/content`, `features/learning` |
| صور السؤال/الوسائط | `internal/media` | R2 metadata + signed upload |
| بنك الأسئلة | `internal/questionbank` | `features/questionbank` |
| الاختبارات والنتائج | `internal/assessment` | `features/assessment` |
| الإتقان والتدخل والخطط | `internal/learning` | `features/learning` |
| الاستحقاق والدفع | `internal/commerce` | `features/commerce` |
| ولي الأمر | `internal/parents` | `features/parents` |
| الإشعارات | `internal/communication` | `features/notifications` |
| الحصص الحية | `internal/realtime` | `features/classroom` |
| الذكاء الاصطناعي | `internal/ai` | `features/ai` |
| التقارير | `internal/reporting` | `features/reporting` |
| السجل والمراقبة | `internal/operations` | `features/operations` |

أنماط الدومين: `domain → application → repository/postgres → transport/http`، مع `internal/platform` للبنية المشتركة فقط؛ الجداول تُدار عبر `migrations/`، والاستعلامات المولدة عبر `db/queries/`، ولا تبديلات runtime للـschema. التزم بـ`../architecture/PROJECT_MAP.md` و`../blueprint/18_MODULE_API_BOUNDARY_MAP_AR.md`.

## 2. خريطة العلاقات المستهدفة

| مفهوم الأصل | تمثيل PostgreSQL | قاعدة ثبات |
|---|---|---|
| المستخدم | users/identities/sessions | حساب واحد حتى مع مدارس/أدوار متعددة |
| عضوية المدرسة | `school_memberships` + صلاحياتها | لا تساوي حق الدخول للمحتوى |
| الفصل | `classes` + `class_memberships` | علاقة مقيدة ومدققة |
| تكليف المدرس | `teaching_assignments` + مادة/فصل | فحص تعارض المادة وسحب السلطة |
| الإشراف | `school_supervisor_scopes` | نطاق المدرسة والفصل الفعال |
| ولي الأمر | `parent_student_relationships` | لا تخمين من هاتف/هوية فقط |
| السؤال | canonical question/version/skill links | لا نسخ السؤال لكل اختبار |
| الاختبار | definition/version + placement/attempt/result | النشر والمحاولة والتصحيح كعقود منفصلة |
| الاستحقاق | grants/entitlements | سلطة خادم وسجل دفع مستقل |
| الحصة | session/batch/question/response/report | تقرير نهائي ثابت وخصوصية الإجابة |
| الصورة/الفيديو | asset metadata/reference | bytes خارج PostgreSQL عند الإمكان |

هذه خريطة منطقية؛ أسماء الأعمدة والقيود الفعلية تُستخرج من `migrations/`، ولا تُفترض منها عمليات ترحيل مكتملة. راجع `../blueprint/15_TARGET_RELATIONSHIP_ERD_AR.md`.

## 3. حالة Go المشاهدة مقابل المدرسة القديمة

| Contract | دليل Go حالي | الحالة والإجراء |
|---|---|---|
| سياق مدرسة مفوضة | `internal/organizations/transport/http/context_handler.go` | IMPLEMENTED؛ يلزم مقارنة الدور/تعدد المدارس |
| قائمة الطلاب/الفصول/المعلمين | `SchoolDirectorDashboardPage.tsx`, `director_core.go` | IMPLEMENTED؛ يلزم تدقيق كل الحالات/الصلاحيات |
| تكليف المعلم بالمادة | `organizations-client.ts`, `SchoolDirectorDashboardPage.tsx`, `teaching_assignments` | **DIFFERENCE OBSERVED:** إدخال subjectId نصًا واختياريًا في واجهة Go؛ الأصل يطلب مادة واضحة ويكشف التعارض؛ افحص السلطة الخلفية قبل تحديد الحل |
| تنقل مدير المدرسة بعشرة أقسام | `SchoolDirectorDashboardPage.tsx` مقابل `directorNavigation.ts` | GAP/UNVERIFIED؛ توجد روابط تشغيل عامة، لكن لم يثبت تطابق التنقل والقوائم |
| اختبارات المدرسة الإدارية | `internal/assessment`, `features/assessment` | IMPLEMENTED OWNER؛ يحتاج مقارنة أفعال المدير/المشرف مع Legacy |
| الحصص الذكية | `internal/realtime`, `features/classroom` | IMPLEMENTED OWNER؛ يحتاج مقارنة واجهات المعلم والطالب والعرض والمواد |
| تقارير التعلم والمدرسة | `internal/reporting`, `features/reporting` | IMPLEMENTED OWNER؛ يحتاج مقارنة المصادر/الفلاتر/التصدير |
| تدخلات المدرسة | `internal/learning`, `SchoolInterventionsPage.tsx` | IMPLEMENTED OWNER؛ يحتاج تدقيق الرحلات والسلطة |

الحالات هنا **ليست نجاح اختبار parity**. وثيقة `../CURRENT_STATE.md` تسجل `TESTED/MERGED` لدفعات سابقة، لكنها تصرّح بأنها ليست `PARITY_PROVEN` ولا شهادة إطلاق إنتاجي.

## 4. قواعد بناء واجهة مطابقة

1. المصدر البصري هو أحدث React في Node.js؛ Go يحافظ على DOM hierarchy والهوية البصرية والـRTL والمسافات والأبعاد والخطوط والرسوم والقوائم والحالات.
2. اعمل React presentation adapters فوق API Go؛ لا تعِد Mongo/Express logic ولا تغيّر Go API لأجل تسهيل النسخ البصري فقط.
3. الحالة الديناميكية تأتي من Go الحقيقي، ولا تعرض عدادًا أو تقريرًا مفبركًا لمجرد مساواة صورة.
4. لا تُعدّل واجهة أصلية سليمة بحجة التحسين؛ إصلاح الوصول/overflow الموثق مسموح، وغيره يحتاج قرار مالك.
5. يجب الاختبار على 360/390/430/768/1024/1366/1440/1920 وكذلك projector؛ ابدأ بالمصفوفة في ملف المصدر.
6. لا تختزل رحلة المعلم أو المدير إلى رابط تنقل: اختبر إنشاء/تحديث/رفض/إلغاء/نتائج/تحرير.

## 5. بوابات الاعتماد لكل موديول

`INVENTORIED → MAPPED → GAP_PROVEN → IMPLEMENTED → UNIT/INTEGRATION/E2E GREEN → VISUAL VERIFIED → ROLE/DATA PARITY VERIFIED → PARITY_PROVEN`.

تُختم الحالة فقط بالأدلة: SHA الأصل، SHA Go، سيناريوهات الاختبار، نتائج CI للرأس النهائي، مسارات الصور وقياس الفرق، محاولات الرفض، نسخة database migration ونتيجة rollback/staging. أي بوابة خارجية غير منفذة تبقى `PENDING`، ولا يُسمّى المشروع جاهزًا للإنتاج.

## 6. ما لا نفعله

- لا ننسخ مجلدات Node.js بالجملة، ولا ننقل ديون MongoDB إلى جداول وهمية/JSON عملاق.
- لا نغيّر الصلاحية أو صحة النتيجة لإرضاء الشاشة.
- لا نعيد بناء مجال اجتاز الاختبار دون دليل gap محدد.
- لا ننفذ ترحيل/كتابة إنتاج أو نغير الاستضافة والدومين دون إذن إطلاق منفصل.
- لا ننشئ GitHub Actions جديدة تكرر الأربعة الموجودة بلا فائدة قياسية.

