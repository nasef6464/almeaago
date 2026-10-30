# STUDENT-PLAN-COMPLETION-POSTGRES-01 — استعادة حقيقة إكمال الدروس في خطط الطالب

**مرجع الواجهة والسلوك (قراءة فقط):** `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`، `pages/Plan.tsx` و`utils/studentPlanCompletion.ts` (المهام المكتملة ونسبة تقدم الخطة).  
**Go base:** `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`.  
**الملكية:** PR #242، لا تعديل لملفات #161/#163/#164/#168/#171/#229/#238 أو أي فريق آخر.

## سبب العطل المثبت

`StudyPlanService.planCandidates` و`hydrate` يستدعيان `Repository.CompletedStudyPlanLessons` لإظهار حالة الدرس المكتمل في الخطة، وتوليد جدول يحترم التقدم. كان الاستعلام يقرأ `learning_lesson_progress`، وهي علاقة غير موجودة في migrations. الملف `migrations/000024_learning_lesson_video_progress.up.sql` ينشئ `lesson_progress` بالاسم الصحيح. لم يُعثر على تعريف جدول/VIEW باسم `learning_lesson_progress`.

**RED الحقيقي:** [Student Study Plan Completion PostgreSQL run 41009523912](https://github.com/nasef6464/almeaago/actions/runs/41009523912) على `1f7da96507fd2c5a658b6f2dfe1a5d8dd129bcbe`، بعد تطبيق جميع migrations على PostgreSQL 18: فشل `TestCompletedStudyPlanLessonsPostgres` بخطأ `SQLSTATE 42P01: relation "learning_lesson_progress" does not exist`. هذا ليس خطأ صورة أو محاكاة.

## الإصلاح

تغيير اسم العلاقة في SELECT فقط إلى `lesson_progress`؛ دون تغيير مخطط PostgreSQL أو الصلاحيات أو حساب الإتقان أو واجهة المستخدم. الاحتفاظ بقيود الاستعلام: `student_id`، `context_type='course'`، `course_id`، `status='completed'` و`lesson_id`.

## اختبار PostgreSQL الحقيقي

`internal/learning/repository/postgres/study_plan_completion_integration_test.go`:
- يقرأ schema الفعلي `public.lesson_progress` ويستخدم جدولًا مؤقتًا بالأنواع نفسها، بلا أي كتابة لبيانات طلاب حقيقية.
- حالتا completed مقابل in_progress لنفس الدرس في دورتين مختلفتين.
- عزل طالب آخر، ومنع احتساب إكمال موضوع foundation كإكمال دورة.
- تعدد الدروس والتكرار، وعدم قراءة جدول عند قائمة مراجع فارغة.
- Workflow مستقل يطبق جميع migrations ثم ينفذ الاختبار على PostgreSQL 18.

## Trace ومعايير الاعتماد

`الطالب → خططي → إنشاء/تعديل/فتح خطة → StudyPlan HTTP → StudyPlanService.planCandidates/hydrate → CompletedStudyPlanLessons → lesson_progress PostgreSQL → عناصر الخطة/التقدم`.

| المعيار | الحالة الحالية |
|---|---|
| كشف السبب على PostgreSQL مهاجر واختبار RED | VERIFIED |
| تغيير SELECT إلى العلاقة المهاجرة | IMPLEMENTED؛ ينتظر GREEN على SHA النهائي |
| اختبار العزل والفراغ والاكتمال في PostgreSQL | PENDING GREEN |
| Backend / Frontend / Database / Browser على نفس SHA | PENDING |
| HTTP حقيقي + حفظ خطة + إعادة قراءة + رجوع/تحديث + فشل/إعادة محاولة | PARTIAL / NOT PROVEN |
| صور Legacy↔Go مقترنة 390/820/1440 RTL بنفس الدور والبيانات | NOT PROVEN |
| تطابق رحلة الطالب كاملة | PARTIAL |

**خطوة تالية:** إكمال GREEN وبوابات CI، ثم اختبار إنشاء خطة HTTP بجلسة طالب تجريبية على PostgreSQL مع درس مكتمل وآخر غير مكتمل؛ التحقق من قائمة المهام بعد reload، والفشل والعودة، ثم المقارنة البصرية المقترنة. لا دمج/نشر/cutover أو كتابة Legacy/إنتاج.
