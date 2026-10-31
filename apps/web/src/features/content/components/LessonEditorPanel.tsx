import { CheckCircle2, HelpCircle, Loader2, Play, Plus, RotateCcw, Save, Trash2, Video, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { contentClient } from '../api/content-client';
import type {
  CreateLessonInput,
  LessonDetail,
  LessonType,
  TaxonomyCore,
  TaxonomyFull,
  UpdateLessonInput,
} from '../api/content-types';

export interface InteractiveVideoQuestion {
  id: string;
  timestamp: number;
  rewatchTimestamp: number;
  actionOnFail: 'continue' | 'rewatch';
  mustPass: boolean;
  inlineQuestion: {
    text: string;
    options: string[];
    correctOptionIndex: number;
  };
}

interface LessonEditorPanelProps {
  lessonId?: string;
  coreTaxonomy: TaxonomyCore;
  initialPathId: string;
  initialSubjectId: string;
  initialSkillIds?: string[];
  requiredSkillIds?: string[];
  scopeContext?: 'teacher' | 'skill';
  lockScope: boolean;
  getCsrfToken(): Promise<string>;
  onCancel(): void;
  onSaved(): void;
}

const lessonTypes: Array<{ value: LessonType; label: string }> = [
  { value: 'video', label: 'فيديو' },
  { value: 'text', label: 'نص / مقال' },
  { value: 'assignment', label: 'تكليف' },
  { value: 'file', label: 'ملف' },
  { value: 'live_youtube', label: 'بث يوتيوب مباشر' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'teams', label: 'Microsoft Teams' },
];

function toLocalDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function LessonEditorPanel({
  lessonId,
  coreTaxonomy,
  initialPathId,
  initialSubjectId,
  initialSkillIds = [],
  requiredSkillIds = [],
  scopeContext = 'teacher',
  lockScope,
  getCsrfToken,
  onCancel,
  onSaved,
}: LessonEditorPanelProps) {
  const editing = Boolean(lessonId);
  const [existing, setExisting] = useState<LessonDetail | null>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomyFull>({ ...coreTaxonomy, skills: [] });
  const [loading, setLoading] = useState(editing);
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [pathId, setPathId] = useState(initialPathId);
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<LessonType>('video');
  const [contentText, setContentText] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoSource, setVideoSource] = useState<CreateLessonInput['videoSource']>('youtube');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [meetingAt, setMeetingAt] = useState('');
  const [recordingUrl, setRecordingUrl] = useState('');
  const [joinInstructions, setJoinInstructions] = useState('');
  const [showRecording, setShowRecording] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [skillIds, setSkillIds] = useState<string[]>(() => [...new Set([...initialSkillIds, ...requiredSkillIds])]);
  const [interactiveQuestions, setInteractiveQuestions] = useState<InteractiveVideoQuestion[]>([]);

  function addInteractiveQuestion() {
    const newQ: InteractiveVideoQuestion = {
      id: `iq-${Date.now()}`,
      timestamp: 30,
      rewatchTimestamp: 0,
      actionOnFail: 'continue',
      mustPass: true,
      inlineQuestion: {
        text: '',
        options: ['', '', '', ''],
        correctOptionIndex: 0,
      },
    };
    setInteractiveQuestions((prev) => [...prev, newQ]);
  }

  function updateInteractiveQuestion(id: string, updater: (prev: InteractiveVideoQuestion) => InteractiveVideoQuestion) {
    setInteractiveQuestions((prev) => prev.map((q) => (q.id === id ? updater(q) : q)));
  }

  function removeInteractiveQuestion(id: string) {
    setInteractiveQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function applyLesson(row: LessonDetail) {
    setExisting(row);
    setPathId(row.pathId);
    setSubjectId(row.subjectId);
    setTitle(row.title);
    setDescription(row.description || '');
    setType(row.type as LessonType);
    setContentText(row.contentText || '');
    if (row.type === 'video' && row.contentText) {
      try {
        const parsed = JSON.parse(row.contentText);
        if (Array.isArray(parsed.interactiveQuestions)) {
          setInteractiveQuestions(parsed.interactiveQuestions);
        }
      } catch {
        // ignore non-json
      }
    }
    setDurationSeconds(row.durationSeconds || 0);
    setVideoUrl(row.videoUrl || '');
    setVideoSource(row.videoSource || '');
    setMeetingUrl(row.meetingUrl || '');
    setMeetingAt(toLocalDateTime(row.meetingAt));
    setRecordingUrl(row.recordingUrl || '');
    setJoinInstructions(row.joinInstructions || '');
    setShowRecording(row.showRecording);
    setIsVisible(row.isVisible);
    setIsLocked(row.isLocked);
    setSkillIds(row.skillIds || []);
  }

  useEffect(() => {
    const controller = new AbortController();
    contentClient
      .taxonomyFull(controller.signal)
      .then(setTaxonomy)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'تعذر تحميل المهارات.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setTaxonomyLoading(false);
      });

    if (lessonId) {
      contentClient
        .lesson(lessonId, controller.signal)
        .then((result) => applyLesson(result.lesson))
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) {
            setError(cause instanceof Error ? cause.message : 'تعذر تحميل الدرس.');
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }

    return () => controller.abort();
  }, [lessonId]);

  const subjects = useMemo(
    () => taxonomy.subjects.filter((subject) => !pathId || subject.pathId === pathId),
    [pathId, taxonomy.subjects],
  );
  const skills = useMemo(
    () => taxonomy.skills.filter((skill) => skill.subjectId === subjectId),
    [subjectId, taxonomy.skills],
  );

  useEffect(() => {
    if (subjectId && !subjects.some((subject) => subject.id === subjectId)) {
      setSubjectId('');
      setSkillIds([]);
    }
  }, [subjectId, subjects]);

  useEffect(() => {
    if (taxonomyLoading) return;
    setSkillIds((current) => current.filter((id) => skills.some((skill) => skill.id === id)));
  }, [skills, taxonomyLoading]);

  const lockedByWorkflow = Boolean(
    existing &&
      (existing.workflowStatus === 'approved' || existing.workflowStatus === 'archived'),
  );
  const scopeMismatch = Boolean(existing && lockScope && (
    existing.pathId !== initialPathId || existing.subjectId !== initialSubjectId ||
    requiredSkillIds.some((id) => !existing.skillIds.includes(id))
  ));
  const canMutate = !lockedByWorkflow && !scopeMismatch;
  const requiredSkillName = taxonomy.skills.find((skill) => skill.id === requiredSkillIds[0])?.name;
  const liveType = ['live_youtube', 'zoom', 'google_meet', 'teams'].includes(type);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (scopeMismatch) {
      setError('الدرس لا ينتمي إلى هذه المهارة أو مادتها. حدّث البيانات قبل التعديل.');
      return;
    }
    if (requiredSkillIds.some((id) => !skills.some((skill) => skill.id === id) || !skillIds.includes(id))) {
      setError('المهارة المحددة لم تعد متاحة ضمن مادة الدرس؛ أعد فتح منشئ الدرس.');
      return;
    }
    if (!pathId || !subjectId || !title.trim() || skillIds.length === 0) {
      setError('أكمل المسار والمادة والعنوان ومهارة واحدة على الأقل.');
      return;
    }

    let finalContent = contentText.trim();
    if (type === 'video') {
      finalContent = JSON.stringify({ interactiveQuestions });
    }

    const base: CreateLessonInput = {
      pathId,
      subjectId,
      title: title.trim(),
      description: description.trim(),
      type,
      contentText: finalContent,
      durationSeconds: Math.max(0, Math.trunc(durationSeconds || 0)),
      videoUrl: videoUrl.trim(),
      videoSource: videoSource || '',
      meetingUrl: meetingUrl.trim(),
      meetingAt: meetingAt ? new Date(meetingAt).toISOString() : null,
      recordingUrl: recordingUrl.trim(),
      joinInstructions: joinInstructions.trim(),
      showRecording,
      isVisible,
      isLocked,
      skillIds,
      assetIds: existing?.assetIds || [],
    };

    if ((type === 'text' || type === 'assignment') && !base.contentText) {
      setError('هذا النوع يحتاج محتوى نصيًا قبل الحفظ.');
      return;
    }
    if (type === 'video' && !base.videoUrl && base.assetIds.length === 0) {
      setError('أدخل رابط الفيديو، أو اربط ملف Media عند اكتمال منتقي الملفات.');
      return;
    }
    if (liveType && (!base.meetingUrl || !base.meetingAt)) {
      setError('الدرس المباشر يحتاج رابط الاجتماع وموعده.');
      return;
    }

    setSaving(true);
    try {
      const csrf = await getCsrfToken();
      if (existing && lessonId) {
        const update: UpdateLessonInput = {
          ...base,
          expectedRevision: existing.revision,
          ownerType: existing.ownerType as UpdateLessonInput['ownerType'],
          ownerUserId: existing.ownerUserId,
          ownerSchoolId: existing.ownerSchoolId,
          assignedTeacherId: existing.assignedTeacherId,
          revenueSharePercentage: existing.revenueSharePercentage,
        };
        await contentClient.updateLesson(lessonId, update, csrf);
      } else {
        await contentClient.createLesson(base, csrf);
      }
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ الدرس.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-[calc(100vh-5rem)] bg-gray-50 p-10 text-center font-black text-gray-500">جاري تحميل الدرس...</main>;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4">
      <form onSubmit={submit} className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 p-4">
          <div className="min-w-0">
            <div className="text-xs font-black text-indigo-600">منشئ الدروس الموحد</div>
            <h1 className="mt-1 truncate text-lg font-black text-gray-800">
              {editing ? 'تعديل الدرس' : 'إضافة درس جديد'}
            </h1>
            <p className="mt-1 truncate text-xs font-bold text-gray-400">{title.trim() || 'درس جديد'}</p>
          </div>
          <button type="button" onClick={onCancel} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-200 hover:text-gray-700" aria-label="إغلاق منشئ الدرس">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
        {lockScope ? <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{scopeContext === 'skill' ? `نطاق الدرس مثبت على المسار والمادة للمهارة ${requiredSkillName || 'المحددة'}.` : 'نطاق المعلم مثبت على المسار والمادة المختارين.'}</div> : null}
        {scopeMismatch ? <div role="alert" className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">الدرس لا ينتمي إلى هذه المهارة أو مادتها. لا يمكن حفظه من هنا.</div> : null}
        {lockedByWorkflow ? <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">الدرس معتمد أو مؤرشف؛ التعديل المباشر مقفول في الـBackend.</div> : null}
        {error ? <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div> : null}

        <section className="grid gap-5 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-black text-gray-700">عنوان الدرس *</span>
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
            <span className="text-sm font-black text-gray-700">نوع الدرس</span>
            <select disabled={!canMutate} value={type} onChange={(event) => setType(event.target.value as LessonType)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold disabled:bg-gray-50">
              {lessonTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-black text-gray-700">المدة بالثواني</span>
            <input disabled={!canMutate} type="number" min={0} value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value))} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold disabled:bg-gray-50" />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-black text-gray-700">الوصف</span>
            <textarea disabled={!canMutate} rows={4} maxLength={12000} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium leading-7 disabled:bg-gray-50" />
          </label>
        </section>

        {(type === 'text' || type === 'assignment') ? (
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            <label className="space-y-2">
              <span className="text-sm font-black text-gray-700">المحتوى النصي *</span>
              <textarea disabled={!canMutate} rows={12} maxLength={50000} value={contentText} onChange={(event) => setContentText(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm font-medium leading-7 disabled:bg-gray-50" />
            </label>
          </section>
        ) : null}

        {type === 'video' ? (
          <section className="grid gap-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 md:grid-cols-[180px_1fr]">
            <label className="space-y-2">
              <span className="text-sm font-black text-gray-700">مصدر الفيديو</span>
              <select disabled={!canMutate} value={videoSource} onChange={(event) => setVideoSource(event.target.value as CreateLessonInput['videoSource'])} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold disabled:bg-gray-50">
                <option value="youtube">YouTube</option>
                <option value="vimeo">Vimeo</option>
                <option value="upload">Media/R2</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-black text-gray-700">رابط الفيديو</span>
              <input disabled={!canMutate} type="url" maxLength={2048} value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold disabled:bg-gray-50" placeholder="https://..." />
            </label>
            {videoSource === 'upload' ? <p className="md:col-span-2 text-xs font-bold text-amber-700">رفع Media/R2 المباشر موجود في الـBackend؛ منتقي الملفات داخل Lesson Builder سيأتي في شريحة Media UI حتى لا تمر البايتات عبر Go.</p> : null}
          </section>
        ) : null}

        {type === 'video' ? (
          <section className="rounded-3xl border border-indigo-100 bg-indigo-50/40 p-5 shadow-sm sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-black text-gray-900 flex items-center gap-2">
                  <HelpCircle size={18} className="text-indigo-600" /> أسئلة داخل الفيديو (Interactive Video)
                </h4>
                <p className="text-xs font-bold text-gray-500 mt-0.5">
                  تظهر للطالب عند توقيت محدد أثناء تشغيل الفيديو لتثبيت المفهوم وتجميد الفيديو للمتابعة.
                </p>
              </div>
              <button
                type="button"
                disabled={!canMutate}
                onClick={addInteractiveQuestion}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Plus size={15} /> إضافة سؤال داخل الفيديو
              </button>
            </div>

            {interactiveQuestions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-indigo-200 bg-white p-6 text-center text-xs font-bold text-gray-400">
                لا توجد أسئلة تفاعلية مضافة لهذا الفيديو بعد. أضف سؤالاً ليظهر في توقيت محدد أثناء المشاهدة.
              </div>
            ) : (
              <div className="space-y-3">
                {interactiveQuestions.map((q, idx) => {
                  const minutes = Math.floor(q.timestamp / 60);
                  const seconds = q.timestamp % 60;
                  const rewatchMin = Math.floor(q.rewatchTimestamp / 60);
                  const rewatchSec = q.rewatchTimestamp % 60;
                  return (
                    <div key={q.id} className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                          سؤال {idx + 1}
                        </span>
                        <button
                          type="button"
                          disabled={!canMutate}
                          onClick={() => removeInteractiveQuestion(q.id)}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                          title="حذف السؤال"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-gray-700 mb-1">نص السؤال *</label>
                        <input
                          disabled={!canMutate}
                          value={q.inlineQuestion.text}
                          onChange={(e) => updateInteractiveQuestion(q.id, (prev) => ({
                            ...prev,
                            inlineQuestion: { ...prev.inlineQuestion, text: e.target.value },
                          }))}
                          placeholder="اكتب نص السؤال الذي سيظهر للطالب في هذا التوقيت..."
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold"
                        />
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {q.inlineQuestion.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-black text-slate-600">
                              {['أ', 'ب', 'ج', 'د'][optIdx] || optIdx + 1}
                            </span>
                            <input
                              disabled={!canMutate}
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...q.inlineQuestion.options];
                                newOpts[optIdx] = e.target.value;
                                updateInteractiveQuestion(q.id, (prev) => ({
                                  ...prev,
                                  inlineQuestion: { ...prev.inlineQuestion, options: newOpts },
                                }));
                              }}
                              placeholder={`الخيار ${optIdx + 1}`}
                              className="min-w-0 flex-1 rounded-xl border border-gray-200 px-2.5 py-1.5 text-xs font-medium"
                            />
                            <input
                              type="radio"
                              name={`correct-opt-${q.id}`}
                              checked={q.inlineQuestion.correctOptionIndex === optIdx}
                              onChange={() => updateInteractiveQuestion(q.id, (prev) => ({
                                ...prev,
                                inlineQuestion: { ...prev.inlineQuestion, correctOptionIndex: optIdx },
                              }))}
                              className="accent-emerald-600 cursor-pointer"
                              title="الإجابة الصحيحة"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="grid gap-3 pt-2 border-t border-gray-100 sm:grid-cols-4">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">التوقيت: دقيقة</label>
                          <input
                            disabled={!canMutate}
                            type="number"
                            min={0}
                            value={minutes}
                            onChange={(e) => updateInteractiveQuestion(q.id, (prev) => ({
                              ...prev,
                              timestamp: Math.max(0, Number(e.target.value) || 0) * 60 + (prev.timestamp % 60),
                            }))}
                            className="w-full rounded-xl border border-gray-200 p-2 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">التوقيت: ثانية</label>
                          <input
                            disabled={!canMutate}
                            type="number"
                            min={0}
                            max={59}
                            value={seconds}
                            onChange={(e) => updateInteractiveQuestion(q.id, (prev) => ({
                              ...prev,
                              timestamp: Math.floor(prev.timestamp / 60) * 60 + Math.min(59, Math.max(0, Number(e.target.value) || 0)),
                            }))}
                            className="w-full rounded-xl border border-gray-200 p-2 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">عند الخطأ</label>
                          <select
                            disabled={!canMutate}
                            value={q.actionOnFail}
                            onChange={(e) => updateInteractiveQuestion(q.id, (prev) => ({
                              ...prev,
                              actionOnFail: e.target.value as 'continue' | 'rewatch',
                            }))}
                            className="w-full rounded-xl border border-gray-200 bg-white p-2 text-xs font-bold"
                          >
                            <option value="continue">متابعة الدرس</option>
                            <option value="rewatch">إعادة المشاهدة من مقطع</option>
                          </select>
                        </div>
                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-2 text-xs font-black text-gray-700 cursor-pointer">
                            <input
                              disabled={!canMutate}
                              type="checkbox"
                              checked={q.mustPass}
                              onChange={(e) => updateInteractiveQuestion(q.id, (prev) => ({
                                ...prev,
                                mustPass: e.target.checked,
                              }))}
                              className="accent-indigo-600 h-4 w-4 rounded"
                            />
                            إجابة مطلوبة للمتابعة
                          </label>
                        </div>
                      </div>

                      {q.actionOnFail === 'rewatch' ? (
                        <div className="grid gap-2 grid-cols-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5 max-w-sm">
                          <label className="text-[11px] font-bold text-amber-900">
                            الرجوع إلى: دقيقة
                            <input
                              disabled={!canMutate}
                              type="number"
                              min={0}
                              value={rewatchMin}
                              onChange={(e) => updateInteractiveQuestion(q.id, (prev) => ({
                                ...prev,
                                rewatchTimestamp: Math.max(0, Number(e.target.value) || 0) * 60 + (prev.rewatchTimestamp % 60),
                              }))}
                              className="mt-1 w-full rounded-lg border border-amber-300 bg-white p-1.5 text-xs font-bold"
                            />
                          </label>
                          <label className="text-[11px] font-bold text-amber-900">
                            الرجوع إلى: ثانية
                            <input
                              disabled={!canMutate}
                              type="number"
                              min={0}
                              max={59}
                              value={rewatchSec}
                              onChange={(e) => updateInteractiveQuestion(q.id, (prev) => ({
                                ...prev,
                                rewatchTimestamp: Math.floor(prev.rewatchTimestamp / 60) * 60 + Math.min(59, Math.max(0, Number(e.target.value) || 0)),
                              }))}
                              className="mt-1 w-full rounded-lg border border-amber-300 bg-white p-1.5 text-xs font-bold"
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {liveType ? (
          <section className="grid gap-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-black text-gray-700">رابط الاجتماع *</span>
              <input disabled={!canMutate} type="url" maxLength={2048} value={meetingUrl} onChange={(event) => setMeetingUrl(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold disabled:bg-gray-50" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-black text-gray-700">موعد الاجتماع *</span>
              <input disabled={!canMutate} type="datetime-local" value={meetingAt} onChange={(event) => setMeetingAt(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold disabled:bg-gray-50" />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-black text-gray-700">تعليمات الانضمام</span>
              <textarea disabled={!canMutate} rows={4} maxLength={10000} value={joinInstructions} onChange={(event) => setJoinInstructions(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium disabled:bg-gray-50" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-black text-gray-700">رابط التسجيل</span>
              <input disabled={!canMutate} type="url" maxLength={2048} value={recordingUrl} onChange={(event) => setRecordingUrl(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold disabled:bg-gray-50" />
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm font-black text-gray-700">
              <input disabled={!canMutate} type="checkbox" checked={showRecording} onChange={(event) => setShowRecording(event.target.checked)} />
              إظهار التسجيل بعد اللقاء
            </label>
          </section>
        ) : null}

        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-black text-gray-900">المهارات *</h2>
          {taxonomyLoading ? <div className="mt-3 text-xs font-bold text-gray-500">جاري تحميل المهارات...</div> : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((skill) => {
              const checked = skillIds.includes(skill.id);
              return (
                <label key={skill.id} className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'}`}>
                  <input disabled={!canMutate || requiredSkillIds.includes(skill.id)} type="checkbox" checked={checked} onChange={() => setSkillIds((current) => checked ? current.filter((id) => id !== skill.id) : [...current, skill.id])} className="mt-1" />
                  <span className="font-bold text-gray-800">{skill.name}</span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="grid gap-3 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6">
          <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm font-black text-gray-700">
            <input disabled={!canMutate} type="checkbox" checked={isVisible} onChange={(event) => setIsVisible(event.target.checked)} />
            ظاهر على المنصة
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm font-black text-gray-700">
            <input disabled={!canMutate} type="checkbox" checked={isLocked} onChange={(event) => setIsLocked(event.target.checked)} />
            مغلق حسب الوصول
          </label>
        </section>

        </div>

        <section className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
            <CheckCircle2 size={17} className="text-emerald-600" />
            الحفظ لا يعتمد الدرس تلقائيًا؛ الاعتماد يظل خطوة مراجعة مستقلة.
          </div>
          <button type="submit" disabled={!canMutate || saving || taxonomyLoading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'جارٍ الحفظ...' : editing ? 'حفظ الدرس' : 'حفظ كمسودة'}
          </button>
        </section>
      </form>
    </div>
  );
}
