import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  Award,
  Flame,
  ArrowRight,
  Share2,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import {
  SpeedDrillQuestion,
  DailyDrillRecord,
  saveDailyDrillRecord,
  getTodayDateKey,
} from './dailySpeedDrillData';
import { ShareScorecard } from './ShareScorecard';

interface DailySpeedDrillModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: SpeedDrillQuestion[];
  userId: string;
  onDrillFinished?: (record: DailyDrillRecord) => void;
  existingRecord?: DailyDrillRecord | null;
}

export const DailySpeedDrillModal: React.FC<DailySpeedDrillModalProps> = ({
  isOpen,
  onClose,
  questions,
  userId,
  onDrillFinished,
  existingRecord,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [drillCompleted, setDrillCompleted] = useState(false);
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  const [showTactics, setShowTactics] = useState(true);
  const [copiedShare, setCopiedShare] = useState(false);

  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (existingRecord && existingRecord.completed) {
      setSelectedAnswers(existingRecord.answers || []);
      setTotalTimeSpent(existingRecord.timeSpentSeconds || 60);
      setDrillCompleted(true);
    } else {
      setCurrentIndex(0);
      setTimeLeft(60);
      setSelectedAnswers([]);
      setDrillCompleted(false);
      setTotalTimeSpent(0);
      startTimeRef.current = Date.now();
    }
  }, [isOpen, existingRecord]);

  useEffect(() => {
    if (!isOpen || drillCompleted || existingRecord?.completed) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeExpired();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, currentIndex, drillCompleted, existingRecord]);

  if (!isOpen) return null;

  const currentQ = questions[currentIndex] || questions[0];

  const handleTimeExpired = () => {
    const updated = [...selectedAnswers, -1];
    setSelectedAnswers(updated);
    proceedToNext(updated);
  };

  const handleSelectOption = (optIndex: number) => {
    if (drillCompleted) return;
    const updated = [...selectedAnswers, optIndex];
    setSelectedAnswers(updated);
    proceedToNext(updated);
  };

  const proceedToNext = (answersSoFar: number[]) => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setTimeLeft(60);
    } else {
      finishDrill(answersSoFar);
    }
  };

  const finishDrill = (finalAnswers: number[]) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const timeSpent = Math.max(15, Math.round((Date.now() - startTimeRef.current) / 1000));
    setTotalTimeSpent(timeSpent);

    let score = 0;
    finalAnswers.forEach((ans, idx) => {
      if (ans === questions[idx]?.correctAnswerIndex) score += 1;
    });

    const record = saveDailyDrillRecord(userId, {
      dateKey: getTodayDateKey(),
      completed: true,
      score,
      totalQuestions: questions.length,
      timeSpentSeconds: timeSpent,
      answers: finalAnswers,
    });

    setDrillCompleted(true);
    if (onDrillFinished) onDrillFinished(record);
  };

  const currentScore = selectedAnswers.reduce((acc, ans, idx) => {
    return ans === questions[idx]?.correctAnswerIndex ? acc + 1 : acc;
  }, 0);

  const avgSeconds = Math.round(totalTimeSpent / (questions.length || 1));
  const shareText = `⚡ أنهيت تحدي الـ 60 ثانية اليومي في منصة المئة بنتيجة ${currentScore}/5 في ${totalTimeSpent} ثانية! 🔥 هل تتحداني؟ جرب التحدي الآن: ${window.location.origin}`;

  const handleShareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleShareX = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareText);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  const timerColor =
    timeLeft > 25
      ? 'text-emerald-500 stroke-emerald-500'
      : timeLeft > 10
      ? 'text-amber-500 stroke-amber-500'
      : 'text-rose-500 stroke-rose-500 animate-pulse';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in" dir="rtl">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Zap size={20} className="fill-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                تحدي الـ 60 ثانية اليومي
              </h3>
              <p className="text-xs text-slate-500 font-bold">5 أسئلة سرعة وتكتيكات قياس</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drill Body */}
        {!drillCompleted ? (
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
            {/* Top Indicator & Timer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  السؤال {currentIndex + 1} من {questions.length}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {currentQ.category} · {currentQ.skill}
                </span>
              </div>

              {/* Countdown Timer */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <Clock size={16} className={timerColor} />
                <span className={`text-sm font-black font-mono ${timerColor}`}>{timeLeft}s</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300 rounded-full"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>

            {/* Question Text */}
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
              <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-relaxed">
                {currentQ.question}
              </p>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {currentQ.options.map((opt, idx) => (
                <button
                  key={idx}
                  data-testid={`drill-opt-${idx}`}
                  onClick={() => handleSelectOption(idx)}
                  className="w-full text-right p-3.5 sm:p-4 rounded-xl font-bold text-sm sm:text-base border transition-all duration-150 bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:bg-amber-50/70 dark:hover:bg-amber-950/30 active:scale-[0.99] flex items-center justify-between group"
                >
                  <span className="text-slate-800 dark:text-slate-100 group-hover:text-amber-900 dark:group-hover:text-amber-200">
                    {opt}
                  </span>
                  <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-black flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                    {['أ', 'ب', 'ج', 'د'][idx]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Completion Screen */
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
            {/* Score Showcase */}
            <div className="text-center p-6 rounded-3xl bg-gradient-to-b from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-slate-800/40 border border-amber-200/70 dark:border-amber-800/50">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 mb-3">
                <Award size={36} />
              </div>
              <h4 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {currentScore === 5 ? 'إنجاز أسطوري! 🏆' : currentScore >= 3 ? 'أداء رائع وسريع! ⚡' : 'محاولة جيدة، استمر! 💪'}
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-bold mt-1">
                تم تسجيل حضورك اليومي وتثبيت شريط الاستمرارية 🔥
              </p>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 mt-4 max-w-sm mx-auto">
                <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-amber-100 dark:border-slate-700">
                  <div className="text-xs text-slate-500 font-bold">النتيجة</div>
                  <div className="text-lg font-black text-amber-600">{currentScore} / {questions.length}</div>
                </div>
                <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-amber-100 dark:border-slate-700">
                  <div className="text-xs text-slate-500 font-bold">إجمالي الوقت</div>
                  <div className="text-lg font-black text-slate-800 dark:text-slate-100">{totalTimeSpent}ث</div>
                </div>
                <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-amber-100 dark:border-slate-700">
                  <div className="text-xs text-slate-500 font-bold">مكافأة اليوم</div>
                  <div className="text-lg font-black text-emerald-600">+25 نقطة</div>
                </div>
              </div>
            </div>

            {/* Royal Share Scorecard */}
            <div className="py-2">
              <ShareScorecard
                result={{
                  score: Math.round((currentScore / (questions.length || 1)) * 100),
                  title: 'تحدي الـ 60 ثانية اليومي',
                  correctAnswers: currentScore,
                  totalQuestions: questions.length,
                  timeSpent: `${totalTimeSpent} ثانية`,
                  badgeLabel: currentScore >= 4 ? 'نجم السرعة ⚡' : 'طالب مثابر',
                }}
              />
            </div>

            {/* Tactical Solutions Section */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-800">
              <button
                onClick={() => setShowTactics(!showTactics)}
                className="w-full flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 font-black text-sm text-slate-800 dark:text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-500" />
                  <span>تكتيكات وحيل الحل السريع للأسئلة</span>
                </div>
                {showTactics ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showTactics && (
                <div className="p-3.5 space-y-3 divide-y divide-slate-100 dark:divide-slate-700 text-xs sm:text-sm">
                  {questions.map((q, idx) => {
                    const studentAns = selectedAnswers[idx];
                    const isCorrect = studentAns === q.correctAnswerIndex;
                    return (
                      <div key={q.id} className={idx > 0 ? 'pt-3' : ''}>
                        <div className="flex items-start gap-2">
                          {isCorrect ? (
                            <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="font-black text-slate-800 dark:text-slate-200">{q.question}</p>
                            <div className="mt-1 flex items-center gap-3 text-xs">
                              <span className="font-bold text-slate-500">
                                إجابتك: {studentAns >= 0 ? q.options[studentAns] : 'انتهى الوقت'}
                              </span>
                              <span className="font-black text-emerald-600">
                                الصحيحة: {q.options[q.correctAnswerIndex]}
                              </span>
                            </div>
                            <div className="mt-1.5 p-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 font-bold text-[11px] sm:text-xs">
                              💡 {q.speedTrick}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Close CTA */}
            <div className="pt-2">
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-sm hover:opacity-95 shadow-md shadow-amber-500/20 transition-all"
              >
                العودة للوحة التحكم
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
