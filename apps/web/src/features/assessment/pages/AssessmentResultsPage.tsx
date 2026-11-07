import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Flag,
  History,
  Play,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { QuestionAssistantPanel } from '../../ai/components/QuestionAssistantPanel';
import { InteractiveSmartTeacher } from '../../ai/components/InteractiveSmartTeacher';
import { learningClient } from '../../learning/api/learning-client';
import { QuestionAssetImage } from '../../learning/components/QuestionAssetImage';
import { QuestionImageZoomModal } from '../components/QuestionImageZoomModal';
import { ResultDonutChart } from '../components/ResultDonutChart';
import { optionLabel, showOptionText } from '../questionPresentation';
import {
  attemptClient,
  type ResultDetail,
  type ResultListItem,
  type ReviewQuestion,
} from '../api/attempt-client';

type ReviewFilter = 'all' | 'wrong' | 'unanswered' | 'marked';

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
  onZoomImage,
  onOpenSmartTeacher,
}: {
  question: ReviewQuestion;
  detail: ResultDetail;
  saved: boolean;
  saving: boolean;
  onSave(questionId: string): void;
  onZoomImage?: (url: string) => void;
  onOpenSmartTeacher?: (question: ReviewQuestion) => void;
}) {
  const [showAiAssistant, setShowAiAssistant] = useState(false);

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-black text-gray-500">
          {question.learnerPresentation?.showQuestionNumber !== false ? `سؤال ${question.learnerPresentation?.questionNumber || question.sortOrder + 1} · ` : ''}{question.points} درجة
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

      {question.passage ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs leading-relaxed text-amber-950">
          <div className="mb-1.5 flex items-center gap-1.5 font-black text-amber-900">
            <BookOpen size={14} className="text-amber-700" />
            <span>قطعة استيعاب المقروء:</span>
          </div>
          <p className="whitespace-pre-line rounded-xl border border-amber-100 bg-white/80 p-2.5 text-xs font-medium leading-relaxed text-slate-800">
            {question.passage}
          </p>
        </div>
      ) : null}

      {/* صورة السؤال المعتمدة */}
      {question.imageUrl || question.imageAssetId ? (
        <div className="my-4 overflow-hidden rounded-2xl border border-gray-100 bg-slate-50 p-3 text-center">
          <button
            type="button"
            onClick={() => question.imageUrl ? onZoomImage?.(question.imageUrl) : undefined}
            className="group relative block w-full cursor-zoom-in"
            title="اضغط لتكبير الصورة وفحص الرسم البياني أو الهندسي"
          >
            {question.imageUrl ? (
              <img
                src={question.imageUrl}
                alt={question.imageAlt || 'صورة السؤال'}
                className="mx-auto max-h-[380px] w-full object-contain rounded-xl transition-transform duration-200 group-hover:scale-[1.01]"
              />
            ) : question.imageAssetId ? (
              <QuestionAssetImage
                assetId={question.imageAssetId}
                alt={question.imageAlt || 'صورة السؤال'}
                onZoom={onZoomImage}
              />
            ) : null}
          </button>
        </div>
      ) : null}

      {!question.optionsEmbeddedInImage && !question.imageUrl && question.text ? (
        <h3 className="mt-3 whitespace-pre-wrap text-base font-black text-gray-900">{question.text}</h3>
      ) : !question.imageUrl && !question.imageAssetId ? (
        <h3 className="mt-3 text-base font-black text-gray-900">{question.text || 'سؤال بصري'}</h3>
      ) : null}

      <div className={`mt-4 grid gap-2 ${question.imageAssetId && question.optionsEmbeddedInImage ? 'grid-cols-4' : ''}`}>
        {question.options.map((option) => {
          const selected = question.selectedOptionIndex === option.index;
          const correct =
            detail.showAnswers && question.correctOptionIndex === option.index;
          return (
            <div
              key={option.index}
              className={`rounded-xl border p-3 text-sm font-bold ${question.imageAssetId && question.optionsEmbeddedInImage ? 'text-center' : ''} ${
                correct
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : selected && !question.correct
                    ? 'border-rose-300 bg-rose-50 text-rose-900'
                    : selected
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                      : 'border-gray-100 bg-gray-50 text-gray-700'
              }`}
            >
              {question.learnerPresentation?.showOptionLabels !== false ? <span className="ml-2 inline-block min-w-7 rounded-lg bg-white p-1 text-center">
                {optionLabel(option.index, question.learnerPresentation, question.optionsEmbeddedInImage ? option.text : undefined, question.optionsEmbeddedInImage && question.options.some(item => /^[a-d]$/i.test(item.text.trim())))}
              </span> : null}
              {showOptionText(question.learnerPresentation, Boolean(question.imageAssetId && question.optionsEmbeddedInImage)) ? option.text : ''}
              {!(question.imageAssetId && question.optionsEmbeddedInImage) && option.assetId ? (
                <div className="mt-2 rounded-xl bg-white p-3">
                  <QuestionAssetImage
                    assetId={option.assetId}
                    alt={`صورة الخيار ${optionLabel(option.index, question.learnerPresentation)}`}
                    onZoom={onZoomImage}
                  />
                </div>
              ) : null}
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

      {question.videoUrl ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs font-bold text-blue-900">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <Play size={13} className="fill-current" />
            </div>
            <span>فيديو شرح حل المسألة متوفر</span>
          </div>
          <a
            href={question.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-700 transition"
          >
            شاهد فيديو الشرح <ExternalLink size={12} />
          </a>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenSmartTeacher?.(question)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 px-4 py-2 text-xs font-black text-white shadow-xs transition hover:from-emerald-700 hover:to-indigo-700 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles size={15} className="text-amber-300" />
            <span>افتح المعلم الذكي والسبورة التفاعلية 🧑‍🏫</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAiAssistant((prev) => !prev)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black shadow-xs transition ${
              showAiAssistant
                ? 'border border-violet-300 bg-violet-600 text-white'
                : 'border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100'
            }`}
          >
            <BrainCircuit size={15} className={showAiAssistant ? 'text-white' : 'text-violet-600'} />
            {showAiAssistant ? 'إخفاء المساعد' : 'اسأل المساعد النصي 💡'}
          </button>
        </div>
      </div>

      {showAiAssistant ? (
        <div className="mt-3">
          <QuestionAssistantPanel reviewCardId={question.questionId} />
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
  const [saveError, setSaveError] = useState('');
  const [detailContext, setDetailContext] = useState('');
  const [savedQuestions, setSavedQuestions] = useState<Set<string>>(() => new Set());
  const [savingQuestion, setSavingQuestion] = useState('');
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [activeSmartTeacherQuestion, setActiveSmartTeacherQuestion] = useState<ReviewQuestion | null>(null);
  const activeContext = `${user?.id ?? ''}:${attemptId}`;
  const activeContextRef = useRef(activeContext);
  activeContextRef.current = activeContext;

  useEffect(() => {
    setSaveError('');
    setSavingQuestion('');
    setFilter('all');
    setActiveSmartTeacherQuestion(null);
  }, [activeContext]);

  useEffect(() => {
    setSavedQuestions(new Set<string>());
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setBusy(false);
      return;
    }
    let active = true;
    setBusy(true);
    setError('');
    setDetail(null);

    const pending = attemptId
      ? attemptClient.review(attemptId).then((response) => {
          if (active) {
            setDetail(response.detail);
            setDetailContext(activeContext);
          }
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
  }, [activeContext, attemptId, authLoading, page, user]);

  async function saveForReview(questionId: string) {
    if (savedQuestions.has(questionId) || savingQuestion) return;
    const requestContext = activeContextRef.current;
    setSavingQuestion(questionId);
    setSaveError('');
    try {
      const csrf = await getCsrfToken();
      await learningClient.saveReview(questionId, csrf);
      if (activeContextRef.current !== requestContext) return;
      setSavedQuestions((current) => {
        const next = new Set(current);
        next.add(questionId);
        return next;
      });
    } catch (cause) {
      if (activeContextRef.current === requestContext) {
        setSaveError(cause instanceof Error ? cause.message : 'تعذر حفظ السؤال للمراجعة');
      }
    } finally {
      if (activeContextRef.current === requestContext) setSavingQuestion('');
    }
  }

  const filteredQuestions = useMemo(() => {
    const questions = detail?.questions || [];
    if (filter === 'wrong') return questions.filter((question) => question.answered && !question.correct);
    if (filter === 'unanswered') return questions.filter((question) => !question.answered);
    if (filter === 'marked') return questions.filter((question) => question.markedForReview);
    return questions;
  }, [detail, filter]);

  if (authLoading || busy || (attemptId && detailContext !== activeContext && !error)) {
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

        {detail.showResultsReport ? (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <div className="flex justify-center p-2 md:border-l md:border-indigo-100">
              <ResultDonutChart
                data={[
                  { name: 'صحيحة', value: result.correctAnswers, color: '#10b981' },
                  { name: 'خاطئة', value: result.wrongAnswers, color: '#ef4444' },
                  { name: 'بدون إجابة', value: result.unanswered, color: '#f59e0b' },
                ]}
                centerLabel={`${result.score.toFixed(0)}%`}
                centerSubLabel={result.passed ? 'ناجح' : 'يحتاج تدريب'}
                primaryColor="#10b981"
              />
            </div>
            <div className="md:col-span-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className={`rounded-2xl border p-3 text-center ${scoreTone(result.passed)}`}><div className="text-3xl font-black">{result.score.toFixed(1)}%</div><div className="text-xs font-bold">الدرجة</div></div>
              <div className="rounded-2xl bg-emerald-50 p-3 text-center text-emerald-800"><CheckCircle2 className="mx-auto" size={20}/><div className="mt-1 font-black">{result.correctAnswers}</div><div className="text-xs font-bold">صحيحة</div></div>
              <div className="rounded-2xl bg-rose-50 p-3 text-center text-rose-800"><XCircle className="mx-auto" size={20}/><div className="mt-1 font-black">{result.wrongAnswers}</div><div className="text-xs font-bold">خاطئة</div></div>
              <div className="rounded-2xl bg-amber-50 p-3 text-center text-amber-800"><AlertCircle className="mx-auto" size={20}/><div className="mt-1 font-black">{result.unanswered}</div><div className="text-xs font-bold">بدون إجابة</div></div>
            </div>
          </div>
        ) : <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-600">تم تسجيل إكمال الاختبار. تقرير الدرجات التفصيلي غير معروض وفق إعدادات هذا الاختبار.</div>}
      </header>
        {detail.showResultsReport && detail.skillAnalysis ? (
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="attempt-skills-heading">
            <div className="mb-5">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">تحليل الأداء المهاري</span>
              <h2 id="attempt-skills-heading" className="mt-3 text-lg font-black text-gray-900">أين كنت قويًا؟ وأين تحتاج دعم؟</h2>
              <p className="mt-1 text-xs font-bold text-gray-500">مستخرج من إجابات هذه المحاولة.</p>
            </div>
            {!detail.skillAnalysis.complete ? (
              <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">تفاصيل المهارات لهذه المحاولة غير مكتملة حاليًا.</p>
            ) : detail.skillAnalysis.items.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-600">لا توجد مهارات مرتبطة بأسئلة هذه المحاولة.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {([
                  ['strong', 'نقاط القوة (أتقنتها)', 'border-emerald-100 bg-emerald-50/40', 'text-emerald-800', 'bg-emerald-500'],
                  ['weak', 'نقاط تحتاج دعم (أولوية تركيز)', 'border-rose-100 bg-rose-50/40', 'text-rose-800', 'bg-rose-500'],
                  ['average', 'مهارات في تقدم', 'border-amber-100 bg-amber-50/40', 'text-amber-800', 'bg-amber-500'],
                ] as const).map(([status, title, panel, tone, bar]) => {
                  const skills = detail.skillAnalysis!.items.filter(item => item.status === status);
                  if (status === 'average' && skills.length === 0) return null;
                  return <div key={status} className={`rounded-2xl border p-4 sm:p-5 ${status === 'average' ? 'md:col-span-2' : ''} ${panel}`}>
                    <div className={`mb-3 flex items-center justify-between gap-2 text-sm font-black ${tone}`}>
                      <h3>{title}</h3><span className="rounded-full bg-white px-2.5 py-1 text-xs">{skills.length} مهارات</span>
                    </div>
                    {skills.length === 0 ? <p className="rounded-xl bg-white p-3 text-xs font-bold text-gray-500">لا توجد مهارات في هذا التصنيف.</p> : (
                      <div className="space-y-3">{skills.map(skill => <div key={`${skill.pathId}:${skill.subjectId}:${skill.skillId}`} className="rounded-xl bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-2"><span className="text-sm font-black text-gray-800">{skill.skillName}</span><span className={`text-sm font-black ${tone}`}>{skill.mastery}%</span></div>
                        <p className="mt-1 text-xs font-bold text-gray-500">{skill.subjectName}</p>
                        <p className="mt-1 text-xs font-bold text-gray-500">{skill.correctCount} صحيحة من {skill.questionCount}</p>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${bar}`} style={{width: `${skill.mastery}%`}} /></div>
                        {status !== 'strong' && skill.foundationTopics?.length ? (
                          <div className="mt-3 space-y-3">
                            {skill.foundationTopics.map(topic => {
                              const base = new URLSearchParams({ subject: skill.subjectId, tab: 'skills', topic: topic.id });
                              const topicURL = (content: string) => `/category/${encodeURIComponent(skill.pathId)}?${new URLSearchParams([...base, ['content', content]])}`;
                              return <div key={topic.id} className="rounded-lg border border-slate-100 p-2">
                                <p className="text-xs font-bold text-gray-600">{topic.title}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Link to={topicURL('lessons')} className="rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-xs font-black text-indigo-700">شرح التأسيس{topic.isLocked ? ' 🔒' : ''}</Link>
                                  <Link to={topicURL('quizzes')} className="rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs font-black text-amber-800">تدريبات الموضوع</Link>
                                </div>
                              </div>;
                            })}
                          </div>
                        ) : null}
                      </div>)}</div>
                    )}
                  </div>;
                })}
              </div>
            )}
          </section>
        ) : null}
        {saveError ? <p role="alert" className="text-sm font-bold text-rose-700">{saveError}</p> : null}
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
                    onZoomImage={setZoomImageUrl}
                    onOpenSmartTeacher={setActiveSmartTeacherQuestion}
                  />
                ))}
              </div>
            )}
          </>
        )}

      {/* Interactive Smart Teacher & Whiteboard Modal */}
      {activeSmartTeacherQuestion && detail ? (
        <InteractiveSmartTeacher
          isOpen={Boolean(activeSmartTeacherQuestion)}
          onClose={() => setActiveSmartTeacherQuestion(null)}
          questionId={activeSmartTeacherQuestion.questionId}
          questionText={activeSmartTeacherQuestion.text}
          explanation={activeSmartTeacherQuestion.explanation}
          solvingStrategy={activeSmartTeacherQuestion.solvingStrategy}
          options={activeSmartTeacherQuestion.options?.map((opt, idx) => ({
            index: idx,
            label: optionLabel(idx),
            text: opt.text,
          }))}
          selectedOptionIndex={activeSmartTeacherQuestion.selectedOptionIndex}
          correctOptionIndex={activeSmartTeacherQuestion.correctOptionIndex}
          resultId={detail.result.attemptId}
          context="result_review"
        />
      ) : null}

      {/* Full-Screen Image Pan & Zoom Modal */}
      <QuestionImageZoomModal
        imageUrl={zoomImageUrl}
        onClose={() => setZoomImageUrl(null)}
        altText="تكبير صورة المسألة"
      />
    </main>
  );
}
