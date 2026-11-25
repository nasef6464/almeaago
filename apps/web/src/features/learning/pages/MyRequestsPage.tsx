import { ArrowRight } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { MyRequestsTab } from './dashboard/MyRequestsTab';

export default function MyRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  if (!authLoading && !user) {
    return <Navigate replace to={`/login?next=${encodeURIComponent(location.pathname)}`} />;
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/dashboard?tab=requests"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
          >
            <ArrowRight size={15} />
            <span>العودة للوحة الطالب</span>
          </Link>
          <Link
            to="/book-session?source=my-requests"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
          >
            حجز حصة جديدة
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs">
          <MyRequestsTab />
        </div>
      </div>
    </div>
  );
}
