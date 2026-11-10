import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  Search,
  Hand,
  Clock,
  ShieldCheck,
  AlertCircle,
  X,
  Filter,
} from 'lucide-react';
import type {
  ClassroomAttendance,
  ClassroomAttendanceStatus,
  ClassroomAttendanceRow,
} from '../../api/classroom-types';
import type { RosterMember } from '../../../organizations/api/organizations-client';

interface ClassroomRosterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  attendance: ClassroomAttendance | null;
  roster: RosterMember[];
  onChangeStatus: (studentId: string, status: ClassroomAttendanceStatus) => void;
  raisedHands?: string[]; // studentIds who raised hand
  onLowerHand?: (studentId: string) => void;
  busyStudentId?: string;
}

const ATTENDANCE_BADGES: Record<ClassroomAttendanceStatus, { label: string; badge: string }> = {
  present: { label: 'حاضر', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  late: { label: 'متأخر', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  absent: { label: 'غائب', badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
  excused: { label: 'بعذر', badge: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800' },
};

export const ClassroomRosterDrawer: React.FC<ClassroomRosterDrawerProps> = ({
  isOpen,
  onClose,
  attendance,
  roster,
  onChangeStatus,
  raisedHands = [],
  onLowerHand,
  busyStudentId,
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const rosterMap = useMemo(() => new Map(roster.map((m) => [m.userId, m])), [roster]);

  const rows = useMemo(() => {
    return (attendance?.rows || []).filter((row) => {
      const student = rosterMap.get(row.studentId);
      const name = student?.name || row.studentId;
      if (search && !name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus !== 'all' && row.attendanceStatus !== filterStatus) return false;
      return true;
    });
  }, [attendance?.rows, rosterMap, search, filterStatus]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs" dir="rtl">
      <div className="flex h-full w-full max-w-lg flex-col border-r border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <UserCheck size={20} />
            </span>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                حضور وغياب الطلاب اللحظي
              </h3>
              <p className="text-xs font-bold text-slate-500">
                إجمالي الفصل: {attendance?.expected || roster.length} · حاضر: {attendance?.present || 0}
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

        {/* Attendance Summary Chips */}
        <div className="grid grid-cols-4 gap-2 border-b border-slate-100 bg-slate-50/50 p-4 text-center dark:border-slate-800 dark:bg-slate-950/40">
          <div className="rounded-xl border border-emerald-200 bg-white p-2 dark:border-emerald-900 dark:bg-slate-900">
            <div className="text-base font-black text-emerald-600">{attendance?.present || 0}</div>
            <div className="text-[10px] font-bold text-slate-500">حاضر</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-white p-2 dark:border-amber-900 dark:bg-slate-900">
            <div className="text-base font-black text-amber-600">{attendance?.late || 0}</div>
            <div className="text-[10px] font-bold text-slate-500">متأخر</div>
          </div>
          <div className="rounded-xl border border-rose-200 bg-white p-2 dark:border-rose-900 dark:bg-slate-900">
            <div className="text-base font-black text-rose-600">{attendance?.absent || 0}</div>
            <div className="text-[10px] font-bold text-slate-500">غائب</div>
          </div>
          <div className="rounded-xl border border-sky-200 bg-white p-2 dark:border-sky-900 dark:bg-slate-900">
            <div className="text-base font-black text-sky-600">{attendance?.excused || 0}</div>
            <div className="text-[10px] font-bold text-slate-500">بعذر</div>
          </div>
        </div>

        {/* Hand-raise queue if any */}
        {raisedHands.length > 0 && (
          <div className="border-b border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/30">
            <div className="flex items-center gap-2 text-xs font-black text-amber-800 dark:text-amber-300">
              <Hand size={16} className="animate-bounce" />
              <span>طلاب يطلبون المشاركة ({raisedHands.length}):</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {raisedHands.map((studentId) => {
                const s = rosterMap.get(studentId);
                return (
                  <span
                    key={studentId}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-amber-900 shadow-xs dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200"
                  >
                    {s?.name || studentId}
                    {onLowerHand && (
                      <button
                        type="button"
                        onClick={() => onLowerHand(studentId)}
                        className="text-amber-500 hover:text-amber-800"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="flex items-center gap-2 p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="بحث باسم الطالب…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-9 text-xs font-bold focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <select
            aria-label="تصفية حسب الحالة"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <option value="all">كافة الحالات</option>
            <option value="present">حاضر</option>
            <option value="late">متأخر</option>
            <option value="absent">غائب</option>
            <option value="excused">بعذر</option>
          </select>
        </div>

        {/* Students List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {rows.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-slate-400">
              لا يوجد طلاب مطابقون لمعايير البحث.
            </div>
          ) : (
            rows.map((row) => {
              const student = rosterMap.get(row.studentId);
              const name = student?.name || row.studentId;
              const hasHandRaised = raisedHands.includes(row.studentId);

              return (
                <div
                  key={row.studentId}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs transition hover:border-indigo-200 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-black text-slate-900 dark:text-white text-xs sm:text-sm">
                          {name}
                        </span>
                        {hasHandRaised && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                            <Hand size={11} className="mr-0.5 inline" /> رافع يده
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] font-bold text-slate-400">
                        {row.joinedAt ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            انضم {new Date(row.joinedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span>لم ينضم بعد</span>
                        )}
                        {row.joinedMethod && <span>({row.joinedMethod})</span>}
                      </div>
                    </div>
                  </div>

                  {/* Attendance Selector */}
                  <select
                    aria-label={`تغيير حضور ${name}`}
                    value={row.attendanceStatus}
                    disabled={busyStudentId === row.studentId}
                    onChange={(e) =>
                      onChangeStatus(row.studentId, e.target.value as ClassroomAttendanceStatus)
                    }
                    className={`rounded-xl border px-3 py-1.5 text-xs font-black transition ${
                      ATTENDANCE_BADGES[row.attendanceStatus]?.badge || ''
                    }`}
                  >
                    <option value="present">حاضر</option>
                    <option value="late">متأخر</option>
                    <option value="absent">غائب</option>
                    <option value="excused">بعذر</option>
                  </select>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
