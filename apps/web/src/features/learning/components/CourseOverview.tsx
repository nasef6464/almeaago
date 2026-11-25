import { courseFileURL } from '../courseFileURL';
import { CourseAssessmentList } from './CourseAssessmentList';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import { lessonProgressSummaryClient, type CourseCertificate } from '../api/learning-client';
import {
  Award,
  BarChart,
  BookOpen,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  FileText,
  Heart,
  HelpCircle,
  Lock,
  MessageSquare,
  PlayCircle,
  Send,
  Share2,
  Star,
  User,
  Video,
  X,
} from 'lucide-react';

export type TabType = 'syllabus' | 'description' | 'tests' | 'qa' | 'files';

export interface CourseOverviewFile {
  id: string;
  title: string;
  size?: string;
  url?: string;
  access?: 'free_preview' | 'enrolled_paid';
}

export interface CourseOverviewAssessment {
  id: string;
  title: string;
  phase?: 'pre_course' | 'during_course' | 'final_course';
  durationMinutes?: number;
  questionsCount?: number;
  access?: 'free_preview' | 'enrolled_paid';
  quizId?: string;
}

export interface CourseOverviewData {
  id: string;
  title: string;
  description?: string;
  instructorName?: string;
  durationMinutes?: number;
  level?: string;
  thumbnailAssetId?: string;
  thumbnailUrl?: string;
  category?: string;
  pathId?: string;
  subjectId?: string;
  certificateEnabled?: boolean;
  dripContentEnabled?: boolean;
  price?: number;
  originalPrice?: number;
  currency?: string;
  rating?: number;
  studentsCount?: number;
  fakeStudentsCount?: number;
  fakeRating?: number;
  trailerVideoUrl?: string;
  reviews?: Array<{
    id: string;
    authorName: string;
    rating: number;
    createdAt: string;
    comment: string;
    verified?: boolean;
    reply?: string;
  }>;
  modules: Array<{
    id: string;
    title: string;
    description?: string;
    sortOrder: number;
    lessons: Array<{
      id: string;
      title: string;
      description?: string;
      type: string;
      durationSeconds?: number;
      durationLabel?: string;
      isLocked?: boolean;
      isPreview?: boolean;
      commerceLocked?: boolean;
      sortOrder: number;
    }>;
  }>;
  files?: CourseOverviewFile[];
  assessments?: CourseOverviewAssessment[];
  tests?: CourseOverviewAssessment[];
  presentation?: {
    files?: CourseOverviewFile[];
    assessments?: CourseOverviewAssessment[];
    [key: string]: unknown;
  };
  features?: string[];
  objectives?: string[];
  access?: {
    allowed: boolean;
    configured: boolean;
    reason: string;
  };
}

interface QaThread {
  id: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  question: string;
  replies: Array<{
    id: string;
    authorName: string;
    authorRole: string;
    createdAt: string;
    text: string;
    isInstructor?: boolean;
  }>;
}

export interface CourseOverviewProps {
  course: CourseOverviewData;
  initialTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  onContinue: (lessonId?: string) => void;
  isStaffViewer?: boolean;
  completedLessonIds?: string[] | null;
}

const DEFAULT_OBJECTIVES = [
  'فهم الأسس والمفاهيم الجوهرية بطريقة مبسطة وعملية.',
  'التدرب على نماذج أسئلة وتطبيقات واقعية تشبه الاختبار الفعلي.',
  'اكتساب مهارات إدارة الوقت والحل السريع بدقة عالية.',
  'التحضير الشامل لرفع الدرجة وتحقيق التفوق بإذن الله.',
];

const DEFAULT_FEATURES = [
  'شروحات فيديو تفاعلية بجودة عالية وتدريج منطقي.',
  'ملخصات ومذكرات قابلة للتحميل والمراجعة السريعة.',
  'اختبارات محاكية تقيس مستواك وتحدد نقاط القوة والضعف.',
];

function formatDurationSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return 'درس مرئي';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours} ساعة و ${remainingMins} د` : `${hours} ساعة`;
}

export function CourseOverview({
  course,
  initialTab = 'syllabus',
  onTabChange,
  onContinue,
  isStaffViewer = false,
  completedLessonIds: serverCompletedIds = null,
}: CourseOverviewProps) {
  const navigate = useNavigate();
  const { user, getCsrfToken } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [certificate, setCertificate] = useState<CourseCertificate | null>(null);
  const [certBusy, setCertBusy] = useState(false);
  const [certError, setCertError] = useState('');

  type CourseQAItem = Awaited<ReturnType<typeof contentClient.qaList>>['items'][number];
  type CourseQAReply = Awaited<ReturnType<typeof contentClient.qaReplies>>['items'][number];
  const [qaItems, setQaItems] = useState<CourseQAItem[]>([]);
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [qaSubmitting, setQaSubmitting] = useState(false);
  const [openRepliesId, setOpenRepliesId] = useState<string>('');
  const [repliesByQuestion, setRepliesByQuestion] = useState<Record<string, CourseQAReply[]>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const loadCourseQA = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;
    setQaLoading(true);
    setQaError('');
    try {
      const res = await contentClient.qaList({ courseId: course.id, limit: 30 }, signal);
      setQaItems(res.items || []);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setQaError(err instanceof Error ? err.message : 'تعذر تحميل أسئلة الدورة.');
      }
    } finally {
      setQaLoading(false);
    }
  }, [course.id, user]);

  useEffect(() => {
    if (activeTab !== 'qa' || !user) return;
    const controller = new AbortController();
    loadCourseQA(controller.signal);
    return () => controller.abort();
  }, [activeTab, loadCourseQA, user]);
  const [isFavorite, setIsFavorite] = useState(() => {
    try {
      return localStorage.getItem(`course_fav_${course.id}`) === 'true';
    } catch {
      return false;
    }
  });
  const [shareNotice, setShareNotice] = useState('');
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [expandedModules, setExpandedModules] = useState<string[]>(() =>
    course.modules.length > 0 ? [course.modules[0].id] : [],
  );

  const completedLessonIds = useMemo(() => new Set(serverCompletedIds || []), [serverCompletedIds]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const toggleModuleAccordion = (moduleId: string) => {
    setExpandedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId],
    );
  };

  const handleToggleFavorite = () => {
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      localStorage.setItem(`course_fav_${course.id}`, String(next));
    } catch {
      // ignore
    }
  };

  const handleShareCourse = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: course.title,
          text: `انضم إلى دورة: ${course.title} على منصة المعا!`,
          url,
        });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setShareNotice('تم نسخ رابط الدورة بنجاح!');
        setTimeout(() => setShareNotice(''), 3000);
      } catch {
        setShareNotice('الرابط: ' + url);
      }
    }
  };

  // Calculations
  const allLessons = useMemo(() => course.modules.flatMap((m) => m.lessons), [course.modules]);
  const totalLessonsCount = allLessons.length;
  const completedLessonsCount = allLessons.filter((l) => completedLessonIds.has(l.id)).length;
  const progressPercent = serverCompletedIds === null ? null : totalLessonsCount > 0 ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0;

  const totalDurationMinutes = course.durationMinutes || Math.round(
    allLessons.reduce((acc, l) => acc + (l.durationSeconds || 0), 0) / 60,
  );
  const durationLabel = totalDurationMinutes >= 60
    ? `${Math.floor(totalDurationMinutes / 60)} ساعة و ${totalDurationMinutes % 60} د`
    : `${totalDurationMinutes} دقيقة`;

  const videoLessonsCount = allLessons.filter((l) => l.type === 'video').length;
  const hasAccess = Boolean(course.access?.allowed || isStaffViewer);
  const coursePrice = Number(course.price || 0);
  const courseOriginalPrice = Number(course.originalPrice || 0);
  const hasDiscount = courseOriginalPrice > coursePrice && coursePrice > 0;
  const isFree = coursePrice <= 0;
  const audienceCount = (Number(course.studentsCount) || 0) + (Number(course.fakeStudentsCount) || 0);
  const displayRating = course.fakeRating ? Math.min(Number(course.fakeRating) || 0, 5) : (Number(course.rating) || 0);


  const filesList = useMemo(() => course.files || course.presentation?.files || [], [course.files, course.presentation?.files]);
  const testsList = useMemo(() => {
    if (course.assessments && course.assessments.length > 0) {
      return course.assessments;
    }
    if (course.tests && course.tests.length > 0) {
      return course.tests;
    }
    if (course.presentation?.assessments && course.presentation.assessments.length > 0) {
      return course.presentation.assessments;
    }
    return [];
  }, [course.assessments, course.tests, course.presentation?.assessments]);

  const objectivesList = course.objectives && course.objectives.length > 0 ? course.objectives : DEFAULT_OBJECTIVES;
  const featuresList = course.features && course.features.length > 0 ? course.features : DEFAULT_FEATURES;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 relative font-sans text-right" dir="rtl">
      {/* Top Atmospheric Ambient Glow */}
      <div className="absolute top-0 left-0 right-0 h-[480px] bg-gradient-to-b from-[#0a0f1d] via-[#0f172a] to-transparent pointer-events-none z-0" />

      {/* Main Layout Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-6 sm:pt-8 md:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 items-start">
          
          {/* Main Content Column: Hero Showcase Card + Tabs */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Hero Showcase Card - Dark Navy High-Contrast Card */}
            <div className="rounded-3xl bg-gradient-to-br from-[#0a0f1d] via-[#0f172a] to-[#1e293b] p-6 sm:p-8 md:p-10 text-white shadow-2xl border border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/15 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-600/10 blur-3xl rounded-full -ml-10 -mb-10 pointer-events-none" />

              <div className="relative z-10 space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> جديد ومحدّث
                  </span>
                  {course.category ? (
                    <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-black px-3 py-1 rounded-full">
                      {course.category}
                    </span>
                  ) : null}
                  {course.certificateEnabled ? (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1">
                      <Award size={14} /> شهادة إتمام معتمدة
                    </span>
                  ) : null}
                  {course.trailerVideoUrl ? (
                    <button
                      type="button"
                      onClick={() => setShowTrailerModal(true)}
                      className="bg-indigo-500/30 hover:bg-indigo-500/50 text-indigo-200 border border-indigo-400/40 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <PlayCircle size={14} className="text-indigo-400" /> مشاهدة برومو الدورة
                    </button>
                  ) : null}
                </div>

                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight tracking-tight text-white drop-shadow-sm break-words">
                  {course.title}
                </h1>

                {course.description ? (
                  <p className="text-slate-300 text-sm sm:text-base leading-relaxed line-clamp-3">
                    {course.description}
                  </p>
                ) : null}

                {/* 4 Professional Metadata Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-2">
                  {/* Instructor */}
                  <div className="rounded-2xl border border-slate-700/80 bg-slate-800/80 p-3.5 shadow-sm backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/20 text-indigo-400 font-black">
                        <User size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-400">المدرب</p>
                        <p className="truncate text-sm font-black text-white">{course.instructorName || 'فريق المنصة'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Rating */}
                  {displayRating > 0 && (
                    <div className="rounded-2xl border border-slate-700/80 bg-slate-800/80 p-3.5 shadow-sm backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20 text-amber-400 font-black">
                          <Star size={20} className="fill-amber-400 text-amber-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-400">التقييم</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-white">{displayRating.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Enrolled Students */}
                  {audienceCount > 0 && (
                    <div className="rounded-2xl border border-slate-700/80 bg-slate-800/80 p-3.5 shadow-sm backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/20 text-emerald-400 font-black">
                          <BarChart size={20} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-400">الطلاب المسجلون</p>
                          <p className="truncate text-sm font-black text-emerald-400">+{audienceCount.toLocaleString()} طالب</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Content / Lessons */}
                  <div className="rounded-2xl border border-slate-700/80 bg-slate-800/80 p-3.5 shadow-sm backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/20 text-blue-400 font-black">
                        <BookOpen size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-400">المنهج والمدة</p>
                        <p className="truncate text-sm font-black text-white">
                          {totalLessonsCount} درس
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Share Notification Alert */}
            {shareNotice ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 flex items-center justify-between">
                <span>{shareNotice}</span>
                <button onClick={() => setShareNotice('')} className="text-emerald-700 hover:text-emerald-900 text-xs font-black">إغلاق</button>
              </div>
            ) : null}

            {/* Content Tabs Container */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex overflow-x-auto border-b border-gray-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => handleTabClick('syllabus')}
                  className={`shrink-0 px-6 md:px-8 py-4 font-black text-xs md:text-sm transition-all cursor-pointer ${
                    activeTab === 'syllabus'
                      ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white shadow-xs'
                      : 'text-gray-500 hover:text-indigo-600'
                  }`}
                >
                  المحتوى ({totalLessonsCount})
                </button>
                <button
                  type="button"
                  onClick={() => handleTabClick('description')}
                  className={`shrink-0 px-6 md:px-8 py-4 font-black text-xs md:text-sm transition-all cursor-pointer ${
                    activeTab === 'description'
                      ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white shadow-xs'
                      : 'text-gray-500 hover:text-indigo-600'
                  }`}
                >
                  وصف الدورة
                </button>
                <button
                  type="button"
                  onClick={() => handleTabClick('tests')}
                  className={`shrink-0 px-6 md:px-8 py-4 font-black text-xs md:text-sm transition-all cursor-pointer ${
                    activeTab === 'tests'
                      ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white shadow-xs'
                      : 'text-gray-500 hover:text-indigo-600'
                  }`}
                >
                  الاختبارات
                </button>
                <button
                  type="button"
                  onClick={() => handleTabClick('qa')}
                  className={`shrink-0 px-6 md:px-8 py-4 font-black text-xs md:text-sm transition-all cursor-pointer ${
                    activeTab === 'qa'
                      ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white shadow-xs'
                      : 'text-gray-500 hover:text-indigo-600'
                  }`}
                >
                  سؤال وجواب
                </button>
                <button
                  type="button"
                  onClick={() => handleTabClick('files')}
                  className={`shrink-0 px-6 md:px-8 py-4 font-black text-xs md:text-sm transition-all cursor-pointer ${
                    activeTab === 'files'
                      ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white shadow-xs'
                      : 'text-gray-500 hover:text-indigo-600'
                  }`}
                >
                  ملفات الدورة ({filesList.length})
                </button>
              </div>

              {/* Tab Contents */}
              <div className="p-4 sm:p-6 md:p-8">
                
                {/* 1. SYLLABUS TAB */}
                {activeTab === 'syllabus' && (
                  <div className="space-y-6">
                    {course.modules.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <BookOpen size={48} className="mx-auto text-gray-300 mb-3" />
                        <p className="font-bold">يجري حالياً إعداد منهج هذه الدورة.</p>
                      </div>
                    ) : (
                      course.modules.map((module, mIdx) => {
                        const isExpanded = expandedModules.includes(module.id);
                        const moduleDurationSeconds = module.lessons.reduce((acc, l) => acc + (l.durationSeconds || 0), 0);
                        const moduleDurationLabel = formatDurationSeconds(moduleDurationSeconds);

                        return (
                          <div key={module.id} className="rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-xs">
                            {/* Module Header Accordion Toggle */}
                            <button
                              type="button"
                              onClick={() => toggleModuleAccordion(module.id)}
                              className="w-full flex items-center justify-between p-4 sm:p-5 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-right"
                            >
                              <div className="flex items-center gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 text-xs font-black">
                                  {mIdx + 1}
                                </span>
                                <div>
                                  <h3 className="text-sm sm:text-base font-black text-gray-900">{module.title}</h3>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {module.lessons.length} دروس • {moduleDurationLabel}
                                  </p>
                                </div>
                              </div>
                              <div className="text-gray-500">
                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                              </div>
                            </button>

                            {/* Module Lessons List */}
                            {isExpanded && (
                              <div className="p-3 sm:p-4 space-y-2.5 divide-y divide-gray-100/60">
                                {module.lessons.map((lesson, lIdx) => {
                                  const isCompleted = completedLessonIds.has(lesson.id);
                                  const isLocked = Boolean(lesson.isLocked || lesson.commerceLocked) && !lesson.isPreview && !hasAccess;
                                  const isQuiz = lesson.type === 'quiz' || lesson.type === 'assignment';
                                  const isFile = lesson.type === 'file';
                                  const durationStr = lesson.durationLabel || formatDurationSeconds(lesson.durationSeconds || 0);

                                  return (
                                    <div
                                      key={lesson.id}
                                      onClick={() => {
                                        if (isLocked) {
                                          navigate(`/checkout?courseId=${course.id}`);
                                        } else {
                                          onContinue(lesson.id);
                                        }
                                      }}
                                      title={isLocked ? 'هذا الدرس يتطلب الاشتراك في الدورة - اضغط للشراء والتفعيل' : 'اضغط لمتابعة الدرس'}
                                      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                                        isLocked
                                          ? 'bg-amber-50/40 border-amber-200/60 hover:bg-amber-100/60 opacity-90'
                                          : isCompleted
                                            ? 'bg-emerald-50/30 border-emerald-200/60 hover:bg-emerald-50'
                                            : 'bg-white border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/20'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-xs font-bold text-slate-400 w-5 shrink-0 text-center">
                                          {lIdx + 1}
                                        </span>
                                        <div
                                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                                            isCompleted
                                              ? 'bg-emerald-500 text-white'
                                              : isQuiz
                                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                : isFile
                                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                                  : 'bg-blue-50 text-blue-600 border border-blue-200'
                                          }`}
                                        >
                                          {isCompleted ? (
                                            <CheckCircle2 size={18} />
                                          ) : isQuiz ? (
                                            <Award size={18} />
                                          ) : isFile ? (
                                            <FileText size={18} />
                                          ) : (
                                            <PlayCircle size={18} />
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-black text-slate-800 truncate">
                                              {lesson.title}
                                            </p>
                                            {isCompleted ? (
                                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                مكتمل ✓
                                              </span>
                                            ) : isLocked ? (
                                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                                <Lock size={10} /> يحتاج اشتراك
                                              </span>
                                            ) : lesson.isPreview ? (
                                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 border border-blue-200">
                                                معاينة مجانية
                                              </span>
                                            ) : (
                                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                                متاح الآن
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-xs text-slate-500 font-medium mt-0.5">{durationStr}</p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        {isLocked ? (
                                          <span className="text-xs font-black text-amber-700 flex items-center gap-1 hover:underline">
                                            <Lock size={14} className="text-amber-600" /> اشترك لفتح الدرس ←
                                          </span>
                                        ) : isCompleted ? (
                                          <span className="text-xs font-bold text-emerald-600">إعادة الدرس ←</span>
                                        ) : (
                                          <span className="text-xs font-bold text-indigo-600 hover:text-indigo-700">ابدأ الآن ←</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 2. DESCRIPTION TAB */}
                {activeTab === 'description' && (
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-lg font-black text-gray-900 mb-3">عن هذه الدورة</h3>
                      <p className="text-sm sm:text-base text-gray-700 leading-8">
                        {course.description || 'دورة شاملة ومصممة بأعلى معايير الجودة التعليمية لتمكين الطلاب من استيعاب كافة مهارات المنهج والتفوق في الاختبارات الوزارية والقياسية.'}
                      </p>
                    </div>

                    {/* What you will learn */}
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6">
                      <h4 className="text-base font-black text-indigo-950 mb-4 flex items-center gap-2">
                        <CheckCircle size={20} className="text-indigo-600" />
                        ماذا ستتعلم في هذه الدورة؟
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {objectivesList.map((obj, i) => (
                          <div key={i} className="flex items-start gap-2.5 text-sm text-indigo-900 font-medium">
                            <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                            <span>{obj}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Course Features */}
                    <div>
                      <h4 className="text-base font-black text-gray-900 mb-4">مميزات الدورة</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {featuresList.map((feat, i) => (
                          <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                              <CheckCircle2 size={16} />
                            </div>
                            <p className="text-sm font-bold text-gray-800 leading-relaxed">{feat}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. TESTS TAB */}
                {activeTab === 'tests' && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                      <h3 className="text-sm font-black text-indigo-950">تشمل الدورة حزمة اختبارات محاكية</h3>
                      <p className="mt-1 text-xs font-bold text-indigo-800/80">اختبارات شاملة وتدريبات قياس متوافقة مع معايير الاختبارات الفعلية.</p>
                    </div>
                    {testsList.length > 0 && (
                      <div className="space-y-3">
                        {testsList.map((test) => {
                          const isLocked = test.access === 'enrolled_paid' && !hasAccess;
                          return (
                            <div
                              key={test.id}
                              className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all hover:border-indigo-300 hover:shadow-xs"
                            >
                              <div>
                                <h4 className="font-black text-gray-900 text-sm md:text-base">{test.title}</h4>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 font-medium">
                                  <span>{test.questionsCount || 20} سؤال</span>
                                  <span>•</span>
                                  <span>{test.durationMinutes || 30} دقيقة</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/assessments/${encodeURIComponent(test.id)}/start?courseId=${encodeURIComponent(course.id)}&returnTo=${encodeURIComponent(`/course/${encodeURIComponent(course.id)}?tab=tests`)}`,
                                  )
                                }
                                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-700 transition shadow-xs"
                              >
                                {isLocked ? 'فتح الاختبار' : 'بدء الاختبار ←'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <CourseAssessmentList courseId={course.id} pathId={course.pathId || ''} subjectId={course.subjectId || ''} hideIfEmpty={testsList.length > 0} returnTo={`/course/${encodeURIComponent(course.id)}?tab=tests`} />
                  </div>
                )}

                {/* 4. QA TAB */}
                {activeTab === 'qa' && (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-7 text-indigo-800">
                      اطرح استفسارك حول دروس الدورة، وتابع ردود المدربين والطلاب مباشرة. لحجز حصة خاصة فردية استخدم{' '}
                      <button
                        type="button"
                        onClick={() => navigate('/book-session?source=course')}
                        className="font-black underline hover:text-indigo-950"
                      >
                        صفحة حجز الحصص
                      </button>
                      .
                    </div>

                    {!user ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-600">
                        سجّل الدخول لطرح الأسئلة ومتابعة نقاشات الدورة.
                      </div>
                    ) : (
                      <>
                        {qaError && (
                          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
                            {qaError}
                          </div>
                        )}
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (newQuestionText.trim().length < 5) {
                              setQaError('يرجى كتابة سؤال واضح لا يقل عن 5 أحرف.');
                              return;
                            }
                            setQaSubmitting(true);
                            setQaError('');
                            try {
                              const csrf = await getCsrfToken();
                              await contentClient.qaCreate(
                                {
                                  courseId: course.id,
                                  pathId: course.pathId,
                                  subjectId: course.subjectId,
                                  subjectName: course.category || course.title,
                                  question: newQuestionText.trim(),
                                  requestId: `cqa-${Date.now()}`,
                                },
                                csrf,
                              );
                              setNewQuestionText('');
                              await loadCourseQA();
                            } catch (err) {
                              setQaError(err instanceof Error ? err.message : 'تعذر إرسال السؤال.');
                            } finally {
                              setQaSubmitting(false);
                            }
                          }}
                          className="flex flex-col sm:flex-row gap-3 mb-6"
                        >
                          <input
                            type="text"
                            value={newQuestionText}
                            onChange={(e) => setNewQuestionText(e.target.value)}
                            placeholder="اكتب سؤالك أو استفسارك حول الدورة..."
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="submit"
                            disabled={qaSubmitting}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors font-bold text-sm disabled:opacity-60"
                          >
                            {qaSubmitting ? 'جاري الإرسال...' : 'إرسال السؤال'}
                          </button>
                        </form>

                        {qaLoading ? (
                          <p role="status" className="text-center text-sm font-bold text-slate-500 py-6">
                            جاري تحميل النقاشات...
                          </p>
                        ) : qaItems.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-500">
                            لا توجد أسئلة مسجلة لهذه الدورة بعد. كن أول من يطرح سؤالاً!
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {qaItems.map((item) => {
                              const isExpanded = openRepliesId === item.id;
                              const threadReplies = repliesByQuestion[item.id] || [];
                              return (
                                <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <span className="font-black text-slate-700">{item.authorName}</span>
                                    <div className="flex items-center gap-2">
                                      {item.isResolved ? (
                                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-black text-emerald-700">تم الحل</span>
                                      ) : item.authorId === user.id && (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              const csrf = await getCsrfToken();
                                              await contentClient.qaResolve(item.id, csrf);
                                              await loadCourseQA();
                                            } catch {}
                                          }}
                                          className="rounded-lg border border-emerald-200 px-2.5 py-1 font-bold text-emerald-700 hover:bg-emerald-50"
                                        >
                                          تحديد كمحلول
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (isExpanded) {
                                            setOpenRepliesId('');
                                            return;
                                          }
                                          setOpenRepliesId(item.id);
                                          try {
                                            const r = await contentClient.qaReplies(item.id);
                                            setRepliesByQuestion((prev) => ({ ...prev, [item.id]: r.items || [] }));
                                          } catch {}
                                        }}
                                        className="rounded-lg bg-slate-100 px-2.5 py-1 font-bold text-slate-700 hover:bg-slate-200"
                                      >
                                        الردود ({item.repliesCount})
                                      </button>
                                    </div>
                                  </div>
                                  <p className="text-sm font-bold text-slate-900">{item.question}</p>
                                  {item.latestReply && !isExpanded && (
                                    <div className="rounded-xl bg-emerald-50/70 p-3 text-xs text-slate-700">
                                      <span className="font-black text-emerald-800">{item.latestReplyBy || 'المدرب'}: </span>
                                      {item.latestReply}
                                    </div>
                                  )}
                                  {isExpanded && (
                                    <div className="space-y-2 border-t border-slate-100 pt-3">
                                      {threadReplies.map((rep) => (
                                        <div
                                          key={rep.id}
                                          className={`rounded-xl p-3 text-xs ${
                                            rep.isInstructor ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50'
                                          }`}
                                        >
                                          <span className="font-black text-slate-900">
                                            {rep.authorName}{rep.isInstructor ? ' (مدرب)' : ''}:{' '}
                                          </span>
                                          <span className="text-slate-700">{rep.body}</span>
                                        </div>
                                      ))}
                                      <div className="flex gap-2 pt-1">
                                        <input
                                          type="text"
                                          value={replyDrafts[item.id] || ''}
                                          onChange={(e) =>
                                            setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                                          }
                                          placeholder="أضف رداً..."
                                          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                                        />
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            const draft = (replyDrafts[item.id] || '').trim();
                                            if (draft.length < 2) return;
                                            try {
                                              const csrf = await getCsrfToken();
                                              const created = await contentClient.qaCreateReply(
                                                item.id,
                                                draft,
                                                `cqar-${Date.now()}`,
                                                csrf,
                                              );
                                              setReplyDrafts((prev) => ({ ...prev, [item.id]: '' }));
                                              setRepliesByQuestion((prev) => ({
                                                ...prev,
                                                [item.id]: [...(prev[item.id] || []), created.item],
                                              }));
                                              await loadCourseQA();
                                            } catch {}
                                          }}
                                          className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
                                        >
                                          رد
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </article>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* 5. FILES TAB */}
                {activeTab === 'files' && (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-7 text-indigo-800">
                      يمكنك تحميل مذكرات الشرح والملخصات المعتمدة لمراجعتها دون الحاجة للاتصال بالإنترنت.
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filesList.length === 0 && <p className="text-sm font-bold text-gray-500">لا توجد ملفات مرفقة بهذه الدورة حاليًا.</p>}
                      {filesList.map((file) => {
                        const isLocked = file.access !== 'free_preview' && !hasAccess;
                        return (
                          <div
                            key={file.id}
                            className={`rounded-2xl border p-4 flex items-center justify-between gap-3 ${
                              isLocked
                                ? 'bg-amber-50/40 border-amber-200'
                                : 'bg-white border-gray-200 hover:border-indigo-300 shadow-xs'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                                  isLocked ? 'bg-amber-100 text-amber-700' : 'bg-red-50 text-red-600 border border-red-100'
                                }`}
                              >
                                {isLocked ? <Lock size={20} /> : <FileText size={20} />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-black text-gray-900 truncate">{file.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {file.size || 'الحجم غير محدد'} • {isLocked ? 'ضمن شراء الدورة' : 'مفتوح للجميع'}
                                </p>
                              </div>
                            </div>

                            {isLocked ? (
                              <span className="rounded-xl bg-amber-100 p-2 text-xs font-bold text-amber-800">ضمن شراء الدورة</span>
                            ) : courseFileURL(file.url) ? (
                              <a href={courseFileURL(file.url)} target="_blank" rel="noopener noreferrer" download aria-label={`تحميل ${file.title}`} className="rounded-xl border border-gray-200 p-2.5 text-indigo-700"><Download size={18} /></a>
                            ) : (
                              <span className="text-xs font-bold text-gray-500">الرابط غير متاح</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sticky Right Column: Progress / Purchase Card */}
          <div className="lg:sticky lg:top-24 z-30">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden text-gray-900 border border-gray-100">
              {/* Thumbnail / Video Preview */}
              <div className="relative aspect-video bg-slate-900">
                <img
                  src={course.thumbnailUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60'}
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (course.trailerVideoUrl) {
                        setShowTrailerModal(true);
                      } else {
                        onContinue();
                      }
                    }}
                    className="w-14 h-14 rounded-full bg-white/90 text-indigo-600 hover:bg-white hover:scale-105 transition-all shadow-xl flex items-center justify-center cursor-pointer"
                    aria-label="بدء المعاينة أو مشاهدة البرومو"
                  >
                    <PlayCircle size={32} />
                  </button>
                </div>
              </div>

              {/* Price & Actions */}
              <div className="p-5 sm:p-6">
                {!hasAccess ? (
                  <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-right">
                    <div className="text-xs font-bold text-gray-500">السعر</div>
                    <div className="mt-1 flex flex-wrap items-baseline justify-end gap-2">
                      {hasDiscount ? (
                        <span className="text-sm font-bold text-gray-400 line-through">
                          {courseOriginalPrice} {course.currency || 'ر.س'}
                        </span>
                      ) : null}
                      <span className="text-2xl font-black text-amber-600">
                        {isFree ? 'مجاناً' : `${coursePrice} ${course.currency || 'ر.س'}`}
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* Progress bar if accessed */}
                <div className="mb-6">
                  <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
                    <span>نسبة الإنجاز</span>
                    <span className="font-black text-indigo-600">{progressPercent === null ? 'غير متاح' : `${progressPercent}%`}</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-700"
                      style={{ width: `${progressPercent ?? 0}%` }}
                    />
                  </div>
                </div>

                {/* Main Action Button */}
                {hasAccess ? (
                  <button
                    type="button"
                    onClick={() => onContinue()}
                    className="w-full bg-[#1e293b] text-white py-4 rounded-2xl font-black text-lg hover:bg-slate-800 transition-all shadow-lg mb-4 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <PlayCircle size={22} />
                    {progressPercent === null || progressPercent > 0 ? 'متابعة التعلم' : 'ابدأ التعلم الآن'}
                  </button>
                ) : isFree ? (
                  <button
                    type="button"
                    onClick={() => onContinue()}
                    className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-lg mb-4 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    ابدأ مجاناً الآن
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate(`/checkout?courseId=${course.id}`)}
                    className="w-full bg-amber-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-amber-600 transition-all shadow-lg mb-4 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    شراء الدورة الآن
                  </button>
                )}

                {/* Secondary Favorite & Share Buttons */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleToggleFavorite}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 border rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      isFavorite
                        ? 'border-rose-200 bg-rose-50 text-rose-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
                    {isFavorite ? 'في المفضلة' : 'المفضلة'}
                  </button>
                  <button
                    type="button"
                    onClick={handleShareCourse}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <Share2 size={16} />
                    مشاركة
                  </button>
                </div>
              </div>

              {/* Course Details List */}
              <div className="p-5 sm:p-6 border-t border-gray-100 bg-gray-50/50">
                <h4 className="font-black text-gray-800 mb-4 text-sm">تفاصيل الدورة</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Clock size={15} />
                      <span>المدة الإجمالية</span>
                    </div>
                    <span className="font-bold text-gray-700">{durationLabel}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-gray-500">
                      <PlayCircle size={15} />
                      <span>دروس الفيديو</span>
                    </div>
                    <span className="font-bold text-gray-700">{videoLessonsCount} درس</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-gray-500">
                      <BarChart size={15} />
                      <span>الاختبارات المحاكية</span>
                    </div>
                    <span className="font-bold text-gray-700">اختبارات الدورة</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-gray-500">
                      <BookOpen size={15} />
                      <span>إجمالي الدروس</span>
                    </div>
                    <span className="font-bold text-gray-700">{totalLessonsCount} درس</span>
                  </div>
                  {course.certificateEnabled ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-gray-500">
                          <Award size={15} />
                          <span>شهادة الإتمام</span>
                        </div>
                        <span className="font-bold text-emerald-600">معتمدة وموثقة</span>
                      </div>
                      {user && progressPercent === 100 && totalLessonsCount > 0 && (
                        certificate ? (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                            <div className="font-black">تم إصدار شهادتك بنجاح</div>
                            <div className="mt-1 font-mono text-[11px] font-bold">رمز التحقق: {certificate.verificationCode}</div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={certBusy}
                            onClick={async () => {
                              setCertBusy(true);
                              setCertError('');
                              try {
                                const csrf = await getCsrfToken();
                                const res = await lessonProgressSummaryClient.issueCertificate(course.id, csrf);
                                setCertificate(res.certificate);
                              } catch (err) {
                                setCertError(err instanceof Error ? err.message : 'تعذر إصدار الشهادة.');
                              } finally {
                                setCertBusy(false);
                              }
                            }}
                            className="w-full rounded-xl bg-emerald-600 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {certBusy ? 'جاري الإصدار...' : 'إصدار شهادة إتمام الدورة'}
                          </button>
                        )
                      )}
                      {certError && <p className="text-[11px] font-bold text-rose-600">{certError}</p>}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Promo Trailer Modal */}
      {showTrailerModal && course.trailerVideoUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-slate-900 shadow-2xl border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 text-white">
              <div className="flex items-center gap-2">
                <PlayCircle size={20} className="text-indigo-400" />
                <span className="font-black text-sm">الفيديو الترويجي · {course.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTrailerModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="relative aspect-video w-full bg-black">
              {course.trailerVideoUrl.includes('youtube.com') || course.trailerVideoUrl.includes('youtu.be') ? (
                <iframe
                  src={
                    course.trailerVideoUrl.includes('embed')
                      ? course.trailerVideoUrl
                      : course.trailerVideoUrl.includes('v=')
                      ? `https://www.youtube.com/embed/${new URL(course.trailerVideoUrl).searchParams.get('v')}`
                      : `https://www.youtube.com/embed/${course.trailerVideoUrl.split('/').pop()}`
                  }
                  title="Course Promo Video"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={course.trailerVideoUrl}
                  controls
                  autoPlay
                  className="h-full w-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
