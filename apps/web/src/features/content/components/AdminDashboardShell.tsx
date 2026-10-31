import {
  Bell,
  BarChart3,
  ChevronDown,
  BrainCircuit,
  BookOpen,
  Award,
  Boxes,
  Building2,
  CheckCircle2,
  Database,
  HelpCircle,
  Layers,
  Library,
  LayoutDashboard,
  Megaphone,
  Menu,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Radio,
  ShoppingCart,
  Target,
  User,
  Users,
  Type,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { HOMEPAGE_ADMIN_HREF,isHomepageLocation,buildHomepageHref, PLATFORM_FONTS_ADMIN_HREF, isPlatformFontsLocation, buildPlatformFontsHref } from '../../presentation/navigation';

interface AdminDashboardShellProps {
  children: ReactNode;
}

const navItems = [
  { label: 'نظرة عامة', icon: LayoutDashboard, href: '/admin-dashboard' },
  { label: 'إدارة المحتوى التعليمي', icon: BookOpen, href: '/admin-dashboard/content' },
  { label: 'إدارة المسارات', icon: Boxes, href: '/admin-dashboard/taxonomy' },
  { label: 'مركز التأسيس', icon: Target, href: '/admin-dashboard/content?tab=foundation' },
  { label: 'مركز المهارات', icon: Award, href: '/admin-dashboard?tab=skills' },
  { label: 'اعتماد المحتوى', icon: CheckCircle2, href: '/admin-dashboard/content?tab=review' },
  { label: 'مركز بنك الأسئلة', icon: HelpCircle, href: '/admin-dashboard/questions' },
  { label: 'مركز الدروس', icon: BookOpen, href: '/admin-dashboard/content?tab=lessons' },
  { label: 'مركز المكتبة وملفات الدعم', icon: Library, href: '/admin-dashboard/content?tab=library' },
  { label: 'مركز الاختبارات', icon: HelpCircle, href: '/admin-dashboard/assessments' },
  { label: 'التجارة والصلاحيات', icon: ShoppingCart, href: '/admin-dashboard/commerce' },
  { label: 'إدارة المستخدمين', icon: Users, href: '/admin-dashboard/users' },
  { label: 'إدارة المدربين', icon: User, href: '/admin-dashboard/trainers' },
  { label: 'تشغيل المدارس', icon: Building2, href: '/admin-dashboard/schools' },
  { label: 'مركز الإشعارات', icon: Bell, href: '/admin-dashboard/notifications' },
  { label: 'الفصل الذكي', icon: Radio, href: '/admin-dashboard/classroom' },
  { label: 'إدارة الذكاء الاصطناعي', icon: BrainCircuit, href: '/admin-dashboard/ai' },
  { label: 'التقارير والتحليلات', icon: BarChart3, href: '/admin-dashboard/reports' },
  { label: 'مركز العمليات والتدقيق', icon: ShieldCheck, href: '/admin-dashboard/operations' },
  { label: 'إدارة الصفحة الرئيسية', icon: Settings, href: HOMEPAGE_ADMIN_HREF },
  { label: 'إدارة الإعلانات', icon: Megaphone, href: '/admin-dashboard/announcements' },
  { label: 'إدارة خطوط المنصة', icon: Type, href: PLATFORM_FONTS_ADMIN_HREF },
  { label: 'إدارة التكاملات والتسجيل', icon: Layers, href: '/admin-dashboard/integrations' },
  { label: 'النسخ الاحتياطي', icon: Database, href: '/admin-dashboard/backups' },
  { label: 'الإعدادات العامة', icon: Settings, href: '/admin-dashboard/integrations' },
];

function Brand() {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2">
      <div className="leading-tight">
        <div className="text-xl font-black sm:text-2xl">
          <span className="text-blue-900">منصة</span>
          <span className="mx-1 text-amber-500">المئة</span>
        </div>
        <div className="mt-0.5 text-[10px] font-bold text-gray-400 sm:text-xs">قدرات & تحصيلي</div>
      </div>
    </Link>
  );
}

export function AdminDashboardShell({ children }: AdminDashboardShellProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [plannedOpen, setPlannedOpen] = useState(false);
  const visibleItems = navItems.filter((item) => (item.href !== PLATFORM_FONTS_ADMIN_HREF && item.href !== HOMEPAGE_ADMIN_HREF) || user?.roles.includes('admin'));
  const availableItems = visibleItems.filter((item) => Boolean(item.href));
  const plannedItems = visibleItems.filter((item) => !item.href);
  const isActiveHref = (href: string) => {
    if (href === HOMEPAGE_ADMIN_HREF) return isHomepageLocation(location);
    if (href === PLATFORM_FONTS_ADMIN_HREF) return isPlatformFontsLocation(location);
    if (href.includes('?')) {
      const [path, search] = href.split('?');
      if (location.pathname !== path) return false;
      const targetParams = new URLSearchParams(search);
      const currentParams = new URLSearchParams(location.search);
      for (const [k, v] of targetParams.entries()) {
        if (currentParams.get(k) !== v) return false;
      }
      return true;
    }
    if (href === '/admin-dashboard') {
      return location.pathname === href && !isPlatformFontsLocation(location) && !isHomepageLocation(location) && !location.search;
    }
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };
  const activeItem = availableItems.find((item) => item.href ? isActiveHref(item.href) : false);

  const sidebar = (
    <aside data-testid="admin-dashboard-sidebar" className="flex h-full w-64 flex-col border-l border-gray-100 bg-white sm:w-[270px]">
      <div className="border-b border-gray-100 px-6 py-6">
        <h2 className="text-xl font-black text-gray-900">لوحة الإدارة</h2>
        <p className="mt-1 text-xs font-bold text-gray-400">التحكم الكامل بالمنصة</p>
      </div>
      <nav aria-label="تنقل لوحة الإدارة" className="flex-1 overflow-y-auto py-3">
        <div className="px-5 pb-2 text-[10px] font-black tracking-wide text-gray-400">الأقسام المتاحة</div>
        {availableItems.map((item) => {
          const Icon = item.icon;
          const active = item.href ? isActiveHref(item.href) : false;
          const classes = active
            ? 'border-r-4 border-amber-500 bg-amber-50 text-amber-800'
            : 'border-r-4 border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-800';
          return (
            <Link
              key={item.label}
              to={item.href === HOMEPAGE_ADMIN_HREF ? buildHomepageHref(location) : item.href === PLATFORM_FONTS_ADMIN_HREF ? buildPlatformFontsHref(location) : item.href!}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-5 py-3 text-sm font-bold transition-colors ${classes}`}
            >
              <Icon size={18} className="shrink-0" />
              <span className="min-w-0 flex-1">{item.label}</span>
            </Link>
          );
        })}

        {plannedItems.length ? (
          <div className="mx-4 mt-3 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => setPlannedOpen((value) => !value)}
              className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-xs font-black text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              aria-expanded={plannedOpen}
            >
              <span>أقسام قيد النقل ({plannedItems.length})</span>
              <ChevronDown size={16} className={`transition-transform ${plannedOpen ? 'rotate-180' : ''}`} />
            </button>
            {plannedOpen ? (
              <div className="mt-1 space-y-0.5">
                {plannedItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold text-gray-400"
                      title="هذه الشاشة ستُنقل في مرحلتها."
                    >
                      <Icon size={16} className="shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </nav>
    </aside>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white">
        <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-700 lg:hidden"
              aria-label="فتح قائمة الإدارة"
            >
              {menuOpen ? <X size={20} /> : <Menu size={22} />}
            </button>
            <Brand />
          </div>

          <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
            <div className="min-w-0 rounded-2xl bg-gray-50 px-5 py-2 text-center ring-1 ring-gray-100">
              <div className="text-[10px] font-black text-gray-400">لوحة الإدارة</div>
              <div className="mt-0.5 max-w-md truncate text-sm font-black text-gray-800">{activeItem?.label || 'نظرة عامة'}</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button type="button" className="hidden h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 sm:inline-flex" aria-label="الوضع الليلي"><Moon size={17} /></button>
            <button type="button" className="hidden h-9 w-9 items-center justify-center rounded-xl text-gray-500 sm:inline-flex" aria-label="بحث"><Search size={18} /></button>
            <button type="button" className="relative hidden h-9 w-9 items-center justify-center rounded-xl text-gray-500 sm:inline-flex" aria-label="السلة">
              <ShoppingCart size={18} />
              <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-rose-500" />
            </button>
            <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-500" aria-label="الإشعارات"><Bell size={18} /></button>
            <div className="hidden items-center gap-2 rounded-xl border border-gray-100 px-2 py-1.5 sm:flex">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-100 to-blue-200" />
              <div className="max-w-28 truncate text-xs font-black text-gray-700">{user?.name || 'مدير المنصة'}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)]">
        <div className="hidden shrink-0 lg:block"><div className="sticky top-16 h-[calc(100vh-4rem)]">{sidebar}</div></div>

        {menuOpen ? (
          <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMenuOpen(false)}>
            <div data-testid="admin-mobile-drawer" className="absolute right-0 top-16 h-[calc(100vh-4rem)] max-w-[86vw]" onClick={(event) => event.stopPropagation()}>
              {sidebar}
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="px-3 py-4 sm:px-5 lg:px-6 xl:px-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-sm">
                <span className="inline-block h-2 w-2 rounded-full border border-white/70" />
                تغيير الدور
              </div>
              <div className="max-w-full truncate rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs font-black text-gray-600 shadow-sm lg:hidden">
                {activeItem?.label || 'نظرة عامة'}
              </div>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
