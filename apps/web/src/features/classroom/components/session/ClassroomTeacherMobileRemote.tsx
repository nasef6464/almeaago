import React from 'react';
import {
  ChevronLeft,
  Eye,
  EyeOff,
  Plus,
  Square,
  Users,
} from 'lucide-react';

export interface ClassroomTeacherMobileRemoteProps {
  currentOrdinal?: number | null;
  totalQuestions: number;
  responseCount: number;
  expectedCount: number;
  isRevealed: boolean;
  onToggleReveal: () => void;
  onNextQuestion?: () => void;
  hasActiveBatch: boolean;
  isEndingBatch: boolean;
  onEndBatch: () => void;
  onOpenPushDrawer: () => void;
  onOpenRosterDrawer: () => void;
  isSessionActive: boolean;
}

export const ClassroomTeacherMobileRemote: React.FC<ClassroomTeacherMobileRemoteProps> = ({
  currentOrdinal,
  totalQuestions,
  responseCount,
  expectedCount,
  isRevealed,
  onToggleReveal,
  onNextQuestion,
  hasActiveBatch,
  isEndingBatch,
  onEndBatch,
  onOpenPushDrawer,
  onOpenRosterDrawer,
  isSessionActive,
}) => {
  if (!isSessionActive) return null;

  const currentDisplayNum = currentOrdinal != null ? currentOrdinal + 1 : 1;

  return (
    <aside
      aria-label="شريط تحكم المعلم المتنقل بالجوال"
      className="lg:hidden fixed bottom-3 inset-x-3 z-50 rounded-2xl bg-slate-950/95 border border-slate-800 p-3 text-white backdrop-blur-md shadow-2xl transition-all"
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-2">
        {/* Left Side: Question Status and Student Responses */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-black text-indigo-400 truncate">
              سؤال {currentDisplayNum} من {Math.max(1, totalQuestions)}
            </span>
            <button
              type="button"
              onClick={onOpenRosterDrawer}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white"
            >
              <Users size={12} className="text-emerald-400" />
              <span>
                أجاب: <strong className="text-emerald-400">{responseCount}</strong>/{expectedCount}
              </span>
            </button>
          </div>
        </div>

        {/* Right Side: Quick Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Reveal Solution Button */}
          {hasActiveBatch && (
            <button
              type="button"
              onClick={onToggleReveal}
              className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-black transition ${
                isRevealed
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>{isRevealed ? 'إخفاء' : 'كشف الحل'}</span>
            </button>
          )}

          {/* Next / End Batch / Push Questions */}
          {onNextQuestion ? (
            <button
              type="button"
              onClick={onNextQuestion}
              className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-700 shadow-sm transition active:scale-95"
            >
              <span>التالي</span>
              <ChevronLeft size={14} />
            </button>
          ) : hasActiveBatch ? (
            <button
              type="button"
              disabled={isEndingBatch}
              onClick={onEndBatch}
              className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50 transition active:scale-95"
            >
              <Square size={12} className="fill-current" />
              <span>إنهاء السؤال</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenPushDrawer}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 shadow-sm transition active:scale-95"
            >
              <Plus size={14} />
              <span>إرسال سؤال</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

