import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle, FileText, Video, X } from 'lucide-react';
import { displayText } from './studentReportDomain';
import type { StudentAggregatedSkill, SkillRecommendation } from './studentReportTypes';

interface StudentSelectedSkillPanelProps {
  skill: StudentAggregatedSkill;
  recommendation?: SkillRecommendation | null;
  onClose?: () => void;
}

export const StudentSelectedSkillPanel: React.FC<StudentSelectedSkillPanelProps> = ({
  skill,
  recommendation,
  onClose,
}) => {
  const isWeak = skill.mastery < 50;

  const foundationLink = skill.pathId
    ? `/category/${skill.pathId}?subject=${skill.subjectId || ''}`
    : '/dashboard?tab=paths';

  const practiceLink = skill.pathId
    ? `/dashboard?tab=assessments&pathId=${skill.pathId}&subjectId=${skill.subjectId || ''}`
    : '/dashboard?tab=assessments';

  const recheckLink = `/dashboard?tab=assessments&slot=tests&pathId=${skill.pathId || ''}`;

  return (
    <div
      data-testid="student-selected-skill-panel"
      className="mt-5 rounded-3xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/80 dark:bg-slate-900/90 p-5 sm:p-6 transition-all shadow-md animate-fade-in relative"
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق تفاصيل المهارة"
          className="absolute top-4 left-4 p-1.5 rounded-xl bg-white/80 dark:bg-slate-800 hover:bg-white text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
        >
          <X size={18} />
        </button>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="rounded-full bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/60 px-3 py-1 text-xs font-black text-indigo-700 dark:text-indigo-300 shadow-2xs">
              تفاصيل المهارة ومصادر التأسيس
            </span>
            {skill.parentSkill && (
              <span className="rounded-full bg-indigo-100 dark:bg-indigo-950/70 px-3 py-1 text-xs font-black text-indigo-700 dark:text-indigo-300">
                {displayText(skill.parentSkill)}
              </span>
            )}
            <span
              className={`rounded-full px-3 py-1 text-xs font-black ${
                isWeak
                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              مستوى الإتقان: {skill.mastery}%
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white break-words">
            {displayText(skill.skill)}
          </h3>

          <div className="mt-2.5 flex flex-wrap gap-2 text-xs font-bold text-gray-600 dark:text-slate-300">
            <span className="rounded-lg bg-white dark:bg-slate-800 px-2.5 py-1 border border-slate-100 dark:border-slate-700">
              عدد الأدلة: {skill.totalEvidence || skill.attempts || 1} محاولة
            </span>
            <span className="rounded-lg bg-white dark:bg-slate-800 px-2.5 py-1 border border-slate-100 dark:border-slate-700">
              الحالة الإحصائية: {skill.isReliable ? 'مؤكدة' : 'قيد القياس الأولي'}
            </span>
            {skill.trend && (
              <span className="rounded-lg bg-white dark:bg-slate-800 px-2.5 py-1 border border-slate-100 dark:border-slate-700">
                الاتجاه: {skill.trend === 'improving' ? '📈 في تحسن' : skill.trend === 'declining' ? '📉 يحتاج تثبيت' : '➡️ مستقر'}
              </span>
            )}
          </div>

          <p className="mt-3 text-xs sm:text-sm leading-7 text-gray-600 dark:text-slate-300">
            اضغط على أي من الخيارات باليسار للانتقال فوراً إلى درس التأسيس المشروح بالفيديو، أو حل تمرين متخصص لسد هذه الفجوة.
          </p>
        </div>

        <div className="grid w-full gap-2.5 sm:grid-cols-3 lg:w-auto lg:min-w-[480px]">
          <Link
            to={recommendation?.lessonLink || foundationLink}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-slate-800 p-3.5 text-xs sm:text-sm font-black text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-700 transition shadow-2xs"
          >
            <Video size={17} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>شرح التأسيس</span>
          </Link>

          <Link
            to={recommendation?.quizLink || practiceLink}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-slate-800 p-3.5 text-xs sm:text-sm font-black text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-slate-700 transition shadow-2xs"
          >
            <FileText size={17} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>تدريب المهارة</span>
          </Link>

          <Link
            to={recheckLink}
            className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 p-3.5 text-xs sm:text-sm font-black text-white transition shadow-xs"
          >
            <CheckCircle size={17} className="shrink-0" />
            <span>إعادة القياس</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
