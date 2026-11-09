import React, { useState, useMemo, useEffect } from 'react';
import {
  Award, BarChart3, Bell, BookOpen, Calendar, Check, CheckCircle2,
  ChevronLeft, Clock, Copy, Edit2, ExternalLink, Eye, FilePlus2,
  FileText, Filter, HelpCircle, Layers, LayoutGrid, Loader2, MessageSquare,
  Play, Plus, QrCode, RefreshCcw, Search, Send, Settings, Sparkles,
  Star, StickyNote, Target, Trash2, Trophy, Users, Video, X, Zap
} from 'lucide-react';
import { useAuth } from '../../auth/state/AuthProvider';

export interface TrainerCourse {
  id: string;
  title: string;
  category: string;
  pathName: string;
  enrolledStudents: number;
  completionRate: number;
  averageScore: number;
  rating: number;
  approvalStatus: 'draft' | 'pending_review' | 'approved' | 'rejected';
  reviewerNotes?: string;
  price: number;
  updatedAt: string;
}

export interface TrainerLiveSession {
  id: string;
  title: string;
  courseTitle: string;
  scheduledAt: string;
  durationMinutes: number;
  enrolledCount: number;
  status: 'scheduled' | 'live' | 'completed';
  meetingUrl?: string;
  pin: string;
}

export interface TrainerQuizItem {
  id: string;
  title: string;
  courseTitle: string;
  questionCount: number;
  submissionsCount: number;
  avgScore: number;
  workflowStatus: 'approved' | 'rejected';
  kind: 'drill' | 'mock' | 'exam';
  dueDate: string;
}

export interface TrainerQuestionItem {
  id: string;
  text: string;
  subjectName: string;
  difficulty: 'easy' | 'medium' | 'hard';
  version: number;
  workflowStatus: 'approved' | 'rejected';
}

export const PlatformTrainerDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'live-sessions' | 'quizzes' | 'questions' | 'skills' | 'qa'>('overview');
  const [feedback, setFeedback] = useState('');
  const [search, setSearch] = useState('');

  // Courses State
  const [courses, setCourses] = useState<TrainerCourse[]>([
    {
      id: 'tc-1',
      title: 'دورة استراتيجيات الحل السريع للقدرات الكمية 2026',
      category: 'القدرات العامة',
      pathName: 'مسار القدرات العامة (علمي وأدبي)',
      enrolledStudents: 142,
      completionRate: 78,
      averageScore: 84,
      rating: 4.9,
      approvalStatus: 'approved',
      reviewerNotes: 'محتوى متميز وشامل لجميع استراتيجيات الحساب الذهني المعتمدة.',
      price: 299,
      updatedAt: '2026-11-05',
    },
    {
      id: 'tc-2',
      title: 'المعسكر المكثف في التحصيلي العلمي: فيزياء وكيمياء',
      category: 'التحصيلي العلمي',
      pathName: 'مسار التحصيلي العلمي الشامل',
      enrolledStudents: 98,
      completionRate: 64,
      averageScore: 76,
      rating: 4.8,
      approvalStatus: 'approved',
      price: 349,
      updatedAt: '2026-11-02',
    },
    {
      id: 'tc-3',
      title: 'تدريبات مهارات استيعاب المقروء والتناظر اللفظي المتقدم',
      category: 'القدرات اللفظية',
      pathName: 'مسار القدرات العامة',
      enrolledStudents: 65,
      completionRate: 42,
      averageScore: 71,
      rating: 4.7,
      approvalStatus: 'pending_review',
      reviewerNotes: 'بانتظار اعتماد المراجعة النهائية لوحدات التناظر اللفظي الجديدة.',
      price: 199,
      updatedAt: '2026-11-08',
    },
  ]);

  // Live Sessions State
  const [liveSessions, setLiveSessions] = useState<TrainerLiveSession[]>([
    {
      id: 'tls-1',
      title: 'بث تدريبي تفاعلي: حل أصعب تجميعات الهندسة والحساب الذهني',
      courseTitle: 'دورة استراتيجيات الحل السريع للقدرات الكمية 2026',
      scheduledAt: 'اليوم · 06:30 م',
      durationMinutes: 60,
      enrolledCount: 84,
      status: 'live',
      pin: '849201',
      meetingUrl: '/classroom/tls-1/projector',
    },
    {
      id: 'tls-2',
      title: 'ورشة مراجعة قوانين الحركة والموجات للتحصيلي',
      courseTitle: 'المعسكر المكثف في التحصيلي العلمي: فيزياء وكيمياء',
      scheduledAt: 'غداً · 07:00 م',
      durationMinutes: 90,
      enrolledCount: 62,
      status: 'scheduled',
      pin: '394821',
      meetingUrl: '/classroom/tls-2/projector',
    },
  ]);

  // Quizzes State with 6 Exact Legacy Parity Actions
  const [quizzes, setQuizzes] = useState<TrainerQuizItem[]>([
    {
      id: 'tq-1',
      title: 'اختبار دوري: التناسب الطردي والعكسي والكسور',
      courseTitle: 'دورة استراتيجيات الحل السريع للقدرات الكمية 2026',
      questionCount: 20,
      submissionsCount: 118,
      avgScore: 82,
      workflowStatus: 'approved',
      kind: 'exam',
      dueDate: '2026-11-15',
    },
    {
      id: 'tq-2',
      title: 'تدريب تشخيصي: ميكانيكا الكم والديناميكا الحرارية',
      courseTitle: 'المعسكر المكثف في التحصيلي العلمي: فيزياء وكيمياء',
      questionCount: 15,
      submissionsCount: 74,
      avgScore: 68,
      workflowStatus: 'approved',
      kind: 'drill',
      dueDate: '2026-11-18',
    },
    {
      id: 'tq-3',
      title: 'محاكي قياس الكامل: قدرات تجريبي الأسبوع الرابع',
      courseTitle: 'دورة استراتيجيات الحل السريع للقدرات الكمية 2026',
      questionCount: 40,
      submissionsCount: 92,
      avgScore: 79,
      workflowStatus: 'rejected',
      kind: 'mock',
      dueDate: '2026-11-22',
    },
  ]);

  // Questions State
  const [questions, setQuestions] = useState<TrainerQuestionItem[]>([
    {
      id: 't-qst-1',
      text: 'إذا زادت سرعة سيارة بنسبة 20% ونقص زمن الرحلة 20%، فما نسبة التغير في المسافة؟',
      subjectName: 'قدرات كمي - سرعة ومسافة',
      difficulty: 'hard',
      version: 1,
      workflowStatus: 'approved',
    },
    {
      id: 't-qst-2',
      text: 'ما الحد التالي في المتتابعة: 2 ، 6 ، 14 ، 30 ، 62 ، ... ؟',
      subjectName: 'قدرات كمي - متتابعات',
      difficulty: 'medium',
      version: 2,
      workflowStatus: 'approved',
    },
    {
      id: 't-qst-3',
      text: 'جسم كتلته 5 كجم يتحرك بتسارع 4 م/ث²، فما مقدار القوة المحصلة المؤثرة عليه؟',
      subjectName: 'تحصيلي فيزياء - قوانين نيوتن',
      difficulty: 'easy',
      version: 1,
      workflowStatus: 'approved',
    },
  ]);

  // Modals
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [showScheduleLiveModal, setShowScheduleLiveModal] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<TrainerQuestionItem | null>(null);

  // New Course Draft
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseCategory, setNewCourseCategory] = useState('القدرات العامة');
  const [newCoursePrice, setNewCoursePrice] = useState(199);

  // New Live Session
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newSessionDuration, setNewSessionDuration] = useState(60);

  const toggleQuizStatus = (quizId: string) => {
    setQuizzes((prev) =>
      prev.map((q) => {
        if (q.id === quizId) {
          const next = q.workflowStatus === 'approved' ? 'rejected' : 'approved';
          setFeedback(next === 'approved' ? `✅ تم اعتماد الاختبار "${q.title}"` : `⚠️ تم رفض/إعادة مراجعة الاختبار "${q.title}"`);
          setTimeout(() => setFeedback(''), 3000);
          return { ...q, workflowStatus: next };
        }
        return q;
      })
    );
  };

  const toggleQuestionStatus = (qId: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === qId) {
          const next = q.workflowStatus === 'approved' ? 'rejected' : 'approved';
          setFeedback(next === 'approved' ? '✅ تم اعتماد السؤال بنجاح' : '⚠️ تم رفض / استبعاد السؤال');
          setTimeout(() => setFeedback(''), 3000);
          return { ...q, workflowStatus: next };
        }
        return q;
      })
    );
  };

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim()) return;
    const item: TrainerCourse = {
      id: `tc-${Date.now()}`,
      title: newCourseTitle.trim(),
      category: newCourseCategory,
      pathName: newCourseCategory.includes('تحصيلي') ? 'مسار التحصيلي العلمي' : 'مسار القدرات العامة',
      enrolledStudents: 0,
      completionRate: 0,
      averageScore: 0,
      rating: 5.0,
      approvalStatus: 'pending_review',
      reviewerNotes: 'مسودة جديدة أُرسلت للمراجعة والاعتماد من قبل إدارة المنصة.',
      price: newCoursePrice,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    setCourses([item, ...courses]);
    setNewCourseTitle('');
    setShowCreateCourseModal(false);
    setFeedback(`✅ تم إنشاء مسودة الدورة "${item.title}" وإرسالها للمراجعة`);
    setTimeout(() => setFeedback(''), 4000);
  };

  const handleScheduleSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionTitle.trim()) return;
    const session: TrainerLiveSession = {
      id: `tls-${Date.now()}`,
      title: newSessionTitle.trim(),
      courseTitle: courses[0]?.title || 'الدورة التدريبية المعتمدة',
      scheduledAt: newSessionDate || 'غداً · 08:00 م',
      durationMinutes: newSessionDuration,
      enrolledCount: 0,
      status: 'scheduled',
      pin: String(Math.floor(100000 + Math.random() * 900000)),
      meetingUrl: `/classroom/session-${Date.now()}/projector`,
    };
    setLiveSessions([session, ...liveSessions]);
    setNewSessionTitle('');
    setShowScheduleLiveModal(false);
    setFeedback(`✅ تم جدولة اللقاء التدريبي المباشر بنجاح (PIN: ${session.pin})`);
    setTimeout(() => setFeedback(''), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20" dir="rtl">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-l from-indigo-900 via-indigo-950 to-slate-950 text-white border-b border-indigo-800/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-black mb-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600/60 text-white">
                  <Star size={13} className="fill-amber-400 text-amber-400" />
                </span>
                <span>مدرب منصة المئة المعتمد (Platform Coach Workspace)</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
                لوحة مدرب المنصة
                <span className="text-sm font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 rounded-full">
                  أ. طارق المحمدي
                </span>
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-indigo-200/80 max-w-2xl leading-relaxed">
                إدارة دوراتك التدريبية المركزية، بث اللقاءات المباشرة، متابعة المتدربين، بنك الأسئلة والاختبارات المعتمدة، وتحليل الأداء والتقييمات.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowScheduleLiveModal(true)}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 px-5 py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
              >
                <Video size={16} /> جدولة لقاء تدريبي حي
              </button>
              <button
                type="button"
                onClick={() => setShowCreateCourseModal(true)}
                className="flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-5 py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
              >
                <FilePlus2 size={16} /> إنشاء دورة جديدة
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4">
        {/* Navigation Tabs */}
        <div className="bg-white rounded-3xl p-2 shadow-sm border border-slate-100 flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'overview', label: 'نظرة عامة', icon: LayoutGrid },
            { id: 'courses', label: 'دوراتي ومساراتي', icon: BookOpen },
            { id: 'live-sessions', label: 'اللقاءات المباشرة', icon: Video },
            { id: 'quizzes', label: 'الاختبارات والتقييمات', icon: FileText },
            { id: 'questions', label: 'بنك الأسئلة والتمارين', icon: Target },
            { id: 'skills', label: 'رادار إتقان المتدربين', icon: Award },
            { id: 'qa', label: 'استفسارات الطلاب (12)', icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-black text-emerald-800 animate-fade-in flex items-center justify-between">
            <span>{feedback}</span>
            <button type="button" onClick={() => setFeedback('')} className="text-emerald-600 hover:text-emerald-800">
              <X size={16} />
            </button>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="mt-6 space-y-6 animate-fade-in">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">إجمالي المتدربين</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Users size={16} />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-black text-slate-900">305 طالب</div>
                <div className="mt-1 text-[11px] font-bold text-emerald-600">+18% هذا الشهر</div>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">الدورات النشطة</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <BookOpen size={16} />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-black text-slate-900">{courses.length} دورات</div>
                <div className="mt-1 text-[11px] font-bold text-indigo-600">2 معتمدة · 1 بانتظار المراجعة</div>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">متوسط نتائج الاختبارات</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Target size={16} />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-black text-slate-900">81.4%</div>
                <div className="mt-1 text-[11px] font-bold text-emerald-600">مستوى إتقان متقدم</div>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">تقييم المدرب العام</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Star size={16} className="fill-amber-500 text-amber-500" />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-black text-slate-900">4.9 / 5.0</div>
                <div className="mt-1 text-[11px] font-bold text-slate-500">من 215 تقييم موثق</div>
              </div>
            </div>

            {/* Performance Verified Section */}
            <div className="rounded-3xl border border-indigo-100 bg-gradient-to-l from-indigo-50/70 via-white to-white p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-indigo-100 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white font-bold">
                    <BarChart3 size={20} />
                  </span>
                  <div>
                    <h2 className="text-base font-black text-slate-900">أداء موثّق من محرك التعلّم المركزي (Learning Insights)</h2>
                    <p className="text-xs text-slate-500">إحصائيات الإكمال الفعلي ومحاولات الاختبارات ومستحقات التدريب.</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                  حساب مدرب نشط وموثق ✓
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
                <div className="rounded-2xl bg-white p-4 border border-slate-100">
                  <div className="text-xs font-bold text-slate-500">إكمال قابل للقياس</div>
                  <div className="mt-1.5 text-xl font-black text-slate-900">72%</div>
                  <div className="mt-1 text-[11px] text-slate-400">متوسط إتمام دروس الدورات</div>
                </div>
                <div className="rounded-2xl bg-white p-4 border border-slate-100">
                  <div className="text-xs font-bold text-slate-500">محاولات الاختبارات</div>
                  <div className="mt-1.5 text-xl font-black text-slate-900">284 محاولة</div>
                  <div className="mt-1 text-[11px] text-emerald-600">معدل اجتياز 88%</div>
                </div>
                <div className="rounded-2xl bg-white p-4 border border-slate-100">
                  <div className="text-xs font-bold text-slate-500">مستحقات التدريب المقدرة</div>
                  <div className="mt-1.5 text-xl font-black text-indigo-700">6,420 ر.س</div>
                  <div className="mt-1 text-[11px] text-slate-400">دورة الصرف القادمة: نهاية الشهر</div>
                </div>
              </div>
            </div>

            {/* Quick Live Session Now Banner */}
            {liveSessions.some((s) => s.status === 'live') && (
              <div className="rounded-3xl border border-rose-200 bg-rose-50/50 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
                  </span>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">لديك لقاء تدريبي مباشر جارٍ الآن!</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {liveSessions.find((s) => s.status === 'live')?.title} · PIN: <b className="text-indigo-800">{liveSessions.find((s) => s.status === 'live')?.pin}</b>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('live-sessions')}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 px-5 py-2 text-xs font-black text-white transition-all shadow-xs"
                >
                  دخول شاشة البث المباشر ←
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COURSES */}
        {activeTab === 'courses' && (
          <div className="mt-6 space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">دوراتي التدريبية المعتمدة</h2>
                <p className="text-xs text-slate-500 mt-0.5">أنشئ دورة جديدة، أرسلها للمراجعة والاعتماد، وتابع ملاحظات الإدارة ومبيعات الدورة.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateCourseModal(true)}
                className="flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-black text-white shadow-sm"
              >
                <Plus size={16} /> إضافة دورة تدريبية
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {courses.map((c) => (
                <div key={c.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-black text-indigo-700">
                        {c.category}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                        c.approvalStatus === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : c.approvalStatus === 'pending_review'
                          ? 'bg-amber-50 text-amber-700 border border-amber-100'
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {c.approvalStatus === 'approved' ? 'معتمدة ✓' : c.approvalStatus === 'pending_review' ? 'بانتظار المراجعة ⏳' : 'تحتاج تعديل ⚠️'}
                      </span>
                    </div>

                    <h3 className="mt-3 text-base font-black text-slate-900 leading-snug">{c.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 font-bold">{c.pathName}</p>

                    {c.reviewerNotes && (
                      <div className="mt-3 rounded-2xl bg-amber-50/70 border border-amber-100 p-3 text-xs text-amber-900 flex items-start gap-2">
                        <StickyNote size={15} className="shrink-0 text-amber-600 mt-0.5" />
                        <div>
                          <b className="block font-black">ملاحظة المراجع:</b>
                          {c.reviewerNotes}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-xl bg-slate-50 p-2">
                        <span className="text-[10px] text-slate-400 block font-bold">الطلاب</span>
                        <b className="text-slate-900 font-black">{c.enrolledStudents}</b>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2">
                        <span className="text-[10px] text-slate-400 block font-bold">الإكمال</span>
                        <b className="text-emerald-700 font-black">{c.completionRate}%</b>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2">
                        <span className="text-[10px] text-slate-400 block font-bold">التقييم</span>
                        <b className="text-amber-700 font-black">★ {c.rating}</b>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-slate-900">{c.price} ر.س</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setFeedback(`معاينة دورة: ${c.title}`);
                          setTimeout(() => setFeedback(''), 3000);
                        }}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg text-xs font-bold"
                        title="معاينة كطالب"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFeedback(`تعديل دورة: ${c.title}`);
                          setTimeout(() => setFeedback(''), 3000);
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-bold"
                        title="تعديل"
                      >
                        <Edit2 size={15} />
                      </button>
                      {c.approvalStatus !== 'approved' && (
                        <button
                          type="button"
                          onClick={() => {
                            setCourses((prev) => prev.map((item) => item.id === c.id ? { ...item, approvalStatus: 'pending_review' } : item));
                            setFeedback(`✅ تم إرسال "${c.title}" للمراجعة والاعتماد`);
                            setTimeout(() => setFeedback(''), 3000);
                          }}
                          className="flex items-center gap-1 rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-[11px] font-black text-white"
                        >
                          <Send size={12} /> إرسال للمراجعة
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: LIVE SESSIONS */}
        {activeTab === 'live-sessions' && (
          <div className="mt-6 space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">اللقاءات التدريبية الحية (Live Streaming)</h2>
                <p className="text-xs text-slate-500 mt-0.5">بث مباشر تفاعلي مع المتدربين، مشاركة الشاشة، وحل التجميعات الفورية.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleLiveModal(true)}
                className="flex items-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 px-4 py-2.5 text-xs font-black text-white shadow-sm"
              >
                <Video size={16} /> جدولة لقاء جديد
              </button>
            </div>

            <div className="space-y-4">
              {liveSessions.map((ls) => (
                <div
                  key={ls.id}
                  className={`rounded-3xl border p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    ls.status === 'live' ? 'border-rose-300 bg-rose-50/40' : 'border-slate-100 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-black ${
                      ls.status === 'live' ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-100 text-slate-700'
                    }`}>
                      <Video size={22} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                          ls.status === 'live' ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {ls.status === 'live' ? '● بث مباشر الآن' : 'مجدول'}
                        </span>
                        <span className="text-xs font-bold text-slate-500">{ls.scheduledAt}</span>
                      </div>
                      <h3 className="mt-1.5 text-base font-black text-slate-900">{ls.title}</h3>
                      <p className="text-xs text-indigo-700 font-bold mt-0.5">{ls.courseTitle}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-center rounded-2xl bg-slate-50 border border-slate-200/60 px-4 py-2">
                      <span className="text-[10px] text-slate-400 block font-bold">رمز الدخول PIN</span>
                      <b className="text-base font-black text-slate-900" dir="ltr">{ls.pin}</b>
                    </div>
                    {ls.status === 'live' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setFeedback(`دخول البث المباشر: ${ls.title}`);
                          setTimeout(() => setFeedback(''), 3000);
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-5 py-2.5 text-xs font-black text-white shadow-sm"
                      >
                        <Play size={14} /> دخول البث التفاعلي
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setLiveSessions((prev) => prev.map((item) => item.id === ls.id ? { ...item, status: 'live' } : item));
                          setFeedback(`🚀 تم بدء البث المباشر للقاء "${ls.title}"`);
                          setTimeout(() => setFeedback(''), 4000);
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-black text-white"
                      >
                        <Play size={14} /> بدء البث الآن
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: QUIZZES WITH EXACT LEGACY ACTIONS */}
        {activeTab === 'quizzes' && (
          <div className="mt-6 space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">اختباراتي وتقييماتي التدريبية</h2>
                <p className="text-xs text-slate-500 mt-0.5">تقييمات دورات القدرات والتحصيلي مع عناصر التحكم والاعتماد الستة المطابقة للنظام القديم.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newQ: TrainerQuizItem = {
                    id: `tq-${Date.now()}`,
                    title: 'تدريب دوري جديد: الحساب الذهني المتقدم',
                    courseTitle: courses[0]?.title || 'دورة القدرات الكمية',
                    questionCount: 15,
                    submissionsCount: 0,
                    avgScore: 0,
                    workflowStatus: 'approved',
                    kind: 'drill',
                    dueDate: '2026-11-25',
                  };
                  setQuizzes([newQ, ...quizzes]);
                  setFeedback(`✅ تم إنشاء التدريب "${newQ.title}" بنجاح!`);
                  setTimeout(() => setFeedback(''), 4000);
                }}
                className="flex items-center gap-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-black text-white shadow-sm"
              >
                <Plus size={16} /> إنشاء اختبار / تدريب
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    {/* Top Badges & Action Buttons (Exact Match to User Screenshot) */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-black text-indigo-700">
                          {quiz.kind === 'mock' ? 'محاكي' : quiz.kind === 'drill' ? 'تدريب' : 'اختبار'}
                        </span>
                        {quiz.workflowStatus === 'rejected' ? (
                          <button
                            type="button"
                            onClick={() => toggleQuizStatus(quiz.id)}
                            className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-black text-rose-700 border border-rose-100 hover:bg-rose-100 transition-colors"
                            title="حالة الاعتماد: مرفوض (انقر للتبديل)"
                          >
                            رفض
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleQuizStatus(quiz.id)}
                            className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition-colors"
                            title="حالة الاعتماد: معتمد (انقر للتبديل)"
                          >
                            معتمد
                          </button>
                        )}
                      </div>

                      {/* The 4 Exact Action Icons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setFeedback(`✅ تم نسخ الاختبار "${quiz.title}" إلى الحافظة`);
                            setTimeout(() => setFeedback(''), 3000);
                          }}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="نسخ الاختبار"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFeedback(`معاينة الاختبار: ${quiz.title}`);
                            setTimeout(() => setFeedback(''), 3000);
                          }}
                          className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                          title="معاينة الاختبار"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFeedback(`تعديل الاختبار: ${quiz.title}`);
                            setTimeout(() => setFeedback(''), 3000);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="تعديل وتوجيه"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setQuizzes((prev) => prev.filter((item) => item.id !== quiz.id));
                            setFeedback(`🗑️ تم حذف الاختبار "${quiz.title}"`);
                            setTimeout(() => setFeedback(''), 3000);
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <h3 className="mt-3 font-black text-slate-900 text-sm leading-snug">{quiz.title}</h3>
                    <p className="text-xs text-indigo-700 font-bold mt-1">{quiz.courseTitle}</p>

                    <div className="mt-4 space-y-2 text-xs font-bold text-slate-500">
                      <div className="flex justify-between">
                        <span>الإجابات المكتملة</span>
                        <span className="text-slate-900 font-black">{quiz.submissionsCount} متدرب</span>
                      </div>
                      <div className="flex justify-between">
                        <span>متوسط الدرجات</span>
                        <span className="text-emerald-700 font-black">{quiz.avgScore}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>تاريخ الاستحقاق</span>
                        <span>{quiz.dueDate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400">{quiz.questionCount} سؤال معتمد</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFeedback(`✅ تم إرسال تذكير إشعاري للمتدربين المتأخرين في "${quiz.title}"`);
                        setTimeout(() => setFeedback(''), 3500);
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      تذكير المتأخرين ←
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: QUESTIONS BANK */}
        {activeTab === 'questions' && (
          <div className="mt-6 space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">بنك الأسئلة والتمارين للمدرب</h2>
                <p className="text-xs text-slate-500 mt-0.5">أسئلتك التدريبية المعتمدة مع أدوات المعاينة والنسخ والتعديل الكاملة.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const q: TrainerQuestionItem = {
                    id: `t-qst-${Date.now()}`,
                    text: 'سؤال تدريبي جديد: حساب مساحة الأشكال المركبة والمظللة',
                    subjectName: 'قدرات كمي - هندسة',
                    difficulty: 'medium',
                    version: 1,
                    workflowStatus: 'approved',
                  };
                  setQuestions([q, ...questions]);
                  setFeedback(`✅ تم إضافة سؤال جديد لبنك تحضيرك الخاص`);
                  setTimeout(() => setFeedback(''), 3000);
                }}
                className="flex items-center gap-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-black text-white shadow-sm"
              >
                <Plus size={16} /> إضافة سؤال جديد
              </button>
            </div>

            <div className="space-y-3">
              {questions.map((q) => (
                <div key={q.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 leading-relaxed">{q.text}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-bold text-slate-500">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5">{q.subjectName}</span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5">صعوبة: {q.difficulty === 'hard' ? 'صعب' : q.difficulty === 'medium' ? 'متوسط' : 'سهل'}</span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5">الإصدار {q.version}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* Status Toggle */}
                    {q.workflowStatus === 'rejected' ? (
                      <button
                        type="button"
                        onClick={() => toggleQuestionStatus(q.id)}
                        className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-black text-rose-700 border border-rose-100 hover:bg-rose-100 transition-colors"
                        title="حالة الاعتماد: مرفوض (انقر للتبديل)"
                      >
                        رفض
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleQuestionStatus(q.id)}
                        className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition-colors"
                        title="حالة الاعتماد: معتمد (انقر للتبديل)"
                      >
                        معتمد
                      </button>
                    )}

                    <div className="flex items-center gap-1 border-r border-slate-200 pr-2 mr-1">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(q.text);
                          setFeedback(`✅ تم نسخ السؤال إلى الحافظة`);
                          setTimeout(() => setFeedback(''), 3000);
                        }}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="نسخ"
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewQuestion(q)}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                        title="معاينة"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFeedback(`تعديل السؤال: ${q.text.slice(0, 30)}...`);
                          setTimeout(() => setFeedback(''), 3000);
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="تعديل"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuestions((prev) => prev.filter((item) => item.id !== q.id));
                          setFeedback(`🗑️ تم حذف السؤال من بنك التحضير`);
                          setTimeout(() => setFeedback(''), 3000);
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: SKILLS RADAR */}
        {activeTab === 'skills' && (
          <div className="mt-6 space-y-6 animate-fade-in">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Award className="text-indigo-600" size={22} /> رادار إتقان المهارات لطلاب الدورات
              </h2>
              <p className="text-xs text-slate-500 mt-1">تشخيص فوري للمهارات الأكثر إتقاناً والمهارات الحرجة التي تتطلب تدخلاً تدريبياً.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {[
                  { skill: 'المتتابعات الحسابية والهندسية', accuracy: 88, status: 'متقن 🟢' },
                  { skill: 'الكسور والعمليات الحسابية السريعة', accuracy: 82, status: 'متقن 🟢' },
                  { skill: 'التناسب الطردي والعكسي وسرعة الحل', accuracy: 64, status: 'يحتاج دعم 🟡' },
                  { skill: 'الهندسة الإحداثية والمساحات المظللة', accuracy: 58, status: 'حرج 🔴' },
                  { skill: 'استيعاب المقروء وتحليل النصوص', accuracy: 85, status: 'متقن 🟢' },
                  { skill: 'التناظر اللفظي والعلاقات المنطقية', accuracy: 91, status: 'متقن 🟢' },
                ].map((sk) => (
                  <div key={sk.skill} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-black text-slate-900">{sk.skill}</span>
                      <span className="text-[10px] font-bold">{sk.status}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-black">
                      <span className="text-slate-500">نسبة الإتقان</span>
                      <span className={sk.accuracy < 65 ? 'text-rose-600' : 'text-emerald-700'}>{sk.accuracy}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${sk.accuracy < 65 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{ width: `${sk.accuracy}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: Q&A */}
        {activeTab === 'qa' && (
          <div className="mt-6 space-y-4 animate-fade-in">
            <h2 className="text-xl font-black text-slate-900">استفسارات المتدربين وأسئلة الدروس</h2>
            <div className="space-y-3">
              {[
                { id: 'qa-1', student: 'محمد الدوسري', course: 'دورة استراتيجيات الحل السريع', question: 'يا أستاذ، في مسألة التناسب العكسي هل دائماً نضرب بشكل أفقي بدلاً من المقص؟', time: 'منذ ساعتين', answered: false },
                { id: 'qa-2', student: 'ريان الغامدي', course: 'المعسكر المكثف في التحصيلي العلمي', question: 'هل التسارع في الحركة الدائرية المنتظمة يساوي صفراً أم يتجه نحو المركز؟', time: 'منذ 5 ساعات', answered: true, reply: 'أهلاً ريان، التسارع الخطي ثابت، لكن يوجد تسارع مركزي يتجه دائماً نحو مركز الدائرة.' },
              ].map((item) => (
                <div key={item.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-black text-xs">
                        {item.student.slice(0, 1)}
                      </div>
                      <div>
                        <b className="text-xs font-black text-slate-900 block">{item.student}</b>
                        <span className="text-[10px] text-slate-400 font-bold">{item.course} · {item.time}</span>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${item.answered ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {item.answered ? 'تم الرد ✓' : 'بانتظار ردك ⏳'}
                    </span>
                  </div>

                  <p className="mt-3 text-xs sm:text-sm font-bold text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    {item.question}
                  </p>

                  {item.reply ? (
                    <div className="mt-3 mr-4 p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-900">
                      <b className="block font-black text-indigo-950 mb-1">ردك:</b>
                      {item.reply}
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        placeholder="اكتب ردك التوجيهي للطالب..."
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setFeedback(`✅ تم إرسال الرد للطالب ${item.student}`);
                          setTimeout(() => setFeedback(''), 3000);
                        }}
                        className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-black text-white hover:bg-indigo-700"
                      >
                        إرسال الرد
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Course Modal */}
      {showCreateCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FilePlus2 className="text-indigo-600" size={18} /> إنشاء دورة تدريبية جديدة
              </h3>
              <button type="button" onClick={() => setShowCreateCourseModal(false)} className="rounded-xl p-1 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عنوان الدورة التدريبية</label>
                <input
                  type="text"
                  required
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  placeholder="مثال: المعسكر التدريبي المكثف لاجتياز القدرات 2026"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف والمسار</label>
                  <select
                    value={newCourseCategory}
                    onChange={(e) => setNewCourseCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="القدرات العامة">القدرات العامة</option>
                    <option value="التحصيلي العلمي">التحصيلي العلمي</option>
                    <option value="القدرات اللفظية">القدرات اللفظية</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">السعر (ر.س)</label>
                  <input
                    type="number"
                    min="0"
                    value={newCoursePrice}
                    onChange={(e) => setNewCoursePrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-indigo-50/70 border border-indigo-100 p-3 text-xs text-indigo-900 leading-relaxed">
                ℹ️ بعد إنشاء مسودة الدورة، ستُرفع لإدارة المنصة للمراجعة والاعتماد الفوري لنشرها أمام المتدربين.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCourseModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white hover:bg-indigo-700 shadow-sm"
                >
                  حفظ وإرسال للمراجعة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Live Session Modal */}
      {showScheduleLiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Video className="text-amber-500" size={18} /> جدولة لقاء تدريبي حي ومباشر
              </h3>
              <button type="button" onClick={() => setShowScheduleLiveModal(false)} className="rounded-xl p-1 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleScheduleSession} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عنوان اللقاء التدريبي</label>
                <input
                  type="text"
                  required
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  placeholder="مثال: ورشة حل التجميعات المليونية وتحديات السرعة"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الموعد المقترح</label>
                  <input
                    type="text"
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                    placeholder="مثال: غداً · 08:00 م"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المدة (بالدقائق)</label>
                  <select
                    value={newSessionDuration}
                    onChange={(e) => setNewSessionDuration(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value={45}>45 دقيقة</option>
                    <option value={60}>60 دقيقة (ساعة)</option>
                    <option value={90}>90 دقيقة (ساعة ونصف)</option>
                    <option value={120}>120 دقيقة (ساعتان)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleLiveModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-500 hover:bg-amber-600 px-5 py-2 text-xs font-black text-white shadow-sm"
                >
                  تأكيد الجدولة وتوليد الـ PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Question Preview Modal */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                  <Eye size={18} />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900">معاينة السؤال التدريبي</h3>
                  <span className="text-[10px] text-slate-400 font-bold">المعرف: {previewQuestion.id} · الإصدار {previewQuestion.version}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewQuestion(null)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-sm font-black text-slate-900 leading-relaxed">{previewQuestion.text}</p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-black text-slate-700">خيارات الإجابة:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold">
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700">أ) الخيار الأول</div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700">ب) الخيار الثاني</div>
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-2.5 text-emerald-800 flex items-center justify-between">
                  <span>ج) الخيار الصحيح (المعتمد)</span>
                  <Check size={14} className="text-emerald-600" />
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700">د) الخيار الرابع</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-black text-emerald-700 border border-emerald-100">
                معتمد ✓
              </span>
              <button
                type="button"
                onClick={() => setPreviewQuestion(null)}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-black text-white hover:bg-slate-800"
              >
                إغلاق المعاينة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
