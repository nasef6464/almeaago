import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Loader2,
  Radio,
  RefreshCcw,
  Trophy,
  Wifi,
  WifiOff,
  Hand,
  PenTool,
  Sparkles,
  HelpCircle,
  Award,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../auth/state/AuthProvider';
import { classroomClient } from '../api/classroom-client';
import type { ClassroomStudentState, WhiteboardElement, WhiteboardTheme } from '../api/classroom-types';
import { SmartWhiteboardCanvas } from '../components/whiteboard/SmartWhiteboardCanvas';
import { StepSolutionPlayer } from '../components/whiteboard/StepSolutionPlayer';
import { xapi } from '../api/classroom-xapi';

type StudentTab = 'questions' | 'whiteboard' | 'step_solver';

export function ClassroomStudentPage() {
  const { sessionId = '' } = useParams();
  const { user, loading, getCsrfToken } = useAuth();
  const [state, setState] = useState<ClassroomStudentState | null>(null);
  const [busy, setBusy] = useState(true);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [tick, setTick] = useState(0);
  const [handRaised, setHandRaised] = useState(false);
  const [activeTab, setActiveTab] = useState<StudentTab>('questions');
  const [whiteboardElements, setWhiteboardElements] = useState<WhiteboardElement[]>([]);
  const [whiteboardTheme, setWhiteboardTheme] = useState<WhiteboardTheme>('math_grid');

  const socketRef = useRef<WebSocket | null>(null);
  const activeSessionRef = useRef(sessionId);
  activeSessionRef.current = sessionId;
  const readVersionRef = useRef(0);
  const joinVersionRef = useRef(0);
  const [joinedSessionId, setJoinedSessionId] = useState('');
  const [loadedSessionId, setLoadedSessionId] = useState('');
  const visibleState = joinedSessionId === sessionId && state?.sessionId === sessionId ? state : null;

  // Load latest student state
  const refresh = useCallback(async () => {
    if (!sessionId || activeSessionRef.current !== sessionId) return;
    const version = ++readVersionRef.current;
    try {
      const out = await classroomClient.current(sessionId);
      if (activeSessionRef.current !== sessionId || version !== readVersionRef.current) return;
      if (out.state.sessionId !== sessionId) throw new Error('تعذر التحقق من جلسة الحصة');
      setState(out.state);
      setError('');

      // Check whiteboard storage if synced
      try {
        const wbRaw = sessionStorage.getItem(`almeaa:whiteboard:${sessionId}`);
        if (wbRaw) {
          const parsed = JSON.parse(wbRaw);
          if (parsed.elements) setWhiteboardElements(parsed.elements);
          if (parsed.theme) setWhiteboardTheme(parsed.theme);
        }
      } catch {}
    } catch (e) {
      if (activeSessionRef.current !== sessionId || version !== readVersionRef.current) return;
      setState(null);
      setError(e instanceof Error ? e.message : 'تعذر تحميل حالة الحصة');
    } finally {
      if (activeSessionRef.current === sessionId && version === readVersionRef.current)
        setBusy(false);
    }
  }, [sessionId]);

  const enter = useCallback(async () => {
    if (!sessionId || !user?.roles.includes('student')) return;
    const version = ++joinVersionRef.current;
    setBusy(true);
    setError('');
    try {
      const csrf = await getCsrfToken();
      if (activeSessionRef.current !== sessionId || version !== joinVersionRef.current) return;
      await classroomClient.join(sessionId, csrf);
      if (activeSessionRef.current !== sessionId || version !== joinVersionRef.current) return;
      setJoinedSessionId(sessionId);
      await refresh();

      // Record standard xAPI statement for student join
      xapi.recordJoin(sessionId, user.id, user.name || 'طالب', 'dashboard');
    } catch (e) {
      if (activeSessionRef.current !== sessionId || version !== joinVersionRef.current) return;
      setJoinedSessionId('');
      setState(null);
      setError(e instanceof Error ? e.message : 'تعذر الانضمام للحصة');
    } finally {
      if (activeSessionRef.current === sessionId && version === joinVersionRef.current) {
        setLoadedSessionId(sessionId);
        setBusy(false);
      }
    }
  }, [sessionId, user, getCsrfToken, refresh]);

  useEffect(() => {
    readVersionRef.current++;
    joinVersionRef.current++;
    setState(null);
    setJoinedSessionId('');
    setLoadedSessionId('');
    setAction('');
    setError('');
    setConnected(false);
    if (loading || !user?.roles.includes('student') || !sessionId) return;
    void enter();
    return () => {
      readVersionRef.current++;
      joinVersionRef.current++;
    };
  }, [loading, user, sessionId, enter]);

  const retry = () => {
    if (joinedSessionId === sessionId) {
      setBusy(true);
      void refresh();
    } else {
      void enter();
    }
  };

  useEffect(() => {
    socketRef.current?.close();
    socketRef.current = null;
    if (!sessionId || !user || !visibleState || visibleState.status !== 'live') return;
    let stopped = false;
    let retryTimer: number | undefined;

    const connect = () => {
      if (stopped) return;
      try {
        const ws = classroomClient.websocket(sessionId);
        socketRef.current = ws;
        ws.onopen = () => {
          setConnected(true);
          void refresh();
        };
        ws.onmessage = () => void refresh();
        ws.onclose = () => {
          setConnected(false);
          if (!stopped) retryTimer = window.setTimeout(connect, 1500);
        };
        ws.onerror = () => ws.close();
      } catch {
        setConnected(false);
        retryTimer = window.setTimeout(connect, 2000);
      }
    };
    connect();
    const poll = window.setInterval(() => void refresh(), 5000);
    return () => {
      stopped = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      window.clearInterval(poll);
      socketRef.current?.close();
      setConnected(false);
    };
  }, [sessionId, user, visibleState?.status, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const challengeRemaining = useMemo(() => {
    void tick;
    if (!visibleState?.challenge?.timerEndsAt || visibleState.challenge.expired) return 0;
    return Math.max(0, Math.ceil((Date.parse(visibleState.challenge.timerEndsAt) - Date.now()) / 1000));
  }, [visibleState?.challenge?.timerEndsAt, visibleState?.challenge?.expired, tick]);

  const challengeClosed = Boolean(
    visibleState?.challenge?.competitionEnabled &&
      (visibleState.challenge.expired || challengeRemaining <= 0)
  );

  async function answer(ordinal: number, index: number) {
    if (!sessionId || challengeClosed || joinedSessionId !== sessionId || !visibleState) return;
    const scope = sessionId;
    setAction(`${ordinal}:${index}`);
    setError('');
    try {
      const csrf = await getCsrfToken();
      if (activeSessionRef.current !== scope) return;
      await classroomClient.answer(scope, ordinal, index, csrf);
      if (activeSessionRef.current === scope) await refresh();

      // Record xAPI answer statement
      xapi.recordAnswer(
        scope,
        user?.id || 'student',
        user?.name || 'طالب',
        ordinal,
        index
      );
    } catch (e) {
      if (activeSessionRef.current === scope)
        setError(e instanceof Error ? e.message : 'تعذر حفظ الإجابة');
    } finally {
      if (activeSessionRef.current === scope) setAction('');
    }
  }

  const toggleHandRaise = () => {
    setHandRaised((prev) => !prev);
  };

  if (loading) {
    return (
      <main dir="rtl" className="p-10 text-center font-black">
        <Loader2 className="mx-auto mb-2 animate-spin text-indigo-600" />
        جاري دخول الحصة الذكية...
      </main>
    );
  }
  if (!user || !user.roles.includes('student')) {
    return (
      <main dir="rtl" className="p-10 text-center font-black text-rose-700">
        هذه الوجهة مخصصة للطلاب المسجلين فقط.
      </main>
    );
  }
  if (busy || loadedSessionId !== sessionId) {
    return (
      <main dir="rtl" className="p-10 text-center font-black">
        <Loader2 className="mx-auto mb-2 animate-spin text-indigo-600" />
        جاري التحقق من قاعة الفصل والانضمام...
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 px-3 py-5 sm:px-6 dark:bg-slate-950 transition-colors">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Student Classroom Header */}
        <header className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-xl dark:border-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-cyan-300">
                <Radio size={16} className={connected ? 'animate-pulse' : ''} />
                <span className="text-xs font-black uppercase tracking-wider">
                  الفصل الذكي التفاعلي · طالب
                </span>
              </div>
              <h1 className="mt-1.5 text-2xl font-black">الحصة المباشرة</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Hand raise button */}
              <button
                type="button"
                onClick={toggleHandRaise}
                className={`inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-black transition ${
                  handRaised
                    ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Hand size={15} className={handRaised ? 'animate-bounce' : ''} />
                {handRaised ? 'يدك مرفوعة ✋' : 'طلب المشاركة'}
              </button>

              {/* Real-time Connection Indicator */}
              <div
                className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-black ${
                  connected
                    ? 'bg-emerald-500/20 text-emerald-200'
                    : 'bg-amber-500/20 text-amber-200'
                }`}
              >
                {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
                {connected ? 'متصل لحظياً' : 'إعادة اتصال…'}
              </div>
            </div>
          </div>

          {/* Challenge Timer Banner */}
          {visibleState?.challenge?.competitionEnabled && (
            <div
              data-testid="student-challenge-timer"
              className="mt-4 flex items-center justify-between rounded-2xl bg-violet-500/20 border border-violet-400/30 p-3.5 text-violet-100"
            >
              <div className="flex items-center gap-2 font-black text-xs sm:text-sm">
                <Trophy size={18} className="text-violet-300" />
                <span>تحدي الدفعة التنافسي · 100 نقطة لكل إجابة صحيحة</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 font-mono text-base font-black text-violet-200">
                <Clock3 size={15} />
                {challengeRemaining}s
              </div>
            </div>
          )}
        </header>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition ${
              activeTab === 'questions'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <HelpCircle size={15} />
            الأسئلة والإجابة
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('whiteboard')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition ${
              activeTab === 'whiteboard'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <PenTool size={15} />
            سبورة المعلم
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('step_solver')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition ${
              activeTab === 'step_solver'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles size={15} />
            شرح الحل (خطوة بخطوة)
          </button>
        </div>

        {error ? (
          <div role="alert" className="rounded-2xl bg-rose-50 p-4 font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
            <button
              type="button"
              onClick={retry}
              className="mr-2 inline-flex items-center gap-1 font-black underline"
            >
              <RefreshCcw size={14} />
              إعادة المحاولة
            </button>
          </div>
        ) : null}

        {challengeClosed && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-xs font-black text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300">
            انتهت نافذة التحدي الزمني. أغلق الخادم استقبال الإجابات؛ بانتظار خطوة المعلم القادمة.
          </div>
        )}

        {/* Tab Content: Whiteboard */}
        {activeTab === 'whiteboard' && (
          <section className="space-y-4">
            <SmartWhiteboardCanvas
              sessionId={sessionId}
              isReadOnly={true}
              initialElements={whiteboardElements}
              initialTheme={whiteboardTheme}
            />
          </section>
        )}

        {/* Tab Content: Step Solver */}
        {activeTab === 'step_solver' && (
          <section className="space-y-4">
            <StepSolutionPlayer
              questionText={
                visibleState?.questions[0]?.text ||
                'شرح وحل تفاعلي للأسئلة بالسبورة الذكية:'
              }
            />
          </section>
        )}

        {/* Tab Content: Questions */}
        {activeTab === 'questions' && (
          <>
            {visibleState?.status === 'ended' || visibleState?.status === 'archived' ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <CheckCircle2 className="mx-auto text-emerald-600" size={48} />
                <h2 className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                  انتهت الحصة بنجاح
                </h2>
                <p className="mt-2 text-xs font-bold text-slate-500">
                  حُفظت كافة مشاركاتك وإجاباتك في السجل التراكمي المعتمد للمدرسة.
                </p>
              </section>
            ) : visibleState?.questions && visibleState.questions.length > 0 ? (
              <div className="space-y-4">
                {visibleState.questions.map((q) => (
                  <section
                    key={q.ordinal}
                    className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between text-xs font-black text-indigo-600 dark:text-indigo-400">
                      <span>السؤال #{q.ordinal + 1}</span>
                      {q.revealed && (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          تم كشف الحل من المعلم
                        </span>
                      )}
                    </div>

                    <h2 className="mt-3 text-lg font-black leading-8 text-slate-900 dark:text-white sm:text-xl">
                      {q.text || 'سؤال بصري'}
                    </h2>

                    {/* Touch-first Answer Options */}
                    <div className="mt-6 grid gap-3">
                      {q.options.map((o) => {
                        const isSelected = q.selectedOptionIndex === o.index;
                        const isCorrect = q.revealed && q.correctOptionIndex === o.index;
                        const isWrong = q.revealed && isSelected && !isCorrect;

                        return (
                          <button
                            key={o.index}
                            type="button"
                            aria-pressed={isSelected}
                            data-testid={`classroom-answer-${q.ordinal}-${o.index}`}
                            disabled={q.revealed || challengeClosed || action !== ''}
                            onClick={() => void answer(q.ordinal, o.index)}
                            className={`flex items-center justify-between rounded-2xl border-2 p-4 text-right font-black transition disabled:cursor-default ${
                              isCorrect
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                                : isWrong
                                ? 'border-rose-400 bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200'
                                : isSelected
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm dark:bg-indigo-950/50 dark:text-indigo-200'
                                : 'border-slate-100 bg-white hover:border-indigo-200 dark:border-slate-800 dark:bg-slate-900 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {['أ', 'ب', 'ج', 'د', 'هـ'][o.index] || o.index + 1}
                              </span>
                              <span className="text-sm">{o.text || `الخيار ${o.index + 1}`}</span>
                            </div>

                            {action === `${q.ordinal}:${o.index}` && (
                              <Loader2 className="animate-spin text-indigo-600" size={18} />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Explanation after reveal */}
                    {q.revealed ? (
                      <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                        <div className="font-black text-xs text-emerald-800 dark:text-emerald-300 mb-1">
                          طريقة الحل والشرح المعتمد:
                        </div>
                        {q.explanation ? (
                          <p className="text-xs font-bold leading-6 text-emerald-900 dark:text-emerald-200">
                            {q.explanation}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-4 text-[11px] font-bold text-slate-400">
                        {challengeClosed
                          ? 'انتهى وقت التحدي.'
                          : 'يمكنك تعديل إجابتك بحرية قبل إغلاق السؤال أو كشف الحل.'}
                      </p>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <Radio className="mx-auto text-slate-400 animate-pulse" size={44} />
                <h3 className="mt-4 text-xl font-black text-slate-900 dark:text-white">
                  بانتظار طرح السؤال من المعلم
                </h3>
                <p className="mt-2 text-xs font-bold text-slate-500">
                  أنت متصل بالقاعة بنجاح. ستظهر الأسئلة أو السبورة الذكية فور نشرها.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
