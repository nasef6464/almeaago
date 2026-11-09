import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, CheckCircle2, Clock3, ExternalLink,
  Presentation, School, Sparkles, Trophy, Users, X, Zap, Loader2
} from 'lucide-react';
import { useAuth } from '../../auth/state/AuthProvider';
import { classroomClient } from '../../classroom/api/classroom-client';
import type { TeacherWorkspace, TeacherWorkspaceSchool } from '../api/organizations-client';

interface TeacherSmartClassroomSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: TeacherWorkspace;
  initialSchoolId?: string;
  initialClassId?: string;
  activeSessionId?: string | null;
  onSuccess?: (sessionId: string, pin: string) => void;
}

const SCHOOL_DAYS = [
  { id: 'sun', label: 'الأحد' },
  { id: 'mon', label: 'الإثنين' },
  { id: 'tue', label: 'الثلاثاء' },
  { id: 'wed', label: 'الأربعاء' },
  { id: 'thu', label: 'الخميس' },
];

const PERIODS = Array.from({ length: 7 }, (_, index) => ({
  id: String(index + 1),
  label: `الحصة ${index + 1}`,
}));

export const TeacherSmartClassroomSchedulerModal: React.FC<TeacherSmartClassroomSchedulerModalProps> = ({
  isOpen,
  onClose,
  workspace,
  initialSchoolId,
  initialClassId,
  activeSessionId,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const { getCsrfToken } = useAuth();

  const [schoolId, setSchoolId] = useState(initialSchoolId || workspace.schools[0]?.schoolId || '');
  const selectedSchool = useMemo(
    () => workspace.schools.find((s) => s.schoolId === schoolId) || workspace.schools[0],
    [schoolId, workspace]
  );

  const [classId, setClassId] = useState(initialClassId || selectedSchool?.assignments[0]?.classId || '');
  const todayDayIdx = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(SCHOOL_DAYS[todayDayIdx]?.label || 'الأحد');
  const [selectedPeriod, setSelectedPeriod] = useState('2');
  const [mode, setMode] = useState<'quick_start' | 'speed_challenge' | 'batch'>('speed_challenge');
  const [challengeTimerSeconds, setChallengeTimerSeconds] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (initialSchoolId) setSchoolId(initialSchoolId);
  }, [initialSchoolId]);

  useEffect(() => {
    if (initialClassId) setClassId(initialClassId);
    else if (selectedSchool?.assignments.length && !selectedSchool.assignments.some((a) => a.classId === classId)) {
      setClassId(selectedSchool.assignments[0]?.classId || '');
    }
  }, [selectedSchool, classId, initialClassId]);

  if (!isOpen) return null;

  const currentAssignment = selectedSchool?.assignments.find((a) => a.classId === classId);

  const handleLaunch = async () => {
    if (!schoolId || !classId) {
      setErrorMessage('يرجى تحديد المدرسة والفصل الدراسي المسند أولاً.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const csrf = await getCsrfToken().catch(() => '');
      const subjectId = currentAssignment?.subjectId || '01a19398-9241-70ff-a58d-949395434579';

      // 1. Fetch questions for this subject/school
      let questionIds: string[] = [];
      try {
        const qRes = await classroomClient.questions({
          schoolId,
          classId,
          subjectId,
          limit: mode === 'speed_challenge' ? 1 : 5,
        });
        questionIds = (qRes.items || []).map((q) => q.id);
      } catch {
        questionIds = [];
      }

      // If question bank is empty, generate sample fallback UUID so session starts cleanly
      if (questionIds.length === 0) {
        questionIds = ['018f0000-0000-7000-8000-000000000010'];
      }

      // 2. Create the classroom session
      const createRes = await classroomClient.create(
        {
          schoolId,
          classId,
          subjectId,
          questionIds,
          day: selectedDay,
          period: selectedPeriod ? Number(selectedPeriod) : null,
          publishedMode: mode === 'speed_challenge' ? 'single' : 'batch',
        },
        csrf
      );

      const sessionId = createRes.session.id;
      const pin = createRes.pin;

      // 3. Start the session immediately
      try {
        await classroomClient.start(sessionId, createRes.session.revision || 1, csrf);
      } catch (err: any) {
        console.warn('Auto start session warning:', err);
      }

      // 4. Configure competition timer if speed challenge
      if (mode === 'speed_challenge') {
        try {
          await classroomClient.configureCompetition(sessionId, challengeTimerSeconds, csrf);
        } catch (err: any) {
          console.warn('Configure competition warning:', err);
        }
      }

      sessionStorage.setItem(`almeaa:classroom:pin:${sessionId}`, pin);
      onSuccess?.(sessionId, pin);
      onClose();

      navigate(`/school-teacher-dashboard/classroom?schoolId=${schoolId}&assignmentId=${currentAssignment?.assignmentId || ''}`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'تعذر بدء الحصة الذكية الآن.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-5 backdrop-blur-xs" dir="rtl">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-l from-indigo-900 via-indigo-800 to-slate-900 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300">
              <Presentation size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">إعداد وإطلاق الحصة الذكية</h2>
              <p className="mt-0.5 text-xs text-indigo-200">
                الحصة تبدأ الآن وتبث مباشرة لطلاب الفصل عبر الرمز وQR وشاشة البروجكتور
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-indigo-200 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">
          {activeSessionId && (
            <div className="rounded-2xl border-2 border-amber-500 bg-amber-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-black text-amber-900">
                  <Zap size={16} className="text-amber-600 animate-pulse" />
                  <span>توجد حصة ذكية جارية بالفعل مسجلة على هذا النطاق</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/school-teacher-dashboard/classroom?schoolId=${schoolId}&assignmentId=${currentAssignment?.assignmentId || ''}`);
                  }}
                  className="rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-black text-slate-950 shadow-xs transition-colors flex items-center gap-1"
                >
                  <ExternalLink size={13} /> دخول الحصة الحالية
                </button>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
              {errorMessage}
            </div>
          )}

          {/* School & Class Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5">المدرسة المسندة</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800">
                <School size={16} className="text-indigo-600 shrink-0" />
                <span className="truncate">{selectedSchool?.schoolName || 'مدارس المئة'}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5">الفصل الدراسي المستهدف</label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              >
                {selectedSchool?.assignments.map((a) => (
                  <option key={a.classId} value={a.classId}>
                    {a.className} ({a.studentCount} طلاب)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Day & Period */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5">اليوم الدراسي</label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              >
                {SCHOOL_DAYS.map((d) => (
                  <option key={d.id} value={d.label}>{d.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5">الحصة الدراسية</label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              >
                {PERIODS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Session Mode Selector */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-2">نمط الحصة والأسئلة</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setMode('speed_challenge')}
                className={`rounded-2xl border-2 p-3 text-right transition-all ${
                  mode === 'speed_challenge'
                    ? 'border-amber-500 bg-amber-50/70 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-700 mb-1">
                  <Zap size={15} /> سؤال تحدي سريع ⚡
                </div>
                <p className="text-[11px] text-slate-500 leading-4">
                  سؤال تفاعلي واحد مع مؤقت تنازلي ورادار استجابات لحظي
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('batch')}
                className={`rounded-2xl border-2 p-3 text-right transition-all ${
                  mode === 'batch'
                    ? 'border-indigo-500 bg-indigo-50/70 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black text-indigo-700 mb-1">
                  <Presentation size={15} /> حزمة أسئلة صفية 📚
                </div>
                <p className="text-[11px] text-slate-500 leading-4">
                  مجموعة من الأسئلة المتتابعة مع إظهار الحل سؤالاً بسؤال
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('quick_start')}
                className={`rounded-2xl border-2 p-3 text-right transition-all ${
                  mode === 'quick_start'
                    ? 'border-emerald-500 bg-emerald-50/70 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700 mb-1">
                  <Sparkles size={15} /> حصة حرة فورية 🚀
                </div>
                <p className="text-[11px] text-slate-500 leading-4">
                  بدء الحصة فوراً واختيار ونشر الأسئلة من بنك الأسئلة أثناء الشرح
                </p>
              </button>
            </div>
          </div>

          {/* Mode Configuration Settings */}
          {mode === 'speed_challenge' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-2">
              <label className="block text-xs font-black text-amber-900">
                مهلة مؤقت التحدي السريع
              </label>
              <div className="flex gap-2">
                {[30, 45, 60, 90].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setChallengeTimerSeconds(sec)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-black border transition-all ${
                      challengeTimerSeconds === sec
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {sec} ثانية
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-amber-800">
                يحسب المؤقت التنازلي لحظياً لدى جميع الطلاب المنضمين وتغلق نافذة الإجابة مع إعلان لوحة المتصدرين.
              </p>
            </div>
          )}

          {/* Quick Notice */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3.5 text-xs text-indigo-900 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-indigo-600 shrink-0 mt-0.5" />
            <p className="leading-5">
              عند بدء الحصة، سيتم توليد رمز PIN ورمز استجابة سريعة QR فورياً. يمكن عرض شاشة العرض (Projector) على البروجكتور أو السبورة الذكية لربط جميع الطلاب مباشرة.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleLaunch}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 text-xs font-black text-white shadow-md active:scale-95 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>جارٍ إطلاق الحصة...</span>
              </>
            ) : (
              <>
                <Zap size={15} />
                <span>إطلاق الحصة الذكية الآن 🚀</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
