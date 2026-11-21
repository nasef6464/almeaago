import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, FileQuestion, Layers, Loader2, Play, RotateCcw, Star } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../../auth/state/AuthProvider';
import { attemptClient, type ResultListItem } from '../../../assessment/api/attempt-client';
import { relativeArabicDate } from '../../../assessment/relativeDate';
import { useStudentExperience } from '../../navigation';
import { usePublicMocks } from '../../../public/header/pages/public-metadata';
import type { MockSummary } from '../../../public/header/pages/destination-model';

export const MockExamsTab: React.FC = () => {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const navigate = useNavigate();
  const { paths, enrolledPaths, loading: experienceLoading, error: experienceError } = useStudentExperience();
  const catalog = usePublicMocks();
  const [resultsByAssessment, setResultsByAssessment] = useState<Record<string, ResultListItem>>({});
  const [resultsLoading, setResultsLoading] = useState(false);
  const [starting, setStarting] = useState('');
  const [startError, setStartError] = useState('');
  const startKeys = useRef(new Map<string, string>());
  const studentId = user?.roles.includes('student') ? user.id : '';

  // Submitted attempts are optional enrichment for the "التي أداها" section.
  // If the results request fails we simply omit that section instead of
  // inventing a score or an attempt.
  useEffect(() => {
    if (authLoading || !studentId) {
      setResultsByAssessment({});
      setResultsLoading(false);
      return;
    }
    let active = true;
    setResultsLoading(true);
    attemptClient.results(1, 100)
      .then((page) => {
        if (!active) return;
        const latest: Record<string, ResultListItem> = {};
        for (const item of page.items) {
          if (!latest[item.assessmentId]) latest[item.assessmentId] = item;
        }
        setResultsByAssessment(latest);
      })
      .catch(() => {
        if (active) setResultsByAssessment({});
      })
      .finally(() => {
        if (active) setResultsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authLoading, studentId]);

  const enrolledPathList = useMemo(() => {
    if (!enrolledPaths?.length) return [];
    return paths
      .filter((path) => enrolledPaths.includes(path.id) && path.isActive !== false)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'ar'));
  }, [enrolledPaths, paths]);

  const groups = useMemo(
    () =>
      enrolledPathList
        .map((path) => ({
          path,
          items: catalog.items.filter((mock) => mock.pathId === path.id && Boolean(mock.id)),
        }))
        .filter((group) => group.items.length > 0),
    [catalog.items, enrolledPathList],
  );

  const completed = useMemo(() => {
    const enrolled = new Set(enrolledPathList.map((path) => path.id));
    return catalog.items
      .flatMap((mock) => {
        if (!mock.id || !enrolled.has(mock.pathId)) return [];
        const result = resultsByAssessment[mock.id];
        if (!result) return [];
        const path = enrolledPathList.find((item) => item.id === mock.pathId);
        return [{ mock, result, pathName: path?.name || '' }];
      })
      .sort((a, b) => Date.parse(b.result.finalizedAt) - Date.parse(a.result.finalizedAt));
  }, [catalog.items, enrolledPathList, resultsByAssessment]);

  const completedIds = useMemo(
    () => new Set(completed.map((item) => item.mock.id).filter(Boolean)),
    [completed],
  );

  async function startMock(mock: MockSummary) {
    const assessmentId = mock.id || '';
    if (!assessmentId || starting || !studentId) return;
    let startKey = startKeys.current.get(assessmentId);
    if (!startKey) {
      startKey = crypto.randomUUID();
      startKeys.current.set(assessmentId, startKey);
    }
    setStarting(assessmentId);
    setStartError('');
    try {
      const csrf = await getCsrfToken();
      const response = await attemptClient.start(assessmentId, startKey, csrf);
      startKeys.current.delete(assessmentId);
      const returnTo = '/dashboard?tab=mock-exams';
      navigate(
        `/assessment-attempts/${encodeURIComponent(response.attempt.id)}?${new URLSearchParams({
          returnTo,
          source: 'mock-exam',
        })}`,
      );
    } catch (reason) {
      setStartError(reason instanceof Error ? reason.message : 'تعذر بدء المحاكية.');
    } finally {
      setStarting('');
    }
  }

  const loading = authLoading || experienceLoading || catalog.loading;
  const error = experienceError || catalog.error;

  return (
    <div dir="rtl" className="w-full min-w-0 space-y-5 pb-16 animate-fade-in">
      <header className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
            <Star size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-gray-900 sm:text-2xl">الاختبارات المحاكية</h2>
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-black text-indigo-700">
                على مستوى المسار
              </span>
            </div>
            <p className="mt-1 text-xs font-bold leading-6 text-gray-500 sm:text-sm">
              نماذج كاملة تحاكي بيئة الاختبار الرسمي، وقد يضم النموذج الواحد أكثر من مادة.
            </p>
          </div>
        </div>
      </header>

      {startError ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {startError}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-gray-100 bg-white p-10 text-sm font-bold text-gray-500">
          <Loader2 size={18} className="animate-spin text-indigo-600" />
          جارٍ تحميل المحاكيات...
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => (catalog.error ? catalog.reload() : window.location.reload())}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-black"
          >
            <RotateCcw size={14} />
            إعادة المحاولة
          </button>
        </div>
      ) : groups.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-indigo-200 bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Star size={22} />
          </div>
          <h3 className="mt-3 text-base font-black text-gray-900">لا توجد اختبارات محاكية متاحة لمسارك بعد</h3>
          <p className="mx-auto mt-1 max-w-md text-xs font-bold leading-6 text-gray-500">
            {enrolledPathList.length === 0
              ? 'سجّل في مسار أولًا، ثم ستظهر هنا المحاكيات المنشورة له.'
              : 'سيظهر هنا أي نموذج محاكي جديد ينشره فريق المنصة لمسارك.'}
          </p>
          {enrolledPathList.length === 0 ? (
            <Link
              to="/dashboard?tab=paths"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-700"
            >
              اختيار مسار
            </Link>
          ) : null}
        </section>
      ) : (
        <div className="space-y-6">
          {groups.map(({ path, items }) => (
            <section key={path.id} className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <h3 className="text-base font-black text-gray-900 sm:text-lg">{path.name}</h3>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-black text-gray-600">
                  {items.length} {items.length === 1 ? 'نموذج' : 'نماذج'}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((mock) => {
                  const assessmentId = mock.id || '';
                  const done = Boolean(mock.id && completedIds.has(mock.id));
                  return (
                    <article
                      key={assessmentId}
                      className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs transition hover:border-indigo-200 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <h4 className="text-sm font-black leading-snug text-gray-900 sm:text-base">
                          {mock.title || 'محاكية المسار'}
                        </h4>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-gray-500">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-1">
                            <FileQuestion size={13} />
                            {mock.questionCount} سؤال
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-1">
                            <Clock size={13} />
                            {Math.max(1, Math.round(mock.timeLimitSeconds / 60))} دقيقة
                          </span>
                          {mock.sectionCount > 1 ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-1">
                              <Layers size={13} />
                              {mock.sectionCount} أقسام
                            </span>
                          ) : null}
                          {done ? (
                            <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">أديتها سابقًا</span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(starting) || !assessmentId}
                        onClick={() => void startMock(mock)}
                        className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-indigo-700 disabled:opacity-40 sm:w-auto"
                      >
                        {starting === assessmentId ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                        ابدأ المحاكية
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          {resultsLoading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-xs font-bold text-gray-500">
              <Loader2 size={15} className="animate-spin text-indigo-600" />
              جارٍ تحميل المحاكيات التي أديتها...
            </div>
          ) : completed.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <h3 className="text-base font-black text-gray-900 sm:text-lg">التي أداها</h3>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                  {completed.length}
                </span>
              </div>
              <div className="grid gap-2 xl:grid-cols-2">
                {completed.map(({ mock, result, pathName }) => {
                  const shownScore = result.showResultsReport ? `${result.score.toFixed(1)}%` : 'مكتملة';
                  return (
                    <article
                      key={mock.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-xs"
                    >
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-black text-gray-900">
                          {mock.title || 'محاكية المسار'}
                        </h4>
                        <p className="mt-1 text-[11px] font-bold text-gray-500">
                          {pathName ? `${pathName} · ` : ''}
                          {relativeArabicDate(result.finalizedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-center">
                          <div className="text-xl font-black text-emerald-600">{shownScore}</div>
                          <div className="text-[10px] font-bold text-gray-500">
                            {result.showResultsReport ? 'الدرجة' : 'الحالة'}
                          </div>
                        </div>
                        <Link
                          to={`/assessment-results/${encodeURIComponent(result.attemptId)}`}
                          className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100"
                        >
                          راجع
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
};
