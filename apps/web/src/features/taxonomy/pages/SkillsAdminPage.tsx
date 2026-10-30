import { BookOpen, ChevronDown, ChevronUp, Edit2, HelpCircle, Link2, Loader2, Plus, Target, Unlink, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import type { LessonSummary } from '../../content/api/content-types';
import { lessonLinkWrite } from '../../content/api/lesson-link-write';
import { LessonEditorPanel } from '../../content/components/LessonEditorPanel';
import { questionBankClient, type QuestionSummary } from '../../questionbank/api/questionbank-client';
import {
  taxonomyAdminClient,
  type AdminTaxonomyBootstrap,
  type AdminTaxonomySkill,
} from '../api/taxonomy-admin-client';

const EMPTY: AdminTaxonomyBootstrap = { paths: [], levels: [], subjects: [], skills: [] };
type SkillDraft = { id?: string; kind: 'main' | 'sub'; subjectId: string; parentSkillId: string; code: string; name: string; description: string; sortOrder: number };
type LinkedQuestions = { skillId: string; rows: QuestionSummary[]; total: number | null; loading: boolean; error: string };
type LinkedLessons = { skillId: string; rows: LessonSummary[]; loading: boolean; hasMore: boolean; error: string };

export function SkillsAdminPage() {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const [data, setData] = useState<AdminTaxonomyBootstrap>(EMPTY);
  const [pathFilter, setPathFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [busy, setBusy] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [expandedMainId, setExpandedMainId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SkillDraft | null>(null);
  const [expandedSubSkillId, setExpandedSubSkillId] = useState<string | null>(null);
  const [linkedQuestions, setLinkedQuestions] = useState<LinkedQuestions>({ skillId: '', rows: [], total: null, loading: false, error: '' });
  const [linkedLessons, setLinkedLessons] = useState<LinkedLessons>({ skillId: '', rows: [], loading: false, hasMore: false, error: '' });
  const [lessonPage, setLessonPage] = useState(1);
  const [lessonRefresh, setLessonRefresh] = useState(0);
  const [linkTarget, setLinkTarget] = useState<AdminTaxonomySkill | null>(null);
  const [lessonPendingId, setLessonPendingId] = useState('');
  const [lessonError, setLessonError] = useState('');
  const [lessonNotice, setLessonNotice] = useState('');
  const [lessonEditor, setLessonEditor] = useState<{ skill: AdminTaxonomySkill; lessonId?: string } | null>(null);
  const isAdmin = user?.roles.includes('admin') ?? false;

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    const controller = new AbortController();
    setBusy(true);
    setError('');
    taxonomyAdminClient.bootstrap(controller.signal)
      .then(setData)
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر تحميل المهارات'); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [authLoading, isAdmin, refresh]);

  const subjects = useMemo(() => data.subjects.filter((subject) => !pathFilter || subject.pathId === pathFilter), [data.subjects, pathFilter]);
  const visibleSubjectIds = useMemo(() => new Set(subjects.filter((subject) => !subjectFilter || subject.id === subjectFilter).map((subject) => subject.id)), [subjects, subjectFilter]);
  const visibleSkills = useMemo(() => data.skills.filter((skill) => visibleSubjectIds.has(skill.subjectId)), [data.skills, visibleSubjectIds]);
  const mainSkills = useMemo(() => visibleSkills.filter((skill) => skill.kind === 'main').sort((a, b) => a.sortOrder - b.sortOrder), [visibleSkills]);
  const subSkills = useMemo(() => visibleSkills.filter((skill) => skill.kind === 'sub').sort((a, b) => a.sortOrder - b.sortOrder), [visibleSkills]);
  const subjectName = (id: string) => data.subjects.find((subject) => subject.id === id)?.name || 'غير محدد';
  const pathName = (subjectId: string) => data.paths.find((path) => path.id === data.subjects.find((subject) => subject.id === subjectId)?.pathId)?.name || 'غير محدد';

  useEffect(() => {
    if (!isAdmin || !expandedSubSkillId || !subSkills.some((skill) => skill.id === expandedSubSkillId)) return;
    const controller = new AbortController();
    const skillId = expandedSubSkillId;
    setLinkedQuestions({ skillId, rows: [], total: null, loading: true, error: '' });
    Promise.all([
      questionBankClient.list({ page: 1, limit: 6, skillIds: [skillId] }, controller.signal),
      questionBankClient.coverage({ page: 1, limit: 6, skillIds: [skillId] }, controller.signal),
    ]).then(([page, coverage]) => {
      if (!controller.signal.aborted) setLinkedQuestions({ skillId, rows: page.items, total: coverage.questionsTotal, loading: false, error: '' });
    }).catch((reason) => {
      if (!controller.signal.aborted) setLinkedQuestions({ skillId, rows: [], total: null, loading: false, error: reason instanceof Error ? reason.message : 'تعذر تحميل الأسئلة المرتبطة' });
    });
    return () => controller.abort();
  }, [expandedSubSkillId, isAdmin, subSkills]);

  useEffect(() => {
    if (!isAdmin || !expandedSubSkillId) return;
    const sub = subSkills.find((skill) => skill.id === expandedSubSkillId);
    if (!sub) return;
    const controller = new AbortController();
    setLinkedLessons((current) => ({ skillId: sub.id, rows: lessonPage > 1 && current.skillId === sub.id ? current.rows : [], loading: true, hasMore: false, error: '' }));
    contentClient.lessons({ page: lessonPage, limit: 50, subjectId: sub.subjectId, skillId: sub.id }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setLinkedLessons((current) => ({ skillId: sub.id, rows: lessonPage > 1 && current.skillId === sub.id ? [...current.rows, ...result.items] : result.items, loading: false, hasMore: result.hasMore, error: '' }));
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setLinkedLessons((current) => ({ ...current, loading: false, error: reason instanceof Error ? reason.message : 'تعذر تحميل الدروس المرتبطة' }));
      });
    return () => controller.abort();
  }, [expandedSubSkillId, isAdmin, lessonPage, lessonRefresh, subSkills]);

  async function detachLesson(sub: AdminTaxonomySkill, lesson: LessonSummary) {
    if (lessonPendingId) return;
    setLessonPendingId(lesson.id); setLessonError(''); setLessonNotice('');
    try {
      const detail = (await contentClient.lesson(lesson.id)).lesson;
      if (detail.subjectId !== sub.subjectId || detail.pathId !== data.subjects.find((subject) => subject.id === sub.subjectId)?.pathId) throw new Error('الدرس لا ينتمي إلى مادة المهارة.');
      if (detail.workflowStatus === 'approved' || detail.workflowStatus === 'archived') throw new Error('لا يمكن تعديل درس معتمد أو مؤرشف؛ أعده لمسودة من إدارة المحتوى أولًا.');
      const next = detail.skillIds.filter((skillId) => skillId !== sub.id);
      if (next.length === 0) throw new Error('لا يمكن فصل المهارة الوحيدة عن الدرس. اربط الدرس بمهارة بديلة أولًا.');
      await contentClient.updateLesson(detail.id, lessonLinkWrite(detail, next), await getCsrfToken());
      setLessonNotice('تم فصل الدرس عن المهارة دون حذف محتواه.');
      setLessonPage(1); setLessonRefresh((value) => value + 1);
    } catch (reason) {
      setLessonError(reason instanceof Error ? reason.message : 'تعذر فصل الدرس');
    } finally { setLessonPendingId(''); }
  }

  const openCreate = (kind: 'main' | 'sub', parent?: AdminTaxonomySkill) => {
    setError('');
    setNotice('');
    setDraft({ kind, subjectId: parent?.subjectId || subjectFilter || '', parentSkillId: parent?.id || '', code: '', name: '', description: '', sortOrder: 0 });
  };
  const openEdit = (skill: AdminTaxonomySkill) => {
    setError('');
    setDraft({ id: skill.id, kind: skill.kind, subjectId: skill.subjectId, parentSkillId: skill.parentSkillId || '', code: skill.code, name: skill.name, description: skill.description, sortOrder: skill.sortOrder });
  };

  async function saveSkill() {
    if (!draft || pending) return;
    if (!draft.name.trim() || (!draft.id && !draft.code.trim())) return setError('أدخل اسم المهارة وكودها.');
    if (!draft.subjectId) return setError('اختر المادة قبل حفظ المهارة.');
    if (draft.kind === 'sub' && !draft.parentSkillId) return setError('اختر المهارة الرئيسة أولًا.');
    setPending(true); setError(''); setNotice('');
    try {
      const csrf = await getCsrfToken();
      if (draft.id) {
        await taxonomyAdminClient.updateSkill(draft.id, { name: draft.name.trim(), description: draft.description.trim(), sortOrder: draft.sortOrder }, csrf);
      } else {
        await taxonomyAdminClient.createSkill({
          subjectId: draft.subjectId, parentSkillId: draft.kind === 'sub' ? draft.parentSkillId : '',
          code: draft.code.trim(), name: draft.name.trim(), description: draft.description.trim(),
          kind: draft.kind, sortOrder: draft.sortOrder,
        }, csrf);
      }
      setDraft(null); // Failure never loses the editor or the user's input.
      setNotice('تم حفظ المهارة.');
      setRefresh((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر حفظ المهارة');
    } finally { setPending(false); }
  }


  if (authLoading) return <main className="p-10 text-center font-black">جاري التحقق من الصلاحيات...</main>;
  if (!isAdmin) return <main dir="rtl" className="p-10 text-center font-black text-rose-700">مركز المهارات متاح لمدير المنصة فقط.</main>;

  return <main dir="rtl" data-testid="admin-skills-center" className="space-y-6 pb-12">
    <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">مركز المهارات</h1>
        <p className="mt-1 text-sm text-gray-500">المصدر الحقيقي للمهارات في المنصة: المهارات الرئيسة والمهارات الفرعية وربطها بالدروس والأسئلة.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => openCreate('main')} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white shadow-sm hover:bg-indigo-700"><Plus size={18}/> إضافة مهارة رئيسة</button>
      </div>
    </header>

    {error && !draft ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}
    {notice ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-bold text-emerald-700">{notice}</div> : null}
    {busy ? <div role="status" className="flex items-center gap-2 rounded-xl border bg-white p-5 font-bold text-slate-600"><Loader2 size={18} className="animate-spin"/> جاري تحميل المهارات...</div> : null}

    <section className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:flex-row" aria-label="فلاتر المهارات">
      <select data-testid="skills-filter-path" aria-label="فلتر المسار" value={pathFilter} onChange={(event) => {setPathFilter(event.target.value); setSubjectFilter(''); setExpandedMainId(null); setExpandedSubSkillId(null);}} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-indigo-500">
        <option value="">كل المسارات</option>
        {data.paths.map((path) => <option key={path.id} value={path.id}>{path.name}</option>)}
      </select>
      <select data-testid="skills-filter-subject" aria-label="فلتر المادة - اختر المسار أولا" value={subjectFilter} onChange={(event) => {setSubjectFilter(event.target.value); setExpandedMainId(null); setExpandedSubSkillId(null);}} disabled={!pathFilter} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 disabled:opacity-50">
        <option value="">كل المواد</option>
        {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
      </select>
    </section>

    <section className="grid grid-cols-2 gap-4 md:grid-cols-6" aria-label="إحصاءات المهارات">
      <div data-testid="skills-counter-main" className="rounded-xl border bg-white p-4 shadow-sm"><p className="mb-1 text-sm text-gray-500">المهارات الرئيسة</p><b className="text-2xl text-indigo-600">{mainSkills.length}</b></div>
      <div data-testid="skills-counter-sub" className="rounded-xl border bg-white p-4 shadow-sm"><p className="mb-1 text-sm text-gray-500">المهارات الفرعية</p><b className="text-2xl text-emerald-600">{subSkills.length}</b></div>
    </section>

    <section aria-label="شجرة المهارات" className="space-y-4">
      {!busy && mainSkills.length === 0 ? <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">لا توجد مهارات رئيسة في هذا النطاق.</div> : null}
      {mainSkills.map((main) => {
        const children = subSkills.filter((sub) => sub.parentSkillId === main.id);
        const expanded = expandedMainId === main.id;
        return <article key={main.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className={`flex items-center gap-3 p-4 ${expanded ? 'border-b border-indigo-100 bg-indigo-50/50' : 'bg-gray-50'}`}>
            <button type="button" onClick={() => { setExpandedMainId(expanded ? null : main.id); setExpandedSubSkillId(null); }} aria-label={`${expanded ? 'طي' : 'فتح'} المهارة الرئيسة ${main.name}`} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-3 text-right">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white"><Target size={23}/></span>
              <span className="min-w-0"><b className="block text-lg text-gray-900">{main.name}</b><span className="text-sm text-gray-500">{children.length} مهارات فرعية · {subjectName(main.subjectId)} · {pathName(main.subjectId)}</span></span>
              {expanded ? <ChevronUp size={19} className="text-indigo-600"/> : <ChevronDown size={19} className="text-gray-400"/>}
            </button>
            <button type="button" onClick={() => openEdit(main)} aria-label={`تعديل المهارة الرئيسة ${main.name}`} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"><Edit2 size={18}/></button>
          </div>
          {expanded ? <div className="space-y-3 p-5">
            <div className="flex items-center justify-between"><h2 className="font-bold text-gray-800">المهارات الفرعية ({main.name})</h2><button type="button" onClick={() => openCreate('sub', main)} className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700"><Plus size={16}/> إضافة مهارة فرعية</button></div>
            {children.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-center text-sm text-gray-500">لا توجد مهارات فرعية بعد.</p> : null}
            {children.map((sub) => {
              const subExpanded = expandedSubSkillId === sub.id;
              const questions = linkedQuestions.skillId === sub.id ? linkedQuestions : null;
              const lessons = linkedLessons.skillId === sub.id ? linkedLessons : null;
              return <article key={sub.id} className="overflow-hidden rounded-xl border bg-white">
                <div className="flex items-center gap-2 bg-gray-50 p-3">
                  <button type="button" onClick={() => { setExpandedSubSkillId(subExpanded ? null : sub.id); setLessonPage(1); setLessonError(''); setLessonNotice(''); }} aria-label={`${subExpanded ? 'طي' : 'فتح'} المهارة الفرعية ${sub.name}`} aria-expanded={subExpanded} className="flex min-w-0 flex-1 items-center gap-2 text-right">
                    <Target size={16} className="shrink-0 text-indigo-600"/>
                    <span className="min-w-0"><b className="block truncate">{sub.name}</b><span className="text-xs text-gray-500">{sub.code}</span></span>
                    {subExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                  </button>
                  <button type="button" onClick={() => openEdit(sub)} aria-label={`تعديل المهارة الفرعية ${sub.name}`} className="rounded-lg p-2 text-blue-600"><Edit2 size={16}/></button>
                  
                </div>
                {subExpanded ? <section className="space-y-3 border-t p-4" aria-label={`تفاصيل مهارة ${sub.name}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="inline-flex items-center gap-2 font-bold text-gray-800"><BookOpen size={17} className="text-indigo-600"/> الدروس المرتبطة</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => { setLessonError(''); setLinkTarget(sub); }} className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700"><Link2 size={14}/> ربط درس موجود</button>
                      <button type="button" onClick={() => { setLessonError(''); setLessonEditor({ skill: sub }); }} className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700"><Plus size={14}/> إضافة درس جديد</button>
                    </div>
                  </div>
                  {lessonError ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{lessonError}</p> : null}
                  {lessonNotice ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{lessonNotice}</p> : null}
                  {lessons?.loading || !lessons ? <p role="status" className="text-sm text-gray-500">جاري تحميل الدروس المرتبطة...</p> : null}
                  {lessons?.error ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{lessons.error}</p> : null}
                  {lessons && !lessons.loading && !lessons.error ? <>
                    {lessons.rows.length ? <ul className="space-y-2">{lessons.rows.map((lesson) => <li key={lesson.id} className="flex flex-wrap items-center gap-2 rounded-xl border bg-slate-50 p-3">
                      <span className="min-w-0 flex-1"><b className="block truncate text-sm text-gray-800">{lesson.title}</b><span className="text-xs text-gray-500">{lesson.type} · {lesson.workflowStatus === 'approved' ? 'معتمد' : lesson.workflowStatus === 'archived' ? 'مؤرشف' : 'قابل للتحرير بحسب الصلاحية'}</span></span>
                      <button type="button" aria-label={`تعديل الدرس ${lesson.title}`} disabled={!!lessonPendingId || lesson.workflowStatus === 'approved' || lesson.workflowStatus === 'archived'} title={lesson.workflowStatus === 'approved' || lesson.workflowStatus === 'archived' ? 'الدرس المعتمد أو المؤرشف محمي من التعديل' : 'تعديل الدرس'} onClick={() => setLessonEditor({ skill: sub, lessonId: lesson.id })} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"><Edit2 size={16}/></button>
                      <button type="button" aria-label={`فصل الدرس ${lesson.title} عن المهارة`} disabled={!!lessonPendingId || lesson.workflowStatus === 'approved' || lesson.workflowStatus === 'archived'} title={lesson.workflowStatus === 'approved' || lesson.workflowStatus === 'archived' ? 'الدرس المعتمد أو المؤرشف محمي من تعديل الروابط' : 'فصل الارتباط فقط دون حذف الدرس'} onClick={() => void detachLesson(sub, lesson)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"><Unlink size={14}/> فصل</button>
                    </li>)}</ul> : <p className="text-sm text-gray-500">لا توجد دروس مرتبطة بهذه المهارة.</p>}
                    {lessons.hasMore ? <button type="button" onClick={() => setLessonPage((page) => page + 1)} className="rounded-lg border px-3 py-2 text-xs font-bold text-indigo-700">عرض المزيد من الدروس</button> : null}
                  </> : null}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                    <h3 className="inline-flex items-center gap-2 font-bold text-gray-800"><HelpCircle size={17} className="text-indigo-600"/> الأسئلة المرتبطة</h3>
                    <Link to={`/admin-dashboard/questions?skillId=${encodeURIComponent(sub.id)}`} className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">فتح بنك الأسئلة لهذه المهارة</Link>
                  </div>
                  {questions?.loading || !questions ? <p role="status" className="text-sm text-gray-500">جاري تحميل الأسئلة المرتبطة...</p> : null}
                  {questions?.error ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{questions.error}</p> : null}
                  {questions && !questions.loading && !questions.error ? <>
                    <p data-testid={`subskill-question-count-${sub.id}`} className="text-xs font-bold text-gray-500">{questions.total} سؤال مرتبط بهذه المهارة</p>
                    {questions.rows.length ? <ul className="space-y-2">{questions.rows.map((question) => <li key={question.id} className="flex items-center justify-between gap-3 rounded-lg border bg-slate-50 px-3 py-2"><span className="font-bold text-gray-700">{question.questionCode}</span><span className="text-xs text-gray-500">{question.workflowStatus === 'approved' ? 'معتمد' : question.workflowStatus === 'draft' ? 'مسودة' : 'قيد المراجعة'}</span></li>)}</ul> : <p className="text-sm text-gray-500">لا توجد أسئلة مرتبطة بهذه المهارة.</p>}
                    {questions.total !== null && questions.total > questions.rows.length ? <p className="text-xs text-gray-500">تظهر أول {questions.rows.length} أسئلة؛ افتح بنك الأسئلة لمشاهدة الباقي.</p> : null}
                  </> : null}
                </section> : null}
              </article>;
            })}
          </div> : null}
        </article>;
      })}
    </section>

    {draft ? <div role="presentation" className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3" onMouseDown={(event) => {if (event.target === event.currentTarget && !pending) setDraft(null);}}>
      <section role="dialog" aria-modal="true" aria-label={draft.id ? 'تعديل المهارة' : draft.kind === 'main' ? 'إضافة مهارة رئيسة' : 'إضافة مهارة فرعية'} className="w-full max-w-xl space-y-3 rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{draft.id ? 'تعديل المهارة' : draft.kind === 'main' ? 'إضافة مهارة رئيسة' : 'إضافة مهارة فرعية'}</h2><button type="button" aria-label="إغلاق المحرر" disabled={pending} onClick={() => setDraft(null)}><X size={20}/></button></div>
        {error ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div> : null}
        {!draft.id ? <select aria-label="مادة المهارة" value={draft.subjectId} disabled={draft.kind === 'sub'} onChange={(event) => setDraft({ ...draft, subjectId: event.target.value })} className="w-full rounded-lg border p-3"><option value="">اختر المادة</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select> : null}
        {!draft.id ? <input aria-label="كود المهارة" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} placeholder="الكود" className="w-full rounded-lg border p-3"/> : null}
        <input aria-label="اسم المهارة" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="اسم المهارة" className="w-full rounded-lg border p-3"/>
        <textarea aria-label="وصف المهارة" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="الوصف" className="w-full rounded-lg border p-3"/>
        <button type="button" disabled={pending} onClick={() => void saveSkill()} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white disabled:opacity-50">{pending ? 'جاري الحفظ...' : 'حفظ المهارة'}</button>
      </section>
    </div> : null}
    {linkTarget ? <LinkLessonDialog
      skill={linkTarget}
      pathId={data.subjects.find((subject) => subject.id === linkTarget.subjectId)?.pathId || ''}
      getCsrfToken={getCsrfToken}
      onClose={() => setLinkTarget(null)}
      onLinked={() => { setLinkTarget(null); setLessonNotice('تم ربط الدرس بالمهارة.'); setLessonPage(1); setLessonRefresh((value) => value + 1); }}
    /> : null}
    {lessonEditor ? <LessonEditorPanel
      key={`${lessonEditor.skill.id}:${lessonEditor.lessonId || 'new'}`}
      lessonId={lessonEditor.lessonId}
      coreTaxonomy={data}
      initialPathId={data.subjects.find((subject) => subject.id === lessonEditor.skill.subjectId)?.pathId || ''}
      initialSubjectId={lessonEditor.skill.subjectId}
      initialSkillIds={[lessonEditor.skill.id]}
      requiredSkillIds={[lessonEditor.skill.id]}
      scopeContext="skill"
      lockScope
      getCsrfToken={getCsrfToken}
      onCancel={() => setLessonEditor(null)}
      onSaved={() => {
        setLessonEditor(null);
        setLessonError('');
        setLessonNotice(lessonEditor.lessonId ? 'تم حفظ تعديلات الدرس.' : 'تم إنشاء الدرس وربطه بالمهارة كمسودة.');
        setLessonPage(1);
        setLessonRefresh((value) => value + 1);
      }}
    /> : null}
  </main>;
}

function LinkLessonDialog({ skill, pathId, getCsrfToken, onClose, onLinked }: {
  skill: AdminTaxonomySkill;
  pathId: string;
  getCsrfToken(): Promise<string>;
  onClose(): void;
  onLinked(): void;
}) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<LessonSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    if (page === 1) {
      setRows([]);
      setHasMore(false);
    }
    contentClient.lessons({ page, limit: 50, pathId, subjectId: skill.subjectId }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setRows((current) => page === 1 ? result.items : [...current, ...result.items.filter((item) => !current.some((previous) => previous.id === item.id))]);
        setHasMore(result.hasMore);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر تحميل الدروس المتاحة للربط');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, pathId, skill.subjectId, retry]);

  async function linkLesson() {
    const row = rows.find((item) => item.id === selectedLessonId);
    if (!row || pendingId || loading) return;
    setPendingId(row.id);
    setError('');
    try {
      const detail = (await contentClient.lesson(row.id)).lesson;
      if (detail.subjectId !== skill.subjectId || detail.pathId !== pathId) throw new Error('لا يمكن ربط درس من مادة أو مسار مختلف.');
      if (detail.workflowStatus === 'approved' || detail.workflowStatus === 'archived') throw new Error('لا يمكن تعديل درس معتمد أو مؤرشف؛ أعده لمسودة أولًا.');
      if (detail.skillIds.includes(skill.id)) throw new Error('هذا الدرس مرتبط بالفعل بهذه المهارة.');
      await contentClient.updateLesson(detail.id, lessonLinkWrite(detail, [...detail.skillIds, skill.id]), await getCsrfToken());
      onLinked();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر ربط الدرس');
    } finally { setPendingId(''); }
  }

  return <div role="presentation" className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-4">
    <section role="dialog" aria-modal="true" aria-label="ربط درس موجود" className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-800">ربط درس موجود</h2>
        <button type="button" aria-label="إغلاق ربط الدرس" disabled={!!pendingId} onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100"><X size={20}/></button>
      </div>
      <div>
        <label htmlFor="skills-lesson-to-link" className="mb-2 block text-sm font-bold text-gray-700">اختر الدرس</label>
        <select id="skills-lesson-to-link" value={selectedLessonId} disabled={!!pendingId || (loading && rows.length === 0)} onChange={(event) => setSelectedLessonId(event.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500">
          <option value="">-- اختر درسًا --</option>
          {rows.filter((row) => row.workflowStatus !== 'approved' && row.workflowStatus !== 'archived').map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}
        </select>
      </div>
      {loading ? <p role="status" className="text-sm text-gray-500">جاري تحميل الدروس...</p> : null}
      {!loading && !error && rows.length === 0 ? <p className="text-sm text-gray-500">لا توجد دروس في هذه المادة للربط.</p> : null}
      {error ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}
      {error && !pendingId ? <button type="button" onClick={() => setRetry((value) => value + 1)} className="text-sm font-bold text-indigo-700">إعادة المحاولة</button> : null}
      {hasMore && !error ? <button type="button" disabled={loading || !!pendingId} onClick={() => setPage((current) => current + 1)} className="text-sm font-bold text-indigo-700">عرض المزيد من الدروس</button> : null}
      <div className="flex justify-end gap-3">
        <button type="button" disabled={!!pendingId} onClick={onClose} className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-100">إلغاء</button>
        <button type="button" disabled={!selectedLessonId || !!pendingId || loading} onClick={() => void linkLesson()} className="rounded-lg bg-indigo-600 px-5 py-2 font-bold text-white disabled:opacity-50">{pendingId ? 'جارٍ الربط...' : 'ربط'}</button>
      </div>
    </section>
  </div>;
}
