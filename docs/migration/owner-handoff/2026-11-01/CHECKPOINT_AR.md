# نقطة استئناف — 1 نوفمبر 2026

## 26 نوفمبر — نقل طالب بواسطة المشرف / PARTIAL

- المصدر Legacy `ed28102d7084899856de0371dc2c93a3d602d518`، `dashboards/admin/SupervisorDashboard.tsx` في تبويب الطلاب. الاختيار والتأكيد موجودان في الأصل. الفرع `feat/supervisor-student-transfer` فوق إصلاح عقد كشف الطلاب في [#323](https://github.com/nasef6464/almeaago/pull/323) عند `478a549c6468d6747525c5a3bf3485f5e14a880b`. عند بدء الدفعة كان `origin/main` على `dfc35ec0a429e862a174e5bc586142ddd972fefd`.
- المشرف ← كشف «تعلم الطلاب وجاهزيتهم» ← اختيار الفصل وتأكيده ← `PUT /api/v1/schools/{schoolId}/supervisor/students/{studentId}/class` مع `fromClassId` و`classId` وCSRF ← `organizations` ← عضوية مشرف فعالة ونطاق مفوض للفصلين داخل المدرسة نفسها ← نقل ذري في `class_memberships` مع سجل `audit_logs` ← إعادة قراءة كشف الطلاب. الطلب المتكرر آمن، والحساب غير المخول أو الفصل خارج النطاق أو اختلاف المدرسة يُرفض، وتعدد الفصول النشطة يتطلب تصحيح التوزيع أولًا. لا هجرة جديدة.
- المحاور المستخدمة A (ترقيم الفصول)، B (الدور والنطاق وحماية الكتابة)، D/F (التأكيد والخطأ وRTL وسجل التدقيق)، G/H (عقد OpenAPI وإثبات قابل للإعادة). المهارات `almeaa-api-contract-validator` و`almeaa-rbac-audit` و`almeaa-school-director-validator` و`almeaa-db-migrator` و`almeaa-rtl-browser-verifier`. بدأ اختبار النقل HTTP بـRED 404. رابط فحوص معالج التأسيس السابق [#326](https://github.com/nasef6464/almeaago/pull/326/checks) نجح في Backend وDatabase وFrontend وأجزاء E2E الثلاثة عند `09b2efc15fdaebf834ff2e1ba72bd4cd655475f8`، ومعاينة Vercel معلقة عند الفحص. لا دمج أو نشر لهذه الدفعات.
- **PASS محليًا:** اختبار PostgreSQL لطلبين متزامنين، عضوية نهائية واحدة، تدقيق واحد، رفض التداخل بين المدارس والنطاقات وسحب التكليف أو عضوية المدرسة. تجربة المتصفح مع Go وPostgreSQL عبر جلسة مشرف أثبتت النقل والاسترجاع بعد التحديث ورفض الفصل الخارجي والمحلي غير المفوض. لقطات Go في `C:/almeaago/tmp-evidence/supervisor-transfer-stack/rtl` عند 390/820/1440. تمت مراجعة كود الشكل الأصلي، وتبقى مقارنة صور المصدر والهدف **PARTIAL**. أظهر تشغيل محلي مكرر للباقة الأوسع عيب تكرار بيانات fixture اختبار `TestListSchoolsIncludesRealStatsPostgres` في القاعدة المعاد استخدامها، ونجح اختبار النقل الخاص بعده.
- توجيه المالك للدفعة اللاحقة هو تطوير لوحات المعلم والمشرف ومدير المدرسة وتوسيع إمكاناتها عند دمج بحوث العمليات. يبدأ التطوير بجرد كل إجراء حالي ومصدر بياناته ضمن الخطة 03. المعلم يرى أدلة جاهزية طلاب فصله ومادته ويقترح أو يعتمد حصة تقوية. المشرف ينسق التدخلات والمواعيد داخل نطاق تفويضه. المدير يرى احتياجات وسعة المدارس المفوضة ونتائج التدخلات. تُبنى التوصيات على أدلة `learning` ونتائج `assessment`، وتعرضها `reporting` بعد تحقق `organizations`. تبقى القدرات والتحصيلي منفصلين وتظهر «أدلة غير كافية» عند غياب القياس. أول تجربة لاحقة توزع حصص التقوية وفق الاحتياج وسعة المعلم وتعارض الوقت، مع اعتماد بشري وقياس لاحق قبل التعميم. هذا بند متابعة ضمن الخطة القائمة.
- طلب النقل [#328](https://github.com/nasef6464/almeaago/pull/328) مسودة فوق #323، وكود الوظيفة `6e12a3ae1eb6b5cd387b65a605f9230662e42173`. أُدرج اختبار PostgreSQL في Database CI كي ينفذ مع قاعدة فعلية. الاستئناف يبدأ بـ `gh pr checks 328` لمطابقة فحوص الرأس وحالة #323، ثم تتبع الجدول المدرسي وربط الأدوار من المصدر. المطابقة البصرية الشاملة وسريان هذه الدفعة على الموقع الحي غير مثبتين.

## 26 نوفمبر — إتمام حزمة M3 (ولي الأمر والمعلم والمدرب والمدير والمشرف) وتحديث P6/P7 / PARTIAL

- Go main `56bcf2dd` بعد دمج حزم M3 الأربع:
  - **M3-A (ولي الأمر):** [PR #318](https://github.com/nasef6464/almeaago/pull/318) (`a0b3869c`) — المهاجرة `000067_m3_parent_parity` (`parent_approval_status`, `parent_approved_by`, `parent_approved_at` على `commerce_payment_requests`)، وتفعيل إرسال التقرير الأسبوعي وموافقات الدفع وفك الارتباط في `internal/parents` و`ParentDashboardPage.tsx`. التحقق: PASS `go test ./internal/parents/...` (7/7)، و`tsc -b`، و`parents-action-truth.spec.ts` (5/5)، وبوابات CI (`backend`, `database`, `frontend`, `overlap`, `e2e 1-3`).
  - **M3-B (معلم المدرسة):** [PR #319](https://github.com/nasef6464/almeaago/pull/319) (`fb9e3c1f`) — إضافة نقطة `GET /api/v1/learning/evidence` بسياسة الحالات الخمس (`unmeasured`, `insufficient`, `support`, `developing`, `ready`) وتبديل المصدر (`school_assessment` / `platform_self_study`)، واستبدال المسودات المحلية والمهارات الثابتة في `TeacherWorkspacePage.tsx` ببيانات الخادم. التحقق: PASS `go test ./internal/learning/...`، و`tsc -b`، و`organizations-teacher-school-scope.spec.ts` (11/11)، و`learning-school-interventions.spec.ts` (3/3)، وجميع بوابات CI الثماني.
  - **M3-C (مدرب المنصة):** [PR #320](https://github.com/nasef6464/almeaago/pull/320) (`3eace13d`) — ربط `PlatformTrainerDashboardPage.tsx` بنقاط `/api/v1/assessments` و`/api/v1/questions` ومنع الاعتماد الذاتي للمدرب (`draft`/`rejected` ↔ `pending_review` فقط). التحقق: PASS `tsc -b`، و`trainer-discussion-entry.spec.ts` (3/3)، وجميع بوابات CI.
  - **M3-D (مدير المدرسة والمشرف):** [PR #321](https://github.com/nasef6464/almeaago/pull/321) (`56bcf2dd`) — توسيع صلاحيات `internal/assessment` عبر `SchoolAuthorizer` (`CanManageSchool`) لتمكين مدير المدرسة والمشرف ضمن مدرستهما فقط دون إضعاف قيود المعلم أو العزل بين المدارس، وتفعيل استطلاع المراقبة الحية كل 10 ثوانٍ وإرسال تنبيهات الطلاب عبر `/api/v1/notifications/admin/send` في `SupervisorDashboardPage.tsx`. التحقق: PASS `go test ./internal/assessment/application/...` (بما فيها `TestSchoolAdminAndSupervisorSchoolAssessmentRBAC`)، و`tsc -b`، و45/45 اختبار Playwright عبر `organizations-director.spec.ts` و`organizations-supervisor-roster-parity.spec.ts` و`supervisor-assignment-isolated.spec.ts`، وجميع بوابات CI السبع.
- **حالة بوابة P6:** تم التحقق في `Database CI` على كل من `PR #318` و`PR #319` و`PR #321` من تطبيق المهاجرات الـ `67` (`000001..000067`) والتراجع عنها وإعادة تطبيقها، إضافةً إلى تمرين `pg_dump`/`psql` المثبت في `PR #309`؛ وتبقى مطابقة `MongoDB -> PostgreSQL` **`BLOCKED`** محليًا دون تصدير معزول من MongoDB.
- **حالة بوابة P7 والخطوة التالية:** اجتازت مسارات M3 اختبارات RTL (`390/820/1440`) في Playwright وفحص `route-inventory.mjs` (`55/55` مسار Legacy، `legacyOnly: []`). المتبقي: حزم M4–M5 (الفصل الذكي، عقود OpenAPI، والمطابقة البصرية بالصور Legacy مقابل Go). تبقى حالة المنصة العامة **`PARTIAL`**.

## 26 نوفمبر — دمج M1 (الإدارة والعمليات والمدارس) و M2 (رحلة الطالب والتقارير والمسارات) وتحديث P6/P7 / PARTIAL

- Go main `9cca0bce` بعد دمج [PR #313](https://github.com/nasef6464/almeaago/pull/313) (`26419df9`) و[PR #315](https://github.com/nasef6464/almeaago/pull/315) (`9cca0bce`).
- **إنجازات PR #313 (حزمة M1 — الإدارة والعمليات والذكاء الاصطناعي والمدارس):**
  1. تطبيق المهاجرة `000065_m1_admin_ops_ai` وربط حصص الذكاء الاصطناعي للمدارس (`internal/ai`)، وتصدير النسخ الاحتياطية لـ 10 جداول وإعدادات التكامل/SEO (`internal/operations`)، وإحصائيات وعقود المدارس (`internal/organizations`)، وصلاحيات التجارة (`internal/commerce`)، و`api/openapi/openapi.yaml`.
  2. تحديث واجهات `AiAdminPage` و`BackupAdminPage` (حالة فارغة صادقة وفحص ملفات JSON للقراءة فقط دون استعادة وهمية) و`PlatformIntegrationsAdminPage` و`SchoolsAdminPage` و`AdminDashboardShell` (تفعيل `ThemeToggle` و`SearchModal` ورابط السلة والإشعارات).
  3. **التحقق:** PASS `go vet` واختبارات Go/PG، و`tsc -b`، و`admin-skills-separation.test.mjs` (11/11)، وPlaywright `m1-admin-ops-parity.spec.ts` (4/4)، واجتياز جميع بوابات GitHub Actions السبع (`backend`, `database`, `frontend`, `overlap`, `e2e 1-3`).
- **إنجازات PR #315 (حزمة M2 — الطالب والتقارير والمسارات والسياسات):**
  1. تطبيق المهاجرة `000066_m2_student_parity` وإضافة مسارات وخدمات Go/PG لحجز الحصص (`/api/v1/session-bookings`)، وملخص إنجازات ودورات المتعلم (`/api/v1/learning-progress/achievements` و`courses/summary`)، وسؤال وجواب واللقاءات المباشرة (`/api/v1/learning-spaces/qa`)، وسياسة أدلة التقارير (`internal/reporting`).
  2. إضافة صفحات `BookSessionPage` و`LiveSessionsPage` و`LiveSessionLobbyPage` و`MyRequestsPage` و`QAPage` و`QuizGeneratorPage`، واستكمال تطابق `StudentDashboardPage` و`ReportsPage` و`CoursesPage` و`CourseOverview` و`AssessmentFollowUpSkills`.
  3. **التحقق:** PASS `go vet` واختبارات Go/PG، و`tsc -b`، و`student-dashboard-parity.spec.ts` (2/2)، و`student-report-skill-focus.spec.ts` (4/4)، و`m2-student-parity.spec.ts` (6/6 شاملة `390/820/1440` RTL)، و`course-system-parity.spec.ts`، وفحص `route-inventory.mjs` (`55/55` مسار Legacy، `legacyOnly: []`)، واجتياز جميع بوابات GitHub Actions الثماني (`backend`, `database`, `frontend`, `overlap`, `review-saved`, `e2e 1-3`).
- **حالة بوابة P6:**
  - تم التحقق آليًا في `Database CI` على `PR #313` و`PR #315` من تطبيق المهاجرات الـ `66` (`000001..000066`) كاملةً والتراجع عنها وإعادة تطبيقها، إضافةً إلى تمرين `pg_dump`/`psql` المثبت في `PR #309`.
  - **مطابقة البيانات الفعلية (`MongoDB -> PostgreSQL`):** تظل **`BLOCKED`** محليًا لعدم توفر نسخة تصدير معزولة من MongoDB (`*.bson`/`*.archive`) أو أدوات `mongod`/`mongorestore` محليًا، مع الالتزام التام بعدم الاتصال بالإنتاج.
- **حالة بوابة P7 والخطوة التالية:**
  - تم اجتياز اختبارات Playwright RTL (`390/820/1440`) لفحوص M1 وM2، وتبقى حزم M3–M5 (أدوار المعلم/المدرب/المدير/المشرف، الفصل الذكي وعقود OpenAPI، والمطابقة البصرية المتقابلة بالصور Legacy مقابل Go `HEADER-VISUAL-EXACT-001`) وبقية فجوات `gap-register.json` المفتوحة. تبقى حالة المنصة العامة **`PARTIAL`**.

## 25 نوفمبر — تركيز المهارة عبر URL في التقارير وصدق إجراءات ولي الأمر (PR #311 و PR #312) / PARTIAL

- Go main `035d67ef` بعد دمج [PR #311](https://github.com/nasef6464/almeaago/pull/311) و[PR #312](https://github.com/nasef6464/almeaago/pull/312) (`f2a0bcf9`) فوق [PR #310](https://github.com/nasef6464/almeaago/pull/310) (`3469085d`).
- **إنجازات PR #311 (تركيز `skillId` في `/reports` للطالب):**
  1. تحديث `apps/web/src/features/reporting/pages/ReportsPage.tsx` لقراءة معامل `skillId` من الرابط، وإبراز بطاقة المهارة المستهدفة (`data-testid="focused-skill-card"`) وتقديمها أعلى القائمة مع زر «عرض كل المهارات» لإلغاء التركيز، وإظهار إشعار واضح عند عدم وجود المهارة ضمن المهارات الضعيفة.
  2. PASS 7 اختبارات Playwright في `apps/web/tests/e2e/student-report-skill-focus.spec.ts` و`student-report-scope-failure.spec.ts` عند مقاسات `390 / 820 / 1440` RTL و`tsc -b` واجتياز بوابات CI (`frontend`, `overlap`, `e2e 1-3`).
- **إنجازات PR #312 (صدق تفضيلات وإشعارات ولي الأمر `PARENT-ACTION-TRUTH`):**
  1. تحديث `apps/web/src/features/parents/pages/ParentDashboardPage.tsx` لاستبدال حالة تبديل واتساب المحلية الوهمية بقراءة وحفظ فعليين عبر `GET/PATCH /api/v1/notifications/me/preferences` مع CSRF و`expectedRevision`، وتحويل زر التبديل إلى عنصر `role="switch"` يقبل النقرات ويدعم إظهار أخطاء الخادم (`role="alert"`) دون تغيير كاذب للحالة، وإزالة بيانات الموافقات الوهمية لصالح حالة فارغة صادقة.
  2. PASS 7 اختبارات Playwright في `apps/web/tests/e2e/parents-action-truth.spec.ts` و`parents-dashboard.spec.ts` عند `390 / 820 / 1440` RTL و`tsc -b` واجتياز بوابات CI (`frontend`, `overlap`, `e2e 1-3`).
- **ما تبقى (حالة المنصة العامة `PARTIAL`):** استكمال حزم M1–M5 في الـworktrees المعزولة، وبقية فجوات `gap-register.json`، ومطابقة MongoDB في P6 (محجوبة دون نسخة معزولة)، والاعتماد البصري والرحلات الشاملة P7.

## 25 نوفمبر — تثبيت مهارة نسخة السؤال في الاختبار المنشور

- Legacy `ed28102d7084899856de0371dc2c93a3d602d518`، Go baseline لتجربة RED `b4ad0d1f053b391b9636f42f61a6e829c32c4d6b`، كود الشريحة `45a97cf13e032dfb3c73b75e84d20f8cb5baba02` في [PR #310](https://github.com/nasef6464/almeaago/pull/310). السلوك VERIFIED محليًا للحالة أدناه. حالة المطابقة العامة PARTIAL.
- RED على Go baseline. بعد نشر اختبار يشير إلى السؤال v1، عدّل مدير المنصة مهارة السؤال وإجابته من مسار اعتماد بنك الأسئلة. احتفظ الطالب بدرجة v1 الصحيحة وتسرّب تصنيف v2 إلى تحليل المحاولة ودليل الإتقان. لا يُعد ذلك فرقًا بصريًا مثبتًا عن Legacy.
- المدير ← نشر الاختبار ← `POST /api/v1/assessments/{id}/publication` ← `assessment_version_questions`، ثم `PATCH /api/v1/questions/{id}/workflow` و`POST /api/v1/questions/{id}/versions` ← تحقق Go من الدور وحالة المراجعة و`expectedCurrentVersion` ← `question_version_taxonomy` و`question_version_taxonomy_skills` داخل معاملة تعديل السؤال. الطالب ← التسليم ← `POST /api/v1/assessment-attempts/{id}/submit` بحقل `submissionKey` ← Go يستخدم تصنيف نسخة السؤال المثبّتة ← `mastery_evidence` و`mastery_evidence_skills` ← التحليل والمراجعة و«تقاريري» بعد التحديث.
- PASS تجربة React وGo وPostgreSQL لثبات الدرجة والمهارة ومراجعة السؤال الأصلي بعد تحديث الصفحة. أعاد طلب التسليم بنفس المفتاح النتيجة نفسها ووجد اختبار SQL صف نتيجة واحدًا ودليلًا واحدًا وربطًا واحدًا بالمهارة الأصلية. رُفضت مراجعة المحاولة بحساب طالب آخر. PASS فحص وحدات Go الأربع، وتكامل الاختبار الذاتي والمُعد والمحاكي على PostgreSQL، وتطبيق الترحيل 000064 ثم التراجع عنه وإعادة تطبيقه في قاعدة معزولة.
- الصور `assessment-version-taxonomy-{390,820,1440}.png` من الجديد، مع تحذير عدم تحميل خط المنصة في الخادم التجريبي. لم تُلتقط صور أصل مقترنة. نسخ الأسئلة التي استُبدلت قبل وجود الأرشيف لا تُنسب إليها المهارة الحالية، ولا يُعاد كتابة الأدلة المخزنة سابقًا. لم يُنفّذ نشر.
- إعادة التحقق: اضبط `PREPARED_QUIZ_LIVE_BROWSER=1` و`PREPARED_SKILL_VERSION_TEST=1` و`PREPARED_QUIZ_TEST_FILTER=تصنيف السؤال المنشور` وعنوان PostgreSQL تجريبي معزول في `ASSESSMENT_SELF_SCHEMA_TEST_DATABASE_URL` ثم شغّل `go test ./internal/assessment/repository/postgres -run '^TestPreparedQuizLiveBrowser$' -count=1 -v`. أُضيف الفحص إلى Database CI بعد دمج #309. راجع CI على رأس PR. الخطوة التالية تحقق نتيجة اختبار بمهارات متعددة قبل بدء قياس تغطية الجاهزية.

## 25 نوفمبر — بوابة P6: تمرين النسخ الاحتياطي والاستعادة وتكاملات التجارة على PostgreSQL 18 / PARTIAL

- Go main `7895368bb1c35f0a0beacf52d2a698c845ad0cef` بعد دمج [PR #309](https://github.com/nasef6464/almeaago/pull/309).
- **إنجازات PR #309 (تمرين P6 على `postgres:18` في GitHub Actions `Database CI`):**
  1. تطبيق جميع المهاجرات الـ 63 (`*.up.sql`) ثم التراجع الكامل عنها (`*.down.sql` بترتيب عكسي) وإعادة تطبيقها من الصفر والتحقق من كافة القيود والفهارس والمشغلات.
  2. تنفيذ تمرين `pg_dump --no-owner --no-acl` ثم استعادته إلى قاعدة تحقق مستقلة `almeaa_restore_verify` عبر `psql -v ON_ERROR_STOP=1` مع مطابقة عدد الجداول وسلامة بذور `ai_provider_settings`.
  3. تشغيل اختبارات تكامل التجارة (`internal/commerce/repository/postgres` عبر `COMMERCE_JOURNEY_TEST_DATABASE_URL`) مباشرة على القاعدة المستعادة `almeaa_restore_verify`.
  4. PASS بوابة `database` (3m 53s) و`overlap` (7s) في GitHub Actions دون أي اتصال بقواعد الإنتاج.
- **ما تبقى من P6/P7:** تمرين مطابقة البيانات الفعلي (`MongoDB -> PostgreSQL` reconciliation) ضد نسخة تصدير معزولة من Legacy (إن وُجدت بيانات إنتاجية مستهدفة للترحيل)، ثم الاعتماد البصري المتقابل P7 على المقاسات الثلاثة (`390 / 820 / 1440`). حالة المنصة العامة تبقى **`PARTIAL`**.

## 25 نوفمبر — إصلاح تعدد نطاقات WEB_ORIGIN في OAuth واستعادة حالة الدفع عبر Tap paymentReturn / PARTIAL

- Go main `d02fa27884a2838cb3600d618c97db2f357e3127` بعد دمج [PR #307](https://github.com/nasef6464/almeaago/pull/307) و[PR #308](https://github.com/nasef6464/almeaago/pull/308).
- **إنجازات PR #307 (إصلاح `WEB_ORIGIN` متعدد النطاقات في OAuth):**
  1. إصلاح `internal/identity/transport/http/handler.go` بحيث يتم تحليل `WEB_ORIGIN` المفصول بفواصل إلى قائمة نطاقات `http/https` معتمدة (مع رفض `*` وبيانات الدخول في الرابط)، بدلاً من دمج النطاقات مع بعضها في رابط إعادة التوجيه.
  2. حفظ النطاق المطابق عند بدء `/google/start` في كوكي `almeaa_google_oauth_origin` (HttpOnly) وإعادة التوجيه إليه عند العودة أو الخطأ مع الرجوع الآمن للنطاق الأساسي عند التلاعب.
  3. PASS جميع اختبارات `internal/identity/...` بما فيها `TestParseAllowedWebOriginsFiltersInvalidAndPreservesOrder` و`TestMultiOriginWebOriginOAuthRedirectsUseSingleAllowlistedOrigin` واجتياز بوابتي `backend` و`overlap` في GitHub Actions.
- **إنجازات PR #308 (استعادة حالة الدفع عند العودة من Tap `paymentReturn=1`):**
  1. تحديث `apps/web/src/features/commerce/pages/CheckoutPage.tsx` لاسترجاع طلب الدفع المطابق عبر `requestId` من معاملات الرابط عند العودة من بوابة Tap (`?productId=...&requestId=...&paymentReturn=1`) حتى في حال غياب مفتاح الاستعادة المحلي أو تحول الطلب بالفعل عبر Webhook إلى `paid`/`failed`/`cancelled`.
  2. إضافة تغذية راجعة صادقة لحالة السداد دون أي منح صلاحيات وصول من الواجهة.
  3. PASS جميع اختبارات Playwright الـ 12 في `apps/web/tests/e2e/commerce-checkout.spec.ts` وفحص `tsc -b` واجتياز بوابات `frontend` و`overlap` و`e2e (1-3)` في GitHub Actions بنسبة 100%.
- حالة المنصة العامة تظل **`PARTIAL`** حتى استكمال بوابات P5–P7 المتبقية.

## 25 نوفمبر — دمج ثبات مسودات ودورات المدرب وإثبات تبويبات المشرف السبعة ومساحة المعلم / PARTIAL

- Go main `57bec0def4d20f8ab08600a3cff4b3239cb2b70f` بعد دمج [PR #305](https://github.com/nasef6464/almeaago/pull/305) و [PR #304](https://github.com/nasef6464/almeaago/pull/304). الفحوصات الآلية في GitHub Actions (`frontend`, `overlap`, `e2e 1-3`) اجتازت 100% أخضر على رأسي الدمج.
- **إنجازات PR #304 (مساحة المعلم):**
  1. حفظ مسودات التكليفات والاختبارات محلياً في `localStorage` مفتاح (`almeaa_teacher_assessment_drafts_${schoolId}`) لضمان استمرارها وبقائها بعد إعادة التحميل (Reload) دون ادعاء نجاح خادم زائف.
  2. إضافة واجهة إدارة المسودات في التبويب السادس مع عداد وأزرار حذف المسودة وتغذية راجعة صادقة.
  3. استبدال قائمة الطلاب الوهمية الثابتة بقائمة طلاب حقيقية ديناميكية مسترجعة من الخادم عبر `organizationsClient.students(schoolId, classId)`.
  4. اختبار Playwright مخصص في `apps/web/tests/e2e/organizations-teacher-school-scope.spec.ts` أثبت استمرار المسودة واختفاءها فقط عند الحذف وحصر الطلاب في الفصل والمدرسة.
- **إنجازات PR #305 (مساحة المدرب وتبويبات المشرف السبعة):**
  1. حفظ مسودات الدورات التدريبية للمدرب محلياً في `localStorage` (`almeaa_trainer_course_drafts_${userId}`) مع إمكانية حذفها وواجهة مخصصة بالتبويب الثاني وزر «إنشاء مسودة دورة جديدة».
  2. حفظ مواعيد اللقاءات التدريبية المباشرة المجدولة محلياً في `localStorage` (`almeaa_trainer_live_sessions_${userId}`) مع عناصر إلغاء اللقاء وإصدار رمز PIN صادق.
  3. إثبات عمل واجهات التبويبات السبعة للمشرف في اختبار Playwright شامل `organizations-supervisor-roster-parity.spec.ts`:
     - التبويب 1 (overview): مؤشرات الأداء والبطاقات الإحصائية (85%, 2, 90%).
     - التبويب 2 (students): جدول الطلاب وملف ذكاء الطالب (`StudentIntelligenceProfile`).
     - التبويب 3 (live-sessions): مكون `LiveSessionsManager` مع إظهار حالة عدم وجود حصص صادقة أو حالة الخطأ والتراجع.
     - التبويب 4 (tests): مكون `SupervisorTestsManager` مع فلترة الاختبارات المحاكية والرسمية.
     - التبويب 5 (live-monitoring): شاشة المراقبة اللحظية مع مؤشر `متصل (0 نشط)`.
     - التبويب 6 (skills): خريطة مهارات الفصل (`ClassSkillsMapPanel`).
     - التبويب 7 (reports): تقارير أداء الفصل وجدول التوزيع وتصدير CSV.
     - عزل المدارس: التأكد من اختفاء طلاب المدرسة 1 عند اختيار المدرسة 2.
  4. اختبار Playwright مخصص في `apps/web/tests/e2e/public-user-workspaces-parity.spec.ts` أثبت استمرار مسودة الدورة واللقاء المباشر للمدرب بعد إعادة التحميل.
- حالة المنصة العامة: **`PARTIAL`**، ولا يتم الإعلان عن الاكتمال إلا بعد استيفاء كافة بوابات الجودة P0–P7.

## 24 نوفمبر — حفظ نطاق المسار والمادة عند فتح التقرير / PARTIAL

- Legacy `ed28102d7084899856de0371dc2c93a3d602d518`، Go main `a63d543aa752bc574e4a2569cf51dfc2feb83d05` بعد دمج #300 محليًا، كود الشريحة `a44992109028acb0226a8039cce32f4ddd9711fd` على فرع [PR #301](https://github.com/nasef6464/almeaago/pull/301). لا تعارض مع ملفات #300. يلزم فحص CI للرأس المرفوع.
- الطالب ← النتيجة ← «تابع الخطة» ← رابط يحمل المسار والمادة والمهارة ← صفحة `/reports` تحتفظ بالمسار والمادة عند تحميل التصنيف ← `GET /api/v1/reports/overview` و`GET /api/v1/reports/results` ضمن صلاحية الطالب ومرشحات المسار والمادة ← PostgreSQL ← عرض نتيجة الطالب. معرّف المهارة يُمرر في الرابط لكن صفحة التقارير لا تعرض تركيز مهارة محددة بعد.
- PASS `report-link-live.log` على Go/PostgreSQL ومتصفح لفتح التقرير من النتيجة مع اختيار المسار والمادة وظهور المحاولة والعودة للمراجعة. PASS ثلاث حالات متصفح ببيانات معزولة لتغيير النطاق وفشل القراءة والتعافي عند 390/820/1440 في `report-link-web.log`. PASS TypeScript وGo للحزم المتأثرة بعد دمج main و`git diff --check`.
- لم تُثبت مطابقة التقارير الكاملة أو اختيار المهارة نفسها أو حجز المتابعة. لقطات جديدة مقترنة مع Legacy غير متاحة لهذه الشريحة. حالة Vercel السابقة PENDING ولا تعني نشرًا.
- الاستئناف: تتبع عرض المهارة المحددة في التقرير وعقد حجز المتابعة، وفحص CI بعد رفع الرأس. أول أمر: `rg -n "skillId|selectedSkill|buildSkillReportActionLink|book-session" C:/almeaago/almeaacodax/pages/Reports.tsx apps/web/src/features/reporting`.

## 24 نوفمبر — بطاقات إجراءات النتيجة / PARTIAL

- Legacy `ed28102d7084899856de0371dc2c93a3d602d518` وGo main `d0afc757a41e42e7f7e9159a1fe273262e5784cd`. الكود `b57358254bdcd12037391c411de14c7586510581` على فرع [PR #301](https://github.com/nasef6464/almeaago/pull/301).
- أضيفت بطاقات فتح الشرح وتدريب الموضوع وملف الدعم في ملخص نتيجة المهارة. الروابط تستخدم موضوع التأسيس المثبت وتبقى الأذونات في الوجهة. PASS `action-cards-live.log` لطلب النتيجة من Go/PostgreSQL والتحقق من روابط الشرح والملف والتدريب وفتح وجهاتها في رحلة الطالب. PASS TypeScript و`git diff --check`.
- لا توجد وجهة `/book-session` أو بديل مثبت في كود Go بحسب البحث المحلي، لذلك بطاقة حجز المتابعة من Legacy لم تُستعد. يلزم تتبع عقد الحجز وملكيته قبل تنفيذها. لا توجد صور مقترنة لهذه البطاقات، ومطابقة القسم كله غير مثبتة.
- الاستئناف: تحقق من وجهة الحجز وإجراءات التقرير المرتبطة بنطاق المهارة وحالات عدم توفر الأدلة، ثم صور Legacy/Go ومراجعة CI النهائي. أول أمر: `rg -n "book-session|bookSessionLink|buildSkillReportActionLink" C:/almeaago/almeaacodax apps/web/src internal`.

## 24 نوفمبر — مسار ما بعد الاختبار / PARTIAL

- Legacy `ed28102d7084899856de0371dc2c93a3d602d518`، Go main `d0afc757a41e42e7f7e9159a1fe273262e5784cd`، كود الشريحة `5c1db45bea3caf087928a68cbe4d38839159112f` على فرع [PR #301](https://github.com/nasef6464/almeaago/pull/301).
- أضيفت خطوات المراجعة والشرح وتدريب الموضوع والتقرير في ملخص النتيجة مع حالة لا توجد فيها مهارة ضعيفة. رابط التدريب يستخدم موضوع التأسيس المرتبط صراحة عندما يتوفر. PASS ست حالات متصفح معزولة في `journey-steps-final.log` وفحص TypeScript. PASS `journey-steps-live-final.log` لرحلة Go/PostgreSQL شملت رابط تدريب الموضوع، والتقرير والمساعد والمراجعة. فشل التشغيل الأول بسبب تعدد ظهور اسم الموضوع في محدد الاختبار وصُحح المحدد.
- التصنيف PARTIAL: تختلف بنية وأيقونات القسم عن Legacy، ولم تُستعد بطاقات الإجراءات المباشرة وحجز المتابعة أو رابط التقرير بنطاق المهارة. حالات عدم وجود الأدلة وكل المهارات المتقنة لم تُثبت بصور متقابلة. فحص CI مطلوب على الرأس بعد الرفع.
- الاستئناف: أكمل بطاقات الإجراءات المتبقية وفق الأصل وتتبع توفر وجهة حجز المتابعة، ثم صور RTL متقابلة وفحص كافة الحالات. أول أمر: `rg -n "nextActionCards|bookSessionLink|postResultJourney" C:/almeaago/almeaacodax/pages/Results.tsx`.

## 24 نوفمبر — رحلة طالب في تكليف مدرسة / PARTIAL

- Legacy `ed28102d7084899856de0371dc2c93a3d602d518`، Go main `d0afc757a41e42e7f7e9159a1fe273262e5784cd`، كود الاختبار `cba4a3c5bdff30e882b36edf20fc7e48dcbd6b2a` في [PR #301](https://github.com/nasef6464/almeaago/pull/301). المسودة مرفوعة وتحتاج فحص CI على الرأس النهائي.
- PASS `school-live-2.log` في Go/PostgreSQL معزولين: تكليف اختبار منشور لمدرسة، فتح الطالب للتكليف من واجهته، الإجابة والتسليم، ظهور النتيجة في السجل ومراجعة الإجابة الصحيحة، ورفض طالب آخر قراءة المحاولة. أُنشئت بيانات المدرسة والتكليف مباشرة في قاعدة الاختبار، لذا لا يثبت ذلك إنشاء مدير المدرسة للتكليف عبر واجهته أو اختبارًا محاكيًا مدرسيًا. فشل تجهيز الاختبار الأول بسبب جمع عبارات SQL ذات المعاملات، ثم صُححت بيانات الاختبار.
- PASS `school-audience.log` لعزل جمهور المدرسة، و`school-assessment-browser-final.log` لخمس حالات واجهة باستجابات معزولة، و`mock-browser-final.log` للمحاكي المنشور بمادتين. لقطات Legacy/Go المقترنة للحالة المدرسية والاعتماد البصري الكامل غير متاحة في هذه الدفعة.
- الاستئناف: راجع طلب الدمج والفحوص على رأسه النهائي، واستكمل فروق النتيجة والتقارير وطرق المدرسة والمحاكي في واجهات الإنشاء والأدوار. أول أمر: `gh pr view 301 --json headRefOid,statusCheckRollup,mergeable,isDraft`.

## 24 نوفمبر — متابعة المحاكي والمدرسة ورفع المسودة / PARTIAL

- [PR #301](https://github.com/nasef6464/almeaago/pull/301) مسودة مرفوعة. الرأس `298398554e7b0f80ce109c4c4600898d92e1c1c5` نجحت عليه فحوص backend وdatabase وfrontend وoverlap وأقسام e2e الثلاثة. حالة Vercel كانت PENDING عند الفحص. الوثائق التالية تغير الرأس وتستلزم إعادة التحقق.
- PASS `.tmp/student-review-notes/mock-browser-final.log` رحلة محاكي صارم بمادتين على Go/PostgreSQL معزولين. PASS `school-audience.log` لاختبار جمهور المدرسة عبر قاعدة محلية ومهاجرات فعلية. PASS خمس حالات واجهة باستجابات معزولة في `school-assessment-browser-final.log` للتكليفات والجلسات. تجاوز اختبار التكليف في التشغيل الأول مهلة 30 ثانية ثم نجح عند زيادة المهلة في إعادة التشغيل.
- لا تثبت هذه الأدلة رحلة اختبار مدرسي كاملة من إنشاء المدرسة حتى استلام الطالب نتيجته على Go/PostgreSQL، أو تطابق جميع حالات شاشة الطالب مع Legacy. لا دمج أو نشر حتى استكمالها وفحص الرأس النهائي. الاختبار الذاتي الحقيقي ونتيجته في التقرير موثقان في الإدخال التالي.
- الاستئناف: إعداد رحلة تكليف مدرسي حقيقية من مستخدم مخول إلى الطالب والنتيجة وتقاريره، وفحص بقية حالات واجهة الطالب مقارنة بالأصل. أول أمر: `rg -n "TestSchoolWideAssignmentLearnerAudiencePostgres|NewAssignments|StartAssigned" internal/assessment`.

## 24 نوفمبر — استعادة اختبار متصفح الاختبار الذاتي / PARTIAL

- Legacy `ed28102d7084899856de0371dc2c93a3d602d518`، Go main `d0afc757a41e42e7f7e9159a1fe273262e5784cd`، كود الاختبار `afd12c0a5e8f7a980efac7a7bde711cd523eeb71` على `fix/student-review-notes`. الفرع مرفوع وPR مسودة [#301](https://github.com/nasef6464/almeaago/pull/301)، وفحوص الرأس السابق جارية.
- استعيد `self-quiz-live.spec.ts` ومشغل Go يستخدم إعداد Playwright محليًا ويهيئ خدمات التقارير وبيانات اختبار معزولة. PASS في `.tmp/student-review-notes/self-browser-live-2.log` لإنشاء اختبار ذاتي من الواجهة وتسليمه ووجوده في سجل المحاولات وفتح النتيجة من «تقاريري» ثم إظهار الإجابة الصحيحة. فشل الاختبار الأول في توقع HTTP 201 بينما الاستجابة الفعلية 200 وصُحح توقع الاختبار.
- اختبارات المحاكي والمدرسي، صور Legacy/Go المتقابلة والـCI على الرأس النهائي لم تثبت بعد. المسودة ليست جاهزة للدمج أو شهادة اكتمال الرحلة.
- الاستئناف: تحقق من المحاكي والمدرسي ومن استمرار CI بعد رفع هذا الرأس، ثم أكمل حالات النتيجة وواجهة التقارير. أول أمر: `rg -n "^test\\(" apps/web/tests/e2e/prepared-quiz-live.spec.ts`.

## 24 نوفمبر — نتيجة الاختبار الذاتي في تقارير الطالب / PARTIAL

- Legacy `ed28102d7084899856de0371dc2c93a3d602d518` وGo main `d0afc757a41e42e7f7e9159a1fe273262e5784cd`. الكود المحلي `31594bc57eeff9b02f2ab0bd7e810f5a156eea59` في `fix/student-review-notes`؛ لا PR أو دمج أو نشر وCI SKIPPED.
- الاختبار الذاتي كان موجودًا في `assessment_results` و«اختباراتي»، لكنه يغيب من استعلام التقارير بسبب اشتراط نسخة اختبار منشور. يصلح `reportAttemptVersionJoin` مصدر نطاق واسم المحاولة الذاتية من `self_quiz_settings` في نطاق الطالب، بما يشمل قائمة النتائج وأعداد المحاولات وملخص أدلة المهارات. بقيت نطاقات بقية الأدوار كما هي. العنوان المعروض «اختبار ذاتي».
- RED في `self-report-red.log` على غياب النتيجة. PASS `self-report-http.log` على PostgreSQL معزول لتسليم نتيجة ذاتية وإرجاعها عبر HTTP للتقارير وترشيح مسار ومادة في المستودع ومنع ظهورها لطالب آخر ودخولها الإجماليات. PASS `prepared-after-self.log` لرحلة اختبار منشور وإظهار نتيجته في صفحة التقارير وتصفية المسار والمادة والمساعد والمراجعة وحفظ السؤال. PASS حزم التقارير و`git diff --check`.
- لم تُثبت بعد واجهة الاختبار الذاتي إلى صفحة التقارير في متصفح حقيقي. مشغل اختبارها المحلي `self_quiz_live_browser_test.go` يشير إلى ملف `apps/web/tests/e2e/self-quiz-live.spec.ts` المفقود. لا صور Legacy/Go مقترنة لهذه الحالة، والمحاكي والمدرسي والـCI ما زالوا مطلوبين.
- الاستئناف: إعادة إنشاء اختبار المتصفح المفقود باستخدام واجهة الإنشاء الفعلية وخادم معزول، وإثبات التسليم وظهور النتيجة في «اختباراتي» و«تقاريري»، ثم اختبار المحاكي والمدرسي. أول أمر: `rg -n "createSelf|currentSelf|self-quiz-live|اختبار ذاتي" apps/web/src/features/assessment apps/web/src/features/learning internal/assessment/repository/postgres/self_quiz_live_browser_test.go`.

## 24 نوفمبر — اختبار ترابط تقارير الطالب ومساعد السؤال / PARTIAL

- Legacy `ed28102d7084899856de0371dc2c93a3d602d518` وGo main `d0afc757a41e42e7f7e9159a1fe273262e5784cd`، رأس الاختبارات المحلي `d4f7331937370db45674ab623fbf1865ca6ff158` على `fix/student-review-notes`. لا رفع أو PR أو دمج وCI SKIPPED.
- PASS `.tmp/student-review-notes/ai-result-final.log` على Go وPostgreSQL: تسليم اختبار ثم اختيار المسار والمادة في `/reports` وظهور المحاولة والعودة للنتيجة، ومراجعة الإجابة وحفظ السؤال، وطلب مساعد السؤال والحصول على شرح احتياطي، ورفض سؤال المساعد عن محاولة طالب آخر، وفتح تبويبات موضوع المهارة والتدريب، وعدم ظهور المحاولة في تقرير طالب آخر. استخدمت معرّفات عينة سليمة لتفعيل ترشيح الخادم، وحدّثت المرجع في fixture المصاحب.
- اختبار زر PDF أثبت استدعاء أمر طباعة المتصفح عبر بديل اختباري، ولم يتحقق من ملف مطبوع فعلي. اختبار AI محلي بلا مزود خارجي وأثبت الاستجابة الاحتياطية وحدها. تحذير إعداد الخط ظاهر في بيئة الاختبار.
- صور شاشة التقارير عند 390 و820 و1440 في `apps/web/test-results/student-report-live-*.png`؛ صورة 390 تُظهر نتيجة الاختبار والتصفية ولا تُثبت المطابقة مع شاشة Legacy الكاملة. يظهر أن قائمة المهارات الضعيفة في التقرير تشترط حد الأدلة الموجود، ولا تُعد نتيجة سؤال واحد ضعفًا مؤكدًا.
- المكوّن `StudentReportsView.tsx` لا يوجد مستهلك له في البحث الحالي، وتستخدم الصفحة ولوحة الطالب `ReportsPage.tsx`. يلزم مقارنة المحتوى المستعاد في التقارير بالأصل وبيان وظائف المكوّن غير المدمج قبل أي دمج. تظل الأنواع الذاتية والمدرسية والمحاكية والطباعة الفعلية ومقدمو AI غير مثبتة في هذه الرحلة.
- الاستئناف: اختبر تكامل نتيجة الاختبار الذاتي مع اختباراتي وتقاريري والمهارات، ثم المحاكي والمدرسي وفق دليل المصدر. أول أمر: `rg -n "self_quiz|assessment_results|reports/results|self/current" internal/assessment/repository/postgres internal/reporting/repository/postgres apps/web/tests/e2e`.

## 24 نوفمبر — امتداد رحلة الطالب إلى التقارير والمراجعة / PARTIAL

- طلب المالك تأجيل بحوث العمليات على مستوى المنصة. المهمة الجارية إكمال رحلة الاختبار والتحليل والمراجعة وسجل الطالب والتقارير وفق القديم.
- Legacy `ed28102d7084899856de0371dc2c93a3d602d518`، Go main `d0afc757a41e42e7f7e9159a1fe273262e5784cd`، كود واختبارات محلية `1859ffac` على `fix/student-review-notes`. لا PR أو دمج أو نشر وCI SKIPPED.
- PASS `.tmp/student-review-notes/student-whole-saved-verified.log` لرحلة على Go وPostgreSQL معزولين: تسليم اختبار، ظهور محاولته في API اختباراتي والتقارير العامة، ظهور المهارة في API تقدم الطالب، عرض الإجابة الصحيحة، حفظ السؤال واسترجاعه من مكتبة المراجعة، فتح شرح وفيديو وملف وتدريب المهارة، ومنع طالب آخر من قراءة المحاولة. أُضيفت مسارات التقارير والمراجعة والإتقان إلى خادم الاختبار فقط. تمت قراءة نتائج التقارير دون مرشحات لأن معرّفات عينة المسار والمادة لا تطابق صيغة UUID المطلوبة للتصفية، لذا التصفية واجهة التقارير لم تُثبت.
- فشل تشغيلان أثناء تطوير الاختبار بسبب إغفال مسار مكتبة المراجعة ثم توقع شكل غير صحيح لحمولتها؛ صُحح الاختبار. PASS ثماني حالات متصفح معزولة في `whole-result-check.log`، وحزم تطبيق AI وواجهته وتطبيق التقارير في `student-ai-report-tests.log`. لا يثبت ذلك تشغيل مزود الذكاء الاصطناعي أو تكافؤ شرح السؤال الفعلي.
- تعديل نص التوصية في `AssessmentFollowUpSkills.tsx` يتبع الحالات المستنتجة من محتوى الموضوع، ويحتاج استكمال مقارنة الحالات مع الأصل. بقيت واجهة «تقاريري» والتصفية، المحاولات الذاتية والمدرسية والمحاكية، الطباعة، شرح AI والمقارنة البصرية للشاشة الكاملة غير مثبتة. لا تعد الرحلة مكتملة.
- أول أمر للاستئناف: `rg -n "QuestionAssistantPanel|InteractiveSmartTeacher|reportingClient.results|learningClient.progress" apps/web/src/features/assessment/pages/AssessmentResultsPage.tsx apps/web/src/features/reporting/student/StudentReportsView.tsx`.

## استئناف طلب المالك — رحلة النتيجة كاملة / PARTIAL

- طلب المالك مطابقة محتوى وسلوك رحلة النتيجة كاملة دفعة واحدة، بما يشمل مراجعة الأسئلة والمحاولات السابقة والتقرير الكامل ونافذة تحليل المهارات، مع السماح بتحسين التنسيق مع الحفاظ على المحتوى والنظام. لا تعد الدفعة مكتملة حتى تثبت الرحلة كاملة.
- Legacy main `ed28102d7084899856de0371dc2c93a3d602d518` وGo main `d0afc757a41e42e7f7e9159a1fe273262e5784cd`، الفرع المحلي `fix/student-review-notes` ورأسه `a5b6ccc2`. لا PR أو CI لهذا الفرع.
- يوجد تعديل غير ملتزم في `AssessmentFollowUpSkills.tsx` يقارب نص توصية المهارة بالأصل وفق المحتوى المتاح. فحص المتصفح للاستجابات المعزولة نجح في ثماني حالات في `.tmp/student-review-notes/whole-result-check.log`. لا يثبت ذلك الرحلة الكاملة أو تكافؤ النص لكل حالة.
- مقارنة المصدر أظهرت أن «الخطوة التالية الموصى بها» وبطاقات الإجراءات المباشرة تحتاج فحصًا شاملًا مقابل الصفحة الحالية. يلزم اختبار الرحلة كاملة بقاعدة محلية ثم مقارنة كل الأزرار والحالات والمقاسات وتصحيح الفروق قبل اعتماد العمل.
- أول أمر للاستئناف: `rg -n "nextActionCards|الخطوة التالية الموصى بها|تفاصيل أكثر|المحاولات السابقة" C:/almeaago/almeaacodax/pages/Results.tsx apps/web/src/features/assessment`.

## 24 نوفمبر — شارتا الشرح والتدريب في بطاقة متابعة المهارة / PARTIAL

- Legacy `ed28102d7084899856de0371dc2c93a3d602d518` من `pages/Results.tsx` و`pages/Reports/recommendationViewModel.ts`. Go main `d0afc757a41e42e7f7e9159a1fe273262e5784cd`. كود الدفعة `c30fc4e1a2ae35cb70689371f4d5d6fad64c879e` على `fix/student-review-notes` محليًا. الحالة بلا PR أو دمج أو نشر. GitHub CI للرأس SKIPPED.
- الطالب ← التقرير الكامل ← بطاقة متابعة المهارة ← `GET /api/v1/assessment-attempts/{id}/review` ← سياسة إتاحة التقرير وملكية المحاولة ← موضوع التأسيس المرتبط صراحة بالمهارة. حقل `hasLesson` اختياري ويثبت وجود درس معتمد ظاهر في `topic_lessons`، وحقل `hasPractice` اختياري ويثبت وجود تدريب منشور معتمد ظاهر في `assessment_learning_placements` في نفس نطاق الموضوع والمادة والمسار. الشارتان معلومات عن وجود المحتوى. أذونات قراءته وتشغيله واستنفاد محاولاته باقية في الوجهات الحالية.
- تحافظ الشارتان على نصهما ولونهما وترتيبهما في المرجع. في الأصل يمكن أن تظهر شارة «تدريب قصير» لأن عنوان الموضوع يُستخدم كقيمة بديلة لعنوان التدريب. الشارة في Go تشترط وجود تدريب فعلي كما هو محدد في هذه الدفعة. الروابط إلى تبويبي الشرح والتدريب تبقى وفق ربط المهارة الصريح. لا ترحيل للبيانات.
- الملفات `AssessmentFollowUpSkills.tsx` و`attempt-client.ts` وعقد نتيجة Go واستعلام `result_skill_analysis.go` وOpenAPI واختبارات المستودع والمتصفح. RED مثبت في `followup-badges-red.log` لغياب الشارة، وPASS فحص TypeScript وحزم Go الست و`git diff --check`. PASS في `followup-badges-live.log` للرحلة الحقيقية التي تثبت حقلي HTTP وظهور الشارات بعد التحديث، ولاختباري PostgreSQL للنتيجة والملكية. تغطي حالة النتيجة درس مسودة ودرس مادة أخرى وتدريبًا مخفيًا وموضعًا خارج المادة واختبارًا عاديًا. تعذر بدء الفحص الأول بحساب قاعدة التجربة القديمة، وأعيد بنجاح على قاعدة اختبار مخصصة بهذه الدفعة.
- PASS ثماني حالات متصفح للنتائج والمراجعة باستجابات معزولة في `followup-badges-web.log`، شملت غياب الشارتين عند خلو الموضوع ووجودهما عند توافر المحتوى. تحذيرات إعداد الخط في بيئة الاختبار خارج الإجراء المختبر.
- صور RTL عند 390 و820 و1440 في `.tmp/student-review-notes/legacy-follow-up-*.png` و`.tmp/student-review-notes/followup-badges-go-*.png`. تحقق ترتيب الشارات والتفافها في العينة. تختلف سماكة الخط، والتفاف أزرار الإجراءات عند 390، وعرض غلاف البطاقة على الديسكتوب. تبقى الشاشة بكاملها PARTIAL.

الاستئناف: طابق سطر «الخطوة التالية» وتوزيع أزرار بطاقة المتابعة على الموبايل مقابل المرجع، باستخدام حالات شرح وتدريب وكلاهما وموضوع خالٍ. أول أمر محلي: `rg -n "الخطوة التالية|شاهد الفيديو|تدريب مناسب" C:/almeaago/almeaacodax/pages/Results.tsx apps/web/src/features/assessment/components/AssessmentFollowUpSkills.tsx`.

## 24 نوفمبر — «شاهد الفيديو» من بطاقة متابعة المهارة / PARTIAL

- مرجع Legacy `ed28102d7084899856de0371dc2c93a3d602d518` من `pages/Results.tsx`. Go main `d0afc757a41e42e7f7e9159a1fe273262e5784cd`. كود الدفعة `c54c63c5a5f60f56abba492bf96cd36adc7b4d36` على `fix/student-review-notes` محليًا بعد إعادة التركيب فوق main. الرفع وPR والدمج والنشر غير منفذة. فحص GitHub CI للرأس SKIPPED.
- الطالب ← التقرير الكامل ← «شاهد الفيديو». يعيد `GET /api/v1/assessment-attempts/{id}/review` معرّف أول درس فيديو معتمد وظاهر مرتبط بموضوع التأسيس، ضمن مسار ومادة المهارة في PostgreSQL. عند الضغط يطلب العميل `GET /api/v1/learning-spaces/foundation/{topicId}/lessons/{lessonId}`. يتحقق Go من الارتباط والصلاحية الحالية قبل إرجاع رابط المقطع. يعرض المشغل في التقرير وينتظر ضغط «تشغيل»، ويعيد التركيز إلى الزر بعد الإغلاق. تظهر رسالة في البطاقة إذا تعذر تحميل الدرس. تظهر شارتا «فيديو شرح» و«ملف داعم» بحسب توافرهما.
- الملفات `AssessmentFoundationVideoAction.tsx` و`AssessmentFollowUpSkills.tsx` و`attempt-client.ts` وعقد Go واستعلام موارد التأسيس في `result_skill_analysis.go` وOpenAPI واختبارات Go والمتصفح.
- RED لغياب الزر في `followup-video-red.log`. PASS فحص TypeScript و`git diff --check` وحزم Go للتقييم وتطبيق المحتوى. PASS ثماني حالات متصفح في `followup-video-web.log`، شملت غياب طلب الدرس قبل الضغط وحالة رفضه. PASS رحلة حقيقية مع Go وPostgreSQL في `followup-video-live.log`، شملت إعادة تحميل التقرير وطلب الدرس المصرّح به وتشغيل مقطع WebM يدويًا والإغلاق وعودة التركيز، واختباري PostgreSQL للنتيجة والملكية. ظهرت تحذيرات إعدادات الخط خارج الإجراء المختبَر.
- صور RTL عند 390 و820 و1440 في `.tmp/student-review-notes/legacy-follow-up-video-*.png` و`apps/web/test-results/assessment-live-follow-up-video-*.png`. تطابق إجراء الفتح والإغلاق في العينة. يتبقى اختلاف تحكم المشغل وخلفية النافذة.

الاستئناف: تحقق من شارات «شرح مرتبط» و«تدريب قصير» مقابل محتوى التأسيس الظاهر في نفس نطاق المهارة. أول أمر محلي: `rg -n "شرح مرتبط|تدريب قصير|hasSupport|videoLessonId" C:/almeaago/almeaacodax/pages/Results.tsx apps/web/src/features/assessment/components/AssessmentFollowUpSkills.tsx internal/assessment/repository/postgres/result_skill_analysis.go`.

## 24 نوفمبر — إجراءات «مهارات تحتاج متابعة» في التقرير الكامل / PARTIAL

- Legacy `ed28102d7084899856de0371dc2c93a3d602d518` من `pages/Results.tsx` و`pages/Reports/recommendationViewModel.ts`. Go main `2c10ff186b726c2e9f37aad96b55afc0ab9144d6`. كود الدفعة `d424172ffa33da467ff520eca4445132a96d60e2` على `fix/student-review-notes` محليًا. لا رفع أو PR أو نشر وGitHub CI SKIPPED.
- الطالب ← نتيجة المحاولة ← التقرير الكامل ← بطاقة المهارة ← `GET /api/v1/assessment-attempts/{id}/review` بعد تحقق الملكية وسياسة التقرير ← مهارة المحاولة وموضوع التأسيس المثبت عبر `topic_skill_links` ← الشرح والتدريب والدعم في تبويبات الموضوع نفسه. إشارة `hasSupport` تتطلب عنصر مكتبة معتمدًا وظاهرًا في نفس المادة والمسار داخل PostgreSQL، دون إرجاع عنوان الملف في تقرير النتيجة. تبقى قراءة محتواه والأذونات ومشغل الدرس والتدريب في وجهة التأسيس الحالية. لا تغيير في درجات المحاولة أو حفظها.
- الملفات `AssessmentFollowUpSkills.tsx` و`AssessmentResultsPage.tsx` و`resultFoundationPath.ts` و`attempt-client.ts` وملفات Go لعقد النتيجة واستعلام خرائط التأسيس وOpenAPI والاختبارات. RED في `followup-red.log`. PASS فحص TypeScript و`git diff --check` وحزم Go للتقييم وست حالات متصفح في `followup-web.log`. PASS في `followup-live-final.log` لمحاولة حقيقية بعد إعادة التحميل ثم فتح تبويبات ملف الدعم والشرح وبدء التدريب صراحة، ورفض قراءة النتيجة من طالب آخر، واختباري PostgreSQL للمنشور والذاتي. التصحيح بين التشغيلين كان محدد اختبار مهارة متكرر في DOM.
- صور RTL عند 390 و820 و1440 في `.tmp/student-review-notes/legacy-follow-up-*.png` و`apps/web/test-results/assessment-live-follow-up-*.png`. استعدنا الإجراءات الثلاثة وهيكل البطاقة وحالة غياب المهارات. تبقى شارات توافر الأنواع وزر الفيديو المباشر في البطاقة من فروق الأصل. ملف الدعم يفتح تبويبه حتى تُطبق صلاحيات العرض الحالية.

الاستئناف: افحص زر «شاهد الفيديو» في بطاقة المتابعة مع مسار الدرس المصرح به في التأسيس، بما يتيح اختيار الفيديو دون تشغيل تلقائي. أول أمر محلي: `rg -n "شاهد الفيديو|lessonVideoUrl|selectedLesson|LearnerFoundationLesson" C:/almeaago/almeaacodax/pages/Results.tsx apps/web/src/features/learning/components/FoundationTopicDialog.tsx apps/web/src/features/assessment/components/AssessmentFollowUpSkills.tsx`.

## 24 نوفمبر — نافذة تحليل المهارات بعد «تفاصيل أكثر» / PARTIAL

- Legacy `ed28102d7084899856de0371dc2c93a3d602d518` من `components/DetailedAnalysisModal.tsx` و`pages/Results.tsx`. أعيد تركيب `fix/student-review-notes` فوق أحدث Go main `2c10ff186b726c2e9f37aad96b55afc0ab9144d6`. كود الدفعة `ddece662ba75a9d8a6d89c96b74c29c92779fd5b`. لا رفع أو PR أو نشر لهذا الرأس وGitHub CI SKIPPED.
- الطالب ← «تفاصيل أكثر» أو «عرض الكل» ← `GET /api/v1/assessment-attempts/{id}/review` ← ملكية المحاولة وإتاحة تقريرها ← مهارات المحاولة وأدلتها في PostgreSQL ← نافذة مرتبة من الأضعف للأقوى مع تصفية بالمادة والمسار. يضاف اسم قسم التصنيف إن كان مرتبطًا بالمهارة أو رئيسيتها في المادة نفسها، وتظهر صفة التدريب على نسخ التقييم العادي ذات وضع practice. تعرض أزرار الفيديو والتدريب موضوع التأسيس المرتبط بالمحتوى المطلوب حسب الخادم، وتظهر غير متاحة إذا غاب الربط. تبقى الأذونات في وجهة التأسيس. لا تغيير لتصحيح المحاولة أو حفظها.
- الملفات `AssessmentSkillAnalysisDialog.tsx` و`AssessmentResultSummary.tsx` و`AssessmentResultsPage.tsx` و`resultFoundationPath.ts` و`attempt-client.ts` وملفات Go لعقد النتيجة وتحليل المهارات المنشور والذاتي وOpenAPI والاختبارات.
- RED في `details-red.log` على النافذة السابقة. PASS فحص TypeScript و`git diff --check` وحزم Go للتقييم وخمس حالات متصفح في `details-web-final.log` بعد تحديد بطاقة النسبة في الاختبار. الحالة الجديدة أثبتت ترتيب الدرجات، والتصفية، وفتح التقرير من الزرين، وعودة التركيز بعد الإغلاق، وإغلاق النافذة والتنقل إلى رابط التأسيس. PASS رحلة محاكي بمادتين من التسليم حتى تحليل المهارات وفيديو المراجعة بعد التحديث واختبارا PostgreSQL للمنشور والذاتي في `details-live.log`.
- صور RTL عند 390 و820 و1440 في `.tmp/student-review-notes/legacy-skill-analysis-*.png` و`apps/web/test-results/assessment-live-skill-analysis-*.png`. النافذة والسلوك يضاهيان المرجع في العينة. تبقى فروق الخط وترتيب المهارات ذات النسب المتساوية وفق ترتيب بيانات التقييم، ولذلك لا شهادة بتطابق شاشة النتيجة كلها.

الاستئناف: فحص إجراءات الشرح والتدريب والدعم لكل مهارة داخل قسم «مهارات تحتاج متابعة» في التقرير الكامل مقابل مسار Legacy قبل تنفيذ أي روابط إضافية. أول أمر محلي: `rg -n "topThreeFocusSkills|مهارات تحتاج متابعة|followUpSkills" C:/almeaago/almeaacodax/pages/Results.tsx apps/web/src/features/assessment/pages/AssessmentResultsPage.tsx`.

## 24 نوفمبر — تفاصيل أقسام المحاكي في نتيجة الطالب / PARTIAL

- Legacy `ed28102d7084899856de0371dc2c93a3d602d518` من `components/quiz/QuizSectionResults.tsx` و`quizSubmissionSectionResults.ts`. أعيد تركيب الفرع المحلي `fix/student-review-notes` فوق أحدث Go main `9ea6dd74cab1afb76cf84e688604e5c808e70511` قبل التنفيذ. كود الدفعة `93a2232fb160cfa1c400ce5108598801bf65d38b`. لا رفع أو PR أو نشر لهذا الرأس، وفحص GitHub CI SKIPPED.
- الطالب ← ملخص نتيجة المحاكي ← قسم قابل للفتح أسفل «أداؤك لكل مادة» ← `GET /api/v1/assessment-attempts/{id}/review` ← ملكية المحاولة وإتاحة تقريرها ← أقسام وأسئلة النسخة المسلّمة والإجابات المصححة في PostgreSQL ← `sectionResults` مرتبة بترتيب النسخة. تظهر النسبة غير الموزونة وعدد الصحيح والخطأ والمتروك لكل قسم. يحجب التقرير الجزئي إذا تعذر مطابقة الإجابات والأقسام مع الإجماليات المخزنة. لا تغيير للحساب العام أو تخزين النتائج، ولا تمتد الدفعة إلى تقرير المشرف.
- الملفات `AssessmentSectionResults.tsx` و`AssessmentResultSummary.tsx` و`attempt-client.ts` و`result_review.go` و`result_review_repository.go` و`result_sections.go` وOpenAPI واختبارات النتائج والمحاكي وPostgreSQL.
- RED على المكوّن السابق في `sections-baseline-final.log` بسبب غياب زر التفاصيل. PASS فحص الأنواع و`git diff --check` وحزم Go للتقييم، وأربع حالات متصفح في `sections-web-final.log`. PASS اختبار البيانات في `sections-live-final.log` لتثبيت النسخة، والتمييز بين الخطأ والمتروك، وحجب التقرير المخفي أو الأدلة الناقصة، مع رحلة محاكي بمادتين على Go/PostgreSQL من التسليم حتى فتح التفاصيل بعد إعادة التحميل. أعيد التحقق بعد اكتمال تثبيت تبعيات المتصفح.
- صور بطاقة RTL على 390 و820 و1440 ببيانات متكافئة في `.tmp/student-review-notes/legacy-section-results-*.png` و`apps/web/test-results/assessment-live-section-results-*.png`. السلوك والترتيب مطابقان في العينة، وتظل شاشة النتائج كاملة PARTIAL مع فروق الخط وأغلفة الصفحة. الخادم المحلي وقاعدة الاختبار أُوقفا بعد التحقق.

الاستئناف: راجع زر «تفاصيل أكثر» ومحتوى نافذة تحليل النتيجة مقابل الأصل، بدءًا من البيانات المتاحة في العقد الحالي. أول أمر محلي: `rg -n "DetailedAnalysisModal|تفاصيل أكثر|التقرير الكامل" C:/almeaago/almeaacodax/pages/Results.tsx apps/web/src/features/assessment/components/AssessmentResultSummary.tsx`.

## 24 نوفمبر — المهارات الرئيسية والفرعية في نتيجة الطالب / PARTIAL

- المرجع Legacy `ed28102d7084899856de0371dc2c93a3d602d518` من `components/quiz/QuizSubjectResults.tsx`، وGo main `d57a96db005168a38e2cf90972bfadf1546b3dc4`. الكود المحلي `ed9e04590005f37dab815b828c9843eaa24b8d67` على `fix/student-review-notes`. لا رفع، لا PR، لا دمج، وCI على الرأس SKIPPED.
- الطالب ← «أداؤك لكل مادة» ← «تفاصيل المهارات» ← `GET /api/v1/assessment-attempts/{id}/review` ← تحقق دور الطالب وملكية المحاولة وسياسة إظهار التقرير ← أدلة المحاولة في PostgreSQL مع إضافة `level` و`parentSkillId` من تصنيف المادة الحالي. تعرض الواجهة الفرعية تحت الرئيسية فقط إذا ظهرت الرئيسية نفسها في أدلة نفس المادة والمسار. الفرعية ذات الأب الغائب وبيانات الاستجابة القديمة تظل ظاهرة. لا ترحيل قاعدة بيانات أو تغيير في التصحيح أو حساب الإتقان. اختلاف معروف عن بيانات Legacy المجمدة: نقل المهارة إلى أب آخر في التصنيف الحالي قد يغيّر موضعها، بينما تبقى نسب المحاولة وعدد أسئلتها ثابتين.
- الملفات: `AssessmentSubjectResults.tsx` و`attempt-client.ts` و`result_review.go` و`result_skill_analysis.go` و`self_quiz_skill_analysis.go` وOpenAPI واختبارات النتيجة والمحاكي والذاتي. RED على الواجهة الأصلية في `hierarchy-red.log` بسبب غياب التعشيش. تعثر التشغيل الأول من التقاط الدور الضمني لعنصر تفاصيل المتصفح ثم نجح محدد مجموعة الفرع المسمّاة.
- PASS فحص الأنواع في `hierarchy-types.log` و`git diff --check` وحزم Go للتقييم في `hierarchy-go.log`، وثلاث حالات متصفح في `hierarchy-web-final.log`، واختبارا PostgreSQL للمنشور والذاتي ورحلة محاكي بمادتين بعد إعادة التحميل في `hierarchy-live-final.log`. ثبتت المهارة الفرعية المستقلة عند غياب الرئيسية، وتعشيش «المساحة» تحت «الهندسة» وعدم إرجاع أب من مادة أخرى.
- صور نفس الترتيب والأرقام عند 390 و820 و1440 تحت `.tmp/student-review-notes/legacy-subject-skills-*.png` و`apps/web/test-results/assessment-live-subject-skills-*.png`. بنية البطاقة ومسافة الفرع تضاهيان المرجع في العينة، وتظل فروق الخط والعرض ولقطات الشاشة الكاملة خارج إثبات تطابق هذه البطاقة.

الاستئناف: استعادة «تفاصيل الأقسام» للمحاكي كما تظهر مستقلة بعد تفصيل المواد في القديم. أول أمر محلي: `rg -n "sectionResults|assessment_sections|section_id" internal/assessment/repository/postgres/result_review_repository.go internal/assessment/repository/postgres/result_subjects.go apps/web/src/features/assessment/components/AssessmentResultSummary.tsx`.

## 24 نوفمبر — فيديو الشرح داخل مراجعة الطالب / PARTIAL

- Legacy `ed28102d7084899856de0371dc2c93a3d602d518` من `pages/Results.tsx` و`components/VideoModal.tsx`. Go main `d57a96db005168a38e2cf90972bfadf1546b3dc4` بعد [#293](https://github.com/nasef6464/almeaago/pull/293). كود الدفعة `e2272e598d856155db19a40cb51e8736483df3c8` على الفرع المحلي `fix/student-review-notes` ويشمل دفعة الملاحظات تحته. لا PR لهذا الرأس ولا دمج أو نشر. exact-head CI SKIPPED.
- الطالب ← مراجعة السؤال ← `GET /api/v1/assessment-attempts/{id}/review` ← التحقق من ملكية المحاولة وسياسة نسختها ← رابط فيديو نسخة السؤال من PostgreSQL إن كان الشرح متاحًا ← «تشغيل شرح الفيديو» ← نافذة داخلية تستخدم المشغل المشترك ← الإغلاق والعودة لنفس السؤال. تحميل الفيديو يبدأ عند فتح النافذة والتشغيل يبدأ بطلب الطالب. لا تغيير في API أو التخزين أو سياسة إتاحة الشرح.
- الملفات `AssessmentResultsPage.tsx` و`AssessmentReviewVideo.tsx`، واختبارات المتصفح `assessment-solution-visibility.spec.ts` و`prepared-quiz-live.spec.ts` و`fixtures/review-video.ts` وبيانات اختبار Go في `prepared_quiz_live_browser_test.go`.
- PASS فحص الأنواع و`git diff --check`. PASS حالتا متصفح مع مقطع WebM فعلي محلي للتحقق من التشغيل والإغلاق واستعادة التركيز ومنع طلب المقطع إذا كان الشرح مخفيًا في `.tmp/student-review-notes/video-browser-final.log). PASS رحلة المحاكي بمادتين من التسليم والتحديث إلى المراجعة والفيديو على Go/PostgreSQL معزولين وحالتا سياسة مراجعة في `video-verified-sha.log`. تعثرت تجربة سابقة عندما اختلف امتداد ملف الاختبار بين مسار Go والاعتراض المحلي، ثم نجح الرأس الحالي.
- صور RTL عند 390 و820 و1440 في `.tmp/student-review-notes/legacy-review-video-*.png` و`apps/web/test-results/assessment-review-video-*.png`. حجم النافذة وموضع زر الإغلاق متقاربان. أزرار المشغل واختبار الخلفية مختلفة، لذلك المطابقة البصرية للشاشة الكاملة جزئية. الأدلة لمقطع محلي وليست شهادة تشغيل لكل مزود خارجي.

الاستئناف: طابق ترتيب المهارات الرئيسية والفرعية داخل «أداؤك لكل مادة» من أدلة المحاولة. أثبت وجود معرّف الأب داخل نفس المادة قبل التعشيش، واحتفظ بعرض المهارة التي لا أب مثبت لها. أول أمر محلي: `rg -n "parent_skill_id|ResultSkillAnalysisItem" internal/assessment/domain/result_review.go internal/assessment/repository/postgres/result_skill_analysis.go internal/assessment/repository/postgres/self_quiz_skill_analysis.go migrations/000001_platform_foundation.up.sql`.

## 24 نوفمبر — ملاحظات مراجعة الطالب والعودة من السؤال الأخير / PARTIAL

- القديم `ed28102d7084899856de0371dc2c93a3d602d518` من `pages/Results.tsx`. Go main `d57a96db005168a38e2cf90972bfadf1546b3dc4` يضم [#293](https://github.com/nasef6464/almeaago/pull/293) مع فحوص GitHub ناجحة على رأسه `01c9d0a76c5599a0373abb886c033ac2925d902c`. هذا الدمج استعاد تفصيل المواد وبطاقة المشاركة والرحلة السابقة.
- كود الدفعة المحلية `1e4f2b63fccda54a7629bc2f13126d856823e570` على `fix/student-review-notes` في `C:/almeaago/worktrees/student-review-notes-20261123`. لم يرفع ولم يدمج. CI لهذا الرأس SKIPPED.
- الطالب ← ملخص النتيجة ← مراجعة ← `GET /api/v1/assessment-attempts/{id}/review` ← صلاحيات الطالب ومحاولته في Go وPostgreSQL ← تفاصيل السؤال المتاحة ← إظهار/إخفاء الملاحظات ← الإغلاق عند الانتقال أو تغيير الفلتر ← «إنهاء المراجعة» من آخر سؤال مصفى والعودة للملخص. الزر يغير حالة العرض في React ولا يرسل طلب كتابة. تحت سياسة إخفاء الشرح يظهر نص الحالة فقط. بقيت عقود API والتصحيح كما هي.
- الملفات `AssessmentResultsPage.tsx` و`assessment-image-contract.spec.ts` و`assessment-results.spec.ts` و`prepared-quiz-live.spec.ts`. RED على كود `d57a96db` لأن الشرح ظهر قبل الضغط. PASS فحص TypeScript وGREEN محليًا في `.tmp/student-review-notes/notes-final.log`. المجموعة 16/17 مع تعثر بدء اختبار الصورة مرة، ثم نجاح الحالة منفردة في `recheck.log`. نجحت رحلتا الاختبار الجاهز والمحاكي بمادتين على Go وPostgreSQL معزولين في `live.log`.
- صور RTL 390 و820 و1440 من تشغيل المكوّن الأصلي ببيانات اختبار في `.tmp/student-review-notes/legacy-review-notes-*.png` ومن مكوّن Go في `test-results/assessment-review-notes-*.png`. المقارنة البصرية جزئية لأن سياسات التأليف وبيانات العرض تختلف ولأن لقطة Go للبطاقة. لا تزال مراجعة السؤال تختلف في خيارات الإجابة وموضع الحفظ، ومشغل فيديو الشرح في القديم نافذة داخلية. كما يبقى ترتيب المهارات الرئيسية والفرعية في تقرير المادة.

الاستئناف: افحص عقد تشغيل فيديو الشرح داخل المراجعة مع سياسة العرض، ثم أعد استخدام المشغل المناسب دون تغيير صلاحيات الفيديو. أول أمر محلي: `rg -n "onShowVideo|videoUrl|SharedVideoPlayer" apps/web/src/features/assessment/pages/AssessmentResultsPage.tsx apps/web/src/features/learning/components/SharedVideoPlayer.tsx`.


## 23 نوفمبر — رحلة الطالب بعد التسليم وتكافؤ النتائج والمراجعة / PARTIAL

الأصل المعتمد `ed28102d7084899856de0371dc2c93a3d602d518` (`pages/QuizPage.tsx` و`pages/Results.tsx`). كود Go المحلي على `fix/student-result-legacy-parity` فوق `c57e75cd`.

- الطالب ← تسليم المحاولة ← `POST /api/v1/assessment-attempts/{attemptID}/submit` ← منطق الحفظ والتصحيح وصلاحياته الحالية ← PostgreSQL ← ملخص النتيجة المباشر عند إتاحة التقرير، أو العودة إلى سياق الدرس المحدد إذا كان التقرير مخفيًا. يحتفظ مسار الملخص برابط سياق الدرس بعد إعادة التحميل.
- النتيجة ← مراجعة سؤال واحد مع لوحة الأرقام والتصفية ← `GET /api/v1/assessment-attempts/{attemptID}/review` ← بيانات المحاولة وسياسة كشف الحلول الحالية. النتيجة ← المحاولات السابقة ← `GET /api/v1/assessment-attempts/results?page=…&limit=20` ← محاولات صاحب الجلسة مجمعة حسب عنوان الاختبار. سجل Go يحمل صفحات إضافية عند الطلب. أضيف جزء «مهارات تحتاج متابعة» وملخص قابل للنسخ والمشاركة للتقرير الموسع، مع تفصيل أداء المواد الدراسية (`AssessmentSubjectResults`) وبطاقة المشاركة (`AssessmentShareScorecard`).
- الملفات `AssessmentAttemptPage.tsx` و`AssessmentResultsPage.tsx` و`AssessmentResultSummary.tsx` و`AssessmentPreviousAttempts.tsx` و`AssessmentSubjectResults.tsx` و`AssessmentShareScorecard.tsx`، واختبارات المتصفح في `apps/web/tests/e2e`.
- PASS فحص TypeScript و`git diff --check` وجميع اختبارات نتائج الطالب ومراجعة المحاولات وعودة الدرس وحفظ النطاق (`assessment-results.spec.ts`، `assessment-topic-return.spec.ts`، `student-results-review-scope-save.spec.ts`).

## استلام المنصة كاملة — 23 نوفمبر 2026

نطاق القبول هو جميع الأدوار والوظائف. المرجع التشغيلي [فحص استلام المنصة](PLATFORM_TAKEOVER_STATUS_AR.md) مع [جرد الإجراءات](PLATFORM_ACTION_INVENTORY_AR.md). مثال الاختبارات أدناه يحتفظ بدليله ضمن خدمات الطالب. يبدأ الاستئناف بالموقع العام والدخول وإدارة المسار/المادة وأثره على الطالب وفق الخطة المعتمدة، وتُعالج العوائق المثبتة في أي دور حسب أثرها. رأس Go `c57e75cd` وLegacy `ed28102d7084899856de0371dc2c93a3d602d518`. سجّل نتيجة كل إجراء عند رأسه، ولا تُعلن قبول دور كامل من عيناته.

## لقطة الاستلام السابقة — 23 نوفمبر 2026

**PARTIAL / تحديث توثيقي.** أدلة الفحص في [مراجعة الاستلام](../../reviews/ALMEAA_GO_TAKEOVER_REVIEW_AR_2026-11-23.md). المرجع [خطة التنفيذ](../../03_EXECUTION_AND_HANDOFF_PLAN_AR.md). الفحص: `almeaago/main=f0bbb96bec2f77b409bc6752e713401440f90af3` محليًا وعلى GitHub، و`almeaacodax/main=ed28102d7084899856de0371dc2c93a3d602d518` على GitHub. نسخة Legacy المحلية المفتوحة أقدم، واستُخدمت كائنات Git للرأس المرجعي عند مقارنة الكود. لم تظهر طلبات دمج مفتوحة أثناء الفحص. `supervisor-tabs-20261123` بدأ نظيفًا عند نفس رأس Go. عند إعادة الفحص ظهرت ثلاثة ملفات معدّلة محليًا في `feat/issue-260-supervisor-tabs`، منها الصفحة واختباران، وفي الصفحة أصبحت التبويبات السبعة مفعّلة في كود الفرع. لم يظهر فرع مطابق في GitHub، ويظل أثر كل تبويب وعزله بحاجة للتحقق. مسار `route-splitting-20261123` لم يوجد. استمر في العمل بجوار شريحة المشرف وفق ملكية الملفات، وقارن فروع الاختبارات القديمة بالوظائف قبل إعادة تطبيق أي تغيير.

| النطاق | الحالة والدليل |
|---|---|
| الطالب | #276 و#279 مدمجان. يوجد دليل محلي أقدم على رحلة محددة عبر Go/PostgreSQL، وتظل إعادة الرحلة على الرأس الحالي وقبول المالك معلّقين. |
| المشرف والفصل الذكي | [d59f460f](https://github.com/nasef6464/almeaago/commit/d59f460f) ضمن #280 اختصر الصفحتين. المشرف يتيح الملخص والطلاب، وتبقى خمسة تبويبات معطلة. صفحة المعلم تحتفظ بطلبات الجلسة والحضور والأسئلة والتقرير الأساسي، وتفتقد الربط السابق للسبورة والاستطلاع والريموت والتقرير المتقدم. ملفا المشرف وChatWidget اجتازا قراءة UTF-8 من بايتات Git. |
| نجاح بلا أثر | طلب إرسال تقرير ولي الأمر، الربط والموافقات وتفضيل واتساب تعمل داخل الواجهة في المسارات المفحوصة. بعض إجراءات إنشاء الاختبارات عند المعلم والدورات عند المدرب تعدّل حالة الشاشة فقط. يلزم تتبع واختبار كل إجراء قبل اعتماد النطاق. |
| الأداء والاختبارات | #287 دمج 28 استيرادًا كسولًا. حماية الخطأ الحالية تخص المسارات، والهيدر وChatWidget خارجها. بعض اختبارات E2E تحاكي HTTP، وبعض التغييرات المعزولة في الأدوار أو الفصل أو التجارة أو الدخول لا تقع ضمن مرشحات تشغيل E2E الحالية. |
| الأمان والتشغيل والإطلاق | #286 مدمج، ويظل اعتماد حارس Seed بحاجة لفحص دفاعي محلي على إعدادات اختبار. إعداد Render الموجود للتجربة، وكود Worker موجود دون خدمة في ملف Render. مراجعة Tap والتسوية بين MongoDB وPostgreSQL وتجربة الاستعادة والاعتماد ما زالت ضمن #141. |

**التحقق:** PASS لفحص الواجهة على رأس Go المدمج ولأجزاء E2E الثلاثة على رأس #287 قبل الدمج. فشل فحص TypeScript في النسخة المحلية الأولى بسبب تبعيات منها `lucide-react`. نجح بعد تثبيت التبعيات من ملف القفل في نسخة معزولة، ونجح بناء Vite. نجحت اختبارات Go المستهدفة و14 اختبارًا لأدوات الجرد، وتطبيق 63 هجرة والتراجع عنها وإعادة تطبيقها في PostgreSQL فارغ. SKIPPED في جولة التوثيق: تشغيل Go/PostgreSQL والمتصفح، وصور المقارنة، وفحوص النشر.

**دخول الوكلاء:** أضيفت إلى [AGENTS.md](../../../../AGENTS.md) طريقة مباشرة لتطبيق طلب المالك المختصر. تربط المهمة بالخطة ونقطة الاستئناف، وتحول المحاور المؤثرة إلى فحوص، وتطلب قراءة المهارة وتسجيل أثرها في التسليم. هذا تغيير توثيقي. رحلة الطالب تظل الدفعة الوظيفية التالية.

**أول إجراء في الدفعة التالية:** من جذر Go نفّذ `git status --short --branch`، وطابق الرأس مع GitHub وحدد ملكية الفرع. من `apps/web` في بيئة الاختبار المعزولة، أعد تجهيز التبعيات من ملف القفل بـ `npm ci --no-audit --no-fund` ثم شغّل `npm run typecheck`. جهّز PostgreSQL للاختبار على loopback بمهاجرات الرأس وبيانات صناعية، وشغّل الخادم والواجهة بمتغيرات محلية صريحة. بعدها نفّذ معيار قبول `STUDENT-ATTEMPT-DEMO-20261123` في [سجل الفجوات](gap-register.json)، ووثّق الرابط المحلي والحسابات التجريبية دون أسرار، والنتيجة الفعلية، وأي عائق. السجل المؤرخ أدناه يحفظ الأدلة السابقة.

### إعادة فحص رحلة الاختبار — 23 نوفمبر 2026

- رأس كود المنتج `f0bbb96bec2f77b409bc6752e713401440f90af3`، وفُحص في نسخة الوثائق `28ac0712dba666d6ef07459d2fc34bdcbac4e4c3` التي تطابقه في ملفات التطبيق والاختبارات. Legacy المرجعي `ed28102d7084899856de0371dc2c93a3d602d518`. دمج #276 حمل مكونات الاختبار الذاتي والجاهز، ودمج #279 حمل حفظ واستئناف الطالب. #273 و#274 و#275 مغلقة دون دمج مباشر، وتُقارن دلتا الوظائف قبل نقل أي فرع.
- **PASS (2)، قبول جزئي.** `go test ./internal/assessment/repository/postgres -run '^TestPreparedQuizLiveBrowser$' -count=1 -v` مع PostgreSQL محلي على loopback، وتفعيل `PREPARED_QUIZ_LIVE_BROWSER` و`PREPARED_COURSE_PROGRESS`، وتحديد اختبارَي «رحلة الاختبار الجاهز بين الإدارة والطالب» و«اختبار الدرس والنتيجة والمراجعة والعودة». الأول نشر من محرر الإدارة داخل صفحة اختبار، ثم أتاحه لطالب محدد عبر Go/PostgreSQL، وثبتت الدرجة والمراجعة ورفض طالب آخر. الثاني استخدم ربط درس مهيأ في بيانات الاختبار، وأثبت الحل والنتيجة والمراجعة والعودة لنفس الدرس بعد إعادة التحميل.
- **حدود الإثبات:** الدخول في الفحص تم عبر طلب تسجيل الدخول، وشاشات إدارة الحالة الأولى صفحات اختبار. إنشاء الربط من محرر الدورة الرسمي ثم ظهوره في الدرس يحتاج اختبارًا متصلًا. اختبار محرر الدورة الحالي يحاكي طلبات HTTP حتى عند اختبار التحديث. فحص المتصفح الحي اختياري وغير مفعل بالاسم أو بمتغير التفعيل في ملفات GitHub Actions المفحوصة. ظهرت تحذيرات إعداد الخطوط في خادم الاختبار المصغر. صور Legacy المقترنة، نسخة الموقع التي فتحها المالك وبياناتها، وحالة الحفظ والخروج والاستئناف عبر المسار الرسمي على الرأس الحالي تظل غير مثبتة في هذه الإعادة.
- **التحقق المتبقي لاختبار الدرس:** نفّذ من واجهة الإدارة الرسمية إنشاء الاختبار ونشره، واحفظ الربط بالدرس من محرر الدورة، ثم تحقّق من ظهوره لطالب مستحق ومن الحفظ والنتيجة والعودة. أعد استخدام الأمر أعلاه كمرجع نجاح للحالتين المعروفتين، وأثبت أثر الكتابة بقراءة قاعدة الاختبار وفحص رفض طالب غير مستحق. لم تتغير ملفات التطبيق أو إعدادات GitHub في هذه الجولة.

**توضيح النطاق — 23 نوفمبر 2026:** الدورة هنا تعني الكورس التعليمي ودروسه. الدفعة الوظيفية التالية تبدأ باختبار منصة مستقل من مركز الاختبارات، مع اختيار المسار والمادة ومكان الظهور «اختبارات» والتحقق من إتاحته للطالب والحفظ والنتيجة من الشاشات الرسمية. ربط اختبار بالكورس أو الدرس سياق مستقل في Go ويُفحص في دفعة منفصلة. الاختبار الجاهز الموجّه والتدريب الذاتي والمحاكي والتكليف المدرسي لها مداخل أو قواعد إتاحة تخصها. تُراجع القوائم والأزرار مقابل Legacy قبل تغيير تسمياتها أو ترتيبها.

**جرد المنصة وعقد الاختبارات — 23 نوفمبر:** ابدأ من [جرد الأدوار والأزرار والرحلات](PLATFORM_ACTION_INVENTORY_AR.md) لاختيار معرّف الإجراء قبل فتح ملف. التدريب والعادي والمحاكي أنماط في نظام واحد، وإتاحة الكورس والجمهور سياقان منفصلان عن النوع. أولوية التحقق في الاختبارات الآن: إنشاء تدريب واختبار عادي في مادة، ثم واجهة الحل وما بعد التسليم من القوائم الرسمية، وبعدها المحاكي متعدد المواد وسجل المحاولات والتكليف المدرسي حسب الخطة. الفحص الساكن للأصل والجديد ناجح، و10 اختبارات لأدوات الجرد ناجحة. صور المتصفح المقترنة والتكافؤ على مستوى كل زر ما زالا غير مثبتين في هذه الجولة.

## 22 نوفمبر — أسباب فشل CI / PARTIAL

PR #279 عند `3bb07063`: نجح Backend/Frontend/Database، وفشلت مجموعات المتصفح 82 و64 و234. معظمها موروث من فحوص main، ولا يثبت التشابه عدديًا تطابق كل عطل. يعمل Frontend E2E مع Vite فقط دون API عام، واختبارات كثيرة تستخدم ردودًا صناعية جزئية. مثال مُعاد الإنتاج: `track4_enterprise_ai_system.spec.ts` يعترض bootstrap للطور الكامل برد لا يتضمن skills، ما أدى إلى TypeError في بنك الأسئلة؛ بعد إكمال الرد ظهر فرق مستقل في العنوان المتوقع، كما أن أسماء عدد من الاختبارات تصف وظائف لا تفحصها. لا يجوز حذف الفحوص أو اعتبار العنوان وحده شهادة على الوظيفة.

أُصلحت حماية بنك الأسئلة ضد رد تصنيف غير مكتمل بحيث تعرض الخطأ بدل انهيار الصفحة وتحافظ على الخطأ عند استكمال تحميل الأسئلة. اختبار المتصفح للمشكلة نجح مع رد ناقص ومحاكاة لباقي API. عُدّل Playwright لمنع استخدام خادم قائم في CI وفرض المنفذ، بعد إثبات تلوث فحص محلي بخادم عمل آخر؛ نجح فحص الرفض مع منفذ مشغول، و5 اختبارات دخول محلية نجحت. لا يثبت ذلك إصلاح كل CI؛ يلزم تصحيح تجهيزات واختبارات كل نطاق مع التحقق الفعلي. سجل الفحص `.tmp/integration/taxonomy-green3.log`، والفشل المجمع `.tmp/integration/latest-shard*.log`. الخطوة التالية: تحليل أسماء الإخفاقات والتحقق من صحة كل عقد قبل تعديل التوقع أو بيانات الاختبار. لا دمج أو نشر ما دامت البوابات فاشلة.

## مراجعة الحفظ — 21 نوفمبر

المراجعة المستقلة كشفت حذف علامة الاستكمال قبل نجاح التسليم لمحاولة منتهية أو استرجاع نتيجتها. أضيف اختبار يعيد فشل التسليم ثم يثبت بقاء العلامة، وأُصلح الحذف ليحدث عند نجاح استعادة النتيجة أو إلغاء المحاولة. اختبارات المتصفح الخاصة بانقطاع الاتصال والحفظ نجحت؛ البيانات في `.tmp/integration/expired-fixed.log`. الاستكمال يعتمد المتصفح نفسه. فحص الواجهة الكامل نجح قبل الإصلاح ويجب إعادته على الرأس النهائي. لا رفع دون اعتماد المالك.

## 21 نوفمبر — ترتيب الإجابات ونتيجة الطالب

على فرع `codex/assessment-question-board` فوق `cfc73982`: تعيد قراءة المحاولة إعداد ترتيب الإجابات من نسخة الاختبار، وتستعمله الواجهة في عرض الاختيارات النصية. بعد التسليم تعرض الواجهة تفاصيل النتيجة والمراجعة في نفس الشاشة عند السماح بتقرير النتيجة، بالاعتماد على واجهة المراجعة الحالية وسياسة الخادم. عند إخفاء التقرير لا يُطلب endpoint المراجعة تلقائيًا. لا تغيير لقواعد التصحيح.

PASS: فحص TypeScript، اختبارات Go لنطاق assessment، اختبار عرض أفقي للاختيارات الطويلة، وفحص إخفاء التقرير. رحلة المتصفح المتصلة بـ Go وPostgreSQL نجحت بعد الحفظ وإعادة التحميل ثم التسليم وعرض المراجعة على 390 وعلى الكمبيوتر. السجلات `.tmp/integration/unified-exam-mobile2.log` و`.tmp/integration/unified-exam-desktop.log` و`.tmp/integration/hidden-result.log`. ظهرت تحذيرات خطوط في خادم الاختبار المصغر. المقارنة البصرية الكاملة مع الأصل PARTIAL ولا تشمل كل أنواع الاختبارات؛ لا رفع أو نشر.

## 21 نوفمبر — حفظ محاولة الطالب واستكمالها

الدفعة فوق `2ef67464` على `codex/assessment-question-board`. يقفل زر التسليم النهائي المحاولة عبر مسار Go الموجود بعد التأكيد. زر الحفظ يحفظ وقت السؤال عبر API وينشئ رابط استكمال في «اختبارات المنصة» على المتصفح نفسه، مرتبطًا بحساب الطالب. الإجابات تُقرأ من الخادم عند العودة لنفس معرف المحاولة، وموضع السؤال من المتصفح. يبقى موعد الانتهاء الذي حدده الخادم ساريًا. تُحذف علامة الاستكمال بعد التسليم أو عند فتح محاولة لم تعد جارية.

سجلات التحقق المحلي في `.tmp/integration/attempt-resume-final.log` و`.tmp/integration/attempt-resume-live.log`. فحص الأنواع ناجح. الخطوة التالية مراجعة عنوان ما بعد التسليم وتخطيط الاختيارات مقارنةً بالأصل. لا رفع أو نشر في هذه الدفعة.

## 21 نوفمبر — لوحة أرقام أسئلة محاولة الطالب

على فرع `codex/assessment-question-board` فوق Go main `df538daa` ومرجع Legacy `ed28102d` (`pages/QuizPage.tsx`). أعيدت لوحة الأسئلة إلى يسار السؤال على الشاشة الواسعة، مع شبكة تحت أدوات السابق/التالي على 390 و820. تحافظ البطاقة على حالات السؤال وقواعد الانتقال الحالية. المسار هو الطالب ← بطاقة الرقم ← `changeQuestion` ← حفظ وقت مغادرة السؤال عند الحاجة عبر عميل المحاولة الحالي. لم تتغير عقود API أو التخزين.

تحقق محلي: TypeScript وثلاث حالات متصفح ناجحة لموضع اللوحة والوصول للسؤال 26 ومنع تجاوز السؤال المطلوب في الاختبار العادي والسماح في المحاكي. صور Go محلية عند 1440 و820 و390 في `.tmp/integration/question-board/`. استخدام بيانات محاكاة في اختبار الموضع، ودون صور Legacy مقترنة؛ المطابقة البصرية الكاملة PARTIAL. نجحت رحلة الحل والتسليم والمراجعة مع Go وPostgreSQL، والسجل في `.tmp/integration/question-board-live.log`. التالي: تجربة المالك للشكل ثم مراجعة فرق ترتيب الاختيارات ووجهة ما بعد التسليم كدفعة مستقلة. لا رفع أو نشر في هذه الدفعة.

**حالة البرنامج: جزئي؛ لم يثبت نقل كل المنطق والمحتوى والواجهات.**

المرجع التنفيذي الوحيد plan03. ابدأ من `README_AR.md` ثم عقد فهم المنتج وسجل الفجوات. لا تعد مسح المنصة أو بناء ما ثبت.

## تصحيح فلسفة المالك — 1 نوفمبر

تدريبات المادة موجهة للمهارات/المواضيع الرئيسية؛ اختبارات المادة عشوائية وفق الأصل؛ المحاكي على مستوى المسار وقد يضم مادتين أو أكثر. نتيجة المحاولة تحلل مهاراتها وتوجه الضعيف إلى موضوعات التأسيس والتدريب. المهارة والموضوع والدرس كيانات مستقلة؛ الموضوع الفرعي يرتبط بعدة مهارات وعدة فيديوهات، والفيديو لم يُنتج بعد. Codex مسؤول عن البنية والمنطق، وAntigravity عن إدخال المحتوى. العقد التفصيلي في `PRODUCT_LOGIC_CONTRACT_AR.md` تحت توضيح المالك الحاكم.

لا تُعد قوائم placements الحالية أو وجود جداول الروابط دليلًا على تحقيق الفلسفة: يجب فحص بناء العشوائية والتصحيح وتحليل المهارات الفعلي والأقسام متعددة المواد وربط الأزرار وصلاحية كل رابط مع الأصل وPostgreSQL المعزول. لا تغييرات غير مدروسة في التصحيح/الإتقان أو بيانات الإنتاج.

## استلام تعديلات Gemini — رحلة التدريب والتأسيس / PARTIAL

المالك طلب استلام تعديل Gemini وأكد أن Legacy CODAX هو المرجع. حُفظت تعديلاته المحلية في LearningSpacePage وTaxonomyAdminPage وغيرها، ولم تُكتب بياناته أو ملفات docs/content_migration/scratch. قراءة PostgreSQL المحلية عند الفحص أظهرت 14943 سؤالًا (13676 معتمدًا و1258 مسودة و9 مرفوضة)، و0 assessments و0 placements؛ هذه لقطة لحظية لا تثبت حالة Neon أو المحتوى الجاري نقله. وجود أسئلة لا ينشئ تلقائيًا اختبارًا منشورًا أو يحدد استحقاقه. لا إنشاء بيانات اختبار للطلاب أو نشر مزيف.

أصلحنا إظهار خطأ تحميل قائمة التدريب/الاختبارات مع إعادة المحاولة، منع ظهور قوائم قديمة عند تغير المادة/الحساب، منع تنقل نتيجة بدء متأخرة بعد ترك الصفحة، وإتاحة رابط كامل للنتائج الإضافية بدل إخفاء ما بعد50. رُبط تبويب تدريبات الموضوع بقائمة placements للموضوع نفسه، مع server access/CSRF/idempotency وفشل وإعادة ومحاولة سياق قديم وصفحات؛ لا استخدام لقفل التأسيس كترخيص تدريب. أضيف returnTo آمن من المحاولة إلى الموضوع أثناءها وبعد التسليم؛ النتيجة المفصلة لم تتبنَّ الرابط بعد. الفحص 13/13 للموضوع والرجوع و4/4 لأخطاء القائمة وتغير النطاق ومغادرة الصفحة، و15/15 لمجموعة الموضوع السابقة؛ HTTP محاكى. فحص تطبيق assessment/content PASS وبناء الواجهة PASS مع تحذيرات bundle؛ لا دليل تخزين أو سؤال حقيقي شامل لهذا الربط بعد.

إدارة التأسيس: إصلاح اختيار الأب عند إضافة موضوع فرعي، حفظ النطاق والمهارات وCSRF والقراءة بعد reload عند390/820/1440. معالجة حالة أن الأب خارج أول50 نتيجة ورفض إعادة إظهار أب قديم بعد تبديل المادة. الاختبارات محاكاة؛ لا قبول بصري أو DB شامل. تبقى مطابقة مشغل الأسئلة القديم وشاشة النتيجة وتحليل المهارات والتدريب العشوائي وربط البنوك ومحتوى الاختبارات الحقيقية وفحص صور مقترن، وحماية صلاحياتها. قوائم المادة تعرض أول50 مع رابط «عرض المزيد» للصفحة المخصصة؛ يلزم التأكد منرحلة الوصول الكامل فيها. لا ادعاء اكتمال.

فشل CI السابق: تثبيت أعمدةpresentation في schema اختبار visibility المعزول اجتاز RED/GREEN؛ اختبار cycle workflow يستخدم Go overlay لعزل المرجع القديم، وRED أثبت رسالة descendant parent must conflict وGREEN اجتاز PostgreSQL. لم يرفع بعد. التعديلات الحالية تشمل Gemini وCodex ويجب مراجعتها كدفعة قبل stage/push، مع استبعاد ملفاتالمحتوى والبيانات غير المتتبعة. راجع PR263/262 وCI حيًا؛ الأصل للقراءة فقط.

## مراجعة الدفعة قبل الرفع

المراجعة المستقلة للواجهة ولمسار taxonomy/commerce لم تسجل P1/P2 في نطاق التعديلات؛ هي مراجعة ساكنة وليست اعتمادًا لإنتاج أو دفع حي. على الشجرة المحلية: `npm run typecheck` PASS، وGo لحزم commerce HTTP وtaxonomy application/HTTP/Postgres وplatform HTTP PASS (الاختبارات المشروطة بالقاعدة تُثبت من التشغيل المعزول السابق، وليست ضمن هذا الأمر غير المهيأ). نجح بناء الواجهة سابقًا مع تحذيراتbundle، وأيضًا الاختبارات المذكورة أدناه. المقارنة البصرية الشاملة للهيدر ما زالت FAIL، وCI على304e1063 فشلE2E. بعد commit/push تحقق من SHA الجديد وCI ولا تدمج بفشل قائم. استكمل تقييم فروق الهيدر الكامل ومحرر إعداداته، وبقية الحالات الحية للطالب. تقارير Antigravity غير المتتبعة خارج commit.

## الرئيسية ومساراتها — تصحيح مستهلك إضافي

المراجعة المستقلة كشفت أن `showInHome=false` كان يُحفظ بعد الإصلاح لكنه لا يمنع بطاقة المسار في PublicLandingPage. أصل `pages/Landing.tsx` يستبعدها قبل تطبيق featured IDs. طُبق نفس ترتيب التصفية في الهدف مع الإبقاء على الترتيب والبديل عندما لا يوجد مسار مميز مؤهل. RED: ظهور البطاقة المخفية قبل الإصلاح. GREEN: `homepage-path-home-visibility.spec.ts` **3/3** عند390/820/1440، ثلاثة سيناريوهات لكل مقاس ببياناتHTTP محاكاة (لاfeatured/مختلط/كل المختار مخفي أو قديم). أول تشغيل محلي اصطدم بمهلة30ث لثلاث تنقلات ولقطات لكل حالة؛ حُددت90ث لهذا الاختبار متعدد الخطوات، ثم نجحت الحالات بلا حذف assertions. `npm run build` PASS مع تحذيراتbundle المعتادة. لا يدعي ذلك مطابقة الرئيسية كاملة أو أن الإدخال تحقق من قاعدة حية؛ تدفق حفظ/قراءةfalse والنافذة تحقق مستقلًا بالمتصفح وGo/PG.

حالة الصور: `docs/migration/evidence/owner-20261101-enrollment-dialog/manifest.json` يحفظ18صورة،9أزواج الأصل/الهدف متماثلة بكسليًا للنافذة عند اختيار المرحلة/اختيارها/فشل الحفظ، بموفريGo وCSS وبيانات محاكاة مشتركة. مرجعLegacy فيbaselines ببصمة Git، وعمل الاختبار portable. لقطات الهيدر الكاملة فيmanifest منفصل، نتيجتها FAIL. **لا تزال الرحلة كاملة PARTIAL.**

## متابعة نافذة اختيار المسار وإخفاء المسار

مقارنة نافذة الأصل الفعلية مقابل مكوّن Go في3حالات (اختيار مرحلة، مرحلة مختارة، فشل حفظ) وعرض390/820/1440: **PASS3/3، تسعة أزواج صور متساوية بكسليًا**، وفُتح زوج فشل الحفظ390 بالعين. الصور وSHA في `docs/migration/evidence/owner-20261101-enrollment-dialog/manifest.json`. كلا الجانبين يستخدم CSS وproviders وبياناتGo اصطناعية مشتركة؛ لا يمثل مقارنة تطبيقLegacy كاملًا أو إثبات تكامل قاعدة البيانات. النسخ المرجعية محفوظة ببصمة Git في `docs/migration/baselines/` حتى يعمل الاختبار خارج جهاز المالك.

فجوة ثانية أُصلحت: showInHome لم يكن محفوظًا أو ظاهرًا عبرDTO، فمسار مخفي من الرئيسية والهيدر قد يظهر في نافذة التسجيل. الآن PATCH معfalse/true والإنشاء والاسترجاع للمدير والعام تحفظ القيمة دون محو الإعدادات الأخرى؛ اختبارات taxonomy التطبيق/HTTP/Postgres نجحت على55439 المعزول. اختبار browser→Go→PostgreSQL الحي نجح بعد إضافة حالة مسار مخفي من الاثنين: تحقّق من استجابة API واستبعاده من قائمة الطالب، ثم سجّل مسارًا آخر وحفظ مرحلته واسترجعها بعد reload. الحالة الحية390 فقط؛ حالات الجوال/التابلت/الكمبيوتر الثلاثة وفشل الحفظ الآخر محاكاة. لا إغلاق للهيدر الكامل، فصور الهيدر العامة ما زالت FAIL، ولا ادعاء مطابقة كاملة للموقع.

التعديلات محلية ولم ترفع. خادم CI على304e1063 فشلE2E؛ عند تجهيز الدفعة راجع المخاطر وCI الجديد، واحفظ docs/content_migration غير المتتبعة وتقرير المالك.

## إعادة التقاط الهيدر — الصور محفوظة والنتيجة FAIL

أعيد `HEADER_BROWSER_SUITE=visual` على قاعدة55439 مع Go، مع فصل مخرجاته عن بقية الاختبارات. النتيجة FAIL؛ حفظ76 صورة كاملة للإطار للأصل/الجديد مع SHA256 والفروق الدقيقة في `docs/migration/evidence/owner-20261101-header-full-component/manifest.json`. سجل الفرق9حالات منها guest390/closed عدد3 وadmin820/level عدد45pixel. فُتح الزوجان guest390 وadmin820 بالعين؛ لا يُثبت تشابه الصورة عدم وجود فرق أو تفاعلات ناقصة. التصوير لنسخة Header الأصلية داخل موفري Go مشتركين، ولا يشمل نافذة اختيار الطالب ولا كل تطبيقLegacy. مصدر الفرق قد يكون الرسم أو الكود؛ لم يثبت السبب، ولا تغير السماحية لتجاوز الاختبار.

الخطوة التالية: صور فعلية متقابلة لشريط الطالب والنافذة بمقاساتها وحالاتها؛ فحص التاريخ/الفشل/الأدوار مع الأصل، وتشخيص فرق البكسلات، ثم مراجعة CI. التعديلات المحلية لم تُرفع بعد.

## متابعة الرحلة الحية — PASS وظيفي محدود / الشكل PARTIAL

تركيب StudentPathBar أصلح عدم ظهور نافذة التسجيل. اختبار حي `HEADER_BROWSER_SUITE=enrollment` عبر متصفح Chromium→React→Go→PostgreSQL على قاعدة معزولة55439 نجح: دخول طالب صناعي، اختيار المسار والمرحلة، PATCH معCSRF، تحديث واسترجاع مسار ومرحلة منAPI. PASS على390 فقط؛ حفظ صورة الصفحة الجديدة بعد التحديث في `docs/migration/evidence/owner-20261101-student-enrollment/go-student-390-after-reload.png` SHA256 `DA1544757A9FDD63364731818499D12ECC2BFA4021302F49B8124DFDFD91CFE7`. ليست صورة مقترنة بالأصل. محاولتان سابقتان فشلتا بسبب توقع خاطئ للتحديد المؤقت بعد reload ثم استخدام matcher خاطئ لخيار HTML؛ الأصل يبدّل التحديد المؤقت إلى «كل المسارات» والتسجيل نفسه محفوظ. لم تُخفَ الفشلات.

اختبار الصور الحي الكامل للهيدر فشل في مقارنات exact pixels عند بعض الأدوار والمقاسات؛ عُرض زوج guest390 بالعين وكان قريبًا لكن3pixels مختلفة. الملفات المؤقتة للمحاولة أزيلت تلقائيًا منPlaywright عند تشغيل ملف آخر؛ ليست دليلًا محفوظًا للمراجعة ويجب إعادة توليدها بمجلد إخراج ثابت ونسخها قبل أي تشغيل آخر. مقارنة الأصل المشترك تستخدم نفس providers/StudentPathBar، وبالتالي لا تثبت تطبيق الأصل كاملًا. اختبار رحلة الهيدر الأشمل فشل قبل تسجيل الطالب عند حقل محرر إعدادات غير قابل للتحرير خلال180ث. لا اعتماد بصري للهيدر أو الرحلة الكاملة.

فجوات دائمة كشفتها الرحلة: أُعيد ربط قائمتَي منتجات المتجر وطرق الدفع بالـhandlers القائمة، وأضيف PublicCommerceScopeVisible وفق صلاحية نشر المسار ووالديه والمادة والمرحلة؛ اختبارات Go وPostgreSQL المعزولة نجحت، ومراجعة مستقلة ساكنة بلا P1/P2. ShowInNavbar-only صار مقبولًا باختبارات خدمة، وحقول العرض الأخرى وShowInHome ما زالت تحتاج إكمالًا منفصلًا. بناء الواجهة النهائي PASS؛ تحذيراتbundle وsrc الفارغ بقيت. npm install قوطع ثم فشلEBUSY؛ أصلحت مكتباتlucide وrolldown إلى النسخة المقفلة وأعدت البناء بنجاح، وثبت Chromium1248 الموافق لـPlaywright1.64.1. لا ادعاء سلامة كل dependencies.

كل التعديلات محلية غير مرفوعة حتى الآن؛ لا تُدمج قبل مراجعة الملفات وCI. التالي: صورة كاملة للأصل والجديد لنفس بيانات الطالب والنافذة وحالاتها عند390/820/1440 مع مراجعة بشرية؛ تشخيص محرر الهيدر والاختلافات وتوسيع الحفظ الحي للأدوار والحالات. استمر دون استنتاج اكتمال المنتج.

## شريحة اختيار مسار الطالب — قيد التنفيذ / PARTIAL

المالك اعتمد استكمال الرحلة كاملة بدل ملاحقة الاختبارات وحدها. مرجع الأصل `components/MainLayout.tsx` يعرض Header ثم StudentPathBar؛ الهدف كان يعرض OriginalHeader وحده، والنافذة لا تُركب. عُدل `apps/web/src/app/App.tsx` محليًا لتركيب StudentPathBar بعد الهيدر داخل StudentNavigationProvider، وينشئ الشريط نافذة واحدة للطالب. **لم يُدمج أو يُرفع بعد.**

قبل الإصلاح فشل اختبارا `header-navigation-preferences` لغياب الزرين. بعده PASS2/2 (فشل حفظ/إعادة محاولة/تحديث وتبديل حساب) وPASS3/3 لزر صفحة المسار المقيد عند390/820/1440، باستخدام HTTP محاكى. اختبار Go `TestPostgresSaveReloadIsolationForeignLevelAndAuditRollback` نجح على قاعدة55439 المعزولة؛ يثبت حفظ واسترجاع وعزل ورفض مرحلة أخرى وتراجع التدقيق، بمصادقة اختبار، وليس متصفحًا موصولًا بقاعدة. مراجعة مستقلة ساكنة: لا P1/P2 في تركيب الشريط والنطاق. ليس اعتمادًا بصريًا أو رحلة حية كاملة.

محاولة `TestOriginalHeaderHTTPPostgresBrowser`: حُدثت مهاجرات schema الاختبارية46→47؛ المرة الأولى فشلت لأن تحديث ShowInNavbar وحده يُرفض بـinvalid taxonomy input. هذا خلل منتج مستقل مفتوح؛ أضيف الاسم في fixture كما ترسل واجهة الإدارة كي يمكن مواصلة فحص الهيدر، ولا يُعد العيب محلولًا. المحاولة التالية فشلت قبل المتصفح بـ404 للعنوان `/api/v1/commerce/catalog/products` الذي تستهلكه الواجهة؛ handler الحالي لا يركّب قائمة المنتجات/خيارات الدفع. لا تخفِ الفشل أو تُعلن تطابقًا. الصور المقترنة الكاملة390/820/1440 ونجاح المتصفح مع Go/PG ومراجعتها بعين الإنسان ما زالت مطلوبة. مرجع الاختبار الأصلي يشارك providers مع الجديد، لذا حتى نجاحه لا يثبت تماثل تطبيق الأصل كله.

استعادة pngjs كانت مطلوبة لمقارنة الصور؛ قوطعت محاولة تثبيت أولى قبل اكتمالها فاختفى أمر tsc، ثم فشلت محاولة الاستعادة الكاملة بـEBUSY لأن ملف rolldown مستخدم بعملية أخرى. نجح `npm rebuild typescript --ignore-scripts`؛ تأكد وجود أوامرtsc/vite/playwright وpngjs7 ونجح `node node_modules/typescript/bin/tsc -b --pretty false`. الاستعادة الكاملة لم تنجح ولا يدّعى أن جميع الاعتماديات تحققت. قاعدة الاختبار ملك هذه الجولة55439، أوقفها بعد الاختبارات فقط. ملفات `docs/content_migration/` وOWNER_REVIEW_REPORT غير متتبعة؛ لا تضمها دون قصد. لا تغييرات إنتاج أو بيانات منقولة.

الخطوة التالية: إنهاء استعادة البيئة، إصلاح/اختبار الفجوتين حسب نطاق الخطة دون تخفيف الفحص، ثم إعادة تشغيل browser/Go/PG، التقاط صور كاملة مقترنة ومراجعتها. راجع CI على الرأس الجديد قبل أي دمج.

## توجيه المالك: الفحص البصري الفعلي

طلب المالك صراحة رؤية الصور وفحص الواجهة بصريًا كمستخدم، بجانب اختبارات الكود والتفاعل. تُفحص صور الأصل والجديد المتقابلة لكل جزء ودور ومقاس مناسب، وتُسجل الحالات وحدودها؛ لا يُستنتج تطابق صفحة كاملة من قصاصة. في هذه المتابعة فُتحت صورة هوية الهيدر للضيف390 من المصدر والهدف وقورنت بصريًا، والجزء المصوّر بدا متطابقًا؛ أدلتها المحفوظة محدودة بالمكون وليست فحصًا جديدًا حيًا أو إغلاقًا للهيدر الكامل.

CI الرأس7eb05697 اكتمل:451PASS و30FAIL فيE2E؛ الخادم والواجهة وقاعدة البيانات نجحت. أول ثلاث حالات فاشلة أصلحت محليًا في اختباري الجلسات والتعلم، ونجحت المجموعتان3/3 و5/5؛ بعد رفعها تابع فشل header-navigation-preferences ثم المقارنة البصرية الكاملة للهيدر حسب خطة البوابة.

## متابعة روابط التعلم القديمة

فشل رابطا category في `content-learning-space.spec.ts` محليًا لأن fixture لا يرد على واجهة تفضيلات تسجيل الطالب. أُضيف رد مستقل يسجل الطالب في المسارp1، دون تعديل المنتج أو تعطيل التحكم في التسجيل. أعيد الملف كاملًا **5/5 PASS**، ومنها الانتقال للدورة والدرس؛ HTTP محاكى ولا يثبت بيانات حقيقية أو وصولًا فعليًا. انتهى تشغيل GitHub الحالي41297373197 بفشل30 ونجاح451؛ ترفع إصلاحات الاختبارات بعد التحقق.

## متابعة جلسات الاختبارات

اختبار `assessment-sessions.spec.ts` أعاد محليًا فشلًا بسبب أسماء قديمة للعنوان والزر وتوقع رابط نسبي؛ عُدلت التوقعات وفق الواجهة الحالية مع الاحتفاظ بتحقق الرابط الكامل وإنشاء الجلسة وتفعيلها. الملف كاملًا **3/3 PASS**، مع HTTP محاكى؛ لا يثبت تكامل قاعدة البيانات أو المقارنة البصرية. تشغيل E2E على7eb05697 كان جاريًا؛ راجع نتيجته قبل رفع التحديث لتفادي إلغاء التشغيل القائم.

## متابعة اختبارات إدارة الدورات

على الرأس `7eb05697` نجح اختبار البحث المتعثر سابقًا على820 محليًا، ثم نجح ملف `admin-content-list-scope.spec.ts` كاملًا **15/15** خلال1.7دقيقة دون تعديل الكود. فشل GitHub السابق لم يُعد إنتاجه؛ لا يُفترض علاجه حتى يظهر سبب قابل للإثبات. Backend/Frontend/Database/Overlap نجحت على الرأس المذكور؛ E2E كان جاريًا عند هذا التحديث. راجع نتيجة run `41297373197` ثم أول فشل متبقٍ إن وجد. تقارير المحتوى الخارجية غير المتتبعة محفوظة كما هي.

## أحدث فحص — حفظ التصنيف ومحتوى الترحيل

إصلاح محلي لمسار/مرحلة/مادة: لا تغلق نافذة التحرير إلا بعد نجاح الحفظ، والخطأ داخل النافذة مع بقاء المسودة. قُيّد عرض شبكة المسار لمنع قص الأزرار فيRTL الجوال. **PASS20/20** للملفين `admin-taxonomy-save-retry` و`admin-taxonomy-null-error-retry` عند390/820/1440، وPASS11/11 لاستقلال مركز المهارات، وtypecheck/build ناجحان. HTTP في هذه الاختبارات محاكى؛ لا اعتماد تخزين أو مطابقة بصرية كاملة. تفاصيل الفشلات السابقة محفوظة فيverification.

على الرأس السابق6b84 نجحتBackend/Frontend/Database/Overlap، لكنE2E أعاد429PASS و43FAIL؛ لا دمج. بعد رفع إصلاح التصنيف اقرأ رأسPR263 الجديد، ثم أعد إنتاج أول فشل باقٍ محليًا؛ لا تخفف الاختبارات أو تتوسع إلى مجال جديد قبل حسم سببه.

**المحتوى:** تحقق قراءة فقط من قاعدة127.0.0.1:5432/almeaa أثبت الأعداد المبلّغ عنها، و0 نسخة حالية مفقودة و0 خلل بعدد خياراتMCQ أو عضوية فهرس الجواب، والمنصف1937كلهاQUDRAT/QUANT. لكنه أثبت أيضًا أن **جميع570درسvideo معتمدة بلاvideo_url أوrecording_url أوmeeting_url أوcontent_text**. المالك أوضح لاحقًا أنه لم يُنشئ الفيديوهات بعد؛ هذا متوقع وليس عيبًا في نقل مواضيع التأسيس. الموضوع مستقل ويمكن ربطه بصفر أو عدة فيديوهات لاحقًا. جدولtopic_lessons يدعم ذلك بالمفتاح(topic_id,lesson_id) والترتيب. لا تعُدّ570صفًا فارغًا570فيديو جاهزًا، ولا تحذفها تلقائيًا. شجرةscratch تحتوي العناوين والعلاقات فقط. لا تعديل للبيانات المشتركة أوNeon، ولا اختبار مستقل للسحابة. أمر التدقيق القابل للإعادة: `psql -X -v ON_ERROR_STOP=1 -h127.0.0.1 -p5432 -Ualmeaa -dalmeaa -f scripts/parity/content-import-readonly-audit.sql`؛ BEGIN READ ONLY/ROLLBACK.

## تسليم المحتوى من المالك — 1 نوفمبر، قيد التحقق المستقل

المالك أكد أن Antigravity تولى نقل المحتوى، وأرسل سجل التنفيذ (attachment `e12268fb-660c-42b7-a57d-817d7bcdea3d`). وُجدت ثلاثة تقارير خارجية في `docs/content_migration/`؛ لا تُعدّل أو تُضمّن تلقائيًا في commit إصلاح الواجهة. الحصيلة المبلّغ عنها: 12,673 سؤالًا و50,692 خيارًا و158 موضوعًا رئيسيًا و570 فرعيًا و570 درسًا، محليًا وعلىNeon؛1937 سؤال منصف مع عزل136. **هذه أرقام من تقرير المنفذ، وليست اعتمادًا مستقلًا من Codex.**

الفحص التالي بالقراءة فقط: تسوية أكواد البنوك ومصادرها، نسخ الاختيار التي لا خيارات لها (استعلام التقرير لا يكشفها)، هوية الجواب والصور وتحميلها، وحصر الاختبارات المحاكية الذي لا يغطيه التقرير صراحة. **توضيح المالك: الفيديوهات لم تُنتج بعد؛ لا تُطلب لقبول مواضيع التأسيس، وكل موضوع يدعم عدة فيديوهات مستقبلًا.** المنصف حصريًاQUDRAT/QUANT، وليسNAFES. لا إعادة استيراد أو تعديل لقاعدة البيانات المشتركة أوNeon. قبول العرض والتشغيل مستقل عن قبول أعداد الصفوف. التفاصيل المنظمة في `verification.json.contentMigrationHandoff20261101`.

## أحدث استئناف تنفيذي — الدخول والهوية والبيئة المحلية

الفرع الحالي `fix/question-authoring-answer-parity-20261101`، و[PR #263](https://github.com/nasef6464/almeaago/pull/263). **commit الكود الأخير: `0fbaa2e2435bf72b99f30195c2150cb1b9b0f474`**. إصلاح حفظ الجواب السابق محفوظ في `dad62c8b`، ولم يُعَد تنفيذه. لا دمج أو نشر للإنتاج.

ما أُصلح ونُظّم:

- أضيف قسم `ALMEAA_CODEX_CONTINUATION` إلىAGENTS، وحُدث سجل الأدوات بأوامر التشغيل والمهارات وحدود الاتصال الخارجي. لم يلزم تثبيت اعتماديات جديدة أو تغيير خدمات سحابية.
- كانت App وHeader تفتحان نافذتين للدخول في الوقت نفسه. أصبح للهيدر مالك واحد، مع بديل للصفحات التي تخفيه. الإغلاق يحذفauth فقط ويحفظ بقيةquery والـhash؛ زرا الدخول يعيدان وضع الدخول بعد إغلاق التسجيل. أضيفت أسماء دلالية للتنقل دون تغيير الشكل.
- أُعيد اختبار العودة إلى `authAdapter` الفعلي بدل ملف قديم مفقود، ورُفض محرفTab غير الصالح. لا تغيير لعقود المصادقة أوRBAC أوCSRF أوالمزودين.
- استُبدل المرجع الجزئي للهوية بالهيدر الأصلي الكامل المثبت. المقارنة حرفية بلاmasks أو سماحية بكسلات، وبنفس إعداد رسم المتصفح البرمجي المستخدم أصلًا في اختبارات المقارنة الكاملة.
- أصبحت حالات الهوية والمحرر مستقلة لكل دور ومقاس، مع الاحتفاظ بكل الفحوص والمهل. استدعاء المتصفح عبرNode وتطبيعCRLF في مولّد المراجع يعالجان تشغيلWindows. يحدWaitDelay انتظار تدفقات العملية الفرعية عند الإلغاء، ولا يحول الفشل إلى نجاح.

النتائج الفعلية:

| الفحص | النتيجة وحدودها |
|---|---|
| الدخول والإغلاق وإعادة الفتح والأرقام العربية والاستعادة والتنقل |15 حالة متصفح PASS، بطلباتHTTP صناعية |
| عقود الهوية والتنقل والرئيسية والعودة الآمنة |15 اختبار وحدة/عقد PASS؛ منها4 اختبارات للعودة الفعلية |
| TypeScript وVite وحزمتاGo للإعدادات والهيدر |PASS؛ تحذيرات حجمbundle وdynamic import السابقة محفوظة |
| مجموعةbrand الحية |6/6 PASS خلال170.25 ثانية فيGo؛ مدير وزائر عند390/820/1440؛ جلسات وCSRF وPostgreSQL حقيقية |
| مجموعةeditor الحية |3/3 PASS خلال178 ثانية؛ حفظ واسترجاع وقراءة الزائر وBack/Forward/logout على المقاسات الثلاثة |
| الصور المقترنة |6 أزواج للهوية و6 أزواج لقسمي محرر الهوية والعنوان الرئيسي، متطابقةBytes حرفيًا |
| المراجعة المستقلة |لا ملاحظاتP1/P2 متبقية في النطاق المحدد؛ مراجعة ساكنة، وليست شهادة إطلاق |

أدلة [الهوية](../../evidence/owner-20261101-header-brand/manifest.json) و[المحرر](../../evidence/owner-20261101-homepage-editor/manifest.json). فُحصت صور الهوية بصريًا؛ صور المقارنة تخص المكونات المحددة، وليست شهادة للهيدر أو الصفحة كاملين.

شُغلت مجموعتاbrand وeditor منفصلتين محليًا. الإعداد الافتراضي فيCI ما زال يشغلهما معًا، والمهل120/180 ثانية للمقارنة و5 دقائق لاختبارGo لم تزد. **نجاح التشغيل المنفصل لا يثبت نجاح مدةCI المجمعة.** حُفظت الفشلات والمحاولات السابقة فيverification.json، بما فيها مرجع820 الناقص، ورسم النص المختلف عند1440، ومهلة الاختبار المجمّع.

الحدود الحالية: خادمpresentation المعزول لا يركّبfont-settings endpoint، فيشترك المرجع والهدف في العرض الاحتياطي؛ هذا ليس اعتمادًا لحفظ الخطوط. توجد تحذيراتimgsrc فارغة وحجمbundle خارج الإصلاح المحدد، ولا ادعاء بخلوConsole أو اعتماد الأداء. لا جرد كامل لكل زر، ولا محتوى إنتاج منقول أو تكافؤ منصة كامل. قاعدة55439 الخاصة بهذه الجولة أُوقفت بعد التحقق؛ لم يُمس القديم أوpgdata المشتركة أو.env أو إعداد سحابي.

CI السابق على`4e1f465e`: نجحBackend/Frontend/Overlap، وفشلDatabase عند مرجع820 القديم، وأُلغيE2E بعد15 دقيقة مع فشلات إضافية. بعد رفع التحديث اقرأCI على الرأس النهائي؛ لا تدمج من دليل رأس قديم. PR262 منفصل ولا يدمج شاملًا.

**الخطوة التالية:** تحقق من رأس263 وبواباته، ثم أعد إنتاج أول فشل متبقٍ محليًا وأصلحه دون تخفيف الفحوص. بعد إغلاقه تابع ضوابط الموقع العام#258 ورحلة المدير#259 وفقplan03؛ الجرد الشكلي وحده لا يغلق الدور أو المحتوى.

**أول أمر للاستئناف:** `git status --short` ثم `gh pr view 263 --repo nasef6464/almeaago --json headRefOid,state,statusCheckRollup`، ثم الفجوة النشطة فيgap-register. لا تعِد مسح المشروع. لتشغيل المتصفح الحي اتبعLOCAL_TOOLCHAIN وشغّل مجموعة واحدة على4173.

### السجل السابق محفوظ أدناه

## النسخ

- الأصل read-only: `C:\almeaago\almeaacodax@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`، مطابق remote main عند الاستلام.
- بداية الهدف: `4c1a5a740b22a2e9c3de5e93b25832a587203b42`، كانت شجرة العمل نظيفة ومطابقة لـremote main.
- فرع الدفعة: `fix/question-authoring-answer-parity-20261101` في نفس المجلد المحلي.
- **commit كود الإصلاح واختباراته:** `dad62c8bfada2d1cc10773e193932d0647b00bc3`. أي commit توثيق تابع لا يغير هذا الكود. رأس PR النهائي وفحوصه يقرآن حيًا من GitHub قبل الدمج.
- PR262 قائم لصور اختيارات الطالب عند `07bcd0cf2e666d8a845114af27b93d1455455633` وقت الفحص؛ لا تكرر إصلاحه: https://github.com/nasef6464/almeaago/pull/262 .

## المنفذ

1. ثلاثة اختصاصيين مستقلين فحصوا الأسئلة ورحلة الطالب وبقية الأدوار. كان كاتب كود المنتج واحدًا. انتهت مهام الوكلاء الحالية؛ هذا الملف لا يعني عملهم في الخلفية بعد انتهاء الجلسة.
2. عقد أولي لفلسفة المجالات وقواعدها ومحتواها وعلاقاتها، وقالب لكل جزئية، وفهرس سبعة أدوار، وأداة جرد قابلة للتحديث، وسجل فجوات مثبتة. **لم يكتمل جرد يدوي لكل زر أو نقل محتوى حي.**
3. QB-ANSWER-001: حفظ هوية الجواب بعد إزالة خيارات النص الفارغة، ورفض تحديد الفراغ مع بقاء المسودة. خيارات الصورة ومواضعها وبياناتها البديلة متطابقة: أربعة لـMCQ واثنان لصح/خطأ. لا تعديل لمحرك تصحيح الاختبار أوRBAC أوAPI.
4. اختبار HTTP→Go→PostgreSQL حقيقي يحفظ ويقرأ الجواب والاختيارات ويتحقق من التدقيق ورفض المدخل الخاطئ. جلسة الاختبار صناعية، ولا تثبت المصادقة الحية.

## الأدلة

| الفحص | النتيجة | حدود الدليل |
|---|---|---|
| قبل الإصلاح: خمس حالات متصفح | FAIL5/5 المتوقع | عند390/820/1440 المطلوب0 والمحفوظ1؛ الفراغ لم يرفض؛ موضع الصورة3 صار1 |
| Playwright النهائي، ملف question-bank-admin كاملًا | **PASS12/12** | ست حالات جديدة وست قائمة؛ HTTP محاكى، وليس التخزين الحقيقي |
| TestAuthoringAnswerPersistenceHTTPPostgres | **PASS بأربع حالات فرعية** | فهرس0 و1، صورة بفهرس3 مع أربعة اختيارات، ورفض فهرس غير صالح؛ SQL وHTTP reload والتدقيق؛ مهاجرات المشروع الحقيقية47 داخل schema معزول |
| go test ./internal/questionbank/... | **PASS** | اختبارات التطبيق وHTTP والتصنيف؛ اختبار التخزين المشروط شُغل منفصلًا كما أعلاه |
| go build -o .tmp/owner-verification-api.exe ./cmd/api | **PASS** | تجميع الخادم، دون تشغيل إنتاجي |
| TypeScript ثم Vite build النهائي | **PASS** | تحذيرات حجم bundle وdynamic import محفوظة، ولا اعتماد أداء من البناء |
| أدوات screen/route inventory | **PASS6/6** | سلامة الاكتشاف الساكن؛ ليست شهادة تكافؤ |
| JSON parse وgit diff --check | **PASS** | سلامة ملفات المتابعة والتغييرات |
| مراجعة مستقلة نهائية | لا ملاحظاتP1/P2 متبقية في الإصلاح | مراجعة ساكنة؛ التقطت أولًا مشكلة ترابط اختيارات الصورة وتم تصحيحها واختبارها |
| صور أصل/جديد كاملة ومقترنة | **لم تشغل / NOT PROVEN** | لا شهادة مطابقة بصرية100% أو إكمال المنشئ كله |
| CI على رأس PR النهائي | **تقرأ حيًا بعد الرفع** | لا دمج أو نشر للإنتاج؛ local لا يستبدل CI |

أول توسع للاختبارات القائمة أعاد5PASS وحالة إنشاء واحدة تجاوزت مهلة30s أثناء تشغيل أدوات متزامنة؛ السبب غير محسوم. أُعيد الملف كاملًا دون تخفيف مهلة أو تعطيل اختبار، فنجح12/12 خلال2.8دقيقة. الفشل محفوظ ولا يُمحى من التاريخ.

قاعدة التحقق الخاصة بنا: `.tmp/owner-verification-20261101-pg`،127.0.0.1:55439، واسم `almeaa_owner_verify_20261101`، ببيانات صناعية فقط. الاختبار أنشأ schema خاصًا ونظفه؛ أُوقف cluster بعد نجاحه. لم تُقرأ `.env` أو تستخدم pgdata المشتركة أو خدمة سحابية أو بيانات القديم. الأوامر والنتائج المنظمة في `verification.json`.

## المتبقي وأول متابعة

- **سلامة حفظ الإجابة مثبتة في نطاق محدد؛ المنشئ الكامل ورحلة المتعلم والمطابقة البصرية جزئية.** يلزم متصفح بجلسة حقيقية إلى Go/PostgreSQL بنفس البيانات وصور مقترنة؛ لا تسمِّ اختبارات منفصلة رحلة معتمدة.
- راجع PR262 وفشل CI الحالي؛ لا تنسب فشل E2E عام إلى صور الاختيارات بلا تحليل.
- أكمل بوابة العام#258، ثم رحلة المدير#259 وفق plan03، مع قالب فهم كل جزئية. لا تنظيم ظاهر يغير الأصل تلقائيًا.
- نتائج الاختبار تفتقد تحليل مهارات المحاولة وروابط Topic؛ دروس نافذة التأسيس غير قابلة للفتح وتدريباتها غير موصولة. أصلح صلاحية قراءة محتوى المتعلم وسياق تقدم foundation، دون admin read أو courseId مصطنع.
- خدمات المدارس وإحصاءاتها بها عرض ثابت غير مستمد من العقد والنطاق. أعد استخدام الخدمات القائمة وحالات التحميل والفشل، دون تغيير الاستحقاق.
- عتبات accuracy/evidence/mastery/readiness تحتاج مصالحة دلالية بحالات ذهبية؛ الأرقام المختلفة قد تقيس أشياء مختلفة. لا تغير التصحيح تحت اسم مطابقة الواجهة.
- المحتوى الحي والمزودون والأداء والترحيل التجريبي والاستعادة لم تعتمد في هذه الجولة. لا تثبيت25/95 كتعداد حي، ولا ادعاء إكمال كل جزئية.

## متابعة المحاكي متعدد المواد

- أصلحنا قراءة أدلة المحاولة لتحدد المسار والمادة لكل سؤال، بدل افتراض مادة واحدة للمحاكي؛ وتُحفظ أدلة الإتقان وبطاقات المراجعة في نطاق السؤال. ترفض الأدلة غير المتسقة بدل إسنادها لمادة عشوائية.
- اختبارات Go للتطبيق والتخزين في assessment وlearning نجحت، ومنها اختبارات PostgreSQL ببيانات صناعية معزولة لمادتين وتكرار تطبيق الأدلة وعزل الطالب. سبق الإصلاح فشل الاختبارات المستهدفة على الكود القديم.
- لم تُعتمد رحلة المتصفح أو المطابقة البصرية للمحاكي من البداية للنهاية. يظل نطاق السؤال وروابط مهاراته مأخوذين من البيانات الحالية لا نسخة مجمدة؛ كما أن فشل تسجيل الأدلة بعد حفظ النتيجة ما زال يحتاج معالجة موثوقة. تحليل النتيجة وأزرار علاج الضعف ما زالت أعمالًا متبقية؛ التفاصيل في `RESULT_ANALYSIS_REMEDIATION_AUDIT_AR.md`.
- اختيار الأسئلة عند بناء الاختبار وخلط ترتيب الأسئلة أثناء المحاولة وظيفتان مختلفتان؛ لم تثبت بعد مطابقة قواعد الاختيار العشوائي كاملة.

## فحص بصري لصورة الخيار

- أصلح عرض صورة الخيار المستقلة في المحاولة ومراجعة النتيجة، مع إبقاء زر إعادة تحميل الصورة خارج زر اختيار الإجابة. الاختيارات المضمنة في صورة السؤال تحتفظ بسلوكها.
- فُحصت حالة صناعية عبر Playwright بواجهة API وهمية: ظهور الصورة على شاشة المحاولة والنتيجة، وضغط الخيار وإرسال رقمه وعرض حالة الاختيار. اللقطات المحلية: `.tmp/assessment-question-desktop.png` و`.tmp/assessment-question-mobile.png` و`.tmp/assessment-review-mobile.png`.
- هذه ليست مطابقة بصرية مع القديم ولا رحلة متصلة بخادم وقاعدة حقيقيين. أوضح المالك أن أسئلته كلها اختيار من متعدد ولا يريد مسار أسئلة مقالية؛ وجود نوع مقالي برمجيًا لا يجعله أولوية ضمن النطاق المطلوب. لا يجوز اعتبار كل حالات الاختيارات منجزة دون فحصها.

## توضيح المالك وعرض السؤال والدرجة صفر

- السؤال قد يكون صورة وحدها أو نصًا وحده. في الكمي قد تضم الصورة السؤال والاختيارات، وتظهر تحتها أزرار الحروف فقط؛ لا تكرار لنص البدائل خارج الصورة. عُدل عرض المحاولة والمراجعة حتى لا يظهر وصف الصورة كنص سؤال عندما لا يوجد نص، مع إبقاء الوصف متاحًا لقارئ الشاشة.
- فُحصت في المتصفح حالتا الصورة المتضمنة للخيارات والسؤال النصي باستخدام API وهمية وصورة صناعية؛ اللقطتان `.tmp/question-image-embedded-mobile.png` و`.tmp/question-text-mobile.png`. لا تثبتان المطابقة للمرجع ولا اتصال قاعدة بيانات حقيقية.
- أصلح حساب الدرجة عندما لا توجد إجابات صحيحة: كان مجموع الدرجات الصحيحة NULL ويتسبب في فشل التسليم. اختبار PostgreSQL المعزول فشل قبل الإصلاح ونجح بعده لحالات بلا إجابة وكلها خطأ والإجابة الصحيحة. لا يعني ذلك اكتمال اختبارات كل حالات التصحيح أو التقارير.

## شريحة تحليل مهارات النتيجة

- أضيف تحليل خاص بالمحاولة من لقطة أدلة التسليم، مع نطاق المادة واسمها وعدد الأسئلة والصحيح وتصنيف النتيجة؛ يختلف عن الإتقان التراكمي. عند نقص الأدلة أو تعارض النطاق تظهر حالة غير مكتملة بلا مهارات مفترضة، ولا يُعرض التحليل إذا أُخفي التقرير.
- اجتازت حزم Go المعنية اختبار PostgreSQL المعزول، مع مادتين والسؤال المتروك وحدود التصنيف وملكية الطالب وإخفاء التقرير والأدلة الناقصة أو المكررة. فُحصت الواجهة بمتصفح وAPI وهمية في حالات التحليل المكتمل والناقص والتقرير المخفي؛ لقطات `.tmp/result-skill-analysis-mobile.png` و`.tmp/result-skill-analysis-desktop.png`.
- عند انتهاء هذه الشريحة كان ربط موضوعات التأسيس متبقيًا؛ تقدم الربط موضح في القسم التالي. أسماء التصنيف الحالية ليست لقطة تاريخية مجمدة. حقل النتيجة الأساسي في API موجود مسبقًا حتى عندما إعداد التقرير مخفي ويحتاج مراجعة منفصلة لسياسة الصلاحيات.

## ربط النتيجة بموضوع التأسيس

- عُرضت روابط الموضوعات الصريحة النشطة والظاهرة المرتبطة بالمهارة في نفس المسار والمادة، بما يسمح بعدة موضوعات؛ روابط الشرح والتدريب تفتح تبويب الموضوع المحدد. الرابط ليس تصريحًا لفتح درس أو بدء اختبار؛ قرار التدريب يبقى لخادم المواضع، والقفل لا يُزال.
- أصلح فتح موضوع خارج أول صفحة من مساحة التعلم بطلب الموضوع المحدد والتحقق من معرفه ومساره ومادته، مع رسالة خطأ وإعادة محاولة عند الفشل. كشف learner-topic صار يعيد نطاقه لتمكين هذا التحقق.
- اختبارات PostgreSQL معزولة وHTTP presenter وتطبيق Go نجحت لحالات التعدد والقفل والإخفاء والأرشفة والمادة الأخرى. اختبار متصفح بواجهات وهمية انتقل من النتيجة إلى موضوع خارج الصفحة الأولى ورفض استجابة من مادة أخرى. اللقطات `.tmp/result-remediation-links-mobile.png` و`.tmp/result-remediation-mobile.png`.
- الروابط تعكس ربط الموضوعات الحالي وليست لقطة تاريخية. لم يعتمد بعد المسار المتكامل بقاعدة حقيقية أو تشغيل فيديو تأسيس أو مقارنة صور بالأصل؛ لم تُنشأ دروس أو اختبارات أو بيانات محتوى.

## متابعة 2026-11-02: الرحلة المتصلة وعرض السؤال

- نجحت رحلة بمتصفح وخادم Go وPostgreSQL وRedis محليين مستقلين، ببيانات مصطنعة فقط: إجابة خاطئة وتسليم → نتيجة وتحليل مهارة → موضوع تأسيس → بدء تدريبه → ظهور سؤال التدريب. اللقطتان `.tmp/real-result-remediation.png` و`.tmp/real-topic-training.png`. لا تثبت هذه الحالة كل سياسات الاستحقاق أو المحاكيات أو مطابقة الأصل بصريًا.
- أُضيف إلى إعدادات إصدار السؤال رقم اختياري، ورموز مستقلة لكل اختيار، وحروف افتراضية عربية أو لاتينية، وأعلام مستقلة لإظهار رقم السؤال والرمز والنص. القيم مربوطة بفهرس الإجابة الأصلي، لا بموضع العرض بعد الخلط. الإعدادات موجودة عند الإنشاء والتعديل بإصدار جديد، مع الحفاظ على بيانات السؤال.
- تسمح الشيفرة بخيارات نصها فارغ عندما تظهر رموزها فقط، أو حين تكون داخل صورة السؤال. `000048_question_label_only_options` محلي ولم يطبق على قاعدة المستخدم. ولأن قيد PostgreSQL القديم لا يستطيع رؤية إعدادات الإصدار الأب، أزيل القيد الصفّي وتعتمد صلاحية الاختيار الفارغ على تحقق التطبيق؛ يجب تقييم أي كاتب SQL مباشر مستقل قبل التطبيق.
- نجحت اختبارات Go المستهدفة للتحقق والعرض، واختبار إنشاء HTTP مع PostgreSQL معزول للاختيارات الفارغة وقراءة الإعدادات في محاولة المتعلم. اختبار المتصفح بواجهات وهمية تحقق من الإنشاء والتعديل، وإخفاء وإظهار النص والترقيم، والرموز مع الخلط. اللقطات `.tmp/author-presentation-controls.png` و`.tmp/question-latin-presentation.png` و`.tmp/question-text-only-presentation.png`.
- عند وجود الاختيارات داخل صورة السؤال لا يخلط الخادم ترتيبها حتى لو فُعّل خلط الاختيارات، توافقًا مع الأصل؛ يظهر صف من أربعة رموز في المحاولة والمراجعة. نجح فحص إنشاء السؤال وقراءة المحاولة مع خيار الخلط في PostgreSQL معزول، بما في ذلك ثبات ترتيب اختيارات الصورة.
- إعداد إخفاء تقرير النتيجة أصبح يخفي الدرجة عند التسليم ويعود للمصدر الآمن إن وجد؛ تحقق المتصفح بواجهة وهمية. تقرير API كان يعيد النتيجة كذلك في القديم؛ لا يوصف إعداد العرض وحده بسياسة سرية. عرض الباركود العام وبقية عوارض السؤال والتطابق البصري التفصيلي بالأصل لم تُعتمد بعد. تشغيل دروس التأسيس وصلاحياتها موثق في `FOUNDATION_VIDEO_AUDIT_AR.md` ولم يكتمل.

## استكمال: موضوع التأسيس والدرس

- تأكيد المالك: رابط المهارة يفتح الموضوع الفرعي المرتبط، ويختار الطالب من دروسه بنفسه؛ وتدريباته تخص الموضوع المحدد فقط. الجديد يمرر معرف الموضوع نفسه إلى قارئ التدريبات، بينما روابط المهارة الحالية تعتمد الربط الصريح المسجل وقد تشمل موضوعًا رئيسيًا؛ لم نفرض شرطًا جديدًا على نوع الموضوع قبل فحص بيانات الربط وسلوك المنشئ.
- أضيف محليًا قارئ خادم لدرس داخل موضوع محدد وفحص للنطاق والنشر والقفل والاستحقاق، واستُخدم الفحص ذاته لتقدم التأسيس؛ لم تُعدل واجهة Gemini ولم يضف محتوى. اختبارات تطبيق Content وCommerce وLearning وAssessment نجحت؛ وفحص PostgreSQL لعلاقة الدرس بالموضوع ونطاق المادة نجح بعد تصحيح حقل ناقص في بيانات الاختبار. لم تُختبر بعد رحلة تشغيل فيديو بمتصفح أو مطابقة سياسة الاستحقاق بكل أنواع الباقات على بيانات فعلية.
- حفظ إجابة الاختبار يرفض رقم اختيار غير موجود في نسخة السؤال ويحافظ على الإجابة السابقة. نجح اختبار تطبيق وPostgreSQL معزول؛ لم تطبق تغييرات على قاعدة المستخدم.

## حماية السؤال عند تعذر التصنيف — متابعة PR #279

- مراجعة مستقلة لـ b62bcfc2 كشفت أن النسخ ومحرر القسم قد يعتمدان على تصنيف لم يكتمل. يمنع التعديل تشغيلهما حتى ينجح تحميل المسارات والمواد والمهارات؛ لا يُشترط وجود sections لأن Go يحذف الحقل عندما تكون القائمة فارغة (omitempty).
- PASS: اختبارا متصفح منفصلان باستجابات وهمية للفشل والنجاح؛ الأول فشل قبل الحماية ونجح بعدها، والثاني أثبت إتاحة الأدوات بعد التحميل. PASS: typecheck. لا يثبت ذلك كتابة قاعدة حقيقية أو سلامة كل عمليات بنك الأسئلة.
- آخر فحوص GitHub للرأس السابق b62bcfc2: backend وfrontend وdatabase وoverlap PASS؛ E2E قيد التشغيل. بعض اختبارات المسارات تستخدم بيانات وهمية ناقصة وتتحقق من العنوان فقط، ولا يصح الادعاء بأنها تحقق الوظائف أو تعطيلها لتجاوز البوابة.
- PR: https://github.com/nasef6464/almeaago/pull/279 ؛ لم يدمج ولم ينشر. الخطوة التالية: دفع هذا الإصلاح بعد التحقق ثم متابعة فحوص الرأس الجديد وتصحيح جذور فشل E2E. الأمر الأول: gh pr checks 279.

## متابعة سبب E2E — 22 نوفمبر

- رأس PR #279 هو b9f4516b؛ backend وfrontend وdatabase وoverlap نجحت وE2E فشل بمجموعات متعددة. لا دمج ولا نشر.
- السبب المثبت لبعض الفشل: أربعة ملفات تحظر أي origin بخلاف 127.0.0.1:4173 بينما CI يستخدم 5173. اختبار foundation المعزول على 4277 فشل قبل التعديل بـ ERR_BLOCKED_BY_CLIENT. التعديل يستخدم baseURL الفعلي ويحافظ على حظر المواقع الخارجية؛ دُفع بالرأس b1b71c40.
- PASS: foundation على 4277 بمهلة محلية 120 ثانية، وتسجيل الدخول وتسجيل المسار بعرض 390 بكسل؛ FAIL: اختبار الصفحة الرئيسية تجاوز خطأ الحظر لكنه لم يجد العنوان المتوقع ويحتاج تحقيقًا مستقلًا. بقية المقاسات غير مفحوصة. ملفات التعديل: auth-single-dialog وcategory-enrollment-dialog وfoundation-topic-placements وhomepage-path-home-visibility ضمن apps/web/tests/e2e.
- أسباب فشل أخرى مستقلة ما زالت مفتوحة، منها محددات قديمة واختبارات مسارات اسمها يوحي بتغطية وظيفية بينما تفحص العناوين فقط. لا يعاد تصنيفها أو تعطيلها لتجاوز البوابة. الخطوة التالية: تحقيق اختلاف عنوان الرئيسية مع المصدر، ومتابعة بقية إخفاقات E2E بعد الدفع؛ الأمر: gh pr checks 279.

## مراجعة عمل أنتجرافتي وفشل Database CI

- أنتجرافتي: قراءة فقط C:/almeaago/almeaago، الرأس b5432ca9، PR #280. يعمل على المدارس وإصلاح إعدادات واختبارات E2E، ويتداخل مع شاشة المحاولة والنتائج وملفات اختبارات هذا الفرع. لا يُدمج الفرعان دون مراجعة التعارض وسلوك حفظ الإجابة. فحص database في #280 PASS؛ بقية E2E معلقة وقت الفحص.
- Database CI على b1b71c40 فشل في مطابقة صورة hero لا في الترحيلات: فحص صورة الاختبار وجد 3 بكسلات مختلفة من 1106×3278، وأقصى فرق بقناة اللون 1. إعادة التشغيل رقم 2 للوظيفة 45007178620 PASS دون تعديل الكود أو تخفيف الفحص؛ يدل الفشل السابق على تذبذب متقطع ولم يُصلح سببه الجذري بعد.
- track4 في #280 أصلح fixture الناقص وعدل العنوان، لكن بعض الاختبارات المسماة وظائف لا تفحص سوى ظهور العنوان؛ لا تعتبر تغطية وظيفية.
- التالي: gh run view 45007178620 --json status,conclusion,attempt ثم gh pr checks 280 و gh pr checks 279، مع مراجعة صورة الفشل والتداخل قبل التكامل.

## رسالة حالة السؤال ومحددات الاختبار — 22 نوفمبر

- مصدر المرجع almeaacodax/main عند ed28102d7084899856de0371dc2c93a3d602d518. قسم المسارات الأصلي يحمل عنوان «كل ما تحتاجه للتفوق» وقد أعادته أنتجرافتي محليًا في b5432ca9؛ لم نكرر تعديلها. دمج تجريبي بالذاكرة كشف خمسة تعارضات بين b1b71c40 وb5432ca9 في نتيجة الاختبار وأربعة ملفات E2E، دون تعديل أي فرع.
- أصلحنا رسالة إنشاء السؤال المتناقضة «مسودة معتمدة» لتقول «مسودة»، وعدلنا محددات فحوص إنشاء/تعديل الأسئلة القديمة لتشير للأدوات الحالية مع إبقاء فحص البيانات. اختبار sparse choices فشل قبل التعديل بسبب الرسالة القديمة؛ PASS بعده. PASS: ثلاثة اختبارات متصفح على API وهمية تشمل رمز الخيار، تعديل إصدار دون فقد المحتوى، وتثبيت الإجابة الصحيحة بعد حذف فراغات؛ PASS typecheck. لا تثبت قاعدة حقيقية أو اعتماد السؤال.
- PR #280: database وbackend وfrontend وoverlap وdirector-nav وE2E shard 3 PASS، وشارد 1 و2 قيد التشغيل؛ بعض اختبارات shard 3 لا تثبت وظائف أسمائها. PR #279: database PASS بإعادة التشغيل بعد تذبذب الصورة، E2E فاشل. الخطوة التالية: متابعة gh pr checks 280 وgh pr checks 279 ثم معالجة تعارضات الفرعين وفحوص GitHub الفعلية.

- متابعة فحوص الأسئلة على API وهمية: PASS لحالة رفض إجابة فارغة مع الاحتفاظ بالمسودة ثم إعادة المحاولة، وPASS لحفظ ترتيب اختيارات الصورة في النوعين mcq وtrue_false بعد تحديث خطوات الاختبار للرفع التلقائي الحالي. لم تُختبر خدمة رفع أو قاعدة حقيقية بهذه الحالات. فحوص أنتجرافتي #280 النهائية: E2E shard 1 فشل 66، shard 2 فشل 56، shard 3 نجح؛ backend/database/frontend نجحت، وما زال Vercel pending وقت القراءة.

## مراجعة وأرشفة السؤال — 22 نوفمبر

- على b2675d45 أُعيدت فحوص واجهة وهمية لسلوك إلغاء الأرشفة وتأكیدها؛ PASS: لا طلب عند الإلغاء، PATCH بحالة archived ورقم الإصدار وCSRF عند التأكيد ولا DELETE. PASS: إرسال للمراجعة ثم الاعتماد بحالتي pending_review وapproved والإصدار وCSRF. PASS: رفع Cloudinary الموقّع الوهمي دون api_secret في الطلب. لا تثبت الفحوص سلوك خدمة أو قاعدة حقيقية.
- بقي اختبار إنشاء سؤال الإدارة على سطح المكتب فاشلًا؛ يفترض غياب زر الحذف وحقل وصف صورة لم يُعثر عليه في الواجهة. الزر الحالي يؤدي للأرشفة؛ لم نحذف الاختبار أو نسقط شرط وصف الصورة. مراجعة عقد المصدر وسلوك حقل الوصف ما زالت مطلوبة.
- #280 عند b5432ca9: مجموعتا E2E فشلتا (66 و56 اختبارًا) وثالثة نجحت؛ database وbackend وfrontend PASS. #279 عند b2675d45: database وbackend وfrontend PASS؛ E2E قيد التشغيل. التالي gh pr checks 279 ومراجعة تعارضات #280 قبل دمج أي شيء.

## وصف صورة السؤال — 22 نوفمبر

- راجعنا المصدر ed28102d7084899856de0371dc2c93a3d602d518 في dashboards/admin/builders/UnifiedQuestionBuilder.tsx: لا حقل وصف يدوي في المنشئ، بل الوصف الافتراضي كود السؤال. Go كان يستخدم اسم الملف؛ عُدل لاتباع الكود دون المساس بالوصف الموجود مسبقًا.
- اختبار إنشاء سؤال الإدارة ببيانات وهمية فشل أولًا (الوصف q بدل Q-NEW) ثم PASS بعد الإصلاح، بما في ذلك CSRF والصورة والمهارات. فحص الأرشفة المنفصل يحافظ على اختبار عدم DELETE. PASS typecheck. لا دليل من الخدمة الحقيقية أو قاعدة البيانات لهذه الشريحة.
- مرجع #279 السابق a73b5ba4: backend/database/frontend/overlap PASS وE2E قيد التشغيل؛ #280 يعمل أنتجرافتي في worktree آخر دون تدخل. الخطوة التالية gh pr checks 279، وفحص تعارضات التكامل قبل الدمج.

## متابعة النشر — 22 نوفمبر

- الرأس الحالي f432f66d على PR #279. إعادة الاختبارات الستة student-attempt-save-serialization على منفذ 4277 مع API وهمية PASS؛ تشمل فشل الحفظ على ثلاثة مقاسات، منع التسليم أثناء الحفظ، إعادة محاولة التسليم واستعادة الإجابة المؤكدة. لا تثبت اتصال قاعدة حقيقية بهذه الإعادة.
- GitHub: backend/frontend/database/overlap PASS للرأس f432f66d؛ E2E ثلاث مجموعات جارية، وVercel pending. ربط Vercel MCP لا يملك صلاحية فريق المشروع (403)، وتوليد رابط ترخيص فشل 404؛ لا يثبت ذلك حالة النشر الفعلية. لم يُعدل أي إعداد سحابي ولم يُنشر.
- #280 ما زال في الرأس b5432ca9 مع تعديلات غير ملتزمة لأنتجرافتي؛ فحوصه تحتوي فشل E2E وتعارضات مع #279. التالي: gh pr checks 279؛ ثم تشخيص النتائج وإنهاء دمج التعديلات بعد انتهاء الكاتب الآخر.

## أصل تعطل معاينة Vercel وفحوص الدمج — 22 نوفمبر

- مصدر Neon project wandering-dream-40787500؛ production br-damp-feather-b9lqdru1 وتسعة فروع إضافية، فوصل العدد إلى عشرة. قراءة واجهة Vercel للـ preview عند f432f66d أظهرت فشل Neon branching: Branch limit exceeded؛ ليس خلل بناء. لم نتجاوز الفحص ولم نحذف أو نغيّر قاعدة الإنتاج.
- المرشح br-tiny-snow-b97tvlcw فرع Vercel مؤرشف لطلب #257 المدموج؛ بيانات Neon قبل الاستعلام سجلت compute_time_seconds=0 وwritten_data_bytes=0. بدأ pg_dump قراءة على الفرع المرشح فقط بعد مطابقة المضيف لواجهة Neon. نسخة قاعدة neondb المحفوظة مشفرة AES-GCM في .tmp/integration/neon-backups/preview-257-20261122.dump.aesgcm ومفتاحها مرتبط بحساب Windows عبر DPAPI؛ تحقق فك التشفير والتجزئة وفهرس pg_restore PASS. لا تشمل كلمات مرور الأدوار أو الوسائط الخارجية، ولم تجر تجربة استعادة كاملة؛ لا يصح القول إنها نسخة كاملة للفرع. Neon رفض snapshot لأن الفرع ليس root. لم يحذف أي فرع.
- اختبار #279 عند f432f66d: backend/frontend/database/overlap PASS؛ E2E شارد 1 و2 و3 FAIL (64، 54، 234 حالة). اختبارات student-attempt-save-serialization الستة وquestion-bank-admin المستهدفة PASS على GitHub بمحاكاة. هذه الأرقام لا تثبت أن جميع الفشل أعطال منتج ولا تبرر تخطيها. Vercel check فشل بسبب Neon limit رغم بقاء GitHub Vercel pending.
- أنتجرافتي تعمل الآن بملفات غير ملتزمة تشمل AssessmentAttemptPage.tsx؛ لا تُلمس نسختها أو تُدمج دون انتهاء العمل ومراجعة التعارض. الخطوة التالية: حل فحوص E2E على رأس واحد، والتحقق من خطة الحفاظ على فرع المعاينة قبل أي حذف، ثم إعادة فحص Vercel وCI دون تجاوز البوابات. الأمر الأول: gh pr checks 279.

- محاولة استعادة النسخة إلى PostgreSQL محلي معزول FAIL لأن إضافة pg_session_jwt غير متاحة محليًا؛ لا يثبت فهرس النسخة قدرتها على الاستعادة الكاملة. أُوقف خادم الاختبار، وحظرت المراجعة الآلية إزالة مجلد الاختبار .tmp/integration/restore-check-257-f685b929ed؛ يُحتمل احتواؤه بيانات مستعادة جزئيًا. لم يُحذف فرع Neon المرشح أو قاعدة الإنتاج. لا ينفذ الحذف قبل إثبات استعادة كاملة وتفويض محدد.

## 23 نوفمبر — استعادة ملخص نتيجة الطالب من مرجع المالك

**PARTIAL.** المرفقان يعرضان شاشة النتيجة في Go وLegacy. مصدر Legacy `ed28102d7084899856de0371dc2c93a3d602d518` والمنتج الأساسي `f0bbb96bec2f77b409bc6752e713401440f90af3`. العمل على فرع `fix/student-result-legacy-parity`. فُصل ملخص النتيجة ومراجعة الأسئلة، واستُعيد ترتيب الدرجة والتوزيع ووقت الحل والأزرار، وتحليل المهارات وخطوة التدريب من بيانات المحاولة. احتُفظ بسجل المحاولات ومصدر الرجوع وسياسة إخفاء الدرجة والحلول كما يرجعها الخادم. لا تغيير في إجراءات التصحيح أو صلاحيات الخادم أو قاعدة البيانات.

**الأدلة:** RED لفقد عنوان وملخص Legacy في `assessment-results.spec.ts` ثم PASS في الإعادة المحلية المركزة لأربع حالات بمُحاكاة HTTP. لقطة الملخص في 390/820/1440 من بيانات تجربة، ولقطات المرجع من HTML المالك على المقاسات نفسها ببيانات مختلفة. نجح `npm --prefix apps/web run typecheck`، ونجح `TestPreparedQuizLiveBrowser` لحالتين على Go وPostgreSQL معزول: اختبار جاهز من محرر اختبار إلى طالب، واختبار درس مُهيأ وحفظ النتيجة والعودة. قاعدة الاختبار أوقفت. لم تُرفع الدفعة إلى GitHub.

**المتبقي:** بطاقة الأداء لكل مادة تحتاج بيانات موثوقة على مستوى المادة من الخادم. مراجعة الأصل الكاملة تشمل عرضًا متسلسلاً للأسئلة، مشاركة بطاقة النتيجة، مقارنة التقرير الكامل، وتكافؤ التنقل بعد التسليم. صفحة المحاولة تعرض تأكيد التسليم الحالي ثم الملخص المستعاد. لا شهادة لتطابق بصري بنفس البيانات أو لمطابقة 100%. ابدأ الجولة التالية بفحص `internal/assessment/repository/postgres/result_review_repository.go` وواجهات النتيجة في Legacy قبل إضافة مؤشرات خادم جديدة.

الفحص الموسع: 29 PASS و5 FAIL في التشغيل المتوازي. الحالات الخمس نجحت في الإعادتين المستهدفتين بعد تكييف خطوات دخول المراجعة، 4/4 و6/6. لم تُعد المجموعة الموسعة كاملة بتشغيل واحد أخضر.

## 26 نوفمبر — إتاحة بطاقات المادة من إدارة المسارات

- مرجع Legacy هو `ed28102d7084899856de0371dc2c93a3d602d518` في `FoundationManager.tsx` و`PathsManager.tsx` و`SubjectQuizzesPanel.tsx`. أساس Go هو `58ebc7ea62b40de1bfc3aa4b87c47ec78d1117e0` وتطبيق الدفعة `f330fe9f6c552546e6286d8cf75d79ef627f6217` على [#317](https://github.com/nasef6464/almeaago/pull/317). الطلب مسودة مستقلة عن #316.
- **VERIFIED محليًا.** مدير المنصة ← المسار والمادة ← بطاقة الموضوع الرئيسي ← `GET/PUT /api/v1/foundation/topics/{id}` مع `expectedRevision` ← Content Go ← `foundation_topics.is_locked` ← ساحة تعلم الطالب. ظهر الأثر في الاتجاهين مع بقاء الظهور ورفض كتابة الطالب 403.
- **VERIFIED محليًا.** مدير المنصة ← بطاقة التدريب أو الاختبار العادي ← `GET /api/v1/assessments` بمرشح `normalMode` ونطاق المسار والمادة ← استرجاع حالة موضع المادة في نفس الطلب ← زر تبديل واحد ← `PATCH /api/v1/assessment-placements/{id}` مع `expectedUpdatedAt` ← Assessment Go ← `assessment_learning_placements.access_type` ← قائمة الطالب. لا ترحيل لهذه الدفعة.
- فحوص Go لحزم المحتوى والاختبارات PASS، وفحص PostgreSQL لضم موضع المادة المنشور واستبعاد سجل بلا موضع PASS. اختبار Chromium بمحاكاة HTTP PASS عند 390/820/1440، وأثبت بقاء الظهور والترتيب والحالة بعد التحديث. دليل التشغيل الحقيقي المحلي في `C:/almeaago/tmp-evidence/taxonomy-workspace-audit/card-access-live.cjs` للبيانات التجريبية فقط. فشل CI الأول في محمل اختبار فصل المهارات بسبب المكونات المضافة وصُحح مع بقاء شروط الاختبار ونجاح 11/11 محليًا.
- **PARTIAL.** الزر الخارجي يبدّل الحالة مباشرة مثل الأصل ويحتاج مكان ظهور قائمًا للنسخة المنشورة في المادة. عند غيابه توفر البطاقة رابط المركز. لا إثبات للتكافؤ البصري الكامل لصفحة إدارة المسارات. المحاور المتأثرة A/B/D/E/G/H. طُبقت مهارتا مطابقة الأصل وعقود API. لا دمج ولا نشر إنتاج. أول إجراء بعد الاستئناف `gh pr checks 317` على آخر رأس.

## 26 نوفمبر — عقد كشف الطلاب للمشرف والمعلم ومدير المنصة

- `fix/school-roster-json` على أساس `cd3f11b6`. كشف الطلاب في `GET /api/v1/schools/{schoolId}/roster` كان يرسل أسماء Go مثل `UserID` و`Roles` بينما الواجهة تقرأ `userId` و`roles`. صُحح العقد في `internal/organizations/domain/core.go` وOpenAPI. لا هجرة لهذه الدفعة. إصلاح إنشاء المدرسة مستقل في #322.
- اختبار HTTP المطابق لأسماء المفاتيح RED على الأصل ثم PASS، وحزمة `go test ./internal/organizations/...` PASS. في Go/PostgreSQL محلي على `000067` ثبت أن المشرف يرى الطالب داخل فصله فقط، والمعلم يرى فصله المسند وحده، والمدير ينقل الطالب ضمن المدرسة ويرفض قراءة مدرسة أخرى. تفعيل وحدة الاختبارات في العقد أعطى المدير 200، وسحبها أعاد 403 لنفس الجلسة.
- رفض الخادم محاولة المشرف للنقل عبر مسار المدير. نقل المشرف يحتاج مسارًا مستقلًا يفحص التفويض النشط للفصل المصدر والوجهة داخل معاملة واحدة. لا اعتماد بصري كامل لهذه الجولة. تمت مراجعة محوري الصلاحيات وعقود API. أمر المتابعة الأول `gh pr list --head fix/school-roster-json` ثم فحوص الرأس.
