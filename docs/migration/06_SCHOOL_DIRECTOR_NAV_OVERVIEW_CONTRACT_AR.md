# SCHOOL-004 — خريطة أقسام مدير المدرسة والملخص التنفيذي

**تاريخ الفحص:** 2026-10-27

**Legacy:** `nasef6464/almeaacodax` — `dashboards/SchoolDirectorDashboard.tsx`, `dashboards/school-director/directorNavigation.ts`, `server/src/modules/schools/application/schoolDirectorWorkspace.ts`, `services/api.ts`

**Go baseline:** `nasef6464/almeaago@dce0ca43de71b9f8180e7df868600fb728816297` (SCHOOL-003 merged)
**الحالة:** SOURCE/TRACING GAP DOCUMENTED — NOT IMPLEMENTED / NOT PARITY_PROVEN

## ما يراه مدير المدرسة في المصدر

تُعرض الأقسام التالية ضمن شريط جانبي قابل للطي ومجموعات وصندوق breadcrumb؛ القائمة **مشتقة من صلاحيات الربط والوحدات الفعالة** وليست قائمة ثابتة لكل مدير:

| Legacy section ID | النص | المجموعة | شرط الظهور في `directorNavigation.ts` | Go الحالي |
|---|---|---|---|---|
| `overview` | الملخص العام | البداية | `SCHOOL_OVERVIEW_VIEW` | أربع بطاقات مختلفة، دون فصل قسم مستقل |
| `students` | الطلاب | إدارة المدرسة | `SCHOOL_STUDENTS_VIEW` | إدارة مدمجة في الصفحة الحالية |
| `classes` | الفصول | إدارة المدرسة | `SCHOOL_CLASSES_MANAGE` + `SCHOOL_CORE` | إدارة مدمجة في الصفحة |
| `teachers` | المعلمون والتكليفات | إدارة المدرسة | `SCHOOL_TEACHERS_ASSIGN` + `SCHOOL_CORE` | إدارة مدمجة؛ SCHOOL-003 أضاف إظهار/إيقاف التكليف |
| `learning-evidence` | التعلم والجاهزية | التعلم والمتابعة | `SCHOOL_REPORTS_DETAILED_VIEW` + `SCHOOL_INTELLIGENCE` | لا نفس مدخل `SchoolLearningEvidencePanel` |
| `assessments` | اختبارات المدرسة | التعلم والمتابعة | `SCHOOL_ASSESSMENTS_MANAGE` + `SCHOOL_ASSESSMENTS` | لا نفس شاشة المدير/محررها |
| `sessions` | الحصص الذكية | التعلم والمتابعة | `SCHOOL_SMART_CLASSROOM_VIEW` + `SMART_CLASSROOM` | يوجد دومين smart classroom؛ شاشة المدير غير مكافئة |
| `interventions` | الدعم والمهارات | التعلم والمتابعة | `SCHOOL_INTERVENTIONS_VIEW` أو `MANAGE` + `INTERVENTION_CENTER` | رابط منفصل للتدخلات، ليس نفس الشاشة |
| `reports` | التقارير والتصدير | التعلم والمتابعة | `SCHOOL_REPORTS_DETAILED_VIEW` + `SCHOOL_INTELLIGENCE` أو `SCHOOL_REPORTS_EXPORT` + `EXECUTIVE_ANALYTICS` | رابط تقارير عام؛ تصدير CSV والمدخل المفصل غير مثبتين |
| `transfer` | النقل بين المدارس | عمليات حساسة | `SCHOOL_STUDENTS_TRANSFER_SCHOOL` + `SCHOOL_CORE` | لا نفس سير النقل والتأكيد |

**قيد أساسي:** لا يجوز رسم رابط يعمل ظاهريًا ويؤدي إلى صفحة عامة مختلفة الصلاحيات. الأقسام غير المنقولة تبقى حالة gap معلنة حتى يُربط كل منها بخدمة صحيحة واختبارات سلبية، ولا تُعرض افتراضيًا كأنها مكتملة.

## عقد الملخص القديم: ست بطاقات لا أربع

المصدر `buildSchoolDirectorOverview(schoolId)` في Node يعيد
`{school:{schoolId,schoolName}, metrics:{students,classes,teachers,supervisors,schoolAssessments,completedSmartClasses},classes:[{classId,className}]}`؛ مساره `GET /school-access/director/schools/{schoolId}/overview` بعد تفويض `SCHOOL_OVERVIEW_VIEW`.

| المؤشر | المعنى في Node (من قراءة المصدر) | المرشح في PostgreSQL | حكم التحقق |
|---|---|---|---|
| الطلاب | عدد المستخدمين ضمن `schoolStudentFilter` الفعلي للمدرسة وفصولها | `school_memberships` + `users` + حارس العضويات | تطابق حالات active/suspended مطلوب |
| الفصول | `scope.classes.length` | `classes` داخل المدرسة، مع تفسير status | راجع قاعدة نطاق الفصول النشطة |
| المعلمون | `distinct teacherId` للتكليفات **النشطة** داخل فصول المدرسة | `teaching_assignments` مع `classes` | لا تستبدل بعدد عضويات المعلمين |
| المشرفون | اتحاد `school.supervisorIds` و`classes[].supervisorIds` بلا تكرار | `school_memberships` و`school_supervisor_scopes` | **تطابق الدلالة غير مثبت**؛ يحتاج حالة اختبار mapping |
| اختبارات المدرسة | `QuizModel` منشور ويطابق `schoolAssessmentAudience` (أوسع من ملكية المدرسة وحدها) | `assessments` + `assessment_assignments` + classes/users audience | **غير محسوم**؛ لا تستخدم `owner_school_id` وحده |
| الحصص الذكية المكتملة | `ClassroomSessionModel.countDocuments({schoolId,status:'ended'})` | `classroom_sessions` بحالة `ended` | لا تُحسب `archived` تلقائيًا |

حاليًا في Go يوجد `GET /api/school-access/director/schools/{schoolId}/overview-access` كفحص وصول فقط في `internal/organizations/transport/http/legacy_director_core.go`؛ **لا يرجع المقاييس الستة**. الملف `apps/web/src/features/organizations/pages/SchoolDirectorDashboardPage.tsx` يحسب أربع بطاقات من استجابات الطلاب والفصول والمعلمين وعدد الصلاحيات: ليس العقد المرجعي. الماسح الموجود لطلاب/معلمي المدير في `internal/reporting/repository/postgres/school_director_directory.go` نقطة إعادة استخدام محتملة، ولا يثبت عدد الاختبارات/المشرفين.

## مسار السلطة وملكية الحقيقة

`Director page` ← `organizationsClient.directorOverview(schoolId)` ← `/api/school-access/director/schools/{schoolId}/overview` ← `requireRole(school_admin)` و`SCHOOL_OVERVIEW_VIEW` المدرسية **في Go** ← قراءة مجمعة نطاقية بقاعدة PostgreSQL. لا يُشتق أي مؤشر من 100 صف فقط على المتصفح؛ لا يُعتمد حقل يرسله العميل لتقرير school scope. يجب رفض مدير مدرسة «أ» إذا طلب ملخص «ب»، وإلغاء النتيجة القديمة عند تبديل المدرسة أو زيارة أ→ب→أ.

## سياسة الشكل والمقاسات

- نقل الـsidebar ذي الأربع مجموعات وترتيب الأقسام والبريدكرامب من Legacy بأسماء وشرط ظهور مطابقين؛ فتح الشريط وطيّه على الجوال يعمل باللمس.
- لقطة لكل حالة `overview`, `students`, `teachers` على: 360، 390، 430، 768، 1024، 1366، 1440، 1920 بكسل. مقارنة مع **نفس البيانات والحالة** في Node، والتحقق من غياب horizontal overflow، وfocus، وRTL.
- مؤشر `schoolId`, permissions, modules وبيانات الصفحة تُصفّر أو تُعاد قراءتها بعد تبديل المدرسة؛ تعاد اختبارات السباقات من SCHOOL-003.
- `PARITY_PROVEN` يتطلب صورًا مقارنة، اختبار عقد الخادم، نتائج قواعد البيانات، واختبار دور مدير المدرسة، وليس ألوانًا مشابهة فقط.

## أول تسلسل تنفيذ مقترح

1. تثبيت mapping وfixtures للستة مؤشرات، خصوصًا المشرفين والاختبارات، وكتابة اختبارات رفض المدرسة الأخرى.
2. تنفيذ القراءة والتجميع في Go PostgreSQL مع نفس عقد JSON، وفحوص عددية حتمية (0، 1، تكرار تكليف، اختبار منشور لفصل كامل).
3. تنفيذ شريط مدير المدرسة والأقسام المبوبة دون فقد العمليات المكتملة؛ ربط الملخص بعقد الخادم لا بأرقام محلية ناقصة.
4. Playwright لمسار صلاحيات منخفضة/مرتفعة، تبديل المدارس، صور المقاسات، ثم Frontend/Backend/Database/E2E CI على نفس SHA.
5. لا تبدأ بنقل التقارير أو الاختبارات أو النقل الحساس قبل عقد مستقل لها؛ هي أقسام ظاهرة **لكن مستقلة الاختبار والسلطة**.

**الوضع عند إنشاء الملف:** هذه خريطة قيود وفجوات موثقة من الشيفرة، ولم يُعدل API ولا واجهة SCHOOL-004 بعد. المرجع التنفيذي التالي: `docs/superpowers/plans/2026-10-27-school-director-overview.md`.
