import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarDays, Copy, Download, ExternalLink, Lock, LockOpen, Plus,
  RefreshCw, Search, Video, Clock, Users, CheckCircle, Radio, Loader2
} from 'lucide-react';
import { classroomClient } from '../../classroom/api/classroom-client';

export interface LiveSessionItem {
  id: string;
  title: string;
  subjectName: string;
  provider: 'zoom' | 'teams' | 'google_meet' | 'live_youtube';
  meetingUrl: string;
  meetingDate: string;
  time: string;
  durationMinutes: number;
  instructorName: string;
  className: string;
  status: 'upcoming' | 'live' | 'ended';
  attendeesCount: number;
}

const providerLabels: Record<string, { name: string; color: string }> = {
  zoom: { name: 'Zoom', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  teams: { name: 'Microsoft Teams', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  google_meet: { name: 'Google Meet', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  live_youtube: { name: 'YouTube Live', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export interface LiveSessionsManagerProps {
  schoolId?: string;
  initialSessions?: LiveSessionItem[];
}

export const LiveSessionsManager: React.FC<LiveSessionsManagerProps> = ({ schoolId, initialSessions }) => {
  const [sessions, setSessions] = useState<LiveSessionItem[]>(initialSessions || []);
  const [loading, setLoading] = useState(!initialSessions);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [copyFeedback, setCopyFeedback] = useState('');

  useEffect(() => {
    if (initialSessions) {
      setSessions(initialSessions);
      setLoading(false);
      setLoadError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setLoadError(null);
    classroomClient
      .teacherSessions(schoolId, ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        const matching = schoolId
          ? (res.sessions || []).filter((s) => s.schoolId === schoolId)
          : (res.sessions || []);
        const mapped: LiveSessionItem[] = matching.map((s) => ({
          id: s.id,
          title: `حصة تفاعلية - ${s.day || 'اليوم'}`,
          subjectName: 'فصل تفاعلي مباشر',
          provider: 'teams',
          meetingUrl: `/classroom/${s.id}`,
          meetingDate: s.day || new Date().toISOString().split('T')[0],
          time: s.period ? `الحصة ${s.period}` : 'حصة مباشرة',
          durationMinutes: 45,
          instructorName: 'معلم الفصل',
          className: 'فصل مدرسي',
          status: s.status === 'live' ? 'live' : s.status === 'ended' ? 'ended' : 'upcoming',
          attendeesCount: 0,
        }));
        setSessions(mapped);
        setLoadError(null);
      })
      .catch((err: any) => {
        if (ctrl.signal.aborted) return;
        setSessions([]);
        setLoadError(err?.message || 'تعذر تحميل الحصص المباشرة للمدرسة');
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [schoolId, initialSessions, reloadKey]);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (providerFilter !== 'all' && s.provider !== providerFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          s.title.toLowerCase().includes(q) ||
          s.subjectName.toLowerCase().includes(q) ||
          s.instructorName.toLowerCase().includes(q) ||
          s.className.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sessions, providerFilter, searchQuery]);

  const copyMeetingLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopyFeedback('✅ تم نسخ رابط الحصة المباشرة إلى الحافظة!');
    setTimeout(() => setCopyFeedback(''), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black text-gray-900">
            <Video className="text-indigo-600" /> الحصص المباشرة والجدول الأكاديمي
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            متابعة البث الحي والفصول الافتراضية وحضور الطلاب في الحصص المقررة.
          </p>
        </div>
      </div>

      {copyFeedback && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
          {copyFeedback}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في الحصص أو المعلمين أو الفصول..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pr-9 pl-3 text-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">كل منصات البث</option>
            <option value="zoom">Zoom</option>
            <option value="teams">Microsoft Teams</option>
            <option value="google_meet">Google Meet</option>
            <option value="live_youtube">YouTube Live</option>
          </select>
        </div>
      </div>

      {/* Sessions Grid */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-12 text-sm text-gray-500">
          <Loader2 size={18} className="animate-spin text-indigo-600" />
          <span>جاري تحميل الحصص المباشرة...</span>
        </div>
      ) : loadError ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-800">
          <div className="font-bold text-sm mb-1">فشل تحميل الحصص المباشرة</div>
          <p className="text-xs text-rose-600 mb-4">{loadError}</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10 text-center">
          <Video size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-bold">لا توجد حصص تفاعلية مباشرة مجدولة حالياً لهذه المدرسة.</p>
          <p className="text-xs text-gray-400 mt-1">ستظهر الحصص الافتراضية هنا بمجرد جدولتها من قبل معلمي المدرسة.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((s) => {
            const providerInfo = providerLabels[s.provider] || { name: s.provider, color: 'bg-gray-50 text-gray-700' };
            const isLiveNow = s.status === 'live';

            return (
              <div key={s.id} className="flex flex-col justify-between rounded-3xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-all">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black border ${providerInfo.color}`}>
                      {providerInfo.name}
                    </span>
                    {isLiveNow ? (
                      <span className="flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 text-[10px] font-black">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                        بث مباشر الآن
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full px-2.5 py-0.5">
                        قادم
                      </span>
                    )}
                  </div>

                  <h3 className="font-black text-gray-900 text-sm leading-snug">{s.title}</h3>
                  <p className="text-xs text-indigo-600 font-bold mt-1">{s.subjectName}</p>

                  <div className="mt-4 space-y-2 border-t border-gray-50 pt-3 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={13} className="text-gray-400" />
                      <span>{s.meetingDate} • {s.time} ({s.durationMinutes} دقيقة)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users size={13} className="text-gray-400" />
                      <span>المعلم: {s.instructorName} • {s.className}</span>
                    </div>
                    <div className="flex items-center gap-2 text-indigo-700 font-bold">
                      <CheckCircle size={13} className="text-emerald-500" />
                      <span>المسجلون: {s.attendeesCount} طالب</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-gray-100 flex gap-2">
                  <a
                    href={s.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-white py-2 text-xs font-black hover:bg-indigo-700 transition-colors shadow-xs"
                  >
                    <ExternalLink size={13} />
                    <span>دخول الحصة</span>
                  </a>
                  <button
                    onClick={() => copyMeetingLink(s.meetingUrl)}
                    className="rounded-xl border border-gray-200 p-2 text-gray-600 hover:bg-gray-100 transition-colors"
                    title="نسخ الرابط"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
