# بطاقة الدفعة G4: مشغل الاختبارات والمراجعة البعدية وتحليل الضعف والمعلم الذكي

- **Batch ID:** G4_ASSESSMENT_RUNNER_AND_REVIEW
- **الهدف المحدود:**
  1. التحقق من مشغل الاختبارات (`AssessmentAttemptPage.tsx`): المؤقت التنازلي التفاعلي، التسليم التلقائي الحتمي عند وصول المؤقت إلى 00:00، تلوين الفراغات اللفظية (`<span class="question-blank">___</span>`)، وشبكة الخيارات المتجاوبة (عمودان أو 4 أعمدة في الخيارات المضمنة في الصور).
  2. استعراض الأسئلة بالتفاصيل بعد التسليم (`AssessmentResultsPage.tsx`):
     - الرسم البياني الدائري التفاعلي لنسبة الإنجاز (`ResultDonutChart.tsx`).
     - إمكانية تكبير وفحص رسومات ومخططات الأسئلة الهندسية والعلمية عبر نافذة Zoom التفاعلية (`QuestionImageZoomModal.tsx`).
     - تصنيف الأسئلة حسب (الكل، الخاطئة، غير المجابة، المميزة للمراجعة).
     - استعراض قطع استيعاب المقروء المرتبطة بالسؤال.
     - زر "حفظ للمراجعة" لإضافة السؤال لبنك مراجعات الطالب.
     - استدعاء المعلم الذكي (`QuestionAssistantPanel.tsx`) لتقديم شرح وتوضيح مفاهيمي فوري لكل سؤال دون إعطاء الإجابة مباشرة.
- **الملفات المملوكة:**
  - `apps/web/src/features/assessment/pages/AssessmentAttemptPage.tsx`
  - `apps/web/src/features/assessment/pages/AssessmentResultsPage.tsx`
  - `apps/web/src/features/assessment/components/ResultDonutChart.tsx`
  - `apps/web/src/features/assessment/components/QuestionImageZoomModal.tsx`
  - `apps/web/src/features/ai/components/QuestionAssistantPanel.tsx`
  - `internal/assessment/*`
  - `internal/ai/*`
- **العقود المستهلكة:**
  - التوثيق: `docs/migration/GEMINI_WHOLE_PLATFORM_DELIVERY_CONTRACT_AR.md` (القسم 6 والقسم 7 البنود 1 و 4 و 5 و 6)
- **خطوات التحقق:**
  1. فحص `go test ./internal/assessment/transport/http/... ./internal/ai/transport/http/...` (PASS).
  2. فحص بناء الواجهة `npm run typecheck` و `npm run build` (PASS).
  3. التحقق من تكامل الرسم البياني ونافذة التكبير والمعلم الذكي في شاشة النتائج.
- **معيار القبول:** تجربة بعدية كاملة للمتعلم تطابق الأصل 1:1، خلو كامل من الأخطاء التجميعية، وربط متكامل للتقييم مع الذكاء الاصطناعي.
