import { ClipboardList, Loader2, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { attemptClient, type ResultListItem } from '../api/attempt-client';
import {
  assessmentAssignmentClient,
  type LearnerAssessmentAssignment,
} from '../api/assessment-assignment-client';
import { relativeArabicDate } from '../relativeDate';

// A retry of a failed request must reuse its idempotency key. Once the server
// confirms an attempt, the next explicit start must receive a new key.
// The student scope prevents another account in this browser session from
// accidentally reusing the previous student's pending start key.
const startStorageKey = (studentId: string, assignmentId: string) =>
  `assessment-assignment-start:${encodeURIComponent(studentId)}:${encodeURIComponent(assignmentId)}`;

function pendingStartKey(studentId: string, assignmentId: string): string {
  const storageKey = startStorageKey(studentId, assignmentId);
  let value = sessionStorage.getItem(storageKey);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(storageKey, value);
  }
  return value;
}

export function AssessmentAssignmentsPage({ embedded }: { embedded?: boolean } = {}) {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<LearnerAssessmentAssignment[]>([]);
  const [busy, setBusy] = useState(true);
  const [starting, setStarting] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [pagination, setPagination] = useState({ studentId: '', page: 1 });
  const [retry, setRetry] = useState(0);
  const [loadedScope, setLoadedScope] = useState('');
  const [resultsByAssessment, setResultsByAssessment] = useState<Record<string, ResultListItem>>({});
  const [resultsState, setResultsState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const startingRef = useRef(false);
  const studentId = user?.roles.includes('student') ? user.id : '';
  const page = pagination.studentId === studentId ? pagination.page : 1;
  const requestScope = JSON.stringify([studentId, page, retry]);

  useEffect(() => {
    if (authLoading || !embedded) return;
    setRows([]);
    setError('');
    setLoadError('');
    setHasMore(false);
    if (!studentId) {
      setBusy(false);
      return;
    }

    const controller = new AbortController();
    setBusy(true);
    assessmentAssignmentClient.mine(page, 30, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) { setRows(result.items); setHasMore(result.hasMore); }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setLoadError(reason instanceof Error ? reason.message : 'تعذر تحميل التكليفات');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) { setLoadedScope(requestScope); setBusy(false); }
      });
    return () => controller.abort();
  }, [authLoading, embedded, studentId, page, retry, requestScope]);

  // Delivered assignments are not included in the assignment payload. The
  // learner-owned results endpoint is the real source for submitted scores and
  // review links; a failure only hides that enrichment, never invents it.
  useEffect(() => {
    if (authLoading || !studentId) {
      setResultsByAssessment({});
      setResultsState('idle');
      return;
    }
    let active = true;
    setResultsState('loading');
    attemptClient.results(1, 100)
      .then((result) => {
        if (!active) return;
        const latest: Record<string, ResultListItem> = {};
        for (const item of result.items) {
          if (!latest[item.assessmentId]) latest[item.assessmentId] = item;
        }
        setResultsByAssessment(latest);
        setResultsState('ready');
      })
      .catch(() => {
        if (!active) return;
        setResultsByAssessment({});
        setResultsState('failed');
      });
    return () => {
      active = false;
    };
  }, [authLoading, studentId]);

  const pendingRows = useMemo(
    () => rows.filter((row) => row.attemptCount < 1 || !resultsByAssessment[row.assessmentId]),
    [resultsByAssessment, rows],
  );
  const completedRows = useMemo(
    () =>
      rows
        .filter((row) => row.attemptCount > 0)
        .flatMap((row) => {
          const result = resultsByAssessment[row.assessmentId];
          return result ? [{ row, result }] : [];
        })
        .sort((a, b) => Date.parse(b.result.finalizedAt) - Date.parse(a.result.finalizedAt)),
    [resultsByAssessment, rows],
  );

  async function start(row: LearnerAssessmentAssignment) {
    if (startingRef.current || !user?.id || !row.canStart) return;
    startingRef.current = true;
    setStarting(row.assignmentId);
    setError('');

    try {
      const csrf = await getCsrfToken();
      const storageKey = startStorageKey(user.id, row.assignmentId);
      const attempt = await assessmentAssignmentClient.start(
        row.assignmentId,
        pendingStartKey(user.id, row.assignmentId),
        csrf,
      );
      // Only a confirmed response consumes the key. A network/HTTP failure
      // retains it so retry cannot accidentally create a duplicate attempt.
      sessionStorage.removeItem(storageKey);
      navigate(`/assessment-attempts/${attempt.attempt.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر بدء التكليف');
    } finally {
      startingRef.current = false;
      setStarting('');
    }
  }

  if (authLoading || (embedded && studentId && (busy || loadedScope !== requestScope))) {
    return <div className="p-10 text-center font-black">جاري تحميل التكليفات...</div>;
  }
  if (!embedded && (!user || user?.roles.includes('student'))) {
    return <Navigate to="/dashboard?tab=assignments" replace />;
  }
  if (!user?.roles.includes('student')) {
    return <div className="p-10 text-center font-black text-rose-700">هذه الشاشة مخصصة للطالب.</div>;
  }

  const ContainerTag = embedded ? 'div' : 'main';

  return (
    <ContainerTag dir="rtl" className={embedded ? 'mx-auto w-full max-w-5xl space-y-4' : 'min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-6 sm:px-6'}>
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="rounded-3xl bg-slate-950 p-5 text-white">
          <div className="flex items-center gap-2 text-indigo-300">
            <ClipboardList size={20} />
            <h1 className="text-2xl font-black">الاختبارات الموجهة لك</h1>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            اختبارات أرسلتها مدرستك — قد تكون عادية أو محاكية. تظهر فقط التكليفات الفعالة الموجهة لك أو لفصلك.
          </p>
        </header>

        {error ? (
          <div role="alert" className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}</div>
        ) : null}

        {loadError ? (
          <div role="alert" className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">
            <p>{loadError}</p>
            <button type="button" aria-label="إعادة محاولة تحميل التكليفات" onClick={() => setRetry((value) => value + 1)} className="mt-2 rounded-lg border border-rose-300 px-3 py-2">إعادة المحاولة</button>
          </div>
        ) : null}

        {!loadError && rows.length === 0 ? (
          <section className="rounded-2xl border border-dashed bg-white p-10 text-center font-bold text-gray-500">
            لا توجد تكليفات اختبار فعالة الآن.
          </section>
        ) : rows.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <section className="space-y-3" aria-labelledby="pending-assignments-heading">
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 id="pending-assignments-heading" className="text-base font-black text-gray-900 sm:text-lg">
                  جديد من مدرستك
                </h2>
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700">
                  {pendingRows.length}
                </span>
              </div>
              {pendingRows.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-center text-xs font-bold text-gray-500">
                  لا توجد تكليفات جديدة الآن.
                </p>
              ) : (
                <div className="space-y-2">
                  {pendingRows.map((row) => (
                    <article key={row.assignmentId} className="flex flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-black leading-snug text-gray-900 sm:text-base">{row.title}</h3>
                        {resultsState === 'ready' ? (
                          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                            row.attemptCount > 0
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {row.attemptCount > 0 ? 'قيد الحل' : 'جديد'}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-gray-500">
                        <span className="rounded-lg bg-gray-50 px-2 py-1">
                          المحاولات {row.attemptCount} من {row.maxAttempts}
                        </span>
                        {row.closesAt && Number.isFinite(Date.parse(row.closesAt)) ? (
                          <span
                            className="rounded-lg bg-rose-50 px-2 py-1 text-rose-700"
                            title={new Date(row.closesAt).toLocaleString('ar-SA')}
                          >
                            آخر موعد: {relativeArabicDate(row.closesAt)}
                          </span>
                        ) : null}
                      </div>
                      {row.supervisorMessage ? (
                        <p className="mt-3 rounded-xl bg-gray-50 p-3 text-xs font-bold leading-6 text-gray-600">
                          {row.supervisorMessage}
                        </p>
                      ) : null}
                      <div className="mt-auto pt-4">
                        <button
                          type="button"
                          disabled={!row.canStart || Boolean(starting)}
                          onClick={() => void start(row)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-indigo-700 disabled:opacity-40"
                        >
                          {starting === row.assignmentId ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                          {row.canStart ? 'ابدأ التكليف' : 'استُنفدت المحاولات'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3" aria-labelledby="completed-assignments-heading">
              <div className="flex items-center justify-between gap-3 px-1">
                <h2 id="completed-assignments-heading" className="text-base font-black text-gray-900 sm:text-lg">
                  تم تسليمه
                </h2>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                  {completedRows.length}
                </span>
              </div>
              {resultsState === 'loading' || resultsState === 'idle' ? (
                <p className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-xs font-bold text-gray-500">
                  <Loader2 size={15} className="animate-spin text-indigo-600" />
                  جارٍ تحميل نتائجك المسلَّمة...
                </p>
              ) : resultsState === 'failed' ? (
                <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-center text-xs font-bold text-gray-500">
                  تعذر تحميل النتائج المسلَّمة الآن.
                </p>
              ) : completedRows.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-center text-xs font-bold text-gray-500">
                  لم يتم تسليم أي تكليف من مدرستك بعد.
                </p>
              ) : (
                <div className="space-y-2">
                  {completedRows.map(({ row, result }) => (
                    <article
                      key={row.assignmentId}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs"
                    >
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-black text-gray-900">{row.title}</h3>
                        <p className="mt-1 text-[11px] font-bold text-gray-500">
                          {relativeArabicDate(result.finalizedAt)}
                          {row.attemptCount > 0 ? ` · ${row.attemptCount} محاولة` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-center">
                          <div className="text-2xl font-black text-emerald-600">
                            {result.showResultsReport ? `${result.score.toFixed(1)}%` : '✓'}
                          </div>
                          <div className="text-[10px] font-bold text-gray-500">
                            {result.showResultsReport ? 'الدرجة' : 'مكتمل'}
                          </div>
                        </div>
                        <Link
                          to={`/assessment-results/${encodeURIComponent(result.attemptId)}`}
                          className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100"
                        >
                          راجع
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
        {(page > 1 || hasMore || loadError) ? (
          <nav aria-label="صفحات التكليفات" className="flex items-center justify-center gap-3 text-sm font-bold">
            <button type="button" aria-label="الصفحة السابقة للتكليفات" disabled={page <= 1} onClick={() => setPagination({ studentId, page: page - 1 })} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40">السابق</button>
            <span>الصفحة {page}</span>
            <button type="button" aria-label="الصفحة التالية للتكليفات" disabled={!hasMore || Boolean(loadError)} onClick={() => setPagination({ studentId, page: page + 1 })} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40">التالي</button>
          </nav>
        ) : null}
      </div>
    </ContainerTag>
  );
}
