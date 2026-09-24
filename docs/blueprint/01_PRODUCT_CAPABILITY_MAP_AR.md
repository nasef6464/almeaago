# 01 — Product Capability Map

## 1. المنتج العام

ALMEAA منصة تعليمية متعددة السياقات تجمع:

- B2C: طالب فردي يشتري/يفتح محتوى ويتعلم ذاتيًا.
- B2B: مدارس، فصول، معلمون، مشرفون، مدير مدرسة، عقود ووصول.
- Assessment Platform: بنك أسئلة، اختبارات، محاكيات، موجّه، جلسات ومحاولات ونتائج.
- Learning Platform: تأسيس، دورات، دروس، ملفات، تدريبات، مسار ذكي.
- AI Layer: مساعد إداري، Question Assistant، معلم ذكي/صوتي مخطط/جزئي، توليد/تشخيص.
- Operations: إشعارات، مراقبة، audit، backups، integrations.

## 2. المسارات والصفحات الرئيسية الحالية VERIFIED

Routes أساسية في الواجهة:

- `/`, `/dashboard`
- `/category/:pathId`, `/category/:pathId/:subjectId`
- `/courses`, `/course/:courseId`
- `/quizzes`, `/mock-exams`, `/my-quizzes`
- `/quiz/:quizId`, `/results`, `/reports`
- `/favorites` (وظيفيًا تتجه إلى أسئلتي للمراجعة)
- `/review`, `/plan`, `/qa`
- `/book-session`, `/live-sessions`
- `/classroom/:sessionId`, teacher/projector variants
- `/profile`, `/achievements`, `/my-requests`
- `/pricing`, `/cart`, `/checkout`
- Barcode/Public Tests
- `/admin-dashboard`
- `/instructor-dashboard`
- `/school-teacher-dashboard`
- `/school-director-dashboard`
- `/supervisor-dashboard`
- `/parent-dashboard`

## 3. Admin Command Center VERIFIED

التبويبات/المراكز الموجودة حاليًا تشمل:

- نظرة عامة.
- إدارة المسارات/مساحات العمل.
- إدارة الدورات.
- اعتماد المحتوى.
- مركز الدروس.
- المكتبة وملفات الدعم.
- مركز الاختبارات.
- مركز الأسئلة.
- مركز المهارات.
- إدارة المستخدمين.
- إدارة المدربين.
- تشغيل المدارس.
- العضويات.
- المالية والاشتراكات.
- الإشعارات.
- مراقبة النظام.
- الإعدادات.
- إدارة الصفحة الرئيسية.
- الإعلانات.
- خطوط المنصة.
- التكاملات.
- النسخ الاحتياطي.
- إدارة المساعد الذكي.
- الحصص المباشرة.
- اختبارات الباركود.

## 4. Student Capability Map

### التعلم
- اختيار المسار/المادة.
- مساحة تعلم للمادة.
- التأسيس Topics/Subtopics.
- دروس فيديو/محتوى.
- ملفات دعم/مكتبة.
- تدريبات قصيرة.
- اختبارات المادة.
- اختبارات محاكية.
- دورات.
- تقدم الدروس.
- Interactive video progress.

### التقييم
- بدء اختبار.
- Autosave/attempt lifecycle.
- محاولات محددة.
- مؤقت وإعدادات اختبار.
- محاكيات متعددة الأقسام.
- نتيجة عامة.
- تحليل أقسام.
- تحليل مهارات.
- مراجعة السؤال.
- حفظ للمراجعة.
- قائمة أخطائي.
- تدريب علاجي من الأسئلة السابقة.

### التقارير والخطة
- تقاريري.
- خططي.
- أهداف Mastery.
- Weak skills.
- Next Best Action.
- فتح شرح/تدريب من التقرير.
- readiness/action strip.

### أدوات ومشاركة
- سؤال وجواب.
- بطاقات تذكر.
- جلسات مباشرة.
- Classroom join.
- شهادات.
- طلبات الدفع/الشراء.
- إشعارات.

## 5. Teacher/Trainer Capability Map

- إنشاء/تعديل محتوى ضمن managed scope.
- Questions ضمن path/subject scope.
- Assessments ضمن scope.
- إرسال المحتوى للمراجعة.
- مشاهدة reviewer notes.
- دوراتي كمدرب منصة.
- School Teacher workspace للفصول المسندة.
- Teaching assignments.
- مشاهدة roster المصرح به.
- اختبارات موجّهة حسب النطاق.
- Smart Classroom sessions.
- تقارير الفصل/الحصة المصرح بها.
- لا يملك اعتمادًا عامًا أو publication خارج السياسة.

## 6. Supervisor Capability Map

- نطاق مدرسة/فصول/مواد/مسارات فقط.
- الطلاب الواقعون في managed scope.
- تقارير مجمعة ومهارات.
- اختبارات موجّهة.
- مهام/تدخلات حسب النطاق.
- لا يتحول إلى Admin عام.
- لا يرى/يعدل بيانات خارج المدرسة أو assignment.

## 7. School Admin/Director Capability Map

- لوحة منفصلة.
- مدرسة/مدارس مفوضة.
- overview aggregates.
- إضافة طالب ونقله داخل المدرسة عند التفويض.
- فصول، أشخاص، assignments، تقارير بحسب permission.
- School contract/modules/seat capacity.
- لا يمنح نفسه صلاحيات.
- لا يحذف الطالب hard-delete افتراضيًا.
- cross-school access مرفوض.

## 8. Parent Capability Map

- Observer وليس Assessment taker افتراضيًا.
- يرى الطلاب المرتبطين فقط.
- نتائج/تقارير مبسطة.
- مهارات ضعيفة وخطوة قادمة.
- تقرير أسبوعي/WhatsApp عند التفعيل.
- ربط طالب ضمن السياسات الحالية.
- لا يكتب محتوى أو Assessment.

## 9. Platform Admin Capability Map

- إدارة كاملة للمستخدمين والأدوار والنطاقات.
- المدارس والعلاقات والباقات.
- Taxonomy والمسارات والمواد والمهارات.
- Question Bank.
- Assessments/Mock/Public Barcode.
- Content/Courses/Foundation/Library.
- Payments/discounts/access.
- AI providers/config/monitoring.
- Notifications.
- Backup/restore.
- Integrations.
- Audit/operations.
- Homepage/fonts/ads.

## 10. Backend API Domains VERIFIED

Mounted API families:

`health, auth, taxonomy, content, courses, quizzes, question-analytics, media, live-exams, payments, ai, operations, backups, seo, notifications, product-config, school-access, classroom, quiz-results, certificates, discussions, review, leaderboard, search, parent, activities, public-tests`.

## 11. مبدأ إعادة البناء

لا يتم إنشاء شاشة في النسخة الجديدة من اسم الشاشة فقط. لكل Capability يجب تسجيل:

- actor.
- trigger.
- inputs.
- permissions.
- reads.
- writes.
- side effects.
- error states.
- analytics effects.
- media/network cost.
- E2E proof.
