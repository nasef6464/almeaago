import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

import { contentClient } from '../../content/api/content-client';
import type { TaxonomyPath, TaxonomySubject } from '../../content/api/content-types';
import { learningEvidenceClient, type LearningEvidenceReport, type LearningEvidenceSkill, type LearningEvidenceStatus } from '../../learning/api/learning-client';
import { organizationsClient, type SchoolClass, type SchoolContext } from '../api/organizations-client';

const labels: Record<LearningEvidenceStatus, string> = {
  unmeasured: 'دون قياس',
  insufficient: 'أدلة غير كافية',
  support: 'بحاجة إلى دعم',
  developing: 'قيد التطور',
  ready: 'مستوى جيد في المهارات المقاسة',
};
const fieldClass = 'mt-1 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
const buttonClass = 'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-50';
const pageSize = 20;

function SkillResult({ skill }: { skill: LearningEvidenceSkill }) {
  return <li className="rounded-xl bg-slate-50 px-3 py-2">
    <div className="flex flex-wrap items-baseline gap-x-3">
      <span className="font-bold">{skill.name}</span>
      <span className="font-black tabular-nums" dir="ltr">{skill.accuracy == null ? '—' : `${skill.accuracy}%`}</span>
    </div>
    <p className="mt-1 text-xs text-slate-600">
      {labels[skill.status]} · {skill.correct} إجابة صحيحة من {skill.questions} · {skill.tests} اختبار
    </p>
  </li>;
}

export function DirectorSkillsRadar({ school }: { school: SchoolContext }) {
  const { schoolId, allowedPaths } = school;
  const [taxonomy, setTaxonomy] = useState<{ paths: TaxonomyPath[]; subjects: TaxonomySubject[] }>();
  const [classes, setClasses] = useState<SchoolClass[]>();
  const [catalogError, setCatalogError] = useState(false);
  const [classesError, setClassesError] = useState(false);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [pathId, setPathId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState<LearningEvidenceStatus | ''>('');
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [read, setRead] = useState<{ key: string; report: LearningEvidenceReport | null }>();
  const key = JSON.stringify([schoolId, pathId, subjectId, classId, status, search, page, retry]);
  const report = read?.key === key ? read.report : undefined;
  const paths = (taxonomy?.paths ?? []).filter(path =>
    !allowedPaths?.length || allowedPaths.includes(path.id) || allowedPaths.includes(path.code));
  const subjects = (taxonomy?.subjects ?? []).filter(subject => subject.pathId === pathId);

  useEffect(() => {
    const controller = new AbortController();
    contentClient.taxonomyCore(controller.signal)
      .then(result => { if (!controller.signal.aborted) setTaxonomy(result); })
      .catch(() => { if (!controller.signal.aborted) setCatalogError(true); });
    async function loadClasses() {
      const first = await organizationsClient.classes(schoolId, controller.signal);
      const all = [...first.classes];
      for (let next = 2; next <= first.pagination.totalPages && !controller.signal.aborted; next++) {
        const result = await organizationsClient.classes(schoolId, controller.signal, next);
        all.push(...result.classes);
      }
      if (!controller.signal.aborted) setClasses(all.filter(item => item.schoolId === schoolId));
    }
    loadClasses().catch(() => { if (!controller.signal.aborted) setClassesError(true); });
    return () => controller.abort();
  }, [schoolId, catalogRetry]);

  useEffect(() => {
    if (!subjectId) return;
    const controller = new AbortController();
    learningEvidenceClient.get({
      source: 'school_assessment', schoolId, pathId, subjectId, classId, status, search, page, limit: pageSize,
    }, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      const matches = result.source === 'school_assessment' && result.subjectId === subjectId && result.page === page;
      setRead({ key, report: matches ? result : null });
    }).catch(() => {
      if (!controller.signal.aborted) setRead({ key, report: null });
    });
    return () => controller.abort();
  }, [key, schoolId, pathId, subjectId, classId, status, search, page]);

  return <section aria-label="رادار مهارات المدرسة" className="mt-6 min-w-0 space-y-4">
    <header className="rounded-3xl border bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-black"><Activity size={20} className="text-emerald-600" /> رادار مهارات المدرسة</h2>
      <p className="mt-2 text-sm text-slate-600">يعرض دقة الإجابات في المهارات المقاسة من اختبارات المدرسة للمادة المختارة.</p>
    </header>
    <div className="rounded-3xl border bg-white p-4 sm:p-5">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-bold">المسار
          <select aria-label="المسار" className={fieldClass} value={pathId} disabled={!taxonomy} onChange={event => {
            setPathId(event.target.value); setSubjectId(''); setRead(undefined); setPage(1);
          }}>
            <option value="">اختر المسار</option>
            {paths.map(path => <option key={path.id} value={path.id}>{path.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">المادة
          <select aria-label="المادة" className={fieldClass} value={subjectId} disabled={!pathId} onChange={event => {
            setSubjectId(event.target.value); setRead(undefined); setPage(1);
          }}>
            <option value="">اختر المادة</option>
            {subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">الفصل
          <select aria-label="الفصل" className={fieldClass} value={classId} disabled={!classes} onChange={event => {
            setClassId(event.target.value); setRead(undefined); setPage(1);
          }}>
            <option value="">جميع الفصول</option>
            {classes?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">حالة الطالب في المادة
          <select className={fieldClass} value={status} onChange={event => {
            setStatus(event.target.value as LearningEvidenceStatus | ''); setRead(undefined); setPage(1);
          }}>
            <option value="">كل الحالات</option>
            {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={event => {
        event.preventDefault();
        const next = name.trim();
        if (search === next && page === 1) return;
        setSearch(next); setRead(undefined); setPage(1);
      }}>
        <label className="min-w-0 text-sm font-bold">اسم الطالب
          <input className={fieldClass} value={name} maxLength={80} onChange={event => setName(event.target.value)} />
        </label>
        <button className={buttonClass}>بحث</button>
      </form>
      {catalogError || classesError ? <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-rose-800">
        <p>{catalogError ? 'تعذر تحميل المسارات والمواد.' : 'تعذر تحميل قائمة الفصول.'}</p>
        <button type="button" className={buttonClass} onClick={() => {
          setCatalogError(false); setClassesError(false); setCatalogRetry(current => current + 1);
        }}>إعادة تحميل القوائم</button>
      </div> : null}
      {taxonomy && !paths.length ? <p className="mt-3 text-sm text-slate-600">لا توجد مسارات متاحة للمدرسة.</p> : null}
      {pathId && !subjects.length ? <p className="mt-3 text-sm text-slate-600">لا توجد مواد متاحة في هذا المسار.</p> : null}
    </div>
    {!subjectId ? <p className="rounded-2xl border bg-white p-4 text-sm">اختر المسار والمادة لعرض أدلة المهارات.</p> : null}
    {subjectId && report === undefined ? <p role="status" className="rounded-2xl border bg-white p-4 text-sm">جارٍ تحميل أدلة المهارات…</p> : null}
    {report === null ? <div role="alert" className="rounded-2xl border border-rose-200 bg-white p-4 text-sm text-rose-800">
      <p>تعذر تحميل أدلة المهارات.</p>
      <button type="button" className={`mt-2 ${buttonClass}`} onClick={() => setRetry(current => current + 1)}>إعادة المحاولة</button>
    </div> : null}
    {report ? <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-slate-700">آخر {report.days} يومًا · {report.filteredTotal} طالب مطابق</p>
        <div aria-label="طريقة عرض النتائج" role="group" className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} aria-pressed={view === 'cards'} onClick={() => setView('cards')}>بطاقات</button>
          <button type="button" className={buttonClass} aria-pressed={view === 'list'} onClick={() => setView('list')}>قائمة</button>
        </div>
      </div>
      {!report.students.length ? <p className="rounded-2xl border bg-white p-4 text-sm">لا يوجد طلاب مطابقون للفلاتر.</p> : null}
      <ul className={view === 'cards' ? 'grid gap-3 lg:grid-cols-2' : 'grid gap-3'}>
        {report.students.map(student => <li key={student.id} className="min-w-0 rounded-2xl border bg-white p-4">
          <h3 className="break-words font-black">{student.name}</h3>
          <p className="mt-1 text-sm text-slate-600">{labels[student.status]}</p>
          {student.skills.length
            ? <ul className="mt-3 space-y-2">{student.skills.map(skill => <SkillResult key={skill.id} skill={skill} />)}</ul>
            : <p className="mt-3 text-sm text-slate-600">لا توجد إجابات مقاسة لهذا الطالب.</p>}
        </li>)}
      </ul>
      {report.filteredTotal > report.limit ? <nav aria-label="صفحات رادار المهارات" className="flex flex-wrap items-center gap-3">
        <button type="button" className={buttonClass} disabled={page <= 1} onClick={() => { setRead(undefined); setPage(page - 1); }}>السابق</button>
        <span className="text-sm">صفحة {page} من {Math.ceil(report.filteredTotal / report.limit)}</span>
        <button type="button" className={buttonClass} disabled={page * report.limit >= report.filteredTotal} onClick={() => { setRead(undefined); setPage(page + 1); }}>التالي</button>
      </nav> : null}
    </div> : null}
  </section>;
}
