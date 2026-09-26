import {
  Bookmark,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Loader2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import type { TaxonomyCore } from '../../content/api/content-types';
import {
  learningClient,
  type ReviewItem,
  type ReviewTab,
  type SkillProgress,
} from '../api/learning-client';

const tabLabels: Record<ReviewTab, string> = {
  all: 'الكل',
  mistakes: 'أخطائي',
  saved: 'المحفوظة',
};

const statusLabel: Record<SkillProgress['status'], string> = {
  weak: 'تحتاج دعمًا',
  average: 'متوسطة',
  good: 'جيدة',
  mastered: 'متقنة',
};

const optionLetter = (index: number) =>
  ['أ', 'ب', 'ج', 'د', 'هـ', 'و'][index] || String(index + 1);

export function ReviewLibraryPage() {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const [searchParams] = useSearchParams();
  const [taxonomy, setTaxonomy] = useState<TaxonomyCore>({ paths: [], subjects: [] });
  const [pathId, setPathId] = useState(searchParams.get('pathId') || '');
  const [subjectId, setSubjectId] = useState(searchParams.get('subjectId') || '');
  const [tab, setTab] = useState<ReviewTab>('all');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextAction, setNextAction] = useState<SkillProgress | null>(null);
  const [progress, setProgress] = useState<SkillProgress[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    contentClient.taxonomyCore(controller.signal).then(setTaxonomy).catch(() => {});
    return () => controller.abort();
  }, []);

  const subjects = useMemo(
    () => taxonomy.subjects.filter((subject) => !pathId || subject.pathId === pathId),
    [pathId, taxonomy.subjects],
  );

  useEffect(() => {
    if (subjectId && !subjects.some((subject) => subject.id === subjectId)) {
      setSubjectId('');
    }
  }, [subjectId, subjects]);

  useEffect(() => {
    setPage(1);
  }, [pathId, subjectId, tab]);

  useEffect(() => {
    if (authLoading || !user || !user.roles.includes('student') || !pathId) {
      setItems([]);
      setProgress([]);
      setNextAction(null);
      setHasMore(false);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    setError('');
    Promise.all([
      learningClient.reviewLibrary(tab, pathId, subjectId, page, 20, controller.signal),
      learningClient.progress(pathId, subjectId, 1, 8, controller.signal),
      learningClient.nextAction(pathId, subjectId, controller.signal),
    ])
      .then(([review, mastery, action]) => {
        setItems(review.items);
        setHasMore(review.hasMore);
        setProgress(mastery.items);
        setNextAction(action.item);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'تعذر تحميل مكتبة المراجعة');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [authLoading, page, pathId, reload, subjectId, tab, user]);

  async function toggleSaved(item: ReviewItem) {
    setSaving(item.card.questionId);
    setError('');
    try {
      const csrf = await getCsrfToken();
      if (item.card.savedForReview) {
        await learningClient.unsaveReview(item.card.questionId, csrf);
      } else {
        await learningClient.saveReview(item.card.questionId, csrf);
      }
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحديث الحفظ للمراجعة');
    } finally {
      setSaving('');
    }
  }

  if (authLoading) {
    return <main className="p-10 text-center font-black">جاري التحقق من الجلسة...</main>;
  }
  if (!user || !user.roles.includes('student')) {
    return <main className="p-10 text-center font-black text-rose-700">هذه الشاشة مخصصة للطالب.</main>;
  }

  return (
    <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="rounded-3xl bg-slate-950 p-5 text-white">
          <div className="flex items-center gap-2 text-amber-400">
            <BrainCircuit size={20} />
            <span className="text-xs font-black">REVIEW & MASTERY</span>
          </div>
          <h1 className="mt-2 text-2xl font-black">أسئلتي للمراجعة</h1>
          <p className="mt-1 text-sm text-slate-300">
            الأخطاء والمحفوظات في بطاقة واحدة لكل سؤال، مع خطوة تالية محسوبة من أدلة إجاباتك فقط.
          </p>
        </header>

        <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-black text-gray-600">المسار</span>
            <select
              aria-label="مسار المراجعة"
              value={pathId}
              onChange={(event) => {
                setPathId(event.target.value);
                setSubjectId('');
              }}
              className="w-full rounded-xl border p-2.5"
            >
              <option value="">اختر المسار</option>
              {taxonomy.paths.map((path) => (
                <option key={path.id} value={path.id}>{path.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-black text-gray-600">المادة</span>
            <select
              aria-label="مادة المراجعة"
              value={subjectId}
              disabled={!pathId}
              onChange={(event) => setSubjectId(event.target.value)}
              className="w-full rounded-xl border p-2.5 disabled:bg-gray-50"
            >
              <option value="">كل مواد المسار</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </label>
        </section>

        {pathId && nextAction ? (
          <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black text-indigo-600">الخطوة التالية</p>
                <h2 className="mt-1 font-black text-indigo-950">{nextAction.recommendedAction}</h2>
                <p className="mt-1 text-xs font-bold text-indigo-700">
                  أقل إتقان حالي: {nextAction.mastery.toFixed(1)}% · {statusLabel[nextAction.status]} · {nextAction.evidenceCount} دليل
                </p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
                <div className="text-2xl font-black text-indigo-900">{nextAction.mastery.toFixed(0)}%</div>
                <div className="text-[11px] font-black text-indigo-500">MASTERY</div>
              </div>
            </div>
          </section>
        ) : null}

        {pathId && progress.length > 1 ? (
          <section className="rounded-2xl border bg-white p-4">
            <p className="text-xs font-black text-gray-500">أدلة الإتقان الحالية</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {progress.slice(0, 4).map((item, index) => (
                <div key={item.skillId} className="rounded-xl bg-gray-50 p-3">
                  <div className="text-xs font-bold text-gray-500">مهارة {index + 1}</div>
                  <div className="mt-1 text-xl font-black text-gray-900">{item.mastery.toFixed(0)}%</div>
                  <div className="text-[11px] font-bold text-gray-500">{statusLabel[item.status]}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid grid-cols-3 gap-2 rounded-2xl border bg-white p-2">
          {(Object.entries(tabLabels) as Array<[ReviewTab, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-xl px-3 py-2.5 text-sm font-black ${
                tab === value ? 'bg-slate-950 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </section>

        {error ? (
          <div className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}</div>
        ) : null}

        {!pathId ? (
          <div className="rounded-2xl border border-dashed bg-white p-10 text-center font-bold text-gray-500">
            اختر مسارًا لعرض أسئلتك بدون خلط أدلة مسارات مختلفة.
          </div>
        ) : busy ? (
          <div className="rounded-2xl bg-white p-10 text-center font-bold text-gray-500">
            <Loader2 className="mx-auto mb-2 animate-spin" size={22} />
            جاري تحميل المراجعة...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white p-10 text-center font-bold text-gray-500">
            لا توجد أسئلة في هذا التصنيف.
          </div>
        ) : (
          <section className="space-y-3">
            {items.map((item) => (
              <article key={item.card.cardId} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {item.card.hasMistake ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700">
                        <CircleAlert size={13} />
                        خطأ سابق
                      </span>
                    ) : null}
                    {item.card.savedForReview ? (
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">
                        محفوظ
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={saving === item.card.questionId}
                    onClick={() => void toggleSaved(item)}
                    className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-40"
                  >
                    {saving === item.card.questionId ? <Loader2 size={14} className="animate-spin" /> : <Bookmark size={14} />}
                    {item.card.savedForReview ? 'إزالة من المحفوظة' : 'حفظ للمراجعة'}
                  </button>
                </div>

                <h2 className="mt-3 text-base font-black leading-7 text-gray-900">
                  {item.question.text || item.question.imageAlt || 'سؤال بصري'}
                </h2>

                <div className="mt-4 grid gap-2">
                  {item.question.options.map((option) => {
                    const correct = item.question.correctOptionIndex === option.index;
                    return (
                      <div
                        key={option.index}
                        className={`rounded-xl border p-3 text-sm font-bold ${
                          correct
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                            : 'border-gray-100 bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="ml-2 inline-block min-w-7 rounded-lg bg-white p-1 text-center">
                          {optionLetter(option.index)}
                        </span>
                        {item.question.optionsEmbeddedInImage ? '' : option.text}
                        {correct ? <span className="mr-2 text-xs">الإجابة الصحيحة</span> : null}
                      </div>
                    );
                  })}
                </div>

                {item.question.explanation || item.question.hint || item.question.solvingStrategy ? (
                  <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm leading-7 text-amber-950">
                    {item.question.explanation ? <p><strong>الشرح:</strong> {item.question.explanation}</p> : null}
                    {item.question.hint ? <p><strong>تلميح:</strong> {item.question.hint}</p> : null}
                    {item.question.solvingStrategy ? <p><strong>طريقة الحل:</strong> {item.question.solvingStrategy}</p> : null}
                  </div>
                ) : null}
              </article>
            ))}
          </section>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-2 font-black disabled:opacity-40"
          >
            <ChevronRight size={17} />
            السابق
          </button>
          <span className="text-sm font-black text-gray-500">صفحة {page}</span>
          <button
            type="button"
            disabled={!hasMore}
            onClick={() => setPage((value) => value + 1)}
            className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-2 font-black disabled:opacity-40"
          >
            التالي
            <ChevronLeft size={17} />
          </button>
        </div>
      </div>
    </main>
  );
}
