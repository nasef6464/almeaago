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
import { authClient } from '../../auth/api/auth-client';
import type { AdminUser } from '../../auth/api/auth-types';
import { SchoolImportPanel, type ImportSummary, type ImportCredentialItem } from '../components/SchoolImportPanel';
import {
  parseImportRows,
  parseTextToRows,
  inspectImportData,
  type ImportRow,
} from '../utils/importRowParsing';
import {
  organizationsClient,
  OrganizationsApiError,
  type SchoolSummary,
  type SchoolClass,
  type DirectorStudent,
  type DirectorTeacher,
  type DirectorAssignment,
  type SchoolContractData,
  type SchoolDirectorRecord,
} from '../api/organizations-client';
import { SchoolCreateDialog } from '../components/SchoolCreateDialog';
import { commerceClient } from '../../commerce/api/commerce-client';
import type { CommerceAccessCode, CommerceProduct } from '../../commerce/api/commerce-types';
import { Skeleton, SkeletonTable, SkeletonMetricCard } from '../../../components/ui/Skeleton';

export const PACKAGE_TIERS = [
  {
    id: 'tier_foundation',
    name: 'باقة التأسيس',
    badge: 'الأساسية',
    description: 'تشمل مسار القدرات وبنك الأسئلة التفاعلي وتأسيس الفصول والمقاعد المدرسية.',
    color: 'border-blue-200 bg-blue-50/50 text-blue-800',
    modules: ['SCHOOL_CORE', 'QUESTION_BANK', 'PATHS_AND_COURSES'],
    allowedPaths: ['qudurat_general'],
    maxSeats: 200,
    maxClasses: 5,
  },
  {
    id: 'tier_excellence',
    name: 'باقة التميز الأكاديمي',
    badge: 'الأكثر طلباً ⭐',
    description: 'تشمل القدرات والتحصيلي والفصول الذكية ونظام الاختبارات والتقييمات المدرسية الشامل.',
    color: 'border-indigo-300 bg-indigo-50/70 text-indigo-900',
    modules: ['SCHOOL_CORE', 'QUESTION_BANK', 'SCHOOL_ASSESSMENTS', 'PATHS_AND_COURSES', 'INTERACTIVE_VIDEO', 'SMART_CLASSROOM'],
    allowedPaths: ['qudurat_general', 'tahsili_science'],
    maxSeats: 500,
    maxClasses: 15,
  },
  {
    id: 'tier_smart_vip',
    name: 'باقة المدرسة الذكية VIP',
    badge: 'VIP شاملة 👑',
    description: 'جميع وحدات المنصة الـ 11 بالكامل، الشعار المميز، ذكاء رادار نافس والتحليلات التنفيذية العليا.',
    color: 'border-amber-300 bg-amber-50/70 text-amber-900',
    modules: [
      'SCHOOL_CORE',
      'QUESTION_BANK',
      'SCHOOL_ASSESSMENTS',
      'PATHS_AND_COURSES',
      'INTERACTIVE_VIDEO',
      'SMART_CLASSROOM',
      'SCHOOL_INTELLIGENCE',
      'INTERVENTION_CENTER',
      'LIVE_TUTORING',
      'WHITE_LABEL',
      'EXECUTIVE_ANALYTICS',
    ],
    allowedPaths: ['qudurat_general', 'tahsili_science', 'tahsili_arts', 'nafis_national'],
    maxSeats: 2000,
    maxClasses: 50,
  },
  {
    id: 'custom',
    name: 'وضع التخصيص الحر',
    badge: 'مخصص',
    description: 'تحكم تفصيلي كامل في اختيار وتفعيل كل موديول ومسار وسعة المقاعد حسب بنود العقد.',
    color: 'border-slate-200 bg-slate-50 text-slate-800',
    modules: [],
    allowedPaths: [],
    maxSeats: 500,
    maxClasses: 15,
  },
] as const;

export const ALL_CONTRACT_MODULES = [
  { id: 'SCHOOL_CORE', title: 'نواة المدرسة والفصول (School Core)', desc: 'إدارة الهيكل التنظيمي والفصول وإسناد الكادر التعليمي.' },
  { id: 'QUESTION_BANK', title: 'بنك الأسئلة المدرسية (Question Bank)', desc: 'إتاحة آلاف الأسئلة المصنفة مع الشروحات ونماذج الحل.' },
  { id: 'SCHOOL_ASSESSMENTS', title: 'التقييمات والاختبارات (School Assessments)', desc: 'إنشاء اختبارات دورية ومحاكاة قدرات وتحصيلي بمستويات قياس.' },
  { id: 'PATHS_AND_COURSES', title: 'المسارات والمقررات (Paths & Courses)', desc: 'المحتوى التعليمي التأسيسي والمتقدم والتسلسل المهاري.' },
  { id: 'INTERACTIVE_VIDEO', title: 'الفيديو التفاعلي (Interactive Video)', desc: 'شروحات مرئية تفاعلية تتوقف لطرح أسئلة قياس فهم فورية.' },
  { id: 'SMART_CLASSROOM', title: 'وحدة الفصول الذكية (Smart Classroom)', desc: 'جلسات تفاعلية حية وتحديات تنافسية مباشرة داخل الفصل.' },
  { id: 'SCHOOL_INTELLIGENCE', title: 'ذكاء المدرسة ورادار نافس (School Intelligence)', desc: 'تحليل الفجوات المهارية ورادار الجاهزية للاختبارات الوطنية.' },
  { id: 'INTERVENTION_CENTER', title: 'مركز التدخلات العلاجية (Intervention Center)', desc: 'خطط علاجية وتوجيه مهاري آلي للطلاب المتعثرين.' },
  { id: 'LIVE_TUTORING', title: 'الدروس المساندة المباشرة (Live Tutoring)', desc: 'فصول تقوية وبث مباشر للمراجعات المكثفة ليلة الاختبار.' },
  { id: 'WHITE_LABEL', title: 'الهوية والشعار المميز (White-Label & Branding)', desc: 'ظهور شعار المدرسة في اللوحات والتقارير والشهادات الرسمية.' },
  { id: 'EXECUTIVE_ANALYTICS', title: 'التحليلات التنفيذية (Executive Analytics)', desc: 'تقارير الأداء الشامل ومؤشرات القيادة لملاك ومدراء المجمعات.' },
] as const;

export const ALL_CONTRACT_PATHS = [
  { id: 'qudurat_general', name: 'القدرات العامة (علمي وأدبي)', badge: 'قدرات' },
  { id: 'tahsili_science', name: 'التحصيلي العلمي (رياضيات، فيزياء، كيمياء، أحياء)', badge: 'تحصيلي علمي' },
  { id: 'tahsili_arts', name: 'التحصيلي الأدبي', badge: 'تحصيلي أدبي' },
  { id: 'nafis_national', name: 'اختبارات نافس الوطنية (جودة التعليم)', badge: 'نافس' },
] as const;

interface SchoolPortfolioStats {
  classesCount: number;
  studentsCount: number;
  teachersCount: number;
  supervisorsCount: number;
  packagesCount: number;
  readinessScore: number;
  readinessStatus: 'ready' | 'near_ready' | 'needs_setup';
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
  const [supervisorsCount, setSupervisorsCount] = useState<number>(0);
  const [assignments, setAssignments] = useState<DirectorAssignment[]>([]);
  const [contractData, setContractData] = useState<SchoolContractData | null>(null);
  const [contractModules, setContractModules] = useState<string[]>([]);
  const [contractStatus, setContractStatus] = useState<'active' | 'inactive' | 'expired'>('active');
  const [contractValidFrom, setContractValidFrom] = useState<string>('');
  const [contractValidUntil, setContractValidUntil] = useState<string>('');
  const [contractAllowedPaths, setContractAllowedPaths] = useState<string[]>([]);
  const [contractLogoUrl, setContractLogoUrl] = useState<string>('');
  const [contractMaxSeats, setContractMaxSeats] = useState<number>(500);
  const [contractMaxClasses, setContractMaxClasses] = useState<number>(15);
  const [contractTier, setContractTier] = useState<string>('tier_excellence');
  const [contractSaving, setContractSaving] = useState(false);
  const [contractNotice, setContractNotice] = useState<string | null>(null);
  const [contractError, setContractError] = useState<string | null>(null);

  // Director Management State
  const [directorsList, setDirectorsList] = useState<SchoolDirectorRecord[]>([]);
  const [isAssignDirectorOpen, setIsAssignDirectorOpen] = useState(false);
  const [candidateDirectors, setCandidateDirectors] = useState<AdminUser[]>([]);
  const [selectedDirectorUserId, setSelectedDirectorUserId] = useState<string>('');
  const [directorAssigning, setDirectorAssigning] = useState<boolean>(false);
  const [directorAssignNotice, setDirectorAssignNotice] = useState<string | null>(null);
  const [directorAssignError, setDirectorAssignError] = useState<string | null>(null);

  // Modals & Panels
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({ name: '', email: '', password: '', classId: '' });

  // Persisted Commerce B2B Packages & Access Codes
  const [packageProducts, setPackageProducts] = useState<CommerceProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [newCodeMaxUses, setNewCodeMaxUses] = useState<number>(50);
  const [newCodeDurationDays, setNewCodeDurationDays] = useState<number>(365);
  const [codeActionBusy, setCodeActionBusy] = useState<boolean>(false);
  const [accessCodes, setAccessCodes] = useState<CommerceAccessCode[]>([]);

  // Noor Bulk Roster Import State
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importCredentials, setImportCredentials] = useState<ImportCredentialItem[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreviewStats, setImportPreviewStats] = useState({
    classNames: [] as string[],
    rowsWithoutPassword: 0,
    duplicateEmails: [] as string[],
    existingEmails: [] as string[],
  });

  const handleImportFile = async (file: File) => {
    try {
      setImportError(null);
      const text = await file.text();
      const rawRows = parseTextToRows(text);
      if (rawRows.length < 2) {
        setImportError('الملف فارغ أو لا يحتوي على صفوف صالحة.');
        return;
      }
      const parsed = parseImportRows(rawRows);
      if (parsed.length === 0) {
        setImportError('لم يتم العثور على صفوف صالحة. تأكد من وجود عمود الاسم والبريد الإلكتروني.');
        return;
      }
      const stats = inspectImportData(parsed);
      setImportRows(parsed);
      setImportPreviewStats({
        classNames: stats.classNames,
        rowsWithoutPassword: stats.rowsWithoutPassword,
        duplicateEmails: stats.duplicateEmails,
        existingEmails: [],
      });
      if (stats.duplicateEmails.length > 0) {
        setImportError(`يوجد ${stats.duplicateEmails.length} إيميل مكرر في الملف. يرجى تصحيح التكرار.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر قراءة ملف الكشف.';
      setImportError(msg);
    }
  };

  const handleStartImport = async () => {
    if (!selectedSchool || importRows.length === 0) return;
    try {
      setIsImporting(true);
      setImportError(null);
      const csrf = await getCsrfToken();
      const createdCreds: ImportCredentialItem[] = [];
      const touchedClasses = new Set<string>();

      const existingClassMap = new Map<string, string>();
      classes.forEach((c) => existingClassMap.set(c.name.trim(), c.id));
      let fallbackClassId = selectedClassId || classes[0]?.id || '';

      for (const row of importRows) {
        let classId = '';
        if (row.className && row.className.trim()) {
          const cName = row.className.trim();
          touchedClasses.add(cName);
          if (existingClassMap.has(cName)) {
            classId = existingClassMap.get(cName)!;
          } else {
            try {
              const res = await organizationsClient.createClass(selectedSchool.id, { name: cName }, csrf);
              classId = res.class.id;
              existingClassMap.set(cName, classId);
            } catch {
              classId = fallbackClassId;
            }
          }
        } else {
          classId = fallbackClassId;
        }
        if (!classId) {
          const res = await organizationsClient.createClass(selectedSchool.id, { name: 'الصف الافتراضي' }, csrf);
          classId = res.class.id;
          fallbackClassId = classId;
          existingClassMap.set('الصف الافتراضي', classId);
        }

        const pwd = row.password && row.password.trim() ? row.password.trim() : `Almeaa@${Math.floor(1000 + Math.random() * 9000)}`;
        await organizationsClient.addSchoolStudent(selectedSchool.id, {
          name: row.name,
          email: row.email,
          password: pwd,
          classId,
        }, csrf);
        createdCreds.push({
          name: row.name,
          email: row.email,
          password: pwd,
          className: row.className || 'الصف الافتراضي',
        });
      }

      setImportCredentials(createdCreds);
      setImportSummary({
        totalRows: importRows.length,
        imported: createdCreds.length,
        classesTouched: touchedClasses.size || 1,
      });
      void loadSchoolWorkspace(selectedSchool);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إتمام عملية الاستيراد.';
      setImportError(msg);
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = '\uFEFFاسم الطالب,البريد الإلكتروني,الفصل,كلمة المرور\nفيصل بن سعد,faisal@example.com,الصف الثالث الثانوي (أ),Pass@123\nسارة خالد المنصور,sara@example.com,الصف الثالث الثانوي (ب),';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'school-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadCredentials = () => {
    if (importCredentials.length === 0) return;
    const header = 'اسم الطالب,البريد الإلكتروني,الفصل,كلمة المرور\n';
    const rows = importCredentials.map((c) => `"${c.name}","${c.email}","${c.className || ''}","${c.password || ''}"`).join('\n');
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `credentials-${selectedSchool?.code || 'school'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
      setContractError(null);
      setContractNotice(null);
      setSelectedSchool(school);
      setRenameValue(school.name);

      const [
        classesRes,
        studentRosterRes,
        teacherRosterRes,
        supervisorRosterRes,
        assignmentsRes,
        contractRes,
        directorsRes,
        productsRes,
        accessCodesRes,
      ] = await Promise.allSettled([
        organizationsClient.classes(school.id),
        organizationsClient.roster(school.id, { role: 'student', limit: 100 }),
        organizationsClient.roster(school.id, { role: 'teacher', limit: 100 }),
        organizationsClient.roster(school.id, { role: 'supervisor', limit: 100 }),
        organizationsClient.assignments(school.id),
        organizationsClient.contract(school.id),
        organizationsClient.directors(school.id),
        commerceClient.products(1, 50, 'package'),
        commerceClient.accessCodes(1, 100, school.id),
      ]);

      const loadedClasses =
        classesRes.status === 'fulfilled' && Array.isArray(classesRes.value.classes)
          ? classesRes.value.classes
          : [];
      setClasses(loadedClasses);
      if (loadedClasses.length > 0) {
        setSelectedClassId((prev) => (prev && loadedClasses.some((c) => c.id === prev) ? prev : loadedClasses[0].id));
      } else {
        setSelectedClassId('');
      }
      const classNameMap = new Map(loadedClasses.map((c) => [c.id, c.name]));

      if (studentRosterRes.status === 'fulfilled' && Array.isArray(studentRosterRes.value.members)) {
        setStudents(
          studentRosterRes.value.members.map((m) => {
            const firstClassId = m.classIds?.[0] || null;
            return {
              studentId: m.userId,
              name: m.name,
              email: m.email,
              phone: '',
              isActive: m.status === 'active',
              classId: firstClassId,
              className: firstClassId ? classNameMap.get(firstClassId) || null : null,
            };
          }),
        );
      } else {
        setStudents([]);
      }

      if (teacherRosterRes.status === 'fulfilled' && Array.isArray(teacherRosterRes.value.members)) {
        setTeachers(
          teacherRosterRes.value.members.map((m) => ({
            teacherId: m.userId,
            name: m.name,
            email: m.email,
            isActive: m.status === 'active',
          })),
        );
      } else {
        setTeachers([]);
      }

      if (supervisorRosterRes.status === 'fulfilled') {
        setSupervisorsCount(
          supervisorRosterRes.value.pagination?.total ?? supervisorRosterRes.value.members?.length ?? 0,
        );
      } else {
        setSupervisorsCount(school.stats?.supervisorsCount ?? 0);
      }

      if (assignmentsRes.status === 'fulfilled' && Array.isArray(assignmentsRes.value.assignments)) {
        setAssignments(
          assignmentsRes.value.assignments.map((raw) => {
            const a = raw as Record<string, unknown>;
            return {
              assignmentId: String(a.assignmentId || a.id || ''),
              teacherId: String(a.teacherId || ''),
              classId: String(a.classId || ''),
              subjectId: String(a.subjectId || ''),
              status: String(a.status || 'active'),
            };
          }),
        );
      } else {
        setAssignments([]);
      }

      if (directorsRes.status === 'fulfilled' && directorsRes.value && Array.isArray(directorsRes.value.directors)) {
        setDirectorsList(directorsRes.value.directors);
      } else {
        setDirectorsList([]);
      }

      if (productsRes.status === 'fulfilled' && Array.isArray(productsRes.value.items)) {
        const pkgItems = productsRes.value.items.filter((p) => p.productType === 'package');
        setPackageProducts(pkgItems);
        const defaultPaid = pkgItems.find((p) => p.status === 'active' && p.accessMode === 'paid') || pkgItems[0];
        setSelectedProductId((prev) => (prev && pkgItems.some((p) => p.id === prev) ? prev : defaultPaid?.id || ''));
      } else {
        setPackageProducts([]);
        setSelectedProductId('');
      }

      if (accessCodesRes.status === 'fulfilled' && Array.isArray(accessCodesRes.value.items)) {
        setAccessCodes(accessCodesRes.value.items);
      } else {
        setAccessCodes([]);
      }

      if (contractRes.status === 'fulfilled' && contractRes.value.contract) {
        const c = contractRes.value.contract;
        setContractData(c);
        setContractModules(c.modules || []);
        setContractStatus(c.status || 'active');
        setContractValidFrom(c.validFrom ? c.validFrom.split('T')[0] : '');
        setContractValidUntil(c.validUntil ? c.validUntil.split('T')[0] : '');
        const meta = c.metadata || {};
        setContractAllowedPaths(meta.allowedPaths || ['qudurat_general', 'tahsili_science']);
        setContractLogoUrl(meta.logoUrl || '');
        setContractMaxSeats(typeof meta.maxSeats === 'number' ? meta.maxSeats : 500);
        setContractMaxClasses(typeof meta.maxClasses === 'number' ? meta.maxClasses : 15);
        setContractTier(meta.packageTier || 'tier_excellence');
      } else if (contractRes.status === 'rejected') {
        const isNotFound = contractRes.reason instanceof OrganizationsApiError && contractRes.reason.status === 404;
        if (isNotFound) {
          setContractData(null);
          setContractModules(['SCHOOL_CORE']);
          setContractStatus('active');
          setContractValidFrom('');
          setContractValidUntil('');
          setContractAllowedPaths(['qudurat_general']);
          setContractLogoUrl('');
          setContractMaxSeats(200);
          setContractMaxClasses(5);
          setContractTier('tier_foundation');
          setContractNotice('لا يوجد عقد محفوظ بعد. سيُنشأ عند الحفظ الأول.');
        } else {
          setContractData(null);
          setContractModules([]);
          setContractError('تعذر قراءة العقد من الخادم. لم يتم تغيير أي بيانات محليًا.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تحميل بيانات المدرسة';
      setError(msg);
    } finally {
      setWorkspaceLoading(false);
    }
  };

  // Portfolio Statistics Helper (derived strictly from backend school.stats)
  const getSchoolStats = (school: SchoolSummary): SchoolPortfolioStats => {
    const raw = school.stats;
    const classesCount = raw?.classesCount ?? 0;
    const studentsCount = raw?.studentsCount ?? 0;
    const teachersCount = raw?.teachersCount ?? 0;
    const supervisorsCountForSchool = raw?.supervisorsCount ?? 0;
    const packagesCount = raw?.activePackagesCount ?? 0;
    const activeAccessCodesCount = raw?.activeAccessCodesCount ?? 0;
    const hasActiveContract = raw?.contractStatus === 'active';

    const checks = [
      classesCount > 0,
      studentsCount > 0,
      teachersCount > 0 || supervisorsCountForSchool > 0,
      hasActiveContract || packagesCount > 0,
      activeAccessCodesCount > 0,
    ];
    const readinessScore = checks.filter(Boolean).length * 20;

    const readinessStatus: 'ready' | 'near_ready' | 'needs_setup' =
      readinessScore >= 80 ? 'ready' : readinessScore >= 40 ? 'near_ready' : 'needs_setup';

    return {
      classesCount,
      studentsCount,
      teachersCount,
      supervisorsCount: supervisorsCountForSchool,
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
  }, [schools, search, statusFilter]);

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
  }, [schools]);

  // Handlers
  const handleSelectPackageTier = (tierId: string) => {
    setContractTier(tierId);
    const found = PACKAGE_TIERS.find((t) => t.id === tierId);
    if (found && tierId !== 'custom') {
      setContractModules([...found.modules]);
      setContractAllowedPaths([...found.allowedPaths]);
      setContractMaxSeats(found.maxSeats);
      setContractMaxClasses(found.maxClasses);
    }
  };

  const handleToggleModule = (modId: string) => {
    setContractTier('custom');
    setContractModules((prev) =>
      prev.includes(modId) ? prev.filter((m) => m !== modId) : [...prev, modId]
    );
  };

  const handleTogglePath = (pathId: string) => {
    setContractTier('custom');
    setContractAllowedPaths((prev) =>
      prev.includes(pathId) ? prev.filter((p) => p !== pathId) : [...prev, pathId]
    );
  };

  const handleSaveContract = async () => {
    if (!selectedSchool || contractError) return;
    if (contractValidFrom && contractValidUntil && contractValidUntil < contractValidFrom) {
      setContractError('تاريخ انتهاء العقد يجب ألا يسبق تاريخ البداية.');
      return;
    }
    try {
      setContractSaving(true);
      setContractError(null);
      setContractNotice(null);
      const csrf = await getCsrfToken();
      const payload = {
        status: contractStatus,
        modules: contractModules,
        validFrom: contractValidFrom ? new Date(contractValidFrom).toISOString() : null,
        validUntil: contractValidUntil ? new Date(contractValidUntil).toISOString() : null,
        expectedRevision: contractData?.revision || 0,
        metadata: {
          packageTier: contractTier,
          allowedPaths: contractAllowedPaths,
          maxSeats: Number(contractMaxSeats) || 0,
          maxClasses: Number(contractMaxClasses) || 0,
          logoUrl: contractLogoUrl.trim(),
          branding: {
            subtitle: `${selectedSchool.name} - ترخيص معتمد`,
          },
        },
      };

      const res = await organizationsClient.updateContract(selectedSchool.id, payload, csrf);
      if (res && res.contract) {
        setContractData(res.contract);
        setContractNotice('✅ تم حفظ بنود العقد والهوية بنجاح وتحديث التراخيص.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر حفظ إعدادات العقد';
      setContractError(msg);
    } finally {
      setContractSaving(false);
    }
  };

  async function openCreatedSchool(school: SchoolSummary) {
    setNotice(`تم إنشاء المدرسة «${school.name}» بنجاح.`);
    await loadSchools();
    await loadSchoolWorkspace(school);
  }

  const openAssignDirectorModal = async () => {
    setDirectorAssignNotice(null);
    setDirectorAssignError(null);
    setSelectedDirectorUserId(directorsList[0]?.membership?.userId || '');
    setIsAssignDirectorOpen(true);
    try {
      const res = await authClient.adminListUsers({ role: 'school_admin', limit: 100 });
      if (res && res.users) {
        setCandidateDirectors(res.users);
      }
    } catch {
      // ignore
    }
  };

  const handleAssignDirector = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedSchool) return;
    const userId = selectedDirectorUserId.trim();
    if (!userId) {
      setDirectorAssignError('يرجى اختيار أو إدخال المعرف الخاص بمدير المدرسة.');
      return;
    }

    try {
      setDirectorAssigning(true);
      setDirectorAssignError(null);
      setDirectorAssignNotice(null);
      const csrf = await getCsrfToken();
      await organizationsClient.upsertDirector(selectedSchool.id, userId, { status: 'active' }, csrf);
      setDirectorAssignNotice('✅ تم تعيين مدير المدرسة بنجاح وتفعيل صلاحياته الإدارية.');
      setNotice(`تم تعيين مدير المدرسة بنجاح لمدرسة «${selectedSchool.name}».`);

      const updated = await organizationsClient.directors(selectedSchool.id);
      if (updated && updated.directors) {
        setDirectorsList(updated.directors);
      }
      setTimeout(() => {
        setIsAssignDirectorOpen(false);
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تعيين مدير المدرسة';
      setDirectorAssignError(msg);
    } finally {
      setDirectorAssigning(false);
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
      const targetClassId = newStudentForm.classId || selectedClassId || (classes[0]?.id || '');
      if (!targetClassId) {
        setError('يرجى إنشاء فصل دراسي أولًا قبل إضافة طالب.');
        return;
      }
      const csrf = await getCsrfToken();
      await organizationsClient.addSchoolStudent(
        selectedSchool.id,
        {
          name: newStudentForm.name.trim(),
          email: newStudentForm.email.trim(),
          password: newStudentForm.password || 'Student@123456',
          classId: targetClassId,
        },
        csrf,
      );
      setNotice(`تمت إضافة الطالب «${newStudentForm.name.trim()}» بنجاح.`);
      setIsAddStudentOpen(false);
      setNewStudentForm({ name: '', email: '', password: '', classId: '' });
      const classNameMap = new Map(classes.map((c) => [c.id, c.name]));
      const rosterRes = await organizationsClient.roster(selectedSchool.id, { role: 'student', limit: 100 });
      if (rosterRes && Array.isArray(rosterRes.members)) {
        setStudents(
          rosterRes.members.map((m) => {
            const firstClassId = m.classIds?.[0] || null;
            return {
              studentId: m.userId,
              name: m.name,
              email: m.email,
              phone: '',
              isActive: m.status === 'active',
              classId: firstClassId,
              className: firstClassId ? classNameMap.get(firstClassId) || null : null,
            };
          }),
        );
      }
      void loadSchools();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إضافة الطالب';
      setError(msg);
    }
  };

  const handleGenerateAccessCode = async () => {
    if (!selectedSchool) return;
    if (!selectedProductId) {
      setError('يلزم اختيار باقة مدفوعة نشطة قبل توليد كود وصول جديد.');
      return;
    }
    try {
      setCodeActionBusy(true);
      setError(null);
      setNotice(null);
      const csrf = await getCsrfToken();
      const rawPrefix = (selectedSchool.code || 'SCH').replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase() || 'SCH';
      const suffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const code = `${rawPrefix}-${suffix}`;
      const maxUses = Math.max(1, Math.min(10000, Number(newCodeMaxUses) || 50));
      const days = Math.max(1, Math.min(3650, Number(newCodeDurationDays) || 365));
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      const res = await commerceClient.createAccessCode(
        {
          code,
          productId: selectedProductId,
          schoolId: selectedSchool.id,
          maxUses,
          expiresAt,
        },
        csrf,
      );
      const updated = await commerceClient.accessCodes(1, 100, selectedSchool.id);
      setAccessCodes(updated.items || (res?.accessCode ? [res.accessCode, ...accessCodes] : accessCodes));
      setNotice(`تم توليد كود وصول جديد: ${res?.accessCode?.code || code}`);
      void loadSchools();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر توليد كود الوصول';
      setError(msg);
    } finally {
      setCodeActionBusy(false);
    }
  };

  const handleToggleAccessCodeStatus = async (row: CommerceAccessCode) => {
    if (!selectedSchool) return;
    const nextStatus = row.status === 'active' ? 'paused' : 'active';
    try {
      setCodeActionBusy(true);
      setError(null);
      const csrf = await getCsrfToken();
      const res = await commerceClient.setAccessCodeStatus(row, nextStatus, csrf);
      if (res?.accessCode) {
        setAccessCodes((prev) => prev.map((c) => (c.id === row.id ? res.accessCode : c)));
      }
      setNotice(nextStatus === 'active' ? `تم تفعيل الكود ${row.code}` : `تم إيقاف الكود ${row.code} مؤقتًا`);
      void loadSchools();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تحديث حالة الكود';
      setError(msg);
    } finally {
      setCodeActionBusy(false);
    }
  };

  const handleExportAccessCodesCsv = () => {
    if (!selectedSchool || accessCodes.length === 0) {
      setError('لا توجد أكواد وصول مسجلة لتصديرها.');
      return;
    }
    const productNameById = new Map(packageProducts.map((p) => [p.id, p.name]));
    const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['الكود', 'الباقة', 'الاستخدامات', 'الحد الأقصى', 'تاريخ الانتهاء', 'الحالة'].map(esc).join(',');
    const rows = accessCodes.map((c) =>
      [
        c.code,
        productNameById.get(c.productId) || c.productId,
        c.currentUses,
        c.maxUses,
        c.expiresAt ? c.expiresAt.slice(0, 10) : '',
        c.status,
      ]
        .map(esc)
        .join(','),
    );
    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `access-codes-${selectedSchool.code || 'school'}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice('تم تنزيل كشف أكواد الوصول بصيغة CSV.');
  };

  const activeAccessCodesCount = useMemo(
    () =>
      accessCodes.filter(
        (c) => c.status === 'active' && new Date(c.expiresAt).getTime() > Date.now() && c.currentUses < c.maxUses,
      ).length,
    [accessCodes],
  );

  const workspaceReadiness = useMemo(() => {
    const hasContract = contractData?.status === 'active' || (selectedSchool?.stats?.activePackagesCount ?? 0) > 0;
    const checks = [
      classes.length > 0,
      students.length > 0,
      teachers.length > 0 || supervisorsCount > 0,
      hasContract,
      activeAccessCodesCount > 0,
    ];
    const done = checks.filter(Boolean).length;
    return { done, total: checks.length, percent: done * 20 };
  }, [classes.length, students.length, teachers.length, supervisorsCount, contractData?.status, selectedSchool?.stats?.activePackagesCount, activeAccessCodesCount]);

  const paidPackageProducts = useMemo(
    () => packageProducts.filter((p) => p.status === 'active' && p.accessMode === 'paid'),
    [packageProducts],
  );

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
              <h1 className="text-2xl font-black text-gray-900">إدارة المدارس والشركاء (محفظة المدارس والشراكات التعليمية)</h1>
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
              <div className="text-[10px] text-gray-400 font-bold">المدارس النشطة</div>
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
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${statusFilter === f.id
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
            <div
              className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
              role="status"
              aria-busy="true"
              aria-label="جاري تحميل محفظة المدارس..."
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col justify-between rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4 animate-pulse"
                >
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20 rounded-md" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-48 rounded-lg" />
                    <Skeleton className="h-3 w-32 rounded-md" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-28 rounded-md" />
                      <Skeleton className="h-3 w-10 rounded-md" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50 dark:border-slate-800">
                    <Skeleton className="h-8 rounded-xl" />
                    <Skeleton className="h-8 rounded-xl" />
                  </div>
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ))}
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
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${stats.readinessStatus === 'ready'
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
                            className={`h-full transition-all duration-500 ${stats.readinessScore >= 75
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

                      <div className="grid grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            void loadSchoolWorkspace(s);
                            setActiveTab('contract');
                          }}
                          className="rounded-lg border border-indigo-100 bg-indigo-50/50 py-1.5 text-[11px] font-bold text-indigo-700 transition hover:bg-indigo-100"
                        >
                          العقد والباقة
                        </button>
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
                  <h2 className="sr-only">إدارة المدارس والشركاء</h2>
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
                  onClick={openAssignDirectorModal}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                  data-testid="assign-director-btn"
                >
                  <UserCheck size={14} />
                  <span>{directorsList.length > 0 ? 'تغيير مدير المدرسة' : 'تعيين مدير المدرسة'}</span>
                </button>
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
                <span className="font-black text-gray-800">{activeAccessCodesCount}</span>
              </div>
              <div className="p-2">
                <span className="text-gray-400 font-bold">الجاهزية: </span>
                <span
                  className={`font-black ${
                    workspaceReadiness.percent >= 80
                      ? 'text-emerald-700'
                      : workspaceReadiness.percent >= 40
                        ? 'text-amber-700'
                        : 'text-rose-700'
                  }`}
                >
                  {workspaceReadiness.percent === 100
                    ? '100% مكتمل'
                    : `${workspaceReadiness.percent}% (${workspaceReadiness.done}/${workspaceReadiness.total})`}
                </span>
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
                className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold transition whitespace-nowrap cursor-pointer ${activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Workspace Tabs Content */}
          {workspaceLoading ? (
            <div
              className="space-y-6 mt-6"
              role="status"
              aria-busy="true"
              aria-label="جاري تحميل بيانات مساحة عمل المدرسة..."
            >
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonMetricCard key={i} />
                ))}
              </div>
              <SkeletonTable columns={6} rows={6} />
            </div>
          ) : (
            <>
              {/* ── Workspace Tab 1: Overview ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-black text-gray-900">الملخص التنفيذي للمدرسة</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-indigo-900 font-black text-xs">
                        <UserCheck size={16} />
                        <span>مدير المدرسة المفوض</span>
                      </div>
                      <button
                        type="button"
                        onClick={openAssignDirectorModal}
                        className="text-[10px] font-black text-indigo-600 hover:underline cursor-pointer"
                        data-testid="overview-assign-director-link"
                      >
                        {directorsList.length > 0 ? 'تعديل' : 'تعيين'}
                      </button>
                    </div>
                    {directorsList.length > 0 ? (
                      <div className="mt-2 text-xs">
                        <div className="font-black text-gray-900">{directorsList[0].user?.name || 'مدير المدرسة'}</div>
                        <div className="text-[11px] font-mono text-gray-500 truncate">{directorsList[0].user?.email}</div>
                        <span className="inline-block mt-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                          صلاحيات نشطة
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs">
                        <p className="font-bold text-gray-500">لم يتم تعيين مدير بعد.</p>
                        <button
                          type="button"
                          onClick={openAssignDirectorModal}
                          className="mt-1.5 text-[11px] font-black text-indigo-700 hover:underline"
                        >
                          + تعيين مدير المدرسة
                        </button>
                      </div>
                    )}
                  </div>
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
                      {accessCodes.length === 0
                        ? 'لم يتم إصدار أكواد تفعيل لهذه المدرسة بعد.'
                        : `إجمالي الأكواد: ${accessCodes.length} · النشطة: ${activeAccessCodesCount} · الاستخدامات المسجلة: ${accessCodes.reduce((sum, c) => sum + c.currentUses, 0)}`}
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
                  className={`rounded-xl px-4 py-2 text-xs font-black transition ${selectedClassId === '' ? 'bg-slate-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  كافة الطلاب ({students.length})
                </button>
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`rounded-xl px-4 py-2 text-xs font-black transition ${selectedClassId === cls.id ? 'bg-slate-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
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
              <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-black text-gray-900">باقات الوصول ورموز التفعيل (B2B Access Codes)</h2>
                    <p className="text-xs font-bold text-gray-500">
                      أكواد التفعيل المخصصة للمدرسة وربط المقاعد بالباقات التعليمية المعتمدة.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleGenerateAccessCode()}
                      disabled={codeActionBusy || paidPackageProducts.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                    >
                      <Key size={15} />
                      <span>{codeActionBusy ? 'جاري التوليد...' : 'توليد كود وصول جديد'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportAccessCodesCsv}
                      disabled={accessCodes.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                    >
                      <Download size={15} />
                      <span>تصدير Excel</span>
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 border-t border-gray-100 pt-4">
                  <div>
                    <label className="block text-[11px] font-black text-gray-600 mb-1">الباقة المدفوعة المرتبطة</label>
                    <select
                      aria-label="الباقة المدفوعة المرتبطة"
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white p-2 text-xs font-bold"
                    >
                      {paidPackageProducts.length === 0 ? (
                        <option value="">لا توجد باقات مدفوعة نشطة في التجارة</option>
                      ) : (
                        paidPackageProducts.map((pkg) => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.name} ({pkg.code})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-gray-600 mb-1">عدد المقاعد لكل كود</label>
                    <input
                      aria-label="عدد المقاعد لكل كود"
                      type="number"
                      min={1}
                      max={10000}
                      value={newCodeMaxUses}
                      onChange={(e) => setNewCodeMaxUses(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full rounded-xl border border-gray-200 p-2 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-gray-600 mb-1">مدة الصلاحية (أيام)</label>
                    <input
                      aria-label="مدة الصلاحية بالأيام"
                      type="number"
                      min={1}
                      max={3650}
                      value={newCodeDurationDays}
                      onChange={(e) => setNewCodeDurationDays(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full rounded-xl border border-gray-200 p-2 text-xs font-bold"
                    />
                  </div>
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
                        <th className="p-4">الاستخدام</th>
                        <th className="p-4">الحالة</th>
                        <th className="p-4">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-bold text-gray-700">
                      {accessCodes.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-400">
                            لا توجد أكواد وصول مسجلة لهذه المدرسة بعد. اختر باقة مدفوعة ثم اضغط «توليد كود وصول جديد».
                          </td>
                        </tr>
                      ) : (
                        accessCodes.map((code) => {
                          const pkgName = packageProducts.find((p) => p.id === code.productId)?.name || code.productId;
                          const expired = new Date(code.expiresAt).getTime() <= Date.now();
                          return (
                            <tr key={code.id} className="hover:bg-gray-50/50">
                              <td className="p-4 font-mono font-black text-indigo-700">{code.code}</td>
                              <td className="p-4">{pkgName}</td>
                              <td className="p-4 text-gray-500">{code.expiresAt ? code.expiresAt.slice(0, 10) : '—'}</td>
                              <td className="p-4">
                                {code.currentUses} / {code.maxUses}
                              </td>
                              <td className="p-4">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                    code.status === 'active' && !expired && code.currentUses < code.maxUses
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : code.status === 'paused'
                                        ? 'bg-amber-50 text-amber-800'
                                        : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {expired
                                    ? 'منتهي'
                                    : code.currentUses >= code.maxUses
                                      ? 'مكتمل الاستخدام'
                                      : code.status === 'active'
                                        ? 'متاح للاستخدام'
                                        : code.status === 'paused'
                                          ? 'موقوف مؤقتًا'
                                          : 'مؤرشف'}
                                </span>
                              </td>
                              <td className="p-4">
                                {code.status !== 'archived' ? (
                                  <button
                                    type="button"
                                    disabled={codeActionBusy}
                                    onClick={() => void handleToggleAccessCodeStatus(code)}
                                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                                  >
                                    {code.status === 'active' ? 'إيقاف' : 'تفعيل'}
                                  </button>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
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

                {/* School Director Leadership */}
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-900 font-black text-sm">
                      <UserCheck size={18} />
                      <span>القيادة الإدارية ومدير المدرسة</span>
                    </div>
                    <button
                      type="button"
                      onClick={openAssignDirectorModal}
                      className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-indigo-700 transition cursor-pointer"
                      data-testid="relations-assign-director-btn"
                    >
                      {directorsList.length > 0 ? 'تعديل / تغيير المدير' : 'إسناد مدير المدرسة'}
                    </button>
                  </div>
                  {directorsList.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-4 text-xs font-bold text-amber-800">
                      لم يتم تعيين مدير معتمد لهذه المدرسة بعد. اضغط على الزر أعلاه لاختيار وتفويض مدير المدرسة عبر <code>upsertDirector</code>.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 bg-white rounded-xl border border-gray-100 p-3">
                      {directorsList.map((dir, idx) => (
                        <div key={dir.membership?.id || idx} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-2">
                          <div>
                            <div className="font-black text-xs text-gray-900">{dir.user?.name || 'مدير المدرسة'}</div>
                            <div className="text-[11px] font-mono text-gray-500">{dir.user?.email}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 border border-emerald-100">
                              {dir.membership?.status === 'active' ? 'مدير معتمد نشط' : dir.membership?.status}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {dir.membership?.permissions?.length || 0} صلاحيات مفوضة
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

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
                      إسنادات المعلمين المسجلة للمدرسة في قاعدة البيانات ({assignments.length}).
                    </p>
                    {assignments.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-center text-xs font-bold text-gray-400">
                        لا توجد إسنادات فصول مسجلة حاليًا.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {assignments.map((asg, idx) => {
                          const teacherName = teachers.find((t) => t.teacherId === asg.teacherId)?.name || asg.teacherId;
                          const className = classes.find((c) => c.id === asg.classId)?.name || asg.classId;
                          return (
                            <div key={asg.assignmentId || idx} className="flex items-center justify-between rounded-xl bg-white p-3 border border-gray-100">
                              <div>
                                <div className="font-black text-xs text-gray-800">{teacherName}</div>
                                <div className="text-[10px] text-gray-500">{className}</div>
                              </div>
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-700">
                                {asg.status === 'active' ? 'نشط' : asg.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Workspace Tab 5: Bulk Import ── */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              <SchoolImportPanel
                importRows={importRows}
                importSummary={importSummary}
                isImporting={isImporting}
                importCredentials={importCredentials}
                importError={importError}
                importPreviewStats={importPreviewStats}
                handleImportFile={handleImportFile}
                handleStartImport={handleStartImport}
                downloadTemplate={downloadTemplate}
                downloadCredentials={downloadCredentials}
                onReset={() => {
                  setImportRows([]);
                  setImportSummary(null);
                  setImportCredentials([]);
                  setImportError(null);
                  setImportPreviewStats({
                    classNames: [],
                    rowsWithoutPassword: 0,
                    duplicateEmails: [],
                    existingEmails: [],
                  });
                }}
              />
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
              {/* Header & Save Action Bar */}
              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-gray-900">إدارة العقود والباقات المرنة والشعار المميز</h2>
                      <span className="rounded-full bg-indigo-50 px-3 py-0.5 text-xs font-black text-indigo-700 border border-indigo-100">
                        النسخة التعاقدية #{contractData?.revision ?? 1}
                      </span>
                      <span
                        className={`rounded-full px-3 py-0.5 text-xs font-black border ${contractStatus === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                      >
                        {contractStatus === 'active' ? 'العقد سارٍ ونشط' : 'العقد غير نشط'}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-gray-500 mt-1">
                      إعدادات العقد والوحدات المفعلة: تحديد قوالب الباقات المعتمدة، ترخيص المسارات التعليمية، تفعيل موديولات المنصة الـ 11، وضبط الشعار والهوية المدرسية.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveContract}
                    disabled={contractSaving || Boolean(contractError)}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <Sparkles size={18} />
                    <span>{contractSaving ? 'جاري الحفظ والاعتماد...' : 'حفظ واعتماد بنود العقد'}</span>
                  </button>
                </div>

                {contractNotice && (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-black text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>{contractNotice}</span>
                  </div>
                )}
                {contractError && (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-black text-rose-800 flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>{contractError}</span>
                  </div>
                )}
              </div>

              {/* 1. Package Tier Selection Cards */}
              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-black text-gray-900">1. قوالب الباقات التعاقدية المسبقة (Package Tiers)</h3>
                  <p className="text-xs text-gray-500 font-bold">اختر قالباً تعاقدياً لملء الوحدات والمسارات والمقاعد الموصى بها، أو اختر التخصيص الحر.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {PACKAGE_TIERS.map((tier) => {
                    const isSelected = contractTier === tier.id;
                    return (
                      <div
                        key={tier.id}
                        onClick={() => handleSelectPackageTier(tier.id)}
                        className={`cursor-pointer rounded-2xl border-2 p-4 transition-all relative ${isSelected
                            ? 'border-indigo-600 bg-indigo-50/40 shadow-md ring-2 ring-indigo-600/10'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-xs'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-gray-500">{tier.badge}</span>
                          {isSelected && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                              <Check size={12} />
                            </span>
                          )}
                        </div>
                        <h4 className="mt-2 text-sm font-black text-gray-900">{tier.name}</h4>
                        <p className="mt-1 text-[11px] leading-5 text-gray-500 font-bold">{tier.description}</p>
                        {tier.id !== 'custom' && (
                          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[10px] font-black text-gray-600">
                            <span>{tier.modules.length} موديولات</span>
                            <span>{tier.maxSeats} مقعد</span>
                            <span>{tier.maxClasses} فصل</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Licensed Paths & School Capacity */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Allowed Learning Paths */}
                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                  <h3 className="text-base font-black text-gray-900">2. المسارات التعليمية المرخصة للمدرسة (`allowedPaths`)</h3>
                  <p className="text-xs text-gray-500 font-bold">حدد المسارات التدريبية التي يحق لطلاب ومعلمي المدرسة الوصول إليها.</p>

                  <div className="space-y-2.5">
                    {ALL_CONTRACT_PATHS.map((path) => {
                      const isAllowed = contractAllowedPaths.includes(path.id);
                      return (
                        <div
                          key={path.id}
                          onClick={() => handleTogglePath(path.id)}
                          className={`flex cursor-pointer items-center justify-between rounded-2xl border p-3.5 transition-all ${isAllowed
                              ? 'border-indigo-300 bg-indigo-50/50 text-indigo-950 font-black'
                              : 'border-gray-200 bg-gray-50/50 text-gray-600 hover:bg-gray-100/50'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isAllowed}
                              onChange={() => handleTogglePath(path.id)}
                              className="h-4 w-4 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <span className="text-xs font-black">{path.name}</span>
                            </div>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-black border border-gray-200 shadow-2xs">
                            {path.badge}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Capacity & Dates */}
                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                  <h3 className="text-base font-black text-gray-900">3. سعة التراخيص وفترة السريان</h3>
                  <p className="text-xs text-gray-500 font-bold">ضبط الحد الأقصى للمقاعد والفصول وتواريخ سريان العقد.</p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-black text-gray-700">سعة مقاعد الطلاب (Max Seats)</label>
                      <input
                        type="number"
                        min="1"
                        value={contractMaxSeats}
                        onChange={(e) => {
                          setContractTier('custom');
                          setContractMaxSeats(Number(e.target.value) || 0);
                        }}
                        className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-700">الحد الأقصى للفصول (Max Classes)</label>
                      <input
                        type="number"
                        min="1"
                        value={contractMaxClasses}
                        onChange={(e) => {
                          setContractTier('custom');
                          setContractMaxClasses(Number(e.target.value) || 0);
                        }}
                        className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-700">تاريخ بدء السريان</label>
                      <input
                        type="date"
                        value={contractValidFrom}
                        onChange={(e) => setContractValidFrom(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-700">تاريخ انتهاء السريان</label>
                      <input
                        type="date"
                        value={contractValidUntil}
                        onChange={(e) => setContractValidUntil(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-xs font-black text-gray-700 mb-1">حالة العقد التعاقدي</label>
                    <div className="flex gap-2">
                      {(['active', 'inactive', 'expired'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setContractStatus(st)}
                          className={`rounded-xl px-4 py-2 text-xs font-black border transition-all ${contractStatus === st
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                        >
                          {st === 'active' ? 'نشط (Active)' : st === 'inactive' ? 'معلق (Inactive)' : 'منتهي (Expired)'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. School Logo & Branding Customization */}
              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-black text-gray-900">4. هوية وشعار المدرسة (School Branding & White-Label Logo)</h3>
                  <p className="text-xs text-gray-500 font-bold">
                    شعار وهوية المدرسة التي تظهر في رأس شاشات الطلاب والمعلمين، وعلى الشهادات والتقارير المطبوعة.
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  <div className="md:col-span-2 space-y-3">
                    <div>
                      <label className="block text-xs font-black text-gray-700">رابط الشعار الرسمي للمدرسة (Logo URL)</label>
                      <input
                        type="text"
                        value={contractLogoUrl}
                        onChange={(e) => setContractLogoUrl(e.target.value)}
                        placeholder="https://.../school-logo.png"
                        className="mt-1 w-full rounded-xl border border-gray-200 p-2.5 font-mono text-xs text-gray-800 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-gray-500">شعارات نموذجية سريعة للتجربة:</span>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {[
                          { label: 'شعار مدارس الفرسان النموذجية', url: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=160&auto=format&fit=crop&q=80' },
                          { label: 'شعار مجمع الرياض التعليمي', url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=160&auto=format&fit=crop&q=80' },
                          { label: 'شعار دار العلوم الأهلية', url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=160&auto=format&fit=crop&q=80' },
                        ].map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setContractLogoUrl(preset.url)}
                            className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-100"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Logo Live Preview */}
                  <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-[11px] font-black text-gray-500 mb-2">معاينة الشعار الحية</span>
                    {contractLogoUrl.trim() ? (
                      <div className="flex flex-col items-center gap-2">
                        <img
                          src={contractLogoUrl.trim()}
                          alt="School Logo Preview"
                          loading="lazy"
                          className="h-20 w-20 rounded-2xl border border-gray-200 bg-white p-2 object-contain shadow-sm"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                          }}
                        />
                        <span className="text-[10px] font-black text-emerald-700">✓ جاهز للظهور في اللوحات والشهادات</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-400 py-3">
                        <Building2 size={36} />
                        <span className="text-[11px] font-bold">لم يتم تحديد شعار بعد</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. The 11 Modular Entitlements Grid */}
              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-black text-gray-900">5. حزمة الميزات الـ 11 للتحكم بالوحدات المدرسية (11 Modules)</h3>
                    <p className="text-xs text-gray-500 font-bold">
                      يمكنك تشغيل أو إيقاف أي موديول حسب المتفق عليه في عقد المدرسة.
                    </p>
                  </div>
                  <span className="text-xs font-black text-indigo-700">
                    مفعل: {contractModules.length} من {ALL_CONTRACT_MODULES.length}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {ALL_CONTRACT_MODULES.map((mod) => {
                    const isEnabled = contractModules.includes(mod.id);
                    return (
                      <div
                        key={mod.id}
                        onClick={() => handleToggleModule(mod.id)}
                        className={`cursor-pointer rounded-2xl border p-4 transition-all flex flex-col justify-between ${isEnabled
                            ? 'border-emerald-300 bg-emerald-50/40 shadow-xs'
                            : 'border-gray-200 bg-gray-50/30 opacity-75 hover:opacity-100 hover:border-gray-300'
                          }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-gray-900">{mod.title}</span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black border ${isEnabled
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : 'bg-gray-100 text-gray-500 border-gray-200'
                                }`}
                            >
                              {isEnabled ? 'مفعل بالعقد ✓' : 'معطل'}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-5 text-gray-500 font-bold">{mod.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
            </>
          )}
        </div>
      )}

      <SchoolCreateDialog
        open={isWizardOpen}
        getCsrfToken={getCsrfToken}
        onClose={() => setIsWizardOpen(false)}
        onCreated={school => void openCreatedSchool(school)}
      />

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

      {/* ── Modal: Assign Director ── */}
      {isAssignDirectorOpen && selectedSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsAssignDirectorOpen(false)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="text-indigo-600" size={20} />
                <h2 className="text-lg font-black text-slate-900">تعيين مدير لمدرسة «{selectedSchool.name}»</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignDirectorOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {directorAssignNotice && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800" data-testid="director-assign-success">
                {directorAssignNotice}
              </div>
            )}

            {directorAssignError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800" data-testid="director-assign-error">
                {directorAssignError}
              </div>
            )}

            <form onSubmit={handleAssignDirector} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  اختر مدير المدرسة من قائمة المدراء المسجلين
                </label>
                <select
                  value={selectedDirectorUserId}
                  onChange={(e) => setSelectedDirectorUserId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-bold"
                  data-testid="assign-director-select"
                >
                  <option value="">-- اختر مدير المدرسة --</option>
                  {candidateDirectors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.email})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] font-bold text-slate-400">
                  أو يمكنك كتابة المعرف (UUID) يدوياً في الحقل أدناه إذا كان الحساب غير مدرج في القائمة المختصرة:
                </p>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  المعرف التعريفي لمدير المدرسة (User ID)
                </label>
                <input
                  type="text"
                  value={selectedDirectorUserId}
                  onChange={(e) => setSelectedDirectorUserId(e.target.value)}
                  placeholder="مثال: e1f49618-b219-4b68-b74e-0a06840742ea"
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-mono font-bold"
                  data-testid="assign-director-input"
                />
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-900 space-y-1">
                <div className="font-black">معلومات الصلاحيات المفوضة:</div>
                <p className="text-[11px] font-bold text-slate-600 leading-5">
                  سيتم تفعيل عضوية المدير بحالة <code>active</code> ومنحه الصلاحيات الكاملة لإدارة المدرسة والفصول والطلاب وتكليف المعلمين وإنشاء الاختبارات المدرسية.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsAssignDirectorOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={directorAssigning || !selectedDirectorUserId.trim()}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                  data-testid="submit-assign-director-btn"
                >
                  {directorAssigning ? 'جاري تعيين المدير...' : 'تأكيد التعيين والتفعيل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
