import React, { useState } from 'react';
import type { TeachingCheckpoint } from './teachingStoryboard';
import { HelpCircle, Send, Sparkles } from 'lucide-react';

export function PracticeCheckpoint({
  checkpoint,
  pending,
  onAttempt,
  onSkip,
}: {
  checkpoint: TeachingCheckpoint;
  pending: boolean;
  onAttempt: (answer: string) => Promise<boolean | undefined>;
  onSkip: () => void;
}) {
  const [answer, setAnswer] = useState('');
  const [hintCount, setHintCount] = useState(0);

  return (
    <section
      aria-label="جرّب الخطوة القادمة"
      className="rounded-2xl border border-violet-400/40 bg-violet-950/40 p-4 shadow-lg backdrop-blur-xs"
    >
      <div className="flex items-center gap-2 text-violet-300 mb-1">
        <Sparkles size={18} className="text-amber-400" />
        <h3 className="font-black text-sm">جرّب الخطوة القادمة بنفسك</h3>
      </div>

      <p className="my-2 text-sm leading-6 text-slate-100 font-bold">{checkpoint.prompt}</p>

      <form
        className="flex gap-2 mt-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (answer.trim() && !pending && (await onAttempt(answer.trim()))) {
            setAnswer('');
          }
        }}
      >
        <input
          aria-label="إجابتك على الخطوة"
          maxLength={350}
          disabled={pending}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="اكتب فكرتك أو الناتج هنا..."
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-hidden"
        />
        <button
          type="submit"
          disabled={pending || !answer.trim()}
          className="inline-flex items-center gap-1.5 min-h-11 rounded-xl bg-violet-600 px-4 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-40 transition"
        >
          <Send size={14} />
          <span>تحقق</span>
        </button>
      </form>

      {hintCount > 0 ? (
        <div aria-live="polite" className="mt-3 space-y-1.5 rounded-xl bg-slate-900/80 p-3 text-xs text-amber-300 border border-amber-400/20">
          {checkpoint.hints.slice(0, hintCount).map((hint, index) => (
            <p key={index} className="flex items-start gap-1.5 leading-relaxed">
              <span className="font-black">تلميح {index + 1}:</span>
              <span>{hint}</span>
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
        <button
          type="button"
          disabled={pending || hintCount >= checkpoint.hints.length}
          onClick={() => setHintCount((count) => Math.min(checkpoint.hints.length, count + 1))}
          className="inline-flex items-center gap-1 min-h-9 rounded-xl bg-slate-800 px-3 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition"
        >
          <HelpCircle size={14} className="text-amber-400" />
          <span>{hintCount ? 'تلميح إضافي' : 'أحتاج تلميحاً'}</span>
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={onSkip}
          className="min-h-9 px-3 text-xs font-bold text-slate-400 hover:text-white transition"
        >
          أكمل الشرح مباشرة
        </button>
      </div>
    </section>
  );
}
