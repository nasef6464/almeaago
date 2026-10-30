# 32 — استعادة الهيدر والتنقل الأصلي وربط قدراته

دفعة جارية تابعة للخطة03 وعقد المالك وتوجيه التسريع المستلم. مصدر المقارنة `almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`؛ Header blob `c4e45e5d9bd485538036e98f70eac42471a8fa71`. قاعدة التنفيذ `almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`؛ تحفظ #150–#157. لا مصدر أو إنتاج أو نشر.

## التنفيذ والملكية

مسؤول دمج واحد ووكلاء بملكية ملفات منفصلة: taxonomy والوجهات العامة؛ learning preferences والجلسة؛ البحث والإشعارات ومرجع المقارنة؛ commerce والسلة؛ ومراجعة مستقلة للربط والأمان. الاستفادة من دومينات Go القائمة مع نقل عرض الأصل، دون إعادة بناء المنصة أو نقل قرار صلاحية إلى React.

| الرحلة | الربط والتنفيذ | حدود القبول |
|---|---|---|
| المدير يضبط القوائم ← المستهلك | محرر homepage الأصلي ← content settings القائمة ← PostgreSQL JSON ← StudentNavigationProvider/Header | أعيد تفعيل قسم الشريط العلوي فقط؛ بقية أقسام المحرر المعطلة لا تدعي التنفيذ |
| المدير يضبط المسار والمادة | taxonomy admin ← PATCH ← JSONB presentation مع حفظ false/empty/omission والإعدادات غير التابعة ← bootstrap بحسب الدور | bootstrap الموظف الخاص لا يفتح صلاحيات المحتوى؛ العام نشط فقط |
| الطالب يسجل مسارًا ومرحلة ← تحديث | StudentPathBar/EnrollmentDialog الأصليان ← self GET/PATCH + session/CSRF ← learning preferences migration46 + audit | التفضيلات لا تمنح entitlement؛ لا import لبيانات قديمة ضمن الدفعة |
| البحث | SearchModal الأصلي ← discovery ← read ports في content/questionbank ← PostgreSQL | platform/published/approved/visible/scope فقط؛ لا إجابات أو بحث في تفسير السؤال؛ ذلك يحافظ على خصوصية Go الأقوى |
| الإشعارات | NotificationBell الأصلي ← inbox/count/read/read-all/SSE القائمة | فشل الحفظ لا يمسح unread؛ fixture بلا broker لا يثبت SSE متصلًا |
| السلة والعضويات وباقات المسار | عرض الأصل ← commerce public catalog + payment options ← checkout وCSRF القائمان | السعر والخصم والوصول سلطة Go؛ لا سعر أو حساب دفع مختلق |
| المدونة والمحاكيات | عرض الأصل ← metadata APIs عامة محروسة ← published snapshot/approved lesson previews | لا نشر protected bodies أو أسئلة/إجابات؛ عرض metadata لا يفتح محاولة |
| محاكي المسار ← محاولة ← نتيجة ومراجعة ← عودة | native attemptClient/lifecycle القائمان + safe returnTo/source | يحفظ سياق المسار دون تغيير التصحيح أو دورة الحياة |
| المصادقة والحساب والثيم | markup الأصلي ← AuthProvider/identity القائمة؛ local theme key الأصلي | OAuth المستقل إلى لوحة الدور، وطلب الدخول من سياق يحتفظ به |

## فحوص التنفيذ والمراجعة

نجح محليًا `go test ./...`، وفحص TypeScript وبناء Vite. نجح68 اختبارًا مركزًا للهيدر وتوابعه في آخر تشغيل قبل الإصلاحات الأخيرة، وتُشغّل حالات الإصلاحات الجديدة كذلك. اكتشف Playwright عدد152 اختبارًا في38 ملفًا. اختبارات المقارنة تشمل تنفيذ بناء القائمة الأصلي دون قص4/8/10، وعرض HTML للهيدر المغلق لسبعة أدوار، وحالات البحث والإشعارات والتفضيلات والسلة والروابط. جرد المسارات60 مقابل55 في snapshot الأصلي؛32 مشتركة حرفيًا. جرد mount33؛ الأرقام ليست شهادة تكافؤ.

كشفت المراجعة المستقلة ثلاث حالات P2 وعولجت باختبارات مركزة: اختلاف المستويات النشطة بين واجهة التسجيل والخادم مع الحفاظ على السجلات القديمة؛ إعادة استخدام مفتاح طلب دفع لنية مختلفة؛ وظهور منتجات تحت مسار/مادة/مرحلة أو سلف مؤرشف. قارئ visibility العام منفصل عن عقود الشراء القائمة، ولا يغير grants أو التسعير.

PostgreSQL والمتصفح محليًا **غير مثبتين**: لا DATABASE_URL؛ initdb يرفض root ولا تسمح البيئة بتبديل uid/chroot؛ Chromium يخرج SIGTRAP قبل إنشاء context حتى مع مساري الإطلاق المعتاد والخادم. لا تحتسب الاختبارات skipped دليلًا. أضيفت اختبارات PostgreSQL المعزولة وfixture native يجمع الجلسات وCSRF والتصنيف والبحث والكتالوج والحفظ والمتصفح داخل CI؛ تُسجل نتائجه الفعلية على رأسPR قبل اعتماد أي قبول.

## المقارنة وحدودها

مرجع full Header يولد من blob الأصلي بعد تحقق بصمته، مع تبديل imports فقط. المقارنة في نفس إطارات Router/Auth/StudentNavigation/Fonts والجسم القابل للتمرير: guest/admin/student ×390/820/1440، مغلق وقوائم مسار/مرحلة أو جوال، وصور PNG بدون masks أو tolerance. هذا دليل للمكون مع providers مشتركة، وليس تشغيل تطبيق المصدر كله. رحلة actual App مستقلة للحفظ والتحديث والروابط والمصادقة والبحث والإشعارات والثيم. اختبار الشعار السابق محفوظ.

الحالة **PARTIAL / NOT PROVEN** إلى أن تنجح الفحوص والصور والمراجعة على الرأس النهائي. لا يغلق هذا السجل بوابة الموقع العام أو المنصة.

## فجوات معلنة تستكمل وفق الخطة

- بقية مستهلكات homepage والعدادات/featured content/الإعلانات، ومساحة المسار والمادة الأصلية بكل تفاصيلها ما زالت ضمن بوابة الموقع العام وما يليها؛ لم تُعد generic LearningSpacePage شهادة لاستعادة GenericPathPage كاملًا.
- تفاصيل ملكية باقة المشتري، حسابات البنك/المحفظة وحفظ الإيصال/المرجع لا تملك عقود Go مكافئة بعد؛ لذلك لا شهادة purchase parity كاملة ولا badges ملكية مختلقة.
- لوحة الحساب الأصلية تحتوي روابط profile/achievements/my-quizzes/instructor وغيرها لم تغلق رحلة وجهاتها كلها؛ إعادة markup وحدها لا تثبتها. بيانات teacher managed scopes غير المتاحة في identity لا تُختلق.
- المحاكيات لا تدعي analytics/completion أو metadata دفع وعناوين أقسام غير متاحة؛ مدة العرض وexpiry تحتاج مقارنة إضافية للنسخ متعددة الأقسام.
- الـscope القديم orphan preferences لا يستورد تلقائيًا إلى العلاقات الجديدة؛ ترحيل البيانات خارج هذه الدفعة.
- المقارنة تسجل overflow وموضع إغلاق قائمة الجوال حتى لو كان الأصل يعيبهما؛ لا إخفاء أو تغيير صامت للتصميم لتجاوز الصورة.

الخطوة التالية داخل نفس القبول: تثبيت رأسPR، فحص CI الحقيقي والصور وتصحيح أي فشل، ثم استكمال الفجوات العامة المعلنة؛ لا بدء خطة ثانية أو الادعاء باكتمال الهيدر لمجرد نجاح shell.


## 2026-10-30 — جرد 183 ملفًا قبل تضييق #158 (WIP=1)

- **MAIN_SHA:** `a82145bbd840f8b743225bd33e4e293fdb176652`؛ **TARGET_PR:** #158؛ **HEAD_SHA عند بدء الجرد:** `76304b3b84bd6f97f62309be4839ae39e06582ef`؛ **LEGACY:** `almeaacodax/main` للقراءة فقط.
- **حالة مقارنة GitHub:** `diverged`، متقدم 13 commit ومتأخر 54؛ **183 changed paths**. الجرد مستمد من `compare_commits` و`list_pr_changed_filenames` للطلبين #159/#229، وليس تخمينًا من قائمة أول صفحة.
- **فئات الملكية:** `SHARED_COORDINATOR`=12؛ `ASSESSMENT`=14؛ `AUTH`=4؛ `CONTENT_ADMIN`=23؛ `STUDENT_229`=20؛ `HEADER_159`=15؛ `PUBLIC_REVIEW`=54؛ `COMMERCE_REVIEW`=24؛ `OTHER_TEST_OWNER`=17.
- **قرار عدم الفقد:** هذا الجرد يصنّف **الملكية المحتملة فقط**، ولا يثبت أن أي patch مكرر أو مدمج. لا تحذف/تُسقط أي ملف من الفرع حتى تُقارن patch بالـmain الحديث ويثبت `ALREADY_MERGED` بالـblob/behavior أو يُسلم فريدُه إلى مالكه ويؤكد الاستلام. `PUBLIC_REVIEW` تعني المرشح للمراجعة وليست موافقة على الدمج. كل `COMMERCE_REVIEW` محجوز حتى تفويض منفصل لأي تأثير دفع/سعر/RBAC.
- **ترتيب المصالحة من المشرف:** #159 للعرض والتنقل، #229 لسياق الطالب، عقود taxonomy/content لصاحبها؛ #158 للملفات العامة غير المتداخلة بعد استلام النقل. لا تغيّر ملفات CI أو ملفات فرق أخرى.

| الملف | نوع دلتا | مالك المراجعة | تداخل مفتوح |
|---|---|---|---|
| `.github/workflows/database.yml` | modified | SHARED_COORDINATOR | #229 |
| `.github/workflows/frontend-e2e.yml` | modified | SHARED_COORDINATOR | #229 |
| `.github/workflows/frontend.yml` | modified | SHARED_COORDINATOR | #159,#229 |
| `AGENTS.md` | modified | SHARED_COORDINATOR | — |
| `apps/web/package.json` | modified | SHARED_COORDINATOR | — |
| `apps/web/playwright.config.ts` | modified | SHARED_COORDINATOR | — |
| `apps/web/src/app/App.tsx` | modified | SHARED_COORDINATOR | — |
| `apps/web/src/features/assessment/pages/AssessmentAttemptPage.tsx` | modified | ASSESSMENT | — |
| `apps/web/src/features/assessment/pages/AssessmentResultsPage.tsx` | modified | ASSESSMENT | — |
| `apps/web/src/features/assessment/pages/assessment-return.test.mjs` | added | ASSESSMENT | — |
| `apps/web/src/features/assessment/pages/assessment-return.ts` | added | ASSESSMENT | — |
| `apps/web/src/features/auth/utils/oauth-return.ts` | added | AUTH | — |
| `apps/web/src/features/content/api/content-types.ts` | modified | CONTENT_ADMIN | #159,#229 |
| `apps/web/src/features/learning/navigation/PathEnrollmentDialog.tsx` | added | STUDENT_229 | #229 |
| `apps/web/src/features/learning/navigation/StudentNavigationProvider.test.mjs` | added | STUDENT_229 | #229 |
| `apps/web/src/features/learning/navigation/StudentNavigationProvider.tsx` | added | STUDENT_229 | #229 |
| `apps/web/src/features/learning/navigation/StudentPathAccessPrompt.tsx` | added | STUDENT_229 | #229 |
| `apps/web/src/features/learning/navigation/StudentPathBar.tsx` | added | STUDENT_229 | #229 |
| `apps/web/src/features/learning/navigation/index.ts` | added | STUDENT_229 | #229 |
| `apps/web/src/features/learning/navigation/studentPathScope.test.mjs` | added | STUDENT_229 | #229 |
| `apps/web/src/features/learning/navigation/studentPathScope.ts` | added | STUDENT_229 | #229 |
| `apps/web/src/features/learning/navigation/types.ts` | added | STUDENT_229 | #229 |
| `apps/web/src/features/learning/pages/LearningSpacePage.tsx` | modified | STUDENT_229 | #159,#229 |
| `apps/web/src/features/learning/pages/learning-route.ts` | added | STUDENT_229 | — |
| `apps/web/src/features/presentation/HomepageManager.tsx` | modified | CONTENT_ADMIN | — |
| `apps/web/src/features/public/components/LegacySiteHeader.tsx` | modified | HEADER_159 | #159,#229 |
| `apps/web/src/features/public/header/OriginalHeader.tsx` | added | HEADER_159 | — |
| `apps/web/src/features/public/header/authAdapter.test.mjs` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/authAdapter.ts` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/commerce/CartPage.tsx` | added | COMMERCE_REVIEW | — |
| `apps/web/src/features/public/header/commerce/EmptyState.tsx` | added | COMMERCE_REVIEW | — |
| `apps/web/src/features/public/header/commerce/PathPackagesPage.tsx` | added | COMMERCE_REVIEW | — |
| `apps/web/src/features/public/header/commerce/PaymentModal.tsx` | added | COMMERCE_REVIEW | — |
| `apps/web/src/features/public/header/commerce/PricingComparisonMatrix.tsx` | added | COMMERCE_REVIEW | — |
| `apps/web/src/features/public/header/commerce/PricingPage.tsx` | added | COMMERCE_REVIEW | — |
| `apps/web/src/features/public/header/commerce/cart-model.test.mjs` | added | COMMERCE_REVIEW | — |
| `apps/web/src/features/public/header/commerce/cart-model.ts` | added | COMMERCE_REVIEW | — |
| `apps/web/src/features/public/header/commerce/checkout-intent.test.mjs` | added | COMMERCE_REVIEW | — |
| `apps/web/src/features/public/header/commerce/checkout-intent.ts` | added | COMMERCE_REVIEW | — |
| `apps/web/src/features/public/header/commerce/commerce-public-client.ts` | added | COMMERCE_REVIEW | — |
| `apps/web/src/features/public/header/commerce/pricingComparisonData.tsx` | added | COMMERCE_REVIEW | — |
| `apps/web/src/features/public/header/commerce/useHeaderCart.ts` | added | COMMERCE_REVIEW | — |
| `apps/web/src/features/public/header/dependencies/NotificationBell.tsx` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/dependencies/SearchModal.tsx` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/dependencies/ThemeToggle.tsx` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/dependencies/notification-session.ts` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/dependencies/search-transport.ts` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/headerApi.ts` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/headerStore.ts` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/navigation.ts` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/ArticleReaderModal.tsx` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/BlogPage.tsx` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/Card.tsx` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/LearningCatalogCounters.tsx` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/LegacyCategoryPage.tsx` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/MockExamsPage.tsx` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/PathMockExamsPage.tsx` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/PathMockExamsView.tsx` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/README.md` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/defaultArticles.ts` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/destination-model.test.mjs` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/destination-model.ts` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/educationalIcons.ts` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/path-mocks-ui.test.mjs` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/path-mocks.test.mjs` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/path-mocks.ts` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/public-metadata.test.mjs` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/public-metadata.ts` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/public/header/pages/sanitizeArabicText.ts` | added | PUBLIC_REVIEW | — |
| `apps/web/src/features/taxonomy/api/taxonomy-admin-client.ts` | modified | CONTENT_ADMIN | — |
| `apps/web/src/features/taxonomy/pages/TaxonomyAdminPage.tsx` | modified | CONTENT_ADMIN | — |
| `apps/web/src/features/taxonomy/pages/TaxonomyDisplayEditor.tsx` | added | CONTENT_ADMIN | — |
| `apps/web/tests/e2e/ai-assistant.spec.ts` | modified | OTHER_TEST_OWNER | — |
| `apps/web/tests/e2e/ai-question-assistant.spec.ts` | modified | OTHER_TEST_OWNER | — |
| `apps/web/tests/e2e/assessment-assignments.spec.ts` | modified | ASSESSMENT | — |
| `apps/web/tests/e2e/assessment-attempt.spec.ts` | modified | ASSESSMENT | — |
| `apps/web/tests/e2e/assessment-management.spec.ts` | modified | ASSESSMENT | — |
| `apps/web/tests/e2e/assessment-placements.spec.ts` | modified | ASSESSMENT | — |
| `apps/web/tests/e2e/assessment-results.spec.ts` | modified | ASSESSMENT | — |
| `apps/web/tests/e2e/assessment-sessions.spec.ts` | modified | ASSESSMENT | — |
| `apps/web/tests/e2e/auth-arabic-indic.spec.ts` | modified | AUTH | — |
| `apps/web/tests/e2e/auth-parity.spec.ts` | modified | AUTH | — |
| `apps/web/tests/e2e/classroom.spec.ts` | modified | OTHER_TEST_OWNER | — |
| `apps/web/tests/e2e/commerce-checkout.spec.ts` | modified | COMMERCE_REVIEW | — |
| `apps/web/tests/e2e/commerce-foundation.spec.ts` | modified | COMMERCE_REVIEW | — |
| `apps/web/tests/e2e/commerce-public-header.spec.ts` | added | COMMERCE_REVIEW | — |
| `apps/web/tests/e2e/content-learning-space.spec.ts` | modified | OTHER_TEST_OWNER | — |
| `apps/web/tests/e2e/content-management.spec.ts` | modified | OTHER_TEST_OWNER | — |
| `apps/web/tests/e2e/fixtures/header-navigation.ts` | added | HEADER_159 | #229 |
| `apps/web/tests/e2e/fixtures/header-test.ts` | added | HEADER_159 | #229 |
| `apps/web/tests/e2e/global-release-sweep.spec.ts` | modified | PUBLIC_REVIEW | — |
| `apps/web/tests/e2e/header-navigation-preferences.spec.ts` | added | HEADER_159 | #229 |
| `apps/web/tests/e2e/homepage-settings.spec.ts` | modified | PUBLIC_REVIEW | — |
| `apps/web/tests/e2e/learning-lesson-progress.spec.ts` | modified | OTHER_TEST_OWNER | — |
| `apps/web/tests/e2e/learning-mastery-goals.spec.ts` | modified | OTHER_TEST_OWNER | — |
| `apps/web/tests/e2e/learning-remediation.spec.ts` | modified | OTHER_TEST_OWNER | — |
| `apps/web/tests/e2e/learning-review.spec.ts` | modified | OTHER_TEST_OWNER | — |
| `apps/web/tests/e2e/learning-school-interventions.spec.ts` | modified | OTHER_TEST_OWNER | — |
| `apps/web/tests/e2e/learning-study-plans.spec.ts` | modified | OTHER_TEST_OWNER | — |
| `apps/web/tests/e2e/notifications.spec.ts` | modified | PUBLIC_REVIEW | — |
| `apps/web/tests/e2e/organizations-director.spec.ts` | modified | OTHER_TEST_OWNER | — |
| `apps/web/tests/e2e/original-header-live.spec.ts` | added | HEADER_159 | — |
| `apps/web/tests/e2e/parents-dashboard.spec.ts` | modified | OTHER_TEST_OWNER | — |
| `apps/web/tests/e2e/platform-fonts.spec.ts` | modified | OTHER_TEST_OWNER | — |
| `apps/web/tests/e2e/public-footer.spec.ts` | modified | PUBLIC_REVIEW | — |
| `apps/web/tests/e2e/public-not-found-parity.spec.ts` | added | PUBLIC_REVIEW | — |
| `apps/web/tests/e2e/public-user-workspaces-parity.spec.ts` | modified | HEADER_159 | #159,#229 |
| `apps/web/tests/e2e/question-bank-admin.spec.ts` | modified | OTHER_TEST_OWNER | — |
| `apps/web/tests/e2e/reporting-operations.spec.ts` | modified | OTHER_TEST_OWNER | — |
| `apps/web/tests/e2e/taxonomy-admin.spec.ts` | modified | OTHER_TEST_OWNER | — |
| `apps/web/tests/reference/header.html` | added | HEADER_159 | — |
| `apps/web/tests/reference/header.tsx` | added | HEADER_159 | — |
| `apps/web/tests/reference/source-header-api-adapter.ts` | added | HEADER_159 | — |
| `cmd/api/main.go` | modified | SHARED_COORDINATOR | #229 |
| `docs/migration/03_EXECUTION_AND_HANDOFF_PLAN_AR.md` | modified | SHARED_COORDINATOR | #229 |
| `docs/migration/32_ORIGINAL_HEADER_NAVIGATION_AR.md` | added | PUBLIC_REVIEW | — |
| `docs/migration/baselines/legacy-Header.tsx.txt` | added | PUBLIC_REVIEW | — |
| `docs/migration/reviews/OWNER_ACCELERATION_DIRECTIVE_AR_2026-10-29.txt` | added | PUBLIC_REVIEW | — |
| `docs/superpowers/plans/2026-10-29-original-header-navigation.md` | added | HEADER_159 | — |
| `internal/assessment/catalog/README.md` | added | ASSESSMENT | — |
| `internal/assessment/catalog/catalog.go` | added | ASSESSMENT | — |
| `internal/assessment/catalog/catalog_integration_test.go` | added | ASSESSMENT | — |
| `internal/assessment/catalog/catalog_test.go` | added | ASSESSMENT | — |
| `internal/commerce/application/public_catalog.go` | added | COMMERCE_REVIEW | — |
| `internal/commerce/application/public_catalog_test.go` | added | COMMERCE_REVIEW | — |
| `internal/commerce/application/public_payment_options_test.go` | added | COMMERCE_REVIEW | — |
| `internal/commerce/domain/public_catalog.go` | added | COMMERCE_REVIEW | — |
| `internal/commerce/repository/postgres/public_catalog.go` | added | COMMERCE_REVIEW | — |
| `internal/commerce/repository/postgres/public_catalog_integration_test.go` | added | COMMERCE_REVIEW | — |
| `internal/commerce/transport/http/handler.go` | modified | COMMERCE_REVIEW | — |
| `internal/commerce/transport/http/public_catalog.go` | added | COMMERCE_REVIEW | — |
| `internal/content/domain/public_search.go` | added | CONTENT_ADMIN | — |
| `internal/content/repository/postgres/public_search.go` | added | CONTENT_ADMIN | — |
| `internal/discovery/README.md` | added | PUBLIC_REVIEW | — |
| `internal/discovery/application/articles.go` | added | PUBLIC_REVIEW | — |
| `internal/discovery/application/articles_test.go` | added | PUBLIC_REVIEW | — |
| `internal/discovery/application/service.go` | added | PUBLIC_REVIEW | — |
| `internal/discovery/application/service_test.go` | added | PUBLIC_REVIEW | — |
| `internal/discovery/domain/articles.go` | added | PUBLIC_REVIEW | — |
| `internal/discovery/domain/search.go` | added | PUBLIC_REVIEW | — |
| `internal/discovery/transport/http/articles.go` | added | PUBLIC_REVIEW | — |
| `internal/discovery/transport/http/articles_test.go` | added | PUBLIC_REVIEW | — |
| `internal/discovery/transport/http/handler.go` | added | PUBLIC_REVIEW | — |
| `internal/discovery/transport/http/handler_test.go` | added | PUBLIC_REVIEW | — |
| `internal/discovery/transport/http/search_integration_test.go` | added | PUBLIC_REVIEW | — |
| `internal/learning/navigation/README.md` | added | STUDENT_229 | #229 |
| `internal/learning/navigation/http.go` | added | STUDENT_229 | #229 |
| `internal/learning/navigation/http_test.go` | added | STUDENT_229 | #229 |
| `internal/learning/navigation/postgres.go` | added | STUDENT_229 | #229 |
| `internal/learning/navigation/postgres_integration_test.go` | added | STUDENT_229 | #229 |
| `internal/learning/navigation/preferences.go` | added | STUDENT_229 | #229 |
| `internal/learning/navigation/preferences_test.go` | added | STUDENT_229 | #229 |
| `internal/platform/httpserver/header_integration_test.go` | added | SHARED_COORDINATOR | — |
| `internal/platform/httpserver/header_mounts_test.go` | added | SHARED_COORDINATOR | — |
| `internal/platform/httpserver/server.go` | modified | SHARED_COORDINATOR | #229 |
| `internal/questionbank/domain/public_search.go` | added | CONTENT_ADMIN | — |
| `internal/questionbank/repository/postgres/public_search.go` | added | CONTENT_ADMIN | — |
| `internal/taxonomy/README.md` | modified | CONTENT_ADMIN | — |
| `internal/taxonomy/application/display_test.go` | added | CONTENT_ADMIN | — |
| `internal/taxonomy/application/service.go` | modified | CONTENT_ADMIN | — |
| `internal/taxonomy/domain/bootstrap.go` | modified | CONTENT_ADMIN | — |
| `internal/taxonomy/domain/mutations.go` | modified | CONTENT_ADMIN | — |
| `internal/taxonomy/repository/postgres/display.go` | added | CONTENT_ADMIN | — |
| `internal/taxonomy/repository/postgres/display_integration_test.go` | added | CONTENT_ADMIN | — |
| `internal/taxonomy/repository/postgres/mutations.go` | modified | CONTENT_ADMIN | — |
| `internal/taxonomy/repository/postgres/public_commerce_scope.go` | added | CONTENT_ADMIN | — |
| `internal/taxonomy/repository/postgres/public_commerce_scope_integration_test.go` | added | CONTENT_ADMIN | — |
| `internal/taxonomy/repository/postgres/public_commerce_scope_test.go` | added | CONTENT_ADMIN | — |
| `internal/taxonomy/repository/postgres/repository.go` | modified | CONTENT_ADMIN | — |
| `internal/taxonomy/transport/http/display_test.go` | added | CONTENT_ADMIN | — |
| `internal/taxonomy/transport/http/handler.go` | modified | CONTENT_ADMIN | — |
| `migrations/000046_learning_navigation_preferences.down.sql` | added | STUDENT_229 | #229 |
| `migrations/000046_learning_navigation_preferences.up.sql` | added | STUDENT_229 | #229 |
| `scripts/parity/api-mount-inventory.test.mjs` | modified | PUBLIC_REVIEW | — |
| `scripts/parity/header-brand.test.mjs` | modified | HEADER_159 | #159,#229 |
| `scripts/parity/header-category-route.test.mjs` | added | PUBLIC_REVIEW | — |
| `scripts/parity/header-navigation.test.mjs` | added | HEADER_159 | #159,#229 |
| `scripts/parity/header-notifications.test.mjs` | added | PUBLIC_REVIEW | — |
| `scripts/parity/header-oauth-return.test.mjs` | added | AUTH | — |
| `scripts/parity/header-reference.mjs` | added | HEADER_159 | — |
| `scripts/parity/header-rendering.test.mjs` | added | HEADER_159 | — |
| `scripts/parity/header-search.test.mjs` | added | PUBLIC_REVIEW | — |
| `scripts/parity/route-inventory.test.mjs` | modified | PUBLIC_REVIEW | — |

**حالة الفحوص:** لا يمكن اعتبار بوابات CI السابقة صالحة لهذا الجرد؛ يلزم فحص Backend/Database/Frontend/E2E على HEAD النهائي بعد فصل التداخلات وإثبات browser parity بنفس الدور والبيانات على 390/820/1440 RTL. **BLOCKER:** #158 متعارض ويتضمن ملفات خارج الملكية؛ #159/#229 بحاجة لاستلام فريد الـpatch. **NEXT_EXACT_ACTION:** افحص diff للملفات `HEADER_159` و`STUDENT_229` ضد `main` وPR المالك، سجّل ALREADY_MERGED/TRANSFERRED أو الاختلافات، ثم ضيّق #158 بدون إسقاط فريد وابدأ بوابات CI. **MERGED_COUNT في هذه الجولة:** 0.
