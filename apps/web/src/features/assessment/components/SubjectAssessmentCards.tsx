import { useEffect, useState } from 'react';
import { Eye, Lock, Unlock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { assessmentClient } from '../api/assessment-client';
import { assessmentPlacementClient } from '../api/assessment-placement-client';
import type { AssessmentPage, SubjectPlacementAccess } from '../api/assessment-types';

interface Props {
  pathId: string;
  subjectId: string;
  slot: 'training' | 'tests';
  getCsrfToken: () => Promise<string>;
}

function AssessmentCardAccess({ initial, title, getCsrfToken }: {
  initial: SubjectPlacementAccess;
  title: string;
  getCsrfToken: Props['getCsrfToken'];
}) {
  const [placement, setPlacement] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isFree = placement.accessType === 'free'
    || (placement.accessType === 'inherit' && placement.baseAccessType === 'free');
  const action = isFree ? 'جعله ضمن باقة' : 'جعله مجانيًا';

  async function toggleAccess() {
    setBusy(true);
    setError('');
    try {
      const { placement: updated } = await assessmentPlacementClient.patch(
        placement, isFree ? 'package' : 'free',
        placement.isVisible, placement.sortOrder, await getCsrfToken(),
      );
      setPlacement({ ...updated, baseAccessType: placement.baseAccessType });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تغيير الإتاحة.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        <span role="status" className={`rounded-full px-2 py-1 ${isFree ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {isFree ? 'مجاني' : placement.accessType === 'package' ? 'ضمن باقة' : 'مدفوع'}
        </span>
        <span className="text-slate-500">{placement.isVisible ? 'ظاهر' : 'مخفي'}</span>
        <button
          type="button"
          aria-label={`${action} (${title})`}
          title={action}
          disabled={busy}
          onClick={() => void toggleAccess()}
          className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-1.5 font-black text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
        >
          {isFree ? <Unlock size={14} /> : <Lock size={14} />}
          {busy ? 'جارٍ الحفظ…' : action}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function SubjectAssessmentCards(props: Props) {
  const { pathId, subjectId, slot } = props;
  const training = slot === 'training';
  const normalMode = training ? 'practice' : 'exam';
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AssessmentPage>();
  const [error, setError] = useState('');
  const center = `/admin-dashboard/assessments?pathId=${pathId}&subjectId=${subjectId}`;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void assessmentClient.list({ pathId, subjectId, page, normalMode }, signal).then(data => {
      if (!signal.aborted) setResult(data);
    }).catch(cause => {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : 'تعذر تحميل القائمة.');
    });
    return () => controller.abort();
  }, [page, pathId, subjectId, normalMode]);

  function turnPage(next: number) {
    setResult(undefined);
    setError('');
    setPage(next);
  }

  const cards = result?.items.filter(item => item.pathId === pathId && item.subjectId === subjectId
    && item.kind === 'normal' && item.normalMode === normalMode);

  return (
    <section className="space-y-3">
      {training && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-black text-slate-900">تدريبات المادة</h3>
          <Link to={center} className="text-xs font-black text-indigo-700">مركز الاختبارات والتقييم</Link>
        </div>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!result && !error && <p role="status" className="text-sm text-slate-600">جارٍ التحميل…</p>}
      {cards?.length === 0 && (
        <div className="rounded-3xl border border-dashed bg-white p-8 text-center text-slate-600">
          <p className="text-sm">{training ? 'لا توجد تدريبات في هذه الصفحة.' : 'لا توجد اختبارات في هذه الصفحة.'}</p>
          {!training && page === 1 && !result?.hasMore && (
            <Link to={center} className="mt-3 inline-flex rounded-xl bg-indigo-50 px-4 py-2 text-xs font-black text-indigo-700">
              إنشاء أول اختبار للمادة ←
            </Link>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {cards?.map(assessment => (
          <article key={assessment.id} className="flex flex-col justify-between rounded-3xl border border-gray-100 bg-white p-5 shadow-xs">
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${assessment.isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {assessment.isPublished ? 'منشور' : 'مسودة'}
                </span>
                <span className="font-mono text-xs text-slate-500">{assessment.code}</span>
              </div>
              <h4 className="text-sm font-black leading-snug text-slate-900">{assessment.title}</h4>
            </div>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-2 border-t border-gray-100 pt-3">
              <Link to={`/assessments/${assessment.id}/start`} target="_blank" className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-200">
                <Eye size={13} /> معاينة
              </Link>
              {assessment.subjectPlacement ? (
                <AssessmentCardAccess
                  key={assessment.subjectPlacement.updatedAt}
                  initial={assessment.subjectPlacement}
                  title={assessment.title}
                  getCsrfToken={props.getCsrfToken}
                />
              ) : assessment.ownerType === 'platform' && assessment.isPublished ? (
                <Link to={center} className="text-xs font-bold text-indigo-700">ضبط الإتاحة من مركز الاختبارات</Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {(page > 1 || result?.hasMore) && (
        <div className="flex flex-wrap gap-2 text-sm">
          <button type="button" disabled={page === 1} onClick={() => turnPage(page - 1)} className="rounded-lg border px-3 py-1 disabled:opacity-50">السابق</button>
          <button type="button" disabled={!result?.hasMore} onClick={() => turnPage(page + 1)} className="rounded-lg border px-3 py-1 disabled:opacity-50">التالي</button>
        </div>
      )}
    </section>
  );
}
