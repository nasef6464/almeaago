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
import { LegacySiteHeader } from '../features/public/components/LegacySiteHeader';
import { StaticInfoPage } from '../features/public/pages/StaticInfoPage';

type ModalMode = 'login' | 'signup' | null;

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
      {!hideSiteHeader ? <LegacySiteHeader onAuth={setManualMode} /> : null}

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
        <Route path="/category/:pathId" element={<LearningSpacePage />} />
        <Route path="/learning/courses/:courseId" element={<CourseLearningPage />} />
        <Route path="/course/:courseId" element={<CourseLearningPage />} />
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
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <AuthModal
        open={modalMode !== null}
        initialSignUp={modalMode === 'signup'}
        onClose={closeModal}
      />
    </>
  );
}
