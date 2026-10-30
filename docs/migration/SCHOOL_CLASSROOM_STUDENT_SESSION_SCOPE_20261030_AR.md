# المدارس والأدوار — عزل حالة الطالب بين الحصص الذكية (2026-10-30)

## مصدر العقد وحدود الملكية
- Legacy للقراءة فقط: `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`، `pages/ClassroomStudentLive.tsx` و`components/classroom/ClassroomStudentWaitingPanel.tsx`. الأصل يمسح الأسئلة والإجابات وحالة التسليم عند تبديل الجلسة/انتهائها، ولا يعرض أسئلة جلسة أخرى.
- Go base: `nasef6464/almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`. نطاق هذا PR فقط `ClassroomStudentPage.tsx` واختبار جديد. لا كتابة في #162/#165/#172/#177/#181/#187/#194/#198/#205/#208، ولا ملفات المحرك الموحد للتصحيح أو الإنتاج أو Legacy.
- لا تغييرات بصرية، ولا زر أو قسم جديد؛ زر «تحديث» الموجود يعيد محاولة الانضمام عند فشله، ويعيد قراءة الحالة بعد الانضمام.

## رحلة المستخدم عبر الطبقات
`طالب → /classroom/:sessionId → POST /api/v1/classroom/sessions/:id/join → realtime/application.Service.Join → org.CanStudentJoinSmartClassroom → PostgreSQL school_memberships + class_memberships + schools + classes → realtime repository.JoinSession → GET /api/v1/classroom/sessions/:id/current → Service.StudentState → participant/session/questions/responses → React ClassroomStudentPage → POST /answers/:ordinal`.

تفصل الخدمة أصلًا بين عضوية المدرسة والفصل وبين التكليف التدريسي؛ تفعيل `SMART_CLASSROOM` يعتمد على عقد المدرسة. هذه الدفعة **لا تعدل** تلك السلطة. حفظ الإجابة/التصحيح وPostgreSQL لم يتغيروا.

## الفرق المثبت من المصدر
- في Go main، `refresh` عند HTTP 403/503 يبقي `state` السابق ويعرضه مع رسالة الخطأ؛ أصل المصدر يمسح الأسئلة عند فشل `loadCurrent`.
- عند تغيير `sessionId` داخل React Router، `join` الفاشل لا يمنع استدعاء `current`؛ وقد يظهر سؤال جلسة سابقة أو طلب GET لجلسة لم ينجح الانضمام إليها.
- استجابة `current` القديمة غير مقيدة بمفتاح الجلسة/تسلسل الطلب؛ يمكنها استبدال نتيجة الجلسة الأحدث.
- زر التحديث القديم يقرأ `current` مباشرة بعد فشل `join`، بدل إعادة التحقق من العضوية.

## إصلاح محدود بلا تعديل RBAC
- قيد العرض على `joinedSessionId === route sessionId === state.sessionId`.
- منع قراءة الحالة عند فشل POST الانضمام، وإعادة POST عند إعادة المحاولة.
- تجاهل ردود الانضمام والقراءة القديمة بعد تغير المسار أو تقدم طلب أحدث.
- عند فشل قراءة حالة الحصة، محو الأسئلة/الإجابات المعروضة حتى ينجح التحديث؛ لا مسح بيانات PostgreSQL ولا إرسال إجابة تلقائية.
- منع إرسال الإجابة من حالة لم تُثبت انتماءها للجلسة الحالية.

## معايير الاختبار وحدود الدليل
- `apps/web/tests/e2e/schools-classroom-student-session-scope.spec.ts`: ثلاث حالات × 390/820/1440 RTL: فشل عضوية B بعد عرض A ثم إعادة الانضمام؛ وصول GET قديم متأخر؛ HTTP 503 ثم استرجاع الحالة عبر «تحديث». صور Go داخل `test-results/schools-classroom-*.png`.
- يجب تسجيل RED وGREEN وSHA وروابط بوابات Backend/Frontend/Database/Browser الفعلية على رأس PR، ولا تعني CI وحدها تطابقًا مع Legacy.
- هذه اختبارات HTTP مع mocks، **وليست** شهادة عضوية/تكليف/استحقاق حقيقية في PostgreSQL؛ ولا توجد أزواج صور Legacy↔Go بنفس الدور/البيانات. حالة التكافؤ الكلي PARTIAL.
- يظل إثبات الاستمرار بعد إعادة التحميل وحفظ الإجابات عبر قاعدة البيانات، ومقارنة مشغل الأسئلة/الانتظار مع الأصل، وفحص عضوية الطالب بعد سحبها أثناء جلسة قائمة خارج هذا PR. أي تغيير لخادم RBAC/assessment يحتاج عقدًا مستقلًا.

## حالة الدفعة
- تنفيذ حماية الحالة: IMPLEMENTED على فرع مستقل.
- RED→GREEN، صور المقارنة، التكامل الحقيقي: قيد إثبات CI؛ لا ادعاء قبول قبل ظهور السجلات.
- ممنوع الدمج/النشر/cutover قبل مصالحة المصدر والأدلة.
