# بطاقة الدفعة G5: خدمات الطالب والمساعد الذكي والتواصل العائم (WhatsApp)

- **Batch ID:** G5_STUDENT_SERVICES_AND_AI
- **الهدف المحدود:**
  1. التحقق من وجود زر "تواصل معنا" العائم عبر واتساب (`FloatingContactWidget.tsx`) باللون المعتمد عالمياً لواتساب (`#25D366`) ورابط المحادثة المباشر المرمز (`https://wa.me/...`).
  2. التحقق من ويدجت المساعد الذكي العائم للدردشة والاستفسارات السريعة (`ChatWidget.tsx`) مع الاقتراحات السريعة (خطة المذاكرة، شرح الكسور، مراجعة الأخطاء).
  3. التأكد من دمج المكونين في جذر التطبيق (`src/app/App.tsx`) وظهورهما في صفحات المنصة ولوحة الطالب.
- **الملفات المملوكة:**
  - `apps/web/src/features/support/FloatingContactWidget.tsx`
  - `apps/web/src/features/support/ChatWidget.tsx`
  - `apps/web/src/app/App.tsx`
- **العقود المستهلكة:**
  - التوثيق: `docs/migration/GEMINI_WHOLE_PLATFORM_DELIVERY_CONTRACT_AR.md` (القسم 6 بند الذكاء والتواصل)
- **خطوات التحقق:**
  1. التحقق من تركيب المكونات في `src/app/App.tsx` (PASS).
  2. فحص بناء الواجهة `npm run typecheck` و `npm run build` (PASS).
- **معيار القبول:** وجود زر واتساب العائم والمساعد الذكي في الواجهة، واجتياز البناء التام.
