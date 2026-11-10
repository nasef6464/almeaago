import React, { useState, useMemo } from 'react';
import {
  PlusCircle,
  X,
  Search,
  Filter,
  CheckCircle2,
  Send,
  Layers,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import type { ClassroomQuestionSummary } from '../../api/classroom-types';

interface ClassroomPushQuestionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  availableQuestions: ClassroomQuestionSummary[];
  selectedIds: string[];
  onToggleQuestion: (id: string) => void;
  onSelectCount: (count: number) => void;
  onClearSelection: () => void;
  onSubmitBatch: (batchLabel: string) => void;
  busy?: boolean;
}

export const ClassroomPushQuestionsDrawer: React.FC<ClassroomPushQuestionsDrawerProps> = ({
  isOpen,
  onClose,
  availableQuestions,
  selectedIds,
  onToggleQuestion,
  onSelectCount,
  onClearSelection,
  onSubmitBatch,
  busy = false,
}) => {
  const [search, setSearch] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [batchLabel, setBatchLabel] = useState('دفعة تدريب تفاعلية');

  const filteredQuestions = useMemo(() => {
    return availableQuestions.filter((q) => {
      if (search && !q.text?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterDifficulty !== 'all' && q.difficulty !== filterDifficulty) return false;
      if (filterType !== 'all' && q.questionType !== filterType) return false;
      return true;
    });
  }, [availableQuestions, search, filterDifficulty, filterType]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs" dir="rtl">
      <div className="flex h-full max-h-[85vh] w-full max-w-3xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <PlusCircle size={20} />
            </span>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                إرسال أسئلة جديدة أثناء الحصة
              </h3>
              <p className="text-xs font-bold text-slate-500">
                اختر أسئلة معتمدة من بنك الأسئلة أو حزمة سريعة لنشرها فوراً على جوالات الطلاب
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Batch Select Bar */}
        <div className="border-b border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-600 dark:text-slate-300">
                تحديد سريع:
              </span>
              <button
                type="button"
                onClick={() => onSelectCount(1)}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                1 سؤال
              </button>
              <button
                type="button"
                onClick={() => onSelectCount(3)}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                3 أسئلة
              </button>
              <button
                type="button"
                onClick={() => onSelectCount(5)}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                5 أسئلة
              </button>
              <button
                type="button"
                onClick={() => onSelectCount(10)}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                10 أسئلة
              </button>
            </div>

            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={onClearSelection}
                className="text-xs font-bold text-rose-600 hover:underline"
              >
                مسح التحديد ({selectedIds.length})
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="relative">
              <Search className="absolute right-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="بحث في نص السؤال…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-9 text-xs font-bold focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <select
              aria-label="تصفية حسب الصعوبة"
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="all">كافة المستويات</option>
              <option value="easy">سهل</option>
              <option value="medium">متوسط</option>
              <option value="hard">متقدم</option>
            </select>

            <select
              aria-label="تصفية حسب نوع السؤال"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="all">كافة الأنواع</option>
              <option value="mcq">اختيار من متعدد</option>
              <option value="true_false">صح أو خطأ</option>
            </select>
          </div>
        </div>

        {/* Questions list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredQuestions.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-slate-400">
              لا توجد أسئلة مطابقة للبحث.
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const isSelected = selectedIds.includes(q.id);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onToggleQuestion(q.id)}
                  className={`w-full rounded-2xl border p-4 text-right transition ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/70 shadow-xs dark:border-indigo-700 dark:bg-indigo-950/40'
                      : 'border-slate-200 bg-white hover:border-indigo-200 dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 font-bold leading-7 text-slate-900 dark:text-slate-100 text-sm">
                      {q.text || 'سؤال بصري'}
                    </div>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-black ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-slate-400">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                      v{q.version}
                    </span>
                    <span>{q.questionType === 'mcq' ? 'اختيار من متعدد' : 'صح/خطأ'}</span>
                    <span>·</span>
                    <span>صعوبة: {q.difficulty || 'متوسط'}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-700 dark:text-slate-300">
              المحدد: {selectedIds.length} سؤال
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              aria-label="اسم الدفعة"
              value={batchLabel}
              onChange={(e) => setBatchLabel(e.target.value)}
              placeholder="اسم الدفعة"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <button
              type="button"
              disabled={selectedIds.length === 0 || busy}
              onClick={() => onSubmitBatch(batchLabel)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-indigo-700 disabled:opacity-40"
            >
              <Send size={15} />
              نشر الدفعة الآن للطلاب
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
