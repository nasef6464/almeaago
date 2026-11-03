# بطاقة الدفعة G3: مساحة التعلم وموضوعات التأسيس والمشغل الموحد

- **Batch ID:** G3_LEARNING_SPACE_FOUNDATION
- **الهدف المحدود:**
  1. التحقق من مساحة التعلم (`LearningSpacePage.tsx`) وموضوعات التأسيس (`FoundationTopicDialog.tsx`).
  2. الفصل التام بين موضوع التأسيس، والمهارة، ودرس الفيديو؛ الموضوع الفرعي يحتوي شروحاته وتدريباته دون خلط.
  3. عدم التشغيل التلقائي القسري (No Autostart) لأول فيديو أو تدريب؛ الطالب يختار الدرس بملء إرادته عبر زر "فتح الدرس".
  4. المشغل الموحد (`SharedVideoPlayer.tsx`) مع قناع يوتيوب العلوي والشفاف، ونسبة العرض السينمائية `aspect-video` وحفظ موضع المشاهدة تلقائياً عبر `POST /api/v1/learning/progress/video`.
- **الملفات المملوكة:**
  - `apps/web/src/features/learning/pages/LearningSpacePage.tsx`
  - `apps/web/src/features/learning/components/FoundationTopicDialog.tsx`
  - `apps/web/src/features/learning/components/SharedVideoPlayer.tsx`
  - `internal/content/*`
- **العقود المستهلكة:**
  - الأصل: `C:\ALMEAA MAY - codax\components\CoursePlayer.tsx` & `C:\ALMEAA MAY - codax\pages\Dashboard.tsx`
  - التوثيق: `docs/migration/GEMINI_WHOLE_PLATFORM_DELIVERY_CONTRACT_AR.md` (القسم 7 البنود 2 و 3 و 7)
- **خطوات التحقق:**
  1. فحص `go test ./internal/content/transport/http/... ./internal/content/application/...` (PASS).
  2. فحص بناء الواجهة `npm run typecheck` و `npm run build` (PASS).
  3. التأكد من حوار التأسيس `FoundationTopicDialog` وخلوه من التشغيل التلقائي.
- **معيار القبول:** التزام كامل بقواعد المالك المعتمدة في القسم 7، واجتياز كافة الفحوص التجميعية.
