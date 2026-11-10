import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Volume2,
  VolumeX,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Moon,
  Sun,
} from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Step {
  stepNumber: number;
  title: string;
  explanation: string;
  latex?: string;
}

interface StepSolutionPlayerProps {
  questionText?: string;
  steps?: Step[];
  onComplete?: () => void;
}

const DEFAULT_STEPS: Step[] = [
  {
    stepNumber: 1,
    title: 'تحديد المعطيات والمطلوب',
    explanation: 'نحدد المعطيات في السؤال ونحدد المتغير المجهول x.',
    latex: '2x + 10 = 30',
  },
  {
    stepNumber: 2,
    title: 'عزل المتغير بطرح 10 من الطرفين',
    explanation: 'نطرح الثابت 10 من طرفي المعادلة للحفاظ على التساوي الرياضي.',
    latex: '2x = 30 - 10 \\implies 2x = 20',
  },
  {
    stepNumber: 3,
    title: 'القسمة على معامل x للحصول على الحل النهائي',
    explanation: 'نقسم طرفي المعادلة على 2 لحساب قيمة x بدقة.',
    latex: 'x = \\frac{20}{2} = 10',
  },
  {
    stepNumber: 4,
    title: 'التحقق من صحة الإجابة والمهارة الرياضية',
    explanation: 'نعوض x = 10 في المعادلة الأصلية: 2(10) + 10 = 30 (صحيحة تماماً).',
    latex: '2(10) + 10 = 20 + 10 = 30 \\quad \\checkmark',
  },
];

export const StepSolutionPlayer: React.FC<StepSolutionPlayerProps> = ({
  questionText = 'أوجد قيمة x في المعادلة الآتية:',
  steps = DEFAULT_STEPS,
  onComplete,
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const timerRef = useRef<any>(null);

  const activeStep = steps[currentStepIdx] || steps[0];

  // Speech synthesis for step narration
  const speakStep = (text: string) => {
    if (!soundEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  useEffect(() => {
    if (activeStep) {
      speakStep(`${activeStep.title}. ${activeStep.explanation}`);
    }
  }, [currentStepIdx, soundEnabled]);

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setTimeout(() => {
      if (currentStepIdx < steps.length - 1) {
        setCurrentStepIdx((prev) => prev + 1);
      } else {
        setIsPlaying(false);
        if (onComplete) onComplete();
      }
    }, 6000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentStepIdx, steps.length, onComplete]);

  const renderFormula = (formula: string) => {
    try {
      return (
        <div
          dir="ltr"
          className="my-3 text-2xl font-bold"
          dangerouslySetInnerHTML={{
            __html: katex.renderToString(formula, { displayMode: true, throwOnError: false }),
          }}
        />
      );
    } catch {
      return <div dir="ltr" className="my-2 font-mono">{formula}</div>;
    }
  };

  const isDark = theme === 'dark';

  return (
    <div
      dir="rtl"
      className={`flex flex-col rounded-3xl border shadow-xl overflow-hidden transition-colors ${
        isDark
          ? 'border-slate-800 bg-slate-950 text-white'
          : 'border-slate-200 bg-white text-slate-900'
      }`}
    >
      {/* Top Header */}
      <div className={`flex items-center justify-between border-b px-5 py-3.5 ${
        isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50'
      }`}>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 font-black">
            <Sparkles size={16} />
          </span>
          <span className="text-sm font-black">حل تفاعلي خطوة بخطوة بالسبورة الذكية</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            title={soundEnabled ? 'كتم الصوت' : 'تشغيل الصوت'}
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            type="button"
            title="تبديل النمط"
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>

      {/* Question context bar */}
      {questionText && (
        <div className={`px-6 py-3 border-b text-sm font-bold ${
          isDark ? 'border-slate-800/60 bg-slate-900/30 text-slate-300' : 'border-slate-100 bg-slate-50/70 text-slate-700'
        }`}>
          {questionText}
        </div>
      )}

      {/* Main chalkboard step display */}
      <div className="relative min-h-[280px] p-6 flex flex-col justify-center items-center text-center">
        {/* Step indicator badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-black text-indigo-400">
          <span>الخطوة {activeStep.stepNumber} من {steps.length}</span>
        </div>

        {/* Step Title */}
        <h4 className="mt-3 text-xl font-black">{activeStep.title}</h4>

        {/* Math formula */}
        {activeStep.latex && renderFormula(activeStep.latex)}

        {/* Step Explanation */}
        <p className={`mt-2 max-w-xl text-base leading-7 font-bold ${
          isDark ? 'text-slate-300' : 'text-slate-600'
        }`}>
          {activeStep.explanation}
        </p>
      </div>

      {/* Progress Dots */}
      <div className="flex items-center justify-center gap-2 pb-4">
        {steps.map((_, idx) => (
          <button
            key={idx}
            type="button"
            aria-label={`الانتقال للخطوة ${idx + 1}`}
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIdx(idx);
            }}
            className={`h-2.5 rounded-full transition-all ${
              idx === currentStepIdx
                ? 'w-8 bg-indigo-500'
                : 'w-2.5 bg-slate-400/40 hover:bg-slate-400'
            }`}
          />
        ))}
      </div>

      {/* Bottom Playback Toolbar */}
      <div className={`flex items-center justify-between border-t px-6 py-4 ${
        isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50'
      }`}>
        <button
          type="button"
          onClick={() => {
            setIsPlaying(false);
            setCurrentStepIdx(0);
          }}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-400"
        >
          <RotateCcw size={14} />
          إعادة من البداية
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={currentStepIdx === 0}
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIdx((prev) => Math.max(0, prev - 1));
            }}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-700 hover:bg-slate-800 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>

          <button
            type="button"
            onClick={() => setIsPlaying((prev) => !prev)}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg hover:bg-indigo-700"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="mr-0.5" />}
          </button>

          <button
            type="button"
            disabled={currentStepIdx === steps.length - 1}
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIdx((prev) => Math.min(steps.length - 1, prev + 1));
            }}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-700 hover:bg-slate-800 disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        <div className="text-xs font-bold text-slate-400">
          {isPlaying ? 'تشغيل تلقائي جارٍ…' : 'جاهز للشرح'}
        </div>
      </div>
    </div>
  );
};
