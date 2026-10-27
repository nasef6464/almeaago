# SCHOOL-004 — سجل تنفيذ عقد ملخص مدير المدرسة

**مرجع السلوك:** `almeaacodax/server/src/modules/schools/application/schoolDirectorWorkspace.ts`، و`schoolAssessmentAudience.ts`، وواجهة `SchoolDirectorDashboard.tsx`.

**نطاق الدفعة الحالية:** API الملخص فقط؛ نقل بقية أقسام المدارس والتطابق البصري ما زال عملاً لاحقًا. لا تُعتبر قاعدة Node أو نسخة الإنتاج متأثرة بهذه الدفعة.

## العقد المنفذ

- `GET /api/school-access/director/schools/{schoolId}/overview` للـ`school_admin` المصرح له بصلاحية `SCHOOL_OVERVIEW_VIEW` في المدرسة المطلوبة.
- نتيجة JSON تضم `school`, `metrics`, `classes` وبداخل `metrics` ستة مفاتيح مطابقة لـNode: `students`, `classes`, `teachers`, `supervisors`, `schoolAssessments`, `completedSmartClasses`.
- يتم رفض معرّف مدرسة غير صالح أو فارغ، أو مستخدم/مدرسة بلا تفويض، قبل حساب المقاييس. لا يعيد مسار القراءة أصفارًا مصطنعة عند فشل SQL.
- يتم حساب الأعداد من استعلام PostgreSQL واحد، مع `COUNT(DISTINCT ...)` للمعلمين والمشرفين والاختبارات، وفصل عدد صفوف الطلاب عن حجم صفحة قائمة الطلاب.

## خريطة بيانات Node إلى Go — مثبتة بالكود وتنتظر اختبار PostgreSQL CI

| مؤشر Node | المصدر الحالي في Go/PostgreSQL | قاعدة العد |
| --- | --- | --- |
| `students` | `school_memberships` | طلاب المدرسة بحالة `active` أو `suspended`، مرة واحدة لكل مستخدم |
| `classes` | `classes` | الفصول `active` للمدرسة |
| `teachers` | `teaching_assignments` + `classes` | المعلم المميز بتكليف نشط داخل فصل نشط |
| `supervisors` | `school_supervisor_scopes` | المشرف المميز ذو نطاق نشط |
| `schoolAssessments` | `assessments` + `assessment_assignments` + جداول جمهور الصف/الطالب | اختبار منشور يستهدف فصلًا نشطًا أو طالبًا في المدرسة، بغض النظر عن `owner_school_id` |
| `completedSmartClasses` | `classroom_sessions` | الجلسات ذات الحالة `ended` فقط، مثل Node |

## حالات اختبار محددة

- مدرسة أ لها طالبان وفصلان ومعلم واحد مكلف بفصلين ومشرفان، واختباران منشوران، وجلسة منتهية؛ القيم المتوقعة `2/2/1/2/2/1`.
- مدرسة ب منفصلة بقيم `1/1/1/1/1/1` لمنع تسرب بيانات مدرسة إلى أخرى.
- الاختبار المنشور لمُنشئ تابع لمدرسة ب يدخل في عدد اختبارات مدرسة أ إذا استهدف طالبًا منها.
- رفض دور المعلم ومدير مدرسة أخرى والطلب دون صلاحية؛ رفض school ID غير صالح.

## دليل التحقق وتبعيات الإغلاق

- **RED → GREEN:** اختبار طبقة التطبيق فشل قبل تعريف الخدمة ثم نجح؛ اختبار HTTP بدأ بـ404 قبل تسجيل المسار ثم نجح؛ اختبار صيغة school ID فشل ثم نجح بعد التحقق.
- **محلي:** `go test ./...` نجح ببيئة Go 1.27.1. اختبار PostgreSQL مبرمج ضمن `TestDirectorOverviewCountsRealSchoolAudiencePostgres`، لكنه **يتخطى محليًا** عند غياب `DATABASE_URL`؛ نجاح ترجمة الكود لا يساوي نجاح SQL.
- **بوابة PostgreSQL:** أضيف تشغيل الاختبار ضمن `.github/workflows/database.yml`. لا تُغلق هذه الدفعة ولا تُدمج حتى تكون PostgreSQL CI خضراء على آخر HEAD.

## فوارق دلالية يجب ألّا تُخفى

1. Node يحسب `supervisorIds` من مجموعة المدرسة وفصولها، أما Go فيعتمد على `school_supervisor_scopes`. يلزم التأكد عند ترحيل البيانات أن جميع نطاقات المشرفين انتقلت إلى هذا الجدول، ولا تُصنع قوائم وهمية لملء الفارق.
2. Node يسمح باختبار يستهدف **مجموعة المدرسة ككل** دون تحديد فصل/طالب. نموذج Go الحالي يمثل جمهور الاختبارات المدرسية عبر `assessment_assignment_classes` و`assessment_assignment_users`؛ **استهداف المدرسة بالكامل لا يطابقه تحويل مثبت حتى الآن**. هذه فجوة مستقلة قبل ادعاء تطابق المؤشر في جميع الحالات.
3. Node يجمع الطلاب من `schoolId` و`studentIds` ومجموعات الفصول؛ Go يعتمد على `school_memberships`. سلامة ترحيل العضويات شرط لتساوي الأعداد؛ لا يكفي نجاح الاختبار الصناعي وحده.

## التسليم التالي المحدد

1. رفع الفرع المستقل وتشغيل `Backend CI` و`Database CI` وسائر البوابات؛ إصلاح أي إخفاق على الفرع ذاته.
2. بعد نجاح CI، دمج API فقط وتثبيت SHA وPR بهذا السجل.
3. الانتقال إلى Task 3 في الخطة: استهلاك API بست بطاقات حقيقية وnavigation حارس للصلاحيات واستجابة أجهزة الكمبيوتر والتابلت والجوال؛ اختبارات أ→ب→أ ومقارنة لقطات Node/Go.

