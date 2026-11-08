import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Filter, Target } from 'lucide-react';

interface SkillEntry {
  skill: string;
  mastery: number;
}

interface StudentRow {
  id: string;
  name: string;
  className: string;
  average: number;
  status: string;
  resultsList: Array<{ skillsAnalysis?: SkillEntry[] }>;
}

interface GroupSnapshot {
  id: string;
  name: string;
  studentCount: number;
  average: number;
}

interface ClassSkillsMapPanelProps {
  students: StudentRow[];
  groupSnapshots: GroupSnapshot[];
  onSelectStudent: (id: string) => void;
}

function getCellColor(mastery: number): string {
  if (mastery >= 80) return 'bg-emerald-500 text-white';
  if (mastery >= 65) return 'bg-emerald-200 text-emerald-900';
  if (mastery >= 50) return 'bg-amber-300 text-amber-900';
  if (mastery >= 35) return 'bg-orange-400 text-white';
  return 'bg-rose-500 text-white';
}

const PAGE_SIZE = 10;

export const ClassSkillsMapPanel: React.FC<ClassSkillsMapPanelProps> = ({
  students, onSelectStudent,
}) => {
  const [classFilter, setClassFilter] = useState('all');
  const [page, setPage] = useState(0);

  const filteredStudents = useMemo(() => {
    if (classFilter === 'all') return students;
    return students.filter((s) => s.className === classFilter);
  }, [students, classFilter]);

  const { skillColumns, studentSkillMap } = useMemo(() => {
    const skillSet = new Map<string, { total: number; count: number }>();
    const studentMap = new Map<string, Map<string, { total: number; count: number }>>();

    filteredStudents.forEach((student) => {
      const sMap = new Map<string, { total: number; count: number }>();
      student.resultsList.forEach((r) => {
        (r.skillsAnalysis || []).forEach((sk) => {
          const name = String(sk.skill || '').trim();
          if (!name) return;
          const cur = skillSet.get(name) || { total: 0, count: 0 };
          cur.total += Number(sk.mastery || 0);
          cur.count += 1;
          skillSet.set(name, cur);

          const sCur = sMap.get(name) || { total: 0, count: 0 };
          sCur.total += Number(sk.mastery || 0);
          sCur.count += 1;
          sMap.set(name, sCur);
        });
      });
      studentMap.set(student.id, sMap);
    });

    const skillColumns = Array.from(skillSet.entries())
      .map(([skill, { total, count }]) => ({ skill, avg: count ? Math.round(total / count) : 0 }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 12);

    return { skillColumns, studentSkillMap: studentMap };
  }, [filteredStudents]);

  const paged = filteredStudents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE);
  const classNames = Array.from(new Set(students.map((s) => s.className))).filter(Boolean);

  if (skillColumns.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-10 text-center">
        <Target size={36} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 font-bold">لا توجد بيانات مهارات كافية بعد.</p>
        <p className="text-xs text-gray-400 mt-1">ستظهر مصفوفة المهارات تلقائياً عند أداء الطلاب للاختبارات.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
            <Target size={18} className="text-violet-500" />
            مصفوفة المهارات — طالب × مهارة
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            الألوان: <span className="text-emerald-600 font-bold">أخضر ممتاز</span> •{' '}
            <span className="text-amber-600 font-bold">أصفر متوسط</span> •{' '}
            <span className="text-rose-600 font-bold">أحمر ضعيف</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select
            value={classFilter}
            onChange={(e) => { setClassFilter(e.target.value); setPage(0); }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            <option value="all">كل الفصول ({students.length} طالب)</option>
            {classNames.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {skillColumns.filter((s) => s.avg < 50).length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-800">
          <AlertTriangle size={14} />
          {skillColumns.filter((s) => s.avg < 50).length} مهارة دون 50% — تحتاج إعادة شرح للفصل
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="sticky right-0 z-10 bg-gray-50 px-4 py-3 text-right font-black text-gray-700 min-w-[130px]">
                الطالب
              </th>
              <th className="px-3 py-3 text-center font-black text-gray-700 whitespace-nowrap">
                المتوسط
              </th>
              {skillColumns.map((sk) => (
                <th key={sk.skill} className="px-2 py-3 text-center font-bold text-gray-600 max-w-[80px]">
                  <div className="truncate max-w-[72px] mx-auto" title={sk.skill}>{sk.skill}</div>
                  <div className={`mt-1 text-[10px] font-black rounded px-1 ${getCellColor(sk.avg)}`}>{sk.avg}%</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paged.map((student) => {
              const sMap = studentSkillMap.get(student.id);
              const avgColor = student.average >= 75 ? 'text-emerald-700' : student.average >= 55 ? 'text-amber-700' : 'text-rose-700';
              return (
                <tr key={student.id} className="hover:bg-violet-50/30 transition-colors cursor-pointer"
                  onClick={() => onSelectStudent(student.id)}>
                  <td className="sticky right-0 z-10 bg-white px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-black text-violet-700">
                        {student.name.charAt(0)}
                      </span>
                      <div>
                        <p className="font-bold text-gray-900 truncate max-w-[90px]" title={student.name}>{student.name}</p>
                        <p className="text-[10px] text-gray-400">{student.className}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`font-black text-sm ${avgColor}`}>{student.average}%</span>
                  </td>
                  {skillColumns.map((sk) => {
                    const entry = sMap?.get(sk.skill);
                    const mastery = entry ? Math.round(entry.total / entry.count) : null;
                    return (
                      <td key={sk.skill} className="px-2 py-2.5 text-center">
                        {mastery !== null ? (
                          <span className={`inline-block rounded-lg px-2 py-1 text-[11px] font-black ${getCellColor(mastery)}`}>
                            {mastery}%
                          </span>
                        ) : (
                          <span className="text-gray-200 font-bold">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs font-bold text-gray-500">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
            <ChevronRight size={14} /> السابق
          </button>
          <span>صفحة {page + 1} من {totalPages} • {filteredStudents.length} طالب</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
            التالي <ChevronLeft size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
