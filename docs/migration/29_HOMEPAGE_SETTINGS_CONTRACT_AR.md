# عقد حفظ إعدادات الرئيسية — خطوة تابعة لبوابة1

**المرجع الحاكم:** الخطة03 والتقرير المستقل في reviews؛ ليست خطة رئيسية جديدة.
**المصدر:** Legacy `bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7` للقراءة فقط.
**القاعدة:** Go `6baf9f1159c682f70062455eb9fcedc57469abf5` بعد دمج#153؛
فرع `feat/persisted-homepage-contract`. الحالة IMPLEMENTED/TESTED LOCAL للعقد؛
Go/PostgreSQL وCI النهائي يحدثان في PR. لا بوابة1 مغلقة ولا شهادة واجهة.

## الفجوة المحددة والمعاد استخدامه

الأصل: `HomepageManager` → `taxonomyContentApi.updateHomepageSettings` →
`contentPresentationRoutes` GET/PATCH → Zod/model → إعدادات يقرأها Header/Landing.
Go كان يملك الخطوط فقط في عقد presentation، وقيم الرئيسية/الهوية ثابتة.
هذه الخطوة تضيف طبقة الحفظ التي تعتمد عليها استعادة الشاشة؛ **لا تبدّل شاشة
المدير أو الهيدر أو الرئيسية في هذه الخطوة**، ولا تدّعي أن غياب consumers انتهى.

أعيد استخدام content domain/repository/HTTP mount، جلسات identity وCSRF ودور
admin وaudit transaction وPostgreSQL الحالي. لا محرك صلاحيات جديد، لا تخزين
Mongo أو Zustand منقول، ولا تغيير taxonomy/content ownership أو entitlement.

## التنفيذ والتتبع

| الطرف | العقد والأثر |
|---|---|
| HTTP | GET/PATCH `/api/v1/content/homepage-settings`؛ GET عام/no-store وPATCH مدير+CSRF قبل معالجة body؛ حد5MiB من app.ts الأصلي |
| domain | ParseHomepagePatch يطابق الحقول/الأنواع/الـenums وstrip unknown وfalse/empty/zero؛ HomepageSubdocumentDefaults يملأ defaults نموذج المصدر عند nested replacement |
| application | HomepageService: سلطة admin، خطأ storage لا يصبح defaults أو نجاحًا؛ لا درجة أو إتقان أو منحة هنا |
| repository | shallow merge للحقول العلوية؛ replacement للمتداخل؛ read واحد لكل scalars/references؛ كتابة scalars+references+audit في transaction متسلسلة على singleton |
| schema000045 | content_homepage_settings للعرض، وثلاثة جداول ordered featured FK إلى paths/courses/lessons؛ منع تكرار IDs داخل JSONB، وحفظ الترتيب والتكرار مثل المصدر |
| البوابات التابعة | HomepageManager الأصلي، URL tab=homepage، typed adapter، Header/Landing refresh، الحفظ من المتصفح وصور الأصل/Go: ما زالت تالية وغير مثبتة |

GET بلا سجل يعرض defaults المصدر دون إنشاء سجل؛ أول PATCH يهيئها ثم يطبق
التعديل. هذا اختيار داخلي لتجنب الكتابة في GET؛ لا شهادة تطابق لكل edge case
لـfindOneAndUpdate/upsert في Mongo. البروتوكول العادي للمدير يقرأ قبل الحفظ.
الـIDs هنا مراجع للعلاقات الحالية، وليست ترحيلًا لـObjectIds أو منح نشر/إتاحة؛
الاستهلاك العام اللاحق ملزم بفلترة النشر والصلاحيات من ملاكها.

## أدلة المصدر والاختبارات

- Baselines حرفية: presentation defaults/schema وHomepageSettings model، مثبتة من SHA المصدر أعلاه.
- `scripts/parity/homepage-source-fixtures.mjs` يعيد توليد25حالة من Zod4.6.7 وMongoose8.24.3 المثبتين في lockfile المصدر. يشغّل parsing وdocument casting/defaults فقط بلا Mongo، ولا يكتب في المصدر. الاختبارات تقارن Go بنتائج المصدر المستقلة؛ ليست fixtures مولدة من كود Go.
- أمثلة التغطية: omission/false/empty/zero، nested replacement، arrays فارغة، unknown stripping، enums، defaults stats/navigation، وعدم مشاركة defaults بين القراءات. حد صور gallery محسوب بـUTF-16 مثل المصدر.
- أضيفت tests قبل تعريف API الجديد؛ البناء فشل لغياب implementation ثم نجح. RED سلوكي إضافي أثبت403→400 الخاطئ لطلب طالب malformed، وتجاوز حد source5MiB؛ صحح role-before-decode وحد الحجم ثم نجح الاختبار. لا نسمي تعطل البيئة أو compile-error وحده reproduction لمتصفح المنتج.
- `go test ./...` و`go vet ./...` محليًا PASS. التحذير المحلي الخاص بـtelemetry/readlink لا يمنع exit0. اختبار PostgreSQL المحلي SKIP دون `HOMEPAGE_TEST_DB=1` وDATABASE_URL، لذلك ليس دليل تكامل حتى تشغيله الفعلي.
- Database CI الحالي موسع باختبار `TestHomepageSettingsHTTPPostgres`: session حقيقية، guest GET، admin PATCH، رفض student/anonymous/CSRF، persisted read، FK، ترتيب/تكرار/clear، rollback للمرجع المفقود/المعرّف التالف وفشل audit، concurrent disjoint updates، migration apply/down/reapply في schema فريد. لا يعطل الاختبار القيود ولا يكتب إعدادات public القائمة.

## قرارات وحدود الاستلام

**Ruling:** تنفيذ عقد الحفظ أولًا كـPR تابع قبل استعادة consumers — هذا اعتماد
صريح في بوابة1 والتقرير، لا إغلاق واجهة backend-only. تكلفته إن فُهم خطأ أن
يُحسب API تكافؤًا؛ لذلك تبقى PUB-ADMIN/BRAND/NAV/HERO وغيرها PARTIAL/MISSING.

لا screenshots جديدة لأن لا عنصر UI تغير. لا PostgreSQL إنتاجي أو deployment
أو بيانات تعليمية أو سياسات مدفوعات/تصحيح/صلاحيات متغيرة. لا تحويل25حالة إلى
نسبة تطابق. سجل PR النهائي يثبت SHA وCI والمراجعة ونتيجة DB وحدودها.

**التالي المحدد:** استعادة HomepageManager مع API/session adapters وروابط الأصل،
ثم ربط Header/Landing بالبيانات نفسها وتحديثها، مع failed-save draft/reload/back
وdeny وpaired images390/820/1440. بعد اكتمال هذا الدليل تبدأ مساحة المسار/المادة
حتى ظهور الطالب، مع الحفاظ على جميع الوظائف السابقة.
