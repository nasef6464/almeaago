# Auth Frontend Parity Implementation Map

## الهدف
نقل تجربة Auth الحالية إلى React V2 بدون إعادة تصميم.

## Legacy visual sources
- `almeaacodax/components/Header.tsx` — Login/Register modal.
- `almeaacodax/pages/ForgotPassword.tsx`
- `almeaacodax/pages/ResetPassword.tsx`
- `almeaacodax/pages/VerifyEmail.tsx`
- `almeaacodax/tailwind.config.cjs`
- `almeaacodax/postcss.config.cjs`

## Target feature structure

```
apps/web/src/features/auth/
  api/
    auth-client.ts
    auth-types.ts
  components/
    AuthModal.tsx
    SmartLoginInput.tsx
    PasswordField.tsx
    GoogleButton.tsx
    AuthErrorBanner.tsx
  pages/
    ForgotPasswordPage.tsx
    ResetPasswordPage.tsx
    VerifyEmailPage.tsx
  state/
    AuthProvider.tsx
  utils/
    identify-login-input.ts
```

الهدف تفكيك Header القديم بدل نسخ ملف 70KB كامل، مع الحفاظ على نفس HTML/classes المرئية.

## Modal baseline
- overlay: `fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm`
- center: `flex items-center justify-center p-4`
- card: white/dark-slate, `rounded-3xl`, `w-full max-w-md`, shadow-2xl, border.
- header padding: px-6 pt-6 pb-4.
- title: text-xl font-black.
- subtitle: text-xs gray.
- close button: rounded-full hover background.
- body: p-6 space-y-4.

## Login text
- title: تسجيل الدخول
- subtitle: مرحباً بعودتك! اختر الطريقة الأنسب لك
- smart input label: البريد أو الجوال أو رقم الهوية
- password label: كلمة المرور
- forgot link preserved.
- loading text: جارٍ تسجيل الدخول...

## Signup text
- title: إنشاء حساب جديد
- subtitle: انضم إلى منصة المئة وابدأ رحلة تميزك اليوم
- Google action preserved.
- email/password registration layout preserved.

## Smart input
Legacy input recognizes:
- email.
- Saudi National ID: 10 digits starting 1 or 2.
- Saudi/mobile phone shape.

Target routing:
- email -> `POST /api/v1/auth/login`
- national ID -> `POST /api/v1/auth/login/national-id`
- phone -> WhatsApp/password path remains disabled or marked pending until Slice 3 implements the matching backend contract.

Do not silently change phone behavior.

## Recovery screens
Copy layout/classes and Arabic wording from legacy screens:
- Forgot: emerald accent.
- Reset: indigo accent.
- Verify: amber accent.
- `max-w-md rounded-2xl border bg-white p-6 shadow-sm`.
- same links, labels, helper copy, loading and error states.

## Auth client behavior
- always `credentials: "include"`.
- session token is never readable by JS.
- login/register response supplies CSRF token; keep it in memory only.
- `GET /api/v1/auth/csrf` rotates/refetches CSRF after reload.
- unsafe authenticated requests send `X-CSRF-Token`.
- 401 clears local user state.
- no token in localStorage/sessionStorage.

## Tailwind parity
Keep Tailwind 3.4-compatible utility behavior during parity phase.
Use the legacy theme values:
- primary emerald.
- secondary amber.
- dark slate.
- platform font CSS variable + Tajawal fallback.
- fade-in 180ms.

## Router parity
- `/login` opens login modal.
- `/signup` opens signup modal.
- `?auth=login|signup` opens matching modal.
- `/forgot-password`.
- `/reset-password?token=...`.
- `/verify-email?token=...`.

## Visual gate
Before PARITY_PROVEN:
1. desktop modal comparison.
2. mobile modal comparison.
3. login error state.
4. login loading state.
5. signup state.
6. forgot success/error.
7. reset token/password validation.
8. verify auto-token flow.
9. dark mode where legacy supports it.

No redesign is allowed during this slice.
