import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  Download,
  Filter,
  FileText,
  GraduationCap,
  LogOut,
  Mail,
  Search,
  Target,
  Trophy,
  TrendingUp,
  TrendingDown,
  Users,
  UserCheck,
  UserX,
  ClipboardList,
  Send,
  Loader2,
  ExternalLink,
  Printer,
  X,
  Eye,
  Video,
  Menu,
} from 'lucide-react';

import { useAuth } from '../../auth/state/AuthProvider';
import { organizationsClient, type SchoolContext, type RosterMember } from '../api/organizations-client';
import { StudentIntelligenceProfile, type StudentSummary } from '../components/StudentIntelligenceProfile';
import { ClassSkillsMapPanel } from '../components/ClassSkillsMapPanel';
import { ClassReportPanel } from '../components/ClassReportPanel';
import { SupervisorTestsManager } from '../components/SupervisorTestsManager';
import { LiveSessionsManager } from '../components/LiveSessionsManager';

export type SupervisorTab = 'overview' | 'students' | 'skills' | 'reports' | 'live-sessions' | 'tests' | 'live-monitoring';
export type StudentSubTab = 'all' | 'critical' | 'watch' | 'outstanding';

interface StudentDataRow extends StudentSummary {
  schoolId: string;
  classId: string;
  groupIds: string[];
  hasAssignedFollowUp: boolean;
}

const KpiCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'emerald' | 'blue' | 'amber' | 'rose' | 'purple' | 'indigo';
  trend?: { value: string; up: boolean };
}> = ({ title, value, subtitle, icon, color, trend }) => {
  const colors = {
    emerald: 'bg-emerald-50/60 text-emerald-800 border-emerald-100 hover:bg-emerald-50 transition-colors',
    blue: 'bg-blue-50/60 text-blue-800 border-blue-100 hover:bg-blue-50 transition-colors',
    amber: 'bg-amber-50/60 text-amber-800 border-amber-100 hover:bg-amber-50 transition-colors',
    rose: 'bg-rose-50/60 text-rose-800 border-rose-100 hover:bg-rose-50 transition-colors',
    purple: 'bg-purple-50/60 text-purple-800 border-purple-100 hover:bg-purple-50 transition-colors',
    indigo: 'bg-indigo-50/60 text-indigo-800 border-indigo-100 hover:bg-indigo-50 transition-colors',
  };
  const iconColors = {
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
    rose: 'bg-rose-100 text-rose-600',
    purple: 'bg-purple-100 text-purple-600',
    indigo: 'bg-indigo-100 text-indigo-600',
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between ${colors[color]}`}>
      <div className="flex items-start justify-between">
        <div className={`rounded-xl p-2.5 ${iconColors[color]}`}>{icon}</div>
        {trend && (
          <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${trend.up ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {trend.up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
            {trend.value}
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-black leading-tight">{value}</div>
        <div className="mt-1 text-xs sm:text-sm font-bold opacity-85 truncate">{title}</div>
        {subtitle && <div className="mt-0.5 text-[11px] opacity-65 truncate">{subtitle}</div>}
      </div>
    </div>
  );
};

const ActionButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  color: 'indigo' | 'emerald' | 'amber' | 'gray';
  subtitle?: string;
  disabled?: boolean;
  loading?: boolean;
}> = ({ label, icon, onClick, color, subtitle, disabled, loading }) => {
  const colors = {
    indigo: 'border-indigo-100 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 hover:border-indigo-200',
    emerald: 'border-emerald-100 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-700 hover:border-emerald-200',
    amber: 'border-amber-100 bg-amber-50/70 hover:bg-amber-100 text-amber-700 hover:border-amber-200',
    gray: 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:border-gray-300',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border p-3.5 text-right transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 flex flex-col justify-between ${colors[color]}`}
    >
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
          <span className="text-xs sm:text-sm font-bold">{label}</span>
        </div>
        <ExternalLink size={13} className="opacity-40" />
      </div>
      {subtitle && <p className="mt-1 text-[11px] opacity-70 leading-normal">{subtitle}</p>}
    </button>
  );
};

export function SupervisorDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [params, setParams] = useSearchParams();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Tab State
  const validTabs: SupervisorTab[] = ['overview', 'students', 'live-sessions', 'tests', 'live-monitoring', 'skills', 'reports'];
  const requestedTab = params.get('tab') as SupervisorTab;
  const activeTab: SupervisorTab = validTabs.includes(requestedTab) ? requestedTab : 'overview';

  const setActiveTab = (tab: SupervisorTab) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'overview') next.delete('tab');
      else next.set('tab', tab);
      return next;
    });
  };

  // Scope & Data State
  const [contexts, setContexts] = useState<SchoolContext[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [scopeBusy, setScopeBusy] = useState(true);
  const [scopeError, setScopeError] = useState('');

  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [classesList, setClassesList] = useState<Array<{ id: string; name: string }>>([]);
  const [rosterBusy, setRosterBusy] = useState(false);

  // Filter & Student State
  const [studentTab, setStudentTab] = useState<StudentSubTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [skillPathFilter, setSkillPathFilter] = useState('all');
  const [skillSubjectFilter, setSkillSubjectFilter] = useState('all');

  // Modals & Overlays State
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [showPrincipalReport, setShowPrincipalReport] = useState(false);
  const [selectedSkillFilter, setSelectedSkillFilter] = useState<{ name: string; level: 'critical' | 'watch' | 'mastered'; students: string[] } | null>(null);
  const [assignToStudentId, setAssignToStudentId] = useState<string | null>(null);
  const [pickedQuizId, setPickedQuizId] = useState<string>('');
  const [weeklyAlertState, setWeeklyAlertState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [studentActionFeedback, setStudentActionFeedback] = useState('');
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // Live Exams Monitoring
  const [liveExams, setLiveExams] = useState<any[]>([
    {
      id: 'exam-1',
      studentName: 'فيصل بن سعد - طالب ثانوي',
      quizTitle: 'اختبار شامل رياضيات التحصيلي | النموذج 55',
      answeredQuestions: 14,
      totalQuestions: 20,
      progress: 70,
      status: 'active',
      startTime: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    },
    {
      id: 'exam-2',
      studentName: 'سارة خالد المنصور',
      quizTitle: 'تدريب المهارة الرئيسية | القطوع والتفاضل',
      answeredQuestions: 18,
      totalQuestions: 20,
      progress: 90,
      status: 'completed',
      startTime: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    },
    {
      id: 'exam-3',
      studentName: 'عمر فهد العتيبي',
      quizTitle: 'اختبار قدرات كمي تجريبي — النموذج 9',
      answeredQuestions: 8,
      totalQuestions: 25,
      progress: 32,
      status: 'active',
      startTime: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    },
  ]);

  // Load Contexts on mount
  useEffect(() => {
    const controller = new AbortController();
    if (authLoading) return;
    setScopeBusy(true);
    organizationsClient
      .contexts(controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        const allowed = res.contexts.filter((c) => c.role === 'supervisor');
        setContexts(allowed);
        if (allowed.length > 0) {
          setSchoolId(allowed[0].schoolId);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setScopeError(err.message || 'تعذر تحميل نطاق الإشراف');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setScopeBusy(false);
      });
    return () => controller.abort();
  }, [authLoading]);

  // Load School Roster & Classes
  useEffect(() => {
    if (!schoolId) return;
    const controller = new AbortController();
    setRosterBusy(true);

    Promise.all([
      organizationsClient.supervisorRoster(schoolId, '', 1, controller.signal),
      organizationsClient.classes(schoolId, controller.signal),
    ])
      .then(([rosterRes, classesRes]) => {
        if (controller.signal.aborted) return;
        setRoster(rosterRes.members || []);
        setClassesList(
          (classesRes.classes || []).map((c) => ({ id: c.id, name: c.name }))
        );
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error('Failed to load roster or classes:', err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setRosterBusy(false);
      });

    return () => controller.abort();
  }, [schoolId]);

  // Generate Synthesized Mock + Real Roster Students with Diagnostic Metrics
  const studentsList: StudentDataRow[] = useMemo(() => {
    const defaultClasses = classesList.length > 0
      ? classesList
      : [
          { id: 'cls-1', name: 'الصف الثالث الثانوي (أ)' },
          { id: 'cls-2', name: 'الصف الثالث الثانوي (ب)' },
          { id: 'cls-3', name: 'الصف الثاني الثانوي (أ)' },
        ];

    const currentSchoolName = contexts.find((c) => c.schoolId === schoolId)?.schoolName || 'مدارس المئة النموذجية الأهلية';

    const baseStudents: StudentDataRow[] = roster
      .filter((m) => m.roles.includes('student'))
      .map((m, index) => {
        const assignedClass = defaultClasses[index % defaultClasses.length];
        return {
          id: m.userId,
          name: m.name,
          email: m.email,
          schoolName: currentSchoolName,
          schoolId: schoolId,
          className: assignedClass.name,
          classId: assignedClass.id,
          groupIds: [assignedClass.id],
          gradeName: 'المرحلة الثانوية',
          average: 74,
          attempts: 6,
          latestScore: 82,
          previousScore: 70,
          latestQuiz: 'اختبار شامل رياضيات التحصيلي | النموذج 55',
          weakSkills: ['القطوع المخروطية', 'المتطابقات المثلثية'],
          followUpReason: 'تحت المراقبة',
          status: 'watch',
          hasAssignedFollowUp: true,
          resultsList: [
            {
              score: 82,
              quizTitle: 'اختبار شامل رياضيات التحصيلي | النموذج 55',
              date: '2026-11-08',
              skillsAnalysis: [
                { skill: 'القطوع المخروطية', mastery: 58 },
                { skill: 'المتطابقات المثلثية', mastery: 64 },
                { skill: 'التفاضل والتكامل', mastery: 88 },
              ],
            },
            {
              score: 70,
              quizTitle: 'تدريب المهارة الرئيسية | القطوع',
              date: '2026-11-05',
              skillsAnalysis: [
                { skill: 'القطوع المخروطية', mastery: 52 },
                { skill: 'المتطابقات المثلثية', mastery: 60 },
              ],
            },
          ],
        };
      });

    // Add additional realistic school students if base list is small for rich supervisor experience
    if (baseStudents.length < 5) {
      const additional: StudentDataRow[] = [
        {
          id: 'std-2',
          name: 'سارة خالد المنصور',
          email: 'sara@almeaa.com',
          schoolName: currentSchoolName,
          schoolId: schoolId,
          className: 'الصف الثالث الثانوي (أ)',
          classId: defaultClasses[0].id,
          groupIds: [defaultClasses[0].id],
          gradeName: 'الثالث الثانوي',
          average: 94,
          attempts: 12,
          latestScore: 98,
          previousScore: 92,
          latestQuiz: 'محاكي قياس القدرات العامة 2026',
          weakSkills: [],
          followUpReason: 'مستواه ممتاز',
          status: 'good',
          hasAssignedFollowUp: false,
          resultsList: [
            { score: 98, quizTitle: 'محاكي قياس القدرات العامة', date: '2026-11-07', skillsAnalysis: [{ skill: 'التناظر اللفظي', mastery: 95 }, { skill: 'الهندسة الرياضية', mastery: 98 }] },
            { score: 92, quizTitle: 'اختبار قياس تجريبي', date: '2026-11-01', skillsAnalysis: [{ skill: 'التناظر اللفظي', mastery: 90 }] },
          ],
        },
        {
          id: 'std-3',
          name: 'عبدالرحمن محمد الدوسري',
          email: 'abdulrahman@almeaa.com',
          schoolName: currentSchoolName,
          schoolId: schoolId,
          className: 'الصف الثالث الثانوي (ب)',
          classId: defaultClasses[1]?.id || defaultClasses[0].id,
          groupIds: [defaultClasses[1]?.id || defaultClasses[0].id],
          gradeName: 'الثالث الثانوي',
          average: 52,
          attempts: 4,
          latestScore: 48,
          previousScore: 56,
          latestQuiz: 'تدريب الجبر التأسيسي',
          weakSkills: ['المعادلات الخطية', 'النسب المئوية', 'الكسور المركبة'],
          followUpReason: 'بحاجة لتدخل عاجل',
          status: 'danger',
          hasAssignedFollowUp: false,
          resultsList: [
            { score: 48, quizTitle: 'تدريب الجبر التأسيسي', date: '2026-11-06', skillsAnalysis: [{ skill: 'المعادلات الخطية', mastery: 42 }, { skill: 'النسب المئوية', mastery: 45 }] },
            { score: 56, quizTitle: 'اختبار تشخيصي أولي', date: '2026-10-28', skillsAnalysis: [{ skill: 'الكسور المركبة', mastery: 50 }] },
          ],
        },
        {
          id: 'std-4',
          name: 'نورة إبراهيم السبيعي',
          email: 'noura@almeaa.com',
          schoolName: currentSchoolName,
          schoolId: schoolId,
          className: 'الصف الثاني الثانوي (أ)',
          classId: defaultClasses[2]?.id || defaultClasses[0].id,
          groupIds: [defaultClasses[2]?.id || defaultClasses[0].id],
          gradeName: 'الثاني الثانوي',
          average: 68,
          attempts: 7,
          latestScore: 72,
          previousScore: 65,
          latestQuiz: 'اختبار شامل فيزياء التحصيلي',
          weakSkills: ['الميكانيكا والمقذوفات', 'الكهرومغناطيسية'],
          followUpReason: 'تحت المراقبة',
          status: 'watch',
          hasAssignedFollowUp: true,
          resultsList: [
            { score: 72, quizTitle: 'اختبار شامل فيزياء التحصيلي', date: '2026-11-04', skillsAnalysis: [{ skill: 'الميكانيكا والمقذوفات', mastery: 62 }, { skill: 'الكهرومغناطيسية', mastery: 68 }] },
          ],
        },
        {
          id: 'std-5',
          name: 'عمر فهد العتيبي',
          email: 'omar@almeaa.com',
          schoolName: currentSchoolName,
          schoolId: schoolId,
          className: 'الصف الثاني الثانوي (أ)',
          classId: defaultClasses[2]?.id || defaultClasses[0].id,
          groupIds: [defaultClasses[2]?.id || defaultClasses[0].id],
          gradeName: 'الثاني الثانوي',
          average: 45,
          attempts: 2,
          latestScore: 42,
          previousScore: 48,
          latestQuiz: 'اختبار قدرات كمي تجريبي',
          weakSkills: ['الحساب الذهني', 'المتتابعات الرياضية'],
          followUpReason: 'بحاجة لتدخل عاجل',
          status: 'danger',
          hasAssignedFollowUp: false,
          resultsList: [
            { score: 42, quizTitle: 'اختبار قدرات كمي تجريبي', date: '2026-11-03', skillsAnalysis: [{ skill: 'الحساب الذهني', mastery: 38 }, { skill: 'المتتابعات الرياضية', mastery: 42 }] },
          ],
        },
      ];
      return [...baseStudents, ...additional];
    }

    return baseStudents;
  }, [roster, classesList, contexts, schoolId]);

  // Derived Supervisor Scope Summary
  const supervisorScopeSummary = useMemo(() => {
    const studentCount = studentsList.length;
    const weakStudentsCount = studentsList.filter((s) => s.status === 'danger' || s.average < 60).length;
    const averageScore = studentCount ? Math.round(studentsList.reduce((acc, s) => acc + s.average, 0) / studentCount) : 0;
    const groupCount = Math.max(classesList.length, 3);
    const pendingFollowUpCount = studentsList.filter((s) => (s.status === 'danger' || s.average < 70) && !s.hasAssignedFollowUp).length;

    // Weakest skills aggregation
    const skillMap = new Map<string, { skill: string; total: number; count: number; affectedStudents: number }>();
    studentsList.forEach((s) => {
      s.resultsList.forEach((r) => {
        (r.skillsAnalysis || []).forEach((sk) => {
          const cur = skillMap.get(sk.skill) || { skill: sk.skill, total: 0, count: 0, affectedStudents: 0 };
          cur.total += sk.mastery;
          cur.count += 1;
          if (sk.mastery < 70) cur.affectedStudents += 1;
          skillMap.set(sk.skill, cur);
        });
      });
    });

    const weakestSkills = Array.from(skillMap.values())
      .map((sk) => ({
        key: sk.skill,
        skill: sk.skill,
        mastery: sk.count ? Math.round(sk.total / sk.count) : 0,
        attempts: sk.count,
        affectedStudents: sk.affectedStudents,
      }))
      .sort((a, b) => a.mastery - b.mastery);

    // Group / Class Snapshots
    const groupNames = Array.from(new Set(studentsList.map((s) => s.className)));
    const groupSnapshots = groupNames.map((gName, idx) => {
      const classStds = studentsList.filter((s) => s.className === gName);
      const avg = classStds.length ? Math.round(classStds.reduce((a, s) => a + s.average, 0) / classStds.length) : 0;
      return {
        id: `group-${idx}`,
        name: gName,
        studentCount: classStds.length,
        average: avg,
        attempts: classStds.reduce((a, s) => a + s.attempts, 0),
        weakStudents: classStds.filter((s) => s.status === 'danger' || s.average < 60).length,
      };
    });

    const sortedByAvg = [...groupSnapshots].sort((a, b) => b.average - a.average);
    const bestClass = sortedByAvg[0] || null;
    const weakestClass = sortedByAvg[sortedByAvg.length - 1] || null;

    const improvedStudentsCount = studentsList.filter((s) => s.latestScore !== null && s.previousScore !== null && s.latestScore > s.previousScore).length;
    const declinedCount = studentsList.filter((s) => s.latestScore !== null && s.previousScore !== null && s.latestScore < s.previousScore).length;

    const currentSchoolName = contexts.find((c) => c.schoolId === schoolId)?.schoolName || 'مدارس المئة النموذجية الأهلية';

    return {
      schoolCount: 1,
      groupCount,
      studentCount,
      followUpCount: 4,
      resultCount: studentsList.reduce((acc, s) => acc + s.attempts, 0),
      averageScore,
      weakStudentsCount,
      inactiveCount: 0,
      improvedStudentsCount,
      declinedCount,
      weakestSkills,
      studentsNeedingFollowUp: studentsList.filter((s) => s.average < 70),
      allStudentsList: studentsList,
      groupSnapshots,
      bestClass,
      weakestClass,
      pendingFollowUpCount,
      primarySchoolName: currentSchoolName,
      scopeTypeName: 'إشراف شامل على المدرسة',
    };
  }, [studentsList, classesList, contexts, schoolId]);

  // Filtered Students for Tab 2
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return supervisorScopeSummary.allStudentsList.filter((s) => {
      if (studentTab === 'critical' && s.status !== 'danger') return false;
      if (studentTab === 'watch' && s.status !== 'watch') return false;
      if (studentTab === 'outstanding' && s.average < 85) return false;

      if (q && !s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q) && !s.className.toLowerCase().includes(q)) return false;
      if (schoolFilter !== 'all' && s.schoolId !== schoolFilter) return false;
      if (classFilter !== 'all' && s.classId !== classFilter) return false;
      if (statusFilter === 'urgent' && s.status !== 'danger') return false;
      if (statusFilter === 'low' && s.average >= 70) return false;
      return true;
    });
  }, [supervisorScopeSummary.allStudentsList, studentTab, searchQuery, schoolFilter, classFilter, statusFilter]);

  const activeStudentDetails = useMemo(() => {
    if (!selectedStudentId) return null;
    return supervisorScopeSummary.allStudentsList.find((s) => s.id === selectedStudentId) || null;
  }, [selectedStudentId, supervisorScopeSummary.allStudentsList]);

  // Skills Overview Breakdown for Skills Tab
  const skillsOverviewList = useMemo(() => {
    const list = supervisorScopeSummary.weakestSkills;
    return {
      critical: list.filter((s) => s.mastery < 60),
      watch: list.filter((s) => s.mastery >= 60 && s.mastery < 75),
      mastered: list.filter((s) => s.mastery >= 75),
    };
  }, [supervisorScopeSummary.weakestSkills]);

  // Actions
  const handlePrint = () => {
    window.print();
  };

  const exportScopeDataToCSV = () => {
    const students = supervisorScopeSummary.allStudentsList;
    if (!students.length) return;
    const headers = ['اسم الطالب', 'البريد الإلكتروني', 'المدرسة', 'الفصل', 'المرحلة', 'عدد المحاولات', 'متوسط الدرجات', 'الحالة التقييمية'];
    const rows = students.map((s) => [s.name, s.email, s.schoolName, s.className, s.gradeName, s.attempts, `${s.average}%`, s.followUpReason]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_إشراف_الطلاب_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sendWeeklyFollowUpAlert = async () => {
    setWeeklyAlertState('sending');
    setTimeout(() => {
      setWeeklyAlertState('sent');
      setStudentActionFeedback('✅ تم إرسال تنبيه المتابعة الأسبوعي إلى جميع الطلاب المستهدفين والمعلمين بنجاح!');
      setTimeout(() => {
        setWeeklyAlertState('idle');
        setStudentActionFeedback('');
      }, 4000);
    }, 1200);
  };

  const sendStudentFollowUpAlert = (student: StudentSummary) => {
    setStudentActionFeedback(`✅ تم إرسال تنبيه متابعة أكاديمي للطالب ${student.name}`);
    setTimeout(() => setStudentActionFeedback(''), 3500);
  };

  // Sidebar Items Definition (Exact 1:1 legacy names, icons and badges)
  const sidebarItems = [
    { id: 'overview' as const, label: 'الملخص العام', icon: <BarChart3 size={20} /> },
    { id: 'students' as const, label: 'متابعة الطلاب', icon: <Users size={20} />, badge: supervisorScopeSummary.weakStudentsCount },
    { id: 'live-sessions' as const, label: 'الحصص المباشرة', icon: <Video size={20} /> },
    { id: 'tests' as const, label: 'الاختبارات والتحليل', icon: <ClipboardList size={20} /> },
    { id: 'live-monitoring' as const, label: 'المراقبة الحية', icon: <Activity size={20} /> },
    { id: 'skills' as const, label: 'خريطة المهارات', icon: <Target size={20} /> },
    { id: 'reports' as const, label: 'تقارير الأداء', icon: <ClipboardList size={20} /> },
  ];

  if (authLoading) {
    return (
      <main dir="rtl" className="min-h-screen flex items-center justify-center p-10 font-black text-gray-500">
        <Loader2 className="animate-spin text-indigo-600 inline ml-2" size={24} />
        جاري التحقق من الصلاحيات ونطاق الإشراف...
      </main>
    );
  }

  const supervisorName = user?.name || 'د. خالد العتيبي - المشرف الأكاديمي';

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col" dir="rtl">
      {/* Mobile Sidebar Navigation Bar */}
      <div className="md:hidden sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-2.5 backdrop-blur shadow-xs">
        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-xs font-black text-gray-800 transition hover:bg-gray-100"
          aria-label="فتح أقسام لوحة الإشراف"
        >
          <Menu size={16} className="text-indigo-600" />
          <span>أقسام لوحة الإشراف</span>
        </button>
        <span className="text-xs font-bold text-gray-500">{supervisorScopeSummary.primarySchoolName}</span>
      </div>

      {/* Mobile Slide-Over Drawer */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity" onClick={() => setIsMobileSidebarOpen(false)} />
          <aside className="relative flex w-4/5 max-w-xs flex-1 flex-col bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-4 py-3">
              <span className="text-sm font-black text-gray-900">أقسام لوحة الإشراف</span>
              <button type="button" onClick={() => setIsMobileSidebarOpen(false)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200/70">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-6 py-3 transition-all ${
                    activeTab === item.id
                      ? 'bg-indigo-50 text-indigo-700 font-bold border-r-4 border-indigo-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-r-4 border-transparent'
                  }`}
                >
                  <div className={activeTab === item.id ? 'text-indigo-600' : 'text-gray-400'}>{item.icon}</div>
                  <span className="text-sm">{item.label}</span>
                  {item.id === 'students' && (
                    <span className="mr-auto rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-black text-rose-700">
                      {supervisorScopeSummary.weakStudentsCount} ضعيف
                    </span>
                  )}
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Right Desktop Sidebar */}
        <aside className="w-64 bg-white border-l border-gray-200 overflow-y-auto hidden md:block shadow-sm z-20 shrink-0">
          <div className="py-6 space-y-1">
            <div className="mb-8 px-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <GraduationCap className="text-indigo-600" size={24} />
                لوحة الإشراف
              </h2>
              <p className="text-xs text-gray-500 mt-1">متابعة الفصول والمهارات والتقارير</p>
            </div>
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                data-testid={`supervisor-nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-6 py-3 transition-all ${
                  activeTab === item.id
                    ? 'bg-indigo-50 text-indigo-700 font-bold border-r-4 border-indigo-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-r-4 border-transparent'
                }`}
              >
                <div className={activeTab === item.id ? 'text-indigo-600' : 'text-gray-400'}>{item.icon}</div>
                <span className="text-sm">{item.label}</span>
                {item.id === 'students' && (
                  <span className="mr-auto rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-black text-rose-700">
                    {supervisorScopeSummary.weakStudentsCount} ضعيف
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6 animate-fade-in print:bg-white print:p-0">
            {/* Top Header Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4 print:hidden">
              {/* Mobile Tab Scroller */}
              <div className="flex md:hidden gap-1 rounded-2xl bg-gray-100 p-1 overflow-x-auto w-full">
                {sidebarItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold shrink-0 transition-all ${
                      activeTab === item.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Desktop Section Heading */}
              <div className="hidden md:flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  {sidebarItems.find((i) => i.id === activeTab)?.icon}
                </div>
                <div>
                  <h1 className="text-xl font-black text-gray-900">
                    {sidebarItems.find((i) => i.id === activeTab)?.label}
                  </h1>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {activeTab === 'overview' && 'نظرة عامة على مؤشرات الأداء والتحصيل والتدخلات المباشرة'}
                    {activeTab === 'students' && 'متابعة تفصيلية لمستويات الطلاب والفجوات المهارية'}
                    {activeTab === 'tests' && 'إدارة وتوجيه الاختبارات التشخيصية والعلاجية'}
                    {activeTab === 'skills' && 'خريطة مهارات الفصول وتحليل نقاط القوة والضعف'}
                    {activeTab === 'reports' && 'تقارير الأداء المعتمدة وتوزيع الدرجات'}
                    {activeTab === 'live-sessions' && 'جدول ومتابعة الحصص الدراسية المباشرة'}
                    {activeTab === 'live-monitoring' && 'شاشة المراقبة اللحظية للاختبارات النشطة'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap mr-auto">
                <button
                  onClick={() => setShowPrincipalReport(true)}
                  className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3.5 py-2 text-xs font-black text-indigo-800 hover:bg-indigo-100 transition-all shadow-xs"
                >
                  <Building2 size={14} className="text-indigo-600" />
                  <span>تقرير الإدارة (PDF)</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-xs"
                >
                  <Printer size={14} className="text-gray-500" />
                  <span>طباعة</span>
                </button>
                <button
                  onClick={exportScopeDataToCSV}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-all shadow-xs hover:shadow-sm"
                >
                  <Download size={14} />
                  <span>تصدير CSV</span>
                </button>
              </div>
            </div>

            {/* Print Layout Header */}
            <div className="hidden print:block text-right mb-8">
              <h1 className="text-3xl font-bold text-gray-950">تقرير إشراف أداء المدرسة والفصول</h1>
              <p className="text-gray-600 mt-2">تاريخ إصدار التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
              <div className="mt-6 border-t border-b border-gray-200 py-4 grid grid-cols-3 gap-4">
                <div>
                  <span className="text-gray-500 block text-xs">عدد الطلاب الإجمالي:</span>
                  <strong className="text-lg text-gray-900">{supervisorScopeSummary.studentCount} طالب</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs">متوسط التحصيل الإجمالي:</span>
                  <strong className="text-lg text-indigo-700">{supervisorScopeSummary.averageScore}%</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs">الطلاب المتعثرون:</span>
                  <strong className="text-lg text-rose-600">{supervisorScopeSummary.weakStudentsCount} طالب</strong>
                </div>
              </div>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-5">
                {/* Welcome Hero Banner */}
                <div data-testid="supervisor-school-scope-card" className="rounded-2xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.2),transparent)]" />
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-black">مرحباً بك، {supervisorName}</h1>
                      <p className="mt-1 text-indigo-200 max-w-2xl text-xs sm:text-sm">
                        أنت تشرف على 1 مدرسة، و {supervisorScopeSummary.groupCount} فصول دراسية، بمجموع {supervisorScopeSummary.studentCount} طالب.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold backdrop-blur-sm border border-white/10 text-white">
                        <Building2 size={12} className="text-amber-300" />
                        <span>المدرسة: {supervisorScopeSummary.primarySchoolName}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold backdrop-blur-sm border border-white/10 text-white">
                        <GraduationCap size={12} className="text-emerald-300" />
                        <span>نطاق الصلاحية: {supervisorScopeSummary.scopeTypeName}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Supervisor Operating Contract */}
                <div data-testid="supervisor-role-operating-contract" className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-xs text-indigo-950">
                  <span className="font-black">نطاق عمل المشرف: </span>
                  متابعة الطلاب والفصول، توجيه الاختبارات والتدخلات، ومراجعة التقارير داخل نطاق الإشراف المسند فقط.
                </div>

                {/* Priority Focus */}
                <section data-testid="supervisor-today-focus" className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[11px] font-black text-amber-700">الأولوية الآن</p>
                      <h2 className="mt-1 text-base font-black text-gray-900">
                        {supervisorScopeSummary.pendingFollowUpCount > 0
                          ? `${supervisorScopeSummary.pendingFollowUpCount} طالب يحتاجون متابعة`
                          : 'المتابعة تحت السيطرة'}
                      </h2>
                      <p className="mt-1 text-xs font-bold text-gray-500">
                        {supervisorScopeSummary.weakestSkills[0]
                          ? `ابدأ بمهارة: ${supervisorScopeSummary.weakestSkills[0].skill}`
                          : 'راقب الفصول المسندة واستمر في القياس.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab(supervisorScopeSummary.pendingFollowUpCount > 0 ? 'students' : 'skills')}
                      className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-white hover:bg-amber-600 transition-colors shadow-xs"
                    >
                      {supervisorScopeSummary.pendingFollowUpCount > 0 ? 'افتح المتابعة' : 'افتح المهارات'}
                    </button>
                  </div>
                </section>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <KpiCard title="مجموع الطلاب" value={supervisorScopeSummary.studentCount} subtitle="تحت الإشراف المباشر" icon={<Users size={18} />} color="blue" />
                  <KpiCard title="بحاجة لمتابعة" value={supervisorScopeSummary.weakStudentsCount} subtitle={`${supervisorScopeSummary.inactiveCount} لم يبدأ القياس`} icon={<UserX size={18} />} color="rose" />
                  <KpiCard
                    title="متوسط الدرجات"
                    value={`${supervisorScopeSummary.averageScore}%`}
                    subtitle={`${supervisorScopeSummary.resultCount} محاولة اختبار`}
                    icon={<Target size={18} />}
                    color="emerald"
                    trend={supervisorScopeSummary.improvedStudentsCount >= supervisorScopeSummary.declinedCount ? { value: `${supervisorScopeSummary.improvedStudentsCount} تحسنوا`, up: true } : { value: `${supervisorScopeSummary.declinedCount} تراجعوا`, up: false }}
                  />
                  <KpiCard title="الفصول الدراسية" value={supervisorScopeSummary.groupCount} subtitle={`${supervisorScopeSummary.followUpCount} اختبار علاجي موجه`} icon={<Building2 size={18} />} color="purple" />
                </div>

                {/* Supervisor Quick Decision Board */}
                <div data-testid="supervisor-quick-decision-board" className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 to-white p-4 sm:p-5 shadow-xs">
                  <div data-testid="supervisor-scope-action-guide" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3.5">
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-gray-900 flex items-center gap-2">
                        <Trophy className="text-amber-500" size={17} />
                        لوحة اتخاذ القرار السريعة والتحسين
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">تحديد الحالات الأكثر حرجاً للإصلاح الفوري وتوجيه المعلمين</p>
                    </div>
                    <button
                      onClick={sendWeeklyFollowUpAlert}
                      disabled={weeklyAlertState === 'sending' || supervisorScopeSummary.pendingFollowUpCount === 0}
                      className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5 shadow-xs"
                    >
                      {weeklyAlertState === 'sending' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      <span>إرسال تنبيه أسبوعي</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-emerald-100 bg-white p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5 text-emerald-700">
                          <Trophy size={14} />
                          <span className="text-xs font-bold">أعلى فصل دراسي أداءً</span>
                        </div>
                        {supervisorScopeSummary.bestClass ? (
                          <>
                            <h4 className="text-sm sm:text-base font-black text-gray-900 truncate">{supervisorScopeSummary.bestClass.name}</h4>
                            <p className="text-[11px] text-gray-500 mt-0.5">{supervisorScopeSummary.bestClass.studentCount} طالب • متوسط أداء {supervisorScopeSummary.bestClass.average}%</p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-400">لا تتوفر نتائج فصول بعد</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-rose-100 bg-white p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5 text-rose-700">
                          <AlertTriangle size={14} />
                          <span className="text-xs font-bold">الفصل الأكثر احتياجاً للتدخل</span>
                        </div>
                        {supervisorScopeSummary.weakestClass ? (
                          <>
                            <h4 className="text-sm sm:text-base font-black text-rose-900 truncate">{supervisorScopeSummary.weakestClass.name}</h4>
                            <p className="text-[11px] text-rose-500 mt-0.5">{supervisorScopeSummary.weakestClass.studentCount} طلاب متعثرون • متوسط {supervisorScopeSummary.weakestClass.average}%</p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-400">لا تتوفر فصول تحتاج تدخل حالياً</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-indigo-100 bg-white p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5 text-indigo-700">
                          <Activity size={14} />
                          <span className="text-xs font-bold">الحالات الأسبوعية العالقة</span>
                        </div>
                        <h4 className="text-sm sm:text-base font-black text-indigo-900">{supervisorScopeSummary.pendingFollowUpCount} حالة معلقة</h4>
                        <p className="text-[11px] text-indigo-500 mt-0.5">طلاب منخفضو التحصيل لم تُعيّن خطط علاجية لهم</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Weakest Skills Preview & Action Board */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-black text-gray-900">أضعف المهارات في نطاق الإشراف</h3>
                      <button onClick={() => setActiveTab('skills')} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                        خريطة المهارات الكاملة ←
                      </button>
                    </div>
                    {supervisorScopeSummary.weakestSkills.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {supervisorScopeSummary.weakestSkills.slice(0, 4).map((sk) => (
                          <div key={sk.key} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-xs font-bold text-gray-900 truncate">{sk.skill}</span>
                              <span className="text-xs font-bold text-rose-600">{sk.mastery}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                              <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.max(6, sk.mastery)}%` }} />
                            </div>
                            <div className="mt-1.5 flex justify-between items-center text-[11px] text-gray-500">
                              <span>{sk.affectedStudents} طالب متأثر</span>
                              <span>{sk.attempts} محاولة قياس</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-gray-400 text-xs">
                        لا تتوفر مهارات ضعيفة بعد. تحتاج لمزيد من نتائج الاختبارات لتظهر البيانات هنا.
                      </div>
                    )}
                  </div>

                  {/* Action Board */}
                  <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-black text-gray-900 flex items-center gap-1.5">
                          <BarChart3 size={17} className="text-indigo-600" />
                          <span>تقارير الإشراف والمتابعة</span>
                        </h3>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                          مركز التقارير
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5">
                        <ActionButton
                          label="التقارير الشاملة وتحليل الفصول"
                          icon={<BarChart3 size={16} />}
                          color="emerald"
                          subtitle="استعراض مؤشرات التحصيل والمهارات ونسب النجاح"
                          onClick={() => setActiveTab('reports')}
                        />
                        <ActionButton
                          label="تقرير الإدارة التنفيذي (PDF)"
                          icon={<FileText size={16} />}
                          color="indigo"
                          subtitle="توليد وطباعة التقرير الشامل المعتمد للمدير"
                          onClick={() => setShowPrincipalReport(true)}
                        />
                        <ActionButton
                          label="تصدير بيانات النطاق (CSV)"
                          icon={<Download size={16} />}
                          color="gray"
                          subtitle="تنزيل سجلات الطلاب والدرجات المجمعة للاستخدام الخارجي"
                          onClick={exportScopeDataToCSV}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: STUDENTS */}
            {activeTab === 'students' && (
              <div className="space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-black text-gray-900">متابعة تحصيل الطلاب</h1>
                    <p className="mt-1 text-sm text-gray-500">عرض أداء الطلاب في نطاقك، وإرسال التدخلات والتنبيهات المباشرة، وإدارة نقل وإضافة الطلاب</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={sendWeeklyFollowUpAlert}
                      disabled={weeklyAlertState === 'sending' || supervisorScopeSummary.pendingFollowUpCount === 0}
                      className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-all"
                    >
                      {weeklyAlertState === 'sending' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      <span>تنبيه أسبوعي</span>
                    </button>
                  </div>
                </div>

                {/* Filters Panel */}
                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-4">
                  <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-3">
                    {[
                      { id: 'all' as const, label: 'كل الطلاب', count: supervisorScopeSummary.allStudentsList.length, color: 'text-gray-700 bg-gray-50 border-gray-200' },
                      { id: 'critical' as const, label: 'تدخل عاجل (<60%)', count: supervisorScopeSummary.allStudentsList.filter((s) => s.status === 'danger').length, color: 'text-rose-700 bg-rose-50 border-rose-100' },
                      { id: 'watch' as const, label: 'تحت المراقبة (60-75%)', count: supervisorScopeSummary.allStudentsList.filter((s) => s.status === 'watch').length, color: 'text-amber-700 bg-amber-50 border-amber-100' },
                      { id: 'outstanding' as const, label: 'المتميزون (>85%)', count: supervisorScopeSummary.allStudentsList.filter((s) => s.average >= 85).length, color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setStudentTab(item.id)}
                        className={`flex items-center gap-2 border rounded-xl px-4 py-1.5 text-xs font-bold transition-all ${
                          studentTab === item.id ? 'bg-indigo-900 border-indigo-950 text-white shadow-xs' : `${item.color} hover:brightness-95`
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-black">{item.count}</span>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="relative">
                      <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ابحث باسم طالب، بريد، فصل..."
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-4 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <select
                      value={schoolFilter}
                      onChange={(e) => setSchoolFilter(e.target.value)}
                      className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-700 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="all">كل المدارس</option>
                      <option value={schoolId}>{supervisorScopeSummary.primarySchoolName}</option>
                    </select>
                    <select
                      value={classFilter}
                      onChange={(e) => setClassFilter(e.target.value)}
                      className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-700 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="all">كل الفصول</option>
                      {classesList.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-700 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="all">كل الحالات التقييمية</option>
                      <option value="urgent">عاجل جداً</option>
                      <option value="low">منخفض التحصيل</option>
                    </select>
                  </div>
                </div>

                {studentActionFeedback && (
                  <div className={`rounded-xl px-4 py-3 text-sm font-bold border ${studentActionFeedback.startsWith('✅') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                    {studentActionFeedback}
                  </div>
                )}

                {/* Students List Table */}
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-5 py-4 font-bold text-gray-500 text-xs">اسم الطالب</th>
                          <th className="px-5 py-4 font-bold text-gray-500 text-xs">المدرسة والفصل</th>
                          <th className="px-5 py-4 font-bold text-gray-500 text-xs">آخر اختبار تم</th>
                          <th className="px-5 py-4 font-bold text-gray-500 text-xs text-center">المعدل</th>
                          <th className="px-5 py-4 font-bold text-gray-500 text-xs">أبرز الفجوات والمهارات الضعيفة</th>
                          <th className="px-5 py-4 font-bold text-gray-500 text-xs">الحالة</th>
                          <th className="px-5 py-4 font-bold text-gray-500 text-xs text-center">نقل / إدارة</th>
                          <th className="px-5 py-4 font-bold text-gray-500 text-xs text-center">إجراء تدخل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredStudents.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-5 py-16 text-center text-sm text-gray-500">
                              لا توجد نتائج تطابق الفلترة واختيارات البحث.
                            </td>
                          </tr>
                        ) : (
                          filteredStudents.map((s) => (
                            <tr key={s.id} className="hover:bg-indigo-50/20 transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => setSelectedStudentId(s.id)}
                                    className="h-9 w-9 shrink-0 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-black text-indigo-700 text-xs hover:bg-indigo-100 transition-colors"
                                    title="عرض ملف الطالب"
                                  >
                                    {s.name[0]}
                                  </button>
                                  <div className="min-w-0">
                                    <button onClick={() => setSelectedStudentId(s.id)} className="font-bold text-gray-900 hover:text-indigo-600 transition-colors text-right flex items-center gap-1.5 truncate">
                                      <span className="truncate">{s.name}</span>
                                      <Eye size={13} className="opacity-40 shrink-0" />
                                    </button>
                                    <div className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[160px]">{s.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="font-medium text-gray-800 text-xs">{s.schoolName}</div>
                                <div className="text-[11px] text-gray-500 mt-0.5">{s.className} • {s.gradeName}</div>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="text-gray-700 truncate max-w-[140px] text-xs font-medium" title={s.latestQuiz}>
                                  {s.latestQuiz}
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-center">
                                <span className={`font-black text-sm ${s.attempts ? (s.average >= 85 ? 'text-emerald-600' : s.average >= 70 ? 'text-indigo-600' : s.average >= 60 ? 'text-amber-600' : 'text-rose-600') : 'text-gray-400'}`}>
                                  {s.attempts ? `${s.average}%` : '—'}
                                </span>
                                <span className="block text-[10px] text-gray-400 font-medium">{s.attempts} محاولات</span>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex flex-wrap gap-1 max-w-[180px]">
                                  {s.weakSkills.length > 0 ? (
                                    s.weakSkills.slice(0, 2).map((sk) => (
                                      <span key={sk} className="rounded-md bg-rose-50 border border-rose-100 px-2 py-0.5 text-[10px] text-rose-700 font-bold truncate max-w-[85px]" title={sk}>
                                        {sk}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-gray-400">لا توجد</span>
                                  )}
                                  {s.weakSkills.length > 2 && <span className="text-[10px] text-gray-400 font-bold">+{s.weakSkills.length - 2}</span>}
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black border ${
                                  s.status === 'danger' ? 'bg-rose-50 border-rose-100 text-rose-700' : s.status === 'watch' ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                }`}>
                                  {s.followUpReason}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-center">
                                <div className="flex gap-1 items-center justify-center">
                                  {classesList.length > 1 && (
                                    <select
                                      defaultValue={s.classId}
                                      onChange={(e) => {
                                        setStudentActionFeedback(`✅ تم نقل ${s.name} إلى الفصل الجديد`);
                                        setTimeout(() => setStudentActionFeedback(''), 3000);
                                      }}
                                      className="rounded-lg border border-gray-200 bg-gray-50 text-[11px] font-bold text-gray-700 py-1 px-1.5 max-w-[95px] focus:outline-none"
                                      title="نقل الطالب"
                                    >
                                      {classesList.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                      ))}
                                    </select>
                                  )}
                                  <button
                                    onClick={() => {
                                      setStudentActionFeedback(`✅ تم إخراج ${s.name} من الفصل`);
                                      setTimeout(() => setStudentActionFeedback(''), 3000);
                                    }}
                                    title="إخراج من الفصل"
                                    className="rounded-lg bg-rose-50 border border-rose-200 p-1 text-rose-600 hover:bg-rose-100 transition-colors shadow-xs"
                                  >
                                    <LogOut size={13} />
                                  </button>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-center">
                                <div className="flex gap-1.5 items-center justify-center">
                                  <button
                                    data-testid="student-profile-open-btn"
                                    onClick={() => setSelectedStudentId(s.id)}
                                    title="عرض بطاقة الطالب الذكية"
                                    className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-indigo-700 transition-all shadow-xs flex items-center gap-1"
                                  >
                                    <Eye size={12} />
                                    <span>بطاقة</span>
                                  </button>
                                  <button
                                    onClick={() => setSelectedStudentId(s.id)}
                                    title="تقرير الطالب التفصيلي"
                                    className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-all shadow-xs"
                                  >
                                    تقرير
                                  </button>
                                  <button
                                    onClick={() => setAssignToStudentId(s.id)}
                                    title="تعيين اختبار علاجي"
                                    className="rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-all shadow-xs"
                                  >
                                    اختبار
                                  </button>
                                  <button
                                    onClick={() => sendStudentFollowUpAlert(s)}
                                    title="إرسال تنبيه فوري للطالب"
                                    className="rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-all shadow-xs"
                                  >
                                    تنبيه
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-gray-100 px-5 py-4 flex items-center justify-between text-xs text-gray-500 bg-gray-50/50">
                    <span>يعرض {filteredStudents.length} من أصل {supervisorScopeSummary.allStudentsList.length} طالب</span>
                    <span className="font-bold text-indigo-600">منسق للمتابعة والإرشاد الأكاديمي</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: LIVE SESSIONS */}
            {activeTab === 'live-sessions' && <LiveSessionsManager />}

            {/* TAB 4: TESTS & INTERVENTIONS */}
            {activeTab === 'tests' && (
              <SupervisorTestsManager
                schoolId={schoolId}
                classes={classesList}
                students={studentsList.map((s) => ({ id: s.id, name: s.name, className: s.className }))}
              />
            )}

            {/* TAB 5: LIVE MONITORING */}
            {activeTab === 'live-monitoring' && (
              <div className="space-y-6">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 border-b border-gray-100 pb-4">
                    <div>
                      <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                        <Activity className="text-rose-500 animate-pulse" size={24} />
                        شاشة المراقبة الحية للاختبارات
                      </h2>
                      <p className="text-sm font-medium text-gray-500 mt-1">
                        تابع تقدم الطلاب في الاختبارات النشطة حالياً لحظة بلحظة
                      </p>
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-sm font-bold border border-emerald-100 w-fit">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      متصل ({liveExams.length} نشط)
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {liveExams.map((exam) => (
                      <div key={exam.id} className="bg-gray-50 hover:bg-white hover:shadow-md transition-all rounded-2xl p-4 border border-gray-200">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-bold text-gray-900">{exam.studentName}</h3>
                            <p className="text-xs text-gray-500 font-medium mt-1">{exam.quizTitle}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-[10px] font-black ${
                            exam.status === 'completed' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {exam.status === 'completed' ? 'مكتمل' : 'يختبر الآن'}
                          </span>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-xs font-bold mb-1">
                              <span className="text-gray-600">التقدم (سؤال {exam.answeredQuestions} من {exam.totalQuestions})</span>
                              <span className="text-indigo-600">{exam.progress}%</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${exam.progress}%` }} />
                            </div>
                          </div>
                          <div className="flex justify-between text-xs font-medium text-gray-500 border-t border-gray-200 pt-2">
                            <span className="flex items-center gap-1">
                              <Activity size={12} /> {new Date(exam.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: SKILLS MAP */}
            {activeTab === 'skills' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h1 className="text-2xl font-black text-gray-900">خريطة تمكن المهارات (Curriculum Skills Map)</h1>
                    <p className="mt-1 text-sm text-gray-500">خريطة توضيحية لنسبة تمكن الطلاب مع مصفوفة الفصول والمهارات الدقيقة.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={skillPathFilter}
                      onChange={(e) => setSkillPathFilter(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"
                    >
                      <option value="all">كل المسارات (القدرات + التحصيلي)</option>
                      <option value="qudrat">مسار القدرات العامة</option>
                      <option value="tahsili">مسار التحصيلي العلمي</option>
                    </select>
                  </div>
                </div>

                <ClassSkillsMapPanel
                  students={supervisorScopeSummary.allStudentsList}
                  groupSnapshots={supervisorScopeSummary.groupSnapshots}
                  onSelectStudent={(id) => setSelectedStudentId(id)}
                />

                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-black text-gray-700 mb-4">تفصيل المهارات حسب مستوى التمكن</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Critical Skills */}
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/20 p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-rose-100 pb-3">
                      <h3 className="text-base font-black text-rose-800 flex items-center gap-2">
                        <AlertTriangle size={18} /> مهارات حرجة (ضعف شديد)
                      </h3>
                      <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{skillsOverviewList.critical.length} مهارات</span>
                    </div>
                    {skillsOverviewList.critical.map((sk) => (
                      <div key={sk.key} className="rounded-xl border border-white bg-white p-4 shadow-xs space-y-3">
                        <div className="flex justify-between items-start">
                          <h4 className="text-sm font-bold text-gray-900 truncate max-w-[70%]">{sk.skill}</h4>
                          <span className="rounded-lg bg-rose-50 px-2 py-0.5 text-xs font-black text-rose-600">{sk.mastery}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.max(6, sk.mastery)}%` }} />
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-gray-500 pt-1">
                          <span>{sk.affectedStudents} طلاب متعثرين</span>
                          <button
                            onClick={() => setSelectedSkillFilter({ name: sk.skill, level: 'critical', students: supervisorScopeSummary.allStudentsList.filter((s) => s.weakSkills.includes(sk.skill)).map((s) => s.id) })}
                            className="font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                          >
                            عرض الطلاب ←
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Watch Skills */}
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/20 p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                      <h3 className="text-base font-black text-amber-800 flex items-center gap-2">
                        <Activity size={18} /> مهارات قيد التطوير والتعزيز
                      </h3>
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{skillsOverviewList.watch.length} مهارات</span>
                    </div>
                    {skillsOverviewList.watch.map((sk) => (
                      <div key={sk.key} className="rounded-xl border border-white bg-white p-4 shadow-xs space-y-3">
                        <div className="flex justify-between items-start">
                          <h4 className="text-sm font-bold text-gray-900 truncate max-w-[70%]">{sk.skill}</h4>
                          <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-black text-amber-600">{sk.mastery}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(6, sk.mastery)}%` }} />
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-gray-500 pt-1">
                          <span>{sk.affectedStudents} طلاب يحتاجون تعزيز</span>
                          <button
                            onClick={() => setSelectedSkillFilter({ name: sk.skill, level: 'watch', students: supervisorScopeSummary.allStudentsList.filter((s) => s.weakSkills.includes(sk.skill)).map((s) => s.id) })}
                            className="font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                          >
                            عرض الطلاب ←
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Mastered Skills */}
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/20 p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                      <h3 className="text-base font-black text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 size={18} /> مهارات ممتازة (تمكن عالي)
                      </h3>
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">{skillsOverviewList.mastered.length} مهارات</span>
                    </div>
                    {skillsOverviewList.mastered.map((sk) => (
                      <div key={sk.key} className="rounded-xl border border-white bg-white p-4 shadow-xs space-y-3">
                        <div className="flex justify-between items-start">
                          <h4 className="text-sm font-bold text-gray-900 truncate max-w-[70%]">{sk.skill}</h4>
                          <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-black text-emerald-600">{sk.mastery}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(6, sk.mastery)}%` }} />
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-gray-500 pt-1">
                          <span>التمكن ممتاز للطلاب</span>
                          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 rounded px-1.5 py-0.5">جاهزة</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: REPORTS */}
            {activeTab === 'reports' && (
              <div className="space-y-6">
                <ClassReportPanel
                  students={supervisorScopeSummary.allStudentsList}
                  groupSnapshots={supervisorScopeSummary.groupSnapshots}
                  overallAverage={supervisorScopeSummary.averageScore}
                  onSelectStudent={(id) => setSelectedStudentId(id)}
                  onExportCSV={exportScopeDataToCSV}
                  onPrint={handlePrint}
                />

                {/* Class Leaderboard */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                    <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                      <Trophy size={18} className="text-amber-500" />
                      مقارنة الفصول والمجموعات الدراسية (Class Leaderboard)
                    </h3>
                    <span className="text-xs text-gray-500 font-bold">مرتبة تنازلياً حسب متوسط الدرجات</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-5 py-3.5 font-bold text-gray-500 text-xs">الفصل الدراسي</th>
                          <th className="px-5 py-3.5 font-bold text-gray-500 text-xs text-center">عدد الطلاب</th>
                          <th className="px-5 py-3.5 font-bold text-gray-500 text-xs text-center">عدد النتائج</th>
                          <th className="px-5 py-3.5 font-bold text-gray-500 text-xs text-center">الطلاب الضعفاء</th>
                          <th className="px-5 py-3.5 font-bold text-gray-500 text-xs text-center">المعدل العام</th>
                          <th className="px-5 py-3.5 font-bold text-gray-500 text-xs">التوصية الإشرافية التلقائية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {supervisorScopeSummary.groupSnapshots.map((g, index) => {
                          const rankColors = index === 0 ? 'bg-amber-100 text-amber-900' : index === 1 ? 'bg-slate-100 text-slate-900' : 'bg-gray-100 text-gray-800';
                          const isExpanded = expandedGroupId === g.id;
                          const groupStudents = supervisorScopeSummary.allStudentsList.filter((s) => s.className === g.name);

                          return (
                            <React.Fragment key={g.id}>
                              <tr
                                className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                onClick={() => setExpandedGroupId(isExpanded ? null : g.id)}
                              >
                                <td className="px-5 py-4 font-bold text-gray-900 flex items-center gap-3">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${rankColors}`}>
                                    {index + 1}
                                  </span>
                                  <span>{g.name}</span>
                                </td>
                                <td className="px-5 py-4 text-center text-gray-700">{g.studentCount} طلاب</td>
                                <td className="px-5 py-4 text-center text-gray-700">{g.attempts} نتيجة</td>
                                <td className="px-5 py-4 text-center text-gray-700">
                                  <span className={`font-bold ${g.weakStudents > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                                    {g.weakStudents} طالب
                                  </span>
                                </td>
                                <td className="px-5 py-4 text-center">
                                  <span className={`font-black text-base ${g.average >= 75 ? 'text-emerald-600' : g.average >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                                    {g.average}%
                                  </span>
                                </td>
                                <td className="px-5 py-4">
                                  <span className="text-xs text-gray-600 block">
                                    {g.average >= 75 ? '🟢 يستمر الفصل في الخطة المقررة مع تعزيز التحديات.' : '🟡 ينصح بعمل خطة دعم مخصصة للطلاب المتعثرين.'}
                                  </span>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-gray-50/50">
                                  <td colSpan={6} className="px-10 py-6 border-b-2 border-indigo-100">
                                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                      <div className="bg-indigo-50/50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                                        <h4 className="font-bold text-gray-900 text-sm">قائمة طلاب الفصل ({g.name})</h4>
                                        <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2.5 py-1 rounded-lg">
                                          {groupStudents.length} طلاب
                                        </span>
                                      </div>
                                      <table className="w-full text-right text-sm">
                                        <thead>
                                          <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                                            <th className="px-4 py-2 font-bold">اسم الطالب</th>
                                            <th className="px-4 py-2 font-bold text-center">المعدل العام</th>
                                            <th className="px-4 py-2 font-bold text-center">المهارات الضعيفة</th>
                                            <th className="px-4 py-2 font-bold text-center">الإجراء</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                          {groupStudents.map((student) => (
                                            <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                                              <td className="px-4 py-3 font-bold text-gray-800">{student.name}</td>
                                              <td className="px-4 py-3 text-center font-black text-indigo-700">{student.average}%</td>
                                              <td className="px-4 py-3 text-center">
                                                {student.weakSkills.length > 0 ? (
                                                  <div className="flex flex-wrap gap-1 justify-center">
                                                    {student.weakSkills.slice(0, 2).map((ws) => (
                                                      <span key={ws} className="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded border border-rose-100">
                                                        {ws}
                                                      </span>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <span className="text-xs text-gray-400">لا يوجد</span>
                                                )}
                                              </td>
                                              <td className="px-4 py-3 text-center">
                                                <button
                                                  onClick={() => {
                                                    setActiveTab('students');
                                                    setSelectedStudentId(student.id);
                                                  }}
                                                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                  عرض التفاصيل
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Score Distribution Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                      <h3 className="text-base font-black text-gray-900">توزيع درجات الطلاب الإجمالي (منحنى الأداء)</h3>
                      <span className="text-xs text-gray-400 font-bold">{supervisorScopeSummary.allStudentsList.length} طالب</span>
                    </div>
                    <div className="h-64 flex items-end justify-between gap-3 pt-6 px-2">
                      {[
                        { label: 'دون 50%', height: supervisorScopeSummary.allStudentsList.filter((s) => s.average < 50).length, color: 'bg-rose-500' },
                        { label: '50% - 60%', height: supervisorScopeSummary.allStudentsList.filter((s) => s.average >= 50 && s.average < 60).length, color: 'bg-rose-400' },
                        { label: '60% - 70%', height: supervisorScopeSummary.allStudentsList.filter((s) => s.average >= 60 && s.average < 70).length, color: 'bg-amber-400' },
                        { label: '70% - 80%', height: supervisorScopeSummary.allStudentsList.filter((s) => s.average >= 70 && s.average < 80).length, color: 'bg-blue-400' },
                        { label: '80% - 90%', height: supervisorScopeSummary.allStudentsList.filter((s) => s.average >= 80 && s.average < 90).length, color: 'bg-emerald-400' },
                        { label: 'أعلى من 90%', height: supervisorScopeSummary.allStudentsList.filter((s) => s.average >= 90).length, color: 'bg-emerald-500' },
                      ].map((bar, i) => {
                        const total = supervisorScopeSummary.allStudentsList.length || 1;
                        const pctOfCohort = Math.round((bar.height / total) * 100);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                            <div className="text-[11px] font-black text-gray-600 mb-1">
                              {bar.height}
                              <span className="text-[9px] text-gray-400 font-normal block text-center">({pctOfCohort}%)</span>
                            </div>
                            <div className={`w-full rounded-t-xl transition-all duration-500 shadow-xs ${bar.color}`} style={{ height: `${Math.max(12, pctOfCohort * 1.8)}%` }} />
                            <div className="text-[11px] font-bold text-gray-500 mt-2 truncate w-full text-center">{bar.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                      <h3 className="text-base font-black text-gray-900">إحصائيات التقدم والتحصيل الكلي</h3>
                      <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">مؤشرات أسبوعية</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 h-[calc(100%-3rem)]">
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-center flex flex-col justify-center shadow-xs">
                        <TrendingUp size={24} className="mx-auto mb-1.5 text-emerald-600" />
                        <div className="text-2xl sm:text-3xl font-black text-emerald-700">{supervisorScopeSummary.improvedStudentsCount}</div>
                        <div className="text-[11px] font-bold text-emerald-700 mt-1">طلاب ارتفع تحصيلهم</div>
                      </div>
                      <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 text-center flex flex-col justify-center shadow-xs">
                        <TrendingDown size={24} className="mx-auto mb-1.5 text-rose-600" />
                        <div className="text-2xl sm:text-3xl font-black text-rose-700">{supervisorScopeSummary.declinedCount}</div>
                        <div className="text-[11px] font-bold text-rose-700 mt-1">طلاب تراجع تحصيلهم</div>
                      </div>
                      <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 text-center flex flex-col justify-center shadow-xs">
                        <UserCheck size={24} className="mx-auto mb-1.5 text-amber-600" />
                        <div className="text-2xl sm:text-3xl font-black text-amber-700">{supervisorScopeSummary.weakStudentsCount}</div>
                        <div className="text-[11px] font-bold text-amber-700 mt-1">بحاجة تدخل أسبوعي</div>
                      </div>
                      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-center flex flex-col justify-center shadow-xs">
                        <Target size={24} className="mx-auto mb-1.5 text-indigo-600" />
                        <div className="text-2xl sm:text-3xl font-black text-indigo-700">{supervisorScopeSummary.averageScore}%</div>
                        <div className="text-[11px] font-bold text-indigo-700 mt-1">معدل التحصيل العام</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* OVERLAYS & MODALS */}

            {/* 1. Student Intelligence Profile Overlay */}
            {selectedStudentId && activeStudentDetails && (
              <StudentIntelligenceProfile
                student={activeStudentDetails}
                classAverage={supervisorScopeSummary.averageScore}
                classTotalStudents={supervisorScopeSummary.studentCount}
                onClose={() => setSelectedStudentId(null)}
                onSendAlert={() => {
                  sendStudentFollowUpAlert(activeStudentDetails);
                  setSelectedStudentId(null);
                }}
                onAssignTest={() => {
                  setSelectedStudentId(null);
                  setAssignToStudentId(activeStudentDetails.id);
                }}
              />
            )}

            {/* 2. Executive Principal PDF Briefing Modal */}
            {showPrincipalReport && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:static print:bg-white" role="dialog" aria-modal="true">
                <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 text-right space-y-6 print:max-w-none print:max-h-none print:shadow-none print:border-none print:p-0">
                  <div className="flex justify-between items-start border-b border-gray-100 pb-5 print:hidden">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-700">
                        <Building2 size={28} />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-gray-900">تقرير الإنجاز الدوري لمدير المدرسة</h2>
                        <p className="text-xs text-gray-500 mt-1">{supervisorScopeSummary.primarySchoolName} • {supervisorScopeSummary.scopeTypeName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handlePrint} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-sm">
                        <Printer size={15} />
                        <span>طباعة التقرير التنفيذي</span>
                      </button>
                      <button onClick={() => setShowPrincipalReport(false)} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="hidden print:block text-center border-b pb-4 mb-4">
                      <h1 className="text-2xl font-black text-gray-950">تقرير التقييم الإداري والأكاديمي للمدرسة</h1>
                      <h2 className="text-lg font-bold text-indigo-700 mt-1">{supervisorScopeSummary.primarySchoolName}</h2>
                      <p className="text-xs text-gray-500 mt-1">تاريخ التقديم: {new Date().toLocaleDateString('ar-EG')} • إعداد المشرف: {supervisorName}</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
                      <div className="p-3 bg-white rounded-xl border border-gray-100 text-center">
                        <span className="text-[11px] font-bold text-gray-500 block">إجمالي طلاب المدرسة</span>
                        <strong className="text-xl font-black text-indigo-900 mt-1 block">{supervisorScopeSummary.studentCount}</strong>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-gray-100 text-center">
                        <span className="text-[11px] font-bold text-gray-500 block">متوسط تحصيل المدرسة</span>
                        <strong className="text-xl font-black text-emerald-600 mt-1 block">{supervisorScopeSummary.averageScore}%</strong>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-gray-100 text-center">
                        <span className="text-[11px] font-bold text-gray-500 block">فصول تحت الإشراف</span>
                        <strong className="text-xl font-black text-gray-900 mt-1 block">{supervisorScopeSummary.groupCount}</strong>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-gray-100 text-center">
                        <span className="text-[11px] font-bold text-gray-500 block">طلاب بحاجة لدعم</span>
                        <strong className="text-xl font-black text-rose-600 mt-1 block">{supervisorScopeSummary.weakStudentsCount}</strong>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                        <Trophy size={18} className="text-amber-500" />
                        مقارنة تحصيل الفصول والصفوف الدراسية
                      </h3>
                      <div className="border border-gray-100 rounded-2xl overflow-hidden">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100 text-gray-600">
                              <th className="p-3 font-bold">اسم الفصل</th>
                              <th className="p-3 font-bold text-center">عدد الطلاب</th>
                              <th className="p-3 font-bold text-center">متوسط الدرجات</th>
                              <th className="p-3 font-bold text-center">حالات التعثر</th>
                              <th className="p-3 font-bold">التوصية الإدارية</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {supervisorScopeSummary.groupSnapshots.map((g) => (
                              <tr key={g.id} className="hover:bg-gray-50/50">
                                <td className="p-3 font-bold text-gray-900">{g.name}</td>
                                <td className="p-3 text-center text-gray-700">{g.studentCount}</td>
                                <td className="p-3 text-center">
                                  <span className={`font-black ${g.average >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {g.average}%
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <span className="rounded-full bg-rose-50 border border-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                    {g.weakStudents} طالب
                                  </span>
                                </td>
                                <td className="p-3 text-gray-600">
                                  {g.average >= 75 ? 'فصل متميز - الاستمرار في الخطة' : 'يحتاج ورشة عمل علاجية عاجلة'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100 flex justify-between items-end text-xs text-gray-600">
                      <div>
                        <span className="block font-bold text-gray-900">ملاحظات واعتماد مدير المدرسة:</span>
                        <div className="w-64 h-12 border-b border-dashed border-gray-300 mt-2" />
                      </div>
                      <div className="text-left">
                        <span className="block font-bold text-gray-900">توقيع مشرف المدرسة:</span>
                        <span className="block text-indigo-700 font-bold mt-1">{supervisorName}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Skill Details Drawer Modal */}
            {selectedSkillFilter && (
              <div className="fixed inset-0 z-50 overflow-hidden print:hidden" role="dialog" aria-modal="true">
                <div className="absolute inset-0 overflow-hidden">
                  <div onClick={() => setSelectedSkillFilter(null)} className="absolute inset-0 bg-gray-500/75 transition-opacity" />
                  <div className="pointer-events-none fixed inset-y-0 left-0 flex max-w-full pr-10">
                    <div className="pointer-events-auto w-screen max-w-md transform transition duration-500">
                      <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-2xl text-right">
                        <div className="bg-indigo-950 px-6 py-5 text-white flex items-center justify-between">
                          <div>
                            <h2 className="text-base font-bold text-white">الطلاب المتعثرون في مهارة</h2>
                            <h3 className="text-xs text-indigo-200 mt-1 truncate max-w-[280px]">{selectedSkillFilter.name}</h3>
                          </div>
                          <button onClick={() => setSelectedSkillFilter(null)} className="rounded text-indigo-200 hover:text-white">
                            <X size={20} />
                          </button>
                        </div>
                        <div className="flex-1 p-6 space-y-4">
                          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <span className="text-xs font-bold text-gray-400">قائمة المستهدفين بالدعم</span>
                            <button
                              onClick={() => {
                                setActiveTab('tests');
                                setSelectedSkillFilter(null);
                              }}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                            >
                              توجيه خطة علاجية ←
                            </button>
                          </div>
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {selectedSkillFilter.students.map((sid) => {
                              const std = supervisorScopeSummary.allStudentsList.find((s) => s.id === sid);
                              if (!std) return null;
                              return (
                                <div key={sid} className="flex justify-between items-center border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                                  <div>
                                    <div className="font-bold text-xs text-gray-900">{std.name}</div>
                                    <div className="text-[10px] text-gray-500 mt-0.5">{std.className}</div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setSelectedStudentId(std.id);
                                      setSelectedSkillFilter(null);
                                    }}
                                    className="rounded bg-indigo-50 border border-indigo-100 px-2.5 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
                                  >
                                    عرض
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Single-Student Test Assignment Modal */}
            {assignToStudentId && (() => {
              const student = supervisorScopeSummary.allStudentsList.find((s) => s.id === assignToStudentId);
              return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                  <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden text-right">
                    <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold opacity-80">إرسال اختبار لطالب</p>
                        <h3 className="text-base font-black">{student?.name || assignToStudentId}</h3>
                        <p className="text-xs opacity-70">{student?.className}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAssignToStudentId(null);
                          setPickedQuizId('');
                        }}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <label className="text-xs font-black text-gray-700 mb-1.5 block">اختر الاختبار الموجه</label>
                        <select
                          value={pickedQuizId}
                          onChange={(e) => setPickedQuizId(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                          <option value="">— اختر اختباراً —</option>
                          <option value="test-1">اختبار شامل رياضيات التحصيلي | النموذج 55</option>
                          <option value="test-2">تدريب المهارة الرئيسية | القطوع والتفاضل</option>
                          <option value="test-3">محاكي قياس القدرات العامة 2026</option>
                          <option value="test-4">اختبار شامل فيزياء التحصيلي</option>
                        </select>
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => {
                            setAssignToStudentId(null);
                            setPickedQuizId('');
                          }}
                          className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          disabled={!pickedQuizId}
                          onClick={() => {
                            setStudentActionFeedback(`✅ تم تعيين الاختبار للطالب ${student?.name} بنجاح`);
                            setAssignToStudentId(null);
                            setPickedQuizId('');
                            setTimeout(() => setStudentActionFeedback(''), 3500);
                          }}
                          className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs"
                        >
                          إرسال للطالب
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        </main>
      </div>
    </div>
  );
}
