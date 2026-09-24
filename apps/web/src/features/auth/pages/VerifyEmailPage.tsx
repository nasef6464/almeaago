import { ArrowRight, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../state/AuthProvider';

export function VerifyEmailPage() {
  const { user, verifyEmail, resendEmailVerification } = useAuth();
  const [searchParams] = useSearchParams();
  const initialToken = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [token, setToken] = useState(initialToken);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function verify(verificationToken: string) {
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await verifyEmail(verificationToken.trim());
      setMessage(response.message || 'تم تأكيد البريد بنجاح.');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'تعذر تأكيد البريد الآن.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (initialToken) {
      void verify(initialToken);
    }
  }, [initialToken]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await verify(token);
  }

  async function resend() {
    setError('');
    setMessage('');
    setIsResending(true);

    try {
      const response = await resendEmailVerification();
      setMessage(response.message || 'تم إرسال رمز تحقق جديد.');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'سجل الدخول أولا لإعادة إرسال رمز التحقق.',
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-gray-50 px-4 py-10" dir="rtl">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-amber-600"
        >
          <ArrowRight size={16} />
          العودة للرئيسية
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            {message ? <CheckCircle2 size={22} /> : <Mail size={22} />}
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">تأكيد البريد الإلكتروني</h1>
            <p className="mt-1 text-sm text-gray-500">
              أدخل رمز التأكيد أو افتح الرابط المرسل إلى بريدك.
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
            <label className="mb-1 block text-sm font-bold text-gray-700">رمز التحقق</label>
            <input
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              dir="ltr"
              placeholder="verification token"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
            تأكيد البريد
          </button>
        </form>

        <button
          type="button"
          onClick={resend}
          disabled={isResending || !user}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResending ? <Loader2 size={18} className="animate-spin" /> : null}
          إعادة إرسال رمز التحقق
        </button>
      </section>
    </main>
  );
}
