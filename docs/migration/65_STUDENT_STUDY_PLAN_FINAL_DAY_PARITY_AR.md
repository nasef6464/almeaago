# ALMEAA V2 — حفظ مهام الخطة عند انتهاء الأيام المتاحة

**التاريخ:** 2026-10-30. **المالك:** الطالب والتعلم / application layer فقط. **الحالة:** PARTIAL حتى ظهور CI النهائي ودليل HTTP/PostgreSQL والمتصفح.

## مصدر السلوك الملزم

- Legacy read-only: `nasef6464/almeaacodax@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`، `utils/studentPlanSchedule.ts::scheduleStudentPlanTasks`.
- Go baseline: `nasef6464/almeaago@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`، `internal/learning/application/study_plan.go::generateItems`.
- Legacy يضع المهمة الأولى بمدتها الأصلية حتى لو تجاوزت المدة اليومية، ثم يضع المهام المتبقية في **آخر يوم مؤهل** بمرحلة المراجعة، بدل حذفها صامتًا.
- Go baseline كان يقص مدة المهمة إلى `dailyMinutes` ويتوقف عند انتهاء الأيام؛ تختفي المهام الباقية من الخطة المحفوظة. هذا فرق من الكود وليس شهادة متصفح.

## نطاق الإصلاح

`student → study-plan form → HTTP create/update → learning.StudyPlanService.generateItems → StudyPlanRepository.Create/UpdateStudyPlan → study_plan_items → student plan view`.

تغيّر مولّد العناصر فقط؛ لا تغيير في DTO أو واجهة أو HTTP أو PostgreSQL schema أو RBAC أو scoring أو entitlement. يحتفظ Go بالحد الآمن `studyPlanMaxItems=160` وحدود موارد المرشحين الحالية، حتى لو كان المصدر يسمح بعدد أكبر؛ هذه **فجوة باقية صريحة** تتطلب عقدًا مستقلًا قبل إزالة الحد.

## اختبارات RED→GREEN

- `TestStudyPlanPreservesLastDayOverflowAndOriginalDurations`: يوم واحد، 15 دقيقة يومية، ثلاث دروس 30/20/10 دقيقة؛ التوقع 3 عناصر بتاريخ واحد، وأوقات 17:00/17:30/17:50، دون تقصير المدة.
- `TestStudyPlanOverflowKeepsSafetyCap`: 100 درس متاح، يوم واحد؛ لا فقد صامت ضمن الحد الآمن، وترتيب متصل.
- RED test-only commit: `49c4fe7f3e793f2da8a82efecfa22bdfd2dab62b` (يلزم مراجعة نتيجة تشغيل الاختبار؛ لا تُحسب بوابة gofmt دليل RED).
- تنفيذ الإصلاح: `4a1e2bd43ebe0f3cc84f2fb244bec4138ff7dbe9`؛ تنسيق الاختبارات: `14801b9f46b2418daed677dfca1900b7da8a285e`.

## عقد التكامل الباقي

1. بعد نجاح CI: تشغيل مسار POST/GET/PATCH بخادم Go حقيقي وPostgreSQL معزول، والتحقق من ثلاثة سجلات `study_plan_items` ثم الرجوع وإعادة التحميل؛ مع فشل 503/409 ومسودة قابلة للإعادة.
2. صور Legacy↔Go متقابلة بنفس الطالب والبيانات والوقت والمنطقة عند 390/820/1440 RTL؛ اختبار حالة التحميل/الفراغ/الخطأ.
3. عدم إعادة كتابة `StudyPlanPage.tsx` المملوك لـ#164، أو ملفات #161/#163/#168/#229؛ لا إعادة توليد الاختبارات أو تعديل scoring.
4. يراجع مالك الطالب حدود 160 عنصرًا كفرق غير مغلق عن Legacy؛ لا تغيّر حدود السلامة بصمت.

**التصنيف:** IMPLEMENTED في مولّد Go؛ TESTED يتطلب نجاح CI على SHA النهائي؛ HTTP/PostgreSQL/visual = NOT PROVEN. لا دمج ولا نشر ولا cutover.
