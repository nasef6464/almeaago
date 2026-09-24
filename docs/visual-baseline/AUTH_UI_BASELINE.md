# Auth UI Visual Baseline

## Legacy login/register modal
Verified from `components/Header.tsx`.

### Modal shell
- full-screen black/60 overlay.
- backdrop blur.
- centered modal with padding.
- white / dark slate surface.
- rounded-3xl.
- max width md.
- shadow-2xl.
- border.
- header separated by bottom border.

### Header copy
Login:
- title: تسجيل الدخول
- subtitle: مرحباً بعودتك! اختر الطريقة الأنسب لك

Signup:
- title: إنشاء حساب جديد
- subtitle: انضم إلى منصة المئة وابدأ رحلة تميزك اليوم

### Entry methods
- Google button visible in both login and signup.
- Smart input can identify email / phone / Saudi National ID.
- Phone path supports password and/or OTP behavior.
- Email/national-id password path.
- Error banner inside modal.
- Close resets auth form state.

### Google button
- full width.
- white/dark slate.
- 2px border.
- rounded-xl.
- Google mark.
- Arabic action copy.

### Mobile
The existing mobile header opens the same authentication modal; do not redesign into an unrelated standalone page unless the legacy route requires it.

## Recovery screens
Legacy routes:
- forgot-password
- reset-password
- verify-email

Maintain current RTL card/form hierarchy, Arabic messages, loading/disabled states, token-from-URL behavior and manual token fallback where present.

## Parity evidence required
Before marking Auth UI PARITY_PROVEN:
- legacy desktop screenshot.
- new desktop screenshot.
- legacy mobile screenshot.
- new mobile screenshot.
- login, signup, forgot, reset, verification states.
- validation/error/disabled/loading states.
