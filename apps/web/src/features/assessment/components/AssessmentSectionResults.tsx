import type { ResultSectionItem } from '../api/attempt-client';

export function AssessmentSectionResults({ sections }: { sections?: ResultSectionItem[] }) {
  if (!sections?.length) return null;
  return (
    <section aria-label="تفاصيل أقسام الاختبار" dir="rtl" className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <details>
        <summary className="cursor-pointer text-sm font-bold text-slate-700">تفاصيل الأقسام ({sections.length})</summary>
        <p className="my-3 text-xs text-slate-500">القسم قد يجمع أكثر من مادة؛ تحليل كل مادة ظاهر بصورة مستقلة أعلاه.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {sections.map(section => (
            <div key={section.sectionId} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <h4 className="font-bold">{section.sectionName}</h4>
                <strong>{section.score}٪</strong>
              </div>
              <p className="mt-2 text-xs text-slate-600">{section.total} أسئلة · {section.correct} صحيح · {section.wrong} خطأ · {section.unanswered} دون إجابة</p>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
