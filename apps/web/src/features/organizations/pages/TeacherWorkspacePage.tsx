import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowRight, Award, BarChart3, Bell,
  Bookmark, BookOpenCheck, Calendar, CheckCircle, CheckCircle2, ChevronRight,
  Clock3, Copy, Dumbbell, Edit2, ExternalLink, Eye, Filter, GraduationCap, LayoutDashboard,
  LayoutGrid, ListFilter, Loader2, LogOut, Plus, Presentation, Radio, RefreshCw, RotateCcw,
  School, Search, Send, SlidersHorizontal, Sparkles, Square, Target, Trash2, Trophy, UserCheck,
  Users, UsersRound, X, Zap
} from 'lucide-react';

import { useAuth } from '../../auth/state/AuthProvider';
import { organizationsClient, type TeacherWorkspace, type TeacherWorkspaceSchool, type TeacherWorkspaceAssignment } from '../api/organizations-client';
import { classroomClient } from '../../classroom/api/classroom-client';
import type { ClassroomSession } from '../../classroom/api/classroom-types';
import { TeacherCertificateModal } from '../components/TeacherCertificateModal';
import { TeacherSmartClassroomSchedulerModal } from '../components/TeacherSmartClassroomSchedulerModal';
import { TeacherClassroomReportsSection } from '../components/TeacherClassroomReportsSection';
import { TeacherPreparedQuestionsManager } from '../components/TeacherPreparedQuestionsManager';
import { SupervisorTestsManager } from '../components/SupervisorTestsManager';

export type TeacherTab =
  | 'overview'
  | 'smart-classroom'
  | 'prepared-questions'
  | 'reports'
  | 'skills-radar'
  | 'assessments'
  | 'certificates';

const TEACHER_NAV_ITEMS: Array<{ id: TeacherTab; label: string; icon: React.ReactNode; badge?: string | number }> = [
  { id: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard size={19} /> },
  { id: 'smart-classroom', label: 'إدارة الحصص والجدول', icon: <Presentation size={19} />, badge: 'بث حي' },
  { id: 'prepared-questions', label: 'بنك التحضير المسبق', icon: <Target size={19} /> },
  { id: 'reports', label: 'تقارير الحصص والمهارات', icon: <BarChart3 size={19} /> },
  { id: 'skills-radar', label: 'رادار فجوات الفصول', icon: <Award size={19} /> },
  { id: 'assessments', label: 'اختباراتي وتكليفاتي', icon: <BookOpenCheck size={19} /> },
  { id: 'certificates', label: 'شهادات التقدير والتحفيز', icon: <Trophy size={19} /> },
];

export interface TeacherAssessmentItem {
  id: string;
  title: string;
  kind: 'test' | 'drill' | 'mock';
  className: string;
  workflowStatus: 'approved' | 'rejected' | 'pending' | 'draft';
  isPublished: boolean;
  dueDate?: string;
  totalQuestions: number;
  participantsCount: number;
  totalStudents: number;
  avgScore: number;
}

export function TeacherWorkspacePage() {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const requestedTab = (searchParams.get('tab') as TeacherTab) || 'overview';
  const [activeTab, setActiveTab] = useState<TeacherTab>(
    TEACHER_NAV_ITEMS.some((i) => i.id === requestedTab) ? requestedTab : 'overview'
  );

  const [workspace, setWorkspace] = useState<TeacherWorkspace | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Modals
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [showCreateAssessmentModal, setShowCreateAssessmentModal] = useState(false);
  const [targetClassForLaunch, setTargetClassForLaunch] = useState('');

  // Real active session detection
  const [activeSession, setActiveSession] = useState<ClassroomSession | null>(null);

  // Mock teacher assessments with exact legacy parity
  const [teacherAssessments, setTeacherAssessments] = useState<TeacherAssessmentItem[]>([
    {
      id: 'teach-quiz-1',
      title: 'اختبار دوري: مسائل الحساب الذهني والتناسب',
      kind: 'test',
      className: 'الصف الثالث الثانوي (أ)',
      workflowStatus: 'approved',
      isPublished: true,
      dueDate: '2026-11-15',
      totalQuestions: 15,
      participantsCount: 18,
      totalStudents: 22,
      avgScore: 82,
    },
    {
      id: 'teach-quiz-2',
      title: 'تدريب علاجي: مهارات الجبر والكسور العشرية',
      kind: 'drill',
      className: 'الصف الثالث الثانوي (ب)',
      workflowStatus: 'approved',
      isPublished: true,
      dueDate: '2026-11-18',
      totalQuestions: 10,
      participantsCount: 12,
      totalStudents: 20,
      avgScore: 64,
    },
    {
      id: 'teach-quiz-3',
      title: 'اختبار مقترح: الهندسة التحليلية وحساب المثلثات (بانتظار المشرف)',
      kind: 'test',
      className: 'الصف الثالث الثانوي (أ)',
      workflowStatus: 'rejected',
      isPublished: false,
      totalQuestions: 12,
      participantsCount: 0,
      totalStudents: 22,
      avgScore: 0,
    },
  ]);

  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizKind, setNewQuizKind] = useState<'test' | 'drill' | 'mock'>('test');
  const [newQuizClass, setNewQuizClass] = useState('');

  const isTeacher = Boolean(
    user?.role === 'teacher' ||
    user?.roles?.includes('teacher') ||
    user?.role === 'admin' ||
    user?.roles?.includes('admin')
  );

  // Load teacher workspace
  const loadWorkspace = useCallback(async () => {
    if (authLoading || !isTeacher) return;
    setBusy(true);
    setError('');
    try {
      const res = await organizationsClient.teacherWorkspace();
      setWorkspace(res);
      if (res.schools.length > 0 && !selectedSchoolId) {
        setSelectedSchoolId(res.schools[0].schoolId);
      }
    } catch (err: any) {
      setError(err?.message || 'تعذر تحميل مساحة المعلم');
    } finally {
      setBusy(false);
    }
  }, [authLoading, isTeacher, selectedSchoolId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  // Check for active sessions on interval
  const checkActiveSessions = useCallback(async () => {
    try {
      const res = await classroomClient.teacherSessions();
      const live = (res.sessions || []).find((s) => s.status === 'live');
      setActiveSession(live || null);
    } catch {
      setActiveSession(null);
    }
  }, []);

  useEffect(() => {
    void checkActiveSessions();
    const interval = setInterval(() => void checkActiveSessions(), 6000);
    return () => clearInterval(interval);
  }, [checkActiveSessions]);

  const selectedSchool: TeacherWorkspaceSchool | undefined = useMemo(() => {
    if (!workspace || workspace.schools.length === 0) return undefined;
    return workspace.schools.find((s) => s.schoolId === selectedSchoolId) || workspace.schools[0];
  }, [workspace, selectedSchoolId]);

  const teacherClasses = useMemo(() => {
    return (selectedSchool?.assignments || []).map((a) => ({
      id: a.classId,
      name: a.className,
    }));
  }, [selectedSchool]);

  const teacherStudents = useMemo(() => [
    { id: '018f0000-0000-7000-8000-000000000005', name: 'فيصل بن سعد', className: 'الصف الثالث الثانوي (أ)' },
    { id: 'st-2', name: 'سارة خالد المنصور', className: 'الصف الثالث الثانوي (أ)' },
    { id: 'st-3', name: 'محمد الدوسري', className: 'الصف الثالث الثانوي (ب)' },
    { id: 'st-4', name: 'ريان الغامدي', className: 'الصف الثالث الثانوي (ب)' },
  ], []);

  // Multi-Dimensional Skills Filter States (Tab 5)
  const [skillLevelFilter, setSkillLevelFilter] = useState<'all' | 'critical' | 'watch' | 'mastered'>('all');
  const [skillPathFilter, setSkillPathFilter] = useState<string>('all');
  const [skillSubjectFilter, setSkillSubjectFilter] = useState<string>('all');
  const [skillClassFilter, setSkillClassFilter] = useState<string>('all');
  const [skillGradeFilter, setSkillGradeFilter] = useState<string>('all');
  const [skillStudentFilter, setSkillStudentFilter] = useState<string>('all');
  const [skillSearchQuery, setSkillSearchQuery] = useState<string>('');
  const [skillsViewMode, setSkillsViewMode] = useState<'cards' | 'matrix'>('cards');
  const [activeSkillForDrawer, setActiveSkillForDrawer] = useState<any | null>(null);

  const [teacherSkills] = useState([
    {
      id: 'sk-1',
      skill: 'المتتابعات الحسابية والهندسية',
      pathId: 'qudrat',
      pathName: 'القدرات العامة',
      subjectName: 'القدرات الكمي',
      gradeName: 'الصف الثالث الثانوي',
      classId: '018f0000-0000-7000-9100-000000000001',
      className: 'الصف الثالث الثانوي (أ)',
      mastery: 54,
      attempts: 24,
      atRiskStudents: [
        { id: '018f0000-0000-7000-8000-000000000005', name: 'فيصل بن سعد', score: 52, status: 'حرجة', class: 'الصف الثالث الثانوي (أ)' },
        { id: 'st-5', name: 'عمر القحطاني', score: 48, status: 'حرجة', class: 'الصف الثالث الثانوي (أ)' },
        { id: 'st-6', name: 'عبدالله الشهري', score: 55, status: 'حرجة', class: 'الصف الثالث الثانوي (أ)' },
      ],
    },
    {
      id: 'sk-2',
      skill: 'الكسور والعمليات الحسابية السريعة',
      pathId: 'qudrat',
      pathName: 'القدرات العامة',
      subjectName: 'القدرات الكمي',
      gradeName: 'الصف الثالث الثانوي',
      classId: '018f0000-0000-7000-9100-000000000002',
      className: 'الصف الثالث الثانوي (ب)',
      mastery: 62,
      attempts: 30,
      atRiskStudents: [
        { id: 'st-3', name: 'محمد الدوسري', score: 50, status: 'حرجة', class: 'الصف الثالث الثانوي (ب)' },
        { id: 'st-7', name: 'ياسر الحربي', score: 64, status: 'قيد التعزيز', class: 'الصف الثالث الثانوي (ب)' },
      ],
    },
    {
      id: 'sk-3',
      skill: 'التناسب الطردي والعكسي',
      pathId: 'qudrat',
      pathName: 'القدرات العامة',
      subjectName: 'القدرات الكمي',
      gradeName: 'الصف الثالث الثانوي',
      classId: '018f0000-0000-7000-9100-000000000001',
      className: 'الصف الثالث الثانوي (أ)',
      mastery: 78,
      attempts: 28,
      atRiskStudents: [
        { id: 'st-8', name: 'سلطان العتيبي', score: 68, status: 'قيد التعزيز', class: 'الصف الثالث الثانوي (أ)' },
      ],
    },
    {
      id: 'sk-4',
      skill: 'الهندسة الإحداثية والمساحات',
      pathId: 'qudrat',
      pathName: 'القدرات العامة',
      subjectName: 'القدرات الكمي',
      gradeName: 'الصف الثالث الثانوي',
      classId: '018f0000-0000-7000-9100-000000000002',
      className: 'الصف الثالث الثانوي (ب)',
      mastery: 71,
      attempts: 22,
      atRiskStudents: [
        { id: 'st-3', name: 'محمد الدوسري', score: 58, status: 'حرجة', class: 'الصف الثالث الثانوي (ب)' },
        { id: 'st-4', name: 'ريان الغامدي', score: 70, status: 'قيد التعزيز', class: 'الصف الثالث الثانوي (ب)' },
      ],
    },
    {
      id: 'sk-5',
      skill: 'التناظر اللفظي والعلاقات المنطقية',
      pathId: 'qudrat',
      pathName: 'القدرات العامة',
      subjectName: 'القدرات اللفظي',
      gradeName: 'الصف الثالث الثانوي',
      classId: '018f0000-0000-7000-9100-000000000001',
      className: 'الصف الثالث الثانوي (أ)',
      mastery: 89,
      attempts: 35,
      atRiskStudents: [],
    },
    {
      id: 'sk-6',
      skill: 'استيعاب المقروء وتحليل النصوص',
      pathId: 'qudrat',
      pathName: 'القدرات العامة',
      subjectName: 'القدرات اللفظي',
      gradeName: 'الصف الثالث الثانوي',
      classId: '018f0000-0000-7000-9100-000000000002',
      className: 'الصف الثالث الثانوي (ب)',
      mastery: 84,
      attempts: 26,
      atRiskStudents: [
        { id: 'st-4', name: 'ريان الغامدي', score: 72, status: 'قيد التعزيز', class: 'الصف الثالث الثانوي (ب)' },
      ],
    },
    {
      id: 'sk-7',
      skill: 'حساب المثلثات والمتطابقات التحصيلية',
      pathId: 'tahsili',
      pathName: 'التحصيلي العلمي',
      subjectName: 'رياضيات',
      gradeName: 'الصف الثالث الثانوي',
      classId: '018f0000-0000-7000-9100-000000000001',
      className: 'الصف الثالث الثانوي (أ)',
      mastery: 58,
      attempts: 20,
      atRiskStudents: [
        { id: '018f0000-0000-7000-8000-000000000005', name: 'فيصل بن سعد', score: 55, status: 'حرجة', class: 'الصف الثالث الثانوي (أ)' },
        { id: 'st-2', name: 'سارة خالد المنصور', score: 62, status: 'قيد التعزيز', class: 'الصف الثالث الثانوي (أ)' },
      ],
    },
    {
      id: 'sk-8',
      skill: 'قوانين نيوتن وحفظ الطاقة الحركية',
      pathId: 'tahsili',
      pathName: 'التحصيلي العلمي',
      subjectName: 'فيزياء',
      gradeName: 'الصف الثالث الثانوي',
      classId: '018f0000-0000-7000-9100-000000000002',
      className: 'الصف الثالث الثانوي (ب)',
      mastery: 66,
      attempts: 18,
      atRiskStudents: [
        { id: 'st-3', name: 'محمد الدوسري', score: 54, status: 'حرجة', class: 'الصف الثالث الثانوي (ب)' },
      ],
    },
  ]);

  const filteredSkillsList = useMemo(() => {
    return teacherSkills.filter((sk) => {
      if (skillLevelFilter === 'critical' && sk.mastery >= 60) return false;
      if (skillLevelFilter === 'watch' && (sk.mastery < 60 || sk.mastery >= 75)) return false;
      if (skillLevelFilter === 'mastered' && sk.mastery < 75) return false;
      if (skillPathFilter !== 'all' && sk.pathId !== skillPathFilter) return false;
      if (skillSubjectFilter !== 'all' && !sk.subjectName.includes(skillSubjectFilter)) return false;
      if (skillClassFilter !== 'all' && sk.classId !== skillClassFilter && sk.className !== skillClassFilter) return false;
      if (skillGradeFilter !== 'all' && !sk.gradeName.includes(skillGradeFilter)) return false;
      if (skillStudentFilter !== 'all' && !sk.atRiskStudents.some((st) => st.id === skillStudentFilter)) return false;
      if (skillSearchQuery.trim()) {
        const q = skillSearchQuery.trim().toLowerCase();
        const matchName = sk.skill.toLowerCase().includes(q);
        const matchSubject = sk.subjectName.toLowerCase().includes(q);
        const matchClass = sk.className.toLowerCase().includes(q);
        if (!matchName && !matchSubject && !matchClass) return false;
      }
      return true;
    });
  }, [
    teacherSkills,
    skillLevelFilter,
    skillPathFilter,
    skillSubjectFilter,
    skillClassFilter,
    skillGradeFilter,
    skillStudentFilter,
    skillSearchQuery,
  ]);

  const hasActiveSkillFilters =
    skillLevelFilter !== 'all' ||
    skillPathFilter !== 'all' ||
    skillSubjectFilter !== 'all' ||
    skillClassFilter !== 'all' ||
    skillGradeFilter !== 'all' ||
    skillStudentFilter !== 'all' ||
    skillSearchQuery.trim() !== '';

  const resetSkillFilters = () => {
    setSkillLevelFilter('all');
    setSkillPathFilter('all');
    setSkillSubjectFilter('all');
    setSkillClassFilter('all');
    setSkillGradeFilter('all');
    setSkillStudentFilter('all');
    setSkillSearchQuery('');
  };

  const handleTabChange = (tab: TeacherTab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const openScheduler = (classId = '') => {
    setTargetClassForLaunch(classId);
    setShowSchedulerModal(true);
  };

  const handleEndActiveSession = async () => {
    if (!activeSession) return;
    try {
      const csrf = await getCsrfToken().catch(() => '');
      await classroomClient.end(activeSession.id, csrf);
      setActiveSession(null);
      setFeedback('✅ تم إنهاء الحصة الذكية بنجاح وحفظ تقريرها.');
      setTimeout(() => setFeedback(''), 4000);
      void checkActiveSessions();
    } catch (err: any) {
      setFeedback('❌ حدث خطأ أثناء إنهاء الحصة: ' + (err?.message || ''));
    }
  };

  const toggleAssessmentStatus = (id: string) => {
    setTeacherAssessments((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const next = a.workflowStatus === 'approved' ? 'rejected' : 'approved';
          setFeedback(next === 'approved' ? `✅ تم اعتماد ونشر الاختبار "${a.title}"` : `⚠️ تم رفض/إعادة مراجعة الاختبار "${a.title}"`);
          setTimeout(() => setFeedback(''), 3000);
          return { ...a, workflowStatus: next };
        }
        return a;
      })
    );
  };

  const handleCreateAssessment = () => {
    if (!newQuizTitle.trim()) return;
    const item: TeacherAssessmentItem = {
      id: `teach-quiz-${Date.now()}`,
      title: newQuizTitle.trim(),
      kind: newQuizKind,
      className: newQuizClass || selectedSchool?.assignments[0]?.className || 'الصف الثالث الثانوي (أ)',
      workflowStatus: 'approved',
      isPublished: true,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      totalQuestions: 15,
      participantsCount: 0,
      totalStudents: 22,
      avgScore: 0,
    };
    setTeacherAssessments([item, ...teacherAssessments]);
    setNewQuizTitle('');
    setShowCreateAssessmentModal(false);
    setFeedback(`✅ تم إنشاء واعتماد الاختبار "${item.title}" وإضافته لفصولك المسندة!`);
    setTimeout(() => setFeedback(''), 4000);
  };

  if (authLoading || busy) {
    return (
      <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 flex flex-col items-center justify-center p-10 font-black">
        <Loader2 className="animate-spin text-indigo-600 mb-3" size={32} />
        <span>جاري تحميل مساحة المعلم الذكية...</span>
      </main>
    );
  }

  if (!isTeacher) {
    return (
      <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 flex flex-col items-center justify-center p-10 font-black text-rose-700">
        هذه المساحة مخصصة للمعلم المخول فقط.
      </main>
    );
  }

  const studentsCount = selectedSchool?.assignments.reduce((sum, a) => sum + (a.studentCount || 0), 0) || 0;

  return (
    <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 px-3 py-5 sm:px-6" data-testid="teacher-workspace">
      <div className="mx-auto max-w-7xl grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* ========================================================= */}
        {/* SIDEBAR: EXACT 1:1 LEGACY STRUCTURE & BADGES */}
        {/* ========================================================= */}
        <aside className="rounded-3xl border border-slate-200/80 bg-white py-6 shadow-sm self-start sticky top-24">
          <div className="mb-6 px-6">
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs mb-1">
              <School size={15} /> مساحة مدرسة معتمدة (B2B)
            </div>
            <h1 className="text-lg font-black text-slate-900">لوحة معلم المدرسة</h1>
            <p className="text-xs text-slate-500 mt-0.5">{selectedSchool?.schoolName || 'مدارس المئة النموذجية'}</p>

            {workspace && workspace.schools.length > 1 && (
              <div className="mt-3">
                <select
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
                >
                  {workspace.schools.map((s) => (
                    <option key={s.schoolId} value={s.schoolId}>{s.schoolName}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <nav aria-label="تنقل لوحة معلم المدرسة" className="space-y-1 px-3">
            {TEACHER_NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-right transition-all text-xs font-bold ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-black border-r-4 border-indigo-600 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={isActive ? 'text-indigo-600' : 'text-slate-400'}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Instant Session Launcher */}
          <div className="mt-8 px-4">
            <button
              type="button"
              onClick={() => openScheduler()}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 p-3 text-xs font-black text-white shadow-md hover:from-indigo-700 hover:to-indigo-800 active:scale-95 transition-all"
            >
              <Presentation size={15} /> بدء حصة ذكية فورية 🚀
            </button>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* MAIN WORKSPACE CONTENT AREA */}
        {/* ========================================================= */}
        <section className="min-w-0 space-y-6">
          {/* Active Session Pulsing Alert Banner */}
          {activeSession && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-indigo-500 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 p-5 text-white shadow-xl animate-fade-in">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600/30 border border-indigo-400/40 text-indigo-300">
                  <Presentation size={24} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-xs font-black text-emerald-300">
                      ● حصة ذكية جارية الآن
                    </span>
                    <span className="text-xs font-bold text-indigo-200">
                      (رمز الدخول PIN: {sessionStorage.getItem(`almeaa:classroom:pin:${activeSession.id}`) || 'مباشر'})
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm sm:text-base font-black text-white">
                    لديك حصة تفاعلية نشطة تبث للطلاب حالياً
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate(`/school-teacher-dashboard/classroom?schoolId=${selectedSchool?.schoolId || ''}&assignmentId=${selectedSchool?.assignments[0]?.assignmentId || ''}`)}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-5 py-2.5 text-xs font-black text-slate-950 shadow-md active:scale-95 transition-all"
                >
                  العودة لشاشة الحصة 🚀
                </button>
                <button
                  type="button"
                  onClick={handleEndActiveSession}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-400/40 bg-rose-500/20 px-3.5 py-2.5 text-xs font-bold text-rose-200 hover:bg-rose-500/30 transition-all"
                >
                  إنهاء الحصة 🛑
                </button>
              </div>
            </div>
          )}

          {feedback && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 shadow-2xs">
              {feedback}
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              <header className="rounded-3xl bg-gradient-to-l from-indigo-800 via-indigo-900 to-slate-900 p-6 sm:p-8 text-white shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <span className="rounded-md bg-indigo-500/30 px-2.5 py-1 text-xs font-black text-indigo-200">
                      مساحة تعليمية مدرسية معتمدة
                    </span>
                    <h1 className="mt-3 text-2xl sm:text-3xl font-black">
                      مرحباً بك، {user?.name || 'أستاذ المادة'} 👋
                    </h1>
                    <p className="mt-2 text-xs sm:text-sm text-indigo-100 max-w-xl leading-6 font-medium">
                      من هنا تدير فصولك المسندة في {selectedSchool?.schoolName || 'المدرسة'}، وتبدأ الحصص التفاعلية، وتتابع الفجوات الصفية.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => openScheduler()}
                      className="flex items-center gap-1.5 rounded-2xl bg-indigo-500 hover:bg-indigo-600 px-4 py-3 text-xs font-black text-white shadow-md active:scale-95 transition-all"
                    >
                      <Presentation size={16} /> بدء حصة ذكية
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCertificateModal(true)}
                      className="flex items-center gap-1.5 rounded-2xl bg-amber-500 hover:bg-amber-600 px-4 py-3 text-xs font-black text-white shadow-md active:scale-95 transition-all"
                    >
                      <Trophy size={16} /> إصدار شهادة تقدير
                    </button>
                  </div>
                </div>
              </header>

              {/* Today's Priority Banner */}
              <section data-testid="teacher-today-focus" className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black text-indigo-600">الأولوية اليوم</p>
                    <h2 className="mt-1 text-base font-black text-slate-900">ابدأ من فصلك، ثم راجع الفجوات.</h2>
                    <p className="mt-1 text-xs font-bold text-slate-500">الحصة أولًا، والمتابعة بعد ظهور الأدلة.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openScheduler()}
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-black text-white"
                    >
                      ابدأ حصة
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTabChange('reports')}
                      className="rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 px-4 py-2 text-xs font-black text-indigo-700"
                    >
                      راجع الفجوات
                    </button>
                  </div>
                </div>
              </section>

              {/* 4 Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">طلاب فصولي</span>
                    <UsersRound size={20} className="text-emerald-600" />
                  </div>
                  <div className="mt-3 text-2xl font-black text-slate-900">{studentsCount || 4}</div>
                  <p className="mt-1 text-[11px] text-slate-400">مسجلون فعلياً في فصولك</p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">الحصص الذكية</span>
                    <Presentation size={20} className="text-indigo-600" />
                  </div>
                  <div className="mt-3 text-2xl font-black text-slate-900">مفعلة 🟢</div>
                  <p className="mt-1 text-[11px] text-slate-400">جاهزة للبث التفاعلي</p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">اختبارات المدرسة</span>
                    <BookOpenCheck size={20} className="text-amber-600" />
                  </div>
                  <div className="mt-3 text-2xl font-black text-slate-900">{teacherAssessments.length}</div>
                  <p className="mt-1 text-[11px] text-slate-400">اختبارات موجهة لفصولك</p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">المدرسة الحالية</span>
                    <School size={20} className="text-purple-600" />
                  </div>
                  <div className="mt-3 text-sm font-black text-slate-900 truncate">
                    {selectedSchool?.schoolName || 'مدارس المئة'}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">كود الإسناد الرسمي</p>
                </div>
              </div>

              {/* Assigned Classes */}
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-black text-slate-900">فصولي المسندة وجدول الحصص</h2>
                  <span className="text-xs text-slate-400">اضغط على أي فصل لبدء الحصة الذكية مباشرة</span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {(selectedSchool?.assignments || []).map((assignment) => (
                    <div
                      key={assignment.assignmentId}
                      className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 hover:border-indigo-200 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-black text-slate-900 text-base">{assignment.className}</span>
                          <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">
                            القدرات العامة
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          المادة: القدرات العامة والتحصيلي · نظام الحصص الذكية المباشر
                        </p>
                        <p className="mt-1 text-xs font-bold text-emerald-700">
                          {assignment.studentCount || 2} طلاب مسجلين
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => openScheduler(assignment.classId)}
                          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-black text-white active:scale-95 transition-all"
                        >
                          <Presentation size={14} /> بدء حصة ذكية لهذا الفصل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTabChange('reports')}
                          className="text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors"
                        >
                          تقارير الفصل ←
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Roster Preview */}
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
                <div className="mb-4">
                  <h2 className="text-base font-black text-slate-900">قائمة طلاب فصولي المسندة</h2>
                  <p className="mt-1 text-xs text-slate-500">تقرأ من إسنادك المدرسي فقط؛ لا تظهر طلاب أي مدرسة أو فصل آخر.</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { id: 'st-1', name: 'فيصل بن سعد', class: 'الصف الثالث الثانوي (أ)', status: 'نشط 🟢', lastScore: '94%' },
                    { id: 'st-2', name: 'سارة خالد المنصور', class: 'الصف الثالث الثانوي (أ)', status: 'نشط 🟢', lastScore: '88%' },
                    { id: 'st-3', name: 'محمد الدوسري', class: 'الصف الثالث الثانوي (ب)', status: 'بحاجة لدعم 🟡', lastScore: '52%' },
                    { id: 'st-4', name: 'ريان الغامدي', class: 'الصف الثالث الثانوي (ب)', status: 'نشط 🟢', lastScore: '76%' },
                  ].map((st) => (
                    <div key={st.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 flex items-center justify-between">
                      <div>
                        <h4 className="font-black text-xs text-slate-900">{st.name}</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">{st.class}</p>
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-black text-indigo-700 block">{st.lastScore}</span>
                        <span className="text-[10px] text-emerald-600 font-bold">{st.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SMART CLASSROOM */}
          {activeTab === 'smart-classroom' && (
            <div className="space-y-6 animate-fade-in">
              <div className="rounded-3xl border border-indigo-100 bg-gradient-to-l from-indigo-50/90 via-white to-white p-6 sm:p-8 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold">
                        <Presentation size={20} />
                      </span>
                      <h2 className="text-xl font-black text-slate-900">مركز إدارة وإطلاق الحصص الذكية</h2>
                    </div>
                    <p className="mt-2 text-xs sm:text-sm text-slate-600 max-w-xl leading-6 font-medium">
                      يتيح لك النظام نمطين متكاملين: بث <b>سؤال تحدي فردي سريع ⚡</b> أو <b>حزمة أسئلة متكاملة 📚</b> مع إمكانية التبديل اللحظي وعرض شاشة البروجكتور الذكية.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openScheduler()}
                    className="flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-6 py-3 text-xs sm:text-sm font-black text-white shadow-md active:scale-95 transition-all"
                  >
                    <Zap size={16} /> إطلاق حصة الآن (تحديد اليوم والحصة) 🚀
                  </button>
                </div>
              </div>

              {/* Mode Options Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-black text-sm text-amber-950 mb-2">
                      <Zap size={18} className="text-amber-600" /> النمط الأول: سؤال تحدي سريع فردي ⚡
                    </div>
                    <p className="text-xs text-amber-900/80 leading-5 font-medium">
                      بث فوري لسؤال واحد سريع بمهلة 30 أو 45 أو 60 ثانية مع نقاط مضاعفة ورادار استجابات لحظي لكشف الفهم وكسر رتابة الحصة.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openScheduler()}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-black text-amber-700 hover:text-amber-900"
                  >
                    إطلاق تحدي سريع الآن ←
                  </button>
                </div>

                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-black text-sm text-indigo-950 mb-2">
                      <Bookmark size={18} className="text-indigo-600" /> النمط الثاني: حزمة أسئلة صفية متتابعة 📚
                    </div>
                    <p className="text-xs text-indigo-900/80 leading-5 font-medium">
                      إطلاق جلسة تدريب صفي متتابعة من 2 إلى 10 أسئلة مجهزة مسبقاً، مع رابط السبورة التفاعلية للبروجكتور وكشف الأسئلة سؤالاً بعد سؤال.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTabChange('prepared-questions')}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-black text-indigo-700 hover:text-indigo-900"
                  >
                    تحضير وتجهيز الحزم مسبقاً ←
                  </button>
                </div>
              </div>

              {/* Direct Class Launcher Grid */}
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
                <h3 className="text-sm font-black text-slate-900 mb-4">اختر الفصل الدراسي لبدء الحصة التفاعلية</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(selectedSchool?.assignments || []).map((assignment) => (
                    <div
                      key={assignment.assignmentId}
                      className="rounded-2xl border border-slate-100 p-4 bg-slate-50/50 hover:bg-white hover:border-indigo-200 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <p className="font-black text-slate-900 text-sm">{assignment.className}</p>
                        <p className="text-xs text-slate-500 mt-1">القدرات العامة · {assignment.studentCount || 0} طلاب</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openScheduler(assignment.classId)}
                        className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-700 active:scale-95 transition-all"
                      >
                        <Presentation size={13} /> إطلاق الحصة
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PREPARED QUESTIONS */}
          {activeTab === 'prepared-questions' && (
            <TeacherPreparedQuestionsManager
              schoolId={selectedSchool?.schoolId || ''}
              classId={selectedSchool?.assignments[0]?.classId || ''}
              subjectId={selectedSchool?.assignments[0]?.subjectId || '01a19398-9241-70ff-a58d-949395434579'}
              onLaunchPreparedPackage={(qIds, chIds) => {
                openScheduler();
              }}
            />
          )}

          {/* TAB 4: REPORTS */}
          {activeTab === 'reports' && (
            <TeacherClassroomReportsSection
              schoolId={selectedSchool?.schoolId || ''}
              assignments={selectedSchool?.assignments || []}
              onPrepareIntervention={(skillOrClass) => {
                setShowCreateAssessmentModal(true);
              }}
            />
          )}

          {/* TAB 5: SKILLS RADAR */}
          {activeTab === 'skills-radar' && (
            <div className="space-y-6 animate-fade-in" data-testid="teacher-skills-radar">
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
                      <Award className="text-indigo-600" size={22} /> رادار فجوات الفصول وتحليل الإتقان
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      فلترة دقيقة للمهارات حسب المسارات والمواد والمراحل والفصول والطلاب · تصنيف القوة والضعف والتدخل الفوري.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* View Switcher: Cards vs Matrix */}
                    <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setSkillsViewMode('cards')}
                        className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black transition-all cursor-pointer ${
                          skillsViewMode === 'cards' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <LayoutGrid size={14} />
                        <span>بطاقات المهارات</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSkillsViewMode('matrix')}
                        className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black transition-all cursor-pointer ${
                          skillsViewMode === 'matrix' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <ListFilter size={14} />
                        <span>مصفوفة الفصول</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCreateAssessmentModal(true)}
                      className="flex items-center gap-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-black text-white shadow-sm transition-all"
                    >
                      <Zap size={14} /> إنشاء تدريب علاجي للمهارات الضعيفة
                    </button>
                  </div>
                </div>

                {/* MULTI-DIMENSIONAL SKILLS FILTER TOOLBAR */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-3 text-xs font-black text-slate-700">
                    <span className="flex items-center gap-1.5 text-indigo-700">
                      <Filter size={15} /> فلترة منظومة المهارات الشاملة (منع التكدس)
                    </span>
                    <span className="text-slate-500 font-bold">
                      عرض <span className="text-indigo-600 font-black">{filteredSkillsList.length}</span> من أصل <span className="text-slate-900">{teacherSkills.length}</span> مهارة
                    </span>
                  </div>

                  {/* 6 Dropdowns Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {/* 1. Mastery Level */}
                    <div>
                      <label className="text-[11px] font-black text-slate-600 mb-1 block">مستوى التمكن</label>
                      <select
                        value={skillLevelFilter}
                        onChange={(e) => setSkillLevelFilter(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        <option value="all">كل المستويات</option>
                        <option value="critical">مهارات حرجة (&lt; 60%)</option>
                        <option value="watch">قيد التعزيز (60% - 74%)</option>
                        <option value="mastered">مهارات متقنة (≥ 75%)</option>
                      </select>
                    </div>

                    {/* 2. Path */}
                    <div>
                      <label className="text-[11px] font-black text-slate-600 mb-1 block">المسار التعليمي</label>
                      <select
                        value={skillPathFilter}
                        onChange={(e) => setSkillPathFilter(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        <option value="all">كل المسارات</option>
                        <option value="qudrat">القدرات العامة</option>
                        <option value="tahsili">التحصيلي العلمي</option>
                        <option value="nafes">نافس الوطني</option>
                      </select>
                    </div>

                    {/* 3. Subject */}
                    <div>
                      <label className="text-[11px] font-black text-slate-600 mb-1 block">المادة الدراسية</label>
                      <select
                        value={skillSubjectFilter}
                        onChange={(e) => setSkillSubjectFilter(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        <option value="all">كل المواد</option>
                        <option value="القدرات الكمي">القدرات الكمي</option>
                        <option value="القدرات اللفظي">القدرات اللفظي</option>
                        <option value="رياضيات">رياضيات التحصيلي</option>
                        <option value="فيزياء">فيزياء التحصيلي</option>
                      </select>
                    </div>

                    {/* 4. Class */}
                    <div>
                      <label className="text-[11px] font-black text-slate-600 mb-1 block">الفصل المسند</label>
                      <select
                        value={skillClassFilter}
                        onChange={(e) => setSkillClassFilter(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        <option value="all">كل فصولي المسندة</option>
                        {(selectedSchool?.assignments || []).map((c) => (
                          <option key={c.classId} value={c.classId}>{c.className}</option>
                        ))}
                      </select>
                    </div>

                    {/* 5. Grade */}
                    <div>
                      <label className="text-[11px] font-black text-slate-600 mb-1 block">المرحلة الدراسية</label>
                      <select
                        value={skillGradeFilter}
                        onChange={(e) => setSkillGradeFilter(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        <option value="all">كل المراحل</option>
                        <option value="الثالث الثانوي">الصف الثالث الثانوي</option>
                        <option value="الثاني الثانوي">الصف الثاني الثانوي</option>
                      </select>
                    </div>

                    {/* 6. Specific Student */}
                    <div>
                      <label className="text-[11px] font-black text-slate-600 mb-1 block">تحديد الطالب</label>
                      <select
                        value={skillStudentFilter}
                        onChange={(e) => setSkillStudentFilter(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        <option value="all">كل الطلاب</option>
                        {teacherStudents.map((s) => (
                          <option key={s.id} value={s.id}>{s.name} ({s.className})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Search & Reset */}
                  <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                    <div className="relative flex-1">
                      <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={skillSearchQuery}
                        onChange={(e) => setSkillSearchQuery(e.target.value)}
                        placeholder="بحث باسم المهارة أو المادة أو الفصل..."
                        className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-10 pl-4 text-xs font-medium focus:border-indigo-500 focus:outline-none transition-all"
                      />
                      {skillSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setSkillSearchQuery('')}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {hasActiveSkillFilters && (
                      <button
                        type="button"
                        onClick={resetSkillFilters}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer shrink-0"
                      >
                        <RotateCcw size={13} />
                        <span>إعادة ضبط فلاتر المهارات</span>
                      </button>
                    )}
                  </div>

                  {/* Active Chips */}
                  {hasActiveSkillFilters && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/60 text-xs">
                      <span className="font-bold text-slate-500 ml-1">تصفية المهارات النشطة:</span>
                      {skillLevelFilter !== 'all' && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                          المستوى: {skillLevelFilter === 'critical' ? 'حرجة' : skillLevelFilter === 'watch' ? 'قيد التعزيز' : 'متقنة'}
                          <button type="button" onClick={() => setSkillLevelFilter('all')}><X size={11} /></button>
                        </span>
                      )}
                      {skillPathFilter !== 'all' && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                          المسار: {skillPathFilter === 'qudrat' ? 'القدرات العامة' : skillPathFilter === 'tahsili' ? 'التحصيلي العلمي' : 'نافس الوطني'}
                          <button type="button" onClick={() => setSkillPathFilter('all')}><X size={11} /></button>
                        </span>
                      )}
                      {skillSubjectFilter !== 'all' && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                          المادة: {skillSubjectFilter}
                          <button type="button" onClick={() => setSkillSubjectFilter('all')}><X size={11} /></button>
                        </span>
                      )}
                      {skillClassFilter !== 'all' && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                          الفصل: {(selectedSchool?.assignments || []).find((c) => c.classId === skillClassFilter)?.className || skillClassFilter}
                          <button type="button" onClick={() => setSkillClassFilter('all')}><X size={11} /></button>
                        </span>
                      )}
                      {skillStudentFilter !== 'all' && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                          الطالب: {teacherStudents.find((s) => s.id === skillStudentFilter)?.name || skillStudentFilter}
                          <button type="button" onClick={() => setSkillStudentFilter('all')}><X size={11} /></button>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* View 1: Cards View */}
                {skillsViewMode === 'cards' ? (
                  filteredSkillsList.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-16 text-center shadow-xs">
                      <Target size={40} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-sm font-black text-slate-700">لا توجد مهارات تطابق هذه التصفية</p>
                      <p className="text-xs text-slate-400 mt-1">جرّب إلغاء بعض الفلاتر لاستعراض باقي المهارات الأكاديمية لفصولك.</p>
                      <button
                        type="button"
                        onClick={resetSkillFilters}
                        className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
                      >
                        عرض جميع مهارات فصولي
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredSkillsList.map((sk) => {
                        const isCritical = sk.mastery < 60;
                        const isWatch = sk.mastery >= 60 && sk.mastery < 75;
                        const cardBg = isCritical ? 'border-rose-200 bg-rose-50/20' : isWatch ? 'border-amber-200 bg-amber-50/20' : 'border-emerald-200 bg-emerald-50/20';
                        const badgeColor = isCritical ? 'bg-rose-50 text-rose-700 border-rose-200' : isWatch ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                        const barColor = isCritical ? 'bg-rose-500' : isWatch ? 'bg-amber-500' : 'bg-emerald-500';

                        return (
                          <div
                            key={sk.id}
                            className={`rounded-2xl border p-4.5 shadow-xs hover:shadow-md transition-all bg-white flex flex-col justify-between ${cardBg}`}
                          >
                            <div>
                              <div className="flex justify-between items-start gap-2">
                                <h4 className="text-sm font-black text-slate-900 leading-snug">{sk.skill}</h4>
                                <span className={`rounded-lg px-2 py-0.5 text-xs font-black border shrink-0 ${badgeColor}`}>
                                  {sk.mastery}%
                                </span>
                              </div>

                              <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-500">
                                <span className="rounded-md bg-slate-100 px-2 py-0.5">{sk.pathName}</span>
                                <span className="rounded-md bg-indigo-50 text-indigo-700 px-2 py-0.5">{sk.subjectName}</span>
                                <span className="rounded-md bg-slate-100 px-2 py-0.5">{sk.className}</span>
                              </div>

                              <div className="mt-3">
                                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                  <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${Math.max(6, sk.mastery)}%` }} />
                                </div>
                              </div>

                              <div className="mt-3 flex justify-between items-center text-[11px] text-slate-500 font-bold">
                                <span>{sk.attempts} محاولة قياس</span>
                                {sk.atRiskStudents.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => setActiveSkillForDrawer(sk)}
                                    className="rounded-lg bg-rose-50 px-2 py-0.5 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors font-black cursor-pointer"
                                  >
                                    {sk.atRiskStudents.length} طلاب بحاجة دعم ←
                                  </button>
                                ) : (
                                  <span className="text-emerald-600 font-black">متقنة بالكامل ✓</span>
                                )}
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100/80 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setNewQuizTitle(`تدريب علاجي: ${sk.skill}`);
                                  setNewQuizKind('drill');
                                  setNewQuizClass(sk.className);
                                  setShowCreateAssessmentModal(true);
                                }}
                                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 px-3 py-2 text-xs font-black transition-colors cursor-pointer"
                              >
                                <Zap size={13} /> تدريب علاجي فوري
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  /* View 2: Matrix / Table View */
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-black border-b border-slate-200">
                        <tr>
                          <th className="p-3.5">المهارة الأكاديمية</th>
                          <th className="p-3.5">المادة والمسار</th>
                          <th className="p-3.5">الفصل</th>
                          <th className="p-3.5 text-center">نسبة الإتقان</th>
                          <th className="p-3.5 text-center">الطلاب المتعثرون</th>
                          <th className="p-3.5 text-center">الإجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                        {filteredSkillsList.map((sk) => (
                          <tr key={sk.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3.5 font-black text-slate-900">{sk.skill}</td>
                            <td className="p-3.5 text-slate-500">{sk.subjectName} · {sk.pathName}</td>
                            <td className="p-3.5 text-slate-600">{sk.className}</td>
                            <td className="p-3.5 text-center">
                              <span className={`inline-block rounded-lg px-2 py-0.5 font-black border text-xs ${
                                sk.mastery < 60 ? 'bg-rose-50 text-rose-700 border-rose-200' : sk.mastery < 75 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                                {sk.mastery}%
                              </span>
                            </td>
                            <td className="p-3.5 text-center">
                              {sk.atRiskStudents.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setActiveSkillForDrawer(sk)}
                                  className="text-xs font-black text-rose-600 hover:underline cursor-pointer"
                                >
                                  {sk.atRiskStudents.length} طلاب
                                </button>
                              ) : (
                                <span className="text-emerald-600 font-bold">لا يوجد</span>
                              )}
                            </td>
                            <td className="p-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setNewQuizTitle(`تدريب علاجي: ${sk.skill}`);
                                  setNewQuizKind('drill');
                                  setNewQuizClass(sk.className);
                                  setShowCreateAssessmentModal(true);
                                }}
                                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white font-black hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
                              >
                                تدريب ⚡
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: ASSESSMENTS (اختباراتي وتكليفاتي) */}
          {activeTab === 'assessments' && (
            <div className="space-y-6 animate-fade-in" data-testid="teacher-assessments-manager">
              <SupervisorTestsManager
                schoolId={selectedSchool?.schoolId}
                classes={teacherClasses}
                students={teacherStudents}
                roleMode="teacher"
                onAssignToStudent={(stId, testId) => {
                  setFeedback(`✅ تم توجيه الاختبار بنجاح للطلاب المحددين وإرسال إشعار لحظي.`);
                  setTimeout(() => setFeedback(''), 4000);
                }}
              />
            </div>
          )}

          {/* TAB 7: CERTIFICATES */}
          {activeTab === 'certificates' && (
            <div className="space-y-6 animate-fade-in">
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-5">
                  <div>
                    <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
                      <Trophy className="text-amber-500" size={22} /> شهادات التقدير والتحفيز الصفي
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      إصدار شهادات شكر وتقدير رسمية للطلاب المتميزين في الحصص الذكية وسرعة التحديات.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCertificateModal(true)}
                    className="flex items-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 px-5 py-3 text-xs sm:text-sm font-black text-white shadow-md active:scale-95 transition-all"
                  >
                    <Trophy size={16} /> فتح مولد الشهادات الرسمي 🏆
                  </button>
                </div>

                <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50/30 p-8 text-center max-w-2xl mx-auto">
                  <Trophy size={42} className="mx-auto text-amber-500 mb-3" />
                  <h3 className="text-base font-black text-amber-950">تحفيز أبطال الحصص الذكية والمسابقات</h3>
                  <p className="mt-2 text-xs text-amber-800 leading-6 font-medium">
                    يمكنك تخصيص اسم الطالب، الفصل الدراسي، نوع الإنجاز (الفائز بتحدي السرعة ⚡، الأكثر تفاعلاً 🌟، التميز الأكاديمي 🏆)، مع توقيع المعلم الرسمي، وختم إدارة المدرسة، وإمكانية التحميل والطباعة والمشاركة الفورية عبر واتساب لولي الأمر.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCertificateModal(true)}
                    className="mt-5 rounded-xl bg-amber-500 hover:bg-amber-600 px-6 py-2.5 text-xs font-black text-white shadow-xs"
                  >
                    إنشاء شهادة تقدير الآن 📜
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ========================================================= */}
      {/* MODALS */}
      {/* ========================================================= */}
      {/* 1. Smart Classroom Scheduler Modal */}
      {workspace && (
        <TeacherSmartClassroomSchedulerModal
          isOpen={showSchedulerModal}
          onClose={() => setShowSchedulerModal(false)}
          workspace={workspace}
          initialSchoolId={selectedSchool?.schoolId}
          initialClassId={targetClassForLaunch}
          activeSessionId={activeSession?.id}
          onSuccess={(sessionId, pin) => {
            void checkActiveSessions();
          }}
        />
      )}

      {/* 2. Appreciation Certificate Modal */}
      <TeacherCertificateModal
        isOpen={showCertificateModal}
        onClose={() => setShowCertificateModal(false)}
        defaultSchoolName={selectedSchool?.schoolName || 'مدارس المئة النموذجية الأهلية'}
        defaultTeacherName={user?.name || 'أ. فهد القحطاني - معلم القدرات'}
        defaultClassName={selectedSchool?.assignments[0]?.className || 'الصف الثالث الثانوي (أ)'}
      />

      {/* 3. Create Assessment Modal */}
      {showCreateAssessmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">إنشاء اختبار / تدريب صفي موجه</h3>
              <button
                type="button"
                onClick={() => setShowCreateAssessmentModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">عنوان الاختبار أو التدريب</label>
              <input
                type="text"
                value={newQuizTitle}
                onChange={(e) => setNewQuizTitle(e.target.value)}
                placeholder="مثال: تدريب علاجي مكثف - التناسب والكسور"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">نوع التكليف</label>
              <select
                value={newQuizKind}
                onChange={(e) => setNewQuizKind(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="test">اختبار مدرسي موجه</option>
                <option value="drill">تدريب علاجي مكثف</option>
                <option value="mock">محاكي قياس تجريبي</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">الفصل المستهدف</label>
              <select
                value={newQuizClass}
                onChange={(e) => setNewQuizClass(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              >
                {(selectedSchool?.assignments || []).map((a) => (
                  <option key={a.classId} value={a.className}>{a.className}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateAssessmentModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateAssessment}
                disabled={!newQuizTitle.trim()}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2 text-xs font-black text-white disabled:opacity-40"
              >
                إنشاء واعتماد الاختبار
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Active Skill Struggling Students Drawer / Modal */}
      {activeSkillForDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                  تحليل فجوة الطلاب
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">{activeSkillForDrawer.skill}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeSkillForDrawer.subjectName} · {activeSkillForDrawer.className} · متوسط الإتقان: {activeSkillForDrawer.mastery}%
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSkillForDrawer(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {activeSkillForDrawer.atRiskStudents.length === 0 ? (
                <div className="py-8 text-center text-xs font-bold text-slate-400">
                  جميع طلاب هذا الفصل أتقنوا هذه المهارة بنجاح! 🌟
                </div>
              ) : (
                activeSkillForDrawer.atRiskStudents.map((st: any) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-all"
                  >
                    <div>
                      <h4 className="text-xs font-black text-slate-900">{st.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">{st.class}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`rounded-lg px-2 py-0.5 text-xs font-black border ${
                        st.score < 60 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {st.score}% ({st.status})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFeedback(`✅ تم توجيه تدريب علاجي فوري للطالب "${st.name}" في مهارة "${activeSkillForDrawer.skill}"!`);
                          setTimeout(() => setFeedback(''), 4000);
                        }}
                        className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-[11px] font-black text-white shadow-2xs active:scale-95 transition-all cursor-pointer"
                      >
                        توجيه تدريب ⚡
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs font-bold text-slate-500">
                إجمالي المحتاجين للدعم: {activeSkillForDrawer.atRiskStudents.length} طلاب
              </span>
              <button
                type="button"
                onClick={() => {
                  setNewQuizTitle(`تدريب علاجي: ${activeSkillForDrawer.skill}`);
                  setNewQuizKind('drill');
                  setNewQuizClass(activeSkillForDrawer.className);
                  setActiveSkillForDrawer(null);
                  setShowCreateAssessmentModal(true);
                }}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 px-4 py-2 text-xs font-black text-white shadow-xs cursor-pointer"
              >
                إنشاء تدريب جماعي لهذا الفصل 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
export default TeacherWorkspacePage;
