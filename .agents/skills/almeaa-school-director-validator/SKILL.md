---
name: almeaa-school-director-validator
description: >-
  Validates school director operations, literal roster search, 12-class grid matrix,
  teacher assignment persistence, serial student class moves, and projector session scope isolation.
---

# ALMEAA School Director & Classroom Operations Validator

## الغرض
تدقيق ومطابقة شاشات وعمليات إدارة المدرسة والفصول الذكية لتطابق تجربة الأصل في `SchoolsManager.tsx` و `ClassroomSession.ts`.

## العمليات الأساسية المدققة
1. **لوحة مدير المدرسة (`/school-director-dashboard`):**
   - مطابقة مصفوفة شبكة الفصول الـ 12 مع كافة عناصر التحكم في الصفوف.
   - البحث الحرفي في سجل طلاب المدرسة (Literal School Roster Search) بدقة الـ Case والأرقام.
2. **نقل الطلاب بين الفصول:**
   - تطبيق التسلسل التزامني الصارم (Serial Class Moves) لمنع الـ Race Conditions وتعارض المقاعد.
3. **حصص العرض الصفي التفاعلية (Projector View):**
   - عزل الجلسة فوراً عند انتهاء الحصة (`/classroom/:sessionId/projector`).
   - إغلاق العرض ومنع استمرار العرض السابق عند تبديل الجلسة (Fail Closed on session switches).
