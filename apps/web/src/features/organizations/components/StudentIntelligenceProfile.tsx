import React, { useMemo, useEffect } from 'react';
import {
  Activity, Award, BookOpen, TrendingDown,
  TrendingUp, Users, Zap, BarChart3, Target,
  CheckCircle2, AlertTriangle, XCircle, ArrowLeft, FileText, ExternalLink,
} from 'lucide-react';

export interface StudentSummary {
  id: string;
  name: string;
  email: string;
  className: string;
  schoolName: string;
  gradeName: string;
  average: number;
  attempts: number;
  latestScore: number | null;
  previousScore: number | null;
  latestQuiz: string;
  weakSkills: string[];
  followUpReason: string;
  status: 'danger' | 'watch' | 'good' | string;
  resultsList: Array<{
    score: number;
    quizTitle: string;
    date: string;
    skillsAnalysis?: Array<{ skill: string; skillId?: string; mastery: number }>;
  }>;
}

export interface StudentIntelligenceProfileProps {
  student: StudentSummary;
  classAverage: number;
  classTotalStudents: number;
  completedLessons?: string[];
  onClose: () => void;
  onSendAlert: () => void;
  onAssignTest: () => void;
  onOpenReport?: (id: string) => void;
}

const MasteryBar: React.FC<{ skill: string; mastery: number }> = ({ skill, mastery }) => {
  const color = mastery >= 75 ? 'bg-emerald-500' : mastery >= 55 ? 'bg-amber-400' : 'bg-rose-500';
  const label = mastery >= 75 ? 'قوي' : mastery >= 55 ? 'متوسط' : 'ضعيف';
  const labelColor = mastery >= 75 ? 'text-emerald-700' : mastery >= 55 ? 'text-amber-700' : 'text-rose-700';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-gray-700 truncate max-w-[160px]">{skill}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`font-black text-xs ${labelColor}`}>{label}</span>
          <span className="font-black text-gray-900 w-8 text-left">{mastery}%</span>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(mastery, 100)}%` }} />
      </div>
    </div>
  );
};

const ScoreChip: React.FC<{ score: number; label: string }> = ({ score, label }) => {
  const color = score >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : score >= 60 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-rose-50 text-rose-700 border-rose-200';
  return (
    <div className={`rounded-2xl border px-4 py-3 text-center ${color}`}>
      <div className="text-2xl font-black">{score}%</div>
      <div className="text-xs font-bold opacity-80 mt-0.5">{label}</div>
    </div>
  );
};

export const StudentIntelligenceProfile: React.FC<StudentIntelligenceProfileProps> = ({
  student, classAverage, classTotalStudents, completedLessons = [],
  onClose, onSendAlert, onAssignTest, onOpenReport,
}) => {
  const aggregatedSkills = useMemo(() => {
    const map = new Map<string, { skill: string; total: number; count: number }>();
    student.resultsList.forEach((r) => {
      (r.skillsAnalysis || []).forEach((sk) => {
        const key = sk.skillId || String(sk.skill).trim();
        if (!key) return;
        const cur = map.get(key) || { skill: String(sk.skill).trim(), total: 0, count: 0 };
        cur.total += Number(sk.mastery || 0);
        cur.count += 1;
        map.set(key, cur);
      });
    });
    return Array.from(map.values())
      .map((s) => ({ skill: s.skill, mastery: s.count ? Math.round(s.total / s.count) : 0 }))
      .sort((a, b) => a.mastery - b.mastery);
  }, [student.resultsList]);

  const weakSkillsAgg = aggregatedSkills.filter((s) => s.mastery < 60).slice(0, 5);
  const strongSkillsAgg = aggregatedSkills.filter((s) => s.mastery >= 75).slice(-3);

  const trend = student.latestScore !== null && student.previousScore !== null
    ? student.latestScore - student.previousScore : null;
  const trendLabel = trend === null ? null : trend > 0 ? `↑ +${trend}%` : trend < 0 ? `↓ ${trend}%` : 'ثابت';
  const trendColor = trend === null ? '' : trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-rose-600' : 'text-gray-500';

  const vsClass = student.average - classAverage;
  const vsLabel = vsClass > 0 ? `+${vsClass}% فوق متوسط الفصل` : vsClass < 0 ? `${vsClass}% دون متوسط الفصل` : 'مساوٍ لمتوسط الفصل';
  const vsColor = vsClass > 0 ? 'text-emerald-600' : vsClass < 0 ? 'text-rose-600' : 'text-gray-500';

  const recentResults = student.resultsList.slice(0, 5);

  const statusConfig: Record<string, { icon: React.ReactNode; label: string; bg: string }> = {
    danger: { icon: <XCircle size={16} />, label: 'يحتاج تدخلاً عاجلاً', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
    watch:  { icon: <AlertTriangle size={16} />, label: 'تحت المراقبة', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
    good:   { icon: <CheckCircle2 size={16} />, label: 'مستوى جيد', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  };
  const sc = statusConfig[student.status] || statusConfig.good;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex items-start justify-end p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
        <div className="relative bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 px-6 py-5 text-white">
          <button
            onClick={onClose}
            aria-label="إغلاق الملف الذكي"
            className="absolute left-4 top-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl font-black">
              {student.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black truncate">{student.name}</h2>
              <p className="text-white/80 text-sm mt-0.5">{student.className} • {student.schoolName}</p>
              <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${sc.bg}`}>
                {sc.icon} {sc.label}
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto max-h-[calc(100vh-200px)]">
          <div className="grid grid-cols-3 gap-3">
            <ScoreChip score={student.average} label="المتوسط العام" />
            <ScoreChip score={classAverage} label="متوسط الفصل" />
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-center">
              <div className={`text-2xl font-black ${trendColor}`}>{trendLabel ?? '—'}</div>
              <div className="text-xs font-bold text-gray-500 mt-0.5">آخر تطور</div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
            <Users size={18} className="text-slate-500 shrink-0" />
            <div className="text-sm">
              <span className="font-bold text-gray-700">مقارنة بالفصل ({classTotalStudents} طالب): </span>
              <span className={`font-black ${vsColor}`}>{vsLabel}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-black text-blue-800 mb-3 flex items-center gap-2">
              <BookOpen size={14} /> نشاط الطالب على المنصة
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white border border-blue-100 p-2.5">
                <div className="text-lg font-black text-blue-800">{student.attempts}</div>
                <div className="text-[11px] text-blue-600 font-bold">اختبار ذاتي</div>
              </div>
              <div className="rounded-xl bg-white border border-blue-100 p-2.5">
                <div className="text-lg font-black text-blue-800">{completedLessons.length}</div>
                <div className="text-[11px] text-blue-600 font-bold">درس مكتمل</div>
              </div>
              <div className="rounded-xl bg-white border border-blue-100 p-2.5">
                <div className="text-lg font-black text-blue-800">{student.latestQuiz !== 'لم يبدأ بعد' ? 'نشط' : 'غير نشط'}</div>
                <div className="text-[11px] text-blue-600 font-bold">الحالة</div>
              </div>
            </div>
          </div>

          {aggregatedSkills.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                <Target size={16} className="text-violet-500" /> خريطة المهارات
              </h3>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                {aggregatedSkills.slice(0, 8).map((sk) => (
                  <MasteryBar key={sk.skill} skill={sk.skill} mastery={sk.mastery} />
                ))}
              </div>
            </div>
          )}

          {(weakSkillsAgg.length > 0 || strongSkillsAgg.length > 0) && (
            <div className="space-y-2">
              <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                <Zap size={16} className="text-amber-500" /> التوصيات
              </h3>
              {weakSkillsAgg.map((sk) => (
                <div key={sk.skill} className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2.5 text-xs text-rose-800">
                  <TrendingDown size={13} className="shrink-0 mt-0.5" />
                  <span><strong>{sk.skill}</strong> ({sk.mastery}%) — يحتاج تدريباً إضافياً</span>
                </div>
              ))}
              {strongSkillsAgg.map((sk) => (
                <div key={sk.skill} className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-xs text-emerald-800">
                  <TrendingUp size={13} className="shrink-0 mt-0.5" />
                  <span><strong>{sk.skill}</strong> ({sk.mastery}%) — متقدم، جاهز لمستوى أعلى</span>
                </div>
              ))}
            </div>
          )}

          {recentResults.length > 0 && (
            <div>
              <h3 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
                <BarChart3 size={16} className="text-indigo-500" /> آخر الاختبارات
              </h3>
              <div className="space-y-2">
                {recentResults.map((r, i) => {
                  const sc = Number(r.score || 0);
                  const scColor = sc >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : sc >= 60 ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-rose-700 bg-rose-50 border-rose-200';
                  return (
                    <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 truncate">{r.quizTitle}</p>
                        <p className="text-xs text-gray-400">{r.date}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${scColor}`}>{sc}%</span>
                        {onOpenReport && (
                          <button
                            onClick={() => onOpenReport(student.id)}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                            title="عرض تقرير الاختبار"
                          >
                            <ExternalLink size={11} />
                            تقرير
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-3 border-t border-gray-100">
            {onOpenReport && (
              <button
                onClick={() => onOpenReport(student.id)}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3 text-xs font-black text-gray-700 hover:bg-gray-100 transition-colors shadow-xs"
              >
                <FileText size={15} /> التقرير الشامل
              </button>
            )}
            <button
              onClick={onSendAlert}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs font-black text-amber-800 hover:bg-amber-100 transition-colors shadow-xs"
            >
              <Activity size={15} /> إرسال تنبيه
            </button>
            <button
              onClick={onAssignTest}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-black text-white hover:bg-indigo-700 transition-colors shadow-xs"
            >
              <Award size={15} /> توجيه اختبار
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
