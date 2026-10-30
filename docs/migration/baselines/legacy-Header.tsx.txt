import { useStudentExperience } from '../contexts/StudentExperienceContext';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  ChevronDown,
  Menu,
  X,
  User,
  LayoutGrid,
  BookOpen,
  FileText,
  Award,
  LogOut,
  Home,
  Grid,
  Book,
  Eye,
  EyeOff,
  LogIn,
  Shield,
  Gift,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, isStagingEnv } from '../services/api';
import { useStore } from '../store/useStore';
import type { HomepageSettings } from '../types';
import { sanitizeHomepageSettings } from '../utils/sanitizeMojibakeArabic';
import { ThemeToggle } from './ThemeToggle';
import { SearchModal } from './SearchModal';
import { NotificationBell } from './NotificationBell';

const NavIcons: Record<string, React.ReactNode> = {
  home: <Home size={18} />,
  grid: <Grid size={18} />,
  'book-open': <BookOpen size={18} />,
  'file-text': <FileText size={18} />,
  book: <Book size={18} />,
  'layout-grid': <LayoutGrid size={18} />,
  gift: <Gift size={18} />,
  award: <Award size={18} />,
};

const text = {
  account: '\u062d\u0633\u0627\u0628\u064a',
  guest: '\u0645\u0633\u062a\u062e\u062f\u0645',
  dashboard: '\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645',
  courses: '\u062f\u0648\u0631\u0627\u062a\u064a',
  quizzes: '\u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a\u064a',
  achievements: '\u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a \u0648\u0627\u0644\u0625\u0646\u062c\u0627\u0632\u0627\u062a',
  profile: '\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062e\u0635\u064a',
  adminPanel: '\u0644\u0648\u062d\u0629 \u0627\u0644\u0625\u062f\u0627\u0631\u0629',
  logout: '\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c',
  login: '\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644',
  createAccount: '\u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628 \u062c\u062f\u064a\u062f',
  email: '\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a',
  password: '\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631',
  signUp: '\u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628',
  signIn: '\u062f\u062e\u0648\u0644',
  or: '\u0623\u0648',
  continueWithGoogle: '\u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629 \u0628\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u062c\u0648\u062c\u0644',
  forgotPassword: '\u0646\u0633\u064a\u062a \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631\u061f',
  hasAccount: '\u0644\u062f\u064a \u062d\u0633\u0627\u0628 \u0628\u0627\u0644\u0641\u0639\u0644\u061f \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644',
  noAccount: '\u0644\u064a\u0633 \u0644\u062f\u064a\u0643 \u062d\u0633\u0627\u0628\u061f \u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628 \u062c\u062f\u064a\u062f',
  main: '\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629',
  quizzesNav: '\u0627\u062e\u062a\u0628\u0627\u0631\u0627\u062a',
  blog: '\u0627\u0644\u0645\u062f\u0648\u0646\u0629',
  offersPrefix: '\u0639\u0631\u0648\u0636 \u0648\u0628\u0627\u0642\u0627\u062a',
  platform: '\u0645\u0646\u0635\u0629',
  hundred: '\u0627\u0644\u0645\u0626\u0629',
  subtitle: '\u0642\u062f\u0631\u0627\u062a & \u062a\u062d\u0635\u064a\u0644\u064a',
  authFallbackError: '\u062d\u062f\u062b \u062e\u0637\u0623 \u0623\u062b\u0646\u0627\u0621 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644',
  continueWithWhatsApp: '\u062a\u0633\u062c\u064a\u0644 \u0628\u0627\u0644\u0648\u0627\u062a\u0633\u0627\u0628',
  otpPhone: '\u0631\u0642\u0645 \u0627\u0644\u0648\u0627\u062a\u0633\u0627\u0628',
  otpCode: '\u0631\u0645\u0632 \u0627\u0644\u062a\u062d\u0642\u0642',
  otpSend: '\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0631\u0645\u0632',
  otpVerify: '\u062a\u062d\u0642\u0642 \u0648\u062f\u062e\u0648\u0644',
};
export const Header: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [expandedMobileStageId, setExpandedMobileStageId] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [smartInput, setSmartInput] = useState('');
  const [smartPassword, setSmartPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [smartLoginLoading, setSmartLoginLoading] = useState(false);

  const toAsciiDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());

  const detectInputType = (value: string): 'email' | 'phone' | 'nationalId' | 'unknown' => {
    const v = toAsciiDigits(value.trim());
    if (v.includes('@')) return 'email';
    const digits = v.replace(/\D/g, '');
    if (/^[12]\d{9}$/.test(digits)) return 'nationalId';
    if (digits.length >= 8) return 'phone';
    return 'unknown';
  };

  const smartInputType = detectInputType(smartInput);
  // Password field shows for email, nationalId, AND phone (phone users may have password OR use OTP)
  const smartInputNeedsPassword = smartInputType === 'email' || smartInputType === 'nationalId' || smartInputType === 'phone';
  const smartInputIsPhone = smartInputType === 'phone';
  const [navigationLoadingExpired, setNavigationLoadingExpired] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { homepageSettings, scope } = useStudentExperience();

  const location = useLocation();
  const navigate = useNavigate();
  const { paths, subjects: rawSubjects, levels: rawLevels, cartItems } = useStore();
  const subjects = rawSubjects.filter(scope.matchesNavigationContent);
  const levels = rawLevels.filter(level => scope.matchesNavigationContent({ pathId: level.pathId, levelId: level.id }));
  const { user, signInWithGoogle, signInWithEmail, signInWithNationalId, signUpWithEmail, logout } = useAuth();

  const getDashboardPathForRole = (role?: string | null, targetUser?: any) => {
    const activeUser = targetUser || user;
    switch (role) {
      case 'admin':
        return '/admin-dashboard';
      case 'teacher':
        if (activeUser?.schoolId || (activeUser?.groupIds && activeUser.groupIds.length > 0) || !(activeUser?.managedPathIds?.length)) {
          return '/school-teacher-dashboard';
        }
        return '/instructor-dashboard';
      case 'supervisor':
        return '/supervisor-dashboard';
      case 'school_admin':
        return '/school-director-dashboard';
      case 'parent':
        return '/parent-dashboard';
      default:
        return '/dashboard';
    }
  };

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    setActiveDropdown(null);
  }, [location]);

  useEffect(() => {
    const authParam = new URLSearchParams(location.search).get('auth');
    const isAuthRoute = location.pathname === '/login' || location.pathname === '/signup';
    const shouldOpen = isAuthRoute || authParam === 'login' || authParam === 'signup';
    if (!shouldOpen) return;

    setIsSignUp(location.pathname === '/signup' || authParam === 'signup');
    setIsLoginModalOpen(true);
  }, [location.pathname, location.search]);

  const navigationMenu = useMemo(() => {
    const navSettings = homepageSettings?.navigation || {};
    const navItems = navSettings.items || [];
    const getNavItem = (id: string) => navItems.find((item) => item.id === id);
    const isNavVisible = (id: string) => getNavItem(id)?.visible !== false;
    const getNavLabel = (id: string, fallback: string) => getNavItem(id)?.label?.trim() || fallback;
    const getNavOrder = (id: string, fallback: number) => Number(getNavItem(id)?.order ?? fallback);
    const menu: Array<Record<string, any>> = [];

    if (isNavVisible('home')) {
      menu.push({ id: 'home', label: getNavLabel('home', text.main), link: '/', iconName: 'home' });
    }

    const canSeeHiddenPaths = ['admin', 'teacher', 'supervisor'].includes(user?.role || '');
    const activePaths = paths.filter(
      (path) =>
        (canSeeHiddenPaths || path.isActive !== false) &&
        scope.navigationPathVisible(path) &&
        path.showInNavbar !== false &&
        typeof path.id === 'string' &&
        path.id.trim().length > 0 &&
        typeof path.name === 'string' &&
        path.name.trim().length > 0
    );
    const topLevelPaths = activePaths.filter((path) => !path.parentPathId);
    const childPaths = activePaths.filter((path) => path.parentPathId);

    if (navSettings.showAutoPaths !== false) {
      topLevelPaths.forEach((path) => {
        const menuNode: Record<string, any> = {
          id: path.id,
          label: path.name,
          link: `/category/${path.id}`,
          iconName: 'book',
          children: [],
        };

        const pathLevels = levels.filter((level) => level.pathId === path.id);
        const pathSubjects = subjects.filter((subject) => subject.pathId === path.id);

        if (pathLevels.length > 0) {
          pathLevels.forEach((level) => {
            const levelSubjects = pathSubjects.filter((subject) => subject.levelId === level.id);
            menuNode.children.push({
              id: level.id,
              label: level.name,
              link: `/category/${path.id}?level=${level.id}`,
              isGroup: true,
              levelId: level.id,
              pathId: path.id,
              subjects: levelSubjects.map((subject) => ({
                id: subject.id,
                label: subject.name,
                link: `/category/${path.id}?level=${level.id}&subject=${subject.id}`,
                icon: subject.icon,
                color: subject.color,
                isChild: true,
              })),
            });
          });

          const unassignedSubjects = pathSubjects.filter(
            (subject) => !subject.levelId || !pathLevels.some((l) => l.id === subject.levelId)
          );
          if (unassignedSubjects.length > 0) {
            unassignedSubjects.forEach((subject) => {
              menuNode.children.push({
                id: subject.id,
                label: subject.name,
                link: `/category/${path.id}?subject=${subject.id}`,
                icon: subject.icon,
                color: subject.color,
              });
            });
          }
        } else {
          pathSubjects.forEach((subject) => {
            menuNode.children.push({
              id: subject.id,
              label: subject.name,
              link: `/category/${path.id}?subject=${subject.id}`,
              icon: subject.icon,
              color: subject.color,
            });
          });
        }

        const subPaths = childPaths.filter((childPath) => childPath.parentPathId === path.id);
        if (subPaths.length > 0 && menuNode.children.length > 0) {
          menuNode.children.push({ isDivider: true });
        }

        subPaths.forEach((subPath) => {
          menuNode.children.push({
            id: subPath.id,
            label: subPath.name,
            link: `/category/${subPath.id}`,
          });
        });

        if (pathSubjects.length > 0 || subPaths.length > 0 || pathLevels.length > 0) {
          if (menuNode.children.length > 0) {
            menuNode.children.push({ isDivider: true });
          }

          menuNode.children.push({
            id: `${path.id}_mock_exams`,
            label: `اختبارات محاكية ${path.name}`,
            link: `/category/${path.id}?tab=mock-exams`,
            iconName: 'award',
            isMockExam: true,
          });

          menuNode.children.push({
            id: `${path.id}_packages`,
            label: `${text.offersPrefix} ${path.name}`,
            link: `/category/${path.id}?tab=packages`,
            iconName: 'gift',
            isPackage: true,
          });
        } else {
          delete menuNode.children;
        }

        menu.push(menuNode);
      });
    }

    const mockExamPaths = topLevelPaths.filter((path) => path.settings?.showMockExamCard !== false);

    if (isNavVisible('mock-exams') && mockExamPaths.length > 0) {
      menu.push({
        id: 'mock-exams',
        label: getNavLabel('mock-exams', 'اختبارات محاكية'),
        link: '/mock-exams',
        iconName: 'award',
        children: mockExamPaths.map((path) => ({
          id: `mock-${path.id}`,
          label: path.name,
          link: `/category/${path.id}?tab=mock-exams`,
        })),
      });
    }

    const moreChildren = [
      isNavVisible('pricing') ? { id: 'pricing', label: getNavLabel('pricing', 'العضويات'), link: '/pricing', iconName: 'gift' } : null,
      isNavVisible('blog') ? { id: 'blog', label: getNavLabel('blog', text.blog), link: '/blog', iconName: 'layout-grid' } : null,
    ].filter(Boolean);

    if (moreChildren.length > 0) {
      menu.push({
        id: 'more',
        label: navSettings.moreLabel?.trim() || 'أخرى',
        link: moreChildren.length === 1 ? moreChildren[0]?.link : '#',
        iconName: 'layout-grid',
        children: moreChildren,
      });
    }

    return menu.sort((a, b) => getNavOrder(a.id, a.id === 'more' ? 100 : 50) - getNavOrder(b.id, b.id === 'more' ? 100 : 50));
  }, [homepageSettings?.navigation, levels, paths, subjects, user?.role, scope]);
  const isPrivilegedUser = user?.role === 'admin' || user?.role === 'teacher' || user?.role === 'supervisor' || user?.role === 'school_admin';
  const showNavigationLoading = Boolean(user) && paths.length === 0 && navigationMenu.length <= 2 && !navigationLoadingExpired;
  const isStrongPassword = (value: string) => value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);

  useEffect(() => {
    if (!user || paths.length > 0) {
      setNavigationLoadingExpired(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setNavigationLoadingExpired(true);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [paths.length, user]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

const brandLogoUrl = String(homepageSettings?.brand?.logoUrl || '').trim();
  const brandLogoAlt = String(homepageSettings?.brand?.logoAlt || 'منصة المئة').trim();
  const brandLogoText = String(homepageSettings?.brand?.logoText || text.platform).trim();
  const brandLogoAccentText = String(homepageSettings?.brand?.logoAccentText || text.hundred).trim();

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isAuthSubmitting) return;
    setAuthError('');
    setIsAuthSubmitting(true);

    if (isSignUp) {
      if (!signupName.trim() || signupName.trim().length < 2) {
        setAuthError('يرجى كتابة الاسم الكامل (حرفين على الأقل).');
        setIsAuthSubmitting(false);
        return;
      }
      if (!isStrongPassword(password)) {
        setAuthError('كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف ورقم.');
        setIsAuthSubmitting(false);
        return;
      }
      if (password !== confirmPassword) {
        setAuthError('كلمتا المرور غير متطابقتين.');
        setIsAuthSubmitting(false);
        return;
      }
    }

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPassword = password.trim();
      const sessionUser = isSignUp
        ? await signUpWithEmail(normalizedEmail, normalizedPassword, signupName.trim())
        : await signInWithEmail(normalizedEmail, normalizedPassword);

      const nextPath = getDashboardPathForRole(sessionUser.role);

      setIsUserMenuOpen(false);
      setActiveDropdown(null);
      setIsMobileMenuOpen(false);
      setIsLoginModalOpen(false);
      setEmail('');
      setPassword('');
      setSignupName('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);

      navigate(nextPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : text.authFallbackError;
      setAuthError(message);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleSmartLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (smartLoginLoading) return;
    setAuthError('');
    setSmartLoginLoading(true);
    const v = smartInput.trim();
    const pw = smartPassword.trim();
    const asciiV = toAsciiDigits(v);
    const asciiPw = toAsciiDigits(pw);
    const digits = asciiV.replace(/\D/g, '');
    try {
      let sessionUser: any;
      if (smartInputType === 'email') {
        sessionUser = await signInWithEmail(v.toLowerCase(), pw);
      } else if (smartInputType === 'nationalId') {
        sessionUser = await signInWithNationalId(digits, asciiPw);
      } else if (smartInputType === 'phone') {
        // الدخول بالجوال + كلمة المرور مباشرة
        await api.post('/auth/login/phone-password', { phone: digits || asciiV, password: asciiPw });
        window.location.reload();
        return;
      } else {
        setAuthError('أدخل بريد إلكتروني أو رقم جوال أو رقم الهوية');
        setSmartLoginLoading(false);
        return;
      }
      if (sessionUser) {
        setIsLoginModalOpen(false);
        setSmartInput('');
        setSmartPassword('');
        setShowPassword(false);
        navigate(getDashboardPathForRole(sessionUser.role));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : text.authFallbackError;

      if (/Too many login attempts|تم تجاوز عدد المحاولات/i.test(message)) {
        setAuthError('توقف الدخول مؤقتًا لحماية حسابك. انتظر 15 دقيقة، أو اضغط «نسيت كلمة المرور» لاستعادة الدخول.');
      } else if (/Too many authentication attempts/i.test(message)) {
        setAuthError('محاولات دخول كثيرة من هذه الشبكة. انتظر قليلًا، أو استخدم «نسيت كلمة المرور» إذا نسيتها.');
      } else if (/Invalid email or password|رقم الهوية أو كلمة المرور غير صحيحة|الجوال أو كلمة المرور/i.test(message)) {
        setAuthError('بيانات الدخول غير صحيحة. راجعها، وإذا نسيت كلمة المرور اضغط «نسيت كلمة المرور» بدل تكرار المحاولات.');
      } else {
        setAuthError(message);
      }
    } finally {
      setSmartLoginLoading(false);
    }
  };

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm font-sans dark:bg-gray-950 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20 gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              onClick={() => setIsMobileMenuOpen((value) => !value)}
              aria-label={isMobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <Link to="/" className="flex items-center gap-2.5 min-w-0 group">
              {brandLogoUrl ? (
                <img
                  src={brandLogoUrl}
                  alt={brandLogoAlt}
                  className="h-9 w-9 sm:h-11 sm:w-11 rounded-full object-contain bg-white border border-amber-100 shadow-sm shrink-0"
                />
              ) : null}
              <div className="flex flex-col justify-center min-w-0 leading-tight">
                <div className="text-lg sm:text-2xl font-black text-amber-500 flex items-center min-w-0">
                  <span className="text-blue-900 dark:text-blue-400">{brandLogoText}</span>
                  <span className="mx-1">{brandLogoAccentText}</span>
                  {isStagingEnv ? (
                    <span className="mr-1.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-black text-amber-700 tracking-wider border border-amber-300/40 select-none">
                      STAGING
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-400 tracking-tight leading-none mt-0.5">
                  {text.subtitle}
                </span>
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {showNavigationLoading ? (
              <div className="flex items-center gap-3 px-3 py-2" aria-label="جارٍ تجهيز قائمة المنصة">
                {Array.from({ length: 4 }).map((_, index) => (
                  <span
                    key={`nav-loading-${index}`}
                    className={`h-4 animate-pulse rounded-full bg-gray-100 ${index === 0 ? 'w-16' : index === 1 ? 'w-24' : 'w-20'}`}
                  />
                ))}
              </div>
            ) : navigationMenu.map((item, index) => {
              const icon = item.iconName ? NavIcons[item.iconName] : null;

              return (
                <div
                  key={`nav-${item.id}-${index}`}
                  className="relative group px-3 py-2"
                  onMouseEnter={() => setActiveDropdown(item.id)}
                  onMouseLeave={() => {
                    setActiveDropdown(null);
                    setActiveStageId(null);
                  }}
                >
                  <Link
                    to={item.link || '#'}
                    className="flex items-center gap-2 text-gray-700 font-bold hover:text-amber-500 transition-colors text-sm"
                  >
                    {icon ? (
                      <span className="text-gray-400 group-hover:text-amber-500 transition-colors">{icon}</span>
                    ) : null}
                    {item.label}
                    {item.children ? <ChevronDown size={14} /> : null}
                  </Link>

                  {item.children && activeDropdown === item.id ? (
                    <div className="absolute top-full right-0 w-72 sm:w-80 bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-slate-100 dark:border-slate-800 border-t-2 border-t-amber-500 py-2.5 animate-fade-in z-50 backdrop-blur-md">
                      {item.children.map((child: Record<string, any>, childIndex: number) => {
                        if (child.isDivider) {
                          return <div key={`divider-${childIndex}`} className="h-px bg-slate-100 dark:bg-slate-800 my-1.5 mx-3" />;
                        }

                        if (child.isGroup) {
                          const hasSubjects = Array.isArray(child.subjects) && child.subjects.length > 0;
                          const isStageOpen = activeStageId === child.id;

                          return (
                            <div
                              key={`stage-${child.id}-${childIndex}`}
                              className="mx-2 my-1"
                              onMouseEnter={() => {
                                if (hasSubjects) setActiveStageId(child.id);
                              }}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (hasSubjects) {
                                    setActiveStageId((prev) => (prev === child.id ? null : child.id));
                                  } else {
                                    navigate(child.link || '#');
                                    setActiveDropdown(null);
                                    setActiveStageId(null);
                                  }
                                }}
                                className={`w-full px-3 py-2 text-xs font-black rounded-xl flex items-center justify-between transition-all cursor-pointer select-none text-right ${
                                  isStageOpen
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-slate-100/90 dark:bg-slate-800/90 text-indigo-950 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-700 dark:hover:text-indigo-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm shrink-0">📂</span>
                                  <span className="truncate">{child.label}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                                      isStageOpen
                                        ? 'bg-white/20 text-white'
                                        : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                                    }`}
                                  >
                                    مرحلة
                                  </span>
                                  {hasSubjects ? (
                                    <ChevronDown
                                      size={14}
                                      className={`transition-transform duration-200 ${
                                        isStageOpen ? 'rotate-180 text-white' : 'text-gray-400'
                                      }`}
                                    />
                                  ) : null}
                                </div>
                              </button>

                              {hasSubjects && isStageOpen ? (
                                <div className="mt-1 mr-2 pr-3 py-1 space-y-0.5 border-r-2 border-indigo-500/70 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-lg animate-fade-in">
                                  {child.subjects.map((sub: Record<string, any>) => (
                                    <Link
                                      key={`sub-${sub.id}`}
                                      to={sub.link}
                                      onClick={() => {
                                        setActiveDropdown(null);
                                        setActiveStageId(null);
                                      }}
                                      className="block px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white/80 dark:hover:bg-slate-800/80 rounded-md transition-all flex items-center gap-2"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                      <span className="truncate">{sub.label}</span>
                                    </Link>
                                  ))}
                                  <Link
                                    to={child.link}
                                    onClick={() => {
                                      setActiveDropdown(null);
                                      setActiveStageId(null);
                                    }}
                                    className="block px-2.5 py-1.5 text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline pt-1 border-t border-indigo-100/70 dark:border-indigo-900/40"
                                  >
                                    استعراض كامل {child.label} ←
                                  </Link>
                                </div>
                              ) : null}
                            </div>
                          );
                        }

                        if (child.isMockExam || child.id?.includes('mock')) {
                          return (
                            <Link
                              key={`child-${child.id}-${childIndex}`}
                              to={child.link || '#'}
                              onClick={() => {
                                setActiveDropdown(null);
                                setActiveStageId(null);
                              }}
                              className="mx-2 my-1.5 px-3 py-2 text-xs font-black rounded-xl bg-gradient-to-r from-purple-50 via-purple-100/50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 text-purple-900 dark:text-purple-200 border border-purple-200/80 dark:border-purple-800/60 flex items-center justify-between shadow-xs hover:from-purple-100 hover:to-indigo-100 transition-all hover:scale-[1.01]"
                            >
                              <span className="flex items-center gap-2">
                                <Award size={15} className="text-purple-600 dark:text-purple-400 shrink-0" />
                                {child.label}
                              </span>
                              <span className="text-[10px] bg-purple-600 text-white font-black px-1.5 py-0.5 rounded-full shadow-xs">محاكاة</span>
                            </Link>
                          );
                        }

                        if (child.isPackage || child.id?.includes('packages')) {
                          return (
                            <Link
                              key={`child-${child.id}-${childIndex}`}
                              to={child.link || '#'}
                              onClick={() => {
                                setActiveDropdown(null);
                                setActiveStageId(null);
                              }}
                              className="mx-2 my-1.5 px-3 py-2 text-xs font-black rounded-xl bg-gradient-to-r from-amber-50 via-amber-100/50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/60 flex items-center justify-between shadow-xs hover:from-amber-100 hover:to-orange-100 transition-all hover:scale-[1.01]"
                            >
                              <span className="flex items-center gap-2">
                                <Gift size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                {child.label}
                              </span>
                              <span className="text-[10px] bg-amber-500 text-white font-black px-1.5 py-0.5 rounded-full shadow-xs">عرض خاص</span>
                            </Link>
                          );
                        }

                        return (
                          <Link
                            key={`child-${child.id}-${childIndex}`}
                            to={child.link || '#'}
                            onClick={() => {
                              setActiveDropdown(null);
                              setActiveStageId(null);
                            }}
                            className="block py-2 text-xs font-bold transition-colors text-slate-700 dark:text-slate-200 hover:bg-indigo-50/70 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 px-3 mx-2 rounded-lg"
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle />

            <button
              onClick={() => setIsSearchOpen(true)}
              className="text-gray-500 hover:text-amber-500 transition-colors dark:text-gray-300"
              title="بحث (Ctrl+K)"
              aria-label="فتح البحث"
            >
              <Search size={20} />
            </button>

            <Link to="/cart" className="relative text-gray-500 hover:text-amber-500 transition-colors dark:text-gray-300">
              <ShoppingCart size={20} />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {cartItems.length}
              </span>
            </Link>

            <div className="relative">
              {user ? (
                <>
                  <div className="flex items-center gap-1 sm:gap-2 bg-slate-50 dark:bg-slate-800/80 pl-1 pr-1 sm:pr-3 py-1 rounded-full border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
                    {/* جرس الإشعارات مدمج على بطاقة الحساب والاسم لتوفير المساحة الأفقية */}
                    <NotificationBell />

                    <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-700" />

                    <button
                      onClick={() => setIsUserMenuOpen((value) => !value)}
                      className="flex items-center gap-2 hover:opacity-85 transition-opacity"
                      aria-label="قائمة المستخدم"
                    >
                      <div className="hidden lg:block text-right">
                        <span className="block text-[10px] text-gray-400 font-medium leading-none">{text.account}</span>
                        <span className="block text-xs font-black text-gray-800 dark:text-gray-100 leading-tight mt-0.5 max-w-[200px] xl:max-w-[260px] truncate" title={user.displayName || text.guest}>
                          {user.displayName || text.guest}
                        </span>
                      </div>
                      <img
                        src={user.photoURL}
                        alt="User"
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-sm shrink-0"
                      />
                    </button>
                  </div>

                  {isUserMenuOpen ? (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white shadow-xl rounded-xl border border-gray-100 py-2 animate-fade-in z-50">
                      <div className="px-4 py-3 border-b border-gray-100 mb-2">
                        <p className="font-bold text-gray-800">{user.displayName || text.guest}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>

                      {user.role === 'teacher' ? (
                        <>
                          {(user.schoolId || (user.groupIds && user.groupIds.length > 0) || !((user as any).managedPathIds?.length)) && (
                            <UserMenuItem to="/school-teacher-dashboard" icon={<LayoutGrid size={18} />} label="لوحة معلم المدرسة" />
                          )}
                          {Boolean((user as any).managedPathIds?.length || (user as any).managedSubjectIds?.length) && (
                            <UserMenuItem to="/instructor-dashboard" icon={<BookOpen size={18} />} label="لوحة مدرب المنصة" />
                          )}
                        </>
                      ) : (
                        <UserMenuItem to={getDashboardPathForRole(user.role, user)} icon={<LayoutGrid size={18} />} label={text.dashboard} />
                      )}
                      <UserMenuItem to="/dashboard?tab=my-courses" icon={<BookOpen size={18} />} label={text.courses} />
                      <UserMenuItem to="/my-quizzes" icon={<FileText size={18} />} label={text.quizzes} />
                      <UserMenuItem to="/achievements" icon={<Award size={18} />} label={text.achievements} />
                      <UserMenuItem to="/profile" icon={<User size={18} />} label={text.profile} />

                      {isPrivilegedUser ? (
                        <UserMenuItem
                          to={getDashboardPathForRole(user.role)}
                          icon={<Shield size={18} />}
                          label={user.role === 'admin' ? text.adminPanel : text.dashboard}
                        />
                      ) : null}

                      <div className="border-t border-gray-100 mt-2 pt-2">
                        <button
                          data-logout-explicit="true"
                          onClick={async () => {
                            await logout();
                            setIsUserMenuOpen(false);
                            navigate('/?auth=login', { replace: true });
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors"
                        >
                          <LogOut size={18} />
                          {text.logout}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 sm:px-4 py-2 rounded-lg font-bold transition-colors"
                >
                  <LogIn size={18} />
                  <span className="hidden sm:inline">{text.login}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div className="md:hidden fixed inset-0 z-40 bg-white overflow-y-auto pb-20 animate-fade-in">
          <div className="p-4 pt-20">
            {navigationMenu.map((item, index) => {
              const icon = item.iconName ? NavIcons[item.iconName] : null;

              return (
                <div key={`mobile-nav-${item.id}-${index}`} className="mb-4">
                  <Link
                    to={item.link || '#'}
                    data-mobile-nav={String(item.id || '')}
                    className="flex items-center gap-3 font-bold text-lg text-gray-800 mb-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {icon ? <span className="text-amber-500">{icon}</span> : null}
                    {item.label}
                  </Link>

                  {item.children ? (
                    <div className="pr-9 space-y-2 border-r-2 border-gray-100 mr-1">
                      {item.children
                        .filter((child: Record<string, any>) => !child.isDivider)
                        .map((child: Record<string, any>, childIndex: number) => {
                          if (child.isGroup) {
                            const hasSubjects = Array.isArray(child.subjects) && child.subjects.length > 0;
                            const isExpanded = expandedMobileStageId === child.id;

                            return (
                              <div key={`mobile-stage-${child.id}-${childIndex}`} className="my-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (hasSubjects) {
                                      setExpandedMobileStageId((prev) => (prev === child.id ? null : child.id));
                                    } else {
                                      navigate(child.link || '#');
                                      setIsMobileMenuOpen(false);
                                    }
                                  }}
                                  className={`w-full py-2 px-3 text-xs font-black rounded-lg flex items-center justify-between transition-colors text-right ${
                                    isExpanded
                                      ? 'bg-indigo-600 text-white shadow-xs'
                                      : 'bg-slate-100 dark:bg-slate-800 text-indigo-950 dark:text-indigo-200'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <span>📂</span>
                                    <span>{child.label}</span>
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                                        isExpanded
                                          ? 'bg-white/20 text-white'
                                          : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                                      }`}
                                    >
                                      مرحلة
                                    </span>
                                    {hasSubjects ? (
                                      <ChevronDown
                                        size={14}
                                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-180 text-white' : 'text-gray-400'}`}
                                      />
                                    ) : null}
                                  </span>
                                </button>

                                {hasSubjects && isExpanded ? (
                                  <div className="mr-3 pr-3 py-1 space-y-1 border-r-2 border-indigo-400 dark:border-indigo-600 mt-1">
                                    {child.subjects.map((sub: Record<string, any>) => (
                                      <Link
                                        key={`mobile-sub-${sub.id}`}
                                        to={sub.link}
                                        className="block py-1.5 px-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                      >
                                        • {sub.label}
                                      </Link>
                                    ))}
                                    <Link
                                      to={child.link}
                                      className="block py-1 px-2 text-[11px] font-black text-indigo-600 dark:text-indigo-400"
                                      onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                      استعراض كامل {child.label} ←
                                    </Link>
                                  </div>
                                ) : null}
                              </div>
                            );
                          }
                          if (child.isMockExam || child.id?.includes('mock')) {
                            return (
                              <Link
                                key={`mobile-child-${child.id}-${childIndex}`}
                                to={child.link || '#'}
                                className="flex items-center justify-between py-2 px-3 text-xs font-black rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800 my-1"
                                onClick={() => setIsMobileMenuOpen(false)}
                              >
                                <span className="flex items-center gap-2">
                                  <Award size={14} className="text-purple-600" />
                                  {child.label}
                                </span>
                                <span className="text-[10px] bg-purple-600 text-white font-bold px-1.5 py-0.5 rounded">محاكاة</span>
                              </Link>
                            );
                          }
                          if (child.isPackage || child.id?.includes('packages')) {
                            return (
                              <Link
                                key={`mobile-child-${child.id}-${childIndex}`}
                                to={child.link || '#'}
                                className="flex items-center justify-between py-2 px-3 text-xs font-black rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 my-1"
                                onClick={() => setIsMobileMenuOpen(false)}
                              >
                                <span className="flex items-center gap-2">
                                  <Gift size={14} className="text-amber-600" />
                                  {child.label}
                                </span>
                                <span className="text-[10px] bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded">عرض</span>
                              </Link>
                            );
                          }
                          return (
                            <Link
                              key={`mobile-child-${child.id}-${childIndex}`}
                              to={child.link || '#'}
                              className="block py-1.5 px-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-indigo-600"
                              onClick={() => setIsMobileMenuOpen(false)}
                            >
                              {child.label}
                            </Link>
                          );
                        })}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {!user ? (
              <div className="mt-6 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  data-mobile-login="true"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsLoginModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-bold text-white transition-colors hover:bg-emerald-600"
                >
                  <LogIn size={18} />
                  <span>{text.login}</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isLoginModalOpen ? (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 animate-fade-in transition-all">

            {/* Header */}
            <div className="flex justify-between items-center px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white">
                  {isSignUp ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5 font-medium">
                  {isSignUp ? 'انضم إلى منصة المئة وابدأ رحلة تميزك اليوم' : 'مرحباً بعودتك! اختر الطريقة الأنسب لك'}
                </p>
              </div>
              <button
                id="login-modal-close"
                onClick={() => {
                  setIsLoginModalOpen(false);
                  setAuthError('');
                  setSmartInput('');
                  setSmartPassword('');
                  setSignupName('');
                  setEmail('');
                  setPassword('');
                  setConfirmPassword('');
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                  setOtpSent(false);
                  setOtpCode('');
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                aria-label="إغلاق النافذة"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Error Banner */}
              {authError ? (
                <div id="login-error-banner" className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-900/50 flex items-start gap-2">
                  <span className="text-red-400 mt-0.5 shrink-0">⚠️</span>
                  <span className="leading-snug">{authError}</span>
                </div>
              ) : null}

              {/* Google 1-Click Auth (Available in both Login and Sign-up) */}
              <button
                id="login-google-btn"
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                    setIsLoginModalOpen(false);
                  } catch (error) {
                    const message = error instanceof Error ? error.message : text.authFallbackError;
                    setAuthError(message);
                  }
                }}
                className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-slate-700/50 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-xl transition-all shadow-sm"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>{isSignUp ? 'التسجيل السريع بحساب Google' : 'الدخول بحساب Google'}</span>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-400 font-medium">
                  {isSignUp ? 'أو أنشئ حسابك بالبريد الإلكتروني' : 'أو بالبيانات المسجلة'}
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>

              {!isSignUp ? (
                /* LOGIN FORM */
                <form id="smart-login-form" onSubmit={handleSmartLogin} className="space-y-3.5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      البريد أو الجوال أو رقم الهوية
                    </label>
                    <div className="relative">
                      <input
                        id="smart-login-input"
                        type="text"
                        inputMode="email"
                        value={smartInput}
                        onChange={(e) => {
                          setSmartInput(e.target.value);
                          setAuthError('');
                          setOtpSent(false);
                          setOtpCode('');
                        }}
                        className="w-full pr-4 pl-24 py-3 border-2 border-gray-200 dark:border-gray-700 dark:bg-slate-800 dark:text-white rounded-xl focus:ring-0 focus:border-emerald-400 outline-none transition-colors"
                        dir="auto"
                        placeholder="user@example.com أو 05xxxxxxxx أو 10xxxxxxx"
                        autoComplete="username"
                        autoFocus
                      />
                      {smartInput.trim().length > 3 && (
                        <span
                          className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold px-2 py-0.5 rounded-full select-none ${
                            smartInputType === 'email'
                              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                              : smartInputType === 'nationalId'
                              ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                              : smartInputType === 'phone'
                              ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                          }`}
                        >
                          {smartInputType === 'email'
                            ? '✉ إيميل'
                            : smartInputType === 'nationalId'
                            ? '🪪 هوية'
                            : smartInputType === 'phone'
                            ? '📱 جوال'
                            : '...'}
                        </span>
                      )}
                    </div>
                    {/* Guidance tip when typing numbers */}
                    {/^\d+$/.test(smartInput.trim()) && (
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {smartInputType === 'nationalId'
                          ? '✓ رقم هوية وطنية معتمد (10 أرقام تبدأ بـ 1 أو 2)'
                          : smartInputType === 'phone'
                          ? '✓ رقم جوال'
                          : 'الهوية الوطنية: 10 أرقام تبدأ بـ 1 أو 2 | الجوال: يبدأ بـ 05'}
                      </p>
                    )}
                  </div>

                  {/* Password Input: STABLY VISIBLE TO PREVENT LAYOUT SHIFT */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">كلمة المرور</label>
                      <Link
                        to="/forgot-password"
                        onClick={() => setIsLoginModalOpen(false)}
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                      >
                        {text.forgotPassword}
                      </Link>
                    </div>
                    <div className="relative">
                      <input
                        id="smart-login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={smartPassword}
                        onChange={(e) => setSmartPassword(e.target.value)}
                        className="w-full pr-4 pl-11 py-3 border-2 border-gray-200 dark:border-gray-700 dark:bg-slate-800 dark:text-white rounded-xl focus:ring-0 focus:border-emerald-400 outline-none text-left transition-colors"
                        dir="ltr"
                        placeholder="••••••••"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 focus:outline-none"
                        aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    id="smart-login-submit"
                    type="submit"
                    disabled={
                      smartLoginLoading ||
                      smartInput.trim().length < 4 ||
                      !smartPassword.trim()
                    }
                    className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white font-black py-3 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-base"
                  >
                    {smartLoginLoading && !otpSent ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        جارٍ تسجيل الدخول...
                      </span>
                    ) : (
                      'تسجيل الدخول'
                    )}
                  </button>

                  {/* WhatsApp OTP section when phone number is typed */}
                  {smartInputIsPhone && smartInput.trim().length > 3 && (
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
                      <p className="text-xs text-center text-gray-400 font-medium">أو الدخول السريع عبر رمز واتساب</p>

                      {!otpSent ? (
                        <button
                          id="smart-otp-send-btn"
                          type="button"
                          disabled={smartLoginLoading}
                          onClick={async () => {
                            setAuthError('');
                            setSmartLoginLoading(true);
                            try {
                              await api.whatsappStartLogin(smartInput.trim());
                              setOtpSent(true);
                            } catch (err) {
                              setAuthError(err instanceof Error ? err.message : 'حدث خطأ في إرسال الرمز');
                            } finally {
                              setSmartLoginLoading(false);
                            }
                          }}
                          className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold py-2.5 rounded-xl transition-all disabled:opacity-50 text-sm shadow-sm"
                        >
                          {smartLoginLoading ? (
                            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          )}
                          إرسال رمز التحقق على واتساب
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <input
                            id="smart-otp-code"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-4 py-3 border-2 border-[#25D366] rounded-xl focus:ring-0 focus:border-[#1ebe5d] outline-none text-center text-2xl font-mono tracking-widest bg-white dark:bg-slate-800 dark:text-white"
                            dir="ltr"
                            placeholder="• • • • • •"
                            autoFocus
                          />
                          <p className="text-xs text-[#25D366] text-center font-medium">✓ تم إرسال الرمز على واتساب بنجاح</p>
                          <button
                            id="smart-otp-verify-btn"
                            type="button"
                            disabled={smartLoginLoading || otpCode.length !== 6}
                            onClick={async () => {
                              setAuthError('');
                              setSmartLoginLoading(true);
                              try {
                                await api.whatsappVerifyLogin(smartInput.trim(), otpCode.trim());
                                window.location.reload();
                              } catch (err) {
                                setAuthError(err instanceof Error ? err.message : 'رمز التحقق غير صحيح');
                                setSmartLoginLoading(false);
                              }
                            }}
                            className="w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold py-2.5 rounded-xl transition-all disabled:opacity-50 text-sm shadow-sm"
                          >
                            {smartLoginLoading ? (
                              <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />جارٍ التحقق...</span>
                            ) : 'تحقق ودخول'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setOtpSent(false); setOtpCode(''); }}
                            className="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-1 font-medium"
                          >
                            إعادة إرسال الرمز
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </form>
              ) : null}

              {isSignUp ? (
                /* SIGN-UP FORM */
                <form id="signup-form" onSubmit={handleEmailAuth} className="space-y-3.5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      الاسم الكامل <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      aria-label="Name"
                      required
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-slate-800 dark:text-white rounded-xl focus:border-emerald-400 outline-none transition-colors"
                      placeholder="الاسم الثلاثي للطالب"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      البريد الإلكتروني <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      aria-label="Email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-slate-800 dark:text-white rounded-xl focus:border-emerald-400 outline-none text-left transition-colors"
                      dir="ltr"
                      placeholder="user@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      كلمة المرور <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        aria-label="Password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pr-4 pl-11 py-2.5 border-2 border-gray-200 dark:border-gray-700 dark:bg-slate-800 dark:text-white rounded-xl focus:border-emerald-400 outline-none text-left transition-colors"
                        dir="ltr"
                        placeholder="8 أحرف على الأقل"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 focus:outline-none"
                        aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    {/* Password criteria indicators */}
                    <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                      <span
                        className={`inline-flex items-center gap-1 font-medium transition-colors ${
                          password.length >= 8
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {password.length >= 8 ? '✓' : '○'} 8 أحرف فأكثر
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-medium transition-colors ${
                          /[A-Za-z]/.test(password) && /\d/.test(password)
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {/[A-Za-z]/.test(password) && /\d/.test(password) ? '✓' : '○'} حروف وأرقام
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      تأكيد كلمة المرور <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        aria-label="Confirm Password"
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full pr-4 pl-11 py-2.5 border-2 rounded-xl focus:outline-none text-left transition-colors dark:bg-slate-800 dark:text-white ${
                          confirmPassword && password !== confirmPassword
                            ? 'border-red-300 focus:border-red-400'
                            : confirmPassword && password === confirmPassword
                            ? 'border-emerald-300 focus:border-emerald-400'
                            : 'border-gray-200 dark:border-gray-700 focus:border-emerald-400'
                        }`}
                        dir="ltr"
                        placeholder="أعد كتابة كلمة المرور"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 focus:outline-none"
                        aria-label={showConfirmPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <p className="mt-1 text-xs text-red-500 font-medium">كلمتا المرور غير متطابقتين</p>
                    )}
                  </div>

                  {/* Terms & Privacy */}
                  <p className="text-[11px] text-gray-400 dark:text-gray-400 leading-relaxed text-center">
                    بإنشائك للحساب فإنك توافق على{' '}
                    <Link to="/terms" onClick={() => setIsLoginModalOpen(false)} className="text-emerald-600 dark:text-emerald-400 underline underline-offset-2">
                      شروط الاستخدام
                    </Link>{' '}
                    و{' '}
                    <Link to="/privacy" onClick={() => setIsLoginModalOpen(false)} className="text-emerald-600 dark:text-emerald-400 underline underline-offset-2">
                      سياسة الخصوصية
                    </Link>
                  </p>

                  <button
                    type="submit"
                    disabled={isAuthSubmitting}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white font-black py-3 rounded-xl transition-all disabled:opacity-60 shadow-sm text-base"
                  >
                    {isAuthSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        جارٍ إنشاء الحساب...
                      </span>
                    ) : (
                      'إنشاء حساب جديد'
                    )}
                  </button>
                </form>
              ) : null}

              {/* Modal Footer / Switch View */}
              <div className="text-center pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  id="toggle-signup-login"
                  onClick={() => {
                    setIsSignUp((v) => !v);
                    setAuthError('');
                    setSmartInput('');
                    setSmartPassword('');
                    setSignupName('');
                    setEmail('');
                    setPassword('');
                    setConfirmPassword('');
                    setShowPassword(false);
                    setShowConfirmPassword(false);
                  }}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium transition-colors"
                >
                  {isSignUp ? (
                    <span>
                      لديك حساب بالفعل؟ <span className="font-bold text-emerald-600 dark:text-emerald-400 underline underline-offset-2">تسجيل الدخول</span>
                    </span>
                  ) : (
                    <span>
                      ليس لديك حساب في المنصة؟ <span className="font-bold text-emerald-600 dark:text-emerald-400 underline underline-offset-2">إنشاء حساب جديد</span>
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <SearchModal open={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  );
};

const UserMenuItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
  <Link
    to={to}
    className="flex items-center gap-3 px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors font-medium"
  >
    {icon}
    {label}
  </Link>
);
