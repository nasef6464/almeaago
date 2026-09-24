import { ArrowRight, Loader2, MailCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../state/AuthProvider';

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await forgotPassword(email.trim());
      setMessage(response.message || 'تم إرسال تعليمات الاستعادة إذا كان البريد مسجلا لدينا.');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'تعذر إرسال طلب الاستعادة الآن.',
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
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-emerald-600"
        >
          <ArrowRight size={16} />
          العودة للرئيسية
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <MailCheck size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">استعادة كلمة المرور</h1>
            <p className="mt-1 text-sm text-gray-500">
              اكتب بريدك وسنرسل لك تعليمات آمنة للاستعادة.
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
            <label htmlFor="forgot-email" className="mb-1 block text-sm font-bold text-gray-700">
              البريد الإلكتروني
            </label>
            <input
              id="forgot-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              dir="ltr"
              placeholder="user@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
            إرسال التعليمات
          </button>
        </form>

        <Link
          to="/login"
          className="mt-5 block text-center text-sm font-bold text-gray-500 hover:text-emerald-600"
        >
          تذكرت كلمة المرور؟ سجل الدخول
        </Link>
      </section>
    </main>
  );
}
