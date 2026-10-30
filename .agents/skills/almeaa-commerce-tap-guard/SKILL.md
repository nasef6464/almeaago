---
name: almeaa-commerce-tap-guard
description: >-
  Audits commerce transactions, Tap payment provider webhooks, immutable revenue ledger,
  idempotency keys, access codes redemption, and B2B school seat licenses.
---

# ALMEAA Commerce & Tap Payment Guard

## الغرض
حماية وضمان النزاهة المالية لعمليات الدفع والاشتراكات، وتأكيد صحة سجل الإيرادات غير القابل للتعديل (Immutable Ledger) وتراخيص المقاعد.

## القواعد الصارمة
1. **تكامل بوابة الدفع (Tap Payments):**
   - التحقق الصارم من توقيع الـ Webhook الوارد من مزود الدفع قبل تسجيل أي دفعة.
   - استخدام مفاتيح عدم التكرار (Idempotency Keys) لمنع تكرار قيد المبالغ في حساب المستخدم.
2. **دفتر الإيرادات (Immutable Revenue Ledger):**
   - جدول `commerce_revenue_entries` لا يقبل التعديل أو الحذف، وتسجل فيه كل عملية تسوية كقيد فردي.
3. **تراخيص المقاعد وأكواد الوصول:**
   - فحص صحة كود الوصول وصلاحيته التاريخية وعدد المقاعد المتبقية قبل إتمام التفعيل.
   - قفل المعاملة ذرية في PostgreSQL عند استبدال الكود لمنع التفعيل المتزامن لأكثر من طالب على نفس المقعد.
