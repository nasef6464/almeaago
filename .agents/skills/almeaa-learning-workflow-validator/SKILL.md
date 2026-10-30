---
name: almeaa-learning-workflow-validator
description: >-
  Validates the end-to-end student learning journey: Study Plan -> Course/Lesson Player ->
  Assessment Attempt -> Results Review -> Practice Remediation. Enforces question version
  immutability, prevents silent truncation of study plan days, and verifies atomic submission.
---

# ALMEAA Learning Workflow Validator

## الغرض
التأكد من أن تدفق تعلم الطالب وممارسته للاختبارات يعمل بكفاءة تامة وتكامل حقيقي مع Go وPostgreSQL دون أي انقطاع أو فقدان للبيانات.

## محطات الرحلة التعليمية الإلزامية
1. **خطة المذاكرة (`/plan`):** التأكد من توزيع المهام دون بتر اليوم الأخير وحساب أيام الراحة بنجاح.
2. **مشغل الدروس (`/course/:courseId`):** تتبع تقدم مشاهدة الفيديو بدقة الثواني في `lesson_video_progress` واستئناف العرض.
3. **محاكي الاختبارات (`/assessments/:id/start`):** عزل الجلسة، قفل التسليم الذري، ومنع تكرار المحاولة في حالة الفشل العابر.
4. **شاشة النتيجة (`/assessment-results/:attemptId`):** مطابقة بطاقة النتيجة، عرض تفصيل المهارات، وزر مراجعة الأسئلة الخاطئة.
5. **مراجعة الأسئلة (`/review`):** ضمان استرجاع النسخة المعتمدة الدقيقة للسؤال وقت الاختبار عبر `question_versions`.
