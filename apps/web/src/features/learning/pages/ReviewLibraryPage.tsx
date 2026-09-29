import {
  ArrowRight,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { QuestionAssistantPanel } from '../../ai/components/QuestionAssistantPanel';
import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import type { TaxonomyCore } from '../../content/api/content-types';
import {
  learningClient,
  type MasteryGoal,
  type MasteryGoalHorizon,
  type MasteryReadiness,
  type ReviewItem,
  type ReviewTab,
  type SkillProgress,
} from '../api/learning-client';

const tabLabels: Record<ReviewTab, string> = {
  all: 'الكل',
  mistakes: 'أخطأت فيها',
  saved: 'حفظتها للمراجعة',
};

const legacyReviewTabs: Array<[ReviewTab, string]> = [
  ['saved', 'حفظتها للمراجعة'],
  ['mistakes', 'أخطأت فيها'],
];

const statusLabel: Record<SkillProgress['status'], string> = {
  weak: 'تحتاج دعمًا',
  average: 'متوسطة',
  good: 'جيدة',
  mastered: 'متقنة',
};

const readinessStatusLabel: Record<MasteryReadiness['status'], string> = {
  needs_measurement: 'نحتاج قياسًا إضافيًا',
  building: 'نبني الجاهزية',
  ready_for_recheck: 'جاهز لإعادة القياس',
  ready_to_advance: 'جاهز للانتقال',
};

const optionLetter = (index: number) =>
  ['أ', 'ب', 'ج', 'د', 'هـ', 'و'][index] || String(index + 1);

function formatGoalDate(value: string) {
  if (!value) return 'بدون موعد محدد';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ReviewLibraryPage() {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const [searchParams] = useSearchParams();
  const [taxonomy, setTaxonomy] = useState<TaxonomyCore>({ paths: [], subjects: [] });
  const [pathId, setPathId] = useState(searchParams.get('pathId') || '');
  const [subjectId, setSubjectId] = useState(searchParams.get('subjectId') || '');
  const requestedTab = (searchParams.get('mode') || searchParams.get('tab') || 'saved') as ReviewTab;
  const [tab, setTab] = useState<ReviewTab>(
    requestedTab === 'saved' || requestedTab === 'mistakes' ? requestedTab : 'saved',
  );
  const [page, setPage] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextAction, setNextAction] = useState<SkillProgress | null>(null);
  const [progress, setProgress] = useState<SkillProgress[]>([]);
  const [readiness,setReadiness]=useState<MasteryReadiness|null>(null);
  const [goals, setGoals] = useState<MasteryGoal[]>([]);
  const [goalsHasMore, setGoalsHasMore] = useState(false);
  const [goalsBusy, setGoalsBusy] = useState(false);
  const [goalSaving, setGoalSaving] = useState('');
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
      setReadiness(null);
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
      learningClient.readiness(pathId,subjectId,controller.signal),
    ])
      .then(([review, mastery, action,ready]) => {
        setItems(review.items);
        setCurrentIndex(0);
        setShowAnswer(false);
        setHasMore(review.hasMore);
        setProgress(mastery.items);
        setNextAction(action.item);
        setReadiness(ready.readiness);
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

  useEffect(() => {
    if (authLoading || !user || !user.roles.includes('student') || !pathId) {
      setGoals([]);
      setGoalsHasMore(false);
      setGoalsBusy(false);
      return;
    }
    const controller = new AbortController();
    setGoalsBusy(true);
    learningClient
      .goals(pathId, subjectId, 'active', 1, 20, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setGoals(response.items);
        setGoalsHasMore(response.hasMore);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'تعذر تحميل أهداف الإتقان');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setGoalsBusy(false);
      });
    return () => controller.abort();
  }, [authLoading, pathId, subjectId, user]);

  const currentReview = items[currentIndex] || null;
  const canCreateShort = pathId !== '' && !goals.some((goal) => goal.horizon === 'short');
  const canCreateLong = pathId !== '' && !goals.some((goal) => goal.horizon === 'long');

  async function createGoal(horizon: MasteryGoalHorizon) {
    if (!pathId || goalSaving) return;
    setGoalSaving(`create:${horizon}`);
    setError('');
    try {
      const csrf = await getCsrfToken();
      const due = new Date();
      due.setDate(due.getDate() + (horizon === 'short' ? 14 : 60));
      const pathName = taxonomy.paths.find((item) => item.id === pathId)?.name || 'المسار الحالي';
      const response = await learningClient.createGoal(
        {
          pathId,
          subjectId,
          targetType: 'path',
          targetId: pathId,
          title: horizon === 'short'
            ? `هدف قصير لمسار ${pathName}`
            : `إتقان مسار ${pathName}`,
          targetMastery: 90,
          horizon,
          dueDate: due.toISOString().slice(0, 10),
        },
        csrf,
      );
      setGoals((current) => [response.goal, ...current.filter((goal) => goal.id !== response.goal.id)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إنشاء هدف الإتقان');
    } finally {
      setGoalSaving('');
    }
  }

  async function setGoalStatus(goal: MasteryGoal, status: 'achieved' | 'archived') {
    setGoalSaving(goal.id);
    setError('');
    try {
      const csrf = await getCsrfToken();
      await learningClient.updateGoal(goal, { status }, csrf);
      setGoals((current) => current.filter((item) => item.id !== goal.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحديث هدف الإتقان');
    } finally {
      setGoalSaving('');
    }
  }

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
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <header className="order-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" data-testid="legacy-review-library">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-gray-500 transition hover:text-gray-700" aria-label="العودة للوحة الطالب">
              <ArrowRight />
            </Link>
            <div>
              <h1 className="text-xl font-black text-emerald-700 sm:text-2xl">أسئلتي للمراجعة</h1>
              <p className="mt-1 text-xs font-bold text-gray-500 sm:text-sm">المحفوظة والأخطاء في مكان واحد.</p>
            </div>
          </div>
          {pathId ? (
            <Link
              to={`/review/practice?pathId=${encodeURIComponent(pathId)}&subjectId=${encodeURIComponent(subjectId)}&tab=${encodeURIComponent(tab)}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700"
            >
              <Sparkles size={16} />
              تدرّب على هذه الأسئلة
            </Link>
          ) : null}
        </header>

        <section className="order-2 grid gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-2">
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

        {pathId ? (
          <section className="order-8 rounded-3xl border border-indigo-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                  <Target size={14} />
                  أهداف الإتقان
                </div>
                <h2 className="mt-2 text-lg font-black text-gray-900">هدف قريب وهدف للمسار</h2>
                <p className="mt-1 text-sm font-bold leading-7 text-gray-500">
                  الهدف لا يغيّر درجة الإتقان؛ هو علامة متابعة مستقلة مبنية على نفس المسار والمادة.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canCreateShort || goalSaving !== ''}
                  onClick={() => void createGoal('short')}
                  className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {goalSaving === 'create:short' ? 'جاري الإنشاء...' : 'هدف قصير'}
                </button>
                <button
                  type="button"
                  disabled={!canCreateLong || goalSaving !== ''}
                  onClick={() => void createGoal('long')}
                  className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {goalSaving === 'create:long' ? 'جاري الإنشاء...' : 'هدف طويل'}
                </button>
              </div>
            </div>

            {goalsHasMore ? (
              <p className="mt-3 rounded-xl bg-amber-50 p-2 text-xs font-bold text-amber-800">
                لديك أهداف نشطة إضافية؛ هذه الشاشة تعرض أول 20 هدفًا فقط.
              </p>
            ) : null}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {goalsBusy ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
                  جاري تحميل الأهداف...
                </div>
              ) : goals.length ? (
                goals.map((goal) => (
                  <article key={goal.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-600">
                          {goal.horizon === 'short' ? 'قصير' : 'طويل'}
                        </span>
                        <h3 className="mt-2 font-black leading-7 text-gray-900">{goal.title}</h3>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2 text-center">
                        <div className="text-lg font-black text-indigo-700">{goal.targetMastery}%</div>
                        <div className="text-[10px] font-bold text-gray-400">الهدف</div>
                      </div>
                    </div>
                    <p className="mt-2 text-xs font-bold text-gray-500">{formatGoalDate(goal.dueDate)}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={goalSaving !== ''}
                        onClick={() => void setGoalStatus(goal, 'achieved')}
                        className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-black text-emerald-700 disabled:opacity-50"
                      >
                        تحقق
                      </button>
                      <button
                        type="button"
                        disabled={goalSaving !== ''}
                        onClick={() => void setGoalStatus(goal, 'archived')}
                        className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-600 disabled:opacity-50"
                      >
                        أرشفة
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm font-bold leading-7 text-slate-500 md:col-span-2">
                  لا يوجد هدف إتقان نشط بعد. أنشئ هدفًا قصيرًا أو طويلًا للمسار الحالي.
                </div>
              )}
            </div>
          </section>
        ) : null}

        {pathId && readiness ? (
          <section
            className="order-9 rounded-3xl border border-sky-100 bg-sky-50 p-4 sm:p-5"
            data-testid="mastery-readiness"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-black text-sky-700">جاهزية التعلم</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-sky-800 shadow-sm">
                    {readinessStatusLabel[readiness.status]}
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-black leading-7 text-sky-950">
                  {readiness.explanation}
                </h2>
                <p className="mt-2 text-xs font-bold text-sky-700">
                  أدلة موثوقة {readiness.reliableSkills}/{readiness.totalSkills} · إجمالي الأدلة {readiness.totalEvidence}
                </p>
              </div>
              <div className="min-w-24 rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
                <div className="text-3xl font-black text-sky-900">{readiness.score.toFixed(0)}</div>
                <div className="text-[10px] font-black text-sky-500">READINESS</div>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-sky-100">
              <div
                className="h-full rounded-full bg-sky-600"
                style={{ width: `${Math.max(0, Math.min(100, readiness.score))}%` }}
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
                <div className="text-lg font-black text-sky-950">{Math.round(readiness.coverage * 100)}%</div>
                <div className="text-[10px] font-black text-sky-600">التغطية</div>
              </div>
              <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
                <div className="text-lg font-black text-sky-950">{Math.round(readiness.evidenceConfidence * 100)}%</div>
                <div className="text-[10px] font-black text-sky-600">ثقة الأدلة</div>
              </div>
              <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
                <div className="text-lg font-black text-sky-950">{Math.round(readiness.recency * 100)}%</div>
                <div className="text-[10px] font-black text-sky-600">حداثة الأدلة</div>
              </div>
            </div>

            <p className="mt-3 text-[11px] font-bold leading-6 text-sky-700">
              مؤشر داخلي حتمي من الإتقان والتغطية وكفاية الأدلة وحداثتها؛ ليس توقعًا لدرجة اختبار خارجي.
            </p>
          </section>
        ) : null}

        {pathId && nextAction ? (
          <section className="order-10 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
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
          <section className="order-11 rounded-2xl border bg-white p-4">
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

        <section className="order-3 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
          {legacyReviewTabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-xl px-3 py-2.5 text-sm font-black ${
                tab === value ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-white/70'
              }`}
            >
              {label}
            </button>
          ))}
        </section>

        {error ? (
          <div className="order-4 rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}</div>
        ) : null}

        {!pathId ? (
          <div className="order-5 rounded-2xl border border-dashed bg-white p-10 text-center font-bold text-gray-500">
            <BookOpen className="mx-auto mb-3 text-gray-300" size={46} />
            اختر المسار لعرض أسئلتك بنفس مصدر ReviewCard الموحّد بدون خلط أدلة المسارات.
          </div>
        ) : busy ? (
          <div className="order-5 rounded-2xl bg-white p-10 text-center font-bold text-gray-500">
            <Loader2 className="mx-auto mb-2 animate-spin" size={22} />
            جاري تحميل المراجعة...
          </div>
        ) : items.length === 0 ? (
          <div className="order-5 rounded-2xl border-2 border-dashed border-gray-200 bg-white p-10 text-center font-bold text-gray-500">
            <BookOpen className="mx-auto mb-3 text-gray-300" size={46} />
            <h2 className="font-black text-gray-800">{tab === 'saved' ? 'لم تحفظ أسئلة للمراجعة حتى الآن.' : 'لا توجد أسئلة أخطأت فيها محفوظة للمراجعة.'}</h2>
            <p className="mt-2 text-sm font-bold text-gray-500">السؤال لا يُنسخ هنا؛ يتم استدعاؤه من بنك الأسئلة بنفس الهوية.</p>
          </div>
        ) : (
          <section className="order-5 space-y-3">
            {items.slice(currentIndex, currentIndex + 1).map((item) => (
              <article key={item.card.cardId} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {item.card.hasMistake ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700">
                        <RotateCcw size={13} />
                        خطأ سابق
                      </span>
                    ) : null}
                    {item.card.savedForReview ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">
                        <Bookmark size={13} />
                        محفوظ للمراجعة
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
                    {item.card.savedForReview ? <><Trash2 size={14} />إزالة من المحفوظة</> : <>حفظ للمراجعة</>}
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
                          correct && showAnswer
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                            : 'border-gray-100 bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="ml-2 inline-block min-w-7 rounded-lg bg-white p-1 text-center">
                          {optionLetter(option.index)}
                        </span>
                        {item.question.optionsEmbeddedInImage ? '' : option.text}
                        {correct && showAnswer ? <span className="mr-2 inline-flex items-center gap-1 text-xs"><CheckCircle2 size={14} />الإجابة الصحيحة</span> : null}
                      </div>
                    );
                  })}
                </div>

                {showAnswer && (item.question.explanation || item.question.hint || item.question.solvingStrategy) ? (
                  <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-bold leading-7 text-emerald-950">
                    {item.question.explanation ? <p><strong>الشرح:</strong> {item.question.explanation}</p> : null}
                    {item.question.hint ? <p><strong>تلميح:</strong> {item.question.hint}</p> : null}
                    {item.question.solvingStrategy ? <p><strong>طريقة الحل:</strong> {item.question.solvingStrategy}</p> : null}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAnswer((value) => !value)}
                    className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-black text-white"
                  >
                    {showAnswer ? <EyeOff size={16} /> : <Eye size={16} />}
                    {showAnswer ? 'إخفاء الحل' : 'إظهار الحل'}
                  </button>
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => {
                      setCurrentIndex((value) => Math.max(0, value - 1));
                      setShowAnswer(false);
                    }}
                    className="rounded-xl border bg-white px-4 py-2 text-sm font-black disabled:opacity-40"
                  >
                    <ChevronRight size={15} className="ml-1 inline" />
                    السابق
                  </button>
                  <button
                    type="button"
                    disabled={currentIndex >= items.length - 1}
                    onClick={() => {
                      setCurrentIndex((value) => Math.min(items.length - 1, value + 1));
                      setShowAnswer(false);
                    }}
                    className="rounded-xl border bg-white px-4 py-2 text-sm font-black disabled:opacity-40"
                  >
                    التالي
                    <ChevronLeft size={15} className="mr-1 inline" />
                  </button>
                </div>

                <div className="mt-4">
                  <QuestionAssistantPanel reviewCardId={item.card.cardId} />
                </div>
              </article>
            ))}
          </section>
        )}

        <div className="order-6 flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-2 font-black disabled:opacity-40"
          >
            <ChevronRight size={17} />
            السابق
          </button>
          <span className="text-sm font-black text-gray-500">السؤال {currentReview ? currentIndex + 1 : 0} من {items.length} · صفحة {page}</span>
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
