# School Director Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** إتاحة الملخص التنفيذي للمدرسة بمقاييسه الستة الحقيقية في Go، ثم تقديم أقسام لوحة المدير بالشكل والتفويض المأخوذين من نسخة Node دون فقد الوظائف الحالية.

**Architecture:** PostgreSQL مصدر الأعداد، ودومين organizations يتحقق من هوية مدير المدرسة وصلاحية `SCHOOL_OVERVIEW_VIEW` قبل طلب القراءة من directory متخصصة. UI React يستخدم بيانات JSON واحدة للملخص ويعرض الأقسام داخل shell قابل للطي مع حارس الحالة المتأخرة SCHOOL-003. قسم المدرسة الكبير يُنفذ على دفعات؛ التقرير/النقل/الاختبار له عقود مستقلة.

**Tech Stack:** Go + pgx/PostgreSQL، React + TypeScript + Vite، Playwright، GitHub Actions (بوابات Frontend, Backend, Database, Frontend E2E).

**Spec:** `docs/migration/06_SCHOOL_DIRECTOR_NAV_OVERVIEW_CONTRACT_AR.md`.

## Global Constraints

- مرجع السلوك الحالي: `almeaacodax/dashboards/SchoolDirectorDashboard.tsx`, `directorNavigation.ts`, `schoolDirectorWorkspace.ts`؛ لا يُكتب في Legacy.
- تفعيل كل قسم: `permission` وكذلك `module` إن نصت خريطة المصدر. لا روابط لموديول غير منفذ على أنها حية.
- `school_admin` + `SCHOOL_OVERVIEW_VIEW` المدرسية داخل Go لكل ملخص، مع 403 لمدرسة أخرى.
- أعداد المدرسة الستة مشتقة من SQL scoped ومطابقة للمعاني في الجدول؛ لا `teachers.length` أو `students.length` من 100 سجل، ولا default 0 عند خطأ API.
- استخدام رقمي `schoolVisitEpoch` و`loadEpoch` عند وصول استجابة متأخرة؛ لا تغيير لمدرسة حالية من رد مدرسة سابقة.
- 360/390/430/768/1024/1366/1440/1920 RTL؛ المقارنة المرئية مع حالات وبيانات Node متماثلة.
- لا حذف لأي جدول أو migration على بيانات المستخدمين، ولا نشر إنتاج؛ PRs صغيرة فقط وmerge عند نجاح أربع بوابات HEAD ذاته.

## Review Focus

1. مدرسة غير مفوضة: backend يرد 403 ولو أرسلت الواجهة schoolId يدويًا (Task 2).
2. معلم واحد مكلف بفصلين: يعرض مؤشر المعلمين **1** لا **2** (Task 1 وTask 2).
3. اختبار منشور للمدرسة لكنه مملوك لمنشئ آخر ويستهدف فصلًا: لا يُحذف من عدد الاختبارات بسبب `owner_school_id` (Task 1).
4. تبديل مدرسة أ→ب→أ أثناء تأخر الملخص: لا تنقلب البطاقات أو المدرسة أو إشعار الخطأ (Task 3).
5. حق قراءة overview فقط بلا صلاحيات الفصول/التكليفات: تظهر الستة مؤشرات المسموح بها دون كشف قوائم محمية أو زر إدارة (Task 3).

---

## Task 1 — تثبيت دلالات المقاييس الستة ببيانات اختبار

**Files:**
- Review: `server/src/modules/schools/application/schoolDirectorWorkspace.ts`, مسار `schoolAssessmentAudience` في Legacy.
- Review: `migrations/000001_platform_foundation.up.sql`, `000002_organization_access_foundation.up.sql`, `000008_organizations_core.up.sql`, `000020_assessment_foundation.up.sql`, `000036_realtime_smart_classroom.up.sql`.
- Create: `internal/reporting/repository/postgres/director_overview_integration_test.go` (اختبار PostgreSQL مع بيانات معقمة واتصال test).
- Update: `docs/migration/06_SCHOOL_DIRECTOR_NAV_OVERVIEW_CONTRACT_AR.md` لتثبيت أي mapping حُسم بالدليل.

**Interfaces:** يثبت `org.DirectorOverviewMetrics` بالأسماء `students`, `classes`, `teachers`, `supervisors`, `schoolAssessments`, `completedSmartClasses` و`org.DirectorOverview` الذي يتضمن `school` و`classes`؛ تستعملهما Task 2.

- [ ] **Step 1: Write RED integration table cases.** مستند الحالات: طالب active وسجل suspended؛ فصلان نشطان؛ معلم واحد بتكليفين بنفس المادة؛ مشرف مدرسة ومشرف فصل مكرر؛ اختبار منشور ضمن school audience مع owner آخر؛ جلستان واحدة `ended` وأخرى `archived`. توقع قيمًا محددة للستة ولا تُسقط حالة الاختبار صاحب مالك آخر.
- [ ] **Step 2: Run database test.** `go test ./internal/reporting/repository/postgres -run DirectorOverview -count=1`؛ يفشل لغياب الدالة أو لعدم تطابق الدلالات.
- [ ] **Step 3: Resolve owner/membership edge cases.** أثبت mapping من Node إلى مخطط PostgreSQL باختبارات SQL فعلية؛ إذا لم يُمثل PostgreSQL جمهور الاختبار أو المشرف القديم فلا تُصدر مؤشرًا مضللًا — وثق المخطط/الترحيل الناقص كعائق مستقل.
- [ ] **Step 4: Run same test GREEN** وأعد مراجعة الستة توقعات. التزم بحدود SQL المدرسية والفهرسة القائمة؛ لا استعلام لكل طالب/اختبار.
- [ ] **Step 5: Commit** ملفات الاختبار وmapping، مع hash وسجل فحص.

## Task 2 — عقد API للملخص بصلاحية Go

**Files:**
- Create: `internal/organizations/domain/director_overview.go` (أنواع DTO الموضحة أعلاه).
- Modify: `internal/organizations/application/director_core.go` (قراءة جديدة بعد `requireDirectorPermission`).
- Modify: `internal/reporting/repository/postgres/school_director_directory.go` أو ملف `director_overview.go` في نفس الحزمة.
- Modify: `internal/organizations/transport/http/legacy_handler.go` و`legacy_director_core.go`.
- Test: `internal/organizations/application/director_core_test.go` و`internal/organizations/transport/http/legacy_director_core_test.go` وPG test من Task 1.

**Interfaces:** `Service.DirectorOverview(ctx context.Context, actor identity.User, schoolID string) (org.DirectorOverview,error)`؛ `DirectorDirectory.DirectorOverview(ctx context.Context, schoolID string) (org.DirectorOverview,error)`؛ HTTP `GET /api/school-access/director/schools/{schoolId}/overview` بنفس payload العقد القديم.

- [ ] **Step 1: RED policy/HTTP tests.** صلاحية صحيحة → 200 ومقاييس وستة أسماء؛ دور غير مدير → 403؛ مدير مدرسة أخرى أو صلاحية غير مفعلة → 403؛ schoolId فارغ/غير صالح → 4xx بلا SQL غير نطاقي.
- [ ] **Step 2: Run failing tests.** `go test ./internal/organizations/application ./internal/organizations/transport/http -run DirectorOverview -count=1`.
- [ ] **Step 3: Implement minimal Go contract.** backend يمرر actor من جلسة موثوقة؛ حارس المدرسة ثم SQL؛ أي SQL failure ينتج خطأ لا إحصاء صفر. استعمل camelCase JSON الثابت مثل Node. حافظ على `/overview-access` القائم للتوافق.
- [ ] **Step 4: GREEN verification.** نفس test command ثم `go test ./...`، وتحقق JSON fixtures وgofmt وعدم تحريك API المدارس الأخرى.
- [ ] **Step 5: Commit/PR** مستقلة ببوابات Backend/Database؛ لا merge قبل CI.

## Task 3 — Shell أقسام المدير وست بطاقات responsive

**Files:**
- Create: `apps/web/src/features/organizations/components/SchoolDirectorSectionNav.tsx` (خريطة المعرفات/المجموعات وحارس permission/module).
- Modify: `apps/web/src/features/organizations/api/organizations-client.ts` لإضافة `directorOverview(schoolId, signal?)` وDTO.
- Modify: `apps/web/src/features/organizations/pages/SchoolDirectorDashboardPage.tsx` لتجميع الأقسام المدعومة فعليًا وتنقلها مع الحفاظ على أوامر الطلاب/الفصول/المعلمين.
- Test: `apps/web/tests/e2e/organizations-director.spec.ts` (+ screenshot fixtures بمراجعة مرئية).

**Interfaces:** `directorNavItems(context:SchoolContext)` بنفس identifiers وأسماء/ترتيب المصدر؛ `directorOverview(schoolId:string,signal?:AbortSignal):Promise<DirectorOverview>`؛ `overview` يعدّ الستة من الاستجابة فقط، ولا يعتمد على قوائم سابقة.

- [ ] **Step 1: RED E2E.** حساب overview فقط يعرض ستة مؤشرات ولا يطلب teacher/student lists غير المفوضة؛ حساب core يرى أقسام `overview/students/classes/teachers` بالترتيب الصحيح؛ وحدات غير منفذة مؤشرة GAP لا fake link؛ أ→ب→أ مع رد متأخر لا يغير الأرقام.
- [ ] **Step 2: Run failing tests.** `npx playwright test tests/e2e/organizations-director.spec.ts --reporter=line` بمتصفح مشروع مثبت.
- [ ] **Step 3: Implement navigation + overview.** الحفاظ على مسار مدير المدرسة، تكرار تصميم العنوان وتدرج الألوان/RTL، عرض breadcrumb ومجموعات sidebar على desktop وdrawer قابل للوصول على mobile. لا تبديل school context ضمن request قديم، وإخفاء أي قسم غير مفوض.
- [ ] **Step 4: GREEN & responsiveness.** نفس Playwright ثم `npm run build` و`npx playwright test --reporter=line`؛ فحص لقطات 8 مقاسات مقابل Legacy بنفس fixture، وmanual visual approval لإغلاق UI parity لهذا الجزء.
- [ ] **Step 5: Commit/PR** مع لقطات evidence بعد تنقيح بياناتها، وCI للرأس الأخير. أبقِ `reports/assessments/sessions/interventions/transfer/learning-evidence` في backlog المنفصل حتى تكتمل عقودها، دون مدخل UI ميت.

## Execution Checkpoint

- [x] SCHOOL-003 دمج إلى `main` في `dce0ca43de71b9f8180e7df868600fb728816297`، وبواباته الأربع ناجحة، و95/95 E2E محلية.
- [x] توثيق فوارق الـ10 أقسام، الـ6 مؤشرات، والخريطة الأولية للـSQL في `06`.
- [ ] Task 1 PostgreSQL contract fixtures؛ التبعية الأساسية قبل عرض أرقام الإنتاج.
- [ ] Task 2 endpoint + policy tests ثم PR/CI.
- [ ] Task 3 responsive school director UI ثم screenshot parity.

**Next exact action:** افتح حالات اختبار `DirectorOverview` على قاعدة PostgreSQL اختبارية؛ ابدأ بمؤشر المعلمين المميزين والمدارس المختلفة، ثم الاختبارات المدرسية/المشرفين، ولا تُصدر قيماً تخمينية أثناء عدم حسم mapping.
