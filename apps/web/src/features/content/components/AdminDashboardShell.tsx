import {
  Bell,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Library,
  Menu,
  Moon,
  Search,
  Settings,
  ShoppingCart,
  Users,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';

interface AdminDashboardShellProps {
  children: ReactNode;
}

const navItems = [
  { label: 'نظرة عامة', icon: BookOpen, href: '/admin-dashboard' },
  { label: 'إدارة المحتوى التعليمي', icon: BookOpen, href: '/admin-dashboard/content', active: true },
  { label: 'اعتماد المحتوى', icon: CheckCircle2 },
  { label: 'مركز الدروس', icon: BookOpen },
  { label: 'مركز المكتبة وملفات الدعم', icon: Library },
  { label: 'مركز الاختبارات', icon: HelpCircle, href: '/admin-dashboard/assessments' },
  { label: 'التجارة والصلاحيات', icon: ShoppingCart, href: '/admin-dashboard/commerce' },
  { label: 'إدارة المستخدمين', icon: Users },
  { label: 'الإعدادات', icon: Settings },
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

  const sidebar = (
    <aside className="flex h-full w-[270px] flex-col border-l border-gray-100 bg-white">
      <div className="border-b border-gray-100 px-6 py-6">
        <h2 className="text-xl font-black text-gray-900">لوحة الإدارة</h2>
        <p className="mt-1 text-xs font-bold text-gray-400">التحكم الكامل بالمنصة</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.href ? location.pathname === item.href : item.active;
          const classes = active
            ? 'border-r-4 border-amber-500 bg-amber-50 text-amber-700'
            : 'border-r-4 border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-800';
          if (item.href) {
            return (
              <Link
                key={item.label}
                to={item.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-5 py-3 text-sm font-bold transition-colors ${classes}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          }
          return (
            <button
              key={item.label}
              type="button"
              disabled
              className={`flex w-full cursor-not-allowed items-center gap-3 px-5 py-3 text-right text-sm font-bold opacity-70 ${classes}`}
              title="هذه الشاشة ستُنقل في مرحلتها."
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
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

          <div className="hidden flex-1 items-center justify-center gap-3 lg:flex">
            <span className="h-3 w-20 rounded-full bg-gray-100" />
            <span className="h-3 w-20 rounded-full bg-gray-100" />
            <span className="h-3 w-24 rounded-full bg-gray-100" />
            <span className="h-3 w-20 rounded-full bg-gray-100" />
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
        <div className="hidden shrink-0 lg:block">{sidebar}</div>

        {menuOpen ? (
          <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMenuOpen(false)}>
            <div className="absolute right-0 top-16 h-[calc(100vh-4rem)]" onClick={(event) => event.stopPropagation()}>
              {sidebar}
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="px-3 py-4 sm:px-5">
            <div className="mb-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-sm">
              <span className="inline-block h-2 w-2 rounded-full border border-white/70" />
              تغيير الدور
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
