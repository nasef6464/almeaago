/**
 * Original visitor smart-login error contract from the read-only
 * almeaacodax/components/Header.tsx handleSmartLogin catch.
 *
 * Keep this presentation-only: the auth transport preserves HTTP errors,
 * RBAC and throttling decisions remain server-owned, and signup/OTP flows
 * continue to use their own original error handling.
 */
export function legacyLoginErrorMessage(message: string): string {
  if (/Too many login attempts|تم تجاوز عدد المحاولات/i.test(message)) {
    return 'توقف الدخول مؤقتًا لحماية حسابك. انتظر 15 دقيقة، أو اضغط «نسيت كلمة المرور» لاستعادة الدخول.';
  }
  if (/Too many authentication attempts/i.test(message)) {
    return 'محاولات دخول كثيرة من هذه الشبكة. انتظر قليلًا، أو استخدم «نسيت كلمة المرور» إذا نسيتها.';
  }
  if (/Invalid credentials|Invalid email or password|رقم الهوية أو كلمة المرور غير صحيحة|الجوال أو كلمة المرور/i.test(message)) {
    return 'بيانات الدخول غير صحيحة. راجعها، وإذا نسيت كلمة المرور اضغط «نسيت كلمة المرور» بدل تكرار المحاولات.';
  }
  return message;
}
