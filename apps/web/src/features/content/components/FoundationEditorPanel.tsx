import { ArrowRight, Link2, Loader2, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { contentClient } from '../api/content-client';
import type {
  CreateFoundationTopicInput,
  FoundationPlacements,
  FoundationTopicDetail,
  FoundationTopicStatus,
  FoundationTopicSummary,
  LibrarySummary,
  LessonSummary,
  TaxonomyCore,
  TaxonomyFull,
  UpdateFoundationTopicInput,
} from '../api/content-types';

interface FoundationEditorPanelProps {
  topicId?: string;
  coreTaxonomy: TaxonomyCore;
  initialPathId: string;
  initialSubjectId: string;
  getCsrfToken(): Promise<string>;
  onCancel(): void;
  onSaved(): void;
}

export function FoundationEditorPanel({
  topicId,
  coreTaxonomy,
  initialPathId,
  initialSubjectId,
  getCsrfToken,
  onCancel,
  onSaved,
}: FoundationEditorPanelProps) {
  const editing = Boolean(topicId);
  const [topic, setTopic] = useState<FoundationTopicDetail | null>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomyFull>({ ...coreTaxonomy, skills: [] });
  const [placements, setPlacements] = useState<FoundationPlacements>({ lessons: [], libraryItems: [] });
  const [topicOptions, setTopicOptions] = useState<FoundationTopicSummary[]>([]);
  const [lessonOptions, setLessonOptions] = useState<LessonSummary[]>([]);
  const [libraryOptions, setLibraryOptions] = useState<LibrarySummary[]>([]);
  const [selectionHasMore, setSelectionHasMore] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [selectedLibraryId, setSelectedLibraryId] = useState('');
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pathId, setPathId] = useState(initialPathId);
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [parentTopicId, setParentTopicId] = useState('');
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [status, setStatus] = useState<FoundationTopicStatus>('active');
  const [isVisible, setIsVisible] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [skillIds, setSkillIds] = useState<string[]>([]);

  function applyTopic(row: FoundationTopicDetail) {
    setTopic(row);
    setPathId(row.pathId);
    setSubjectId(row.subjectId);
    setParentTopicId(row.parentTopicId || '');
    setCode(row.code);
    setTitle(row.title);
    setDescription(row.description || '');
    setSortOrder(row.sortOrder);
    setStatus(row.status as FoundationTopicStatus);
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
      });
    if (topicId) {
      Promise.all([
        contentClient.foundationTopic(topicId, controller.signal),
        contentClient.foundationPlacements(topicId, controller.signal),
      ])
        .then(([topicResult, placementResult]) => {
          applyTopic(topicResult.topic);
          setPlacements(placementResult.placements);
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'تعذر تحميل موضوع التأسيس.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }
    return () => controller.abort();
  }, [topicId]);

  useEffect(() => {
    if (!pathId || !subjectId) {
      setTopicOptions([]);
      setLessonOptions([]);
      setLibraryOptions([]);
      return;
    }
    const controller = new AbortController();
    Promise.all([
      contentClient.foundation({ page: 1, limit: 100, pathId, subjectId }, controller.signal),
      contentClient.lessons({ page: 1, limit: 100, pathId, subjectId }, controller.signal),
      contentClient.library({ page: 1, limit: 100, pathId, subjectId }, controller.signal),
    ])
      .then(([topics, lessons, library]) => {
        setTopicOptions(topics.items.filter((item) => item.id !== topicId));
        setLessonOptions(lessons.items);
        setLibraryOptions(library.items);
        setSelectionHasMore(topics.hasMore || lessons.hasMore || library.hasMore);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'تعذر تحميل خيارات الربط.');
      });
    return () => controller.abort();
  }, [pathId, subjectId, topicId]);

  const subjects = useMemo(() => taxonomy.subjects.filter((subject) => !pathId || subject.pathId === pathId), [pathId, taxonomy.subjects]);
  const skills = useMemo(() => taxonomy.skills.filter((skill) => skill.subjectId === subjectId), [subjectId, taxonomy.skills]);

  useEffect(() => {
    if (subjectId && !subjects.some((subject) => subject.id === subjectId)) {
      setSubjectId('');
      setParentTopicId('');
      setSkillIds([]);
    }
  }, [subjectId, subjects]);
  useEffect(() => {
    setSkillIds((current) => current.filter((id) => skills.some((skill) => skill.id === id)));
  }, [skills]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!pathId || !subjectId || !code.trim() || !title.trim() || skillIds.length === 0) {
      setError('أكمل المسار والمادة والكود والعنوان ومهارة واحدة على الأقل.');
      return;
    }
    const base: CreateFoundationTopicInput = {
      pathId,
      subjectId,
      parentTopicId,
      code: code.trim().toUpperCase(),
      title: title.trim(),
      description: description.trim(),
      sortOrder: Math.max(0, Math.trunc(sortOrder || 0)),
      status,
      isVisible,
      isLocked,
      skillIds,
    };
    setSaving(true);
    try {
      const csrf = await getCsrfToken();
      if (topic && topicId) {
        const update: UpdateFoundationTopicInput = { ...base, expectedRevision: topic.revision };
        await contentClient.updateFoundationTopic(topicId, update, csrf);
      } else {
        await contentClient.createFoundationTopic(base, csrf);
      }
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ موضوع التأسيس.');
    } finally {
      setSaving(false);
    }
  }

  async function refreshPlacements() {
    if (!topicId) return;
    const result = await contentClient.foundationPlacements(topicId);
    setPlacements(result.placements);
  }

  async function linkLesson() {
    if (!topic || !topicId || !selectedLessonId || topic.status !== 'active') return;
    setSaving(true);
    setError('');
    try {
      const csrf = await getCsrfToken();
      const result = await contentClient.linkFoundationLesson(topicId, selectedLessonId, topic.revision, placements.lessons.length + 1, csrf);
      setTopic({ ...topic, revision: result.topicRevision });
      setSelectedLessonId('');
      await refreshPlacements();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر ربط الدرس.');
    } finally {
      setSaving(false);
    }
  }

  async function unlinkLesson(lessonId: string) {
    if (!topic || !topicId || topic.status !== 'active') return;
    setSaving(true);
    try {
      const csrf = await getCsrfToken();
      const result = await contentClient.unlinkFoundationLesson(topicId, lessonId, topic.revision, csrf);
      setTopic({ ...topic, revision: result.topicRevision });
      await refreshPlacements();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إزالة الدرس.');
    } finally {
      setSaving(false);
    }
  }

  async function linkLibrary() {
    if (!topic || !topicId || !selectedLibraryId || topic.status !== 'active') return;
    setSaving(true);
    setError('');
    try {
      const csrf = await getCsrfToken();
      const result = await contentClient.linkFoundationLibraryItem(topicId, selectedLibraryId, topic.revision, placements.libraryItems.length + 1, csrf);
      setTopic({ ...topic, revision: result.topicRevision });
      setSelectedLibraryId('');
      await refreshPlacements();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر ربط عنصر المكتبة.');
    } finally {
      setSaving(false);
    }
  }

  async function unlinkLibrary(itemId: string) {
    if (!topic || !topicId || topic.status !== 'active') return;
    setSaving(true);
    try {
      const csrf = await getCsrfToken();
      const result = await contentClient.unlinkFoundationLibraryItem(topicId, itemId, topic.revision, csrf);
      setTopic({ ...topic, revision: result.topicRevision });
      await refreshPlacements();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إزالة عنصر المكتبة.');
    } finally {
      setSaving(false);
    }
  }

  const lessonName = (id: string) => lessonOptions.find((item) => item.id === id)?.title || id;
  const libraryName = (id: string) => libraryOptions.find((item) => item.id === id)?.title || id;

  if (loading) return <main className="min-h-[calc(100vh-5rem)] bg-gray-50 p-10 text-center font-black text-gray-500">جاري تحميل التأسيس...</main>;

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <form onSubmit={submit} className="space-y-5">
          <section className="flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div><div className="text-xs font-black text-indigo-600">Foundation Manager</div><h1 className="mt-1 text-2xl font-black text-gray-900">{editing ? 'تعديل موضوع التأسيس' : 'إضافة موضوع تأسيس'}</h1><p className="mt-2 text-sm font-medium text-gray-500">التأسيس هيكل مستقل عن الدورات؛ الروابط إلى الدروس والمكتبة تحفظ كعلاقات فقط.</p></div>
            <button type="button" onClick={onCancel} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-black text-gray-700"><ArrowRight size={18} />رجوع</button>
          </section>

          {error ? <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div> : null}

          <section className="grid gap-5 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 md:grid-cols-2">
            <label className="space-y-2"><span className="text-sm font-black text-gray-700">المسار *</span><select value={pathId} onChange={(event) => { setPathId(event.target.value); setSubjectId(''); setParentTopicId(''); setSkillIds([]); }} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold"><option value="">اختر المسار</option>{taxonomy.paths.map((path) => <option key={path.id} value={path.id}>{path.name}</option>)}</select></label>
            <label className="space-y-2"><span className="text-sm font-black text-gray-700">المادة *</span><select disabled={!pathId} value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setParentTopicId(''); setSkillIds([]); }} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold disabled:bg-gray-50"><option value="">اختر المادة</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
            <label className="space-y-2"><span className="text-sm font-black text-gray-700">الكود الثابت *</span><input disabled={editing} value={code} maxLength={80} onChange={(event) => setCode(event.target.value.toUpperCase())} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-black uppercase disabled:bg-gray-50" /></label>
            <label className="space-y-2"><span className="text-sm font-black text-gray-700">الموضوع الأب</span><select value={parentTopicId} onChange={(event) => setParentTopicId(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold"><option value="">بدون أب</option>{topicOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <label className="space-y-2 md:col-span-2"><span className="text-sm font-black text-gray-700">العنوان *</span><input value={title} maxLength={240} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold" /></label>
            <label className="space-y-2"><span className="text-sm font-black text-gray-700">الترتيب</span><input type="number" min={0} value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold" /></label>
            <label className="space-y-2"><span className="text-sm font-black text-gray-700">الحالة</span><select value={status} onChange={(event) => setStatus(event.target.value as FoundationTopicStatus)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold"><option value="active">نشط</option><option value="inactive">غير نشط</option><option value="archived">مؤرشف</option></select></label>
            <label className="space-y-2 md:col-span-2"><span className="text-sm font-black text-gray-700">الوصف</span><textarea rows={5} maxLength={12000} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium leading-7" /></label>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6"><h2 className="font-black text-gray-900">المهارات *</h2><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{skills.map((skill) => { const checked = skillIds.includes(skill.id); return <label key={skill.id} className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'}`}><input type="checkbox" checked={checked} onChange={() => setSkillIds((current) => checked ? current.filter((id) => id !== skill.id) : [...current, skill.id])} className="mt-1" /><span className="font-bold text-gray-800">{skill.name}</span></label>; })}</div></section>

          <section className="grid gap-3 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6">
            <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm font-black text-gray-700"><input type="checkbox" checked={isVisible} onChange={(event) => setIsVisible(event.target.checked)} />ظاهر للمتعلم</label>
            <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm font-black text-gray-700"><input type="checkbox" checked={isLocked} onChange={(event) => setIsLocked(event.target.checked)} />مغلق حسب الوصول</label>
          </section>

          <div className="flex justify-end"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}{saving ? 'جارٍ الحفظ...' : 'حفظ الموضوع'}</button></div>
        </form>

        {editing && topic ? (
          <section className="space-y-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            <div><h2 className="text-lg font-black text-gray-900">روابط التأسيس</h2><p className="mt-1 text-sm font-medium text-gray-500">Revision {topic.revision} · الروابط متاحة فقط والموضوع نشط.</p></div>
            {selectionHasMore ? <div className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">يوجد أكثر من 100 عنصر في أحد المصادر؛ هذه الواجهة تعرض أول 100 فقط حاليًا، وسيُضاف بحث خادمي عند شريحة التحسين النهائية.</div> : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-gray-100 p-4">
                <h3 className="font-black text-gray-800">الدروس</h3>
                {placements.lessons.map((placement) => <div key={placement.lessonId} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3"><div><div className="font-black text-gray-800">{lessonName(placement.lessonId)}</div><div className="text-xs font-bold text-gray-500">ترتيب {placement.sortOrder}</div></div><button type="button" disabled={saving || topic.status !== 'active'} onClick={() => void unlinkLesson(placement.lessonId)} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 disabled:opacity-50"><Trash2 size={15} /></button></div>)}
                <div className="flex gap-2"><select disabled={topic.status !== 'active'} value={selectedLessonId} onChange={(event) => setSelectedLessonId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold"><option value="">اختر درسًا...</option>{lessonOptions.filter((lesson) => !placements.lessons.some((placement) => placement.lessonId === lesson.id)).map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select><button type="button" disabled={saving || topic.status !== 'active' || !selectedLessonId} onClick={() => void linkLesson()} className="rounded-xl bg-blue-600 px-3 py-2 text-white disabled:opacity-50"><Link2 size={17} /></button></div>
              </div>

              <div className="space-y-3 rounded-2xl border border-gray-100 p-4">
                <h3 className="font-black text-gray-800">المكتبة</h3>
                {placements.libraryItems.map((placement) => <div key={placement.libraryItemId} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3"><div><div className="font-black text-gray-800">{libraryName(placement.libraryItemId)}</div><div className="text-xs font-bold text-gray-500">ترتيب {placement.sortOrder}</div></div><button type="button" disabled={saving || topic.status !== 'active'} onClick={() => void unlinkLibrary(placement.libraryItemId)} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 disabled:opacity-50"><Trash2 size={15} /></button></div>)}
                <div className="flex gap-2"><select disabled={topic.status !== 'active'} value={selectedLibraryId} onChange={(event) => setSelectedLibraryId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold"><option value="">اختر عنصرًا...</option>{libraryOptions.filter((item) => !placements.libraryItems.some((placement) => placement.libraryItemId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button type="button" disabled={saving || topic.status !== 'active' || !selectedLibraryId} onClick={() => void linkLibrary()} className="rounded-xl bg-blue-600 px-3 py-2 text-white disabled:opacity-50"><Link2 size={17} /></button></div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
