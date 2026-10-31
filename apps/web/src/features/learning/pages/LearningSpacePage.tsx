import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileCheck,
  FileText,
  HelpCircle,
  Lock,
  PlayCircle,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import type { LearningSpace, TaxonomyCore } from '../../content/api/content-types';
import { FoundationTopicDialog, type TopicContentTab } from '../components/FoundationTopicDialog';
import { parseLearningRoute, subjectsForSelection, type LearningTab } from './learningRouteSelection';
import {
  resolveCanonicalPath,
  resolveCanonicalSubject,
} from '../../taxonomy/utils/canonicalPathResolver';

type Tab = LearningTab;

export function LearningSpacePage() {
  const { user, loading: authLoading } = useAuth();
  const { pathId: legacyPathId = '' } = useParams<{ pathId?: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // URL is the navigation authority, as in Legacy: reload/back/forward retain scope and topic.
  const selection = parseLearningRoute(legacyPathId, params);
  const { pathId, subjectId, tab } = selection;
  const selectedLevelId = selection.levelId;
  const topicId = tab === 'foundation' ? params.get('topic') || '' : '';
  const contentTab: TopicContentTab = ['lessons', 'quizzes', 'support'].includes(params.get('content') || '')
    ? params.get('content') as TopicContentTab : 'lessons';

  const [taxonomy, setTaxonomy] = useState<TaxonomyCore>({ paths: [], subjects: [] });
  const [space, setSpace] = useState<LearningSpace | null>(null);
  const [requestState, setRequestState] = useState({ key: '', busy: false, error: '' });
  const [retryNonce, setRetryNonce] = useState(0);
  const learningRequestRef = useRef<{ key: string; promise: Promise<LearningSpace> } | null>(null);
  const resolvedPath = useMemo(
    () => resolveCanonicalPath(pathId, taxonomy.paths),
    [pathId, taxonomy.paths],
  );
  const effectivePathId = resolvedPath?.id || pathId;

  const subjects = useMemo(
    () => subjectsForSelection(taxonomy.subjects, effectivePathId, selectedLevelId),
    [effectivePathId, selectedLevelId, taxonomy.subjects],
  );

  const resolvedSubject = useMemo(
    () => resolveCanonicalSubject(subjectId, taxonomy.subjects, effectivePathId),
    [subjectId, taxonomy.subjects, effectivePathId],
  );
  const effectiveSubjectId = resolvedSubject?.id || subjectId;

  const currentPath = resolvedPath || taxonomy.paths.find((item) => item.id === effectivePathId);
  const currentSubject = resolvedSubject || subjects.find((item) => item.id === effectiveSubjectId);
  const subjectIsInScope = subjects.some((item) => item.id === effectiveSubjectId);

  const scopeKey = `${effectivePathId}:${effectiveSubjectId}`;
  const visibleSpace = space?.pathId === effectivePathId && space?.subjectId === effectiveSubjectId ? space : null;
  const busy = requestState.key === scopeKey && requestState.busy;
  const error = requestState.key === scopeKey ? requestState.error : '';

  const updateQuery = (updates: Record<string, string | null>) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  };

  const changePath = (nextPathId: string) => {
    if (legacyPathId) {
      const next = new URLSearchParams();
      next.set('tab', tab === 'foundation' ? 'skills' : tab);
      navigate(nextPathId ? `/category/${encodeURIComponent(nextPathId)}?${next}` : '/learning');
      return;
    }
    updateQuery({ pathId: nextPathId, level: null, subjectId: null, subject: null, topic: null, content: null });
  };
  const changeSubject = (nextSubjectId: string) => {
    updateQuery({
      [legacyPathId ? 'subject' : 'subjectId']: nextSubjectId,
      [legacyPathId ? 'subjectId' : 'subject']: null,
      topic: null,
      content: null,
    });
  };
  const changeTab = (nextTab: Tab) => {
    updateQuery({ tab: nextTab === 'foundation' ? 'skills' : nextTab, topic: null, content: null });
  };

  useEffect(() => {
    const controller = new AbortController();
    contentClient.taxonomyCore(controller.signal).then(setTaxonomy).catch(() => {});
    return () => controller.abort();
  }, []);

  // Do not silently switch subjects on a stale taxonomy response: keep the
  // requested URL, and let the learner correct an invalid selection.
  useEffect(() => {
    if (!effectivePathId || !effectiveSubjectId || !subjectIsInScope) {
      setSpace(null);
      setRequestState({ key: '', busy: false, error: '' });
      return;
    }

    let active = true;
    const requestKey = `${effectivePathId}:${effectiveSubjectId}`;
    const request = learningRequestRef.current?.key === requestKey
      ? learningRequestRef.current.promise
      : contentClient.learningSpace(effectivePathId, effectiveSubjectId, 50);
    learningRequestRef.current = { key: requestKey, promise: request };
    setSpace(null);
    setRequestState({ key: requestKey, busy: true, error: '' });

    request
      .then((nextSpace) => {
        if (!active) return;
        if (nextSpace.pathId !== effectivePathId || nextSpace.subjectId !== effectiveSubjectId) {
          setRequestState({ key: requestKey, busy: false, error: 'لا يطابق المحتوى المسار والمادة المحددين.' });
          return;
        }
        setSpace(nextSpace);
      })
      .catch((reason) => {
        if (active) {
          setSpace(null);
          setRequestState({ key: requestKey, busy: false, error: reason instanceof Error ? reason.message : 'تعذر تحميل مساحة التعلم' });
        }
      })
      .finally(() => {
        if (learningRequestRef.current?.promise === request) learningRequestRef.current = null;
        if (active) setRequestState((previous) => previous.key === requestKey ? { ...previous, busy: false } : previous);
      });

    return () => { active = false; };
  }, [effectivePathId, effectiveSubjectId, subjectIsInScope, retryNonce]);

  const allTabs: Array<[Tab, string, typeof BookOpen]> = useMemo(() => [
    ['courses', 'الدورات', BookOpen],
    ['foundation', 'التأسيس', Target],
    ['questions', 'التدريب', HelpCircle],
    ['exams', 'الاختبارات', FileCheck],
    ['library', 'المكتبة', FileText],
  ], []);

  const subjectSettings = useMemo(() => ((currentSubject as any)?.settings || {}) as Record<string, any>, [currentSubject]);
  const isTabAllowed = useCallback((tabKey: Tab) => {
    if (tabKey === 'courses') return subjectSettings.showCourses ?? true;
    if (tabKey === 'foundation') return subjectSettings.showSkills ?? true;
    if (tabKey === 'questions') return subjectSettings.showBanks ?? true;
    if (tabKey === 'exams') return subjectSettings.showTests ?? true;
    if (tabKey === 'library') return subjectSettings.showLibrary ?? true;
    return true;
  }, [subjectSettings]);
  const tabs = useMemo(() => allTabs.filter(([id]) => isTabAllowed(id)), [allTabs, isTabAllowed]);

  useEffect(() => {
    if (currentSubject && tabs.length > 0 && !isTabAllowed(tab)) {
      changeTab(tabs[0][0]);
    }
  }, [currentSubject, tab, tabs, isTabAllowed]);

  const selectedTopic = visibleSpace?.foundation.items.find((item) => item.id === topicId);
  const mainTopics = visibleSpace?.foundation.items.filter((item) => !item.parentTopicId) || [];

  if (authLoading) {
    return <main className="p-10 text-center font-black">جاري تحميل مساحة التعلم...</main>;
  }

  if (!user) {
    return (
      <main dir="rtl" className="max-w-2xl mx-auto p-12 text-center">
        <div className="rounded-3xl border border-indigo-100 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Lock size={26} />
          </div>
          <h2 className="text-xl font-black text-slate-900">سجّل الدخول لفتح مساحة التعلم</h2>
          <p className="mt-2 text-sm text-slate-500 font-bold leading-6">
            مساحة التعلم الذكية تحفظ تقدمك في الدروس، التأسيس، والتدريبات التفاعلية.
          </p>
          <Link
            to={`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-black text-white hover:bg-indigo-700 transition"
          >
            <span>تسجيل الدخول الآن</span>
            <ChevronRight size={16} />
          </Link>
        </div>
      </main>
    );
  }

  const assessmentHref = (slot: 'training' | 'tests') => {
    const query = new URLSearchParams();
    if (pathId) query.set('pathId', pathId);
    if (subjectId) query.set('subjectId', subjectId);
    query.set('slot', slot);
    return `/assessments?${query.toString()}`;
  };

  return (
    <main dir="rtl" data-testid="legacy-learning-space" className="min-h-screen bg-gray-50 pb-20 font-sans">
      <section className="relative overflow-hidden bg-[#2e2b70] py-7 sm:py-9">
        <div className="relative z-10 mx-auto max-w-7xl px-4 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black text-indigo-100 backdrop-blur-sm">
            <Award size={14} className="text-amber-300" />
            مساحة التعلم
          </div>
          <h1 className="text-2xl font-black leading-tight text-white sm:text-3xl">
            {currentPath && currentSubject
              ? `${currentPath.name} (${currentSubject.name})`
              : 'تعلّم حسب المسار والمادة'}
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm font-bold text-indigo-200 sm:text-base">
            تأسيس، تدريب، اختبارات ومحتوى داعم في مساحة واحدة.
          </p>
          {pathId ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  const q = new URLSearchParams();
                  if (selectedLevelId) q.set('level', selectedLevelId);
                  navigate(`/category/${encodeURIComponent(pathId)}${q.toString() ? `?${q.toString()}` : ''}`);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/25 backdrop-blur-sm shadow-sm"
              >
                <ChevronRight size={16} />
                <span>عودة لصفحة المسار</span>
              </button>
            </div>
          ) : null}
        </div>
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-indigo-400/10" />
        <div className="pointer-events-none absolute -bottom-12 left-8 h-32 w-32 rounded-full bg-amber-400/10" />
      </section>

      <div className="mx-auto mt-7 max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:grid-cols-2">
          <label className="relative">
            <Search className="pointer-events-none absolute right-3 top-3 text-gray-400" size={17} />
            <select
              aria-label="المسار"
              value={pathId}
              onChange={(event) => changePath(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-3 pr-10 font-bold outline-none focus:border-amber-400"
            >
              <option value="">اختر المسار</option>
              {taxonomy.paths.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          <select
            aria-label="المادة"
            value={subjectId}
            disabled={!pathId}
            onChange={(event) => changeSubject(event.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-bold outline-none focus:border-amber-400 disabled:opacity-50"
          >
            <option value="">اختر المادة</option>
            {subjects.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </section>

        <section className="mb-10 mt-7 flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-sm">
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => changeTab(id)}
              className={`flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-all sm:px-5 ${
                tab === id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </section>

        {!pathId ? (
          <section className="space-y-6">
            <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
                <Target size={28} />
              </div>
              <h2 className="text-xl font-black text-gray-800">اختر المسار التعليمي للبدء</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm font-bold text-gray-500">
                اختر المسار المناسب لك لاستعراض كامل الدورات، خطة التأسيس، بنوك الأسئلة، الاختبارات المحاكية، والمكتبة الرقمية.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {taxonomy.paths.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => changePath(p.id)}
                  className="group flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 text-right shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <BookOpen size={24} />
                    </span>
                    <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-black text-gray-600">
                      {p.code}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 group-hover:text-indigo-600 transition-colors">
                      {p.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs font-medium text-gray-500">
                      {p.description || 'مسار تعليمي متكامل للتأسيس والتدريب والاختبارات.'}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-3 text-xs font-black text-indigo-600">
                    <span>استكشاف المسار</span>
                    <ChevronRight size={16} className="rotate-180 transition-transform group-hover:-translate-x-1" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : !subjectId ? (
          <section className="space-y-6">
            <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
                <Target size={28} />
              </div>
              <h2 className="text-xl font-black text-gray-800">اختر المادة في {currentPath?.name || 'المسار'}</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm font-bold text-gray-500">
                اختر المادة لعرض مواد التأسيس، الدورات والشروحات، بنك الأسئلة والاختبارات الخاصة بها.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subjects.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => changeSubject(s.id)}
                  className="group flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 text-right shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Target size={24} />
                    </span>
                    <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">
                      {s.code}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 group-hover:text-indigo-600 transition-colors">
                      {s.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs font-medium text-gray-500">
                      {((s as any).description as string | undefined) || 'مادة تعليمية متخصصة تشمل شروحات وتدريبات واختبارات.'}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-3 text-xs font-black text-indigo-600">
                    <span>دخول المادة</span>
                    <ChevronRight size={16} className="rotate-180 transition-transform group-hover:-translate-x-1" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : busy ? (
          <section className="rounded-2xl border bg-white p-10 text-center font-black text-gray-500">
            جاري تحميل المحتوى...
          </section>
        ) : error ? (
          <section className="rounded-2xl border border-rose-100 bg-rose-50 p-5 font-bold text-rose-700">
            <p>{error}</p>
            <button type="button" onClick={() => setRetryNonce((value) => value + 1)}
              className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">إعادة المحاولة</button>
          </section>
        ) : visibleSpace ? (
          <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tab === 'courses' ? (
              visibleSpace.courses.items.map((course) => (
                <article
                  key={course.id}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="group relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-[#2e2b70] via-indigo-700 to-indigo-500 sm:h-44">
                    <BookOpen size={52} className="text-white/85 transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                    <span className="absolute right-3 top-3 rounded-lg bg-black/40 px-3 py-1.5 text-[11px] font-black text-white backdrop-blur">
                      {course.level || 'دورة'}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h2 className="text-base font-black leading-snug text-gray-900 sm:text-lg">{course.title}</h2>
                    <p className="mt-2 line-clamp-2 text-xs font-medium leading-6 text-gray-500">{course.description}</p>
                    <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <User size={14} />
                        {course.instructorName || 'فريق المنصة'}
                      </span>
                      {course.durationMinutes ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock size={14} />
                          {course.durationMinutes} دقيقة
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-auto grid grid-cols-2 gap-2 border-t border-gray-50 pt-5">
                      <Link
                        to={`/course/${course.id}`}
                        className="flex items-center justify-center rounded-xl border border-gray-200 px-3 py-3 text-sm font-black text-gray-700 hover:bg-gray-50"
                      >
                        معاينة
                      </Link>
                      <Link
                        to={`/course/${course.id}?learn=1`}
                        className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-3 text-sm font-black text-white hover:bg-indigo-700"
                      >
                        <PlayCircle size={16} />
                        ابدأ
                      </Link>
                    </div>
                  </div>
                </article>
              ))
            ) : tab === 'foundation' ? (
              mainTopics.map((topic) => (
                <article
                  key={topic.id}
                  className={`group relative flex min-h-56 flex-col justify-between overflow-hidden rounded-2xl border bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-lg ${
                    topic.isLocked ? 'border-amber-200' : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                      <Target size={28} />
                    </div>
                    <span className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-black ${
                      topic.isLocked ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {topic.isLocked ? <Lock size={13} /> : null}
                      {topic.isLocked ? 'مقفل' : 'متاح'}
                    </span>
                  </div>
                  <button type="button" onClick={() => updateQuery({ tab: 'skills', topic: topic.id, content: 'lessons' })}
                    className="block w-full rounded-xl text-right focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
                    <h2 className="text-xl font-black text-gray-800">{topic.title}</h2>
                    <p className="mt-2 line-clamp-2 text-xs leading-6 text-gray-500">{topic.description}</p>
                  </button>
                  <div className="text-xs font-black text-indigo-600">موضوع تأسيسي</div>
                </article>
              ))
            ) : tab === 'questions' ? (
              <div className="col-span-full space-y-6">
                <article className="flex flex-col gap-4 rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-900 to-[#2e2b70] p-6 text-white shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-8">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-indigo-200">
                      <Sparkles size={14} className="text-amber-300" />
                      بنك الأسئلة والتدريب الذكي
                    </div>
                    <h2 className="text-2xl font-black">{currentSubject?.name ? `تدريب وبنك أسئلة ${currentSubject.name}` : 'التدريب وبنك الأسئلة'}</h2>
                    <p className="max-w-xl text-sm font-medium text-indigo-200 leading-6">
                      تدرب على آلاف الأسئلة المحاكية المصنفة حسب المهارات مع تصحيح ذكي، حلول مفصلة، وتدرج تلقائي في الصعوبة.
                    </p>
                  </div>
                  <Link
                    to={assessmentHref('training')}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3.5 text-sm font-black text-gray-900 shadow hover:bg-amber-300 transition"
                  >
                    <HelpCircle size={18} />
                    <span>عرض التدريبات</span>
                  </Link>
                </article>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                    <div>
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <TrendingUp size={24} />
                      </div>
                      <h3 className="text-lg font-black text-gray-900">التدريب التكيفي الذكي</h3>
                      <p className="mt-2 text-xs font-medium leading-6 text-gray-500">
                        خوارزمية ذكية تختار لك أسئلة تتناسب مع مستواك وتركز تلقائيًا على المهارات التي تحتاج تحسين.
                      </p>
                    </div>
                    <Link
                      to={assessmentHref('training')}
                      className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-600 px-4 py-2.5 text-xs font-black text-indigo-600 hover:bg-indigo-50 transition"
                    >
                      <span>بدء التدريب التكيفي</span>
                      <ChevronRight size={14} className="rotate-180" />
                    </Link>
                  </div>

                  <div className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                    <div>
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <Target size={24} />
                      </div>
                      <h3 className="text-lg font-black text-gray-900">التدريب المهاراتي المركز</h3>
                      <p className="mt-2 text-xs font-medium leading-6 text-gray-500">
                        اختر مهارة محددة وتدرّب عليها بصورة مكثفة مع استعراض استراتيجيات الحل السريع لكل سؤال.
                      </p>
                    </div>
                    <Link
                      to={assessmentHref('training')}
                      className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-600 px-4 py-2.5 text-xs font-black text-emerald-600 hover:bg-emerald-50 transition"
                    >
                      <span>تدريب مهاراتي</span>
                      <ChevronRight size={14} className="rotate-180" />
                    </Link>
                  </div>

                  <div className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                    <div>
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                        <CheckCircle2 size={24} />
                      </div>
                      <h3 className="text-lg font-black text-gray-900">مراجعة الأخطاء السابقة</h3>
                      <p className="mt-2 text-xs font-medium leading-6 text-gray-500">
                        إعادة حل الأسئلة التي أجبت عليها بشكل غير صحيح مع شروحات الفيديو والتحليل الإحصائي.
                      </p>
                    </div>
                    <Link
                      to={assessmentHref('training')}
                      className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-xl border border-purple-600 px-4 py-2.5 text-xs font-black text-purple-600 hover:bg-purple-50 transition"
                    >
                      <span>مراجعة بنك الأسئلة</span>
                      <ChevronRight size={14} className="rotate-180" />
                    </Link>
                  </div>
                </div>
              </div>
            ) : tab === 'exams' ? (
              <div className="col-span-full space-y-6">
                <article className="flex flex-col gap-4 rounded-3xl border border-amber-100 bg-gradient-to-r from-[#2e2b70] via-indigo-900 to-indigo-800 p-6 text-white shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-8">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-black text-amber-300">
                      <Award size={14} />
                      منظومة الاختبارات المحاكية
                    </div>
                    <h2 className="text-2xl font-black">{currentSubject?.name ? `اختبارات ${currentSubject.name}` : 'الاختبارات'}</h2>
                    <p className="max-w-xl text-sm font-medium text-indigo-200 leading-6">
                      اختبارات محاكية تحاكي الاختبار الفعلي بدقة بالوقت وتوزيع الأسئلة، مع تقرير تحليلي فوري لدرجتك ونقاط القوة والضعف.
                    </p>
                  </div>
                  <Link
                    to={assessmentHref('tests')}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3.5 text-sm font-black text-gray-900 shadow hover:bg-amber-300 transition"
                  >
                    <FileCheck size={18} />
                    <span>عرض الاختبارات</span>
                  </Link>
                </article>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                    <div>
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <Award size={24} />
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-lg font-black text-gray-900">الاختبار المحاكي الكامل</h3>
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-700">شامل</span>
                      </div>
                      <p className="mt-2 text-xs font-medium leading-6 text-gray-500">
                        اختبار متكامل بنفس معايير وزمن الاختبار الحقيقي، يقيس جاهزيتك التامة ويعطيك نسبة تقديرية موثوقة.
                      </p>
                    </div>
                    <Link
                      to={assessmentHref('tests')}
                      className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-700 transition"
                    >
                      <PlayCircle size={15} />
                      <span>بدء الاختبار المحاكي</span>
                    </Link>
                  </div>

                  <div className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                    <div>
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Target size={24} />
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-lg font-black text-gray-900">الاختبار التشخيصي</h3>
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-700">تحديد مستوى</span>
                      </div>
                      <p className="mt-2 text-xs font-medium leading-6 text-gray-500">
                        اختبار سريع لتحديد مستواك الأولي قبل بدء الخطة وتحديد المهارات التي تحتاج إلى تركيز وتأسيس.
                      </p>
                    </div>
                    <Link
                      to={assessmentHref('tests')}
                      className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-600 px-4 py-2.5 text-xs font-black text-blue-600 hover:bg-blue-50 transition"
                    >
                      <span>بدء التشخيص</span>
                      <ChevronRight size={14} className="rotate-180" />
                    </Link>
                  </div>

                  <div className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                    <div>
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                        <Clock size={24} />
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-lg font-black text-gray-900">الاختبارات الدورية القصيرة</h3>
                        <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-black text-rose-700">تقييم مرحلي</span>
                      </div>
                      <p className="mt-2 text-xs font-medium leading-6 text-gray-500">
                        اختبارات سريعة لكل قسم للتأكد من استيعاب المفاهيم والموضوعات التأسيسية أولاً بأول.
                      </p>
                    </div>
                    <Link
                      to={assessmentHref('tests')}
                      className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-600 px-4 py-2.5 text-xs font-black text-rose-600 hover:bg-rose-50 transition"
                    >
                      <span>عرض الاختبارات القصيرة</span>
                      <ChevronRight size={14} className="rotate-180" />
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              visibleSpace.library.items.map((item) => (
                <article key={item.id} className="flex h-full flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                  <div>
                    <div className="mb-4 flex items-start justify-between">
                      <span className={`rounded-lg px-3 py-1 text-xs font-black ${
                        item.isLocked ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {item.isLocked ? 'ضمن باقة' : 'متاح'}
                      </span>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                        <FileText size={24} />
                      </div>
                    </div>
                    <h2 className="text-lg font-black text-gray-900 leading-snug">{item.title}</h2>
                    <p className="mt-2 text-xs leading-6 text-gray-500">{item.description}</p>
                  </div>
                  
                  <div className="mt-6 border-t border-gray-50 pt-4 flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-gray-400">{item.type || 'ملف'}</span>
                    {item.isLocked ? (
                      <Link
                        to="/packages"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-black text-amber-800 hover:bg-amber-100 transition"
                      >
                        <Lock size={13} />
                        <span>فتح عبر الباقة</span>
                      </Link>
                    ) : item.externalUrl ? (
                      <a
                        href={item.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-indigo-700 transition shadow-sm"
                      >
                        <Download size={13} />
                        <span>تحميل / فتح</span>
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-600">
                        متاح للقراءة
                      </span>
                    )}
                  </div>
                </article>
              ))
            )}

            {(
              (tab === 'courses' && !visibleSpace.courses.items.length) ||
              (tab === 'foundation' && !mainTopics.length) ||
              (tab === 'library' && !visibleSpace.library.items.length)
            ) ? (
              <div className="col-span-full rounded-2xl border bg-white p-10 text-center font-bold text-gray-500">
                لا يوجد محتوى متاح حاليًا.
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
      {selectedTopic && visibleSpace ? (
        <FoundationTopicDialog
          key={selectedTopic.id}
          topic={selectedTopic}
          topics={visibleSpace.foundation.items}
          contentTab={contentTab}
          onSelectTopic={(id) => updateQuery({ topic: id, content: contentTab })}
          onSelectContent={(id) => updateQuery({ topic: selectedTopic.id, content: id })}
          onClose={() => updateQuery({ topic: null, content: null })}
        />
      ) : null}
    </main>
  );
}
