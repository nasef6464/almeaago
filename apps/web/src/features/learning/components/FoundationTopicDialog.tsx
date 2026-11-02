import { ExternalLink, FileText, Lock, Target, Video, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { contentClient } from '../../content/api/content-client';
import type { LearnerLessonDetail, LearnerTopic, LearnerTopicSummary } from '../../content/api/content-types';
import { SharedVideoPlayer } from './SharedVideoPlayer';
import { lessonProgressClient } from '../api/learning-client';
import { useAuth } from '../../auth/state/AuthProvider';
import { assessmentPlacementClient } from '../../assessment/api/assessment-placement-client';
import type { LearnerAssessmentPlacement } from '../../assessment/api/assessment-types';

export type TopicContentTab = 'lessons' | 'quizzes' | 'support';

type Props = {
  pathId: string;
  subjectId: string;
  topic: LearnerTopicSummary;
  topics: LearnerTopicSummary[];
  contentTab: TopicContentTab;
  onSelectTopic: (topicId: string) => void;
  onSelectContent: (tab: TopicContentTab) => void;
  onClose: () => void;
};

const contentTabs: Array<[TopicContentTab, string, typeof Video]> = [
  ['lessons', 'الشروحات', Video],
  ['quizzes', 'التدريبات القصيرة', Target],
  ['support', 'ملف الدعم', FileText],
];

function FoundationLessonVideo({ topicId, lesson }: { topicId: string; lesson: LearnerLessonDetail }) {
  const { getCsrfToken } = useAuth();
  const [position, setPosition] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const alive = useRef(false);
  const lastSaved = useRef(-1);
  const saving = useRef(false);
  const context = { contextType: 'foundation' as const, courseId: '', topicId };
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    setPosition(null); setError(''); lastSaved.current = -1;
    lessonProgressClient.get(lesson.id, context, controller.signal).then(({ progress }) => {
      if (controller.signal.aborted) return;
      if (progress.lessonId !== lesson.id || progress.contextType !== 'foundation' || progress.topicId !== topicId || progress.courseId) throw new Error('تعذر التحقق من تقدم الدرس.');
      setPosition(Math.max(0, progress.positionSeconds || 0));
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر تحميل تقدم الدرس.'); });
    return () => { alive.current = false; controller.abort(); };
  }, [lesson.id, topicId, retry]);
  async function onProgress(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0 || saving.current || (lastSaved.current >= 0 && Math.abs(seconds - lastSaved.current) < 10)) return;
    // The player can emit a zero position before restoring an existing offset.
    if (position !== null && position > 0 && seconds === 0 && lastSaved.current < 0) return;
    saving.current = true;
    try {
      const csrf = await getCsrfToken();
      if (!alive.current) return;
      await lessonProgressClient.saveVideo(lesson.id, context, Math.floor(seconds), csrf);
      if (alive.current) { lastSaved.current = seconds; setError(''); }
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : 'تعذر حفظ تقدم الدرس.'); }
    finally { saving.current = false; }
  }
  if (position === null) return error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>إعادة المحاولة</button></div> : <p role="status">جاري تحميل تقدم الدرس...</p>;
  return <><SharedVideoPlayer url={lesson.videoUrl} title={lesson.title} initialPositionSeconds={position} onTimeUpdate={onProgress} onPause={onProgress} />{error ? <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p> : null}</>;
}

function FoundationTopicTraining({ pathId, subjectId, topicId }: { pathId: string; subjectId: string; topicId: string }) {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const scope = JSON.stringify([user?.id || '', pathId, subjectId, topicId]);
  const [pagination, setPagination] = useState({ scope: '', page: 1 });
  const page = pagination.scope === scope ? pagination.page : 1;
  const [retry, setRetry] = useState(0);
  const requestKey = JSON.stringify([scope, page, retry]);
  const [result, setResult] = useState<{ key: string; items: LearnerAssessmentPlacement[]; hasMore: boolean; error: string } | null>(null);
  const [startState, setStartState] = useState<{ token: object | null; id: string; error: string }>({ token: null, id: '', error: '' });
  const active = useRef({ key: '', token: {} });
  const contextKey = JSON.stringify([scope, page, location.key, authLoading, user?.roles]);
  if (active.current.key !== contextKey) active.current = { key: contextKey, token: {} };
  const mounted = useRef(true);
  const inFlight = useRef<{ token: object; id: string } | null>(null);
  const ready = !authLoading && Boolean(pathId && subjectId && topicId);
  const current = result?.key === requestKey ? result : null;
  const starting = startState.token === active.current.token ? startState.id : '';
  const startError = startState.token === active.current.token ? startState.error : '';

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; active.current = { key: '', token: {} }; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    assessmentPlacementClient.available({ slot: 'foundation', pathId, subjectId, topicId, page, limit: 30 }, controller.signal)
      .then(response => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(response.items) || response.items.some(row => row.slot !== 'foundation' || row.pathId !== pathId || row.subjectId !== subjectId || row.topicId !== topicId)) {
          throw new Error('تعذر تحميل تدريبات الموضوع؛ أعد المحاولة.');
        }
        setResult({ key: requestKey, items: response.items, hasMore: response.hasMore === true, error: '' });
      })
      .catch(reason => {
        if (!controller.signal.aborted) setResult({ key: requestKey, items: [], hasMore: false, error: reason instanceof Error ? reason.message : 'تعذر تحميل تدريبات الموضوع؛ أعد المحاولة.' });
      });
    return () => controller.abort();
  }, [ready, pathId, subjectId, topicId, page, requestKey]);

  const start = async (placement: LearnerAssessmentPlacement) => {
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    const token = active.current.token;
    if (!ready || !current || !placement.accessAllowed || !placement.canStart || inFlight.current?.token === token) return;
    inFlight.current = { token, id: placement.placementId };
    setStartState({ token, id: placement.placementId, error: '' });
    const stillCurrent = () => mounted.current && active.current.token === token;
    try {
      const csrf = await getCsrfToken();
      if (!stillCurrent()) return;
      const key = `foundation-placement-start:${JSON.stringify([user!.id, pathId, subjectId, topicId, placement.placementId])}`;
      let startKey = sessionStorage.getItem(key);
      if (!startKey) { startKey = crypto.randomUUID(); sessionStorage.setItem(key, startKey); }
      const response = await assessmentPlacementClient.start(placement.placementId, startKey, csrf);
      if (!stillCurrent()) return;
      if (!response.attempt?.id) throw new Error('تعذر تأكيد بدء التدريب؛ أعد المحاولة.');
      sessionStorage.removeItem(key);
      const query = new URLSearchParams({ returnTo: location.pathname + location.search + location.hash });
      navigate(`/assessment-attempts/${encodeURIComponent(response.attempt.id)}?${query}`);
    } catch (reason) {
      if (stillCurrent()) setStartState({ token, id: '', error: reason instanceof Error ? reason.message : 'تعذر بدء التدريب؛ أعد المحاولة.' });
    } finally {
      if (inFlight.current?.token === token) inFlight.current = null;
      if (stillCurrent()) setStartState(previous => ({ ...previous, id: '' }));
    }
  };

  if (authLoading || (ready && !current)) return <p role="status" className="py-10 text-center font-bold text-gray-500">جاري تحميل التدريبات...</p>;
  if (!ready) return <p className="py-10 text-center text-gray-500">جاري التحقق من بيانات الموضوع...</p>;
  if (current?.error) return <div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-5 font-bold text-rose-700"><p>{current.error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">إعادة المحاولة</button></div>;
  return <div className="space-y-4">
    {startError ? <p role="alert" className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{startError}</p> : null}
    {!current?.items.length ? <p className="py-10 text-center text-gray-500">لا توجد تدريبات قصيرة لهذا الجزء بعد.</p> : current.items.map(row => (
      <article key={row.placementId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-4">
        <div><h3 className="font-bold text-gray-900">{row.title}</h3><p className="mt-1 text-xs text-gray-500">المحاولات {row.attemptCount} من {row.maxAttempts}</p></div>
        <button type="button" aria-label={`بدء التدريب: ${row.title}`} disabled={!row.accessAllowed || !row.canStart || Boolean(starting)} onClick={() => void start(row)} className="rounded-lg bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60">
          {starting === row.placementId ? 'جارٍ بدء التدريب...' : !row.accessAllowed ? 'التدريب غير متاح لحسابك' : !row.canStart ? 'استُنفدت المحاولات' : 'ابدأ التدريب'}
        </button>
      </article>
    ))}
    {page > 1 || current?.hasMore ? <nav aria-label="صفحات تدريبات الموضوع" className="flex items-center justify-between gap-3">
      <button type="button" disabled={page === 1 || Boolean(starting)} onClick={() => setPagination({ scope, page: page - 1 })} className="rounded-lg border px-4 py-2 font-bold disabled:opacity-40">السابق</button>
      <span className="text-sm text-gray-500">صفحة {page}</span>
      <button type="button" disabled={!current?.hasMore || Boolean(starting)} onClick={() => setPagination({ scope, page: page + 1 })} className="rounded-lg border px-4 py-2 font-bold disabled:opacity-40">التالي</button>
    </nav> : null}
  </div>;
}

export function FoundationTopicDialog({ pathId, subjectId, topic, topics, contentTab, onSelectTopic, onSelectContent, onClose }: Props) {
  const { user } = useAuth();
  const [detail, setDetail] = useState<LearnerTopic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selectedLesson, setSelectedLesson] = useState('');
  const [lessonRetry, setLessonRetry] = useState(0);
  const lessonScope = JSON.stringify([user?.id || '', pathId, subjectId, topic.id, contentTab, selectedLesson, lessonRetry]);
  const [lessonState, setLessonState] = useState<{ scope: string; lesson: LearnerLessonDetail | null; error: string } | null>(null);
  const currentLesson = lessonState?.scope === lessonScope ? lessonState : null;

  const root = topics.find((item) => item.id === topic.parentTopicId) || topic;
  const children = topics.filter((item) => item.parentTopicId === root.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const detailForTopic = detail?.id === topic.id ? detail : null;

  useEffect(() => { setSelectedLesson(''); }, [user?.id, pathId, subjectId, topic.id, contentTab]);
  useEffect(() => {
    if (contentTab !== 'lessons' || !selectedLesson || (topic.isLocked && !user) || !detailForTopic?.lessons.some(item => item.id === selectedLesson)) return;
    const controller = new AbortController();
    contentClient.learnerFoundationLesson(topic.id, selectedLesson, controller.signal).then(({ lesson }) => {
      if (controller.signal.aborted) return;
      if (!lesson || lesson.id !== selectedLesson) throw new Error('تعذر التحقق من الدرس المطلوب.');
      setLessonState({ scope: lessonScope, lesson, error: '' });
    }).catch(reason => {
      if (!controller.signal.aborted) setLessonState({ scope: lessonScope, lesson: null, error: reason instanceof Error ? reason.message : 'تعذر فتح الدرس.' });
    });
    return () => controller.abort();
  }, [user?.id, pathId, subjectId, topic.id, topic.isLocked, contentTab, selectedLesson, lessonScope, detailForTopic]);

  useEffect(() => {
    setDetail(null);
    setError('');
    if (topic.isLocked) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    contentClient.learnerTopic(topic.id, controller.signal)
      .then(({ topic: next }) => {
        if (!controller.signal.aborted) setDetail(next);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'تعذر تحميل الموضوع');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [topic.id, topic.isLocked, retry]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedLesson) setSelectedLesson('');
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, selectedLesson]);

  return (
    <div data-testid="foundation-topic-dialog" className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden" dir="rtl" role="dialog" aria-modal="true" aria-label={root.title}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:h-[90vh]">
        <header className="relative flex h-24 shrink-0 flex-col justify-between bg-gradient-to-l from-indigo-900 to-[#2e2b70] p-5 text-white sm:h-28 sm:p-6">
          <button type="button" onClick={onClose} aria-label="إغلاق" className="absolute left-4 top-4 rounded-full p-2 hover:bg-white/10">
            <X size={22} />
          </button>
          <span className="text-xs font-bold text-indigo-200">التأسيس</span>
          <h2 className="text-xl font-black">{root.title}</h2>
        </header>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="max-h-44 shrink-0 overflow-y-auto border-b border-gray-100 bg-gray-50 md:max-h-none md:w-64 md:border-b-0 md:border-l">
            <h3 className="border-b border-gray-100 p-4 font-bold text-gray-800">الموضوعات الفرعية</h3>
            <div className="space-y-1 p-2">
              <button type="button" onClick={() => onSelectTopic(root.id)}
                className={`w-full rounded-xl border p-4 text-right font-bold ${topic.id === root.id ? 'border-indigo-100 bg-indigo-50 text-indigo-700' : 'border-transparent text-gray-700 hover:bg-white'}`}>
                عام (للموضوع الرئيسي)
              </button>
              {children.map((child) => (
                <button type="button" key={child.id} onClick={() => onSelectTopic(child.id)}
                  className={`flex w-full items-center justify-between rounded-xl border p-4 text-right font-bold ${topic.id === child.id ? 'border-indigo-100 bg-indigo-50 text-indigo-700' : 'border-transparent text-gray-700 hover:bg-white'}`}>
                  {child.title}{child.isLocked ? <Lock size={16} className="text-amber-600" /> : null}
                </button>
              ))}
            </div>
          </aside>
          <div className="flex min-h-0 flex-1 flex-col">
            <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-200 px-3 sm:px-6" aria-label="محتوى الموضوع">
              {contentTabs.map(([id, label, Icon]) => (
                <button key={id} type="button" onClick={() => onSelectContent(id)}
                  className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-4 text-sm font-bold sm:px-6 ${contentTab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                  <Icon size={18} />{label}
                </button>
              ))}
            </nav>
            <section className="flex-1 overflow-y-auto p-4 sm:p-6">
              {contentTab === 'quizzes' ? (
                <FoundationTopicTraining pathId={pathId} subjectId={subjectId} topicId={topic.id} />
              ) : topic.isLocked ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center font-bold text-amber-800">
                  <Lock className="mx-auto mb-3" size={26} />
                  هذا الموضوع ضمن باقة التأسيس
                </div>
              ) : loading ? (
                <p className="py-10 text-center font-bold text-gray-500">جاري تحميل المحتوى...</p>
              ) : error ? (
                <div className="rounded-xl border border-rose-100 bg-rose-50 p-5 font-bold text-rose-700">
                  <p>{error}</p>
                  <button type="button" onClick={() => setRetry((value) => value + 1)}
                    className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">إعادة المحاولة</button>
                </div>
              ) : contentTab === 'lessons' ? (
                detailForTopic?.lessons.length ? (
                  <div className="space-y-4">
                    {detailForTopic.lessons.map((lesson) => (
                      <article key={lesson.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4">
                        <div>
                          <h3 className="font-bold text-gray-900">{lesson.title}</h3>
                          {lesson.description ? <p className="mt-1 text-sm text-gray-500">{lesson.description}</p> : null}
                        </div>
                        <button type="button" aria-label={`فتح الدرس: ${lesson.title}`} onClick={() => { setSelectedLesson(lesson.id); setLessonRetry(0); }} className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700">
                          {lesson.isLocked || lesson.commerceLocked ? <Lock size={16} /> : <Video size={16} />} فتح الدرس
                        </button>
                      </article>
                    ))}
                    {selectedLesson ? <section role="dialog" aria-modal="true" aria-label="الدرس المحدد" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-auto rounded-2xl bg-white shadow-2xl">
                      <div className="flex items-center justify-between gap-2 bg-gray-50 p-3"><h3 className="font-black">{detailForTopic.lessons.find(item => item.id === selectedLesson)?.title}</h3><button type="button" onClick={() => setSelectedLesson('')} className="rounded-full bg-white p-2 shadow" aria-label="إغلاق مشغل الفيديو"><X size={22} /></button></div>
                      {!currentLesson ? <p role="status">جاري فتح الدرس...</p> : currentLesson.error ? <div role="alert" className="text-rose-700"><p>{currentLesson.error}</p><button type="button" onClick={() => setLessonRetry(value => value + 1)} className="mt-2 rounded-lg border px-3 py-2 font-bold">إعادة المحاولة</button></div> : currentLesson.lesson?.type === 'video' && currentLesson.lesson.videoUrl ? <FoundationLessonVideo key={`${topic.id}:${currentLesson.lesson.id}`} topicId={topic.id} lesson={currentLesson.lesson} /> : currentLesson.lesson?.contentText ? <p className="whitespace-pre-wrap">{currentLesson.lesson.contentText}</p> : <p>لا يوجد محتوى متاح لهذا الدرس بعد.</p>}
                      <div className="bg-gray-50 p-3 text-center text-xs text-gray-500 sm:p-4 sm:text-sm">شرح تفصيلي مقدم من منصة المئة التعليمية</div>
                      </div>
                    </section> : null}
                  </div>
                ) : <p className="py-10 text-center text-gray-500">لا توجد شروحات لهذا الجزء بعد.</p>
              ) : contentTab === 'support' ? (
                detailForTopic?.libraryItems.length ? (
                  <div className="space-y-4">
                    {detailForTopic.libraryItems.map((item) => (
                      <article key={item.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4">
                        <div>
                          <h3 className="font-bold text-gray-900">{item.title}</h3>
                          {item.description ? <p className="mt-1 text-sm text-gray-500">{item.description}</p> : null}
                        </div>
                        {item.isLocked ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                            <Lock size={14} />
                            <span>ضمن الباقة</span>
                          </span>
                        ) : item.externalUrl ? (
                          <a
                            href={item.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
                          >
                            <ExternalLink size={14} />
                            <span>فتح الملف</span>
                          </a>
                        ) : (
                          <FileText size={18} className="text-indigo-600" />
                        )}
                      </article>
                    ))}
                  </div>
                ) : <p className="py-10 text-center text-gray-500">لا يوجد ملف دعم لهذا الجزء بعد.</p>
              ) : (
                <p className="py-10 text-center text-gray-500">لا توجد تدريبات قصيرة لهذا الجزء بعد.</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
