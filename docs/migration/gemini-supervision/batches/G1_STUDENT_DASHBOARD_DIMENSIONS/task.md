# بطاقة الدفعة G1: مطابقة أبعاد لوحة الطالب ومحاذاة الشاشات

- **Batch ID:** G1_STUDENT_DASHBOARD_DIMENSIONS
- **الهدف المحدود:** القضاء على الفراغات الجانبية المزعجة (يمين ويسار الشاشة) في لوحة الطالب ومشغل الدورات، ومطابقة أبعاد الحاويات (Container max-width) والـ Spacing مع المنصة الأصلية عبر مقاسات الشاشات القياسية (390×844 للجوال، 820×1180 للتابلت، 1440×900 للمكتبي).
- **الملفات المملوكة:**
  - `apps/web/src/features/student/StudentDashboardPage.tsx`
  - `apps/web/src/features/student/components/SmartLearningPathWidget.tsx`
  - `apps/web/src/features/learning/LearningSpacePage.tsx`
- **العقود المستهلكة:**
  - الأصل: `client/src/pages/StudentDashboard.tsx`
  - التوثيق: `docs/migration/GEMINI_WHOLE_PLATFORM_DELIVERY_CONTRACT_AR.md` (القسم 11 و 12)
- **خطوات التحقق:**
  1. فحص `max-w-*` و `px-*` في `StudentDashboardPage.tsx` و `LearningSpacePage.tsx`.
  2. التأكد من امتداد الخلفيات وتصميم الحاويات من الحافة للحافة (Edge-to-Edge) مع توحيد هوامش التجاوب حسب كود Codax الأصلي.
  3. التقاط لقطات شاشة ثلاثية الأبعاد (Mobile, Tablet, Desktop) ومقارنتها بصرياً.
  4. قياس Cumulative Layout Shift (CLS) والتأكد من بقائه 0.0000.
- **معيار القبول:** لا يوجد أي فراغ غير مبرر يمين أو يسار الصفحة على العرض المكتبي والتابلت، خلو التمرير الأفقي تماماً (zero horizontal overflow)، وثبات التصميم مع لقطات شاشة موثقة.
