import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  Loader2,
  Lock,
  Menu,
  MessageSquare,
  Moon,
  PauseCircle,
  PlayCircle,
  Radio,
  RotateCcw,
  Send,
  Share2,
  ShoppingCart,
  Sparkles,
  Star,
  Sun,
  User,
  Video,
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
import { SharedVideoPlayer, type SharedVideoPlayerHandle } from '../components/SharedVideoPlayer';

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

// Interactive Video Question Contract
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

export function CourseLearningPage() {
  const { courseId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, getCsrfToken } = useAuth();

  const [course, setCourse] = useState<LearnerCourse | null>(null);
  // Keep the loaded course tied to its route, including during failed transitions.
  const [loadedCourseId, setLoadedCourseId] = useState('');
  const [courseError, setCourseError] = useState('');
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

  const videoRef = useRef<SharedVideoPlayerHandle | null>(null);
  const lastSaved = useRef(0);

  // Interactive Video state
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`almeaa_answered:${courseId}:${lessonId}`);
      if (stored) return new Set(JSON.parse(stored));
    } catch {}
    return new Set();
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`almeaa_answered:${courseId}:${lessonId}`);
      setAnsweredQuestionIds(stored ? new Set(JSON.parse(stored)) : new Set());
    } catch {
      setAnsweredQuestionIds(new Set());
    }
  }, [courseId, lessonId]);

  const lessons = useMemo(() => flattenLessons(course), [course]);
  const selectedSummary = lessons.find((item) => item.id === lessonId) || null;
  const selectedIndex = lessons.findIndex((item) => item.id === lessonId);
  const previousLesson = selectedIndex > 0 ? lessons[selectedIndex - 1] : null;
  const nextLesson = selectedIndex >= 0 ? lessons[selectedIndex + 1] || null : null;

  // Bottom Workspace State
  const [bottomTab, setBottomTab] = useState<'notes' | 'files' | 'qa' | 'assessments' | 'certificate'>('notes');
  const [newCommentText, setNewCommentText] = useState('');
  const [lessonComments, setLessonComments] = useState<Array<{ id: string; authorName: string; createdAt: string; text: string; isInstructor?: boolean }>>(() => {
    try {
      const stored = localStorage.getItem(`lesson_comments_${courseId}_${lessonId}`);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      {
        id: 'lc-1',
        authorName: 'سارة العتيبي',
        createdAt: 'منذ يومين',
        text: 'شرح ممتاز ومفهوم لجميع استراتيجيات هذا الدرس، جزاكم الله خيراً.',
      },
      {
        id: 'lc-2',
        authorName: 'فريق المنصة',
        createdAt: 'منذ يوم',
        text: 'أهلاً بك يا سارة، بالتوفيق لكِ دائماً، وفي حال واجهتِ أي صعوبة في المسائل يمكنكِ طرح سؤالكِ هنا.',
        isInstructor: true,
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(`lesson_comments_${courseId}_${lessonId}`, JSON.stringify(lessonComments));
    } catch {}
  }, [lessonComments, courseId, lessonId]);

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

  const parsedQuizInfo = useMemo(() => {
    if (!activeDetail) return null;
    if (activeDetail.type === 'quiz') {
      try {
        const obj = JSON.parse(activeDetail.contentText);
        return obj && typeof obj === 'object' && obj.quizId ? obj : { quizId: activeDetail.id };
      } catch {
        return { quizId: activeDetail.id };
      }
    }
    return null;
  }, [activeDetail]);

  const parsedMeetingInfo = useMemo(() => {
    if (!activeDetail) return null;
    const isLive = ['live_youtube', 'zoom', 'google_meet', 'teams'].includes(activeDetail.type);
    if (!isLive) return null;
    try {
      const obj = JSON.parse(activeDetail.contentText);
      return obj && typeof obj === 'object' ? obj : null;
    } catch {
      return null;
    }
  }, [activeDetail]);

  const coursePresentation = useMemo(() => {
    if (!course) return {} as any;
    try {
      const pres = (course as any).presentation;
      if (typeof pres === 'string') return JSON.parse(pres);
      if (typeof pres === 'object' && pres !== null) return pres;
    } catch {}
    return {} as any;
  }, [course]);

  const courseAssessmentsList = useMemo(() => {
    return Array.isArray(coursePresentation.assessments) ? coursePresentation.assessments : [];
  }, [coursePresentation]);

  const courseFilesList = useMemo(() => {
    return Array.isArray(coursePresentation.files) ? coursePresentation.files : [];
  }, [coursePresentation]);

  const completedLessonsCount = useMemo(() => {
    return lessons.filter((l: any) => l.completed || (l.id === lessonId && activeProgress?.status === 'completed')).length;
  }, [lessons, lessonId, activeProgress]);

  const completionPercent = useMemo(() => {
    if (!lessons.length) return 0;
    return Math.min(100, Math.round((completedLessonsCount / lessons.length) * 100));
  }, [completedLessonsCount, lessons.length]);

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

  const requiredVideoQuestionIds = useMemo(() => {
    if (!activeDetail || activeDetail.type !== 'video') return [];
    return interactiveQuestions.filter((q) => q.mustPass).map((q) => q.id);
  }, [activeDetail, interactiveQuestions]);

  const unansweredRequiredVideoQuestionIds = useMemo(() => {
    if (requiredVideoQuestionIds.length === 0) return [];
    return requiredVideoQuestionIds.filter((id) => !answeredQuestionIds.has(id));
  }, [answeredQuestionIds, requiredVideoQuestionIds]);

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

  const playerQuestions = useMemo(() => {
    return interactiveQuestions.map((q) => ({
      id: q.id,
      timestamp: q.timestamp,
      text: q.inlineQuestion.text,
      options: q.inlineQuestion.options,
      correctOptionIndex: q.inlineQuestion.correctOptionIndex,
      mustPass: q.mustPass,
      actionOnFail: q.actionOnFail,
      rewatchTimestamp: q.rewatchTimestamp,
    }));
  }, [interactiveQuestions]);

  function handleQuestionAnswered(questionId: string, isCorrect: boolean, allAnsweredIds: string[]) {
    const nextSet = new Set(allAnsweredIds);
    setAnsweredQuestionIds(nextSet);
    try {
      localStorage.setItem(`almeaa_answered:${courseId}:${lessonId}`, JSON.stringify(allAnsweredIds));
    } catch {}
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
    setCourse(null);
    setLoadedCourseId('');
    setCourseError('');
    setError('');
    setDetail(null);
    setProgress(null);
    setLoadedScope('');
    setLessonId(searchParams.get('lesson') || '');

    contentClient.learnerCourse(courseId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        // Never expose an unrelated course from a stale/malformed HTTP response.
        if (result.course.id.toLowerCase() !== courseId.toLowerCase()) {
          throw new Error('تعذر التحقق من سياق الدورة. أعد المحاولة.');
        }
        const allLessons = result.course.modules.flatMap((module) => module.lessons);
        const requested = searchParams.get('lesson');
        const firstAvailable =
          allLessons.find((item) => item.id === requested && ((!item.isLocked && !item.commerceLocked) || item.isPreview)) ||
          allLessons.find((item) => (!item.isLocked && !item.commerceLocked) || item.isPreview);

        const owningModule = firstAvailable
          ? result.course.modules.find((module) => module.lessons.some((item) => item.id === firstAvailable.id))
          : result.course.modules.find((module) => module.lessons.length > 0);
        setExpandedModules(owningModule ? [owningModule.id] : []);
        setLessonId(firstAvailable?.id || '');
        setCourse(result.course);
        setLoadedCourseId(courseId);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setCourseError(reason instanceof Error ? reason.message : 'تعذر تحميل الدورة');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // A lesson query update must not refetch the whole course or reset its progress.
  }, [authLoading, courseId, user?.id]);

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
    if (!lessonId || loadedCourseId !== courseId) return;
    const current = new URLSearchParams(window.location.search);
    if (current.get('learn') === '1' && current.get('lesson') === lessonId) return;
    const next = new URLSearchParams(current);
    next.set('learn', '1');
    next.set('lesson', lessonId);
    setSearchParams(next, { replace: true });
  }, [courseId, lessonId, loadedCourseId, setSearchParams]);

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

  function onTimeUpdate(currentTime: number) {
    const current = Math.floor(currentTime);
    if (current - lastSaved.current >= 15) {
      void persistVideoPosition(current, true);
    }
  }

  async function complete() {
    if (!activeDetail || saving) return;
    if (activeDetail.type === 'video' && unansweredRequiredVideoQuestionIds.length > 0) {
      setError(`يجب إجابة جميع الأسئلة الإلزامية داخل الفيديو لإكمال الدرس (${unansweredRequiredVideoQuestionIds.length} سؤال متبقٍ).`);
      return;
    }
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

  if (authLoading || (user && (loading || (loadedCourseId !== courseId && !courseError)))) {
    // Legacy CourseView uses a centered spinner, not a text placeholder.
    // Route ownership above keeps the previous course hidden during this state.
    return (
      <div data-testid="course-loading" className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user || !user.roles.includes('student')) {
    return <main className="p-10 text-center font-black text-rose-700">هذه الشاشة مخصصة للطالب.</main>;
  }

  if (courseError) {
    return (
      <main dir="rtl" className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <div className="max-w-md rounded-3xl border border-amber-100 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <AlertCircle size={32} />
          </div>
          <h1 className="mb-3 text-xl sm:text-2xl font-black leading-tight text-gray-900">لم نتمكن من فتح الدورة</h1>
          <p className="mb-6 text-sm leading-7 text-gray-500">{courseError}</p>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="w-full rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-black text-white hover:bg-indigo-700 sm:w-auto"
          >
            العودة للخلف
          </button>
        </div>
      </main>
    );
  }

  if (!course || loadedCourseId !== courseId) {
    return (
      <main dir="rtl" className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 leading-tight">الدورة غير متاحة حاليًا</h1>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold w-full sm:w-auto"
        >
          العودة للخلف
        </button>
      </main>
    );
  }

  const totalLessons = lessons.length;
  const currentNumber = selectedIndex >= 0 ? selectedIndex + 1 : 0;
  const lockedCurrent =
    (selectedSummary?.isLocked || selectedSummary?.commerceLocked) && !selectedSummary?.isPreview;

  return (
    <main
      dir="rtl"
      data-testid="legacy-course-player"
      className={`min-h-screen flex flex-col overflow-x-hidden w-full max-w-full transition-colors duration-300 ${
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

      <div className="flex-1 flex overflow-hidden relative w-full max-w-full">
        {isSidebarOpen ? (
          <button
            type="button"
            aria-label="إغلاق خلفية قائمة الدروس"
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 top-16 z-20 bg-black/40 lg:hidden"
          />
        ) : null}

        <aside
          aria-label="فهرس محتوى الدورة"
          className={`fixed bottom-0 right-0 top-16 z-30 w-[88vw] max-w-[340px] shrink-0 overflow-y-auto border-l transition-transform duration-300 lg:static lg:h-[calc(100vh-4rem)] lg:w-80 lg:max-w-none lg:translate-x-0 ${
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

        <section className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 md:p-8 w-full max-w-full lg:max-w-[calc(100vw-20rem)] overflow-x-hidden">
          <div className="max-w-7xl mx-auto w-full min-w-0 space-y-6">
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

            {!course.access?.allowed ? (
              <div
                data-testid="course-commerce-lock"
                className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-900"
              >
                <div>
                  {course.access?.configured
                    ? 'هذه الدورة مدفوعة وتحتاج صلاحية وصول فعالة. يمكنك مشاهدة المعاينات المجانية فقط.'
                    : 'سياسة الوصول التجارية لهذه الدورة غير مكتملة؛ تم قفل المحتوى غير المجاني احترازيًا.'}
                </div>
                {course.access?.configured && course.access?.productId ? (
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
                  <div className={`relative w-full ${
                    activeDetail.type === 'video' && activeDetail.videoUrl
                      ? 'aspect-video bg-black'
                      : isDarkMode
                      ? 'min-h-56 sm:min-h-72 flex items-center justify-center bg-slate-900'
                      : 'min-h-56 sm:min-h-72 flex items-center justify-center bg-slate-100'
                  }`}>
                    {activeDetail.type === 'video' && activeDetail.videoUrl ? (
                      <SharedVideoPlayer
                        key={`${selectedScope}:${activeDetail.videoUrl}`}
                        ref={videoRef}
                        url={activeDetail.videoUrl}
                        title={activeDetail.title}
                        initialPositionSeconds={activeProgress?.positionSeconds || 0}
                        initialAnsweredQuestionIds={Array.from(answeredQuestionIds)}
                        interactiveQuestions={playerQuestions}
                        requireControllable={interactiveQuestions.some((question) => question.mustPass)}
                        onTimeUpdate={onTimeUpdate}
                        onPause={(seconds) => void persistVideoPosition(seconds)}
                        onQuestionAnswered={handleQuestionAnswered}
                      />
                    ) : activeDetail.type === 'video' ? (
                      <div className="max-w-xl p-8 text-center text-white">
                        <PlayCircle className="mx-auto text-indigo-300" size={54} />
                        <h3 className="mt-4 text-lg font-black">لم يتم إرفاق رابط فيديو</h3>
                        <p className="mt-2 text-sm font-bold leading-7 text-slate-300">
                          يرجى التواصل مع إدارة المسار أو المدرب لإضافة محتوى الفيديو المعتمد لهذا الدرس.
                        </p>
                      </div>
                    ) : (activeDetail.type === 'quiz' || parsedQuizInfo) ? (
                      <div className="p-8 text-center max-w-lg mx-auto">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                          <Award size={36} />
                        </div>
                        <span className="inline-block px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-black mb-2">
                          اختبار تقييمي معتمد
                        </span>
                        <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {activeDetail.title}
                        </h3>
                        <p className={`text-xs font-bold leading-6 mb-6 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                          {activeDetail.description || 'اختبار لقياس فهم واستيعاب المهارات المستهدفة في هذه الوحدة من الدورة.'}
                        </p>
                        <Link
                          to={`/assessments/${parsedQuizInfo?.quizId || activeDetail.id}/start`}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 px-6 py-3 text-sm font-black text-slate-950 shadow-md transition"
                        >
                          بدء الاختبار الآن
                          <ArrowRight size={17} />
                        </Link>
                      </div>
                    ) : ['live_youtube', 'zoom', 'google_meet', 'teams'].includes(activeDetail.type) ? (
                      <div className="p-8 text-center max-w-lg mx-auto">
                        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
                          <Radio size={36} className="animate-pulse" />
                        </div>
                        <span className="inline-block px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 text-xs font-black mb-2">
                          بث تدريبي تفاعلي مباشر
                        </span>
                        <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {activeDetail.title}
                        </h3>
                        <p className={`text-xs font-bold leading-6 mb-6 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                          {activeDetail.description || 'جلسة تدريب وبث مباشر مع المدرب لمناقشة المسائل والشروحات التفاعلية.'}
                        </p>
                        {parsedMeetingInfo?.meetingUrl ? (
                          <a
                            href={parsedMeetingInfo.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 px-6 py-3 text-sm font-black text-white shadow-md transition"
                          >
                            الانضمام للبث المباشر
                            <ExternalLink size={17} />
                          </a>
                        ) : (
                          <div className="text-xs font-bold text-slate-400">سيتم إتاحة رابط الاجتماع قبل موعد البث بدقائق.</div>
                        )}
                      </div>
                    ) : activeDetail.type === 'file' ? (
                      <div className="p-8 text-center max-w-lg mx-auto">
                        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                          <FileText size={36} />
                        </div>
                        <span className="inline-block px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-black mb-2">
                          مستند / مذكرة تعليمية
                        </span>
                        <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {activeDetail.title}
                        </h3>
                        <p className={`text-xs font-bold leading-6 mb-6 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                          {activeDetail.description || 'مذكرة قابلة للتحميل تحتوي على ملخص شامل للقوانين والتمارين.'}
                        </p>
                        {activeDetail.videoUrl ? (
                          <a
                            href={activeDetail.videoUrl}
                            download
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 px-6 py-3 text-sm font-black text-white shadow-md transition"
                          >
                            تحميل الملف المرفق
                            <Download size={17} />
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <BookOpen className="mx-auto text-indigo-500" size={48} />
                        <div className={`mt-3 text-sm font-black ${
                          isDarkMode ? 'text-slate-300' : 'text-gray-600'
                        }`}>
                          {activeDetail.title}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-5 sm:p-6">
                    {interactiveQuestions.length > 0 ? (
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-indigo-50/70 p-3.5 text-xs font-bold text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-900/40">
                        <div className="flex items-center gap-2">
                          <HelpCircle size={16} className="text-indigo-600 shrink-0" />
                          <span>
                            يحتوي هذا الدرس على {interactiveQuestions.length} سؤال تفاعلي ({requiredVideoQuestionIds.length} إلزامي للمتابعة).
                          </span>
                        </div>
                        <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-black text-indigo-700 shadow-xs dark:bg-slate-800 dark:text-indigo-300">
                          تم إجابة {answeredQuestionIds.size} من {interactiveQuestions.length}
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
                      <div className="flex flex-col items-end gap-2">
                        {activeProgress?.status !== 'completed' && unansweredRequiredVideoQuestionIds.length > 0 ? (
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 rounded-xl px-3 py-1.5 border border-amber-200">
                            يجب إجابة الأسئلة الإلزامية (${unansweredRequiredVideoQuestionIds.length} متبقٍ)
                          </span>
                        ) : null}
                        <button
                          type="button"
                          disabled={saving || activeProgress?.status === 'completed' || unansweredRequiredVideoQuestionIds.length > 0}
                          onClick={() => void complete()}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-black text-white transition hover:bg-emerald-700 disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
                        >
                          {saving ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
                          تحديد كمكتمل
                        </button>
                      </div>
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

                {/* 5-Tab Learning Workspace Below Player */}
                <div className={`rounded-3xl border shadow-sm overflow-hidden transition-colors ${
                  isDarkMode ? 'border-slate-800 bg-[#1e293b]' : 'border-gray-200/80 bg-white'
                }`}>
                  {/* Tab Navigation Headers */}
                  <div className={`flex items-center overflow-x-auto border-b px-3 py-2 gap-1 sm:gap-2 ${
                    isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-gray-100 bg-slate-50/70'
                  }`}>
                    <button
                      type="button"
                      onClick={() => setBottomTab('notes')}
                      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition cursor-pointer whitespace-nowrap ${
                        bottomTab === 'notes'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <BookOpen size={15} />
                      الشرح والملاحظات
                    </button>
                    <button
                      type="button"
                      onClick={() => setBottomTab('files')}
                      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition cursor-pointer whitespace-nowrap ${
                        bottomTab === 'files'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <FileText size={15} />
                      الملفات والمرفقات ({courseFilesList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBottomTab('qa')}
                      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition cursor-pointer whitespace-nowrap ${
                        bottomTab === 'qa'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <MessageSquare size={15} />
                      الأسئلة والنقاش ({lessonComments.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBottomTab('assessments')}
                      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition cursor-pointer whitespace-nowrap ${
                        bottomTab === 'assessments'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <HelpCircle size={15} />
                      اختبارات الدورة ({courseAssessmentsList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBottomTab('certificate')}
                      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition cursor-pointer whitespace-nowrap ${
                        bottomTab === 'certificate'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Award size={15} />
                      الشهادة والإنجاز
                    </button>
                  </div>

                  {/* Tab Contents */}
                  <div className="p-5 sm:p-6">
                    {/* 1. NOTES TAB */}
                    {bottomTab === 'notes' && (
                      <div className="space-y-4">
                        <h4 className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {activeDetail.title}
                        </h4>
                        <p className={`text-sm leading-8 ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                          {activeDetail.description || 'لا يوجد وصف إضافي لهذا الدرس.'}
                        </p>
                        {lessonTextDescription ? (
                          <div className={`whitespace-pre-wrap rounded-2xl p-4 text-sm leading-8 border ${
                            isDarkMode ? 'bg-slate-900/60 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200/80 text-gray-800'
                          }`}>
                            {lessonTextDescription}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* 2. FILES TAB */}
                    {bottomTab === 'files' && (
                      <div className="space-y-3">
                        {courseFilesList.length === 0 ? (
                          <div className={`text-center py-8 text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                            لا توجد ملفات مرفقة مع هذه الدورة حالياً.
                          </div>
                        ) : (
                          courseFilesList.map((file: any, idx: number) => (
                            <div
                              key={file.id || idx}
                              className={`flex items-center justify-between p-3.5 rounded-2xl border transition ${
                                isDarkMode ? 'border-slate-800 bg-slate-900/40 hover:bg-slate-900' : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                                  <FileText size={20} />
                                </div>
                                <div>
                                  <div className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {file.title || `ملف تدريبي ${idx + 1}`}
                                  </div>
                                  <div className="text-xs text-gray-400 mt-0.5">
                                    {file.size || 'ملف PDF'}
                                  </div>
                                </div>
                              </div>
                              <a
                                href={file.url || '#'}
                                target="_blank"
                                rel="noreferrer"
                                download
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
                              >
                                <Download size={14} />
                                تحميل
                              </a>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* 3. QA TAB */}
                    {bottomTab === 'qa' && (
                      <div className="space-y-4">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!newCommentText.trim()) return;
                            const comment = {
                              id: `c-${Date.now()}`,
                              authorName: user?.name || 'طالب المنصة',
                              createdAt: 'الآن',
                              text: newCommentText.trim(),
                            };
                            setLessonComments((prev) => [comment, ...prev]);
                            setNewCommentText('');
                          }}
                          className="space-y-2.5"
                        >
                          <textarea
                            rows={3}
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            placeholder="اطرح استفسارك أو سؤالك حول هذا الدرس وسيقوم المدرب بالرد عليك..."
                            className={`w-full rounded-2xl border p-3.5 text-sm font-medium outline-none transition focus:ring-2 focus:ring-indigo-500/20 ${
                              isDarkMode
                                ? 'border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:border-indigo-500'
                                : 'border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:bg-white'
                            }`}
                          />
                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={!newCommentText.trim()}
                              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer"
                            >
                              <Send size={14} />
                              نشر التعليق / السؤال
                            </button>
                          </div>
                        </form>

                        <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                          {lessonComments.map((comm) => (
                            <div
                              key={comm.id}
                              className={`p-3.5 rounded-2xl border ${
                                comm.isInstructor
                                  ? isDarkMode
                                    ? 'border-indigo-900/50 bg-indigo-950/20'
                                    : 'border-indigo-100 bg-indigo-50/50'
                                  : isDarkMode
                                  ? 'border-slate-800 bg-slate-900/40'
                                  : 'border-gray-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {comm.authorName}
                                  </span>
                                  {comm.isInstructor ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-600 text-white">
                                      مدرب الدورة
                                    </span>
                                  ) : null}
                                </div>
                                <span className="text-[11px] text-gray-400">{comm.createdAt}</span>
                              </div>
                              <p className={`text-xs sm:text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                                {comm.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 4. ASSESSMENTS TAB */}
                    {bottomTab === 'assessments' && (
                      <div className="space-y-3">
                        {courseAssessmentsList.length === 0 ? (
                          <div className={`text-center py-8 text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                            لا توجد اختبارات مرحلية معينة لهذه الدورة في الوقت الحالي.
                          </div>
                        ) : (
                          courseAssessmentsList.map((test: any, idx: number) => {
                            const phaseLabels: Record<string, string> = {
                              pre_course: 'اختبار قبلي تشخيصي',
                              milestone: 'اختبار مرحلي',
                              final_course: 'اختبار شامل نهائي',
                            };
                            return (
                              <div
                                key={test.id || idx}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition ${
                                  isDarkMode ? 'border-slate-800 bg-slate-900/40' : 'border-gray-200 bg-gray-50/50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                                    <HelpCircle size={20} />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                        {test.title}
                                      </span>
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                        {phaseLabels[test.phase] || 'اختبار تقييمي'}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                      {test.durationMinutes || 30} دقيقة • {test.questionsCount || 20} سؤال
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/assessments?courseId=${courseId}&assessmentId=${test.id}`)}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 transition cursor-pointer"
                                >
                                  بدء الاختبار
                                  <ChevronLeft size={14} />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* 5. CERTIFICATE TAB */}
                    {bottomTab === 'certificate' && (
                      <div className="space-y-5 text-center py-4">
                        <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
                          <Award size={36} />
                        </div>
                        <div>
                          <h4 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            شهادة إتمام الدورة التدريبية
                          </h4>
                          <p className={`text-xs mt-1 max-w-md mx-auto ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                            احصل على شهادتك المعتمدة بمجرد إكمال جميع دروس الدورة واجتياز الاختبارات المقررة.
                          </p>
                        </div>

                        <div className="max-w-md mx-auto space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                            <span>نسبة الإنجاز الحالية</span>
                            <span className="font-black text-indigo-600">{completionPercent}%</span>
                          </div>
                          <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                              style={{ width: `${completionPercent}%` }}
                            />
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {completedLessonsCount} من أصل {lessons.length} درس مكتمل
                          </div>
                        </div>

                        {completionPercent >= 100 ? (
                          <div className="pt-3">
                            <button
                              type="button"
                              onClick={() => alert('مبارك لك! جاري إعداد وتوليد وثيقة شهادتك المعتمدة...')}
                              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 font-black text-white hover:bg-emerald-700 transition shadow-lg cursor-pointer text-sm"
                            >
                              <Download size={18} />
                              تحميل وثيقة الشهادة (PDF)
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 px-4 py-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                            <Lock size={14} />
                            أكمل بقية الدروس لتفعيل زر إصدار الشهادة
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
