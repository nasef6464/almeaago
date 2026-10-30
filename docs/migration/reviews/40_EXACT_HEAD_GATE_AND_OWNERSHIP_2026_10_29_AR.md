# ALMEAA V2 — عقد تكامل البوابات وملكية الملفات (29 أكتوبر 2026)

**مصدر Legacy للقراءة فقط:** `almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`. **Go main عند المراجعة:** `almeaago/main@98b0f6d9ad0bba031936d950d087c0bd3d19b7bb`. راجعنا رؤوس PRs المفتوحة، قوائم الملفات المتغيرة، وتشغيلات Actions الفعلية؛ لا كتابة Legacy/إنتاج، ولا دمج/نشر/cutover.

## اكتشافات مثبتة تمنع اعتمادًا خاطئًا

| PR / HEAD | Backend | Frontend | Database | E2E | القرار |
|---|---|---|---|---|---|
| [#158](https://github.com/nasef6464/almeaago/pull/158) / `0f05e6bc` (غير Draft، 180 ملفًا) | FAIL [40776235161](https://github.com/nasef6464/almeaago/actions/runs/40776235161) | FAIL [40776235278](https://github.com/nasef6464/almeaago/actions/runs/40776235278) | FAIL [40776235272](https://github.com/nasef6464/almeaago/actions/runs/40776235272) | FAIL [40776235115](https://github.com/nasef6464/almeaago/actions/runs/40776235115) | BLOCKED_CI |
| [#159](https://github.com/nasef6464/almeaago/pull/159) / `aa34022b` | MISSING | PASS [40813711046](https://github.com/nasef6464/almeaago/actions/runs/40813711046) | MISSING | PASS [40813711034](https://github.com/nasef6464/almeaago/actions/runs/40813711034) | PARTIAL_CI |
| [#160](https://github.com/nasef6464/almeaago/pull/160) / `9a8e0692` | PASS | PASS | PASS | PASS | CI_ONLY_VERIFIED |
| [#171](https://github.com/nasef6464/almeaago/pull/171) / `6bb7d7fe` | PASS [40884518780](https://github.com/nasef6464/almeaago/actions/runs/40884518780) | PASS [40884518748](https://github.com/nasef6464/almeaago/actions/runs/40884518748) | PASS [40884518770](https://github.com/nasef6464/almeaago/actions/runs/40884518770) | FAIL [40884518756](https://github.com/nasef6464/almeaago/actions/runs/40884518756) | BLOCKED_CI |
| [#173](https://github.com/nasef6464/almeaago/pull/173) / `ba089664` | PASS | PASS | PASS | PASS | CI_ONLY_VERIFIED |

كذلك #161/#162/#163/#165/#166/#167/#168/#169/#170/#172 أظهرت البوابات الأربع الناجحة عند الرؤوس التي فُحصت. نتيجة #169 التي كانت معلقة في تقرير سابق أصبحت PASS في Database [40881231925](https://github.com/nasef6464/almeaago/actions/runs/40881231925) وE2E [40881231867](https://github.com/nasef6464/almeaago/actions/runs/40881231867). **CI_ONLY_VERIFIED لا يعني تطابق واجهة أو دور أو قاعدة بيانات end-to-end.**

سجلات E2E في #171 (job `123484539834`) تثبت فشلين: `content-learning-space.spec.ts:37` ينتظر `مساراتي ودوراتي` المحذوفة، و`public-user-workspaces-parity.spec.ts:80` ينتظر رابط `/notifications` داخل لوحة الطالب. لا نعيد عناصر Go الزائدة لمجرد إرضاء الاختبار؛ نراجع `Legacy/pages/Dashboard.tsx` ونحدث التوقعات بمالك واحد، ثم نعيد التشغيل.

## تعارضات الملفات الحقيقية وقرار الكاتب الواحد

فحص قوائم ملفات PRs أثبت **سبعة أزواج اشتراك**: #158↔#159 (7 ملفات)، #158↔#160 (6)، #158↔#165 (1)، #158↔#168 (1)، #159↔#160 (3)، #159↔#168 (1)، #158↔#123 (1). هذه **مشاركة ملفات لا تعارض merge مثبت**. Patch #158 يستبدل `LegacySiteHeader.tsx` بمغلّف `OriginalHeader`، بينما #159 يعيد شجرة التنقل داخل `LegacySiteHeader.tsx`؛ دمج أحدهما فوق الآخر سيحتاج مصالحة وظيفية صريحة.

| الملف/العقد | مالك الكتابة المقترح | المستهلك وشروط القبول |
|---|---|---|
| `LegacySiteHeader.tsx` / hierarchy | الموقع العام (#159)، مع فصل #158 قبل الدمج | المسار والمادة والرابط والإظهار والترتيب والأدوار والصور 390/820/1440 |
| `LearningSpacePage.tsx` | الطالب (#168) | الهيدر يسلم route/path/subject IDs فقط؛ العودة/التحديث وعدم تشغيل الفيديو تلقائيًا |
| `content-types.ts` / lesson DTO | المدير والمهارات (#160) | GET الطالب يعكس save/link/unlink؛ Go/PostgreSQL فعلي مع رفض غير المصرح |
| `public-user-workspaces-parity.spec.ts` | كاتب تكامل واحد | استبدال توقعات Go المخترعة بأصل Legacy، لا تزييف نجاح E2E |
| `frontend.yml` و`database.yml` | الإشراف والتكامل فقط | لا تحرير متوازٍ للبوابات، وCI الأربع على SHA النهائي |
| membership / assignment / assessment audience / entitlement | مالك كل دومين، لا نسخ للقرارات في React | فشل مغلق، نطاق المدرسة/الفصل، محرك تصحيح موحد |

## شريحة الإشراف المنفذة

أضيفت أداة `scripts/parity/pr-gate-readiness.mjs` لقراءة PRs وتشغيلات Actions على **SHA النهائي نفسه** وإصدار `CI_ONLY_VERIFIED` / `PARTIAL_CI` / `BLOCKED_CI`. ترفض missing/pending/skipped والـSHA القديم، وتقرأ أحدث rerun، وتفشل مغلقًا عند نقص API أو pagination. اختبارات `pr-gate-readiness.test.mjs` تغطي 8 سيناريوهات. Workflow مستقل `pr-gate-readiness.yml` للاختبار والتشغيل اليدوي الرقابي دون تغيير workflows الفرق أو بياناتها. لا يُعد تشغيل الأداة إثباتًا للتكافؤ.

**الخطوة التالية:** الموقع العام يحسم #158/#159 ويصور القوائم الأصلية؛ المدير يغلق رحلة حفظ المهارة/الدرس وتأثيرها على الطالب دون ازدواج #160؛ الطالب يصحح الاختبارين ثم يستكمل video/training/support؛ المدارس تثبت membership/assignment/assessment audience مع بيانات معزولة. لكل فريق لقطات Legacy↔Go بنفس الدور والبيانات عند 390/820/1440 وحالات فشل الحفظ/الرجوع/التحديث. **الحالة الكلية PARTIAL / NOT PROVEN** حتى الأدلة الحية، ولا دمج أو نشر دون قرار مستقل.
