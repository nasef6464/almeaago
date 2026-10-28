# ALMEAA Go — نقطة استعادة التنفيذ: السياسة العلمية أولًا

**التاريخ:** 2026-10-28. **حالة النطاق:** IMPLEMENTED + TESTED LOCAL؛ تكافؤ المنصة الكامل `NOT PROVEN`، والنشر/PR يحدّثان بعد رفع الفرع.

## طلب المالك وقرار البرنامج

> «اهتم بالمدارس» لا يعني «ابدأ بالمدارس». المطلوب نقل **كل المنصة** بنفس السياسة التربوية والوظائف والواجهة وبنية أفضل. المالك فوّض ترتيب العمل الهندسي.

تم تصحيح أولوية `03_EXECUTION_AND_HANDOFF_PLAN_AR.md` بحيث تبدأ بالهدف التعليمي والأدوار والبيانات والعلاقات وقلب الاختبار/المراجعة، ثم تتابع جميع واجهات الأدوار والمدارس والخدمات. شرائح المدارس السابقة على Go محفوظة ولا يعاد تنفيذها لمجرد تغيير ترتيب برنامج العمل.

## المقارنة الحالية

| المصدر | المرجع المقرأ | الإثبات |
|---|---|---|
| Legacy | `almeaacodax@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7` | المطابقة مع GitHub `main` عبر compare بتاريخ الفحص؛ الوثيقة التربوية `STUDENT_JOURNEY_PHILOSOPHY_AR.md` والسياسة `ADAPTIVE_MASTERY_FINAL_MASTER_PLAN_AR.md` |
| Go local | `almeaago@d0ec44d32b888a3a1c474c203184eab82ecf641d` قبل هذا التغيير | بنيته تشمل `internal/{identity,organizations,taxonomy,questionbank,media,content,assessment,learning,reporting,parents,commerce,communication,realtime,ai,operations,platform}` |
| Go remote | `main@728cbe083b2977ece0f9b5d0ee46d7f2e82ab776` وقت الفحص | compare مع ذلك SHA أظهر `status=identical`؛ source school #137/#138 مدمج سابقًا |

**وثيقة التصميم والهدف التربوي:** `../superpowers/specs/2026-10-28-platform-pedagogical-policy-design.md`.

## الفجوة الحقيقية الأولى وأثرها

`internal/learning/application/service.go::Readiness` كان يقرأ `ListSkillProgress(..., page=1, limit=100)` ثم يحسب الاستعداد من `page.Items` فقط. مواد فيها أكثر من 100 مهارة تعرض إجمالي المهارات والأدلة والتغطية غير الكامل. مثال اختبار برمجي: 100 مهارة إتقانها 90% وثلاث أدلة لكل واحدة، والمهارة 101 إتقانها صفر وثلاث أدلة؛ الكود القديم يرجع `totalSkills=100, totalEvidence=300, score=90`، بينما الصفحات المكتملة تُنتج `101, 303, 89`. الرقم 100 هو **حد قراءة** لا شرط تربوي.

**الحل المحدود:** تجميع صفحات النطاق نفسه داخل application بمجموعات 100 حتى اكتمال `HasMore`. حد أمان 100 صفحة (= 10,000 row كحد أقصى)؛ عند error، أو استمرار `HasMore` مع صفحة فارغة، أو تجاوز الحد، تفشل العملية بـ`ErrIncompleteReadiness` ولا تُعرض نتيجة مبنية على جزء من الأدلة. لا تغيير جداول/مسارات/عتبات التصحيح أو بيانات الطلاب.

### إثبات الاختبارات المحلي

1. Baseline قبل التعديل: `go test ./internal/learning/application ./internal/learning/domain` → PASS.
2. RED بعد كتابة حالات الاختبار: أربع حالات `TestReadiness*` فشلت لأن الخدمة اكتفت بالصفحة الأولى أو تجاهلت خطأ الثانية؛ الدليل المباشر `totalSkills=100`, `score=90`.
3. GREEN بعد إصلاح الـapplication: `go test ./internal/learning/application -run TestReadiness -count=1` → PASS.
4. التشغيل الكامل `go test ./...` داخل filesystem sandbox فشل في اختبارات provider التي تفتح منفذ TCP اختبار بسبب `socket: operation not permitted`؛ **ليس حكمًا على الكود**. إعادة التشغيل في بيئة تسمح بـloopback أعادت `exit_code=0` لجميع حزم Go بما فيها learning/assessment/organizations/providers.

## ما يزال خارج هذه الدفعة

- لا نملك بعد جردًا نهائيًا لكل أزرار الشاشات ولا 8×screens screenshots مرئية حديثة؛ لا تسمية `VISUAL PARITY` حتى يكتمل.
- عتبات/مصادر التغطية في Go تحتاج golden comparisons مع Legacy على نفس بيانات المسار، بما فيها **مقام المهارات غير المقاسة**. إصلاح الـ100 يزيل truncation فقط، ولا يثبت دقة مقام المنهج بالكامل.
- قد يتغير progress بين صفحتين أثناء القراءة؛ يحتاج لاحقًا snapshot/revision أو aggregation متسق عند حجم/تزامن إنتاجي، مع معيار benchmark. لا نغير قاعدة بيانات أو API في هذه الدفعة.
- حدود ownership لمنشئ اختبار المدرسة (`organizations` direct assessment inserts) مقابل assessment core تحتاج contract refactor محمي باختبارات.
- Mongo→PostgreSQL production rows والإتاحة/الأموال وAI providers والحصص والصور الحية لم تُختبر هنا؛ لا مساس ببيانات الإنتاج.

## للمنفذ الذي يفتح كودكس في المرة القادمة

1. اقرأ هذا الملف ثم ميثاق السياسة و`03_EXECUTION_AND_HANDOFF_PLAN_AR.md`، ولا تبدأ من خطة المدارس القديمة وحدها.
2. تحقّق من رأس Legacy/Go GitHub main وPR هذه الدفعة؛ لا تعيد تطبيق إصلاح الـ100 إذا كان مدمجًا.
3. أكمل الجرد العابر للطبقات بدءًا من `identity → taxonomy → questionbank → content/access → assessment → learning/reporting` مع E2E ذهبي للتشخيص وإعادة القياس، ثم واجهات المستخدمين بما فيها المدارس.
4. اطلب بيانات staging/fixtures آمنة للتصوير/ترحيل البيانات عندما تصل المرحلة؛ لا تستخدم أو تنشر بيانات الطلاب الحقيقية في ملفات Evidence.

**حكم الإغلاق:** هذه دفعة تأسيس تربوي وإصلاح حساب محدد. ليست اكتمال نقل المنصة، وليست شهادة Visual/UI أو Production readiness.

## تحديث لاحق — برنامج التنفيذ وجدولة استكماله (2026-10-28)

- أُثبت دمج دفعة السياسة والجاهزية السابقة في Go `main@75b4afb752894dcf15d77134d5069cc5bbb7cb92`، PR #139؛ **لا تكرر تطبيقها**.
- فُعّلت جدولة متابعة تنفيذ ALMEAA Go كل ساعتين بتوقيت الرياض؛ كل تشغيل يستعيد حالة GitHub الحية ويراجع الخطة ويكتب أدلة الدفعة. الجدولة لا تعني أن التطبيق يعمل على خادم تطوير دائم.
- بدأ `P0` بجرد آلي قابل للتشغيل لمسارات React في المصدر والهدف، مسجل في `18_FRONTEND_ROUTE_PARITY_AUDIT_AR.md`، مع baseline محدد: Legacy 55 / Go 54 / نص مشترك 28 / Node-only 27 / Go-only 26.
- هذه **فروق في عناوين المسارات وليست حكمًا بفقد 27 وظيفة**. يجب ربط `screen → action → API → domain → database` وتوثيق كل URL بديل وقوة عقده ولقطات مقاسات الأجهزة.
- التالي: استكمال جرد الواجهات والـAPI والعلاقات، ثم golden behavior tests للهوية والاختبارات والمهارات والتقارير، مع الحفاظ على سياسة المدارس ودورة تعلم الطالب.
