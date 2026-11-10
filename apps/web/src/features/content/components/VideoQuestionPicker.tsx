import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Eye, Loader2, RefreshCw, Search, X } from 'lucide-react';
import {
  questionBankClient,
  type QuestionDetail,
  type QuestionSummary,
} from '../../questionbank/api/questionbank-client';
import { normalizeQuestionHtml } from '../../../lib/questionHtml';

export interface VideoQuestionPickerContext {
  pathId?: string;
  subjectId?: string;
  skillIds?: string[];
}

export interface SelectedPickerQuestion {
  id: string;
  questionCode: string;
  text: string;
  options: string[];
  correctOptionIndex: number;
  imageUrl?: string;
}

interface VideoQuestionPickerProps {
  context: VideoQuestionPickerContext;
  excludedQuestionIds: string[];
  selectionMode?: 'single' | 'multiple';
  onConfirm: (questions: SelectedPickerQuestion[]) => void;
  onClose: () => void;
}

const PAGE_SIZE = 15;

export const VideoQuestionPicker: React.FC<VideoQuestionPickerProps> = ({
  context,
  excludedQuestionIds,
  selectionMode = 'single',
  onConfirm,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [page, setPage] = useState(1);
  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [selected, setSelected] = useState<Map<string, QuestionSummary>>(() => new Map());
  const [previewingQuestion, setPreviewingQuestion] = useState<QuestionDetail | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const excluded = useMemo(() => new Set(excludedQuestionIds), [excludedQuestionIds]);
  const visibleQuestions = useMemo(
    () => questions.filter((question) => !excluded.has(question.id)),
    [excluded, questions],
  );

  useEffect(() => {
    setPage(1);
  }, [search, difficulty]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const result = await questionBankClient.list({
          page,
          limit: PAGE_SIZE,
          pathId: context.pathId || undefined,
          subjectId: context.subjectId || undefined,
          search: search.trim() || undefined,
          difficulty: difficulty || undefined,
          workflowStatus: 'approved',
        });
        if (!active) return;
        setQuestions(result.items || []);
        setHasMore(result.hasMore);
      } catch (requestError) {
        if (!active) return;
        setQuestions([]);
        setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل أسئلة البنك الآن.');
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [context.pathId, context.subjectId, difficulty, page, search]);

  const toggleQuestion = (question: QuestionSummary) => {
    setSelected((previous) => {
      const next = new Map(selectionMode === 'single' ? [] : previous);
      if (next.has(question.id)) {
        next.delete(question.id);
      } else {
        if (selectionMode === 'single') next.clear();
        next.set(question.id, question);
      }
      return next;
    });
  };

  const loadPreview = async (questionId: string) => {
    setLoadingPreview(true);
    try {
      const res = await questionBankClient.get(questionId);
      setPreviewingQuestion(res.question);
    } catch {
      // preview error handled gracefully
    } finally {
      setLoadingPreview(false);
    }
  };

  const confirm = async () => {
    const items = Array.from(selected.values());
    if (items.length === 0) return;
    setConfirming(true);

    try {
      const resolvedQuestions: SelectedPickerQuestion[] = [];
      for (const item of items) {
        const res = await questionBankClient.get(item.id);
        const detail = res.question;
        const options = Array.isArray(detail.options)
          ? detail.options.map((o) => o.text)
          : ['أ', 'ب', 'ج', 'د'];
        resolvedQuestions.push({
          id: detail.id,
          questionCode: detail.questionCode,
          text: detail.version?.text || 'سؤال',
          options,
          correctOptionIndex: detail.version?.correctOptionIndex ?? 0,
          imageUrl: detail.version?.imageAssetId ? `/api/v1/media/assets/${detail.version.imageAssetId}` : undefined,
        });
      }
      onConfirm(resolvedQuestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إدراج الأسئلة المختارة.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="منتقي أسئلة الفيديو"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 p-4 sm:p-5">
          <div>
            <h3 className="text-lg font-black text-gray-900">اختيار أسئلة داخل الفيديو</h3>
            <p className="mt-1 text-sm font-medium text-gray-500">
              من بنك الأسئلة المعتمد. اختر السؤال وسيتم دمجه تفاعلياً عند النقطة الزمنية المحددة.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="إغلاق المنتقي"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="border-b border-gray-100 bg-gray-50/70 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute right-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بنص السؤال أو الرمز..."
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-10 text-sm font-medium text-gray-800 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm font-medium text-gray-800 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">جميع مستويات الصعوبة</option>
                <option value="easy">سهل (Easy)</option>
                <option value="medium">متوسط (Medium)</option>
                <option value="hard">صعب (Hard)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 p-4 text-center text-sm font-bold text-red-600">{error}</div>
          ) : visibleQuestions.length === 0 ? (
            <div className="py-16 text-center text-sm font-bold text-gray-400">لا توجد أسئلة تطابق الفلتر الحالي.</div>
          ) : (
            <div className="space-y-2">
              {visibleQuestions.map((q) => {
                const isSelected = selected.has(q.id);
                return (
                  <div
                    key={q.id}
                    onClick={() => toggleQuestion(q)}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all ${isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-lg border transition ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white'
                          }`}
                      >
                        {isSelected ? <Check size={14} /> : null}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-indigo-600">{q.questionCode}</span>
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">
                            {q.difficulty}
                          </span>
                        </div>
                        <div
                          className="mt-1 line-clamp-2 text-sm font-medium text-gray-800"
                          dangerouslySetInnerHTML={{
                            __html: normalizeQuestionHtml(q.text || q.source || q.questionCode),
                          }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void loadPreview(q.id);
                      }}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      title="معاينة السؤال"
                    >
                      <Eye size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer / Pagination */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/70 p-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 disabled:opacity-40"
            >
              <ChevronRight size={18} />
            </button>
            <span className="text-xs font-bold text-gray-600">الصفحة {page}</span>
            <button
              type="button"
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-500">تم تحديد: {selected.size}</span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || confirming}
              onClick={() => void confirm()}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40"
            >
              {confirming ? <Loader2 size={16} className="animate-spin" /> : null}
              تأكيد الإدراج
            </button>
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      {previewingQuestion ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-black text-indigo-600">
                  {previewingQuestion.questionCode}
                </span>
                <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
                  {previewingQuestion.difficulty}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingQuestion(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4">
              {previewingQuestion.version?.imageAssetId ? (
                <div className="mb-3 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 p-2 text-center">
                  <img
                    src={`/api/v1/media/assets/${previewingQuestion.version.imageAssetId}`}
                    alt="صورة السؤال"
                    className="max-h-52 w-full object-contain mx-auto"
                  />
                </div>
              ) : null}
              <div
                className="text-base font-bold leading-relaxed text-gray-900"
                dangerouslySetInnerHTML={{
                  __html: normalizeQuestionHtml(previewingQuestion.version?.text),
                }}
              />
              <div className="mt-4 space-y-2">
                {previewingQuestion.options?.map((opt, i) => {
                  const isCorrect = i === previewingQuestion.version?.correctOptionIndex;
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between rounded-xl border p-3 text-sm font-medium ${isCorrect
                          ? 'border-emerald-500 bg-emerald-50 font-bold text-emerald-900'
                          : 'border-gray-200 bg-gray-50 text-gray-700'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-black text-slate-700">
                          {['أ', 'ب', 'ج', 'د', 'هـ'][i] || i + 1}
                        </span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: normalizeQuestionHtml(typeof opt === 'string' ? opt : opt.text),
                          }}
                        />
                      </div>
                      {isCorrect ? (
                        <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">
                          الإجابة الصحيحة
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
