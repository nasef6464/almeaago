# بطاقة الدفعة G0: تدقيق الـ Baseline والاستلام التشغيلي الأول

- **Batch ID:** G0_BASELINE_AUDIT
- **الهدف المحدود:** استلام حالة العمل الجارية، تثبيت SHAs للمستودعين الأصل والهدف، التحقق من خلو العمليات من أي وكلاء عالقين، وتدقيق صحة البناء والاختبارات التأسيسية.
- **الملفات المملوكة:**
  - `docs/migration/GEMINI_CURRENT_HANDOFF_AR.md`
  - `docs/migration/gemini-supervision/*`
- **العقود المستهلكة:**
  - `docs/migration/GEMINI_WHOLE_PLATFORM_DELIVERY_CONTRACT_AR.md`
- **خطوات التحقق:**
  1. التحقق من حالة الفروع وSHAs في `c:\almeaago\almeaago` و `C:\ALMEAA MAY - codax`.
  2. فحص العمليات الخلفية وقوائم المهام (`manage_task list`, `manage_subagents list`).
  3. فحص بناء واختبارات Go API (`go build`, `go test`).
  4. فحص TypeScript والبناء للواجهة (`npm run typecheck`, `npm run build`).
- **معيار القبول:** نجاح جميع أوامر الفحص بـ Exit Code 0، خلو النظام من العمليات العالقة، وتقديم ملف التسليم الرسمي الموحد.
