import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock3,
  Maximize2,
  Minimize2,
  Radio,
  Users,
  PenTool,
  HelpCircle,
  Trophy,
  Award,
  QrCode,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { classroomClient } from '../api/classroom-client';
import type { ClassroomPresentation, WhiteboardElement, WhiteboardTheme } from '../api/classroom-types';
import { ClassroomJoinQR } from '../components/ClassroomJoinQR';
import { SmartWhiteboardCanvas } from '../components/whiteboard/SmartWhiteboardCanvas';

type ProjectorMode = 'question' | 'whiteboard' | 'lobby' | 'podium';

export function ClassroomProjectorPage() {
  const { sessionId = '' } = useParams();
  const [snapshot, setSnapshot] = useState<{ sessionId: string; value: ClassroomPresentation } | null>(null);
  const [loadError, setLoadError] = useState<{ sessionId: string; message: string } | null>(null);
  const requestEpoch = useRef(0);
  const presentation = snapshot?.sessionId === sessionId ? snapshot.value : null;
  const error = loadError?.sessionId === sessionId ? loadError.message : '';
  const [tick, setTick] = useState(0);
  const [mode, setMode] = useState<ProjectorMode>('question');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [whiteboardElements, setWhiteboardElements] = useState<WhiteboardElement[]>([]);
  const [whiteboardTheme, setWhiteboardTheme] = useState<WhiteboardTheme>('math_grid');

  const socketRef = useRef<WebSocket | null>(null);
  const pin = sessionId ? sessionStorage.getItem('almeaa:classroom:pin:' + sessionId) || '' : '';

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const epoch = ++requestEpoch.current;
    try {
      const out = await classroomClient.presentation(sessionId);
      if (epoch !== requestEpoch.current) return;
      if (!out.presentation || out.presentation.sessionId !== sessionId)
        throw new Error('تعذر تحميل شاشة العرض');
      setSnapshot({ sessionId, value: out.presentation });
      setLoadError(null);

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
      if (epoch !== requestEpoch.current) return;
      setSnapshot(null);
      setLoadError({
        sessionId,
        message: e instanceof Error ? e.message : 'تعذر تحميل شاشة العرض',
      });
    }
  }, [sessionId]);

  useEffect(() => {
    setSnapshot(null);
    setLoadError(null);
    void refresh();
    return () => {
      requestEpoch.current += 1;
    };
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let stopped = false;
    let retry: number | undefined;

    const connect = () => {
      if (stopped) return;
      try {
        const ws = classroomClient.websocket(sessionId);
        socketRef.current = ws;
        ws.onmessage = () => void refresh();
        ws.onopen = () => void refresh();
        ws.onclose = () => {
          if (!stopped) retry = window.setTimeout(connect, 1500);
        };
        ws.onerror = () => ws.close();
      } catch {
        retry = window.setTimeout(connect, 2000);
      }
    };
    connect();
    const poll = window.setInterval(() => void refresh(), 5000);
    return () => {
      stopped = true;
      if (retry) window.clearTimeout(retry);
      window.clearInterval(poll);
      socketRef.current?.close();
    };
  }, [sessionId, refresh]);

  const active =
    presentation?.questions.find((q) => q.ordinal === presentation.activeQuestionOrdinal) ||
    presentation?.questions[0] ||
    null;
  const agg = presentation?.aggregate.questions.find((q) => q.ordinal === active?.ordinal);

  const remaining = useMemo(() => {
    void tick;
    const challenge = presentation?.challenge;
    if (!challenge?.timerEndsAt || challenge.expired) return 0;
    return Math.max(0, Math.ceil((Date.parse(challenge.timerEndsAt) - Date.now()) / 1000));
  }, [presentation?.challenge?.timerEndsAt, presentation?.challenge?.expired, tick]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 p-4 text-white sm:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        {/* Projector Top Header */}
        <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-cyan-300">
              <Radio size={18} className="animate-pulse" />
              <span className="text-xs font-black tracking-widest uppercase">
                شاشة عرض الفصل الذكي · PROJECTOR DISPLAY
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-black">قاعة الفصل التفاعلي</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Pills for Projector */}
            <div className="flex items-center gap-1 rounded-2xl bg-white/10 p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setMode('question')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                  mode === 'question' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <HelpCircle size={14} />
                السؤال
              </button>

              <button
                type="button"
                onClick={() => setMode('whiteboard')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                  mode === 'whiteboard' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <PenTool size={14} />
                السبورة
              </button>

              <button
                type="button"
                onClick={() => setMode('lobby')}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                  mode === 'lobby' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <QrCode size={14} />
                رمز الدخول
              </button>
            </div>

            {/* Challenge Countdown */}
            {presentation?.challenge?.competitionEnabled ? (
              <div
                data-testid="projector-challenge-timer"
                className="rounded-2xl bg-violet-600 px-5 py-2.5 text-center shadow-lg"
              >
                <div className="flex items-center justify-center gap-1 text-[10px] font-black">
                  <Clock3 size={13} />
                  وقت التحدي
                </div>
                <div className="font-mono text-2xl font-black">{remaining}s</div>
              </div>
            ) : null}

            {/* Joined Count */}
            <div className="rounded-2xl bg-white/10 px-4 py-2.5 text-center border border-white/10">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-300">
                <Users size={14} />
                المنضمون
              </div>
              <div className="mt-0.5 text-2xl font-black text-cyan-300">
                {presentation?.aggregate.joinedCount || 0}
              </div>
            </div>

            {/* PIN Badge */}
            {pin ? (
              <div className="rounded-2xl bg-cyan-400 px-5 py-2 text-center text-slate-950 font-bold shadow-md">
                <div className="text-[10px] font-black">PIN الدخول</div>
                <div dir="ltr" className="font-mono text-2xl font-black tracking-widest">
                  {pin}
                </div>
              </div>
            ) : null}

            {/* Fullscreen Toggle */}
            <button
              type="button"
              aria-label="ملء الشاشة"
              onClick={toggleFullscreen}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 transition"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </header>

        {error ? (
          <div role="alert" className="rounded-2xl bg-rose-500/20 p-4 font-bold text-rose-200">
            {error}
          </div>
        ) : null}

        {/* Projector Mode 1: Whiteboard Mirror */}
        {mode === 'whiteboard' && (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl">
            <SmartWhiteboardCanvas
              sessionId={sessionId}
              isReadOnly={true}
              initialElements={whiteboardElements}
              initialTheme={whiteboardTheme}
            />
          </section>
        )}

        {/* Projector Mode 2: Lobby PIN / QR */}
        {mode === 'lobby' && (
          <section className="rounded-[2.5rem] border border-white/10 bg-white/5 p-12 text-center shadow-2xl">
            <Radio className="mx-auto text-cyan-400 animate-pulse" size={60} />
            <h2 className="mt-6 text-4xl font-black text-white">انضم للحصة الآن</h2>
            <p className="mt-2 text-base text-slate-300 max-w-xl mx-auto">
              امسح الرمز بكاميرا الجوال، أو توجه إلى صفحة الدخول واكتب رمز الـ PIN الموضح
            </p>

            {pin ? (
              <div className="mt-8 flex flex-col items-center justify-center gap-8 sm:flex-row">
                <div className="rounded-3xl bg-white p-5 shadow-2xl">
                  <ClassroomJoinQR pin={pin} size={220} />
                </div>

                <div className="rounded-3xl bg-cyan-400 p-8 text-slate-950 shadow-2xl text-center">
                  <div className="text-sm font-black uppercase">رمز الدخول المباشر</div>
                  <div dir="ltr" className="mt-3 font-mono text-6xl font-black tracking-widest">
                    {pin}
                  </div>
                  <div className="mt-3 text-xs font-bold text-slate-800">
                    almeaa.com/classroom/join
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        )}

        {/* Projector Mode 3: Question Display (Default) */}
        {mode === 'question' && (
          <>
            {active ? (
              <section className="rounded-[2.5rem] bg-white p-8 text-slate-950 shadow-2xl sm:p-12">
                <div className="flex items-center justify-between">
                  <span className="text-base font-black text-indigo-600">
                    السؤال #{active.ordinal + 1}
                  </span>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                    <span>
                      إجابات مسجلة: {agg?.responseCount || 0} من{' '}
                      {presentation?.aggregate.joinedCount || 0}
                    </span>
                  </div>
                </div>

                <h2 className="mt-6 text-3xl font-black leading-snug text-slate-950 sm:text-5xl">
                  {active.text || 'سؤال بصري'}
                </h2>

                {/* Options Grid with Live Bars */}
                <div className="mt-10 grid gap-5 sm:grid-cols-2">
                  {active.options.map((o) => {
                    const isCorrect = active.revealed && active.correctOptionIndex === o.index;
                    const count = agg?.distribution[String(o.index)] || 0;
                    const total = agg?.responseCount || 0;
                    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                    const letters = ['أ', 'ب', 'ج', 'د', 'هـ'];

                    return (
                      <div
                        key={o.index}
                        className={`relative overflow-hidden rounded-3xl border-3 p-6 text-2xl font-black transition ${
                          isCorrect
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-950 shadow-lg'
                            : 'border-slate-200 bg-slate-50/50 text-slate-900'
                        }`}
                      >
                        {/* Live animated progress bar */}
                        <div
                          className={`absolute inset-y-0 right-0 opacity-20 transition-all duration-700 ${
                            isCorrect ? 'bg-emerald-500' : 'bg-indigo-600'
                          }`}
                          style={{ width: `${percent}%` }}
                        />

                        <div className="relative flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <span
                              className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-black ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-white text-slate-800 shadow-sm'
                              }`}
                            >
                              {letters[o.index] || o.index + 1}
                            </span>
                            <span>{o.text || `خيار ${o.index + 1}`}</span>
                          </div>

                          <div className="flex items-center gap-2 text-xl font-mono">
                            <span>{percent}%</span>
                            <span className="rounded-xl bg-white px-3 py-1 text-sm font-bold text-slate-600 shadow-xs">
                              {count}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Solution Explanation if revealed */}
                {active.revealed && active.explanation && (
                  <div className="mt-10 rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-6 text-xl font-bold leading-relaxed text-emerald-900 shadow-sm">
                    <div className="font-black text-emerald-800 mb-2">طريقة الحل والتوضيح:</div>
                    {active.explanation}
                  </div>
                )}
              </section>
            ) : (
              <section className="rounded-[2.5rem] border border-white/10 bg-white/5 p-12 text-center shadow-2xl">
                <Radio className="mx-auto text-slate-500 animate-pulse" size={60} />
                <h2 className="mt-6 text-3xl font-black text-white">بانتظار طرح السؤال</h2>
                <p className="mt-2 text-slate-400">
                  يمكن للطلاب الانضمام بالقاعة الآن استعداداً لبدء الأسئلة التفاعلية.
                </p>

                {pin && (
                  <div className="mt-8 flex flex-col items-center justify-center gap-6 sm:flex-row">
                    <div className="rounded-2xl bg-white p-4">
                      <ClassroomJoinQR pin={pin} size={160} />
                    </div>
                    <div className="rounded-3xl bg-cyan-400 px-8 py-5 text-slate-950 text-center">
                      <div className="text-xs font-black">PIN الدخول السريع</div>
                      <div dir="ltr" className="mt-1 font-mono text-5xl font-black tracking-widest">
                        {pin}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
