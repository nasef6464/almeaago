---
name: almeaa-ci-health-monitor
description: >-
  Monitors GitHub Actions CI workflows, detects YAML syntax regressions, investigates failed
  runner logs (Database CI, Backend CI, Frontend E2E), and prevents stalled CI runs.
---

# ALMEAA CI Health Monitor

## الغرض
المراقبة المستمرة لخطوط الأنابيب والفحوصات الآلية في GitHub Actions، واكتشاف أي أخطاء في تكوينات YAML أو فشل في الحاويات أو الاختبارات، وإصلاحها فوراً.

## مسارات الـ Workflows الأساسية
- `.github/workflows/backend.yml`: اختبارات Go و linting وتجميع الثنائيات.
- `.github/workflows/database.yml`: اختبارات التكامل لقاعدة بيانات PostgreSQL والـ Migrations.
- `.github/workflows/frontend.yml`: بناء React/Vite وفحص TypeScript `typecheck`.
- `.github/workflows/frontend-e2e.yml`: اختبارات Playwright للمتصفح.
- `.github/workflows/review-saved-http.yml`: اختبارات مسار مراجعة الطالب المحفوظة في PostgreSQL.

## بروتوكول التدخل السريع
1. التحقق من صيغة YAML عبر المحلل اللغوي قبل أي commit لتجنب أخطاء السكالار أو الأقواس غير المغلقة (مثل حادثة PR #253).
2. عند فشل وظيفة في CI، استخراج السجل الكامل عبر `gh run view <run-id> --log-failed` لتحديد سبب الفشل بدقة (هل هو كود أم بنية تحتية).

## تحقّق من انطباق الفحص قبل قراءة لونه

1. سجّل رأس PR ورأس الدمج كلًا على حدة، والملفات المتغيرة واسم الـworkflow المتوقع. طابق حدث التشغيل ومرشحات `paths` مع التغيير.
2. صنّف كل فحص مطلوب `PASS` أو `FAIL` أو `SKIPPED` أو `NOT_TRIGGERED` أو `PENDING`. أرفق رابط التشغيل وSHA، وحافظ على النطاق الذي يغطيه الاختبار.
3. مثال عملي: تغيير صفحة الفصل الذكي وحدها قد يشغّل Frontend CI دون Frontend E2E بسبب المرشحات. سجّل الفحص الغائب، وشغّل الاختبار المناظر محليًا على نفس الرأس. افتح إصلاحًا مركزًا للمرشحات إذا ثبتت الفجوة، وراجع بوابات المستودع قبل الدمج.
4. صنّف Playwright حسب طريقة الحصول على البيانات. اعتراض HTTP يثبت السلوك الذي اختبره المتصفح مع تلك الاستجابات. قبول إجراء حفظ أو إرسال يحتاج اتصالًا بـGo والتخزين المعزول. عند فشل فحص عام قارن بالنسخة الأساسية بنفس البيئة وسجّل سبب الفشل وآثاره.
