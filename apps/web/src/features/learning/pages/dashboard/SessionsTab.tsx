import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Clock, Loader2, Lock, Play, Radio, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../auth/state/AuthProvider';
import { contentClient } from '../../../content/api/content-client';
import { sessionBookingsClient, type SessionBooking } from '../../api/learning-client';

type LiveFeed = Awaited<ReturnType<typeof contentClient.liveSessions>>;

const bookingStatusLabel: Record<SessionBooking['bookingStatus'], { text: string; cls: string }> = {
  pending: { text: 'قيد الانتظار', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { text: 'مؤكدة', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { text: 'مرفوضة', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  cancelled: { text: 'ملغاة', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const SessionsTab: React.FC = () => {
  const { user, getCsrfToken } = useAuth();
  const [feed, setFeed] = useState<LiveFeed>({ lessons: [], classroomSessions: [] });
  const [bookings, setBookings] = useState<SessionBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState('');

  const loadData = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [liveRes, bookingRes] = await Promise.all([
        contentClient.liveSessions(signal),
        sessionBookingsClient.mine(50, signal).catch(() => ({ bookings: [] })),
      ]);
      setFeed(liveRes);
      setBookings(bookingRes.bookings || []);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'تعذر تحميل الجلسات واللقاءات.');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  async function handleCancel(bookingId: string) {
    setCancellingId(bookingId);
    try {
      const csrf = await getCsrfToken();
      const res = await sessionBookingsClient.cancel(bookingId, csrf);
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? res.booking : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء الحجز.');
    } finally {
      setCancellingId('');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16 w-full min-w-0" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
            <Radio size={24} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">جلساتي والفصول التفاعلية</h2>
            <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-slate-400 mt-0.5">
              البث المباشر، جلسات الفصول النشطة، وطلبات الحصص الفردية المجدولة.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/book-session?source=dashboard"
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs sm:text-sm font-black text-white transition shadow-xs"
          >
            <Calendar size={16} />
            حجز حصة خاصة
          </Link>
          <Link
            to="/classroom/join"
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs sm:text-sm font-black text-white transition shadow-xs"
          >
            <Radio size={16} />
            انضمام إلى فصل برمز
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-sm font-bold text-gray-500">
          <Loader2 size={18} className="animate-spin text-emerald-600" />
          جاري تحميل الحصص واللقاءات...
        </div>
      ) : (
        <>
          {feed.classroomSessions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-black text-gray-700 dark:text-slate-300">جلسات الفصول المباشرة</h3>
              {feed.classroomSessions.map((cls) => (
                <article
                  key={cls.id}
                  className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-emerald-300 dark:border-emerald-700/80 bg-white dark:bg-slate-900 p-5 shadow-xs"
                >
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white px-3 py-0.5 text-xs font-black">
                      {cls.status === 'live' ? 'مباشر الآن' : 'مجدولة'}
                    </span>
                    <h4 className="mt-2 text-base font-black text-gray-900 dark:text-white">
                      {cls.className} — {cls.subjectName}
                    </h4>
                    <p className="mt-1 text-xs font-bold text-gray-500">
                      {cls.teacherName ? `المعلم: ${cls.teacherName} · ` : ''}{cls.day}
                    </p>
                  </div>
                  <Link
                    to="/classroom/student"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3 px-5 text-xs font-black text-white"
                  >
                    <Play size={16} />
                    دخول قاعة الفصل
                  </Link>
                </article>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-700 dark:text-slate-300">اللقاءات والورش المباشرة</h3>
              <Link to="/live-sessions" className="text-xs font-black text-indigo-700 hover:underline">
                عرض كل البثوث
              </Link>
            </div>
            {feed.lessons.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs sm:text-sm font-bold text-gray-500">
                لا توجد لقاءات مباشرة منشورة حالياً.
              </div>
            ) : (
              feed.lessons.map((sess) => (
                <article
                  key={sess.id}
                  className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-0.5 text-xs font-black">
                        <Clock size={12} />
                        {sess.durationMinutes} دقيقة
                      </span>
                      <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                        {sess.pathName}{sess.subjectName ? ` — ${sess.subjectName}` : ''}
                      </span>
                    </div>
                    <h4 className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-snug">
                      {sess.title}
                    </h4>
                    <div className="mt-2 flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-slate-400">
                      <Calendar size={14} className="text-emerald-600" />
                      <span>
                        {sess.meetingDate ? new Date(sess.meetingDate).toLocaleString('ar-SA') : 'موعد مرن'}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {sess.isLocked ? (
                      <Link
                        to={`/category/${sess.pathId}?tab=packages`}
                        className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-black text-amber-800"
                      >
                        <Lock size={15} />
                        متاح للمشتركين
                      </Link>
                    ) : (
                      <Link
                        to={`/live-sessions/${encodeURIComponent(sess.id)}`}
                        className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3 px-5 text-xs font-black text-white"
                      >
                        <Play size={16} />
                        فتح قاعة البث
                      </Link>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-black text-gray-700 dark:text-slate-300">حجوزاتي للحصص الفردية</h3>
            {bookings.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs sm:text-sm font-bold text-gray-500">
                لم تحجز حصصاً خاصة بعد. يمكنك طلب حصة موجهة لمهارتك في أي وقت.
              </div>
            ) : (
              bookings.map((b) => {
                const badge = bookingStatusLabel[b.bookingStatus] || bookingStatusLabel.pending;
                return (
                  <article
                    key={b.id}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-black ${badge.cls}`}>
                          {badge.text}
                        </span>
                        <span className="text-xs font-bold text-gray-500">
                          {b.scheduledDate} — {b.scheduledTime}
                        </span>
                      </div>
                      <h4 className="mt-1.5 text-sm sm:text-base font-black text-gray-900 dark:text-white">{b.title}</h4>
                      <p className="mt-0.5 text-xs font-bold text-gray-500">{b.targetLabel}</p>
                    </div>
                    {b.bookingStatus === 'pending' && (
                      <button
                        type="button"
                        disabled={cancellingId === b.id}
                        onClick={() => handleCancel(b.id)}
                        className="inline-flex items-center gap-1.5 self-start rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        <XCircle size={14} />
                        <span>{cancellingId === b.id ? 'جاري الإلغاء...' : 'إلغاء الحجز'}</span>
                      </button>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};
