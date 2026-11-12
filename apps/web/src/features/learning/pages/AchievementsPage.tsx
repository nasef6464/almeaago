import React, { useMemo, useState } from 'react';
import {
  Award,
  TrendingUp,
  Star,
  Shield,
  Zap,
  Clock,
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
  ExternalLink,
  Flame,
  Gift,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/state/AuthProvider';

export interface BadgeItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  unlocked: boolean;
  progress: number; // 0 to 100
  targetLabel: string;
}

export const AchievementsPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  const studentName = user?.name || 'طالب المئة';

  const badges: BadgeItem[] = useMemo(() => [
    {
      id: 'starter',
      title: 'وسام الانطلاقة الأولى',
      description: 'أكملت أول درس وأول تدريب بنجاح على منصة المئة.',
      icon: '🚀',
      color: 'from-blue-500 to-indigo-600',
      unlocked: true,
      progress: 100,
      targetLabel: 'مكتمل 1/1',
    },
    {
      id: 'streak_master',
      title: 'وسام الاستمرارية والمواظبة',
      description: 'المواظبة على التدريب اليومي لمدة 5 أيام متتالية.',
      icon: '🔥',
      color: 'from-amber-500 to-orange-600',
      unlocked: true,
      progress: 100,
      targetLabel: '5 أيام متتالية',
    },
    {
      id: 'speed_demon',
      title: 'وسام فلاش للسرعة الفائقة',
      description: 'إتمام تحدي الـ 60 ثانية اليومي بنجاح وإحراز نسبة 80% فما فوق.',
      icon: '⚡',
      color: 'from-amber-400 to-yellow-500',
      unlocked: true,
      progress: 100,
      targetLabel: 'مكتمل بنجاح',
    },
    {
      id: 'score_hunter',
      title: 'وسام صائد الدرجات 90%+',
      description: 'تحقيق 90% أو أعلى في أحد الاختبارات المحاكية الشاملة.',
      icon: '🏆',
      color: 'from-emerald-500 to-teal-600',
      unlocked: true,
      progress: 100,
      targetLabel: 'مكتمل 95%',
    },
    {
      id: 'math_wizard',
      title: 'فارس المسائل الكمية',
      description: 'إتقان 10 مهارات في الجبر والهندسة والحساب التكتيكي.',
      icon: '📐',
      color: 'from-indigo-600 to-violet-700',
      unlocked: false,
      progress: 70,
      targetLabel: '7 من 10 مهارات',
    },
    {
      id: 'verbal_champion',
      title: 'بطل التناظر واستيعاب المقروء',
      description: 'حل 50 سؤالاً في التناظر اللفظي واستيعاب المقروء بنجاح.',
      icon: '📚',
      color: 'from-rose-500 to-pink-600',
      unlocked: false,
      progress: 60,
      targetLabel: '30 من 50 سؤالاً',
    },
    {
      id: 'ambassador',
      title: 'وسام سفير منصة المئة',
      description: 'مشاركة كود الخصم الخاص بك ودعوة صديق للانضمام للمنصة.',
      icon: '🎁',
      color: 'from-purple-500 to-indigo-600',
      unlocked: true,
      progress: 100,
      targetLabel: 'كود السفير مفعل',
    },
    {
      id: 'royal_hundred',
      title: 'وسام المئة الملكي (100%)',
      description: 'ختم جميع مسارات قياس والوصول إلى الجاهزية التامة لاختبار هيئة التقويم.',
      icon: '👑',
      color: 'from-amber-300 via-yellow-400 to-amber-600',
      unlocked: false,
      progress: 45,
      targetLabel: 'قيد التقدم 45%',
    },
  ], []);

  const filteredBadges = useMemo(() => {
    if (selectedFilter === 'unlocked') return badges.filter((b) => b.unlocked);
    if (selectedFilter === 'locked') return badges.filter((b) => !b.unlocked);
    return badges;
  }, [badges, selectedFilter]);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Header Card */}
        <header className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden">
          <div className="absolute -left-16 -bottom-16 w-64 h-64 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-300 text-xs font-black">
                <Sparkles size={14} />
                <span>سجل التميز والأوسمة</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
                أوسمة وإنجازات {studentName} 🎖️
              </h1>
              <p className="text-sm font-bold text-indigo-200 max-w-xl">
                كل خطوة تخطوها وكل تدريب تنجزه يقربك من الدرجة الكاملة (100) ويمنحك أوسمة استثنائية معتمدة.
              </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center min-w-[90px]">
                <div className="text-2xl font-black text-amber-300">{unlockedCount} / {badges.length}</div>
                <div className="text-[11px] font-bold text-indigo-200">أوسمة محققة</div>
              </div>

              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center min-w-[90px]">
                <div className="text-2xl font-black text-orange-400">5 أيام</div>
                <div className="text-[11px] font-bold text-indigo-200">استمرارية 🔥</div>
              </div>

              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center min-w-[90px]">
                <div className="text-2xl font-black text-emerald-400">2</div>
                <div className="text-[11px] font-bold text-indigo-200">شهادات رسمية</div>
              </div>
            </div>
          </div>
        </header>

        {/* Filter Navigation */}
        <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                selectedFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              جميع الأوسمة ({badges.length})
            </button>
            <button
              onClick={() => setSelectedFilter('unlocked')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                selectedFilter === 'unlocked'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              المحققة فقط ({unlockedCount})
            </button>
            <button
              onClick={() => setSelectedFilter('locked')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                selectedFilter === 'locked'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              قيد الإنجاز ({badges.length - unlockedCount})
            </button>
          </div>

          <Link
            to="/profile"
            className="text-xs font-black text-indigo-600 hover:underline flex items-center gap-1 pl-2"
          >
            <span>الملف الشخصي والشهادات</span>
            <ArrowRight size={14} className="rotate-180" />
          </Link>
        </div>

        {/* Badges Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredBadges.map((badge) => (
            <div
              key={badge.id}
              data-testid={`badge-card-${badge.id}`}
              className={`rounded-3xl border p-5 transition flex flex-col justify-between ${
                badge.unlocked
                  ? 'bg-white border-slate-200/80 shadow-xs hover:border-indigo-200 hover:shadow-md'
                  : 'bg-slate-100/60 border-slate-200/60 opacity-80'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-md ${
                      badge.unlocked
                        ? 'bg-gradient-to-tr ' + badge.color + ' text-white'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {badge.icon}
                  </div>

                  {badge.unlocked ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={12} />
                      مكتمل
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-black text-slate-600">
                      <Lock size={12} />
                      مغلق
                    </span>
                  )}
                </div>

                <h3 className="text-base font-black text-slate-900 leading-snug">{badge.title}</h3>
                <p className="mt-1 text-xs font-medium text-slate-500 leading-relaxed">
                  {badge.description}
                </p>
              </div>

              {/* Progress bar */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-500">التقدم:</span>
                  <span className={badge.unlocked ? 'text-emerald-600 font-black' : 'text-slate-700'}>
                    {badge.targetLabel}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      badge.unlocked ? 'bg-emerald-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${badge.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Verified Certificates Banner */}
        <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl shrink-0 shadow-xs">
              <Award size={28} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">شهادات إتمام الدورات المعتمدة</h3>
              <p className="text-xs text-slate-500 font-medium">
                احصل على شهادتك الرسمية الصادرة من منصة المئة فور إنهاء متطلبات الدورة بنسبة 100%.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
            <Link
              to="/profile"
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition text-center flex items-center justify-center gap-1.5"
            >
              <ExternalLink size={14} />
              عرض شهاداتي في الملف الشخصي
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
};
