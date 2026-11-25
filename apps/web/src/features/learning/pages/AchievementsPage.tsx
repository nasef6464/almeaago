import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/state/AuthProvider';
import {
  lessonProgressSummaryClient,
  type LearnerAchievementsSummary,
} from '../api/learning-client';

export interface BadgeItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  unlocked: boolean;
  progress: number;
  targetLabel: string;
}

function pct(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

export const AchievementsPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [summary, setSummary] = useState<LearnerAchievementsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    lessonProgressSummaryClient
      .achievements(controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setSummary(res.summary);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'تعذر تحميل الإنجازات.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [user]);

  const studentName = user?.name || 'طالب المئة';

  const badges: BadgeItem[] = useMemo(() => {
    const s = summary || {
      completedLessons: 0,
      completedQuizzes: 0,
      perfectQuizzes: 0,
      masteredSkills: 0,
      enrolledCourses: 0,
      activityCount: 0,
      streakDays: 0,
      certificatesCount: 0,
      points: 0,
      level: 1,
      timeline: [],
    };
    return [
      {
        id: 'starter',
        title: 'وسام الانطلاقة الأولى',
        description: 'إكمال أول درس أو اختبار بنجاح على منصة المئة.',
        icon: '🚀',
        color: 'from-blue-500 to-indigo-600',
        unlocked: s.completedLessons + s.completedQuizzes >= 1,
        progress: pct(s.completedLessons + s.completedQuizzes, 1),
        targetLabel: `${Math.min(1, s.completedLessons + s.completedQuizzes)} / 1`,
      },
      {
        id: 'streak_master',
        title: 'وسام الاستمرارية والمواظبة',
        description: 'المواظبة على التعلم والتدريب لمدة 5 أيام متتالية.',
        icon: '🔥',
        color: 'from-amber-500 to-orange-600',
        unlocked: s.streakDays >= 5,
        progress: pct(s.streakDays, 5),
        targetLabel: `${s.streakDays} / 5 أيام`,
      },
      {
        id: 'quiz_explorer',
        title: 'وسام المثابرة في الاختبارات',
        description: 'إتمام 5 اختبارات تدريبية أو محاكية مكتملة.',
        icon: '⚡',
        color: 'from-amber-400 to-yellow-500',
        unlocked: s.completedQuizzes >= 5,
        progress: pct(s.completedQuizzes, 5),
        targetLabel: `${s.completedQuizzes} / 5 اختبارات`,
      },
      {
        id: 'score_hunter',
        title: 'وسام الدرجة الكاملة 100%',
        description: 'تحقيق 100% في أحد الاختبارات المعتمدة.',
        icon: '🏆',
        color: 'from-emerald-500 to-teal-600',
        unlocked: s.perfectQuizzes >= 1,
        progress: pct(s.perfectQuizzes, 1),
        targetLabel: `${s.perfectQuizzes} / 1`,
      },
      {
        id: 'skill_master',
        title: 'فارس إتقان المهارات',
        description: 'الوصول إلى إتقان 80%+ في 10 مهارات.',
        icon: '📐',
        color: 'from-indigo-600 to-violet-700',
        unlocked: s.masteredSkills >= 10,
        progress: pct(s.masteredSkills, 10),
        targetLabel: `${s.masteredSkills} من 10 مهارات`,
      },
      {
        id: 'lessons_champion',
        title: 'بطل الدروس التأسيسية',
        description: 'إكمال 20 درساً تعليمياً عبر المسارات والدورات.',
        icon: '📚',
        color: 'from-rose-500 to-pink-600',
        unlocked: s.completedLessons >= 20,
        progress: pct(s.completedLessons, 20),
        targetLabel: `${s.completedLessons} من 20 درساً`,
      },
      {
        id: 'course_graduate',
        title: 'وسام إتمام الدورات',
        description: 'إصدار شهادة إتمام دورة تدريبية معتمدة.',
        icon: '🎓',
        color: 'from-purple-500 to-indigo-600',
        unlocked: s.certificatesCount >= 1,
        progress: pct(s.certificatesCount, 1),
        targetLabel: `${s.certificatesCount} شهادة`,
      },
      {
        id: 'royal_hundred',
        title: 'وسام التميز المتقدم (1000 نقطة)',
        description: 'جمع 1000 نقطة تعلم عبر الدروس والاختبارات والمراجعة.',
        icon: '👑',
        color: 'from-amber-300 via-yellow-400 to-amber-600',
        unlocked: s.points >= 1000,
        progress: pct(s.points, 1000),
        targetLabel: `${s.points} / 1000 نقطة`,
      },
    ];
  }, [summary]);

  const filteredBadges = useMemo(() => {
    if (selectedFilter === 'unlocked') return badges.filter((b) => b.unlocked);
    if (selectedFilter === 'locked') return badges.filter((b) => !b.unlocked);
    return badges;
  }, [badges, selectedFilter]);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden">
          <div className="absolute -left-16 -bottom-16 w-64 h-64 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-300 text-xs font-black">
                <Sparkles size={14} />
                <span>سجل التميز والأوسمة · المستوى {summary?.level ?? 1}</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
                أوسمة وإنجازات {studentName}
              </h1>
              <p className="text-sm font-bold text-indigo-200 max-w-xl">
                نقاطك وإنجازاتك محسوبة مباشرة من دروسك المكتملة واختباراتك ومهاراتك المتقنة.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center min-w-[90px]">
                <div className="text-2xl font-black text-amber-300">{unlockedCount} / {badges.length}</div>
                <div className="text-[11px] font-bold text-indigo-200">أوسمة محققة</div>
              </div>

              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center min-w-[90px]">
                <div className="text-2xl font-black text-orange-400">{summary?.streakDays ?? 0} أيام</div>
                <div className="text-[11px] font-bold text-indigo-200">استمرارية</div>
              </div>

              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center min-w-[90px]">
                <div className="text-2xl font-black text-emerald-400">{summary?.certificatesCount ?? 0}</div>
                <div className="text-[11px] font-bold text-indigo-200">شهادات رسمية</div>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                selectedFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              جميع الأوسمة ({badges.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('unlocked')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                selectedFilter === 'unlocked' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              المحققة فقط ({unlockedCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('locked')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                selectedFilter === 'locked' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
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

        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white p-12 text-sm font-bold text-slate-500">
            <Loader2 size={18} className="animate-spin text-indigo-600" />
            <span>جاري حساب إنجازاتك...</span>
          </div>
        ) : (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredBadges.map((badge) => (
              <div
                key={badge.id}
                data-testid={`badge-card-${badge.id}`}
                className={`rounded-3xl border p-5 transition flex flex-col justify-between ${
                  badge.unlocked
                    ? 'bg-white border-slate-200/80 shadow-xs hover:border-indigo-200 hover:shadow-md'
                    : 'bg-slate-100/60 border-slate-200/60 opacity-85'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-md ${
                        badge.unlocked ? 'bg-gradient-to-tr ' + badge.color + ' text-white' : 'bg-slate-200 text-slate-400'
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
                        قيد التقدم
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-black text-slate-900 leading-snug">{badge.title}</h3>
                  <p className="mt-1 text-xs font-medium text-slate-500 leading-relaxed">{badge.description}</p>
                </div>

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
        )}

        {summary && summary.timeline.length > 0 && (
          <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-3">
            <h2 className="text-lg font-black text-slate-900">أحدث الأنشطة المسجلة</h2>
            <div className="divide-y divide-slate-100">
              {summary.timeline.map((item) => (
                <div key={`${item.type}-${item.id}`} className="flex items-center justify-between py-3 text-xs sm:text-sm">
                  <div>
                    <div className="font-black text-slate-900">{item.title}</div>
                    <div className="text-xs font-bold text-slate-500">{item.subtitle}</div>
                  </div>
                  <span className="text-xs font-bold text-slate-400">
                    {new Date(item.date).toLocaleDateString('ar-SA')}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

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
              to="/courses"
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition text-center flex items-center justify-center gap-1.5"
            >
              <ExternalLink size={14} />
              استعراض الدورات والشهادات
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
};
