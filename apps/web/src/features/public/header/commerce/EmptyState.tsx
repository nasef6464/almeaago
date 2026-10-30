import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

type EmptyStateAction = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

type EmptyStateProps = {
  eyebrow?: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  tone?: 'indigo' | 'amber' | 'emerald' | 'slate';
  className?: string;
};

const toneStyles = {
  indigo: {
    shell: 'border-indigo-100 bg-indigo-50/40',
    icon: 'bg-white text-indigo-600',
    eyebrow: 'bg-indigo-50 text-indigo-700',
    primary: 'bg-indigo-600 hover:bg-indigo-700',
    secondary: 'text-indigo-700 hover:bg-indigo-50',
  },
  amber: {
    shell: 'border-amber-100 bg-amber-50/40',
    icon: 'bg-white text-amber-600',
    eyebrow: 'bg-amber-50 text-amber-700',
    primary: 'bg-amber-600 hover:bg-amber-700',
    secondary: 'text-amber-700 hover:bg-amber-50',
  },
  emerald: {
    shell: 'border-emerald-100 bg-emerald-50/40',
    icon: 'bg-white text-emerald-600',
    eyebrow: 'bg-emerald-50 text-emerald-700',
    primary: 'bg-emerald-600 hover:bg-emerald-700',
    secondary: 'text-emerald-700 hover:bg-emerald-50',
  },
  slate: {
    shell: 'border-slate-200 bg-white',
    icon: 'bg-slate-50 text-slate-600',
    eyebrow: 'bg-slate-100 text-slate-700',
    primary: 'bg-slate-900 hover:bg-slate-800',
    secondary: 'text-slate-700 hover:bg-slate-50',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  eyebrow = 'الخطوة التالية',
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  tone = 'indigo',
  className = '',
}) => {
  const styles = toneStyles[tone];

  return (
    <div className={`rounded-3xl border border-dashed p-5 text-center shadow-sm sm:p-6 ${styles.shell} ${className}`}>
      <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ${styles.icon}`}>
        {icon || <ArrowRight size={22} />}
      </div>
      <div className={`mx-auto mt-4 inline-flex rounded-full px-3 py-1 text-xs font-black ${styles.eyebrow}`}>
        {eyebrow}
      </div>
      <h2 className="mx-auto mt-3 max-w-xl text-lg font-black leading-7 text-gray-900 sm:text-xl">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-7 text-gray-500">
        {description}
      </p>
      {(primaryAction || secondaryAction) ? (
        <div className="mt-5 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
          {secondaryAction ? (
            <Link
              to={secondaryAction.href}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white bg-white px-4 text-sm font-black shadow-sm transition ${styles.secondary}`}
            >
              {secondaryAction.icon}
              {secondaryAction.label}
            </Link>
          ) : null}
          {primaryAction ? (
            <Link
              to={primaryAction.href}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black text-white shadow-sm transition ${styles.primary}`}
            >
              {primaryAction.icon}
              {primaryAction.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
