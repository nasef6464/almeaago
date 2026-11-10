import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Crown,
  ExternalLink,
  Sparkles,
  Zap,
} from 'lucide-react';

import { useAuth } from '../../auth/state/AuthProvider';
import {
  resolveEffectiveAccess,
  type EffectiveEntitlement,
  type IndividualEntitlement,
  type SchoolContractContext,
} from '../api/membership-types';

interface StudentMembershipBadgeProps {
  overrideAccess?: EffectiveEntitlement;
  compact?: boolean;
  className?: string;
}

export const StudentMembershipBadge: React.FC<StudentMembershipBadgeProps> = ({
  overrideAccess,
  compact = false,
  className = '',
}) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const effective = useMemo<EffectiveEntitlement>(() => {
    if (overrideAccess) return overrideAccess;

    // Extract school context from user if available
    let schoolContract: SchoolContractContext | null = null;
    const uAny = user as any;
    if (uAny && (uAny.schoolName || uAny.schoolId)) {
      schoolContract = {
        schoolName: uAny.schoolName || 'المدرسة الشريكة',
        allowedPaths: uAny.schoolAllowedPaths || ['qudurat_general'],
        validUntil: uAny.schoolValidUntil || undefined,
        logoUrl: uAny.schoolLogoUrl || undefined,
      };
    }

    // Extract individual entitlements from user if available
    const individualEntitlements: IndividualEntitlement[] = [];
    if (user && (user as any).membershipTier) {
      individualEntitlements.push({
        tierId: (user as any).membershipTier,
        validUntil: (user as any).membershipValidUntil,
        allowedPaths: (user as any).membershipAllowedPaths || ['*'],
        status: 'active',
      });
    }

    return resolveEffectiveAccess({
      schoolContract,
      individualEntitlements,
    });
  }, [overrideAccess, user]);

  // Visual Styling per Tier
  const tierStyle = useMemo(() => {
    if (effective.effectiveTierId === 'diamond_vip') {
      return {
        badgeBg: 'bg-gradient-to-r from-amber-500/15 via-yellow-500/15 to-amber-600/15',
        badgeBorder: 'border-amber-300 dark:border-amber-500/40',
        badgeText: 'text-amber-900 dark:text-amber-300',
        icon: <Crown size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />,
        ring: 'ring-1 ring-amber-400/30',
        title: '💎 عضوية VIP الماسية',
      };
    }
    if (effective.effectiveTierId === 'golden_excellence') {
      return {
        badgeBg: 'bg-indigo-50 dark:bg-indigo-950/40',
        badgeBorder: 'border-indigo-300 dark:border-indigo-500/40',
        badgeText: 'text-indigo-900 dark:text-indigo-300',
        icon: <Award size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />,
        ring: 'ring-1 ring-indigo-400/30',
        title: 'باقة التميز الذهبية',
      };
    }
    if (effective.effectiveTierId === 'smart_foundation') {
      return {
        badgeBg: 'bg-blue-50 dark:bg-blue-950/40',
        badgeBorder: 'border-blue-300 dark:border-blue-500/40',
        badgeText: 'text-blue-900 dark:text-blue-300',
        icon: <Zap size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />,
        ring: 'ring-1 ring-blue-400/30',
        title: 'باقة التأسيس الذكي',
      };
    }
    if (effective.hasSchoolSponsorship) {
      return {
        badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
        badgeBorder: 'border-emerald-300 dark:border-emerald-500/40',
        badgeText: 'text-emerald-900 dark:text-emerald-300',
        icon: <Building2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />,
        ring: 'ring-1 ring-emerald-400/30',
        title: `باقة مدرسة: ${effective.schoolName || ''}`,
      };
    }
    return {
      badgeBg: 'bg-slate-100 dark:bg-slate-800',
      badgeBorder: 'border-slate-200 dark:border-slate-700',
      badgeText: 'text-slate-700 dark:text-slate-300',
      icon: <Sparkles size={14} className="text-amber-500 shrink-0" />,
      ring: '',
      title: 'حساب تجريبي مجاني',
    };
  }, [effective]);

  return (
    <div ref={containerRef} className={`relative inline-block text-right ${className}`} dir="rtl">
      {/* Badge Button Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black transition-all cursor-pointer border shadow-2xs ${tierStyle.badgeBg} ${tierStyle.badgeBorder} ${tierStyle.badgeText} ${tierStyle.ring} hover:shadow-xs hover:scale-[1.02]`}
        title="انقر لعرض تفاصيل العضوية والصلاحيات"
      >
        {tierStyle.icon}
        <span className="truncate max-w-[140px] sm:max-w-[190px]">
          {compact
            ? tierStyle.title.split(':')[0]
            : tierStyle.title}
        </span>

        {effective.remainingDays !== undefined && (
          <span className="hidden sm:inline-flex items-center rounded-full bg-white/80 dark:bg-slate-900/80 px-1.5 py-0.2 text-[10px] font-bold text-slate-700 dark:text-slate-300">
            {effective.remainingDays} يوماً
          </span>
        )}

        <ChevronDown
          size={12}
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Popover Details Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 sm:right-auto mt-2 w-80 max-w-[90vw] rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl z-50 animate-fade-in text-xs font-sans">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
                {tierStyle.icon}
              </span>
              <div>
                <h4 className="font-black text-slate-900 dark:text-white text-sm">{tierStyle.title}</h4>
                <p className="text-[10px] text-slate-500 font-bold">
                  {effective.hasSchoolSponsorship
                    ? 'رعاية مدرسية معتمدة'
                    : effective.effectiveTierId !== 'free_starter'
                    ? 'اشتراك فردي مباشر'
                    : 'حساب تجريبي أولي'}
                </p>
              </div>
            </div>

            {effective.remainingDays !== undefined && (
              <span className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-black text-slate-700 dark:text-slate-300">
                <Calendar size={12} className="text-slate-400" />
                <span>{effective.remainingDays} يوماً</span>
              </span>
            )}
          </div>

          {/* School Context Note */}
          {effective.hasSchoolSponsorship && (
            <div className="mt-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 p-2.5 text-[11px] text-emerald-900 dark:text-emerald-300 font-bold leading-5">
              <span>🏫 مسجل عبر: </span>
              <span className="font-black">{effective.schoolName}</span>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                تغطي مدرستك بنك الأسئلة ومسارات القدرات مجاناً بالكامل.
              </p>
            </div>
          )}

          {/* Active Features Checklist */}
          <div className="mt-3.5 space-y-2">
            <p className="text-[11px] font-black text-slate-700 dark:text-slate-300">الميزات المتاحة لحسابك:</p>
            <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>
                  {effective.features.maxQuestionsPerDay === Infinity
                    ? 'بنك أسئلة قياس غير محدود'
                    : `بنك الأسئلة (${effective.features.maxQuestionsPerDay} أسئلة يومياً)`}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2
                  size={13}
                  className={effective.features.mockExamsUnlimited ? 'text-emerald-600 shrink-0' : 'text-slate-300 shrink-0'}
                />
                <span className={effective.features.mockExamsUnlimited ? '' : 'text-slate-400 line-through'}>
                  محاكيات قياس بقفل الأقسام الصارم
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2
                  size={13}
                  className={effective.features.aiTutorUnlimited ? 'text-emerald-600 shrink-0' : 'text-slate-300 shrink-0'}
                />
                <span className={effective.features.aiTutorUnlimited ? '' : 'text-slate-400 line-through'}>
                  المعلم الذكي والسبورة الصوتية التفاعلية
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2
                  size={13}
                  className={effective.features.allPathsIncluded ? 'text-emerald-600 shrink-0' : 'text-slate-300 shrink-0'}
                />
                <span className={effective.features.allPathsIncluded ? '' : 'text-slate-400'}>
                  {effective.features.allPathsIncluded
                    ? 'جميع المسارات (قدرات + تحصيلي + نافس)'
                    : `المسارات المتاحة: ${Array.from(effective.allowedPaths).length || 'تجريبي'}`}
                </span>
              </li>
            </ul>
          </div>

          {/* Action Upgrade Footer */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <Link
              to="/pricing"
              onClick={() => setIsOpen(false)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 px-3.5 py-2 text-xs font-black text-white shadow-md shadow-indigo-600/20 transition-all text-center"
            >
              <Sparkles size={14} />
              <span>{effective.effectiveTierId === 'diamond_vip' ? 'تفاصيل الباقات' : 'ترقية العضوية الآن'}</span>
            </Link>

            <Link
              to="/pricing#vouchers"
              onClick={() => setIsOpen(false)}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              كود مدرسة
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
