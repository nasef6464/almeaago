# الموقع العام — استعادة رسائل فشل الدخول الأصلية (30 أكتوبر 2026)

## نطاق التنفيذ والملكية
- **مرجع Legacy للقراءة فقط:** `nasef6464/almeaacodax/main@bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7`، `components/Header.tsx`، `handleSmartLogin` / catch.
- **أساس Go:** `nasef6464/almeaago/main@1f6d5a3db2cfba869ac48aee74903b99e17648e1`.
- **المسار:** زائر → نافذة تسجيل الدخول → بريد/هوية/جوال مع كلمة مرور → فشل HTTP → رسالة المصدر نفسها → الاحتفاظ بالمدخلات وإعادة المحاولة → نجاح/انتقال لوحة الدور.
- التغيير محصور في واجهة الزائر ومحول نصوص الخطأ، ولا يمس الهيدر الجاري #159 أو الصفحة الرئيسية #166 أو نقل أخطاء HTTP الجاري #221 أو RBAC أو scoring أو payments أو Legacy.

## الفجوة المثبتة من الكود
في Legacy `components/Header.tsx` تُحوَّل ثلاثة أصناف أخطاء إلى رسائل عربية محددة:
1. `Too many login attempts` أو `تم تجاوز عدد المحاولات` → توجيه الانتظار 15 دقيقة أو استعادة كلمة المرور.
2. `Too many authentication attempts` → رسالة تقييد الشبكة.
3. `Invalid email or password` أو رسائل خطأ الهوية/الجوال → توجيه مراجعة البيانات والاستعادة.

في Go كانت `AuthModal.tsx` تعرض `error.message` حرفيًا دون التحويل. كذلك ترجع طبقة HTTP في Go النص `Invalid credentials` (وليس `Invalid email or password`) عند `ErrInvalidCredentials`؛ ولذلك أضيف هذا **الاسم المكافئ من النقل** إلى صنف العرض الأصلي دون تغيير سياسة الدخول أو الخادم. الأخطاء غير المصنفة لا تُخفى ولا تُغيَّر.

## أثر الوظيفة وطبقاتها
| طبقة | التنفيذ/المصدر | حالة الإثبات |
|---|---|---|
| شاشة الزائر | `AuthModal.tsx` → `legacyLoginErrorMessage`؛ يبقى الحقلان وزر الإعادة | اختبار المتصفح على HTTP fixture، لا مصدر متصفح مقترن |
| HTTP | `POST /api/v1/auth/login`، وبدائله `login/national-id` و`login/phone-password` عبر `authClient` | عقود المصدر والكود؛ اختبارات E2E mocks |
| Go application | `internal/identity/application/service.go` → `Login/LoginNationalID/LoginPhonePassword` → `loginUser` | كود مقروء؛ لم يُغيَّر |
| PostgreSQL | `internal/identity/repository/postgres/repository.go` → `UserByEmail`/سجل المحاولات/القفل والجلسة | كود مقروء؛ لا إثبات جلسة DB حقيقية في هذا الاختبار |
| المستهلك | رسالة الخطأ في النافذة، ثم `dashboardPathFor` عند نجاح إعادة المحاولة | E2E على HTTP fixture |

## RED → GREEN
- **RED:** اختبارات `scripts/parity/public-login-error-source.test.mjs` أُضيفت قبل المعالجة. فشل `Public Login Legacy Error Parity` على `b1487f1568bf1f05d1192d1a25b7c9c504435318`؛ [دليل RED](https://github.com/nasef6464/almeaago/actions/runs/41018708780)، بعد نجاح checkout وinstall وفشل خطوة العقد نفسها.
- **GREEN أولي:** بعد إضافة المحول وربطه، نجح نفس العقد على `88c9e2aa89b733377393c3dfc4062fda196fd7f0`؛ [دليل GREEN](https://github.com/nasef6464/almeaago/actions/runs/41018799104).
- أضيفت تغطية اسم خطأ Go الفعلي `Invalid credentials` إلى الاختبارات والعرض بعد قراءة `writeApplicationError`؛ تُراجع نتائج SHA النهائي في PR.
- E2E مستقل عند `390/820/1440` RTL لأربعة أصناف: رسالة المصدر، حفظ حقلي الدخول بعد الفشل، رابط الاستعادة، تفعيل الإعادة، نجاح المحاولة الثانية، وعدم تمرير أفقي. الصور الناتجة من **Go fixture فقط**؛ ليست صور Legacy↔Go مقترنة.
- لا يُدّعى تكامل PostgreSQL حي من اختبارات Playwright المحاكية. لا تغيير SQL أو Go في هذه الشريحة.

## حالة القبول
- **VERIFIED (source/code):** فرق رسالة الدخول، عقد المحول، وعدم المساس بمنطق الخادم.
- **PARTIAL (runtime):** Browser mock وCI حسب SHA النهائي؛ إعادة تحميل المسودة بعد فشل الدخول ليست سياسة Legacy، فلا نخزن كلمة مرور في المتصفح.
- **BLOCKED / NOT PROVEN:** صور Legacy↔Go المتطابقة على بيانات ودور واحد، واختبار فشل/نجاح حقيقي على PostgreSQL بجلسة اختبار آمنة.
- **التالي:** متابعة الفريق العام لاستعادة المسارات/الدورات والهيدر عبر PRs المالكة، ثم إثبات مدير يحفظ إعدادات الواجهة ويراها الزائر عبر PostgreSQL وصور مقترنة. لا دمج ولا نشر ضمن هذه الشريحة.
