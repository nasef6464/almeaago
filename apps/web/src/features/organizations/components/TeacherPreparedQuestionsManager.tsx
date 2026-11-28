import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark, Check, Loader2, Presentation, Search, Sparkles, Target, Trash2, Zap,
  Copy, Eye, X
} from 'lucide-react';
import { useAuth } from '../../auth/state/AuthProvider';
import { classroomClient } from '../../classroom/api/classroom-client';
import type { ClassroomQuestionSummary } from '../../classroom/api/classroom-types';
import { questionBankClient, type ClassroomPreparedTemplate, type QuestionDetail } from '../../questionbank/api/questionbank-client';

type QuestionPreview = Pick<QuestionDetail, 'id' | 'questionCode' | 'currentVersion' | 'workflowStatus' | 'text' | 'imageUrl' | 'difficulty' | 'options'> &
  Partial<Pick<QuestionDetail, 'version'>>;

const questionTypeLabels: Record<ClassroomQuestionSummary['questionType'], string> = {
  mcq: 'اختيار من متعدد',
  true_false: 'صح أو خطأ',
};
const difficultyLabels: Record<string, string> = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };

interface TeacherPreparedQuestionsManagerProps {
  schoolId: string;
  classId: string;
  subjectId: string;
  onLaunchPreparedPackage: (questionIds: string[], challengeIds: string[]) => void;
}

export const TeacherPreparedQuestionsManager: React.FC<TeacherPreparedQuestionsManagerProps> = ({
  schoolId,
  classId,
  subjectId,
  onLaunchPreparedPackage,
}) => {
  const { getCsrfToken } = useAuth();
  const [questions, setQuestions] = useState<ClassroomQuestionSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [challengeIds, setChallengeIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [questionsError, setQuestionsError] = useState('');
  const [reloadQuestionsTick, setReloadQuestionsTick] = useState(0);
  const [templates, setTemplates] = useState<ClassroomPreparedTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState('');
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');
  const [previewQuestion, setPreviewQuestion] = useState<QuestionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleCopyQuestion = async (q: ClassroomQuestionSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionError('');
    setFeedback('');
    try {
      await navigator.clipboard.writeText(q.text || q.id);
      setFeedback('تم نسخ السؤال إلى الحافظة.');
    } catch {
      setActionError('تعذر نسخ السؤال إلى الحافظة.');
    }
  };

  const handlePreview = async (q: ClassroomQuestionSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewLoading(true);
    setActionError('');
    try {
      try {
        const res = await questionBankClient.get(q.id);
        setPreviewQuestion(res.question);
      } catch {
        const { question } = await questionBankClient.getApprovedQuestionPreview(q.id);
        setPreviewQuestion({
          ...question,
          currentVersion: question.version ?? q.version,
          workflowStatus: 'approved',
          version: undefined,
          options: (question.options ?? []).map(option => ({
            ...option, text: option.text || question.embeddedOptionTexts?.[option.index] || '',
          })),
        });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر تحميل تفاصيل السؤال للمعاينة.');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    setSelectedIds([]);
    setChallengeIds([]);
    setActionError('');
    setFeedback('');
  }, [schoolId, classId, subjectId]);

  useEffect(() => {
    if (!schoolId) {
      setTemplates([]);
      return;
    }
    const controller = new AbortController();
    setTemplates([]);
    setTemplatesLoading(true);
    setTemplatesError('');
    questionBankClient
      .listClassroomTemplates(schoolId, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setTemplates(res.templates);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setTemplates([]);
          setTemplatesError(err instanceof Error ? err.message : 'تعذر تحميل حزم التحضير المحفوظة.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setTemplatesLoading(false);
        }
      });
    return () => controller.abort();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId || !classId || !subjectId) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setQuestionsError('');
    classroomClient
      .questions(
        {
          schoolId,
          classId,
          subjectId,
          search,
          limit: 40,
        },
        controller.signal,
      )
      .then((res) => {
        if (!controller.signal.aborted) {
          setQuestions(res.items || []);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setQuestions([]);
          setQuestionsError(err instanceof Error ? err.message : 'تعذر تحميل أسئلة المادة المعتمدة.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [schoolId, classId, subjectId, search, reloadQuestionsTick]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        setChallengeIds((cPrev) => cPrev.filter((cId) => cId !== id));
        return prev.filter((i) => i !== id);
      }
      return prev.length < 10 ? [...prev, id] : prev;
    });
  };

  const toggleChallenge = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedIds.includes(id)) return;
    setChallengeIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateTitle.trim() || selectedIds.length === 0 || !schoolId || savingTemplate) return;
    setSavingTemplate(true);
    setActionError('');
    setFeedback('');
    try {
      const csrf = await getCsrfToken();
      const validChallenges = challengeIds.filter((id) => selectedIds.includes(id));
      const { template } = await questionBankClient.createClassroomTemplate(
        {
          schoolId,
          title: newTemplateTitle.trim(),
          questionIds: [...selectedIds],
          challengeIds: validChallenges,
        },
        csrf,
      );
      setTemplates((prev) => [template, ...prev]);
      setNewTemplateTitle('');
      setShowSaveModal(false);
      setFeedback(`✅ تم حفظ حزمة "${template.title}" في الخادم بنجاح!`);
      setTimeout(() => setFeedback(''), 4000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر حفظ حزمة التحضير في الخادم.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (deletingTemplateId) return;
    setDeletingTemplateId(id);
    setActionError('');
    try {
      const csrf = await getCsrfToken();
      await questionBankClient.deleteClassroomTemplate(id, csrf);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setFeedback('🗑️ تم حذف حزمة التحضير من الخادم.');
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر حذف حزمة التحضير.');
    } finally {
      setDeletingTemplateId('');
    }
  };

  const handleApplyTemplate = (tpl: ClassroomPreparedTemplate) => {
    setSelectedIds(tpl.questionIds);
    setChallengeIds(tpl.challengeIds);
    setActionError('');
    setFeedback(`✅ تم تطبيق حزمة "${tpl.title}" وتحديد أسئلتها (${tpl.questionIds.length} أسئلة)!`);
    setTimeout(() => setFeedback(''), 4000);
  };

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (difficultyFilter !== 'all' && q.difficulty !== difficultyFilter) return false;
      return true;
    });
  }, [questions, difficultyFilter]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Bar */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
              <Target className="text-indigo-600" size={22} /> بنك التحضير المسبق وحزم التحدي الصفية
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              اختر أسئلة الحصة والتحدي، واحفظها في حزمة للرجوع إليها.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSaveModal(true)}
              disabled={selectedIds.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 transition-colors"
            >
              <Bookmark size={14} /> حفظ كحزمة تحضير ({selectedIds.length})
            </button>

            <button
              type="button"
              disabled={!selectedIds.length || !schoolId || !classId || !subjectId}
              onClick={() => onLaunchPreparedPackage(selectedIds, challengeIds)}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2 text-xs font-black text-white shadow-md active:scale-95 disabled:opacity-40 transition-all"
            >
              <Presentation size={14} /> إطلاق الحزمة للفصل 🚀
            </button>
          </div>
        </div>

        {feedback && (
          <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
            {feedback}
          </div>
        )}
        {actionError && (
          <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
            {actionError}
          </div>
        )}

        {/* Saved Templates Section */}
        <div className="mt-6">
          <h3 className="text-xs font-black text-slate-700 mb-2.5 flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500" /> الحزم المحفوظة مسبقاً ({templates.length})
          </h3>

          {templatesLoading ? (
            <div role="status" className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-bold text-slate-500">
              جارٍ تحميل الحزم المحفوظة…
            </div>
          ) : templatesError ? (
            <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
              {templatesError}
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs font-bold text-slate-500">
              لا توجد حزم تحضير محفوظة لهذه المدرسة بعد. اختر أسئلة ثم اضغط «حفظ كحزمة تحضير».
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 hover:border-indigo-200 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs sm:text-sm text-slate-900 truncate max-w-[240px]">
                        {tpl.title}
                      </span>
                      <button
                        type="button"
                        disabled={deletingTemplateId === tpl.id}
                        onClick={() => void handleDeleteTemplate(tpl.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 disabled:opacity-40"
                        title="حذف الحزمة"
                        aria-label={`حذف حزمة ${tpl.title}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {tpl.questionIds.length} أسئلة صفية · {tpl.challengeIds.length} أسئلة تحدي ⚡
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/50 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      {new Date(tpl.createdAt).toLocaleDateString('ar-SA')}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleApplyTemplate(tpl)}
                        className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50"
                      >
                        تحديد الأسئلة
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Questions Selector from Question Bank */}
        <div className="mt-8 border-t border-slate-100 pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                أسئلة بنك المنصة والمدرسة المعتمدة ({filteredQuestions.length} سؤال متاح)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                اختر حتى 10 أسئلة للحصة، وانقر على علامة البرق لتعيين السؤال كسؤال تحدي سريع.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث في السؤال..."
                  className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 pr-8 pl-3 text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">كل الصعوبات</option>
                <option value="easy">سهل</option>
                <option value="medium">متوسط</option>
                <option value="hard">صعب</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-10 text-xs font-bold text-slate-400">
              <Loader2 className="mx-auto mb-2 animate-spin text-indigo-600" size={24} />
              جارٍ تحميل أسئلة المادة المعتمدة...
            </div>
          ) : questionsError ? (
            <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-xs font-bold text-rose-700 space-y-2">
              <p>{questionsError}</p>
              <button
                type="button"
                onClick={() => setReloadQuestionsTick((t) => t + 1)}
                className="rounded-lg bg-white border border-rose-200 px-3 py-1 text-xs font-black text-rose-700 hover:bg-rose-100"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs font-bold text-slate-400">
              لا توجد أسئلة معتمدة متاحة تطابق البحث حالياً.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
              {filteredQuestions.map((q) => {
                const isSelected = selectedIds.includes(q.id);
                const isChallenge = challengeIds.includes(q.id);
                return (
                  <div
                    key={q.id}
                    onClick={() => toggleSelect(q.id)}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(q.id)}
                        className="mt-1 rounded text-indigo-600 shrink-0"
                      />
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 leading-6">
                          {q.text || 'سؤال بصري / بدون نص صريح'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-slate-500 font-bold">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5">{questionTypeLabels[q.questionType]}</span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5">{difficultyLabels[q.difficulty] ?? 'صعوبة غير محددة'}</span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5">الإصدار {q.version}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black text-emerald-700 border border-emerald-100">
                        معتمد
                      </span>

                      <div className="flex items-center gap-1 border-r border-slate-200 pr-2 mr-1">
                        <button
                          type="button"
                          onClick={(e) => handleCopyQuestion(q, e)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="نسخ السؤال"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          type="button"
                          disabled={previewLoading}
                          onClick={(e) => void handlePreview(q, e)}
                          className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
                          title="معاينة السؤال"
                          aria-label={`معاينة السؤال ${q.text || q.id}`}
                        >
                          <Eye size={15} />
                        </button>
                      </div>

                      {isSelected && (
                        <button
                          type="button"
                          onClick={(e) => toggleChallenge(q.id, e)}
                          className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-black transition-all ${
                            isChallenge
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Zap size={13} />
                          <span>{isChallenge ? 'تحدي ⚡' : 'تعيين كتحدي'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Save Template Dialog */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-slate-900">حفظ حزمة التحضير الصفية</h3>
            <p className="text-xs text-slate-500">
              سيتم حفظ ({selectedIds.length}) أسئلة و({challengeIds.length}) أسئلة تحدي لاستدعائها فوراً في أي وقت.
            </p>
            <input
              type="text"
              value={newTemplateTitle}
              onChange={(e) => setNewTemplateTitle(e.target.value)}
              placeholder="مثال: حزمة مراجعة المتتابعات - الأسبوع الثالث"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void handleSaveTemplate()}
                disabled={!newTemplateTitle.trim() || savingTemplate}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                {savingTemplate ? 'جارٍ الحفظ...' : 'حفظ الحزمة'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Question Preview Modal */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs" dir="rtl">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                  <Eye size={18} />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900">معاينة السؤال</h3>
                  <span className="text-[10px] text-slate-400 font-bold">المعرف: {previewQuestion.questionCode || previewQuestion.id} · الإصدار {previewQuestion.currentVersion}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewQuestion(null)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 space-y-2">
              <p className="text-sm font-black text-slate-900 leading-relaxed">
                {previewQuestion.version?.text || previewQuestion.text || 'سؤال بصري / صورة توضيحية'}
              </p>
              {previewQuestion.version?.imageUrl || previewQuestion.imageUrl ? (
                <img
                  src={previewQuestion.version?.imageUrl || previewQuestion.imageUrl}
                  alt={previewQuestion.version?.imageAlt || 'صورة السؤال'}
                  className="max-h-48 max-w-full rounded-xl object-contain"
                />
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-black text-slate-700">خيارات الإجابة:</div>
              {previewQuestion.options && previewQuestion.options.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold">
                  {previewQuestion.options.map((opt, idx) => {
                    const isCorrect = previewQuestion.version?.correctOptionIndex === opt.index;
                    const label = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'][idx] || String(idx + 1);
                    return (
                      <div
                        key={opt.index}
                        className={`rounded-xl border p-2.5 flex items-center justify-between ${
                          isCorrect
                            ? 'border-emerald-300 bg-emerald-50/70 text-emerald-800'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <span>{label}) {opt.text || 'خيار مصور'}</span>
                        {isCorrect ? <Check size={14} className="text-emerald-600" /> : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs font-bold text-slate-500">لا توجد خيارات نصية مرفقة لهذا السؤال.</p>
              )}
              {previewQuestion.version?.explanation ? (
                <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 p-3 text-xs font-bold text-indigo-900">
                  الشرح: {previewQuestion.version.explanation}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-black text-emerald-700 border border-emerald-100">
                  {previewQuestion.workflowStatus === 'approved' ? 'معتمد ✓' : previewQuestion.workflowStatus}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                  {difficultyLabels[previewQuestion.version?.difficulty || previewQuestion.difficulty] ?? 'صعوبة غير محددة'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewQuestion(null)}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-black text-white hover:bg-slate-800"
              >
                إغلاق المعاينة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
