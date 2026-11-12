import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, Zap, BookOpen, Award, Compass } from 'lucide-react';

export interface StudentNextActionStripProps {
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref?: string;
  onPrimaryClick?: () => void;
  kicker?: string;
  icon?: React.ReactNode;
  tone?: 'indigo' | 'amber' | 'emerald' | 'rose';
  secondaryLabel?: string;
  secondaryHref?: string;
  onSecondaryClick?: () => void;
}

const toneStyles = {
  indigo: {
    shell: 'border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/40',
    badge: 'bg-indigo-100 text-indigo-700',
    button: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20',
    dot: 'bg-indigo-600',
    iconBg: 'bg-indigo-600 text-white',
  },
  amber: {
    shell: 'border-amber-100 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40',
    badge: 'bg-amber-100 text-amber-800',
    button: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
    dot: 'bg-amber-600',
    iconBg: 'bg-amber-500 text-white',
  },
  emerald: {
    shell: 'border-emerald-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/40',
    badge: 'bg-emerald-100 text-emerald-800',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20',
    dot: 'bg-emerald-600',
    iconBg: 'bg-emerald-600 text-white',
  },
  rose: {
    shell: 'border-rose-100 bg-gradient-to-r from-rose-50/80 via-white to-rose-50/40',
    badge: 'bg-rose-100 text-rose-800',
    button: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20',
    dot: 'bg-rose-600',
    iconBg: 'bg-rose-600 text-white',
  },
};

export const StudentNextActionStrip: React.FC<StudentNextActionStripProps> = ({
  title,
  description,
  primaryLabel,
  primaryHref,
  onPrimaryClick,
  kicker = 'الموجّه الذكي: خطوتك القادمة',
  icon,
  tone = 'indigo',
  secondaryLabel,
  secondaryHref,
  onSecondaryClick,
}) => {
  const styles = toneStyles[tone] || toneStyles.indigo;

  return (
    <section
      aria-label="خطوة الطالب التالية"
      data-testid="student-next-action-strip"
      className={`rounded-3xl border p-4 sm:p-5 shadow-xs transition hover:shadow-md ${styles.shell}`}
      dir="rtl"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left Side: Icon + Texts */}
        <div className="flex items-start sm:items-center gap-3.5 text-right">
          <div
            className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center font-black shadow-xs ${styles.iconBg}`}
          >
            {icon || <Compass size={20} />}
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span
                data-testid="student-next-action-kicker"
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${styles.badge}`}
              >
                {kicker}
              </span>
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${styles.dot}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${styles.dot}`} />
              </span>
            </div>

            <h3
              data-testid="student-next-action-title"
              className="text-base sm:text-lg font-black text-slate-900 leading-snug tracking-tight"
            >
              {title}
            </h3>

            <p
              data-testid="student-next-action-description"
              className="text-xs sm:text-sm font-bold text-slate-500 max-w-2xl leading-relaxed"
            >
              {description}
            </p>
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0 w-full sm:w-auto">
          {secondaryLabel && (
            secondaryHref ? (
              <Link
                to={secondaryHref}
                data-testid="student-next-action-secondary"
                className="w-full sm:w-auto px-4 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-black text-center transition"
              >
                {secondaryLabel}
              </Link>
            ) : (
              <button
                type="button"
                onClick={onSecondaryClick}
                data-testid="student-next-action-secondary"
                className="w-full sm:w-auto px-4 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-black text-center transition"
              >
                {secondaryLabel}
              </button>
            )
          )}

          {primaryHref ? (
            <Link
              to={primaryHref}
              data-testid="student-next-action-primary"
              className={`w-full sm:w-auto px-6 py-2.5 rounded-2xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition hover:-translate-y-0.5 active:translate-y-0 ${styles.button}`}
            >
              <span>{primaryLabel}</span>
              <ArrowRight size={14} className="rotate-180" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={onPrimaryClick}
              data-testid="student-next-action-primary"
              className={`w-full sm:w-auto px-6 py-2.5 rounded-2xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition hover:-translate-y-0.5 active:translate-y-0 ${styles.button}`}
            >
              <span>{primaryLabel}</span>
              <ArrowRight size={14} className="rotate-180" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
