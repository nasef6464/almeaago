import React, { useEffect, useMemo, useState } from 'react';
import { Award, Check, ChevronLeft, ChevronRight, Frown, Loader2, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
import { learningClient } from '../../api/learning-client';
import type { ReviewItem } from '../../api/learning-client';

export const FlashcardsTab: React.FC = () => {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    learningClient
      .reviewLibrary('all', '', '', 1, 30, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setItems(res.items || []);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setItems([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const flashcards = useMemo(() => {
    if (!items.length) {
      // Fallback demo flashcards if student hasn't accumulated saved questions yet
      return [
        {
          id: 'card-1',
          question: 'ما هو حاصل جمع الزوايا الداخلية لأي مثلث؟',
          answer: '180 درجة مئوية / هندسية.',
          explanation: 'مجموع قياسات الزوايا الداخلية في أي مضلع ثلاثي هو 180° دائماً.',
        },
        {
          id: 'card-2',
          question: 'ما هو التناظر اللفظي بين: (كتاب : ورقة)؟',
          answer: 'علاقة كل إلى جزء (الكتاب يتكون من أوراق).',
          explanation: 'الكل يسبق الجزء، كما في (شجرة : غصن) أو (سيارة : عجلة).',
        },
        {
          id: 'card-3',
          question: 'إذا كان س + ص = 10، وَ س - ص = 4، فما قيمة س؟',
          answer: 'س = 7',
          explanation: 'بجمع المعادلتين: 2س = 14 إذاً س = 7.',
        },
        {
          id: 'card-4',
          question: 'ما مضاد كلمة «جذوة»؟',
          answer: 'رماد أو انطفاء.',
          explanation: 'الجذوة هي الشعلة الملتهبة، وضدها الانطفاء أو الرماد الخامل.',
        },
        {
          id: 'card-5',
          question: 'ما النسبة المئوية للكسر 3/5؟',
          answer: '60%',
          explanation: '(3 ÷ 5) × 100 = 60%.',
        },
      ];
    }

    return items.slice(0, 15).map((item) => {
      const q = item.question;
      const correctOpt = q?.options?.find((o: { index: number; text: string }) => o.index === q.correctOptionIndex) || q?.options?.[0];
      return {
        id: item.card.questionId,
        question: q?.text || 'سؤال مراجعة',
        answer: correctOpt?.text || 'الإجابة الصحيحة',
        explanation: q?.explanation || 'راجع درس التأسيس لتثبيت فهم هذه النقطة.',
      };
    });
  }, [items]);

  const current = flashcards[currentIndex] || flashcards[0];

  const handleNext = (known: boolean) => {
    if (known) setKnownCount((k) => k + 1);
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex((idx) => idx + 1);
      setIsFlipped(false);
    } else {
      setCompleted(true);
    }
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnownCount(0);
    setCompleted(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-16 font-bold text-gray-500 dark:text-slate-400">
        <Loader2 size={20} className="animate-spin text-indigo-600" />
        جارٍ تجهيز بطاقات التذكر...
      </div>
    );
  }

  if (completed) {
    const percentage = Math.round((knownCount / flashcards.length) * 100);
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-12 text-center animate-fade-in shadow-sm" dir="rtl">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center rounded-3xl mb-5 shadow-xs">
          <Award size={40} />
        </div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">أحسنت يا بطل! أنهيت جلسة التذكر</h2>
        <p className="text-sm font-bold text-gray-500 dark:text-slate-400 mb-6">
          أتقنت {knownCount} من أصل {flashcards.length} بطاقة ({percentage}% إتقان).
        </p>

        <div className="w-full max-w-xs bg-gray-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden mb-6">
          <div className="bg-indigo-600 h-full rounded-full transition-all duration-700" style={{ width: `${percentage}%` }} />
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-6 py-3 text-sm font-black text-white transition shadow-sm"
        >
          <RotateCcw size={16} />
          إعادة الجلسة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16 w-full max-w-2xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-black text-violet-600 dark:text-violet-400 mb-1">
            <Sparkles size={14} />
            التكرار المتباعد
          </div>
          <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">بطاقات التذكر الذكية</h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-black bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/60">
            {currentIndex + 1} / {flashcards.length}
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="p-2 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition"
            title="إعادة البدء"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Flip Card */}
      <div
        onClick={() => setIsFlipped((f) => !f)}
        className="cursor-pointer min-h-[300px] sm:min-h-[340px] rounded-3xl border-2 border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 flex flex-col justify-between shadow-md transition-all hover:border-indigo-300 dark:hover:border-indigo-700 select-none relative"
      >
        <div className="flex items-center justify-between text-xs font-bold text-gray-400 dark:text-slate-500">
          <span>{isFlipped ? '💡 الإجابة والتفسير' : '❓ السؤال'}</span>
          <span className="text-[11px] bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
            انقر للقلب 🔄
          </span>
        </div>

        <div className="my-auto py-4 text-center">
          {!isFlipped ? (
            <h3 className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white leading-relaxed">
              {current.question}
            </h3>
          ) : (
            <div className="space-y-3">
              <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {current.answer}
              </div>
              <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-slate-300 leading-relaxed max-w-lg mx-auto">
                {current.explanation}
              </p>
            </div>
          )}
        </div>

        <div className="text-center text-[11px] font-bold text-gray-400 dark:text-slate-500">
          {!isFlipped ? 'فكّر في الإجابة ثم اقلب البطاقة للتحقق' : 'هل عرفت الإجابة بشكل صحيح؟'}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleNext(false)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 py-3.5 px-4 text-sm font-black text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition shadow-xs"
        >
          <Frown size={18} />
          أحتاج مراجعتها لاحقاً
        </button>

        <button
          type="button"
          onClick={() => handleNext(true)}
          className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3.5 px-4 text-sm font-black text-white transition shadow-xs"
        >
          <Check size={18} />
          أعرفها تماماً ✓
        </button>
      </div>
    </div>
  );
};
