import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  ChevronLeft,
  ClipboardList,
  FileText,
  Loader2,
  ShieldCheck,
  Target,
  Users,
  Video,
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
  const schoolCount = contexts.length;
  const permissionCount = new Set(contexts.flatMap((item) => item.permissions)).size;
  const moduleCount = new Set(contexts.flatMap((item) => item.modules)).size;

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

        <section aria-label="ملخص نطاق المشرف" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <article className="rounded-2xl border bg-white p-4 shadow-sm"><Building2 size={19} className="text-indigo-700"/><div className="mt-2 text-xs font-bold text-slate-500">نطاقات المدرسة</div><div className="mt-1 text-2xl font-black">{schoolCount}</div></article>
          <article className="rounded-2xl border bg-white p-4 shadow-sm"><ShieldCheck size={19} className="text-emerald-700"/><div className="mt-2 text-xs font-bold text-slate-500">الصلاحيات الفعلية</div><div className="mt-1 text-2xl font-black">{permissionCount}</div></article>
          <article className="rounded-2xl border bg-white p-4 shadow-sm"><Target size={19} className="text-amber-700"/><div className="mt-2 text-xs font-bold text-slate-500">الوحدات المفعلة</div><div className="mt-1 text-2xl font-black">{moduleCount}</div></article>
          <article className="rounded-2xl border bg-white p-4 shadow-sm"><Users size={19} className="text-sky-700"/><div className="mt-2 text-xs font-bold text-slate-500">حالة النطاق</div><div className="mt-1 text-sm font-black">{busy?'جار التحقق':schoolCount?'مفوض من الخادم':'غير مسند'}</div></article>
        </section>

        <nav aria-label="أقسام لوحة المشرف" className="rounded-3xl border bg-white p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
            <span className="rounded-xl bg-indigo-600 px-3 py-2.5 text-center text-xs font-black text-white">نظرة عامة</span>
            <span className="rounded-xl bg-slate-50 px-3 py-2.5 text-center text-xs font-black text-slate-700"><Users size={15} className="mx-auto mb-1"/>الطلاب</span>
            <Link to="/supervisor-dashboard/interventions" className="rounded-xl bg-slate-50 px-3 py-2.5 text-center text-xs font-black text-slate-700"><Target size={15} className="mx-auto mb-1"/>المهارات</Link>
            <Link to="/reports" className="rounded-xl bg-slate-50 px-3 py-2.5 text-center text-xs font-black text-slate-700"><FileText size={15} className="mx-auto mb-1"/>التقارير</Link>
            <span aria-disabled="true" className="rounded-xl bg-slate-50 px-3 py-2.5 text-center text-xs font-black text-slate-400"><Video size={15} className="mx-auto mb-1"/>الحصص المباشرة</span>
            <span aria-disabled="true" className="rounded-xl bg-slate-50 px-3 py-2.5 text-center text-xs font-black text-slate-400"><ClipboardList size={15} className="mx-auto mb-1"/>الاختبارات</span>
            <span aria-disabled="true" className="rounded-xl bg-slate-50 px-3 py-2.5 text-center text-xs font-black text-slate-400"><BookOpen size={15} className="mx-auto mb-1"/>المراقبة الحية</span>
          </div>
          <p className="mt-3 text-[11px] font-bold leading-5 text-slate-400">الأقسام الرمادية تحفظ خريطة Legacy البصرية فقط إلى أن يوجد لها owner flow قانوني في V2؛ لا تُعرض بيانات أو عمليات وهمية.</p>
        </nav>

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
