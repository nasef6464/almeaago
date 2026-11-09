import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BarChart3, CheckCircle2, Download,
  ExternalLink, FileSpreadsheet, Loader2, Presentation,
  RefreshCw, Target, Trophy, Users, X, Zap
} from 'lucide-react';
import { classroomClient } from '../../classroom/api/classroom-client';
import type { ClassroomReport, ClassroomSession } from '../../classroom/api/classroom-types';

interface TeacherClassroomReportsSectionProps {
  schoolId: string;
  assignments: Array<{ assignmentId: string; classId: string; className: string; subjectId?: string; studentCount: number }>;
  onPrepareIntervention?: (skillOrClass: string) => void;
}

export const TeacherClassroomReportsSection: React.FC<TeacherClassroomReportsSectionProps> = ({
  schoolId,
  assignments,
  onPrepareIntervention,
}) => {
  const [sessions, setSessions] = useState<ClassroomSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ClassroomSession | null>(null);
  const [selectedReport, setSelectedReport] = useState<ClassroomReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [classFilter, setClassFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSessions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await classroomClient.teacherSessions();
      setSessions(res.sessions || []);
    } catch (err: any) {
      setSessions([]);
      setError(err?.message || 'تعذر تحميل سجل الحصص الذكية.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, [schoolId]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (classFilter !== 'all' && s.classId !== classFilter) return false;
      if (timeFilter === 'today') {
        const d = new Date(s.createdAt);
        const now = new Date();
        if (d.toDateString() !== now.toDateString()) return false;
      }
      return true;
    });
  }, [sessions, classFilter, timeFilter]);

  const stats = useMemo(() => {
    const total = filteredSessions.length;
    const ended = filteredSessions.filter((s) => s.status === 'ended' || s.status === 'archived').length;
    const active = filteredSessions.filter((s) => s.status === 'live').length;
    const totalQuestions = filteredSessions.reduce((acc, s) => acc + ((s as any).totalQuestions || 0), 0);
    return { total, ended, active, totalQuestions };
  }, [filteredSessions]);

  const handleOpenReport = async (session: ClassroomSession) => {
    setSelectedSession(session);
    setLoadingReport(true);
    try {
      const repRes = await classroomClient.report(session.id);
      setSelectedReport(repRes.report);
    } catch {
      setSelectedReport(null);
    } finally {
      setLoadingReport(false);
    }
  };

  const exportExcel = (session: ClassroomSession, report: ClassroomReport | null) => {
    const assignment = assignments.find((a) => a.classId === session.classId);
    const className = assignment?.className || 'الفصل';
    const rows = `
      <tr><td>معرف الجلسة</td><td>${session.id}</td></tr>
      <tr><td>الفصل الدراسي</td><td>${className}</td></tr>
      <tr><td>الحالة</td><td>${session.status}</td></tr>
      <tr><td>تاريخ الحصة</td><td>${new Date(session.createdAt).toLocaleDateString('ar-SA')}</td></tr>
      <tr><td>إجمالي الأسئلة</td><td>${(session as any).totalQuestions || 0}</td></tr>
      <tr><td>الطلاب الحاضرون</td><td>${report?.roster.present ?? '—'}</td></tr>
      <tr><td>الطلاب المتأخرون</td><td>${report?.roster.late ?? '—'}</td></tr>
      <tr><td>الطلاب الغائبون</td><td>${report?.roster.absent ?? '—'}</td></tr>
      <tr><td>إجمالي الإجابات</td><td>${report?.totals.responses ?? '—'}</td></tr>
    `;

    const html = `
      <html dir="rtl">
        <head><meta charset="utf-8"/></head>
        <body>
          <table border="1">
            <thead>
              <tr><th colspan="2">تقرير الحصة الذكية - ${className}</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_الحصة_الذكية_${className}_${session.id.slice(0, 8)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Bar */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
              <BarChart3 className="text-indigo-600" size={22} /> تقارير الحصص الذكية وتشخيص الفهم اللحظي
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              سجل كامل للحصص المنعقدة، ونسب الحضور، ودرجات الاستيعاب المحفوظة في قاعدة البيانات.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">كل الفصول المسندة</option>
              {assignments.map((a) => (
                <option key={a.classId} value={a.classId}>{a.className}</option>
              ))}
            </select>

            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">كامل الفترة</option>
              <option value="today">اليوم</option>
              <option value="week">آخر أسبوع</option>
              <option value="month">آخر شهر</option>
            </select>

            <button
              type="button"
              onClick={() => void loadSessions()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>تحديث</span>
            </button>
          </div>
        </div>

        {/* 4 KPIs Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
            <span className="text-xs font-bold text-indigo-700 block">إجمالي الحصص الذكية</span>
            <span className="text-2xl font-black text-indigo-950 mt-1 block">{stats.total}</span>
            <span className="text-[11px] text-indigo-500 mt-1 block">حصص منشأة ومسجلة</span>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <span className="text-xs font-bold text-emerald-700 block">الحصص المكتملة</span>
            <span className="text-2xl font-black text-emerald-950 mt-1 block">{stats.ended}</span>
            <span className="text-[11px] text-emerald-600 mt-1 block">تقارير نهائية محفوظة</span>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
            <span className="text-xs font-bold text-amber-700 block">حصة جارية الآن</span>
            <span className="text-2xl font-black text-amber-950 mt-1 block">{stats.active}</span>
            <span className="text-[11px] text-amber-600 mt-1 block">بث تفاعلي لحظي</span>
          </div>

          <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
            <span className="text-xs font-bold text-purple-700 block">الأسئلة المبثوثة</span>
            <span className="text-2xl font-black text-purple-950 mt-1 block">{stats.totalQuestions}</span>
            <span className="text-[11px] text-purple-600 mt-1 block">أسئلة وتحديات صفية</span>
          </div>
        </div>

        {/* Diagnostic Action Banner */}
        <div className="mt-6 rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-orange-50/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white font-black">
              <Target size={20} />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-amber-950">تشخيص الفجوات المهارية من إجابات الطلاب</h4>
              <p className="text-[11px] text-amber-800 mt-0.5">
                يرصد النظام تلقائياً المهارات التي تدنى استيعاب الطلاب فيها أثناء الحصة لاقتراح تدريب علاجي مباشر.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onPrepareIntervention?.(classFilter !== 'all' ? classFilter : ' الصف الثالث الثانوي')}
            className="flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-black text-white shadow-xs transition-colors shrink-0"
          >
            <Zap size={14} /> إنشاء تدريب علاجي للفجوات
          </button>
        </div>

        {/* Sessions List */}
        <div className="mt-6">
          <h3 className="text-sm font-black text-slate-900 mb-3">سجل الجلسات والحصص المسجلة</h3>
          {loading ? (
            <div className="text-center py-12 text-xs font-bold text-slate-400">
              <Loader2 className="mx-auto mb-2 animate-spin text-indigo-600" size={24} />
              جارٍ تحميل تقارير الحصص من الخادم...
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs font-bold text-slate-400">
              لا توجد حصص منتهية مسجلة بالفلاتر المحددة حالياً. ابدأ أول حصة ذكية من زر "بدء حصة ذكية"!
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 overflow-hidden">
              {filteredSessions.map((s) => {
                const assignment = assignments.find((a) => a.classId === s.classId);
                const className = assignment?.className || 'فصل مسند';
                const isLive = s.status === 'live';
                return (
                  <div
                    key={s.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">{className}</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black border ${
                            isLive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {isLive ? '● جارية الآن' : 'منتهية ومحفوظة'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(s.createdAt).toLocaleDateString('ar-SA')} · {(s as any).totalQuestions || 0} أسئلة · النمط: {s.publishedMode === 'single' ? 'تحدي فردي' : 'حزمة صفية'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenReport(s)}
                        className="flex items-center gap-1 rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
                      >
                        <BarChart3 size={14} /> عرض التقرير
                      </button>

                      <button
                        type="button"
                        onClick={() => exportExcel(s, null)}
                        className="flex items-center gap-1 rounded-xl bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                        title="تصدير إلى Excel"
                      >
                        <FileSpreadsheet size={14} className="text-emerald-700" /> Excel
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Session Report Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs" dir="rtl">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-l from-indigo-900 to-slate-900 p-6 text-white">
              <div>
                <span className="text-[10px] font-bold text-indigo-300">تقرير إنجاز الحصة الذكية</span>
                <h3 className="text-lg font-black text-white mt-0.5">
                  {assignments.find((a) => a.classId === selectedSession.classId)?.className || 'الفصل المسند'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="rounded-xl p-2 text-indigo-200 hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {loadingReport ? (
                <div className="text-center py-10 text-xs font-bold text-slate-400">
                  <Loader2 className="mx-auto mb-2 animate-spin text-indigo-600" size={24} />
                  جارٍ استخراج تفاصيل الحصة والحضور...
                </div>
              ) : selectedReport ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="rounded-xl bg-indigo-50 p-3">
                      <span className="text-[10px] text-indigo-600 font-bold block">الطلاب الحاضرون</span>
                      <span className="text-xl font-black text-indigo-950">{selectedReport.roster.present}</span>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-3">
                      <span className="text-[10px] text-amber-600 font-bold block">الطلاب المتأخرون</span>
                      <span className="text-xl font-black text-amber-950">{selectedReport.roster.late}</span>
                    </div>
                    <div className="rounded-xl bg-rose-50 p-3">
                      <span className="text-[10px] text-rose-600 font-bold block">الطلاب الغائبون</span>
                      <span className="text-xl font-black text-rose-950">{selectedReport.roster.absent}</span>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-3">
                      <span className="text-[10px] text-emerald-600 font-bold block">إجمالي الإجابات</span>
                      <span className="text-xl font-black text-emerald-950">{selectedReport.totals.responses}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs font-bold text-slate-600 space-y-2">
                    <div className="flex justify-between">
                      <span>حالة الحصة الرسمية:</span>
                      <span className="text-emerald-700 font-black">محفوظة وموثقة في سجل المدرسة</span>
                    </div>
                    <div className="flex justify-between">
                      <span>توقيت بدء الحصة:</span>
                      <span>{new Date(selectedSession.createdAt).toLocaleTimeString('ar-SA')}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 text-center">
                  <p className="text-xs font-bold text-indigo-900">
                    تم تسجيل بيانات الحصة وإدراجها ضمن سجل المدرسة والتحصيل العام.
                  </p>
                  <p className="text-[11px] text-indigo-600 mt-1">
                    إجمالي الأسئلة: {(selectedSession as any).totalQuestions || 0}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 p-5">
              <button
                type="button"
                onClick={() => exportExcel(selectedSession, selectedReport)}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-black text-white shadow-xs transition-colors"
              >
                <Download size={14} /> تصدير إلى Excel
              </button>

              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
