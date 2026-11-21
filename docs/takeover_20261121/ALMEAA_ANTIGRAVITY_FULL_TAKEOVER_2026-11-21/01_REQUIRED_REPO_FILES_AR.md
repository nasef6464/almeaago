# خريطة الملفات الفعلية المطلوبة لـAntigravity — اقرأ قبل أن تعدّل

**تنبيه:** هذه **خريطة مسارات في مستودعات GitHub**، وليست نسخًا مجمدة منها. جميع ملفات الكود تُقرأ من أحدث checkout المحلي مع مقارنة `origin/main`. لا تنسخ ملفات غير موجودة عبر التخمين؛ تحقق بـ`Test-Path`/`git ls-files`. روابط `references/` في الحزمة نسخ من التقارير المقدمة وليست بديلًا عن مصدر GitHub. جميع المسارات أدناه نسبية لجذر المستودع المحدد.

## 1) قراءة إلزامية — `almeaago` (المشروع الجديد)

| الملف | الغرض | التصرف |
|---|---|---|
| `AGENTS.md` | دستور العمل والـparity وحقوق الكتابة | READ، أضف ملحقًا صغيرًا فقط بعد المصالحة |
| `.agents/rules/no-redesign.md` | منع التغيير البصري المخالف للأصل | READ/ENFORCE |
| `docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md` | **الخطة العليا الوحيدة** | READ/UPDATE checkpoint وفق الحاجة، لا استبدال |
| `docs/migration/OWNER_BATCH_DELIVERY_CONTRACT_AR.md` | تعريف الدفعة والتسليم | READ |
| `docs/migration/26_WHOLE_PLATFORM_UI_RESTORATION_AR.md` | سجل استعادة جميع شاشات الأصل | READ |
| `docs/migration/17_PLATFORM_POLICY_EXECUTION_CHECKPOINT_AR.md` | السياسة التربوية المعتمدة | READ |
| `docs/superpowers/specs/2026-10-28-platform-pedagogical-policy-design.md` | عقود الكيانات والتعلم | READ |
| `docs/migration/19_API_MOUNTS_AND_ASSESSMENT_OWNERSHIP_AR.md` | مالك واجهات الاختبار والمدارس | READ if affected |
| `docs/migration/owner-handoff/2026-11-01/README_AR.md` | مدخل سجل الاستلام | READ |
| `docs/migration/owner-handoff/2026-11-01/CHECKPOINT_AR.md` | آخر نقطة استئناف موثقة؛ قديمة وتحتاج مقارنة HEAD | READ/UPDATE موحد |
| `docs/migration/owner-handoff/2026-11-01/gap-register.json` | سجل الفجوات القائم | READ/UPDATE بدل سجل منافس |
| `docs/migration/owner-handoff/2026-11-01/verification.json` | الإثبات لكل فجوة | READ/UPDATE |
| `docs/migration/owner-handoff/2026-11-01/PRODUCT_LOGIC_CONTRACT_AR.md` | معنى تدريب/محاكي/مهارة/موضوع | READ |
| `docs/migration/owner-handoff/2026-11-01/CAPABILITY_CONTRACT_TEMPLATE_AR.md` | قالب رحلة المجال | READ |
| `docs/migration/owner-handoff/2026-11-01/LOCAL_TOOLCHAIN_AR.md` | بيئة Windows المعروفة تاريخيًا؛ لا تفترض ثباتها | READ |
| `docs/CURRENT_STATE.md`, `docs/WORKING_SET.md`, `docs/PARITY_MATRIX.md` | حالة العمل والـparity والدفعة الحالية | READ/UPDATE بحقائق SHA لا بتوقعات |
| `docs/ENGINEERING_COMPLETENESS_CHECKLIST_AR.md` | المرجع الحالي للمحاور الـ16 | READ/TRACEABILITY |
| `docs/ENGINEERING_OPERATING_MANUAL_AR.md`, `docs/DEVELOPMENT_PROTOCOL.md` | قواعد هندسية إضافية | READ |
| `docs/architecture/PROJECT_MAP.md` | خريطة الملكية | READ |
| `docs/architecture/VISUAL_PARITY_POLICY.md` | قبول الصور | READ |
| `docs/architecture/ERROR_OWNERSHIP_MAP.md` | مَن يملك الخطأ في كل طبقة | READ |
| `docs/architecture/RESOURCE_BUDGET_POLICY.md`, `docs/architecture/INDEX_PLAN_AR.md` | تكلفة وأداء | READ relevant |
| `docs/blueprint/00_MASTER_INDEX_AR.md`, `docs/blueprint/02_ROLES_SCOPES_RELATIONSHIPS_AR.md` | القدرات والصلاحيات | READ |
| `docs/blueprint/04_ASSESSMENT_ATTEMPTS_RESULTS_AR.md`, `docs/blueprint/05_STUDENT_LEARNING_FOUNDATION_AR.md` | رحلة الطالب والتقييم | READ relevant |
| `docs/blueprint/11_PARITY_TESTING_ACCEPTANCE_AR.md`, `docs/blueprint/17_UI_SCREEN_WORKFLOW_MAP_AR.md` | قبول الرحلات والشاشات | READ relevant |
| `docs/blueprint/18_MODULE_API_BOUNDARY_MAP_AR.md`, `api/openapi/openapi.yaml` | العقود والـAPI | READ relevant |

## 2) وثائق Gemini/Antigravity الموجودة فعلًا — لا تعِد إنشاءها

المسارات الموجودة في `docs/migration/`:

- `GEMINI_START_HERE_FULL_PROMPT_AR.md` — تكليف قديم يتضمن عبارة Codex supervisor؛ **التكليف الحالي يجعل Antigravity مسؤولًا منفردًا** ويطلب مراجعة مستقلة داخل العمل.
- `GEMINI_WHOLE_PLATFORM_DELIVERY_CONTRACT_AR.md` — شامل الأدوار والقدرات والواجهات والأفعال، اقرأه كله ثم طبّقه كمرجع تابع للخطة 03.
- `GEMINI_EXECUTION_PLAYBOOK_AR.md` — دورة الاستلام ← الشريحة ← الأدلة ← التحقق.
- `GEMINI_MODULES_AND_AGENT_OWNERSHIP_AR.md` — ملكية الملفات وحدود الموديولات.
- `GEMINI_ACCEPTANCE_AND_REGRESSION_AR.md` — صور وقيود قبول.
- `GEMINI_SUPERVISED_WORK_QUEUE_AR.md` — مهام تاريخية تحتاج مصالحة مع الجاري.
- `GEMINI_CURRENT_HANDOFF_AR.md` — **يُفضل استخدامه كسجل تلخيص واحد** بشرط مواءمته مع CHECKPOINT الرئيسي، ولا يُنشأ سجل موازٍ بلا حاجة.
- `GEMINI_CURRENT_HANDOFF_AR.md` لا يثبت حالته تاريخية بمجرد وجوده: اقرأ أحدث commit ورأس main.
- `19_LEGACY_UI_100_PARITY_MASTER_PLAN_AR.md` ظهر في GitHub وقت الفحص رغم وثيقة أقدم تقول إنه غير موجود؛ استخدمه مرجعًا فقط بعد مراجعة علاقته بخطة03.

## 3) أدوات التنفيذ والاختبارات الأساسية — `almeaago`

**CI/GitHub:**

- `.github/workflows/backend.yml`
- `.github/workflows/frontend.yml`
- `.github/workflows/frontend-e2e.yml`
- `.github/workflows/database.yml`
- `.github/workflows/pr-overlap-audit.yml`
- `.github/workflows/pr-gate-readiness.yml`
- باقي `.github/workflows/*.yml` المرتبطة بالشريحة؛ افحص `paths` و`required` لا تعتمد على الاسم.

**إعداد وبنية/HTTP:**

- `go.mod`, `go.sum`, `sqlc.yaml`, `migrations/*.up.sql`, `migrations/*.down.sql`
- `cmd/api/main.go`, `cmd/worker/main.go`
- `internal/platform/httpserver/server.go`
- `internal/platform/cache/redis.go`, `internal/platform/cache/store.go`
- `internal/platform/security/**`, `internal/platform/observability/**`
- `render.yaml`, `docker-compose.yml`, `.env.example` — **اقرأ النماذج فقط، لا تطبع أسرار .env ولا تغيّر نشرًا**.
- `apps/web/package.json`, `apps/web/playwright.config.ts`, `apps/web/vite.config.ts`, `apps/web/src/app/App.tsx`
- `apps/web/src/components/ui/Skeleton.tsx`
- `scripts/parity/pr-gate-readiness.mjs`, `scripts/parity/pr-overlap-audit.mjs`
- `scripts/parity/screen-inventory.mjs`, `scripts/parity/route-inventory.mjs`, `scripts/parity/api-mount-inventory.mjs`
- `scripts/parity/verify-vertical-slice.mjs`, `scripts/parity/verify-multi-role-workspaces.mjs`

## 4) أول مجموعة فشل E2E — ملفات اختبار فعلية مؤكد ظهورها

كل مسار يبدأ من `apps/web/`:

| اختبار | ماذا تفحص أولًا | كود يتبع العطل |
|---|---|---|
| `tests/e2e/auth-single-dialog.spec.ts` | `ERR_BLOCKED_BY_CLIENT`، `/login`، modal واحد | `src/app/App.tsx`, `src/features/auth/components/AuthModal.tsx`, `src/features/public/header/OriginalHeader.tsx`, `playwright.config.ts` |
| `tests/e2e/admin-and-learning-spaces-complete.spec.ts` | موضوع تأسيس لا يظهر | `src/features/learning/pages/LearningSpacePage.tsx`, `src/features/learning/components/FoundationTopicDialog.tsx` |
| `tests/e2e/organizations-school-report-parity-retry.spec.ts` | زر اختبارات المدرسة وقائمة الأدوار | `src/features/organizations/pages/SchoolDirectorDashboardPage.tsx` |
| `tests/e2e/student-report-scope-failure.spec.ts` | تحميل النتائج وتغير نطاق المسار | `src/features/reporting/pages/ReportsPage.tsx` |
| `tests/e2e/track4_enterprise_ai_system.spec.ts` | **95 فشلًا**؛ تأكد هل الاختبارات تقيس ميزة معتمدة أم تصورًا جديدًا | `src/features/ai/**`, `src/features/operations/**`, `internal/ai/**` |
| `tests/e2e/track3_hybrid_access_interactive_video.spec.ts` | **67 فشلًا**؛ فحص صلاحيات الفيديو والاشتراك وواقع الـLegacy | `src/features/learning/**`, `src/features/commerce/**`, `internal/content/**` |
| `tests/e2e/track2_schools_contracts_modules.spec.ts` | **48 فشلًا**؛ العقود والقدرات/الأذونات | `src/features/organizations/**`, `internal/organizations/**`, `internal/commerce/**` |
| `tests/e2e/enterprise_b2b_journeys.spec.ts` | رحلة مدرسية متعددة الوحدات؛ صنف test scope | `internal/organizations/**`, `internal/assessment/**`, `src/features/organizations/**` |
| `tests/e2e/track1_schools_acquisition.spec.ts` | ميزة عرض المدارس/حاسبة العائد؛ هل موجودة فعلًا في الأصل؟ | `src/features/public/**`, `src/features/commerce/**` |
| `tests/e2e/organizations-supervisor-roster-parity.spec.ts` | قائمة المشرف وتعارض النطاق | `src/features/organizations/pages/SupervisorDashboardPage.tsx` |
| `tests/e2e/parents-dashboard.spec.ts`, `tests/e2e/parents-scope-refresh.spec.ts` | ولي الأمر والأبناء وأثر إلغاء الربط | `src/features/parents/**`, `internal/parents/**` |
| `tests/e2e/assessment-attempt.spec.ts`, `tests/e2e/assessment-results.spec.ts` | سلامة الاختبار والتصحيح والتقرير | `src/features/assessment/**`, `internal/assessment/**` |
| `tests/e2e/question-bank-admin.spec.ts` | هوية السؤال والصور وخيارات الإجابة | `src/features/questionbank/**`, `internal/questionbank/**` |

**المسارات البرمجية في العمود الأخير هي أماكن بحث أولية، وليست إثباتًا أن العيب فيها.** اقرأ الـnetwork trace لتحديد الـDomain الحاسم قبل التعديل.

## 5) بوابات المنطق والبيانات حسب الملكية

| Domain | استكشف أولًا | السلطة |
|---|---|---|
| Identity/Auth | `internal/identity/{domain,application,transport,repository}/**` | مصادقة/جلسات/استرداد وCSRF |
| Organizations/Schools | `internal/organizations/**` | عضوية مدرسة، مدرس/فصل، توجيه ومدير |
| Taxonomy | `internal/taxonomy/**` | المسار والمادة والمهارة والعرض والنشر |
| Question Bank | `internal/questionbank/**` | السؤال والإجابة والنسخة والصور |
| Assessment | `internal/assessment/**` | Version/Attempt/Result/Scoring/Assignments |
| Learning | `internal/learning/**` | Progress/Evidence/Review/Adaptive/Study plans |
| Content | `internal/content/**` | دورات/دروس/عرض وهوية الصفحة |
| Parents | `internal/parents/**` | نسب الأبناء/الصلاحيات المحدودة |
| Commerce | `internal/commerce/**` | Price/Entitlement/Payments/Grants |
| AI | `internal/ai/**` | مزودون وشرح وتوليد بدون سلطة تصحيح |
| Reporting/Operations | `internal/reporting/**`, `internal/operations/**` | تجميع مشروع وسجلات تدقيق |
| Platform | `internal/platform/**` | cross-cutting لا منطق منتج مكرر |

**أجزاء Adaptive الموجودة أصلًا:** `internal/learning/domain/adaptive_selection.go`, `internal/learning/repository/postgres/adaptive_selection.go`; `scripts/parity/adaptive-selection-golden.mjs`; `docs/migration/25_ADAPTIVE_SELECTION_DELIVERY_AR.md`. **لا تكتب خوارزمية بديلة قبل مقارنة البيانات والسياسة الحالية.**

## 6) المصدر القديم `almeaacodax` — للقراءة فقط

أول قراءة: `AGENTS.md` → `docs/MASTER_CONTROL/README_AR.md` → `docs/MASTER_CONTROL/ALMEAA_GRAND_MASTER_PLAN_AR.md` → `docs/MASTER_CONTROL/CURRENT_EXECUTION_STATUS_AR.md` → `docs/MASTER_CONTROL/STUDENT_SKILL_FOUNDATION_ACTION_POLICY_AR.md` → `docs/REFERENCE_CENTER/REFERENCE_REGISTRY.json`.

في رحلة الشاشة/الدور المعينة، ابحث في **الفروع الفعلية**: `App.tsx`, `pages/**`, `components/**`, `dashboards/**`, `services/**`, `server/src/**`, `styles/**`, `hooks/**`, `contexts/**`. وثيقة سابقة تشير إلى `components/MainLayout.tsx` و`pages/Landing.tsx` و`components/Header.tsx`; تحقق من الملفات الفعلية لا تعتمد على الاسم فقط. أدوار المدرسة ونطاق الدروس في المصدر قد تغيرت بعد snapshot أكتوبر؛ مرجع المقارنة هو أحدث Legacy main.

## 7) بنك المهارات الحقيقي (14 تخصصًا موجودة)

داخل `.agents/skills/<name>/SKILL.md`؛ افتح **مهارة واحدة أو أكثر بحسب المشكلة، لا كلها بلا هدف**:

`almeaa-ai-tutor-guard`, `almeaa-api-contract-validator`, `almeaa-arabic-normalizer`, `almeaa-ci-health-monitor`, `almeaa-commerce-tap-guard`, `almeaa-content-taxonomy-guard`, `almeaa-db-migrator`, `almeaa-learning-workflow-validator`, `almeaa-parity-checker`, `almeaa-pr-controller`, `almeaa-rbac-audit`, `almeaa-release-orchestrator`, `almeaa-rtl-browser-verifier`, `almeaa-school-director-validator`.

## 8) معنى «كل الملفات»

Antigravity مسؤول عن **كل المستودع، لا قائمة مسارات مغلقة**. هذا الملف يحدد **أول ملفات واجبة القراءة ومواضع البحث والإصلاح**؛ كل ما يظهر في inventory/trace يدخل السجل. لا تُنسخ آلاف ملفات المستودع ضمن حزمة واحدة؛ خذها من GitHub مباشرة كي لا تخلق نسخة قديمة موازية.
