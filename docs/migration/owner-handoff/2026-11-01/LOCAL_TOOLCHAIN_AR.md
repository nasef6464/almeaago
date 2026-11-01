# التشغيل والتحقق المحلي

لا تُحمّل مكتبة لمجرد توفرها. أدوات البداية موجودة فعلًا: Go1.27.1، Node24.11.1، npm11.6.2، Git وGitHub CLI، PostgreSQL18.6 في `C:\almeaago\pgsql\bin`، Playwright1.63.0 وChromium1243 داخل cache المستخدم. لم يلزم تثبيت إضافات أو تغيير dependencies لهذه الدفعة. Docker غير متاح عبرPATH؛ PostgreSQL المحلي يكفي للعزل. ملفات `.agents/skills/` في المشروع تتضمن أدوات مطابقة وRTL وPR/API؛ تُقرأ المهارة المناسبة للنطاق فقط.

## تحقق بدون خدمات سحابية

من `C:\almeaago\almeaago\apps\web`:

```powershell
node node_modules/typescript/bin/tsc -b --pretty false
node node_modules/vite/bin/vite.js build
node node_modules/@playwright/test/cli.js test tests/e2e/question-bank-admin.spec.ts --grep 'authoring answer parity' --reporter=list --workers=1
```

Playwright يشغّل Vite على127.0.0.1:4173 وفق config المشروع. هذه الاختبارات تستبدلHTTP ببيانات صناعية؛ لا تثبتGo/PostgreSQL. لا تستخدم توكنات أو حسابات الإنتاج. عند استخدام اختبارات أوسع راجع مواضعnetwork وseed أولًا. الاستدعاء المباشر لأدواتNode يتجنب أي تنزيل تلقائي منnpm exec.

من جذر الجديد:

```powershell
go test ./internal/questionbank/...
node --test scripts/parity/screen-inventory.test.mjs scripts/parity/route-inventory.test.mjs
node scripts/parity/owner-handoff-snapshot.mjs --legacy 'C:\almeaago\almeaacodax' --output docs/migration/owner-handoff/2026-11-01/discovery.json
```

لـAPI/التخزين الحقيقي: cluster جديد داخل `.tmp/owner-verification-20261101-pg`، على127.0.0.1:55439، وقاعدة `almeaa_owner_verify_20261101`، بمهاجرات المشروع الكاملة. لا تفتح `.env` أو تستخدم `C:\almeaago\pgdata` المشتركة. مصادقةtrust هنا محلية loopback فقط ببيانات صناعية؛ ليست إعداد إنتاج.

تشغيل اختبار التخزين يتطلب `QUESTIONBANK_PERSISTENCE_DB_TEST=1` وDATABASE_URL محليًا صريحًا. الاختبار المتخطى SKIPPED لا يعدPASS. جلسةHTTP صناعية لا تثبتتسجيل الدخول الحقيقي. يسجّل CHECKPOINT أوامر التشغيل والنتائج، بما فيها المهاجراتالفاشلة وأسبابها.

## الأدلة

الأدلة الكبيرة محليًا في `.tmp/` و`apps/web/test-results/`؛ لقطاتالمقارنة المعتمدة تُربط من `docs/migration/evidence/` بعد مراجعتها. لا ترفع بيانات شخصية أو أسرار أو قواعد محلية أو traces لجلساتحقيقية. كل لقطة لها SHA ودور وحالة وبياناتصناعية ومقاس وDPR وخطوط. لقطاتالجديد وحده لا تكفي لإغلاق المطابقة.

لا تعدّل إعداداتRender/Vercel/Neon/Cloudinary ولا تنشرmain ضمن هذا التفويض. افحصCI على الرأس النهائي قبل أي دمج لاحق؛ لا تُخفّض حدودالمقارنة أو تتخطّاختبارًا لفتح بوابة.

## سجل الأدوات والمهارات الدائم — تحديث الاستلام المستمر

| الأداة | الاستخدام | طريقة التشغيل/إعادة التحقق | اتصال خارجي |
|---|---|---|---|
| Git | حفظ الدفعات، فحص الفروق والملكية | `git status --short` و`git diff --check` | لا، إلا fetch/push/ls-remote |
| GitHub CLI | قراءة PR وCI وسجلات الفشل، رفع دفعة مكتملة | `gh pr view 263 --repo nasef6464/almeaago` | نعم؛ لا طباعة بيانات الدخول |
| ripgrep | بحث محدد بدل قراءة المستودع بالكامل | `rg -n 'اسم الوظيفة' المسار` | لا |
| Go1.27.1 | التطبيق واختبارات الوحدة والتكامل | `go version` ثم اختبارات الحزم المتأثرة | لا بعد توفر modules/toolchain في cache |
| Node24.11.1/npm11.6.2 | أدوات الفحص والبناء | `node --version` و`npm --version` | لا للأدوات المثبتة؛ install/exec قد يتصل |
| TypeScript/Vite | الأنواع، البناء وخادم محلي | الأوامر المباشرة أعلاه | لا للبناء؛ صفحة التشغيل قد تطلب خطوطًا خارجية |
| Playwright1.63.0/Chromium1243 | تفاعل حقيقي وصور ومقارنة | `node node_modules/@playwright/test/cli.js test ...` منapps/web | لا للمتصفح المثبت؛ راجع كلfixture قبل التشغيل |
| PostgreSQL18.6 | حفظ وقراءة ومهاجرات داخل اختبار معزول | `C:\almeaago\pgsql\bin\pg_ctl.exe` و`psql.exe` | لا، loopback فقط |
| PNG / Buffer منNode | فحص أبعادPNG وتطابقbytes حرفيًا | لا تنزيل مطلوب؛ pngjs7 معلنة فيpackage.json لكن لم يحلهاNode محليًا عند الفحص | لا |

الإصدارات السابقة موثقة من تشغيل محلي؛ أعد فحص أداة متأثرة عند تغيير البيئة، لا تنزل إصدارًا أحدث عشوائيًا. لم تثبت إضافة جديدة لهذه الدفعة. Docker ليس علىPATH؛ لا يلزم لتشغيلPostgreSQL المحلي الحالي. لا تستدعِcmd/seed بدونDATABASE_URL اختبار صريح لأن له fallback يقرأ.env.

المهارات المحلية المتاحة في `.agents/skills/` تشمل المطابقة، RTL، صحةCI، إدارةPR، عقودAPI، عزلRBAC، ملكية المحتوى والتصنيف، رحلة التعلم، سلامة المهاجرات، المدارس، التجارة، المعلم الذكي، وتطبيع العربية. اقرأSKILL.md المتصل بالوظيفة فقط. في دفعة إزالة العوائق الحالية تستخدم: `almeaa-ci-health-monitor` و`almeaa-pr-controller` و`almeaa-parity-checker` و`almeaa-rtl-browser-verifier`. المهارات المتخصصة الأخرى لا تعمل تلقائيًا ولا تُعدّ دليلًا أن المجال اختُبر.

القدرات المتاحة في الجلسة تشمل أدوات إدارةCodex للشاتات والملفات المرفقة، وأداة التحكم بالمتصفح/التطبيقات، وأدوات مستندات وعروض وجداول وSites. لا حاجة لتشغيلها أو تثبيتPlugins للمهمة الحالية. استُخدمghCLI القائم لقراءةGitHub؛ توافرGitHub connector تغيّر خلالالجلسة، فلا تعتمد غيابه أووجوده كحالةدائمة. تتغير القدرات بين الجلسات، لذا افحص أداة لازمة وقت الحاجة بدل حفظ صلاحيات أو أسرار في هذا الملف.

## استئناف البيئة بدون إعادة تجهيز كاملة

1. اقرأAGENTS ثمCHECKPOINT، وافحصbranch/status والـPR الحالية. لا تُنشئcheckout موازية.
2. تحقق من الأداة المرتبطة فقط. إن نقصت، جرّب المثبت الموجود وcache المتصفح قبل أي تنزيل.
3. لتجربةHTTP/قاعدة: تحقق من منفذ55439، ثم ابدأcluster الاختبار المعروف فقط. لا تستخدم5432 أوpgdata المشتركة تلقائيًا. سجلملكيتك للخدمة وأوقف فقط ما بدأتَه.
4. شغّل اختبار الفجوة المحدد. توسّع إلى المجموعة المرتبطة ثم بوابات الدفعة محليًا. لا ترفعكل تعديل صغير إلىGitHub.
5. الدفع إلىPR قد يشغّل Backend/Frontend/Database/E2E وVercel preview تلقائيًا. هذه آثار إعدادات قائمة؛ لا تغيير لها ولا تشغيلpreview يدوي. اجمع التغييرات المتصلة في دفعة واحدة واختبر قبل الدفع. لا تعطّل الحماية لتوفير التكلفة.
6. لا تشغيل مستمر بعد انتهاء الجلسة. كلمة«أكمل» تستعيدCHECKPOINT؛ الأتمتة تحتاج تفويضًا وإعدادًا مستقلين.


## مقارنة الرئيسية والهوية الحية علىWindows

اختباراتGo التي تشغّل المتصفح تستدعيCLI المثبتة مباشرة عبرNode؛ لا تعتمد علىnpm.cmd كبرنامجتنفيذي محمول. المصدر المرجعي للهيدر يُولّد منblobالأصل المثبت، ويجب تشغيل `node scripts/parity/homepage-reference.mjs` قبل استخدام صفحاتمرجعالرئيسية. الأداة تطبّع نهاياتالأسطر عند تحديدحدودالأقسام فقط، ولا تغيرعرضالمصدر.

داخلبيئةقاعدةالاختبارالمعزولةفقط:

```powershell
$env:DATABASE_URL='postgres://almeaa@127.0.0.1:55439/almeaa_owner_verify_20261101?sslmode=disable'
$env:HOMEPAGE_TEST_DB='1'
$env:HOMEPAGE_BROWSER_E2E='1'
$env:HOMEPAGE_BROWSER_SUITE='brand' # ثم editor فيتشغيلمنفصل
$env:CI='1' # يرفضإعادةاستخدامViteقديمبproxyيشيرلخادماختبارانتهى
 go test ./internal/content/repository/postgres -run '^TestHomepageSettingsHTTPPostgres$' -count=1 -v
```

`brand` يشغّلالحالاتالست كاملة، و`editor` يشغّلاختبارالمحررالكامل. حذفHOMEPAGE_BROWSER_SUITE يعيدالافتراضي:المجموعتانمعًا، كمافيCI. أيةقيمةأخرىتفشل. لايُوصفنجاحالتشغيلينالمنفصلينبأنهماإثباتلنجاحمدةCIالمجمعة. إعدادdisableGPU فيمقارنةالهوية هو نفسالمستخدمباختبارالهيدرالكامل، لمنعرسمالنصبطرقGPUمختلفة؛ تظلالمقارنةحرفيةبلاmaskأوسماحيةبكسلات.

لا تشغّلمجموعتيPlaywrightتستخدمان4173معًا. عندإيقافاختباربالمهلة، افحصأولًاعملياتالمنفذالمعروفالتيبدأتهاهذهالجولة؛ لا توقفViteالمستخدمعلى5173ولاالمتصفحالشخصي. WaitDelayفيالاستدعاءيحدانتظارتدفقاتالعمليةالفرعيةالمعلقة، ولايحولالفشلإلىنجاح.
