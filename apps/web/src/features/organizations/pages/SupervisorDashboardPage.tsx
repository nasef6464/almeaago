import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ChevronLeft,
  Loader2,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { organizationsClient, type SchoolContext } from '../api/organizations-client';

const actions = [
  {
    to: '/supervisor-dashboard/interventions',
    title: 'التدخلات والخطط العلاجية',
    text: 'متابعة التدخلات المسموح بها حسب المدرسة أو الفصل المسند.',
    icon: Activity,
    tone: 'bg-amber-50 text-amber-700',
  },
  {
    to: '/reports',
    title: 'التقارير والتحليلات',
    text: 'نتائج ومؤشرات ضمن النطاق المصرح به فقط.',
    icon: BarChart3,
    tone: 'bg-indigo-50 text-indigo-700',
  },
  {
    to: '/notifications',
    title: 'الإشعارات',
    text: 'تنبيهات حساب المشرف ورسائل المتابعة داخل المنصة.',
    icon: Bell,
    tone: 'bg-slate-100 text-slate-700',
  },
];

export function SupervisorDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [contexts, setContexts] = useState<SchoolContext[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user || !user.roles.includes('supervisor')) return;
    const controller = new AbortController();
    setBusy(true);
    setError('');
    organizationsClient
      .contexts(controller.signal)
      .then((response) => setContexts(response.contexts.filter((item) => item.role === 'supervisor')))
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'تعذر تحميل نطاق الإشراف');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [authLoading, user]);

  if (authLoading) {
    return <main dir="rtl" className="p-10 text-center font-black">جاري التحقق من الحساب...</main>;
  }
  if (!user || !user.roles.includes('supervisor')) {
    return <main dir="rtl" className="p-10 text-center font-black text-rose-700">هذه الصفحة مخصصة للمشرف.</main>;
  }

  return (
    <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 px-3 py-5 sm:px-6 sm:py-7">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl sm:p-8">
          <div className="flex items-center gap-2 text-emerald-300">
            <ShieldCheck size={18}/>
            <span className="text-xs font-black">SUPERVISOR WORKSPACE</span>
          </div>
          <h1 className="mt-2 text-2xl font-black sm:text-4xl">لوحة المشرف</h1>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-7 text-slate-300">
            نظرة تشغيلية على نطاقات الإشراف الفعلية، مع الانتقال إلى التقارير والتدخلات دون توسيع الصلاحية من الواجهة.
          </p>
        </header>

        {error ? <div role="alert" className="rounded-2xl bg-rose-50 p-4 font-bold text-rose-700">{error}</div> : null}

        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Building2 size={19} className="text-indigo-600"/>
            <h2 className="font-black">نطاقات الإشراف</h2>
          </div>
          {busy ? (
            <div className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-500"><Loader2 size={16} className="animate-spin"/>جاري تحميل النطاقات...</div>
          ) : contexts.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {contexts.map((context) => (
                <article key={context.schoolId} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="font-black text-slate-900">{context.schoolName}</div>
                  <div className="mt-2 text-xs font-bold text-slate-500">
                    {context.source === 'scope' ? 'نطاق إشراف مفوض' : 'نطاق حساب فعال'}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {context.permissions.slice(0, 4).map((permission) => (
                      <span key={permission} className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500">{permission}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
              لا توجد مدرسة أو فصول مسندة لهذا الحساب حاليًا.
            </div>
          )}
        </section>

        <section aria-label="اختصارات المشرف" className="grid gap-3 md:grid-cols-3">
          {actions.map(({ to, title, text, icon: Icon, tone }) => (
            <Link key={to} to={to} className="group rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className={'flex h-11 w-11 items-center justify-center rounded-2xl ' + tone}><Icon size={21}/></div>
              <h2 className="mt-4 font-black text-slate-900">{title}</h2>
              <p className="mt-2 min-h-12 text-xs font-bold leading-6 text-slate-500">{text}</p>
              <div className="mt-4 inline-flex items-center gap-1 text-xs font-black text-indigo-700">فتح <ChevronLeft size={15}/></div>
            </Link>
          ))}
        </section>

        <section className="rounded-3xl border border-indigo-100 bg-indigo-50 p-5">
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 shrink-0 text-indigo-700" size={20}/>
            <p className="text-sm font-bold leading-7 text-indigo-900">
              هذه اللوحة لا تنشئ بيانات أكاديمية جديدة؛ هي مدخل إلى النطاقات والتقارير والتدخلات التي يتحقق منها الخادم في كل طلب.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
