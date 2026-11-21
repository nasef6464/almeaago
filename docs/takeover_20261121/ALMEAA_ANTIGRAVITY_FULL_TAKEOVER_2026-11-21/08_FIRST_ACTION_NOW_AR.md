# أول أمر تنفيذي لـAntigravity — دفعة G0-01

**الهدف:** استقبال الكود الحالي دون فقد بيانات أو تكرار عمل، وتحديد السبب الجذري الأول لفشل E2E، ثم الاستمرار في أول شريحة إصلاح يمكن إثباتها.

## المخرجات المطلوبة من أول دفعة

1. `current_source_sha`, `current_target_sha`, working tree status، قائمة الملفات غير المتتبعة مع مالك التغيير إن عرف، والـPRs المفتوحة محدثة؛ لا اعتماد SHA ثابت من هذه الحزمة.
2. قائمة current required checks الفعلية في Branch protection/Rulesets، وقائمة كل required check التي مرّت/فشلت/تخطت على final sha المرشح.
3. أحدث run E2E وفشلاته، لا تعتمد run `44890325571` إن وجد أحدث؛ هذا baseline مرجعي للبدء. Root-cause clusters بأدلة trace/screenshot/HTTP/expected code.
4. مصالحة #271/#273/#274/#269/#268/#266/#265/#264/#262 و#276/#277/#278: ما دخل main، ما بقي، وما لا يجوز دمجه.
5. بحث محلي عن `docs/ALMEAA_ENGINEERING_PILLARS_MASTER.md`، وأي تعديلات AGENTS غير مرفوعة، ومقارنتها بـ`docs/ENGINEERING_COMPLETENESS_CHECKLIST_AR.md`.
6. اختيار **أول عطل حرج قابل للإعادة**، وعقد شريحة صغير واسم الاختبار الأحمر والمسارات المقصودة، ثم تنفيذ الإصلاح وتشغيل فحصه إن أمكن بأمان.

## بوابات البداية (لا تلغيها لتبدأ أسرع)

- لا `git clean`, `git reset --hard`, `git checkout -f`, `git add .`, mass rebase أو merge تلقائي لفروع متباعدة.
- لا تشغيل seed أو migration إلا بقاعدة معزولة موثقة واتصال اختبار صريح.
- لا تعديل Legacy أو publish/deploy/cutover؛ لا فتح دومين أو User data للإعلانات أو مقارنات الصورة.
- إذا وجدت مرجعًا تاريخيًا متعارضًا، احفظ كلا الادعاءين واقرأ رأس الشجرة/الكود/الـCI؛ الحقيقة هي evidence الحالي.
- لا انتظار موافقة جديدة لأمر إصلاح داخل نطاق آمن قائم لا يغيّر حقائق المنتج؛ لكن أي عمل يؤثر إنتاجًا أو يتطلب تغيير قرار منتج أو صلاحيات جوهريًا يحتاج موافقة صريحة.

## وصف المهمة المختصر

`G0-01 = read current reality → reconcile owned work → triage E2E root causes → smallest verified red case → tested correction → independent review → PR gates → checkpoint`, بالتكرار حتى غلق G1. بعد انتهاء كل شريحة اكتب أول أمر للدفعة التالية وتابع نطاق الاستئناف المعتمد.
