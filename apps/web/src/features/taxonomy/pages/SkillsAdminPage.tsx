import { ChevronDown, ChevronUp, Edit2, Loader2, Plus, RefreshCcw, Target, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../auth/state/AuthProvider';
import {
  taxonomyAdminClient,
  type AdminTaxonomyBootstrap,
  type AdminTaxonomySkill,
  type TaxonomyStatus,
} from '../api/taxonomy-admin-client';

const EMPTY: AdminTaxonomyBootstrap = { paths: [], levels: [], subjects: [], skills: [] };
const statuses: Record<TaxonomyStatus, string> = { active: 'نشط', inactive: 'غير نشط', archived: 'مؤرشف' };
type SkillDraft = { id?: string; kind: 'main' | 'sub'; subjectId: string; parentSkillId: string; code: string; name: string; description: string; sortOrder: number };

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
  const subSkills = useMemo(() => visibleSkills.filter((skill) => skill.kind === 'sub'), [visibleSkills]);
  const subjectName = (id: string) => data.subjects.find((subject) => subject.id === id)?.name || 'غير محدد';
  const pathName = (subjectId: string) => data.paths.find((path) => path.id === data.subjects.find((subject) => subject.id === subjectId)?.pathId)?.name || 'غير محدد';

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

  async function changeStatus(skill: AdminTaxonomySkill, status: TaxonomyStatus) {
    if (pending) return;
    setPending(true); setError(''); setNotice('');
    try {
      const csrf = await getCsrfToken();
      await taxonomyAdminClient.updateSkill(skill.id, { status }, csrf);
      setNotice(`تم تحديث الحالة إلى «${statuses[status]}».`);
      setRefresh((value) => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر تحديث حالة المهارة'); }
    finally { setPending(false); }
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
        <button type="button" onClick={() => setRefresh((value) => value + 1)} aria-label="تحديث المهارات" className="rounded-xl border border-gray-200 bg-white p-2.5 text-slate-600"><RefreshCcw size={18}/></button>
        <button type="button" onClick={() => openCreate('main')} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white shadow-sm hover:bg-indigo-700"><Plus size={18}/> إضافة مهارة رئيسة</button>
      </div>
    </header>

    {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}
    {notice ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-bold text-emerald-700">{notice}</div> : null}
    {busy ? <div role="status" className="flex items-center gap-2 rounded-xl border bg-white p-5 font-bold text-slate-600"><Loader2 size={18} className="animate-spin"/> جاري تحميل المهارات...</div> : null}

    <section className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:flex-row" aria-label="فلاتر المهارات">
      <select data-testid="skills-filter-path" aria-label="فلتر المسار" value={pathFilter} onChange={(event) => {setPathFilter(event.target.value); setSubjectFilter(''); setExpandedMainId(null);}} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 focus:ring-2 focus:ring-indigo-500">
        <option value="">كل المسارات</option>
        {data.paths.map((path) => <option key={path.id} value={path.id}>{path.name}</option>)}
      </select>
      <select data-testid="skills-filter-subject" aria-label="فلتر المادة - اختر المسار أولا" value={subjectFilter} onChange={(event) => {setSubjectFilter(event.target.value); setExpandedMainId(null);}} disabled={!pathFilter} className="flex-1 rounded-lg border border-gray-200 px-4 py-2 disabled:opacity-50">
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
            <button type="button" onClick={() => setExpandedMainId(expanded ? null : main.id)} aria-label={`${expanded ? 'طي' : 'فتح'} المهارة الرئيسة ${main.name}`} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-3 text-right">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white"><Target size={23}/></span>
              <span className="min-w-0"><b className="block text-lg text-gray-900">{main.name}</b><span className="text-sm text-gray-500">{children.length} مهارات فرعية · {subjectName(main.subjectId)} · {pathName(main.subjectId)}</span></span>
              {expanded ? <ChevronUp size={19} className="text-indigo-600"/> : <ChevronDown size={19} className="text-gray-400"/>}
            </button>
            <button type="button" onClick={() => openEdit(main)} aria-label={`تعديل المهارة الرئيسة ${main.name}`} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"><Edit2 size={18}/></button>
            <select aria-label={`حالة المهارة ${main.name}`} value={main.status} onChange={(event) => void changeStatus(main, event.target.value as TaxonomyStatus)} className="rounded-lg border bg-white p-2 text-xs font-bold">{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </div>
          {expanded ? <div className="space-y-3 p-5">
            <div className="flex items-center justify-between"><h2 className="font-bold text-gray-800">المهارات الفرعية ({main.name})</h2><button type="button" onClick={() => openCreate('sub', main)} className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700"><Plus size={16}/> إضافة مهارة فرعية</button></div>
            {children.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-center text-sm text-gray-500">لا توجد مهارات فرعية بعد.</p> : null}
            {children.map((sub) => <div key={sub.id} className="flex items-center gap-2 rounded-xl border bg-gray-50 p-3"><Target size={16} className="shrink-0 text-indigo-600"/><div className="min-w-0 flex-1"><b className="block truncate">{sub.name}</b><span className="text-xs text-gray-500">{sub.code}</span></div><button type="button" onClick={() => openEdit(sub)} aria-label={`تعديل المهارة الفرعية ${sub.name}`} className="rounded-lg p-2 text-blue-600"><Edit2 size={16}/></button><select aria-label={`حالة المهارة ${sub.name}`} value={sub.status} onChange={(event) => void changeStatus(sub, event.target.value as TaxonomyStatus)} className="rounded-lg border bg-white p-2 text-xs">{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>)}
          </div> : null}
        </article>;
      })}
    </section>

    {draft ? <div role="presentation" className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3" onMouseDown={(event) => {if (event.target === event.currentTarget && !pending) setDraft(null);}}>
      <section role="dialog" aria-modal="true" aria-label={draft.id ? 'تعديل المهارة' : draft.kind === 'main' ? 'إضافة مهارة رئيسة' : 'إضافة مهارة فرعية'} className="w-full max-w-xl space-y-3 rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{draft.id ? 'تعديل المهارة' : draft.kind === 'main' ? 'إضافة مهارة رئيسة' : 'إضافة مهارة فرعية'}</h2><button type="button" aria-label="إغلاق المحرر" disabled={pending} onClick={() => setDraft(null)}><X size={20}/></button></div>
        {!draft.id ? <select aria-label="مادة المهارة" value={draft.subjectId} disabled={draft.kind === 'sub'} onChange={(event) => setDraft({ ...draft, subjectId: event.target.value })} className="w-full rounded-lg border p-3"><option value="">اختر المادة</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select> : null}
        {!draft.id ? <input aria-label="كود المهارة" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} placeholder="الكود" className="w-full rounded-lg border p-3"/> : null}
        <input aria-label="اسم المهارة" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="اسم المهارة" className="w-full rounded-lg border p-3"/>
        <textarea aria-label="وصف المهارة" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="الوصف" className="w-full rounded-lg border p-3"/>
        <button type="button" disabled={pending} onClick={() => void saveSkill()} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white disabled:opacity-50">{pending ? 'جاري الحفظ...' : 'حفظ المهارة'}</button>
      </section>
    </div> : null}
  </main>;
}
