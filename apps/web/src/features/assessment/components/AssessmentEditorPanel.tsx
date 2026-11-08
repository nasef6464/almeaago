import {
  ArrowRight,
  Plus,
  Search,
  Trash2,
  Sparkles,
  Clock,
  CheckCircle2,
  Lock,
  Layers,
  Settings,
  FileQuestion,
  ZoomIn,
  Sliders,
  ChevronDown,
  ChevronUp,
  Award,
  HelpCircle,
  AlertCircle,
  Eye,
  X,
  Users,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { assessmentClient } from '../api/assessment-client';
import type {
  AssessmentDetail,
  AssessmentQuestionPlacement,
  AssessmentSection,
  AssessmentVersion,
  AssessmentWorkflowStatus,
  QuestionSummary,
} from '../api/assessment-types';
import type { TaxonomyCore } from '../../content/api/content-types';
import { QuestionImageZoomModal } from './QuestionImageZoomModal';

interface Props {
  assessmentId?: string;
  taxonomy: TaxonomyCore;
  initialPathId: string;
  initialSubjectId: string;
  isAdmin: boolean;
  lockScope: boolean;
  getCsrfToken: () => Promise<string>;
  onCancel: () => void;
  onSaved: () => void;
}

const baseVersion = (pathId: string, subjectId: string): AssessmentVersion => ({
  version: 1,
  accessType: 'free',
  title: '',
  description: '',
  pathId,
  subjectId,
  kind: 'normal',
  normalMode: 'exam',
  showExplanations: true,
  showAnswers: true,
  showResultsReport: true,
  returnToSourceOnFinish: false,
  maxAttempts: 1,
  passingScore: 60,
  timeLimitSeconds: 3600, // 60 minutes default
  randomizeQuestions: false,
  randomizeOptions: false,
  showProgressBar: true,
  requireAnswerBeforeNext: false,
  allowQuestionReview: true,
  optionLayout: 'vertical',
  mockCategory: '',
  mockTargetScore: null,
  mockStrictSectionLock: null,
  mockPresentationMode: '',
  presentation: {},
  revisionNote: '',
});

export function AssessmentEditorPanel(p: Props) {
  const [activeTab, setActiveTab] = useState<'info' | 'sections' | 'questions' | 'settings' | 'access'>('info');
  const [detail, setDetail] = useState<AssessmentDetail | null>(null);
  const [code, setCode] = useState('');
  const [version, setVersion] = useState<AssessmentVersion>(() => baseVersion(p.initialPathId, p.initialSubjectId));
  const [sections, setSections] = useState<AssessmentSection[]>([]);
  const [questions, setQuestions] = useState<AssessmentQuestionPlacement[]>([]);
  const [qRows, setQRows] = useState<QuestionSummary[]>([]);
  const [qSearch, setQSearch] = useState('');
  const [qDifficulty, setQDifficulty] = useState<string>('all');
  const [loading, setLoading] = useState(Boolean(p.assessmentId));
  const [saving, setSaving] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Zoom modal state
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

  // Auto-generation modal
  const [showAutoGenerate, setShowAutoGenerate] = useState(false);
  const [autoGenCount, setAutoGenCount] = useState<number>(20);
  const [autoGenDifficulty, setAutoGenDifficulty] = useState<string>('all');
  const [autoGenSectionId, setAutoGenSectionId] = useState<string>('');

  useEffect(() => {
    if (!p.assessmentId) return;
    const c = new AbortController();
    setLoading(true);
    setError('');
    assessmentClient
      .get(p.assessmentId, c.signal)
      .then((r) => {
        if (c.signal.aborted) return;
        setDetail(r.assessment);
        setCode(r.assessment.code);
        setVersion(r.assessment.version);
        setIsVisible(r.assessment.isVisible);
        setSections(r.assessment.sections || []);
        setQuestions(r.assessment.questions || []);
      })
      .catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'تعذر تحميل الاختبار'); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [p.assessmentId]);

  const subjects = useMemo(
    () => p.taxonomy.subjects.filter((s) => s.pathId === version.pathId),
    [p.taxonomy.subjects, version.pathId]
  );

  const selectedPath = useMemo(
    () => p.taxonomy.paths.find((path) => path.id === version.pathId),
    [p.taxonomy.paths, version.pathId]
  );

  const isTahsili = useMemo(
    () =>
      (selectedPath?.code || '').toUpperCase().includes('TAHSILI') ||
      (selectedPath?.name || '').includes('تحصيلي'),
    [selectedPath]
  );

  const isQudrat = useMemo(
    () =>
      (selectedPath?.code || '').toUpperCase().includes('QUDRAT') ||
      (selectedPath?.name || '').includes('قدرات'),
    [selectedPath]
  );

  // Load questions for picking
  useEffect(() => {
    if (!version.pathId || !version.subjectId) {
      setQRows([]);
      return;
    }
    const c = new AbortController();
    const t = window.setTimeout(
      () =>
        assessmentClient
          .questions(version.pathId, version.subjectId, qSearch.trim(), qDifficulty, 100, c.signal)
          .then((r) => setQRows(r.items))
          .catch(() => setQRows([])),
      250
    );
    return () => {
      window.clearTimeout(t);
      c.abort();
    };
  }, [qSearch, qDifficulty, version.pathId, version.subjectId]);

  // Add individual question
  function addQuestion(q: QuestionSummary, targetSectionId = '') {
    if (questions.some((x) => x.questionId === q.id)) return;
    setQuestions((x) => [
      ...x,
      {
        questionId: q.id,
        questionVersion: q.currentVersion,
        sectionId: targetSectionId || (sections[0]?.id ?? ''),
        sortOrder: x.length + 1,
        points: 1,
      },
    ]);
  }

  // Remove individual question
  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  // Auto-generate questions
  function handleAutoGenerate() {
    let pool = qRows.filter((q) => !questions.some((existing) => existing.questionId === q.id));
    if (autoGenDifficulty !== 'all') {
      pool = pool.filter((q) => (q.difficulty || '').toLowerCase() === autoGenDifficulty.toLowerCase());
    }

    // Shuffle pool
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, autoGenCount);

    if (chosen.length === 0) {
      setError('لم يتم العثور على أسئلة تطابق معايير التوليد التلقائي.');
      return;
    }

    const newPlacements: AssessmentQuestionPlacement[] = chosen.map((q, idx) => ({
      questionId: q.id,
      questionVersion: q.currentVersion,
      sectionId: autoGenSectionId || (sections[0]?.id ?? ''),
      sortOrder: questions.length + idx + 1,
      points: 1,
    }));

    setQuestions((prev) => [...prev, ...newPlacements]);
    setShowAutoGenerate(false);
    setSuccessNotice(`تمت إضافة ${newPlacements.length} سؤال تلقائياً بنجاح.`);
  }

  // Generate standard Tahsili Qiyas Sections (4 sections x 25 min)
  function generateTahsiliSections() {
    const mathSubj = subjects.find((s) => s.code.includes('MATH') || s.name.includes('رياضيات'));
    const physSubj = subjects.find((s) => s.code.includes('PHYS') || s.name.includes('فيزياء'));
    const chemSubj = subjects.find((s) => s.code.includes('CHEM') || s.name.includes('كيمياء'));
    const bioSubj = subjects.find((s) => s.code.includes('BIO') || s.name.includes('أحياء') || s.name.includes('احياء'));

    const tahsiliSections: AssessmentSection[] = [
      {
        id: `sec_tah_math_${Date.now()}`,
        title: 'القسم الأول — الرياضيات',
        subjectId: mathSubj?.id || version.subjectId,
        sortOrder: 1,
        timeLimitSeconds: 1500, // 25 min
        domain: 'math',
        strictLock: true,
      },
      {
        id: `sec_tah_phys_${Date.now() + 1}`,
        title: 'القسم الثاني — الفيزياء',
        subjectId: physSubj?.id || version.subjectId,
        sortOrder: 2,
        timeLimitSeconds: 1500, // 25 min
        domain: 'physics',
        strictLock: true,
      },
      {
        id: `sec_tah_chem_${Date.now() + 2}`,
        title: 'القسم الثالث — الكيمياء',
        subjectId: chemSubj?.id || version.subjectId,
        sortOrder: 3,
        timeLimitSeconds: 1500, // 25 min
        domain: 'chemistry',
        strictLock: true,
      },
      {
        id: `sec_tah_bio_${Date.now() + 3}`,
        title: 'القسم الرابع — الأحياء',
        subjectId: bioSubj?.id || version.subjectId,
        sortOrder: 4,
        timeLimitSeconds: 1500, // 25 min
        domain: 'biology',
        strictLock: true,
      },
    ];

    setSections(tahsiliSections);
    setVersion((v) => ({
      ...v,
      kind: 'mock',
      mockCategory: 'tahsili',
      mockStrictSectionLock: true,
      timeLimitSeconds: 6000, // 100 min total
    }));
    setSuccessNotice('تم توليد أقسام محاكي التحصيلي القياسي (4 أقسام × 25 دقيقة) بنجاح.');
  }

  // Generate standard Qudrat Qiyas Sections (5 sections x 25 min)
  function generateQudratSections() {
    const quantSubj = subjects.find((s) => s.code.includes('QUANT') || s.name.includes('كمي'));
    const verbalSubj = subjects.find((s) => s.code.includes('VERBAL') || s.name.includes('لفظي'));

    const qudratSections: AssessmentSection[] = [
      {
        id: `sec_qud_1_${Date.now()}`,
        title: 'القسم الأول — كمي',
        subjectId: quantSubj?.id || version.subjectId,
        sortOrder: 1,
        timeLimitSeconds: 1500,
        domain: 'quantitative',
        strictLock: true,
      },
      {
        id: `sec_qud_2_${Date.now() + 1}`,
        title: 'القسم الثاني — لفظي',
        subjectId: verbalSubj?.id || version.subjectId,
        sortOrder: 2,
        timeLimitSeconds: 1500,
        domain: 'verbal',
        strictLock: true,
      },
      {
        id: `sec_qud_3_${Date.now() + 2}`,
        title: 'القسم الثالث — كمي',
        subjectId: quantSubj?.id || version.subjectId,
        sortOrder: 3,
        timeLimitSeconds: 1500,
        domain: 'quantitative',
        strictLock: true,
      },
      {
        id: `sec_qud_4_${Date.now() + 3}`,
        title: 'القسم الرابع — لفظي',
        subjectId: verbalSubj?.id || version.subjectId,
        sortOrder: 4,
        timeLimitSeconds: 1500,
        domain: 'verbal',
        strictLock: true,
      },
      {
        id: `sec_qud_5_${Date.now() + 4}`,
        title: 'القسم الخامس — كمي',
        subjectId: quantSubj?.id || version.subjectId,
        sortOrder: 5,
        timeLimitSeconds: 1500,
        domain: 'quantitative',
        strictLock: true,
      },
    ];

    setSections(qudratSections);
    setVersion((v) => ({
      ...v,
      kind: 'mock',
      mockCategory: 'qudrat',
      mockStrictSectionLock: true,
      timeLimitSeconds: 7500, // 125 min total
    }));
    setSuccessNotice('تم توليد أقسام محاكي القدرات القياسي (5 أقسام × 25 دقيقة) بنجاح.');
  }

  // Save handler
  async function save() {
    setSaving(true);
    setError('');
    setSuccessNotice('');
    try {
      const csrf = await p.getCsrfToken();
      const input = {
        expectedRevision: detail?.revision,
        code: code.trim(),
        ownerType: (detail?.ownerType || 'platform') as 'platform' | 'teacher' | 'school',
        ownerUserId: detail?.ownerUserId || '',
        ownerSchoolId: detail?.ownerSchoolId || '',
        assignedTeacherId: detail?.assignedTeacherId || '',
        isVisible,
        version: {
          ...version,
          timeLimitSeconds: version.timeLimitSeconds ? Number(version.timeLimitSeconds) : null,
        },
        sections,
        questions,
      };
      if (p.assessmentId) {
        await assessmentClient.update(p.assessmentId, input, csrf);
      } else {
        await assessmentClient.create(input, csrf);
      }
      p.onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر حفظ الاختبار');
    } finally {
      setSaving(false);
    }
  }

  async function workflow(status: AssessmentWorkflowStatus) {
    if (!p.assessmentId || !detail) return;
    try {
      const csrf = await p.getCsrfToken();
      await assessmentClient.workflow(p.assessmentId, detail.revision, status, '', csrf);
      p.onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحديث الحالة');
    }
  }

  async function publish() {
    if (!p.assessmentId || !detail) return;
    try {
      const csrf = await p.getCsrfToken();
      await assessmentClient.publication(p.assessmentId, detail.revision, !detail.isPublished, csrf);
      p.onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحديث النشر');
    }
  }

  if (loading) return <div className="p-10 text-center font-black">جاري تحميل منشئ الاختبار...</div>;

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-4">
      {/* Zoom Modal */}
      {zoomedImageUrl ? (
        <QuestionImageZoomModal imageUrl={zoomedImageUrl} onClose={() => setZoomedImageUrl(null)} />
      ) : null}

      {/* Header Bar */}
      <div data-testid="assessment-editor-header" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="العودة لمركز الاختبارات"
            onClick={p.onCancel}
            className="rounded-lg p-2 transition-colors hover:bg-gray-200"
          >
            <X size={20} className="text-gray-500" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">{p.assessmentId ? 'تعديل الاختبار' : 'إنشاء اختبار جديد'}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {detail && detail.workflowStatus !== 'approved' ? (
            <button
              onClick={() => void workflow('pending_review')}
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 font-bold text-amber-800 hover:bg-amber-100"
            >
              إرسال للمراجعة
            </button>
          ) : null}
          {p.isAdmin && detail?.workflowStatus === 'pending_review' ? (
            <button
              onClick={() => void workflow('approved')}
              className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white shadow-xs hover:bg-emerald-700"
            >
              اعتماد
            </button>
          ) : null}
          {p.isAdmin && detail?.workflowStatus === 'approved' ? (
            <button
              onClick={publish}
              className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white shadow-xs hover:bg-slate-800"
            >
              {detail.isPublished ? 'إلغاء النشر' : 'نشر الاختبار'}
            </button>
          ) : null}
          <button
            disabled={saving}
            onClick={save}
            className="rounded-xl bg-indigo-600 px-6 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ الاختبار'}
          </button>
        </div>
      </div>

      {/* Main Title & Kind Badge */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">
                {version.kind === 'mock' ? 'MOCK EXAM · محاكي قياس' : 'REGULAR EXAM · اختبار قياسي'}
              </span>
              {detail ? (
                <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {detail.code} · v{detail.currentVersion}
                </span>
              ) : null}
            </div>
            {p.assessmentId ? <p className="mt-2 text-lg font-black text-gray-800">{version.title || 'بدون عنوان'}</p> : null}
            <p className="mt-1 text-xs text-gray-500">
              منشئ الاختبارات الموحد — يدعم الاختبارات العادية، محاكيات قياس الصارمة بالأقسام، والتوليد الآلي للأسئلة.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex flex-wrap rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setVersion((v) => ({ ...v, kind: 'normal', normalMode: 'exam' }))}
              className={`rounded-xl px-4 py-2 text-xs font-black transition ${
                version.kind === 'normal'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              اختبار عادي (تقييم / تدريب)
            </button>
            <button
              type="button"
              onClick={() =>
                setVersion((v) => ({
                  ...v,
                  kind: 'mock',
                  mockStrictSectionLock: true,
                }))
              }
              className={`rounded-xl px-4 py-2 text-xs font-black transition ${
                version.kind === 'mock'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              محاكي قياس رسمي (أقسام ومؤقت)
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav aria-label="أقسام منشئ الاختبارات" className="flex flex-wrap border-t border-gray-200 bg-white px-2 sm:px-6">
          {([
            { id: 'info', label: 'المعلومات الأساسية', Icon: FileQuestion },
            { id: 'questions', label: 'الأسئلة', Icon: CheckCircle2 },
            { id: 'settings', label: 'الإعدادات', Icon: Settings },
            { id: 'access', label: 'الصلاحيات والنشر', Icon: Users },
            { id: 'sections', label: 'الأقسام والمؤقت', Icon: Layers },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-4 text-sm font-bold transition-colors ${
                activeTab === id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
      </section>

      {/* Notifications */}
      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-800">
          <AlertCircle size={18} /> {error}
        </div>
      ) : null}
      {successNotice ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">
          <CheckCircle2 size={18} /> {successNotice}
        </div>
      ) : null}

      {/* TAB 1: INFO */}
      {activeTab === 'info' ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-gray-900">بيانات وتصنيف الاختبار</h2>

            <div>
              <label className="block text-xs font-bold text-gray-700">كود الاختبار الفريد *</label>
              <input
                disabled={Boolean(p.assessmentId)}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="مثال: EXAM-TAH-PHYS-01 أو MOCK-QUD-01"
                className="mt-1 w-full rounded-xl border p-3 text-sm font-bold disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700">عنوان الاختبار *</label>
              <input
                value={version.title}
                onChange={(e) => setVersion((v) => ({ ...v, title: e.target.value }))}
                placeholder="مثال: الاختبار المحاكي الشامل للقدرات العامة — النموذج التجريبي 1"
                className="mt-1 w-full rounded-xl border p-3 text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700">الوصف والتعليمات</label>
              <textarea
                rows={3}
                value={version.description}
                onChange={(e) => setVersion((v) => ({ ...v, description: e.target.value }))}
                placeholder="تعليمات موجهة للطالب قبل بدء الاختبار..."
                className="mt-1 w-full rounded-xl border p-3 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700">المسار *</label>
                <select
                  aria-label="مسار الاختبار"
                  disabled={p.lockScope && Boolean(p.initialPathId)}
                  value={version.pathId}
                  onChange={(e) => setVersion((v) => ({ ...v, pathId: e.target.value, subjectId: '' }))}
                  className="mt-1 w-full rounded-xl border p-3 text-sm font-bold"
                >
                  <option value="">اختر المسار</option>
                  {p.taxonomy.paths.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700">المادة الأساسية *</label>
                <select
                  aria-label="مادة الاختبار"
                  disabled={p.lockScope && Boolean(p.initialSubjectId)}
                  value={version.subjectId}
                  onChange={(e) => setVersion((v) => ({ ...v, subjectId: e.target.value }))}
                  className="mt-1 w-full rounded-xl border p-3 text-sm font-bold"
                >
                  <option value="">اختر المادة</option>
                  {subjects.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-gray-900">نمط الاختبار</h2>

            {version.kind === 'normal' ? (
              <div>
                <label className="block text-xs font-bold text-gray-700">نمط الاختبار العادي</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVersion((v) => ({ ...v, normalMode: 'practice' }))}
                    className={`rounded-xl border p-3 text-right text-xs transition ${
                      version.normalMode === 'practice'
                        ? 'border-emerald-500 bg-emerald-50 font-bold text-emerald-900 ring-2 ring-emerald-400'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-black text-sm">وضع تدريب مرن</div>
                    <div className="text-gray-500 mt-1">بدون مؤقت تنازلي صارم، تظهر تلميحات الشرح المباشرة.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVersion((v) => ({ ...v, normalMode: 'exam' }))}
                    className={`rounded-xl border p-3 text-right text-xs transition ${
                      version.normalMode === 'exam'
                        ? 'border-amber-500 bg-amber-50 font-bold text-amber-900 ring-2 ring-amber-400'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-black text-sm">وضع اختبار رسمي</div>
                    <div className="text-gray-500 mt-1">يخضع لوقت محدد ولا تظهر الإجابات إلا بعد التسليم.</div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 text-xs font-medium text-indigo-950 space-y-2">
                <div className="flex items-center gap-2 font-black text-indigo-900">
                  <Award size={18} className="text-indigo-600" />
                  <span>طبيعة محاكي قياس الرسمي (Mock Exam)</span>
                </div>
                <p>
                  يتم تقسيم الاختبار إلى أقسام زمنية مستقلة مثل اختبارات قياس تماماً. لا يتم احتساب الاختبار مكتملاً إلا
                  بعد إنهاء جميع الأقسام بالتتابع.
                </p>
                <div className="flex items-center gap-2 pt-1 font-bold text-indigo-700">
                  <Lock size={15} /> قفل الأقسام الصارم مفعّل تلقائياً لمنع العودة لقسم سابق.
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTab('sections')}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black text-white hover:bg-slate-800"
              >
                الانتقال للخطوة 2: الأقسام والمؤقت <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === 'access' ? (
        <section className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800">الصلاحيات والنشر</h2>
          <div>
            <label htmlFor="assessment-access-type" className="mb-2 block text-sm font-bold text-gray-700">نوع الوصول</label>
            <select
              id="assessment-access-type"
              aria-label="سياسة وصول الاختبار"
              value={version.accessType}
              disabled={detail?.workflowStatus === 'approved' || detail?.workflowStatus === 'archived'}
              onChange={(e) => setVersion((v) => ({ ...v, accessType: e.target.value as AssessmentVersion['accessType'] }))}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 disabled:bg-gray-100"
            >
              <option value="free">مجاني للجميع</option>
              <option value="paid">ضمن باقة / يحتاج تفعيل</option>
              <option value="private">خاص وموجه</option>
              <option value="course_only">داخل الدورات فقط</option>
            </select>
            {version.accessType === 'private' ? <p className="mt-2 text-xs text-gray-600">لا يتاح الوصول المباشر لهذا الاختبار؛ يحتاج الطالب إلى تعيين موجه.</p> : null}
            {version.accessType === 'course_only' ? <p className="mt-2 text-xs text-gray-600">يفتح من موضع مرتبط بدورة مع تحقق صلاحية الوصول للدورة.</p> : null}
          </div>
          <label className="flex items-center gap-3 border-t border-gray-100 pt-4 text-sm font-bold text-gray-800">
            <input
              type="checkbox"
              checked={isVisible}
              disabled={detail?.workflowStatus === 'approved' || detail?.workflowStatus === 'archived'}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="h-4 w-4 accent-indigo-600"
            />
            إظهار الاختبار للطلاب
          </label>
          <p className="text-xs text-gray-600">تُحفظ إعدادات الظهور والوصول مع الاختبار؛ يلزم اعتماد الاختبار ونشره قبل إتاحته.</p>
          {detail?.workflowStatus === 'approved' || detail?.workflowStatus === 'archived' ? (
            <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">لا يمكن تعديل هذه الإعدادات بالحفظ العادي بعد اعتماد الاختبار أو أرشفته.</p>
          ) : null}
        </section>
      ) : null}

      {/* TAB 2: SECTIONS & QIYAS BUILDER */}
      {activeTab === 'sections' ? (
        <section className="space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-lg font-black text-gray-900">أقسام الاختبار والمؤقت الزمني</h2>
              <p className="text-xs text-gray-500 mt-1">
                يمكن تشغيل الاختبار كقسم واحد موحد، أو تقسيمه إلى عدة أقسام مستقلة بمؤقت زمني لكل قسم (كما في قياس).
              </p>
            </div>

            {/* One-Click Qiyas Templates */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={generateTahsiliSections}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100 shadow-2xs"
              >
                <Sparkles size={16} /> توليد أقسام محاكي التحصيلي (4 أقسام)
              </button>
              <button
                type="button"
                onClick={generateQudratSections}
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-xs font-black text-violet-700 hover:bg-violet-100 shadow-2xs"
              >
                <Sparkles size={16} /> توليد أقسام محاكي القدرات (5 أقسام)
              </button>
              <button
                type="button"
                onClick={() =>
                  setSections((s) => [
                    ...s,
                    {
                      id: `sec_${Date.now()}`,
                      title: `القسم ${s.length + 1}`,
                      subjectId: version.subjectId,
                      sortOrder: s.length + 1,
                      timeLimitSeconds: 1500, // 25 min default
                      domain: 'general',
                      strictLock: version.kind === 'mock',
                    },
                  ])
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-black text-white hover:bg-slate-800"
              >
                <Plus size={16} /> إضافة قسم مخصص
              </button>
            </div>
          </div>

          {/* Sections List */}
          {sections.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-gray-500">
              لا توجد أقسام مخصصة حالياً. سيعامل الاختبار كقسم عام واحد خاضع للوقت الكلي. يمكنك الضغط على أحد أزرار
              التوليد التلقائي لقياس أعلاه لإنشاء الأقسام فوراً.
            </div>
          ) : (
            <div className="space-y-3">
              {sections.map((sec, idx) => (
                <div
                  key={sec.id || idx}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition hover:bg-slate-50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 font-black text-xs text-white">
                        {idx + 1}
                      </span>
                      <input
                        value={sec.title}
                        onChange={(e) =>
                          setSections((all) =>
                            all.map((item, j) => (j === idx ? { ...item, title: e.target.value } : item))
                          )
                        }
                        placeholder="عنوان القسم..."
                        className="rounded-xl border bg-white px-3 py-1.5 text-sm font-bold min-w-56"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Subject selector for section */}
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-500 font-bold">المادة:</span>
                        <select
                          value={sec.subjectId}
                          onChange={(e) =>
                            setSections((all) =>
                              all.map((item, j) => (j === idx ? { ...item, subjectId: e.target.value } : item))
                            )
                          }
                          className="rounded-xl border bg-white px-2 py-1 text-xs font-bold"
                        >
                          <option value="">عام / مادة الاختبار</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Time limit in minutes */}
                      <div className="flex items-center gap-1 text-xs">
                        <Clock size={15} className="text-gray-400" />
                        <span className="text-gray-500 font-bold">الوقت (بالدقائق):</span>
                        <input
                          type="number"
                          min={1}
                          max={180}
                          value={Math.round((sec.timeLimitSeconds || 1500) / 60)}
                          onChange={(e) =>
                            setSections((all) =>
                              all.map((item, j) =>
                                j === idx
                                  ? { ...item, timeLimitSeconds: Number(e.target.value) * 60 }
                                  : item
                              )
                            )
                          }
                          className="w-16 rounded-xl border bg-white px-2 py-1 text-center font-bold"
                        />
                      </div>

                      {/* Strict lock checkbox */}
                      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sec.strictLock}
                          onChange={(e) =>
                            setSections((all) =>
                              all.map((item, j) => (j === idx ? { ...item, strictLock: e.target.checked } : item))
                            )
                          }
                          className="rounded text-indigo-600"
                        />
                        <span>قفل صارم</span>
                      </label>

                      {/* Delete section */}
                      <button
                        type="button"
                        aria-label={`حذف القسم ${idx + 1}`}
                        onClick={() => setSections((all) => all.filter((_, j) => j !== idx))}
                        className="rounded-xl p-1.5 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-gray-400 font-medium">
                    الأسئلة المسندة لهذا القسم:{' '}
                    <span className="font-bold text-gray-700">
                      {questions.filter((q) => q.sectionId === sec.id).length} سؤال
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 flex justify-between border-t">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className="rounded-xl border px-4 py-2 text-xs font-bold text-gray-700"
            >
              السابق
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('questions')}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black text-white hover:bg-slate-800"
            >
              الانتقال للخطوة 3: انتقاء وتوليد الأسئلة <ArrowRight size={16} />
            </button>
          </div>
        </section>
      ) : null}

      {/* TAB 3: QUESTIONS PICKER & AUTO-GENERATOR */}
      {activeTab === 'questions' ? (
        <section className="space-y-4">
          {/* Top Bar for Questions with Auto Generate Button */}
          <div className="rounded-3xl border bg-white p-5 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-900">بنك الأسئلة وانتقاء أسئلة الاختبار</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                إجمالي الأسئلة في الاختبار حالياً:{' '}
                <span className="font-black text-indigo-700 text-sm">{questions.length} سؤال</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAutoGenerate((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:from-indigo-700 hover:to-violet-700"
            >
              <Sparkles size={16} /> التوليد التلقائي للأسئلة من البنك
            </button>
          </div>

          {/* Auto-Generation Drawer/Box */}
          {showAutoGenerate ? (
            <div className="rounded-3xl border border-indigo-200 bg-indigo-50/70 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-indigo-950 text-sm">
                  <Sparkles size={18} className="text-indigo-600" />
                  <span>معايير التوليد التلقائي للأسئلة</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAutoGenerate(false)}
                  className="text-xs font-bold text-gray-500 hover:text-gray-800"
                >
                  إغلاق
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">عدد الأسئلة المطلوب</label>
                  <select
                    value={autoGenCount}
                    onChange={(e) => setAutoGenCount(Number(e.target.value))}
                    className="w-full rounded-xl border bg-white p-2.5 text-xs font-bold"
                  >
                    <option value={10}>10 أسئلة</option>
                    <option value={20}>20 سؤالاً</option>
                    <option value={25}>25 سؤالاً (قسم قياس كامل)</option>
                    <option value={40}>40 سؤالاً</option>
                    <option value={50}>50 سؤالاً</option>
                    <option value={100}>100 سؤال (محاكي كامل)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">مستوى الصعوبة</label>
                  <select
                    value={autoGenDifficulty}
                    onChange={(e) => setAutoGenDifficulty(e.target.value)}
                    className="w-full rounded-xl border bg-white p-2.5 text-xs font-bold"
                  >
                    <option value="all">كل المستويات (توزيع متوازن)</option>
                    <option value="Easy">سهل فقط</option>
                    <option value="Medium">متوسط فقط</option>
                    <option value="Hard">صعب وتحدي</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">تعيين للقسم</label>
                  <select
                    value={autoGenSectionId}
                    onChange={(e) => setAutoGenSectionId(e.target.value)}
                    className="w-full rounded-xl border bg-white p-2.5 text-xs font-bold"
                  >
                    <option value="">بدون قسم / عام</option>
                    {sections.map((s, idx) => (
                      <option key={s.id || idx} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleAutoGenerate}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white hover:bg-indigo-700 shadow-xs"
                >
                  <Sparkles size={15} /> بدء التوليد والإضافة الآن
                </button>
              </div>
            </div>
          ) : null}

          {/* Dual Panel: Picker on Left, Added on Right */}
          <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            {/* Bank Questions Picker */}
            <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-gray-900 text-sm">البحث في بنك الأسئلة المعتمد</h3>
                <span className="text-xs font-bold text-gray-400">{qRows.length} سؤال متاح</span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="relative">
                  <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
                  <input
                    aria-label="بحث بنك الأسئلة"
                    value={qSearch}
                    onChange={(e) => setQSearch(e.target.value)}
                    placeholder="ابحث بالكود أو نص المسألة..."
                    className="w-full rounded-xl border py-2 pr-9 pl-3 text-xs"
                  />
                </div>
                <select
                  value={qDifficulty}
                  onChange={(e) => setQDifficulty(e.target.value)}
                  className="rounded-xl border p-2 text-xs font-bold"
                >
                  <option value="all">كل الصعوبات</option>
                  <option value="Easy">Easy (سهل)</option>
                  <option value="Medium">Medium (متوسط)</option>
                  <option value="Hard">Hard (صعب)</option>
                </select>
              </div>

              <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
                {qRows.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-400">
                    لا توجد أسئلة مطابقة للبحث في هذا المسار والمادة.
                  </div>
                ) : (
                  qRows.map((q) => {
                    const isAdded = questions.some((x) => x.questionId === q.id);
                    return (
                      <article
                        key={q.id}
                        className={`rounded-2xl border p-3.5 transition ${
                          isAdded ? 'border-emerald-200 bg-emerald-50/40 opacity-70' : 'bg-white hover:border-indigo-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-xs text-gray-900">{q.questionCode}</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                              {q.difficulty || 'Medium'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {q.imageUrl ? (
                              <button
                                type="button"
                                onClick={() => setZoomedImageUrl(q.imageUrl || null)}
                                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/80 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                              >
                                <ZoomIn size={13} /> تكبير
                              </button>
                            ) : null}

                            <button
                              type="button"
                              disabled={isAdded}
                              onClick={() => addQuestion(q)}
                              className={`rounded-xl px-3 py-1 text-xs font-black transition ${
                                isAdded
                                  ? 'bg-emerald-600 text-white cursor-default'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs'
                              }`}
                            >
                              {isAdded ? '✓ مضاف' : '+ إضافة للاختبار'}
                            </button>
                          </div>
                        </div>

                        {/* Image preview thumbnail */}
                        {q.imageUrl ? (
                          <div className="mt-2 w-full max-w-[280px] overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-1">
                            <img
                              src={q.imageUrl}
                              alt={q.questionCode}
                              className="max-h-24 w-full object-contain rounded cursor-pointer hover:scale-[1.02] transition-transform"
                              onClick={() => setZoomedImageUrl(q.imageUrl || null)}
                            />
                          </div>
                        ) : null}

                        {q.text ? (
                          <p className="mt-1.5 text-xs text-gray-600 line-clamp-2 leading-relaxed">{q.text}</p>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </div>
            </div>

            {/* Added Questions List */}
            <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-gray-900 text-sm">الأسئلة المختارة للاختبار</h3>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-black text-indigo-700">
                  {questions.length} سؤال
                </span>
              </div>

              <div className="max-h-[560px] space-y-2.5 overflow-y-auto pr-1">
                {questions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-400">
                    لم تتم إضافة أسئلة للاختبار بعد. اختر أسئلة من اللوحة اليمنى أو استخدم التوليد التلقائي.
                  </div>
                ) : (
                  questions.map((q, idx) => {
                    const meta = qRows.find((item) => item.id === q.questionId);
                    return (
                      <div
                        key={q.questionId}
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800 text-xs font-black text-white">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-black text-xs text-gray-900 truncate">
                              {meta?.questionCode || q.questionId}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              الإصدار v{q.questionVersion}
                              {meta?.imageUrl ? ' · يحتوي صورة' : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Section assignment if sections exist */}
                          {sections.length > 0 ? (
                            <select
                              aria-label={`قسم السؤال ${idx + 1}`}
                              value={q.sectionId}
                              onChange={(e) =>
                                setQuestions((all) =>
                                  all.map((item, j) => (j === idx ? { ...item, sectionId: e.target.value } : item))
                                )
                              }
                              className="rounded-lg border bg-white px-2 py-1 text-[11px] font-bold"
                            >
                              <option value="">بدون قسم</option>
                              {sections.map((s, sIdx) => (
                                <option key={s.id || sIdx} value={s.id}>
                                  {s.title}
                                </option>
                              ))}
                            </select>
                          ) : null}

                          {/* Points */}
                          <div className="flex items-center gap-1 text-[11px]">
                            <span className="text-gray-400">درجة:</span>
                            <input
                              aria-label={`درجة السؤال ${idx + 1}`}
                              type="number"
                              min={0.1}
                              step={0.5}
                              value={q.points}
                              onChange={(e) =>
                                setQuestions((all) =>
                                  all.map((item, j) => (j === idx ? { ...item, points: Number(e.target.value) } : item))
                                )
                              }
                              className="w-12 rounded-lg border bg-white p-1 text-center font-bold"
                            />
                          </div>

                          {/* Remove button */}
                          <button
                            type="button"
                            aria-label={`حذف السؤال ${idx + 1}`}
                            onClick={() => removeQuestion(idx)}
                            className="rounded-lg p-1 text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          <div className="pt-4 flex justify-between border-t">
            <button
              type="button"
              onClick={() => setActiveTab('sections')}
              className="rounded-xl border px-4 py-2 text-xs font-bold text-gray-700"
            >
              السابق
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black text-white hover:bg-slate-800"
            >
              الانتقال للخطوة 4: الإعدادات والسياسات <ArrowRight size={16} />
            </button>
          </div>
        </section>
      ) : null}

      {/* TAB 4: SETTINGS & POLICIES */}
      {activeTab === 'settings' ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {/* Timing & Scoring */}
          <div className="space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-gray-900">الوقت والدرجات</h2>

            <div>
              <label className="block text-xs font-bold text-gray-700">الوقت الإجمالي للاختبار (بالدقائق)</label>
              <input
                type="number"
                min={5}
                max={300}
                value={Math.round((version.timeLimitSeconds || 3600) / 60)}
                onChange={(e) =>
                  setVersion((v) => ({ ...v, timeLimitSeconds: Number(e.target.value) * 60 }))
                }
                className="mt-1 w-full rounded-xl border p-3 text-sm font-bold"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                في الاختبارات المحاكية ذات الأقسام المستقلة، يُحسب الوقت الإجمالي من مجموع أوقات الأقسام.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700">درجة النجاح (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={version.passingScore}
                  onChange={(e) => setVersion((v) => ({ ...v, passingScore: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-xl border p-3 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700">الحد الأقصى للمحاولات</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={version.maxAttempts}
                  onChange={(e) => setVersion((v) => ({ ...v, maxAttempts: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-xl border p-3 text-sm font-bold"
                />
              </div>
            </div>
          </div>

          {/* Question Behavior & Display Policies */}
          <div className="space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-gray-900">سلوك الأسئلة وعرض النتائج</h2>

            <div className="space-y-3 pt-1">
              <label className="flex items-center justify-between rounded-2xl border p-3 text-xs font-bold text-gray-800 cursor-pointer hover:bg-gray-50">
                <span>ترتيب عشوائي للأسئلة في كل محاولة (Shuffle Questions)</span>
                <input
                  type="checkbox"
                  checked={version.randomizeQuestions}
                  onChange={(e) => setVersion((v) => ({ ...v, randomizeQuestions: e.target.checked }))}
                  className="h-4 w-4 rounded text-indigo-600"
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border p-3 text-xs font-bold text-gray-800 cursor-pointer hover:bg-gray-50">
                <span>ترتيب عشوائي للخيارات (Shuffle Options)</span>
                <input
                  type="checkbox"
                  checked={version.randomizeOptions}
                  onChange={(e) => setVersion((v) => ({ ...v, randomizeOptions: e.target.checked }))}
                  className="h-4 w-4 rounded text-indigo-600"
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border p-3 text-xs font-bold text-gray-800 cursor-pointer hover:bg-gray-50">
                <span>إظهار التفسيرات والشروحات بعد انتهاء الاختبار</span>
                <input
                  type="checkbox"
                  checked={version.showExplanations}
                  onChange={(e) => setVersion((v) => ({ ...v, showExplanations: e.target.checked }))}
                  className="h-4 w-4 rounded text-indigo-600"
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border p-3 text-xs font-bold text-gray-800 cursor-pointer hover:bg-gray-50">
                <span>إظهار تقرير النتيجة والتفاصيل للطالب فوراً</span>
                <input
                  type="checkbox"
                  checked={version.showResultsReport}
                  onChange={(e) => setVersion((v) => ({ ...v, showResultsReport: e.target.checked }))}
                  className="h-4 w-4 rounded text-indigo-600"
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border p-3 text-xs font-bold text-gray-800 cursor-pointer hover:bg-gray-50">
                <span>السماح بمراجعة الأسئلة وتحديدها للمراجعة (Flag for Review)</span>
                <input
                  type="checkbox"
                  checked={version.allowQuestionReview}
                  onChange={(e) => setVersion((v) => ({ ...v, allowQuestionReview: e.target.checked }))}
                  className="h-4 w-4 rounded text-indigo-600"
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border p-3 text-xs font-bold text-gray-800 cursor-pointer hover:bg-gray-50">
                <span>إلزام الطالب بالإجابة قبل الانتقال للسؤال التالي</span>
                <input
                  type="checkbox"
                  checked={version.requireAnswerBeforeNext}
                  onChange={(e) => setVersion((v) => ({ ...v, requireAnswerBeforeNext: e.target.checked }))}
                  className="h-4 w-4 rounded text-indigo-600"
                />
              </label>
            </div>

            <div className="pt-4 flex justify-between border-t">
              <button
                type="button"
                onClick={() => setActiveTab('questions')}
                className="rounded-xl border px-4 py-2 text-xs font-bold text-gray-700"
              >
                السابق
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-black text-slate-950 shadow-xs hover:bg-amber-400 disabled:opacity-50"
              >
                {saving ? 'جاري الحفظ...' : 'حفظ ونشر الاختبار الآن'}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
