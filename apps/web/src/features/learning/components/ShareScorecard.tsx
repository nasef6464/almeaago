import React, { useRef, useState } from 'react';
import { Share2, Check, Sparkles, Award } from 'lucide-react';
import { useAuth } from '../../auth/state/AuthProvider';

export interface ScorecardResult {
  score: number;
  title: string;
  correctAnswers?: number;
  totalQuestions?: number;
  timeSpent?: string;
  badgeLabel?: string;
}

export const ShareScorecard: React.FC<{ result: ScorecardResult; onShared?: () => void }> = ({
  result,
  onShared,
}) => {
  const { user } = useAuth();
  const scorecardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const studentName = user?.name || 'بطل المئة';
  const shareText = `🎯 حققتُ درجة ${result.score}% في "${result.title}" على منصة المئة للقدرات والتحصيلي! 🚀\nهل يمكنك التفوّق عليّ؟ تدرّب الآن: https://almeaa.net`;

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `نتيجتي في منصة المئة: ${result.score}%`,
          text: shareText,
          url: 'https://almeaa.net',
        });
        onShared?.();
        return;
      } catch {
        // User cancelled or failed, fallback to whatsapp/copy
      }
    }

    // Direct WhatsApp share
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    onShared?.();
  };

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      onShared?.();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto" dir="rtl">
      {/* Visual Royal Card */}
      <div
        ref={scorecardRef}
        data-testid="share-scorecard-card"
        className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 p-6 text-white shadow-2xl border border-indigo-500/30 text-center select-none"
      >
        <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 h-44 w-44 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          {/* Badge Icon */}
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-950 shadow-lg text-2xl">
            {result.score >= 90 ? '🏆' : result.score >= 75 ? '⭐' : '💪'}
          </div>

          <div className="text-[11px] font-black uppercase tracking-widest text-amber-300 flex items-center gap-1">
            <Sparkles size={12} />
            منصة المئة التعليمية
          </div>
          <h2 className="mt-1 text-lg font-black text-white truncate max-w-[240px]">
            {studentName}
          </h2>

          {/* Big Score Box */}
          <div className="my-4 w-full rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/10 shadow-inner">
            <div className="text-5xl font-black text-amber-300 drop-shadow-md tracking-tight">
              {result.score}%
            </div>
            <div className="mt-1 text-xs font-bold text-indigo-100 truncate w-full" title={result.title}>
              {result.title}
            </div>
          </div>

          {/* Details Row */}
          <div className="flex w-full justify-around items-center text-xs font-bold text-indigo-200 border-t border-white/10 pt-3">
            {result.correctAnswers !== undefined && (
              <div className="flex flex-col items-center">
                <span className="text-sm font-black text-white">{result.correctAnswers}</span>
                <span className="text-[10px] text-indigo-300">إجابة صحيحة</span>
              </div>
            )}
            {result.timeSpent && (
              <div className="flex flex-col items-center">
                <span className="text-sm font-black text-white">{result.timeSpent}</span>
                <span className="text-[10px] text-indigo-300">الوقت المستغرق</span>
              </div>
            )}
            <div className="flex flex-col items-center">
              <span className="text-sm font-black text-amber-300">
                {result.badgeLabel || (result.score >= 90 ? 'فارس قياس' : 'طالب طموح')}
              </span>
              <span className="text-[10px] text-indigo-300">المرتبة</span>
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-3 text-[10px] font-bold text-indigo-300/80 uppercase tracking-widest">
            almeaa.net • منصة القدرات والتحصيلي
          </div>
        </div>
      </div>

      {/* Share Actions */}
      <div className="flex w-full gap-2">
        <button
          type="button"
          onClick={handleShare}
          data-testid="share-scorecard-whatsapp-button"
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 py-3 text-xs font-black text-white shadow-lg shadow-emerald-600/30 transition"
        >
          <Share2 size={16} />
          شارك وتحدّ أصدقاءك على الواتساب
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="px-4 py-3 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-black transition"
          title="نسخ نص التحدي"
        >
          {copied ? <Check size={16} className="text-emerald-600" /> : 'نسخ'}
        </button>
      </div>
    </div>
  );
};
