import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { TeachingBoard } from './teaching/TeachingBoard';
import { useTeachingPlayback } from './teaching/useTeachingPlayback';
import { BrowserNarrationEngine } from './teaching/narrationEngine';
import { PracticeCheckpoint } from './teaching/PracticeCheckpoint';
import {
  validateTeachingStoryboard,
  type TeachingStoryboard,
} from './teaching/teachingStoryboard';
import { useAuth } from '../../auth/state/AuthProvider';

export type AssistantContext =
  | 'result_review'
  | 'saved_review'
  | 'mistake_review'
  | 'mastery_review';

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: any) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type TeacherLesson = {
  text: string;
  plan: TeachingStoryboard | null;
};

type SmartTeacherTurn = {
  id: string;
  role: 'student' | 'teacher';
  text: string;
};

export interface InteractiveSmartTeacherProps {
  isOpen: boolean;
  onClose: () => void;
  questionId: string;
  questionText?: string;
  explanation?: string;
  solvingStrategy?: string;
  options?: Array<{ index?: number; label?: string; text: string }>;
  selectedOptionIndex?: number | null;
  correctOptionIndex?: number;
  resultId?: string;
  context?: AssistantContext;
  tutorSessionId?: string;
}

/**
 * Generates an instant, zero-delay storyboard directly from pre-approved question bank assets.
 * Renders in < 50ms without waiting for LLM network latency.
 */
function buildInstantQuestionStoryboard(props: InteractiveSmartTeacherProps): TeachingStoryboard | null {
  const text = (props.questionText || '').trim();
  const expl = (props.explanation || '').trim();
  const strat = (props.solvingStrategy || '').trim();

  if (!text && !expl && !strat) return null;

  const scenes: TeachingStoryboard['scenes'] = [];

  // Scene 1: Problem Definition & Givens
  scenes.push({
    id: 'scene_givens',
    narration: 'أهلاً بك يا بطل! لنبدأ معاً بتحليل معطيات هذا السؤال خطوة بخطوة للوصول إلى الحل الأسرع والأدق.',
    actions: [
      {
        type: 'write',
        id: 'act_given_1',
        kind: 'text',
        content: `المسألة:\n${text || 'مسألة رياضية تتطلب تطبيق القوانين المباشرة.'}`,
      },
    ],
  });

  // Scene 2: Solving Strategy / Formula (if available)
  if (strat || /س|ص|²|³|\+|-|=|\times|\/|\\frac/.test(text)) {
    scenes.push({
      id: 'scene_strategy',
      narration: strat
        ? `استراتيجية الحل المعتمدة: ${strat.slice(0, 200)}.`
        : 'نستحضر القانون والعلاقة الرياضية الأساسية التي تربط معطيات المسألة.',
      actions: [
        {
          type: 'write',
          id: 'act_strat_1',
          kind: strat && /[=+\-*/\\^]/.test(strat) ? 'formula' : 'text',
          content: strat || 'القانون: بتطبيق المتطابقة أو العلاقة الحاكمة مباشرة',
        },
        {
          type: 'highlight',
          target: 'act_strat_1',
        },
      ],
    });
  }

  // Scene 3: Step-by-Step Solution & Conclusion
  if (expl) {
    scenes.push({
      id: 'scene_solution',
      narration: `الخطوة النهائية والتعليل المعتمد: ${expl.slice(0, 250)}. وبذلك نكون قد تأكدنا من صحة الخيار.`,
      actions: [
        {
          type: 'write',
          id: 'act_sol_1',
          kind: /[=+\-*/\\^]/.test(expl) ? 'formula' : 'text',
          content: expl,
        },
        {
          type: 'box',
          target: 'act_sol_1',
        },
      ],
    });
  }

  return {
    version: 1,
    language: 'ar-SA',
    scenes,
  };
}

export const InteractiveSmartTeacher: React.FC<InteractiveSmartTeacherProps> = ({
  isOpen,
  onClose,
  questionId,
  questionText = '',
  explanation = '',
  solvingStrategy = '',
  options = [],
  selectedOptionIndex,
  correctOptionIndex,
  resultId,
  context = 'result_review',
  tutorSessionId = 'smart-tutor-session',
}) => {
  const { getCsrfToken } = useAuth();
  const [turns, setTurns] = useState<SmartTeacherTurn[]>([]);
  const [lesson, setLesson] = useState<TeacherLesson | null>(null);
  const [reply, setReply] = useState<TeacherLesson | null>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [autoVoice, setAutoVoice] = useState(true);
  const [listening, setListening] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const requestRef = useRef(false);
  const generation = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const legacyNarrator = useMemo(() => new BrowserNarrationEngine(), []);

  const main = useTeachingPlayback(
    lesson?.plan || null,
    autoVoice,
    isOpen && !reply && !pending && !listening
  );
  const branch = useTeachingPlayback(
    reply?.plan || null,
    autoVoice,
    isOpen && !pending && !listening,
    false
  );

  const active = reply ? branch : main;
  const activeLesson = reply || lesson;

  const stopListening = () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        // Ignored
      }
    }
    setListening(false);
  };

  const interrupt = () => {
    main.pause();
    branch.pause();
    legacyNarrator.cancel();
  };

  const ask = async (
    studentText: string,
    helpLevel: 'concept' | 'steps' | 'follow_up' = 'follow_up',
    replaceLesson = false
  ) => {
    const clean = studentText.trim();
    if (!clean || requestRef.current) return;
    const interruptedContext = active.context || activeLesson?.text.slice(0, 1000) || '';
    interrupt();
    stopListening();
    requestRef.current = true;
    const requestGeneration = generation.current;

    setTurns((current) => [...current, { id: `student-${Date.now()}`, role: 'student', text: clean }]);
    setPending(true);
    setError('');
    setMessage('');
    if (lesson && !replaceLesson) setChatOpen(true);

    try {
      const csrf = await getCsrfToken();
      const base = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const resp = await fetch(`${base}/api/v1/ai/question-assistant`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-CSRF-Token': csrf,
        },
        body: JSON.stringify({
          questionId,
          reviewCardId: questionId,
          attemptId: resultId || '',
          resultId: resultId || '',
          context,
          helpLevel,
          message: clean.slice(0, 800),
          boardMode: 'storyboard_v1',
          boardContext: interruptedContext,
          tutorSessionId,
          questionText,
          userSelectedAnswer: selectedOptionIndex ?? undefined,
          correctAnswer: correctOptionIndex ?? undefined,
        }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.message || 'تعذر تشغيل المعلم الذكي الآن.');
      }

      const data = await resp.json();
      if (requestGeneration !== generation.current) return;

      const resultPayload = data.result || data;
      const text = String(resultPayload.text || '').trim();
      const plan = validateTeachingStoryboard(resultPayload.storyboard || data.storyboard) || lesson?.plan || null;

      const next: TeacherLesson = {
        text: text || 'هذا الشرح التوضيحي للخطوة.',
        plan,
      };

      setTurns((current) => [
        ...current,
        { id: `teacher-${Date.now()}`, role: 'teacher', text: next.text },
      ]);

      if (!lesson || replaceLesson) {
        setLesson(next);
        setReply(null);
      } else {
        setReply(next);
      }

      if (!next.plan && autoVoice) {
        legacyNarrator.speak(next.text, 'ar-SA', () => {});
      }
      return true;
    } catch (requestError) {
      if (requestGeneration === generation.current) {
        setError(requestError instanceof Error ? requestError.message : 'تعذر تشغيل المعلم الذكي الآن.');
      }
      return false;
    } finally {
      if (requestGeneration === generation.current) {
        requestRef.current = false;
        setPending(false);
      }
    }
  };

  const attemptStep = async (answer: string) => {
    if (!main.checkpoint) return false;
    const result = await ask(
      `راجع محاولتي لهذه الخطوة: ${main.checkpoint.prompt}\nإجابتي: ${answer.slice(
        0,
        350
      )}\nوضح صحة الخطوة من المرجع المعتمد؛ إن أخطأت أعطني تلميحاً ذكياً دون حرق الحل بالكامل.`
    );
    if (result) main.completeCheckpoint();
    return result;
  };

  // On Open: Immediate Zero-Delay Initialization
  useEffect(() => {
    if (!isOpen) return;

    setLesson(null);
    setReply(null);
    setTurns([]);
    setMessage('');
    setError('');
    setChatOpen(false);
    requestRef.current = false;

    // 1. Instant First Paint: render from local question props immediately (<50ms)!
    const instantPlan = buildInstantQuestionStoryboard({
      isOpen,
      onClose,
      questionId,
      questionText,
      explanation,
      solvingStrategy,
    });

    if (instantPlan) {
      setLesson({
        text: explanation || 'شرح السؤال والخطوات المعتمدة للحل.',
        plan: instantPlan,
      });
    }

    // 2. Fetch full background storyboard from Go backend / LLM provider
    void ask('اشرح حل هذا السؤال بخطوات واضحة واكتب الرموز والمعادلات على السبورة.', 'steps', !instantPlan);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      generation.current += 1;
      requestRef.current = false;
      stopListening();
      legacyNarrator.cancel();
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, questionId, resultId, context, tutorSessionId]);

  useEffect(() => {
    if (!autoVoice) legacyNarrator.cancel();
  }, [autoVoice, legacyNarrator]);

  const toggleListening = () => {
    if (listening) {
      stopListening();
      return;
    }
    if (requestRef.current) return;

    const target = window as typeof window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = target.SpeechRecognition || target.webkitSpeechRecognition;

    if (!Recognition) {
      setError('التعرف على الصوت غير متاح في هذا المتصفح. يمكنك كتابة سؤالك في الحقل.');
      setChatOpen(true);
      return;
    }

    interrupt();
    setChatOpen(true);
    const recognition = new Recognition();
    recognition.lang = activeLesson?.plan?.language || 'ar-SA';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const transcript = String(event?.results?.[0]?.[0]?.transcript || '').trim();
      recognitionRef.current = null;
      setListening(false);
      if (transcript) {
        void (main.checkpoint && !reply ? attemptStep(transcript) : ask(transcript));
      }
    };

    recognition.onerror = () => {
      recognitionRef.current = null;
      setListening(false);
      setError('لم يتم التقاط الصوت بوضوح. أعد المحاولة أو اكتب سؤالك.');
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        setListening(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      setError('');
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError('تعذر تشغيل الميكروفون. يمكنك كتابة سؤالك.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-2 sm:p-5 backdrop-blur-md"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="المعلم الذكي والسبورة التفاعلية"
    >
      <div className="flex h-[96dvh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-950 text-white shadow-2xl sm:h-[92dvh]">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <Bot size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-base text-white">المعلم الذكي والسبورة التفاعلية</h2>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-400 border border-emerald-500/30">
                  شرح فوري وصوت متزامن
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">السبورة الذكية تحاكي الشرح الواقعي خطوة بخطوة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`min-h-10 min-w-10 rounded-xl p-2.5 transition border ${
                autoVoice
                  ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              onClick={() => setAutoVoice((value) => !value)}
              aria-label={autoVoice ? 'إيقاف الشرح الصوتي' : 'تشغيل الشرح الصوتي'}
              title={autoVoice ? 'الصوت مفعّل' : 'الصوت متوقف'}
            >
              {autoVoice ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 min-h-10 rounded-xl bg-violet-600 px-3.5 text-xs font-black text-white hover:bg-violet-700 transition shadow-sm"
              onClick={() => {
                interrupt();
                setChatOpen((value) => !value);
              }}
              aria-expanded={chatOpen}
            >
              <MessageCircle size={16} />
              <span>اسأل المعلم</span>
            </button>

            <button
              type="button"
              className="min-h-10 min-w-10 rounded-xl bg-slate-800 p-2.5 text-slate-400 hover:text-white hover:bg-slate-700 transition border border-slate-700"
              onClick={onClose}
              aria-label="إغلاق المعلم الذكي"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div
          className={`grid min-h-0 flex-1 ${
            chatOpen
              ? 'grid-rows-[minmax(0,1fr)_minmax(200px,.65fr)] lg:grid-rows-1 lg:grid-cols-[minmax(0,4fr)_minmax(280px,1.2fr)]'
              : 'grid-cols-1'
          }`}
        >
          {/* Main Blackboard View */}
          <section className="flex min-h-0 flex-col gap-3 bg-slate-900/50 p-3 sm:p-5 overflow-auto">
            <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-800 bg-slate-950 shadow-inner">
              {activeLesson?.plan ? (
                <TeachingBoard
                  elements={active.elements}
                  narration={active.narration}
                  language={activeLesson.plan.language}
                />
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center gap-4 p-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
                    <Sparkles size={32} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">السبورة التفاعلية جاهزة</h3>
                    <p className="mt-1 text-xs text-slate-400 font-medium">
                      {pending ? 'المعلم يجهز الشرح التفصيلي...' : 'اضغط للبدء وسيقوم المعلم بالشرح المباشر.'}
                    </p>
                  </div>
                  {!pending ? (
                    <button
                      type="button"
                      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-700 transition"
                      onClick={() => void ask('اشرح السؤال خطوة بخطوة بالتفصيل.', 'steps', true)}
                    >
                      ابدأ الشرح الآن
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            {pending ? (
              <p role="status" className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <Loader2 size={14} className="animate-spin" />
                <span>المعلم يجهز الشرح التفاعلي...</span>
              </p>
            ) : null}

            {/* Checkpoint for student practice */}
            {main.checkpoint && !reply ? (
              <PracticeCheckpoint
                key={`${questionId}-${main.sceneIndex}`}
                checkpoint={main.checkpoint}
                pending={pending}
                onAttempt={attemptStep}
                onSkip={() => main.completeCheckpoint(true)}
              />
            ) : null}

            {reply ? (
              <div className="flex items-center justify-between rounded-xl bg-violet-950/60 p-3 border border-violet-500/30">
                <span className="text-xs font-bold text-violet-200">أنت الآن في فرع إجابة سؤالك الخاص.</span>
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                  onClick={() => {
                    branch.pause();
                    legacyNarrator.cancel();
                    setReply(null);
                    setChatOpen(false);
                    main.toggle();
                  }}
                >
                  العودة للشرح الرئيسي
                </button>
              </div>
            ) : null}

            {/* Blackboard Playback Navigation Bar */}
            {activeLesson?.plan ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="min-h-9 min-w-9 rounded-xl bg-slate-800 p-2 text-slate-300 hover:text-white disabled:opacity-40 transition"
                    disabled={pending || listening || active.sceneIndex === 0}
                    onClick={() => active.seek(active.sceneIndex - 1)}
                    aria-label="الخطوة السابقة"
                    title="السابق"
                  >
                    <ChevronRight size={18} />
                  </button>

                  <button
                    type="button"
                    className="flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-40 transition"
                    disabled={pending || listening || Boolean(active.checkpoint)}
                    onClick={active.toggle}
                  >
                    {active.playing ? <Pause size={15} /> : <Play size={15} />}
                    <span>{active.playing ? 'إيقاف مؤقت' : 'تشغيل'}</span>
                  </button>

                  <button
                    type="button"
                    className="min-h-9 min-w-9 rounded-xl bg-slate-800 p-2 text-slate-300 hover:text-white disabled:opacity-40 transition"
                    disabled={
                      pending ||
                      listening ||
                      active.sceneIndex >= activeLesson.plan.scenes.length - 1
                    }
                    onClick={() => active.seek(active.sceneIndex + 1)}
                    aria-label="الخطوة التالية"
                    title="التالي"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <span className="text-xs font-black text-slate-400 mr-2">
                    المشهد {active.sceneIndex + 1} من {activeLesson.plan.scenes.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="min-h-9 rounded-xl bg-slate-800 px-3 text-xs font-bold text-slate-300 hover:text-white transition flex items-center gap-1"
                    onClick={() => active.seek(0)}
                    aria-label="إعادة الشرح من البداية"
                  >
                    <RotateCcw size={14} />
                    <span>من البداية</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Quick Action Chips */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['أبسط أكثر', 'اشرح لي هذه النقطة ببساطة وبخطوات أقصر.'],
                ['مثال آخر', 'اعرض مثالاً تدريبياً مشابهاً لهذه النقطة.'],
                ['لماذا هذه الخطوة؟', 'لماذا قمنا بهذه الخطوة الرياضية تحديداً؟'],
                ['أعد الشرح', 'أعد شرح السؤال من البداية بطريقة أخرى.'],
              ].map(([label, prompt]) => (
                <button
                  key={label}
                  type="button"
                  disabled={pending || listening}
                  className="min-h-9 rounded-xl border border-slate-800 bg-slate-900/90 px-3 text-xs font-bold text-slate-300 hover:border-violet-500/50 hover:bg-slate-800 hover:text-white disabled:opacity-40 transition"
                  onClick={() =>
                    void ask(
                      prompt,
                      label === 'أعد الشرح' ? 'steps' : 'follow_up',
                      label === 'أعد الشرح'
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {error ? (
              <p role="alert" className="rounded-xl bg-rose-950/60 border border-rose-800/40 p-3 text-xs font-bold text-rose-300">
                {error}
              </p>
            ) : null}
          </section>

          {/* Dialogue / Smart Assistant Sidebar */}
          {chatOpen ? (
            <aside
              id="teacher-dialogue"
              className="flex min-h-0 flex-col border-t border-white/10 bg-slate-900/80 p-3 lg:border-r lg:border-t-0"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <h3 className="font-black text-xs text-slate-200">حوار المعلم الذكي</h3>
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  className="p-1 text-slate-400 hover:text-white"
                  aria-label="إغلاق الحوار"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-2.5 overflow-auto py-3">
                {turns.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-6">
                    يمكنك كتابة أي استفسار أو التحدث صوتياً مع المعلم.
                  </p>
                ) : null}
                {turns.map((turn) => (
                  <div
                    key={turn.id}
                    className={`rounded-2xl p-3 text-xs leading-6 ${
                      turn.role === 'student'
                        ? 'bg-violet-600/30 border border-violet-500/40 text-violet-100 mr-4'
                        : 'bg-slate-800 border border-slate-700 text-slate-200 ml-4'
                    }`}
                  >
                    <div className="text-[10px] font-black opacity-60 mb-1">
                      {turn.role === 'student' ? 'سؤالك:' : 'المعلم:'}
                    </div>
                    {turn.text}
                  </div>
                ))}
              </div>

              <form
                className="mt-2 flex gap-1.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void ask(message);
                }}
              >
                <input
                  aria-label="سؤالك للمعلم"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onFocus={interrupt}
                  disabled={pending || listening}
                  maxLength={800}
                  placeholder="اسأل المعلم عن هذه الخطوة..."
                  className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-hidden"
                />

                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={pending}
                  className={`min-h-9 min-w-9 rounded-xl p-2 transition ${
                    listening ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  aria-label={listening ? 'إيقاف الاستماع' : 'تحدث مع المعلم'}
                  title="تحدث بالصوت"
                >
                  {listening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>

                <button
                  type="submit"
                  disabled={pending || listening || !message.trim()}
                  className="min-h-9 min-w-9 rounded-xl bg-violet-600 p-2 text-white hover:bg-violet-700 disabled:opacity-40 transition"
                  aria-label="إرسال السؤال للمعلم"
                >
                  <Send size={16} />
                </button>
              </form>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
};
