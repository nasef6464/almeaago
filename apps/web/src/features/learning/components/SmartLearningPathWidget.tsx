import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Sparkles, Zap, Target } from 'lucide-react';

export interface SmartSkillRecommendation {
  id: string;
  title: string;
  reason: string;
  duration: string;
  link: string;
  actionLabel?: string;
}

interface SmartLearningPathWidgetProps {
  current?: SmartSkillRecommendation | null;
  nextItems?: SmartSkillRecommendation[];
  loading?: boolean;
}

export const SmartLearningPathWidget: React.FC<SmartLearningPathWidgetProps> = ({
  current,
  nextItems = [],
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-emerald-100" />
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  const effectiveCurrent = current || {
    id: 'default-verbal',
    title: 'أساسيات التناظر اللفظي والعلاقات',
    reason: 'أكثر مهارة مؤثرة في اختبار القدرات — تدريب مكثف على العلاقات الأكثر تكراراً.',
    duration: '15 دقيقة',
    link: '/learning',
    actionLabel: 'ابدأ التدريب الآن',
  };

  const effectiveNext = nextItems.length > 0 ? nextItems : [
    {
      id: 'step-2',
      title: 'العمليات الحسابية والكسور',
      duration: '20 دقيقة',
      reason: 'القسم الكمي',
      link: '/learning',
    },
    {
      id: 'step-3',
      title: 'استيعاب المقروء وتحليل النصوص',
      duration: '15 دقيقة',
      reason: 'القسم اللفظي',
      link: '/learning',
    },
    {
      id: 'step-4',
      title: 'اختبار محاكي مصغر (20 سؤال)',
      duration: '25 دقيقة',
      reason: 'قياس شامل',
      link: '/assessments',
    },
  ];

  return (
    <div
      data-testid="student-smart-path"
      className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm"
    >
      <div className="border-b border-emerald-100 bg-gradient-to-l from-emerald-50 via-white to-white p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-gray-900">المسار الذكي التكيفي</h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                  ذكاء اصطناعي
                </span>
              </div>
              <p className="text-xs font-bold text-gray-500 mt-0.5">خطوة واضحة ومحددة، ثم نحدّث التوصيات تلقائيًا بحسب أدائك.</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">
            <Target size={14} />
            <span>تدرج تكيفي</span>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black text-emerald-700">
            <span className="rounded-full bg-white px-2.5 py-1 shadow-xs">خطوتك الآن</span>
            <span className="inline-flex items-center gap-1 text-gray-500">
              <Clock size={12} /> {effectiveCurrent.duration}
            </span>
          </div>
          <h4 className="mt-2 text-lg font-black text-gray-900">{effectiveCurrent.title}</h4>
          <p className="mt-1 text-xs sm:text-sm font-medium leading-6 text-gray-600">{effectiveCurrent.reason}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to={effectiveCurrent.link}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700 shadow-sm transition"
            >
              <span>{effectiveCurrent.actionLabel || 'ابدأ الآن'}</span>
              <ArrowLeft size={16} />
            </Link>
          </div>
        </div>

        {effectiveNext.length > 0 && (
          <div className="mt-5">
            <p className="mb-2.5 text-xs font-black text-gray-700 flex items-center gap-1.5">
              <span>الخطوات التالية الموصى بها</span>
              <span className="h-1 w-1 rounded-full bg-gray-400" />
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {effectiveNext.slice(0, 3).map((item) => (
                <Link
                  key={item.id}
                  to={item.link}
                  className="group rounded-2xl border border-gray-100 bg-gray-50/80 p-3.5 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/50 hover:shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-black text-gray-800 group-hover:text-emerald-800 transition">
                      {item.title}
                    </span>
                    <Zap size={14} className="shrink-0 text-amber-500" />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-gray-500">
                    <span>{item.reason}</span>
                    <span className="inline-flex items-center gap-1 text-gray-400">
                      <Clock size={11} /> {item.duration}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
