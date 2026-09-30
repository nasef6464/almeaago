import {
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  ChevronLeft,
  ClipboardCheck,
  Home,
  Menu,
  Radio,
  Route as RouteIcon,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  tone: string;
};

const groups: Array<{ id: string; title: string; tone: string; items: NavItem[] }> = [
  {
    id: 'learning',
    title: 'التعلم',
    tone: 'border-emerald-200/80 bg-gradient-to-b from-emerald-100/90 to-emerald-50/80 text-emerald-800',
    items: [
      { to: '/learning', label: 'مساراتي ودوراتي', icon: BookOpen, tone: 'bg-violet-100 text-violet-700' },
      { to: '/plan', label: 'خططي', icon: CalendarDays, tone: 'bg-emerald-100 text-emerald-700' },
      { to: '/reports', label: 'تقاريري', icon: BarChart3, tone: 'bg-cyan-100 text-cyan-700' },
    ],
  },
  {
    id: 'exams',
    title: 'الاختبارات',
    tone: 'border-rose-200/80 bg-gradient-to-b from-rose-100/90 to-rose-50/80 text-rose-800',
    items: [
      { to: '/assessments', label: 'اختبارات المنصة', icon: ClipboardCheck, tone: 'bg-rose-100 text-rose-700' },
      { to: '/assessment-assignments', label: 'الاختبارات الموجهة', icon: Target, tone: 'bg-sky-100 text-sky-700' },
      { to: '/assessment-results', label: 'اختباراتي ونتائجي', icon: RouteIcon, tone: 'bg-amber-100 text-amber-700' },
    ],
  },
  {
    id: 'tools',
    title: 'الأدوات',
    tone: 'border-violet-200/80 bg-gradient-to-b from-violet-100/90 to-violet-50/80 text-violet-800',
    items: [
      { to: '/review', label: 'أسئلتي للمراجعة', icon: BrainCircuit, tone: 'bg-violet-100 text-violet-700' },
      { to: '/classroom/join', label: 'الفصل الذكي', icon: Radio, tone: 'bg-indigo-100 text-indigo-700' },
    ],
  },
  {
    id: 'support',
    title: 'الدعم والمتابعة',
    tone: 'border-orange-200/80 bg-gradient-to-b from-orange-100/90 to-orange-50/80 text-orange-800',
    items: [
      { to: '/notifications', label: 'الإشعارات', icon: Bell, tone: 'bg-orange-100 text-orange-700' },
    ],
  },
];

const overviewCards: NavItem[] = [
  { to: '/learning', label: 'مساحة التعلم', icon: BookOpen, tone: 'bg-indigo-50 text-indigo-700' },
  { to: '/assessments', label: 'الاختبارات', icon: ClipboardCheck, tone: 'bg-blue-50 text-blue-700' },
  { to: '/review', label: 'المراجعة والإتقان', icon: BrainCircuit, tone: 'bg-purple-50 text-purple-700' },
  { to: '/plan', label: 'الخطة الدراسية', icon: CalendarDays, tone: 'bg-amber-50 text-amber-700' },
];

export function StudentDashboardPage() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return <main dir="rtl" className="p-10 text-center font-black">جاري تحميل لوحة الطالب...</main>;
  }
  if (!user || !user.roles.includes('student')) {
    return <main dir="rtl" className="p-10 text-center font-black text-rose-700">هذه الصفحة مخصصة للطالب.</main>;
  }

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');

  const navItem = (item: NavItem) => {
    const Icon = item.icon;
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={() => setSidebarOpen(false)}
        className="flex w-full items-center justify-between rounded-2xl border border-transparent px-3 py-2 text-sm font-bold text-gray-800 transition hover:border-white/80 hover:bg-white/80"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ' + item.tone}>
            <Icon size={17} />
          </span>
          <span className="truncate">{item.label}</span>
        </span>
        <ChevronLeft size={15} className="shrink-0 text-gray-400" />
      </Link>
    );
  };

  return (
    <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-gray-50">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="إغلاق قائمة لوحة الطالب"
          className="fixed inset-0 z-30 bg-slate-950/25 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <button
        type="button"
        aria-label={sidebarOpen ? 'إغلاق قائمة لوحة الطالب' : 'فتح قائمة لوحة الطالب'}
        className="fixed bottom-6 left-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg lg:hidden"
        onClick={() => setSidebarOpen((value) => !value)}
      >
        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <div className="mx-auto flex max-w-[1500px] items-start">
        <aside
          aria-label="تنقل لوحة الطالب"
          className={`fixed bottom-0 right-0 top-20 z-40 h-[calc(100vh-5rem)] w-72 max-w-[calc(100vw-1rem)] overflow-y-auto border-l border-gray-200 bg-white transition-transform duration-300 lg:sticky lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="p-5">
            <div className="mb-6 flex items-center gap-3">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="h-12 w-12 rounded-full border-2 border-amber-100 object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-100 bg-indigo-50 text-sm font-black text-indigo-700">
                  {initials || 'ط'}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-sm font-black text-gray-900">{user.name}</h2>
                <span className="text-xs font-bold text-gray-500">لوحة تحكم الطالب</span>
              </div>
            </div>

            <nav className="space-y-3">
              <div data-testid="student-menu-overview">
                <a
                  href="#overview"
                  onClick={() => setSidebarOpen(false)}
                  className="flex w-full items-center justify-between rounded-[20px] border border-sky-200 bg-gradient-to-l from-sky-200/90 to-blue-100/90 px-3.5 py-2.5 text-sm font-black text-indigo-950 shadow-sm"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/65 text-indigo-800 shadow-sm">
                      <Home size={18} />
                    </span>
                    نظرة عامة
                  </span>
                  <ChevronLeft size={18} />
                </a>
              </div>

              {groups.map((group) => (
                <section
                  key={group.id}
                  data-testid={`student-menu-group-${group.id}`}
                  className={'rounded-[22px] border p-2.5 shadow-sm ' + group.tone}
                >
                  <div className="px-2.5 pb-2 pt-1 text-base font-black">{group.title}</div>
                  <div className="space-y-1 rounded-[16px] bg-white/60 p-1.5 ring-1 ring-white/70">
                    {group.items.map(navItem)}
                  </div>
                </section>
              ))}
            </nav>
          </div>
        </aside>

        <section id="overview" className="min-w-0 flex-1 px-3 pb-20 pt-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-4">
            <header className="flex flex-col justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm sm:flex-row sm:items-center sm:p-4">
              <div className="flex items-center gap-3">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full border-2 border-amber-100 object-cover" />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-amber-100 bg-indigo-50 text-sm font-black text-indigo-700">
                    {initials || 'ط'}
                  </div>
                )}
                <div>
                  <h1 className="text-lg font-black text-gray-900 sm:text-xl">مرحباً يا بطل! 👋</h1>
                  <p className="mt-0.5 text-xs font-bold text-gray-500">جاهز تحقق أهدافك اليوم؟</p>
                </div>
              </div>
              <Link
                to="/notifications"
                className="inline-flex self-start items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-black text-orange-700 sm:self-auto"
              >
                <Bell size={15} />
                الإشعارات
              </Link>
            </header>

            <section
              data-testid="student-today-focus"
              className="rounded-3xl border border-emerald-100 bg-gradient-to-l from-emerald-50 via-white to-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                    <Sparkles size={13} />
                    خطوتك اليوم
                  </div>
                  <h2 className="text-base font-black text-gray-900 sm:text-lg">ابدأ من مساحة التعلم، ثم دع نتائجك تحدد الخطوة التالية</h2>
                  <p className="mt-1 text-xs font-bold leading-6 text-gray-500 sm:text-sm">
                    لا نعرض أرقامًا أو توصيات مختلقة هنا؛ النتائج والمراجعة والخطة والتقارير تعتمد على بياناتك الفعلية داخل خدمات V2.
                  </p>
                </div>
                <Link
                  to="/learning"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700"
                >
                  افتح مساحة التعلم
                  <ChevronLeft size={16} />
                </Link>
              </div>
            </section>

            <section aria-label="اختصارات رحلة الطالب" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {overviewCards.map(({ to, label, icon: Icon, tone }) => (
                <Link
                  key={to}
                  to={to}
                  className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-100 hover:shadow-md"
                >
                  <div className={'flex h-10 w-10 items-center justify-center rounded-xl ' + tone}><Icon size={19} /></div>
                  <h2 className="mt-3 text-sm font-black text-slate-900">{label}</h2>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-black text-indigo-700">
                    فتح
                    <ChevronLeft size={14} />
                  </div>
                </Link>
              ))}
            </section>

            <section className="grid gap-3 md:grid-cols-3">
              <Link to="/assessment-assignments" className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                <Target className="text-sky-700" size={20} />
                <h2 className="mt-2 text-sm font-black text-sky-950">اختبارات موجهة لك</h2>
                <p className="mt-1 text-xs font-bold leading-6 text-sky-800/70">تكليفات المدرسة أو المعلم ضمن الصلاحية الفعلية.</p>
              </Link>
              <Link to="/reports" className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <BarChart3 className="text-emerald-700" size={20} />
                <h2 className="mt-2 text-sm font-black text-emerald-950">تقرير الأداء</h2>
                <p className="mt-1 text-xs font-bold leading-6 text-emerald-800/70">ملخص أدائك والمهارات التي تحتاج متابعة من Reporting V2.</p>
              </Link>
              <Link to="/notifications" className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                <Bell className="text-orange-700" size={20} />
                <h2 className="mt-2 text-sm font-black text-orange-950">آخر التنبيهات</h2>
                <p className="mt-1 text-xs font-bold leading-6 text-orange-800/70">افتح صندوق الإشعارات بدل عرض عدّاد غير موثوق في الواجهة.</p>
              </Link>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
