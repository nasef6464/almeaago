import { ArrowRight, KeyRound, Loader2 } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../state/AuthProvider';

export function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const initialToken = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف ورقم.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await resetPassword(token.trim(), password);
      setMessage(response.message || 'تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.');
      setPassword('');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'تعذر تحديث كلمة المرور الآن.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-gray-50 px-4 py-10" dir="rtl">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-600"
        >
          <ArrowRight size={16} />
          العودة للرئيسية
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <KeyRound size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">تعيين كلمة مرور جديدة</h1>
            <p className="mt-1 text-sm text-gray-500">
              استخدم الرمز الذي وصلك ثم اختر كلمة مرور قوية.
            </p>
          </div>
        </div>

        {message ? (
          <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-600">
            {error}
          </div>
        ) : null}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700">رمز الاستعادة</label>
            <input
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              dir="ltr"
              placeholder="reset token"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700">
              كلمة المرور الجديدة
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              dir="ltr"
              placeholder="********"
            />
            <p className="mt-1 text-xs text-gray-400">8 أحرف على الأقل، مع حرف ورقم.</p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
            حفظ كلمة المرور
          </button>
        </form>
      </section>
    </main>
  );
}
