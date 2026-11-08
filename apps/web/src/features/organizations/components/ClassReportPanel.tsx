import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Award, BarChart3, CheckCircle2,
  ChevronRight, Download, Printer, Trophy, Users,
} from 'lucide-react';

interface StudentRow {
  id: string;
  name: string;
  className: string;
  average: number;
  attempts: number;
  status: string;
  weakSkills: string[];
  resultsList: Array<{ score: number; quizTitle: string; date: string }>;
}

interface GroupSnapshot {
  id: string;
  name: string;
  studentCount: number;
  average: number;
  weakStudents: number;
}

interface ClassReportPanelProps {
  students: StudentRow[];
  groupSnapshots: GroupSnapshot[];
  overallAverage: number;
  onSelectStudent: (id: string) => void;
  onExportCSV: () => void;
  onPrint: () => void;
}

type Band = { label: string; min: number; max: number; color: string; bg: string; border: string };
const BANDS: Band[] = [
  { label: 'ممتاز', min: 90, max: 100, color: 'text-emerald-800', bg: 'bg-emerald-100', border: 'border-emerald-300' },
  { label: 'جيد جداً', min: 75, max: 89, color: 'text-blue-800', bg: 'bg-blue-100', border: 'border-blue-300' },
  { label: 'جيد', min: 60, max: 74, color: 'text-amber-800', bg: 'bg-amber-100', border: 'border-amber-300' },
  { label: 'مقبول', min: 50, max: 59, color: 'text-orange-800', bg: 'bg-orange-100', border: 'border-orange-300' },
  { label: 'يحتاج دعم', min: 0, max: 49, color: 'text-rose-800', bg: 'bg-rose-100', border: 'border-rose-300' },
];

export const ClassReportPanel: React.FC<ClassReportPanelProps> = ({
  students, overallAverage, onSelectStudent, onExportCSV, onPrint,
}) => {
  const [selectedClass, setSelectedClass] = useState<string>('all');

  const filteredStudents = useMemo(() =>
    selectedClass === 'all' ? students : students.filter((s) => s.className === selectedClass),
    [students, selectedClass],
  );

  const stats = useMemo(() => {
    const withAttempts = filteredStudents.filter((s) => s.attempts > 0);
    const avg = withAttempts.length
      ? Math.round(withAttempts.reduce((t, s) => t + s.average, 0) / withAttempts.length) : 0;
    const highest = withAttempts.length ? withAttempts.reduce((best, s) => s.average > best ? s.average : best, 0) : 0;
    const lowest = withAttempts.length ? withAttempts.reduce((low, s) => s.average < low ? s.average : low, 100) : 0;

    const bandCounts = BANDS.map((band) => ({
      ...band,
      students: withAttempts.filter((s) => s.average >= band.min && s.average <= band.max),
    }));

    const skillMap = new Map<string, number>();
    filteredStudents.forEach((s) => s.weakSkills.forEach((sk) => {
      skillMap.set(sk, (skillMap.get(sk) || 0) + 1);
    }));
    const weakestSkills = Array.from(skillMap.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([skill, count]) => ({ skill, count }));

    return { avg, highest, lowest, bandCounts, weakestSkills, total: filteredStudents.length, withAttempts: withAttempts.length };
  }, [filteredStudents]);

  const classNames = Array.from(new Set(students.map((s) => s.className))).filter(Boolean);
  const urgentStudents = filteredStudents.filter((s) => s.status === 'danger' || (s.attempts > 0 && s.average < 50));
  const topStudents = [...filteredStudents].filter((s) => s.attempts > 0).sort((a, b) => b.average - a.average).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-500" /> تقرير أداء الفصل
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">توزيع مستويات الطلاب + المهارات الضعيفة + قائمة التدخل</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="all">كل الفصول ({students.length} طالب)</option>
            {classNames.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={onPrint} className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50">
            <Printer size={13} /> طباعة
          </button>
          <button onClick={onExportCSV} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700">
            <Download size={13} /> تصدير CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
          <span className="text-xs font-bold text-gray-500 block">إجمالي الطلاب</span>
          <span className="text-2xl font-black text-gray-900 mt-1 block">{stats.total}</span>
          <span className="text-[10px] text-gray-400">{stats.withAttempts} أدّوا اختبارات</span>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-center">
          <span className="text-xs font-bold text-indigo-700 block">متوسط درجات الفصل</span>
          <span className="text-2xl font-black text-indigo-700 mt-1 block">{stats.avg}%</span>
          <span className="text-[10px] text-indigo-500">العام: {overallAverage}%</span>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center">
          <span className="text-xs font-bold text-emerald-700 block">أعلى درجة مسجلة</span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">{stats.highest}%</span>
          <span className="text-[10px] text-emerald-500">أداء متفوق</span>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-center">
          <span className="text-xs font-bold text-rose-700 block">حالات تحتاج تدخل</span>
          <span className="text-2xl font-black text-rose-700 mt-1 block">{urgentStudents.length}</span>
          <span className="text-[10px] text-rose-500">دون 60% أو متعثر</span>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
        <h4 className="text-xs font-black text-gray-700">توزيع المستويات الدراسية</h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {stats.bandCounts.map((b) => (
            <div key={b.label} className={`rounded-xl border p-3 text-center ${b.bg} ${b.border}`}>
              <div className={`text-xl font-black ${b.color}`}>{b.students.length}</div>
              <div className={`text-xs font-black ${b.color} mt-0.5`}>{b.label}</div>
              <div className="text-[10px] opacity-70 mt-0.5">({b.min}%–{b.max}%)</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-rose-100 bg-rose-50/20 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-rose-100 pb-2">
            <h4 className="text-xs font-black text-rose-800 flex items-center gap-1.5">
              <AlertTriangle size={14} /> الطلاب الأكثر احتياجاً للتدخل
            </h4>
            <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
              {urgentStudents.length} طلاب
            </span>
          </div>
          {urgentStudents.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">لا توجد حالات حرجة في هذا الفصل.</p>
          ) : (
            <div className="space-y-2">
              {urgentStudents.slice(0, 5).map((s) => (
                <div key={s.id} onClick={() => onSelectStudent(s.id)}
                  className="flex items-center justify-between rounded-xl bg-white border border-rose-100 p-2.5 cursor-pointer hover:bg-rose-50/50 transition-colors">
                  <div>
                    <span className="text-xs font-black text-gray-900 block">{s.name}</span>
                    <span className="text-[10px] text-gray-400">{s.className}</span>
                  </div>
                  <span className="rounded-lg bg-rose-100 text-rose-700 px-2 py-0.5 text-xs font-black">
                    {s.average}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/20 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
            <h4 className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
              <Trophy size={14} /> الطلاب المتميزون (لوحة الشرف)
            </h4>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
              {topStudents.length} طلاب
            </span>
          </div>
          {topStudents.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">لا تتوفر نتائج بعد لتحديد المتميزين.</p>
          ) : (
            <div className="space-y-2">
              {topStudents.map((s, idx) => (
                <div key={s.id} onClick={() => onSelectStudent(s.id)}
                  className="flex items-center justify-between rounded-xl bg-white border border-emerald-100 p-2.5 cursor-pointer hover:bg-emerald-50/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-black">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="text-xs font-black text-gray-900 block">{s.name}</span>
                      <span className="text-[10px] text-gray-400">{s.className}</span>
                    </div>
                  </div>
                  <span className="rounded-lg bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-black">
                    {s.average}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
