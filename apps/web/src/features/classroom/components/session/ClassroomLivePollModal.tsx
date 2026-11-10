import React, { useState } from 'react';
import { HelpCircle, X, Clock, Play, Sparkles } from 'lucide-react';
import type { PollType, LivePollQuestion } from '../../api/classroom-types';

interface ClassroomLivePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchPoll: (poll: LivePollQuestion) => void;
}

export const ClassroomLivePollModal: React.FC<ClassroomLivePollModalProps> = ({
  isOpen,
  onClose,
  onLaunchPoll,
}) => {
  const [pollType, setPollType] = useState<PollType>('options_4');
  const [prompt, setPrompt] = useState('سؤال سريع: ما هو ناتج العملية الآتية؟');
  const [options, setOptions] = useState<string[]>(['أ) 15', 'ب) 20', 'ج) 25', 'د) 30']);
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number | null>(1);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(45);

  const handleTypeChange = (type: PollType) => {
    setPollType(type);
    if (type === 'options_4') {
      setOptions(['أ) الخيار الأول', 'ب) الخيار الثاني', 'ج) الخيار الثالث', 'د) الخيار الرابع']);
      setCorrectOptionIndex(0);
    } else if (type === 'options_2') {
      setOptions(['أ) الخيار الأول', 'ب) الخيار الثاني']);
      setCorrectOptionIndex(0);
    } else if (type === 'true_false') {
      setOptions(['صح (True)', 'خطأ (False)']);
      setCorrectOptionIndex(0);
    } else {
      setOptions(['موافق تماماً', 'موافق', 'محايد', 'غير موافق']);
      setCorrectOptionIndex(null);
    }
  };

  const updateOptionText = (index: number, text: string) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  };

  const handleLaunch = () => {
    if (!prompt.trim()) return;
    const poll: LivePollQuestion = {
      id: `poll-${Date.now()}`,
      type: pollType,
      prompt: prompt.trim(),
      options: options.map((o) => o.trim()),
      correctOptionIndex,
      timeLimitSeconds,
      startedAt: new Date().toISOString(),
    };
    onLaunchPoll(poll);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs" dir="rtl">
      <div className="flex w-full max-w-xl flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <Sparkles size={20} />
            </span>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                إنشاء سؤال أو تصويت لحظي فوري
              </h3>
              <p className="text-xs font-bold text-slate-500">
                اطرح سؤالاً سريعاً على الطلاب دون الحاجة لاختياره مسبقاً من بنك الأسئلة
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

        {/* Poll Type Selector */}
        <div className="mt-4">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">
            نوع السؤال / التصويت:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handleTypeChange('options_4')}
              className={`rounded-xl border p-2.5 text-xs font-black transition ${
                pollType === 'options_4'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              4 خيارات (أ/ب/ج/د)
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('true_false')}
              className={`rounded-xl border p-2.5 text-xs font-black transition ${
                pollType === 'true_false'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              صح أو خطأ
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('options_2')}
              className={`rounded-xl border p-2.5 text-xs font-black transition ${
                pollType === 'options_2'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              خياران (أ/ب)
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('open_vote')}
              className={`rounded-xl border p-2.5 text-xs font-black transition ${
                pollType === 'open_vote'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              استفتاء رأي
            </button>
          </div>
        </div>

        {/* Prompt Input */}
        <div className="mt-4">
          <label htmlFor="poll-prompt" className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
            نص السؤال اللحظي:
          </label>
          <input
            id="poll-prompt"
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            placeholder="اكتب السؤال هنا ليظهر فوراً على شاشات الطلاب…"
          />
        </div>

        {/* Options Editor */}
        <div className="mt-4 space-y-2">
          <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
            الخيارات (حدد الخيار الصحيح إن وُجد):
          </div>
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="radio"
                name="correctOption"
                checked={correctOptionIndex === idx}
                onChange={() => setCorrectOptionIndex(idx)}
                title="تحديد كإجابة صحيحة"
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
              />
              <input
                type="text"
                value={opt}
                onChange={(e) => updateOptionText(idx, e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          ))}
        </div>

        {/* Timer selector */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
              الوقت المتاح للإجابة:
            </span>
          </div>
          <select
            aria-label="مدة الإجابة"
            value={timeLimitSeconds}
            onChange={(e) => setTimeLimitSeconds(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <option value={15}>15 ثانية</option>
            <option value={30}>30 ثانية</option>
            <option value={45}>45 ثانية</option>
            <option value={60}>60 ثانية</option>
            <option value={90}>90 ثانية</option>
            <option value={120}>دقيقتان</option>
          </select>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={!prompt.trim()}
            onClick={handleLaunch}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-black text-white hover:bg-amber-700 disabled:opacity-40"
          >
            <Play size={16} />
            إطلاق السؤال اللحظي الآن
          </button>
        </div>
      </div>
    </div>
  );
};
