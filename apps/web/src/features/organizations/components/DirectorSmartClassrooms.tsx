import { Radio, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

import { classroomClient } from '../../classroom/api/classroom-client';
import type { ClassroomSession, ClassroomSessionStatus } from '../../classroom/api/classroom-types';

interface NamedRecord { id: string; name: string }

const statusLabels: Record<ClassroomSessionStatus, string> = {
  draft: 'مسودة', scheduled: 'مجدولة', live: 'مباشرة', ended: 'مكتملة', archived: 'مؤرشفة',
};

interface Props {
  schoolId: string;
  classes: NamedRecord[];
  subjects: NamedRecord[];
  teachers: { teacherId: string; name: string }[];
}

export function DirectorSmartClassrooms({ schoolId, classes, subjects, teachers }: Props) {
  const [result, setResult] = useState<{ sessions: ClassroomSession[] } | { error: true } | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    classroomClient.teacherSessions(schoolId, controller.signal).then(({ sessions }) => {
      if (!controller.signal.aborted) setResult({ sessions: sessions.filter(session => session.schoolId === schoolId) });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ error: true });
    });
    return () => controller.abort();
  }, [schoolId, refresh]);

  function reload() {
    setResult(null);
    setRefresh(value => value + 1);
  }

  return <section aria-label="الحصص الذكية المدرسية" className="mt-6 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-white p-5 shadow-sm">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black text-slate-900"><Radio size={19} className="text-indigo-600" /> الحصص الذكية المدرسية</h2>
        <p className="mt-1 text-sm text-slate-600">أحدث الحصص المسجلة في المدرسة</p>
      </div>
      <button type="button" disabled={!result} onClick={reload} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50">
        <RefreshCw size={15} /> تحديث الحصص
      </button>
    </div>
    {!result ? <p role="status" className="rounded-2xl border bg-white p-4 text-sm">جارٍ تحميل الحصص الذكية…</p> :
      'error' in result ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        تعذر تحميل الحصص الذكية لهذه المدرسة.
        <button type="button" onClick={reload} className="ms-3 font-bold underline">إعادة المحاولة</button>
      </div> : !result.sessions.length ? <p className="rounded-2xl border border-dashed bg-white p-5 text-sm text-slate-600">لا توجد حصص ذكية مسجلة لهذه المدرسة.</p> :
      <div className="grid gap-4 sm:grid-cols-2">
        {result.sessions.map(session => {
          const classroom = classes.find(item => item.id === session.classId);
          const subject = subjects.find(item => item.id === session.subjectId);
          const teacher = teachers.find(item => item.teacherId === session.teacherId);
          return <article key={session.id} className="space-y-3 rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 sm:justify-between">
              <h3 className="font-black text-slate-900">{classroom?.name || subject?.name || 'حصة ذكية'}</h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${session.status === 'live' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                {statusLabels[session.status] || 'حالة غير متاحة'}
              </span>
            </div>
            {classroom && subject ? <p className="text-sm text-slate-700">{subject.name}</p> : null}
            {teacher ? <p className="text-sm text-slate-700">المعلم {teacher.name}</p> : null}
            <div className="flex flex-col items-start gap-2 border-t pt-3 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <span><bdi>{session.day}</bdi>{session.period != null ? ` · الحصة ${session.period}` : ''}</span>
              {session.status === 'live' ? <a href={`/classroom/${encodeURIComponent(session.id)}/projector`} target="_blank" rel="noreferrer" className="font-bold text-indigo-700 underline">فتح شاشة العرض</a> : null}
            </div>
          </article>;
        })}
      </div>}
  </section>;
}
