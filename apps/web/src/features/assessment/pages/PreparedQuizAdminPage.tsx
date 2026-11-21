import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { PreparedQuizAdminPanel } from '../components/PreparedQuizAdminPanel';

export function PreparedQuizAdminPage() {
  const { assessmentId = '' } = useParams();
  const { user, loading, getCsrfToken } = useAuth();
  const admin = Boolean(user?.role === 'admin' || user?.roles?.includes('admin'));

  if (loading) {
    return <main className="p-10 text-center font-black text-slate-500">جاري التحقق من الجلسة...</main>;
  }
  if (!user || !admin) {
    return <main dir="rtl" className="p-10 text-center font-black text-rose-700">هذه الشاشة متاحة لإدارة المنصة فقط.</main>;
  }

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-4 p-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-950 p-5 text-white">
        <div>
          <h1 className="text-xl font-black">الاختبارات المُعدّة</h1>
          <p className="mt-1 text-xs font-bold text-slate-300">
            جهّز مجموعات الاختبارات وحدّد من يحق له رؤيتها وبدءها.
          </p>
        </div>
        <Link
          to="/admin-dashboard/assessments"
          className="rounded-xl border border-white/30 px-4 py-2 text-sm font-black text-white"
        >
          عودة لإدارة الاختبارات
        </Link>
      </section>
      {assessmentId ? (
        <PreparedQuizAdminPanel assessmentId={assessmentId} getCsrfToken={getCsrfToken} />
      ) : (
        <div className="rounded-2xl border bg-white p-6 text-center font-bold text-slate-500">
          لم يتم تحديد اختبار.
        </div>
      )}
    </main>
  );
}
