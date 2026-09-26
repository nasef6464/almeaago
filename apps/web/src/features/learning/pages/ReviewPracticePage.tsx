import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  CircleX,
  Loader2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import {
  learningClient,
  type ReviewAnswerResult,
  type ReviewPracticeItem,
  type ReviewTab,
} from '../api/learning-client';

const optionLetter = (index: number) =>
  ['أ', 'ب', 'ج', 'د', 'هـ', 'و'][index] || String(index + 1);

function submissionKey(cardId: string, updatedAt: string, selected: number) {
  const storageKey = `review-answer:${cardId}:${updatedAt}:${selected}`;
  let value = sessionStorage.getItem(storageKey);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(storageKey, value);
  }
  return value;
}

export function ReviewPracticePage() {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const [params] = useSearchParams();
  const pathId = params.get('pathId') || '';
  const subjectId = params.get('subjectId') || '';
  const tab = (params.get('tab') as ReviewTab) || 'all';

  const [items, setItems] = useState<ReviewPracticeItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<ReviewAnswerResult | null>(null);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.roles.includes('student') || !pathId) {
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    setError('');
    learningClient
      .reviewPractice(tab, pathId, subjectId, 1, 20, controller.signal)
      .then((page) => {
        setItems(page.items);
        setHasMore(page.hasMore);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'تعذر تحميل جلسة المراجعة');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [authLoading, pathId, subjectId, tab, user]);

  const current = items[index] || null;
  const complete = !busy && items.length > 0 && index >= items.length;
  const progress = useMemo(
    () => (items.length ? Math.min(100, ((Math.min(index, items.length - 1) + 1) / items.length) * 100) : 0),
    [index, items.length],
  );

  async function submit() {
    if (!current || selected === null || result) return;
    setSubmitting(true);
    setError('');
    try {
      const csrf = await getCsrfToken();
      const response = await learningClient.answerReview(
        current.card.cardId,
        {
          submissionKey: submissionKey(current.card.cardId, current.card.updatedAt, selected),
          expectedUpdatedAt: current.card.updatedAt,
          selectedOptionIndex: selected,
        },
        csrf,
      );
      setResult(response.result);
      setAnswered((value) => value + 1);
      if (response.result.correct) setCorrect((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تسجيل إجابة المراجعة');
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    setIndex((value) => value + 1);
    setSelected(null);
    setResult(null);
    setError('');
  }

  if (authLoading || busy) {
    return <main className="p-10 text-center font-black">جاري تجهيز جلسة المراجعة...</main>;
  }
  if (!user || !user.roles.includes('student')) {
    return <main className="p-10 text-center font-black text-rose-700">هذه الشاشة مخصصة للطالب.</main>;
  }
  if (!pathId) {
    return <main className="p-10 text-center font-black text-rose-700">اختر مسار المراجعة أولًا.</main>;
  }

  if (items.length === 0) {
    return (
      <main dir="rtl" className="mx-auto max-w-2xl p-5">
        <section className="rounded-3xl border bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto text-emerald-600" size={44} />
          <h1 className="mt-3 text-2xl font-black">لا توجد بطاقات مستحقة الآن</h1>
          <p className="mt-2 text-sm font-bold text-gray-500">جدولة المراجعة تعمل حسب موعد كل بطاقة.</p>
          <Link to={`/review?pathId=${encodeURIComponent(pathId)}&subjectId=${encodeURIComponent(subjectId)}`} className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 font-black text-white">
            العودة للمكتبة
          </Link>
        </section>
      </main>
    );
  }

  if (complete) {
    return (
      <main dir="rtl" className="mx-auto max-w-2xl p-5">
        <section className="rounded-3xl border bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto text-emerald-600" size={48} />
          <h1 className="mt-3 text-2xl font-black">اكتملت دفعة المراجعة</h1>
          <p className="mt-2 font-bold text-gray-600">{correct} صحيحة من {answered}</p>
          {hasMore ? (
            <p className="mt-2 text-sm font-bold text-amber-700">توجد بطاقات مستحقة أخرى؛ ابدأ دفعة جديدة بعد العودة.</p>
          ) : null}
          <Link to={`/review?pathId=${encodeURIComponent(pathId)}&subjectId=${encodeURIComponent(subjectId)}`} className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 font-black text-white">
            العودة للمكتبة
          </Link>
        </section>
      </main>
    );
  }

  if (!current) return null;

  return (
    <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-3xl bg-slate-950 p-5 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-amber-400">DUE REVIEW</p>
              <h1 className="mt-1 text-2xl font-black">جلسة المراجعة</h1>
            </div>
            <Link to="/review" className="inline-flex items-center gap-1 rounded-xl border border-slate-700 px-3 py-2 text-sm font-black">
              <ArrowRight size={16} />
              خروج
            </Link>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-700">
            <div className="h-full bg-amber-400" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs font-bold text-slate-300">بطاقة {index + 1} من {items.length}</p>
        </header>

        {error ? <div className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}

        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {current.card.hasMistake ? <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700">علاجي</span> : null}
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">
              مستحقة للمراجعة
            </span>
          </div>
          <h2 className="mt-4 text-lg font-black leading-8 text-gray-900">
            {current.question.text || current.question.imageAlt || 'سؤال بصري'}
          </h2>
          <div className="mt-5 grid gap-2">
            {current.question.options.map((option) => {
              const chosen = selected === option.index;
              const isCorrect = result?.correctOptionIndex === option.index;
              const chosenWrong = Boolean(result && chosen && !result.correct);
              return (
                <button
                  key={option.index}
                  type="button"
                  disabled={Boolean(result) || submitting}
                  onClick={() => setSelected(option.index)}
                  className={`rounded-xl border p-3 text-right font-bold disabled:cursor-default ${
                    isCorrect
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : chosenWrong
                        ? 'border-rose-300 bg-rose-50 text-rose-900'
                        : chosen
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                          : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  <span className="ml-2 inline-block min-w-7 rounded-lg bg-gray-100 p-1 text-center">
                    {optionLetter(option.index)}
                  </span>
                  {current.question.optionsEmbeddedInImage ? '' : option.text}
                  {result && isCorrect ? <span className="mr-2 text-xs">الإجابة الصحيحة</span> : null}
                </button>
              );
            })}
          </div>

          {result ? (
            <div className={`mt-4 rounded-2xl border p-4 ${result.correct ? 'border-emerald-100 bg-emerald-50' : 'border-rose-100 bg-rose-50'}`}>
              <div className="flex items-center gap-2 font-black">
                {result.correct ? <CheckCircle2 className="text-emerald-700" size={20} /> : <CircleX className="text-rose-700" size={20} />}
                <span>{result.correct ? 'إجابة صحيحة' : 'إجابة غير صحيحة'}</span>
              </div>
              {result.explanation ? <p className="mt-3 text-sm font-bold leading-7">{result.explanation}</p> : null}
              {result.hint ? <p className="mt-2 text-sm leading-7"><strong>تلميح:</strong> {result.hint}</p> : null}
              {result.solvingStrategy ? <p className="mt-2 text-sm leading-7"><strong>طريقة الحل:</strong> {result.solvingStrategy}</p> : null}
              <p className="mt-3 text-xs font-black text-gray-600">
                المراجعة التالية: {new Date(result.nextReviewAt).toLocaleString('ar-SA')}
              </p>
            </div>
          ) : null}
        </section>

        <footer className="flex justify-end">
          {result ? (
            <button type="button" onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 font-black text-white">
              التالي
              <ChevronLeft size={18} />
            </button>
          ) : (
            <button
              type="button"
              disabled={selected === null || submitting}
              onClick={() => void submit()}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 font-black text-slate-950 disabled:opacity-40"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
              تحقق من الإجابة
            </button>
          )}
        </footer>
      </div>
    </main>
  );
}
