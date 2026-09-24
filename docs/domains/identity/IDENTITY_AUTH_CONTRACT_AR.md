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

## Provider Slice
Implemented on `feat/identity-oauth-otp`:
- POST /api/v1/auth/whatsapp/start
- POST /api/v1/auth/whatsapp/verify
- GET /api/v1/auth/google/start
- GET /api/v1/auth/google/callback
- canonical Saudi phone identity.
- HMAC-peppered OTP digest; plaintext OTP never persists.
- 10-minute OTP TTL.
- 3 sends / 15 minutes.
- 5 verification attempts.
- Google OAuth state protected by HttpOnly short-lived cookie.
- Google verified email required.
- external provider configuration remains optional until staging.

## الخطوات التالية داخل Identity
1. CI verification for Google/WhatsApp slice.
2. Staging provider credentials and live smoke test.
3. Auth screenshot visual parity.
4. Admin account management.
5. Email delivery adapter when notification provider is selected.

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


## Admin Account Operations
Current V2 slice:
- GET /api/v1/auth/admin/users
- GET /api/v1/auth/admin/users/summary
- POST /api/v1/auth/admin/users
- PATCH /api/v1/auth/admin/users/bulk-status
- PATCH /api/v1/auth/admin/users/:id
- DELETE /api/v1/auth/admin/users/:id

Rules:
- unsafe mutations require authenticated session + CSRF.
- create/update/bulk/delete require platform admin role.
- directory page size defaults to 50 and is hard-capped at 100.
- search is bounded and indexed by PostgreSQL pg_trgm.
- disabling an account revokes active sessions.
- self-delete is blocked.
- at least one active admin must remain.
- the last-admin invariant is protected transactionally under concurrency.
- every mutation writes an audit event in the same transaction.

Organization-owned fields remain pending:
- school/class/group scope.
- parent/student relationships.
- trainer managed paths/subjects.
- supervisor/teacher directory scope.

V2 does not silently ignore those fields. Their writes fail explicitly until Organizations/Trainer scope is connected.

## Intentional legacy fix
Legacy single-user PATCH did not consistently protect the last admin while delete/bulk operations did.
V2 applies one invariant across all account mutations. See `docs/LEGACY-BUGS.md`.
