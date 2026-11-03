# بطاقة الدفعة G6: منظومة المدارس ولوحات الأدوار والقيادة المركزية (Schools & Admin Command Center)

- **Batch ID:** G6_SCHOOLS_AND_PLATFORM_ROLES
- **الهدف المحدود:**
  1. التحقق من صلاحيات وأدوار المدارس: مدير المدرسة (`SchoolDirectorDashboardPage.tsx`)، المعلم (`TeacherDashboardPage.tsx`)، والمشرف (`SupervisorDashboardPage.tsx`).
  2. التحقق من عزل الصلاحيات ومنع الوصول غير المصرح به عبر `internal/organizations` واختبارات الـ RBAC.
  3. التحقق من تكامل لوحة تحكم ولي الأمر (`ParentDashboardPage.tsx`) ومتابعة نتائج الأبناء.
  4. التحقق من مراكز الإدارة المركزية (Admin Command Center): الكتالوج، المستخدمون، الأسئلة، الاختبارات، التجارة، والعمليات.
- **الملفات المملوكة:**
  - `apps/web/src/features/organizations/*`
  - `apps/web/src/features/parents/*`
  - `apps/web/src/features/admin/*`
  - `internal/organizations/*`
  - `internal/parents/*`
- **العقود المستهلكة:**
  - التوثيق: `docs/migration/GEMINI_WHOLE_PLATFORM_DELIVERY_CONTRACT_AR.md` (القسم 6 والقسم 8)
- **خطوات التحقق:**
  1. تشغيل اختبارات Go عبر: `go test ./internal/organizations/... ./internal/parents/... ./internal/identity/... ./internal/commerce/... ./internal/questionbank/... ./internal/operations/...` (100% PASS).
  2. فحص البناء النهائي للواجهة `npm run typecheck` و `npm run build` (PASS).
- **معيار القبول:** اجتياز كافة اختبارات حزم الباك إند والفرونت إند بـ Exit Code 0.
