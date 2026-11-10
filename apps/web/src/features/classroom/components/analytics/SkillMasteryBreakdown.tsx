import React from 'react';
import { Target, AlertTriangle, CheckCircle2, Sparkles, BookOpen } from 'lucide-react';
import type { SkillMasteryStat } from '../../api/classroom-types';

interface SkillMasteryBreakdownProps {
  skills: SkillMasteryStat[];
  onScheduleRemedial?: (skill: SkillMasteryStat) => void;
}

export const SkillMasteryBreakdown: React.FC<SkillMasteryBreakdownProps> = ({
  skills,
  onScheduleRemedial,
}) => {
  if (skills.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs font-bold text-slate-400 dark:border-slate-800">
        لم يتم رصد مهارات كافية في هذه الحصة.
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="text-indigo-600 dark:text-indigo-400" size={18} />
          <h4 className="text-sm font-black text-slate-900 dark:text-white">
            تحليل إتقان المهارات الأكاديمية (Skill Mastery)
          </h4>
        </div>
        <span className="text-xs font-bold text-slate-400">
          معيار الإتقان: 60% فأعلى
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {skills.map((skill) => {
          const isWeak = skill.accuracy < 60;
          return (
            <div
              key={skill.skillId}
              className={`rounded-2xl border p-4 transition ${
                isWeak
                  ? 'border-amber-300 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-black text-slate-900 dark:text-white text-xs sm:text-sm">
                    {skill.skillName}
                  </div>
                  {skill.sectionName && (
                    <div className="text-[11px] font-bold text-slate-400 mt-0.5">
                      {skill.sectionName}
                    </div>
                  )}
                </div>

                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${
                    isWeak
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                  }`}
                >
                  {isWeak ? (
                    <AlertTriangle size={12} className="inline" />
                  ) : (
                    <CheckCircle2 size={12} className="inline" />
                  )}
                  {skill.accuracy}% إتقان
                </span>
              </div>

              {/* Mastery progress bar */}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isWeak ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, skill.accuracy))}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>
                  {skill.correctCount} صحيحة من أصل {skill.totalQuestions} أسئلة
                </span>

                {isWeak && onScheduleRemedial && (
                  <button
                    type="button"
                    onClick={() => onScheduleRemedial(skill)}
                    className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-300 font-black hover:underline"
                  >
                    <Sparkles size={12} />
                    جدولة حصة دعم 🎯
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
