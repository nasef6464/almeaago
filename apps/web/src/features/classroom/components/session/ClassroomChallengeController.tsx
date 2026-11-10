import React from 'react';
import { Trophy, Clock3, Flame, Award, AlertCircle, StopCircle, Play } from 'lucide-react';
import type { ClassroomCompetition, ClassroomChallenge } from '../../api/classroom-types';

interface ClassroomChallengeControllerProps {
  challenge: ClassroomChallenge | null;
  competition: ClassroomCompetition | null;
  remainingSeconds: number;
  durationSeconds: number;
  onDurationChange: (seconds: number) => void;
  onStartChallenge: () => void;
  onStopChallenge: () => void;
  busy?: boolean;
}

export const ClassroomChallengeController: React.FC<ClassroomChallengeControllerProps> = ({
  challenge,
  competition,
  remainingSeconds,
  durationSeconds,
  onDurationChange,
  onStartChallenge,
  onStopChallenge,
  busy = false,
}) => {
  const isRunning = Boolean(challenge?.competitionEnabled && !challenge?.expired && remainingSeconds > 0);

  return (
    <div
      dir="rtl"
      className="rounded-3xl border border-violet-200 bg-violet-50/70 p-5 shadow-sm dark:border-violet-900/50 dark:bg-violet-950/20"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-violet-700 dark:text-violet-400">
            <Trophy size={20} className={isRunning ? 'animate-bounce' : ''} />
            <h3 className="text-base font-black">تحدي الدفعة التنافسي</h3>
          </div>
          <p className="mt-1 text-xs font-bold leading-6 text-violet-800/80 dark:text-violet-300">
            100 نقطة لكل إجابة صحيحة، مع احتساب الإتقان ونزاهة الخادم بدون تسريب للإجابة.
          </p>
        </div>

        {/* Live Timer Clock */}
        {challenge?.competitionEnabled && (
          <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-3 shadow-sm dark:bg-slate-900">
            <div className="text-right">
              <div className="text-[10px] font-black text-violet-500">الوقت المتبقي</div>
              <div className="font-mono text-3xl font-black text-violet-950 dark:text-violet-200">
                {remainingSeconds}s
              </div>
            </div>
            <Clock3
              size={28}
              className={`text-violet-600 ${isRunning ? 'animate-spin' : ''}`}
            />
          </div>
        )}
      </div>

      {/* Control Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-violet-200/60 pt-4 dark:border-violet-900/40">
        {!challenge?.competitionEnabled ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-violet-900 dark:text-violet-300">
                مدة التحدي:
              </span>
              <select
                aria-label="مدة تحدي الدفعة"
                value={durationSeconds}
                onChange={(e) => onDurationChange(Number(e.target.value))}
                className="rounded-xl border border-violet-200 bg-white p-2 text-xs font-bold text-violet-900 dark:border-violet-800 dark:bg-slate-800 dark:text-violet-200"
              >
                <option value={30}>30 ثانية</option>
                <option value={45}>45 ثانية</option>
                <option value={60}>60 ثانية (دقيقة)</option>
                <option value={90}>90 ثانية</option>
                <option value={120}>120 ثانية (دقيقتان)</option>
              </select>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={onStartChallenge}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-violet-800 disabled:opacity-40"
            >
              <Play size={15} />
              بدء التحدي التنافسي الآن
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy || challenge.expired}
            onClick={onStopChallenge}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-white px-5 py-2.5 text-xs font-black text-violet-800 hover:bg-violet-50 disabled:opacity-40 dark:border-violet-700 dark:bg-slate-800 dark:text-violet-200"
          >
            <StopCircle size={16} />
            إنهاء التحدي وكشف النتائج
          </button>
        )}
      </div>

      {/* Live Podium & Leaderboard if available */}
      {competition?.leaderboard && competition.leaderboard.length > 0 && (
        <div className="mt-5 border-t border-violet-200/60 pt-4 dark:border-violet-900/40">
          <div className="text-xs font-black text-violet-900 dark:text-violet-300 mb-3 flex items-center gap-1.5">
            <Award size={16} />
            <span>لوحة صدارة المتفوقين في التحدي:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {competition.leaderboard.slice(0, 3).map((item, idx) => {
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div
                  key={item.studentId}
                  className="flex flex-col items-center rounded-2xl bg-white p-4 text-center shadow-xs dark:bg-slate-900 border border-violet-100 dark:border-violet-900/50"
                >
                  <span className="text-2xl">{medals[idx] || `#${idx + 1}`}</span>
                  <div className="mt-1 font-black text-slate-900 dark:text-white text-xs truncate max-w-full">
                    {item.studentId}
                  </div>
                  <div className="mt-1 text-xl font-black text-violet-700 dark:text-violet-400">
                    {item.score} نقطة
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                    إتقان {item.accuracy}% ({item.correct}/{item.answered})
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
