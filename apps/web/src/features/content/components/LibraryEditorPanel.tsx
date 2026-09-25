import { ArrowRight, CheckCircle2, Loader2, Save } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { contentClient } from '../api/content-client';
import type {
  CreateLibraryInput,
  LibraryDetail,
  LibraryItemType,
  TaxonomyCore,
  TaxonomyFull,
  UpdateLibraryInput,
} from '../api/content-types';

interface LibraryEditorPanelProps {
  itemId?: string;
  coreTaxonomy: TaxonomyCore;
  initialPathId: string;
  initialSubjectId: string;
  lockScope: boolean;
  getCsrfToken(): Promise<string>;
  onCancel(): void;
  onSaved(): void;
}

const itemTypes: Array<{ value: LibraryItemType; label: string }> = [
  { value: 'link', label: 'رابط' },
  { value: 'pdf', label: 'PDF' },
  { value: 'doc', label: 'مستند' },
  { value: 'video', label: 'فيديو' },
];

export function LibraryEditorPanel({
  itemId,
  coreTaxonomy,
  initialPathId,
  initialSubjectId,
  lockScope,
  getCsrfToken,
  onCancel,
  onSaved,
}: LibraryEditorPanelProps) {
  const editing = Boolean(itemId);
  const [existing, setExisting] = useState<LibraryDetail | null>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomyFull>({ ...coreTaxonomy, skills: [] });
  const [loading, setLoading] = useState(editing);
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pathId, setPathId] = useState(initialPathId);
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<LibraryItemType>('link');
  const [externalUrl, setExternalUrl] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [skillIds, setSkillIds] = useState<string[]>([]);

  function applyItem(row: LibraryDetail) {
    setExisting(row);
    setPathId(row.pathId);
    setSubjectId(row.subjectId);
    setTitle(row.title);
    setDescription(row.description || '');
    setType(row.type as LibraryItemType);
    setExternalUrl(row.externalUrl || '');
    setIsVisible(row.isVisible);
    setIsLocked(row.isLocked);
    setSkillIds(row.skillIds || []);
  }

  useEffect(() => {
    const controller = new AbortController();
    contentClient.taxonomyFull(controller.signal)
      .then(setTaxonomy)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'تعذر تحميل المهارات.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setTaxonomyLoading(false);
      });
    if (itemId) {
      contentClient.libraryItem(itemId, controller.signal)
        .then((result) => applyItem(result.item))
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'تعذر تحميل عنصر المكتبة.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }
    return () => controller.abort();
  }, [itemId]);

  const subjects = useMemo(() => taxonomy.subjects.filter((subject) => !pathId || subject.pathId === pathId), [pathId, taxonomy.subjects]);
  const skills = useMemo(() => taxonomy.skills.filter((skill) => skill.subjectId === subjectId), [subjectId, taxonomy.skills]);

  useEffect(() => {
    if (subjectId && !subjects.some((subject) => subject.id === subjectId)) {
      setSubjectId('');
      setSkillIds([]);
    }
  }, [subjectId, subjects]);
  useEffect(() => {
    setSkillIds((current) => current.filter((id) => skills.some((skill) => skill.id === id)));
  }, [skills]);

  const lockedByWorkflow = Boolean(existing && (existing.workflowStatus === 'approved' || existing.workflowStatus === 'archived'));
  const canMutate = !lockedByWorkflow;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!pathId || !subjectId || !title.trim() || skillIds.length === 0) {
      setError('أكمل المسار والمادة والعنوان ومهارة واحدة على الأقل.');
      return;
    }
    if (!externalUrl.trim() && !existing?.primaryAssetId) {
      setError('أدخل رابط المصدر. منتقي Media/R2 سيُضاف في شريحة Media UI.');
      return;
    }

    const base: CreateLibraryInput = {
      pathId,
      subjectId,
      title: title.trim(),
      description: description.trim(),
      type,
      externalUrl: externalUrl.trim(),
      isVisible,
      isLocked,
      skillIds,
      primaryAssetId: existing?.primaryAssetId || '',
    };

    setSaving(true);
    try {
      const csrf = await getCsrfToken();
      if (existing && itemId) {
        const update: UpdateLibraryInput = {
          ...base,
          expectedRevision: existing.revision,
          ownerType: existing.ownerType as UpdateLibraryInput['ownerType'],
          ownerUserId: existing.ownerUserId,
          ownerSchoolId: existing.ownerSchoolId,
          assignedTeacherId: existing.assignedTeacherId,
          revenueSharePercentage: existing.revenueSharePercentage,
        };
        await contentClient.updateLibraryItem(itemId, update, csrf);
      } else {
        await contentClient.createLibraryItem(base, csrf);
      }
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ عنصر المكتبة.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="min-h-[calc(100vh-5rem)] bg-gray-50 p-10 text-center font-black text-gray-500">جاري تحميل عنصر المكتبة...</main>;

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-6 sm:px-6 lg:px-8">
      <form onSubmit={submit} className="mx-auto max-w-5xl space-y-5">
        <section className="flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-black text-indigo-600">Library Manager</div>
            <h1 className="mt-1 text-2xl font-black text-gray-900">{editing ? 'تعديل عنصر المكتبة' : 'إضافة عنصر للمكتبة'}</h1>
            <p className="mt-2 text-sm font-medium leading-7 text-gray-500">المكتبة تحفظ البيانات الوصفية والمراجع؛ البايتات الكبيرة تظل في Media/R2.</p>
          </div>
          <button type="button" onClick={onCancel} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-black text-gray-700"><ArrowRight size={18} />رجوع</button>
        </section>

        {lockScope ? <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">نطاق المعلم مثبت على المسار والمادة المختارين.</div> : null}
        {lockedByWorkflow ? <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">العنصر معتمد أو مؤرشف؛ التعديل المباشر مقفول.</div> : null}
        {error ? <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div> : null}

        <section className="grid gap-5 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2"><span className="text-sm font-black text-gray-700">العنوان *</span><input disabled={!canMutate} value={title} maxLength={240} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold disabled:bg-gray-50" /></label>
          <label className="space-y-2"><span className="text-sm font-black text-gray-700">المسار *</span><select disabled={!canMutate || lockScope} value={pathId} onChange={(event) => { setPathId(event.target.value); setSubjectId(''); setSkillIds([]); }} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold disabled:bg-gray-50"><option value="">اختر المسار</option>{taxonomy.paths.map((path) => <option key={path.id} value={path.id}>{path.name}</option>)}</select></label>
          <label className="space-y-2"><span className="text-sm font-black text-gray-700">المادة *</span><select disabled={!canMutate || lockScope || !pathId} value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setSkillIds([]); }} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold disabled:bg-gray-50"><option value="">اختر المادة</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
          <label className="space-y-2"><span className="text-sm font-black text-gray-700">النوع</span><select disabled={!canMutate} value={type} onChange={(event) => setType(event.target.value as LibraryItemType)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold disabled:bg-gray-50">{itemTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="space-y-2"><span className="text-sm font-black text-gray-700">رابط المصدر *</span><input disabled={!canMutate} type="url" maxLength={2048} value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold disabled:bg-gray-50" placeholder="https://..." /></label>
          <label className="space-y-2 md:col-span-2"><span className="text-sm font-black text-gray-700">الوصف</span><textarea disabled={!canMutate} rows={5} maxLength={12000} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium leading-7 disabled:bg-gray-50" /></label>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-black text-gray-900">المهارات *</h2>
          {taxonomyLoading ? <p className="mt-2 text-xs font-bold text-gray-500">جاري تحميل المهارات...</p> : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{skills.map((skill) => { const checked = skillIds.includes(skill.id); return <label key={skill.id} className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'}`}><input disabled={!canMutate} type="checkbox" checked={checked} onChange={() => setSkillIds((current) => checked ? current.filter((id) => id !== skill.id) : [...current, skill.id])} className="mt-1" /><span className="font-bold text-gray-800">{skill.name}</span></label>; })}</div>
        </section>

        <section className="grid gap-3 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6">
          <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm font-black text-gray-700"><input disabled={!canMutate} type="checkbox" checked={isVisible} onChange={(event) => setIsVisible(event.target.checked)} />ظاهر على المنصة</label>
          <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm font-black text-gray-700"><input disabled={!canMutate} type="checkbox" checked={isLocked} onChange={(event) => setIsLocked(event.target.checked)} />مغلق حسب الوصول</label>
        </section>

        <section className="flex flex-col gap-3 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500"><CheckCircle2 size={17} className="text-emerald-600" />الحفظ لا يعتمد العنصر تلقائيًا.</div>
          <button type="submit" disabled={!canMutate || saving || taxonomyLoading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
        </section>
      </form>
    </main>
  );
}
