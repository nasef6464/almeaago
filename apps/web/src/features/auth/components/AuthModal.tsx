import { Loader2, MessageCircle, X } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../state/AuthProvider';
import { dashboardPathFor } from '../utils/dashboard-path';
import { identifyLoginInput } from '../utils/identify-login-input';
import { AuthErrorBanner } from './AuthErrorBanner';
import { GoogleButton } from './GoogleButton';
import { PasswordField } from './PasswordField';
import { SmartLoginInput } from './SmartLoginInput';

interface Props {
  open: boolean;
  initialSignUp?: boolean;
  onClose(): void;
}

export function AuthModal({ open, initialSignUp = false, onClose }: Props) {
  const navigate = useNavigate();
  const { signIn, signInNationalId, signInPhone, signUp } = useAuth();

  const [isSignUp, setIsSignUp] = useState(initialSignUp);
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [smartInput, setSmartInput] = useState('');
  const [smartPassword, setSmartPassword] = useState('');
  const [showSmartPassword, setShowSmartPassword] = useState(false);

  const [signupName, setSignupName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (open) {
      setIsSignUp(initialSignUp);
    }
  }, [initialSignUp, open]);

  const inputType = useMemo(() => identifyLoginInput(smartInput), [smartInput]);
  const strongPassword =
    password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

  if (!open) {
    return null;
  }

  function resetForm() {
    setAuthError('');
    setSmartInput('');
    setSmartPassword('');
    setShowSmartPassword(false);
    setSignupName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSubmitting(false);
  }

  function close() {
    resetForm();
    onClose();
  }

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const identity = smartInput.trim();
    const digits = identity.replace(/\D/g, '');
    const enteredPassword = smartPassword.trim();

    if (!enteredPassword) {
      setAuthError('يرجى إدخال كلمة المرور.');
      return;
    }

    setSubmitting(true);
    setAuthError('');

    try {
      if (inputType === 'email') {
        const user = await signIn(identity.toLowerCase(), enteredPassword);
        close();
        navigate(dashboardPathFor(user));
        return;
      }

      if (inputType === 'nationalId') {
        const user = await signInNationalId(digits, enteredPassword);
        close();
        navigate(dashboardPathFor(user));
        return;
      }

      if (inputType === 'phone') {
        const user = await signInPhone(identity, enteredPassword);
        close();
        navigate(dashboardPathFor(user));
        return;
      }

      setAuthError('أدخل بريد إلكتروني أو رقم جوال أو رقم الهوية.');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSignup(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (signupName.trim().length < 2) {
      setAuthError('يرجى كتابة الاسم الكامل (حرفين على الأقل).');
      return;
    }
    if (!strongPassword) {
      setAuthError('كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف ورقم.');
      return;
    }
    if (password !== confirmPassword) {
      setAuthError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setSubmitting(true);
    setAuthError('');

    try {
      const user = await signUp(signupName.trim(), email.trim().toLowerCase(), password.trim());
      close();
      navigate(dashboardPathFor(user));
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'حدث خطأ أثناء إنشاء الحساب');
    } finally {
      setSubmitting(false);
    }
  }

  function toggleMode() {
    resetForm();
    setIsSignUp((value) => !value);
  }

  function pendingGoogle() {
    setAuthError('تسجيل Google محفوظ في الواجهة وسيُفعّل عند ربط مزود Google في مرحلة التكاملات.');
  }

  function pendingWhatsApp() {
    setAuthError('تسجيل واتساب محفوظ في الواجهة وسيُفعّل مع OTP في مرحلة الهوية التالية.');
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="animate-fade-in w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 pb-4 pt-6 dark:border-gray-800">
          <div>
            <h2 id="auth-modal-title" className="text-xl font-black text-gray-900 dark:text-white">
              {isSignUp ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
            </h2>
            <p className="mt-0.5 text-xs font-medium text-gray-400 dark:text-gray-400">
              {isSignUp
                ? 'انضم إلى منصة المئة وابدأ رحلة تميزك اليوم'
                : 'مرحباً بعودتك! اختر الطريقة الأنسب لك'}
            </p>
          </div>
          <button
            id="login-modal-close"
            type="button"
            onClick={close}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800"
            aria-label="إغلاق النافذة"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <AuthErrorBanner message={authError} />

          <GoogleButton signUp={isSignUp} onClick={pendingGoogle} />

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            <span className="text-xs font-medium text-gray-400">
              {isSignUp ? 'أو أنشئ حسابك بالبريد الإلكتروني' : 'أو بالبيانات المسجلة'}
            </span>
            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          </div>

          {!isSignUp ? (
            <form id="smart-login-form" onSubmit={submitLogin} className="space-y-3.5">
              <SmartLoginInput
                value={smartInput}
                onChange={(value) => {
                  setSmartInput(value);
                  setAuthError('');
                }}
              />

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    كلمة المرور
                  </label>
                  <Link
                    to="/forgot-password"
                    onClick={close}
                    className="text-xs font-bold text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    نسيت كلمة المرور؟
                  </Link>
                </div>
                <PasswordField
                  id="smart-login-password"
                  label=""
                  value={smartPassword}
                  onChange={setSmartPassword}
                  shown={showSmartPassword}
                  onToggle={() => setShowSmartPassword((value) => !value)}
                  autoComplete="current-password"
                />
              </div>

              <button
                id="smart-login-submit"
                type="submit"
                disabled={
                  submitting ||
                  smartInput.trim().length < 4 ||
                  !smartPassword.trim()
                }
                className="w-full rounded-xl bg-emerald-500 py-3 text-base font-black text-white shadow-sm transition-all hover:bg-emerald-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={17} className="animate-spin" />
                    جارٍ تسجيل الدخول...
                  </span>
                ) : (
                  'تسجيل الدخول'
                )}
              </button>

              {inputType === 'phone' ? (
                <button
                  type="button"
                  onClick={pendingWhatsApp}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#1ebe5d]"
                >
                  <MessageCircle size={18} />
                  تسجيل بالواتساب
                </button>
              ) : null}
            </form>
          ) : (
            <form id="signup-form" onSubmit={submitSignup} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">
                  الاسم الكامل <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  aria-label="Name"
                  required
                  value={signupName}
                  onChange={(event) => setSignupName(event.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 outline-none transition-colors focus:border-emerald-400 dark:border-gray-700 dark:bg-slate-800 dark:text-white"
                  placeholder="الاسم الثلاثي للطالب"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">
                  البريد الإلكتروني <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  aria-label="Email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-left outline-none transition-colors focus:border-emerald-400 dark:border-gray-700 dark:bg-slate-800 dark:text-white"
                  dir="ltr"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <PasswordField
                  label="كلمة المرور *"
                  value={password}
                  onChange={setPassword}
                  shown={showPassword}
                  onToggle={() => setShowPassword((value) => !value)}
                  placeholder="8 أحرف على الأقل"
                  autoComplete="new-password"
                />
                <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                  <span
                    className={`inline-flex items-center gap-1 font-medium transition-colors ${
                      password.length >= 8
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {password.length >= 8 ? '✓' : '○'} 8 أحرف فأكثر
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 font-medium transition-colors ${
                      /[A-Za-z]/.test(password) && /\d/.test(password)
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {/[A-Za-z]/.test(password) && /\d/.test(password) ? '✓' : '○'} حروف وأرقام
                  </span>
                </div>
              </div>

              <div>
                <PasswordField
                  label="تأكيد كلمة المرور *"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  shown={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword((value) => !value)}
                  placeholder="أعد كتابة كلمة المرور"
                  autoComplete="new-password"
                  inputClassName={
                    confirmPassword && password !== confirmPassword
                      ? '!border-red-300 focus:!border-red-400'
                      : confirmPassword && password === confirmPassword
                        ? '!border-emerald-300 focus:!border-emerald-400'
                        : ''
                  }
                />
                {confirmPassword && password !== confirmPassword ? (
                  <p className="mt-1 text-xs font-medium text-red-500">
                    كلمتا المرور غير متطابقتين
                  </p>
                ) : null}
              </div>

              <p className="text-center text-[11px] leading-relaxed text-gray-400 dark:text-gray-400">
                بإنشائك للحساب فإنك توافق على{' '}
                <Link
                  to="/terms"
                  onClick={close}
                  className="text-emerald-600 underline underline-offset-2 dark:text-emerald-400"
                >
                  شروط الاستخدام
                </Link>{' '}
                و{' '}
                <Link
                  to="/privacy"
                  onClick={close}
                  className="text-emerald-600 underline underline-offset-2 dark:text-emerald-400"
                >
                  سياسة الخصوصية
                </Link>
              </p>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-emerald-500 py-3 text-base font-black text-white shadow-sm transition-all hover:bg-emerald-600 active:scale-[0.99] disabled:opacity-60"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={17} className="animate-spin" />
                    جارٍ إنشاء الحساب...
                  </span>
                ) : (
                  'إنشاء حساب جديد'
                )}
              </button>
            </form>
          )}

          <div className="border-t border-gray-100 pt-3 text-center dark:border-gray-800">
            <button
              id="toggle-signup-login"
              type="button"
              onClick={toggleMode}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-emerald-600 dark:text-gray-300 dark:hover:text-emerald-400"
            >
              {isSignUp ? (
                <span>
                  لديك حساب بالفعل؟{' '}
                  <span className="font-bold text-emerald-600 underline underline-offset-2 dark:text-emerald-400">
                    تسجيل الدخول
                  </span>
                </span>
              ) : (
                <span>
                  ليس لديك حساب في المنصة؟{' '}
                  <span className="font-bold text-emerald-600 underline underline-offset-2 dark:text-emerald-400">
                    إنشاء حساب جديد
                  </span>
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
