import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flag,
  History,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import {
  attemptClient,
  type ResultDetail,
  type ResultListItem,
  type ReviewQuestion,
} from '../api/attempt-client';

type ReviewFilter = 'all' | 'wrong' | 'unanswered' | 'marked';

const optionLetter = (index: number) =>
  ['أ', 'ب', 'ج', 'د', 'هـ', 'و'][index] || String(index + 1);

function scoreTone(passed: boolean) {
  return passed
    ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
    : 'border-rose-100 bg-rose-50 text-rose-800';
}

function ResultSummary({ item }: { item: ResultListItem }) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-black text-gray-900">{item.title}</h2>
          <p className="mt-1 text-xs font-bold text-gray-500">
            المحاولة {item.attemptNumber} · {new Date(item.finalizedAt).toLocaleString('ar-SA')}
          </p>
        </div>
        {item.showResultsReport ? (
          <span className={`rounded-full border px-3 py-1 text-sm font-black ${scoreTone(item.passed)}`}>
            {item.score.toFixed(1)}%
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-600">
            تم الإكمال
          </span>
        )}
      </div>
      {item.showResultsReport ? (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold">
          <div className="rounded-xl bg-emerald-50 p-2 text-emerald-800">{item.correctAnswers} صحيحة</div>
          <div className="rounded-xl bg-rose-50 p-2 text-rose-800">{item.wrongAnswers} خاطئة</div>
          <div className="rounded-xl bg-gray-50 p-2 text-gray-700">{item.unanswered} بدون إجابة</div>
        </div>
      ) : null}
      <Link
        to={`/assessment-results/${item.attemptId}`}
        className="mt-4 inline-flex rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-700"
      >
        عرض النتيجة
      </Link>
    </article>
  );
}

function ReviewQuestionCard({
  question,
  detail,
}: {
  question: ReviewQuestion;
  detail: ResultDetail;
}) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-black text-gray-500">
          سؤال {question.sortOrder + 1} · {question.points} درجة
        </div>
        <div className="flex gap-2">
          {!question.answered ? (
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-black text-gray-600">
              بدون إجابة
            </span>
          ) : question.correct ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
              صحيح
            </span>
          ) : (
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700">
              خطأ
            </span>
          )}
          {question.markedForReview ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">
              <Flag size={12} />
              للمراجعة
            </span>
          ) : null}
        </div>
      </div>

      <h3 className="mt-3 text-base font-black text-gray-900">
        {question.text || question.imageAlt || 'سؤال بصري'}
      </h3>
      {question.imageAssetId ? (
        <div className="mt-3 rounded-xl bg-gray-50 p-4 text-center text-xs font-bold text-gray-400">
          صورة السؤال: {question.imageAssetId}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {question.options.map((option) => {
          const selected = question.selectedOptionIndex === option.index;
          const correct =
            detail.showAnswers && question.correctOptionIndex === option.index;
          return (
            <div
              key={option.index}
              className={`rounded-xl border p-3 text-sm font-bold ${
                correct
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : selected && !question.correct
                    ? 'border-rose-300 bg-rose-50 text-rose-900'
                    : selected
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                      : 'border-gray-100 bg-gray-50 text-gray-700'
              }`}
            >
              <span className="ml-2 inline-block min-w-7 rounded-lg bg-white p-1 text-center">
                {optionLetter(option.index)}
              </span>
              {question.optionsEmbeddedInImage ? '' : option.text}
              {selected ? <span className="mr-2 text-xs">اختيارك</span> : null}
              {correct ? <span className="mr-2 text-xs">الإجابة الصحيحة</span> : null}
            </div>
          );
        })}
      </div>

      {detail.showExplanations &&
      (question.explanation || question.hint || question.solvingStrategy) ? (
        <div className="mt-4 space-y-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm leading-7 text-amber-950">
          {question.explanation ? <p><strong>الشرح:</strong> {question.explanation}</p> : null}
          {question.hint ? <p><strong>تلميح:</strong> {question.hint}</p> : null}
          {question.solvingStrategy ? <p><strong>طريقة الحل:</strong> {question.solvingStrategy}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

export function AssessmentResultsPage() {
  const { attemptId = '' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [history, setHistory] = useState<ResultListItem[]>([]);
  const [detail, setDetail] = useState<ResultDetail | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setBusy(false);
      return;
    }
    let active = true;
    setBusy(true);
    setError('');

    const pending = attemptId
      ? attemptClient.review(attemptId).then((response) => {
          if (active) setDetail(response.detail);
        })
      : attemptClient.results(page, 20).then((response) => {
          if (!active) return;
          setHistory(response.items);
          setHasMore(response.hasMore);
        });

    pending
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'تعذر تحميل النتائج');
      })
      .finally(() => {
        if (active) setBusy(false);
      });

    return () => {
      active = false;
    };
  }, [attemptId, authLoading, page, user]);

  const filteredQuestions = useMemo(() => {
    const questions = detail?.questions || [];
    if (filter === 'wrong') return questions.filter((question) => question.answered && !question.correct);
    if (filter === 'unanswered') return questions.filter((question) => !question.answered);
    if (filter === 'marked') return questions.filter((question) => question.markedForReview);
    return questions;
  }, [detail, filter]);

  if (authLoading || busy) {
    return <main className="p-10 text-center font-black">جاري تحميل النتائج...</main>;
  }
  if (!user) {
    return <main className="p-10 text-center font-black text-rose-700">يلزم تسجيل الدخول.</main>;
  }
  if (error) {
    return <main className="p-10 text-center font-black text-rose-700">{error}</main>;
  }

  if (!attemptId) {
    return (
      <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-gray-50 px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <header className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-indigo-700">
              <History size={20} />
              <span className="text-xs font-black">Assessment History</span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-gray-900">سجل النتائج</h1>
            <p className="mt-2 text-sm font-medium text-gray-500">
              نتائجك فقط، مرتبة من الأحدث، مع تحميل 20 نتيجة في الصفحة.
            </p>
          </header>

          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center font-bold text-gray-500">
              لا توجد نتائج حتى الآن.
            </div>
          ) : (
            <div className="grid gap-3">{history.map((item) => <ResultSummary key={item.attemptId} item={item} />)}</div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-2 text-sm font-black disabled:opacity-40"
            >
              <ChevronRight size={16} />
              السابق
            </button>
            <span className="text-xs font-black text-gray-500">صفحة {page}</span>
            <button
              type="button"
              disabled={!hasMore}
              onClick={() => setPage((value) => value + 1)}
              className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-2 text-sm font-black disabled:opacity-40"
            >
              التالي
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!detail) {
    return <main className="p-10 text-center font-black">النتيجة غير متاحة.</main>;
  }

  const result = detail.result;
  return (
    <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-6 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <Link to="/assessment-results" className="text-sm font-black text-indigo-700">
            ← سجل النتائج
          </Link>
          <h1 className="mt-3 text-2xl font-black text-gray-900">{detail.title}</h1>
          <p className="mt-1 text-xs font-bold text-gray-500">
            المحاولة {detail.attemptNumber} · {new Date(result.finalizedAt).toLocaleString('ar-SA')}
          </p>

          {detail.showResultsReport ? (
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className={`rounded-2xl border p-3 text-center ${scoreTone(result.passed)}`}>
                <div className="text-2xl font-black">{result.score.toFixed(1)}%</div>
                <div className="text-xs font-bold">الدرجة</div>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3 text-center text-emerald-800">
                <CheckCircle2 className="mx-auto" size={20} />
                <div className="mt-1 font-black">{result.correctAnswers}</div>
                <div className="text-xs font-bold">صحيحة</div>
              </div>
              <div className="rounded-2xl bg-rose-50 p-3 text-center text-rose-800">
                <XCircle className="mx-auto" size={20} />
                <div className="mt-1 font-black">{result.wrongAnswers}</div>
                <div className="text-xs font-bold">خاطئة</div>
              </div>
              <div className="rounded-2xl bg-gray-100 p-3 text-center text-gray-700">
                <AlertCircle className="mx-auto" size={20} />
                <div className="mt-1 font-black">{result.unanswered}</div>
                <div className="text-xs font-bold">بدون إجابة</div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-600">
              تم تسجيل إكمال الاختبار. تقرير الدرجات التفصيلي غير معروض وفق إعدادات هذا الاختبار.
            </div>
          )}
        </header>

        {!detail.allowQuestionReview ? (
          <section className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-900">
            مراجعة الأسئلة غير متاحة لهذا الاختبار وفق إعدادات النسخة التي أجريت عليها المحاولة.
          </section>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm sm:grid-cols-4">
              {([
                ['all', 'الكل'],
                ['wrong', 'أخطأت فيها'],
                ['unanswered', 'بدون إجابة'],
                ['marked', 'للمراجعة'],
              ] as Array<[ReviewFilter, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-xl px-3 py-2.5 text-sm font-black ${
                    filter === value ? 'bg-slate-950 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </section>

            {filteredQuestions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm font-bold text-gray-500">
                لا توجد أسئلة في هذا التصنيف.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredQuestions.map((question) => (
                  <ReviewQuestionCard
                    key={`${question.questionId}:${question.questionVersion}`}
                    question={question}
                    detail={detail}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
