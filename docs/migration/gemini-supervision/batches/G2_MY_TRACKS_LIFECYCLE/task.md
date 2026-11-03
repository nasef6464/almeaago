# بطاقة الدفعة G2: استعادة دورة حياة تبويب "مساراتي" (My Tracks Full Lifecycle)

- **Batch ID:** G2_MY_TRACKS_LIFECYCLE
- **الهدف المحدود:** استعادة وتأكيد الرحلة الكاملة للطالب في تبويب "مساراتي":
  1. استعراض المسارات المتاحة للتسجيل (المسارات العامة: القدرات، التحصيلي، نافس).
  2. الضغط على زر "تسجيل في المسار" لتأكيد المسار واختيار المرحلة (المستوى).
  3. ظهور بطاقة المسار فوراً في "المسارات الحالية المسجلة" بنسب الإنجاز وعدد الدورات والاختبارات المحسوبة.
  4. الضغط على بطاقة المسار أو عنوانه أو زر "متابعة المسار" ينقل الطالب مباشرة إلى مساحة عمل المسار المعتمدة (`/category/:pathId`) لاستعراض المواد، التأسيس، التدريبات، والاختبارات المحاكية، بدلاً من التحويل العشوائي.
  5. ثبات واستمرار التسجيل في قاعدة البيانات (PostgreSQL / Neon) وعبر الجلسات مع إمكانية إلغاء التسجيل الآمنة ("إلغاء التسجيل").
- **الملفات المملوكة:**
  - `apps/web/src/features/learning/pages/dashboard/PathsTab.tsx`
  - `apps/web/src/features/learning/pages/StudentDashboardPage.tsx`
  - `apps/web/src/features/learning/navigation/*`
  - `internal/learning/navigation/*`
- **العقود المستهلكة:**
  - الأصل: `C:\ALMEAA MAY - codax\pages\Dashboard.tsx` (Lines 420-520)
  - التوثيق: `docs/migration/GEMINI_WHOLE_PLATFORM_DELIVERY_CONTRACT_AR.md` (القسم 6 والقسم 13)
- **خطوات التحقق:**
  1. فحص واختبار `internal/learning/navigation` عبر `go test -v ./internal/learning/navigation/...` (PASS).
  2. فحص واختبار الواجهة عبر `node StudentNavigationProvider.test.mjs` و `node studentPathScope.test.mjs` (9/9 PASS).
  3. ربط أزرار وبطاقات المتابعة بـ `/category/:pathId` بشكل صريح.
  4. فحص TypeScript والبناء للإنتاج (`npm run typecheck`, `npm run build` Exit Code 0).
- **معيار القبول:** نجاح جميع الاختبارات التأسيسية، خلو الواجهة من أخطاء الروابط، وثبات التسجيل في الـ Backend.
