import {
  ArrowRight,
  Calendar,
  Clock,
  ExternalLink,
  Lock,
  Radio,
  Video,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import { type SessionBooking, sessionBookingsClient } from '../api/learning-client';

type LiveFeed = Awaited<ReturnType<typeof contentClient.liveSessions>>;

const bookingStatusStyle: Record<SessionBooking['bookingStatus'], { label: string; cls: string }> = {
  pending: { label: 'قيد المراجعة', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { label: 'مؤكدة', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'مرفوضة', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  cancelled: { label: 'ملغاة', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export default function LiveSessionsPage() {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const location = useLocation();

  const [feed, setFeed] = useState<LiveFeed>({ lessons: [], classroomSessions: [] });
  const [bookings, setBookings] = useState<SessionBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState('');

  const loadAll = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const [liveRes, bookingRes] = await Promise.all([
        contentClient.liveSessions(signal),
        sessionBookingsClient.mine(50, signal).catch(() => ({ bookings: [] })),
      ]);
      setFeed(liveRes);
      setBookings(bookingRes.bookings);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'تعذر تحميل البثوث والجلسات المباشرة.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    loadAll(controller.signal);
    return () => controller.abort();
  }, [user, loadAll]);

  if (!authLoading && !user) {
    return <Navigate replace to={`/login?next=${encodeURIComponent(location.pathname)}`} />;
  }

  async function handleCancelBooking(bookingId: string) {
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
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/dashboard?tab=sessions"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
          >
            <ArrowRight size={15} />
            <span>العودة للوحة الطالب</span>
          </Link>
          <Link
            to="/book-session?source=live-sessions"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
          >
            <Calendar size={15} />
            <span>حجز حصة فردية</span>
          </Link>
        </div>

        <header className="rounded-3xl border border-indigo-100 bg-white p-5 sm:p-6 shadow-2xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">
            <Radio size={14} />
            <span>البث المباشر واللقاءات</span>
          </span>
          <h1 className="mt-2 text-xl sm:text-2xl font-black text-slate-900">
            الحصص المباشرة وحجوزاتي الفردية
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-600">
            ادخل إلى قاعات البث المباشر المتاحة أو تابع حالة طلبات الحصص الفردية.
          </p>
        </header>

        {error && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div role="status" className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">
            جاري تحميل الحصص واللقاءات...
          </div>
        ) : (
          <>
            {feed.classroomSessions.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-black text-slate-900">جلسات الفصول النشطة</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {feed.classroomSessions.map((cls) => (
                    <article
                      key={cls.id}
                      className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 font-black text-emerald-700">
                          {cls.status === 'live' ? 'مباشر الآن' : 'مجدولة'}
                        </span>
                        <span className="font-bold text-slate-500">{cls.day}</span>
                      </div>
                      <h3 className="mt-2.5 text-base font-black text-slate-900">
                        {cls.className} — {cls.subjectName}
                      </h3>
                      {cls.teacherName && (
                        <p className="mt-1 text-xs font-bold text-slate-600">المعلم: {cls.teacherName}</p>
                      )}
                      <div className="mt-3">
                        <Link
                          to="/classroom/student"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-700"
                        >
                          <ExternalLink size={14} />
                          <span>دخول قاعة الفصل</span>
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-3">
              <h2 className="text-base font-black text-slate-900">اللقاءات والورش المباشرة</h2>
              {feed.lessons.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
                  لا توجد لقاءات مباشرة منشورة حالياً.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {feed.lessons.map((lesson) => (
                    <article
                      key={lesson.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="rounded-full bg-indigo-50 px-3 py-1 font-black text-indigo-700">
                            {lesson.pathName} {lesson.subjectName ? `— ${lesson.subjectName}` : ''}
                          </span>
                          <span className="inline-flex items-center gap-1 font-bold text-slate-500">
                            <Clock size={13} />
                            <span>{lesson.durationMinutes} دقيقة</span>
                          </span>
                        </div>
                        <h3 className="mt-3 text-base font-black text-slate-900">{lesson.title}</h3>
                        {lesson.description && (
                          <p className="mt-1.5 text-xs font-medium text-slate-600 line-clamp-2">
                            {lesson.description}
                          </p>
                        )}
                        {lesson.teacherName && (
                          <p className="mt-2 text-xs font-bold text-slate-700">المدرب: {lesson.teacherName}</p>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                        <span className="text-[11px] font-bold text-slate-500">
                          {lesson.meetingDate
                            ? new Date(lesson.meetingDate).toLocaleString('ar-SA')
                            : 'موعد مرن'}
                        </span>
                        {lesson.isLocked ? (
                          <Link
                            to={`/category/${lesson.pathId}?tab=packages`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-black text-amber-800 hover:bg-amber-100"
                          >
                            <Lock size={14} />
                            <span>متاح للمشتركين</span>
                          </Link>
                        ) : (
                          <Link
                            to={`/live-sessions/${encodeURIComponent(lesson.id)}`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-black text-white hover:bg-indigo-700"
                          >
                            <Video size={14} />
                            <span>فتح قاعة البث</span>
                          </Link>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-black text-slate-900">حجوزات الحصص الفردية</h2>
              {bookings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
                  لا توجد حجوزات حصص فردية مسجلة حالياً.
                </div>
              ) : (
                <div className="space-y-3">
                  {bookings.map((booking) => {
                    const badge = bookingStatusStyle[booking.bookingStatus] || bookingStatusStyle.pending;
                    return (
                      <article
                        key={booking.id}
                        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-3 py-0.5 text-xs font-black ${badge.cls}`}>
                              {badge.label}
                            </span>
                            <span className="text-xs font-bold text-slate-500">
                              {booking.scheduledDate} — {booking.scheduledTime}
                            </span>
                          </div>
                          <h3 className="mt-2 text-sm sm:text-base font-black text-slate-900">
                            {booking.title}
                          </h3>
                          <p className="mt-1 text-xs font-bold text-slate-600">{booking.targetLabel}</p>
                          {booking.assignedTeacherName && (
                            <p className="mt-1 text-xs font-bold text-indigo-700">
                              المدرب المعين: {booking.assignedTeacherName}
                            </p>
                          )}
                        </div>
                        {booking.bookingStatus === 'pending' && (
                          <button
                            type="button"
                            disabled={cancellingId === booking.id}
                            onClick={() => handleCancelBooking(booking.id)}
                            className="inline-flex items-center gap-1.5 self-start rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                          >
                            <XCircle size={14} />
                            <span>{cancellingId === booking.id ? 'جاري الإلغاء...' : 'إلغاء الطلب'}</span>
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
