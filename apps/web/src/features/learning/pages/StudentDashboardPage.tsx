import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  ChevronLeft,
  ClipboardCheck,
  Copy,
  FileText,
  GraduationCap,
  Headphones,
  Home,
  LogOut,
  Menu,
  Route as RouteIcon,
  Sparkles,
  Star,
  Target,
  Wrench,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';

// The original dashboard menu is the presentation contract:
// almeaacodax/pages/Dashboard.tsx at bf7281fc9fe34165a070e3d2d58f65f91b4a3ef7.
// Null destinations are original features that have NOT been ported. Never
// route them to an unrelated screen or expose a misleading clickable control.
type StudentNavItem = {
  id: string;
  label: string;
  to: string | null;
  icon: typeof Home;
  tone: string;
};

const items: StudentNavItem[] = [
  { id: 'paths', label: 'مساراتي', to: '/learning', icon: RouteIcon, tone: 'bg-sky-100 text-sky-700' },
  { id: 'my-courses', label: 'دوراتي', to: '/learning?tab=courses', icon: BookOpen, tone: 'bg-violet-100 text-violet-700' },
  { id: 'sessions', label: 'جلساتي', to: null, icon: CalendarDays, tone: 'bg-emerald-100 text-emerald-700' },
  { id: 'smart-path', label: 'المسار الذكي', to: null, icon: Brain, tone: 'bg-emerald-100 text-emerald-700' },
  { id: 'plan', label: 'خططي', to: '/plan', icon: CalendarDays, tone: 'bg-emerald-100 text-emerald-700' },
  { id: 'reports', label: 'تقاريري', to: '/reports', icon: BarChart3, tone: 'bg-cyan-100 text-cyan-700' },
  { id: 'quizzes', label: 'الاختبارات السابقة', to: '/assessment-results', icon: FileText, tone: 'bg-rose-100 text-rose-700' },
  { id: 'school-tests', label: 'الاختبارات المدرسية', to: '/assessment-assignments', icon: Target, tone: 'bg-sky-100 text-sky-700' },
  { id: 'mock-exams', label: 'الاختبارات المحاكية', to: null, icon: Star, tone: 'bg-rose-100 text-rose-700' },
  { id: 'favorites', label: 'أسئلتي للمراجعة', to: '/review', icon: BookOpen, tone: 'bg-violet-100 text-violet-700' },
  { id: 'flashcards', label: 'بطاقات التذكر', to: null, icon: Copy, tone: 'bg-violet-100 text-violet-700' },
  { id: 'qa', label: 'سؤال وجواب', to: null, icon: Headphones, tone: 'bg-orange-100 text-orange-700' },
  { id: 'requests', label: 'طلباتي', to: null, icon: FileText, tone: 'bg-orange-100 text-orange-700' },
];

const groups: Array<{ id: string; title: string | null; tone: string; icon: typeof Home | null; ids: string[] }> = [
  {
    id: 'learning',
    title: null,
    icon: null,
    tone: 'border-slate-100 bg-white/95',
    ids: ['paths', 'my-courses', 'sessions'],
  },
  {
    id: 'journey',
    title: 'رحلتي التعليمية',
    icon: GraduationCap,
    tone: 'border-emerald-200/80 bg-gradient-to-b from-emerald-100/90 to-emerald-50/80 text-emerald-800',
    ids: ['smart-path', 'plan', 'reports'],
  },
  {
    id: 'exams',
    title: 'الاختبارات',
    icon: ClipboardCheck,
    tone: 'border-rose-200/80 bg-gradient-to-b from-rose-100/90 to-rose-50/80 text-rose-800',
    ids: ['quizzes', 'school-tests', 'mock-exams'],
  },
  {
    id: 'tools',
    title: 'الأدوات',
    icon: Wrench,
    tone: 'border-violet-200/80 bg-gradient-to-b from-violet-100/90 to-violet-50/80 text-violet-800',
    ids: ['favorites', 'flashcards'],
  },
  {
    id: 'support',
    title: 'الدعم',
    icon: Headphones,
    tone: 'border-orange-200/80 bg-gradient-to-b from-orange-100/90 to-orange-50/80 text-orange-800',
    ids: ['qa', 'requests'],
  },
];

export function StudentDashboardPage() {
  const { user, loading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');

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

  function navItem(item: StudentNavItem) {
    const Icon = item.icon;
    const children = (
      <>
        <span className="flex min-w-0 items-center gap-3">
          <span className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ' + item.tone}>
            <Icon size={17} />
          </span>
          <span className="truncate">{item.label}</span>
        </span>
        <ChevronLeft size={15} className="shrink-0 text-gray-400" />
      </>
    );
    const className = 'flex w-full items-center justify-between rounded-2xl border border-transparent px-3 py-2 text-sm font-bold text-gray-800 transition hover:border-white/80 hover:bg-white/80';
    return item.to ? (
      <Link key={item.id} to={item.to} onClick={() => setSidebarOpen(false)} className={className} data-testid={'student-menu-item-' + item.id}>
        {children}
      </Link>
    ) : (
      <span
        key={item.id}
        aria-disabled="true"
        data-testid={'student-menu-item-' + item.id}
        className={className + ' cursor-not-allowed opacity-50'}
      >
        {children}
      </span>
    );
  }

  async function logout() {
    if (logoutBusy) return;
    setLogoutBusy(true);
    setLogoutError('');
    try {
      await signOut();
      window.location.assign('/?auth=login');
    } catch {
      // Keep the student on this screen if the server rejects the logout.
      setLogoutError('تعذر تسجيل الخروج، حاول مرة أخرى.');
      setLogoutBusy(false);
    }
  }

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
          className={'fixed bottom-0 right-0 top-20 z-40 h-[calc(100vh-5rem)] w-72 max-w-[calc(100vw-1rem)] overflow-y-auto border-l border-gray-200 bg-white transition-transform duration-300 lg:sticky lg:translate-x-0 ' + (sidebarOpen ? 'translate-x-0' : 'translate-x-full')}
        >
          <div className="p-6">
            <div className="mb-8 flex items-center gap-3">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="h-12 w-12 rounded-full border-2 border-amber-100 object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-100 bg-indigo-50 text-sm font-black text-indigo-700">
                  {initials || 'ط'}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold text-gray-800">{user.name}</h2>
                <span className="text-xs text-gray-500">لوحة تحكم الطالب</span>
              </div>
            </div>

            <nav aria-label="تنقل لوحة الطالب" className="space-y-1">
              <div data-testid="student-menu-overview" className="mb-2.5">
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

              {groups.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <section
                    key={group.id}
                    data-testid={'student-menu-group-' + group.id}
                    className={'mt-3 rounded-[22px] border p-2.5 shadow-sm ' + group.tone}
                  >
                    {group.title ? (
                      <div className="flex items-center gap-2 px-2.5 pb-2 pt-1 text-base font-black">
                        {GroupIcon ? <GroupIcon size={21} aria-hidden="true" /> : null}
                        <span>{group.title}</span>
                      </div>
                    ) : null}
                    <div className={group.title ? 'space-y-1 rounded-[16px] bg-white/60 p-1.5 ring-1 ring-white/70' : 'space-y-1'}>
                      {group.ids.map((id) => items.find((item) => item.id === id)).filter((item): item is StudentNavItem => Boolean(item)).map(navItem)}
                    </div>
                  </section>
                );
              })}
            </nav>
            <div className="mt-6 border-t border-gray-100 pt-4">
              <button
                type="button"
                data-logout-explicit="true"
                disabled={logoutBusy}
                onClick={() => void logout()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] border border-red-200 bg-gradient-to-l from-red-100 to-rose-50 px-4 py-2.5 text-sm font-black text-red-800 shadow-sm hover:from-red-200 hover:to-rose-100 disabled:opacity-60"
              >
                <LogOut size={16} />
                تسجيل الخروج
              </button>
              {logoutError ? <p role="alert" className="mt-2 text-xs font-bold text-red-700">{logoutError}</p> : null}
            </div>
          </div>
        </aside>

        <section id="overview" className="min-w-0 flex-1 px-3 pb-20 pt-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl space-y-4">
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
                  <h2 className="text-base font-black text-gray-900 sm:text-lg">ابدأ بقياس قصير</h2>
                  <p className="mt-1 text-xs font-bold text-gray-500 sm:text-sm">قياس بسيط يساعدنا نحدد لك الخطوة التالية.</p>
                </div>
                <Link
                  to="/assessments"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700"
                >
                  ابدأ القياس
                  <ChevronLeft size={16} />
                </Link>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
