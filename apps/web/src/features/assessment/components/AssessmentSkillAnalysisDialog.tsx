import { FileText, Target, Video, X } from 'lucide-react';
import { useId, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';

import type { ResultDetail } from '../api/attempt-client';
import { resultFoundationPath } from '../navigation/resultFoundationPath';

type Skill = NonNullable<ResultDetail['skillAnalysis']>['items'][number];

function scopeKey(skill: Skill) {
  return `${skill.pathId}:${skill.subjectId}`;
}

function skillLevel(mastery: number) {
  if (mastery >= 80) return { label: 'إتقان ممتاز', chip: 'border-emerald-200 bg-emerald-50 text-emerald-800', number: 'text-emerald-700', bar: 'bg-emerald-500' };
  if (mastery >= 50) return { label: 'متوسط', chip: 'border-amber-200 bg-amber-50 text-amber-800', number: 'text-amber-700', bar: 'bg-amber-500' };
  return { label: 'تحتاج تدريبًا', chip: 'border-rose-200 bg-rose-50 text-rose-800', number: 'text-rose-700', bar: 'bg-rose-500' };
}

export function AssessmentSkillAnalysisDialog({ detail, dialogRef }: { detail: ResultDetail; dialogRef: RefObject<HTMLDialogElement | null> }) {
  const titleID = useId();
  const [subject, setSubject] = useState('');
  const skills = detail.skillAnalysis?.complete ? [...detail.skillAnalysis.items].sort((a, b) => a.mastery - b.mastery) : [];
  const subjects = new Map(skills.map(skill => [scopeKey(skill), skill.subjectName || 'غير مصنف']));
  const active = subjects.has(subject) ? subject : '';
  const visible = active ? skills.filter(skill => scopeKey(skill) === active) : skills;
  const close = () => dialogRef.current?.close();

  return (
    <dialog ref={dialogRef} dir="rtl" aria-labelledby={titleID} onClose={() => setSubject('')}
      className="m-auto max-h-[calc(100dvh_-_1rem)] w-[calc(100%_-_1rem)] max-w-6xl overflow-auto rounded-3xl border border-slate-200/80 bg-white p-0 shadow-2xl backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm sm:w-[calc(100%_-_2rem)] print:hidden">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 via-white to-white p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-200"><Target size={22} /></div>
          <div className="min-w-0">
            <h2 id={titleID} className="text-base font-black text-slate-900 sm:text-xl">تحليل المهارات</h2>
            <p className="mt-0.5 text-xs font-bold text-slate-500">{detail.analysisMode === 'bank' ? 'من التدريب' : 'من الاختبار'} • {visible.length} مهارات</p>
          </div>
        </div>
        <button type="button" onClick={close} aria-label="إغلاق" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"><X size={18} /></button>
      </header>
      <div className="max-h-[min(78vh,calc(100dvh_-_10rem))] overflow-y-auto p-3 sm:p-5">
        {subjects.size > 1 && (
          <div role="group" aria-label="تصفية حسب المادة" className="mb-4 flex flex-wrap gap-2">
            {[['', 'الكل'], ...subjects].map(([id, label]) => (
              <button key={id} type="button" aria-pressed={id === active} onClick={() => setSubject(id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold ${id === active ? 'border-sky-400 bg-sky-100 text-sky-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{label}</button>
            ))}
          </div>
        )}
        {visible.length ? (
          <div className="grid gap-2.5 sm:gap-3 lg:grid-cols-2">
            {visible.map(skill => {
              const level = skillLevel(skill.mastery);
              const topic = skill.pathId && skill.subjectId ? skill.foundationTopics?.[0] : undefined;
              return (
                <article key={`${scopeKey(skill)}:${skill.skillId}`} className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-3 hover:border-sky-200">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-sm font-bold leading-relaxed text-slate-800"><span className="rounded bg-sky-50 px-1.5 py-0.5 underline decoration-sky-200 decoration-2 underline-offset-4">{skill.skillName || 'مهارة غير مسماة'}</span></h3>
                      <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-bold">
                        {skill.sectionName && <span className="rounded-md bg-indigo-50/80 px-1.5 py-0.5 text-indigo-700">{skill.sectionName}</span>}
                        {skill.subjectName && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600">{skill.subjectName}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${level.chip}`}>{level.label}</span>
                      <span className={`min-w-9 text-left text-sm font-bold ${level.number}`}>{skill.mastery}%</span>
                    </div>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                    <div className={`h-full rounded-full ${level.bar}`} style={{ width: `${Math.max(0, Math.min(100, skill.mastery))}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {topic ? (
                      <>
                        <Link to={resultFoundationPath(skill, topic.id, 'lessons')} onClick={close} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/80 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-600 hover:text-white"><Video size={13} /> فيديو{topic.isLocked ? ' 🔒' : ''}</Link>
                        <Link to={resultFoundationPath(skill, topic.id, 'quizzes')} onClick={close} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-600 hover:text-white"><FileText size={13} /> تدريب{topic.isLocked ? ' 🔒' : ''}</Link>
                      </>
                    ) : (
                      <>
                        <span aria-disabled="true" className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-2.5 py-1 text-xs text-slate-400"><Video size={13} /> فيديو</span>
                        <span aria-disabled="true" className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-2.5 py-1 text-xs text-slate-400"><FileText size={13} /> تدريب</span>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">لا توجد مهارات موثقة لهذه المحاولة.</p>
        )}
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 p-4">
        <span className="text-xs font-bold text-slate-500">المهارات مرتبة من الأضعف للأقوى.</span>
        <form method="dialog"><button className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-100 sm:text-sm">إغلاق</button></form>
      </footer>
    </dialog>
  );
}
