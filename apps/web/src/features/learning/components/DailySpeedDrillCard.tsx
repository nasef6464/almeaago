import React, { useState, useEffect } from 'react';
import { Zap, Flame, Clock, Award, CheckCircle, ChevronLeft, Sparkles } from 'lucide-react';
import {
  getDailyQuestions,
  loadDailyDrillRecord,
  DailyDrillRecord,
  getTodayDateKey,
} from './dailySpeedDrillData';
import { DailySpeedDrillModal } from './DailySpeedDrillModal';

interface DailySpeedDrillCardProps {
  userId: string;
  onDrillCompleted?: (record: DailyDrillRecord) => void;
}

export const DailySpeedDrillCard: React.FC<DailySpeedDrillCardProps> = ({
  userId,
  onDrillCompleted,
}) => {
  const [record, setRecord] = useState<DailyDrillRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setRecord(loadDailyDrillRecord(userId));
  }, [userId]);

  const questions = getDailyQuestions();
  const isDoneToday = Boolean(record && record.completed && record.dateKey === getTodayDateKey());

  const handleDrillFinished = (newRecord: DailyDrillRecord) => {
    setRecord(newRecord);
    if (onDrillCompleted) onDrillCompleted(newRecord);
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-4 sm:p-5 text-white shadow-md shadow-amber-500/10 border border-amber-400/40">
        {/* Background glow decoration */}
        <div className="absolute -left-10 -bottom-10 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-300/20 blur-lg pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left Column: Info & Title */}
          <div className="flex items-start gap-3 sm:gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
              <Zap size={24} className="fill-white text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-white/25 border border-white/20 text-white uppercase">
                  تحدي اليوم
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-100">
                  <Clock size={12} />
                  <span>60 ثانية لكل سؤال</span>
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white mt-1 leading-tight">
                تحدي الـ 60 ثانية اليومي ⚡
              </h3>
              <p className="text-xs text-amber-50/90 font-medium mt-0.5 max-w-md">
                5 أسئلة تكتيكية خاطفة من تجميعات قياس لاختبار جاهزيتك وتثبيت شريط الاستمرارية اليومي.
              </p>
            </div>
          </div>

          {/* Right Column: Status & Action Button */}
          <div className="flex items-center gap-3 shrink-0 self-stretch md:self-auto justify-between md:justify-end">
            {isDoneToday ? (
              <div className="flex items-center gap-3 w-full md:w-auto justify-between">
                <div className="bg-black/20 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/20 text-right">
                  <div className="text-[10px] font-bold text-amber-200">النتيجة المحققة</div>
                  <div className="text-sm font-black text-white flex items-center gap-1">
                    <span>{record?.score} / {record?.totalQuestions}</span>
                    <span className="text-xs font-normal text-amber-100">({record?.timeSpentSeconds}ث)</span>
                  </div>
                </div>
                <button
                  data-testid="start-daily-drill-btn"
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-white text-amber-700 font-black text-xs sm:text-sm hover:bg-amber-50 transition-all active:scale-95 shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle size={15} className="text-emerald-600" />
                  <span>مراجعة الأسئلة</span>
                  <ChevronLeft size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
                <div className="hidden sm:flex items-center gap-1.5 bg-white/15 px-2.5 py-1.5 rounded-xl border border-white/20 text-xs font-bold text-amber-100">
                  <Flame size={14} className="text-orange-200 fill-orange-200" />
                  <span>+1 ستريك</span>
                </div>
                <button
                  data-testid="start-daily-drill-btn"
                  onClick={() => setIsModalOpen(true)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white text-orange-600 font-black text-xs sm:text-sm hover:bg-amber-50 hover:shadow-lg transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5"
                >
                  <span>ابدأ التحدي الآن</span>
                  <ChevronLeft size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <DailySpeedDrillModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        questions={questions}
        userId={userId}
        existingRecord={record}
        onDrillFinished={handleDrillFinished}
      />
    </>
  );
};
