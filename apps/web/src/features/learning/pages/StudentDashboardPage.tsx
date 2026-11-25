import {
  BarChart3,
  Bell,
  Bookmark,
  BookOpen,
  Brain,
  Calculator,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Copy,
  FileText,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Route as RouteIcon,
  Star,
  Target,
  Wrench,
  X,
} from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { assessmentAssignmentClient, type LearnerAssessmentAssignment } from '../../assessment/api/assessment-assignment-client';
import { contentClient } from '../../content/api/content-client';
import type { TaxonomyPath } from '../../content/api/content-types';
import { QiyasCalculatorModal } from '../components/QiyasCalculatorModal';
import { ProgressBar } from '../components/ProgressBar';
import { StudentNextActionStrip } from '../components/StudentNextActionStrip';
import { useStudentExperience } from '../navigation';
import { PathsTab } from './dashboard/PathsTab';
import { MyCoursesTab } from './dashboard/MyCoursesTab';
import { SessionsTab } from './dashboard/SessionsTab';
import { SmartPathTab } from './dashboard/SmartPathTab';
import { MockExamsTab } from './dashboard/MockExamsTab';
import { FlashcardsTab } from './dashboard/FlashcardsTab';
import { QATab } from './dashboard/QATab';
import { MyRequestsTab } from './dashboard/MyRequestsTab';
import { resolvePathProgress, type DashboardPath } from './dashboard/pathProgressProjection';
const ReportsPage = lazy(() => import('../../reporting/pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
import { StudyPlanPage } from './StudyPlanPage';
import { ReviewLibraryPage } from './ReviewLibraryPage';
import { AssessmentAssignmentsPage } from '../../assessment/pages/AssessmentAssignmentsPage';
import { AssessmentAvailabilityPage } from '../../assessment/pages/AssessmentAvailabilityPage';
import { AssessmentResultsPage } from '../../assessment/pages/AssessmentResultsPage';

type NavItem = {
  tab: string;
  label: string;
  description?: string;
  icon: typeof LayoutDashboard;
  tone: string;
};

const tabAliases: Record<string, string> = {
  exams: 'quizzes',
  saher: 'quizzes',
  results: 'quizzes',
  assignments: 'school-tests',
  assessments: 'mock-exams',
  review: 'favorites',
};

const INITIAL_PATHS: TaxonomyPath[] = [
  {
    id: '018f0000-0000-7000-8000-000000000030',
    code: 'QUDRAT',
    name: 'مسار القدرات العامة',
    description: 'تأسيس وتدريب شامل لاختبار القدرات العامة (كمي ولفظي)',
    sortOrder: 1,
  },
  {
    id: 'd242dd63-2c42-54e1-81da-37322e5234a7',
    code: 'TAHSILI',
    name: 'مسار التحصيلي العلمي',
    description: 'تأسيس واختبارات محاكية لاختبار التحصيلي لطلاب العلمي',
    sortOrder: 2,
  },
  {
    id: 'a5d9b9ec-625e-5eb1-87b9-0cd8f6073a44',
    code: 'NAFES',
    name: 'مسار اختبار نافس الوطني',
    description: 'اختبارات محاكية ومراجعات لمعايير الاختبارات الوطنية نافس',
    sortOrder: 3,
  },
];

export function StudentDashboardPage() {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'overview';
  const tab = Object.hasOwn(tabAliases, requestedTab) ? tabAliases[requestedTab] : requestedTab;
  const { enrolledPaths } = useStudentExperience();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [paths, setPaths] = useState<TaxonomyPath[]>(INITIAL_PATHS);
  const [assignments, setAssignments] = useState<LearnerAssessmentAssignment[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (loading || !user || !user.roles.includes('student')) {
      setLoadingData(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setLoadingData(true);

    Promise.allSettled([
      contentClient.taxonomyCore(controller.signal),
      tab === 'overview' ? assessmentAssignmentClient.mine(1, 4, controller.signal) : Promise.resolve(null),
    ]).then(([taxResult, assignResult]) => {
      if (!active) return;
      if (taxResult.status === 'fulfilled') {
        setPaths(taxResult.value.paths || []);
      }
      if (assignResult.status === 'fulfilled' && assignResult.value) {
        setAssignments(assignResult.value.items || []);
      }
      setLoadingData(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [loading, tab, user]);

  const studentUser = user && user.roles.includes('student') ? user : null;

  const copyParentCode = useCallback(() => {
    const code = String(studentUser?.id || user?.id || 'ALM892').slice(-6).toUpperCase();
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }, [studentUser?.id, user?.id]);

  if (loading) {
    return (
      <main dir="rtl" className="p-10 text-center font-black text-slate-500">
        جاري التحقق من الحساب...
      </main>
    );
  }

  if (!user) {
    return (
      <main dir="rtl" className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-black text-slate-900">سجّل الدخول لعرض لوحتك</h1>
        <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
          لوحة الطالب تعرض مساراتك ودوراتك ونتائجك، وتحتاج إلى حساب مسجّل.
        </p>
        <Link
          to="/login"
          className="mt-5 inline-flex rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white"
        >
          تسجيل الدخول
        </Link>
      </main>
    );
  }

  if (!studentUser) {
    return (
      <main dir="rtl" className="p-10 text-center font-black text-rose-700">
        هذه الصفحة مخصصة للطالب.
      </main>
    );
  }

  const initials = studentUser.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');

  const learningShortcuts: NavItem[] = [
    { tab: 'paths', label: 'مساراتي', icon: RouteIcon, tone: 'bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300' },
    { tab: 'my-courses', label: 'دوراتي', icon: BookOpen, tone: 'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300' },
    { tab: 'sessions', label: 'جلساتي', icon: CalendarDays, tone: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300' },
  ];

  const groups: Array<{ id: string; title: string; icon: typeof GraduationCap; tone: string; items: NavItem[] }> = [
    {
      id: 'journey',
      title: 'رحلتي التعليمية',
      icon: GraduationCap,
      tone: 'border-emerald-200/80 bg-gradient-to-b from-emerald-100/90 to-emerald-50/80 text-emerald-800 dark:border-emerald-800/60 dark:from-emerald-950/70 dark:to-emerald-900/40 dark:text-emerald-300',
      items: [
        { tab: 'smart-path', label: 'المسار الذكي', icon: Brain, tone: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300' },
        { tab: 'reports', label: 'تقاريري', icon: BarChart3, tone: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300' },
        { tab: 'plan', label: 'خططي', icon: CalendarDays, tone: 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300' },
      ],
    },
    {
      id: 'exams',
      title: 'الاختبارات',
      icon: FileText,
      tone: 'border-rose-200/80 bg-gradient-to-b from-rose-100/90 to-rose-50/80 text-rose-800 dark:border-rose-800/60 dark:from-rose-950/70 dark:to-rose-900/40 dark:text-rose-300',
      items: [
        { tab: 'quizzes', label: 'الاختبارات السابقة', description: 'نتائجك ومحاولاتك التي أنجزتها', icon: FileText, tone: 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300' },
        { tab: 'school-tests', label: 'الاختبارات المدرسية', description: 'ما تطلبه منك مدرستك', icon: Target, tone: 'bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300' },
        { tab: 'mock-exams', label: 'الاختبارات المحاكية', description: 'نماذج للتدرب على الاختبار', icon: Star, tone: 'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300' },
      ],
    },
    {
      id: 'tools',
      title: 'الأدوات',
      icon: Wrench,
      tone: 'border-violet-200/80 bg-gradient-to-b from-violet-100/90 to-violet-50/80 text-violet-800 dark:border-violet-800/60 dark:from-violet-950/70 dark:to-violet-900/40 dark:text-violet-300',
      items: [
        { tab: 'favorites', label: 'أسئلتي للمراجعة', icon: Bookmark, tone: 'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300' },
        { tab: 'flashcards', label: 'بطاقات التذكر', icon: Copy, tone: 'bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300' },
      ],
    },
    {
      id: 'support',
      title: 'الدعم',
      icon: Headphones,
      tone: 'border-orange-200/80 bg-gradient-to-b from-orange-100/90 to-orange-50/80 text-orange-800 dark:border-orange-800/60 dark:from-orange-950/70 dark:to-orange-900/40 dark:text-orange-300',
      items: [
        { tab: 'qa', label: 'سؤال وجواب', icon: MessageCircle, tone: 'bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300' },
        { tab: 'requests', label: 'طلباتي', icon: ClipboardList, tone: 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300' },
      ],
    },
  ];

  const navItem = (item: NavItem) => {
    const Icon = item.icon;
    const isItemActive = item.tab === tab;
    return (
      <Link
        key={item.tab}
        to={`/dashboard?tab=${item.tab}`}
        onClick={() => setSidebarOpen(false)}
        aria-current={isItemActive ? 'page' : undefined}
        className={`group flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-sm transition ${
          isItemActive
            ? 'border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 shadow-xs ring-1 ring-indigo-200 dark:ring-indigo-900/60 font-black text-indigo-900 dark:text-white'
            : 'border-transparent font-bold text-gray-800 dark:text-gray-100 hover:border-white/80 dark:hover:border-slate-700 hover:bg-white/90 dark:hover:bg-slate-800/90'
        }`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-xs ' + item.tone}>
            <Icon size={17} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black leading-tight">{item.label}</span>
            {item.description && <span className="mt-0.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{item.description}</span>}
          </span>
        </span>
        <ChevronLeft size={16} className="shrink-0 text-gray-400 group-hover:text-indigo-600 group-hover:-translate-x-0.5 transition-all" />
      </Link>
    );
  };

  const enrolledPathList = paths.filter((path) => enrolledPaths?.includes(path.id));
  const nextAssignment = assignments.find((assignment) => assignment.canStart);
  const overviewPaths = enrolledPathList.length > 0 ? enrolledPathList.slice(0, 3) : paths.slice(0, 3);

  return (
    <div dir="rtl" className="flex min-h-[calc(100vh-5rem)] bg-gray-50 overflow-x-hidden w-full max-w-full">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="إغلاق خلفية لوحة الطالب"
          className="fixed inset-0 z-30 bg-slate-950/25 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <button
        type="button"
        aria-label={sidebarOpen ? 'إغلاق قائمة لوحة الطالب' : 'فتح قائمة لوحة الطالب'}
        className="fixed bottom-6 left-6 md:bottom-28 md:left-8 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg lg:hidden"
        onClick={() => setSidebarOpen((value) => !value)}
      >
        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <aside
        aria-label="تنقل لوحة الطالب"
        className={`fixed bottom-0 right-0 top-20 z-40 h-[calc(100vh-5rem)] w-72 shrink-0 max-w-[calc(100vw-1rem)] overflow-y-auto border-l border-gray-200 bg-white transition-transform duration-300 lg:visible lg:static lg:h-[calc(100vh-5rem)] lg:translate-x-0 lg:overflow-y-auto ${
          sidebarOpen ? 'visible translate-x-0' : 'invisible translate-x-full'
        }`}
      >
          <div className="p-4 sm:p-5">
            <div className="mb-6 flex items-center gap-3">
              {studentUser.avatarUrl && studentUser.avatarUrl.trim() !== '' ? (
                <img src={studentUser.avatarUrl} alt={studentUser.name} loading="lazy" className="h-12 w-12 shrink-0 rounded-full border-2 border-amber-100 object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-amber-100 bg-indigo-50 text-sm font-black text-indigo-700">
                  {initials || 'ط'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-black text-gray-900 leading-snug break-words">{studentUser.name}</h2>
                <span className="text-xs text-gray-500">لوحة تحكم الطالب</span>
              </div>
            </div>

            <nav aria-label="تنقل لوحة الطالب" className="space-y-3">
              {/* Primary overview */}
              <div data-testid="student-menu-overview">
                <Link
                  to="/dashboard"
                  onClick={() => setSidebarOpen(false)}
                  aria-current={tab === 'overview' ? 'page' : undefined}
                  className={`group flex w-full items-center justify-between rounded-[20px] border px-3.5 py-2.5 text-sm font-black transition shadow-xs ${
                    tab === 'overview'
                      ? 'border-sky-200 dark:border-sky-800/80 bg-gradient-to-l from-sky-200/90 to-blue-100/90 dark:from-sky-950/80 dark:to-indigo-950/80 text-indigo-950 dark:text-white font-black'
                      : 'border-transparent text-gray-700 dark:text-gray-200 hover:border-white/80 dark:hover:border-slate-700 hover:bg-white/80 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/75 dark:bg-slate-800 text-indigo-800 dark:text-indigo-300 shadow-xs">
                      <LayoutDashboard size={18} />
                    </span>
                    <span className="whitespace-nowrap font-black">نظرة عامة</span>
                  </span>
                  <ChevronLeft size={16} className="shrink-0 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                </Link>
              </div>

              {/* Main learning shortcuts */}
              <div
                data-testid="student-menu-group-learning"
                className="space-y-1 rounded-[20px] border border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 p-2 shadow-sm"
              >
                {learningShortcuts.map(navItem)}
              </div>

              {/* Groups with section headers and icons */}
              {groups.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <section
                    key={group.id}
                    data-testid={`student-menu-group-${group.id}`}
                    className={'rounded-[22px] border p-2.5 shadow-sm ' + group.tone}
                  >
                    <div className="flex items-center gap-2 px-2.5 pb-2 pt-1 text-base font-black">
                      <GroupIcon size={19} aria-hidden="true" />
                      <span>{group.title}</span>
                    </div>
                    <div className="space-y-1 rounded-[16px] bg-white/70 dark:bg-slate-900/80 p-1.5 ring-1 ring-white/70 dark:ring-slate-800/80">
                      {group.items.map(navItem)}
                    </div>
                  </section>
                );
              })}
            </nav>
          </div>
        </aside>

      <main id="overview" dir="rtl" className="flex-1 min-w-0 p-4 lg:p-8 pb-24 lg:pb-8 w-full max-w-full lg:max-w-[calc(100vw-18rem)] overflow-x-hidden">
        {tab === 'paths' ? (
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <PathsTab paths={paths} />
          </div>
        ) : tab === 'my-courses' ? (
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <MyCoursesTab />
          </div>
        ) : tab === 'sessions' ? (
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <SessionsTab />
          </div>
        ) : tab === 'smart-path' ? (
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <SmartPathTab />
          </div>
        ) : tab === 'plan' ? (
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <StudyPlanPage embedded={true} />
          </div>
        ) : tab === 'reports' ? (
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <Suspense fallback={<div className="p-8 text-center text-slate-500">جاري تحميل التقارير...</div>}>
              <ReportsPage embedded={true} />
            </Suspense>
          </div>
        ) : tab === 'quizzes' ? (
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <AssessmentResultsPage embedded={true} />
          </div>
        ) : tab === 'school-tests' ? (
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <AssessmentAssignmentsPage embedded={true} />
          </div>
        ) : tab === 'platform-assessments' ? (
          <AssessmentAvailabilityPage embedded />
        ) : tab === 'mock-exams' ? (
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <MockExamsTab />
          </div>
        ) : tab === 'favorites' ? (
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <ReviewLibraryPage embedded={true} />
          </div>
        ) : tab === 'flashcards' ? (
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <FlashcardsTab />
          </div>
        ) : tab === 'qa' ? (
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <QATab />
          </div>
        ) : tab === 'requests' ? (
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <MyRequestsTab />
          </div>
        ) : (
          <div className="max-w-7xl mx-auto w-full min-w-0 space-y-6">
            {/* Greeting and notifications */}
            <header className="flex flex-col justify-between gap-3 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
              <div className="flex items-center gap-3.5">
                {studentUser.avatarUrl && studentUser.avatarUrl.trim() !== '' ? (
                  <img src={studentUser.avatarUrl} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-full border-2 border-amber-100 object-cover" />
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
                <Link
                  to="/notifications"
                  className="inline-flex items-center gap-2 rounded-2xl border border-orange-100 bg-orange-50/80 px-3.5 py-2.5 text-xs font-black text-orange-700 hover:bg-orange-100 transition"
                >
                  <Bell size={16} />
                  <span>الإشعارات</span>
                </Link>
              </div>
            </header>

            <div data-testid="student-today-focus">
              <StudentNextActionStrip
                kicker="خطوتك اليوم"
                title={nextAssignment?.title || 'تابع تعلمك'}
                description={nextAssignment
                  ? 'اختبار موجه ينتظرك في الاختبارات المدرسية.'
                  : 'افتح المسار الذكي لعرض توصياتك حسب أدائك.'}
                primaryLabel={nextAssignment ? 'افتح الاختبارات المدرسية' : 'افتح المسار الذكي'}
                primaryHref={nextAssignment ? '/dashboard?tab=school-tests' : '/dashboard?tab=smart-path'}
                tone="emerald"
              />
            </div>

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
                className="group rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/70 via-indigo-50/40 to-white dark:from-indigo-950/60 dark:via-slate-900 dark:to-slate-900 p-4 shadow-xs hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-md transition cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <Calculator size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base truncate">حاسبة النسبة الموزونة</h3>
                      <span className="rounded-md bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 text-[10px] font-black text-indigo-700 dark:text-indigo-300">قياس</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate mt-0.5">احسب نسبتك الموزونة وفرصتك بالجامعات السعودية.</p>
                  </div>
                </div>
                <div className="text-indigo-600 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-900/50 p-2 rounded-xl shrink-0 mr-2 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ChevronLeft size={18} />
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-100 dark:border-purple-900/60 bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-white dark:from-purple-950/60 dark:via-slate-900 dark:to-slate-900 p-4 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center font-black shrink-0 text-lg shadow-xs">
                    🔗
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-gray-900 dark:text-white text-sm sm:text-base truncate">كود ربط ولي الأمر</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate mt-0.5">شاركه مع ولي أمرك لمتابعة تقدمك ونتائجك.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-purple-100 dark:border-purple-900/50 shadow-xs shrink-0 mr-2">
                  <span className="font-mono font-black text-indigo-900 dark:text-indigo-200 text-sm tracking-wider">
                    {String(user?.id || 'ALM892').slice(-6).toUpperCase()}
                  </span>
                  <button
                    type="button"
                    onClick={copyParentCode}
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 p-1.5 rounded-lg flex items-center gap-1 text-xs font-black transition-colors"
                    title="نسخ الكود"
                  >
                    <Copy size={14} />
                    {copiedCode && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black">تم النسخ ✓</span>}
                  </button>
                </div>
              </div>
            </div>

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
                <Link to="/dashboard?tab=paths" className="text-xs font-black text-indigo-600 hover:text-indigo-800">
                  عرض كل المسارات ←
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {overviewPaths.length > 0 ? (
                  overviewPaths.map((path) => {
                    const pathStats = resolvePathProgress(path as DashboardPath, [], [], []);
                    const progress = pathStats.progress;
                    return (
                      <div
                        key={path.id}
                        data-testid={`overview-active-path-card-${path.id}`}
                        className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-gray-50/60 p-4 transition hover:border-indigo-100 hover:bg-white hover:shadow-xs"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="rounded-lg bg-indigo-100/70 px-2 py-0.5 text-xs font-black text-indigo-800">
                              {path.code || path.name}
                            </span>
                            <span className="text-xs font-black text-indigo-600">{progress}%</span>
                          </div>
                          <h4 className="text-sm font-black text-gray-900">{path.name}</h4>
                          <div className="mt-2.5">
                            <ProgressBar percentage={progress} color="primary" showPercentage={false} />
                          </div>
                        </div>
                        <Link
                          to={`/category/${path.id}`}
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
                    {loadingData ? 'جاري تحميل المسارات...' : 'لا توجد مسارات متاحة الآن.'}
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
                  <Link to="/dashboard?tab=school-tests" className="text-xs font-black text-sky-700 hover:text-sky-900">
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
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        )}
      </main>

        {/* Qiyas Calculator Modal */}
        <QiyasCalculatorModal
          isOpen={showCalculator}
          onClose={() => setShowCalculator(false)}
        />
      </div>
  );
}
