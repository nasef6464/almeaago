import { Bell, LogIn, Menu, Radio, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { AuthModal } from '../features/auth/components/AuthModal';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '../features/auth/pages/VerifyEmailPage';
import { useAuth } from '../features/auth/state/AuthProvider';
import { dashboardPathFor } from '../features/auth/utils/dashboard-path';
import { ContentAdminPage } from '../features/content/pages/ContentAdminPage';
import { AdminOverviewPage } from '../features/content/pages/AdminOverviewPage';
import { AssessmentAdminPage } from '../features/assessment/pages/AssessmentAdminPage';
import { AssessmentAttemptPage } from '../features/assessment/pages/AssessmentAttemptPage';
import { AssessmentResultsPage } from '../features/assessment/pages/AssessmentResultsPage';
import { AssessmentAvailabilityPage } from '../features/assessment/pages/AssessmentAvailabilityPage';
import { AssessmentAssignmentsPage } from '../features/assessment/pages/AssessmentAssignmentsPage';
import { ReviewLibraryPage } from '../features/learning/pages/ReviewLibraryPage';
import { ReviewPracticePage } from '../features/learning/pages/ReviewPracticePage';
import { CourseLearningPage } from '../features/learning/pages/CourseLearningPage';
import { LearningSpacePage } from '../features/learning/pages/LearningSpacePage';
import { StudyPlanPage } from '../features/learning/pages/StudyPlanPage';
import { SchoolInterventionsPage } from '../features/learning/pages/SchoolInterventionsPage';
import { PublicBarcodeAssessmentPage } from '../features/assessment/pages/PublicBarcodeAssessmentPage';
import { CommerceAdminPage } from '../features/commerce/pages/CommerceAdminPage';
import { CheckoutPage } from '../features/commerce/pages/CheckoutPage';
import { ParentDashboardPage } from '../features/parents/pages/ParentDashboardPage';
import { LiveAssessmentJoinPage } from '../features/assessment/pages/LiveAssessmentJoinPage';
import { AdminDashboardShell } from '../features/content/components/AdminDashboardShell';
import { NotificationInboxPage } from '../features/notifications/pages/NotificationInboxPage';
import { NotificationsAdminPage } from '../features/notifications/pages/NotificationsAdminPage';
import { ClassroomTeacherPage } from '../features/classroom/pages/ClassroomTeacherPage';
import { ClassroomJoinPage } from '../features/classroom/pages/ClassroomJoinPage';
import { ClassroomStudentPage } from '../features/classroom/pages/ClassroomStudentPage';
import { ClassroomProjectorPage } from '../features/classroom/pages/ClassroomProjectorPage';
import { ClassroomContractsAdminPage } from '../features/classroom/pages/ClassroomContractsAdminPage';
import { AiAdminPage } from '../features/ai/pages/AiAdminPage';
import { ReportsPage } from '../features/reporting/pages/ReportsPage';
import { OperationsAdminPage } from '../features/operations/pages/OperationsAdminPage';
import { TaxonomyAdminPage } from '../features/taxonomy/pages/TaxonomyAdminPage';
import { QuestionBankAdminPage } from '../features/questionbank/pages/QuestionBankAdminPage';
import { SchoolDirectorDashboardPage } from '../features/organizations/pages/SchoolDirectorDashboardPage';
import { SupervisorDashboardPage } from '../features/organizations/pages/SupervisorDashboardPage';
import { StudentDashboardPage } from '../features/learning/pages/StudentDashboardPage';
import { PublicLandingPage } from '../features/public/pages/PublicLandingPage';

type ModalMode = 'login' | 'signup' | null;

function SiteHeader({ onAuth }: { onAuth(mode: Exclude<ModalMode, null>): void }) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const dashboardHref = user ? dashboardPathFor(user) : '';

  const navItems = [
    { to: '/', label: 'الرئيسية' },
    { to: '/learning', label: 'التعلم' },
    { to: '/assessments', label: 'الاختبارات' },
    { to: '/review', label: 'المراجعة' },
    { to: '/reports', label: 'التقارير' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:h-20 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2.5" onClick={() => setMenuOpen(false)}>
          <div className="flex min-w-0 flex-col justify-center leading-tight">
            <div className="flex min-w-0 items-center text-lg font-black text-amber-500 sm:text-2xl">
              <span className="text-blue-900 dark:text-blue-400">منصة</span>
              <span className="mx-1">المئة</span>
            </div>
            <span className="mt-0.5 text-[10px] font-bold leading-none tracking-tight text-gray-400 sm:text-xs">
              قدرات & تحصيلي
            </span>
          </div>
        </Link>

        <nav aria-label="التنقل الرئيسي" className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} className="rounded-xl px-3 py-2 text-sm font-black text-slate-600 transition hover:bg-slate-50 hover:text-indigo-700">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link to={dashboardHref} className="hidden rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white sm:inline-flex">
                لوحتي
              </Link>
              <Link to={user.roles.includes('teacher') ? '/school-teacher-dashboard' : '/classroom/join'} aria-label="الفصل الذكي" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200">
                <Radio size={18} />
              </Link>
              <Link to="/notifications" aria-label="الإشعارات" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200">
                <Bell size={18} />
              </Link>
              <div className="hidden max-w-32 truncate text-sm font-bold text-gray-700 xl:block dark:text-gray-200">{user.name}</div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onAuth('login')}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-600 sm:px-4"
            >
              <LogIn size={18} />
              <span>تسجيل الدخول</span>
            </button>
          )}
          <button
            type="button"
            aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 lg:hidden"
          >
            {menuOpen ? <X size={20}/> : <Menu size={20}/>}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav aria-label="التنقل الرئيسي للجوال" className="border-t border-slate-100 bg-white px-3 py-3 lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-1">
            {user ? (
              <Link to={dashboardHref} onClick={() => setMenuOpen(false)} className="rounded-xl bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700">
                لوحتي
              </Link>
            ) : null}
            {navItems.map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <main className="min-h-[calc(100vh-5rem)] bg-gray-50 px-4 py-10">
      <section className="mx-auto max-w-xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">هذه الوجهة ستُنقل من الواجهة المرجعية في مرحلتها.</p>
      </section>
    </main>
  );
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [manualMode, setManualMode] = useState<ModalMode>(null);

  const routeMode = useMemo<ModalMode>(() => {
    if (location.pathname === '/signup') return 'signup';
    if (location.pathname === '/login') return 'login';
    const authQuery = new URLSearchParams(location.search).get('auth');
    if (authQuery === 'signup') return 'signup';
    if (authQuery === 'login') return 'login';
    return null;
  }, [location.pathname, location.search]);

  const modalMode = manualMode ?? routeMode;

  useEffect(() => {
    if (loading || !user || location.pathname !== '/login') {
      return;
    }

    const params = new URLSearchParams(location.search);
    if (params.get('oauth_provider') !== 'google') {
      return;
    }

    const returnTo = params.get('oauth_return') || '/';
    if (
      returnTo.startsWith('/') &&
      !returnTo.startsWith('//') &&
      !returnTo.includes('\\') &&
      !/[\r\n]/.test(returnTo)
    ) {
      navigate(returnTo, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [loading, location.pathname, location.search, navigate, user]);

  function closeModal() {
    setManualMode(null);
    if (routeMode) {
      navigate('/', { replace: true });
    }
  }

  const inAdminWorkspace = location.pathname.startsWith('/admin-dashboard');
  const hideSiteHeader = inAdminWorkspace || location.pathname.endsWith('/projector');

  return (
    <>
      {!hideSiteHeader ? <SiteHeader onAuth={setManualMode} /> : null}

      <Routes>
        <Route path="/" element={<PublicLandingPage onAuth={setManualMode} />} />
        <Route path="/login" element={<PublicLandingPage onAuth={setManualMode} />} />
        <Route path="/signup" element={<PublicLandingPage onAuth={setManualMode} />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/terms" element={<PlaceholderPage title="شروط الاستخدام" />} />
        <Route path="/privacy" element={<PlaceholderPage title="سياسة الخصوصية" />} />
        <Route path="/notifications" element={<NotificationInboxPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/dashboard" element={<StudentDashboardPage />} />
        <Route path="/admin-dashboard" element={<AdminDashboardShell><AdminOverviewPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/content" element={<AdminDashboardShell><ContentAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/taxonomy" element={<AdminDashboardShell><TaxonomyAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/questions" element={<AdminDashboardShell><QuestionBankAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/assessments" element={<AdminDashboardShell><AssessmentAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/commerce" element={<AdminDashboardShell><CommerceAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/notifications" element={<AdminDashboardShell><NotificationsAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/classroom" element={<AdminDashboardShell><ClassroomContractsAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/ai" element={<AdminDashboardShell><AiAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/reports" element={<AdminDashboardShell><ReportsPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/operations" element={<AdminDashboardShell><OperationsAdminPage /></AdminDashboardShell>} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/assessments" element={<AssessmentAvailabilityPage />} />
        <Route path="/assessment-assignments" element={<AssessmentAssignmentsPage />} />
        <Route path="/barcode-test" element={<PublicBarcodeAssessmentPage />} />
        <Route path="/barcode-test/:code" element={<PublicBarcodeAssessmentPage />} />
        <Route path="/live-assessment" element={<LiveAssessmentJoinPage />} />
        <Route path="/assessments/:assessmentId/start" element={<AssessmentAttemptPage />} />
        <Route path="/assessment-attempts/:attemptId" element={<AssessmentAttemptPage />} />
        <Route path="/assessment-results" element={<AssessmentResultsPage />} />
        <Route path="/assessment-results/:attemptId" element={<AssessmentResultsPage />} />
        <Route path="/learning" element={<LearningSpacePage />} />
        <Route path="/learning/courses/:courseId" element={<CourseLearningPage />} />
        <Route path="/review" element={<ReviewLibraryPage />} />
        <Route path="/review/practice" element={<ReviewPracticePage />} />
        <Route path="/plan" element={<StudyPlanPage />} />
        <Route path="/school-teacher-dashboard" element={<ClassroomTeacherPage />} />
        <Route path="/school-teacher-dashboard/classroom" element={<ClassroomTeacherPage />} />
        <Route path="/classroom/join" element={<ClassroomJoinPage />} />
        <Route path="/classroom/:sessionId" element={<ClassroomStudentPage />} />
        <Route path="/classroom/:sessionId/projector" element={<ClassroomProjectorPage />} />
        <Route path="/supervisor-dashboard" element={<SupervisorDashboardPage />} />
        <Route path="/supervisor-dashboard/interventions" element={<SchoolInterventionsPage />} />
        <Route path="/school-director-dashboard" element={<SchoolDirectorDashboardPage />} />
        <Route path="/school-director-dashboard/interventions" element={<SchoolInterventionsPage />} />
        <Route path="/parent-dashboard" element={<ParentDashboardPage />} />
        <Route path="*" element={<PlaceholderPage title="الصفحة قيد النقل" />} />
      </Routes>

      <AuthModal
        open={modalMode !== null}
        initialSignUp={modalMode === 'signup'}
        onClose={closeModal}
      />
    </>
  );
}
