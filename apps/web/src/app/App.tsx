import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { AppErrorBoundary } from './AppErrorBoundary';
import { AuthModal } from '../features/auth/components/AuthModal';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '../features/auth/pages/VerifyEmailPage';
import { useAuth } from '../features/auth/state/AuthProvider';
import { AssessmentAttemptPage } from '../features/assessment/pages/AssessmentAttemptPage';
import { AssessmentResultsPage } from '../features/assessment/pages/AssessmentResultsPage';
import { AssessmentAvailabilityPage } from '../features/assessment/pages/AssessmentAvailabilityPage';
import { SelfQuizPage } from '../features/assessment/pages/SelfQuizPage';
import { AssessmentAssignmentsPage } from '../features/assessment/pages/AssessmentAssignmentsPage';
import { ReviewLibraryPage } from '../features/learning/pages/ReviewLibraryPage';
import { ReviewPracticePage } from '../features/learning/pages/ReviewPracticePage';
import { CourseLearningPage } from '../features/learning/pages/CourseLearningPage';
import { CourseView } from '../features/learning/pages/CourseView';
import { LearningSpacePage } from '../features/learning/pages/LearningSpacePage';
import { StudyPlanPage } from '../features/learning/pages/StudyPlanPage';
import { PublicBarcodeAssessmentPage } from '../features/assessment/pages/PublicBarcodeAssessmentPage';
import { CheckoutPage } from '../features/commerce/pages/CheckoutPage';
import { LiveAssessmentJoinPage } from '../features/assessment/pages/LiveAssessmentJoinPage';
import { AdminDashboardShell } from '../features/content/components/AdminDashboardShell';
import { NotificationInboxPage } from '../features/notifications/pages/NotificationInboxPage';
import { CertificatePage } from '../features/organizations/pages/CertificatePage';
import { SupervisorDashboardPage } from '../features/organizations/pages/SupervisorDashboardPage';
import { ParentDashboardPage } from '../features/parents/pages/ParentDashboardPage';
import { ProfilePage } from '../features/auth/pages/ProfilePage';
import { AchievementsPage } from '../features/learning/pages/AchievementsPage';
import { PwaInstallBanner } from '../features/presentation/PwaInstallBanner';
import { StudentDashboardPage } from '../features/learning/pages/StudentDashboardPage';
import { PublicLandingPage } from '../features/public/pages/PublicLandingPage';
import { CoursesPage } from '../features/public/pages/CoursesPage';
import { CartPage } from '../features/public/header/commerce/CartPage';
import { PricingPage } from '../features/public/header/commerce/PricingPage';
import { PricingPlansPage } from '../features/commerce/pages/PricingPlansPage';
import { BlogPage } from '../features/public/header/pages/BlogPage';
import { MockExamsPage } from '../features/public/header/pages/MockExamsPage';
import { LegacySiteFooter, showPublicFooter } from '../features/public/components/LegacySiteFooter';
import { Header as OriginalHeader } from '../features/public/header/OriginalHeader';
import { LegacyCategoryPage } from '../features/public/header/pages/LegacyCategoryPage';
import { StaticInfoPage } from '../features/public/pages/StaticInfoPage';
import { SchoolsPitchPage } from '../features/public/pages/SchoolsPitchPage';
import { StudentNavigationProvider, StudentPathBar } from '../features/learning/navigation';

import { PlatformFontBootstrap } from '../features/presentation/PlatformFontBootstrap';
import { AnnouncementAdsOverlay } from '../features/presentation/AnnouncementAdsOverlay';
import { isHomepageLocation, isPlatformFontsLocation } from '../features/presentation/navigation';
import { ChatWidget } from '../features/ai/components/ChatWidget';
import { FloatingContactWidget } from '../features/support/FloatingContactWidget';

// 28 Lazy-Loaded Role & Admin Modules (Safe Route Splitting per Issue #284)
const ContentAdminPage = React.lazy(() => import('../features/content/pages/ContentAdminPage').then(m => ({ default: m.ContentAdminPage })));
const AdminOverviewPage = React.lazy(() => import('../features/content/pages/AdminOverviewPage').then(m => ({ default: m.AdminOverviewPage })));
const AssessmentAdminPage = React.lazy(() => import('../features/assessment/pages/AssessmentAdminPage').then(m => ({ default: m.AssessmentAdminPage })));
const PreparedQuizAdminPage = React.lazy(() => import('../features/assessment/pages/PreparedQuizAdminPage').then(m => ({ default: m.PreparedQuizAdminPage })));
const CommerceAdminPage = React.lazy(() => import('../features/commerce/pages/CommerceAdminPage').then(m => ({ default: m.CommerceAdminPage })));
const UsersAdminPage = React.lazy(() => import('../features/auth/pages/UsersAdminPage').then(m => ({ default: m.UsersAdminPage })));
const SchoolsAdminPage = React.lazy(() => import('../features/organizations/pages/SchoolsAdminPage').then(m => ({ default: m.SchoolsAdminPage })));
const NotificationsAdminPage = React.lazy(() => import('../features/notifications/pages/NotificationsAdminPage').then(m => ({ default: m.NotificationsAdminPage })));
const ClassroomContractsAdminPage = React.lazy(() => import('../features/classroom/pages/ClassroomContractsAdminPage').then(m => ({ default: m.ClassroomContractsAdminPage })));
const AiAdminPage = React.lazy(() => import('../features/ai/pages/AiAdminPage').then(m => ({ default: m.AiAdminPage })));
const ReportsPage = React.lazy(() => import('../features/reporting/pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const OperationsAdminPage = React.lazy(() => import('../features/operations/pages/OperationsAdminPage').then(m => ({ default: m.OperationsAdminPage })));
const TaxonomyAdminPage = React.lazy(() => import('../features/taxonomy/pages/TaxonomyAdminPage').then(m => ({ default: m.TaxonomyAdminPage })));
const SkillsAdminPage = React.lazy(() => import('../features/taxonomy/pages/SkillsAdminPage').then(m => ({ default: m.SkillsAdminPage })));
const QuestionBankAdminPage = React.lazy(() => import('../features/questionbank/pages/QuestionBankAdminPage').then(m => ({ default: m.QuestionBankAdminPage })));
const AnnouncementAdsAdminPage = React.lazy(() => import('../features/presentation/AnnouncementAdsAdminPage').then(m => ({ default: m.AnnouncementAdsAdminPage })));
const PlatformIntegrationsAdminPage = React.lazy(() => import('../features/operations/pages/PlatformIntegrationsAdminPage').then(m => ({ default: m.PlatformIntegrationsAdminPage })));
const BackupAdminPage = React.lazy(() => import('../features/operations/pages/BackupAdminPage').then(m => ({ default: m.BackupAdminPage })));
const PlatformFontsPage = React.lazy(() => import('../features/presentation/PlatformFontsPage').then(m => ({ default: m.PlatformFontsPage })));
const HomepagePage = React.lazy(() => import('../features/presentation/HomepagePage').then(m => ({ default: m.HomepagePage })));

const SchoolDirectorDashboardPage = React.lazy(() => import('../features/organizations/pages/SchoolDirectorDashboardPage').then(m => ({ default: m.SchoolDirectorDashboardPage })));
const TeacherWorkspacePage = React.lazy(() => import('../features/organizations/pages/TeacherWorkspacePage').then(m => ({ default: m.TeacherWorkspacePage })));
const PlatformTrainerDashboardPage = React.lazy(() => import('../features/organizations/pages/PlatformTrainerDashboardPage').then(m => ({ default: m.PlatformTrainerDashboardPage })));
const ClassroomTeacherPage = React.lazy(() => import('../features/classroom/pages/ClassroomTeacherPage').then(m => ({ default: m.ClassroomTeacherPage })));
const ClassroomProjectorPage = React.lazy(() => import('../features/classroom/pages/ClassroomProjectorPage').then(m => ({ default: m.ClassroomProjectorPage })));
const ClassroomJoinPage = React.lazy(() => import('../features/classroom/pages/ClassroomJoinPage').then(m => ({ default: m.ClassroomJoinPage })));
const ClassroomStudentPage = React.lazy(() => import('../features/classroom/pages/ClassroomStudentPage').then(m => ({ default: m.ClassroomStudentPage })));
const SchoolInterventionsPage = React.lazy(() => import('../features/learning/pages/SchoolInterventionsPage').then(m => ({ default: m.SchoolInterventionsPage })));

type ModalMode = 'login' | 'signup' | null;

function RouteLoadingFallback() {
  return (
    <div dir="rtl" className="min-h-[40vh] flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      <p className="mt-4 text-sm font-bold text-slate-500">جاري تحميل الصفحة...</p>
    </div>
  );
}

function NotFoundPage() {
  return (
    <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-16">
      <section className="mx-auto max-w-xl rounded-3xl border border-slate-100 bg-white p-7 text-center shadow-sm">
        <div className="text-xs font-black text-indigo-600">404</div>
        <h1 className="mt-2 text-2xl font-black text-slate-950">الصفحة غير موجودة</h1>
        <p className="mt-2 text-sm font-bold leading-7 text-slate-500">تحقق من الرابط أو ارجع للصفحة الرئيسية.</p>
        <Link to="/" className="mt-5 inline-flex rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white">العودة للرئيسية</Link>
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

  const consumeAuthIntent = useCallback(() => setManualMode(null), []);
  const closeModal = useCallback(() => {
    setManualMode(null);
    if (location.pathname === '/login' || location.pathname === '/signup') {
      navigate('/', { replace: true });
    } else if (routeMode) {
      const params = new URLSearchParams(location.search);
      params.delete('auth');
      const query = params.toString();
      navigate(location.pathname + (query ? '?' + query : '') + location.hash, { replace: true });
    }
  }, [location.pathname, location.search, location.hash, navigate, routeMode]);


  const inAdminWorkspace = location.pathname.startsWith('/admin-dashboard');
  const inAssessmentResult = /^\/assessment-results\/[^/]+\/?$/.test(location.pathname);
  const hideSiteHeader = inAssessmentResult || inAdminWorkspace || location.pathname.endsWith('/projector') || location.pathname === '/quiz';

  return (
    <StudentNavigationProvider>
      <PlatformFontBootstrap />
      {!hideSiteHeader ? (
        <>
          <OriginalHeader
            requestedAuthMode={modalMode}
            onAuthIntentConsumed={consumeAuthIntent}
            onAuthClose={closeModal}
          />
          <StudentPathBar />
        </>
      ) : null}

      <AppErrorBoundary>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
        <Route path="/" element={<PublicLandingPage onAuth={setManualMode} />} />
        <Route path="/login" element={<PublicLandingPage onAuth={setManualMode} />} />
        <Route path="/signup" element={<PublicLandingPage onAuth={setManualMode} />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/terms" element={<StaticInfoPage kind="terms" />} />
        <Route path="/privacy" element={<StaticInfoPage kind="privacy" />} />
        <Route path="/about" element={<StaticInfoPage kind="about" />} />
        <Route path="/contact" element={<StaticInfoPage kind="contact" />} />
        <Route path="/faq" element={<StaticInfoPage kind="faq" />} />
        <Route path="/notifications" element={<NotificationInboxPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/dashboard" element={<StudentDashboardPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/pricing" element={<PricingPlansPage />} />
        <Route path="/memberships" element={<PricingPlansPage />} />
        <Route path="/for-schools" element={<SchoolsPitchPage />} />
        <Route path="/schools" element={<SchoolsPitchPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/mock-exams" element={<MockExamsPage />} />
        <Route path="/quizzes" element={<MockExamsPage />} />
        <Route path="/admin-dashboard" element={<AdminDashboardShell>{isHomepageLocation(location) ? <HomepagePage /> : isPlatformFontsLocation(location) ? <PlatformFontsPage /> : new URLSearchParams(location.search).get('tab') === 'skills' ? <SkillsAdminPage /> : <AdminOverviewPage />}</AdminDashboardShell>} />
        <Route path="/admin-dashboard/homepage" element={<AdminDashboardShell><HomepagePage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/platform-fonts" element={<AdminDashboardShell><PlatformFontsPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/content" element={<AdminDashboardShell><ContentAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/taxonomy" element={<AdminDashboardShell><TaxonomyAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/questions" element={<AdminDashboardShell><QuestionBankAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/assessments" element={<AdminDashboardShell><AssessmentAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/assessments/:assessmentId/prepared" element={<AdminDashboardShell><PreparedQuizAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/commerce" element={<AdminDashboardShell><CommerceAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/users" element={<AdminDashboardShell><UsersAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/trainers" element={<AdminDashboardShell><UsersAdminPage defaultRoleFilter="platform_trainer" pageTitle="إدارة المدربين والمعلمين" /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/schools" element={<AdminDashboardShell><SchoolsAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/notifications" element={<AdminDashboardShell><NotificationsAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/classroom" element={<AdminDashboardShell><ClassroomContractsAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/ai" element={<AdminDashboardShell><AiAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/reports" element={<AdminDashboardShell><ReportsPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/operations" element={<AdminDashboardShell><OperationsAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/announcements" element={<AdminDashboardShell><AnnouncementAdsAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/integrations" element={<AdminDashboardShell><PlatformIntegrationsAdminPage /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/backups" element={<AdminDashboardShell><BackupAdminPage /></AdminDashboardShell>} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/assessments" element={<AssessmentAvailabilityPage />} />
        <Route path="/quiz" element={<SelfQuizPage />} />
        <Route path="/assessment-assignments" element={<AssessmentAssignmentsPage />} />
        <Route path="/barcode-test" element={<PublicBarcodeAssessmentPage />} />
        <Route path="/barcode-test/:code" element={<PublicBarcodeAssessmentPage />} />
        <Route path="/live-assessment" element={<LiveAssessmentJoinPage />} />
        <Route path="/assessments/:assessmentId/start" element={<AssessmentAttemptPage />} />
        <Route path="/assessment-attempts/:attemptId" element={<AssessmentAttemptPage />} />
        <Route path="/assessment-results" element={<AssessmentResultsPage />} />
        <Route path="/assessment-results/:attemptId" element={<AssessmentResultsPage />} />
        <Route path="/learning" element={<LearningSpacePage />} />
        <Route path="/category/:pathId" element={<LegacyCategoryPage />} />
        <Route path="/path/:pathId" element={<LegacyCategoryPage />} />
        <Route path="/paths/:pathId" element={<LegacyCategoryPage />} />
        <Route path="/learning/courses/:courseId" element={<CourseView />} />
        <Route path="/course/:courseId" element={<CourseView />} />
        <Route path="/review" element={<ReviewLibraryPage />} />
        <Route path="/favorites" element={<ReviewLibraryPage />} />
        <Route path="/review/practice" element={<ReviewPracticePage />} />
        <Route path="/plan" element={<StudyPlanPage />} />
        <Route path="/school-teacher-dashboard" element={<TeacherWorkspacePage />} />
        <Route path="/school-teacher-dashboard/classroom" element={<ClassroomTeacherPage />} />
        <Route path="/classroom/teacher" element={<ClassroomTeacherPage />} />
        <Route path="/classroom/:sessionId/teacher" element={<ClassroomTeacherPage />} />
        <Route path="/instructor-dashboard" element={<PlatformTrainerDashboardPage />} />
        <Route path="/trainer-dashboard" element={<PlatformTrainerDashboardPage />} />
        <Route path="/coach-dashboard" element={<PlatformTrainerDashboardPage />} />
        <Route path="/classroom/join" element={<ClassroomJoinPage />} />
        <Route path="/classroom/:sessionId" element={<ClassroomStudentPage />} />
        <Route path="/classroom/:sessionId/projector" element={<ClassroomProjectorPage />} />
        <Route path="/supervisor-dashboard" element={<SupervisorDashboardPage />} />
        <Route path="/supervisor-dashboard/interventions" element={<SchoolInterventionsPage />} />
        <Route path="/school-director" element={<SchoolDirectorDashboardPage />} />
        <Route path="/school-director-dashboard" element={<SchoolDirectorDashboardPage />} />
        <Route path="/school-director-dashboard/interventions" element={<SchoolInterventionsPage />} />
        <Route path="/certificate/:code" element={<CertificatePage />} />
        <Route path="/verify/cert/:code" element={<CertificatePage />} />
        <Route path="/verify/:code" element={<CertificatePage />} />
        <Route path="/parent-dashboard" element={<ParentDashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/achievements" element={<AchievementsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
        </Suspense>
      </AppErrorBoundary>

      {showPublicFooter(location.pathname) ? <LegacySiteFooter /> : null}

      <AnnouncementAdsOverlay />
      <PwaInstallBanner />

      {!inAssessmentResult && location.pathname !== '/quiz' ? (
        <>
          <ChatWidget />
          <FloatingContactWidget />
        </>
      ) : null}

      {hideSiteHeader ? (
        <AuthModal open={modalMode !== null} initialSignUp={modalMode === 'signup'} onClose={closeModal} />
      ) : null}
    </StudentNavigationProvider>
  );
}
