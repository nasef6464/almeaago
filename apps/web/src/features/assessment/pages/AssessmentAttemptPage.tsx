import { BookOpen, CheckCircle2, Clock3, Flag, Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { attemptClient, type Attempt, type Result } from '../api/attempt-client';
import { QuestionAssetImage } from '../../learning/components/QuestionAssetImage';

const key = (prefix: string, id: string) => {
  const storageKey = `${prefix}:${id}`;
  let value = sessionStorage.getItem(storageKey);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(storageKey, value);
  }
  return value;
};

export function AssessmentAttemptPage() {
  const { assessmentId = '', attemptId = '' } = useParams();
  const { user, loading, getCsrfToken } = useAuth();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [draftChoice, setDraftChoice] = useState<{ attemptId: string; questionId: string; option: number } | null>(null);
  const actionRef = useRef('');
  const scopeKey = `${user?.id || ''}:${assessmentId}:${attemptId}`;
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  const getCsrfRef = useRef(getCsrfToken);
  getCsrfRef.current = getCsrfToken;

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    setAttempt(null);
    setResult(null);
    setIndex(0);
    setDraftChoice(null);
    setSavingAnswer(false);
    actionRef.current = '';
    setError('');
    setBusy(true);
    const run = async () => {
      try {
        if (attemptId) {
          const response = await attemptClient.get(attemptId);
          if (active) setAttempt(response.attempt);
        } else if (assessmentId) {
          const csrf = await getCsrfRef.current();
          if (!active) return;
          const response = await attemptClient.start(
            assessmentId,
            key('assessment-start', `${user.id}:${assessmentId}`),
            csrf,
          );
          if (active) setAttempt(response.attempt);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'تعذر فتح الاختبار');
      } finally {
        if (active) setBusy(false);
      }
    };
    void run();
    return () => { active = false; };
  }, [assessmentId, attemptId, loading, user?.id]);

  const answers = useMemo(
    () => new Map((attempt?.answers || []).map((answer) => [answer.questionId, answer])),
    [attempt],
  );
  const question = attempt?.questions[index];
  const saved = question ? answers.get(question.id) : undefined;

  async function choose(option: number) {
    if (!attempt || !question || busy || actionRef.current) return;
    const actionScope = scopeKey;
    const selectedQuestionId = question.id;
    actionRef.current = actionScope;
    setDraftChoice({ attemptId: attempt.id, questionId: selectedQuestionId, option });
    setSavingAnswer(true);
    setError('');
    try {
      const csrf = await getCsrfToken();
      if (scopeRef.current !== actionScope) return;
      const response = await attemptClient.save(
        attempt.id,
        selectedQuestionId,
        option,
        saved?.markedForReview || false,
        csrf,
      );
      if (scopeRef.current !== actionScope) return;
      setAttempt(response.attempt);
      setDraftChoice(null);
      if (attempt.requireAnswerBeforeNext && index < attempt.questions.length - 1) {
        setIndex((value) => value + 1);
      }
    } catch (cause) {
      if (scopeRef.current === actionScope) {
        // Keep the local choice for an explicit retry, not as a persisted answer.
        setError(cause instanceof Error ? cause.message : 'تعذر حفظ الإجابة');
      }
    } finally {
      if (actionRef.current === actionScope) actionRef.current = '';
      if (scopeRef.current === actionScope) setSavingAnswer(false);
    }
  }

  async function toggleReview() {
    if (!attempt || !question || busy || actionRef.current || draftChoice?.attemptId === attempt.id) return;
    if (saved?.selectedOptionIndex == null) {
      setError('أجب عن السؤال أولًا ثم يمكنك تعليمه للمراجعة.');
      return;
    }
    const actionScope = scopeKey;
    actionRef.current = actionScope;
    setSavingAnswer(true);
    setError('');
    try {
      const csrf = await getCsrfToken();
      if (scopeRef.current !== actionScope) return;
      const response = await attemptClient.save(
        attempt.id,
        question.id,
        saved.selectedOptionIndex,
        !saved.markedForReview,
        csrf,
      );
      if (scopeRef.current === actionScope) setAttempt(response.attempt);
    } catch (cause) {
      if (scopeRef.current === actionScope) {
        setError(cause instanceof Error ? cause.message : 'تعذر تحديث علامة المراجعة');
      }
    } finally {
      if (actionRef.current === actionScope) actionRef.current = '';
      if (scopeRef.current === actionScope) setSavingAnswer(false);
    }
  }

  async function submit() {
    if (!attempt || busy || actionRef.current || draftChoice?.attemptId === attempt.id) return;
    const actionScope = scopeKey;
    actionRef.current = actionScope;
    setBusy(true);
    setError('');
    try {
      const csrf = await getCsrfToken();
      if (scopeRef.current !== actionScope) return;
      const response = await attemptClient.submit(
        attempt.id,
        key('assessment-submit', `${user?.id || ''}:${attempt.id}`),
        csrf,
      );
      if (scopeRef.current === actionScope) setResult(response.result);
    } catch (cause) {
      if (scopeRef.current === actionScope) {
        setError(cause instanceof Error ? cause.message : 'تعذر تسليم الاختبار');
      }
    } finally {
      if (actionRef.current === actionScope) actionRef.current = '';
      if (scopeRef.current === actionScope) setBusy(false);
    }
  }

  if (loading || (busy && !attempt)) {
    return <main className="p-10 text-center font-black">جاري فتح الاختبار...</main>;
  }
  if (error && !attempt) {
    return <main className="p-10 text-center font-black text-rose-700">{error}</main>;
  }
  if (result) {
    return (
      <main dir="rtl" className="mx-auto max-w-xl p-5">
        <section className="rounded-3xl border bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto text-emerald-600" size={48} />
          <h1 className="mt-3 text-2xl font-black">تم تسليم الاختبار</h1>
          <div className="mt-5 text-5xl font-black">{result.score.toFixed(1)}%</div>
          <p className="mt-3 font-bold">
            {result.correctAnswers} صحيحة · {result.wrongAnswers} خاطئة · {result.unanswered} بدون إجابة
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Link
              to={`/assessment-results/${result.attemptId}`}
              className="rounded-xl bg-slate-950 px-4 py-2.5 font-black text-white"
            >
              عرض النتيجة والمراجعة
            </Link>
            <Link
              to="/assessment-results"
              className="rounded-xl border px-4 py-2.5 font-black text-slate-700"
            >
              سجل النتائج
            </Link>
          </div>
        </section>
      </main>
    );
  }
  if (!attempt || !question) {
    return <main className="p-10 text-center font-black">لا توجد أسئلة متاحة.</main>;
  }

  return (
    <main dir="rtl" className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="rounded-2xl bg-slate-950 p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-400">اختبار جاري</p>
            <h1 className="font-black">{attempt.title}</h1>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <Clock3 size={16} />
            {attempt.expiresAt ? 'مؤقت' : 'بدون مؤقت'}
          </div>
        </div>
        {attempt.showProgressBar ? (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700">
            <div
              className="h-full bg-amber-400"
              style={{ width: `${((index + 1) / attempt.questions.length) * 100}%` }}
            />
          </div>
        ) : null}
      </header>

      {error ? (
        <div className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}</div>
      ) : null}

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex justify-between text-sm font-bold text-gray-500">
          <span>السؤال {index + 1} من {attempt.questions.length}</span>
          <span>{question.points} درجة</span>
        </div>
        {question.passage ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-950">
            <div className="mb-2 flex items-center gap-1.5 font-black text-amber-900">
              <BookOpen size={15} className="text-amber-700" />
              <span>قطعة استيعاب المقروء:</span>
            </div>
            <p className="whitespace-pre-line rounded-xl border border-amber-100 bg-white/80 p-3 text-sm font-medium leading-relaxed text-slate-800">
              {question.passage}
            </p>
          </div>
        ) : null}

        <h2 className="text-lg font-black">{question.text || question.imageAlt || 'سؤال بصري'}</h2>
        {question.imageAssetId ? (
          <div className="my-4 overflow-hidden rounded-2xl border border-gray-100 bg-slate-50 p-3 text-center">
            <QuestionAssetImage assetId={question.imageAssetId} alt={question.imageAlt || 'صورة السؤال'} />
          </div>
        ) : null}
        <div className="mt-5 grid gap-2">
          {question.options.map((option) => (
            <button
              key={option.index}
              type="button"
              disabled={savingAnswer || busy}
              onClick={() => void choose(option.index)}
              className={`rounded-xl border p-3 text-right font-bold ${
                (draftChoice?.attemptId === attempt.id && draftChoice.questionId === question.id
                  ? draftChoice.option : saved?.selectedOptionIndex) === option.index
                  ? 'border-amber-500 bg-amber-50'
                  : ''
              }`}
            >
              <span className="ml-2 inline-block min-w-7 rounded-lg bg-gray-100 p-1 text-center">
                {['أ', 'ب', 'ج', 'د', 'هـ'][option.index] || option.index + 1}
              </span>
              {question.optionsEmbeddedInImage ? '' : option.text}
              {!question.optionsEmbeddedInImage && option.assetId ? (
                <span className="mt-2 block w-full">
                  <QuestionAssetImage
                    assetId={option.assetId}
                    alt={`صورة الاختيار ${['أ', 'ب', 'ج', 'د', 'هـ'][option.index] || option.index + 1}`}
                    className="mx-auto max-h-40 max-w-full rounded-lg object-contain"
                    showRetryButton={false}
                  />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={index === 0 || savingAnswer || busy || draftChoice?.attemptId === attempt.id}
            onClick={() => setIndex((value) => value - 1)}
            className="rounded-xl border px-4 py-2 font-bold disabled:opacity-40"
          >
            السابق
          </button>
          <button
            type="button"
            disabled={
              savingAnswer || busy || draftChoice?.attemptId === attempt.id ||
              index === attempt.questions.length - 1 ||
              (attempt.requireAnswerBeforeNext && !saved)
            }
            onClick={() => setIndex((value) => value + 1)}
            className="rounded-xl border px-4 py-2 font-bold disabled:opacity-40"
          >
            التالي
          </button>
          {attempt.allowQuestionReview ? (
            <button
              type="button"
              disabled={savingAnswer || busy || draftChoice?.attemptId === attempt.id || saved?.selectedOptionIndex == null}
              onClick={() => void toggleReview()}
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-40 ${
                saved?.markedForReview ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : ''
              }`}
            >
              <Flag size={15} />
              {saved?.markedForReview ? 'معلّم للمراجعة' : 'للمراجعة'}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || savingAnswer || draftChoice?.attemptId === attempt.id}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 font-black text-white"
        >
          <Send size={17} />
          تسليم الاختبار
        </button>
      </footer>
    </main>
  );
}
