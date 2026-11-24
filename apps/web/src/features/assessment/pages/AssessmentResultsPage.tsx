import { resultFoundationPath } from '../navigation/resultFoundationPath';
import { safeReturnPath, returnPathLabel } from '../navigation/returnPath';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Flag,
  History,
  Play,
  Sparkles,
  Target,
  Volume2,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { QuestionAssistantPanel } from '../../ai/components/QuestionAssistantPanel';
import { InteractiveSmartTeacher } from '../../ai/components/InteractiveSmartTeacher';
import { StepSolutionModal } from '../../classroom/components/whiteboard/StepSolutionPlayer';
import { learningClient } from '../../learning/api/learning-client';
import { QuestionAssetImage } from '../../learning/components/QuestionAssetImage';
import { QuestionImageZoomModal } from '../components/QuestionImageZoomModal';
import { AssessmentResultSummary } from '../components/AssessmentResultSummary';
import { AssessmentSkillAnalysisDialog } from '../components/AssessmentSkillAnalysisDialog';
import { AssessmentFollowUpSkills } from '../components/AssessmentFollowUpSkills';
import { AssessmentPreviousAttempts } from '../components/AssessmentPreviousAttempts';
import { AssessmentShareScorecard } from '../components/AssessmentShareScorecard';
import { AssessmentReviewVideo } from '../components/AssessmentReviewVideo';
import { optionLabel, showOptionText } from '../questionPresentation';
import { relativeArabicDate } from '../relativeDate';
import {
  attemptClient,
  type ResultDetail,
  type ResultListItem,
  type ReviewQuestion,
} from '../api/attempt-client';

const reviewFilters = [
  ['all', 'الكل'],
  ['wrong', 'الأخطاء فقط'],
  ['correct', 'الصحيحة'],
  ['unanswered', 'بدون إجابة'],
] as const;
type ReviewFilter = (typeof reviewFilters)[number][0];

function matchesReviewFilter(question: ReviewQuestion, filter: ReviewFilter) {
  if (filter === 'all') return true;
  if (filter === 'unanswered') return !question.answered;
  return question.answered && question.correct === (filter === 'correct');
}

function resolveReviewImage(question: ReviewQuestion): string | null {
  if (question.imageUrl) return question.imageUrl;
  const txt = question.text?.trim() || '';
  if (/^image:/i.test(txt)) return txt.replace(/^image:/i, '').trim();
  if (/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(txt)) return txt;
  return txt.match(/<img\s+[^>]*src=["']([^"']+)["']/i)?.[1]
    || txt.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/i)?.[1] || null;
}

function hasReviewImage(question: ReviewQuestion): boolean {
  return Boolean(resolveReviewImage(question) || question.imageAssetId);
}


function ResultSummary({ item }: { item: ResultListItem }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-colors hover:border-indigo-200 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-black text-indigo-700">
            محاولة {item.attemptNumber}
          </span>
          <span className="text-[11px] font-bold text-gray-500">{relativeArabicDate(item.finalizedAt)}</span>
        </div>
        <h2 className="mt-1.5 text-base font-black leading-snug text-gray-900">{item.title}</h2>
        {item.showResultsReport ? (
          <p className="mt-1 text-[11px] font-bold text-gray-500">
            {item.correctAnswers} صحيحة من {item.totalQuestions} · {item.wrongAnswers} خاطئة · {item.unanswered} بدون إجابة
          </p>
        ) : (
          <p className="mt-1 text-[11px] font-bold text-gray-500">تم الإكمال</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:justify-end">
        {item.showResultsReport ? (
          <div className="text-center">
            <div className={`text-2xl font-black ${item.passed ? 'text-emerald-600' : 'text-rose-600'}`}>
              {item.score.toFixed(1)}%
            </div>
            <div className="text-[10px] font-bold text-gray-500">{item.passed ? 'ناجح' : 'يحتاج تدريب'}</div>
          </div>
        ) : null}
        <Link
          to={`/assessment-results/${item.attemptId}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-black text-white transition hover:bg-indigo-700"
        >
          <Eye size={15} />
          عرض النتيجة
        </Link>
      </div>
    </article>
  );
}

function ReviewQuestionCard({
  question,
  displayNumber,
  detail,
  saved,
  saving,
  onSave,
  onZoomImage,
  onOpenSmartTeacher,
  onOpenStepSolution,
  onPrevious,
  onNext,
  isLast,
}: {
  question: ReviewQuestion;
  displayNumber: number;
  detail: ResultDetail;
  saved: boolean;
  saving: boolean;
  onSave(questionId: string): void;
  onZoomImage?: (url: string) => void;
  onOpenSmartTeacher?: (question: ReviewQuestion) => void;
  onOpenStepSolution?: (question: ReviewQuestion) => void;
  onPrevious?: () => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const videoURL = detail.showExplanations ? question.videoUrl : '';
  const resolvedImageUrl = useMemo(() => resolveReviewImage(question), [question.imageUrl, question.text]);
  const imageEmbeddedOptions = Boolean(resolvedImageUrl || question.imageAssetId);

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-black text-gray-500">
          {question.learnerPresentation?.showQuestionNumber !== false ? `سؤال ${question.learnerPresentation?.questionNumber || displayNumber} · ` : ''}{question.points} درجة
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

      {!imageEmbeddedOptions && question.passage ? (
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
      {resolvedImageUrl || question.imageAssetId ? (
        <div className="my-4 overflow-hidden rounded-2xl border border-gray-100 bg-slate-50 p-3 text-center">
          <button
            type="button"
            onClick={() => resolvedImageUrl ? onZoomImage?.(resolvedImageUrl) : undefined}
            className="group relative block w-full cursor-zoom-in"
            title="اضغط لتكبير الصورة وفحص الرسم البياني أو الهندسي"
          >
            {resolvedImageUrl ? (
              <img
                src={resolvedImageUrl}
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

      {!imageEmbeddedOptions && question.text ? (
        <h3 className="mt-3 whitespace-pre-wrap text-base font-black text-gray-900">{question.text}</h3>
      ) : !resolvedImageUrl && !question.imageAssetId ? (
        <h3 className="mt-3 text-base font-black text-gray-900">{question.text || 'سؤال بصري'}</h3>
      ) : null}

      <div className={`mt-4 grid gap-2 ${imageEmbeddedOptions ? 'grid-cols-4' : ''}`}>
        {question.options.map((option, displayIndex) => {
          const labelIndex = imageEmbeddedOptions ? option.index : displayIndex;
          const selected = question.selectedOptionIndex === option.index;
          const correct =
            detail.showAnswers && question.correctOptionIndex === option.index;
          return (
            <div
              key={option.index}
              className={`rounded-xl border p-3 text-sm font-bold ${imageEmbeddedOptions ? 'text-center' : ''} ${
                correct
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : selected && !question.correct
                    ? 'border-rose-300 bg-rose-50 text-rose-900'
                    : selected
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                      : 'border-gray-100 bg-gray-50 text-gray-700'
              }`}
            >
              {imageEmbeddedOptions || question.learnerPresentation?.showOptionLabels !== false ? <span className="ml-2 inline-block min-w-7 rounded-lg bg-white p-1 text-center">
                {optionLabel(labelIndex, question.learnerPresentation, imageEmbeddedOptions ? option.text : undefined, imageEmbeddedOptions && question.options.some(item => /^[a-d]$/i.test(item.text.trim())))}
              </span> : null}
              {!imageEmbeddedOptions && showOptionText(question.learnerPresentation, false) ? option.text : ''}
              {!imageEmbeddedOptions && option.assetId ? (
                <div className="mt-2 rounded-xl bg-white p-3">
                  <QuestionAssetImage
                    assetId={option.assetId}
                    alt={`صورة الخيار ${optionLabel(labelIndex, question.learnerPresentation)}`}
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

      {(showNotes || videoURL) && (
        <section aria-label="ملاحظات السؤال" className="mt-4 space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm leading-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-700">مراجعة وتقييم السؤال</h4>
            {videoURL && (
              <button type="button" onClick={() => setVideoOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700">
                <Play size={15} /> تشغيل شرح الفيديو
              </button>
            )}
          </div>
          {showNotes && detail.showExplanations && (question.explanation || question.hint || question.solvingStrategy) ? (
            <div className="space-y-2 text-slate-700">
              {question.explanation && <p><strong>الشرح:</strong> {question.explanation}</p>}
              {question.hint && <p><strong>تلميح:</strong> {question.hint}</p>}
              {question.solvingStrategy && <p><strong>طريقة الحل:</strong> {question.solvingStrategy}</p>}
            </div>
          ) : (
            <p className="text-xs font-bold text-slate-500">
              {detail.showExplanations
                ? 'يمكنك مراجعة اختيارك وحالة إجابتك أعلاه.'
                : 'الشرح التحريري غير متاح لهذا السؤال. يمكنك مراجعة اختيارك وحالة إجابتك أعلاه.'}
            </p>
          )}
        </section>
      )}
      {videoURL && videoOpen && (
        <AssessmentReviewVideo url={videoURL} title={`شرح السؤال ${displayNumber}`} onClose={() => setVideoOpen(false)} />
      )}
      {detail.showAnswers && detail.showExplanations ? <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenStepSolution?.(question)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-black text-white shadow-xs transition hover:from-indigo-700 hover:to-violet-700 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Volume2 size={15} className="text-amber-300" />
            <span>شرح صوتي خطوة بخطوة بالسبورة 🎙️</span>
          </button>

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
      </div> : null}

      {showAiAssistant && detail.showAnswers && detail.showExplanations ? (
        <div className="mt-3">
          <QuestionAssistantPanel questionId={question.questionId} attemptId={detail.result.attemptId} />
        </div>
      ) : null}
      <nav aria-label="التنقل بين الأسئلة" className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 sm:pt-5">
        <button type="button" disabled={!onPrevious} onClick={onPrevious} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-black text-slate-700 disabled:bg-slate-50 disabled:text-slate-400 sm:px-4"><ArrowRight size={15} /> السابق</button>
        <button type="button" aria-expanded={showNotes} onClick={() => setShowNotes(open => !open)} className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-black sm:px-4 ${showNotes ? 'bg-amber-100 text-amber-800' : 'bg-indigo-50 text-indigo-700'}`}><Eye size={14} /> {showNotes ? 'إخفاء الملاحظات' : 'إظهار الملاحظات'}</button>
        <button type="button" onClick={onNext} className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-2.5 py-2 text-xs font-black text-white sm:px-4">{isLast ? 'إنهاء المراجعة' : 'التالي'} <ChevronLeft size={15} /></button>
      </nav>
    </article>
  );
}

const learnerSavedReviewQuestions = new Map<string, Set<string>>();

export function AssessmentResultsPage({ embedded, resultAttemptId, hideReturnLink }: { embedded?: boolean; resultAttemptId?: string; hideReturnLink?: boolean } = {}) {
  const { attemptId: routeAttemptId = '' } = useParams();
  const attemptId = resultAttemptId || routeAttemptId;
  const [searchParams, setSearchParams] = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get('returnTo'));
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const [history, setHistory] = useState<ResultListItem[]>([]);
  const [detail, setDetail] = useState<ResultDetail | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [reviewBoardOpen, setReviewBoardOpen] = useState(false);
  const [fullResult, setFullResult] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState('');
  const reviewOpen = searchParams.get('view') === 'review';
  const historyOpen = searchParams.get('view') === 'history';
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [detailContext, setDetailContext] = useState('');
  const [savedQuestions, setSavedQuestions] = useState<Set<string>>(() => {
    return new Set(learnerSavedReviewQuestions.get(user?.id || '') || []);
  });
  const [savingQuestion, setSavingQuestion] = useState('');
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [activeSmartTeacherQuestion, setActiveSmartTeacherQuestion] = useState<ReviewQuestion | null>(null);
  const [activeStepSolverQuestion, setActiveStepSolverQuestion] = useState<ReviewQuestion | null>(null);
  const activeContext = `${user?.id ?? ''}:${attemptId}`;
  const activeContextRef = useRef(activeContext);
  const analysisDialog = useRef<HTMLDialogElement>(null);
  activeContextRef.current = activeContext;

  useEffect(() => {
    setSaveError('');
    setSavingQuestion('');
    setFilter('all');
    setSelectedQuestionId('');
    setReviewBoardOpen(false);
    setFullResult(false);
    setSummaryStatus('');
    setActiveSmartTeacherQuestion(null);
    setActiveStepSolverQuestion(null);
  }, [activeContext]);

  useEffect(() => {
    const id = user?.id || '';
    setSavedQuestions(new Set(learnerSavedReviewQuestions.get(id) || []));
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
          setHistory(response.items || []);
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


  function changeResultView(view: 'review' | 'history' | 'summary') {
    const params = new URLSearchParams(searchParams);
    if (view !== 'summary') params.set('view', view);
    else params.delete('view');
    setFilter('all');
    setSelectedQuestionId('');
    setReviewBoardOpen(false);
    setSearchParams(params, { replace: true });
    window.scrollTo(0, 0);
  }

  function changeReviewView(open: boolean) {
    changeResultView(open ? 'review' : 'summary');
  }

  async function saveForReview(questionId: string) {
    if (savedQuestions.has(questionId) || savingQuestion) return;
    const requestContext = activeContextRef.current;
    setSavingQuestion(questionId);
    setSaveError('');
    try {
      const csrf = await getCsrfToken();
      await learningClient.saveReview(questionId, csrf);
      if (activeContextRef.current !== requestContext) return;
      const id = user?.id || '';
      let set = learnerSavedReviewQuestions.get(id);
      if (!set) {
        set = new Set<string>();
        learnerSavedReviewQuestions.set(id, set);
      }
      set.add(questionId);
      setSavedQuestions(new Set(set));
    } catch (cause) {
      if (activeContextRef.current === requestContext) {
        setSaveError(cause instanceof Error ? cause.message : 'تعذر حفظ السؤال للمراجعة');
      }
    } finally {
      if (activeContextRef.current === requestContext) setSavingQuestion('');
    }
  }

  const filteredQuestions = useMemo(() => (detail?.questions || []).filter((question) => matchesReviewFilter(question, filter)), [detail, filter]);
  const reviewCounts = useMemo(() => ({
    all: detail?.questions?.length ?? 0,
    wrong: detail?.questions?.filter(question => matchesReviewFilter(question, 'wrong')).length ?? 0,
    correct: detail?.questions?.filter(question => matchesReviewFilter(question, 'correct')).length ?? 0,
    unanswered: detail?.questions?.filter(question => matchesReviewFilter(question, 'unanswered')).length ?? 0,
  }), [detail]);
  const selectedIndex = Math.max(0, filteredQuestions.findIndex(question => question.questionId === selectedQuestionId));
  const selectedQuestion = filteredQuestions[selectedIndex];
  const displayNumbers = useMemo(() => new Map((detail?.questions || []).map((question, index) => [question.questionId, index + 1])), [detail]);

  if (authLoading || busy || (attemptId && detailContext !== activeContext && !error)) {
    return <div className="p-10 text-center font-black">جاري تحميل النتائج...</div>;
  }
  if (!user) {
    return <div className="p-10 text-center font-black text-rose-700">يلزم تسجيل الدخول.</div>;
  }
  if (error) {
    return <div className="p-10 text-center font-black text-rose-700">{error}</div>;
  }

  const ContainerTag = embedded ? 'div' : 'main';

  if (!attemptId) {
    const passedOnPage = history.filter((item) => item.showResultsReport && item.passed).length;
    const visibleScores = history.filter((item) => item.showResultsReport).map((item) => item.score);
    const bestOnPage = visibleScores.length ? Math.max(...visibleScores) : null;
    return (
      <ContainerTag dir="rtl" className={`mx-auto max-w-4xl space-y-5 ${embedded ? 'p-0 w-full' : 'px-3 pb-20 pt-5 sm:px-6'}`}>
        <header className="rounded-3xl border border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/40 dark:from-indigo-950/60 dark:via-slate-900 dark:to-slate-900 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {!embedded ? (
                <Link to="/dashboard" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm" aria-label="العودة للوحة الطالب"><ArrowRight size={20}/></Link>
              ) : null}
              <div>
                <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-black text-gray-900 dark:text-white sm:text-2xl">اختباراتي</h1><span className="rounded-full bg-indigo-100 dark:bg-indigo-950/60 px-2.5 py-0.5 text-xs font-black text-indigo-700 dark:text-indigo-300">سجل الإنجاز</span></div>
                <p className="mt-1 text-xs font-bold text-gray-500 dark:text-slate-400 sm:text-sm">محاولاتك ونتائجك المحفوظة من الخادم، مرتبة من الأحدث.</p>
              </div>
            </div>
            <Link to={embedded ? "/dashboard?tab=assessments" : "/assessments"} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/50 px-4 py-3 text-sm font-black text-amber-800 dark:text-amber-300"><Target size={16}/>مركز الاختبارات</Link>
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
      </ContainerTag>
    );
  }

  if (!detail) {
    return <main className="p-10 text-center font-black">النتيجة غير متاحة.</main>;
  }

  if (historyOpen && detail.showResultsReport) {
    return <AssessmentPreviousAttempts key={activeContext} onBack={() => changeResultView('summary')} />;
  }

  const shouldShowReview = !detail.showResultsReport || reviewOpen;
  const weakestSkill = detail.skillAnalysis?.complete
    ? detail.skillAnalysis.items.reduce<(typeof detail.skillAnalysis.items)[number] | undefined>((lowest, skill) => (
      skill.status !== 'strong' && (!lowest || skill.mastery < lowest.mastery) ? skill : lowest
    ), undefined)
    : undefined;
  const practiceURL = weakestSkill ? `/quiz?${new URLSearchParams({
    mode: 'self', pathId: weakestSkill.pathId, subjectId: weakestSkill.subjectId, skillIds: weakestSkill.skillId,
  })}` : '';
  const guardianSummary = weakestSkill
    ? `نتيجة الاختبار ${detail.result.score}%. أضعف مهارة ظهرت هي «${weakestSkill.skillName}» بنسبة ${weakestSkill.mastery}%.`
    : `نتيجة الاختبار ${detail.result.score}%.`;

  async function shareGuardianSummary(share: boolean) {
    try {
      if (share && navigator.share) {
        await navigator.share({ title: 'ملخص نتيجة الاختبار', text: guardianSummary });
        setSummaryStatus('تمت المشاركة');
      } else {
        await navigator.clipboard.writeText(guardianSummary);
        setSummaryStatus('تم النسخ');
      }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setSummaryStatus('تعذر مشاركة الملخص');
    }
  }
  const retryURL = !returnTo && detail.assessmentId ? `/assessments/${encodeURIComponent(detail.assessmentId)}/start` : '';
  const resultNavigation = (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      {reviewOpen && detail.showResultsReport ? (
        <button type="button" onClick={() => changeReviewView(false)} aria-label="العودة للملخص" className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600"><ArrowRight size={20} /></button>
      ) : (
        <Link to={embedded ? '/assessment-results' : '/dashboard'} aria-label={embedded ? 'العودة لسجل النتائج' : 'العودة للوحة الطالب'} className="text-gray-500"><ArrowRight size={22} /></Link>
      )}
      <div>
        <h1 className="text-xl font-bold">{reviewOpen && detail.showResultsReport ? 'مراجعة الحلول والأسئلة' : 'نتيجة الاختبار'}</h1>
        {reviewOpen && detail.showResultsReport && (
          <h2 className="text-xs font-bold text-slate-500">{detail.title} • تفاصيل الإجابات والشرح النموذجي</h2>
        )}
      </div>
      {returnTo && !hideReturnLink && <Link to={returnTo} className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">{returnPathLabel(returnTo)}</Link>}
    </div>
  );

  return (
    <main dir="rtl" className="mx-auto max-w-5xl space-y-6 px-3 pb-20 pt-5 sm:px-6">
      {shouldShowReview && <header className="border-b border-slate-200/80 pb-2">{resultNavigation}</header>}
      {!detail.showResultsReport ? (
        <section className="rounded-2xl border border-slate-100 bg-white p-5">
          <h2 className="font-black text-gray-900">{detail.title}</h2>
          <p className="mt-2 text-sm font-bold text-gray-600">تم تسجيل إكمال الاختبار. تقرير الدرجات التفصيلي غير معروض وفق إعدادات هذا الاختبار.</p>
        </section>
      ) : !reviewOpen ? (
        <>
          <AssessmentResultSummary detail={detail} navigation={resultNavigation} full={fullResult} onToggleFull={() => setFullResult((current) => !current)} onReview={() => changeReviewView(true)} onMoreDetails={() => analysisDialog.current?.showModal()} onHistory={() => changeResultView('history')} practiceURL={practiceURL} retryURL={retryURL} />
          <AssessmentSkillAnalysisDialog key={activeContext} detail={detail} dialogRef={analysisDialog} />
        </>
      ) : null}
        {!shouldShowReview && detail.showResultsReport && detail.skillAnalysis ? (
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
                              return <div key={topic.id} className="rounded-lg border border-slate-100 p-2">
                                <p className="text-xs font-bold text-gray-600">{topic.title}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Link to={resultFoundationPath(skill, topic.id, 'lessons')} className="rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-xs font-black text-indigo-700">شرح التأسيس{topic.isLocked ? ' 🔒' : ''}</Link>
                                  <Link to={resultFoundationPath(skill, topic.id, 'quizzes')} className="rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs font-black text-amber-800">تدريبات الموضوع</Link>
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
      {!shouldShowReview && detail.showResultsReport && weakestSkill ? (
        <section className="rounded-3xl border border-indigo-100 bg-indigo-50/40 p-5 sm:p-6">
          <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">الخطوة التالية الموصى بها</span>
          <h2 className="text-lg font-black text-gray-900">خطة تحسين لمهارة: {weakestSkill.skillName}</h2>
          <p className="mt-1 text-xs font-bold leading-relaxed text-gray-500">{weakestSkill.foundationTopics?.[0]?.hasLesson ? 'ابدأ بشرح قصير لهذه المهارة ثم انتقل للتدريب.' : weakestSkill.foundationTopics?.[0]?.hasPractice ? 'ابدأ بتدريب قصير الآن ثم أعد القياس بعده.' : 'ابدأ بخطوة صغيرة على المهارة الأضعف ثم أعد الاختبار لاحقًا.'}</p>
          <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-black text-gray-900">مسار ما بعد الاختبار</h3>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-4">
              <button type="button" disabled={!detail.allowQuestionReview || !detail.questions?.length} onClick={() => changeReviewView(true)} className="min-h-[104px] rounded-2xl border border-emerald-100 bg-white p-3 text-start text-emerald-800 disabled:opacity-50">
                <span className="text-xs font-black">مراجعة الحلول</span><span className="mt-3 block text-sm font-black text-gray-900">راجع موضع الخطأ</span><span className="mt-1 block text-xs font-bold">{detail.allowQuestionReview && detail.questions?.length ? `${detail.questions.length} سؤال متاح للمراجعة.` : 'تفاصيل الحلول غير متاحة لهذه المحاولة.'}</span>
              </button>
              <Link to={weakestSkill.foundationTopics?.[0] ? resultFoundationPath(weakestSkill, weakestSkill.foundationTopics[0].id, 'lessons') : '/reports'} className="min-h-[104px] rounded-2xl border border-indigo-100 bg-white p-3 text-indigo-800">
                <span className="text-xs font-black">{weakestSkill.foundationTopics?.[0] ? 'فتح الشرح' : 'فتح التقرير'}</span><span className="mt-3 block text-sm font-black text-gray-900">افهم المهارة</span><span className="mt-1 block text-xs font-bold">ابدأ بشرح {weakestSkill.foundationTopics?.[0]?.title || weakestSkill.skillName}.</span>
              </Link>
              <Link to={weakestSkill.foundationTopics?.[0] ? resultFoundationPath(weakestSkill, weakestSkill.foundationTopics[0].id, 'quizzes') : practiceURL} className="min-h-[104px] rounded-2xl border border-amber-100 bg-white p-3 text-amber-800">
                <span className="text-xs font-black">بدء التدريب</span><span className="mt-3 block text-sm font-black text-gray-900">تدرب ثم قِس</span><span className="mt-1 block text-xs font-bold">تدريب قصير على نفس المهارة.</span>
              </Link>
              <Link to="/reports" className="min-h-[104px] rounded-2xl border border-slate-200 bg-white p-3 text-slate-800">
                <span className="text-xs font-black">فتح التقرير</span><span className="mt-3 block text-sm font-black text-gray-900">تابع الخطة</span><span className="mt-1 block text-xs font-bold">ارجع للتقرير العام لترى هل تحسنت المهارة بعد المحاولة القادمة.</span>
              </Link>
            </div>
          </div>
        </section>
      ) : null}
      {!shouldShowReview && detail.showResultsReport && !weakestSkill && (
        <section className="rounded-3xl border border-indigo-100 bg-indigo-50/40 p-5 sm:p-6">
          <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">الخطوة التالية الموصى بها</span>
          <h2 className="mt-2 text-lg font-black text-gray-900">{detail.skillAnalysis?.complete && detail.skillAnalysis.items.length > 0 ? 'جاهز لتحدٍ جديد' : 'خطة ما بعد الاختبار'}</h2>
          <p className="mt-1 text-xs font-bold leading-relaxed text-gray-500">{detail.skillAnalysis?.complete && detail.skillAnalysis.items.length > 0 ? 'أتقنت المهارات المقاسة في هذه المحاولة. واصل التعلم بتحدٍ جديد.' : 'راجع الحلول أولًا؛ لا توجد أدلة مهارية كافية لتحديد خطة تحسين.'}</p>
          <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-black text-gray-900">مسار ما بعد الاختبار</h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <button type="button" disabled={!detail.allowQuestionReview || !detail.questions?.length} onClick={() => changeReviewView(true)} className="rounded-2xl border border-emerald-100 bg-white p-3 text-start text-sm font-black text-emerald-800 disabled:opacity-50">مراجعة الحلول</button>
              <Link to="/dashboard" className="rounded-2xl border border-indigo-100 bg-white p-3 text-sm font-black text-indigo-800">العودة لمساري</Link>
            </div>
          </div>
        </section>
      )}
      {!shouldShowReview && detail.showResultsReport && <AssessmentShareScorecard key={activeContext} result={detail.result} title={detail.title} studentName={user.name} />}
      {!shouldShowReview && detail.showResultsReport && fullResult && (
        <>
          <section aria-labelledby="guardian-summary" className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
            <h2 id="guardian-summary" className="text-sm font-black text-indigo-900">ملخص سريع لولي الأمر أو المعلم</h2>
            <p className="mt-2 text-sm leading-7 text-indigo-800">{guardianSummary}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 print:hidden">
              <button type="button" onClick={() => void shareGuardianSummary(false)} className="rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-700">نسخ الملخص</button>
              <button type="button" onClick={() => void shareGuardianSummary(true)} className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700">مشاركة</button>
              <span role="status" className="text-xs font-bold text-indigo-900">{summaryStatus}</span>
            </div>
          </section>
          <AssessmentFollowUpSkills detail={detail} openAnalysis={() => analysisDialog.current?.showModal()} />
        </>
      )}
        {saveError ? <p role="alert" className="text-sm font-bold text-rose-700">{saveError}</p> : null}
        {!detail.allowQuestionReview ? (
          <section className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-900">
            مراجعة الأسئلة غير متاحة لهذا الاختبار وفق إعدادات النسخة التي أجريت عليها المحاولة.
          </section>
        ) : shouldShowReview ? (
          <div className="grid items-start gap-6 lg:grid-cols-12">
            <section className="space-y-4 lg:col-span-8" aria-label="السؤال الحالي">
            {!selectedQuestion ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm font-bold text-gray-500">
                لا توجد أسئلة في هذا التصنيف.
              </div>
            ) : (
              <ReviewQuestionCard
                key={`${filter}:${selectedQuestion.questionId}:${selectedQuestion.questionVersion}`}
                question={selectedQuestion}
                displayNumber={displayNumbers.get(selectedQuestion.questionId) || 1}
                detail={detail}
                saved={savedQuestions.has(selectedQuestion.questionId)}
                saving={savingQuestion === selectedQuestion.questionId}
                onSave={(questionId) => void saveForReview(questionId)}
                onZoomImage={setZoomImageUrl}
                onOpenSmartTeacher={setActiveSmartTeacherQuestion}
                onOpenStepSolution={setActiveStepSolverQuestion}
                onPrevious={selectedIndex > 0 ? () => setSelectedQuestionId(filteredQuestions[selectedIndex - 1].questionId) : undefined}
                onNext={() => {
                  const nextQuestion = filteredQuestions[selectedIndex + 1];
                  if (nextQuestion) setSelectedQuestionId(nextQuestion.questionId);
                  else changeReviewView(false);
                }}
                isLast={selectedIndex === filteredQuestions.length - 1}
              />
            )}
            </section>
            <aside aria-label="لوحة مراجعة الأسئلة" className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-6 lg:col-span-4 lg:rounded-3xl">
              <button type="button" aria-expanded={reviewBoardOpen} onClick={() => setReviewBoardOpen(open => !open)} className="w-full rounded-2xl p-3 text-xs font-black text-slate-900 lg:hidden">
                لوحة الأسئلة · {reviewCounts.all}
              </button>
              <div className={`${reviewBoardOpen ? 'block' : 'hidden'} space-y-4 p-4 lg:block`}>
              <h2 className="hidden text-sm font-black text-slate-900 lg:block">لوحة مراجعة الأسئلة</h2>
              <div className="grid grid-cols-2 gap-2">
                {reviewFilters.map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={filter === value} onClick={() => {
                    setFilter(value);
                    setSelectedQuestionId(selectedQuestion?.questionId || '');
                  }} className={`rounded-xl border px-2 py-2 text-xs font-black ${filter === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 bg-slate-50 text-slate-700'}`}>
                    {label} ({reviewCounts[value]})
                  </button>
                ))}
              </div>
              <div className="grid max-h-56 grid-cols-6 gap-2 overflow-y-auto p-1">
                {filteredQuestions.map(question => {
                  const number = displayNumbers.get(question.questionId);
                  const current = question.questionId === selectedQuestion?.questionId;
                  const tone = !question.answered ? 'bg-amber-50 text-amber-800' : question.correct ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white';
                  return <button key={question.questionId} type="button" aria-label={`سؤال ${number}`} aria-current={current ? 'step' : undefined}
                    onClick={() => setSelectedQuestionId(question.questionId)} className={`h-9 rounded-xl text-xs font-black ${tone} ${current ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}>{number}</button>;
                })}
              </div>
              {reviewCounts.wrong > 0 && <Link to="/favorites?tab=mistakes" className="block rounded-2xl border border-rose-200 bg-rose-50 p-2.5 text-center text-xs font-black text-rose-700">تدرب على أخطائك في بنك المراجعة ({reviewCounts.wrong})</Link>}
              <button type="button" onClick={() => changeReviewView(false)} className="w-full rounded-2xl bg-slate-900 py-3 text-xs font-black text-white">إنهاء المراجعة والعودة للملخص</button>
              </div>
            </aside>
          </div>
        ) : null}

      {/* Step Solution Player (Audio + KaTeX + Whiteboard Steps) */}
      {activeStepSolverQuestion ? (
        <StepSolutionModal
          isOpen={Boolean(activeStepSolverQuestion)}
          onClose={() => setActiveStepSolverQuestion(null)}
          questionText={hasReviewImage(activeStepSolverQuestion) ? '' : activeStepSolverQuestion.text}
          explanation={activeStepSolverQuestion.explanation}
          solvingStrategy={activeStepSolverQuestion.solvingStrategy}
        />
      ) : null}

      {/* Interactive Smart Teacher & Whiteboard Modal */}
      {activeSmartTeacherQuestion && detail ? (
        <InteractiveSmartTeacher
          isOpen={Boolean(activeSmartTeacherQuestion)}
          onClose={() => setActiveSmartTeacherQuestion(null)}
          questionId={activeSmartTeacherQuestion.questionId}
          questionText={activeSmartTeacherQuestion.text}
          hideQuestionTextFromDisplay={hasReviewImage(activeSmartTeacherQuestion)}
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
