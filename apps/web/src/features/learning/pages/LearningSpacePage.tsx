import {
  Award,
  BookOpen,
  Clock,
  FileCheck,
  FileText,
  HelpCircle,
  Lock,
  PlayCircle,
  Search,
  Target,
  User,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import type { LearningSpace, TaxonomyCore } from '../../content/api/content-types';

type Tab = 'courses' | 'foundation' | 'questions' | 'exams' | 'library';

const legacyTabMap: Record<string, Tab> = {
  courses: 'courses',
  skills: 'foundation',
  foundation: 'foundation',
  banks: 'questions',
  questions: 'questions',
  tests: 'exams',
  exams: 'exams',
  library: 'library',
};

export function LearningSpacePage() {
  const { user, loading: authLoading } = useAuth();
  const { pathId: legacyPathId = '' } = useParams<{ pathId?: string }>();
  const [params, setParams] = useSearchParams();

  const initialPathId = legacyPathId || params.get('pathId') || '';
  const initialSubjectId = params.get('subjectId') || params.get('subject') || '';
  const initialTab = legacyTabMap[params.get('tab') || 'courses'] || 'courses';

  const [taxonomy, setTaxonomy] = useState<TaxonomyCore>({ paths: [], subjects: [] });
  const [pathId, setPathId] = useState(initialPathId);
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [space, setSpace] = useState<LearningSpace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    contentClient.taxonomyCore(controller.signal).then(setTaxonomy).catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (legacyPathId && legacyPathId !== pathId) {
      setPathId(legacyPathId);
      setSubjectId(params.get('subjectId') || params.get('subject') || '');
      setTab(legacyTabMap[params.get('tab') || 'courses'] || 'courses');
    }
  }, [legacyPathId, params, pathId]);

  const subjects = useMemo(
    () => taxonomy.subjects.filter((item) => !pathId || item.pathId === pathId),
    [pathId, taxonomy.subjects],
  );
  const currentPath = taxonomy.paths.find((item) => item.id === pathId);
  const currentSubject = taxonomy.subjects.find((item) => item.id === subjectId);

  useEffect(() => {
    if (subjectId && taxonomy.subjects.length > 0 && !subjects.some((item) => item.id === subjectId)) {
      setSubjectId('');
    }
  }, [subjectId, subjects, taxonomy.subjects.length]);

  useEffect(() => {
    if (legacyPathId) return;
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      pathId ? next.set('pathId', pathId) : next.delete('pathId');
      subjectId ? next.set('subjectId', subjectId) : next.delete('subjectId');
      next.delete('subject');
      next.set('tab', tab);
      return next;
    }, { replace: true });
  }, [legacyPathId, pathId, setParams, subjectId, tab]);

  useEffect(() => {
    if (!pathId || !subjectId) {
      setSpace(null);
      return;
    }

    const controller = new AbortController();
    setBusy(true);
    setError('');
    contentClient.learningSpace(pathId, subjectId, 50, controller.signal)
      .then(setSpace)
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setSpace(null);
          setError(reason instanceof Error ? reason.message : 'تعذر تحميل مساحة التعلم');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });

    return () => controller.abort();
  }, [pathId, subjectId]);

  if (authLoading) {
    return <main className="p-10 text-center font-black">جاري تحميل مساحة التعلم...</main>;
  }

  if (!user) {
    return <main className="p-10 text-center font-black text-rose-700">سجّل الدخول لفتح مساحة التعلم.</main>;
  }

  const tabs: Array<[Tab, string, typeof BookOpen]> = [
    ['courses', 'الدورات', BookOpen],
    ['foundation', 'التأسيس', Target],
    ['questions', 'التدريب', HelpCircle],
    ['exams', 'الاختبارات', FileCheck],
    ['library', 'المكتبة', FileText],
  ];

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
              onChange={(event) => {
                setPathId(event.target.value);
                setSubjectId('');
              }}
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
            onChange={(event) => setSubjectId(event.target.value)}
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
              onClick={() => setTab(id)}
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

        {!pathId || !subjectId ? (
          <section className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
            <Target className="mx-auto text-indigo-300" size={34} />
            <h2 className="mt-3 text-lg font-black text-gray-800">اختر المسار ثم المادة</h2>
            <p className="mt-2 text-sm font-bold leading-7 text-gray-500">
              بعدها تظهر لك نفس أقسام مساحة التعلم: الدورات، التأسيس، التدريب، الاختبارات والمكتبة.
            </p>
          </section>
        ) : busy ? (
          <section className="rounded-2xl border bg-white p-10 text-center font-black text-gray-500">
            جاري تحميل المحتوى...
          </section>
        ) : error ? (
          <section className="rounded-2xl border border-rose-100 bg-rose-50 p-5 font-bold text-rose-700">
            {error}
          </section>
        ) : space ? (
          <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tab === 'courses' ? (
              space.courses.items.map((course) => (
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
              space.foundation.items.map((topic) => (
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
                  <div>
                    <h2 className="text-xl font-black text-gray-800">{topic.title}</h2>
                    <p className="mt-2 line-clamp-2 text-xs leading-6 text-gray-500">{topic.description}</p>
                  </div>
                  <div className="text-xs font-black text-indigo-600">موضوع تأسيسي</div>
                </article>
              ))
            ) : tab === 'questions' ? (
              <article className="col-span-full flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <h2 className="text-xl font-black text-gray-800">التدريب وبنك الأسئلة</h2>
                  <p className="mt-1 max-w-2xl text-sm font-medium leading-7 text-gray-500">
                    الواجهة تحافظ على مدخل التدريب القديم، بينما المحاولات والتصحيح وحقائق الإجابات تظل مملوكة لـ Assessment V2.
                  </p>
                </div>
                <Link
                  to={assessmentHref('training')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-black text-white hover:bg-indigo-700"
                >
                  <HelpCircle size={18} />
                  عرض التدريبات
                </Link>
              </article>
            ) : tab === 'exams' ? (
              <article className="col-span-full flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Award size={24} />
                </div>
                <h2 className="text-xl font-black text-gray-800">الاختبارات</h2>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-7 text-gray-500">
                  نفس نقطة الدخول المرئية للواجهة القديمة، مع بقاء الوصول والمحاولات والدرجة والتصحيح من الخادم الحالي.
                </p>
                <Link
                  to={assessmentHref('tests')}
                  className="mt-5 inline-flex self-start items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-black text-white hover:bg-indigo-700"
                >
                  <FileCheck size={18} />
                  عرض الاختبارات
                </Link>
              </article>
            ) : (
              space.library.items.map((item) => (
                <article key={item.id} className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-6 flex items-start justify-between">
                    <span className={`rounded-lg px-3 py-1 text-xs font-black ${
                      item.isLocked ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {item.isLocked ? 'ضمن باقة' : 'متاح'}
                    </span>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                      <FileText size={24} />
                    </div>
                  </div>
                  <h2 className="text-center text-lg font-black text-gray-800">{item.title}</h2>
                  <p className="mt-2 text-center text-xs leading-6 text-gray-500">{item.description}</p>
                  <div className="mt-auto pt-5 text-center text-xs font-black uppercase text-gray-400">{item.type}</div>
                </article>
              ))
            )}

            {(
              (tab === 'courses' && !space.courses.items.length) ||
              (tab === 'foundation' && !space.foundation.items.length) ||
              (tab === 'library' && !space.library.items.length)
            ) ? (
              <div className="col-span-full rounded-2xl border bg-white p-10 text-center font-bold text-gray-500">
                لا يوجد محتوى متاح حاليًا.
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
