---
name: almeaa-pr-controller
description: >-
  Controls GitHub branch lifecycle, pull request triage, and merge readiness for ALMEAA.
  Enforces the RED -> GREEN -> MERGE protocol, prevents file collision across subagents,
  and verifies CI checks before merging to main.
---

# ALMEAA PR Controller

## الغرض
حوكمة وإدارة دورة حياة الفروع وطلبات السحب (PRs) على مستودع GitHub لمنع أي فوضى برمجية أو تعارضات أو تكرار في العمل.

## بروتوكول العمل الإلزامي
1. **التحقق من الملكية وعدم التعارض:**
   - فحص الفروع المفتوحة عبر `gh pr list`.
   - التأكد من عدم وجود فرع آخر يعدل نفس الملفات في نفس الوقت.
2. **منهجية RED ➔ GREEN:**
   - فتح فرع دليل أو اختبار أحمر (RED) يثبت الفجوة دون تعديل كود الإنتاج (مثال: `test/...`).
   - إنشاء فرع إصلاح هندسي محدد (GREEN) يحول الاختبار إلى الأخضر (مثال: `fix/...`).
3. **فحص بوابات الجودة قبل طلب الدمج:**
   - نجاح تجميع Go (`go build ./cmd/api`).
   - نجاح فحص TypeScript (`npm run typecheck`).
   - اجتياز اختبارات GitHub Actions CI بالكامل (`gh pr checks <PR-number>`).
4. **منع النشر غير المصرح:** لا يتم نشر أي كود إلى بيئة الإنتاج أو المساس بالبيانات الحية أثناء هذه المراحل.
