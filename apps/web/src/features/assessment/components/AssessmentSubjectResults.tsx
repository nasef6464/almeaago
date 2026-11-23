import type { ResultDetail } from '../api/attempt-client';

function ScoreBar({ label, value, height }: { label: string; value: number; height: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className={`${height} overflow-hidden rounded-full bg-slate-100`}>
      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${value}%` }} />
    </div>
  );
}

export function AssessmentSubjectResults({ detail }: { detail: ResultDetail }) {
  const { subjectResults, skillAnalysis, result } = detail;
  if (!subjectResults?.length) return null;
  const classified = subjectResults.reduce((sum, subject) => sum + subject.total, 0);
  return (
    <section aria-label="أداؤك لكل مادة" dir="rtl" className="mt-5 space-y-3 rounded-2xl border border-indigo-100 bg-white p-4">
      <h3 className="font-black">أداؤك لكل مادة</h3>
      {classified !== result.totalQuestions && (
        <p role="status" className="text-sm text-amber-800">تفصيل المواد غير مكتمل؛ الأسئلة المصنفة {classified} من {result.totalQuestions}.</p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {subjectResults.map(subject => {
          const skills = skillAnalysis?.complete ? skillAnalysis.items.filter(skill => skill.subjectId === subject.subjectId) : [];
          return (
            <section key={subject.subjectId} aria-label={`أداؤك في مادة ${subject.subjectName || 'بدون اسم محفوظ'}`} className="space-y-3 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-bold">{subject.subjectName || 'مادة بدون اسم محفوظ'}</h4>
                <strong className="text-lg text-indigo-700">{subject.score}٪</strong>
              </div>
              <ScoreBar label={`درجة ${subject.subjectName || 'المادة'}`} value={subject.score} height="h-2" />
              <p className="text-sm text-slate-600">{subject.total} أسئلة · {subject.correct} صحيح · {subject.wrong} خطأ · {subject.unanswered} دون إجابة</p>
              {skills.length > 0 && (
                <details className="border-t border-slate-100 pt-2">
                  <summary className="cursor-pointer text-sm font-bold text-indigo-700">تفاصيل المهارات ({skills.length})</summary>
                  <div className="mt-3 space-y-3">
                    {skills.map(skill => (
                      <div key={skill.skillId} className="space-y-1 rounded-lg border border-slate-100 p-2">
                        <div className="flex items-center justify-between gap-3 text-sm"><span>{skill.skillName}</span><strong>{skill.mastery}٪</strong></div>
                        <ScoreBar label={skill.skillName} value={skill.mastery} height="h-1.5" />
                        <p className="text-xs text-slate-500">{skill.correctCount} صحيح من {skill.questionCount}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}
