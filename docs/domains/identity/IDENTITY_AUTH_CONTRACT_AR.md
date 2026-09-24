# Identity/Auth Contract — ALMEAA V2

## Legacy observable baseline
النسخة الجديدة يجب أن تحافظ على:
- إنشاء حساب بالاسم والبريد وكلمة المرور.
- تسجيل الدخول بالبريد وكلمة المرور.
- تسجيل الدخول بالهوية الوطنية السعودية وكلمة المرور.
- تسجيل الدخول بالجوال + كلمة المرور.
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
Communication سيملك delivery adapters للبريد وWhatsApp؛ Identity يستدعي Port فقط ولا يعرف provider.

## Session Model
- token عشوائي opaque.
- raw session token لا يُحفظ في PostgreSQL.
- DB تحفظ SHA-256 digest فقط.
- HttpOnly cookie: `almeaa_access_token`.
- 7-day expiry.
- session قابلة للإلغاء فورًا.
- CSRF token digest مرتبط بالجلسة.
- roles تُقرأ من server truth ولا تُدفن داخل JWT طويل العمر.
- last_seen write bounded لتقليل write amplification.
- Auth responses تحمل `Cache-Control: no-store`.

## Password Storage
- Argon2id.
- self-describing/versioned parameters.
- current baseline موثق في ADR-0007.
- successful login يستطيع rehash عندما تتغير parameters.
- قبل Production يتم Benchmark على instance class الحقيقية مع concurrent login load.

## Recovery / Verification
### Password reset
- Generic forgot-password response لمنع account enumeration.
- raw reset token يُسلّم فقط لقناة الإرسال.
- PostgreSQL تحفظ digest فقط.
- token TTL = 60 minutes.
- إصدار token جديد يلغي السابق.
- token one-time.
- reset يتم داخل transaction.
- successful reset يلغي كل sessions القديمة ويصفر lock state.

### Email verification
- raw verification token لا يُحفظ.
- token TTL = 24 hours.
- resend يلغي token السابق.
- consume one-time داخل transaction.
- التسجيل ينشئ user + role + verification token atomically.

## Current API
- POST /api/v1/auth/register
- POST /api/v1/auth/login
- POST /api/v1/auth/login/national-id
- POST /api/v1/auth/login/phone-password
- GET /api/v1/auth/me
- GET /api/v1/auth/csrf
- POST /api/v1/auth/logout
- POST /api/v1/auth/forgot-password
- POST /api/v1/auth/reset-password
- POST /api/v1/auth/email/verify
- POST /api/v1/auth/email/resend-verification

## Security Acceptance
- Wrong credentials => generic 401.
- Unknown account performs dummy password verification to reduce timing distinction.
- fifth failed attempt enters lock policy.
- disabled user denied.
- successful login clears failed-login state.
- raw session/CSRF/recovery tokens do not persist in DB.
- logout and resend-verification require CSRF for authenticated sessions.
- generic `/me` does not return national ID or phone.
- CORS is explicit allow-list; no wildcard credentials.
- security headers are applied at API boundary.
- request body size is bounded.
- password reset revokes previous sessions.
- recovery token is one-time and expiry-bound.

## Delivery status
Recovery workflow is **not PARITY_PROVEN** until a real reliable delivery adapter is wired through Communication:
- email queue/outbox.
- delivery status/observability.
- bounded retry/backoff.
- no raw reset/verification token in logs.

The current development adapter intentionally discards delivery.

## Remaining Identity work
1. Google OAuth with state binding and safe returnTo.
2. WhatsApp OTP with hashed OTP + Redis/server-side throttling.
3. Phone/national-ID identity management policy.
4. Admin account management through audited application services.
5. Auth frontend visual parity.
6. Staging E2E + visual proof.

## Visual Parity
واجهة Login/Register وRecovery screens تظل مطابقة للواجهة القديمة:
- نفس RTL.
- نفس modal proportions.
- نفس Google entry point.
- نفس smart input لسلوك email / phone / national ID.
- نفس login/register toggle.
- نفس error banner.
- نفس password visibility controls.
- نفس mobile behavior.
- نفس الصياغة العربية إلا لو اعتمد تغيير صريح.
