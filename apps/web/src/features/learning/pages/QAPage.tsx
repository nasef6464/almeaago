import { ArrowRight, CheckCircle2, HelpCircle, MessageSquare, Plus, Search, X } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import type { TaxonomyCore } from '../../content/api/content-types';

type QAData = Awaited<ReturnType<typeof contentClient.qaList>>;
type QAItem = QAData['items'][number];

export default function QAPage() {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const location = useLocation();

  const [items, setItems] = useState<QAItem[]>([]);
  const [stats, setStats] = useState({ total: 0, answered: 0, pending: 0 });
  const [filter, setFilter] = useState<'all' | 'answered' | 'pending'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [taxonomy, setTaxonomy] = useState<TaxonomyCore>({ paths: [], subjects: [] });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [requestId, setRequestId] = useState(() => `qa-${Date.now()}`);

  const loadFeed = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const res = await contentClient.qaList({ filter, q: search.trim(), limit: 60 }, signal);
      setItems(res.items);
      setStats(res.stats);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'تعذر تحميل الأسئلة والأجوبة.');
      }
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    loadFeed(controller.signal);
    return () => controller.abort();
  }, [user, loadFeed]);

  useEffect(() => {
    const controller = new AbortController();
    contentClient
      .taxonomyCore(controller.signal)
      .then((core) => setTaxonomy(core))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!authLoading && !user) {
    return <Navigate replace to={`/login?next=${encodeURIComponent(location.pathname)}`} />;
  }

  async function handleCreateQuestion(event: FormEvent) {
    event.preventDefault();
    setSubmitError('');
    if (questionText.trim().length < 5) {
      setSubmitError('يرجى كتابة سؤال واضح لا يقل عن 5 أحرف.');
      return;
    }
    const subj = taxonomy.subjects.find((s) => s.id === selectedSubjectId);
    setSubmitting(true);
    try {
      const csrf = await getCsrfToken();
      await contentClient.qaCreate(
        {
          subjectId: subj?.id || undefined,
          pathId: subj?.pathId || undefined,
          subjectName: subj?.name || 'عام',
          question: questionText.trim(),
          requestId,
        },
        csrf,
      );
      setQuestionText('');
      setModalOpen(false);
      setRequestId(`qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      await loadFeed();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'تعذر إرسال السؤال.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/dashboard?tab=qa"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
          >
            <ArrowRight size={15} />
            <span>العودة للوحة الطالب</span>
          </Link>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
          >
            <Plus size={15} />
            <span>اطرح سؤالاً جديداً</span>
          </button>
        </div>

        <header className="rounded-3xl border border-indigo-100 bg-white p-5 sm:p-6 shadow-2xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                <HelpCircle size={14} />
                <span>بنك الأسئلة والإجابات</span>
              </span>
              <h1 className="mt-2 text-xl sm:text-2xl font-black text-slate-900">
                أسئلة الطلاب وإجابات المعلمين
              </h1>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-lg font-black text-slate-900">{stats.total}</div>
                <div className="text-[11px] font-bold text-slate-500">الإجمالي</div>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                <div className="text-lg font-black text-emerald-700">{stats.answered}</div>
                <div className="text-[11px] font-bold text-emerald-700">مجاب عنها</div>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2">
                <div className="text-lg font-black text-amber-700">{stats.pending}</div>
                <div className="text-[11px] font-bold text-amber-700">بانتظار الرد</div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['all', 'الكل'],
                  ['answered', 'مجاب عنها'],
                  ['pending', 'قيد الانتظار'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-black transition ${
                    filter === key
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث في الأسئلة أو المواد..."
                aria-label="بحث في الأسئلة والأجوبة"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-9 pl-3 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </header>

        {error && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div role="status" className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">
            جاري تحميل الأسئلة والأجوبة...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <MessageSquare size={32} className="mx-auto text-slate-300" />
            <h2 className="mt-3 text-base font-black text-slate-800">لا توجد أسئلة مطابقة حالياً</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              يمكنك طرح سؤالك الأول الآن وسيصلك رد المعلم فور إضافته.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-indigo-50 px-3 py-1 font-black text-indigo-700">
                      {item.subjectName}
                    </span>
                    {item.courseTitle && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">
                        {item.courseTitle}
                      </span>
                    )}
                    <span className="font-bold text-slate-500">{item.authorName}</span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-black ${
                      item.hasAnswer
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {item.hasAnswer && <CheckCircle2 size={13} />}
                    <span>{item.hasAnswer ? 'مجاب عنه' : 'بانتظار الرد'}</span>
                  </span>
                </div>

                <h2 className="mt-3 text-sm sm:text-base font-black text-slate-900 leading-relaxed">
                  {item.question}
                </h2>

                {item.latestReply && (
                  <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5 text-xs sm:text-sm">
                    <div className="font-black text-emerald-800">
                      إجابة {item.latestReplyBy || 'المدرب'}:
                    </div>
                    <p className="mt-1 font-medium text-slate-800 leading-relaxed">{item.latestReply}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="طرح سؤال جديد"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">طرح سؤال جديد</h2>
              <button
                type="button"
                aria-label="إغلاق النافذة"
                onClick={() => setModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateQuestion} className="mt-4 space-y-4">
              {submitError && (
                <div role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                  {submitError}
                </div>
              )}
              <div>
                <label htmlFor="qa-subject" className="block text-xs font-black text-slate-700 mb-1">
                  المادة
                </label>
                <select
                  id="qa-subject"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800"
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
                <label htmlFor="qa-question" className="block text-xs font-black text-slate-700 mb-1">
                  نص السؤال
                </label>
                <textarea
                  id="qa-question"
                  rows={4}
                  required
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="اكتب سؤالك بالتفصيل ليتمكن المدرب من مساعدتك..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-60"
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
}
