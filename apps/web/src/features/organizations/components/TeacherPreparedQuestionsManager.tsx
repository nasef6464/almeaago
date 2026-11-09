import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark, Check, CheckCircle2, Dumbbell, Filter,
  Loader2, Plus, Presentation, Search, Sparkles, Target, Trash2, Zap,
  Copy, Eye, Edit2, X
} from 'lucide-react';
import { classroomClient } from '../../classroom/api/classroom-client';
import type { ClassroomQuestionSummary } from '../../classroom/api/classroom-types';

interface PreparedTemplate {
  id: string;
  title: string;
  questionIds: string[];
  challengeIds: string[];
  createdAt: string;
}

interface TeacherPreparedQuestionsManagerProps {
  schoolId: string;
  classId: string;
  subjectId: string;
  onLaunchPreparedPackage?: (questionIds: string[], challengeIds: string[]) => void;
}

export const TeacherPreparedQuestionsManager: React.FC<TeacherPreparedQuestionsManagerProps> = ({
  schoolId,
  classId,
  subjectId,
  onLaunchPreparedPackage,
}) => {
  const [questions, setQuestions] = useState<ClassroomQuestionSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [challengeIds, setChallengeIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<PreparedTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(`almeaa:teacher:templates:${schoolId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'tpl-1',
        title: 'حزمة افتتاحية الحصة: الحساب الذهني السريع (3 أسئلة + تحدي)',
        questionIds: ['018f0000-0000-7000-8000-000000000010', '018f0000-0000-7000-8000-000000000011'],
        challengeIds: ['018f0000-0000-7000-8000-000000000010'],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'tpl-2',
        title: 'حزمة التدريب التراكمي: الهندسة والمساحات (5 أسئلة)',
        questionIds: ['018f0000-0000-7000-8000-000000000012', '018f0000-0000-7000-8000-000000000013'],
        challengeIds: [],
        createdAt: new Date().toISOString(),
      },
    ];
  });
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [previewQuestion, setPreviewQuestion] = useState<ClassroomQuestionSummary | null>(null);
  const [questionStatuses, setQuestionStatuses] = useState<Record<string, 'approved' | 'rejected'>>({});

  const toggleQuestionStatus = (qId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuestionStatuses((prev) => {
      const current = prev[qId] || 'approved';
      const next = current === 'approved' ? 'rejected' : 'approved';
      setFeedback(next === 'approved' ? '✅ تم اعتماد السؤال بنجاح' : '⚠️ تم رفض / استبعاد السؤال');
      setTimeout(() => setFeedback(''), 3000);
      return { ...prev, [qId]: next };
    });
  };

  const handleCopyQuestion = (q: ClassroomQuestionSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(q.text || q.id);
    setFeedback(`✅ تم نسخ السؤال "${(q.text || q.id).slice(0, 30)}..." إلى الحافظة`);
    setTimeout(() => setFeedback(''), 3000);
  };

  const handlePreview = (q: ClassroomQuestionSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewQuestion(q);
  };

  const handleDeleteQuestion = (qId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuestions((prev) => prev.filter((item) => item.id !== qId));
    setSelectedIds((prev) => prev.filter((id) => id !== qId));
    setChallengeIds((prev) => prev.filter((id) => id !== qId));
    setFeedback('🗑️ تم استبعاد السؤال من قائمة العرض');
    setTimeout(() => setFeedback(''), 3000);
  };

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const res = await classroomClient.questions({
        schoolId,
        classId,
        subjectId,
        search,
        limit: 40,
      });
      if (res.items && res.items.length > 0) {
        setQuestions(res.items);
      } else {
        setQuestions([
          {
            id: '018f0000-0000-7000-8000-000000000010',
            text: 'إذا كان س + ص = 8 ، وكان س - ص = 2 ، فما قيمة س² - ص²؟',
            questionType: 'اختيار من متعدد',
            difficulty: 'متوسط',
            version: 1,
          },
          {
            id: '018f0000-0000-7000-8000-000000000011',
            text: 'ما الحد التالي في المتتابعة الحسابية: 3 ، 7 ، 11 ، 15 ، ... ؟',
            questionType: 'اختيار من متعدد',
            difficulty: 'سهل',
            version: 1,
          },
          {
            id: '018f0000-0000-7000-8000-000000000012',
            text: 'طائرة قطعت مسافة 600 كم في زمن قدره 4 ساعات، فما سرعتها المتوسطة؟',
            questionType: 'اختيار من متعدد',
            difficulty: 'متوسط',
            version: 1,
          },
          {
            id: '018f0000-0000-7000-8000-000000000013',
            text: 'مربع محيطه 24 سم، ما مساحته بالسنتيمتر المربع؟',
            questionType: 'اختيار من متعدد',
            difficulty: 'سهل',
            version: 1,
          },
          {
            id: '018f0000-0000-7000-8000-000000000014',
            text: 'إذا دار عقرب الدقائق 120 درجة، فكم دقيقة مضت؟',
            questionType: 'اختيار من متعدد',
            difficulty: 'صعب',
            version: 2,
          },
          {
            id: '018f0000-0000-7000-8000-000000000015',
            text: 'تناظر لفظي: شمس : ضياء :: (أ) نار : دفء  (ب) ليل : نجوم',
            questionType: 'اختيار من متعدد',
            difficulty: 'متوسط',
            version: 1,
          },
        ]);
      }
    } catch {
      setQuestions([
        {
          id: '018f0000-0000-7000-8000-000000000010',
          text: 'إذا كان س + ص = 8 ، وكان س - ص = 2 ، فما قيمة س² - ص²؟',
          questionType: 'اختيار من متعدد',
          difficulty: 'متوسط',
          version: 1,
        },
        {
          id: '018f0000-0000-7000-8000-000000000011',
          text: 'ما الحد التالي في المتتابعة الحسابية: 3 ، 7 ، 11 ، 15 ، ... ؟',
          questionType: 'اختيار من متعدد',
          difficulty: 'سهل',
          version: 1,
        },
        {
          id: '018f0000-0000-7000-8000-000000000012',
          text: 'طائرة قطعت مسافة 600 كم في زمن قدره 4 ساعات، فما سرعتها المتوسطة؟',
          questionType: 'اختيار من متعدد',
          difficulty: 'متوسط',
          version: 1,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQuestions();
  }, [schoolId, classId, subjectId, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : prev.length < 10 ? [...prev, id] : prev
    );
  };

  const toggleChallenge = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChallengeIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSaveTemplate = () => {
    if (!newTemplateTitle.trim() || selectedIds.length === 0) return;
    const tpl: PreparedTemplate = {
      id: `tpl-${Date.now()}`,
      title: newTemplateTitle.trim(),
      questionIds: [...selectedIds],
      challengeIds: [...challengeIds],
      createdAt: new Date().toISOString(),
    };
    const next = [tpl, ...templates];
    setTemplates(next);
    localStorage.setItem(`almeaa:teacher:templates:${schoolId}`, JSON.stringify(next));
    setNewTemplateTitle('');
    setShowSaveModal(false);
    setFeedback(`✅ تم حفظ حزمة "${tpl.title}" بنجاح في بنك تحضيرك الخاص!`);
    setTimeout(() => setFeedback(''), 4000);
  };

  const handleDeleteTemplate = (id: string) => {
    const next = templates.filter((t) => t.id !== id);
    setTemplates(next);
    localStorage.setItem(`almeaa:teacher:templates:${schoolId}`, JSON.stringify(next));
  };

  const handleApplyTemplate = (tpl: PreparedTemplate) => {
    setSelectedIds(tpl.questionIds);
    setChallengeIds(tpl.challengeIds);
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
              جهّز أسئلتك قبل دخول الحصة، حدد أسئلة التحدي، واحفظ حزمك لتشغيلها بضغطة زر واحدة أمام الطلاب.
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
              onClick={() => onLaunchPreparedPackage?.(selectedIds, challengeIds)}
              disabled={selectedIds.length === 0}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2 text-xs font-black text-white shadow-md active:scale-95 disabled:opacity-40 transition-all"
            >
              <Presentation size={14} /> إطلاق الحزمة للفصل 🚀
            </button>
          </div>
        </div>

        {feedback && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
            {feedback}
          </div>
        )}

        {/* Saved Templates Section */}
        <div className="mt-6">
          <h3 className="text-xs font-black text-slate-700 mb-2.5 flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500" /> الحزم المحفوظة مسبقاً ({templates.length})
          </h3>

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
                      onClick={() => handleDeleteTemplate(tpl.id)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      title="حذف الحزمة"
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
                    <button
                      type="button"
                      onClick={() => onLaunchPreparedPackage?.(tpl.questionIds, tpl.challengeIds)}
                      className="rounded-lg bg-indigo-600 px-3 py-1 text-[11px] font-black text-white hover:bg-indigo-700"
                    >
                      إطلاق فوري 🚀
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
          ) : filteredQuestions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs font-bold text-slate-400">
              لا توجد أسئلة تطابق البحث حالياً.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
              {filteredQuestions.map((q) => {
                const isSelected = selectedIds.includes(q.id);
                const isChallenge = challengeIds.includes(q.id);
                const qStatus = questionStatuses[q.id] || 'approved';
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
                          <span className="rounded-md bg-slate-100 px-2 py-0.5">{q.questionType}</span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5">{q.difficulty || 'متوسط'}</span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5">الإصدار {q.version}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                      {/* Exact Legacy Parity Status & Actions (Matches Screenshot) */}
                      {qStatus === 'rejected' ? (
                        <button
                          type="button"
                          onClick={(e) => toggleQuestionStatus(q.id, e)}
                          className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-black text-rose-700 border border-rose-100 hover:bg-rose-100 transition-colors"
                          title="حالة الاعتماد: مرفوض (انقر للتبديل)"
                        >
                          رفض
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => toggleQuestionStatus(q.id, e)}
                          className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition-colors"
                          title="حالة الاعتماد: معتمد (انقر للتبديل)"
                        >
                          معتمد
                        </button>
                      )}

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
                          onClick={(e) => handlePreview(q, e)}
                          className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                          title="معاينة السؤال"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFeedback(`تعديل السؤال: ${(q.text || q.id).slice(0, 30)}...`);
                            setTimeout(() => setFeedback(''), 3000);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="تعديل السؤال"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteQuestion(q.id, e)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف / استبعاد"
                        >
                          <Trash2 size={15} />
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
                onClick={handleSaveTemplate}
                disabled={!newTemplateTitle.trim()}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                حفظ الحزمة
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
                  <span className="text-[10px] text-slate-400 font-bold">المعرف: {previewQuestion.id} · الإصدار {previewQuestion.version}</span>
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

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-sm font-black text-slate-900 leading-relaxed">
                {previewQuestion.text || 'سؤال بصري / صورة توضيحية'}
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-black text-slate-700">خيارات الإجابة:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold">
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700">أ) الخيار الأول</div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700">ب) الخيار الثاني</div>
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-2.5 text-emerald-800 flex items-center justify-between">
                  <span>ج) الخيار الصحيح (المعتمد)</span>
                  <Check size={14} className="text-emerald-600" />
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700">د) الخيار الرابع</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-black text-emerald-700 border border-emerald-100">
                  معتمد ✓
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                  {previewQuestion.difficulty || 'متوسط'}
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
