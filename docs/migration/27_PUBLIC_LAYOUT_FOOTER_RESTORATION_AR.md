# استعادة فوتر الموقع العام من المكوّن الأصلي

المصدر read-only: almeaacodax main bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7، components/MainLayout.tsx:121–132.
الهدف base c828f181f858fabe75c86384846d72f93daca23a بعد #150.

## السبب والإصلاح
الفوتر الأصلي جزء من MainLayout ويظهر في صفحات الموقع. Go وضع فوترًا داكنًا مختلفًا داخل الصفحة الرئيسية؛ صفحات المعلومات بلا فوتر. استعيد JSX الأصلي (الكلاسات، النصوص، ترتيب الروابط الخمسة، والعناوين) دون إعادة تصميم، في LegacySiteFooter؛ رُبط بالموقع العام في App.tsx بدل وضعه داخل الرئيسية.

الحد الحالي: / وlogin/signup وabout/contact/faq/privacy/terms وforgot-password/reset-password. لا تغيير في مساحات الإدارة أو مشغلات التقييم أو الأدوار؛ مقارنة بقية wrappers ما زالت UNKNOWN.

Actor visitor → shared footer → React Router public URL → existing StaticInfoPage. هذا عرض وروابط ثابتة؛ لا كتابة بيانات ولا API جديد ولا مخطط PostgreSQL. لا نسميه اختبار تكامل قاعدة بيانات.

## إثبات العقد
- snapshot JSX مأخوذ حرفيًا من المصدر المثبت، لا من Go، في baselines/legacy-public-footer.tsx.txt.
- اختبار SSR يقارن الناتج الكامل للمكوّنين (الأصل/Go) بنفس React/MemoryRouter، بما يشمل ترتيب العناصر والروابط والكلاسات؛ RED لغياب المكوّن ثم GREEN.
- Playwright عند390/820/1440: فوتر واحد، الخلفية الأصلية، الروابط الخمسة، التنقل والرجوع، reload، ومنع overflow؛ screenshot للفوتر.
- بناء TypeScript/Vite واختبارات parity محليًا؛ المتصفح يعتمد CI بسبب SIGTRAP المثبت سابقًا.

## الحكم
PARTIAL على مستوى الموقع، وليس PARITY_PROVEN. مطابقة SSR تثبت markup لهذه القطعة؛ لا تثبت screenshots مقترنة لصفحة Legacy كاملة، ولا dynamic homepage settings أو navigation أو مكونات الطالب. لا تغيير صلاحيات أو تصحيح أو مدفوعات أو بيانات إنتاج.

التالي: عقد إعدادات homepage/font/navigation وحفظها، ثم ربط أصل العرض بدل القيم الثابتة. لا الاستعاضة ببيانات وهمية عن اتصال Go/PostgreSQL.
