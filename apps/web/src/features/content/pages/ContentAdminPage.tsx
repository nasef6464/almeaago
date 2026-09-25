import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderTree,
  GraduationCap,
  Library,
  Lock,
  Plus,
  RefreshCcw,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../api/content-client';
import { CourseCreatePanel } from '../components/CourseCreatePanel';
import { CourseEditorPanel } from '../components/CourseEditorPanel';
import { LessonEditorPanel } from '../components/LessonEditorPanel';
import type {
  ContentListFilters,
  ContentWorkflowStatus,
  CourseSummary,
  FoundationTopicSummary,
  LibrarySummary,
  LessonSummary,
  TaxonomyCore,
} from '../api/content-types';

type ContentTab = 'courses' | 'lessons' | 'foundation' | 'library';
type ContentRow = CourseSummary | LessonSummary | FoundationTopicSummary | LibrarySummary;

const workflowLabels: Record<ContentWorkflowStatus, string> = {
  draft: 'مسودة',
  pending_review: 'بانتظار المراجعة',
  approved: 'معتمد',
  rejected: 'مرفوض',
  archived: 'مؤرشف',
};

function tabLabel(tab: ContentTab) {
  switch (tab) {
    case 'courses':
      return 'الدورات';
    case 'lessons':
      return 'الدروس';
    case 'foundation':
      return 'التأسيس';
    case 'library':
      return 'المكتبة';
  }
}

function workflow(row: ContentRow): ContentWorkflowStatus | undefined {
  return 'workflowStatus' in row ? row.workflowStatus : undefined;
}

function workflowClass(status: ContentWorkflowStatus) {
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700';
  if (status === 'pending_review') return 'bg-amber-50 text-amber-700';
  if (status === 'rejected') return 'bg-rose-50 text-rose-700';
  if (status === 'archived') return 'bg-slate-100 text-slate-600';
  return 'bg-gray-100 text-gray-600';
}

function isCourseRow(row: ContentRow): row is CourseSummary {
  return 'isPublished' in row;
}

function isLessonRow(row: ContentRow): row is LessonSummary {
  return 'durationSeconds' in row;
}

export function ContentAdminPage() {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const isTeacher = user?.roles.includes('teacher') ?? false;
  const [tab, setTab] = useState<ContentTab>('courses');
  const [taxonomy, setTaxonomy] = useState<TaxonomyCore>({ paths: [], subjects: [] });
  const [taxonomyError, setTaxonomyError] = useState('');
  const [pathId, setPathId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [workflowStatus, setWorkflowStatus] = useState<ContentWorkflowStatus | ''>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState('');
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [mutatingCourseId, setMutatingCourseId] = useState('');
  const [mutatingLessonId, setMutatingLessonId] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    contentClient
      .taxonomyCore(controller.signal)
      .then((result) => {
        setTaxonomy(result);
        setTaxonomyError('');
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setTaxonomyError(cause instanceof Error ? cause.message : 'تعذر تحميل المسارات والمواد.');
      });
    return () => controller.abort();
  }, []);

  const availableSubjects = useMemo(
    () => taxonomy.subjects.filter((subject) => !pathId || subject.pathId === pathId),
    [pathId, taxonomy.subjects],
  );

  useEffect(() => {
    if (subjectId && !availableSubjects.some((subject) => subject.id === subjectId)) {
      setSubjectId('');
    }
  }, [availableSubjects, subjectId]);

  useEffect(() => {
    if (tab === 'foundation' && !isAdmin) setTab('courses');
  }, [isAdmin, tab]);

  const teacherRequiresExactScope = isTeacher && !isAdmin;
  const waitingForTeacherScope = Boolean(teacherRequiresExactScope && (!pathId || !subjectId));

  useEffect(() => {
    if (authLoading || !user || (!isAdmin && !isTeacher) || waitingForTeacherScope) {
      setRows([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const filters: ContentListFilters = {
      page,
      limit: 50,
      pathId,
      subjectId,
      search: debouncedSearch,
      workflowStatus: tab === 'foundation' ? '' : workflowStatus,
    };

    setLoading(true);
    setError('');

    const pending =
      tab === 'courses'
        ? contentClient.courses(filters, controller.signal)
        : tab === 'lessons'
          ? contentClient.lessons(filters, controller.signal)
          : tab === 'library'
            ? contentClient.library(filters, controller.signal)
            : contentClient.foundation(filters, controller.signal);

    pending
      .then((result) => {
        setRows(result.items);
        setHasMore(result.hasMore);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setRows([]);
        setHasMore(false);
        setError(cause instanceof Error ? cause.message : 'تعذر تحميل المحتوى.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [
    authLoading,
    debouncedSearch,
    isAdmin,
    isTeacher,
    page,
    pathId,
    reloadKey,
    subjectId,
    tab,
    user,
    waitingForTeacherScope,
    workflowStatus,
  ]);

  const stats = useMemo(() => {
    const approved = rows.filter((row) => workflow(row) === 'approved').length;
    const visible = rows.filter((row) => row.isVisible).length;
    const locked = rows.filter((row) => 'isLocked' in row && row.isLocked).length;
    return { shown: rows.length, approved, visible, locked };
  }, [rows]);

  async function setCourseWorkflow(
    course: CourseSummary,
    status: ContentWorkflowStatus,
    reviewerNotes = '',
  ) {
    setMutatingCourseId(course.id);
    setActionError('');
    try {
      const csrfToken = await getCsrfToken();
      await contentClient.courseWorkflow(
        course.id,
        course.revision,
        status,
        reviewerNotes.trim(),
        csrfToken,
      );
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'تعذر تحديث حالة الدورة.');
    } finally {
      setMutatingCourseId('');
    }
  }

  async function toggleCoursePublication(course: CourseSummary) {
    setMutatingCourseId(course.id);
    setActionError('');
    try {
      const csrfToken = await getCsrfToken();
      await contentClient.coursePublication(
        course.id,
        course.revision,
        !course.isPublished,
        csrfToken,
      );
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'تعذر تحديث نشر الدورة.');
    } finally {
      setMutatingCourseId('');
    }
  }

  function rejectCourse(course: CourseSummary) {
    const notes = window.prompt('اشرح المطلوب تعديله للمدرب:', '');
    if (notes === null) return;
    void setCourseWorkflow(course, 'rejected', notes);
  }

  async function setLessonWorkflow(
    lesson: LessonSummary,
    status: ContentWorkflowStatus,
    reviewerNotes = '',
  ) {
    setMutatingLessonId(lesson.id);
    setActionError('');
    try {
      const csrfToken = await getCsrfToken();
      await contentClient.lessonWorkflow(
        lesson.id,
        lesson.revision,
        status,
        reviewerNotes.trim(),
        csrfToken,
      );
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'تعذر تحديث حالة الدرس.');
    } finally {
      setMutatingLessonId('');
    }
  }

  function rejectLesson(lesson: LessonSummary) {
    const notes = window.prompt('اشرح المطلوب تعديله للمدرب:', '');
    if (notes === null) return;
    void setLessonWorkflow(lesson, 'rejected', notes);
  }

  if (authLoading) {
    return <main className="min-h-[calc(100vh-5rem)] bg-gray-50 p-10 text-center font-black text-gray-600">جاري التحقق من الجلسة...</main>;
  }
  if (!user || (!isAdmin && !isTeacher)) {
    return <main className="min-h-[calc(100vh-5rem)] bg-gray-50 p-10 text-center font-black text-rose-700">هذه الشاشة متاحة للإدارة والمعلمين المخولين فقط.</main>;
  }

  if (editingLessonId !== null) {
    return (
      <LessonEditorPanel
        lessonId={editingLessonId || undefined}
        coreTaxonomy={taxonomy}
        initialPathId={pathId}
        initialSubjectId={subjectId}
        lockScope={teacherRequiresExactScope}
        getCsrfToken={getCsrfToken}
        onCancel={() => setEditingLessonId(null)}
        onSaved={() => {
          setEditingLessonId(null);
          setTab('lessons');
          setPage(1);
          setReloadKey((value) => value + 1);
        }}
      />
    );
  }

  if (editingCourseId) {
    return (
      <CourseEditorPanel
        courseId={editingCourseId}
        coreTaxonomy={taxonomy}
        isAdmin={isAdmin}
        lockScope={teacherRequiresExactScope}
        getCsrfToken={getCsrfToken}
        onCancel={() => setEditingCourseId('')}
        onChanged={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  if (creatingCourse) {
    return (
      <CourseCreatePanel
        coreTaxonomy={taxonomy}
        initialPathId={pathId}
        initialSubjectId={subjectId}
        lockScope={teacherRequiresExactScope}
        getCsrfToken={getCsrfToken}
        onCancel={() => setCreatingCourse(false)}
        onCreated={() => {
          setCreatingCourse(false);
          setTab('courses');
          setPage(1);
          setReloadKey((value) => value + 1);
        }}
      />
    );
  }

  const tabs: Array<{ id: ContentTab; label: string; icon: typeof BookOpen }> = [
    { id: 'courses', label: 'الدورات', icon: GraduationCap },
    { id: 'lessons', label: 'الدروس', icon: BookOpen },
    ...(isAdmin ? [{ id: 'foundation' as const, label: 'التأسيس', icon: FolderTree }] : []),
    { id: 'library', label: 'المكتبة', icon: Library },
  ];

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-black text-indigo-600">Content Management</div>
            <h1 className="mt-1 text-2xl font-black text-gray-900">إدارة المحتوى التعليمي</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-7 text-gray-500">
              نقل تدريجي لنفس تقسيم الواجهة المرجعية، مع قراءة مباشرة من Go/PostgreSQL وقوائم محدودة بدل تحميل المخزون كاملًا.
            </p>
          </div>
          <button
            type="button"
            disabled={
              (tab !== 'courses' && tab !== 'lessons') ||
              (teacherRequiresExactScope && (!pathId || !subjectId))
            }
            title={
              tab !== 'courses' && tab !== 'lessons'
                ? 'سيتم تفعيل الإنشاء لكل نوع محتوى في شريحته المنفصلة.'
                : teacherRequiresExactScope && (!pathId || !subjectId)
                  ? 'اختر المسار والمادة أولًا لتثبيت نطاق المعلم.'
                  : tab === 'courses'
                    ? 'إنشاء دورة جديدة'
                    : 'إضافة درس جديد'
            }
            onClick={() => {
              if (tab === 'courses') setCreatingCourse(true);
              if (tab === 'lessons') setEditingLessonId('');
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={18} />
            {tab === 'courses' ? 'إنشاء دورة جديدة' : tab === 'lessons' ? 'إضافة درس جديد' : 'إضافة'}
          </button>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setPage(1);
                    setWorkflowStatus('');
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black transition ${active ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5">
          <label className="relative block xl:col-span-2">
            <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`ابحث في ${tabLabel(tab)}...`}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-3 pr-10 text-sm font-bold outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <select
            value={pathId}
            onChange={(event) => {
              setPathId(event.target.value);
              setSubjectId('');
              setPage(1);
            }}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-700 outline-none"
          >
            <option value="">كل المسارات</option>
            {taxonomy.paths.map((path) => <option key={path.id} value={path.id}>{path.name}</option>)}
          </select>

          <select
            value={subjectId}
            disabled={!pathId}
            onChange={(event) => {
              setSubjectId(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-700 outline-none disabled:opacity-50"
          >
            <option value="">كل المواد</option>
            {availableSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
          </select>

          {tab !== 'foundation' ? (
            <select
              value={workflowStatus}
              onChange={(event) => {
                setWorkflowStatus(event.target.value as ContentWorkflowStatus | '');
                setPage(1);
              }}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-700 outline-none"
            >
              <option value="">كل الحالات</option>
              {Object.entries(workflowLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          ) : (
            <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-black text-gray-700">
              <RefreshCcw size={17} />
              تحديث
            </button>
          )}
        </section>

        {taxonomyError ? <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{taxonomyError}</div> : null}
        {waitingForTeacherScope ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm font-bold leading-7 text-blue-800">
            اختر المسار ثم المادة لقراءة نطاق المدرسة/المدرب المصرح لك به. لا يتم تنفيذ طلب واسع للمعلم قبل تحديد النطاق.
          </div>
        ) : null}

        {!waitingForTeacherScope ? (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'المعروض', value: stats.shown, icon: FileText },
                { label: 'المعتمد', value: stats.approved, icon: CheckCircle2 },
                { label: 'الظاهر', value: stats.visible, icon: BookOpen },
                { label: 'المغلق', value: stats.locked, icon: Lock },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-black text-gray-500"><Icon size={17} />{item.label}</div>
                    <div className="mt-3 text-2xl font-black text-gray-900">{item.value.toLocaleString('ar-SA')}</div>
                  </div>
                );
              })}
            </section>

            {error ? <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</div> : null}
            {actionError ? <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-800">{actionError}</div> : null}

            <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
                <div>
                  <h2 className="font-black text-gray-900">{tabLabel(tab)}</h2>
                  <p className="mt-1 text-xs font-bold text-gray-400">صفحة {page.toLocaleString('ar-SA')} · 50 عنصرًا كحد أقصى</p>
                </div>
                <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-600">
                  <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
                  تحديث
                </button>
              </div>

              {loading ? (
                <div className="p-10 text-center text-sm font-black text-gray-500">جاري تحميل المحتوى...</div>
              ) : rows.length === 0 ? (
                <div className="p-10 text-center text-sm font-black text-gray-500">لا توجد عناصر مطابقة للفلاتر الحالية.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-right text-sm">
                    <thead className="bg-gray-50 text-xs font-black text-gray-500">
                      <tr>
                        <th className="px-4 py-3">العنوان</th>
                        <th className="px-4 py-3">المسار / المادة</th>
                        <th className="px-4 py-3">الحالة</th>
                        <th className="px-4 py-3">الظهور</th>
                        <th className="px-4 py-3">النوع / المستوى</th>
                        <th className="px-4 py-3">آخر تحديث</th>
                        <th className="px-4 py-3">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((row) => {
                        const path = taxonomy.paths.find((item) => item.id === row.pathId);
                        const subject = taxonomy.subjects.find((item) => item.id === row.subjectId);
                        const status = workflow(row);
                        const type = 'level' in row ? row.level : 'type' in row ? row.type : 'code' in row ? row.code : '-';
                        return (
                          <tr key={row.id} className="text-gray-700 hover:bg-gray-50/70">
                            <td className="px-4 py-4"><div className="font-black text-gray-900">{row.title}</div></td>
                            <td className="px-4 py-4"><div className="font-bold">{path?.name || row.pathId}</div><div className="mt-1 text-xs text-gray-500">{subject?.name || row.subjectId}</div></td>
                            <td className="px-4 py-4">
                              {status ? <span className={`rounded-full px-3 py-1 text-xs font-black ${workflowClass(status)}`}>{workflowLabels[status]}</span> : <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{'status' in row ? row.status : '-'}</span>}
                            </td>
                            <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${row.isVisible ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-500'}`}>{row.isVisible ? 'ظاهر' : 'مخفي'}</span></td>
                            <td className="px-4 py-4 font-bold text-gray-600">{type || '-'}</td>
                            <td className="px-4 py-4 text-xs font-bold text-gray-500">{new Date(row.updatedAt).toLocaleString('ar-SA')}</td>
                            <td className="px-4 py-4">
                              {isCourseRow(row) ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={mutatingCourseId === row.id}
                                    onClick={() => setEditingCourseId(row.id)}
                                    className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-black text-blue-800 disabled:opacity-50"
                                  >
                                    تعديل / المنهج
                                  </button>
                                  {(row.workflowStatus === 'draft' || row.workflowStatus === 'rejected') ? (
                                    <button
                                      type="button"
                                      disabled={mutatingCourseId === row.id}
                                      onClick={() => void setCourseWorkflow(row, 'pending_review')}
                                      className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-black text-amber-800 disabled:opacity-50"
                                    >
                                      إرسال للمراجعة
                                    </button>
                                  ) : null}
                                  {row.workflowStatus === 'pending_review' && !isAdmin ? (
                                    <button
                                      type="button"
                                      disabled={mutatingCourseId === row.id}
                                      onClick={() => void setCourseWorkflow(row, 'draft')}
                                      className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-black text-gray-700 disabled:opacity-50"
                                    >
                                      سحب للمسودة
                                    </button>
                                  ) : null}
                                  {row.workflowStatus === 'pending_review' && isAdmin ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={mutatingCourseId === row.id}
                                        onClick={() => void setCourseWorkflow(row, 'approved')}
                                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-800 disabled:opacity-50"
                                      >
                                        اعتماد
                                      </button>
                                      <button
                                        type="button"
                                        disabled={mutatingCourseId === row.id}
                                        onClick={() => rejectCourse(row)}
                                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-black text-rose-800 disabled:opacity-50"
                                      >
                                        رفض
                                      </button>
                                    </>
                                  ) : null}
                                  {row.workflowStatus === 'approved' && isAdmin ? (
                                    <button
                                      type="button"
                                      disabled={mutatingCourseId === row.id}
                                      onClick={() => void toggleCoursePublication(row)}
                                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-black text-indigo-800 disabled:opacity-50"
                                    >
                                      {row.isPublished ? 'إلغاء النشر' : 'نشر'}
                                    </button>
                                  ) : null}
                                </div>
                              ) : isLessonRow(row) ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={mutatingLessonId === row.id}
                                    onClick={() => setEditingLessonId(row.id)}
                                    className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-black text-blue-800 disabled:opacity-50"
                                  >
                                    تعديل
                                  </button>
                                  {(row.workflowStatus === 'draft' || row.workflowStatus === 'rejected') ? (
                                    <button
                                      type="button"
                                      disabled={mutatingLessonId === row.id}
                                      onClick={() => void setLessonWorkflow(row, 'pending_review')}
                                      className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-black text-amber-800 disabled:opacity-50"
                                    >
                                      إرسال للمراجعة
                                    </button>
                                  ) : null}
                                  {row.workflowStatus === 'pending_review' && !isAdmin ? (
                                    <button
                                      type="button"
                                      disabled={mutatingLessonId === row.id}
                                      onClick={() => void setLessonWorkflow(row, 'draft')}
                                      className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-black text-gray-700 disabled:opacity-50"
                                    >
                                      سحب للمسودة
                                    </button>
                                  ) : null}
                                  {row.workflowStatus === 'pending_review' && isAdmin ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={mutatingLessonId === row.id}
                                        onClick={() => void setLessonWorkflow(row, 'approved')}
                                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-800 disabled:opacity-50"
                                      >
                                        اعتماد
                                      </button>
                                      <button
                                        type="button"
                                        disabled={mutatingLessonId === row.id}
                                        onClick={() => rejectLesson(row)}
                                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-black text-rose-800 disabled:opacity-50"
                                      >
                                        رفض
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-4">
                <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 disabled:opacity-40"><ChevronRight size={16} />السابق</button>
                <span className="text-xs font-black text-gray-500">صفحة {page.toLocaleString('ar-SA')}</span>
                <button type="button" disabled={!hasMore || loading} onClick={() => setPage((value) => value + 1)} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 disabled:opacity-40">التالي<ChevronLeft size={16} /></button>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
