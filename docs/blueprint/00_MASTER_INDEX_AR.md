# ALMEAA Product Blueprint V1 — المرجع الهندسي الشامل

**الفرع:** `almeaa-product-blueprint-v1`  
**مرجع الفحص:** `main @ 4aec4bc265299ecc1ba7e32738a0fdc60681a878` — 2026-09-24  
**حالة البيانات:** المنصة ما زالت Development/Test، ولا يوجد مستخدمون Production حقيقيون أو بيانات أعمال Production يجب الحفاظ عليها.

## الهدف

هذه الحزمة ليست خطة برمجة مختصرة، بل **مواصفات المنتج القابلة لإعادة البناء**. الهدف أن يستطيع مطور أو Coding Agent إعادة بناء ALMEAA داخليًا بتقنيات مختلفة مع الحفاظ على ما يهم المستخدم:

- Functional Parity.
- Visual/UX Parity حيث يكون السلوك الحالي مقصودًا.
- Role/Scope/Permission Parity.
- Data/Relationship Parity.
- Business Rule Parity.
- Performance/Growth/Security constraints.
- عدم نقل الأخطاء التاريخية كأنها Features.

## قاعدة الحالات

كل معلومة في هذه الحزمة تستخدم إحدى الحالات:

- **VERIFIED:** مثبتة من الكود الحالي أو من evidence/contract حديث.
- **INTENDED:** قرار منتج موثق ومطلوب، لكنه قد يكون جزئي التنفيذ.
- **PROPOSED:** تحسين مستهدف للنسخة الجديدة.
- **REVERIFY:** سلوك/مشكلة تاريخية يجب إعادة التحقق منها قبل النقل.

## لقطة المستودع

- حوالي 1,644 ملفًا و122 مجلدًا.
- Frontend: React 19.2 + TypeScript + Vite.
- Backend: Express + TypeScript.
- Database: MongoDB/Mongoose.
- Shared state/jobs/realtime: Redis + BullMQ + Socket.IO.
- Monitoring: Sentry.
- Media: Cloudflare R2 integration موجودة لصور الأسئلة والصوت.
- 59 Model في `server/src/models`.
- 31 route group تقريبًا في `server/src/routes`.
- Modules حالية منظمة جزئيًا: `ai, auth, content, media, notifications, parents, privacy, product-config, public-tests, quizzes, reports, schools`.

## الأدوار القانونية الحالية

`student`, `teacher`, `admin`, `supervisor`, `school_admin`, `parent`.

قاعدة الصلاحية ليست role فقط:

```
Permission = Role + Scope + Ownership/Assignment + Resource State + Delivery Context
```

## ملفات الحزمة

1. `01_PRODUCT_CAPABILITY_MAP_AR.md` — خريطة المنتج وكل القدرات.
2. `02_ROLES_SCOPES_RELATIONSHIPS_AR.md` — الأدوار والنطاق والعلاقات.
3. `03_QUESTION_BANK_SKILLS_AR.md` — السؤال، بنك الأسئلة، المهارات، العدادات، الصور، الاستيراد.
4. `04_ASSESSMENT_ATTEMPTS_RESULTS_AR.md` — نظام الاختبارات والمحاولات والنتائج.
5. `05_STUDENT_LEARNING_FOUNDATION_AR.md` — رحلة الطالب، التأسيس، المسار الذكي والعلاج.
6. `06_SCHOOLS_CLASSROOMS_B2B_AR.md` — المدارس، الفصول، المعلمين، المشرفين، Smart Classroom.
7. `07_CONTENT_COURSES_ACCESS_COMMERCE_AR.md` — المحتوى، الدورات، الباقات، الوصول والدفع.
8. `08_AI_NOTIFICATIONS_MEDIA_AR.md` — AI، الإشعارات، الصوت، R2 والتكاملات.
9. `09_DATA_GROWTH_BANDWIDTH_PERFORMANCE_AR.md` — الباندويث، التضخم، الكاش، الصفحات، retention.
10. `10_TARGET_GO_POSTGRES_ARCHITECTURE_AR.md` — شكل النسخة الجديدة Go/PostgreSQL.
11. `11_PARITY_TESTING_ACCEPTANCE_AR.md` — كيف نثبت أن النسخة الجديدة لم تفقد شيئًا.
12. `12_KNOWN_PROBLEMS_DECISIONS_AR.md` — المشاكل والقرارات التاريخية وما يجب عدم تكراره.
13. `13_AGENT_EXECUTION_PROTOCOL_AR.md` — طريقة عمل الـAgent على المشروع بدون تخمين.

## قواعد غير قابلة للتفاوض في النسخة الجديدة

1. لا تُنسخ Question أو Image لمجرد إعادة استخدامها في Quiz/Review/Training.
2. Media كبيرة لا تُخزن داخل PostgreSQL ولا تمر عبر Go API في كل قراءة.
3. الطالب/المعلم/المشرف/ولي الأمر لا يثق في الواجهة وحدها؛ الصلاحية Server-side.
4. كل قائمة قابلة للنمو يجب أن تكون bounded/paginated.
5. كل عملية مالية/وصول/تسليم حساسة يجب أن تكون idempotent.
6. لا نخلط Assessment Definition مع Assignment/Session/Learning Placement.
7. لا نخلط School Membership مع Entitlement؛ العضوية تحدد الانتماء، والوصول التعليمي تحدده المنحة/الباقة.
8. لا ننقل Mongo arrays إلى PostgreSQL حرفيًا إذا كانت تمثل علاقات حقيقية.
9. لا تُعلن Feature مكتملة إلا بعد round-trip + authorization + E2E.
10. لا يبدأ Agent تنفيذ Go قبل قراءة هذه الحزمة وإخراج Gap Report.

## مصدر الحقيقة عند التعارض

1. السلوك العامل والمثبت في الكود والاختبارات.
2. الوثائق المعمارية الحديثة المتوافقة مع الكود.
3. قرارات المنتج INTENDED.
4. الاقتراحات PROPOSED.

أي تعارض يسجل بدل أن يُحسم بالتخمين.


## ملاحق الجرد الجديدة

17. `16_MODEL_CATALOG_AR.md` — قاموس الـ59 Model الحالية وما يقابلها في التصميم الجديد.
18. `17_UI_SCREEN_WORKFLOW_MAP_AR.md` — خريطة الشاشات والـWorkflows.
19. `18_MODULE_API_BOUNDARY_MAP_AR.md` — حدود الـModules والـAPI والاعتماد بينها.
