# ALMEAA — P0-B: بوابات API وملكية إنشاء الاختبار المدرسي

**الحالة:** P0-B / ROUTER-MOUNTS INVENTORIED + SCHOOL ASSESSMENT OWNERSHIP TRACED؛ **ENDPOINT PARITY NOT PROVEN**.
**التاريخ:** 2026-10-28.

| المرجع | SHA المعاين | نقطة التوجيه |
|---|---|---|
| الأصل Node/Mongo | `almeaacodax@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7` | `server/src/app.ts` يركّب `apiRouter` على `/api`؛ `server/src/routes/index.ts` |
| الهدف Go/PostgreSQL | `almeaago@491d5b1c87cc53c1f3e7aea52057498dc40496af` | `internal/platform/httpserver/server.go` (`chi`) |

## 1. كشف آلي محدود وصادق

```bash
node scripts/parity/api-mount-inventory.mjs
node scripts/parity/api-mount-inventory.test.mjs
# مصدر Node المباشر إن توفر مجاورًا:
node scripts/parity/api-mount-inventory.mjs --legacy-source ../almeaacodax/server/src/routes/index.ts
```

حُفظت قائمة Node في `baselines/2026-10-28-node-api-mounts.json` مع أسماء الـrouter الموصولة؛ لم تُنسخ موديولات Express إلى Go. يتكرر عمداً mount واحد في Node حين يكون هناك أكثر من router بنفس الجذر؛ إزالة التكرار قبل فهم الأولوية تفسد الجرد.

| قياس `router mounts` صريحة فقط | العدد |
|---|---:|
| Node: `apiRouter.use` | 33 تسجيلًا |
| Node: جذور URL مميزة | 30 |
| Go: `router.Mount` | 31 تسجيلًا وجذرًا مميزًا |
| تطابق الجذر كاملاً حرفيًا | **1: `/api/school-access`** |

**السبب:** Node يبدأ `/api/*` غالبًا، Go يبدأ `/api/v1/*`؛ **اختلاف بادئة ليس فقد وظيفة ولا تساوي سلوك**. توجد استثناءات مثل `/api/school-access` في Go للحفاظ على توافق جزئي. الأرقام لا تحصي عدد endpoint فعلية داخل كل router ولا ديناميكية الـsubrouters؛ كما لا تثبت تفعيل dependencies وقت التشغيل أو تصاريحها. لا تنشئ aliases تلقائيًا لجميع المسارات قبل تعيين سياقات الأدوار والتحويلات.

## 2. أول مسار مكتمل التتبع: اختبار المدرسة

### Legacy — تعريف وقراءة وتعديل مدرسة

المصدر: `server/src/routes/index.ts`, `server/src/modules/quizzes/http/schoolAssessmentsRouter.ts`.

| الطلب بعد mount | سلطة/طبقة موثقة في الكود | غرضه |
|---|---|---|
| `POST /api/school-assessments/compose` | `requireAuth` + دور `admin/school_admin/supervisor/teacher` ثم `resolveSchoolCompositionContext` | إنشاء معاينة/تركيب أسئلة، وليس نشرًا تلقائيًا |
| `GET /api/school-assessments/:id/context` | `resolveSchoolAssessmentContext` + قواعد `canManage/canEditContent` | سلطة التحرير والنسخ بحسب النطاق وحالة النشر |
| `GET /api/school-assessments/:id/definition` | سياق المدرسة + `assertSchoolAssessmentOperation(edit)` | قراءة تعريف قابل للتحرير دون الدليل الخاص `schoolQuestionEvidence` |
| `POST /api/school-assessments/:id/clone` | سياق المدرسة + `cloneSchoolAssessment` | إنشاء نسخة معتمدة من الأصل |
| `POST /api/school-assessments/:id/commands` | `executeSchoolAssessmentCommand` | أوامر إدارة/تعديل بالسياسة المدرسية |
| `GET /api/school-assessments/:id/report` | `buildSchoolAssessmentReport` | تقرير مدرسة مأذون |
| `GET /api/school-assessments/:id/learners` | `readSchoolAssessmentLearners` | الطلاب/حالة التسليم بحدود المدرسة |
| `GET /api/school-assessments/:id/results/:resultId` | `readSchoolAssessmentLearnerResult` | نتيجة محاولة فردية في سياق الاختبار |

وجود الدور في middleware **لا يعطي سلطة عامة**: التحقق اللاحق من سياق المدرسة والاختبار إلزامي.

### Go — استعراض الأسئلة وإنشاء الاختبار والتقرير المدرسي

المصدر: `internal/platform/httpserver/server.go`, `internal/organizations/transport/http/legacy_handler.go`, `internal/organizations/application/director_assessments_create.go`, `internal/organizations/repository/postgres/director_assessments_create.go`، إضافة إلى `internal/assessment/transport/http/*`.

| الطلب على Go | نقطة الملكية الحالية | الحكم |
|---|---|---|
| `GET /api/school-access/director/schools/{schoolId}/academic/available-questions` | organizations / سؤال معتمد + مادة/مسار + تفويض فعّال في SQL | موجود؛ قارن نطاق السؤال وحقوق المصدر |
| `GET /api/school-access/director/schools/{schoolId}/academic/eligible-students` | organizations | موجود؛ يجب فحص الطلاب النشطين ومقام الاستهداف |
| `POST /api/school-access/director/schools/{schoolId}/academic/assessments` | organizations → `DirectorCreateAssessment` → repo Tx | موجود؛ إنشاء اختبار/تكليف، حماية idempotency، نطاق school/class/classes/selected |
| `GET /api/school-access/director/schools/{schoolId}/academic/assessments` | organizations | موجود؛ قائمة/فلاتر تحتاج مقارنة actual DTO |
| `GET .../assessments/{assessmentId}/report` | organizations | موجود؛ التقرير لا يعني تطابق كل تحليلات Legacy |
| `GET .../assessments/{assessmentId}/learners` | organizations | موجود؛ الصفحات والبحث والحالة |
| `GET .../assessments/{assessmentId}/results/{attemptId}` | organizations | موجود؛ نتائج الطلاب ضمن المدرسة |
| `GET/POST/PATCH ...` تحت `/api/v1/assessments/*` | assessment domain | محرك اختبارات عام منفصل في الواجهة؛ لا تفترض أن مدير مدرسة مفوض يستطيع استعماله على اختبار مدرسي |
| مقابلات صريحة لـ`compose/context/definition/clone/commands` | لم تثبت في router المدرسة Go المدرَس | **GAP-CANDIDATE / UNKNOWN**؛ تتبّع أي قدرات مكافئة في application/UI قبل إصدار حكم أن الوظيفة مفقودة |

**حقيقة واجهة Go الحالية:** `apps/web/src/features/organizations/components/DirectorAssessmentCreator.tsx` يعرض نطاقات `class/classes/school/selected`، ويتيح درجة النجاح والوقت وعدد المحاولات وطريقة عرض الاختيارات. هذا يثبت ظهور عناصر إعداد، **ولا يثبت** وحده تطبيق كل إعداد داخل محاولة الطالب ونتيجته؛ يلزم فحص الحفظ والاستعادة والتشغيل والتقرير. كما أن إنشاء مركزي لعدة فصول وطلاب محددين موجود في واجهة Go، فلا تعِد بناءه لمجرد غياب عنوان URL قديم.

### PostgreSQL — أين يُكتب الاختبار بالفعل؟

`createDirectorAssessmentTx` يفتح transaction ويفحص صلاحية المدير **مجددًا في SQL** عبر `schools`, `school_memberships`, `school_membership_permissions`, `school_contracts`, `school_contract_modules` قبل الكتابة. يتحقق من الفصول والطلاب/المادة/المسار والأسئلة المعتمدة، ثم يستخدم:

- `school_assessment_create_requests`: حجز `(school, requestKey)` وبصمة المحتوى لمنع الإنشاء المكرر؛ تصادم مختلف = رفض.
- `assessments` و`assessment_versions` و`assessment_version_questions`: تعريف موحد وإصدار وأسئلة مرتبطة **بالمعرف**، لا نسخ عشوائية للسؤال.
- `assessment_assignments`, `assessment_assignment_classes`, `assessment_assignment_users`: جمهور الاختبار، المدرسة/الفصول/الطلاب.
- `questions`, `question_versions`, `assets`: بيانات سؤال معتمد وصورته ونسخته.

**الاستنتاج الهندسي من الكود:** يوجد بالفعل **مخزن assessment مشترك**، لكن **مسار أمر إنشاء المدرسة داخل organizations repository** بدلاً من application command يملكه `internal/assessment`. لا يثبت ذلك وجود محرك تصحيح مكرر، ولا يستلزم هدمه الآن؛ عزل ownership يتم لاحقًا بعقد صريح مع اختبارات Postgres idempotency + RBAC + نتائج ومحاولات قديمة. التعليق في repository يصرح بأن النشر المدرسي يملك قواعد استهداف خاصة؛ يجب حفظ هذه القواعد عند النقل.

## 3. المعايير المتبقية قبل تسمية الاختبارات المدرسية PARITY_PROVEN

1. استكمال `Node method/path → Go method/path/DTO` لكل عملية إنشاء/تعديل/استنساخ/نشر/تكليف/محاولة/نتيجة؛ لا تكفي مطابقة اسم الملف.
2. تجارب رفض حقيقية: مدرسة ثانية، فصل خارج المدرسة، معلم بلا تكليف مادة، مشرف بلا نطاق، نقل طالب، سحب الصلاحية أثناء transaction.
3. تجارب بيانات حقيقية معقمة: امتحان مركزي لفصول متعددة + selected students + اختبار المعلم داخل فصل واحد، same question ID وVersion، ونتيجة/تحليل مهارات مطابقان.
4. منشىء الاختبار المدرسي قد يختلف UI عن منشئ المنصة، لكن لا تصحيح أو سؤال/مهارة مستقل؛ اختبر واجهة المدير والمعلم والطالب 360–1920px مع RTL.
5. لا تحديث للدرجات أو الروابط الإنتاجية ولا تحويل `/api/school-assessments` إلى `/api/v1/assessments` بلا اختبار قرار سلطة المدرسة ومعنى الـpayload.

**الخطوة التالية:** فتح `schoolAssessmentCommands.js` والـGo assessment application والـDirectorAssessmentCreator وفحص ما إذا كانت `clone/commands` تغيب في Go حقًا؛ ثم اختيار أصغر فجوة مؤكدة لدفعة TDD رأسية. بالتوازي استكمال جرد `auth → taxonomy/questions → content/access` وبقية routers.
