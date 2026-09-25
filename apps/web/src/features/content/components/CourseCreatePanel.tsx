import { ArrowRight, CheckCircle2, Loader2, Save } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { contentClient } from '../api/content-client';
import type { CreateCourseInput, TaxonomyCore, TaxonomyFull } from '../api/content-types';

interface CourseCreatePanelProps {
  coreTaxonomy: TaxonomyCore;
  initialPathId: string;
  initialSubjectId: string;
  lockScope: boolean;
  getCsrfToken(): Promise<string>;
  onCancel(): void;
  onCreated(): void;
}

const levels = [
  { value: 'beginner' as const, label: 'مبتدئ' },
  { value: 'intermediate' as const, label: 'متوسط' },
  { value: 'advanced' as const, label: 'متقدم' },
];

export function CourseCreatePanel({
  coreTaxonomy,
  initialPathId,
  initialSubjectId,
  lockScope,
  getCsrfToken,
  onCancel,
  onCreated,
}: CourseCreatePanelProps) {
  const [taxonomy, setTaxonomy] = useState<TaxonomyFull>({ ...coreTaxonomy, skills: [] });
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);
  const [taxonomyError, setTaxonomyError] = useState('');
  const [pathId, setPathId] = useState(initialPathId);
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructorName, setInstructorName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [level, setLevel] = useState<CreateCourseInput['level']>('beginner');
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [dripContentEnabled, setDripContentEnabled] = useState(false);
  const [certificateEnabled, setCertificateEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    contentClient
      .taxonomyFull(controller.signal)
      .then((result) => {
        setTaxonomy(result);
        setTaxonomyError('');
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setTaxonomyError(cause instanceof Error ? cause.message : 'تعذر تحميل المهارات.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setTaxonomyLoading(false);
      });
    return () => controller.abort();
  }, []);

  const subjects = useMemo(
    () => taxonomy.subjects.filter((subject) => !pathId || subject.pathId === pathId),
    [pathId, taxonomy.subjects],
  );
  const skills = useMemo(
    () => taxonomy.skills.filter((skill) => skill.subjectId === subjectId),
    [subjectId, taxonomy.skills],
  );

  useEffect(() => {
    if (subjectId && !subjects.some((subject) => subject.id === subjectId)) {
      setSubjectId('');
      setSkillIds([]);
    }
  }, [subjectId, subjects]);

  useEffect(() => {
    setSkillIds((current) => current.filter((id) => skills.some((skill) => skill.id === id)));
  }, [skills]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const normalizedTitle = title.trim();
    if (!pathId || !subjectId || !normalizedTitle) {
      setError('اختر المسار والمادة واكتب اسم الدورة.');
      return;
    }
    if (skillIds.length === 0) {
      setError('اختر مهارة واحدة على الأقل قبل حفظ الدورة.');
      return;
    }

    setSaving(true);
    try {
      const csrfToken = await getCsrfToken();
      await contentClient.createCourse(
        {
          pathId,
          subjectId,
          title: normalizedTitle,
          description: description.trim(),
          instructorName: instructorName.trim() || 'فريق المنصة',
          durationMinutes: Math.max(0, Math.trunc(durationMinutes || 0)),
          level,
          isVisible,
          dripContentEnabled,
          certificateEnabled,
          skillIds,
        },
        csrfToken,
      );
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ الدورة.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-6 sm:px-6 lg:px-8">
      <form onSubmit={submit} className="mx-auto max-w-5xl space-y-5">
        <section className="flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-black text-indigo-600">Course Builder</div>
            <h1 className="mt-1 text-2xl font-black text-gray-900">إنشاء دورة جديدة</h1>
            <p className="mt-2 text-sm font-medium leading-7 text-gray-500">
              تُحفظ الدورة كمسودة. الظهور للطالب منفصل عن الاعتماد والنشر، كما في دورة العمل المرجعية.
            </p>
          </div>
          <button type="button" onClick={onCancel} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-black text-gray-700">
            <ArrowRight size={18} />
            رجوع
          </button>
        </section>

        {taxonomyError ? <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{taxonomyError}</div> : null}
        {error ? <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div> : null}
        {lockScope ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
            نطاق المعلم مثبت على المسار والمادة المختارين لتجنب طلبات خارج التكليف المصرح.
          </div>
        ) : null}

        <section className="grid gap-5 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-black text-gray-700">اسم الدورة *</span>
            <input value={title} maxLength={240} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" placeholder="مثال: أساسيات الكمي" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-black text-gray-700">المسار *</span>
            <select value={pathId} disabled={lockScope} onChange={(event) => { setPathId(event.target.value); setSubjectId(''); setSkillIds([]); }} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold disabled:opacity-60">
              <option value="">اختر المسار</option>
              {taxonomy.paths.map((path) => <option key={path.id} value={path.id}>{path.name}</option>)}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-black text-gray-700">المادة *</span>
            <select value={subjectId} disabled={!pathId || lockScope} onChange={(event) => { setSubjectId(event.target.value); setSkillIds([]); }} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold disabled:opacity-60">
              <option value="">اختر المادة</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-black text-gray-700">اسم المدرب</span>
            <input value={instructorName} maxLength={160} onChange={(event) => setInstructorName(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold" placeholder="فريق المنصة" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-black text-gray-700">المستوى</span>
            <select value={level} onChange={(event) => setLevel(event.target.value as CreateCourseInput['level'])} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold">
              {levels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-black text-gray-700">المدة بالدقائق</span>
            <input type="number" min={0} value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold" />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-black text-gray-700">الوصف</span>
            <textarea value={description} maxLength={12000} rows={5} onChange={(event) => setDescription(event.target.value)} className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium leading-7" placeholder="وصف مختصر للدورة..." />
          </label>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-gray-900">المهارات *</h2>
              <p className="mt-1 text-xs font-bold text-gray-500">يتم تحميل المهارات فقط عند فتح نموذج الإنشاء لتقليل حجم شاشة القائمة.</p>
            </div>
            {taxonomyLoading ? <Loader2 className="animate-spin text-indigo-600" size={20} /> : null}
          </div>
          {!subjectId ? (
            <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-500">اختر المادة أولًا.</div>
          ) : skills.length === 0 ? (
            <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-800">لا توجد مهارات نشطة لهذه المادة في Taxonomy.</div>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {skills.map((skill) => {
                const checked = skillIds.includes(skill.id);
                return (
                  <label key={skill.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={checked} onChange={() => setSkillIds((current) => checked ? current.filter((id) => id !== skill.id) : [...current, skill.id])} className="mt-1" />
                    <span>
                      <span className="block font-black text-gray-800">{skill.name}</span>
                      <span className="mt-1 block text-xs font-bold text-gray-400">{skill.kind}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid gap-3 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:grid-cols-3 sm:p-6">
          {[
            { label: 'إظهار على المنصة', value: isVisible, setValue: setIsVisible },
            { label: 'فتح المحتوى تدريجيًا', value: dripContentEnabled, setValue: setDripContentEnabled },
            { label: 'تفعيل الشهادة', value: certificateEnabled, setValue: setCertificateEnabled },
          ].map((item) => (
            <label key={item.label} className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm font-black text-gray-700">
              <input type="checkbox" checked={item.value} onChange={(event) => item.setValue(event.target.checked)} />
              {item.label}
            </label>
          ))}
        </section>

        <section className="flex flex-col gap-3 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
            <CheckCircle2 size={17} className="text-emerald-600" />
            الحفظ ينشئ مسودة فقط؛ الاعتماد والنشر خطوات مستقلة.
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-black text-gray-700">إلغاء</button>
            <button type="submit" disabled={saving || taxonomyLoading || Boolean(taxonomyError)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {saving ? 'جارٍ الحفظ...' : 'حفظ كمسودة'}
            </button>
          </div>
        </section>
      </form>
    </main>
  );
}
