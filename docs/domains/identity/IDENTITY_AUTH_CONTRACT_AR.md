# Identity/Auth Contract — ALMEAA V2

## Legacy observable baseline
النسخة الجديدة يجب أن تحافظ على:
- إنشاء حساب بالاسم والبريد وكلمة المرور.
- تسجيل الدخول بالبريد وكلمة المرور.
- تسجيل الدخول بالهوية الوطنية السعودية وكلمة المرور.
- Google OAuth.
- WhatsApp OTP.
- Logout وCurrent User.
- Forgot/Reset Password.
- Email Verification + Resend.
- منع الحساب المعطل.
- قفل تسجيل الدخول بعد 5 محاولات فاشلة لمدة 15 دقيقة.
- كلمة المرور 8-160 حرفًا وبها حرف ورقم.
- Cookie-first auth بمدة جلسة 7 أيام.

## حدود المسؤولية
Identity يملك الهوية وبيانات الاعتماد والجلسات.
Organizations يملك عضوية المدارس والفصول وعلاقات ولي الأمر.
Commerce يملك Entitlements.
Learning يملك Progress/Review.

## Core Slice الحالي
- POST /api/v1/auth/register
- POST /api/v1/auth/login
- POST /api/v1/auth/login/national-id
- GET /api/v1/auth/me
- GET /api/v1/auth/csrf
- POST /api/v1/auth/logout

## Session Model
- token عشوائي opaque.
- القيمة الخام لا تحفظ في PostgreSQL.
- DB تحفظ SHA-256 digest فقط.
- HttpOnly cookie باسم legacy-compatible: almeaa_access_token.
- 7-day expiry.
- session قابلة للإلغاء فورًا.
- CSRF token digest مرتبط بالجلسة.
- roles تُقرأ من server truth ولا تُدفن داخل JWT طويل العمر.
- last_seen bounded write: لا يُحدّث أكثر من مرة كل 5 دقائق لتقليل write amplification.

## Password Storage
Password hashing versioned وقابل للهجرة مستقبلًا.
انظر ADR-0007.
قبل Production يتم Benchmark على instance class الحقيقية لضبط cost بدون إضعاف الأمان أو إرهاق السيرفر.

## Recovery / Verification Slice
Implemented on `feat/identity-recovery`:
- POST /api/v1/auth/forgot-password
- POST /api/v1/auth/reset-password
- POST /api/v1/auth/email/verify
- POST /api/v1/auth/email/resend
- raw recovery/verification tokens never persist.
- password reset TTL = 60 minutes.
- email verification TTL = 24 hours.
- reset revokes active sessions transactionally.
- resend verification requires authenticated session + CSRF.
- repeated token issuance invalidates prior unused token for the same purpose.

## الخطوات التالية داخل Identity
1. Auth frontend visual parity.
2. Google OAuth.
3. WhatsApp OTP.
4. Phone/password parity if the legacy smart-input flow still requires it.
5. Admin account management.
6. External delivery adapters.

## Security Acceptance
- Wrong credentials => generic 401.
- المحاولة الخامسة تدخل lock policy.
- Disabled user لا يسجل الدخول.
- Successful login يمسح failed-login state.
- Raw session/CSRF tokens لا تحفظ في DB.
- Logout يتطلب CSRF عند وجود session صالحة.
- Auth response لا يعرض password/security internals.
- Session lookup indexed ومحدود.

## Visual Parity
واجهة Login/Register والـRecovery screens تظل مطابقة للواجهة القديمة:
- نفس RTL.
- نفس modal proportions.
- نفس Google entry point.
- نفس login/register toggle.
- نفس error banner.
- نفس password visibility controls.
- نفس mobile behavior.
- نفس الصياغة العربية إلا لو اعتمد تغيير صريح.
