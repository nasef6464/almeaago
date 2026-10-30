import React from 'react';
import { ChevronLeft, ArrowRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  active?: boolean;
}

export interface AdminBreadcrumbHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  className?: string;
  testId?: string;
}

export const AdminBreadcrumbHeader: React.FC<AdminBreadcrumbHeaderProps> = ({
  breadcrumbs,
  title,
  subtitle,
  icon,
  badge,
  actions,
  onBack,
  backLabel,
  className = '',
  testId,
}) => {
  return (
    <header
      data-testid={testId}
      className={`rounded-3xl border border-gray-100 bg-white p-5 sm:p-6 shadow-xs mb-6 transition-all ${className}`}
      dir="rtl"
    >
      {/* ── شريط مسار التصفح (Breadcrumbs Trail) ── */}
      {breadcrumbs.length > 0 && (
        <nav
          aria-label="مسار التنقل"
          className="flex items-center gap-1.5 text-xs text-gray-500 font-bold flex-wrap mb-4"
        >
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1 || item.active;
            return (
              <React.Fragment key={`${item.label}-${index}`}>
                {index > 0 && (
                  <ChevronLeft size={13} className="text-gray-300 shrink-0 select-none" />
                )}
                {item.onClick && !isLast ? (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="text-gray-500 hover:text-indigo-600 font-bold transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ) : (
                  <span
                    className={`font-black ${
                      isLast ? 'text-indigo-900 bg-indigo-50/70 px-2 py-0.5 rounded-lg' : 'text-gray-500'
                    }`}
                  >
                    {item.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* ── الرأس الأساسي (Main Header) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          {icon && (
            <div className="shrink-0 flex items-center justify-center rounded-2xl p-2.5 bg-gray-50 border border-gray-100">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">
                {title}
              </h1>
              {badge}
            </div>
            {subtitle && (
              <p className="mt-1 text-xs sm:text-sm text-gray-500 font-medium leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* ── الإجراءات وزر الرجوع ── */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          {actions}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-black text-gray-700 shadow-xs hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer"
            >
              <ArrowRight size={14} />
              <span>{backLabel || 'رجوع'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
