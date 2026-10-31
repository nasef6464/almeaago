import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Archive,
  ArrowRight,
  Award,
  BookOpen,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Eye,
  FileQuestion,
  GraduationCap,
  Layers,
  LayoutGrid,
  Library,
  Loader2,
  Package,
  PackagePlus,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Settings,
  Sparkles,
  Target,
  X,
} from 'lucide-react';

import { useAuth } from '../../auth/state/AuthProvider';
import {
  taxonomyAdminClient,
  type AdminTaxonomyBootstrap,
  type AdminTaxonomyLevel,
  type AdminTaxonomyPath,
  type AdminTaxonomySkill,
  type AdminTaxonomySubject,
  type TaxonomyStatus,
} from '../api/taxonomy-admin-client';
import { commerceClient } from '../../commerce/api/commerce-client';
import type {
  CommerceContentType,
  CommercePackageItem,
  CommerceProduct,
} from '../../commerce/api/commerce-types';
import { contentClient } from '../../content/api/content-client';
import type { CourseSummary, LibrarySummary } from '../../content/api/content-types';
import { assessmentClient } from '../../assessment/api/assessment-client';
import type { AssessmentSummary } from '../../assessment/api/assessment-types';
import { AdminBreadcrumbHeader } from '../components/AdminBreadcrumbHeader';
import { EducationalIconPicker } from '../components/EducationalIconPicker';
import {
  getPathIcon,
  getSubjectIcon,
  getLevelIcon,
  resolveColor,
  resolvePathDisplaySettings,
} from '../components/pathDisplayPresentation';
import {
  type PathsManagerPathTab,
  type PathsManagerSubjectTab,
  replacePathsManagerUrlState,
  resolvePathsManagerUrlState,
} from '../components/pathsManagerUrlState';
import { buildPathReadinessSummary } from '../components/pathReadiness';

const EMPTY: AdminTaxonomyBootstrap = { paths: [], levels: [], subjects: [], skills: [] };
const statusLabels: Record<TaxonomyStatus, string> = {
  active: 'نشط',
  inactive: 'غير نشط',
  archived: 'مؤرشف',
};

function StatusSelect({
  value,
  onChange,
  label,
}: {
  value: TaxonomyStatus;
  onChange: (value: TaxonomyStatus) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as TaxonomyStatus)}
      className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-black shadow-xs focus:border-indigo-500 focus:outline-hidden"
    >
      <option value="active">نشط</option>
      <option value="inactive">غير نشط</option>
      <option value="archived">مؤرشف</option>
    </select>
  );
}

export function TaxonomyAdminPage() {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const [data, setData] = useState<AdminTaxonomyBootstrap>(EMPTY);
  const [busy, setBusy] = useState(true);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);

  // URL state management
  const initialUrlState = resolvePathsManagerUrlState();
  const [selectedPathId, setSelectedPathId] = useState<string | null>(initialUrlState.selectedPathId);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(initialUrlState.selectedSubjectId);
  const [pathTab, setPathTab] = useState<PathsManagerPathTab>(initialUrlState.pathTab);
  const [subjectTab, setSubjectTab] = useState<PathsManagerSubjectTab>(initialUrlState.subjectTab);

  // Modals state
  const [isPathModalOpen, setIsPathModalOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<AdminTaxonomyPath | null>(null);
  const [pathForm, setPathForm] = useState({
    code: '',
    name: '',
    parentPathId: '',
    description: '',
    sortOrder: 0,
    color: 'indigo',
    icon: '📚',
    iconUrl: '',
    iconStyle: 'default',
    showInNavbar: true,
    showSubjectCards: true,
    showMockExamCard: true,
    showPackageCard: true,
    stageLabel: 'اختر المرحلة الدراسية',
    stageSelection: 'optional',
  });

  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<AdminTaxonomyLevel | null>(null);
  const [levelForm, setLevelForm] = useState({
    code: '',
    name: '',
    sortOrder: 0,
    icon: '🎓',
    iconUrl: '',
  });

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<AdminTaxonomySubject | null>(null);
  const [subjectForm, setSubjectForm] = useState({
    code: '',
    name: '',
    levelId: '',
    sortOrder: 0,
    color: 'indigo',
    icon: '📖',
    iconUrl: '',
    iconStyle: 'default',
  });

  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [pkgForm, setPkgForm] = useState({
    code: '',
    name: '',
    priceMinor: 9900,
    contentType: 'all' as CommerceContentType,
  });

  // Skills Modal State
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<AdminTaxonomySkill | null>(null);
  const [skillForm, setSkillForm] = useState({
    code: '',
    name: '',
    parentSkillId: '',
    description: '',
    kind: 'main' as 'main' | 'sub',
    sortOrder: 1,
  });

  // Additional data for readiness & tabs
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [packages, setPackages] = useState<CommerceProduct[]>([]);
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibrarySummary[]>([]);
  const [mockExamSearch, setMockExamSearch] = useState('');
  const [isMockModalOpen, setIsMockModalOpen] = useState(false);
  const [mockForm, setMockForm] = useState({ title: '', code: '', durationMinutes: 120, passingScore: 60 });
  const [librarySearch, setLibrarySearch] = useState('');
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [libraryForm, setLibraryForm] = useState({ title: '', url: '', description: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: 'path' | 'level' | 'subject' | 'skill'; id: string; name: string } | null>(null);

  // Search & Filter State
  const [pathSearch, setPathSearch] = useState('');
  const [pathStatusFilter, setPathStatusFilter] = useState<'all' | 'active' | 'inactive' | 'archived'>('all');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [skillSearch, setSkillSearch] = useState('');
  const [skillKindFilter, setSkillKindFilter] = useState<'all' | 'main' | 'sub'>('all');

  const isAdmin = user?.roles.includes('admin') ?? false;

  // Sync with URL State
  useEffect(() => {
    replacePathsManagerUrlState({
      selectedPathId,
      selectedSubjectId,
      pathTab,
      subjectTab,
    });
  }, [pathTab, selectedPathId, selectedSubjectId, subjectTab]);

  // Load Bootstrap Data
  useEffect(() => {
    if (authLoading || !user || !isAdmin) return;
    const c = new AbortController();
    setBusy(true);
    setError('');

    Promise.all([
      taxonomyAdminClient.bootstrap(c.signal),
      contentClient.courses({ limit: 100 }, c.signal).catch(() => ({ items: [] as CourseSummary[], page: 1, limit: 100, hasMore: false })),
      commerceClient.products(1, 100, 'package', '', c.signal).catch(() => ({ items: [] as CommerceProduct[], page: 1, limit: 100, hasMore: false })),
      assessmentClient.list({ limit: 100 }, c.signal).catch(() => ({ items: [] as AssessmentSummary[], page: 1, limit: 100, hasMore: false })),
      contentClient.library({ limit: 100 }, c.signal).catch(() => ({ items: [] as LibrarySummary[], page: 1, limit: 100, hasMore: false })),
    ])
      .then(([nextTaxonomy, coursesRes, commerceRes, assessmentsRes, libraryRes]) => {
        setData(nextTaxonomy);
        setCourses(coursesRes.items || []);
        setPackages(commerceRes.items || []);
        setAssessments(assessmentsRes.items || []);
        setLibraryItems(libraryRes.items || []);

        setSelectedPathId((current) => {
          if (current && nextTaxonomy.paths.some((x: AdminTaxonomyPath) => x.id === current)) return current;
          return nextTaxonomy.paths[0]?.id || null;
        });
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'تعذر تحميل التصنيف');
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });

    return () => c.abort();
  }, [authLoading, isAdmin, reload, user]);

  const selectedPath = useMemo(
    () => data.paths.find((x) => x.id === selectedPathId) || null,
    [data.paths, selectedPathId]
  );
  const levels = useMemo(
    () => data.levels.filter((x) => x.pathId === selectedPathId),
    [data.levels, selectedPathId]
  );
  const subjects = useMemo(
    () => data.subjects.filter((x) => x.pathId === selectedPathId),
    [data.subjects, selectedPathId]
  );
  const selectedSubject = useMemo(
    () => subjects.find((x) => x.id === selectedSubjectId) || null,
    [subjects, selectedSubjectId]
  );
  const subjectSkills = useMemo(
    () => data.skills.filter((x) => x.subjectId === selectedSubjectId),
    [data.skills, selectedSubjectId]
  );

  const filteredPaths = useMemo(() => {
    return data.paths.filter((p) => {
      const q = pathSearch.trim().toLowerCase();
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
      const matchesStatus = pathStatusFilter === 'all' || p.status === pathStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data.paths, pathSearch, pathStatusFilter]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      const q = subjectSearch.trim().toLowerCase();
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
      const matchesLevel = levelFilter === 'all' || (levelFilter === 'none' ? !s.levelId : s.levelId === levelFilter);
      return matchesSearch && matchesLevel;
    });
  }, [subjects, subjectSearch, levelFilter]);

  const filteredSkills = useMemo(() => {
    return subjectSkills.filter((sk) => {
      const q = skillSearch.trim().toLowerCase();
      const matchesSearch = !q || sk.name.toLowerCase().includes(q) || sk.code.toLowerCase().includes(q);
      const matchesKind = skillKindFilter === 'all' || sk.kind === skillKindFilter;
      return matchesSearch && matchesKind;
    });
  }, [subjectSkills, skillSearch, skillKindFilter]);

  const readinessSummary = useMemo(() => {
    if (!selectedPath) return null;
    return buildPathReadinessSummary({
      pathId: selectedPath.id,
      subjects,
      courses,
    });
  }, [courses, selectedPath, subjects]);

  async function run(key: string, action: (csrf: string) => Promise<void>, success: string) {
    setPending(key);
    setError('');
    setNotice('');
    try {
      const csrf = await getCsrfToken();
      await action(csrf);
      setNotice(success);
      setReload((x) => x + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تنفيذ عملية التصنيف');
    } finally {
      setPending('');
    }
  }

  // --- Path Actions ---
  const openCreatePath = () => {
    setEditingPath(null);
    setPathForm({
      code: '',
      name: '',
      parentPathId: '',
      description: '',
      sortOrder: (data.paths.length + 1) * 10,
      color: 'indigo',
      icon: '📚',
      iconUrl: '',
      iconStyle: 'default',
      showInNavbar: true,
      showSubjectCards: true,
      showMockExamCard: true,
      showPackageCard: true,
      stageLabel: 'اختر المرحلة الدراسية',
      stageSelection: 'optional',
    });
    setIsPathModalOpen(true);
  };

  const openEditPath = (path: AdminTaxonomyPath) => {
    setEditingPath(path);
    setPathForm({
      code: path.code,
      name: path.name,
      parentPathId: path.parentPathId || '',
      description: path.description || '',
      sortOrder: path.sortOrder || 0,
      color: path.color || 'indigo',
      icon: path.icon || '📚',
      iconUrl: path.iconUrl || '',
      iconStyle: path.iconStyle || 'default',
      showInNavbar: path.showInNavbar !== false,
      showSubjectCards: path.showSubjectCards !== false,
      showMockExamCard: path.showMockExamCard !== false,
      showPackageCard: path.showPackageCard !== false,
      stageLabel: path.settings?.stageLabel || 'اختر المرحلة الدراسية',
      stageSelection: path.settings?.stageSelection || 'optional',
    });
    setIsPathModalOpen(true);
  };

  const savePath = async () => {
    if (!pathForm.code.trim() || !pathForm.name.trim()) {
      return setError('أدخل كود واسم المسار.');
    }
    const payload = {
      ...pathForm,
      code: pathForm.code.trim(),
      name: pathForm.name.trim(),
      settings: {
        stageLabel: pathForm.stageLabel,
        stageSelection: pathForm.stageSelection,
      },
    };

    if (editingPath) {
      await run(
        'update-path',
        (csrf) => taxonomyAdminClient.updatePath(editingPath.id, payload, csrf).then(() => undefined),
        'تم حفظ تعديلات المسار بنجاح.'
      );
    } else {
      await run(
        'create-path',
        (csrf) => taxonomyAdminClient.createPath(payload, csrf).then(() => undefined),
        'تم إنشاء المسار بنجاح.'
      );
    }
    setIsPathModalOpen(false);
  };

  // --- Level Actions ---
  const openCreateLevel = () => {
    setEditingLevel(null);
    setLevelForm({
      code: '',
      name: '',
      sortOrder: (levels.length + 1) * 10,
      icon: '🎓',
      iconUrl: '',
    });
    setIsLevelModalOpen(true);
  };

  const openEditLevel = (lvl: AdminTaxonomyLevel) => {
    setEditingLevel(lvl);
    setLevelForm({
      code: lvl.code,
      name: lvl.name,
      sortOrder: lvl.sortOrder || 0,
      icon: lvl.icon || '🎓',
      iconUrl: lvl.iconUrl || '',
    });
    setIsLevelModalOpen(true);
  };

  const saveLevel = async () => {
    if (!selectedPath || !levelForm.code.trim() || !levelForm.name.trim()) {
      return setError('أدخل كود واسم المرحلة.');
    }
    if (editingLevel) {
      await run(
        'update-level',
        (csrf) => taxonomyAdminClient.updateLevel(editingLevel.id, levelForm, csrf).then(() => undefined),
        'تم حفظ تعديلات المرحلة بنجاح.'
      );
    } else {
      await run(
        'create-level',
        (csrf) =>
          taxonomyAdminClient.createLevel({ pathId: selectedPath.id, ...levelForm }, csrf).then(() => undefined),
        'تم إنشاء المرحلة بنجاح.'
      );
    }
    setIsLevelModalOpen(false);
  };

  // --- Subject Actions ---
  const openCreateSubject = () => {
    setEditingSubject(null);
    setSubjectForm({
      code: '',
      name: '',
      levelId: levels[0]?.id || '',
      sortOrder: (subjects.length + 1) * 10,
      color: selectedPath?.color || 'indigo',
      icon: '📖',
      iconUrl: '',
      iconStyle: 'default',
    });
    setIsSubjectModalOpen(true);
  };

  const openEditSubject = (sub: AdminTaxonomySubject) => {
    setEditingSubject(sub);
    setSubjectForm({
      code: sub.code,
      name: sub.name,
      levelId: sub.levelId || '',
      sortOrder: sub.sortOrder || 0,
      color: sub.color || 'indigo',
      icon: sub.icon || '📖',
      iconUrl: sub.iconUrl || '',
      iconStyle: sub.iconStyle || 'default',
    });
    setIsSubjectModalOpen(true);
  };

  const saveSubject = async () => {
    if (!selectedPath || !subjectForm.code.trim() || !subjectForm.name.trim()) {
      return setError('أدخل كود واسم المادة.');
    }
    if (editingSubject) {
      await run(
        'update-subject',
        (csrf) => taxonomyAdminClient.updateSubject(editingSubject.id, subjectForm, csrf).then(() => undefined),
        'تم حفظ تعديلات المادة بنجاح.'
      );
    } else {
      await run(
        'create-subject',
        (csrf) =>
          taxonomyAdminClient.createSubject({ pathId: selectedPath.id, ...subjectForm }, csrf).then(() => undefined),
        'تم إنشاء المادة بنجاح.'
      );
    }
    setIsSubjectModalOpen(false);
  };

  // --- Skill Actions ---
  const openCreateSkill = () => {
    setEditingSkill(null);
    setSkillForm({
      code: '',
      name: '',
      parentSkillId: '',
      description: '',
      kind: 'main',
      sortOrder: (subjectSkills.length + 1) * 10,
    });
    setIsSkillModalOpen(true);
  };

  const openEditSkill = (sk: AdminTaxonomySkill) => {
    setEditingSkill(sk);
    setSkillForm({
      code: sk.code,
      name: sk.name,
      parentSkillId: sk.parentSkillId || '',
      description: sk.description || '',
      kind: sk.kind || 'main',
      sortOrder: sk.sortOrder || 1,
    });
    setIsSkillModalOpen(true);
  };

  const saveSkill = async () => {
    if (!selectedSubject || !skillForm.code.trim() || !skillForm.name.trim()) {
      return setError('أدخل كود واسم المهارة.');
    }
    if (editingSkill) {
      await run(
        'update-skill',
        (csrf) =>
          taxonomyAdminClient
            .updateSkill(
              editingSkill.id,
              {
                name: skillForm.name.trim(),
                parentSkillId: skillForm.parentSkillId || '',
                description: skillForm.description.trim(),
                sortOrder: skillForm.sortOrder,
              },
              csrf,
            )
            .then(() => undefined),
        'تم حفظ تعديلات المهارة بنجاح.'
      );
    } else {
      await run(
        'create-skill',
        (csrf) =>
          taxonomyAdminClient
            .createSkill(
              {
                subjectId: selectedSubject.id,
                code: skillForm.code.trim().toUpperCase(),
                name: skillForm.name.trim(),
                parentSkillId: skillForm.parentSkillId || undefined,
                description: skillForm.description.trim(),
                kind: skillForm.kind,
                sortOrder: skillForm.sortOrder,
              },
              csrf,
            )
            .then(() => undefined),
        'تم إنشاء المهارة بنجاح.'
      );
    }
    setIsSkillModalOpen(false);
  };

  // --- Package Actions ---
  const createPathPackage = async () => {
    if (!selectedPath || !pkgForm.code.trim() || !pkgForm.name.trim()) {
      return setError('أدخل كود واسم الباقة.');
    }
    await run(
      'create-package',
      (csrf) =>
        commerceClient
          .createProduct(
            {
              code: pkgForm.code.trim().toUpperCase(),
              productType: 'package',
              name: pkgForm.name.trim(),
              description: `باقة خاصة بمسار ${selectedPath.name}`,
              status: 'active',
              accessMode: 'paid',
              priceMinor: Math.max(1, Math.trunc(pkgForm.priceMinor)),
              currency: 'SAR',
              courseId: '',
              isVisible: true,
              package: {
                packageKind: 'bundle',
                seatCapacity: null,
                validityDays: null,
                items: [
                  {
                    scopeType: pkgForm.contentType === 'all' ? 'all' : 'content_type',
                    courseId: '',
                    pathId: selectedPath.id,
                    subjectId: '',
                    contentType: pkgForm.contentType === 'all' ? '' : (pkgForm.contentType as CommerceContentType),
                  },
                ],
              },
            },
            csrf
          )
          .then(() => undefined),
      'تم إنشاء باقة المسار بنجاح.'
    );
    setIsPackageModalOpen(false);
  };

  // --- Status Patch ---
  async function patchStatus(type: 'path' | 'level' | 'subject' | 'skill', id: string, status: TaxonomyStatus) {
    const method =
      type === 'path'
        ? taxonomyAdminClient.updatePath
        : type === 'level'
          ? taxonomyAdminClient.updateLevel
          : type === 'subject'
            ? taxonomyAdminClient.updateSubject
            : taxonomyAdminClient.updateSkill;
    await run(
      `status-${type}-${id}`,
      (csrf) => method(id, { status } as never, csrf).then(() => undefined),
      `تم تحديث الحالة إلى «${statusLabels[status]}».`
    );
  }

  // Quick Toggle Path Presentation
  async function togglePathSetting(
    key: 'showInNavbar' | 'showSubjectCards' | 'showMockExamCard' | 'showPackageCard',
    currentVal?: boolean
  ) {
    if (!selectedPath) return;
    const nextVal = currentVal === false;
    await run(
      `toggle-${key}`,
      (csrf) => taxonomyAdminClient.updatePath(selectedPath.id, { [key]: nextVal }, csrf).then(() => undefined),
      'تم تحديث إعدادات المسار.'
    );
  }

  if (authLoading) return <main className="p-10 text-center font-black">جاري التحقق من الصلاحيات...</main>;
  if (!isAdmin) {
    return (
      <main dir="rtl" className="p-10 text-center font-black text-rose-700">
        إدارة التصنيف والمسارات متاحة لمدير المنصة فقط.
      </main>
    );
  }

  const pathColor = resolveColor(selectedPath?.color);

  // ══════════════════════════════════════════════════════════════════════
  // SCENE 2: SUBJECT WORKSPACE (مساحة عمل المادة المتكاملة)
  // ══════════════════════════════════════════════════════════════════════
  if (selectedSubject && selectedPath) {
    const subjectColor = resolveColor(selectedSubject.color || selectedPath.color);
    const parentLevel = levels.find((l) => l.id === selectedSubject.levelId);

    return (
      <main dir="rtl" className="mx-auto max-w-7xl space-y-6 pb-16 font-sans">
        {/* Breadcrumb Header */}
        <AdminBreadcrumbHeader
          breadcrumbs={[
            { label: 'إدارة المسارات', onClick: () => { setSelectedSubjectId(null); } },
            { label: selectedPath.name, onClick: () => { setSelectedSubjectId(null); } },
            { label: selectedSubject.name, active: true },
          ]}
          title={selectedSubject.name}
          subtitle={`مساحة عمل وإدارة محتوى المادة (${selectedSubject.code})`}
          icon={getSubjectIcon(selectedSubject, 'w-8 h-8')}
          badge={
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black"
              style={{ backgroundColor: subjectColor.soft, color: subjectColor.text }}
            >
              {parentLevel ? parentLevel.name : 'مادة مباشرة'}
            </span>
          }
          actions={
            <button
              type="button"
              onClick={() => openEditSubject(selectedSubject)}
              className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-black text-gray-700 shadow-xs hover:bg-gray-50 transition"
            >
              تعديل بيانات المادة
            </button>
          }
          onBack={() => setSelectedSubjectId(null)}
          backLabel={`العودة لمسار ${selectedPath.name}`}
        />

        {/* Feedback Messages */}
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">{notice}</div> : null}

        {/* Subject Workspace Tabs */}
        <div className="flex border-b border-gray-200 gap-2 overflow-x-auto pb-px">
          {[
            { id: 'courses', label: 'الدورات التدريبية', icon: BookOpen },
            { id: 'skills', label: 'شجرة المهارات', icon: Award },
            { id: 'questions', label: 'بنك الأسئلة والتدريب', icon: FileQuestion },
            { id: 'exams', label: 'الاختبارات والتقييمات', icon: CheckCircle2 },
            { id: 'library', label: 'المكتبة والمراجع', icon: Library },
            { id: 'settings', label: 'إعدادات المادة', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = subjectTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubjectTab(tab.id as PathsManagerSubjectTab)}
                className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-black transition-all border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-xl'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content: Skills */}
        {subjectTab === 'skills' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white p-5 border shadow-xs">
              <div>
                <h3 className="text-lg font-black text-slate-900">شجرة مهارات {selectedSubject.name}</h3>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  المهارات الأساسية والفرعية المربوطة بأسئلة ومسائل هذه المادة.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openCreateSkill}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-indigo-700 transition"
                >
                  <Plus size={15} />
                  <span>إضافة مهارة</span>
                </button>
                <Link
                  to="/admin-dashboard?tab=skills"
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 transition"
                >
                  <span>مركز المهارات الكامل</span>
                  <ExternalLink size={14} />
                </Link>
              </div>
            </div>

            {/* Search & Kind Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl bg-white p-4 border shadow-xs">
              <div className="relative flex-1">
                <Search size={15} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  placeholder="البحث في المهارات بالاسم أو الكود..."
                  className="w-full rounded-xl border border-gray-200 bg-slate-50 py-2 pr-9 pl-3 text-xs font-bold outline-none focus:border-indigo-400 focus:bg-white transition"
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {(['all', 'main', 'sub'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setSkillKindFilter(kind)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                      skillKindFilter === kind
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'border border-gray-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {kind === 'all' ? 'كافة المهارات' : kind === 'main' ? 'رئيسية فقط' : 'فرعية فقط'}
                  </button>
                ))}
                <span className="text-xs font-bold text-slate-400 mr-2">
                  ({filteredSkills.length} من {subjectSkills.length})
                </span>
              </div>
            </div>

            <div className="rounded-3xl border bg-white p-5 shadow-xs">
              {filteredSkills.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-bold">
                  {subjectSkills.length === 0
                    ? 'لا توجد مهارات مسجلة لهذه المادة بعد. اضغط «إضافة مهارة» لإنشاء أول مهارة.'
                    : 'لا توجد مهارات مطابقة لمعايير البحث الحالية.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSkills.map((sk) => {
                    const parentSkill = sk.parentSkillId ? subjectSkills.find((p) => p.id === sk.parentSkillId) : null;
                    return (
                      <div
                        key={sk.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-gray-100 p-3.5 hover:bg-slate-50 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-black shrink-0 ${
                              sk.kind === 'main' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {sk.kind === 'main' ? 'رئيسية' : 'فرعية'}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <strong className="text-sm font-black text-slate-900 truncate">{sk.name}</strong>
                              <span className="text-xs text-slate-400 font-mono shrink-0">{sk.code}</span>
                            </div>
                            {parentSkill && (
                              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                تابعة للمهارة الرئيسية: <span className="font-bold text-indigo-600">{parentSkill.name}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => openEditSkill(sk)}
                            className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-100 transition"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm({ open: true, type: 'skill', id: sk.id, name: sk.name })}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100 transition"
                            title="أرشفة المهارة"
                          >
                            <Archive size={13} />
                          </button>
                          <StatusSelect
                            label={`حالة مهارة ${sk.name}`}
                            value={sk.status}
                            onChange={(v) => void patchStatus('skill', sk.id, v)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Courses */}
        {subjectTab === 'courses' && (
          <div className="rounded-3xl border bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">الدورات التدريبية في {selectedSubject.name}</h3>
                <p className="text-xs text-slate-500 font-bold mt-1">الدورات التأسيسية والمكثفة المنشورة للطالب.</p>
              </div>
              <Link
                to="/admin-dashboard/content"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100 transition"
              >
                <span>إدارة المحتوى والدورات</span>
                <ChevronLeft size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 pt-2">
              {courses
                .filter((c) => c.subjectId === selectedSubject.id || c.pathId === selectedPath.id)
                .map((course) => (
                  <div key={course.id} className="rounded-2xl border border-gray-100 p-4 bg-slate-50/50">
                    <h4 className="font-black text-sm text-slate-900">{course.title}</h4>
                    <p className="text-xs text-slate-500 font-bold mt-1">{course.instructorName || 'مدرب معتمد'}</p>
                    <Link
                      to={`/course/${course.id}`}
                      target="_blank"
                      className="mt-3 block text-center rounded-xl bg-white border py-1.5 text-xs font-black text-slate-700 hover:text-indigo-600"
                    >
                      معاينة الدورة للطالب
                    </Link>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Tab Content: Questions & Drills */}
        {subjectTab === 'questions' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white p-4 border shadow-xs">
              <div>
                <h3 className="text-lg font-black text-slate-900">بنوك الأسئلة والتدريبات في {selectedSubject.name}</h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">
                  الأسئلة والتمارين التدريبية المخصصة لتثبيت المفاهيم وتدريب الطالب.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/admin-dashboard/questions?pathId=${selectedPath.id}&subjectId=${selectedSubject.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 transition"
                >
                  <Plus size={15} />
                  <span>إدارة بنك الأسئلة للمادة</span>
                </Link>
              </div>
            </div>

            {/* Skills & Topics Coverage */}
            <div className="rounded-3xl border bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h4 className="text-sm font-black text-slate-900">المهارات المشمولة في بنوك الأسئلة</h4>
                <span className="text-xs font-bold text-slate-400">{subjectSkills.length} مهارات مسجلة</span>
              </div>
              {subjectSkills.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold border border-dashed rounded-2xl">
                  لا توجد مهارات مسجلة بعد لهذه المادة. انتقل لتبويب «التأسيس والمهارات» لإضافة المهارات.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {subjectSkills.map((sk) => (
                    <div key={sk.id} className="rounded-2xl border border-gray-100 bg-slate-50/50 p-3.5 flex items-center justify-between">
                      <div>
                        <span className="font-black text-xs text-slate-900 block">{sk.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{sk.code}</span>
                      </div>
                      <Link
                        to={`/admin-dashboard/questions?pathId=${selectedPath.id}&subjectId=${selectedSubject.id}&search=${encodeURIComponent(sk.name)}`}
                        className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                      >
                        عرض الأسئلة
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Quizzes & Assessments */}
        {subjectTab === 'exams' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white p-4 border shadow-xs">
              <div>
                <h3 className="text-lg font-black text-slate-900">الاختبارات والتقييمات في {selectedSubject.name}</h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">
                  الاختبارات الدورية، الاختبارات البعدية، ونماذج التقييم المرحلية.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/admin-dashboard/assessments?pathId=${selectedPath.id}&subjectId=${selectedSubject.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-700 px-4 py-2 text-xs font-black text-white hover:bg-purple-800 transition"
                >
                  <Plus size={15} />
                  <span>مركز الاختبارات والتقييم</span>
                </Link>
              </div>
            </div>

            {(() => {
              const subjectExams = assessments.filter((a) => a.subjectId === selectedSubject.id && a.kind !== 'mock');
              if (subjectExams.length === 0) {
                return (
                  <div className="rounded-3xl border border-dashed bg-white p-12 text-center text-slate-400 font-bold space-y-2">
                    <Award size={36} className="mx-auto text-purple-300" />
                    <p className="text-sm">لا توجد اختبارات مسجلة لهذه المادة بعد.</p>
                    <Link
                      to={`/admin-dashboard/assessments?pathId=${selectedPath.id}&subjectId=${selectedSubject.id}`}
                      className="mt-3 inline-flex rounded-xl bg-indigo-50 px-4 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100"
                    >
                      إنشاء أول اختبار للمادة ←
                    </Link>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {subjectExams.map((exam) => (
                    <div
                      key={exam.id}
                      className="rounded-3xl border border-gray-100 bg-white p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                            exam.isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {exam.isPublished ? 'منشور' : 'مسودة'}
                          </span>
                          <span className="font-mono text-xs text-slate-400">{exam.code}</span>
                        </div>
                        <h4 className="font-black text-sm text-slate-900 leading-snug">{exam.title}</h4>
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                        <Link
                          to={`/assessments/${exam.id}/start`}
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-200"
                        >
                          <Eye size={13} />
                          <span>معاينة</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Tab Content: Library */}
        {subjectTab === 'library' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white p-4 border shadow-xs">
              <div>
                <h3 className="text-lg font-black text-slate-900">مكتبة ومراجع {selectedSubject.name}</h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">
                  الملفات المساعدة، المذكرات، والملخصات بصيغة PDF الداعمة لتعلم الطالب.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLibraryForm({ title: '', url: '', description: '' });
                  setIsLibraryModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800 transition"
              >
                <Plus size={15} />
                <span>إضافة ملف للمكتبة</span>
              </button>
            </div>

            {(() => {
              const subjectFiles = libraryItems.filter((item) => item.subjectId === selectedSubject.id || item.pathId === selectedPath.id);
              if (subjectFiles.length === 0) {
                return (
                  <div className="rounded-3xl border border-dashed bg-white p-12 text-center text-slate-400 font-bold space-y-2">
                    <Library size={36} className="mx-auto text-slate-300" />
                    <p className="text-sm">لا توجد ملفات أو مراجع مضافة لهذه المادة بعد.</p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {subjectFiles.map((file) => (
                    <div key={file.id} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {file.type || 'PDF'}
                          </span>
                        </div>
                        <h4 className="font-black text-sm text-slate-900">{file.title}</h4>
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                        <a
                          href={(file as any).externalUrl || (file as any).url || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-200"
                        >
                          <ExternalLink size={13} />
                          <span>فتح الملف</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Tab Content: Subject Settings */}
        {subjectTab === 'settings' && (
          <div className="rounded-3xl border bg-white p-6 sm:p-8 shadow-xs space-y-6">
            <div className="border-b pb-4">
              <h3 className="text-lg font-black text-slate-900">التحكم بصفحة الطالب والعرض ({selectedSubject.name})</h3>
              <p className="text-xs text-slate-500 font-bold mt-1">
                تخصيص أيقونة المادة، لونها، رمزها، وحالتها داخل المسار.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">اسم المادة</label>
                <input
                  value={selectedSubject.name}
                  onChange={(e) => {
                    const next = { ...selectedSubject, name: e.target.value };
                    setData((prev) => ({
                      ...prev,
                      subjects: prev.subjects.map((s) => (s.id === selectedSubject.id ? next : s)),
                    }));
                  }}
                  className="w-full rounded-xl border p-2.5 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">كود المادة</label>
                <input
                  value={selectedSubject.code}
                  disabled
                  className="w-full rounded-xl border p-2.5 text-xs font-mono font-bold uppercase bg-gray-50 text-gray-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">لون المادة</label>
              <div className="flex flex-wrap gap-2">
                {['indigo', 'purple', 'emerald', 'teal', 'amber', 'orange', 'rose', 'blue'].map((colorName) => {
                  const c = resolveColor(colorName);
                  const isSelected = (selectedSubject.color || 'indigo') === colorName;
                  return (
                    <button
                      key={colorName}
                      type="button"
                      onClick={() => {
                        const next = { ...selectedSubject, color: colorName };
                        setData((prev) => ({
                          ...prev,
                          subjects: prev.subjects.map((s) => (s.id === selectedSubject.id ? next : s)),
                        }));
                      }}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border transition ${
                        isSelected ? 'ring-2 ring-indigo-500 shadow-xs' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.soft, borderColor: c.border, color: c.text }}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.text }} />
                      <span>{colorName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* إعدادات صفحة التعلم والتحكم بصفحة الطالب */}
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6 space-y-4">
              <div>
                <h4 className="text-sm font-black text-slate-900">التحكم بما يظهر للطالب في صفحة التعلم ({selectedSubject.name})</h4>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  من هنا يمكنك التحكم بما يظهر للطالب في صفحة التعلم وحالات القفل لغير المشتركين.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { key: 'showCourses', label: 'تبويب "الدورات والباقات"', desc: 'إظهار أو إخفاء تبويب الدورات بالكامل في صفحة المادة.', default: true },
                  { key: 'showSkills', label: 'تبويب "التأسيس والمهارات"', desc: 'إظهار أو إخفاء تبويب التأسيس والموضوعات بالكامل.', default: true },
                  { key: 'lockSkillsForNonSubscribers', label: 'قفل التأسيس لغير المشتركين', desc: 'سيظهر المحتوى وعليه علامة 🔒 للطلاب غير المشتركين.', default: false },
                  { key: 'showBanks', label: 'تبويب "التدريب وبنك الأسئلة"', desc: 'إظهار أو إخفاء تبويب التدريب بالكامل.', default: true },
                  { key: 'lockBanksForNonSubscribers', label: 'قفل التدريب لغير المشتركين', desc: 'سيظهر التدريب وعليه علامة 🔒 للطلاب غير المشتركين.', default: false },
                  { key: 'showTests', label: 'تبويب "الاختبارات والتقييم"', desc: 'إظهار أو إخفاء تبويب الاختبارات بالكامل.', default: true },
                  { key: 'lockTestsForNonSubscribers', label: 'قفل الاختبارات لغير المشتركين', desc: 'سيظهر الاختبار وعليه علامة 🔒 للطلاب غير المشتركين.', default: false },
                  { key: 'showLibrary', label: 'تبويب "المكتبة والمراجع"', desc: 'إظهار أو إخفاء تبويب المكتبة بالكامل.', default: true },
                  { key: 'lockLibraryForNonSubscribers', label: 'قفل المكتبة لغير المشتركين', desc: 'سيظهر الملف وعليه علامة 🔒 للطلاب غير المشتركين.', default: false },
                ].map((item) => {
                  const currentSettings = selectedSubject.settings || {};
                  const val = currentSettings[item.key] ?? item.default;
                  return (
                    <div
                      key={item.key}
                      onClick={() => {
                        const updated = {
                          ...selectedSubject,
                          settings: {
                            ...currentSettings,
                            [item.key]: !val,
                          },
                        };
                        setData((prev) => ({
                          ...prev,
                          subjects: prev.subjects.map((s) => (s.id === selectedSubject.id ? updated : s)),
                        }));
                      }}
                      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3.5 hover:border-indigo-300 hover:bg-indigo-50/20 transition cursor-pointer"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-black text-slate-800">{item.label}</div>
                        <div className="text-[11px] font-bold text-slate-500 leading-relaxed">{item.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(val)}
                        onChange={() => {}}
                        className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0 mr-3"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t flex justify-between items-center">
              <button
                type="button"
                onClick={() => setDeleteConfirm({ open: true, type: 'subject', id: selectedSubject.id, name: selectedSubject.name })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 transition cursor-pointer"
              >
                <Archive size={14} />
                <span>أرشفة المادة</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setBusy(true);
                    const csrf = await getCsrfToken();
                    await taxonomyAdminClient.updateSubject(selectedSubject.id, {
                      name: selectedSubject.name,
                      color: selectedSubject.color,
                      icon: selectedSubject.icon,
                      settings: selectedSubject.settings || {},
                    }, csrf);
                    setNotice('تم حفظ إعدادات المادة بنجاح');
                    setReload((r) => r + 1);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'تعذر حفظ الإعدادات');
                  } finally {
                    setBusy(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-black text-white hover:bg-indigo-700 transition"
              >
                <Save size={15} />
                <span>حفظ التعديلات</span>
              </button>
            </div>
          </div>
        )}

        {/* Modals for Subject Workspace */}
        {isSubjectModalOpen && renderSubjectModal()}
        {isSkillModalOpen && renderSkillModal()}
        {isLibraryModalOpen && renderLibraryModal()}
        {deleteConfirm?.open && renderDeleteModal()}
      </main>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // SCENE 1: PATH WORKSPACE (إدارة المسارات الكاملة - 5 TABS)
  // ══════════════════════════════════════════════════════════════════════
  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-6 pb-16 font-sans" data-testid="taxonomy-admin-page">
      {/* ── Top Header Banner ── */}
      <header className="rounded-3xl bg-gradient-to-l from-indigo-900 via-slate-900 to-slate-950 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-indigo-300 mb-2">
              <Boxes size={18} />
              <span>PATHS & CURRICULUM COMMAND CENTER</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black">إدارة المسارات والمناهج</h1>
            <p className="mt-2 max-w-3xl text-xs sm:text-sm leading-6 text-slate-300 font-medium">
              مركز القيادة المتكامل للتحكم بالمسارات التعليمية، المراحل الدراسية، المواد، الاختبارات المحاكية، والباقات.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={openCreatePath}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs sm:text-sm font-black text-white shadow-lg hover:bg-indigo-500 transition cursor-pointer"
            >
              <Plus size={16} />
              <span>إضافة مسار جديد</span>
            </button>
            <button
              type="button"
              onClick={() => setReload((x) => x + 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-black text-white hover:bg-white/20 transition cursor-pointer"
            >
              <RefreshCcw size={16} />
              <span>تحديث</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Feedback Banners ── */}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">{notice}</div> : null}
      {busy ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border bg-white p-8 font-black text-gray-500">
          <Loader2 className="animate-spin" size={20} /> جاري تحميل شجرة المسارات...
        </div>
      ) : null}

      {/* ── Main Two-Column Layout (Sidebar + Path Workspace) ── */}
      <section className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* ── Right Column: Paths List Sidebar ── */}
        <aside className="space-y-4">
          <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Boxes size={18} className="text-indigo-600" />
                <h2 className="text-base font-black text-slate-900">المسارات</h2>
              </div>
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-black text-indigo-700">
                {filteredPaths.length} من {data.paths.length}
              </span>
            </div>

            {/* Path Search & Status Filters */}
            <div className="space-y-2 mb-3">
              <div className="relative">
                <Search size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={pathSearch}
                  onChange={(e) => setPathSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو الرمز..."
                  className="w-full rounded-xl border border-gray-200 bg-slate-50 py-1.5 pr-8 pl-3 text-xs font-bold outline-none focus:border-indigo-400 focus:bg-white transition"
                />
              </div>
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-black">
                {(['all', 'active', 'inactive', 'archived'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setPathStatusFilter(st)}
                    className={`rounded-lg px-2 py-1 transition ${
                      pathStatusFilter === st
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'all' ? 'الكل' : statusLabels[st]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-[550px] overflow-y-auto pl-1">
              {filteredPaths.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 font-bold border border-dashed rounded-2xl p-4">
                  لا توجد مسارات مطابقة لمعايير البحث الحالية.
                </div>
              ) : (
                filteredPaths.map((path) => {
                  const isSelected = selectedPathId === path.id;
                  const pathTone = resolveColor(path.color);
                  return (
                    <div
                      key={path.id}
                      onClick={() => {
                        setSelectedPathId(path.id);
                        setSelectedSubjectId(null);
                      }}
                      className={`group relative flex items-center justify-between rounded-2xl border p-3 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-400 bg-indigo-50/70 shadow-xs ring-2 ring-indigo-500/20'
                          : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg shadow-2xs border"
                          style={{
                            backgroundColor: pathTone.soft,
                            borderColor: pathTone.border,
                            color: pathTone.text,
                          }}
                        >
                          {getPathIcon(path, 'w-6 h-6 object-contain')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <strong className="block text-sm font-black text-slate-900 truncate">{path.name}</strong>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                            <span>{path.code}</span>
                            <span className={`text-[10px] font-black ${path.status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}>
                              • {statusLabels[path.status]}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Link
                          to={`/category/${path.id}`}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-100 hover:text-indigo-700 transition"
                          title="معاينة المسار في نافذة جديدة"
                        >
                          <Eye size={15} />
                        </Link>
                        <ChevronLeft size={16} className={`transition-transform ${isSelected ? '-translate-x-1 text-indigo-600' : 'text-slate-300'}`} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* ── Left Column: Active Path Workspace ── */}
        <section className="space-y-6">
          {!selectedPath ? (
            <div className="rounded-3xl border border-dashed bg-white p-16 text-center font-bold text-gray-400">
              اختر مسارًا من القائمة الجانبية لإدارة محتواه ومواده وإعداداته.
            </div>
          ) : (
            <>
              {/* Path Overview Card */}
              <article
                className="rounded-3xl border p-6 shadow-xs relative overflow-hidden"
                style={{
                  backgroundColor: '#ffffff',
                  borderTop: `4px solid ${pathColor.text}`,
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-xs border"
                      style={{
                        backgroundColor: pathColor.soft,
                        borderColor: pathColor.border,
                        color: pathColor.text,
                      }}
                    >
                      {getPathIcon(selectedPath, 'w-8 h-8 object-contain')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-2xl font-black text-slate-900">{selectedPath.name}</h2>
                        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-mono font-bold text-slate-600">
                          {selectedPath.code}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                            selectedPath.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {statusLabels[selectedPath.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
                        {selectedPath.description || 'لا يوجد وصف للمسار.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-center">
                    <Link
                      to={`/category/${selectedPath.id}`}
                      target="_blank"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100 transition"
                    >
                      <Eye size={14} />
                      <span>معاينة الطالب</span>
                      <ExternalLink size={12} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => openEditPath(selectedPath)}
                      className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 shadow-xs hover:bg-gray-50 transition"
                    >
                      تعديل المسار
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ open: true, type: 'path', id: selectedPath.id, name: selectedPath.name })}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                      title="أرشفة المسار"
                    >
                      <Archive size={14} />
                    </button>
                    <StatusSelect
                      label={`حالة ${selectedPath.name}`}
                      value={selectedPath.status}
                      onChange={(v) => void patchStatus('path', selectedPath.id, v)}
                    />
                  </div>
                </div>

                {/* Readiness & Summary Metrics */}
                {readinessSummary && (
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-gray-100 pt-5">
                    <div className="rounded-2xl bg-slate-50 p-3 text-center border border-slate-100">
                      <span className="text-[11px] font-bold text-slate-500">المواد الدراسية</span>
                      <strong className="block text-xl font-black text-slate-900 mt-0.5">{subjects.length}</strong>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3 text-center border border-slate-100">
                      <span className="text-[11px] font-bold text-slate-500">المراحل التعليمية</span>
                      <strong className="block text-xl font-black text-slate-900 mt-0.5">{levels.length}</strong>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3 text-center border border-slate-100">
                      <span className="text-[11px] font-bold text-slate-500">الباقات الفعالة</span>
                      <strong className="block text-xl font-black text-emerald-700 mt-0.5">{readinessSummary.packages}</strong>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3 text-center border border-slate-100">
                      <span className="text-[11px] font-bold text-slate-500">إجمالي المحتوى</span>
                      <strong className="block text-xl font-black text-indigo-700 mt-0.5">{readinessSummary.total}</strong>
                    </div>
                  </div>
                )}
              </article>

              {/* ── 5 Core Path Tabs ── */}
              <div className="flex border-b border-gray-200 gap-2 overflow-x-auto pb-px">
                {[
                  { id: 'subjects', label: `المواد الدراسية (${subjects.length})`, icon: BookOpen },
                  { id: 'levels', label: `المراحل التعليمية (${levels.length})`, icon: GraduationCap },
                  { id: 'mockExams', label: 'الاختبارات المحاكية', icon: Award },
                  { id: 'packages', label: 'العروض والباقات', icon: CreditCard },
                  { id: 'settings', label: 'إعدادات وتجربة المسار', icon: Settings },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = pathTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPathTab(tab.id as PathsManagerPathTab)}
                      className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-black transition-all border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
                        active
                          ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-xl shadow-xs'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Icon size={16} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* ── TAB 1: SUBJECTS (المواد) ── */}
              {pathTab === 'subjects' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white p-4 border shadow-xs">
                    <div>
                      <h3 className="font-black text-slate-900 text-base">المواد المندرجة تحت {selectedPath.name}</h3>
                      <p className="text-xs text-slate-400 font-bold mt-0.5">
                        انقر على أي مادة لفتح مساحة عمل وإدارة محتواها الكامل.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openCreateSubject}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-black text-white shadow-xs hover:bg-indigo-700 transition"
                    >
                      <Plus size={15} />
                      <span>إضافة مادة</span>
                    </button>
                  </div>

                  {/* Search & Level Filters for Subjects */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl bg-white p-4 border shadow-xs">
                    <div className="relative flex-1">
                      <Search size={15} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={subjectSearch}
                        onChange={(e) => setSubjectSearch(e.target.value)}
                        placeholder="البحث في مواد المسار بالاسم أو الكود..."
                        className="w-full rounded-xl border border-gray-200 bg-slate-50 py-2 pr-9 pl-3 text-xs font-bold outline-none focus:border-indigo-400 focus:bg-white transition"
                      />
                    </div>
                    {levels.length > 0 && (
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="text-xs font-black text-slate-500 whitespace-nowrap">المرحلة الدراسية:</label>
                        <select
                          value={levelFilter}
                          onChange={(e) => setLevelFilter(e.target.value)}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold shadow-xs focus:border-indigo-400 outline-none"
                        >
                          <option value="all">كافة المراحل ({subjects.length})</option>
                          {levels.map((lvl) => (
                            <option key={lvl.id} value={lvl.id}>
                              {lvl.name} ({subjects.filter((s) => s.levelId === lvl.id).length})
                            </option>
                          ))}
                          <option value="none">مواد عامة بدون مرحلة</option>
                        </select>
                      </div>
                    )}
                    <span className="text-xs font-bold text-slate-400 mr-2 shrink-0 self-center">
                      ({filteredSubjects.length} من {subjects.length})
                    </span>
                  </div>

                  {filteredSubjects.length === 0 ? (
                    <div className="rounded-3xl border border-dashed bg-white p-12 text-center text-slate-400 font-bold">
                      {subjects.length === 0
                        ? 'لا توجد مواد مسجلة لهذا المسار بعد. اضغط «إضافة مادة» لإنشاء أول مادة.'
                        : 'لا توجد مواد مطابقة لمعايير البحث الحالية.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                      {filteredSubjects.map((sub) => {
                        const subTone = resolveColor(sub.color || selectedPath.color);
                        const lvl = levels.find((l) => l.id === sub.levelId);
                        return (
                          <div
                            key={sub.id}
                            className="group relative flex flex-col justify-between rounded-3xl border border-gray-100 bg-white p-5 shadow-xs hover:shadow-md transition-all overflow-hidden"
                            style={{ borderTop: `4px solid ${subTone.text}` }}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div
                                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl shadow-2xs border"
                                  style={{
                                    backgroundColor: subTone.soft,
                                    borderColor: subTone.border,
                                    color: subTone.text,
                                  }}
                                >
                                  {getSubjectIcon(sub, 'w-6 h-6 object-contain')}
                                </div>
                                <StatusSelect
                                  label={`حالة ${sub.name}`}
                                  value={sub.status}
                                  onChange={(v) => void patchStatus('subject', sub.id, v)}
                                />
                              </div>

                              <h4 className="text-base font-black text-slate-900">{sub.name}</h4>
                              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-1">
                                <span>{sub.code}</span>
                                {lvl && (
                                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                    {lvl.name}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditSubject(sub)}
                                  className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50 transition"
                                >
                                  تعديل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirm({ open: true, type: 'subject', id: sub.id, name: sub.name })}
                                  className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100 transition"
                                  title="أرشفة المادة"
                                >
                                  <Archive size={13} />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSubjectId(sub.id);
                                  setSubjectTab('courses');
                                }}
                                className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700 hover:bg-indigo-100 transition"
                              >
                                <span>مساحة العمل</span>
                                <ChevronLeft size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 2: LEVELS (المراحل) ── */}
              {pathTab === 'levels' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-2xl bg-white p-4 border shadow-xs">
                    <div>
                      <h3 className="font-black text-slate-900 text-base">المراحل الدراسية في {selectedPath.name}</h3>
                      <p className="text-xs text-slate-400 font-bold mt-0.5">
                        تقسيم المسار إلى مراحل دراسية يسهل على الطالب اختيار صفه الدراسي.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openCreateLevel}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-sky-700 px-3.5 py-2 text-xs font-black text-white shadow-xs hover:bg-sky-800 transition"
                    >
                      <Plus size={15} />
                      <span>إضافة مرحلة</span>
                    </button>
                  </div>

                  {levels.length === 0 ? (
                    <div className="rounded-3xl border border-dashed bg-white p-12 text-center text-slate-400 font-bold">
                      لا توجد مراحل مسجلة (هذا المسار يعتبر مساراً مباشراً بدون مراحل مثل مسار القدرات).
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                      {levels.map((lvl) => {
                        const levelSubjects = subjects.filter((s) => s.levelId === lvl.id);
                        return (
                          <div
                            key={lvl.id}
                            className="rounded-3xl border border-gray-100 bg-white p-5 shadow-xs flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-800 text-xl border border-sky-100">
                                  {getLevelIcon(lvl, 'w-6 h-6 object-contain')}
                                </div>
                                <StatusSelect
                                  label={`حالة ${lvl.name}`}
                                  value={lvl.status}
                                  onChange={(v) => void patchStatus('level', lvl.id, v)}
                                />
                              </div>
                              <h4 className="text-base font-black text-slate-900">{lvl.name}</h4>
                              <p className="text-xs text-slate-400 font-mono mt-0.5">{lvl.code}</p>
                              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                                <span>{levelSubjects.length} مواد مرتبطة</span>
                              </div>
                            </div>
                            <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditLevel(lvl)}
                                className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50 transition"
                              >
                                تعديل المرحلة
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm({ open: true, type: 'level', id: lvl.id, name: lvl.name })}
                                className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100 transition"
                                title="أرشفة المرحلة"
                              >
                                <Archive size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 3: MOCK EXAMS (الاختبارات المحاكية) ── */}
              {pathTab === 'mockExams' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white p-4 border shadow-xs">
                    <div>
                      <h3 className="font-black text-slate-900 text-base">الاختبارات المحاكية لمسار {selectedPath.name}</h3>
                      <p className="text-xs text-slate-400 font-bold mt-0.5">
                        تحاكي بيئة الاختبار القياسي بأقسام زمنية ومؤقت دقيق ونموذج نتيجة فوري.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/category/${selectedPath.id}?tab=mock-exams`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100 transition"
                      >
                        <ExternalLink size={14} />
                        <span>معاينة صفحة الطالب</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setMockForm({
                            title: `اختبار محاكي - ${selectedPath.name}`,
                            code: `${selectedPath.code}-MOCK-${Date.now().toString().slice(-4)}`,
                            durationMinutes: 120,
                            passingScore: 60,
                          });
                          setIsMockModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-purple-700 px-3.5 py-2 text-xs font-black text-white shadow-xs hover:bg-purple-800 transition"
                      >
                        <Plus size={15} />
                        <span>إنشاء اختبار محاكي</span>
                      </button>
                    </div>
                  </div>

                  {/* Search bar */}
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="ابحث في الاختبارات المحاكية باسم الاختبار أو الكود..."
                      value={mockExamSearch}
                      onChange={(e) => setMockExamSearch(e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold shadow-xs focus:border-purple-500 focus:outline-hidden"
                    />
                  </div>

                  {/* Mock Exams List */}
                  {(() => {
                    const filteredMocks = assessments.filter((a) => {
                      const matchesPath = a.pathId === selectedPath.id;
                      const isMock = a.kind === 'mock' || a.title.includes('محاك') || a.title.includes('تجريب') || a.code.includes('MOCK');
                      const matchesSearch = !mockExamSearch.trim() ||
                        a.title.toLowerCase().includes(mockExamSearch.toLowerCase()) ||
                        a.code.toLowerCase().includes(mockExamSearch.toLowerCase());
                      return matchesPath && isMock && matchesSearch;
                    });

                    if (filteredMocks.length === 0) {
                      return (
                        <div className="rounded-3xl border border-dashed bg-white p-12 text-center text-slate-400 font-bold space-y-2">
                          <Award size={36} className="mx-auto text-purple-300" />
                          <p className="text-sm">لا توجد اختبارات محاكية منشورة لهذا المسار بعد.</p>
                          <p className="text-xs text-slate-400">اضغط «إنشاء اختبار محاكي» لإضافة نموذج اختبار جديد للطلاب.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                        {filteredMocks.map((mock) => (
                          <div
                            key={mock.id}
                            className="rounded-3xl border border-gray-100 bg-white p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all"
                            style={{ borderTop: '4px solid #7c3aed' }}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${
                                  mock.isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                }`}>
                                  {mock.isPublished ? 'منشور للطلاب' : 'مسودة مخفية'}
                                </span>
                                <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-700">
                                  {mock.code}
                                </span>
                              </div>
                              <h4 className="text-base font-black text-slate-900 leading-snug">{mock.title}</h4>
                              <p className="text-xs text-slate-400 font-bold mt-1">
                                الحالة: {statusLabels[mock.workflowStatus as TaxonomyStatus] || mock.workflowStatus}
                              </p>
                            </div>

                            <div className="mt-5 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                              <Link
                                to={`/assessments/${mock.id}/start`}
                                target="_blank"
                                className="inline-flex items-center gap-1 rounded-xl bg-purple-50 px-3 py-1.5 text-xs font-black text-purple-700 hover:bg-purple-100 transition"
                              >
                                <Eye size={13} />
                                <span>معاينة</span>
                              </Link>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    setBusy(true);
                                    const csrf = await getCsrfToken();
                                    await assessmentClient.publication(mock.id, mock.revision, !mock.isPublished, csrf);
                                    setNotice(mock.isPublished ? 'تم إخفاء الاختبار المحاكي عن الطلاب' : 'تم نشر الاختبار المحاكي بنجاح');
                                    setReload((r) => r + 1);
                                  } catch (err) {
                                    setError(err instanceof Error ? err.message : 'تعذر تغيير حالة النشر');
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className={`rounded-xl border px-3 py-1.5 text-xs font-black transition cursor-pointer ${
                                  mock.isPublished
                                    ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                }`}
                              >
                                {mock.isPublished ? 'إخفاء' : 'نشر للطلاب'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── TAB 4: PACKAGES (العروض والباقات) ── */}
              {pathTab === 'packages' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-2xl bg-white p-4 border shadow-xs">
                    <div>
                      <h3 className="font-black text-slate-900 text-base">باقات وعروض مسار {selectedPath.name}</h3>
                      <p className="text-xs text-slate-400 font-bold mt-0.5">
                        الباقات تتيح للطلاب الاشتراك وفتح مساحات التعلم التابعة للمسار.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPkgForm({
                          code: `${selectedPath.code}-PKG-1`,
                          name: `باقة ${selectedPath.name} الشاملة`,
                          priceMinor: 9900,
                          contentType: 'all',
                        });
                        setIsPackageModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-xs hover:bg-emerald-700 transition"
                    >
                      <PackagePlus size={15} />
                      <span>إنشاء باقة مسار</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {packages
                      .filter((p: CommerceProduct) => p.package?.items?.some((item: CommercePackageItem) => item.pathId === selectedPath.id || !item.pathId))
                      .map((pkg) => (
                        <div key={pkg.id} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-xs flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-black text-emerald-800">
                                {pkg.package?.packageKind === 'membership' ? 'عضوية' : 'باقة تدريبية'}
                              </span>
                              <strong className="text-base font-black text-slate-900">
                                {(pkg.priceMinor / 100).toFixed(0)} {pkg.currency}
                              </strong>
                            </div>
                            <h4 className="text-base font-black text-slate-900">{pkg.name}</h4>
                            <p className="text-xs text-slate-400 mt-1">{pkg.description || 'باقة معتمدة للمسار'}</p>
                          </div>
                          <div className="mt-4 pt-3 border-t border-gray-100 text-xs font-bold text-slate-500">
                            كود الباقة: <span className="font-mono text-slate-800">{pkg.code}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* ── TAB 5: SETTINGS (إعدادات وتجربة المسار) ── */}
              {pathTab === 'settings' && (
                <div className="space-y-4">
                  <div className="rounded-3xl border bg-white p-6 shadow-xs space-y-6">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">إعدادات الظهور في المنصة وتجربة الطالب</h3>
                      <p className="text-xs text-slate-500 font-bold mt-1">
                        التحكم المباشر في كيفية عرض المسار للطلاب في القائمة العلوية وشبكة البطاقات.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {/* Toggle: Navbar */}
                      <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-slate-50/50 p-4">
                        <div>
                          <strong className="text-sm font-black text-slate-900 block">إظهار في القائمة العلوية</strong>
                          <span className="text-xs text-slate-500">يظهر المسار في شريط التنقل العلوي للزوار والطلاب</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void togglePathSetting('showInNavbar', selectedPath.showInNavbar)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            selectedPath.showInNavbar !== false ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                              selectedPath.showInNavbar !== false ? '-translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Toggle: Subject Cards */}
                      <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-slate-50/50 p-4">
                        <div>
                          <strong className="text-sm font-black text-slate-900 block">إظهار بطاقات المواد</strong>
                          <span className="text-xs text-slate-500">عرض شبكة بطاقات المواد الملونة داخل صفحة المسار</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void togglePathSetting('showSubjectCards', selectedPath.showSubjectCards)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            selectedPath.showSubjectCards !== false ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                              selectedPath.showSubjectCards !== false ? '-translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Toggle: Mock Exam Card */}
                      <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-slate-50/50 p-4">
                        <div>
                          <strong className="text-sm font-black text-slate-900 block">إظهار بطاقة الاختبارات المحاكية</strong>
                          <span className="text-xs text-slate-500">عرض بطاقة دخول المحاكيات البنفسجية في صفحة المسار</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void togglePathSetting('showMockExamCard', selectedPath.showMockExamCard)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            selectedPath.showMockExamCard !== false ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                              selectedPath.showMockExamCard !== false ? '-translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Toggle: Package Card */}
                      <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-slate-50/50 p-4">
                        <div>
                          <strong className="text-sm font-black text-slate-900 block">إظهار بطاقة العروض والباقات</strong>
                          <span className="text-xs text-slate-500">عرض بطاقة العروض الخضراء المخصصة لفتح محتوى المسار</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void togglePathSetting('showPackageCard', selectedPath.showPackageCard)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            selectedPath.showPackageCard !== false ? 'bg-indigo-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                              selectedPath.showPackageCard !== false ? '-translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </section>

      {/* ── Modals ── */}
      {isPathModalOpen && renderPathModal()}
      {isLevelModalOpen && renderLevelModal()}
      {isSubjectModalOpen && renderSubjectModal()}
      {isPackageModalOpen && renderPackageModal()}
      {isMockModalOpen && renderMockModal()}
      {isLibraryModalOpen && renderLibraryModal()}
      {isSkillModalOpen && renderSkillModal()}
      {deleteConfirm?.open && renderDeleteModal()}
    </main>
  );

  // ══════════════════════════════════════════════════════════════════════
  // MODAL RENDERS
  // ══════════════════════════════════════════════════════════════════════

  function renderPathModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in" dir="rtl">
        <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-lg font-black text-slate-900">
              {editingPath ? `تعديل مسار ${editingPath.name}` : 'إضافة مسار تعليمي جديد'}
            </h3>
            <button type="button" onClick={() => setIsPathModalOpen(false)} className="rounded-xl p-1 text-slate-400 hover:bg-slate-100">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">اسم المسار</label>
                <input
                  value={pathForm.name}
                  onChange={(e) => setPathForm({ ...pathForm, name: e.target.value })}
                  placeholder="مثال: القدرات العامة"
                  className="w-full rounded-xl border p-2.5 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">كود المسار الثابت</label>
                <input
                  value={pathForm.code}
                  disabled={Boolean(editingPath)}
                  onChange={(e) => setPathForm({ ...pathForm, code: e.target.value.toUpperCase() })}
                  placeholder="مثال: QUDRAT"
                  className="w-full rounded-xl border p-2.5 text-xs font-mono font-bold uppercase disabled:bg-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">لون المسار الرئيسي</label>
              <div className="flex flex-wrap gap-2">
                {['indigo', 'purple', 'emerald', 'amber', 'rose', 'blue', 'gray'].map((colorName) => {
                  const c = resolveColor(colorName);
                  const isSelected = pathForm.color === colorName;
                  return (
                    <button
                      key={colorName}
                      type="button"
                      onClick={() => setPathForm({ ...pathForm, color: colorName })}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border transition ${
                        isSelected ? 'ring-2 ring-indigo-500 shadow-xs' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.soft, borderColor: c.border, color: c.text }}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.text }} />
                      <span>{colorName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Icon Picker Component */}
            <EducationalIconPicker
              selectedIcon={pathForm.icon}
              selectedIconUrl={pathForm.iconUrl}
              color={pathForm.color}
              onSelectIcon={(icon) => setPathForm({ ...pathForm, icon })}
              onClearIconUrl={() => setPathForm({ ...pathForm, iconUrl: '' })}
              label="أيقونة المسار"
            />

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">وصف المسار</label>
              <textarea
                value={pathForm.description}
                onChange={(e) => setPathForm({ ...pathForm, description: e.target.value })}
                placeholder="وصف مختصر لمحتوى وأهداف المسار..."
                className="w-full rounded-xl border p-2.5 text-xs font-medium min-h-20"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={() => setIsPathModalOpen(false)}
              className="rounded-xl border px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={pending.includes('path')}
              onClick={() => void savePath()}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending.includes('path') ? 'جاري الحفظ...' : 'حفظ المسار'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderLevelModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in" dir="rtl">
        <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-lg font-black text-slate-900">
              {editingLevel ? `تعديل مرحلة ${editingLevel.name}` : 'إضافة مرحلة دراسية جديدة'}
            </h3>
            <button type="button" onClick={() => setIsLevelModalOpen(false)} className="rounded-xl p-1 text-slate-400 hover:bg-slate-100">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">اسم المرحلة</label>
              <input
                value={levelForm.name}
                onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })}
                placeholder="مثال: المرحلة الابتدائية - الصف الثالث"
                className="w-full rounded-xl border p-2.5 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">كود المرحلة</label>
              <input
                value={levelForm.code}
                disabled={Boolean(editingLevel)}
                onChange={(e) => setLevelForm({ ...levelForm, code: e.target.value.toUpperCase() })}
                placeholder="مثال: ELEM_3"
                className="w-full rounded-xl border p-2.5 text-xs font-mono font-bold uppercase disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">أيقونة المرحلة</label>
              <input
                value={levelForm.icon}
                onChange={(e) => setLevelForm({ ...levelForm, icon: e.target.value })}
                placeholder="🎒 أو 🏫 أو 🎓"
                className="w-full rounded-xl border p-2.5 text-xs font-bold"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={() => setIsLevelModalOpen(false)}
              className="rounded-xl border px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={pending.includes('level')}
              onClick={() => void saveLevel()}
              className="rounded-xl bg-sky-700 px-5 py-2 text-xs font-black text-white hover:bg-sky-800 disabled:opacity-50"
            >
              {pending.includes('level') ? 'جاري الحفظ...' : 'حفظ المرحلة'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderSubjectModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in" dir="rtl">
        <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-lg font-black text-slate-900">
              {editingSubject ? `تعديل مادة ${editingSubject.name}` : 'إضافة مادة دراسية جديدة'}
            </h3>
            <button type="button" onClick={() => setIsSubjectModalOpen(false)} className="rounded-xl p-1 text-slate-400 hover:bg-slate-100">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">اسم المادة</label>
                <input
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  placeholder="مثال: القدرات الكمي"
                  className="w-full rounded-xl border p-2.5 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">كود المادة</label>
                <input
                  value={subjectForm.code}
                  disabled={Boolean(editingSubject)}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
                  placeholder="مثال: QUANT"
                  className="w-full rounded-xl border p-2.5 text-xs font-mono font-bold uppercase disabled:bg-gray-100"
                />
              </div>
            </div>

            {levels.length > 0 && (
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">المرحلة الدراسية التابعة</label>
                <select
                  value={subjectForm.levelId}
                  onChange={(e) => setSubjectForm({ ...subjectForm, levelId: e.target.value })}
                  className="w-full rounded-xl border p-2.5 text-xs font-bold bg-white"
                >
                  <option value="">بدون مرحلة محددة (مادة عامة في المسار)</option>
                  {levels.map((lvl) => (
                    <option key={lvl.id} value={lvl.id}>
                      {lvl.name} ({lvl.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">لون المادة</label>
              <div className="flex flex-wrap gap-2">
                {['indigo', 'purple', 'emerald', 'amber', 'rose', 'blue', 'gray'].map((colorName) => {
                  const c = resolveColor(colorName);
                  const isSelected = subjectForm.color === colorName;
                  return (
                    <button
                      key={colorName}
                      type="button"
                      onClick={() => setSubjectForm({ ...subjectForm, color: colorName })}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border transition ${
                        isSelected ? 'ring-2 ring-indigo-500 shadow-xs' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.soft, borderColor: c.border, color: c.text }}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.text }} />
                      <span>{colorName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <EducationalIconPicker
              selectedIcon={subjectForm.icon}
              selectedIconUrl={subjectForm.iconUrl}
              color={subjectForm.color}
              onSelectIcon={(icon) => setSubjectForm({ ...subjectForm, icon })}
              onClearIconUrl={() => setSubjectForm({ ...subjectForm, iconUrl: '' })}
              label="أيقونة المادة"
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={() => setIsSubjectModalOpen(false)}
              className="rounded-xl border px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={pending.includes('subject')}
              onClick={() => void saveSubject()}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending.includes('subject') ? 'جاري الحفظ...' : 'حفظ المادة'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderSkillModal() {
    if (!selectedSubject) return null;
    const mainSkillsInSubject = subjectSkills.filter((s) => s.kind === 'main' && s.id !== editingSkill?.id);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in" dir="rtl">
        <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Award size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingSkill ? `تعديل المهارة: ${editingSkill.name}` : `إضافة مهارة جديدة (${selectedSubject.name})`}
                </h3>
                <p className="text-xs text-slate-400 font-bold">ربط المهارة بأسئلة وبنوك تقييم المادة</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSkillModalOpen(false)}
              className="rounded-xl p-1 text-slate-400 hover:bg-slate-100"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">نوع المهارة</label>
                <select
                  disabled={Boolean(editingSkill)}
                  value={skillForm.kind}
                  onChange={(e) =>
                    setSkillForm({
                      ...skillForm,
                      kind: e.target.value as 'main' | 'sub',
                      parentSkillId: e.target.value === 'main' ? '' : skillForm.parentSkillId,
                    })
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-bold"
                >
                  <option value="main">مهارة رئيسية</option>
                  <option value="sub">مهارة فرعية</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">كود المهارة (رمز فريد)</label>
                <input
                  disabled={Boolean(editingSkill)}
                  value={skillForm.code}
                  onChange={(e) => setSkillForm({ ...skillForm, code: e.target.value.toUpperCase() })}
                  placeholder="مثال: SKILL-01"
                  className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-mono font-bold"
                />
              </div>
            </div>

            {skillForm.kind === 'sub' && (
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">المهارة الرئيسية التابعة لها</label>
                <select
                  value={skillForm.parentSkillId}
                  onChange={(e) => setSkillForm({ ...skillForm, parentSkillId: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-bold"
                >
                  <option value="">اختر المهارة الرئيسية الأب</option>
                  {mainSkillsInSubject.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.name} ({parent.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">اسم المهارة</label>
              <input
                value={skillForm.name}
                onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                placeholder="مثال: استيعاب المقروء وحل المسائل اللفظية"
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">وصف المهارة وأهدافها</label>
              <textarea
                value={skillForm.description}
                onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })}
                placeholder="نبذة تشرح ما يقيسه هذا المحور وكيف يتدرب عليه الطالب..."
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">ترتيب الظهور</label>
              <input
                type="number"
                value={skillForm.sortOrder}
                onChange={(e) => setSkillForm({ ...skillForm, sortOrder: Number(e.target.value) || 0 })}
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-bold"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={() => setIsSkillModalOpen(false)}
              className="rounded-xl border px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={busy || !skillForm.name.trim() || (!editingSkill && !skillForm.code.trim())}
              onClick={saveSkill}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {editingSkill ? 'حفظ التعديلات' : 'إضافة المهارة'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderPackageModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in" dir="rtl">
        <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-lg font-black text-slate-900">إنشاء باقة جديدة لمسار {selectedPath?.name}</h3>
            <button type="button" onClick={() => setIsPackageModalOpen(false)} className="rounded-xl p-1 text-slate-400 hover:bg-slate-100">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">اسم الباقة</label>
              <input
                value={pkgForm.name}
                onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
                placeholder="مثال: باقة القدرات الشاملة"
                className="w-full rounded-xl border p-2.5 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">كود الباقة</label>
              <input
                value={pkgForm.code}
                onChange={(e) => setPkgForm({ ...pkgForm, code: e.target.value.toUpperCase() })}
                placeholder="مثال: QUDRAT-ALL"
                className="w-full rounded-xl border p-2.5 text-xs font-mono font-bold uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">السعر بالهللة (100 هللة = 1 ريال)</label>
              <input
                type="number"
                min={1}
                value={pkgForm.priceMinor}
                onChange={(e) => setPkgForm({ ...pkgForm, priceMinor: Number(e.target.value) || 0 })}
                className="w-full rounded-xl border p-2.5 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">مساحات التعلم المفتوحة للطالب</label>
              <select
                value={pkgForm.contentType}
                onChange={(e) => setPkgForm({ ...pkgForm, contentType: e.target.value as CommerceContentType })}
                className="w-full rounded-xl border p-2.5 text-xs font-bold bg-white"
              >
                <option value="all">كل محتوى ومساحات المسار (شاملة)</option>
                <option value="courses">الدورات التدريبية فقط</option>
                <option value="foundation">التأسيس والدروس فقط</option>
                <option value="tests">الاختبارات والتقييمات فقط</option>
                <option value="mock_exams">الاختبارات المحاكية فقط</option>
                <option value="library">المكتبة والمراجع فقط</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={() => setIsPackageModalOpen(false)}
              className="rounded-xl border px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={pending.includes('package')}
              onClick={() => void createPathPackage()}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending.includes('package') ? 'جاري الإنشاء...' : 'إنشاء وتفعيل الباقة'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderMockModal() {
    if (!selectedPath) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in" dir="rtl">
        <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-lg font-black text-slate-900">إنشاء اختبار محاكي لمسار {selectedPath.name}</h3>
            <button type="button" onClick={() => setIsMockModalOpen(false)} className="rounded-xl p-1 text-slate-400 hover:bg-slate-100">
              <X size={20} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">عنوان الاختبار المحاكي</label>
              <input
                value={mockForm.title}
                onChange={(e) => setMockForm({ ...mockForm, title: e.target.value })}
                placeholder="مثال: الاختبار المحاكي الشامل الأول"
                className="w-full rounded-xl border p-2.5 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">كود الاختبار</label>
              <input
                value={mockForm.code}
                onChange={(e) => setMockForm({ ...mockForm, code: e.target.value.toUpperCase() })}
                placeholder="مثال: QUDRAT-MOCK-01"
                className="w-full rounded-xl border p-2.5 text-xs font-mono font-bold uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">المدة بالدقائق</label>
                <input
                  type="number"
                  min={10}
                  value={mockForm.durationMinutes}
                  onChange={(e) => setMockForm({ ...mockForm, durationMinutes: Number(e.target.value) || 60 })}
                  className="w-full rounded-xl border p-2.5 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">درجة الاجتياز (%)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={mockForm.passingScore}
                  onChange={(e) => setMockForm({ ...mockForm, passingScore: Number(e.target.value) || 60 })}
                  className="w-full rounded-xl border p-2.5 text-xs font-bold"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={() => setIsMockModalOpen(false)}
              className="rounded-xl border px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={busy || !mockForm.title.trim()}
              onClick={async () => {
                try {
                  setBusy(true);
                  const csrf = await getCsrfToken();
                  await assessmentClient.create({
                    code: mockForm.code || `${selectedPath.code}-MOCK-${Date.now().toString().slice(-4)}`,
                    ownerType: 'platform',
                    ownerUserId: user?.id || '',
                    ownerSchoolId: '',
                    assignedTeacherId: '',
                    isVisible: true,
                    version: {
                      version: 1,
                      accessType: 'free',
                      title: mockForm.title,
                      description: `اختبار محاكي معتمد لمسار ${selectedPath.name}`,
                      pathId: selectedPath.id,
                      subjectId: '',
                      kind: 'mock',
                      normalMode: 'exam',
                      showExplanations: true,
                      showAnswers: true,
                      showResultsReport: true,
                      returnToSourceOnFinish: true,
                      maxAttempts: 10,
                      passingScore: mockForm.passingScore,
                      timeLimitSeconds: mockForm.durationMinutes * 60,
                      randomizeQuestions: true,
                      randomizeOptions: true,
                      showProgressBar: true,
                      requireAnswerBeforeNext: false,
                      allowQuestionReview: true,
                      optionLayout: 'vertical',
                      mockCategory: 'simulation',
                      mockTargetScore: null,
                      mockStrictSectionLock: null,
                      mockPresentationMode: 'standard',
                      presentation: {},
                      revisionNote: 'إنشاء أولي للاختبار المحاكي',
                    },
                    sections: [],
                    questions: [],
                  }, csrf);
                  setIsMockModalOpen(false);
                  setNotice('تم إنشاء الاختبار المحاكي بنجاح');
                  setReload((r) => r + 1);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'تعذر إنشاء الاختبار المحاكي');
                } finally {
                  setBusy(false);
                }
              }}
              className="rounded-xl bg-purple-700 px-5 py-2 text-xs font-black text-white hover:bg-purple-800 disabled:opacity-50"
            >
              إنشاء الاختبار المحاكي
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderLibraryModal() {
    if (!selectedPath || !selectedSubject) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in" dir="rtl">
        <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-lg font-black text-slate-900">إضافة ملف للمكتبة ({selectedSubject.name})</h3>
            <button type="button" onClick={() => setIsLibraryModalOpen(false)} className="rounded-xl p-1 text-slate-400 hover:bg-slate-100">
              <X size={20} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">عنوان الملف أو المرجع</label>
              <input
                value={libraryForm.title}
                onChange={(e) => setLibraryForm({ ...libraryForm, title: e.target.value })}
                placeholder="مثال: مذكرة التأسيس الشاملة PDF"
                className="w-full rounded-xl border p-2.5 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">رابط الملف (URL)</label>
              <input
                value={libraryForm.url}
                onChange={(e) => setLibraryForm({ ...libraryForm, url: e.target.value })}
                placeholder="https://... / ملف PDF"
                className="w-full rounded-xl border p-2.5 text-xs font-bold font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">وصف الملف</label>
              <textarea
                value={libraryForm.description}
                onChange={(e) => setLibraryForm({ ...libraryForm, description: e.target.value })}
                placeholder="نبذة عن الملف ومحتواه وملاحظات المذاكرة..."
                className="w-full rounded-xl border p-2.5 text-xs font-bold"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={() => setIsLibraryModalOpen(false)}
              className="rounded-xl border px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={busy || !libraryForm.title.trim() || !libraryForm.url.trim()}
              onClick={async () => {
                try {
                  setBusy(true);
                  const csrf = await getCsrfToken();
                  await contentClient.createLibraryItem({
                    title: libraryForm.title,
                    pathId: selectedPath.id,
                    subjectId: selectedSubject.id,
                    type: 'pdf',
                    externalUrl: libraryForm.url,
                    description: libraryForm.description,
                    isVisible: true,
                    isLocked: false,
                    skillIds: [],
                    primaryAssetId: '',
                  }, csrf);
                  setIsLibraryModalOpen(false);
                  setNotice('تمت إضافة الملف إلى مكتبة المادة بنجاح');
                  setReload((r) => r + 1);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'تعذر إضافة الملف للمكتبة');
                } finally {
                  setBusy(false);
                }
              }}
              className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-black text-white hover:bg-black disabled:opacity-50"
            >
              إضافة الملف للمكتبة
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderDeleteModal() {
    if (!deleteConfirm) return null;
    const typeLabel =
      deleteConfirm.type === 'path'
        ? 'المسار'
        : deleteConfirm.type === 'level'
          ? 'المرحلة'
          : deleteConfirm.type === 'subject'
            ? 'المادة'
            : 'المهارة';
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in" dir="rtl">
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <Archive size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">تأكيد أرشفة {typeLabel}</h3>
              <p className="text-xs text-slate-500 font-bold mt-0.5">«{deleteConfirm.name}»</p>
            </div>
          </div>
          <p className="text-xs leading-6 text-slate-600 font-medium">
            سيتم نقل {typeLabel} إلى الأرشيف وإخفاؤه عن الطلاب والزوار، مع الحفاظ على كل المحتوى والبيانات وسجلات الطلاب التاريخية دون فقدان.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => setDeleteConfirm(null)}
              className="rounded-xl border px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const target = deleteConfirm;
                setDeleteConfirm(null);
                await patchStatus(target.type, target.id, 'archived');
                setNotice(`تمت أرشفة ${typeLabel} بنجاح`);
              }}
              className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
            >
              تأكيد الأرشفة
            </button>
          </div>
        </div>
      </div>
    );
  }
}
