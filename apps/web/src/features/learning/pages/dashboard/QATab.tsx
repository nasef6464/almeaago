import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Loader2, MessageCircle, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../auth/state/AuthProvider';
import { contentClient } from '../../../content/api/content-client';
import type { TaxonomyCore } from '../../../content/api/content-types';

type QAResult = Awaited<ReturnType<typeof contentClient.qaList>>;
type QAItem = QAResult['items'][number];

export const QATab: React.FC = () => {
  const { user, getCsrfToken } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'answered' | 'pending'>('all');
  const [showAskModal, setShowAskModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [submittedMessage, setSubmittedMessage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [qaList, setQaList] = useState<QAItem[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyCore>({ paths: [], subjects: [] });
  const [requestId, setRequestId] = useState(() => `qa-tab-${Date.now()}`);

  const loadQuestions = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const res = await contentClient.qaList({ filter, q: search.trim(), limit: 50 }, signal);
      setQaList(res.items || []);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'تعذر تحميل الأسئلة والأجوبة.');
      }
    } finally {
      setLoading(false);
    }
  }, [filter, search, user]);

  useEffect(() => {
    const controller = new AbortController();
    loadQuestions(controller.signal);
    return () => controller.abort();
  }, [loadQuestions]);

  useEffect(() => {
    const controller = new AbortController();
    contentClient
      .taxonomyCore(controller.signal)
      .then((core) => setTaxonomy(core))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => qaList, [qaList]);

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newQuestion.trim().length < 5) {
      setError('يرجى كتابة سؤال واضح لا يقل عن 5 أحرف.');
      return;
    }
    const subj = taxonomy.subjects.find((s) => s.id === selectedSubjectId);
    setSubmitting(true);
    setError('');
    try {
      const csrf = await getCsrfToken();
      await contentClient.qaCreate(
        {
          subjectId: subj?.id || undefined,
          pathId: subj?.pathId || undefined,
          subjectName: subj?.name || 'عام',
          question: newQuestion.trim(),
          requestId,
        },
        csrf,
      );
      setNewQuestion('');
      setShowAskModal(false);
      setRequestId(`qa-tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      setSubmittedMessage(true);
      setTimeout(() => setSubmittedMessage(false), 4000);
      await loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال السؤال.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 w-full min-w-0" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black">
            <MessageCircle size={24} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">سؤال وجواب</h2>
            <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-slate-400 mt-0.5">
              اطرح أسئلتك واحصل على إجابات معتمدة من معلمي ومدربي منصة المئة.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/qa"
            className="inline-flex items-center rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50"
          >
            فتح صفحة الأسئلة الكاملة
          </Link>
          <button
            type="button"
            onClick={() => setShowAskModal(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs sm:text-sm font-black text-white transition shadow-xs"
          >
            <Plus size={16} />
            اطرح سؤالاً جديداً
          </button>
        </div>
      </div>

      {submittedMessage && (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 p-4 font-bold text-emerald-800 dark:text-emerald-300 animate-fade-in">
          تم إرسال سؤالك بنجاح وسيصلك الرد من المدرب المختص.
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في الأسئلة والشروحات..."
            className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 pr-10 pl-4 py-2.5 text-xs sm:text-sm font-bold text-gray-800 dark:text-slate-100 placeholder:text-gray-400"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {(
            [
              { id: 'all', label: 'الكل' },
              { id: 'answered', label: 'المجاب عنها' },
              { id: 'pending', label: 'بانتظار الرد' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                filter === tab.id
                  ? 'bg-sky-600 text-white font-black shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-100 dark:border-slate-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-sm font-bold text-gray-500">
          <Loader2 size={18} className="animate-spin text-sky-600" />
          جاري تحميل الأسئلة...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm font-bold text-gray-500">
          لا توجد أسئلة مطابقة حالياً.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition hover:border-sky-200 dark:hover:border-slate-700 hover:shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <span className="rounded-full bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900/60 px-3 py-0.5 text-xs font-black">
                  {item.subjectName}
                </span>
                <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500">
                  {new Date(item.createdAt).toLocaleDateString('ar-SA')}
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-snug">
                {item.question}
              </h3>

              {item.hasAnswer && item.latestReply ? (
                <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 border border-slate-100 dark:border-slate-700/80">
                  <div className="flex items-center gap-2 mb-2 text-xs font-black text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 size={15} />
                    <span>إجابة معتمدة · {item.latestReplyBy || 'المدرب'}</span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-gray-700 dark:text-slate-200 leading-relaxed">
                    {item.latestReply}
                  </p>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/50">
                  <Clock size={14} />
                  <span>السؤال قيد مراجعة المدرب وسيتم الرد عليه قريباً.</span>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {showAskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-gray-100 dark:border-slate-800 animate-fade-in">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">طرح سؤال تعليمي جديد</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-4 font-bold">
              اكتب سؤالك بوضوح وحدد المادة ليجيبك المدرب المختص.
            </p>

            <form onSubmit={handleAddQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">المادة</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-xs font-bold text-gray-800 dark:text-slate-100"
                >
                  <option value="">عام</option>
                  {taxonomy.subjects.map((subj) => (
                    <option key={subj.id} value={subj.id}>
                      {subj.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">نص السؤال</label>
                <textarea
                  rows={4}
                  required
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="اكتب سؤالك واستفسارك بالتفصيل..."
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs sm:text-sm font-bold text-gray-800 dark:text-slate-100 placeholder:text-gray-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAskModal(false)}
                  className="rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-gray-700 dark:text-slate-300 hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2 text-xs font-bold text-white transition shadow-xs disabled:opacity-60"
                >
                  {submitting ? 'جاري النشر...' : 'نشر السؤال'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
