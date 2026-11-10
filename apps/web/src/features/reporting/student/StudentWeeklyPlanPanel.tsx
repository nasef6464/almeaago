import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle2, ChevronLeft, Sparkles } from 'lucide-react';
import { displayText } from './studentReportDomain';
import type { StudentWeeklyPlanItem } from './studentReportTypes';

interface StudentWeeklyPlanPanelProps {
  visible?: boolean;
  items: StudentWeeklyPlanItem[];
}

export const StudentWeeklyPlanPanel: React.FC<StudentWeeklyPlanPanelProps> = ({
  visible = true,
  items,
}) => {
  if (!visible || items.length === 0) return null;

  return (
    <section className="rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-colors">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300 mb-2">
            <Sparkles size={14} />
            خطة موجهة من نتائجك
          </div>
          <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">خطة أسبوعية مصغرة</h2>
          <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-slate-400 mt-1">
            ثلاث خطوات خفيفة تبدأ من أضعف المهارات، مناسبة للمذاكرة اليومية وولي الأمر يقدر يتابعها بسهولة.
          </p>
        </div>
        <Link
          to="/dashboard?tab=plan"
          className="self-start inline-flex items-center gap-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-2 text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition"
        >
          <span>فتح خطتي الدراسية</span>
          <ChevronLeft size={16} />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item, index) => {
          const isWeak = item.mastery < 50;
          return (
            <div
              key={`${item.day}-${item.skill}-${index}`}
              className="flex flex-col justify-between rounded-2xl border border-gray-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-4 transition hover:border-indigo-200 dark:hover:border-indigo-800"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-800 px-3 py-1 text-xs font-black text-indigo-700 dark:text-indigo-300 shadow-2xs">
                    <Calendar size={13} />
                    {item.day}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${
                      isWeak
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/60'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/60'
                    }`}
                  >
                    إتقان {item.mastery}%
                  </span>
                </div>

                <h3 className="font-black text-gray-900 dark:text-white text-base leading-snug break-words">
                  {item.skill}
                </h3>

                {item.subjectName || item.sectionName ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold text-gray-500 dark:text-slate-400">
                    {item.subjectName && (
                      <span className="rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 border border-slate-100 dark:border-slate-700">
                        المادة: {displayText(item.subjectName)}
                      </span>
                    )}
                    {item.sectionName && (
                      <span className="rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 border border-slate-100 dark:border-slate-700">
                        {displayText(item.sectionName)}
                      </span>
                    )}
                  </div>
                ) : null}

                <p className="mt-2.5 text-xs sm:text-sm leading-6 text-gray-600 dark:text-slate-300">
                  {displayText(item.actionText)}
                </p>

                <div className="mt-3 space-y-1 rounded-xl bg-white/80 dark:bg-slate-800/80 p-2.5 text-xs text-gray-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
                  {item.lessonTitle && (
                    <div className="truncate">
                      شرح مقترح: <span className="font-black text-indigo-700 dark:text-indigo-300">{displayText(item.lessonTitle)}</span>
                    </div>
                  )}
                  {item.quizTitle && (
                    <div className="truncate">
                      تدريب مقترح: <span className="font-black text-amber-700 dark:text-amber-300">{displayText(item.quizTitle)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="print-hide mt-4 grid gap-2">
                {item.lessonLink && (
                  <Link
                    to={item.lessonLink}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3 py-2 text-xs font-black text-white transition shadow-2xs"
                  >
                    <span>فتح شرح اليوم</span>
                    <ChevronLeft size={14} />
                  </Link>
                )}
                {item.quizLink && (
                  <Link
                    to={item.quizLink}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 px-3 py-2 text-xs font-black text-amber-800 dark:text-amber-200 transition"
                  >
                    <span>فتح تدريب اليوم</span>
                    <ChevronLeft size={14} />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
