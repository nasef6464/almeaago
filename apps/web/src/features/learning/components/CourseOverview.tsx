import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  features?: string[];
  objectives?: string[];
  access?: {
    allowed: boolean;
    configured: boolean;
    reason: string;
  };
}

export interface CourseOverviewProps {
  course: CourseOverviewData;
  initialTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  onContinue: (lessonId?: string) => void;
  isStaffViewer?: boolean;
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
  'مساحة نقاش لطرح الأسئلة وتلقي إجابات من المدربين المعتمدين.',
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
}: CourseOverviewProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [newQuestion, setNewQuestion] = useState('');
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [isFavorite, setIsFavorite] = useState(() => {
    try {
      return localStorage.getItem(`course_fav_${course.id}`) === 'true';
    } catch {
      return false;
    }
  });
  const [shareNotice, setShareNotice] = useState('');
  const [expandedModules, setExpandedModules] = useState<string[]>(() =>
    course.modules.length > 0 ? [course.modules[0].id] : [],
  );

  // Completed lessons from localStorage
  const completedLessonIds = useMemo(() => {
    try {
      const raw = localStorage.getItem('completed_lessons_store');
      if (raw) return new Set<string>(JSON.parse(raw));
    } catch {
      // ignore
    }
    return new Set<string>();
  }, []);

  // QA Threads persistence
  const qaStorageKey = `course_qa_${course.id}`;
  const [qaThreads, setQaThreads] = useState<QaThread[]>(() => {
    try {
      const stored = localStorage.getItem(qaStorageKey);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [
      {
        id: 'qa-1',
        authorName: 'سارة العتيبي',
        authorRole: 'طالبة',
        createdAt: 'منذ يومين',
        question: 'هل الأسئلة في الاختبارات المحاكية تشمل أحدث تجميعات هذا العام؟',
        replies: [
          {
            id: 'rep-1',
            authorName: course.instructorName || 'فريق المنصة',
            authorRole: 'المدرب',
            createdAt: 'منذ يوم',
            text: 'نعم بالتأكيد، يتم تحديث بنك الأسئلة والاختبارات المحاكية بصفة دورية وفق أحدث نماذج القياس.',
            isInstructor: true,
          },
        ],
      },
      {
        id: 'qa-2',
        authorName: 'محمد الغامدي',
        authorRole: 'طالب',
        createdAt: 'منذ ٤ أيام',
        question: 'هل يمكن تحميل المذكرات والملفات المرفقة وطباعتها؟',
        replies: [
          {
            id: 'rep-2',
            authorName: course.instructorName || 'فريق المنصة',
            authorRole: 'المدرب',
            createdAt: 'منذ ٣ أيام',
            text: 'نعم، جميع ملفات الدورة بصيغة PDF قابلة للتحميل والطباعة مباشرة من تبويب ملفات الدورة.',
            isInstructor: true,
          },
        ],
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(qaStorageKey, JSON.stringify(qaThreads));
    } catch {
      // ignore
    }
  }, [qaThreads, qaStorageKey]);

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

  const handleAskQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    const q = newQuestion.trim();
    if (!q) return;

    const newThread: QaThread = {
      id: `qa-${Date.now()}`,
      authorName: 'طالب المنصة',
      authorRole: 'طالب',
      createdAt: 'الآن',
      question: q,
      replies: [],
    };
    setQaThreads((prev) => [newThread, ...prev]);
    setNewQuestion('');
    setExpandedThreadId(newThread.id);
  };

  const handleSendReply = (threadId: string) => {
    const text = (replyText[threadId] || '').trim();
    if (!text) return;

    setQaThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== threadId) return thread;
        return {
          ...thread,
          replies: [
            ...thread.replies,
            {
              id: `rep-${Date.now()}`,
              authorName: isStaffViewer ? (course.instructorName || 'المدرب') : 'طالب المنصة',
              authorRole: isStaffViewer ? 'المدرب' : 'طالب',
              createdAt: 'الآن',
              text,
              isInstructor: isStaffViewer,
            },
          ],
        };
      }),
    );
    setReplyText((prev) => ({ ...prev, [threadId]: '' }));
  };

  // Calculations
  const allLessons = useMemo(() => course.modules.flatMap((m) => m.lessons), [course.modules]);
  const totalLessonsCount = allLessons.length;
  const completedLessonsCount = allLessons.filter((l) => completedLessonIds.has(l.id)).length;
  const progressPercent = totalLessonsCount > 0 ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0;

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

  const testsList = useMemo(() => {
    if (course.assessments && course.assessments.length > 0) {
      return course.assessments;
    }
    // Default preview assessments for the course
    return [
      {
        id: `mock-pre-${course.id}`,
        title: `اختبار تحديد المستوى القبلي - ${course.title}`,
        phase: 'pre_course' as const,
        durationMinutes: 25,
        questionsCount: 20,
        access: 'free_preview' as const,
      },
      {
        id: `mock-mid-${course.id}`,
        title: `اختبار المراجعة النصفية - المهارات الأساسية`,
        phase: 'during_course' as const,
        durationMinutes: 30,
        questionsCount: 25,
        access: 'enrolled_paid' as const,
      },
      {
        id: `mock-final-${course.id}`,
        title: `الاختبار المحاكي الشامل النهائي - معيار قياس`,
        phase: 'final_course' as const,
        durationMinutes: 60,
        questionsCount: 50,
        access: 'enrolled_paid' as const,
      },
    ];
  }, [course.assessments, course.id, course.title]);

  const filesList = useMemo(() => {
    if (course.files && course.files.length > 0) {
      return course.files;
    }
    return [
      {
        id: 'file-1',
        title: `الحقيبة التدريبية الشاملة - ${course.title}.pdf`,
        size: '6.4 ميجابايت',
        access: 'free_preview' as const,
      },
      {
        id: 'file-2',
        title: 'مذكرة القوانين والحلول السريعة المختصرة.pdf',
        size: '3.1 ميجابايت',
        access: 'enrolled_paid' as const,
      },
      {
        id: 'file-3',
        title: 'أوراق العمل ونماذج الواجبات التدريبية.pdf',
        size: '4.8 ميجابايت',
        access: 'enrolled_paid' as const,
      },
    ];
  }, [course.files, course.title]);

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
                  <div className="rounded-2xl border border-slate-700/80 bg-slate-800/80 p-3.5 shadow-sm backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20 text-amber-400 font-black">
                        <Star size={20} className="fill-amber-400 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-400">التقييم</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-white">{(course.rating || 4.9).toFixed(1)}</span>
                          <span className="text-[10px] font-bold text-amber-400">★ ★ ★ ★ ★</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Enrolled Students */}
                  <div className="rounded-2xl border border-slate-700/80 bg-slate-800/80 p-3.5 shadow-sm backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/20 text-emerald-400 font-black">
                        <BarChart size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-400">طلاب مسجل</p>
                        <p className="truncate text-sm font-black text-emerald-400">+{course.studentsCount || 55} طالب</p>
                      </div>
                    </div>
                  </div>

                  {/* Content / Lessons */}
                  <div className="rounded-2xl border border-slate-700/80 bg-slate-800/80 p-3.5 shadow-sm backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/20 text-blue-400 font-black">
                        <BookOpen size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-400">المنهج والمدة</p>
                        <p className="truncate text-sm font-black text-white">
                          {totalLessonsCount} درس {testsList.length > 0 ? `• ${testsList.length} اختبار` : ''}
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
                  الاختبارات ({testsList.length})
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
                  سؤال وجواب ({qaThreads.length})
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
                                        if (!isLocked) onContinue(lesson.id);
                                      }}
                                      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3.5 rounded-xl border transition-all ${
                                        isLocked
                                          ? 'bg-amber-50/40 border-amber-200/60 cursor-not-allowed opacity-90'
                                          : isCompleted
                                            ? 'bg-emerald-50/30 border-emerald-200/60 hover:bg-emerald-50 cursor-pointer'
                                            : 'bg-white border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/20 cursor-pointer'
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
                                          <Lock size={16} className="text-amber-500" />
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
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-7 text-indigo-800">
                      تشمل الدورة حزمة اختبارات محاكية لتحديد المستوى والتدريب المكثف على سرعة الحل ودقة الإجابات قبل الاختبار الفعلي.
                    </div>

                    <div className="space-y-4">
                      {testsList.map((test) => {
                        const isLocked = test.access === 'enrolled_paid' && !hasAccess;
                        const phaseName = test.phase === 'pre_course'
                          ? 'اختبار قبلي'
                          : test.phase === 'final_course'
                            ? 'اختبار نهائي شامل'
                            : 'اختبار تدريبي';

                        return (
                          <div
                            key={test.id}
                            className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all ${
                              isLocked
                                ? 'bg-amber-50/40 border-amber-200'
                                : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-xs'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                  isLocked
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-indigo-100 text-indigo-700'
                                }`}
                              >
                                {isLocked ? <Lock size={22} /> : <Award size={22} />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                    {phaseName}
                                  </span>
                                  {isLocked ? (
                                    <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                                      ضمن شراء الدورة
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                                      متاح الآن
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-base font-black text-gray-900 mt-1">{test.title}</h4>
                                <p className="text-xs text-gray-500 mt-1">
                                  {test.durationMinutes || 30} دقيقة • {test.questionsCount || 20} سؤال
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (isLocked) {
                                  alert('هذا الاختبار متاح للمشتركين في الدورة. يمكنك شراء الدورة أو تفعيل الباقة للبدء.');
                                  return;
                                }
                                navigate(`/assessments?courseId=${course.id}`);
                              }}
                              className={`rounded-xl px-5 py-2.5 text-xs font-black transition-all shadow-xs cursor-pointer ${
                                isLocked
                                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                              }`}
                            >
                              {isLocked ? 'فتح الاختبار' : 'بدء الاختبار ←'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. QA TAB */}
                {activeTab === 'qa' && (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-7 text-indigo-800">
                      هذه المساحة مخصصة للاستفسار عن محتوى الدورة ومتابعة الردود التعليمية من المدربين المعتمدين.
                    </div>

                    {/* Ask Form */}
                    <form onSubmit={handleAskQuestion} className="space-y-3">
                      <div className="relative">
                        <textarea
                          rows={3}
                          value={newQuestion}
                          onChange={(e) => setNewQuestion(e.target.value)}
                          placeholder="اكتب سؤالك أو استفسارك حول منهج الدورة هنا..."
                          className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm font-medium outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={!newQuestion.trim()}
                          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
                        >
                          <Send size={15} />
                          إرسال السؤال
                        </button>
                      </div>
                    </form>

                    {/* Threads List */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                      {qaThreads.map((thread) => {
                        const isExpanded = expandedThreadId === thread.id;
                        return (
                          <div key={thread.id} className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-black flex items-center justify-center text-xs">
                                  {thread.authorName.charAt(0)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-gray-900">{thread.authorName}</span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{thread.authorRole}</span>
                                  </div>
                                  <span className="text-[11px] text-gray-400">{thread.createdAt}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setExpandedThreadId(isExpanded ? null : thread.id)}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                              >
                                <MessageSquare size={14} />
                                {thread.replies.length} ردود
                              </button>
                            </div>

                            <p className="text-sm font-bold text-gray-800 leading-relaxed pr-10">{thread.question}</p>

                            {/* Replies */}
                            {isExpanded && (
                              <div className="pr-10 pt-3 space-y-3 border-t border-gray-100">
                                {thread.replies.map((reply) => (
                                  <div
                                    key={reply.id}
                                    className={`rounded-xl p-3.5 text-xs font-medium space-y-1 ${
                                      reply.isInstructor
                                        ? 'bg-indigo-50/80 border border-indigo-100 text-indigo-950'
                                        : 'bg-slate-50 text-slate-800'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between font-bold">
                                      <div className="flex items-center gap-1.5">
                                        <span>{reply.authorName}</span>
                                        {reply.isInstructor ? (
                                          <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded text-[9px]">رد المدرب</span>
                                        ) : null}
                                      </div>
                                      <span className="text-[10px] text-gray-400">{reply.createdAt}</span>
                                    </div>
                                    <p className="leading-relaxed">{reply.text}</p>
                                  </div>
                                ))}

                                {/* Add Reply */}
                                <div className="flex gap-2 pt-2">
                                  <input
                                    type="text"
                                    value={replyText[thread.id] || ''}
                                    onChange={(e) => setReplyText({ ...replyText, [thread.id]: e.target.value })}
                                    placeholder="أضف رداً..."
                                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:bg-white focus:border-indigo-400"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSendReply(thread.id)}
                                    className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 cursor-pointer"
                                  >
                                    رد
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 5. FILES TAB */}
                {activeTab === 'files' && (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-7 text-indigo-800">
                      يمكنك تحميل مذكرات الشرح والملخصات المعتمدة لمراجعتها دون الحاجة للاتصال بالإنترنت.
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filesList.map((file) => {
                        const isLocked = file.access === 'enrolled_paid' && !hasAccess;
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
                                  {file.size || 'ملف PDF'} • {isLocked ? 'ضمن شراء الدورة' : 'مفتوح للجميع'}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (isLocked) {
                                  alert('هذا الملف متاح للمسجلين في الدورة.');
                                  return;
                                }
                                alert(`جارٍ تحميل: ${file.title}`);
                              }}
                              className={`p-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                                isLocked
                                  ? 'border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200'
                                  : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                              }`}
                              title={isLocked ? 'يحتاج اشتراك' : 'تحميل الملف'}
                            >
                              <Download size={18} />
                            </button>
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
                    onClick={() => onContinue()}
                    className="w-14 h-14 rounded-full bg-white/90 text-indigo-600 hover:bg-white hover:scale-105 transition-all shadow-xl flex items-center justify-center cursor-pointer"
                    aria-label="بدء المعاينة"
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
                    <span className="font-black text-indigo-600">{progressPercent}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-700"
                      style={{ width: `${progressPercent}%` }}
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
                    {progressPercent > 0 ? 'متابعة التعلم' : 'ابدأ التعلم الآن'}
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
                    <span className="font-bold text-gray-700">{testsList.length} اختبار</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-gray-500">
                      <BookOpen size={15} />
                      <span>إجمالي الدروس</span>
                    </div>
                    <span className="font-bold text-gray-700">{totalLessonsCount} درس</span>
                  </div>
                  {course.certificateEnabled ? (
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Award size={15} />
                        <span>شهادة الإتمام</span>
                      </div>
                      <span className="font-bold text-emerald-600">معتمدة وموثقة</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
