---
name: almeaa-rbac-audit
description: >-
  Audits role-based access control (RBAC), multi-tenancy boundaries, and permission isolation
  across the 6 core ALMEAA roles: student, teacher, admin, supervisor, school_admin, parent.
  Ensures fail-closed authorization and prevents cross-school data leakage.
---

# ALMEAA RBAC & Multi-Tenancy Auditor

## الغرض
حماية حدود الصلاحيات وضمان عزل المستأجرين (Multi-Tenancy) للمدارس والفصول والمستخدمين، ومنع أي تسرب للبيانات أو وصول غير مصرح به.

## الأدوار الستة المعتمدة
1. `student`: وصول محصور في المسارات المسجلة، محاولات الاختبارات الشخصية، خطة المذاكرة، وسجل المراجعة.
2. `teacher`: وصول محصور في المدرسة المنتسب إليها، والفصول والمواد المسندة إليه عبر `teaching_assignments`.
3. `admin`: وصول كامل لمركز التحكم، مركز المهارات المستقل، إعدادات الهوية والخطوط، والعمليات.
4. `supervisor`: وصول للمدارس والنطاقات الجغرافية المسندة عبر `school_supervisor_scopes` ومتابعة التدخلات.
5. `school_admin` (مدير المدرسة): إدارة شؤون المدرسة المنتسب إليها فقط (المعلمين، الطلاب، الفصول، والتوزيع الصفي).
6. `parent`: وصول محصور في الأبناء المرتبطين صراحة في جدول `parent_student_relationships`.

## خطوات الفحص
1. التأكد من وجود التحقق من التوكن (JWT/Session) في طبقة الـ Middleware.
2. التحقق من فحص نطاق المدرسة (`school_id`) في كل استعلام لقاعدة البيانات لمنع القراءة العابرة للمدارس.
3. التأكد من إرجاع HTTP 403 Forbidden صريح مع رسالة خطأ عربية آمنة عند محاولة الوصول غير المشروع.
