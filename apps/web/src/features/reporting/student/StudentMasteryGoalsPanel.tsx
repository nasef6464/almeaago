import React from 'react';
import { Award, Calendar, CheckCircle2, Flag, Plus, Sparkles } from 'lucide-react';
import type { StudentMasteryGoal } from './studentReportTypes';

interface Props {
  goals: StudentMasteryGoal[];
  loading?: boolean;
  saving?: boolean;
  canCreateShort?: boolean;
  canCreateLong?: boolean;
  onCreateShort?: () => void;
  onCreateLong?: () => void;
  onSetStatus?: (goalId: string, status: 'achieved' | 'archived') => void;
}

export const StudentMasteryGoalsPanel: React.FC<Props> = ({
  goals,
  loading = false,
  saving = false,
  canCreateShort = true,
  canCreateLong = true,
  onCreateShort,
  onCreateLong,
  onSetStatus,
}) => {
  return (
    <section
      data-testid="student-mastery-goals"
      className="rounded-3xl border border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm transition-colors"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 text-xs font-black text-indigo-700 dark:text-indigo-300 mb-2">
            <Award size={14} />
            أهداف الإتقان
          </div>
          <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
            أهداف المذاكرة للمسار الحالي
          </h2>
          <p className="mt-1 text-xs sm:text-sm font-bold leading-6 text-gray-500 dark:text-slate-400">
            حدد هدفًا مرحليًا أو هدفًا شاملاً للمسار لمتابعة وصولك إلى درجة التميز المطلوبة.
          </p>
        </div>

        <div className="print-hide flex flex-wrap gap-2">
          {onCreateShort && (
            <button
              type="button"
              onClick={onCreateShort}
              disabled={!canCreateShort || saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 text-xs font-black text-white transition disabled:opacity-50 shadow-2xs"
            >
              <Plus size={14} />
              <span>هدف قصير</span>
            </button>
          )}
          {onCreateLong && (
            <button
              type="button"
              onClick={onCreateLong}
              disabled={!canCreateLong || saving}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 px-3.5 py-2 text-xs font-black text-indigo-700 dark:text-indigo-300 transition disabled:opacity-50"
            >
              <Flag size={14} />
              <span>هدف المسار</span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {loading ? (
          <div className="col-span-full rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-6 text-center text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">
            جارٍ تحميل أهدافك المسجلة...
          </div>
        ) : goals.length > 0 ? (
          goals.map((goal) => {
            const isAchieved = goal.status === 'achieved';
            return (
              <article
                key={goal.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-4 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2.5 py-0.5 text-[11px] font-black text-slate-700 dark:text-slate-200">
                      {goal.horizon === 'short' ? 'هدف قصير' : 'هدف مسار كامل'}
                    </span>
                    <div className="rounded-xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 px-3 py-1 text-center">
                      <div className="text-base font-black text-indigo-700 dark:text-indigo-300">
                        {goal.targetMastery}%
                      </div>
                      <div className="text-[10px] font-bold text-gray-400">مستهدف</div>
                    </div>
                  </div>

                  <h3 className="mt-2 text-base font-black leading-snug text-gray-900 dark:text-white">
                    {goal.title}
                  </h3>

                  {goal.dueDate && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-slate-400">
                      <Calendar size={13} />
                      <span>الموعد المستهدف: {goal.dueDate}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700 flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-black ${
                      isAchieved
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {isAchieved ? <CheckCircle2 size={14} /> : null}
                    {isAchieved ? 'تم تحقيق الهدف ✓' : 'قيد المتابعة والتدريب'}
                  </span>

                  {onSetStatus && !isAchieved && (
                    <button
                      type="button"
                      onClick={() => onSetStatus(goal.id, 'achieved')}
                      className="rounded-lg bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/80 px-2.5 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition"
                    >
                      تحديد كمنجز
                    </button>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <div className="col-span-full rounded-2xl border border-dashed border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 p-6 text-center">
            <Sparkles size={24} className="mx-auto text-indigo-500 mb-2" />
            <h3 className="text-sm font-black text-gray-800 dark:text-white">لا توجد أهداف نشطة حالياً</h3>
            <p className="mt-1 text-xs font-bold text-gray-500 dark:text-slate-400">
              أضف هدفًا قصيرًا للتركيز على مهارات هذا الأسبوع والوصول لدرجة 85% فأكثر.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
