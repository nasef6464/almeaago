import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  HelpCircle,
  Loader2,
  Lock,
  Menu,
  Moon,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  ShoppingCart,
  Sun,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import type {
  LearnerCourse,
  LearnerLessonDetail,
  LearnerLessonSummary,
} from '../../content/api/content-types';
import { lessonProgressClient, type LessonProgress } from '../api/learning-client';

function flattenLessons(course: LearnerCourse | null) {
  if (!course) return [] as LearnerLessonSummary[];
  return course.modules.flatMap((module) => module.lessons);
}

function progressLabel(progress: LessonProgress | null) {
  if (!progress) return 'لم يبدأ بعد';
  if (progress.status === 'completed') return 'مكتمل';
  if (progress.status === 'in_progress') return `قيد التقدم · آخر موضع ${progress.positionSeconds} ثانية`;
  return 'لم يبدأ بعد';
}

export interface InteractiveVideoQuestion {
  id: string;
  timestamp: number;
  rewatchTimestamp: number;
  actionOnFail: 'continue' | 'rewatch';
  mustPass: boolean;
  inlineQuestion: {
    text: string;
    options: string[];
    correctOptionIndex: number;
  };
}

function getYouTubeVideoId(rawUrl?: string | null) {
  if (!rawUrl) return '';
  const trimmedUrl = rawUrl.trim();
  try {
    const url = new URL(trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      return url.pathname.split('/').filter(Boolean)[0] || '';
    }
    if (host.includes('youtube.com')) {
      return (
        url.searchParams.get('v') ||
        url.pathname.match(/\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] ||
        ''
      );
    }
  } catch {
    return '';
  }
  return '';
}

function VideoQuestionOverlay({
  question,
  onAnswer,
  onSkip,
}: {
  question: InteractiveVideoQuestion;
  onAnswer: (isCorrect: boolean) => void;
  onSkip: () => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);

  const handleSelect = (idx: number) => {
    setSelectedIdx(idx);
    const isCorrect = idx === question.inlineQuestion.correctOptionIndex;
    if (isCorrect) {
      setFeedback({ isCorrect: true, message: 'إجابة صحيحة وممتازة! أحسنت.' });
      setTimeout(() => {
        onAnswer(true);
      }, 1000);
    } else {
      if (question.actionOnFail === 'rewatch') {
        const rewatchMin = Math.floor(question.rewatchTimestamp / 60);
        const rewatchSec = String(question.rewatchTimestamp % 60).padStart(2, '0');
        setFeedback({
          isCorrect: false,
          message: `إجابة غير صحيحة. سيتم الرجوع إلى الدقيقة ${rewatchMin}:${rewatchSec} لمراجعة الشرح.`,
        });
        setTimeout(() => {
          onAnswer(false);
        }, 2200);
      } else {
        setFeedback({
          isCorrect: false,
          message: question.mustPass
            ? 'إجابة غير صحيحة. يجب اختيار الإجابة الصحيحة للاستمرار.'
            : 'إجابة غير صحيحة. يمكنك المحاولة مجددًا أو المتابعة.',
        });
      }
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-xl rounded-3xl border border-indigo-200/40 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
            <HelpCircle size={14} />
            سؤال تفاعلي أثناء الدرس
          </span>
          <span className="text-xs font-bold text-slate-500">
            {Math.floor(question.timestamp / 60)}:{String(question.timestamp % 60).padStart(2, '0')}
          </span>
        </div>

        <h3 className="mb-4 text-base font-black leading-relaxed text-slate-900 dark:text-white">
          {question.inlineQuestion.text}
        </h3>

        <div className="space-y-2.5">
          {question.inlineQuestion.options.map((option, idx) => {
            const isSelected = selectedIdx === idx;
            const isCorrect = idx === question.inlineQuestion.correctOptionIndex;
            let btnClass = 'border-slate-200 bg-slate-50 hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-200';
            if (selectedIdx !== null) {
              if (isSelected && isCorrect) {
                btnClass = 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200';
              } else if (isSelected && !isCorrect) {
                btnClass = 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200';
              }
            }
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(idx)}
                disabled={Boolean(feedback?.isCorrect)}
                className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-right text-sm font-bold transition ${btnClass}`}
              >
                <span>{option}</span>
                {isSelected && isCorrect ? <CheckCircle2 size={18} className="shrink-0 text-emerald-600" /> : null}
                {isSelected && !isCorrect ? <X size={18} className="shrink-0 text-rose-600" /> : null}
              </button>
            );
          })}
        </div>

        {feedback ? (
          <div className={`mt-4 rounded-xl p-3 text-xs font-bold leading-6 ${
            feedback.isCorrect
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
          }`}>
            {feedback.message}
          </div>
        ) : null}

        {!question.mustPass && !feedback?.isCorrect ? (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onSkip}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              متابعة بدون إجابة الآن
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CourseLearningPage() {
  const { courseId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, getCsrfToken } = useAuth();

  const [course, setCourse] = useState<LearnerCourse | null>(null);
  const [lessonId, setLessonId] = useState(searchParams.get('lesson') || '');
  const [detail, setDetail] = useState<LearnerLessonDetail | null>(null);
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [loadedScope, setLoadedScope] = useState('');
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonRetry, setLessonRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return localStorage.getItem('course_player_night_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1024,
  );
  const [expandedModules, setExpandedModules] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSaved = useRef(0);

  // Interactive Video state
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(() => new Set());
  const [activeInteractiveQuestion, setActiveInteractiveQuestion] = useState<InteractiveVideoQuestion | null>(null);

  const lessons = useMemo(() => flattenLessons(course), [course]);
  const selectedSummary = lessons.find((item) => item.id === lessonId) || null;
  const selectedIndex = lessons.findIndex((item) => item.id === lessonId);
  const previousLesson = selectedIndex > 0 ? lessons[selectedIndex - 1] : null;
  const nextLesson = selectedIndex >= 0 ? lessons[selectedIndex + 1] || null : null;
  const context = useMemo(
    () => ({ contextType: 'course' as const, courseId, topicId: '' }),
    [courseId],
  );
  const selectedScope = `${courseId}:${lessonId}`;
  const selectedScopeRef = useRef(selectedScope);
  selectedScopeRef.current = selectedScope;
  // A canonical lesson can be reused in several courses. Match both context and lesson.
  const activeDetail = loadedScope === selectedScope ? detail : null;
  const activeProgress = loadedScope === selectedScope ? progress : null;

  const interactiveQuestions = useMemo<InteractiveVideoQuestion[]>(() => {
    if (!activeDetail || activeDetail.type !== 'video' || !activeDetail.contentText) {
      return [];
    }
    try {
      const parsed = JSON.parse(activeDetail.contentText);
      if (Array.isArray(parsed.interactiveQuestions)) {
        return parsed.interactiveQuestions;
      }
    } catch {
      // plain text content
    }
    return [];
  }, [activeDetail]);

  const lessonTextDescription = useMemo(() => {
    if (!activeDetail?.contentText) return '';
    try {
      const parsed = JSON.parse(activeDetail.contentText);
      if (typeof parsed.text === 'string') return parsed.text;
    } catch {
      return activeDetail.contentText;
    }
    return '';
  }, [activeDetail]);

  function handleInteractiveAnswer(isCorrect: boolean) {
    if (!activeInteractiveQuestion) return;
    const currentQ = activeInteractiveQuestion;
    if (isCorrect || !currentQ.mustPass) {
      setAnsweredQuestionIds((prev) => new Set(prev).add(currentQ.id));
    }
    if (!isCorrect && currentQ.actionOnFail === 'rewatch') {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, currentQ.rewatchTimestamp || 0);
      }
    }
    setActiveInteractiveQuestion(null);
    if (isCorrect || (!isCorrect && currentQ.actionOnFail === 'rewatch')) {
      videoRef.current?.play().catch(() => {});
    }
  }

  function handleInteractiveSkip() {
    if (!activeInteractiveQuestion || activeInteractiveQuestion.mustPass) return;
    const currentQ = activeInteractiveQuestion;
    setAnsweredQuestionIds((prev) => new Set(prev).add(currentQ.id));
    setActiveInteractiveQuestion(null);
    videoRef.current?.play().catch(() => {});
  }

  useEffect(() => {
    try {
      localStorage.setItem('course_player_night_mode', String(isDarkMode));
    } catch {
      // Browser preference persistence is best-effort presentation state.
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (authLoading || !user || !courseId) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');

    contentClient.learnerCourse(courseId, controller.signal)
      .then((result) => {
        setCourse(result.course);
        const allLessons = result.course.modules.flatMap((module) => module.lessons);
        const requested = searchParams.get('lesson');
        const firstAvailable =
          allLessons.find((item) => item.id === requested && ((!item.isLocked && !item.commerceLocked) || item.isPreview)) ||
          allLessons.find((item) => (!item.isLocked && !item.commerceLocked) || item.isPreview);

        const owningModule = firstAvailable
          ? result.course.modules.find((module) => module.lessons.some((item) => item.id === firstAvailable.id))
          : result.course.modules.find((module) => module.lessons.length > 0);
        if (owningModule) setExpandedModules([owningModule.id]);
        if (firstAvailable) setLessonId(firstAvailable.id);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'تعذر تحميل الدورة');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [authLoading, courseId, searchParams, user]);

  useEffect(() => {
    // Do not fetch or expose a lesson before the owning course has been loaded.
    if (!lessonId || !courseId || course?.id !== courseId || !selectedSummary) return;
    setLoadedScope('');
    setDetail(null);
    setProgress(null);
    setNotice('');
    setError('');

    if ((selectedSummary.isLocked || selectedSummary.commerceLocked) && !selectedSummary.isPreview) {
      setLessonLoading(false);
      return;
    }

    const controller = new AbortController();
    const requestScope = `${courseId}:${lessonId}`;
    setLessonLoading(true);
    Promise.all([
      contentClient.learnerCourseLesson(courseId, lessonId, controller.signal),
      lessonProgressClient.get(lessonId, context, controller.signal),
    ])
      .then(([lessonResult, progressResult]) => {
        if (controller.signal.aborted || selectedScopeRef.current !== requestScope) return;
        // Content access is already decided by the course/lesson API. An
        // incorrectly scoped progress payload must never replace this lesson's
        // progress, but must not hide an otherwise accessible lesson body.
        if (lessonResult.lesson.id.toLowerCase() !== lessonId.toLowerCase()) {
          setError('تعذر التحقق من سياق الدرس. أعد المحاولة.');
          return;
        }
        const scopedProgress =
          progressResult.progress.lessonId.toLowerCase() === lessonId.toLowerCase() &&
          progressResult.progress.contextType === 'course' &&
          progressResult.progress.courseId.toLowerCase() === courseId.toLowerCase()
            ? progressResult.progress
            : null;
        setDetail(lessonResult.lesson);
        setProgress(scopedProgress);
        setLoadedScope(requestScope);
        lastSaved.current = scopedProgress?.positionSeconds || 0;
        if (!scopedProgress) {
          setNotice('تعذر التحقق من تقدم هذا الدرس؛ لم تُعرض بيانات درس آخر.');
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted && selectedScopeRef.current === requestScope) {
          setError(reason instanceof Error ? reason.message : 'تعذر تحميل الدرس');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && selectedScopeRef.current === requestScope) {
          setLessonLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    context,
    course?.id,
    courseId,
    lessonId,
    lessonRetry,
    selectedSummary?.commerceLocked,
    selectedSummary?.isLocked,
    selectedSummary?.isPreview,
  ]);

  useEffect(() => {
    if (!lessonId) return;
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('learn', '1');
      next.set('lesson', lessonId);
      return next;
    }, { replace: true });
  }, [lessonId, setSearchParams]);

  async function persistVideoPosition(position: number, quiet = false) {
    if (!activeDetail || activeDetail.type !== 'video' || saving) return;
    const writeScope = selectedScope;
    const seconds = Math.max(0, Math.floor(position || 0));
    if (Math.abs(seconds - lastSaved.current) < 1) return;

    setSaving(true);
    try {
      const csrf = await getCsrfToken();
      const result = await lessonProgressClient.saveVideo(activeDetail.id, context, seconds, csrf);
      if (selectedScopeRef.current === writeScope) {
        setProgress(result.progress);
        lastSaved.current = result.progress.positionSeconds;
        if (!quiet) setNotice('تم حفظ موضع المشاهدة.');
      }
    } catch (reason) {
      if (!quiet && selectedScopeRef.current === writeScope) {
        setError(reason instanceof Error ? reason.message : 'تعذر حفظ موضع المشاهدة');
      }
    } finally {
      setSaving(false);
    }
  }

  function onTimeUpdate() {
    const currentTime = videoRef.current?.currentTime || 0;
    const current = Math.floor(currentTime);
    if (current - lastSaved.current >= 15) {
      void persistVideoPosition(current, true);
    }

    if (interactiveQuestions.length > 0 && !activeInteractiveQuestion) {
      const due = interactiveQuestions.find(
        (q) => !answeredQuestionIds.has(q.id) && Math.abs(currentTime - q.timestamp) <= 1.5,
      );
      if (due) {
        videoRef.current?.pause();
        setActiveInteractiveQuestion(due);
      }
    }
  }

  async function complete() {
    if (!activeDetail || saving) return;
    const writeScope = selectedScope;
    setError('');

    try {
      if (activeDetail.type === 'video' && videoRef.current) {
        await persistVideoPosition(videoRef.current.currentTime, true);
      }
      // The learner may have selected another lesson while CSRF/video save was pending.
      if (selectedScopeRef.current !== writeScope) return;
      setSaving(true);
      const csrf = await getCsrfToken();
      if (selectedScopeRef.current !== writeScope) return;
      const result = await lessonProgressClient.complete(activeDetail.id, context, csrf);
      if (selectedScopeRef.current === writeScope) {
        setProgress(result.progress);
        setNotice('تم تسجيل الدرس كمكتمل.');
      }
    } catch (reason) {
      if (selectedScopeRef.current === writeScope) {
        setError(reason instanceof Error ? reason.message : 'تعذر إكمال الدرس');
      }
    } finally {
      setSaving(false);
    }
  }

  function selectLesson(lesson: LearnerLessonSummary | null) {
    if (!lesson) return;
    const locked = (lesson.isLocked || lesson.commerceLocked) && !lesson.isPreview;
    if (locked) return;
    setLoadedScope('');
    setLessonId(lesson.id);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }

  useEffect(
    () => () => {
      const video = videoRef.current;
      if (
        video &&
        detail?.type === 'video' &&
        Math.abs(Math.floor(video.currentTime) - lastSaved.current) >= 1
      ) {
        void persistVideoPosition(video.currentTime, true);
      }
    },
    [detail],
  );

  if (authLoading || loading) {
    return <main className="p-10 text-center font-black">جاري تحميل الدورة...</main>;
  }

  if (!user || !user.roles.includes('student')) {
    return <main className="p-10 text-center font-black text-rose-700">هذه الشاشة مخصصة للطالب.</main>;
  }

  if (error && !course) {
    return <main className="p-10 text-center font-black text-rose-700">{error}</main>;
  }

  if (!course) {
    return <main className="p-10 text-center font-black">الدورة غير متاحة.</main>;
  }

  const totalLessons = lessons.length;
  const currentNumber = selectedIndex >= 0 ? selectedIndex + 1 : 0;
  const lockedCurrent =
    (selectedSummary?.isLocked || selectedSummary?.commerceLocked) && !selectedSummary?.isPreview;

  return (
    <main
      dir="rtl"
      data-testid="legacy-course-player"
      className={`min-h-screen transition-colors duration-300 ${
        isDarkMode ? 'bg-[#0f172a] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <header
        className={`sticky top-0 z-40 flex h-16 items-center justify-between border-b px-3 shadow-sm sm:px-4 md:px-6 ${
          isDarkMode ? 'border-slate-800 bg-[#1e293b]' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => {
              if (courseId) {
                navigate(`/course/${courseId}`);
              } else {
                navigate('/learning');
              }
            }}
            className={`rounded-xl p-2 transition-colors ${
              isDarkMode
                ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
            aria-label="الرجوع لتفاصيل الدورة"
          >
            <ArrowRight size={20} />
          </button>
          <div className="hidden min-w-0 md:block">
            <h1 className={`max-w-md truncate text-base font-black lg:text-lg ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              {course.title}
            </h1>
            <p className={`mt-0.5 text-[11px] font-bold ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {currentNumber > 0 ? `الدرس ${currentNumber} من ${totalLessons}` : `${totalLessons} درس`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDarkMode((value) => !value)}
            className={`rounded-xl p-2.5 transition-all ${
              isDarkMode
                ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
            }`}
            aria-label={isDarkMode ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            type="button"
            onClick={() => setIsSidebarOpen((value) => !value)}
            className={`rounded-xl p-2.5 lg:hidden ${
              isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 shadow-sm'
            }`}
            aria-label={isSidebarOpen ? 'إغلاق قائمة الدروس' : 'فتح قائمة الدروس'}
          >
            {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <div className="relative mx-auto flex max-w-[1500px]">
        {isSidebarOpen ? (
          <button
            type="button"
            aria-label="إغلاق خلفية قائمة الدروس"
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 top-16 z-20 bg-black/40 lg:hidden"
          />
        ) : null}

        <aside
          className={`fixed bottom-0 right-0 top-16 z-30 w-[88vw] max-w-[340px] overflow-y-auto border-l transition-transform duration-300 lg:sticky lg:top-16 lg:z-10 lg:h-[calc(100vh-4rem)] lg:w-[330px] lg:max-w-none lg:translate-x-0 ${
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          } ${
            isDarkMode ? 'border-slate-800 bg-[#111827]' : 'border-slate-200 bg-white'
          }`}
        >
          <div className={`border-b p-5 ${
            isDarkMode ? 'border-slate-800' : 'border-slate-100'
          }`}>
            <div className="text-[11px] font-black text-amber-500">محتوى الدورة</div>
            <h2 className={`mt-1 text-lg font-black ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {course.title}
            </h2>
            <p className={`mt-2 text-xs font-bold leading-6 ${
              isDarkMode ? 'text-slate-400' : 'text-gray-500'
            }`}>
              {course.instructorName || 'فريق المنصة'}
            </p>
          </div>

          <div>
            {course.modules.map((module) => {
              const expanded = expandedModules.includes(module.id);
              return (
                <section
                  key={module.id}
                  className={`border-b ${
                    isDarkMode ? 'border-slate-800' : 'border-slate-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedModules((current) =>
                        current.includes(module.id)
                          ? current.filter((id) => id !== module.id)
                          : [...current, module.id],
                      )
                    }
                    className={`flex w-full items-center justify-between gap-3 px-4 py-4 text-right ${
                      isDarkMode ? 'hover:bg-slate-800/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                        <BookOpen size={18} />
                      </div>
                      <div>
                        <div className={`text-sm font-black ${
                          isDarkMode ? 'text-slate-100' : 'text-gray-800'
                        }`}>
                          {module.title}
                        </div>
                        <div className={`mt-0.5 text-[10px] font-bold ${
                          isDarkMode ? 'text-slate-500' : 'text-gray-400'
                        }`}>
                          {module.lessons.length} درس
                        </div>
                      </div>
                    </div>
                    {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                  </button>

                  {expanded ? (
                    <div>
                      {module.lessons.map((lesson) => {
                        const locked = (lesson.isLocked || lesson.commerceLocked) && !lesson.isPreview;
                        const active = lesson.id === lessonId;
                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            disabled={locked}
                            onClick={() => selectLesson(lesson)}
                            className={`flex w-full items-center justify-between gap-3 border-t px-4 py-3 text-right transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                              isDarkMode ? 'border-slate-800' : 'border-slate-100'
                            } ${
                              active
                                ? isDarkMode
                                  ? 'bg-indigo-500/15 text-indigo-200'
                                  : 'bg-indigo-50 text-indigo-900'
                                : isDarkMode
                                  ? 'hover:bg-slate-800/70'
                                  : 'hover:bg-gray-50'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold">{lesson.title}</span>
                              <span className={`mt-1 block text-[10px] font-bold ${
                                isDarkMode ? 'text-slate-500' : 'text-gray-400'
                              }`}>
                                {lesson.type === 'video' ? 'درس فيديو' : 'محتوى تعليمي'}
                              </span>
                            </span>
                            {locked ? <Lock size={14} className="shrink-0 text-amber-500" /> : (
                              <PlayCircle size={15} className="shrink-0 text-indigo-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-3 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl space-y-4">
            <div
              className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${
                isDarkMode ? 'border-slate-800 bg-[#1e293b]' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[11px] font-black text-indigo-500">
                    {course.title}
                  </div>
                  <h2 className={`mt-1 text-xl font-black sm:text-2xl ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {activeDetail?.title || selectedSummary?.title || 'اختر درسًا'}
                  </h2>
                  <p className={`mt-1 text-xs font-bold ${
                    isDarkMode ? 'text-slate-400' : 'text-gray-500'
                  }`}>
                    {progressLabel(activeProgress)}
                  </p>
                </div>

                {activeProgress?.status === 'completed' ? (
                  <span className="inline-flex items-center gap-1 self-start rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                    <CheckCircle2 size={15} />
                    مكتمل
                  </span>
                ) : null}
              </div>
            </div>

            {error ? (
              <div className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}</div>
            ) : null}
            {notice ? (
              <div className="rounded-xl bg-emerald-50 p-3 font-bold text-emerald-700">{notice}</div>
            ) : null}

            {!course.access.allowed ? (
              <div
                data-testid="course-commerce-lock"
                className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-900"
              >
                <div>
                  {course.access.configured
                    ? 'هذه الدورة مدفوعة وتحتاج صلاحية وصول فعالة. يمكنك مشاهدة المعاينات المجانية فقط.'
                    : 'سياسة الوصول التجارية لهذه الدورة غير مكتملة؛ تم قفل المحتوى غير المجاني احترازيًا.'}
                </div>
                {course.access.configured && course.access.productId ? (
                  <Link
                    to={`/checkout?productId=${encodeURIComponent(course.access.productId)}`}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 font-black text-slate-950"
                  >
                    <ShoppingCart size={17} />
                    شراء الوصول
                  </Link>
                ) : null}
              </div>
            ) : null}

            {lockedCurrent ? (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 font-bold text-amber-900">
                {selectedSummary?.commerceLocked
                  ? 'هذا الدرس يحتاج شراءً أو منحة وصول فعالة من Commerce.'
                  : 'هذا الدرس مقفول بسياسة المحتوى الحالية.'}
              </div>
            ) : activeDetail ? (
              <>
                <article
                  className={`overflow-hidden rounded-3xl border shadow-sm ${
                    isDarkMode ? 'border-slate-800 bg-[#1e293b]' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className={`relative flex min-h-56 items-center justify-center sm:min-h-72 ${
                    activeDetail.type === 'video' ? 'bg-black' : isDarkMode ? 'bg-slate-900' : 'bg-slate-100'
                  }`}>
                    {activeDetail.type === 'video' && getYouTubeVideoId(activeDetail.videoUrl) ? (
                      <div className="relative aspect-video w-full overflow-hidden bg-black">
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${getYouTubeVideoId(activeDetail.videoUrl)}?rel=0&modestbranding=1`}
                          title={activeDetail.title}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : activeDetail.type === 'video' && activeDetail.videoUrl ? (
                      <video
                        ref={videoRef}
                        data-testid="lesson-video"
                        src={activeDetail.videoUrl}
                        controls
                        className="aspect-video w-full bg-black"
                        onLoadedMetadata={() => {
                          const video = videoRef.current;
                          if (video && activeProgress?.positionSeconds && video.currentTime === 0) {
                            video.currentTime = Math.min(
                              activeProgress.positionSeconds,
                              Number.isFinite(video.duration) ? video.duration : activeProgress.positionSeconds,
                            );
                          }
                        }}
                        onTimeUpdate={onTimeUpdate}
                        onPause={() => {
                          const video = videoRef.current;
                          if (video) void persistVideoPosition(video.currentTime);
                        }}
                      />
                    ) : activeDetail.type === 'video' ? (
                      <div className="max-w-xl p-8 text-center text-white">
                        <PlayCircle className="mx-auto text-indigo-300" size={54} />
                        <h3 className="mt-4 text-lg font-black">لم يتم إرفاق رابط فيديو</h3>
                        <p className="mt-2 text-sm font-bold leading-7 text-slate-300">
                          يرجى التواصل مع إدارة المسار أو المدرب لإضافة محتوى الفيديو المعتمد لهذا الدرس.
                        </p>
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <BookOpen className="mx-auto text-indigo-500" size={48} />
                        <div className={`mt-3 text-sm font-black ${
                          isDarkMode ? 'text-slate-300' : 'text-gray-600'
                        }`}>
                          محتوى الدرس
                        </div>
                      </div>
                    )}

                    {activeInteractiveQuestion ? (
                      <VideoQuestionOverlay
                        question={activeInteractiveQuestion}
                        onAnswer={handleInteractiveAnswer}
                        onSkip={handleInteractiveSkip}
                      />
                    ) : null}
                  </div>

                  <div className="p-5 sm:p-6">
                    {interactiveQuestions.length > 0 ? (
                      <div className="mb-4 flex items-center gap-2 rounded-2xl bg-indigo-50/70 p-3 text-xs font-bold text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
                        <HelpCircle size={16} className="text-indigo-600 shrink-0" />
                        <span>
                          يحتوي هذا الدرس على {interactiveQuestions.length} سؤال تفاعلي يظهر تلقائيًا عند لحظات محددة من الشرح.
                        </span>
                      </div>
                    ) : null}

                    <p className={`text-sm font-medium leading-7 ${
                      isDarkMode ? 'text-slate-300' : 'text-gray-600'
                    }`}>
                      {activeDetail.description}
                    </p>

                    {lessonTextDescription ? (
                      <div className={`mt-4 whitespace-pre-wrap rounded-2xl p-4 text-sm leading-8 ${
                        isDarkMode ? 'bg-slate-900 text-slate-200' : 'bg-gray-50 text-gray-800'
                      }`}>
                        {lessonTextDescription}
                      </div>
                    ) : null}

                    {activeDetail.type === 'video' && activeDetail.videoSource === 'upload' && activeDetail.videoUrl ? (
                      <div className={`mt-4 flex items-center gap-2 text-xs font-bold ${
                        isDarkMode ? 'text-slate-400' : 'text-gray-500'
                      }`}>
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <PauseCircle size={15} />}
                        موضع الاستئناف يُحفظ دوريًا وعند الإيقاف. تغيير الموضع وحده لا يُكمل الدرس.
                      </div>
                    ) : null}

                    <div className={`mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4 ${
                      isDarkMode ? 'border-slate-800' : 'border-slate-100'
                    }`}>
                      <span className={`text-xs font-bold ${
                        isDarkMode ? 'text-slate-400' : 'text-gray-500'
                      }`}>
                        {activeDetail.durationSeconds > 0
                          ? `مدة مرجعية: ${activeDetail.durationSeconds} ثانية`
                          : 'بدون مدة محددة'}
                      </span>
                      <button
                        type="button"
                        disabled={saving || activeProgress?.status === 'completed'}
                        onClick={() => void complete()}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-black text-white transition hover:bg-emerald-700 disabled:opacity-45"
                      >
                        {saving ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
                        تحديد كمكتمل
                      </button>
                    </div>
                  </div>
                </article>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={!previousLesson || ((previousLesson.isLocked || previousLesson.commerceLocked) && !previousLesson.isPreview)}
                    onClick={() => selectLesson(previousLesson)}
                    className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black disabled:opacity-35 ${
                      isDarkMode
                        ? 'border-slate-800 bg-[#1e293b] text-slate-200'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <ArrowRight size={17} />
                    الدرس السابق
                  </button>
                  <button
                    type="button"
                    disabled={!nextLesson || ((nextLesson.isLocked || nextLesson.commerceLocked) && !nextLesson.isPreview)}
                    onClick={() => selectLesson(nextLesson)}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white disabled:opacity-35"
                  >
                    الدرس التالي
                    <ChevronLeft size={17} />
                  </button>
                </div>
              </>
            ) : (
              <div className={`rounded-2xl border border-dashed p-8 text-center font-bold ${
                isDarkMode
                  ? 'border-slate-700 bg-[#1e293b] text-slate-400'
                  : 'border-slate-200 bg-white text-gray-500'
              }`}>
                <p>{lessonLoading ? 'جاري تحميل الدرس...' : error ? 'لم يُحمّل هذا الدرس. يمكنك إعادة المحاولة.' : 'اختر درسًا متاحًا.'}</p>
                {!lessonLoading && error && selectedSummary ? (
                  <button
                    type="button"
                    onClick={() => setLessonRetry((value) => value + 1)}
                    className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white"
                  >
                    إعادة محاولة تحميل الدرس
                  </button>
                ) : null}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Link to="/review" className="inline-flex items-center gap-1 text-sm font-black text-indigo-600">
                المراجعة الذكية <ChevronLeft size={16} />
              </Link>
              <Link to="/plan" className="text-sm font-black text-amber-600">
                خطة الدراسة
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
