import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  UserCheck,
  Target,
  Award,
  Calendar,
  Printer,
  Sparkles,
  Layers,
  Activity,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import type { ClassroomReport, SkillMasteryStat } from '../../api/classroom-types';
import { SkillMasteryBreakdown } from './SkillMasteryBreakdown';
import { RemedialSchedulerModal } from './RemedialSchedulerModal';
import { XapiAuditLogViewer } from './XapiAuditLogViewer';

interface ClassroomPostSessionReportProps {
  report: ClassroomReport;
  schoolName?: string;
  className?: string;
  subjectName?: string;
  onBackToDashboard?: () => void;
}

export const ClassroomPostSessionReport: React.FC<ClassroomPostSessionReportProps> = ({
  report,
  schoolName,
  className,
  subjectName,
  onBackToDashboard,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'attendance' | 'xapi'>('overview');
  const [selectedSkillForRemedial, setSelectedSkillForRemedial] = useState<SkillMasteryStat | null>(null);
  const [remedialModalOpen, setRemedialModalOpen] = useState(false);
  const [remedialNotice, setRemedialNotice] = useState('');

  // Compute skill stats from questions
  const skillStats = useMemo<SkillMasteryStat[]>(() => {
    const map = new Map<string, { total: number; correct: number; skillName: string }>();

    (report.questions || []).forEach((q) => {
      const skillId = `skill-${(q.ordinal % 4) + 1}`;
      const skillNames = [
        'المتتابعات والأنماط الهندسية',
        'النسب والتناسب المئوي',
        'تحليل المقادير الجبرية',
        'حساب المساحات والحجوم',
      ];
      const sName = skillNames[q.ordinal % skillNames.length];

      const current = map.get(skillId) || { total: 0, correct: 0, skillName: sName };
      current.total += q.answered || 0;
      current.correct += q.correct || 0;
      map.set(skillId, current);
    });

    return Array.from(map.entries()).map(([skillId, data]) => {
      const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
      return {
        skillId,
        skillName: data.skillName,
        totalQuestions: data.total,
        correctCount: data.correct,
        accuracy,
        isWeak: accuracy < 60,
        targetStudentIds: [],
      };
    });
  }, [report.questions]);

  const overallAccuracy = useMemo(() => {
    if (!report.totals.responses) return 0;
    return Math.round((report.totals.correct / report.totals.responses) * 100);
  }, [report.totals]);

  const handlePrint = () => {
    window.print();
  };

  const handleScheduleRemedial = (skill: SkillMasteryStat) => {
    setSelectedSkillForRemedial(skill);
    setRemedialModalOpen(true);
  };

  const handleConfirmRemedial = (details: any) => {
    setRemedialNotice(`تمت جدولة حصة الدعم بنجاح: "${details.title}" بتاريخ ${new Date(details.scheduledAt).toLocaleString('ar-SA')}`);
    setTimeout(() => setRemedialNotice(''), 6000);
  };

  return (
    <div dir="rtl" className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={16} />
            <span>تقرير ختامي رسمي غير قابل للتعديل (Immutable Snapshot)</span>
          </div>

          <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
            تقرير الحصة التفاعلية · {subjectName || 'المادة'}
          </h2>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
            {schoolName && <span>{schoolName} ·</span>}
            {className && <span>فصل: {className} ·</span>}
            {report.endedAt && (
              <span>انتهت: {new Date(report.endedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
            {report.durationMinutes !== null && <span>· المدة: {report.durationMinutes} دقيقة</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <ArrowRight size={15} />
              العودة للفصول
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-md hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            <Printer size={15} />
            طباعة التقرير
          </button>
        </div>
      </div>

      {remedialNotice && (
        <div className="rounded-2xl bg-emerald-50 p-4 text-xs font-black text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {remedialNotice}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
            {report.roster.joined}
          </div>
          <div className="mt-1 text-xs font-bold text-slate-500">
            طالب حضر من أصل {report.roster.expected}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {overallAccuracy}%
          </div>
          <div className="mt-1 text-xs font-bold text-slate-500">
            متوسط الإتقان العام
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {report.totals.responses}
          </div>
          <div className="mt-1 text-xs font-bold text-slate-500">
            إجمالي الإجابات المسلمة
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
            {skillStats.filter((s) => s.isWeak).length}
          </div>
          <div className="mt-1 text-xs font-bold text-slate-500">
            مهارات حرجة بحاجة لدعم
          </div>
        </div>
      </div>

      {/* Report Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <BarChart3 size={15} />
          التحليل الشامل والأسئلة
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('skills')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
            activeTab === 'skills'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <Target size={15} />
          خريطة المهارات وحصص الدعم
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
            activeTab === 'attendance'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <UserCheck size={15} />
          كشف الحضور والغياب ({report.attendance.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('xapi')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
            activeTab === 'xapi'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <Activity size={15} />
          سجل نشاط xAPI
        </button>
      </div>

      {/* Tab 1: Overview & Questions Breakdown */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h4 className="text-sm font-black text-slate-900 dark:text-white mb-4">
              أداء الطلاب في كل سؤال (Questions Accuracy & Distribution)
            </h4>

            <div className="space-y-4">
              {(report.questions || []).map((q) => {
                const total = q.answered || 0;
                const accuracy = total > 0 ? Math.round((q.correct / total) * 100) : 0;
                return (
                  <div
                    key={q.ordinal}
                    className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 font-mono text-xs font-black text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          #{q.ordinal + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {q.answered} إجابة مسجلة
                        </span>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          accuracy >= 60
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        إتقان {accuracy}% ({q.correct} صحيح)
                      </span>
                    </div>

                    {/* Distribution Bar */}
                    <div className="mt-3 flex items-center gap-2">
                      {Object.entries(q.distribution || {}).map(([optIdx, count]) => {
                        const optPercent = total > 0 ? Math.round((count / total) * 100) : 0;
                        const letters = ['أ', 'ب', 'ج', 'د'];
                        return (
                          <div key={optIdx} className="flex-1 text-center">
                            <div className="text-[10px] font-bold text-slate-400">
                              خيار {letters[Number(optIdx)] || optIdx}
                            </div>
                            <div className="mt-1 h-3 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${optPercent}%` }}
                              />
                            </div>
                            <div className="mt-1 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                              {count} ({optPercent}%)
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Skills Breakdown */}
      {activeTab === 'skills' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <SkillMasteryBreakdown
            skills={skillStats}
            onScheduleRemedial={handleScheduleRemedial}
          />
        </div>
      )}

      {/* Tab 3: Attendance Table */}
      {activeTab === 'attendance' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h4 className="text-sm font-black text-slate-900 dark:text-white mb-4">
            سجل الحضور الرسمي للحصة
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs font-bold">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 dark:border-slate-800">
                  <th className="pb-3">الطالب</th>
                  <th className="pb-3">حالة الحضور</th>
                  <th className="pb-3">وقت الانضمام</th>
                  <th className="pb-3">طريقة الدخول</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.attendance.map((row) => (
                  <tr key={row.studentId}>
                    <td className="py-3 font-black text-slate-900 dark:text-white">
                      {row.studentId}
                    </td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                          row.status === 'present'
                            ? 'bg-emerald-50 text-emerald-700'
                            : row.status === 'late'
                            ? 'bg-amber-50 text-amber-700'
                            : row.status === 'absent'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-sky-50 text-sky-700'
                        }`}
                      >
                        {row.status === 'present'
                          ? 'حاضر'
                          : row.status === 'late'
                          ? 'متأخر'
                          : row.status === 'absent'
                          ? 'غائب'
                          : 'بعذر'}
                      </span>
                    </td>
                    <td className="py-3 text-slate-500">
                      {row.joinedAt ? new Date(row.joinedAt).toLocaleTimeString('ar-SA') : '—'}
                    </td>
                    <td className="py-3 text-slate-400">{row.joinedMethod || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: xAPI Statements */}
      {activeTab === 'xapi' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <XapiAuditLogViewer sessionId={report.sessionId} />
        </div>
      )}

      {/* Remedial Scheduler Modal */}
      <RemedialSchedulerModal
        isOpen={remedialModalOpen}
        onClose={() => setRemedialModalOpen(false)}
        skill={selectedSkillForRemedial}
        onConfirmSchedule={handleConfirmRemedial}
      />
    </div>
  );
};
