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
  Loader2,
  Lock,
  Play,
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
import type { LearnerTopicSummary, LearningSpace, TaxonomyCore } from '../../content/api/content-types';
import { FoundationTopicDialog, type TopicContentTab } from '../components/FoundationTopicDialog';
import { SubjectAccessGuide } from '../components/SubjectAccessGuide';
import { parseLearningRoute, subjectsForSelection, type LearningTab } from './learningRouteSelection';
import {
  resolveCanonicalPath,
  resolveCanonicalSubject,
} from '../../taxonomy/utils/canonicalPathResolver';
import { assessmentPlacementClient } from '../../assessment/api/assessment-placement-client';
import { subjectPackagesURL } from '../../commerce/navigation/subjectPackages';
import type { LearnerAssessmentPlacement } from '../../assessment/api/assessment-types';
import { useLearnerResourcePages } from './useLearnerResourcePages';

type Tab = LearningTab;

const subjectHeaderColors: Record<string, string> = { purple: '#7c3aed', violet: '#7c3aed', blue: '#2563eb', sky: '#0284c7', cyan: '#0891b2', teal: '#0d9488', emerald: '#10b981', green: '#16a34a', lime: '#65a30d', yellow: '#ca8a04', amber: '#f59e0b', orange: '#ea580c', red: '#dc2626', rose: '#f43f5e', pink: '#db2777', fuchsia: '#c026d3', indigo: '#4f46e5', slate: '#475569', gray: '#6b7280' };
function subjectHeaderColor(value?: string): string {
  if (value && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)) return value;
  return value ? subjectHeaderColors[value.toLowerCase()] || '#4f46e5' : '#4f46e5';
}

export function LearningSpacePage() {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
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
  const [deepTopic, setDeepTopic] = useState<{ key: string; topic: LearnerTopicSummary | null; error: string } | null>(null);
  const [deepTopicRetry, setDeepTopicRetry] = useState(0);
  const learningRequestRef = useRef<{ key: string; promise: Promise<LearningSpace> } | null>(null);
  const [foundationExtra, setFoundationExtra] = useState<{ scope: string; page: number; items: LearnerTopicSummary[]; hasMore: boolean; loading: boolean; error: string } | null>(null);
  const foundationRequest = useRef<AbortController | null>(null);

  const [trainingPlacements, setTrainingPlacements] = useState<LearnerAssessmentPlacement[]>([]);
  const [testPlacements, setTestPlacements] = useState<LearnerAssessmentPlacement[]>([]);
  const [placementsLoading, setPlacementsLoading] = useState(false);
  const [placementsHasMore, setPlacementsHasMore] = useState(false);
  const [placementsError, setPlacementsError] = useState('');
  const [placementsRetry, setPlacementsRetry] = useState(0);
  const [loadedPlacementScope, setLoadedPlacementScope] = useState('');
  const [subjectProgress, setSubjectProgress] = useState<{ scope: string; total: number; completed: number; error?: string } | null>(null);
  const [progressRetry, setProgressRetry] = useState(0);
  const startPlacementRef = useRef('');
  const placementMounted = useRef(true);
  useEffect(() => {
    placementMounted.current = true;
    return () => { placementMounted.current = false; };
  }, []);
  const [startingPlacementId, setStartingPlacementId] = useState('');
  const [startError, setStartError] = useState('');
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
  const legacySubjectScreen = Boolean(legacyPathId && currentSubject && subjectIsInScope);
  const currentLevel = taxonomy.levels?.find(level => level.id === selectedLevelId);

  const scopeKey = JSON.stringify([user?.id || '', effectivePathId, effectiveSubjectId]);
  const foundationScope = useRef(scopeKey);
  foundationScope.current = scopeKey;
  useEffect(() => () => { foundationRequest.current?.abort(); foundationRequest.current = null; }, [scopeKey]);
  const placementScope = `${user?.id || ''}:${effectivePathId}:${effectiveSubjectId}:${tab}`;
  const currentPlacementScope = useRef(placementScope);
  currentPlacementScope.current = placementScope;
  const visibleSpace = !authLoading && requestState.key === scopeKey && space?.pathId === effectivePathId && space?.subjectId === effectiveSubjectId ? space : null;
  const coursePages = useLearnerResourcePages(scopeKey, effectivePathId, effectiveSubjectId, 'courses', visibleSpace?.courses);
  const libraryPages = useLearnerResourcePages(scopeKey, effectivePathId, effectiveSubjectId, 'library', visibleSpace?.library);
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
    if (authLoading) return;
    if (!effectivePathId || !effectiveSubjectId || !subjectIsInScope) {
      setSpace(null);
      setRequestState({ key: '', busy: false, error: '' });
      return;
    }

    let active = true;
    const requestKey = scopeKey;
    const request = learningRequestRef.current?.key === requestKey
      ? learningRequestRef.current.promise
      : contentClient.learningSpace(effectivePathId, effectiveSubjectId, 50);
    learningRequestRef.current = { key: requestKey, promise: request };
    foundationRequest.current?.abort();
    foundationRequest.current = null;
    setFoundationExtra(null);
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
  }, [effectivePathId, effectiveSubjectId, subjectIsInScope, retryNonce, authLoading, scopeKey]);

  useEffect(() => {
    if (authLoading || !effectivePathId || !effectiveSubjectId || !subjectIsInScope || (tab !== 'questions' && tab !== 'exams')) {
      setTrainingPlacements([]);
      setTestPlacements([]);
      setPlacementsLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoadedPlacementScope(placementScope);
    setPlacementsLoading(true);
    setPlacementsError('');
    setPlacementsHasMore(false);
    setTrainingPlacements([]);
    setTestPlacements([]);
    setStartError('');
    const slot = tab === 'questions' ? 'training' : 'tests';
    assessmentPlacementClient
      .available({ slot, pathId: effectivePathId, subjectId: effectiveSubjectId, limit: 50 }, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setPlacementsHasMore(res.hasMore);
          if (slot === 'training') setTrainingPlacements(res.items);
          else setTestPlacements(res.items);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPlacementsError('تعذر تحميل التدريبات أو الاختبارات؛ حاول مرة أخرى.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPlacementsLoading(false);
        }
      });
    return () => controller.abort();
  }, [effectivePathId, effectiveSubjectId, tab, placementsRetry, authLoading, user?.id, subjectIsInScope]);

  useEffect(() => {
    if (authLoading || !user || !effectivePathId || !effectiveSubjectId || !subjectIsInScope || tab !== 'questions') return;
    const controller = new AbortController();
    const scope = placementScope;
    setSubjectProgress(null);
    assessmentPlacementClient.subjectProgress(effectivePathId, effectiveSubjectId, 'training', controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        if (!Number.isInteger(result.total) || !Number.isInteger(result.completed) || result.total < 0 || result.completed < 0 || result.completed > result.total) throw new Error('invalid progress');
        setSubjectProgress({ scope, ...result });
      }).catch(() => { if (!controller.signal.aborted) setSubjectProgress({ scope, total: 0, completed: 0, error: 'تعذر تحميل تقدم تدريبات المادة.' }); });
    return () => controller.abort();
  }, [authLoading, user?.id, effectivePathId, effectiveSubjectId, subjectIsInScope, tab, placementScope, progressRetry]);

  const handleStartPlacement = async (placement: LearnerAssessmentPlacement) => {
    if (authLoading || loadedPlacementScope !== placementScope) return;
    if (!placement.accessAllowed && (placement.accessReason === 'package_required' || placement.accessReason === 'paid_required')) {
      navigate(subjectPackagesURL(effectivePathId, effectiveSubjectId, tab === 'questions' ? 'banks' : 'tests', window.location.pathname + window.location.search + window.location.hash));
      return;
    }
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`);
      return;
    }
    if (startPlacementRef.current || !placement.accessAllowed || !placement.canStart || loadedPlacementScope !== placementScope) return;
    const actionScope = placementScope;
    startPlacementRef.current = placement.placementId;
    setStartingPlacementId(placement.placementId);
    setStartError('');
    try {
      const csrf = await getCsrfToken();
      if (!placementMounted.current || currentPlacementScope.current !== actionScope) return;
      const k = `assessment-placement-start:${user.id}:${placement.placementId}`;
      let startKey = sessionStorage.getItem(k);
      if (!startKey) {
        startKey = crypto.randomUUID();
        sessionStorage.setItem(k, startKey);
      }
      const res = await assessmentPlacementClient.start(placement.placementId, startKey, csrf);
      if (!placementMounted.current || currentPlacementScope.current !== actionScope) return;
      if (!res.attempt?.id) throw new Error('تعذر تأكيد بدء التدريب أو الاختبار؛ حاول مرة أخرى.');
      sessionStorage.removeItem(k);
      navigate(`/assessment-attempts/${encodeURIComponent(res.attempt.id)}`);
    } catch (err) {
      if (placementMounted.current && currentPlacementScope.current === actionScope) setStartError(err instanceof Error ? err.message : 'تعذر بدء التدريب أو الاختبار');
    } finally {
      startPlacementRef.current = '';
      if (placementMounted.current) setStartingPlacementId('');
    }
  };

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

  const extra = foundationExtra?.scope === scopeKey ? foundationExtra : null;
  const foundationItems = visibleSpace ? [...visibleSpace.foundation.items, ...(extra?.items || [])] : [];
  const deepTopicKey = JSON.stringify([user?.id || '', effectivePathId, effectiveSubjectId, topicId]);
  const listedTopic = foundationItems.find((item) => item.id === topicId);
  useEffect(() => {
    if (!user || !visibleSpace || !subjectIsInScope || !topicId || listedTopic) return;
    const controller = new AbortController();
    setDeepTopic({ key: deepTopicKey, topic: null, error: '' });
    contentClient.learnerTopic(topicId, controller.signal).then(({ topic }) => {
      if (controller.signal.aborted) return;
      if (topic.id !== topicId || topic.pathId !== effectivePathId || topic.subjectId !== effectiveSubjectId) {
        setDeepTopic({ key: deepTopicKey, topic: null, error: 'الموضوع غير متاح في المادة المحددة.' });
        return;
      }
      setDeepTopic({ key: deepTopicKey, topic, error: '' });
    }).catch(() => {
      if (!controller.signal.aborted) setDeepTopic({ key: deepTopicKey, topic: null, error: 'تعذر فتح موضوع التأسيس.' });
    });
    return () => controller.abort();
  }, [user?.id, visibleSpace, subjectIsInScope, topicId, listedTopic, deepTopicKey, effectivePathId, effectiveSubjectId, deepTopicRetry]);
  const selectedTopic = listedTopic || (deepTopic?.key === deepTopicKey ? deepTopic.topic : null);
  const mainTopics = foundationItems.filter((item) => !item.parentTopicId);
  const [foundationFilter, setFoundationFilter] = useState<'all' | 'free' | 'locked'>('all');
  const [trainingFilter, setTrainingFilter] = useState<'all' | 'free' | 'locked'>('all');

  const isTopicFree = (topic: LearnerTopicSummary) => topic.isFree === true;

  const loadMoreFoundation = async () => {
    if (!visibleSpace || foundationRequest.current || !(extra ? extra.hasMore : visibleSpace.foundation.hasMore)) return;
    const scope = scopeKey;
    const nextPage = (extra?.page || 1) + 1;
    const controller = new AbortController();
    foundationRequest.current = controller;
    setFoundationExtra({ scope, page: extra?.page || 1, items: extra?.items || [], hasMore: true, loading: true, error: '' });
    try {
      const result = await contentClient.learnerFoundationPage(effectivePathId, effectiveSubjectId, nextPage, controller.signal);
      if (controller.signal.aborted || foundationScope.current !== scope) return;
      if (result.pathId !== effectivePathId || result.subjectId !== effectiveSubjectId || result.page !== nextPage || !Array.isArray(result.items) || typeof result.hasMore !== 'boolean') throw new Error('تعذر التحقق من صفحة الموضوعات.');
      const previous = extra?.items || [];
      const known = new Set([...visibleSpace.foundation.items, ...previous].map(item => item.id));
      const added = result.items.filter(item => { if (!item || typeof item.id !== 'string' || !item.id || known.has(item.id)) return false; known.add(item.id); return true; });
      setFoundationExtra({ scope, page: nextPage, items: [...previous, ...added], hasMore: result.hasMore, loading: false, error: '' });
    } catch (reason) {
      if (!controller.signal.aborted && foundationScope.current === scope) setFoundationExtra({ scope, page: extra?.page || 1, items: extra?.items || [], hasMore: true, loading: false, error: reason instanceof Error ? reason.message : 'تعذر تحميل مزيد من الموضوعات.' });
    } finally {
      if (foundationRequest.current === controller) foundationRequest.current = null;
    }
  };

  const foundationHasMore = Boolean(visibleSpace && (extra ? extra.hasMore : visibleSpace.foundation.hasMore));
  const foundationMore = foundationHasMore ? <div className="mt-4 text-center">{extra?.error && <p role="alert" className="mb-2 text-sm font-bold text-rose-700">{extra.error}</p>}<button type="button" disabled={extra?.loading} onClick={() => void loadMoreFoundation()} className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-bold text-indigo-700 disabled:opacity-50">{extra?.loading ? 'جاري تحميل الموضوعات...' : extra?.error ? 'إعادة تحميل الموضوعات' : 'عرض المزيد من موضوعات التأسيس'}</button></div> : null;

  if (authLoading) {
    return <main className="p-10 text-center font-black">جاري تحميل مساحة التعلم...</main>;
  }



  const assessmentHref = (slot: 'training' | 'tests') => {
    const query = new URLSearchParams();
    if (pathId) query.set('pathId', pathId);
    if (subjectId) query.set('subjectId', subjectId);
    query.set('slot', slot);
    return `/assessments?${query.toString()}`;
  };

  return (
    <main dir="rtl" data-testid="legacy-learning-space" className="min-h-screen bg-gray-50 pb-20 font-sans overflow-x-clip">
      {!user && !legacySubjectScreen && (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/90 p-3 sm:px-5 shadow-xs">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-indigo-950">
              <Sparkles size={16} className="text-amber-500 shrink-0" />
              <span>مرحباً بك! تصفح دروس التأسيس والتدريبات، وسجّل الدخول لحفظ تقدّمك ونتائجك.</span>
            </div>
            <Link
              to={`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`}
              className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-black text-white hover:bg-indigo-700 transition shadow-xs"
            >
              تسجيل الدخول
            </Link>
          </div>
        </div>
      )}
      {legacySubjectScreen ? (
        <header className="relative overflow-hidden py-4 text-white shadow-xs sm:py-5" style={{ backgroundColor: subjectHeaderColor(currentSubject?.color || currentPath?.color) }}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
          <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-between gap-3 px-4 sm:flex-row sm:items-center">
            <div>
              <div className="mb-1 flex items-center gap-2"><span className="inline-flex rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-white/95">{currentLevel ? `${currentLevel.name} • ` : ''}مسار {currentPath?.name}</span></div>
              <h1 className="break-words text-xl font-black leading-tight sm:text-2xl lg:text-3xl">{currentSubject?.name}</h1>
              <p className="mt-0.5 text-xs text-white/80 sm:text-sm">مساحة التعلم الذكية: تأسيس، تدريب، واختبارات</p>
            </div>
            <button type="button" onClick={() => { const query = new URLSearchParams(); if (selectedLevelId) query.set('level', selectedLevelId); navigate(`/category/${encodeURIComponent(effectivePathId)}${query.size ? `?${query}` : ''}`); }} className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-bold text-white/95 hover:bg-white/20 sm:self-center"><ChevronRight size={16} /> عودة لصفحة المسار</button>
          </div>
        </header>
      ) : <section className="relative overflow-hidden bg-[#2e2b70] py-7 sm:py-9">
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
      </section>}

      <div className="mx-auto mt-7 max-w-7xl px-4 sm:px-6 lg:px-8">
        {!legacySubjectScreen && <section className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:grid-cols-2">
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
        </section>}

        {legacySubjectScreen && <SubjectAccessGuide pathId={effectivePathId} subjectId={effectiveSubjectId} />}
        <section className={`mb-10 mt-7 flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-sm ${legacySubjectScreen ? 'mx-auto w-fit' : ''}`}>
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => changeTab(id)}
              style={legacySubjectScreen && tab === id ? { backgroundColor: subjectHeaderColor(currentSubject?.color || currentPath?.color) } : undefined}
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
              coursePages.items.map((course) => (
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
              <div className="col-span-full space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs">
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900">مواضيع التأسيس الرئيسية</h2>
                    <p className="text-xs font-bold text-slate-500">تأسيس ممنهج وشامل لكل مهارات ومفاهيم المادة</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => setFoundationFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        foundationFilter === 'all'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      الكل ({mainTopics.length}{foundationHasMore ? ' معروض' : ''})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFoundationFilter('free')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        foundationFilter === 'free'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      المجاني ({mainTopics.filter(isTopicFree).length}{foundationHasMore ? ' معروض' : ''})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFoundationFilter('locked')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        foundationFilter === 'locked'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      ضمن باقة ({mainTopics.filter((t) => t.isFree === false).length}{foundationHasMore ? ' معروض' : ''})
                    </button>
                  </div>
                </div>

                <div className="grid gap-3.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {mainTopics
                    .filter((topic) => {
                      if (foundationFilter === 'free') return isTopicFree(topic);
                      if (foundationFilter === 'locked') return topic.isFree === false;
                      return true;
                    })
                    .map((topic) => {
                      const isFree = isTopicFree(topic);
                      return (
                        <article
                          key={topic.id}
                          className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white p-3.5 sm:p-4 transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer min-h-[96px] sm:min-h-[104px] shadow-xs ${
                            topic.isLocked ? 'border-amber-200 hover:border-amber-300' : 'border-slate-200/90 hover:border-indigo-400'
                          }`}
                        >
                          <div className="flex items-start gap-3 w-full">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-xs ${
                                topic.isLocked
                                  ? 'bg-amber-50 text-amber-600'
                                  : isFree
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-indigo-50 text-indigo-600'
                              }`}
                            >
                              {topic.isLocked ? <Lock size={18} /> : isFree ? <Play size={18} className="fill-current" /> : <Target size={18} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => updateQuery({ tab: 'skills', topic: topic.id, content: 'lessons' })}
                                className="block w-full text-right focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                              >
                                <h2 className="text-sm sm:text-base font-bold leading-snug break-words">
                                  <span className="inline-block px-3 py-1 rounded-xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-blue-950 dark:text-blue-100 font-extrabold group-hover:bg-blue-100/90 group-hover:border-blue-300 group-hover:text-blue-900 transition-all shadow-2xs">
                                    {topic.title}
                                  </span>
                                </h2>
                                {topic.description ? (
                                  <p className="mt-1 line-clamp-1 text-xs text-slate-500 font-medium">{topic.description}</p>
                                ) : null}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100/80 gap-2 w-full">
                            <div className="flex items-center gap-2 text-xs font-bold">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
                                  topic.isLocked
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                    : isFree
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                                }`}
                              >
                                {topic.isLocked ? 'مقفل' : isFree ? 'مجاني' : 'مفتوح'}
                              </span>
                              <span className="text-gray-300">•</span>
                              <span className="text-gray-500 text-[11px] font-medium">موضوع تأسيسي</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => updateQuery({ tab: 'skills', topic: topic.id, content: 'lessons' })}
                              className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg border transition-all ${
                                topic.isLocked
                                  ? 'text-amber-700 bg-amber-50 border-amber-200/80 hover:bg-amber-100'
                                  : 'text-indigo-700 bg-indigo-50 border-indigo-200/80 hover:bg-indigo-100'
                              }`}
                            >
                              <span>{topic.isLocked ? 'فتح الباقة' : 'ابدأ التأسيس'}</span>
                              <ChevronRight size={13} className="rotate-180 transition-transform group-hover:-translate-x-0.5" />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                </div>
                {foundationMore}
              </div>
            ) : tab === 'questions' ? (
              <div className="col-span-full space-y-6">
                {subjectProgress?.scope === placementScope && subjectProgress.error && <div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs font-bold text-rose-700">{subjectProgress.error} <button type="button" onClick={() => setProgressRetry(value => value + 1)} className="underline">إعادة المحاولة</button></div>}
                {subjectProgress?.scope === placementScope && !subjectProgress.error && subjectProgress.total > 0 && <section aria-label="تقدم تدريبات المادة" className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs font-bold text-slate-700">
                  <div className="flex justify-between gap-3"><span>أكملت {subjectProgress.completed} من {subjectProgress.total} تدريبات منشورة</span><span>{Math.round(subjectProgress.completed * 100 / subjectProgress.total)}%</span></div>
                  <div role="progressbar" aria-label="نسبة إكمال تدريبات المادة" aria-valuemin={0} aria-valuemax={subjectProgress.total} aria-valuenow={subjectProgress.completed} className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-100"><div className="h-full rounded-full bg-sky-500" style={{width: `${subjectProgress.completed * 100 / subjectProgress.total}%`}} /></div>
                  <p className="mt-1 text-[10px] text-slate-500">يشمل العدد التدريبات المنشورة المجانية والمشمولة بالباقات.</p>
                </section>}
                {!legacySubjectScreen && <article className="flex flex-col gap-4 rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-900 to-[#2e2b70] p-6 text-white shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-8">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-indigo-200">
                      <Sparkles size={14} className="text-amber-300" />
                      بنك الأسئلة والتدريب الذكي
                    </div>
                    <h2 className="text-2xl font-black">{currentSubject?.name ? `تدريب وبنك أسئلة ${currentSubject.name}` : 'التدريب وبنك الأسئلة'}</h2>
                    <p className="max-w-xl text-sm font-medium text-indigo-200 leading-6">
                      تدرب على بنوك الأسئلة المصنفة حسب المهارات مع حلول مفصلة وتصحيح فوري وتدرج تلقائي.
                    </p>
                  </div>
                </article>}

                {startError && loadedPlacementScope === placementScope ? (
                  <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
                    {startError}
                  </div>
                ) : null}

                {placementsError && loadedPlacementScope === placementScope ? (
                  <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                    <p>{placementsError}</p>
                    <button type="button" onClick={() => setPlacementsRetry(value => value + 1)} className="mt-3 rounded-xl bg-rose-700 px-4 py-2 text-white">إعادة المحاولة</button>
                  </div>
                ) : (placementsLoading || loadedPlacementScope !== placementScope) ? (
                  <div className="rounded-3xl border border-gray-100 bg-white p-12 text-center shadow-xs">
                    <Loader2 size={30} className="mx-auto animate-spin text-indigo-600 mb-3" />
                    <p className="text-xs font-bold text-gray-500">جاري تحميل تدريبات وبنوك الأسئلة...</p>
                  </div>
                ) : trainingPlacements.length > 0 ? (
                  <div className={legacySubjectScreen ? 'mx-auto max-w-4xl space-y-3' : 'space-y-3'}>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-1">
                      <div className="text-xs font-black text-slate-700">
                        قائمة تدريبات المادة ({trainingPlacements.length})
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <button
                          type="button"
                          onClick={() => setTrainingFilter('all')}
                          className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            trainingFilter === 'all'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          الكل ({trainingPlacements.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTrainingFilter('free')}
                          className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            trainingFilter === 'free'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          المجاني ({trainingPlacements.filter((r) => r.accessType === 'free').length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTrainingFilter('locked')}
                          className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            trainingFilter === 'locked'
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          ضمن باقة ({trainingPlacements.filter((r) => !r.accessAllowed).length})
                        </button>
                      </div>
                    </div>

                    <div className={legacySubjectScreen ? 'space-y-3' : 'grid gap-3.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
                      {trainingPlacements
                        .filter((row) => {
                          if (trainingFilter === 'free') return row.accessType === 'free';
                          if (trainingFilter === 'locked') return !row.accessAllowed;
                          return true;
                        })
                        .map((row) => {
                          const isFree = row.accessType === 'free';
                          const isOpen = row.accessAllowed;
                          const isCompleted = row.maxAttempts > 0 && row.attemptCount >= row.maxAttempts;
                          const hasAttempted = row.attemptCount > 0;

                          return (
                            <article
                              key={row.placementId}
                              className={`group flex flex-col rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-xs transition hover:border-indigo-400 hover:shadow-md text-right ${legacySubjectScreen ? 'gap-3 sm:flex-row sm:items-center sm:justify-between' : 'justify-between min-h-[96px] sm:min-h-[104px]'}`}
                            >
                              <div className={legacySubjectScreen ? 'flex min-w-0 flex-1 items-start gap-3' : 'flex items-start gap-3 w-full'}>
                                <div
                                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                                    !row.accessAllowed
                                      ? 'bg-amber-50 text-amber-600'
                                      : hasAttempted
                                      ? 'bg-emerald-50 text-emerald-600'
                                      : 'bg-indigo-50 text-indigo-600'
                                  }`}
                                >
                                  {!row.accessAllowed ? (
                                    <Lock size={18} />
                                  ) : hasAttempted ? (
                                    <CheckCircle2 size={18} />
                                  ) : (
                                    <Play size={18} className="fill-current" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h3 className="min-w-0 text-sm sm:text-base font-bold break-words">
                                      <span className="inline-block max-w-full whitespace-normal break-words px-3 py-0.5 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-950 dark:text-indigo-100 font-extrabold group-hover:bg-indigo-100/90 group-hover:border-indigo-300 group-hover:text-indigo-900 transition-all shadow-2xs">
                                        {row.title}
                                      </span>
                                    </h3>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                        isFree
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                          : isOpen
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                          : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                      }`}
                                    >
                                      {isFree ? 'مجاني' : isOpen ? 'مفتوح الآن' : 'ضمن باقة'}
                                    </span>
                                    {isCompleted ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                                        <CheckCircle2 size={11} /> مكتمل ({row.attemptCount}/{row.maxAttempts})
                                      </span>
                                    ) : hasAttempted ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                        <CheckCircle2 size={11} /> أنجز ({row.attemptCount} {row.attemptCount === 1 ? 'محاولة' : 'محاولات'})
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200/60 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                                        لم يبدأ
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                                    <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 font-bold border border-slate-100">
                                      بنك تدريب
                                    </span>
                                    <span>•</span>
                                    <span className="text-[11px]">المحاولات: {row.attemptCount} من {row.maxAttempts}</span>
                                  </div>
                                </div>
                              </div>

                              <div className={legacySubjectScreen ? 'flex items-center justify-end gap-2 sm:shrink-0' : 'mt-3 pt-2.5 border-t border-slate-100/80 flex items-center justify-between gap-2'}>
                                {!legacySubjectScreen && <span className="text-[11px] font-bold text-slate-400">v{row.assessmentVersion}</span>}
                                <button
                                  type="button"
                                  disabled={(!row.accessAllowed && row.accessReason !== 'package_required' && row.accessReason !== 'paid_required') || (row.accessAllowed && !row.canStart) || startingPlacementId === row.placementId}
                                  onClick={() => void handleStartPlacement(row)}
                                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer ${
                                    startingPlacementId === row.placementId
                                      ? 'bg-indigo-100 text-indigo-700 cursor-wait'
                                      : !row.accessAllowed
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100'
                                      : !row.canStart
                                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs'
                                  }`}
                                >
                                  {startingPlacementId === row.placementId ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : !row.accessAllowed ? (
                                    <Lock size={14} />
                                  ) : (
                                    <Play size={14} className="fill-current" />
                                  )}
                                  <span>
                                    {startingPlacementId === row.placementId
                                      ? 'جاري البدء...'
                                      : !row.accessAllowed
                                      ? (row.accessReason === 'package_required' || row.accessReason === 'paid_required' ? 'فتح الباقة' : 'غير متاح')
                                      : !row.canStart
                                      ? 'استُنفدت المحاولات'
                                      : hasAttempted
                                      ? 'متابعة التدريب'
                                      : 'ابدأ التدريب'}
                                  </span>
                                  <ChevronRight size={14} className="rotate-180" />
                                </button>
                              </div>
                            </article>
                          );
                        })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-xs mb-6">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                      <BookOpen size={24} />
                    </div>
                    <h3 className="text-base font-black text-gray-900">بنوك التدريب الشاملة</h3>
                    <p className="mx-auto mt-1 max-w-md text-xs font-bold leading-5 text-gray-500">
                      اختر أي مهارة من الأسفل للبدء في حل تدريباتها المباشرة.
                    </p>
                  </div>
                )}

                {placementsHasMore && !placementsLoading && !placementsError && loadedPlacementScope === placementScope ? (
                  <Link to={assessmentHref('training')} className="inline-flex rounded-xl border border-indigo-200 bg-white px-4 py-2 font-bold text-indigo-700">عرض المزيد</Link>
                ) : null}
                {/* تدريبات مهارات ومواضيع المادة */}
                {mainTopics.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">تدريب المهارات التأسيسية ({mainTopics.length} مهارة)</h3>
                        <p className="text-xs font-bold text-slate-500">تدرب على مهارات المادة بشكل تفاعلي وتراكمي</p>
                      </div>
                    </div>
                    <div className="grid gap-3.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {mainTopics.map((topic) => {
                        const isFree = isTopicFree(topic);
                        return (
                          <article
                            key={topic.id}
                            className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-xs transition hover:border-indigo-400 hover:shadow-md text-right min-h-[96px] sm:min-h-[104px]"
                          >
                            <div className="flex items-start gap-3 w-full">
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                                  topic.isLocked
                                    ? 'bg-amber-50 text-amber-600'
                                    : isFree
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-indigo-50 text-indigo-600'
                                }`}
                              >
                                {topic.isLocked ? <Lock size={18} /> : <Target size={18} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h4 className="min-w-0 text-sm sm:text-base font-bold break-words">
                                    <span className="inline-block max-w-full whitespace-normal break-words px-3 py-0.5 rounded-xl bg-indigo-50/90 border border-indigo-200/80 text-indigo-950 font-extrabold group-hover:bg-indigo-100/90 transition-all shadow-2xs">
                                      {topic.title}
                                    </span>
                                  </h4>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                      topic.isLocked
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                        : isFree
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                        : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                    }`}
                                  >
                                    {topic.isLocked ? 'مقفل' : isFree ? 'مجاني' : 'مفتوح'}
                                  </span>
                                  <span className="rounded-md bg-slate-50 border border-slate-200/60 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                                    تدريب مهارة
                                  </span>
                                </div>
                                {topic.description ? (
                                  <p className="line-clamp-1 text-xs text-slate-500 font-medium">{topic.description}</p>
                                ) : null}
                              </div>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-slate-100/80 flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-slate-400">تأسيس وتدريب</span>
                              <button
                                type="button"
                                onClick={() => updateQuery({ tab: 'skills', topic: topic.id, content: 'quizzes' })}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer ${
                                  topic.isLocked
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs'
                                }`}
                              >
                                {topic.isLocked ? <Lock size={14} /> : <Target size={14} />}
                                <span>{topic.isLocked ? 'فتح الباقة' : 'تدرب على هذه المهارة'}</span>
                                <ChevronRight size={14} className="rotate-180" />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {foundationMore}
              </div>
            ) : tab === 'exams' ? (
              <div className="col-span-full space-y-6">
                <article className="flex flex-col gap-4 rounded-3xl border border-indigo-100 bg-gradient-to-r from-[#2e2b70] via-indigo-900 to-indigo-800 p-6 text-white shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-8">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/30 px-3 py-1 text-xs font-black text-indigo-100">
                      <FileCheck size={14} className="text-emerald-300" />
                      اختبارات المادة الدورية
                    </div>
                    <h2 className="text-2xl font-black">{currentSubject?.name ? `اختبارات تقييم ${currentSubject.name}` : 'اختبارات المادة'}</h2>
                    <p className="max-w-xl text-sm font-medium text-indigo-200 leading-6">
                      اختبارات دورية وقصيرة لتقييم مدى استيعابك للمفاهيم والموضوعات الخاصة بهذه المادة أولاً بأول.
                    </p>
                  </div>
                </article>

                {/* Separate Mock Exams Distinction Notice */}
                {effectivePathId ? (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                        <Award size={20} />
                      </div>
                      <p className="text-xs font-bold leading-6">
                        <span className="font-black text-amber-950">هل تبحث عن الاختبارات المحاكية الشاملة؟</span>{' '}
                        الاختبارات المحاكية الكاملة (التي تشمل جميع أقسام المسار بالوقت الفعلي) متوفرة على مستوى المسار بالكامل.
                      </p>
                    </div>
                    <Link
                      to={`/category/${encodeURIComponent(effectivePathId)}?tab=mock-exams`}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-white hover:bg-amber-600 transition shadow-xs"
                    >
                      <span>فتح محاكيات المسار</span>
                      <ChevronRight size={14} className="rotate-180" />
                    </Link>
                  </div>
                ) : null}

                {startError && loadedPlacementScope === placementScope ? (
                  <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
                    {startError}
                  </div>
                ) : null}

                {placementsError && loadedPlacementScope === placementScope ? (
                  <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                    <p>{placementsError}</p>
                    <button type="button" onClick={() => setPlacementsRetry(value => value + 1)} className="mt-3 rounded-xl bg-rose-700 px-4 py-2 text-white">إعادة المحاولة</button>
                  </div>
                ) : (placementsLoading || loadedPlacementScope !== placementScope) ? (
                  <div className="rounded-3xl border border-gray-100 bg-white p-12 text-center shadow-xs">
                    <Loader2 size={30} className="mx-auto animate-spin text-indigo-600 mb-3" />
                    <p className="text-xs font-bold text-gray-500">جاري تحميل اختبارات المادة...</p>
                  </div>
                ) : testPlacements.length > 0 ? (
                  <div className="grid gap-3.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {testPlacements.map((row) => {
                      const isFree = row.accessType === 'free';
                      const isOpen = row.accessAllowed;
                      const isCompleted = row.maxAttempts > 0 && row.attemptCount >= row.maxAttempts;
                      const hasAttempted = row.attemptCount > 0;

                      return (
                        <article
                          key={row.placementId}
                          className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-xs transition hover:border-indigo-400 hover:shadow-md text-right min-h-[96px] sm:min-h-[104px]"
                        >
                          <div className="flex items-start gap-3 w-full">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                                !row.accessAllowed
                                  ? 'bg-amber-50 text-amber-600'
                                  : hasAttempted
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-indigo-50 text-indigo-600'
                              }`}
                            >
                              {!row.accessAllowed ? (
                                <Lock size={18} />
                              ) : hasAttempted ? (
                                <CheckCircle2 size={18} />
                              ) : (
                                <FileCheck size={18} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="min-w-0 text-sm sm:text-base font-bold break-words">
                                  <span className="inline-block max-w-full whitespace-normal break-words px-3 py-0.5 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-950 dark:text-indigo-100 font-extrabold group-hover:bg-indigo-100/90 group-hover:border-indigo-300 group-hover:text-indigo-900 transition-all shadow-2xs">
                                    {row.title}
                                  </span>
                                </h3>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                    isFree
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                      : isOpen
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                  }`}
                                >
                                  {isFree ? 'مجاني' : isOpen ? 'مفتوح الآن' : 'ضمن باقة'}
                                </span>
                                {isCompleted ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                                    <CheckCircle2 size={11} /> مكتمل ({row.attemptCount}/{row.maxAttempts})
                                  </span>
                                ) : hasAttempted ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                    <CheckCircle2 size={11} /> أنجز ({row.attemptCount} {row.attemptCount === 1 ? 'محاولة' : 'محاولات'})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200/60 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                                    لم يبدأ
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 font-bold border border-emerald-100">
                                  اختبار مادة
                                </span>
                                <span>•</span>
                                <span className="text-[11px]">المحاولات: {row.attemptCount} من {row.maxAttempts}</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-100/80 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-400">v{row.assessmentVersion}</span>
                            <button
                              type="button"
                              disabled={(!row.accessAllowed && row.accessReason !== 'package_required' && row.accessReason !== 'paid_required') || (row.accessAllowed && !row.canStart) || startingPlacementId === row.placementId}
                              onClick={() => void handleStartPlacement(row)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer ${
                                startingPlacementId === row.placementId
                                  ? 'bg-indigo-100 text-indigo-700 cursor-wait'
                                  : !row.accessAllowed
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100'
                                  : !row.canStart
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs'
                              }`}
                            >
                              {startingPlacementId === row.placementId ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : !row.accessAllowed ? (
                                <Lock size={14} />
                              ) : (
                                <Play size={14} className="fill-current" />
                              )}
                              <span>
                                {startingPlacementId === row.placementId
                                  ? 'جاري البدء...'
                                  : !row.accessAllowed
                                  ? (row.accessReason === 'package_required' || row.accessReason === 'paid_required' ? 'فتح الباقة' : 'غير متاح')
                                  : !row.canStart
                                  ? 'استُنفدت المحاولات'
                                  : hasAttempted
                                  ? 'متابعة الاختبار'
                                  : 'ابدأ الاختبار'}
                              </span>
                              <ChevronRight size={14} className="rotate-180" />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-xs">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                      <FileCheck size={28} />
                    </div>
                    <h3 className="text-lg font-black text-gray-900">لا توجد اختبارات منشورة لهذه المادة حالياً</h3>
                    <p className="mx-auto mt-2 max-w-md text-xs font-bold leading-6 text-gray-500">
                      سيتم نشر اختبارات التقييم الدوري الخاصة بمادة {currentSubject?.name || 'هذه المادة'} قريباً.
                    </p>
                  </div>
                )}
                {placementsHasMore && !placementsLoading && !placementsError && loadedPlacementScope === placementScope ? (
                  <Link to={assessmentHref('tests')} className="inline-flex rounded-xl border border-indigo-200 bg-white px-4 py-2 font-bold text-indigo-700">عرض المزيد</Link>
                ) : null}
              </div>
            ) : (
              libraryPages.items.map((item) => (
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
                        to={subjectPackagesURL(effectivePathId, effectiveSubjectId, 'library', window.location.pathname + window.location.search + window.location.hash)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-black text-amber-800 hover:bg-amber-100 transition"
                      >
                        <Lock size={13} />
                        <span>فتح عبر الباقة</span>
                      </Link>
                    ) : !user ? (
                      <Link to={`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`} className="rounded-xl bg-indigo-50 px-3.5 py-1.5 text-xs font-black text-indigo-700">سجل الدخول لفتح الملف</Link>
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

            {(tab === 'courses' || tab === 'library') && (tab === 'courses' ? coursePages : libraryPages).hasMore ? (() => {
              const pages = tab === 'courses' ? coursePages : libraryPages;
              return <div className="col-span-full text-center">{pages.error && <p role="alert" className="mb-2 text-sm font-bold text-rose-700">{pages.error}</p>}<button type="button" disabled={pages.loading} onClick={() => void pages.loadMore()} className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-bold text-indigo-700 disabled:opacity-50">{pages.loading ? 'جاري تحميل المزيد...' : pages.error ? 'إعادة المحاولة' : 'عرض المزيد'}</button></div>;
            })() : null}

            {(
              (tab === 'courses' && !coursePages.items.length && !coursePages.hasMore) ||
              (tab === 'foundation' && !mainTopics.length && !foundationHasMore) ||
              (tab === 'library' && !libraryPages.items.length && !libraryPages.hasMore)
            ) ? (
              <div className="col-span-full rounded-2xl border bg-white p-10 text-center font-bold text-gray-500">
                لا يوجد محتوى متاح حاليًا.
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
      {topicId && !selectedTopic && deepTopic?.key === deepTopicKey && deepTopic.error ? (
        <div role="alert" className="mx-auto max-w-5xl rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
          {deepTopic.error} <button type="button" onClick={() => setDeepTopicRetry(value => value + 1)} className="underline">إعادة المحاولة</button>
        </div>
      ) : null}
      {selectedTopic && visibleSpace ? (
        <FoundationTopicDialog
          key={selectedTopic.id}
          pathId={effectivePathId}
          subjectId={effectiveSubjectId}
          topic={selectedTopic}
          topics={listedTopic ? foundationItems : [...foundationItems, selectedTopic]}
          contentTab={contentTab}
          onSelectTopic={(id) => updateQuery({ topic: id, content: contentTab })}
          onSelectContent={(id) => updateQuery({ topic: selectedTopic.id, content: id })}
          onClose={() => updateQuery({ topic: null, content: null })}
        />
      ) : null}
    </main>
  );
}
