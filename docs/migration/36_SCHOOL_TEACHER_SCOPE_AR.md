# SCHOOL-TEACHER-SCOPE-01 — نطاق معلم المدرسة والفصل (مسودة)

**Legacy authority:** `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`  
**Go base:** `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`  
**PR:** #165 — draft; no merge, deployment, production/Legacy writes or cutover.

## فجوة مثبتة ومصدرها

- Legacy `dashboards/SchoolTeacherDashboard.tsx` يعرض محدد المدرسة عند تعدد المدارس، ثمانية تبويبات بأسمائها وترتيبها، وعرض الفصول من المدرسة المختارة؛ `dashboards/school-teacher/SchoolTeacherPrimaryTabs.tsx` يربط بدء الحصة بالفصل المحدد.
- Go `TeacherWorkspacePage.tsx` كان يعرض `workspace.schools[0]` دائمًا، ولا يسمح بتغيير المدرسة؛ بعض عناصر التنقل توجه إلى `/admin-dashboard/questions` و`/admin-dashboard/assessments` وهي مساحات إدارة منصة وليست تبويبات معلم المدرسة.
- `ClassroomTeacherPage.tsx` كان يختار أول تكليف ويستعيد أول جلسة حيّة حتى لو كانت في مدرسة أخرى، ولا يستهلك نطاق المدرسة/التكليف من رابط فتح الفصل.

## شريحة التنفيذ وحدودها

1. محدد المدرسة الأصلي يظهر للمعلم صاحب أكثر من مدرسة، مع الاحتفاظ بالمدرسة المختارة في `schoolId` للرجوع والتحديث. إذا زال الإسناد، لا تعرض بيانات المدرسة الأولى بديلًا صامتًا.
2. استعادة أسماء وترتيب التبويبات الثمانية من المصدر؛ إزالة روابط Go التي تقفز إلى لوحة مدير المنصة. التبويبات التي لا تمتلك رحلة معلم أصلية في Go تبقى معطلة صراحة **PARTIAL**، ولا تُعرض كوظيفة منجزة.
3. عرض ملخص المعلم والفصول من `TeacherWorkspace` للمدرسة المحددة فقط، مع رابط فتح الحصة يحفظ `schoolId + assignmentId`. لا اختلاق لعدد الاختبارات أو صلاحية الفصل الذكي من مجرد وجود إسناد؛ القيم غير المتاحة تظهر `—`.
4. مشغل الفصل يستهلك الرابط، يتحقق من المدرسة والتكليف ضمن الإسقاط المصرح من Go، ويمنع اختيار مدرسة أخرى أو عرض جلسة قديمة من نطاق مختلف؛ تغيير النطاق يفرغ البيانات القديمة ويمنع استجابات التحميل والحصة الحية المتأخرة من استعادة النطاق السابق.
5. لا تعديل على scoring، RBAC، commerce، PostgreSQL schema أو API contract.

## تتبع العلاقة

`Teacher (authenticated)` → `/school-teacher-dashboard?schoolId=...` → `GET /api/v1/schools/teacher-workspace` → `organizations/transport/http/teacher_workspace.go` → `organizations/application.Service.TeacherWorkspace` (role teacher) → `organizations/repository/postgres.TeacherWorkspace` (active school membership + active teaching assignment + active class, class membership counts) → `TeacherWorkspacePage` → `/school-teacher-dashboard/classroom?schoolId=...&assignmentId=...` → `ClassroomTeacherPage` → existing classroom endpoints with server-side authorization.

## الاختبارات المطلوبة وحدود الإثبات

- `apps/web/tests/e2e/organizations-teacher-school-scope.spec.ts`: مدرس بمدرستين، اختيار المدرسة ب، الرجوع، reload، منع تسرّب الفصل الآخر، فشل GET ثم إعادة المحاولة، سحب الإسناد، دور غير معلم، انتقال الفصل وتثبيت النطاق، 390/820/1440. **HTTP mocks** وليست شهادة قاعدة بيانات حية أو صورة أصل↔Go.
- `internal/organizations/repository/postgres/teacher_workspace_scope_integration_test.go`: PostgreSQL معزول تحت `DATABASE_URL`، مدرستان/فصلان، فصل بيانات الطالب، سحب عضوية المعلم، إيقاف التكليف. عند غياب `DATABASE_URL` الاختبار SKIPPED، لا PASS.
- اختبارات Backend/Database/Frontend/E2E على **SHA النهائي** مطلوبة قبل أي قرار دمج. اختبار RED الأول أضيف في `af5136e`، لكن نتيجة E2E لذلك الرأس أُلغيت بعد رفع تغييرات لاحقة؛ لا ندعي RED مقاسًا دون تشغيل مكتمل.

## ما لم يكتمل

- التبويبات الأصلية: التعلم والجاهزية، بنك التحضير، تقارير الحصص، مهارات الحصص، اختباراتي وتكليفاتي، الشهادات؛ تحتاج عقود Go/المستهلك كاملة قبل تفعيلها.
- أزرار الجدولة والشهادات، رادار المهارات، اختبارات المعلم وتفاعل الحصة مقابل المصدر لم تعتمد بصريًا.
- لا توجد صور Legacy↔Go بنفس الحساب والبيانات، ولا اختبار حقيقي متكامل من جلسة المتصفح إلى Go ثم PostgreSQL للفصل في هذه الشريحة.
- الحفظ/المسودة بعد فشل كتابة غير منطبق على اختيار المدرسة (read-only)؛ يجب إثباته عند استعادة تبويبات التحرير.
- استمرار مقارنة شاشة المعلم الأصلية بجميع الحالات والأدوار إلزامي. **التطابق الكامل PARTIAL/NOT PROVEN**.

**الخطوة التالية:** تشغيل البوابات الأربع على SHA النهائي، معالجة الإخفاقات دون تخفيف الاختبارات، ثم استعادة تبويب معلم أصلي كامل ببيانات Go/PG وعلاقات الفصل مع مقارنة صور 390/820/1440.
