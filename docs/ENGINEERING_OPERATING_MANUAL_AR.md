# ALMEAA Go — Engineering Operating Manual

> هذا الملف هو المرجع الدائم لطريقة تنفيذ مشروع ALMEAA Go. يقرأه أي Agent/Engineer قبل استكمال العمل، مع Product Blueprint وArchitecture و`CURRENT_STATE.md`.

## 1. Mission

نبني ALMEAA Go من الأساس كنظام إنتاجي منظم وقابل للتوسع، مع الحفاظ على سلوك المنتج وتجربة المستخدم المطلوبة، وليس بنسخ تراكمات المشروع القديم حرفيًا.

الهدف هو بناء النظام كما كان ينبغي أن يُبنى لو بدأناه اليوم ونحن نفهم المنتج كاملًا.

## 2. Source of truth and project isolation

- مستودع التنفيذ الوحيد: `nasef6464/almeaago`.
- Product Blueprint وArchitecture داخل هذا المستودع هما المرجع الأساسي لحدود النظام والهدف.
- `docs/CURRENT_STATE.md` هو سجل آخر checkpoint فعلي ويجب تحديثه بعد كل مرحلة موثقة.
- `nasef6464/almeaacodax` مرجع read-only للسلوك والواجهة والـparity عند الحاجة فقط.
- لا ننفذ أو ندمج شغل ALMEAA Go داخل المستودع القديم.
- لا ندخل ميزات من مشاريع أخرى لمجرد أنها موجودة في legacy أو في سياق محادثة أخرى.

## 3. The building rule — ابنِ العمارة دورًا فوق دور

العمل foundation-first وليس feature-first.

الترتيب الافتراضي:
1. Foundation / platform contracts.
2. Identity.
3. Organizations / Schools.
4. Taxonomy.
5. Content / Foundation / Courses.
6. Question Bank / Media.
7. Assessment.
8. Learning / Adaptive / Review.
9. Commerce / Access.
10. Parents.
11. Communication / Notifications.
12. Smart Classroom / Realtime.
13. AI.
14. Reporting / Operations.

يمكن تعديل ترتيب جزئي بسبب dependency حقيقية، لكن يجب توثيق السبب. لا نقفز إلى ميزة علوية بينما الأساس الذي تعتمد عليه غير مكتمل.

## 4. Meaning of “كمل”

عندما يقول المالك “كمل”، لا يعني ذلك تنفيذ خطوة صغيرة ثم التوقف للسؤال عن الخطوة التالية.

المعنى التشغيلي:
- افهم الـcheckpoint الحالي.
- راجع الـworking set والمصادر ذات الصلة.
- أكمل الـslice الحالية حتى checkpoint هندسي طبيعي.
- أصلح build/test/CI failures العادية بدل التوقف.
- راجع الأمان والأداء والصلاحيات وحدود الـdomains.
- نفذ QA/review مستقل قدر الإمكان.
- افتح PR صغيرًا ومحددًا.
- لا تدمج إلا بعد gates المطلوبة على exact PR head.
- حدّث التوثيق والحالة.
- انتقل تلقائيًا للخطوة المنطقية التالية ما لم يوجد Stop Condition حقيقي.

لا يحتاج المالك إلى إدارة كل commit أو endpoint يدويًا.

## 5. Legacy parity is intent, not implementation

المشروع القديم يجيب أساسًا عن:
- ماذا يفعل المستخدم؟
- ما الـworkflow المقصود؟
- ما السلوك الظاهر الذي يجب الحفاظ عليه؟
- ما شكل وتجربة الواجهة المطلوبة؟
- ما العلاقات والبيانات التي يحتاجها المنتج فعلًا؟

لا نعتبر التنفيذ القديم مواصفات هندسية مقدسة.

إذا كان القديم يحتوي على:
- schema ضعيف أو arrays غير قابلة للتوسع.
- endpoint متعدد المسؤوليات.
- صلاحيات متداخلة.
- N+1 أو unbounded queries.
- duplication.
- naming أو boundaries غير منظمة.
- workaround أو bug تاريخي.

نفهم intent ثم نعيد التنفيذ بصورة أنظف. السلوك القديم الخاطئ لا يُورث سرًا؛ يصنف ويوثق وفق Truth Labels.

## 6. Improve when there is a real engineering reason

يجوز بل يجب تحسين ما هو موجود عندما يوجد سبب واضح من:
- correctness.
- security.
- performance.
- scalability.
- maintainability.
- data integrity.
- observability.
- UX/accessibility.
- وضوح ownership وحدود الـdomains.
- تقليل bandwidth/resource cost.

لا نعمل over-engineering أو abstraction بلا حاجة، ولا نضيف infrastructure حديثة لمجرد أنها حديثة.

إذا ظهر أثناء بناء دور أعلى عيب تأسيسي حقيقي في دور سابق:
1. نحدد السبب والأثر.
2. نصلحه في الـowning layer/domain.
3. نضيف regression tests/migration آمنة عند الحاجة.
4. نمرر gates.
5. ثم نكمل البناء فوقه.

لا نضع workaround يخفي مشكلة في الأساس.

## 7. Domain ownership is enforced

- كل business state له owner واضح.
- التواصل بين domains يكون بعقود/interfaces صريحة.
- لا cross-domain SQL عشوائي.
- لا ننقل مسؤولية إلى domain لمجرد أن الكود أسهل هناك.
- مثال مهم: Organizations يملك schools/memberships/classes/assignments؛ Commerce يملك entitlements/access.
- Reporting يملك read models والتجميعات، لا business-state mutations.
- Identity يملك account/login/session state، لا school relationships.

إذا كان branch قديمًا يخلط ownership، لا يدمج بالجملة. نستخرج الجزء الصحيح فقط على branch نظيف من `main`.

## 8. Branch / PR discipline

- ابدأ أي شغل جديد من أحدث `main`.
- branch واحد focused لكل slice/fix/performance change.
- commits صغيرة ومتماسكة.
- لا تخلط domain rewrites غير مرتبطة.
- لا تدمج branch قديمًا لمجرد أنه يحتوي شغلًا كثيرًا.
- قارن branch مع `main` أولًا: ahead/behind/files/ownership.
- عند divergence أو stale docs، أعد زرع الجزء الصحيح على branch جديد بدل جر التاريخ غير المطلوب.

## 9. Review like a real engineering team

لا يكتفي المنفذ بتصديق شغله بنفسه.

لكل slice حسب الحاجة:
- correctness review.
- authorization/tenant isolation review.
- security/CSRF/session/data exposure review.
- DB constraints/index/query review.
- performance/bounded-read review.
- negative/regression tests.
- API/OpenAPI review.
- UI/UX/responsive review.
- old/new behavioral parity.
- screenshot/Visual Regression عبر Playwright عندما تكون الواجهة ضمن التغيير.

أي review finding مهم يصلح قبل الدمج أو يسجل بوضوح كـblocked/next work؛ لا يدفن.

## 10. CI and evidence discipline

لا نستخدم كلمة TESTED/GREEN لمجرد أن الكود يبدو صحيحًا.

- شغّل gates المناسبة: Backend / Database / Frontend / E2E.
- المطلوب هو exact-head evidence على الـPR عند الإمكان.
- migrations يجب أن تدعم apply/verify/rollback/re-apply.
- لا تدمج قبل required green gates.
- إن لم تتوفر evidence، اكتب الحالة بدقة مثل IMPLEMENTED / CI PENDING.
- حدّث `CURRENT_STATE.md` بعد checkpoint موثق، لا قبله.

## 11. Database and performance defaults

- PostgreSQL هو system of record.
- migrations immutable بعد اعتمادها.
- العلاقات relational وواضحة؛ لا ننقل Mongo arrays حرفيًا.
- reads bounded/paginated.
- indexes مبنية على query patterns فعلية.
- لا N+1 في dashboards/directories.
- لا تحميل قواعد بيانات كاملة إلى frontend.
- heavy work jobs عند الحاجة.
- object media لا يمر عبر Go API بلا داعٍ.
- caching تحسين أداء وليس مصدر correctness.
- راقب bytes/tokens/resource budgets.

## 12. Security and tenancy defaults

- deny by default.
- school/tenant scope قبل قراءة البيانات الحساسة.
- guessed IDs لا تتجاوز authorization.
- revoked membership/assignment يؤثر فورًا حسب السياسة.
- unsafe cookie-authenticated mutations تتطلب CSRF.
- أقل PII ممكن في roster/read models.
- لا answer keys أو secrets في DTO غير مخول.
- privileged writes audited.
- لا self-elevation.
- invariants الحرجة تفرض في DB/transaction عندما يكون ذلك مناسبًا.

## 13. UI migration and parity

الأولوية عند نقل واجهة موجودة:
- design.
- dimensions/layout.
- colors/fonts.
- spacing.
- responsive behavior.
- states: loading/error/empty.
- interactions/actions/side effects.
- direct-link authorization.

نستخدم automation الآمن للأعمال المتكررة:
- codemods.
- AST transforms.
- import/path migrations.
- API client transformations.
- repetitive component refactors.

لا Blind Conversion. التحويل على مراحل مع مراجعة واختبارات وVisual Regression.

## 14. How to resolve ambiguity

استخدم Truth Labels من Agent Execution Protocol:
- VERIFIED_CURRENT_CODE
- VERIFIED_RUNTIME
- INTENDED_PRODUCT
- PROPOSED_TARGET
- LEGACY_BUG
- UNKNOWN_NEEDS_OWNER

إذا لم يحدد Blueprint/legacy سلوك business مهمًا:
- لا تخترع policy بصمت.
- سجل UNKNOWN_NEEDS_OWNER.
- قدم الخيارات والأثر عندما يصبح القرار مطلوبًا.

أما القرارات التقنية الداخلية التي لا تغير السلوك الظاهر، فيجوز اتخاذ الأفضل هندسيًا دون إيقاف المالك على كل تفصيلة.

## 15. Stop conditions

لا نتوقف بسبب test/build failure عادي؛ نشخصه ونصلحه.

نتوقف ونطلب قرارًا فقط عند:
- business policy ناقصة لا يمكن استنتاجها بأمان.
- external credential مطلوب لإثبات live integration.
- irreversible/destructive data policy تحتاج موافقة.
- security/safety uncertainty جوهرية.
- عملية خارجية حساسة تتطلب موافقة صريحة.

## 16. Working-set discipline

قبل أي slice:
- اقرأ `CURRENT_STATE.md`.
- اقرأ هذا الملف.
- اقرأ relevant Blueprint/domain docs.
- اقرأ target architecture/boundary docs.
- افحص الكود الحالي للـdomain.
- ارجع للـlegacy فقط للجزء المطلوب للـparity.

لا تعيد قراءة المشروع كاملًا كل مرة. حافظ على working set صغيرًا ودقيقًا.

## 17. Definition of Done for a domain slice

الـslice لا تعتبر مكتملة لمجرد وجود backend code. حسب نطاقها يجب إغلاق:
- schema/migration.
- domain/application.
- repository.
- API/OpenAPI.
- permissions/authorization.
- React integration إن كانت ضمن الـslice.
- unit tests.
- DB/integration tests.
- E2E عند الحاجة.
- parity/visual proof عند الحاجة.
- performance/security review.
- docs/current-state update.

## 18. Guiding sentence

**القديم يشرح ماذا يحتاج المنتج؛ الـBlueprint والـArchitecture يحددان أين تنتمي المسؤولية؛ والتنفيذ الجديد يختار أفضل طريقة هندسية تحقق ذلك بدون وراثة أخطاء الماضي.**

وعند قول المالك **“كمل”**: واصل البناء المنظم إلى الـcheckpoint الطبيعي التالي، مع التنفيذ والمراجعة والاختبارات والتوثيق والدمج الآمن، وليس مجرد تنفيذ خطوة منفردة.
