import { useEffect, useState } from 'react';
import { assessmentPlacementClient } from '../../assessment/api/assessment-placement-client';
import type { AssessmentPlacement, AssessmentPlacementAccessType, AssessmentSummary } from '../../assessment/api/assessment-types';

type Props = { courseId: string; pathId: string; subjectId: string; courseReady: boolean; assessments: AssessmentSummary[]; lessons: { id:string; title:string }[]; getCsrfToken(): Promise<string> };
const equalId = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// Placement writes belong to Assessment; course presentation is not an access grant.
export function CourseAssessmentPlacementEditor({ courseId, pathId, subjectId, courseReady, assessments, lessons, getCsrfToken }: Props) {
  const [assessmentId, setAssessmentId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [rows, setRows] = useState<AssessmentPlacement[]>([]);
  const [access, setAccess] = useState<AssessmentPlacementAccessType>('inherit');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setRows([]); setLoaded(false); setError('');
    if (!assessmentId) { setBusy(false); return; }
    const controller = new AbortController();
    setBusy(true);
    (async () => {
      const all: AssessmentPlacement[] = [];
      for (let page = 1; page <= 100; page++) {
        const result = await assessmentPlacementClient.staffList(assessmentId, page, 100, controller.signal);
        if (!Array.isArray(result.items)) throw new Error('تعذر قراءة مواضع الاختبار.');
        all.push(...result.items);
        if (!result.hasMore) return all;
      }
      throw new Error('عدد مواضع الاختبار كبير؛ أدر المواضع من مركز الاختبارات.');
    })().then(items => {
      if (controller.signal.aborted) return;
      setRows(items.filter(row => row.slot === 'course' && equalId(row.courseId, courseId) && equalId(row.pathId, pathId) && equalId(row.subjectId, subjectId) && (lessonId ? equalId(row.lessonId, lessonId) : !row.lessonId)));
      setLoaded(true);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'تعذر تحميل مواضع الاختبار.'); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [assessmentId, courseId, pathId, subjectId, lessonId, revision]);
  async function create() {
    if (!courseReady || !assessmentId || !loaded || rows.length || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await assessmentPlacementClient.create(assessmentId, { slot: 'course', pathId, subjectId, courseId, lessonId, topicId: '', accessType: access, isVisible: true, sortOrder: 0 }, await getCsrfToken());
      setNotice('تم تفعيل موضع الاختبار بنجاح.'); setRevision(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر ربط الاختبار بالدورة.'); }
    finally { setSaving(false); }
  }
  async function update(row: AssessmentPlacement, nextAccess: AssessmentPlacementAccessType, visible: boolean) {
    if (saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await assessmentPlacementClient.patch(row, nextAccess, visible, row.sortOrder, await getCsrfToken());
      setRows(previous => previous.map(item => item.id === row.id ? result.placement : item));
      setNotice('تم تحديث موضع الاختبار.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تحديث موضع الاختبار.'); setRevision(value => value + 1); }
    finally { setSaving(false); }
  }
  return <section className="space-y-4 rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm">
    <div><h2 className="text-lg font-black">تفعيل اختبارات الدورة</h2><p className="mt-1 text-sm text-gray-600">اختر اختبارًا منشورًا للتحكم في ظهوره وصلاحية الدخول إليه في هذه الدورة.</p></div>
    {!courseReady && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">اعتمد الدورة وانشرها وأظهرها أولًا، ثم فعّل اختبارات الدورة هنا.</p>}
    <label className="block text-sm font-bold">الاختبار
      <select aria-label="اختبار الدورة" disabled={saving} value={assessmentId} onChange={event => { setRows([]); setLoaded(false); setAssessmentId(event.target.value); setNotice(''); }} className="mt-1 w-full rounded-xl border p-3">
        <option value="">اختر اختبارًا منشورًا</option>{assessments.filter(item => item.isPublished).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
    </label>
    <label className="block text-sm font-bold">مكان ظهور الاختبار
      <select aria-label="مكان الاختبار في الدورة" disabled={saving} value={lessonId} onChange={event => { setRows([]); setLoaded(false); setLessonId(event.target.value); setNotice(''); }} className="mt-1 w-full rounded-xl border p-3">
        <option value="">الدورة كاملة</option>{lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
      </select>
    </label>
    {lessonId && <p className="text-xs text-gray-600">يجب أن يكون الدرس معتمدًا وظاهرًا ومضافًا لقسم نشط في الدورة.</p>}
    {busy && <p role="status">جاري تحميل مواضع الاختبار...</p>}
    {error && <p role="alert" className="text-sm font-bold text-red-700">{error} <button type="button" className="underline" onClick={() => setRevision(value => value + 1)}>إعادة المحاولة</button></p>}
    {notice && <p role="status" className="text-sm font-bold text-emerald-700">{notice}</p>}
    {assessmentId && loaded && rows.length === 0 && <div className="flex flex-wrap items-end gap-3"><label className="text-sm font-bold">صلاحية الاختبار <select aria-label="صلاحية الاختبار الجديد" value={access} onChange={event => setAccess(event.target.value as AssessmentPlacementAccessType)} className="block rounded-xl border p-2"><option value="inherit">حسب إعداد الاختبار</option><option value="free">مجاني</option><option value="paid">مدفوع</option><option value="package">ضمن باقة</option></select></label><button type="button" disabled={!courseReady || saving} onClick={() => void create()} className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white disabled:opacity-50">تفعيل الاختبار في الدورة</button></div>}
    {rows.map(row => <div key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3"><span className="font-bold">{row.isVisible ? 'ظاهر للطلاب' : 'مخفي عن الطلاب'}</span><label className="text-sm">الصلاحية <select aria-label="صلاحية الاختبار المرتبط" disabled={saving} value={row.accessType} onChange={event => void update(row, event.target.value as AssessmentPlacementAccessType, row.isVisible)} className="rounded-xl border p-2"><option value="inherit">حسب إعداد الاختبار</option><option value="free">مجاني</option><option value="paid">مدفوع</option><option value="package">ضمن باقة</option></select></label><button type="button" disabled={saving} onClick={() => void update(row, row.accessType, !row.isVisible)} className="rounded-xl border px-4 py-2 font-bold">{row.isVisible ? 'إخفاء الاختبار' : 'إظهار الاختبار'}</button></div>)}
  </section>;
}
