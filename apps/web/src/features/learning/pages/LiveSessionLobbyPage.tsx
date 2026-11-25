import { ArrowRight, Calendar, Clock, ExternalLink, Lock, PlayCircle, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';

type LiveLesson = Awaited<ReturnType<typeof contentClient.liveLesson>>['lesson'];

function appendZoomName(rawUrl: string, name: string): string {
  if (!rawUrl || !name.trim()) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.includes('zoom.us') && !parsed.searchParams.has('uname')) {
      parsed.searchParams.set('uname', name.trim());
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export default function LiveSessionLobbyPage() {
  const { lessonId = '' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  const [lesson, setLesson] = useState<LiveLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !lessonId) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    contentClient
      .liveLesson(lessonId, controller.signal)
      .then((res) => setLesson(res.lesson))
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'تعذر تحميل تفاصيل البث المباشر.');
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [user, lessonId]);

  if (!authLoading && !user) {
    return <Navigate replace to={`/login?next=${encodeURIComponent(location.pathname)}`} />;
  }

  const joinUrl = lesson ? appendZoomName(lesson.meetingUrl, user?.name || '') : '';

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/live-sessions"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
          >
            <ArrowRight size={15} />
            <span>العودة لقائمة البثوث</span>
          </Link>
        </div>

        {loading ? (
          <div role="status" className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">
            جاري تجهيز قاعة البث المباشر...
          </div>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-bold text-rose-700">
            {error}
          </div>
        ) : !lesson ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-600">
            اللقاء المطلوب غير متاح.
          </div>
        ) : (
          <section className="rounded-3xl border border-indigo-100 bg-white p-6 sm:p-8 shadow-2xs space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-indigo-50 px-3 py-1 font-black text-indigo-700">
                {lesson.pathName} {lesson.subjectName ? `— ${lesson.subjectName}` : ''}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">
                <Clock size={13} />
                <span>{lesson.durationMinutes} دقيقة</span>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900">{lesson.title}</h1>
            {lesson.description && (
              <p className="text-sm font-medium text-slate-600 leading-relaxed">{lesson.description}</p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-bold text-slate-700">
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-indigo-600" />
                <span>
                  الموعد:{' '}
                  {lesson.meetingDate
                    ? new Date(lesson.meetingDate).toLocaleString('ar-SA')
                    : 'يُحدد مع المدرب'}
                </span>
              </div>
              <div>المدرب: {lesson.teacherName || 'مدرب المنصة'}</div>
            </div>

            {lesson.joinInstructions && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs sm:text-sm">
                <h2 className="font-black text-indigo-900">تعليمات الانضمام</h2>
                <p className="mt-1 font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {lesson.joinInstructions}
                </p>
              </div>
            )}

            {lesson.isLocked ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
                <div className="flex items-center gap-2 text-sm font-black">
                  <Lock size={17} />
                  <span>هذه الجلسة مخصصة للمشتركين في الباقة</span>
                </div>
                <p className="mt-1.5 text-xs font-bold text-amber-800">
                  اشترك في الباقة المناسبة لتفعيل رابط الدخول المباشر والتسجيل.
                </p>
                <div className="mt-4">
                  <Link
                    to={`/category/${lesson.pathId}?tab=packages`}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white hover:bg-amber-700"
                  >
                    <span>عرض الباقات والاشتراك</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 pt-2">
                {joinUrl ? (
                  <a
                    href={joinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white hover:bg-indigo-700"
                  >
                    <Video size={16} />
                    <span>الانضمام للبث المباشر</span>
                    <ExternalLink size={14} />
                  </a>
                ) : (
                  <span className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600">
                    سيُتاح رابط البث المباشر قبل الموعد مباشرة.
                  </span>
                )}

                {lesson.showRecording && lesson.recordingUrl && (
                  <a
                    href={lesson.recordingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-black text-emerald-800 hover:bg-emerald-100"
                  >
                    <PlayCircle size={16} />
                    <span>مشاهدة التسجيل</span>
                  </a>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
