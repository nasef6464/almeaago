import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Loader2,
  Lock,
  Menu,
  Moon,
  PauseCircle,
  PlayCircle,
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

export function CourseLearningPage() {
  const { courseId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, getCsrfToken } = useAuth();

  const [course, setCourse] = useState<LearnerCourse | null>(null);
  const [lessonId, setLessonId] = useState(searchParams.get('lesson') || '');
  const [detail, setDetail] = useState<LearnerLessonDetail | null>(null);
  const [progress, setProgress] = useState<LessonProgress | null>(null);
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

  const lessons = useMemo(() => flattenLessons(course), [course]);
  const selectedSummary = lessons.find((item) => item.id === lessonId) || null;
  const selectedIndex = lessons.findIndex((item) => item.id === lessonId);
  const previousLesson = selectedIndex > 0 ? lessons[selectedIndex - 1] : null;
  const nextLesson = selectedIndex >= 0 ? lessons[selectedIndex + 1] || null : null;
  const context = useMemo(
    () => ({ contextType: 'course' as const, courseId, topicId: '' }),
    [courseId],
  );

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
    if (!lessonId || !courseId) return;

    if ((selectedSummary?.isLocked || selectedSummary?.commerceLocked) && !selectedSummary.isPreview) {
      setDetail(null);
      setProgress(null);
      return;
    }

    const controller = new AbortController();
    setError('');
    setNotice('');

    Promise.all([
      contentClient.learnerCourseLesson(courseId, lessonId, controller.signal),
      lessonProgressClient.get(lessonId, context, controller.signal),
    ])
      .then(([lessonResult, progressResult]) => {
        setDetail(lessonResult.lesson);
        setProgress(progressResult.progress);
        lastSaved.current = progressResult.progress.positionSeconds || 0;
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'تعذر تحميل الدرس');
        }
      });

    return () => controller.abort();
  }, [
    context,
    courseId,
    lessonId,
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
    if (!detail || detail.type !== 'video' || saving) return;
    const seconds = Math.max(0, Math.floor(position || 0));
    if (Math.abs(seconds - lastSaved.current) < 1) return;

    setSaving(true);
    try {
      const csrf = await getCsrfToken();
      const result = await lessonProgressClient.saveVideo(detail.id, context, seconds, csrf);
      setProgress(result.progress);
      lastSaved.current = result.progress.positionSeconds;
      if (!quiet) setNotice('تم حفظ موضع المشاهدة.');
    } catch (reason) {
      if (!quiet) setError(reason instanceof Error ? reason.message : 'تعذر حفظ موضع المشاهدة');
    } finally {
      setSaving(false);
    }
  }

  function onTimeUpdate() {
    const current = Math.floor(videoRef.current?.currentTime || 0);
    if (current - lastSaved.current >= 15) {
      void persistVideoPosition(current, true);
    }
  }

  async function complete() {
    if (!detail) return;
    setError('');

    try {
      if (detail.type === 'video' && videoRef.current) {
        await persistVideoPosition(videoRef.current.currentTime, true);
      }

      setSaving(true);
      const csrf = await getCsrfToken();
      const result = await lessonProgressClient.complete(detail.id, context, csrf);
      setProgress(result.progress);
      setNotice('تم تسجيل الدرس كمكتمل.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر إكمال الدرس');
    } finally {
      setSaving(false);
    }
  }

  function selectLesson(lesson: LearnerLessonSummary | null) {
    if (!lesson) return;
    const locked = (lesson.isLocked || lesson.commerceLocked) && !lesson.isPreview;
    if (locked) return;
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
            onClick={() => navigate('/learning')}
            className={`rounded-xl p-2 transition-colors ${
              isDarkMode
                ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
            aria-label="الرجوع لمساحة التعلم"
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
                    {detail?.title || selectedSummary?.title || 'اختر درسًا'}
                  </h2>
                  <p className={`mt-1 text-xs font-bold ${
                    isDarkMode ? 'text-slate-400' : 'text-gray-500'
                  }`}>
                    {progressLabel(progress)}
                  </p>
                </div>

                {progress?.status === 'completed' ? (
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
            ) : detail ? (
              <>
                <article
                  className={`overflow-hidden rounded-3xl border shadow-sm ${
                    isDarkMode ? 'border-slate-800 bg-[#1e293b]' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className={`relative flex min-h-56 items-center justify-center sm:min-h-72 ${
                    detail.type === 'video' ? 'bg-black' : isDarkMode ? 'bg-slate-900' : 'bg-slate-100'
                  }`}>
                    {detail.type === 'video' && detail.videoSource === 'upload' && detail.videoUrl ? (
                      <video
                        ref={videoRef}
                        data-testid="lesson-video"
                        src={detail.videoUrl}
                        controls
                        className="aspect-video w-full bg-black"
                        onLoadedMetadata={() => {
                          const video = videoRef.current;
                          if (video && progress?.positionSeconds && video.currentTime === 0) {
                            video.currentTime = Math.min(
                              progress.positionSeconds,
                              Number.isFinite(video.duration) ? video.duration : progress.positionSeconds,
                            );
                          }
                        }}
                        onTimeUpdate={onTimeUpdate}
                        onPause={() => {
                          const video = videoRef.current;
                          if (video) void persistVideoPosition(video.currentTime);
                        }}
                      />
                    ) : detail.type === 'video' ? (
                      <div className="max-w-xl p-8 text-center text-white">
                        <PlayCircle className="mx-auto text-indigo-300" size={54} />
                        <h3 className="mt-4 text-lg font-black">محتوى فيديو خارجي</h3>
                        <p className="mt-2 text-sm font-bold leading-7 text-slate-300">
                          المصدر {detail.videoSource || 'خارجي'} يظل رابط المحتوى المعتمد. إكمال الدرس خطوة صريحة منفصلة.
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
                  </div>

                  <div className="p-5 sm:p-6">
                    <p className={`text-sm font-medium leading-7 ${
                      isDarkMode ? 'text-slate-300' : 'text-gray-600'
                    }`}>
                      {detail.description}
                    </p>

                    {detail.type === 'text' && detail.contentText ? (
                      <div className={`mt-4 whitespace-pre-wrap rounded-2xl p-4 text-sm leading-8 ${
                        isDarkMode ? 'bg-slate-900 text-slate-200' : 'bg-gray-50 text-gray-800'
                      }`}>
                        {detail.contentText}
                      </div>
                    ) : null}

                    {detail.type === 'video' && detail.videoSource === 'upload' && detail.videoUrl ? (
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
                        {detail.durationSeconds > 0
                          ? `مدة مرجعية: ${detail.durationSeconds} ثانية`
                          : 'بدون مدة محددة'}
                      </span>
                      <button
                        type="button"
                        disabled={saving || progress?.status === 'completed'}
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
                اختر درسًا متاحًا.
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
