import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/state/AuthProvider';
import { attemptClient } from '../api/attempt-client';

type PreparedQuiz = Awaited<ReturnType<typeof attemptClient.availablePrepared>>['quizzes'][number];

export function PreparedQuizList() {
  const { user, loading, getCsrfToken } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<PreparedQuiz[]>([]);
  const [selected, setSelected] = useState('');
  const [pending, setPending] = useState(true);
  const [loadedFor, setLoadedFor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const startKey = useRef<{ id: string; key: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { setQuizzes([]); setSelected(''); setLoadedFor(''); setPending(false); return; }
    const controller = new AbortController();
    setPending(true); setQuizzes([]); setSelected(''); setError('');
    attemptClient.availablePrepared(controller.signal)
      .then(data => { const cards = data.quizzes || []; setQuizzes(cards); setSelected(cards[0]?.id || ''); })
      .catch(() => { if (!controller.signal.aborted) setError('تعذر تحميل الاختبارات الجاهزة. حاول تحديث الصفحة.'); })
      .finally(() => { if (!controller.signal.aborted) { setLoadedFor(user.id); setPending(false); } });
    return () => controller.abort();
  }, [loading, user?.id]);

  async function start() {
    if (!selected || busy) return;
    if (startKey.current?.id !== selected) startKey.current = { id: selected, key: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      const result = await attemptClient.start(selected, startKey.current.key, await getCsrfToken());
      navigate(`/assessment-attempts/${encodeURIComponent(result.attempt.id)}`);
    } catch {
      setError('تعذر بدء الاختبار. تحقق من إتاحته وحاول مرة أخرى.');
    } finally { setBusy(false); }
  }

  if (loading || (user && (pending || loadedFor !== user.id))) return <p className="text-sm text-gray-500">جارٍ تحميل الاختبارات الجاهزة...</p>;
  if (!user) return <Link to="/login" className="block rounded-xl bg-indigo-600 px-4 py-4 text-center font-bold text-white">سجل الدخول لعرض الاختبارات المتاحة لك</Link>;
  return <div className="space-y-4">
    <p className="text-sm font-bold text-gray-600">اختبار جاهز من الإدارة</p>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {quizzes.length ? <div className="max-h-80 space-y-3 overflow-y-auto pr-1">{quizzes.map(quiz => <button
      key={quiz.id} type="button" disabled={busy} aria-pressed={selected === quiz.id} onClick={() => setSelected(quiz.id)}
      className={`w-full rounded-xl border p-4 text-right ${selected === quiz.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-200'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="font-bold text-gray-800">{quiz.title}</h3><p className="mt-1 text-xs text-gray-500">{quiz.subjectName || 'بدون مادة'} • {quiz.questionCount} سؤال</p>{quiz.dueExclusive && !Number.isNaN(Date.parse(quiz.dueExclusive)) && <p className="mt-1 text-xs text-amber-700">متاح حتى: {new Date(Date.parse(quiz.dueExclusive) - 1).toLocaleDateString('ar-SA')}</p>}</div>
        <span className={`rounded-full px-2 py-1 text-xs font-bold ${quiz.mode === 'saher' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>{quiz.mode === 'saher' ? 'ساهر' : 'مركزي'}</span>
      </div>
    </button>)}</div> : !error && <div className="rounded-xl border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">لا توجد اختبارات جاهزة متاحة حاليًا.</div>}
    {quizzes.length > 0 && <button type="button" onClick={() => void start()} disabled={!selected || busy} className="w-full rounded-xl bg-indigo-600 py-4 font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300">{busy ? 'جارٍ بدء الاختبار...' : 'ابدأ الاختبار'}</button>}
  </div>;
}
