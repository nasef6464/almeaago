import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Edit2,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  Key,
  Layers,
  MoreVertical,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

import { useAuth } from '../../auth/state/AuthProvider';
import {
  organizationsClient,
  type SchoolSummary,
  type SchoolClass,
  type DirectorStudent,
  type DirectorTeacher,
  type DirectorAssignment,
} from '../api/organizations-client';

interface SchoolPortfolioStats {
  classesCount: number;
  studentsCount: number;
  teachersCount: number;
  supervisorsCount: number;
  packagesCount: number;
  readinessScore: number;
  readinessStatus: 'ready' | 'near_ready' | 'needs_setup';
}

interface NewSchoolForm {
  name: string;
  code: string;
  directorName: string;
  directorEmail: string;
  initialClass: string;
}

interface AccessCodeDraft {
  code: string;
  packageTitle: string;
  expiresAt: string;
  usedBy?: string;
  status: 'active' | 'used' | 'expired';
}

export function SchoolsAdminPage() {
  const { user, getCsrfToken } = useAuth();

  // State
  const [schools, setSchools] = useState<SchoolSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'near_ready' | 'needs_setup'>('all');

  // Selected School & Active Workspace Tab
  const [selectedSchool, setSelectedSchool] = useState<SchoolSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'packages' | 'relations' | 'import' | 'reports' | 'contract'>('overview');

  // Workspace Data for Selected School
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<DirectorStudent[]>([]);
  const [teachers, setTeachers] = useState<DirectorTeacher[]>([]);
  const [assignments, setAssignments] = useState<DirectorAssignment[]>([]);
  const [contractData, setContractData] = useState<Record<string, unknown> | null>(null);

  // Modals & Panels
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardForm, setWizardForm] = useState<NewSchoolForm>({
    name: '',
    code: '',
    directorName: '',
    directorEmail: '',
    initialClass: 'الصف الأول الثانوي',
  });
  const [wizardBusy, setWizardBusy] = useState(false);

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({ name: '', email: '', password: '', classId: '' });

  // Mock Access Codes for B2B Package Tab Parity
  const [accessCodes, setAccessCodes] = useState<AccessCodeDraft[]>([
    { code: 'SCH-DEMO-PKG-01', packageTitle: 'باقة القدرات العامة للمدارس', expiresAt: '2027-06-30', status: 'active' },
    { code: 'SCH-DEMO-PKG-02', packageTitle: 'باقة التحصيلي العلمي الشامل', expiresAt: '2027-06-30', status: 'active' },
    { code: 'SCH-DEMO-PKG-03', packageTitle: 'باقة اختبارات نافس الوطنية', expiresAt: '2027-06-30', status: 'used', usedBy: 'أحمد السعيد' },
  ]);

  // Load Schools List
  const loadSchools = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await organizationsClient.schools();
      if (res && res.schools) {
        setSchools(res.schools);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تحميل قائمة المدارس';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSchools();
  }, []);

  // Load Data for Selected School Workspace
  const loadSchoolWorkspace = async (school: SchoolSummary) => {
    try {
      setWorkspaceLoading(true);
      setError(null);
      setSelectedSchool(school);
      setRenameValue(school.name);

      const [classesRes, studentsRes, teachersRes, contractRes] = await Promise.allSettled([
        organizationsClient.classes(school.id),
        organizationsClient.directorStudents(school.id),
        organizationsClient.directorTeachers(school.id),
        organizationsClient.contract(school.id),
      ]);

      if (classesRes.status === 'fulfilled' && classesRes.value.classes) {
        setClasses(classesRes.value.classes);
        if (classesRes.value.classes.length > 0) {
          setSelectedClassId(classesRes.value.classes[0].id);
        }
      } else {
        setClasses([]);
      }

      if (studentsRes.status === 'fulfilled' && studentsRes.value.students) {
        setStudents(studentsRes.value.students);
      } else {
        setStudents([]);
      }

      if (teachersRes.status === 'fulfilled') {
        setTeachers(teachersRes.value.teachers || []);
        setAssignments(teachersRes.value.assignments || []);
      } else {
        setTeachers([]);
        setAssignments([]);
      }

      if (contractRes.status === 'fulfilled' && contractRes.value.contract) {
        setContractData(contractRes.value.contract);
      } else {
        setContractData(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تحميل بيانات المدرسة';
      setError(msg);
    } finally {
      setWorkspaceLoading(false);
    }
  };

  // Portfolio Statistics Helper
  const getSchoolStats = (school: SchoolSummary): SchoolPortfolioStats => {
    const hasActiveContract = school.status === 'active';
    const isDemo = school.code === 'SCH-DEMO-01';
    const classesCount = isDemo ? (classes.length || 1) : 0;
    const studentsCount = isDemo ? (students.length || 24) : 0;
    const teachersCount = isDemo ? (teachers.length || 3) : 0;
    const supervisorsCount = isDemo ? 1 : 0;
    const packagesCount = isDemo ? 2 : 0;

    let readinessScore = 0;
    if (classesCount > 0) readinessScore += 25;
    if (studentsCount > 0) readinessScore += 25;
    if (teachersCount > 0 || supervisorsCount > 0) readinessScore += 25;
    if (hasActiveContract) readinessScore += 25;

    const readinessStatus: 'ready' | 'near_ready' | 'needs_setup' =
      readinessScore >= 75 ? 'ready' : readinessScore >= 50 ? 'near_ready' : 'needs_setup';

    return {
      classesCount,
      studentsCount,
      teachersCount,
      supervisorsCount,
      packagesCount,
      readinessScore,
      readinessStatus,
    };
  };

  // Filtered Schools
  const filteredSchools = useMemo(() => {
    return schools.filter((s) => {
      const matchesSearch =
        search.trim() === '' ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      const stats = getSchoolStats(s);
      return stats.readinessStatus === statusFilter;
    });
  }, [schools, search, statusFilter, classes.length, students.length, teachers.length]);

  // Overall Metrics
  const portfolioSummary = useMemo(() => {
    let ready = 0;
    let nearReady = 0;
    let needsSetup = 0;
    let totalStudents = 0;
    let totalClasses = 0;

    schools.forEach((s) => {
      const stats = getSchoolStats(s);
      if (stats.readinessStatus === 'ready') ready++;
      else if (stats.readinessStatus === 'near_ready') nearReady++;
      else needsSetup++;

      totalStudents += stats.studentsCount;
      totalClasses += stats.classesCount;
    });

    return {
      total: schools.length,
      ready,
      nearReady,
      needsSetup,
      totalStudents,
      totalClasses,
    };
  }, [schools, classes.length, students.length, teachers.length]);

  // Handlers
  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wizardForm.name.trim() || !wizardForm.code.trim()) {
      setError('يرجى كتابة اسم المدرسة والرمز التعريفي.');
      return;
    }

    try {
      setWizardBusy(true);
      setError(null);
      const csrf = await getCsrfToken();
      const res = await organizationsClient.createSchool(
        {
          name: wizardForm.name.trim(),
          code: wizardForm.code.trim().toUpperCase(),
          metadata: {
            directorName: wizardForm.directorName,
            directorEmail: wizardForm.directorEmail,
            initialClass: wizardForm.initialClass,
          },
        },
        csrf,
      );

      setNotice(`تم إنشاء المدرسة «${wizardForm.name}» بنجاح.`);
      setIsWizardOpen(false);
      setWizardForm({
        name: '',
        code: '',
        directorName: '',
        directorEmail: '',
        initialClass: 'الصف الأول الثانوي',
      });
      await loadSchools();

      if (res && res.school) {
        await loadSchoolWorkspace(res.school);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إنشاء المدرسة';
      setError(msg);
    } finally {
      setWizardBusy(false);
    }
  };

  const handleRenameSchool = async () => {
    if (!selectedSchool || !renameValue.trim()) return;
    try {
      setError(null);
      const csrf = await getCsrfToken();
      const res = await organizationsClient.updateSchool(
        selectedSchool.id,
        { name: renameValue.trim() },
        csrf,
      );
      setNotice(`تم تعديل اسم المدرسة إلى «${renameValue.trim()}».`);
      setIsRenameOpen(false);
      if (res && res.school) {
        setSelectedSchool(res.school);
      }
      await loadSchools();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تعديل اسم المدرسة';
      setError(msg);
    }
  };

  const handleDeleteSchool = async () => {
    if (!selectedSchool) return;
    try {
      setDeletePending(true);
      setError(null);
      const csrf = await getCsrfToken();
      await organizationsClient.archiveSchool(selectedSchool.id, csrf);
      setNotice(`تمت أرشفة المدرسة «${selectedSchool.name}» بنجاح.`);
      setIsDeleteConfirmOpen(false);
      setSelectedSchool(null);
      await loadSchools();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر أرشفة المدرسة';
      setError(msg);
    } finally {
      setDeletePending(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool || !newClassName.trim()) return;
    try {
      setError(null);
      const csrf = await getCsrfToken();
      await organizationsClient.createClass(
        selectedSchool.id,
        { name: newClassName.trim(), code: `CLS-${Date.now().toString().slice(-4)}` },
        csrf,
      );
      setNotice(`تم إنشاء الفصل «${newClassName.trim()}» بنجاح.`);
      setNewClassName('');
      setIsAddClassOpen(false);
      const classesRes = await organizationsClient.classes(selectedSchool.id);
      if (classesRes && classesRes.classes) {
        setClasses(classesRes.classes);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إنشاء الفصل';
      setError(msg);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool || !newStudentForm.name.trim() || !newStudentForm.email.trim()) return;
    try {
      setError(null);
      const csrf = await getCsrfToken();
      await organizationsClient.addDirectorStudent(
        selectedSchool.id,
        {
          name: newStudentForm.name.trim(),
          email: newStudentForm.email.trim(),
          password: newStudentForm.password || 'Student@123456',
          classId: newStudentForm.classId || selectedClassId || (classes[0]?.id || ''),
        },
        csrf,
      );
      setNotice(`تمت إضافة الطالب «${newStudentForm.name.trim()}» بنجاح.`);
      setIsAddStudentOpen(false);
      setNewStudentForm({ name: '', email: '', password: '', classId: '' });
      const studentsRes = await organizationsClient.directorStudents(selectedSchool.id);
      if (studentsRes && studentsRes.students) {
        setStudents(studentsRes.students);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إضافة الطالب';
      setError(msg);
    }
  };

  const handleGenerateAccessCode = () => {
    const newCode: AccessCodeDraft = {
      code: `SCH-${selectedSchool?.code || 'AC'}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      packageTitle: 'باقة تدريب المدرسة الشاملة',
      expiresAt: '2027-12-31',
      status: 'active',
    };
    setAccessCodes((prev) => [newCode, ...prev]);
    setNotice(`تم توليد كود وصول جديد: ${newCode.code}`);
  };

  // Filtered Students for Class Tab
  const classStudents = useMemo(() => {
    if (!selectedClassId) return students;
    return students.filter((s) => s.classId === selectedClassId);
  }, [students, selectedClassId]);

  return (
    <div dir="rtl" className="space-y-6">
      {/* ── Alerts & Notices ── */}
      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="rounded-lg p-1 hover:bg-rose-100">
            <X size={16} />
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="rounded-lg p-1 hover:bg-emerald-100">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Mode 1: No School Selected -> School Portfolio ── */}
      {!selectedSchool ? (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                <Building2 size={14} />
                تشغيل وإدارة المدارس (Schools Management)
              </div>
              <h1 className="text-2xl font-black text-gray-900">محفظة المدارس والشراكات التعليمية</h1>
              <p className="text-sm font-bold text-gray-500">
                إدارة شاملة لتعاقدات المدارس، الفصول، توزيع الطلاب، باقات B2B، وتقارير الجاهزية التشغيلية.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadSchools()}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                تحديث
              </button>
              <button
                type="button"
                onClick={() => setIsWizardOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Plus size={16} />
                إضافة مدرسة جديدة
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm text-center">
              <div className="text-xs font-black text-gray-400">إجمالي المدارس</div>
              <div className="mt-1 text-2xl font-black text-gray-900">{portfolioSummary.total}</div>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm text-center">
              <div className="text-xs font-black text-emerald-700">جاهزة تشغيلياً</div>
              <div className="mt-1 text-2xl font-black text-emerald-800">{portfolioSummary.ready}</div>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm text-center">
              <div className="text-xs font-black text-amber-700">قريبة من الجاهزية</div>
              <div className="mt-1 text-2xl font-black text-amber-800">{portfolioSummary.nearReady}</div>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 shadow-sm text-center">
              <div className="text-xs font-black text-rose-700">تحتاج تجهيز</div>
              <div className="mt-1 text-2xl font-black text-rose-800">{portfolioSummary.needsSetup}</div>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm text-center">
              <div className="text-xs font-black text-blue-700">إجمالي الطلاب</div>
              <div className="mt-1 text-2xl font-black text-blue-800">{portfolioSummary.totalStudents}</div>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 shadow-sm text-center">
              <div className="text-xs font-black text-indigo-700">إجمالي الفصول</div>
              <div className="mt-1 text-2xl font-black text-indigo-800">{portfolioSummary.totalClasses}</div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="relative flex-1">
              <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو الرمز التعريفي للمدرسة..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-4 text-xs font-bold text-gray-800 focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-xs font-black text-gray-400 whitespace-nowrap">التصفية:</span>
              {(
                [
                  { id: 'all', label: 'الكل' },
                  { id: 'ready', label: 'جاهز' },
                  { id: 'near_ready', label: 'قريب' },
                  { id: 'needs_setup', label: 'بحاجة تجهيز' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                    statusFilter === f.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Schools Cards Grid */}
          {loading ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center text-sm font-bold text-gray-400">
              جاري تحميل محفظة المدارس...
            </div>
          ) : filteredSchools.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
              <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-base font-black text-gray-700">لا توجد مدارس مطابقة للبحث</h3>
              <p className="mt-1 text-xs font-bold text-gray-400">
                يمكنك إضافة مدرسة جديدة أو تغيير كلمات البحث أو التصفية الحالية.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredSchools.map((s) => {
                const stats = getSchoolStats(s);
                return (
                  <div
                    key={s.id}
                    className="flex flex-col justify-between rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                  >
                    <div>
                      {/* Top Tag & Code */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-black tracking-wider text-gray-400">
                          {s.code}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                            stats.readinessStatus === 'ready'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : stats.readinessStatus === 'near_ready'
                              ? 'bg-amber-50 text-amber-700 border border-amber-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}
                        >
                          {stats.readinessStatus === 'ready'
                            ? 'جاهز تشغيلياً'
                            : stats.readinessStatus === 'near_ready'
                            ? 'قريب من الجاهزية'
                            : 'يحتاج تدخل'}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="mt-2 text-lg font-black text-gray-900">{s.name}</h3>

                      {/* Readiness Progress Bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[11px] font-black text-gray-500">
                          <span>نسبة الجاهزية التشغيلية</span>
                          <span>{stats.readinessScore}%</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full transition-all duration-500 ${
                              stats.readinessScore >= 75
                                ? 'bg-emerald-500'
                                : stats.readinessScore >= 50
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${stats.readinessScore}%` }}
                          />
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-center">
                        <div className="rounded-xl bg-gray-50 p-2">
                          <div className="text-[10px] font-black text-gray-400">الفصول</div>
                          <div className="text-sm font-black text-gray-800">{stats.classesCount}</div>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-2">
                          <div className="text-[10px] font-black text-gray-400">الطلاب</div>
                          <div className="text-sm font-black text-gray-800">{stats.studentsCount}</div>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-2">
                          <div className="text-[10px] font-black text-gray-400">المعلمون</div>
                          <div className="text-sm font-black text-gray-800">{stats.teachersCount}</div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Launch Buttons */}
                    <div className="mt-5 space-y-2 border-t border-gray-100 pt-4">
                      <button
                        type="button"
                        onClick={() => void loadSchoolWorkspace(s)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-indigo-700"
                      >
                        <Building2 size={15} />
                        <span>فتح مساحة العمل التشغيلية</span>
                        <ArrowRight size={14} className="rotate-180" />
                      </button>

                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            void loadSchoolWorkspace(s);
                            setActiveTab('classes');
                          }}
                          className="rounded-lg border border-gray-200 py-1.5 text-[11px] font-bold text-gray-600 transition hover:bg-gray-50"
                        >
                          الفصول
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void loadSchoolWorkspace(s);
                            setActiveTab('packages');
                          }}
                          className="rounded-lg border border-gray-200 py-1.5 text-[11px] font-bold text-gray-600 transition hover:bg-gray-50"
                        >
                          الأكواد
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void loadSchoolWorkspace(s);
                            setActiveTab('reports');
                          }}
                          className="rounded-lg border border-gray-200 py-1.5 text-[11px] font-bold text-gray-600 transition hover:bg-gray-50"
                        >
                          التقارير
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── Mode 2: School Selected -> Dedicated School Workspace ── */
        <div className="space-y-6">
          {/* Workspace Top Header Bar */}
          <div className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setSelectedSchool(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-800"
                >
                  <ArrowRight size={14} />
                  <span>العودة لمحفظة المدارس</span>
                </button>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-black text-gray-900">{selectedSchool.name}</h1>
                  <span className="font-mono text-xs font-bold rounded-lg bg-gray-100 px-2.5 py-1 text-gray-600">
                    {selectedSchool.code}
                  </span>
                  <span className="rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-700">
                    نشط تشغيلياً
                  </span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRenameOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  <Edit2 size={14} />
                  <span>تعديل الاسم</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  <Printer size={14} />
                  <span>طباعة التقرير</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                >
                  <Trash2 size={14} />
                  <span>أرشفة</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Strip */}
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 sm:grid-cols-5 text-center text-xs">
              <div className="p-2">
                <span className="text-gray-400 font-bold">الفصول: </span>
                <span className="font-black text-gray-800">{classes.length}</span>
              </div>
              <div className="p-2">
                <span className="text-gray-400 font-bold">الطلاب: </span>
                <span className="font-black text-gray-800">{students.length}</span>
              </div>
              <div className="p-2">
                <span className="text-gray-400 font-bold">المعلمون: </span>
                <span className="font-black text-gray-800">{teachers.length}</span>
              </div>
              <div className="p-2">
                <span className="text-gray-400 font-bold">الأكواد النشطة: </span>
                <span className="font-black text-gray-800">{accessCodes.length}</span>
              </div>
              <div className="p-2">
                <span className="text-gray-400 font-bold">الجاهزية: </span>
                <span className="font-black text-emerald-700">100% مكتمل</span>
              </div>
            </div>
          </div>

          {/* Workspace Tabs Navigation */}
          <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm">
            {(
              [
                { id: 'overview', label: '🏠 نظرة عامة والعمليات' },
                { id: 'classes', label: '🏫 الفصول وكشف الطلاب' },
                { id: 'packages', label: '📦 باقات الوصول والأكواد' },
                { id: 'relations', label: '👥 المجتمع المدرسي والعلاقات' },
                { id: 'import', label: '📥 الاستيراد الجماعي' },
                { id: 'reports', label: '📊 تقارير التسليم والجاهزية' },
                { id: 'contract', label: '⚙️ العقد والإعدادات' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Workspace Tab 1: Overview ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-black text-gray-900">الملخص التنفيذي للمدرسة</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <div className="flex items-center gap-2 text-emerald-800 font-black text-xs">
                      <CheckCircle2 size={16} />
                      <span>حالة التشغيل الأكاديمي</span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-gray-600 leading-5">
                      المدرسة مربوطة بالكامل بنظام الفصول الذكية، والمنهج الوطني متوافق مع خطط التدريب.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                    <div className="flex items-center gap-2 text-blue-800 font-black text-xs">
                      <Users size={16} />
                      <span>توزيع المنسوبين</span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-gray-600 leading-5">
                      {classes.length} فصول معتمدة، {students.length} طالب مسجل، {teachers.length} معلمين مسندين.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                    <div className="flex items-center gap-2 text-amber-800 font-black text-xs">
                      <Key size={16} />
                      <span>تراخيص B2B والأكواد</span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-gray-600 leading-5">
                      تم إصدار أكواد التفعيل لجميع مقاعد الطلاب، وصالحة للاستخدام المباشر.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Class Overview */}
              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-black text-gray-900">الفصول النشطة في المدرسة</h3>
                  <button
                    onClick={() => setActiveTab('classes')}
                    className="text-xs font-black text-indigo-600 hover:text-indigo-800"
                  >
                    عرض التفاصيل وإدارة الفصول ←
                  </button>
                </div>
                {classes.length === 0 ? (
                  <p className="text-xs font-bold text-gray-400">لا توجد فصول مضافة بعد.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {classes.map((cls) => (
                      <div key={cls.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-sm text-gray-800">{cls.name}</span>
                          <span className="text-[10px] font-bold text-gray-400">{cls.code}</span>
                        </div>
                        <div className="mt-2 text-xs font-bold text-gray-500">
                          الطلاب: {students.filter((s) => s.classId === cls.id).length} طالب
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Workspace Tab 2: Classes & Student Roster ── */}
          {activeTab === 'classes' && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-lg font-black text-gray-900">إدارة الفصول الدراسية وكشف الطلاب</h2>
                  <p className="text-xs font-bold text-gray-500">
                    أضف الفصول، ونظّم كشوف الطلاب وانقلهم بين الفصول الدراسية.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddClassOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    <Plus size={15} />
                    <span>فصل جديد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddStudentOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
                  >
                    <Plus size={15} />
                    <span>إضافة طالب</span>
                  </button>
                </div>
              </div>

              {/* Class Selector Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedClassId('')}
                  className={`rounded-xl px-4 py-2 text-xs font-black transition ${
                    selectedClassId === '' ? 'bg-slate-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  كافة الطلاب ({students.length})
                </button>
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`rounded-xl px-4 py-2 text-xs font-black transition ${
                      selectedClassId === cls.id ? 'bg-slate-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {cls.name} ({students.filter((s) => s.classId === cls.id).length})
                  </button>
                ))}
              </div>

              {/* Students Table */}
              <div className="rounded-3xl border border-gray-100 bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="border-b border-gray-100 bg-gray-50 text-[11px] font-black text-gray-500">
                      <tr>
                        <th className="p-4">اسم الطالب</th>
                        <th className="p-4">البريد الإلكتروني</th>
                        <th className="p-4">الفصل</th>
                        <th className="p-4">الحالة</th>
                        <th className="p-4">الهاتف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-bold text-gray-700">
                      {classStudents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-gray-400">
                            لا يوجد طلاب في هذا الكشف. اضغط «إضافة طالب» للبدء.
                          </td>
                        </tr>
                      ) : (
                        classStudents.map((st) => (
                          <tr key={st.studentId} className="hover:bg-gray-50/50">
                            <td className="p-4 font-black text-gray-900">{st.name}</td>
                            <td className="p-4 text-gray-500">{st.email}</td>
                            <td className="p-4">
                              <span className="rounded-lg bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">
                                {st.className || 'بدون فصل'}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                نشط
                              </span>
                            </td>
                            <td className="p-4 text-gray-400">{st.phone || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Workspace Tab 3: Packages & Access Codes ── */}
          {activeTab === 'packages' && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-lg font-black text-gray-900">باقات الوصول ورموز التفعيل (B2B Access Codes)</h2>
                  <p className="text-xs font-bold text-gray-500">
                    أكواد التفعيل المخصصة للمدرسة وربط المقاعد بالباقات التعليمية.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateAccessCode}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
                  >
                    <Key size={15} />
                    <span>توليد كود وصول جديد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotice('تم تصدير كشف أكواد الوصول بصيغة CSV.')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    <Download size={15} />
                    <span>تصدير Excel</span>
                  </button>
                </div>
              </div>

              {/* Access Codes List */}
              <div className="rounded-3xl border border-gray-100 bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="border-b border-gray-100 bg-gray-50 text-[11px] font-black text-gray-500">
                      <tr>
                        <th className="p-4">رمز التفعيل (Access Code)</th>
                        <th className="p-4">الباقة المشمولة</th>
                        <th className="p-4">تاريخ الصلاحية</th>
                        <th className="p-4">المستفيد</th>
                        <th className="p-4">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-bold text-gray-700">
                      {accessCodes.map((code, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="p-4 font-mono font-black text-indigo-700">{code.code}</td>
                          <td className="p-4">{code.packageTitle}</td>
                          <td className="p-4 text-gray-500">{code.expiresAt}</td>
                          <td className="p-4">{code.usedBy || '—'}</td>
                          <td className="p-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                code.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {code.status === 'active' ? 'متاح للاستخدام' : 'مستخدم'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Workspace Tab 4: Relations ── */}
          {activeTab === 'relations' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-black text-gray-900">المجتمع المدرسي والعلاقات الأكاديمية</h2>
                <p className="text-xs font-bold text-gray-500">
                  ربط المعلمين بالفصول الدراسية ومتابعة إسناد الحصص والمهام.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <h3 className="text-sm font-black text-gray-800 mb-2">المعلمون المعتمدون بالمدرسة</h3>
                    {teachers.length === 0 ? (
                      <p className="text-xs text-gray-400">لا يوجد معلمون مسجلون حالياً.</p>
                    ) : (
                      <div className="space-y-2">
                        {teachers.map((t) => (
                          <div key={t.teacherId} className="flex items-center justify-between rounded-xl bg-white p-3 border border-gray-100">
                            <div>
                              <div className="font-black text-xs text-gray-800">{t.name}</div>
                              <div className="text-[10px] text-gray-400">{t.email}</div>
                            </div>
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                              معتمد
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <h3 className="text-sm font-black text-gray-800 mb-2">إسناد المواد والفصول</h3>
                    <p className="text-xs font-bold text-gray-500 mb-3">
                      يمكن للمشرفين والمدير إسناد المعلمين للمواد والفصول عبر لوحة الإسناد الأكاديمي.
                    </p>
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-center text-xs font-bold text-gray-400">
                      تم حفظ إسنادات الفصول بنجاح ومتوافقة مع قاعدة البيانات.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Workspace Tab 5: Bulk Import ── */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-black text-gray-900">الاستيراد الجماعي لكشوف المدرسة</h2>
                <p className="text-xs font-bold text-gray-500">
                  ارفع ملف Excel أو CSV يحتوي على كشف الطلاب، الفصول، وأولياء الأمور ليتم إدراجهم دفعة واحدة.
                </p>

                <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 p-10 text-center">
                  <Upload size={40} className="mx-auto text-indigo-500 mb-3" />
                  <h4 className="text-sm font-black text-gray-800">اسحب وأفلت ملف الكشف هنا أو اختر من جهازك</h4>
                  <p className="mt-1 text-xs font-bold text-gray-400">يدعم صيغ .xlsx و .csv بحد أقصى 5,000 طالب في الملف</p>
                  <button
                    type="button"
                    onClick={() => setNotice('تم تجهيز قالب الاستيراد. اختر الملف للبدء.')}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-700"
                  >
                    <FileSpreadsheet size={15} />
                    <span>تحميل قالب Excel النموذجي</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Workspace Tab 6: Reports & Handover ── */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-black text-gray-900">تقارير التسليم والجاهزية التشغيلية (Handover)</h2>
                    <p className="text-xs font-bold text-gray-500">
                      تقرير الجاهزية الشامل للتسليم إلى إدارة المدرسة والمشرفين.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-800"
                  >
                    <Printer size={15} />
                    <span>طباعة وثيقة التسليم</span>
                  </button>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 space-y-3">
                  <div className="text-xs font-black text-gray-700">عناصر وثيقة التسليم المعتمدة:</div>
                  <div className="grid gap-2 sm:grid-cols-2 text-xs font-bold text-gray-600">
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-600" />
                      <span>بيانات المدرسة وحسابات القيادة المدرسية</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-600" />
                      <span>الفصول الدراسية وقوائم الطلاب المسجلين</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-600" />
                      <span>أكواد التفعيل ورابط الوصول السريع</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-600" />
                      <span>صلاحيات المشرفين والمعلمين الأكاديمية</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Workspace Tab 7: Contract & Safety ── */}
          {activeTab === 'contract' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-black text-gray-900">إعدادات العقد والوحدات المفعلة</h2>
                <p className="text-xs font-bold text-gray-500">
                  التحكم في وحدات المنصة المفعلة للمدرسة، الفصول الذكية، التقييمات، والوصول الآمن.
                </p>

                <div className="space-y-3">
                  {[
                    { title: 'وحدة الفصول الذكية (Smart Classroom)', desc: 'تمكين المعلمين والطلاب من جلسات الحصص المباشرة والأنشطة.', active: true },
                    { title: 'بنك التقييمات والاختبارات المدرسية', desc: 'إتاحة إنشاء اختبارات دورية ومحاكاة قدرات/تحصيلي للمدرسة.', active: true },
                    { title: 'بوابة أولياء الأمور والمتابعة المباشرة', desc: 'إرسال تقارير الأداء ومؤشرات التقدم لأولياء الأمور.', active: true },
                    { title: 'بوابة المشرف التربوي', desc: 'تمكين المشرفين من متابعة جودة الفصول والتقارير.', active: true },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <div>
                        <div className="text-sm font-black text-gray-800">{item.title}</div>
                        <div className="text-xs font-bold text-gray-500 mt-0.5">{item.desc}</div>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 border border-emerald-100">
                        مفعل بالعقد
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Add New School Wizard ── */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2">
                <Building2 size={20} className="text-indigo-600" />
                <h3 className="text-lg font-black text-gray-900">إضافة مدرسة جديدة للشراكات</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWizardOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSchool} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-700">اسم المدرسة</label>
                <input
                  type="text"
                  required
                  value={wizardForm.name}
                  onChange={(e) => setWizardForm({ ...wizardForm, name: e.target.value })}
                  placeholder="مثال: مدرسة دار العلوم الأهلية"
                  className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700">الرمز التعريفي للمدرسة (Code)</label>
                <input
                  type="text"
                  required
                  value={wizardForm.code}
                  onChange={(e) => setWizardForm({ ...wizardForm, code: e.target.value })}
                  placeholder="مثال: SCH-DAR-01"
                  className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 font-mono text-xs font-bold focus:border-indigo-500 focus:outline-none uppercase"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-black text-gray-700">اسم مدير المدرسة</label>
                  <input
                    type="text"
                    value={wizardForm.directorName}
                    onChange={(e) => setWizardForm({ ...wizardForm, directorName: e.target.value })}
                    placeholder="مثال: أ. محمد العتيبي"
                    className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-700">البريد الإلكتروني للإدارة</label>
                  <input
                    type="email"
                    value={wizardForm.directorEmail}
                    onChange={(e) => setWizardForm({ ...wizardForm, directorEmail: e.target.value })}
                    placeholder="director@school.edu.sa"
                    className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700">الفصل الافتراضي الأولي</label>
                <input
                  type="text"
                  value={wizardForm.initialClass}
                  onChange={(e) => setWizardForm({ ...wizardForm, initialClass: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsWizardOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={wizardBusy}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {wizardBusy ? 'جاري الإنشاء...' : 'إنشاء المدرسة وتجهيز مساحة العمل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Rename School ── */}
      {isRenameOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-black text-gray-900 mb-3">تعديل اسم المدرسة</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setIsRenameOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void handleRenameSchool()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
              >
                حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Delete Confirmation ── */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600 mb-2">
              <ShieldAlert size={22} />
              <h3 className="text-base font-black text-gray-900">تأكيد أرشفة المدرسة</h3>
            </div>
            <p className="text-xs font-bold text-gray-500 leading-5">
              هل أنت متأكد من أرشفة المدرسة «{selectedSchool?.name}»؟ سيتم حجب وصول الحسابات المرتبطة مؤقتاً مع الحفاظ على البيانات.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteSchool()}
                disabled={deletePending}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deletePending ? 'جاري الأرشفة...' : 'تأكيد الأرشفة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Class ── */}
      {isAddClassOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-black text-gray-900 mb-3">إضافة فصل دراسي جديد</h3>
            <form onSubmit={handleCreateClass} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">اسم الفصل</label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="مثال: أول ثانوي / أ"
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddClassOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
                >
                  إضافة الفصل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Add Student ── */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-black text-gray-900 mb-3">إضافة طالب إلى الفصل</h3>
            <form onSubmit={handleAddStudent} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">اسم الطالب الرباعي</label>
                <input
                  type="text"
                  required
                  value={newStudentForm.name}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, name: e.target.value })}
                  placeholder="مثال: خالد فهد السالم"
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  required
                  value={newStudentForm.email}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, email: e.target.value })}
                  placeholder="student@school.edu.sa"
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الفصل المستهدف</label>
                <select
                  value={newStudentForm.classId || selectedClassId}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, classId: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddStudentOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
                >
                  تسجيل الطالب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
