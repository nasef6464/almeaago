import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  Eye,
  FileText,
  Layers3,
  Link2,
  Loader2,
  Plus,
  Save,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { contentClient } from '../api/content-client';
import type {
  CourseDetail,
  CourseLevel,
  CourseModule,
  LessonSummary,
  TaxonomyCore,
  TaxonomyFull,
  UpdateCourseInput,
} from '../api/content-types';

interface CourseEditorPanelProps {
  courseId: string;
  coreTaxonomy: TaxonomyCore;
  isAdmin: boolean;
  lockScope: boolean;
  getCsrfToken(): Promise<string>;
  onCancel(): void;
  onChanged(): void;
}

const levelOptions: Array<{ value: CourseLevel; label: string }> = [
  { value: 'beginner', label: 'مبتدئ' },
  { value: 'intermediate', label: 'متوسط' },
  { value: 'advanced', label: 'متقدم' },
];

function sortModules(modules: CourseModule[]) {
  return [...modules].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function CourseEditorPanel({
  courseId,
  coreTaxonomy,
  isAdmin,
  lockScope,
  getCsrfToken,
  onCancel,
  onChanged,
}: CourseEditorPanelProps) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyFull>({ ...coreTaxonomy, skills: [] });
  const [lessonOptions, setLessonOptions] = useState<LessonSummary[]>([]);
  const [lessonHasMore, setLessonHasMore] = useState(false);
  const [lessonSearch, setLessonSearch] = useState('');
  const [debouncedLessonSearch, setDebouncedLessonSearch] = useState('');
  const [selectedLessonByModule, setSelectedLessonByModule] = useState<Record<string, string>>({});
  const [previewByModule, setPreviewByModule] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'curriculum' | 'settings' | 'pricing' | 'files' | 'assessments'>('curriculum');
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [pathId, setPathId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructorName, setInstructorName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [level, setLevel] = useState<CourseLevel>('beginner');
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [dripContentEnabled, setDripContentEnabled] = useState(false);
  const [certificateEnabled, setCertificateEnabled] = useState(false);

  // Commercial & Pricing
  const [price, setPrice] = useState(0);
  const [originalPrice, setOriginalPrice] = useState(0);
  const [currency, setCurrency] = useState('ر.س');

  // Files & Attachments
  const [courseFiles, setCourseFiles] = useState<Array<{ id: string; title: string; size: string; url?: string; access: 'free_preview' | 'enrolled_paid' }>>([]);
  const [newFileTitle, setNewFileTitle] = useState('');
  const [newFileSize, setNewFileSize] = useState('');
  const [newFileAccess, setNewFileAccess] = useState<'free_preview' | 'enrolled_paid'>('free_preview');

  // Assessments
  const [courseAssessments, setCourseAssessments] = useState<Array<{ id: string; title: string; phase: 'pre_course' | 'during_course' | 'final_course'; durationMinutes: number; questionsCount: number; access: 'free_preview' | 'enrolled_paid' }>>([]);
  const [newAssessmentTitle, setNewAssessmentTitle] = useState('');
  const [newAssessmentPhase, setNewAssessmentPhase] = useState<'pre_course' | 'during_course' | 'final_course'>('during_course');
  const [newAssessmentMinutes, setNewAssessmentMinutes] = useState(30);
  const [newAssessmentQuestions, setNewAssessmentQuestions] = useState(20);

  function applyCourse(row: CourseDetail) {
    setCourse(row);
    setPathId(row.pathId);
    setSubjectId(row.subjectId);
    setTitle(row.title);
    setDescription(row.description || '');
    setInstructorName(row.instructorName || '');
    setDurationMinutes(row.durationMinutes || 0);
    setLevel((row.level as CourseLevel) || 'beginner');
    setSkillIds(row.skillIds || []);
    setIsVisible(row.isVisible);
    setDripContentEnabled(row.dripContentEnabled);
    setCertificateEnabled(row.certificateEnabled);

    let pres: any = {};
    try {
      if (row.presentation) {
        pres = typeof row.presentation === 'string' ? JSON.parse(row.presentation) : row.presentation;
      }
    } catch {
      // ignore
    }
    setPrice(pres.price ?? 0);
    setOriginalPrice(pres.originalPrice ?? 0);
    setCurrency(pres.currency || 'ر.س');
    setCourseFiles(Array.isArray(pres.files) ? pres.files : []);
    setCourseAssessments(Array.isArray(pres.assessments) ? pres.assessments : []);
  }

  async function refreshModules(signal?: AbortSignal) {
    const result = await contentClient.courseModules(courseId, signal);
    setModules(sortModules(result.modules));
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      contentClient.course(courseId, controller.signal),
      contentClient.courseModules(courseId, controller.signal),
      contentClient.taxonomyFull(controller.signal),
    ])
      .then(([courseResult, moduleResult, taxonomyResult]) => {
        applyCourse(courseResult.course);
        setModules(sortModules(moduleResult.modules));
        setTaxonomy(taxonomyResult);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'تعذر تحميل تفاصيل الدورة.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [courseId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedLessonSearch(lessonSearch.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [lessonSearch]);

  useEffect(() => {
    if (!course) return;
    const controller = new AbortController();
    contentClient
      .lessons(
        {
          page: 1,
          limit: 50,
          pathId: course.pathId,
          subjectId: course.subjectId,
          search: debouncedLessonSearch,
        },
        controller.signal,
      )
      .then((result) => {
        setLessonOptions(result.items);
        setLessonHasMore(result.hasMore);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'تعذر تحميل دروس المادة.');
      });
    return () => controller.abort();
  }, [course?.pathId, course?.subjectId, debouncedLessonSearch]);

  const subjects = useMemo(
    () => (taxonomy?.subjects || []).filter((subject) => !pathId || subject.pathId === pathId),
    [pathId, taxonomy?.subjects],
  );
  const skills = useMemo(
    () => (taxonomy?.skills || []).filter((skill) => skill.subjectId === subjectId),
    [subjectId, taxonomy?.skills],
  );
  const canMutate = Boolean(course && course.workflowStatus !== 'approved' && course.workflowStatus !== 'archived');

  useEffect(() => {
    if (subjectId && !subjects.some((subject) => subject.id === subjectId)) {
      setSubjectId('');
      setSkillIds([]);
    }
  }, [subjectId, subjects]);

  useEffect(() => {
    setSkillIds((current) => current.filter((id) => skills.some((skill) => skill.id === id)));
  }, [skills]);

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!course || !canMutate) return;
    const normalizedTitle = title.trim();
    if (!pathId || !subjectId || !normalizedTitle || skillIds.length === 0) {
      setError('أكمل المسار والمادة والعنوان ومهارة واحدة على الأقل.');
      return;
    }

    const existingPres = typeof course.presentation === 'object' && course.presentation !== null
      ? (course.presentation as Record<string, any>)
      : {};

    const updatedPresentation = {
      ...existingPres,
      price: Math.max(0, Number(price) || 0),
      originalPrice: Math.max(0, Number(originalPrice) || 0),
      currency: currency || 'ر.س',
      files: courseFiles,
      assessments: courseAssessments,
    };

    const input: UpdateCourseInput = {
      expectedRevision: course.revision,
      pathId,
      subjectId,
      title: normalizedTitle,
      description: description.trim(),
      instructorName: instructorName.trim() || 'فريق المنصة',
      durationMinutes: Math.max(0, Math.trunc(durationMinutes || 0)),
      level,
      ownerType: course.ownerType as UpdateCourseInput['ownerType'],
      ownerUserId: course.ownerUserId,
      ownerSchoolId: course.ownerSchoolId,
      assignedTeacherId: course.assignedTeacherId,
      revenueSharePercentage: course.revenueSharePercentage,
      isVisible,
      dripContentEnabled,
      certificateEnabled,
      thumbnailAssetId: course.thumbnailAssetId,
      presentation: updatedPresentation,
      skillIds,
    };

    setMutating(true);
    setError('');
    setNotice('');
    try {
      const csrf = await getCsrfToken();
      const result = await contentClient.updateCourse(courseId, input, csrf);
      applyCourse(result.course);
      setNotice('تم حفظ إعدادات الدورة.');
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ الدورة.');
    } finally {
      setMutating(false);
    }
  }

  async function addModule() {
    if (!course || !canMutate) return;
    setMutating(true);
    setError('');
    try {
      const csrf = await getCsrfToken();
      const result = await contentClient.createCourseModule(
        courseId,
        {
          expectedRevision: course.revision,
          title: 'قسم جديد',
          description: '',
          sortOrder: modules.length + 1,
          status: 'active',
        },
        csrf,
      );
      setCourse({ ...course, revision: result.courseRevision });
      await refreshModules();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إضافة القسم.');
    } finally {
      setMutating(false);
    }
  }

  function patchModule(moduleId: string, patch: Partial<CourseModule>) {
    setModules((current) =>
      current.map((module) => (module.id === moduleId ? { ...module, ...patch } : module)),
    );
  }

  async function saveModule(module: CourseModule, status: 'active' | 'archived' = module.status) {
    if (!course || !canMutate) return;
    const titleValue = module.title.trim();
    if (!titleValue) {
      setError('اكتب اسم القسم قبل الحفظ.');
      return;
    }
    setMutating(true);
    setError('');
    try {
      const csrf = await getCsrfToken();
      const result = await contentClient.updateCourseModule(
        courseId,
        module.id,
        {
          expectedRevision: course.revision,
          title: titleValue,
          description: module.description.trim(),
          sortOrder: Math.max(0, module.sortOrder),
          status,
        },
        csrf,
      );
      setCourse({ ...course, revision: result.courseRevision });
      await refreshModules();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ القسم.');
    } finally {
      setMutating(false);
    }
  }

  async function attachLesson(module: CourseModule) {
    if (!course || !canMutate) return;
    const lessonId = selectedLessonByModule[module.id] || '';
    if (!lessonId) {
      setError('اختر درسًا لربطه بالقسم.');
      return;
    }
    if (module.lessons.some((item) => item.lessonId === lessonId)) {
      setError('الدرس مرتبط بهذا القسم بالفعل.');
      return;
    }

    setMutating(true);
    setError('');
    try {
      const csrf = await getCsrfToken();
      const result = await contentClient.placeCourseLesson(
        courseId,
        module.id,
        lessonId,
        {
          expectedRevision: course.revision,
          sortOrder: module.lessons.length + 1,
          isPreview: Boolean(previewByModule[module.id]),
        },
        csrf,
      );
      setCourse({ ...course, revision: result.courseRevision });
      setSelectedLessonByModule((current) => ({ ...current, [module.id]: '' }));
      setPreviewByModule((current) => ({ ...current, [module.id]: false }));
      await refreshModules();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر ربط الدرس.');
    } finally {
      setMutating(false);
    }
  }

  async function removeLesson(module: CourseModule, lessonId: string) {
    if (!course || !canMutate) return;
    setMutating(true);
    setError('');
    try {
      const csrf = await getCsrfToken();
      const result = await contentClient.removeCourseLesson(
        courseId,
        module.id,
        lessonId,
        course.revision,
        csrf,
      );
      setCourse({ ...course, revision: result.courseRevision });
      await refreshModules();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إزالة الدرس من القسم.');
    } finally {
      setMutating(false);
    }
  }

  const lessonName = (lessonId: string) =>
    lessonOptions.find((item) => item.id === lessonId)?.title || lessonId;

  if (loading) {
    return <main className="min-h-[calc(100vh-5rem)] bg-gray-50 p-10 text-center font-black text-gray-500">جاري تحميل الدورة...</main>;
  }
  if (!course) {
    return (
      <main className="min-h-[calc(100vh-5rem)] bg-gray-50 p-6">
        <div className="mx-auto max-w-4xl rounded-2xl border border-rose-100 bg-rose-50 p-5 text-sm font-bold text-rose-800">
          {error || 'تعذر فتح الدورة.'}
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gray-50 p-1 sm:p-2">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <section className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-200 hover:text-gray-700"
              aria-label="إغلاق باني الدورة"
            >
              <X size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black text-gray-800 sm:text-xl">تعديل الدورة (Master Builder)</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500">
                <span className="truncate">{course.title}</span>
                <span>•</span>
                <span>Revision {course.revision}</span>
                <span>•</span>
                <span>{course.workflowStatus}</span>
                {course.isPublished ? <span className="text-emerald-700">• منشور</span> : null}
              </div>
            </div>
          </div>
          {activeTab !== 'curriculum' ? (
            <button
              type="submit"
              form="course-settings-form"
              disabled={!canMutate || mutating}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white transition hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              {mutating ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              <span className="hidden sm:inline">حفظ التغييرات</span>
            </button>
          ) : null}
        </section>

        {/* Top Course Readiness & Student Preview Strip */}
        {course && (() => {
          const issues: string[] = [];
          if (!course.title?.trim()) issues.push('اسم الدورة');
          if (!course.subjectId) issues.push('المادة');
          if (course.isVisible && !course.isPublished) issues.push('غير منشور');
          if (course.isVisible && course.workflowStatus !== 'approved') issues.push('ظاهر قبل الاعتماد');
          if (modules.length === 0) issues.push('لا توجد أقسام');
          const totalLessons = modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0);
          if (totalLessons === 0) issues.push('لا توجد دروس مضافة');

          const isReady = issues.length === 0;
          return (
            <div className={`mx-4 mt-4 p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
              isReady ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <div className="flex items-center gap-2">
                {isReady ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={18} className="text-amber-600 shrink-0" />}
                <span className="text-xs font-black">
                  {isReady ? 'الدورة جاهزة للعرض على الطالب بالكامل' : `جاهزية العرض تحتاج ضبط: ${issues.join('، ')}`}
                </span>
              </div>
              <a
                href={`/course/${course.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-black text-gray-700 hover:bg-gray-50 shadow-xs shrink-0"
              >
                <ExternalLink size={14} />
                معاينة صفحة الطالب ↗
              </a>
            </div>
          );
        })()}

        {lockScope ? (
          <div className="m-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
            نطاق المعلم مثبت على مسار ومادة هذه الدورة؛ تغيير التصنيف من هذه الشاشة غير متاح للمعلم.
          </div>
        ) : null}
        {!canMutate ? (
          <div className="m-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            الدورة {course.workflowStatus === 'approved' ? 'معتمدة' : 'مؤرشفة'}؛ الـBackend يمنع التعديل المباشر عليها. استخدم دورة العمل المناسبة أولًا.
          </div>
        ) : null}
        {notice ? <div className="mx-4 mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{notice}</div> : null}
        {error ? <div className="mx-4 mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div> : null}

        <section className="flex border-b border-gray-200 bg-white px-4 sm:px-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('curriculum')}
            className={`flex items-center justify-center gap-2 border-b-2 px-4 py-4 text-xs sm:text-sm font-black transition shrink-0 cursor-pointer ${
              activeTab === 'curriculum' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BookOpen size={17} />
            المنهج ({modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0)})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center justify-center gap-2 border-b-2 px-4 py-4 text-xs sm:text-sm font-black transition shrink-0 cursor-pointer ${
              activeTab === 'settings' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers3 size={17} />
            إعدادات الدورة
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={`flex items-center justify-center gap-2 border-b-2 px-4 py-4 text-xs sm:text-sm font-black transition shrink-0 cursor-pointer ${
              activeTab === 'pricing' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Tag size={17} />
            الأسعار والتجارة
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('files')}
            className={`flex items-center justify-center gap-2 border-b-2 px-4 py-4 text-xs sm:text-sm font-black transition shrink-0 cursor-pointer ${
              activeTab === 'files' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={17} />
            ملفات الدورة ({courseFiles.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assessments')}
            className={`flex items-center justify-center gap-2 border-b-2 px-4 py-4 text-xs sm:text-sm font-black transition shrink-0 cursor-pointer ${
              activeTab === 'assessments' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Award size={17} />
            الاختبارات المرتبطة ({courseAssessments.length})
          </button>
        </section>

        {activeTab === 'settings' ? (
          <form id="course-settings-form" onSubmit={saveSettings} className="space-y-5 bg-gray-50 p-4 sm:p-6">
            <section className="grid gap-5 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-black text-gray-700">اسم الدورة *</span>
                <input disabled={!canMutate} value={title} maxLength={240} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold disabled:bg-gray-50" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-gray-700">المسار *</span>
                <select disabled={!canMutate || lockScope} value={pathId} onChange={(event) => { setPathId(event.target.value); setSubjectId(''); setSkillIds([]); }} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold disabled:bg-gray-50">
                  <option value="">اختر المسار</option>
                  {taxonomy.paths.map((path) => <option key={path.id} value={path.id}>{path.name}</option>)}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-gray-700">المادة *</span>
                <select disabled={!canMutate || lockScope || !pathId} value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setSkillIds([]); }} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold disabled:bg-gray-50">
                  <option value="">اختر المادة</option>
                  {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-gray-700">اسم المدرب</span>
                <input disabled={!canMutate} value={instructorName} maxLength={160} onChange={(event) => setInstructorName(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold disabled:bg-gray-50" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-gray-700">المستوى</span>
                <select disabled={!canMutate} value={level} onChange={(event) => setLevel(event.target.value as CourseLevel)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold disabled:bg-gray-50">
                  {levelOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-black text-gray-700">المدة بالدقائق</span>
                <input disabled={!canMutate} type="number" min={0} value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold disabled:bg-gray-50" />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-black text-gray-700">الوصف</span>
                <textarea disabled={!canMutate} rows={5} maxLength={12000} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium leading-7 disabled:bg-gray-50" />
              </label>
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="font-black text-gray-900">المهارات</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {skills.map((skill) => {
                  const checked = skillIds.includes(skill.id);
                  return (
                    <label key={skill.id} className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'}`}>
                      <input disabled={!canMutate} type="checkbox" checked={checked} onChange={() => setSkillIds((current) => checked ? current.filter((id) => id !== skill.id) : [...current, skill.id])} className="mt-1" />
                      <span className="font-bold text-gray-800">{skill.name}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-3 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:grid-cols-3 sm:p-6">
              {[
                { label: 'ظاهر على المنصة', value: isVisible, setValue: setIsVisible },
                { label: 'فتح تدريجي للمحتوى', value: dripContentEnabled, setValue: setDripContentEnabled },
                { label: 'الشهادة مفعلة', value: certificateEnabled, setValue: setCertificateEnabled },
              ].map((item) => (
                <label key={item.label} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm font-black text-gray-700">
                  <input disabled={!canMutate} type="checkbox" checked={item.value} onChange={(event) => item.setValue(event.target.checked)} />
                  {item.label}
                </label>
              ))}
            </section>

            <div className="flex justify-end">
              <button type="submit" disabled={!canMutate || mutating} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50 cursor-pointer">
                {mutating ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                حفظ الإعدادات
              </button>
            </div>
          </form>
        ) : activeTab === 'pricing' ? (
          <form id="course-settings-form" onSubmit={saveSettings} className="space-y-5 bg-gray-50 p-4 sm:p-6">
            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 space-y-4">
              <div>
                <h2 className="text-lg font-black text-gray-900">الأسعار والتجارة (Commerce & Pricing)</h2>
                <p className="mt-1 text-xs text-gray-500 font-medium">
                  حدد السعر الفعلي للدورة والسعر الأصلي قبل الخصم، أو اجعلها 0 لتكون متاحة مجانًا للجميع.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-black text-gray-700">السعر الفعلي الحالي *</span>
                  <input
                    disabled={!canMutate}
                    type="number"
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold"
                  />
                  <span className="text-[10px] text-gray-400">0 تعني دورة مجانية مفتوحة</span>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-black text-gray-700">السعر الأصلي (قبل الخصم)</span>
                  <input
                    disabled={!canMutate}
                    type="number"
                    min={0}
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold"
                  />
                  <span className="text-[10px] text-gray-400">يظهر مشطوباً لإبراز نسبة التخفيض</span>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-black text-gray-700">العملة</span>
                  <select
                    disabled={!canMutate}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold"
                  >
                    <option value="ر.س">ر.س (ريال سعودي)</option>
                    <option value="SAR">SAR</option>
                  </select>
                </label>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-xs font-bold leading-6 text-indigo-900">
                {price > 0
                  ? `ستظهر الدورة للطالب بسعر ${price} ${currency} ${originalPrice > price ? `(مخفضة من ${originalPrice} ${currency})` : ''} مع زر شراء الدورة.`
                  : 'الدورة مسعرة بـ 0، ستظهر كـ "دورة مجانية" مع زر "ابدأ مجاناً الآن" دون الحاجة لبوابة دفع.'}
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!canMutate || mutating}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50 cursor-pointer"
              >
                {mutating ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                حفظ الأسعار
              </button>
            </div>
          </form>
        ) : activeTab === 'files' ? (
          <form id="course-settings-form" onSubmit={saveSettings} className="space-y-5 bg-gray-50 p-4 sm:p-6">
            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 space-y-4">
              <div>
                <h2 className="text-lg font-black text-gray-900">ملفات ومذكرات الدورة (Course Files)</h2>
                <p className="mt-1 text-xs text-gray-500 font-medium">
                  أضف مذكرات الشرح وحقائب التدريب القابلة للتحميل من قِبل الطلاب.
                </p>
              </div>

              {/* Add file form */}
              <div className="p-4 rounded-2xl border border-dashed border-gray-200 bg-slate-50/70 grid gap-3 sm:grid-cols-[1fr_120px_160px_auto] sm:items-end">
                <label className="space-y-1">
                  <span className="text-xs font-black text-gray-700">اسم الملف / المذكرة *</span>
                  <input
                    value={newFileTitle}
                    onChange={(e) => setNewFileTitle(e.target.value)}
                    placeholder="مثال: الحقيبة التدريبية الشاملة.pdf"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-black text-gray-700">الحجم</span>
                  <input
                    value={newFileSize}
                    onChange={(e) => setNewFileSize(e.target.value)}
                    placeholder="4.5 ميجابايت"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-black text-gray-700">صلاحية الوصول</span>
                  <select
                    value={newFileAccess}
                    onChange={(e) => setNewFileAccess(e.target.value as any)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold"
                  >
                    <option value="free_preview">مفتوح للجميع</option>
                    <option value="enrolled_paid">ضمن شراء الدورة</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const t = newFileTitle.trim();
                    if (!t) return;
                    setCourseFiles((prev) => [
                      ...prev,
                      {
                        id: `file-${Date.now()}`,
                        title: t,
                        size: newFileSize.trim() || '3.5 ميجابايت',
                        access: newFileAccess,
                      },
                    ]);
                    setNewFileTitle('');
                    setNewFileSize('');
                  }}
                  className="rounded-xl bg-slate-800 text-white px-4 py-2 text-xs font-black hover:bg-slate-900 cursor-pointer h-9 flex items-center justify-center gap-1"
                >
                  <Plus size={15} />
                  إضافة ملف
                </button>
              </div>

              {/* Files List */}
              <div className="space-y-2 pt-2">
                {courseFiles.length === 0 ? (
                  <div className="p-8 text-center text-xs font-bold text-gray-400 border border-gray-100 rounded-2xl bg-white">
                    لم تتم إضافة ملفات بعد. يمكنك إضافة المذكرات والحقائب أعلاه.
                  </div>
                ) : (
                  courseFiles.map((file, idx) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 bg-white shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-400 w-5 text-center">{idx + 1}</span>
                        <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                          <FileText size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-900">{file.title}</p>
                          <p className="text-xs text-gray-500">
                            {file.size} • {file.access === 'free_preview' ? 'مفتوح للجميع' : 'ضمن شراء الدورة'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCourseFiles((prev) => prev.filter((f) => f.id !== file.id))}
                        className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="حذف الملف"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!canMutate || mutating}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50 cursor-pointer"
              >
                {mutating ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                حفظ الملفات
              </button>
            </div>
          </form>
        ) : activeTab === 'assessments' ? (
          <form id="course-settings-form" onSubmit={saveSettings} className="space-y-5 bg-gray-50 p-4 sm:p-6">
            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 space-y-4">
              <div>
                <h2 className="text-lg font-black text-gray-900">الاختبارات المرتبطة (Course Assessments)</h2>
                <p className="mt-1 text-xs text-gray-500 font-medium">
                  حدد اختبارات تحديد المستوى القبلية، الاختبارات الدورية، والاختبار الشامل النهائي للدورة.
                </p>
              </div>

              {/* Add assessment form */}
              <div className="p-4 rounded-2xl border border-dashed border-gray-200 bg-slate-50/70 grid gap-3 sm:grid-cols-[1fr_140px_100px_100px_auto] sm:items-end">
                <label className="space-y-1">
                  <span className="text-xs font-black text-gray-700">عنوان الاختبار *</span>
                  <input
                    value={newAssessmentTitle}
                    onChange={(e) => setNewAssessmentTitle(e.target.value)}
                    placeholder="مثال: الاختبار القبلي لقياس المستوى"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-black text-gray-700">المرحلة</span>
                  <select
                    value={newAssessmentPhase}
                    onChange={(e) => setNewAssessmentPhase(e.target.value as any)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold"
                  >
                    <option value="pre_course">قبل الدورة (قبلي)</option>
                    <option value="during_course">أثناء الدورة (دوري)</option>
                    <option value="final_course">نهاية الدورة (نهائي)</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-black text-gray-700">المدة (د)</span>
                  <input
                    type="number"
                    min={5}
                    value={newAssessmentMinutes}
                    onChange={(e) => setNewAssessmentMinutes(Number(e.target.value) || 25)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-black text-gray-700">الأسئلة</span>
                  <input
                    type="number"
                    min={1}
                    value={newAssessmentQuestions}
                    onChange={(e) => setNewAssessmentQuestions(Number(e.target.value) || 20)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const t = newAssessmentTitle.trim();
                    if (!t) return;
                    setCourseAssessments((prev) => [
                      ...prev,
                      {
                        id: `test-${Date.now()}`,
                        title: t,
                        phase: newAssessmentPhase,
                        durationMinutes: newAssessmentMinutes,
                        questionsCount: newAssessmentQuestions,
                        access: newAssessmentPhase === 'pre_course' ? 'free_preview' : 'enrolled_paid',
                      },
                    ]);
                    setNewAssessmentTitle('');
                  }}
                  className="rounded-xl bg-slate-800 text-white px-4 py-2 text-xs font-black hover:bg-slate-900 cursor-pointer h-9 flex items-center justify-center gap-1"
                >
                  <Plus size={15} />
                  ربط اختبار
                </button>
              </div>

              {/* Assessments List */}
              <div className="space-y-2 pt-2">
                {courseAssessments.length === 0 ? (
                  <div className="p-8 text-center text-xs font-bold text-gray-400 border border-gray-100 rounded-2xl bg-white">
                    لم يتم ربط اختبارات بعد. أضف الاختبارات المرتبطة بهذه الدورة أعلاه.
                  </div>
                ) : (
                  courseAssessments.map((test, idx) => (
                    <div
                      key={test.id}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 bg-white shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-400 w-5 text-center">{idx + 1}</span>
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                          <Award size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-900">{test.title}</p>
                          <p className="text-xs text-gray-500">
                            {test.phase === 'pre_course' ? 'قبلي' : test.phase === 'final_course' ? 'نهائي شامل' : 'دوري'} • {test.durationMinutes} دقيقة • {test.questionsCount} سؤال
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCourseAssessments((prev) => prev.filter((a) => a.id !== test.id))}
                        className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="حذف الاختبار"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!canMutate || mutating}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50 cursor-pointer"
              >
                {mutating ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                حفظ الاختبارات
              </button>
            </div>
          </form>
        ) : (
          <section className="space-y-4 bg-gray-50 p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900">باني المناهج (Curriculum Builder)</h2>
                <p className="mt-1 text-sm font-medium text-gray-500">قم بإضافة الأقسام والدروس. الروابط تحفظ مراجع Content الحقيقية ولا تنسخ محتوى الدرس.</p>
              </div>
              <button type="button" disabled={!canMutate || mutating || modules.length >= 200} onClick={() => void addModule()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">
                <Plus size={18} />
                إضافة قسم
              </button>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <label className="space-y-2">
                <span className="text-xs font-black text-gray-500">ابحث في دروس نفس المسار والمادة</span>
                <input value={lessonSearch} onChange={(event) => setLessonSearch(event.target.value)} placeholder="اسم درس..." className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold" />
              </label>
              {lessonHasMore ? <p className="mt-2 text-xs font-bold text-amber-700">هناك نتائج أخرى؛ استخدم البحث لتضييق القائمة بدل تحميل كل الدروس.</p> : null}
            </div>

            {modules.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm font-bold text-gray-500">
                لا توجد أقسام بعد.
              </div>
            ) : modules.map((module) => (
              <article key={module.id} className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${module.status === 'archived' ? 'border-gray-200 opacity-70' : 'border-gray-100'}`}>
                <div className="grid gap-3 border-b border-gray-100 bg-gray-50 p-4 md:grid-cols-[1fr_160px_auto] md:items-end">
                  <label className="space-y-1">
                    <span className="text-xs font-black text-gray-500">اسم القسم</span>
                    <input disabled={!canMutate || module.status === 'archived'} value={module.title} onChange={(event) => patchModule(module.id, { title: event.target.value })} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-black disabled:bg-gray-100" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-black text-gray-500">الترتيب</span>
                    <input disabled={!canMutate || module.status === 'archived'} type="number" min={0} value={module.sortOrder} onChange={(event) => patchModule(module.id, { sortOrder: Number(event.target.value) || 0 })} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold disabled:bg-gray-100" />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" disabled={!canMutate || mutating || module.status === 'archived'} onClick={() => void saveModule(module)} className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-800 disabled:opacity-50"><Save size={15} />حفظ</button>
                    {isAdmin && module.status === 'active' ? (
                      <button type="button" disabled={!canMutate || mutating} onClick={() => void saveModule(module, 'archived')} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-800 disabled:opacity-50"><Trash2 size={15} />أرشفة</button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  {module.lessons.length === 0 ? (
                    <div className="rounded-xl bg-gray-50 p-4 text-sm font-bold text-gray-500">لا توجد دروس في هذا القسم.</div>
                  ) : module.lessons
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.lessonId.localeCompare(b.lessonId))
                    .map((placement) => (
                      <div key={placement.lessonId} className="flex flex-col gap-3 rounded-xl border border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="font-black text-gray-800">{lessonName(placement.lessonId)}</div>
                          <div className="mt-1 flex items-center gap-2 text-xs font-bold text-gray-500">
                            <span>ترتيب {placement.sortOrder}</span>
                            {placement.isPreview ? <span className="inline-flex items-center gap-1 text-emerald-700"><Eye size={13} />معاينة مجانية</span> : <span>ضمن الاشتراك</span>}
                          </div>
                        </div>
                        <button type="button" disabled={!canMutate || mutating || module.status === 'archived'} onClick={() => void removeLesson(module, placement.lessonId)} className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-800 disabled:opacity-50">
                          <Trash2 size={14} />
                          إزالة
                        </button>
                      </div>
                    ))}

                  {module.status === 'active' ? (
                    <div className="grid gap-2 border-t border-gray-100 pt-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                      <select disabled={!canMutate || mutating} value={selectedLessonByModule[module.id] || ''} onChange={(event) => setSelectedLessonByModule((current) => ({ ...current, [module.id]: event.target.value }))} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold disabled:bg-gray-50">
                        <option value="">استدعاء درس موجود...</option>
                        {lessonOptions
                          .filter((lesson) => !module.lessons.some((placement) => placement.lessonId === lesson.id))
                          .map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
                      </select>
                      <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700">
                        <input disabled={!canMutate || mutating} type="checkbox" checked={Boolean(previewByModule[module.id])} onChange={(event) => setPreviewByModule((current) => ({ ...current, [module.id]: event.target.checked }))} />
                        معاينة مجانية
                      </label>
                      <button type="button" disabled={!canMutate || mutating || !selectedLessonByModule[module.id]} onClick={() => void attachLesson(module)} className="inline-flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">
                        <Link2 size={15} />
                        ربط الدرس
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
