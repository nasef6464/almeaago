import { Share2 } from 'lucide-react';
import { useState } from 'react';

import type { Result } from '../api/attempt-client';
import { formatResultDuration } from '../relativeDate';

export function AssessmentShareScorecard({ result, title, studentName }: { result: Result; title: string; studentName?: string }) {
  const [shareError, setShareError] = useState(false);
  const text = `حققت ${result.score}% في اختبار ${title} على منصة ألمعاء! هل يمكنك التفوق علي؟ 🚀`;

  async function share() {
    setShareError(false);
    try {
      await navigator.share({ title: 'نتيجتي في منصة ألمعاء', text });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setShareError(true);
    }
  }

  const buttonClass = 'flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] hover:bg-indigo-700 active:scale-[0.98] print:hidden';

  return (
    <section aria-label="بطاقة مشاركة النتيجة" className="flex w-full flex-col items-center gap-4 py-2">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-950 p-6 text-white shadow-xl">
        <div aria-hidden="true" className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden="true" className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="relative flex flex-col items-center text-center">
          <span aria-hidden="true" className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-3xl shadow-inner backdrop-blur-md">
            {result.score >= 90 ? '🏆' : result.score >= 70 ? '⭐' : '💪'}
          </span>
          <h3 className="text-xs font-bold text-indigo-200">بطل ألمعاء</h3>
          <p className="mt-1 text-xl font-black">{studentName || 'طالب طموح'}</p>
          <div className="my-6 w-full rounded-2xl border border-white/10 bg-white/10 p-5 shadow-inner backdrop-blur-sm">
            <div className="text-5xl font-black text-amber-300 drop-shadow-lg">{result.score}%</div>
            <div className="mt-2 w-full truncate text-sm font-bold text-indigo-50" title={title}>في اختبار: {title}</div>
          </div>
          <div className="flex w-full justify-center gap-6 text-[11px] font-bold text-indigo-200">
            <div className="flex flex-col items-center gap-1"><span className="text-base text-white">{result.correctAnswers}</span><span>إجابة صحيحة</span></div>
            <div aria-hidden="true" className="h-8 w-px bg-white/20" />
            <div className="flex flex-col items-center gap-1"><span className="text-base text-white">{formatResultDuration(result.timeSpentSeconds)}</span><span>وقت الحل</span></div>
          </div>
          <div className="mt-6 border-t border-white/10 pt-4 text-[10px] font-bold uppercase tracking-widest text-indigo-300/80">almeaa.com</div>
        </div>
      </div>
      {typeof navigator.share === 'function' ? (
        <button type="button" onClick={() => void share()} className={buttonClass}><Share2 size={18} /> شارك نتيجتك وتحدّ أصدقاءك</button>
      ) : (
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className={buttonClass}><Share2 size={18} /> شارك نتيجتك وتحدّ أصدقاءك</a>
      )}
      {shareError && <p role="alert" className="text-sm font-bold text-rose-700">تعذرت مشاركة النتيجة.</p>}
    </section>
  );
}
