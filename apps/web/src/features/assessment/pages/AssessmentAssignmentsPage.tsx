import { ClipboardList, Loader2, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import {
  assessmentAssignmentClient,
  type LearnerAssessmentAssignment,
} from '../api/assessment-assignment-client';

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

export function AssessmentAssignmentsPage() {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<LearnerAssessmentAssignment[]>([]);
  const [busy, setBusy] = useState(true);
  const [starting, setStarting] = useState('');
  const [error, setError] = useState('');
  const startingRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    setRows([]);
    setError('');
    if (!user?.roles.includes('student')) {
      setBusy(false);
      return;
    }

    const controller = new AbortController();
    setBusy(true);
    assessmentAssignmentClient.mine(1, 30, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setRows(result.items);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'تعذر تحميل التكليفات');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [authLoading, user]);

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

  if (authLoading || busy) {
    return <main className="p-10 text-center font-black">جاري تحميل التكليفات...</main>;
  }
  if (!user?.roles.includes('student')) {
    return <main className="p-10 text-center font-black text-rose-700">هذه الشاشة مخصصة للطالب.</main>;
  }

  return (
    <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-6 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-3xl bg-slate-950 p-5 text-white">
          <div className="flex items-center gap-2 text-amber-400">
            <ClipboardList size={20} />
            <h1 className="text-2xl font-black">الاختبارات الموجهة إليك</h1>
          </div>
          <p className="mt-1 text-sm text-slate-300">
            تظهر فقط التكليفات التي يثبت الخادم أنها موجهة لك أو لفصلك وفي نافذة زمنية فعالة.
          </p>
        </header>

        {error ? (
          <div role="alert" className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}</div>
        ) : null}

        {!error && rows.length === 0 ? (
          <section className="rounded-2xl border border-dashed bg-white p-10 text-center font-bold text-gray-500">
            لا توجد تكليفات اختبار فعالة الآن.
          </section>
        ) : rows.length > 0 ? (
          <section className="grid gap-3 sm:grid-cols-2">
            {rows.map((row) => (
              <article key={row.assignmentId} className="rounded-2xl border bg-white p-5 shadow-sm">
                <div>
                  <h2 className="font-black text-gray-900">{row.title}</h2>
                  <p className="mt-1 text-xs font-bold text-gray-500">
                    المحاولات {row.attemptCount} من {row.maxAttempts}
                  </p>
                </div>
                {row.supervisorMessage ? (
                  <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm font-bold leading-6 text-gray-600">
                    {row.supervisorMessage}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={!row.canStart || Boolean(starting)}
                  onClick={() => void start(row)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-black text-white disabled:opacity-40"
                >
                  {starting === row.assignmentId ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                  {row.canStart ? 'ابدأ التكليف' : 'استُنفدت المحاولات'}
                </button>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
