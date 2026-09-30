import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Eye,
  Flag,
  History,
  Target,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { learningClient } from '../../learning/api/learning-client';
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
    <article className="rounded-2xl border-2 border-slate-200/90 bg-white p-4 shadow-sm transition-colors hover:border-indigo-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-black text-indigo-700">محاولة {item.attemptNumber}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-black text-slate-600">v{item.assessmentVersion}</span>
          </div>
          <h2 className="mt-2 text-base font-black leading-tight text-gray-900">{item.title}</h2>
          <p className="mt-1 text-[11px] font-bold text-gray-500">{new Date(item.finalizedAt).toLocaleString('ar-SA')}</p>
        </div>
        {item.showResultsReport ? (
          <div className="flex items-center gap-3">
            <div className="text-center"><div className="text-[10px] font-bold text-gray-500">الدرجة</div><div className={`text-xl font-black ${item.passed?'text-emerald-600':'text-rose-600'}`}>{item.score.toFixed(1)}%</div></div>
            <div className="border-r border-gray-100 pr-3 text-center"><div className="text-[10px] font-bold text-gray-500">صحيح</div><div className="text-lg font-black text-indigo-700">{item.correctAnswers}/{item.totalQuestions}</div></div>
          </div>
        ) : <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-600">تم الإكمال</span>}
      </div>
      {item.showResultsReport ? <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-bold">
        <div className="rounded-xl bg-emerald-50 p-2 text-emerald-800">{item.correctAnswers} صحيحة</div>
        <div className="rounded-xl bg-rose-50 p-2 text-rose-800">{item.wrongAnswers} خاطئة</div>
        <div className="rounded-xl bg-amber-50 p-2 text-amber-800">{item.unanswered} بدون إجابة</div>
      </div> : null}
      <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
        <Link to={`/assessment-results/${item.attemptId}`} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 py-2 text-xs font-black text-white hover:bg-gray-800">
          <Eye size={15} className="text-amber-400"/>عرض النتيجة
        </Link>
      </div>
    </article>
  );
}

function ReviewQuestionCard({
  question,
  detail,
  saved,
  saving,
  onSave,
}: {
  question: ReviewQuestion;
  detail: ResultDetail;
  saved: boolean;
  saving: boolean;
  onSave(questionId: string): void;
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

      <button
        type="button"
        disabled={saved || saving}
        onClick={() => onSave(question.questionId)}
        className="mt-3 inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-800 disabled:opacity-60"
      >
        <Bookmark size={14} />
        {saved ? 'تم الحفظ' : saving ? 'جاري الحفظ...' : 'حفظ للمراجعة'}
      </button>

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
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const [history, setHistory] = useState<ResultListItem[]>([]);
  const [detail, setDetail] = useState<ResultDetail | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [savedQuestions, setSavedQuestions] = useState<Set<string>>(() => new Set());
  const [savingQuestion, setSavingQuestion] = useState('');

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

  async function saveForReview(questionId: string) {
    if (savedQuestions.has(questionId)) return;
    setSavingQuestion(questionId);
    setError('');
    try {
      const csrf = await getCsrfToken();
      await learningClient.saveReview(questionId, csrf);
      setSavedQuestions((current) => {
        const next = new Set(current);
        next.add(questionId);
        return next;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ السؤال للمراجعة');
    } finally {
      setSavingQuestion('');
    }
  }

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
    const passedOnPage = history.filter((item) => item.showResultsReport && item.passed).length;
    const visibleScores = history.filter((item) => item.showResultsReport).map((item) => item.score);
    const bestOnPage = visibleScores.length ? Math.max(...visibleScores) : null;
    return (
      <main dir="rtl" className="mx-auto max-w-4xl space-y-5 px-3 pb-20 pt-5 sm:px-6">
        <header className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/40 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm" aria-label="العودة للوحة الطالب"><ArrowRight size={20}/></Link>
              <div>
                <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-black text-gray-900 sm:text-2xl">اختباراتي</h1><span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-black text-indigo-700">سجل الإنجاز</span></div>
                <p className="mt-1 text-xs font-bold text-gray-500 sm:text-sm">محاولاتك ونتائجك المحفوظة من الخادم، مرتبة من الأحدث.</p>
              </div>
            </div>
            <Link to="/assessments" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800"><Target size={16}/>مركز الاختبارات</Link>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm"><div className="text-2xl font-black text-indigo-700">{history.length}</div><div className="text-[11px] font-bold text-gray-500">محاولات الصفحة</div></div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-center shadow-sm"><div className="text-2xl font-black text-emerald-700">{passedOnPage}</div><div className="text-[11px] font-bold text-emerald-700">ناجحة</div></div>
          <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-4 text-center shadow-sm"><div className="text-2xl font-black text-purple-700">{bestOnPage==null?'—':`${bestOnPage.toFixed(1)}%`}</div><div className="text-[11px] font-bold text-purple-700">أفضل درجة بالصفحة</div></div>
        </div>

        {history.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <History className="mx-auto text-indigo-400" size={28}/><h2 className="mt-3 font-black text-gray-900">لا توجد محاولات بعد</h2><p className="mt-1 text-sm font-bold text-gray-500">ابدأ اختبارًا واحدًا، وبعد التسليم ستظهر النتيجة هنا.</p>
        </div> : <div className="space-y-3">{history.map((item)=><ResultSummary key={item.attemptId} item={item}/>)}</div>}

        <div className="flex items-center justify-between">
          <button type="button" disabled={page<=1} onClick={()=>setPage((value)=>Math.max(1,value-1))} className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-2 text-sm font-black disabled:opacity-40"><ChevronRight size={16}/>السابق</button>
          <span className="text-xs font-black text-gray-500">صفحة {page}</span>
          <button type="button" disabled={!hasMore} onClick={()=>setPage((value)=>value+1)} className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-2 text-sm font-black disabled:opacity-40">التالي<ChevronLeft size={16}/></button>
        </div>
      </main>
    );
  }

  if (!detail) {
    return <main className="p-10 text-center font-black">النتيجة غير متاحة.</main>;
  }

  const result = detail.result;
  return (
    <main dir="rtl" className="mx-auto max-w-5xl space-y-5 px-3 pb-20 pt-5 sm:px-6">
      <header className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/40 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Link to="/assessment-results" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm" aria-label="العودة لسجل النتائج"><ArrowRight size={20}/></Link>
            <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-black text-gray-900 sm:text-2xl">{detail.title}</h1><span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-black text-indigo-700">المحاولة {detail.attemptNumber}</span></div><p className="mt-1 text-xs font-bold text-gray-500">{new Date(result.finalizedAt).toLocaleString('ar-SA')}</p></div>
          </div>
          <div className="flex flex-wrap gap-2"><Link to="/review" className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-black text-purple-700">أسئلتي للمراجعة</Link><Link to="/assessments" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">اختبار جديد</Link></div>
        </div>

        {detail.showResultsReport ? <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className={`rounded-2xl border p-3 text-center ${scoreTone(result.passed)}`}><div className="text-3xl font-black">{result.score.toFixed(1)}%</div><div className="text-xs font-bold">الدرجة</div></div>
          <div className="rounded-2xl bg-emerald-50 p-3 text-center text-emerald-800"><CheckCircle2 className="mx-auto" size={20}/><div className="mt-1 font-black">{result.correctAnswers}</div><div className="text-xs font-bold">صحيحة</div></div>
          <div className="rounded-2xl bg-rose-50 p-3 text-center text-rose-800"><XCircle className="mx-auto" size={20}/><div className="mt-1 font-black">{result.wrongAnswers}</div><div className="text-xs font-bold">خاطئة</div></div>
          <div className="rounded-2xl bg-amber-50 p-3 text-center text-amber-800"><AlertCircle className="mx-auto" size={20}/><div className="mt-1 font-black">{result.unanswered}</div><div className="text-xs font-bold">بدون إجابة</div></div>
        </div> : <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-600">تم تسجيل إكمال الاختبار. تقرير الدرجات التفصيلي غير معروض وفق إعدادات هذا الاختبار.</div>}
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
                    saved={savedQuestions.has(question.questionId)}
                    saving={savingQuestion === question.questionId}
                    onSave={(questionId) => void saveForReview(questionId)}
                  />
                ))}
              </div>
            )}
          </>
        )}
    </main>
  );
}
