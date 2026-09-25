import { LogIn } from 'lucide-react';
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
import { AdminDashboardShell } from '../features/content/components/AdminDashboardShell';

type ModalMode = 'login' | 'signup' | null;

function SiteHeader({ onAuth }: { onAuth(mode: Exclude<ModalMode, null>): void }) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:h-20 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
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

        {user ? (
          <div className="text-sm font-bold text-gray-700 dark:text-gray-200">
            {user.name}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onAuth('login')}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 font-bold text-white transition-colors hover:bg-emerald-600"
          >
            <LogIn size={18} />
            <span>تسجيل الدخول</span>
          </button>
        )}
      </div>
    </header>
  );
}

function HomePage() {
  return (
    <main className="min-h-[calc(100vh-5rem)] bg-gray-50 px-4 py-12">
      <section className="mx-auto max-w-5xl rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
        <p className="text-sm font-black text-emerald-600">ALMEAA V2</p>
        <h1 className="mt-2 text-3xl font-black text-gray-900">واجهة المنصة</h1>
        <p className="mt-3 max-w-2xl leading-8 text-gray-500">
          يتم نقل الواجهة الحالية شاشة بشاشة مع الحفاظ على الشكل والسلوك،
          بينما يُعاد بناء المحرك الداخلي على Go وPostgreSQL.
        </p>
      </section>
    </main>
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

  return (
    <>
      {!inAdminWorkspace ? <SiteHeader onAuth={setManualMode} /> : null}

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<HomePage />} />
        <Route path="/signup" element={<HomePage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/terms" element={<PlaceholderPage title="شروط الاستخدام" />} />
        <Route path="/privacy" element={<PlaceholderPage title="سياسة الخصوصية" />} />
        <Route path="/dashboard" element={<PlaceholderPage title="لوحة الطالب" />} />
        <Route path="/admin-dashboard" element={<AdminDashboardShell><PlaceholderPage title="لوحة الإدارة" /></AdminDashboardShell>} />
        <Route path="/admin-dashboard/content" element={<AdminDashboardShell><ContentAdminPage /></AdminDashboardShell>} />
        <Route path="/school-teacher-dashboard" element={<PlaceholderPage title="لوحة معلم المدرسة" />} />
        <Route path="/supervisor-dashboard" element={<PlaceholderPage title="لوحة المشرف" />} />
        <Route path="/school-director-dashboard" element={<PlaceholderPage title="لوحة مدير المدرسة" />} />
        <Route path="/parent-dashboard" element={<PlaceholderPage title="لوحة ولي الأمر" />} />
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
