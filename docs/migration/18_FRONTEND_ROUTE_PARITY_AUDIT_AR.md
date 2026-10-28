# ALMEAA — الجرد الآلي الأول لمسارات الواجهة: المصدر مقابل Go

**الحالة:** P0 / INVENTORIED PARTIALLY — **ليست شهادة تكافؤ وظيفي أو بصري**.
**التاريخ:** 2026-10-28.
**Legacy baseline:** `nasef6464/almeaacodax@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`، الملف `app/AppRouteTree.tsx`.
**Go baseline:** `nasef6464/almeaago@75b4afb752894dcf15d77134d5069cc5bbb7cb92`، الملف `apps/web/src/app/App.tsx`.

## 1. الدليل القابل لإعادة التشغيل

استخراج `path="..."` المعلنة صراحة على عناصر React Router `<Route>`، مع إزالة التكرار. تم حفظ قائمة المصدر المنظورة عند SHA أعلاه في `baselines/2026-10-28-node-explicit-routes.json` لأن مستودع Go لا يتضمن شجرة Node في CI.

```bash
node scripts/parity/route-inventory.mjs
node scripts/parity/route-inventory.test.mjs
# عند وجود مستودع Node ملاصقًا، للمقارنة المباشرة بدل snapshot:
node scripts/parity/route-inventory.mjs --legacy-source ../almeaacodax/app/AppRouteTree.tsx
```

| المقياس | نتيجة فحص الملفين |
|---|---:|
| مسارات صريحة مميزة في Node | 55 |
| مسارات صريحة مميزة في Go | 54 |
| تشترك في النص الحرفي للمسار | 28 |
| موجودة حرفيًا في Node فقط | 27 |
| موجودة حرفيًا في Go فقط | 26 |

**معنى القياس:** اختلاف URL لا يساوي غياب الوظيفة، وتطابق URL لا يثبت تطابق الصلاحية أو الشاشة أو البيانات أو الأزرار. هذا قياس **مسارات صريحة في هذين الملفين فقط**؛ لا يحصي API ولا redirects وhash compatibility ولا روابط تُنشأ برمجيًا ولا المحتوى داخل اللوحات. يجب إعادة أخذ snapshot عندما يتغير رأس Legacy.

## 2. مسارات Node التي لا يقابلها نفس النص في Go

| مجال العمل | مسارات Legacy-only | فحص التكافؤ التالي |
|---|---|---|
| منشئ الاختبارات والتقييم والنتيجة | `/quiz`, `/quiz/:quizId`, `/results`, `/quizzes`, `/mock-exams`, `/my-quizzes`, `/admin/quiz-gen`, `/barcode-test/:slug`, `/b/:slug` | نفس إنشاء الاختبار وضبطه وتوجيهه وتشغيله وتصحيحه، ثم التقرير وتحليل المهارة؛ طابق `assessment` في Go **وظيفيًا** قبل أي redirect |
| الحصص المباشرة | `/classroom/teacher`, `/classroom/:sessionId/teacher` | ربط لوحة المعلم بالحصة وPIN/عرض الطالب وحق الإظهار؛ Go لديه صفحات مدرسية وحصص، لكن صلاحية المسار وسلوك deep-link غير مثبتين |
| التصفح الدراسي | `/courses`, `/category/:pathId/packages`, `/category/:pathId/:subjectId`, `/section/:catId` | دورات المسار والتأسيس وحالات المحتوى المجاني/المدفوع وروابط Legacy إلى الدرس الصحيح |
| الدروس والخدمات التعليمية | `/qa`, `/book-session`, `/live-sessions`, `/live-sessions/:lessonId` | تحقق إن كانت خدمات فعلية ونشطة؛ إن وجدت فعين عقود API والبيانات والواجهة، وإلا وثق إيقافها دون ادعاء |
| هوية الطالب ومكافآته | `/profile`, `/achievements` | الحساب والملف والجوائز وروابط النتائج والملكية |
| التجارة | `/pricing`, `/cart` | التسعير والسلة والاستحقاقات وحالة الزائر وعدم تكرار الدفع |
| خدمات ودور متخصصة | `/blog`, `/certificate/:code`, `/my-requests`, `/instructor-dashboard` | الشهادات والتحقق، الطلبات، المحتوى العام، صلاحية المدرب |

المجموع في الصفوف = 9 + 2 + 4 + 4 + 2 + 2 + 4 = **27**.

## 3. عائلات Go-only التي تحتاج توصيلها بعقد المصدر

| المجال | ما ظهر في Go | ما لا يجوز افتراضه |
|---|---|---|
| لوحة إدارة المنصة | 10 مسارات تحت `/admin-dashboard/*` (`content`, `taxonomy`, `questions`, `assessments`, `commerce`, `notifications`, `classroom`, `ai`, `reports`, `operations`) | لا تعني 10 روابط أن كل تبويب ووظيفة في `AdminDashboard` الأصلي انتقلا |
| تقييم ومحاولة ونتيجة | `/assessments`, `/assessment-assignments`, `/assessments/:assessmentId/start`, `/assessment-attempts/:attemptId`, `/assessment-results`, `/assessment-results/:attemptId`, `/barcode-test/:code`, `/live-assessment` | لا تدعِ أن `/results` وأي محاولة قديمة قابلتان للاستبدال قبل مطابقة النطاق ونسخة الاختبار |
| التعلم والمراجعة | `/learning`, `/learning/courses/:courseId`, `/review/practice` | تأكد من المسار والموضوع وتدريب نفس المهارة وذاكرة الطالب |
| روابط متخصصة بالمدارس | `/school-director-dashboard/interventions`, `/school-teacher-dashboard/classroom`, `/supervisor-dashboard/interventions` | الموديول المدرسي جزء من النظام كله؛ لا يختصر أدوار الإدارة أو الطالب |
| الحصة | `/classroom/join` | الدخول والرمز والقدرة على عرض جلسة فعلية |
| الإشعارات | `/notifications` | القراءة/الفتح/الحفظ/السرية والأحداث في المصدر |

المجموع = 10 + 8 + 3 + 3 + 1 + 1 = **26**.

## 4. بوابات التنفيذ التالية: من المسار إلى الاختبار الحقيقي

1. **P0-A: Route/UI:** لكل مسار Legacy (وكل تبويب داخله): الدور، الصفحة React، الحالة، الزر، النافذة، التحميل، الخطأ، بيانات الاختبار؛ ثم Go URL أو `GAP`, مع إثبات من الكود.
2. **P0-B: API:** لكل فعل كتابة/قراءة: method/path/DTO/error/auth/RBAC → application owner → SQL/Model → side effects. لا يكفي عدّ الملفات.
3. **P0-C: DB & identity:** رسم PostgreSQL FK/uniqueness مقابل Mongo collections، مع خريطة مستخدم متعدد الأدوار، المدرسة ليست tenant، ومرجعية السؤال والإجابة.
4. **P1/P2: Behavioral parity:** golden fixtures لكل تعليم/اختبار/نتيجة/مهارة؛ إصلاحات اختبار-أول، واستعادة روابط deep-link فقط عند إثبات المعنى.
5. **P3: Visual parity:** 360/390/430/768/1024/1366/1440/1920 (CSS px)، مع نفس الخط والبيانات وحالات الـmodal؛ لقطات الأصل/Go، وتسجيل الفرق واتجاه RTL.
6. **P4–P7:** تجارب الأدوار والحصص والمركزي والدفع/AI، ثم ترحيل staging مع reconciliation وrollback، وإغلاق Runtime/DR والقدرة.

**قاعدة القرار:** كل غائب في المسار أو API = `NOT INVENTORIED / UNKNOWN` حتى يُفتح المصدر ويُختبر؛ لا نصلحه بـ404 redirect عشوائي، ولا نجمّل لوحة Go مع تعطيل رحلة الطالب الأصلية.

## 5. أدلة وقيود التنفيذ

- الآلة: `scripts/parity/route-inventory.mjs`؛ الاختبارات: `scripts/parity/route-inventory.test.mjs`.
- مصدر الشاشة: Node `app/AppRouteTree.tsx`، Go `apps/web/src/app/App.tsx` (المسار الصريح فقط).
- صورة التبويب والمقاس **غير مفحوصين في هذه الدفعة**؛ أي حكم `VISUAL_PARITY` سابق لأوانه.
- قاعدة المعلم/منشئ الاختبار: قد تختلف واجهة المعلم عن واجهة إدارة المنصة، لكن `internal/assessment` يجب أن يبقى مالك تعريف الاختبار والمحاولة والنتيجة؛ لا محركين للتصحيح.
- لا تعدل هذه الدفعة public API ولا الأدوار/الصلاحيات ولا بيانات الإنتاج أو استحقاقاته.

**الخطوة الدقيقة التالية:** ترقيم 55 مسارًا وتبويباتها وربط أفعالها بمسارات HTTP وحراس الصلاحية، بدءًا من هوية الطالب ومنشئ الاختبارات والتقرير؛ وفتح `director_assessments_create.go` لتحديد حد assessment ownership قبل أي توحيد كتابة.
