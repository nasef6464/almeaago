import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, Sparkles } from 'lucide-react';
import { displayText } from './studentReportDomain';
import type { SmartRemediationPlan } from './studentReportTypes';

interface StudentSmartRemediationPanelProps {
  visible?: boolean;
  plan: SmartRemediationPlan | null;
}

export const StudentSmartRemediationPanel: React.FC<StudentSmartRemediationPanelProps> = ({
  visible = true,
  plan,
}) => {
  if (!visible || !plan) return null;

  return (
    <section
      id="remediation-plan"
      className="rounded-3xl border border-amber-200/80 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/90 via-white to-emerald-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-5 sm:p-6 shadow-sm transition-colors"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800/60 px-3 py-1 text-xs font-black text-amber-900 dark:text-amber-200 shadow-2xs mb-2">
            <Sparkles size={14} className="text-amber-600 dark:text-amber-400" />
            خطة علاجية مولدة من أدائك
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white">
            {displayText(plan.title) || 'خطة علاجية قصيرة'}
          </h2>
          <p className="mt-2 max-w-4xl text-xs sm:text-sm font-medium leading-7 text-gray-600 dark:text-slate-300">
            {displayText(plan.summary) ||
              'ابدأ بأضعف مهارة، راجع شرحًا بسيطًا، ثم حل تدريبًا قصيرًا وأعد القياس.'}
          </p>
        </div>
        <Link
          to="/dashboard?tab=plan"
          className="self-start inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs sm:text-sm font-black text-white transition shadow-xs"
        >
          <span>تحويلها لخطة مذاكرة</span>
          <ChevronLeft size={16} />
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {(plan.steps || []).slice(0, 3).map((step, index) => (
          <div
            key={`${step.day || index}-${step.skill || index}`}
            className="rounded-2xl border border-white dark:border-slate-800 bg-white/90 dark:bg-slate-800/80 p-4 shadow-2xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/50 px-3 py-1 text-xs font-black text-amber-800 dark:text-amber-300">
                  {displayText(step.day) || `اليوم ${index + 1}`}
                </span>
                <CheckCircle2 size={18} className="text-emerald-500" />
              </div>

              <h3 className="text-sm sm:text-base font-black leading-snug text-gray-900 dark:text-white mt-2">
                {displayText(step.skill) || 'مهارة تحتاج متابعة'}
              </h3>

              <p className="mt-2 text-xs sm:text-sm leading-6 text-gray-600 dark:text-slate-300">
                {displayText(step.action) || 'راجع شرحًا قصيرًا ثم حل تدريبًا بسيطًا.'}
              </p>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800 px-3 py-2 text-xs font-bold leading-6 text-slate-700 dark:text-slate-300">
              <span className="text-indigo-600 dark:text-indigo-400 font-black">التحقق: </span>
              {displayText(step.check) || 'أعد القياس بسؤال أو اختبار قصير.'}
            </div>
          </div>
        ))}
      </div>

      {plan.parentNote && (
        <div className="mt-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-xs sm:text-sm font-bold leading-7 text-emerald-900 dark:text-emerald-200">
          <span className="font-black text-emerald-700 dark:text-emerald-400">ملاحظة لولي الأمر: </span>
          {displayText(plan.parentNote)}
        </div>
      )}
    </section>
  );
};
