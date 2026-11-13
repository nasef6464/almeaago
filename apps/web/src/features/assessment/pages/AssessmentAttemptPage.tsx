import {
  AlertTriangle,
  Lock,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Flag,
  Moon,
  Send,
  Star,
  Sun,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { attemptClient, type Attempt, type Result } from '../api/attempt-client';
import { QuestionAssetImage } from '../../learning/components/QuestionAssetImage';
import { QuestionImageZoomModal } from '../components/QuestionImageZoomModal';
import {
  formatQuestionHtmlForDisplay,
  formatTimerCountdown,
  getQuizOptionGridClass,
  optionLabel,
  showOptionText,
} from '../questionPresentation';

const key = (prefix: string, id: string) => {
  const storageKey = `${prefix}:${id}`;
  let value = sessionStorage.getItem(storageKey);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(storageKey, value);
  }
  return value;
};

function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return '';
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded)) return '';
    const parsed = new URL(value, window.location.origin);
    return parsed.origin === window.location.origin ? parsed.pathname + parsed.search + parsed.hash : '';
  } catch { return ''; }
}

export function AssessmentAttemptPage() {
  const { assessmentId = '', attemptId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get('returnTo'));
  const { user, loading, getCsrfToken } = useAuth();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [draftChoice, setDraftChoice] = useState<{ attemptId: string; questionId: string; option: number } | null>(null);
  const [isNightMode, setIsNightMode] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') || localStorage.getItem('almeaa_theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: 'light' | 'dark' }>;
      if (customEvent.detail?.theme) {
        setIsNightMode(customEvent.detail.theme === 'dark');
      }
    };
    window.addEventListener('almeaa_theme_change', handleThemeChange);
    return () => window.removeEventListener('almeaa_theme_change', handleThemeChange);
  }, []);

  const toggleNightMode = () => {
    const next = !isNightMode;
    setIsNightMode(next);
    if (typeof document !== 'undefined') {
      if (next) {
        document.documentElement.classList.add('dark');
        try { localStorage.setItem('almeaa_theme', 'dark'); } catch {}
      } else {
        document.documentElement.classList.remove('dark');
        try { localStorage.setItem('almeaa_theme', 'light'); } catch {}
      }
      window.dispatchEvent(new CustomEvent('almeaa_theme_change', { detail: { theme: next ? 'dark' : 'light' } }));
    }
  };
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [lockedSectionIds, setLockedSectionIds] = useState<Set<string>>(() => new Set());
  const [showSectionConfirmModal, setShowSectionConfirmModal] = useState(false);
  const [sectionNotice, setSectionNotice] = useState('');
  const [sectionSecondsLeft, setSectionSecondsLeft] = useState<number | null>(null);

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
    setLockedSectionIds(new Set());
    setShowSectionConfirmModal(false);
    setSectionNotice('');
    setSectionSecondsLeft(null);
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

  useEffect(() => {
    if (!attempt || result) return;
    if (attempt.expiresAt) {
      const diff = Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    } else {
      setSecondsLeft(null);
    }
  }, [attempt?.id, attempt?.expiresAt, result]);

  useEffect(() => {
    if (!attempt || result) return;
    const interval = setInterval(() => {
      if (attempt.expiresAt) {
        const diff = Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000));
        setSecondsLeft(diff);
        if (diff === 0 && !busy && !actionRef.current) {
          clearInterval(interval);
          void submit();
        }
      } else {
        setElapsedSeconds((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [attempt?.id, attempt?.expiresAt, result, busy]);

  const answers = useMemo(
    () => new Map((attempt?.answers || []).map((answer) => [answer.questionId, answer])),
    [attempt],
  );
  const question = attempt?.questions[index];
  const saved = question ? answers.get(question.id) : undefined;
  const resolvedImageUrl = useMemo(() => {
    if (question?.imageUrl) return question.imageUrl;
    const txt = question?.text?.trim() || '';
    if (/^image:/i.test(txt)) return txt.replace(/^image:/i, '').trim();
    if (/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(txt)) return txt;
    const imgMatch = txt.match(/<img\s+[^>]*src=["']([^"']+)["']/i);
    if (imgMatch) return imgMatch[1];
    const mdMatch = txt.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/i);
    if (mdMatch) return mdMatch[1];
    return null;
  }, [question?.imageUrl, question?.text]);
  const hasImage = Boolean(resolvedImageUrl || question?.imageAssetId);
  const isTahsili = Boolean(
    attempt?.title?.includes('تحصيلي') ||
    attempt?.title?.includes('فيزياء') ||
    attempt?.title?.includes('كيمياء') ||
    attempt?.title?.includes('أحياء') ||
    attempt?.title?.includes('رياضيات') ||
    question?.id?.toLowerCase().includes('tah') ||
    question?.id?.toLowerCase().includes('phys') ||
    question?.id?.toLowerCase().includes('chem') ||
    question?.id?.toLowerCase().includes('bio')
  );
  const imageEmbeddedOptions = Boolean(
    (hasImage && question?.optionsEmbeddedInImage) ||
    (hasImage && isTahsili) ||
    (hasImage && (!question?.text || question?.text.trim() === '' || question?.text === 'سؤال بصري'))
  );

  const answeredCount = answers.size;
  const totalQuestions = attempt?.questions.length || 0;
  const unansweredCount = totalQuestions - answeredCount;
  const markedForReviewCount = useMemo(
    () => Array.from(answers.values()).filter((a) => a.markedForReview).length,
    [answers],
  );

  const isMockExam = useMemo(() => {
    const t = (attempt?.title || '').toLowerCase();
    return t.includes('محاكي') || t.includes('قياس') || t.includes('تجريبي') || t.includes('mock');
  }, [attempt?.title]);

  const sectionGroups = useMemo(() => {
    if (!attempt?.questions || attempt.questions.length === 0) return [];
    const map = new Map<string, number[]>();
    attempt.questions.forEach((q, idx) => {
      const sId = q.sectionId || 'sec_default';
      if (!map.has(sId)) map.set(sId, []);
      map.get(sId)!.push(idx);
    });

    const groups: Array<{ id: string; title: string; indices: number[] }> = [];
    let num = 1;
    for (const [id, indices] of map.entries()) {
      groups.push({
        id,
        title: map.size > 1 ? `القسم ${num}` : 'القسم العام',
        indices,
      });
      num++;
    }
    return groups;
  }, [attempt?.questions]);

  const currentSection = useMemo(() => {
    if (!question || sectionGroups.length === 0) return null;
    return sectionGroups.find((g) => g.indices.includes(index)) || sectionGroups[0];
  }, [question, index, sectionGroups]);

  const currentSectionIdx = useMemo(() => {
    if (!currentSection) return 0;
    return sectionGroups.findIndex((g) => g.id === currentSection.id);
  }, [currentSection, sectionGroups]);

  const hasNextSection = sectionGroups.length > 1 && currentSectionIdx < sectionGroups.length - 1;
  const isLastQuestionInSection = useMemo(() => {
    if (!currentSection) return false;
    return currentSection.indices[currentSection.indices.length - 1] === index;
  }, [currentSection, index]);

  useEffect(() => {
    if (!isMockExam || sectionGroups.length <= 1) {
      setSectionSecondsLeft(null);
      return;
    }
    setSectionSecondsLeft(25 * 60);
  }, [currentSection?.id, isMockExam, sectionGroups.length]);

  useEffect(() => {
    if (sectionSecondsLeft == null || result || busy) return;
    const interval = setInterval(() => {
      setSectionSecondsLeft((prev) => {
        if (prev == null || prev <= 1) {
          clearInterval(interval);
          if (currentSection) {
            setLockedSectionIds((old) => new Set([...old, currentSection.id]));
            if (hasNextSection) {
              const nextGroup = sectionGroups[currentSectionIdx + 1];
              setIndex(nextGroup.indices[0]);
              setSectionNotice(`⏱ انتهى وقت ${currentSection.title} وتم قفله تلقائياً، انتقلت إلى ${nextGroup.title}.`);
            } else {
              void submit();
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sectionSecondsLeft, result, busy, currentSection?.id, hasNextSection, currentSectionIdx, sectionGroups]);

  function navigateToQuestion(idx: number) {
    const targetQ = attempt?.questions[idx];
    if (!targetQ) return;
    if (targetQ.sectionId && lockedSectionIds.has(targetQ.sectionId)) {
      setError('🔒 هذا القسم مغلق وفق معايير الاختبار المحاكي لقياس، لا يمكن الرجوع لأسئلته.');
      return;
    }
    if (sectionGroups.length > 1 && currentSection && !currentSection.indices.includes(idx)) {
      const targetGroup = sectionGroups.find((g) => g.indices.includes(idx));
      const targetIdx = targetGroup ? sectionGroups.indexOf(targetGroup) : -1;
      if (targetIdx > currentSectionIdx) {
        setError(`يلزم إنهاء ${currentSection.title} أولاً قبل الانتقال إلى ${targetGroup?.title || 'القسم التالي'}.`);
        return;
      }
    }
    setIndex(idx);
    setError('');
  }

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
        // A failed save must not leave a phantom pending choice: retry and submit
        // remain available, while only server-confirmed answers count as saved.
        setDraftChoice(null);
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
    setShowConfirmSubmit(false);
    try {
      const csrf = await getCsrfToken();
      if (scopeRef.current !== actionScope) return;
      const response = await attemptClient.submit(
        attempt.id,
        key('assessment-submit', `${user?.id || ''}:${attempt.id}`),
        csrf,
      );
      if (scopeRef.current === actionScope) {
        if (attempt.showResultsReport === false && returnTo) navigate(returnTo, { replace: true });
        else setResult(response.result);
      }
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
          {attempt?.showResultsReport !== false ? (
            <>
              <div className="mt-5 text-5xl font-black">{result.score.toFixed(1)}%</div>
              <p className="mt-3 font-bold">
                {result.correctAnswers} صحيحة · {result.wrongAnswers} خاطئة · {result.unanswered} بدون إجابة
              </p>
            </>
          ) : (
            <p className="mt-5 font-bold text-gray-600">تم تسجيل إكمال الاختبار.</p>
          )}
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            {returnTo ? (
              <Link to={returnTo} className="rounded-xl border px-4 py-2.5 font-black text-slate-700">
                العودة لموضوع التأسيس
              </Link>
            ) : null}
            <Link
              to={`/assessment-results/${result.attemptId}`}
              className="rounded-xl bg-slate-950 px-4 py-2.5 font-black text-white"
            >
              عرض النتيجة والمراجعة
            </Link>
            <Link to="/assessment-results" className="rounded-xl border px-4 py-2.5 font-black text-slate-700">
              سجل النتائج
            </Link>
          </div>
        </section>
      </main>
    );
  }
  if (!user) {
    return (
      <main dir="rtl" className="mx-auto max-w-xl p-8 text-center">
        <div className="rounded-3xl border border-indigo-100 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Lock size={26} />
          </div>
          <h2 className="text-xl font-black text-slate-900">سجّل الدخول لبدء التدريب أو الاختبار</h2>
          <p className="mt-2 text-sm text-slate-500 font-bold leading-6">
            تسجيل الدخول مطلوب لحفظ إجاباتك ورصد نتيجتك وتحليل أدائك في تقارير المنصة.
          </p>
          <Link
            to={`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-black text-white hover:bg-indigo-700 transition shadow-xs"
          >
            <span>تسجيل الدخول الآن</span>
          </Link>
        </div>
      </main>
    );
  }
  if (!attempt || !question) {
    return <main className="p-10 text-center font-black">لا توجد أسئلة متاحة.</main>;
  }

  return (
    <main
      dir="rtl"
      className={`min-h-screen transition-colors ${
        isNightMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
      } p-3 sm:p-5`}
    >
      <div className="mx-auto max-w-4xl space-y-4">
        {/* Sticky Header with Navigation and Mode Toggle */}
        <header
          className={`sticky top-3 z-30 rounded-2xl border p-4 shadow-sm backdrop-blur-md transition-colors ${
            isNightMode ? 'border-slate-800 bg-slate-900/90 text-white' : 'border-slate-200 bg-white/90 text-slate-900'
          }`}
        >
          {returnTo ? (
            <Link
              to={returnTo}
              className={`mb-3 inline-block rounded-xl border px-3.5 py-1.5 text-xs font-bold transition ${
                isNightMode
                  ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700'
                  : 'border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200'
              }`}
            >
              العودة لموضوع التأسيس
            </Link>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-amber-500">اختبار جاري</p>
                {sectionGroups.length > 1 && currentSection ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-black text-indigo-400">
                    <Lock size={11} />
                    {currentSection.title} من {sectionGroups.length}
                  </span>
                ) : null}
              </div>
              <h1 className="text-lg font-black">{attempt.title}</h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Day / Night Toggle */}
              <button
                type="button"
                onClick={toggleNightMode}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition ${
                  isNightMode
                    ? 'border-slate-700 bg-slate-800 text-amber-300 hover:bg-slate-700'
                    : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title="تبديل الوضع الليلي / النهاري"
              >
                {isNightMode ? <Sun size={15} /> : <Moon size={15} />}
                <span>{isNightMode ? 'نهاري' : 'ليلي'}</span>
              </button>

              {/* Section Timer Pill (Qiyas Strict Mode) */}
              {sectionSecondsLeft != null && (
                <div
                  className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 font-mono text-xs font-black transition-colors ${
                    sectionSecondsLeft < 180
                      ? 'border-rose-400 bg-rose-50 text-rose-700 animate-pulse'
                      : isNightMode
                      ? 'border-indigo-800 bg-indigo-950 text-indigo-300'
                      : 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  }`}
                  title="مؤقت القسم الحالي وفق معايير قياس"
                >
                  <Clock3 size={15} />
                  <span>متبقي للقسم: {formatTimerCountdown(sectionSecondsLeft)}</span>
                </div>
              )}

              {/* Overall Timer Pill */}
              <div
                className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 font-mono text-xs font-black transition-colors ${
                  secondsLeft != null && secondsLeft < 180
                    ? 'border-rose-400 bg-rose-50 text-rose-700 animate-pulse'
                    : isNightMode
                    ? 'border-slate-700 bg-slate-800 text-amber-300'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                <Clock3 size={15} />
                <span>
                  {secondsLeft != null
                    ? `متبقي: ${formatTimerCountdown(secondsLeft)}`
                    : `الوقت: ${formatTimerCountdown(elapsedSeconds)}`}
                </span>
              </div>

              {/* Review Flag Button */}
              {attempt.allowQuestionReview ? (
                <button
                  type="button"
                  disabled={savingAnswer || busy || draftChoice?.attemptId === attempt.id || saved?.selectedOptionIndex == null}
                  onClick={() => void toggleReview()}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition disabled:opacity-40 ${
                    saved?.markedForReview
                      ? 'border-amber-400 bg-amber-400 text-slate-950 shadow-xs'
                      : isNightMode
                      ? 'border-slate-700 bg-slate-800 text-amber-300 hover:bg-slate-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  <Star size={14} className={saved?.markedForReview ? 'fill-current' : ''} />
                  <span>{saved?.markedForReview ? 'معلّم للمراجعة' : 'مراجعة لاحقاً'}</span>
                </button>
              ) : null}

              {/* End/Submit Button */}
              <button
                type="button"
                onClick={() => setShowConfirmSubmit(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-white hover:bg-amber-600 shadow-xs"
              >
                <Send size={14} />
                <span>إنهاء الاختبار</span>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          {attempt.showProgressBar ? (
            <div className={`mt-3 h-2 overflow-hidden rounded-full ${isNightMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${((index + 1) / attempt.questions.length) * 100}%` }}
              />
            </div>
          ) : null}
        </header>

        {error ? <div className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700 text-xs">{error}</div> : null}
        {sectionNotice ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 font-black text-amber-900 text-xs flex items-center justify-between shadow-xs">
            <span>{sectionNotice}</span>
            <button
              type="button"
              onClick={() => setSectionNotice('')}
              className="rounded-lg p-1 text-amber-800 hover:text-amber-950 font-black cursor-pointer"
            >
              ✕
            </button>
          </div>
        ) : null}

        {/* Question Area Card */}
        <section
          className={`rounded-3xl border p-5 sm:p-7 shadow-xs transition-colors ${
            isNightMode ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'
          }`}
        >
          <div className="mb-4 flex items-center justify-between text-xs font-bold text-slate-500">
            <span>
              {question.learnerPresentation?.showQuestionNumber !== false
                ? `السؤال ${index + 1} من ${attempt.questions.length}`
                : ''}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 font-bold ${
                saved?.selectedOptionIndex != null
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {saved?.selectedOptionIndex != null ? 'تمت الإجابة' : 'لم تُجب بعد'}
            </span>
          </div>

          {question.passage ? (
            <div
              className={`mb-4 rounded-2xl border p-4 text-xs leading-relaxed ${
                isNightMode
                  ? 'border-slate-700 bg-slate-800 text-slate-200'
                  : 'border-amber-200 bg-amber-50/70 text-amber-950'
              }`}
            >
              <div className="mb-2 flex items-center gap-1.5 font-black text-amber-600">
                <BookOpen size={15} />
                <span>قطعة استيعاب المقروء:</span>
              </div>
              <p className="whitespace-pre-line text-sm font-medium leading-relaxed">{question.passage}</p>
            </div>
          ) : null}

          {/* نص السؤال يظهر فقط إذا لم يكن السؤال معتمداً كلياً على الصورة أو إذا لم تكن هناك صورة */}
          {!imageEmbeddedOptions && question.text ? (
            <h2
              className="text-base sm:text-lg font-black leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: formatQuestionHtmlForDisplay(question.text),
              }}
            />
          ) : !hasImage ? (
            <h2 className="text-base font-black">{question.text || 'سؤال بصري'}</h2>
          ) : null}

          {/* صورة السؤال المعتمدة مع إمكانية التكبير */}
          {hasImage ? (
            <div
              className={`my-4 overflow-hidden rounded-2xl border p-3 text-center ${
                isNightMode ? 'border-slate-800 bg-black' : 'border-slate-100 bg-slate-50'
              }`}
            >
              <button
                type="button"
                onClick={() => setZoomImageUrl(resolvedImageUrl || null)}
                className="group relative block w-full cursor-zoom-in"
                title="اضغط لتكبير الصورة وفحص الرسم البياني أو الهندسي"
              >
                {resolvedImageUrl ? (
                  <img
                    src={resolvedImageUrl}
                    alt={question.imageAlt || 'صورة السؤال'}
                    className="mx-auto max-h-[380px] sm:max-h-[460px] w-full object-contain rounded-xl transition-transform duration-200 group-hover:scale-[1.01]"
                  />
                ) : question.imageAssetId ? (
                  <QuestionAssetImage
                    assetId={question.imageAssetId}
                    alt={question.imageAlt || 'صورة السؤال'}
                    onZoom={setZoomImageUrl}
                  />
                ) : null}
              </button>
              <div className="mt-2 flex items-center justify-center">
                <span className="text-[11px] font-bold text-slate-400">اضغط على الصورة للتكبير الكامل 🔍</span>
              </div>
            </div>
          ) : null}

          {/* 4-Grid Responsive Option Cards (1:1 with Legacy) */}
          <div
            className={`mt-6 grid gap-3 ${
              imageEmbeddedOptions
                ? 'grid-cols-4'
                : getQuizOptionGridClass(question.options)
            }`}
          >
            {question.options.map((option) => {
              const isSelected =
                (draftChoice?.attemptId === attempt.id && draftChoice.questionId === question.id
                  ? draftChoice.option
                  : saved?.selectedOptionIndex) === option.index;

              return (
                <div key={option.index}>
                  <button
                    type="button"
                    disabled={savingAnswer || busy}
                    onClick={() => void choose(option.index)}
                    className={`${imageEmbeddedOptions ? 'min-h-[58px] sm:min-h-[64px]' : 'min-h-[76px]'} w-full rounded-2xl border-2 px-4 py-3 text-right transition-all flex flex-col justify-center ${
                      isSelected
                        ? isNightMode
                          ? 'border-indigo-400 bg-indigo-500/25 text-white ring-2 ring-indigo-400/40'
                          : 'border-indigo-600 bg-indigo-50/90 text-indigo-900 ring-2 ring-indigo-200 shadow-xs'
                        : isNightMode
                        ? 'border-slate-700 bg-slate-800 text-slate-100 hover:border-indigo-400 hover:bg-slate-700/60'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex h-full items-center justify-between gap-2.5">
                      <span className="min-w-0 flex-1 text-sm font-black leading-6">
                        {question.learnerPresentation?.showOptionLabels !== false ? (
                          <span
                            className={`ml-2 inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : isNightMode
                                ? 'bg-slate-700 text-slate-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {optionLabel(
                              option.index,
                              question.learnerPresentation,
                              imageEmbeddedOptions ? option.text : undefined,
                              isTahsili,
                            )}
                          </span>
                        ) : null}
                        {showOptionText(question.learnerPresentation, imageEmbeddedOptions) ? option.text : ''}
                      </span>

                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : isNightMode
                            ? 'border-slate-500'
                            : 'border-slate-300'
                        }`}
                      >
                        {isSelected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                      </span>
                    </div>
                    {!imageEmbeddedOptions && option.assetId ? (
                      <span className="mt-2 block w-full rounded-xl border bg-slate-50 p-3">
                        <QuestionAssetImage
                          assetId={option.assetId}
                          alt={`صورة الاختيار ${['أ', 'ب', 'ج', 'د', 'هـ'][option.index] || option.index + 1}`}
                          showRetryButton={false}
                          onZoom={setZoomImageUrl}
                        />
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Question Navigation Ribbon & Prev/Next Bar (1:1 with Legacy) */}
        <footer
          className={`rounded-2xl border p-4 shadow-sm flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between transition-colors ${
            isNightMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
          }`}
        >
          <button
            type="button"
            disabled={index === 0 || savingAnswer || busy || draftChoice?.attemptId === attempt.id}
            onClick={() => navigateToQuestion(Math.max(0, index - 1))}
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-5 py-2.5 text-xs font-black transition disabled:opacity-40 ${
              isNightMode
                ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ArrowRight size={16} />
            <span>السابق</span>
          </button>

          {/* Question Number Ribbon (1:1 with Legacy + Strict Section Locks) */}
          <div className="flex max-w-full gap-1 overflow-x-auto px-2 py-1 lg:max-w-[60%] scrollbar-thin">
            {attempt.questions.map((q, idx) => {
              const isCurrent = index === idx;
              const isAnswered = answers.has(q.id);
              const isReview = answers.get(q.id)?.markedForReview;
              const isLocked = Boolean(q.sectionId && lockedSectionIds.has(q.sectionId));

              return (
                <button
                  key={q.id}
                  type="button"
                  disabled={isLocked}
                  onClick={() => navigateToQuestion(idx)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black transition-all ${
                    isLocked
                      ? 'border border-slate-300 bg-slate-200 text-slate-400 opacity-60 cursor-not-allowed dark:border-slate-800 dark:bg-slate-800 dark:text-slate-600'
                      : isCurrent
                      ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-400'
                      : isReview
                      ? 'border border-amber-300 bg-amber-100 text-amber-800 shadow-2xs'
                      : isAnswered
                      ? 'border border-emerald-300 bg-emerald-100 text-emerald-700 shadow-2xs'
                      : isNightMode
                      ? 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                  title={isLocked ? `السؤال ${idx + 1} (قسم مغلق)` : `السؤال ${idx + 1}`}
                >
                  {isLocked ? <Lock size={12} /> : idx + 1}
                </button>
              );
            })}
          </div>

          {isLastQuestionInSection && hasNextSection ? (
            <button
              type="button"
              disabled={
                savingAnswer ||
                busy ||
                draftChoice?.attemptId === attempt.id ||
                (attempt.requireAnswerBeforeNext && !saved)
              }
              onClick={() => setShowSectionConfirmModal(true)}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-black text-white hover:bg-amber-700 transition disabled:opacity-40 shadow-xs"
            >
              <span>إنهاء {currentSection?.title} والانتقال للقسم التالي</span>
              <ArrowLeft size={16} />
            </button>
          ) : (
            <button
              type="button"
              disabled={
                savingAnswer ||
                busy ||
                draftChoice?.attemptId === attempt.id ||
                index === attempt.questions.length - 1 ||
                (attempt.requireAnswerBeforeNext && !saved)
              }
              onClick={() => navigateToQuestion(index + 1)}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-black text-white hover:bg-indigo-700 transition disabled:opacity-40 shadow-xs"
            >
              <span>التالي</span>
              <ArrowLeft size={16} />
            </button>
          )}
        </footer>
      </div>

      {/* Confirmation Submit Modal (1:1 with Legacy) */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-black text-slate-900">هل أنت متأكد من تسليم الاختبار الآن؟</h2>

            <div className="my-4 space-y-2 text-right">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs font-bold text-slate-700">
                <span>الأسئلة المجاب عليها:</span>
                <span className="font-black text-emerald-600">{answeredCount}</span>
              </div>
              {unansweredCount > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-rose-50 p-2.5 text-xs font-bold text-rose-700">
                  <span>أسئلة بدون إجابة:</span>
                  <span className="font-black">{unansweredCount}</span>
                </div>
              )}
              {markedForReviewCount > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-amber-50 p-2.5 text-xs font-bold text-amber-700">
                  <span>أسئلة معلّمة للمراجعة:</span>
                  <span className="font-black">{markedForReviewCount}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy}
                className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-black text-white hover:bg-indigo-700 shadow-sm"
              >
                نعم، قم بالتسليم
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-3 text-sm font-black text-slate-700 hover:bg-slate-200"
              >
                العودة للحل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Section Lock Modal (Qiyas Strict Section Lock) */}
      {showSectionConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <Lock size={30} />
            </div>
            <h2 className="text-xl font-black text-slate-900">هل أنت متأكد من إنهاء {currentSection?.title}؟</h2>
            <p className="mt-3 text-xs font-bold leading-relaxed text-slate-600">
              وفق المعايير الصارمة لاختبارات قياس المحاكية، سيتم <strong>قفل هذا القسم نهائياً</strong> ولن تتمكن من العودة لأسئلته أو مراجعتها بعد الانتقال.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (currentSection) {
                    setLockedSectionIds((prev) => new Set([...prev, currentSection.id]));
                  }
                  setShowSectionConfirmModal(false);
                  if (hasNextSection) {
                    const nextGroup = sectionGroups[currentSectionIdx + 1];
                    setIndex(nextGroup.indices[0]);
                    setSectionNotice(`🔒 تم قفل ${currentSection?.title} والانتقال إلى ${nextGroup.title}.`);
                  }
                }}
                className="flex-1 rounded-xl bg-amber-600 py-3 text-sm font-black text-white hover:bg-amber-700 shadow-sm"
              >
                نعم، اقفل القسم وانتقل
              </button>
              <button
                type="button"
                onClick={() => setShowSectionConfirmModal(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-3 text-sm font-black text-slate-700 hover:bg-slate-200"
              >
                البقاء في القسم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Image Pan & Zoom Modal */}
      <QuestionImageZoomModal
        imageUrl={zoomImageUrl}
        onClose={() => setZoomImageUrl(null)}
        altText="تكبير صورة المسألة"
      />
    </main>
  );
}
