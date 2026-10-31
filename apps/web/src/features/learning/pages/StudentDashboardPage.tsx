import {
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  Calculator,
  CalendarDays,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Home,
  Menu,
  Radio,
  Route as RouteIcon,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { assessmentAssignmentClient, type LearnerAssessmentAssignment } from '../../assessment/api/assessment-assignment-client';
import { contentClient } from '../../content/api/content-client';
import type { TaxonomyPath } from '../../content/api/content-types';
import { QiyasCalculatorModal } from '../components/QiyasCalculatorModal';
import { SmartLearningPathWidget } from '../components/SmartLearningPathWidget';

type NavItem = {
  to?: string;
  onClick?: () => void;
  label: string;
  icon: typeof Home;
  tone: string;
};

export function StudentDashboardPage() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [paths, setPaths] = useState<TaxonomyPath[]>([]);
  const [assignments, setAssignments] = useState<LearnerAssessmentAssignment[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoadingData(true);

    Promise.allSettled([
      contentClient.taxonomyCore(controller.signal),
      assessmentAssignmentClient.mine(1, 4, controller.signal),
    ]).then(([taxResult, assignResult]) => {
      if (!active) return;
      if (taxResult.status === 'fulfilled') {
        setPaths(taxResult.value.paths || []);
      }
      if (assignResult.status === 'fulfilled') {
        setAssignments(assignResult.value.items || []);
      }
      setLoadingData(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const copyParentCode = useCallback(() => {
    const code = String(user?.id || 'ALM892').slice(-6).toUpperCase();
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }, [user?.id]);

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
        { onClick: () => setShowCalculator(true), label: 'حاسبة النسبة الموزونة', icon: Calculator, tone: 'bg-indigo-100 text-indigo-700' },
        { to: '/review', label: 'أسئلتي للمراجعة', icon: BrainCircuit, tone: 'bg-violet-100 text-violet-700' },
        { to: '/classroom/join', label: 'الفصل الذكي', icon: Radio, tone: 'bg-sky-100 text-sky-700' },
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

  const overviewCards: Array<{ to: string; label: string; icon: typeof Home; tone: string }> = [
    { to: '/learning', label: 'مساحة التعلم', icon: BookOpen, tone: 'bg-indigo-50 text-indigo-700' },
    { to: '/assessments', label: 'الاختبارات', icon: ClipboardCheck, tone: 'bg-blue-50 text-blue-700' },
    { to: '/review', label: 'المراجعة والإتقان', icon: BrainCircuit, tone: 'bg-purple-50 text-purple-700' },
    { to: '/plan', label: 'الخطة الدراسية', icon: CalendarDays, tone: 'bg-amber-50 text-amber-700' },
  ];

  const defaultTrackProgress: Record<string, number> = {
    QUDRAT: 65,
    TAHSILI: 40,
    NAFES: 85,
  };

  const navItem = (item: NavItem) => {
    const Icon = item.icon;
    if (item.onClick) {
      return (
        <button
          key={item.label}
          type="button"
          onClick={() => {
            setSidebarOpen(false);
            item.onClick?.();
          }}
          className="flex w-full items-center justify-between rounded-2xl border border-transparent px-3 py-2 text-sm font-bold text-gray-800 transition hover:border-white/80 hover:bg-white/80 text-right"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ' + item.tone}>
              <Icon size={17} />
            </span>
            <span className="truncate">{item.label}</span>
          </span>
          <ChevronLeft size={15} className="shrink-0 text-gray-400" />
        </button>
      );
    }
    return (
      <Link
        key={item.to}
        to={item.to || '/'}
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

            <nav aria-label="تنقل لوحة الطالب" className="space-y-3">
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
          <div className="mx-auto max-w-6xl space-y-5">
            {/* 1. Header & Streak Banner */}
            <header className="flex flex-col justify-between gap-3 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
              <div className="flex items-center gap-3.5">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full border-2 border-amber-100 object-cover" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-amber-100 bg-indigo-50 text-base font-black text-indigo-700">
                    {initials || 'ط'}
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-black text-gray-900 sm:text-2xl">مرحباً يا بطل! 👋</h1>
                  <p className="mt-0.5 text-xs font-bold text-gray-500">جاهز تحقق أهدافك وتتفوق اليوم؟</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                <div className="flex items-center gap-2.5 rounded-2xl border border-orange-100 bg-orange-50 px-3.5 py-2 shadow-xs">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-base shadow-xs">🔥</div>
                  <div>
                    <div className="text-[10px] font-black text-orange-600">شريط الاستمرارية</div>
                    <div className="text-sm font-black text-orange-700 leading-tight">5 أيام متتالية</div>
                  </div>
                </div>
                <Link
                  to="/notifications"
                  className="inline-flex items-center gap-2 rounded-2xl border border-orange-100 bg-orange-50/80 px-3.5 py-2.5 text-xs font-black text-orange-700 hover:bg-orange-100 transition"
                >
                  <Bell size={16} />
                  <span>الإشعارات</span>
                </Link>
              </div>
            </header>

            {/* 2. Student Today Focus */}
            <section
              data-testid="student-today-focus"
              className="rounded-3xl border border-emerald-100 bg-gradient-to-l from-emerald-50 via-white to-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                    <Sparkles size={14} />
                    <span>خطوتك المقترحة اليوم</span>
                  </div>
                  <h2 className="text-lg font-black text-gray-900 sm:text-xl">تابع خطتك في مساحة التعلم الذكية</h2>
                  <p className="mt-1 text-xs font-medium leading-6 text-gray-600 sm:text-sm">
                    تأسيس مهارات، تدريبات ذكية مكثفة واختبارات محاكية تقيس مستواك وتحدد خطوتك التالية تلقائيًا.
                  </p>
                </div>
                <Link
                  to="/learning"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white hover:bg-emerald-700 shadow-sm transition"
                >
                  <span>افتح مساحة التعلم</span>
                  <ChevronLeft size={16} />
                </Link>
              </div>
            </section>

            {/* 3. Student Tools: Qiyas Calculator & Parent Link Code */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div
                onClick={() => setShowCalculator(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setShowCalculator(true);
                  }
                }}
                className="group rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-indigo-50/40 to-white p-4 shadow-xs hover:border-indigo-200 hover:shadow-md transition cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <Calculator size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-gray-900 text-sm sm:text-base truncate">حاسبة النسبة الموزونة</h3>
                      <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-black text-indigo-700">قياس</span>
                    </div>
                    <p className="text-xs text-gray-500 font-medium truncate mt-0.5">احسب نسبتك الموزونة وفرصتك بالجامعات السعودية.</p>
                  </div>
                </div>
                <div className="text-indigo-600 bg-indigo-100/70 p-2 rounded-xl shrink-0 mr-2 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ChevronLeft size={18} />
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-white p-4 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-black shrink-0 text-lg shadow-xs">
                    🔗
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-gray-900 text-sm sm:text-base truncate">كود ربط ولي الأمر</h3>
                    <p className="text-xs text-gray-500 font-medium truncate mt-0.5">شاركه مع ولي أمرك لمتابعة تقدمك ونتائجك.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-purple-100 shadow-xs shrink-0 mr-2">
                  <span className="font-mono font-black text-indigo-900 text-sm tracking-wider">
                    {String(user?.id || 'ALM892').slice(-6).toUpperCase()}
                  </span>
                  <button
                    type="button"
                    onClick={copyParentCode}
                    className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 p-1.5 rounded-lg flex items-center gap-1 text-xs font-black transition-colors"
                    title="نسخ الكود"
                  >
                    <Copy size={14} />
                    {copiedCode && <span className="text-[10px] text-emerald-600 font-black">تم النسخ ✓</span>}
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Smart Learning Path Widget */}
            <SmartLearningPathWidget loading={loadingData} />

            {/* 5. My Paths Progress (أكمل مساراتك) */}
            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-900">أكمل مساراتك التعليمية</h3>
                    <p className="text-xs font-bold text-gray-500">تابع تقدمك بالتأسيس والدورات والتدريبات</p>
                  </div>
                </div>
                <Link to="/learning" className="text-xs font-black text-indigo-600 hover:text-indigo-800">
                  عرض كل المسارات ←
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {paths.length > 0 ? (
                  paths.slice(0, 3).map((path) => {
                    const progress = defaultTrackProgress[path.code] || 50;
                    return (
                      <div
                        key={path.id}
                        className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-gray-50/60 p-4 transition hover:border-indigo-100 hover:bg-white hover:shadow-xs"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="rounded-lg bg-indigo-100/70 px-2 py-0.5 text-xs font-black text-indigo-800">
                              {path.code}
                            </span>
                            <span className="text-xs font-black text-indigo-600">{progress}%</span>
                          </div>
                          <h4 className="text-sm font-black text-gray-900">{path.name}</h4>
                          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        <Link
                          to={`/learning?pathId=${path.id}`}
                          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-gray-200 py-2 text-xs font-black text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition"
                        >
                          <span>متابعة التعلم</span>
                          <ChevronLeft size={14} />
                        </Link>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-6 text-center text-xs font-bold text-gray-400">
                    جاري تحميل المسارات...
                  </div>
                )}
              </div>
            </section>

            {/* 6. Assigned Quizzes (الاختبارات الموجهة لك) */}
            {assignments.length > 0 && (
              <section className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                      <ClipboardList size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-gray-900">الاختبارات والتكليفات الموجهة لك</h3>
                      <p className="text-xs font-bold text-gray-500">مهام دراسية موجهة من المدرسة أو المعلم</p>
                    </div>
                  </div>
                  <Link to="/assessment-assignments" className="text-xs font-black text-sky-700 hover:text-sky-900">
                    عرض الكل ←
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {assignments.map((item) => (
                    <div
                      key={item.assignmentId}
                      className="flex flex-col justify-between rounded-2xl border border-sky-100 bg-sky-50/30 p-4"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-black text-sky-800">
                            موجّه لك
                          </span>
                          <span className="text-[11px] font-bold text-gray-500">
                            محاولات: {item.attemptCount} / {item.maxAttempts}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-gray-900">{item.title}</h4>
                        {item.supervisorMessage && (
                          <p className="mt-1 text-xs text-gray-500">{item.supervisorMessage}</p>
                        )}
                      </div>
                      <Link
                        to={`/assessments/${item.assessmentId}/start`}
                        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 py-2 text-xs font-black text-white hover:bg-sky-700 transition"
                      >
                        <span>بدء الاختبار</span>
                        <ChevronLeft size={14} />
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 7. Overview Quick Shortcuts */}
            <section aria-label="اختصارات رحلة الطالب" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {overviewCards.map(({ to, label, icon: Icon, tone }) => (
                <Link
                  key={to}
                  to={to}
                  className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-100 hover:shadow-md"
                >
                  <div className={'flex h-10 w-10 items-center justify-center rounded-xl ' + tone}>
                    <Icon size={19} />
                  </div>
                  <h2 className="mt-3 text-sm font-black text-slate-900">{label}</h2>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-black text-indigo-700">
                    <span>فتح</span>
                    <ChevronLeft size={14} />
                  </div>
                </Link>
              ))}
            </section>

            {/* 8. Additional Quick Links */}
            <section className="grid gap-3 md:grid-cols-3">
              <Link to="/assessment-assignments" className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 hover:shadow-xs transition">
                <Target className="text-sky-700" size={20} />
                <h2 className="mt-2 text-sm font-black text-sky-950">اختبارات موجهة لك</h2>
                <p className="mt-1 text-xs font-bold leading-6 text-sky-800/70">تكليفات المدرسة أو المعلم ضمن الصلاحية الفعلية.</p>
              </Link>
              <Link to="/reports" className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 hover:shadow-xs transition">
                <BarChart3 className="text-emerald-700" size={20} />
                <h2 className="mt-2 text-sm font-black text-emerald-950">تقرير الأداء</h2>
                <p className="mt-1 text-xs font-bold leading-6 text-emerald-800/70">ملخص أدائك والمهارات التي تحتاج متابعة من Reporting V2.</p>
              </Link>
              <Link to="/notifications" className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4 hover:shadow-xs transition">
                <Bell className="text-orange-700" size={20} />
                <h2 className="mt-2 text-sm font-black text-orange-950">آخر التنبيهات</h2>
                <p className="mt-1 text-xs font-bold leading-6 text-orange-800/70">افتح صندوق الإشعارات لمتابعة التحديثات والدرجات.</p>
              </Link>
            </section>
          </div>
        </section>
      </div>

      {/* Qiyas Calculator Modal */}
      <QiyasCalculatorModal
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
      />
    </main>
  );
}
