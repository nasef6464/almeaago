import {
  AlertCircle,
  Archive,
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Edit2,
  ExternalLink,
  Eye,
  FileImage,
  Filter,
  HelpCircle,
  ImagePlus,
  ImageUp,
  Loader2,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  UploadCloud,
  Video,
  Volume2,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import type { TaxonomyFull } from '../../content/api/content-types';
import { QuestionAssetImage } from '../../learning/components/QuestionAssetImage';
import { QuestionPresentationEditor } from '../components/QuestionPresentationEditor';
import { QuestionImageZoomModal } from '../../assessment/components/QuestionImageZoomModal';
import {
  questionBankClient,
  type ImportResult,
  type MediaAsset,
  type QuestionCreateWrite,
  type QuestionDetail,
  type QuestionFilters,
  type QuestionSummary,
  type QuestionType,
  type QuestionWorkflowStatus,
} from '../api/questionbank-client';

const EMPTY_TAXONOMY: TaxonomyFull = { paths: [], subjects: [], skills: [] };
const statusLabel: Record<QuestionWorkflowStatus, string> = {
  draft: 'مسودة',
  pending_review: 'بانتظار المراجعة',
  approved: 'معتمد',
  rejected: 'مرفوض',
  archived: 'مؤرشف',
};
const typeLabel: Record<QuestionType, string> = {
  mcq: 'اختيار من متعدد',
  true_false: 'صح / خطأ',
  essay: 'مقالي',
};

export function resolveQuestionMedia(text?: string, imageUrl?: string): { displayText: string; resolvedImage: string } {
  let img = imageUrl?.trim() || '';
  let txt = text?.trim() || '';

  if (!img && txt) {
    if (/^image:/i.test(txt)) {
      img = txt.replace(/^image:/i, '').trim();
      txt = '';
    } else if (/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(txt)) {
      img = txt;
      txt = '';
    } else {
      const imgMatch = txt.match(/<img\s+[^>]*src=["']([^"']+)["']/i);
      if (imgMatch) {
        img = imgMatch[1];
      } else {
        const mdMatch = txt.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/i);
        if (mdMatch) {
          img = mdMatch[1];
        }
      }
    }
  }
  return { displayText: txt, resolvedImage: img };
}

export function QuestionBankAdminPage() {
  const [searchParams] = useSearchParams();
  const selectedSkillId = searchParams.get('skillId')?.trim() || '';
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const isAdmin = Boolean(user?.role === 'admin' || user?.roles?.includes('admin'));
  const isTeacher = Boolean(user?.role === 'teacher' || user?.roles?.includes('teacher') || isAdmin);
  const [taxonomy, setTaxonomy] = useState<TaxonomyFull>(EMPTY_TAXONOMY);
  const [filters, setFilters] = useState<QuestionFilters>({
    page: 1,
    limit: 50,
    search: '',
    pathId: '',
    subjectId: '',
    mainSkillId: '',
    linked: '',
    difficulty: '',
    type: '',
    workflowStatus: '',
    withVideo: '',
    withExplanation: '',
  });
  const [rows, setRows] = useState<QuestionSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [coverage, setCoverage] = useState({
    questionsTotal: 0,
    approved: 0,
    pendingReview: 0,
    unlinked: 0,
    mainSkillCoverage: 0,
    subSkillCoverage: 0,
  });
  const [busy, setBusy] = useState(true);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [detail, setDetail] = useState<QuestionDetail | null>(null);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [imageOnlyFilter, setImageOnlyFilter] = useState<'all' | 'with_image' | 'without_image'>('all');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(() => new Set());

  const displayedRows = useMemo(() => {
    if (imageOnlyFilter === 'all') return rows;
    return rows.filter((r) => {
      const media = resolveQuestionMedia(r.text, r.imageUrl);
      const hasImg = Boolean(media.resolvedImage || r.imageAssetId || r.hasImage);
      return imageOnlyFilter === 'with_image' ? hasImg : !hasImg;
    });
  }, [rows, imageOnlyFilter]);
  const [showCreate, setShowCreate] = useState(false);
  const [create, setCreate] = useState({
    questionCode: '',
    pathId: '',
    subjectId: '',
    type: 'mcq' as QuestionType,
    text: '',
    difficulty: 'Medium',
    examType: '',
    source: 'manual',
    explanation: '',
    hint: '',
    solvingStrategy: '',
    videoUrl: '',
    imageAssetId: '',
    imageAlt: '',
    optionsEmbeddedInImage: false,
    questionNumber: '',
    showQuestionNumber: true,
    showOptionLabels: true,
    showOptionText: true,
    optionLabelStyle: 'arabic' as 'arabic' | 'latin',
    optionLabels: ['', '', '', ''],
    passage: '',
    showPassage: false,
    showAiContext: false,
    showVoiceExplanation: false,
    aiReadableText: '',
    aiSpeechText: '',
    aiVisualDescription: '',
    voiceNotes: '',
    mainSkillId: '',
    subSkillId: '',
    correctOptionIndex: 0,
    options: ['', '', '', ''],
  });

  function autoGenerateCode() {
    const code = `Q-${Date.now().toString().slice(-6)}`;
    setCreate((prev) => ({ ...prev, questionCode: code }));
  }
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaAsset, setMediaAsset] = useState<MediaAsset | null>(null);
  const [importBatchId, setImportBatchId] = useState('');
  const [importText, setImportText] = useState('[]');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importDryRunPassed, setImportDryRunPassed] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    contentClient
      .taxonomyFull(c.signal)
      .then(setTaxonomy)
      .catch((e) => {
        if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'تعذر تحميل بيانات التصنيف');
      });
    return () => c.abort();
  }, []);

  const subjects = useMemo(
    () => taxonomy.subjects.filter((s) => !filters.pathId || s.pathId === filters.pathId),
    [taxonomy, filters.pathId]
  );
  const skills = useMemo(() => {
    if (!filters.subjectId) return taxonomy.skills;
    return taxonomy.skills.filter((s) => s.subjectId === filters.subjectId);
  }, [taxonomy, filters.subjectId]);

  const selectedSkillName = useMemo(() => {
    if (!selectedSkillId) return '';
    return taxonomy.skills.find((s) => s.id === selectedSkillId)?.name || '';
  }, [taxonomy.skills, selectedSkillId]);

  const createSubjects = useMemo(
    () => taxonomy.subjects.filter((s) => !create.pathId || s.pathId === create.pathId),
    [taxonomy, create.pathId]
  );
  const createMainSkills = useMemo(
    () => taxonomy.skills.filter((s) => s.subjectId === create.subjectId && (s.kind === 'main' || !s.parentSkillId)),
    [taxonomy, create.subjectId]
  );
  const createSubSkills = useMemo(
    () =>
      taxonomy.skills.filter((s) => {
        if (s.subjectId !== create.subjectId) return false;
        if (!create.mainSkillId) return s.kind === 'sub' || Boolean(s.parentSkillId);
        return s.parentSkillId === create.mainSkillId;
      }),
    [taxonomy, create.subjectId, create.mainSkillId]
  );

  useEffect(() => {
    if (authLoading || (!isAdmin && !isTeacher)) return;
    const c = new AbortController();
    setBusy(true);
    setError('');
    const effectiveFilters: QuestionFilters = {
      ...filters,
      skillIds: selectedSkillId ? [selectedSkillId] : filters.skillIds,
    };
    Promise.all([
      questionBankClient.list(effectiveFilters, c.signal),
      questionBankClient.coverage(effectiveFilters, c.signal),
    ])
      .then(async ([page, cov]) => {
        setHasMore(page.hasMore);
        setCoverage({
          questionsTotal: cov.questionsTotal,
          approved: cov.approved,
          pendingReview: cov.pendingReview,
          unlinked: cov.unlinked,
          mainSkillCoverage: cov.mainSkillCoverage,
          subSkillCoverage: cov.subSkillCoverage,
        });

        const needsHydration = page.items.length > 0 && page.items.some((r) => ((!r.text || !r.text.trim()) && !r.imageUrl) || !r.options);
        setRows(page.items);

        if (needsHydration && !c.signal.aborted) {
          const hydratedItems = [...page.items];
          const batchSize = 10;
          for (let i = 0; i < hydratedItems.length; i += batchSize) {
            if (c.signal.aborted) return;
            const chunk = hydratedItems.slice(i, i + batchSize);
            await Promise.all(
              chunk.map(async (item, idx) => {
                try {
                  const detail = await questionBankClient.get(item.id, c.signal);
                  if (detail.question?.version) {
                    hydratedItems[i + idx] = {
                      ...item,
                      text: detail.question.version.text || item.text,
                      imageAssetId: detail.question.version.imageAssetId || item.imageAssetId,
                      imageUrl: detail.question.version.imageUrl || item.imageUrl,
                      optionsEmbeddedInImage: detail.question.version.optionsEmbeddedInImage,
                      options: detail.question.options || item.options,
                    };
                  }
                } catch {
                  // ignore detail fetch errors
                }
              }),
            );
            if (!c.signal.aborted) {
              setRows([...hydratedItems]);
            }
          }
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'تعذر تحميل بنك الأسئلة');
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
    return () => c.abort();
  }, [authLoading, filters, isAdmin, isTeacher, reload, selectedSkillId]);

  async function run<T>(tag: string, action: (csrf: string) => Promise<T>, success?: string): Promise<T | null> {
    setPending(tag);
    setError('');
    try {
      const csrf = await getCsrfToken();
      const result = await action(csrf);
      if (success) setNotice(success);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ غير متوقع');
      return null;
    } finally {
      setPending('');
    }
  }

  async function openQuestion(id: string) {
    setPending('detail-' + id);
    setError('');
    try {
      const r = await questionBankClient.get(id);
      setDetail(r.question);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل تفاصيل السؤال');
    } finally {
      setPending('');
    }
  }

  async function workflow(nextStatus: QuestionWorkflowStatus, targetId?: string) {
    const qId = targetId || detail?.id;
    if (!qId) return;
    const targetRow = targetId ? rows.find((r) => r.id === targetId) : detail;
    const version = targetRow ? targetRow.currentVersion : 1;
    await run('workflow-' + qId, async (csrf) => {
      let curVer = version;
      if (
        nextStatus === 'approved' &&
        targetRow &&
        (targetRow.workflowStatus === 'draft' || targetRow.workflowStatus === 'rejected')
      ) {
        const pr = await questionBankClient.workflow(qId, curVer, 'pending_review', 'تقديم للمراجعة للاعتماد', csrf);
        curVer = pr.question.currentVersion;
      }
      const res = await questionBankClient.workflow(qId, curVer, nextStatus, '', csrf);
      if (detail && detail.id === qId) setDetail(res.question);
      setRows((prev) =>
        prev.map((r) =>
          r.id === qId
            ? { ...r, workflowStatus: res.question.workflowStatus, currentVersion: res.question.currentVersion }
            : r
        )
      );
      setNotice(
        nextStatus === 'approved'
          ? 'تم اعتماد السؤال بنجاح'
          : nextStatus === 'rejected'
            ? 'تم رفض السؤال'
            : nextStatus === 'archived'
              ? 'تم أرشفة/حذف السؤال بنجاح'
              : 'تم تحديث حالة السؤال'
      );
      setReload((x) => x + 1);
    });
  }

  async function duplicateQuestion(row: QuestionSummary) {
    await run('duplicate-' + row.id, async (csrf) => {
      const full = await questionBankClient.get(row.id);
      const q = full.question;
      const v = q.version;
      const baseCode = row.questionCode.replace(/_COPY_\d+$/i, '');
      const newCode = `${baseCode}_COPY_${Date.now().toString().slice(-4)}`;
      const baseText = v.text || row.text || 'سؤال مكرر';
      const newText = baseText.includes('(نسخة)') ? baseText : `${baseText} (نسخة)`;

      const pathId = q.pathId || row.pathId || taxonomy.paths[0]?.id || 'general';
      const subjectId = q.subjectId || row.subjectId || taxonomy.subjects[0]?.id || 'general';

      let options = (q.options || []).map((o) => ({
        text: o.text || '',
        assetId: o.assetId || '',
      }));
      if (options.length < 2 && (v.type === 'mcq' || !v.type || v.type === 'true_false')) {
        options = [
          { text: 'أ', assetId: '' },
          { text: 'ب', assetId: '' },
          { text: 'ج', assetId: '' },
          { text: 'د', assetId: '' },
        ];
      }

      const correctOptionIndex =
        v.correctOptionIndex != null && v.correctOptionIndex >= 0 && v.correctOptionIndex < options.length
          ? v.correctOptionIndex
          : 0;

      let links: Array<{ skillId: string; relationType: 'main' | 'sub' | 'secondary' }> = [];
      const sourceLinks = q.skillLinks || [];
      const existingMain = sourceLinks.find((l) => l.relationType === 'main');
      if (existingMain) {
        links.push({ skillId: existingMain.skillId, relationType: 'main' });
        for (const l of sourceLinks) {
          if (l.skillId !== existingMain.skillId) {
            links.push({ skillId: l.skillId, relationType: l.relationType || 'sub' });
          }
        }
      } else {
        const subId = sourceLinks[0]?.skillId || row.mainSkillId || row.skillIds?.[0] || '';
        const subSkill = taxonomy.skills.find((s) => s.id === subId);
        if (subSkill?.parentSkillId) {
          links.push({ skillId: subSkill.parentSkillId, relationType: 'main' });
          links.push({ skillId: subSkill.id, relationType: 'sub' });
        } else if (subSkill?.kind === 'main') {
          links.push({ skillId: subSkill.id, relationType: 'main' });
        } else {
          const subjectMain = taxonomy.skills.find(
            (s) => s.subjectId === subjectId && s.kind === 'main'
          );
          if (subjectMain) {
            links.push({ skillId: subjectMain.id, relationType: 'main' });
            if (subSkill && subSkill.parentSkillId === subjectMain.id) {
              links.push({ skillId: subSkill.id, relationType: 'sub' });
            }
          }
        }
      }

      const payload: QuestionCreateWrite = {
        questionCode: newCode,
        ownerType: 'platform',
        ownerId: '',
        assignedTeacherId: '',
        version: {
          pathId,
          subjectId,
          type: v.type || row.type || 'mcq',
          text: newText,
          imageAssetId: v.imageAssetId || '',
          imageAlt: v.imageAlt || '',
          optionsEmbeddedInImage: Boolean(v.optionsEmbeddedInImage),
          correctOptionIndex,
          explanation: v.explanation || '',
          hint: v.hint || '',
          solvingStrategy: v.solvingStrategy || '',
          videoUrl: v.videoUrl || '',
          sourceMeta: (v.sourceMeta as Record<string, unknown>) || {},
          aiContext: (v.aiContext as Record<string, unknown>) || {},
          voiceExplanation: (v.voiceExplanation as Record<string, unknown>) || {},
          difficulty: v.difficulty || row.difficulty || 'medium',
          examType: v.examType || '',
          source: v.source || '',
          year: v.year ?? null,
          revisionNote: `نسخة مكررة من ${row.questionCode}`,
          options,
          skillLinks: links,
        },
      };

      const res = await questionBankClient.create(payload, csrf);
      const mainLink = links.find((l) => l.relationType === 'main');
      const newSummary: QuestionSummary = {
        id: res.question.id,
        questionCode: res.question.questionCode,
        currentVersion: res.question.currentVersion,
        workflowStatus: res.question.workflowStatus,
        ownerType: res.question.ownerType,
        ownerId: res.question.ownerId,
        pathId: res.question.pathId,
        subjectId: res.question.subjectId,
        assignedTeacherId: res.question.assignedTeacherId,
        type: res.question.version.type,
        difficulty: res.question.version.difficulty,
        examType: res.question.version.examType,
        source: res.question.version.source,
        year: res.question.version.year,
        hasImage: Boolean(res.question.version.imageAssetId || res.question.version.imageUrl),
        hasVideo: Boolean(res.question.version.videoUrl),
        hasExplanation: Boolean(res.question.version.explanation),
        text: res.question.version.text,
        imageUrl: res.question.version.imageUrl,
        imageAssetId: res.question.version.imageAssetId,
        optionsEmbeddedInImage: res.question.version.optionsEmbeddedInImage,
        mainSkillId: mainLink ? mainLink.skillId : '',
        skillIds: links.map((l) => l.skillId),
        updatedAt: new Date().toISOString(),
      };
      setRows((prev) => [newSummary, ...prev]);
      setCoverage((prev) => ({
        ...prev,
        questionsTotal: prev.questionsTotal + 1,
      }));
      setNotice(`تم نسخ السؤال بنجاح بالكود الجديد: ${newCode}`);
    });
  }

  async function deleteQuestion(rowId: string) {
    const row = rows.find((r) => r.id === rowId);
    const code = row?.questionCode || 'هذا السؤال';
    if (!window.confirm(`هل أنت متأكد من حذف ${code} (أرشفته)؟`)) {
      return;
    }
    await run('delete-' + rowId, async (csrf) => {
      const version = row ? row.currentVersion : 1;
      await questionBankClient.workflow(rowId, version, 'archived', 'تم الحذف من جدول بنك الأسئلة', csrf);
      setRows((prev) => prev.filter((r) => r.id !== rowId));
      setSelectedQuestionIds((prev) => {
        if (!prev.has(rowId)) return prev;
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
      setCoverage((prev) => ({
        ...prev,
        questionsTotal: Math.max(0, prev.questionsTotal - 1),
      }));
      setNotice(`تم حذف (أرشفة) السؤال ${code} بنجاح`);
    });
  }

  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  function updateOption(index: number, value: string) {
    setCreate((x) => ({ ...x, options: x.options.map((v, i) => (i === index ? value : v)) }));
  }

  async function handleImageFile(file: File) {
    setMediaFile(file);
    const localUrl = URL.createObjectURL(file);
    setImagePreviewUrl(localUrl);

    let code = create.questionCode.trim();
    if (!code) {
      code = `Q-${Date.now().toString().slice(-6)}`;
      setCreate((prev) => ({ ...prev, questionCode: code }));
    }

    try {
      setPending('media');
      const csrf = await getCsrfToken();
      const asset = await questionBankClient.uploadAsset(file, code, 'question_image', csrf);
      setMediaAsset(asset);
      setCreate((prev) => ({
        ...prev,
        imageAssetId: asset.id,
        imageAlt: prev.imageAlt || file.name.replace(/\.[^/.]+$/, ''),
      }));
      setNotice('تم رفع صورة السؤال بنجاح ومزامنتها.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل رفع الصورة تلقائياً');
    } finally {
      setPending('');
    }
  }

  function handlePasteImage(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.files);
    const image = files.find((f) => f.type.startsWith('image/'));
    if (image) {
      e.preventDefault();
      void handleImageFile(image);
    }
  }

  function removeImage() {
    setMediaFile(null);
    setMediaAsset(null);
    setImagePreviewUrl('');
    setCreate((prev) => ({ ...prev, imageAssetId: '' }));
  }

  async function uploadMedia() {
    if (!mediaFile || !create.questionCode.trim())
      return setError('أدخل كود السؤال واختر ملفاً قبل الرفع.');
    await run(
      'media',
      async (csrf) => {
        const asset = await questionBankClient.uploadAsset(
          mediaFile,
          create.questionCode.trim(),
          'question_image',
          csrf
        );
        setMediaAsset(asset);
        setCreate((x) => ({ ...x, imageAssetId: asset.id }));
      },
      'تم التحقق من ملف الصورة وتثبيته كأصل وسائط.'
    );
  }

  async function createQuestion() {
    if (!create.questionCode.trim() || !create.pathId || !create.subjectId || !create.mainSkillId)
      return setError('الكود والمسار والمادة والمهارة الرئيسية مطلوبة.');
    const optionRows = create.options.map((text, index) => ({ text: text.trim(), index })).filter((row) => row.text);
    const imageOptionTexts = create.options
      .slice(0, create.type === 'true_false' ? 2 : create.options.length)
      .map((text) => text.trim());
    const retainOptionPositions = create.optionsEmbeddedInImage || (!create.showOptionText && create.showOptionLabels);
    const options =
      create.type === 'essay'
        ? []
        : retainOptionPositions
          ? imageOptionTexts.map((text) => ({ text, assetId: '' }))
          : optionRows.map(({ text }) => ({ text, assetId: '' }));
    if (create.type !== 'essay' && options.length < 2) return setError('يلزم خياران على الأقل.');
    const correctOptionIndex =
      create.type === 'essay'
        ? null
        : retainOptionPositions
          ? create.correctOptionIndex
          : optionRows.findIndex((row) => row.index === create.correctOptionIndex);
    if (
      correctOptionIndex === -1 ||
      (retainOptionPositions && correctOptionIndex !== null && correctOptionIndex >= imageOptionTexts.length)
    )
      return setError('يرجى اختيار إجابة صحيحة من الخيارات الموجودة.');
    const skillLinks = [
      { skillId: create.mainSkillId, relationType: 'main' as const },
      ...(create.subSkillId ? [{ skillId: create.subSkillId, relationType: 'sub' as const }] : []),
    ];

    const sourceMeta: Record<string, unknown> = {};
    if (!create.showOptionLabels && !create.showOptionText)
      return setError('أظهر رمز الخيار أو نصه حتى يستطيع الطالب اختيار الإجابة.');
    if (!create.showOptionLabels && create.optionsEmbeddedInImage && imageOptionTexts.some((text) => !text))
      return setError('أظهر رموز الخيارات أو اكتب نصاً لكل خيار حتى يستطيع الطالب التمييز بينها.');
    const selectedLabels = retainOptionPositions
      ? create.optionLabels.slice(0, imageOptionTexts.length)
      : optionRows.map((row) => create.optionLabels[row.index]);
    sourceMeta.learnerPresentation = {
      ...(create.questionNumber.trim() ? { questionNumber: create.questionNumber.trim() } : {}),
      showQuestionNumber: create.showQuestionNumber,
      showOptionLabels: create.showOptionLabels,
      showOptionText: create.showOptionText,
      optionLabelStyle: create.optionLabelStyle,
      ...(selectedLabels.some((label) => label.trim())
        ? { optionLabels: selectedLabels.map((label) => label.trim()) }
        : {}),
    };
    if (create.passage.trim()) {
      sourceMeta.passage = create.passage.trim();
    }

    const aiContext: Record<string, unknown> = {};
    if (create.aiReadableText.trim()) aiContext.readableText = create.aiReadableText.trim();
    if (create.aiSpeechText.trim()) aiContext.speechText = create.aiSpeechText.trim();
    if (create.aiVisualDescription.trim()) aiContext.visualDescription = create.aiVisualDescription.trim();
    if (create.optionsEmbeddedInImage && imageOptionTexts.every(Boolean)) {
      aiContext.optionTexts = imageOptionTexts;
    }

    const voiceExplanation: Record<string, unknown> = {};
    if (create.voiceNotes.trim()) voiceExplanation.notes = create.voiceNotes.trim();

    await run('create', async (csrf) => {
      const result = await questionBankClient.create(
        {
          questionCode: create.questionCode.trim(),
          ownerType: isAdmin ? 'platform' : 'teacher',
          ownerId: isAdmin ? '' : user?.id || '',
          assignedTeacherId: isAdmin ? '' : user?.id || '',
          version: {
            pathId: create.pathId,
            subjectId: create.subjectId,
            type: create.type,
            text: create.text.trim(),
            imageAssetId: create.imageAssetId,
            imageAlt: create.imageAlt.trim(),
            optionsEmbeddedInImage: create.optionsEmbeddedInImage,
            correctOptionIndex,
            explanation: create.explanation.trim(),
            hint: create.hint.trim(),
            solvingStrategy: create.solvingStrategy.trim(),
            videoUrl: create.videoUrl.trim(),
            sourceMeta,
            aiContext,
            voiceExplanation,
            difficulty: create.difficulty,
            examType: create.examType.trim(),
            source: create.source.trim(),
            year: null,
            revisionNote: '',
            options,
            skillLinks,
          },
        },
        csrf
      );
      setDetail(result.question);
      setShowCreate(false);
      setMediaAsset(null);
      setMediaFile(null);
      setImagePreviewUrl('');
      setCreate({
        questionCode: '',
        pathId: '',
        subjectId: '',
        type: 'mcq',
        text: '',
        difficulty: 'Medium',
        examType: '',
        source: 'manual',
        explanation: '',
        hint: '',
        solvingStrategy: '',
        videoUrl: '',
        imageAssetId: '',
        imageAlt: '',
        optionsEmbeddedInImage: false,
        questionNumber: '',
        showQuestionNumber: true,
        showOptionLabels: true,
        showOptionText: true,
        optionLabelStyle: 'arabic',
        optionLabels: ['', '', '', ''],
        passage: '',
        showPassage: false,
        showAiContext: false,
        showVoiceExplanation: false,
        aiReadableText: '',
        aiSpeechText: '',
        aiVisualDescription: '',
        voiceNotes: '',
        mainSkillId: '',
        subSkillId: '',
        correctOptionIndex: 0,
        options: ['', '', '', ''],
      });
      setReload((x) => x + 1);
    }, 'تم حفظ السؤال الجديد كمسودة معتمدة.');
  }

  async function importBatch(dryRun: boolean) {
    if (!isAdmin) return;
    let items: unknown[];
    try {
      const parsed = JSON.parse(importText) as unknown;
      if (!Array.isArray(parsed)) throw new Error();
      items = parsed;
    } catch {
      return setError('صيغة JSON للاستيراد يجب أن تكون مصفوفة عناصر صالحة.');
    }
    if (!importBatchId.trim()) return setError('أدخل معرف دفعة الاستيراد.');
    await run(
      dryRun ? 'import-dry' : 'import-write',
      async (csrf) => {
        const result = await questionBankClient.importBatch(importBatchId.trim(), dryRun, items, csrf);
        setImportResult(result);
        setImportDryRunPassed(dryRun && result.status === 'PASS');
        if (!dryRun && result.status === 'IMPORTED') {
          setReload((x) => x + 1);
          setImportDryRunPassed(false);
        }
      },
      dryRun ? 'اكتمل الفحص الجاف للدفعة.' : 'تم تنفيذ دفعة الاستيراد بعد الفحص الجاف.'
    );
  }

  function toggleSelectQuestion(id: string) {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedQuestionIds.size === rows.length) {
      setSelectedQuestionIds(new Set());
    } else {
      setSelectedQuestionIds(new Set(rows.map((r) => r.id)));
    }
  }

  if (authLoading) return <main className="p-10 text-center font-black">جاري التحقق من الصلاحيات...</main>;
  if (!user) {
    return (
      <main dir="rtl" className="min-h-[50vh] flex flex-col items-center justify-center p-10 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-2 border border-amber-200">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-xl font-black text-gray-800">يرجى تسجيل الدخول للوصول إلى مركز بنك الأسئلة</h2>
        <p className="text-sm font-bold text-gray-500 max-w-md">
          يتطلب بنك الأسئلة صلاحيات مدير المنصة أو مشرف التأليف.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-colors shadow-sm"
        >
          تسجيل الدخول الآن
        </Link>
      </main>
    );
  }
  if (!isAdmin && !isTeacher) {
    return (
      <main dir="rtl" className="min-h-[50vh] flex flex-col items-center justify-center p-10 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-2 border border-rose-200">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-rose-800">مركز بنك الأسئلة متاح للمشرفين على التأليف فقط</h2>
        <p className="text-sm font-bold text-gray-500 max-w-md">
          حسابك الحالي ({user.email}) لا يمتلك صلاحيات إدارة المحتوى. يرجى الدخول بحساب المشرف/المدير.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-800 text-white font-black hover:bg-slate-900 transition-colors"
        >
          التبديل إلى حساب المدير
        </Link>
      </main>
    );
  }

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-5 pb-12" data-testid="question-bank-admin">
      {/* Header */}
      <header className="rounded-3xl bg-gradient-to-l from-violet-800 via-slate-900 to-slate-950 p-5 text-white shadow-xl sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-black text-violet-200">
              <HelpCircle size={17} /> QUESTION BANK
            </p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">مركز بنك الأسئلة</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
              التأليف بإصدارات ثابتة، التصنيف المهاري، المراجعة والاعتماد، وعرض مصور فوري للسؤال
              مطابق لنظام قياس 1:1.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setReload((x) => x + 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-black cursor-pointer"
            >
              <RefreshCcw size={17} /> تحديث
            </button>
            <button
              type="button"
              onClick={() => setShowCreate((x) => !x)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-slate-950 cursor-pointer"
            >
              <Plus size={17} /> سؤال جديد
            </button>
          </div>
        </div>
      </header>

      {selectedSkillId ? (
        <section
          aria-label="نطاق المهارة المحددة"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-bold text-indigo-900"
        >
          <span>الأسئلة المرتبطة بالمهارة: {selectedSkillName || 'مهارة محددة'}</span>
          <Link
            to="/admin-dashboard/questions"
            className="rounded-xl border border-indigo-300 bg-white px-3 py-2 text-indigo-700"
          >
            عرض جميع الأسئلة
          </Link>
        </section>
      ) : null}

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 font-bold text-emerald-700">{notice}</div> : null}

      {/* Metric Cards */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat icon={<BarChart3 size={18} />} label="إجمالي مطابق" value={coverage.questionsTotal} />
        <Stat icon={<CheckCircle2 size={18} />} label="معتمد" value={coverage.approved} />
        <Stat icon={<Send size={18} />} label="بانتظار المراجعة" value={coverage.pendingReview} />
        <Stat icon={<Target size={18} />} label="غير مرتبط مهارياً" value={coverage.unlinked} />
        <Stat icon={<Target size={18} />} label="تغطية رئيسية" value={coverage.mainSkillCoverage} />
        <Stat icon={<Target size={18} />} label="تغطية فرعية" value={coverage.subSkillCoverage} />
      </section>

      {/* Two-Level Filter Bar (Matching Legacy 1:1) */}
      <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-violet-700" />
            <h2 className="font-black text-gray-900">البحث وفلاتر التصفية المتقدمة</h2>
          </div>
          <span className="text-xs font-bold text-gray-400">
            {rows.length} {hasMore ? '+' : ''} سؤال معروض
          </span>
        </div>

        {/* Level 1: Scope Selectors & Search */}
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <label className="relative md:col-span-2">
            <Search className="absolute right-3 top-3 text-gray-400" size={16} />
            <input
              aria-label="بحث بنك الأسئلة"
              value={filters.search || ''}
              onChange={(e) => setFilters((x) => ({ ...x, search: e.target.value, page: 1 }))}
              placeholder="ابحث بالكود أو نص السؤال..."
              className="w-full rounded-xl border py-2.5 pr-9 pl-3 text-sm font-medium"
            />
          </label>
          <select
            aria-label="مسار فلتر الأسئلة"
            value={filters.pathId || ''}
            onChange={(e) =>
              setFilters((x) => ({ ...x, pathId: e.target.value, subjectId: '', mainSkillId: '', page: 1 }))
            }
            className="rounded-xl border p-2.5 text-sm font-medium bg-slate-50"
          >
            <option value="">كل المسارات</option>
            {taxonomy.paths.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select
            aria-label="مادة فلتر الأسئلة"
            value={filters.subjectId || ''}
            onChange={(e) => setFilters((x) => ({ ...x, subjectId: e.target.value, mainSkillId: '', page: 1 }))}
            className="rounded-xl border p-2.5 text-sm font-medium bg-slate-50"
          >
            <option value="">كل المواد</option>
            {subjects.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select
            aria-label="حالة فلتر الأسئلة"
            value={filters.workflowStatus || ''}
            onChange={(e) =>
              setFilters((x) => ({ ...x, workflowStatus: e.target.value as QuestionWorkflowStatus | '', page: 1 }))
            }
            className="rounded-xl border p-2.5 text-sm font-medium bg-slate-50"
          >
            <option value="">كل الحالات</option>
            {Object.entries(statusLabel).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            aria-label="نوع فلتر الأسئلة"
            value={filters.type || ''}
            onChange={(e) => setFilters((x) => ({ ...x, type: e.target.value as QuestionType | '', page: 1 }))}
            className="rounded-xl border p-2.5 text-sm font-medium bg-slate-50"
          >
            <option value="">كل الأنواع</option>
            {Object.entries(typeLabel).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            aria-label="مهارة رئيسية فلتر الأسئلة"
            value={filters.mainSkillId || ''}
            onChange={(e) => setFilters((x) => ({ ...x, mainSkillId: e.target.value, page: 1 }))}
            className="rounded-xl border p-2.5 text-sm font-medium bg-slate-50"
          >
            <option value="">كل المهارات الرئيسية</option>
            {skills
              .filter((x) => x.kind === 'main' || !x.parentSkillId)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
          <select
            aria-label="ارتباط مهاري فلتر الأسئلة"
            value={filters.linked === '' ? '' : String(filters.linked)}
            onChange={(e) =>
              setFilters((x) => ({ ...x, linked: e.target.value === '' ? '' : e.target.value === 'true', page: 1 }))
            }
            className="rounded-xl border p-2.5 text-sm font-medium bg-slate-50"
          >
            <option value="">الارتباط المهاري: الكل</option>
            <option value="true">مرتبط بمهارة</option>
            <option value="false">غير مرتبط بمهارة</option>
          </select>
        </div>

        {/* Level 2: Quick Interactive Filter Pills (فلاتر التصفية السريعة كما في القديم) */}
        <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* فلتر فيديو الشرح */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-gray-200">
              <span className="text-xs font-bold text-gray-500 px-2 flex items-center gap-1">
                <Video size={14} className="text-indigo-600" />
                فيديو الشرح:
              </span>
              <button
                type="button"
                onClick={() => setFilters((x) => ({ ...x, withVideo: '', page: 1 }))}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filters.withVideo === '' || filters.withVideo === undefined
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setFilters((x) => ({ ...x, withVideo: true, page: 1 }))}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filters.withVideo === true
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100'
                }`}
              >
                <Video size={12} />
                يحتوي فيديو شرح
              </button>
              <button
                type="button"
                onClick={() => setFilters((x) => ({ ...x, withVideo: false, page: 1 }))}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filters.withVideo === false
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-700 bg-amber-50/70 hover:bg-amber-100'
                }`}
              >
                <AlertCircle size={12} />
                لا يحتوي فيديو
              </button>
            </div>

            {/* فلتر الشرح النصي */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-gray-200">
              <span className="text-xs font-bold text-gray-500 px-2">الشرح النصي:</span>
              <button
                type="button"
                onClick={() => setFilters((x) => ({ ...x, withExplanation: '', page: 1 }))}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filters.withExplanation === '' || filters.withExplanation === undefined
                    ? 'bg-slate-700 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setFilters((x) => ({ ...x, withExplanation: true, page: 1 }))}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filters.withExplanation === true
                    ? 'bg-emerald-600 text-white'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                موجود
              </button>
              <button
                type="button"
                onClick={() => setFilters((x) => ({ ...x, withExplanation: false, page: 1 }))}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filters.withExplanation === false
                    ? 'bg-rose-600 text-white'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                بدون شرح
              </button>
            </div>

            {/* فلتر مستوى الصعوبة */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-gray-200">
              <span className="text-xs font-bold text-gray-500 px-2 flex items-center gap-1">
                <Filter size={13} className="text-purple-600" />
                الصعوبة:
              </span>
              <button
                type="button"
                onClick={() => setFilters((x) => ({ ...x, difficulty: '', page: 1 }))}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  !filters.difficulty
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setFilters((x) => ({ ...x, difficulty: 'Easy', page: 1 }))}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filters.difficulty === 'Easy'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                سهل
              </button>
              <button
                type="button"
                onClick={() => setFilters((x) => ({ ...x, difficulty: 'Medium', page: 1 }))}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filters.difficulty === 'Medium'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                متوسط
              </button>
              <button
                type="button"
                onClick={() => setFilters((x) => ({ ...x, difficulty: 'Hard', page: 1 }))}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filters.difficulty === 'Hard'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                صعب
              </button>
            </div>

            {/* فلتر الصور */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-gray-200">
              <span className="text-xs font-bold text-gray-500 px-2 flex items-center gap-1">
                <FileImage size={13} className="text-sky-600" />
                الصور:
              </span>
              <button
                type="button"
                onClick={() => setImageOnlyFilter('all')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  imageOnlyFilter === 'all'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setImageOnlyFilter('with_image')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  imageOnlyFilter === 'with_image'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <FileImage size={12} />
                مصور فقط
              </button>
              <button
                type="button"
                onClick={() => setImageOnlyFilter('without_image')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  imageOnlyFilter === 'without_image'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                نصي فقط
              </button>
            </div>

            {/* اختصار سريع لأسئلة التحصيلي المصورة */}
            <button
              type="button"
              onClick={() => {
                setFilters((prev) => ({ ...prev, search: 'TAH', page: 1 }));
                setImageOnlyFilter('all');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl bg-violet-100 text-violet-800 border border-violet-200 hover:bg-violet-200 transition-all cursor-pointer shadow-xs"
              title="عرض أسئلة التحصيلي المصورة مع خياراتها ورسومها"
            >
              <span>📸</span>
              <span>أسئلة التحصيلي المصورة (50+ سؤال)</span>
            </button>
          </div>

          {/* زر إعادة ضبط الفلاتر */}
          <button
            type="button"
            onClick={() => {
              setImageOnlyFilter('all');
              setFilters({
                page: 1,
                limit: 50,
                search: '',
                pathId: '',
                subjectId: '',
                mainSkillId: '',
                linked: '',
                difficulty: '',
                type: '',
                workflowStatus: '',
                withVideo: '',
                withExplanation: '',
              });
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
          >
            <RotateCcw size={13} />
            إعادة ضبط الفلاتر
          </button>
        </div>
      </section>

      {/* Authoring / Create Drawer */}
      {showCreate ? (
        <section
          onPaste={handlePasteImage}
          className="rounded-3xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm sm:p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-amber-700">AUTHORING · UNIFIED BUILDER</p>
              <h2 className="text-xl font-black">
                منشئ الأسئلة الموحد (يدعم لصق الصور مباشرة Ctrl+V وفيديو الشرح وسياق AI)
              </h2>
            </div>
            <button
              type="button"
              aria-label="إغلاق إنشاء السؤال"
              onClick={() => setShowCreate(false)}
              className="cursor-pointer"
            >
              <XCircle size={20} />
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black text-amber-900">
                <BookOpen size={16} className="text-amber-700" />
                <span>النص القرائي / قطعة الفهم (استيعاب المقروء - اختياري)</span>
              </div>
              <button
                type="button"
                onClick={() => setCreate((prev) => ({ ...prev, showPassage: !prev.showPassage }))}
                className="text-xs font-black text-amber-800 hover:underline cursor-pointer"
              >
                {create.showPassage ? 'إخفاء القطعة' : '+ إضافة قطعة للسؤال'}
              </button>
            </div>
            {create.showPassage ? (
              <textarea
                rows={4}
                value={create.passage}
                onChange={(e) => setCreate({ ...create, passage: e.target.value })}
                placeholder="أدخل نص القطعة أو المقال القرائي هنا..."
                className="w-full rounded-xl border border-amber-300 bg-white p-3 text-sm font-medium leading-relaxed outline-none focus:border-amber-500"
              />
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex gap-2">
                  <input
                    aria-label="كود السؤال الجديد"
                    value={create.questionCode}
                    onChange={(e) => setCreate({ ...create, questionCode: e.target.value })}
                    placeholder="الكود الثابت (مثال: Q-ALG-01)"
                    className="min-w-0 flex-1 rounded-xl border p-2.5 font-bold"
                  />
                  <button
                    type="button"
                    onClick={autoGenerateCode}
                    className="rounded-xl border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-black text-indigo-700 hover:bg-indigo-50 shrink-0 cursor-pointer"
                    title="توليد كود تلقائي"
                  >
                    كود تلقائي
                  </button>
                </div>
                <select
                  aria-label="نوع السؤال الجديد"
                  value={create.type}
                  onChange={(e) => setCreate({ ...create, type: e.target.value as QuestionType })}
                  className="rounded-xl border p-2.5"
                >
                  {Object.entries(typeLabel).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  aria-label="مسار السؤال الجديد"
                  value={create.pathId}
                  onChange={(e) =>
                    setCreate({ ...create, pathId: e.target.value, subjectId: '', mainSkillId: '', subSkillId: '' })
                  }
                  className="rounded-xl border p-2.5"
                >
                  <option value="">اختر المسار</option>
                  {taxonomy.paths.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="مادة السؤال الجديد"
                  value={create.subjectId}
                  onChange={(e) =>
                    setCreate({ ...create, subjectId: e.target.value, mainSkillId: '', subSkillId: '' })
                  }
                  className="rounded-xl border p-2.5"
                >
                  <option value="">اختر المادة</option>
                  {createSubjects.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  aria-label="المهارة الرئيسية للسؤال"
                  value={create.mainSkillId}
                  onChange={(e) => setCreate({ ...create, mainSkillId: e.target.value, subSkillId: '' })}
                  className="rounded-xl border p-2.5"
                >
                  <option value="">المهارة الرئيسية</option>
                  {createMainSkills.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="المهارة الفرعية للسؤال"
                  value={create.subSkillId}
                  onChange={(e) => setCreate({ ...create, subSkillId: e.target.value })}
                  className="rounded-xl border p-2.5"
                >
                  <option value="">مهارة فرعية اختيارية</option>
                  {createSubSkills.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <Video size={14} className="text-blue-600" />
                    رابط فيديو شرح السؤال (اختياري)
                  </label>
                  <input
                    type="url"
                    value={create.videoUrl}
                    onChange={(e) => setCreate({ ...create, videoUrl: e.target.value })}
                    placeholder="https://... فيديو شرح حل المسألة"
                    className="w-full rounded-xl border p-2 text-xs font-medium"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={create.optionsEmbeddedInImage}
                      onChange={(e) =>
                        setCreate({
                          ...create,
                          optionsEmbeddedInImage: e.target.checked,
                          showOptionText: !e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded accent-indigo-600"
                    />
                    <span>الخيارات مضمنة داخل صورة السؤال</span>
                  </label>
                </div>
              </div>

              <textarea
                aria-label="نص السؤال الجديد"
                value={create.text}
                onPaste={handlePasteImage}
                onChange={(e) => setCreate({ ...create, text: e.target.value })}
                placeholder="نص السؤال... يمكنك لصق صورة السؤال مباشرة هنا بالضغط على Ctrl+V"
                className="min-h-24 w-full rounded-xl border p-3 leading-relaxed"
              />
              <fieldset className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                <legend className="px-1 text-xs font-black text-indigo-900">طريقة عرض السؤال والخيارات</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold text-slate-700">
                    رقم السؤال (اختياري)
                    <input
                      aria-label="رقم السؤال الاختياري"
                      maxLength={50}
                      value={create.questionNumber}
                      onChange={(e) => setCreate({ ...create, questionNumber: e.target.value })}
                      placeholder="اتركه فارغاً لاستخدام ترقيم الاختبار"
                      className="mt-1 w-full rounded-xl border bg-white p-2"
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-700">
                    أحرف الخيارات الافتراضية
                    <select
                      aria-label="أحرف الخيارات الافتراضية"
                      value={create.optionLabelStyle}
                      onChange={(e) =>
                        setCreate({ ...create, optionLabelStyle: e.target.value as 'arabic' | 'latin' })
                      }
                      className="mt-1 w-full rounded-xl border bg-white p-2"
                    >
                      <option value="arabic">أ، ب، ج، د</option>
                      <option value="latin">A, B, C, D</option>
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-700">
                  <label>
                    <input
                      type="checkbox"
                      checked={create.showQuestionNumber}
                      onChange={(e) => setCreate({ ...create, showQuestionNumber: e.target.checked })}
                    />{' '}
                    إظهار رقم السؤال
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={create.showOptionLabels}
                      onChange={(e) => setCreate({ ...create, showOptionLabels: e.target.checked })}
                    />{' '}
                    إظهار رموز الخيارات
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={create.showOptionText}
                      onChange={(e) => setCreate({ ...create, showOptionText: e.target.checked })}
                    />{' '}
                    إظهار نص الخيارات
                  </label>
                </div>
              </fieldset>
              {create.type !== 'essay' ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {create.options.map((v, i) => (
                    <label key={i} className="text-xs font-bold">
                      الخيار {['أ', 'ب', 'ج', 'د'][i] || i + 1}
                      <div className="mt-1 flex gap-2">
                        <input
                          aria-label={`رمز الخيار ${i + 1}`}
                          maxLength={24}
                          value={create.optionLabels[i]}
                          onChange={(e) =>
                            setCreate((prev) => ({
                              ...prev,
                              optionLabels: prev.optionLabels.map((label, index) =>
                                index === i ? e.target.value : label
                              ),
                            }))
                          }
                          placeholder={
                            create.optionLabelStyle === 'latin'
                              ? ['A', 'B', 'C', 'D'][i]
                              : ['أ', 'ب', 'ج', 'د'][i]
                          }
                          className="w-16 rounded-xl border p-2 text-center text-xs"
                        />
                        <input
                          aria-label={`نص الخيار ${i + 1}`}
                          value={v}
                          onChange={(e) => updateOption(i, e.target.value)}
                          placeholder={
                            create.optionsEmbeddedInImage
                              ? `قيمة الخيار في الصورة (أو الرمز)`
                              : `محتوى الخيار ${i + 1}`
                          }
                          className="min-w-0 flex-1 rounded-xl border p-2 text-xs"
                        />
                        <input
                          aria-label={`الإجابة الصحيحة ${i + 1}`}
                          type="radio"
                          name="correct-option"
                          checked={create.correctOptionIndex === i}
                          onChange={() => setCreate({ ...create, correctOptionIndex: i })}
                          className="accent-emerald-600"
                        />
                      </div>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <textarea
                aria-label="الشرح وتفسير الحل للسؤال"
                value={create.explanation}
                onChange={(e) => setCreate({ ...create, explanation: e.target.value })}
                placeholder="الشرح وتوضيح الإجابة الصحيحة..."
                className="min-h-20 w-full rounded-xl border p-3 leading-relaxed"
              />
              <textarea
                aria-label="استراتيجية الحل السريع للسؤال"
                value={create.solvingStrategy}
                onChange={(e) => setCreate({ ...create, solvingStrategy: e.target.value })}
                placeholder="استراتيجية قياس والحل السريع..."
                className="min-h-16 w-full rounded-xl border p-3 leading-relaxed"
              />

              {/* Upload image box */}
              <div className="rounded-2xl border border-violet-200 bg-white p-3.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageUp size={18} className="text-violet-700" />
                    <h3 className="font-black text-sm">صورة السؤال — لصق أو رفع فوري</h3>
                  </div>
                  {imagePreviewUrl || mediaAsset || create.imageAssetId ? (
                    <button
                      type="button"
                      onClick={removeImage}
                      className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                    >
                      <Trash2 size={14} /> حذف الصورة
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 space-y-2" onPaste={handlePasteImage}>
                  <input
                    aria-label="ملف صورة السؤال"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file) {
                        void handleImageFile(file);
                      }
                    }}
                    className="block w-full text-xs text-slate-700"
                  />
                  {imagePreviewUrl ? (
                    <div className="mt-2 overflow-hidden rounded-xl border border-violet-100 bg-slate-50 p-2 text-center">
                      <img
                        src={imagePreviewUrl}
                        alt="معاينة صورة السؤال"
                        className="mx-auto max-h-48 rounded-lg object-contain"
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                disabled={pending === 'create' || pending === 'media'}
                onClick={() => void createQuestion()}
                className="w-full rounded-xl bg-slate-950 py-3 font-black text-white shadow-sm transition hover:bg-slate-900 disabled:opacity-50 cursor-pointer"
              >
                {pending === 'create' ? 'جاري الحفظ...' : 'حفظ السؤال كمسودة'}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* Bulk Action Bar */}
      {selectedQuestionIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-black shadow-xs">
              {selectedQuestionIds.size}
            </span>
            <span className="text-sm font-black text-indigo-950">أسئلة تم تحديدها</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    for (const id of Array.from(selectedQuestionIds)) {
                      await workflow('approved', id);
                    }
                    setSelectedQuestionIds(new Set());
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                >
                  <CheckCircle2 size={15} /> اعتماد جماعي ({selectedQuestionIds.size})
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    for (const id of Array.from(selectedQuestionIds)) {
                      await workflow('rejected', id);
                    }
                    setSelectedQuestionIds(new Set());
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors shadow-xs cursor-pointer"
                >
                  <AlertCircle size={15} /> رفض جماعي ({selectedQuestionIds.size})
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const count = selectedQuestionIds.size;
                    if (!window.confirm(`هل أنت متأكد من حذف وأرشفة ${count} سؤال/أسئلة محددة؟`)) {
                      return;
                    }
                    const ids = Array.from(selectedQuestionIds);
                    for (const id of ids) {
                      await workflow('archived', id);
                    }
                    setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
                    setSelectedQuestionIds(new Set());
                    setNotice(`تم حذف وأرشفة ${count} سؤال بنجاح`);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shadow-xs cursor-pointer"
                  title="حذف وأرشفة جميع الأسئلة المحددة"
                >
                  <Trash2 size={15} /> حذف جماعي ({selectedQuestionIds.size})
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setSelectedQuestionIds(new Set())}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X size={14} /> إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* Full-Width Questions Table (1:1 Legacy Parity with Images 2 & 3) */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-4 text-center w-12">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selectedQuestionIds.size === rows.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    title={
                      selectedQuestionIds.size === rows.length ? 'إلغاء تحديد كل الأسئلة' : 'تحديد جميع الأسئلة المعروضة'
                    }
                  />
                </th>
                <th className="px-4 py-4 text-sm font-black text-gray-700 min-w-[280px]">نص السؤال</th>
                <th className="px-4 py-4 text-sm font-black text-gray-700 min-w-[150px]">المهارات الفرعية</th>
                <th className="px-4 py-4 text-sm font-black text-gray-700">الصعوبة</th>
                <th className="px-4 py-4 text-sm font-black text-gray-700 min-w-[140px]">الاستخدام والأداء</th>
                <th className="px-4 py-4 text-sm font-black text-gray-700">الحالة</th>
                <th className="px-4 py-4 text-center text-sm font-black text-gray-700 min-w-[150px]">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {busy ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-sm font-bold text-gray-400">
                    <Loader2 className="animate-spin text-violet-700 inline ml-2" size={20} />
                    جاري تحميل بنك الأسئلة والصور...
                  </td>
                </tr>
              ) : displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-sm font-bold text-gray-400">
                    لا توجد أسئلة تطابق معايير الفلترة المحددة.
                  </td>
                </tr>
              ) : (
                displayedRows.map((row) => {
                  const isSelected = selectedQuestionIds.has(row.id);
                  const mainSkill = taxonomy.skills.find((s) => s.id === row.mainSkillId);
                  const subSkills = taxonomy.skills.filter((s) => (row.skillIds || []).includes(s.id));
                  const { displayText, resolvedImage } = resolveQuestionMedia(row.text, row.imageUrl);
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}
                    >
                      <td className="px-4 py-4 text-center align-top pt-6">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectQuestion(row.id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* 1. نص وصورة السؤال المباشرة (مع الشارات) */}
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-2.5">
                          {displayText ? (
                            <div className="text-sm font-semibold text-gray-800 leading-relaxed max-w-[560px]">
                              {displayText}
                            </div>
                          ) : null}

                          {/* بطاقة صورة السؤال المباشرة الكبيرة */}
                          {resolvedImage ? (
                            <div
                              className="w-full max-w-[480px] sm:max-w-[560px] overflow-hidden rounded-xl border border-indigo-100/90 bg-slate-50 p-2 shadow-xs group cursor-pointer hover:border-indigo-300 transition-all"
                              onClick={() => setZoomImageUrl(resolvedImage || null)}
                              title="اضغط لتكبير صورة السؤال"
                            >
                              <img
                                src={resolvedImage}
                                alt={row.questionCode}
                                className="h-48 sm:h-56 w-full object-contain cursor-pointer hover:scale-[1.02] transition-transform duration-200"
                                loading="lazy"
                              />
                              <div className="line-clamp-1 text-[11px] font-bold text-gray-400 mt-1 flex items-center justify-between">
                                <span>اضغط معاينة لرؤية السؤال كاملاً.</span>
                                <Eye size={13} className="text-indigo-500" />
                              </div>
                            </div>
                          ) : row.imageAssetId ? (
                            <div
                              className="w-full max-w-[480px] sm:max-w-[560px] overflow-hidden rounded-xl border border-indigo-100/90 bg-slate-50 p-2 shadow-xs cursor-pointer hover:border-indigo-300 transition-all"
                              onClick={() => void openQuestion(row.id)}
                            >
                              <QuestionAssetImage
                                assetId={row.imageAssetId}
                                alt={row.questionCode}
                                className="h-48 sm:h-56 w-full object-contain cursor-pointer hover:scale-[1.02] transition-transform duration-200"
                              />
                              <div className="line-clamp-1 text-[11px] font-bold text-gray-400 mt-1">
                                اضغط معاينة لرؤية السؤال كاملاً.
                              </div>
                            </div>
                          ) : !displayText ? (
                            <div className="text-sm text-gray-400">سؤال بدون نص أو صورة</div>
                          ) : null}

                          {/* خيارات السؤال أ، ب، ج، د المطابقة للشكل القديم */}
                          {row.options && row.options.length > 0 && !row.optionsEmbeddedInImage && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 max-w-[560px]">
                              {row.options.map((opt, oIdx) => {
                                const letter = ['A', 'B', 'C', 'D'][oIdx] || String.fromCharCode(65 + oIdx);
                                return (
                                  <div
                                    key={oIdx}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs font-semibold text-gray-700"
                                  >
                                    <span className="w-5 h-5 flex items-center justify-center rounded-md bg-indigo-100 text-indigo-700 font-bold text-[11px] shrink-0">
                                      {letter}
                                    </span>
                                    <span className="truncate font-medium">{opt.text || `خيار ${letter}`}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* شارات السؤال المرجعية */}
                          <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-gray-100">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {row.questionCode}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600">
                              {row.ownerType === 'teacher' ? 'سؤال معلم' : 'سؤال المنصة'}
                            </span>
                            {row.hasVideo ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                                <Video size={11} className="text-emerald-600" />
                                فيديو متوفر
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/70">
                                <AlertCircle size={10} className="text-amber-500" />
                                بدون فيديو
                              </span>
                            )}
                            {row.hasExplanation ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200/70">
                                يحتوي شرح نصي
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/70">
                                بدون شرح
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. المهارات الفرعية */}
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col gap-1.5 max-w-[200px]">
                          {mainSkill ? (
                            <div className="text-xs font-black text-gray-800">{mainSkill.name}</div>
                          ) : null}
                          <div className="flex flex-col gap-1">
                            {subSkills.length > 0 ? (
                              subSkills.map((sk) => (
                                <div key={sk.id} className="flex flex-col gap-0.5">
                                  {sk.code ? (
                                    <span className="inline-block w-fit px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                      {sk.code}
                                    </span>
                                  ) : null}
                                  <span className="text-xs font-semibold text-gray-700">
                                    {sk.name}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">غير مرتبط</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. الصعوبة */}
                      <td className="px-6 py-4 align-top whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            row.difficulty === 'Easy'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                              : row.difficulty === 'Medium'
                                ? 'bg-amber-50 text-amber-700 border-amber-200/70'
                                : 'bg-red-50 text-red-700 border-red-200/70'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              row.difficulty === 'Easy'
                                ? 'bg-emerald-500'
                                : row.difficulty === 'Medium'
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                            }`}
                          />
                          {row.difficulty === 'Easy' ? 'سهل' : row.difficulty === 'Hard' ? 'صعب' : 'متوسط'}
                        </span>
                      </td>

                      {/* 4. الاستخدام والأداء */}
                      <td className="px-6 py-4 align-top">
                        <div className="min-w-[140px] p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs font-bold text-gray-600">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 font-medium">المحاولات:</span>
                            <span className="text-gray-900 font-black">١</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 font-medium">الدقة:</span>
                            <span className="text-gray-900 font-black">١٠٠٪</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 font-medium">متوسط الوقت:</span>
                            <span className="text-gray-900 font-black">٠ ث</span>
                          </div>
                        </div>
                      </td>

                      {/* 5. الحالة */}
                      <td className="px-6 py-4 align-top whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            row.workflowStatus === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : row.workflowStatus === 'pending_review'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : row.workflowStatus === 'rejected'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}
                        >
                          {statusLabel[row.workflowStatus]}
                        </span>
                      </td>

                      {/* 6. الإجراءات - مطابقة دقيقة 1:1 للصورة القديمة */}
                      <td className="px-4 py-4 align-top whitespace-nowrap min-w-[140px]">
                        <div className="flex flex-col items-center justify-center gap-1.5 w-full">
                          {/* الصف العلوي: اعتماد/رفض (زر واحد فقط حسب الحالة) + معاينة + نسخ */}
                          <div className="flex items-center gap-1">
                            {isAdmin && (
                              row.workflowStatus === 'approved' ? (
                                <button
                                  type="button"
                                  onClick={() => void workflow('rejected', row.id)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer border border-rose-200/60"
                                  title="رفض السؤال"
                                >
                                  رفض
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void workflow('approved', row.id)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer border border-emerald-200/60"
                                  title="اعتماد السؤال"
                                >
                                  اعتماد
                                </button>
                              )
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const media = resolveQuestionMedia(row.text, row.imageUrl);
                                if (media.resolvedImage || row.imageUrl) {
                                  setZoomImageUrl(media.resolvedImage || row.imageUrl || null);
                                } else {
                                  void openQuestion(row.id);
                                }
                              }}
                              className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="معاينة السؤال"
                            >
                              <Eye size={17} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void duplicateQuestion(row)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="نسخ السؤال"
                            >
                              <Copy size={17} />
                            </button>
                          </div>

                          {/* الصف السفلي: تعديل + حذف */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void openQuestion(row.id)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="تعديل السؤال"
                            >
                              <Edit2 size={17} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteQuestion(row.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف السؤال"
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-slate-50/50">
          <button
            type="button"
            disabled={filters.page! <= 1}
            onClick={() => setFilters((x) => ({ ...x, page: (x.page || 1) - 1 }))}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-black text-gray-700 disabled:opacity-40 hover:bg-gray-50 shadow-xs cursor-pointer"
          >
            <ChevronRight size={16} /> الصفحة السابقة
          </button>
          <span className="text-xs font-bold text-gray-500">صفحة {filters.page || 1}</span>
          <button
            type="button"
            disabled={!hasMore}
            onClick={() => setFilters((x) => ({ ...x, page: (x.page || 1) + 1 }))}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-black text-gray-700 disabled:opacity-40 hover:bg-gray-50 shadow-xs cursor-pointer"
          >
            الصفحة التالية <ChevronLeft size={16} />
          </button>
        </div>
      </section>

      {/* Modal 1: Image Zoom Modal */}
      {zoomImageUrl ? (
        <QuestionImageZoomModal imageUrl={zoomImageUrl} onClose={() => setZoomImageUrl(null)} />
      ) : null}

      {/* Modal 2: Question Presentation & Review Panel (Modal Overlay) */}
      {detail ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl p-6 max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-xs font-black text-violet-700">
                  {detail.questionCode} · v{detail.currentVersion}
                </span>
                <h2 className="text-lg font-black text-gray-900">مراجعة وتعديل عرض السؤال</h2>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <QuestionPresentationEditor
              key={`${detail.id}:${detail.currentVersion}`}
              question={detail}
              getCsrf={getCsrfToken}
              onUpdated={(updated) => {
                setDetail(updated);
                setReload((value) => value + 1);
              }}
            />

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-violet-700">
                  {detail.questionCode} · v{detail.currentVersion}
                </span>
                <div className="flex items-center gap-1.5">
                  {detail.version.optionsEmbeddedInImage ? (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-800">
                      خيارات بالصورة
                    </span>
                  ) : null}
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black shadow-xs">
                    {statusLabel[detail.workflowStatus]}
                  </span>
                </div>
              </div>
              <h3 className="mt-2 text-base font-black leading-relaxed">
                {detail.version.text || 'سؤال بصري / صورة'}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                <span>{typeLabel[detail.version.type]}</span>
                <span>•</span>
                <span>الصعوبة: {detail.version.difficulty || 'متوسط'}</span>
                {detail.version.source ? (
                  <>
                    <span>•</span>
                    <span>المصدر: {detail.version.source}</span>
                  </>
                ) : null}
              </div>
            </div>

            {/* صورة السؤال المعتمدة */}
            {detail.version.imageUrl || detail.version.imageAssetId ? (
              <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white p-3 shadow-xs">
                <p className="mb-2 text-xs font-black text-violet-800">صورة السؤال المعتمدة:</p>
                {detail.version.imageUrl ? (
                  <img
                    src={detail.version.imageUrl}
                    alt={detail.questionCode}
                    className="mx-auto max-h-72 sm:max-h-80 w-full rounded-xl object-contain cursor-pointer"
                    onClick={() => setZoomImageUrl(detail.version.imageUrl || null)}
                  />
                ) : (
                  <QuestionAssetImage
                    assetId={detail.version.imageAssetId}
                    alt={detail.questionCode}
                    className="mx-auto max-h-72 sm:max-h-80 rounded-xl object-contain"
                  />
                )}
              </div>
            ) : null}

            {/* فيديو شرح السؤال */}
            {detail.version.videoUrl ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-3 text-xs font-bold text-blue-900">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                    <Play size={14} className="fill-current" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-blue-950">فيديو شرح حل المسألة</p>
                    <p className="text-[11px] text-blue-700 font-medium truncate">{detail.version.videoUrl}</p>
                  </div>
                </div>
                <a
                  href={detail.version.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-700 transition"
                >
                  فتح الفيديو <ExternalLink size={12} />
                </a>
              </div>
            ) : null}

            {/* الخيارات والإجابة الصحيحة */}
            {detail.options && detail.options.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-black text-gray-500">الخيارات والإجابة المعتمدة:</p>
                <div className="grid gap-2">
                  {detail.options.map((opt, i) => {
                    const isCorrect = i === detail.version.correctOptionIndex;
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between rounded-xl border p-2.5 text-xs font-bold transition-colors ${
                          isCorrect
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-xs'
                            : 'border-gray-200 bg-white text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                              isCorrect ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {['أ', 'ب', 'ج', 'د'][i] || i + 1}
                          </span>
                          <span>{opt.text || `خيار ${i + 1}`}</span>
                        </div>
                        {isCorrect ? (
                          <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">
                            الإجابة الصحيحة ✓
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* الشرح واستراتيجية الحل */}
            {detail.version.explanation ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-xs leading-relaxed text-indigo-950">
                <b className="text-indigo-900">الشرح وتوضيح الإجابة:</b> {detail.version.explanation}
              </div>
            ) : null}

            {detail.version.solvingStrategy ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-2.5 text-xs leading-relaxed text-emerald-950">
                <b className="text-emerald-900">استراتيجية الحل السريع في قياس:</b>{' '}
                {detail.version.solvingStrategy}
              </div>
            ) : null}

            {/* أزرار العمليات */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              {detail.workflowStatus === 'draft' || detail.workflowStatus === 'rejected' ? (
                <button
                  type="button"
                  onClick={() => void workflow('pending_review')}
                  className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-slate-950 hover:bg-amber-400 cursor-pointer"
                >
                  إرسال للمراجعة
                </button>
              ) : null}
              {isAdmin && detail.workflowStatus === 'pending_review' ? (
                <>
                  <button
                    type="button"
                    onClick={() => void workflow('approved')}
                    className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white hover:bg-emerald-600 cursor-pointer"
                  >
                    اعتماد
                  </button>
                  <button
                    type="button"
                    onClick={() => void workflow('rejected')}
                    className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-black text-white hover:bg-rose-600 cursor-pointer"
                  >
                    رفض
                  </button>
                </>
              ) : null}
              {isAdmin && detail.workflowStatus !== 'archived' ? (
                <button
                  type="button"
                  onClick={() => void workflow('archived')}
                  className="rounded-xl border px-3 py-2 text-xs font-black hover:bg-gray-50 cursor-pointer"
                >
                  <Archive size={14} className="inline ml-1" /> أرشفة
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Dry Run Batch Import */}
      {isAdmin ? (
        <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-sky-700" />
            <div>
              <p className="text-xs font-black text-sky-700">V2 IMPORT</p>
              <h2 className="font-black">استيراد إداري بفحص جاف أولًا</h2>
            </div>
          </div>
          <p className="mt-2 text-sm leading-7 text-gray-500">
            هذه الواجهة تستخدم manifest JSON محدوداً (حتى 100 عنصر) وتنفذ فحصاً جافاً (dry-run) للتحقق من سلامة الأصول
            والتصنيف قبل الكتابة.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_2fr]">
            <div>
              <input
                aria-label="معرف دفعة الاستيراد"
                value={importBatchId}
                onChange={(e) => {
                  setImportBatchId(e.target.value);
                  setImportDryRunPassed(false);
                }}
                placeholder="BATCH_2026_001"
                className="w-full rounded-xl border p-2.5"
              />
              {importResult ? (
                <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs">
                  <b>{importResult.status}</b> · prepared {importResult.prepared}/{importResult.requested}
                  {importResult.issues.length ? (
                    <p className="mt-2 text-rose-700">
                      {importResult.issues[0]?.code}: {importResult.issues[0]?.message}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div>
              <textarea
                aria-label="JSON عناصر الاستيراد"
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setImportDryRunPassed(false);
                }}
                className="min-h-40 w-full rounded-xl border p-3 font-mono text-xs"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void importBatch(true)}
                  className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-black text-white cursor-pointer"
                >
                  فحص جاف
                </button>
                <button
                  type="button"
                  disabled={!importDryRunPassed}
                  onClick={() => void importBatch(false)}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-40 cursor-pointer"
                >
                  تنفيذ الدفعة المطابقة
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-7 text-violet-950">
        <b>حدود الملكية:</b> Taxonomy يملك شجرة التصنيف، Media يملك دورة حياة الملف وR2، Question Bank يحتفظ
        بالمعرفات والعلاقات والإصدارات فقط.
      </section>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <article className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-violet-700">{icon}</div>
      <p className="mt-2 text-xs font-bold text-gray-500">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </article>
  );
}
