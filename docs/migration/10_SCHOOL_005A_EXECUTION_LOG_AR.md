# SCHOOL-005A — سجل الدفعة الأولى لنقل اختبارات مدير المدرسة

**التاريخ:** 2026-10-27 (السعودية). **Legacy:** `almeaacodax` read-only. **Go base:** `30b584474ab68036ebaf478fc01108b1f935d7cc` بعد دمج PR #129.

**PR:** https://github.com/nasef6464/almeaago/pull/131 — **Draft**، لا يُدمج قبل اكتمال `005A` والبوابات الأربع.

## ما تحقق في هذه الدفعة

1. فُحصت ملفات تنقل مدير المدرسة و`SchoolDirectorAcademicCenter`, `DirectorAssessmentCards`, `schoolAssessmentManagementPolicy`, والـHTTP routes؛ ثُبت أن العرض والإنشاء والإدارة والنتائج والتذكير وإعادة الفتح عقود منفصلة.
2. قورنت الجداول `assessments`, `assessment_versions`, `assessment_assignments`, `assessment_assignment_classes/users` وخدمة Go الحالية؛ ثبت غياب تمييز صريح بين النطاق الإداري `school_id` وبين جمهور «المدرسة بالكامل».
3. وُضع العقد `09_SCHOOL_005_ASSESSMENTS_CONTRACT_AR.md` والخطة التنفيذية `docs/superpowers/plans/2026-10-27-school-assessments-005a.md`.
4. أضيفت `Service.requireDirectorCapability`، وهي تتحقق بخادم Go من دور `school_admin` وUUID المدرسة والربط النشط والصلاحية والوحدة التعاقدية الفعالة في المدرسة نفسها. تفشل مغلقة إذا نقص عنصر.
5. **RED→GREEN:** اختبار `TestDirectorAssessmentCapabilityRequiresRolePermissionAndActiveModule` فشل أولًا لأن الطريقة غير موجودة؛ ثم نجح للحالات الموجبة والسلبية. نجحت حزمة `go test ./internal/organizations/...` المحلية.

## ما لم ينفذ بعد

- `005A`: migration تمثيل الجمهور، استعلام PostgreSQL الحقيقي، API القائمة، بطاقات المدير واختبارات Playwright للمقاسات؛ **غير منجز**.
- `005B`: إنشاء الاختبار والنشر مع بنك أسئلة معتمد؛ **غير منجز**.
- `005C`: تحرير/استنساخ/إعادة فتح/تذكير/نتائج؛ **غير منجز**.
- `005D`: مقارنة لقطات Node/Go والبيانات والاعتماد؛ **غير منجز**.

## استئناف محدد

1. اقرأ `09` والخطة قبل تعديل ملفات المنتج، ولا تُعد كتابة ما أُنجز.
2. أنشئ اختبار SQL على مخطط migrations الفعلي لتكليف مدرسة بلا جمهور، ثم `targets_entire_school` صريح، ومعالجة مجموعات الفصل والفرد بدون تسريب مدرسة ثانية.
3. الخدمة التي تنفذ `DirectorOverview` موجودة في `internal/reporting/repository/postgres/` وليست مستودع organizations؛ ضع استعلام القائمة الجديد معها، ثم وصل الخدمة المفوضة.
4. شغّل test على `DATABASE_URL` حقيقي تجريبي ضمن Database CI بعد تطبيق migrations. لا تعتبر `go test` المحلي مع اختبار PostgreSQL المتخطى دليلًا كافيًا.
5. اكمل HTTP وReact وE2E وتحديث this log، ثم أربع بوابات SHA واحد وPR/merge.

**لا توجد عمليات على قاعدة البيانات الحية، ولا نشر للإنتاج.**
