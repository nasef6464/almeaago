---
name: almeaa-ai-tutor-guard
description: >-
  Audits AI tutor assistant workflows, daily token quotas, rate limits, prompt safety,
  and intelligent caching in PostgreSQL (ai_question_assist_cache) to prevent duplicate LLM calls.
---

# ALMEAA AI Tutor & Assistance Guard

## الغرض
حوكمة استدعاءات نماذج الذكاء الاصطناعي للمساعد التعليمي للطالب، وحماية الموارد عبر الكاش الذكي، وضمان التقيد بالحدود اليومية.

## القواعد والتطبيقات
1. **الكاش الذكي للأسئلة (`ai_question_assist_cache`):**
   - قبل إرسال السؤال إلى مزود الذكاء الاصطناعي، يتم البحث في جدول الكاش عن شرح مسجل لنفس السؤال والمهارة.
   - إذا وُجد شرح مسبق معتمد، يُعاد فوراً دون أي استهلاك للـ Tokens.
2. **الحدود اليومية (Daily Rate Quotas):**
   - فحص جدول `ai_usage_daily` للتأكد من عدم تجاوز الطالب أو المعلم للحد الأقصى المسموح يومياً.
3. **أمان الإجابات وحماية السياق:**
   - منع حقن الأوامر (Prompt Injection) وضمان تقديم شروحات تعليمية خطوة بخطوة باللغة العربية دون تقديم الإجابة الجاهزة مباشرة لتشجيع التعلم الذاتي.
