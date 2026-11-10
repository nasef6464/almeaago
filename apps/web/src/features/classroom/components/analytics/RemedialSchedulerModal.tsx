import React, { useState } from 'react';
import { Target, X, Calendar, Clock, Video, CheckCircle2, Sparkles, Users } from 'lucide-react';
import type { SkillMasteryStat } from '../../api/classroom-types';

interface RemedialSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  skill: SkillMasteryStat | null;
  onConfirmSchedule: (details: {
    title: string;
    skillId: string;
    scheduledAt: string;
    durationMinutes: number;
    provider: string;
    meetingUrl: string;
  }) => void;
}

export const RemedialSchedulerModal: React.FC<RemedialSchedulerModalProps> = ({
  isOpen,
  onClose,
  skill,
  onConfirmSchedule,
}) => {
  const [title, setTitle] = useState(
    skill ? `حصة دعم وتقوية: مهارة ${skill.skillName}` : 'حصة دعم وتقوية'
  );
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(17, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [provider, setProvider] = useState<'internal' | 'teams' | 'zoom' | 'google_meet'>('internal');
  const [meetingUrl, setMeetingUrl] = useState('https://almeaa.com/classroom/live-tutoring');

  if (!isOpen || !skill) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmSchedule({
      title,
      skillId: skill.skillId,
      scheduledAt: scheduledDate,
      durationMinutes,
      provider,
      meetingUrl,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs" dir="rtl">
      <div className="flex w-full max-w-lg flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <Sparkles size={20} />
            </span>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                محرك جدولة حصص الدعم والتقوية (1-Click Remedial Bridge)
              </h3>
              <p className="text-xs font-bold text-slate-500">
                ربط مباشر بين ضعف الطلاب في الحصة وجدولة حصة تقوية مستهدفة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Target Skill Context Card */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="text-xs font-black text-amber-900 dark:text-amber-200">
              المهارة المستهدفة بالدعم:
            </div>
            <div className="mt-1 font-black text-slate-900 dark:text-white text-sm">
              {skill.skillName} (نسبة الإتقان في الحصة: {skill.accuracy}%)
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
              <Users size={13} />
              <span>
                سيتم إدراج الطلاب المحتاجين للدعم تلقائياً وإشعارهم في لوحة الطالب.
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
              عنوان الحصة:
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                تاريخ ووقت الحصة:
              </label>
              <input
                type="datetime-local"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                المدة بالدقائق:
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value={30}>30 دقيقة</option>
                <option value={45}>45 دقيقة</option>
                <option value={60}>60 دقيقة (ساعة كاملة)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
              منصة البث المباشر:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'internal', label: 'السبورة الذكية الداخلية' },
                { id: 'teams', label: 'Microsoft Teams' },
                { id: 'zoom', label: 'Zoom' },
                { id: 'google_meet', label: 'Google Meet' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setProvider(item.id as any)}
                  className={`rounded-xl border p-2 text-[11px] font-black transition ${
                    provider === item.id
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-black text-white hover:bg-amber-700 shadow-md"
            >
              <Calendar size={15} />
              اعتماد وجدولة حصة الدعم فوراً
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
