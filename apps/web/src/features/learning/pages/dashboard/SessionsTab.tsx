import React from 'react';
import { Calendar, ChevronLeft, Clock, Play, Radio, Users, Video } from 'lucide-react';
import { Link } from 'react-router-dom';

export const SessionsTab: React.FC = () => {
  const sessions = [
    {
      id: 'sess-1',
      title: 'ورشة تدريبية: حل 50 سؤال قدرات كمي في 30 دقيقة',
      instructor: 'أ. أحمد المعلم',
      time: 'اليوم · 8:00 مساءً بتوقيت مكة',
      isLive: true,
      roomCode: 'LIVE-100',
    },
    {
      id: 'sess-2',
      title: 'استراتيجيات استيعاب المقروء وحل القطع الطويلة',
      instructor: 'د. خالد العمري',
      time: 'غداً · 7:00 مساءً بتوقيت مكة',
      isLive: false,
      roomCode: 'READ-202',
    },
    {
      id: 'sess-3',
      title: 'مراجعة شاملة لمتطابقات التحصيلي في الرياضيات',
      instructor: 'أ. سارة الحربي',
      time: 'الخميس · 6:30 مساءً بتوقيت مكة',
      isLive: false,
      roomCode: 'MATH-303',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-16 w-full min-w-0" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
            <Radio size={24} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">جلساتي والفصول التفاعلية</h2>
            <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-slate-400 mt-0.5">
              جلسات البث المباشر والسبورة الذكية مع المعلمين والمدربين.
            </p>
          </div>
        </div>

        <Link
          to="/classroom/join"
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs sm:text-sm font-black text-white transition shadow-xs"
        >
          <Radio size={16} />
          انضمام إلى فصل برمز
        </Link>
      </div>

      {/* Live / Upcoming Sessions Grid */}
      <div className="space-y-4">
        {sessions.map((sess) => (
          <article
            key={sess.id}
            className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border p-5 shadow-xs transition hover:shadow-md ${
              sess.isLive
                ? 'border-emerald-300 dark:border-emerald-700/80 bg-gradient-to-r from-emerald-50/70 via-white to-white dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900'
                : 'border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {sess.isLive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 text-white px-3 py-0.5 text-xs font-black shadow-xs animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    مباشر الآن
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-0.5 text-xs font-black">
                    <Clock size={12} />
                    قادمة
                  </span>
                )}
                <span className="text-xs font-bold text-gray-500 dark:text-slate-400">{sess.instructor}</span>
              </div>

              <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-snug">
                {sess.title}
              </h3>

              <div className="mt-2.5 flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-slate-400">
                <Calendar size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span>{sess.time}</span>
              </div>
            </div>

            <div className="shrink-0">
              <Link
                to={`/classroom/join?code=${sess.roomCode}`}
                className={`flex items-center justify-center gap-2 rounded-2xl py-3 px-6 text-xs sm:text-sm font-black transition shadow-xs ${
                  sess.isLive
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100'
                }`}
              >
                <Play size={16} />
                <span>{sess.isLive ? 'دخول البث المباشر' : 'تجهيز الفصل'}</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
