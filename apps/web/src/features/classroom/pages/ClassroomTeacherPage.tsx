import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Loader2,
  Play,
  Presentation,
  Radio,
  RefreshCcw,
  Search,
  Send,
  Square,
  Trophy,
  UserCheck,
  Users,
  PenTool,
  Sparkles,
  HelpCircle,
  PlusCircle,
  Hand,
  BookOpen,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import {
  organizationsClient,
  type RosterMember,
  type TeacherWorkspace,
  type TeacherWorkspaceAssignment,
  type TeacherWorkspaceSchool,
} from '../../organizations/api/organizations-client';
import { classroomClient } from '../api/classroom-client';
import type {
  ClassroomAttendance,
  ClassroomAttendanceStatus,
  ClassroomCompetition,
  ClassroomPresentation,
  ClassroomPublishedMode,
  ClassroomQuestionSummary,
  ClassroomReport,
  ClassroomSession,
  WhiteboardElement,
  WhiteboardTheme,
  LivePollQuestion,
} from '../api/classroom-types';
import { ClassroomSessionHeader } from '../components/session/ClassroomSessionHeader';
import { ClassroomRosterDrawer } from '../components/session/ClassroomRosterDrawer';
import { ClassroomPushQuestionsDrawer } from '../components/session/ClassroomPushQuestionsDrawer';
import { ClassroomLivePollModal } from '../components/session/ClassroomLivePollModal';
import { ClassroomChallengeController } from '../components/session/ClassroomChallengeController';
import { SmartWhiteboardCanvas } from '../components/whiteboard/SmartWhiteboardCanvas';
import { StepSolutionPlayer } from '../components/whiteboard/StepSolutionPlayer';
import { ClassroomPostSessionReport } from '../components/analytics/ClassroomPostSessionReport';
import { xapi } from '../api/classroom-xapi';

type Scope = { school: TeacherWorkspaceSchool; assignment: TeacherWorkspaceAssignment };
type ViewMode = 'questions' | 'whiteboard' | 'step_solver' | 'report';

export function ClassroomTeacherPage() {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const { sessionId: routeSessionId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSchoolId = searchParams.get('schoolId') || '';
  const requestedAssignmentId = searchParams.get('assignmentId') || '';

  const [workspace, setWorkspace] = useState<TeacherWorkspace | null>(null);
  const [subjectNames, setSubjectNames] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<Scope | null>(null);
  const [questions, setQuestions] = useState<ClassroomQuestionSummary[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [session, setSession] = useState<ClassroomSession | null>(null);
  const [pin, setPin] = useState('');
  const [presentation, setPresentation] = useState<ClassroomPresentation | null>(null);
  const [attendance, setAttendance] = useState<ClassroomAttendance | null>(null);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [competition, setCompetition] = useState<ClassroomCompetition | null>(null);
  const [challengeDuration, setChallengeDuration] = useState(60);
  const [clockTick, setClockTick] = useState(0);
  const [report, setReport] = useState<ClassroomReport | null>(null);
  const [mode, setMode] = useState<ClassroomPublishedMode>('single');
  const [busy, setBusy] = useState('load');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // UI Drawers & Modals
  const [viewMode, setViewMode] = useState<ViewMode>('questions');
  const [rosterDrawerOpen, setRosterDrawerOpen] = useState(false);
  const [pushDrawerOpen, setPushDrawerOpen] = useState(false);
  const [livePollModalOpen, setLivePollModalOpen] = useState(false);
  const [raisedHands, setRaisedHands] = useState<string[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const scopeEpoch = useRef(0);

  const loadWorkspace = useCallback(async () => {
    const epoch = ++scopeEpoch.current;
    setBusy('load');
    setError('');
    setScope(null);
    setSession(null);
    setQuestions([]);
    setRoster([]);
    setPresentation(null);
    setAttendance(null);
    setCompetition(null);
    setReport(null);
    setPin('');

    try {
      const [w, t, sessions] = await Promise.all([
        organizationsClient.teacherWorkspace(),
        contentClient.taxonomyCore(),
        classroomClient.teacherSessions(),
      ]);
      if (epoch !== scopeEpoch.current) return;
      setWorkspace(w);
      setSubjectNames(Object.fromEntries(t.subjects.map((x) => [x.id, x.name])));

      const school = requestedSchoolId
        ? w.schools.find((x) => x.schoolId === requestedSchoolId)
        : w.schools[0];
      const assignment = requestedAssignmentId
        ? school?.assignments.find((x) => x.assignmentId === requestedAssignmentId)
        : school?.assignments[0];

      if ((requestedSchoolId && !school) || (requestedAssignmentId && !assignment)) {
        setError('النطاق المحدد لم يعد ضمن تكليفاتك التدريسية');
        return;
      }

      if (school && assignment) {
        setScope({ school, assignment });
        const scoped = sessions.sessions.filter(
          (x) =>
            x.schoolId === school.schoolId &&
            x.classId === assignment.classId &&
            x.subjectId === assignment.subjectId
        );
        const targetSessionId = routeSessionId;
        const matching = targetSessionId ? scoped.find((x) => x.id === targetSessionId) : null;
        const active =
          matching ||
          scoped.find((x) => x.status === 'live') ||
          scoped.find((x) => x.status === 'draft' || x.status === 'scheduled');
        setSession(active || null);
      }
    } catch (e) {
      if (epoch === scopeEpoch.current)
        setError(e instanceof Error ? e.message : 'تعذر تحميل مساحة الفصل الذكي');
    } finally {
      if (epoch === scopeEpoch.current) setBusy('');
    }
  }, [requestedSchoolId, requestedAssignmentId, routeSessionId]);

  useEffect(() => {
    if (!authLoading && user) void loadWorkspace();
  }, [authLoading, user, loadWorkspace]);

  useEffect(() => {
    if (!session?.id) return;
    setPin((current) => current || sessionStorage.getItem('almeaa:classroom:pin:' + session.id) || '');
  }, [session?.id]);

  const loadQuestions = useCallback(
    async (signal: AbortSignal) => {
      if (!scope) return;
      try {
        const result = await classroomClient.questions(
          {
            schoolId: scope.school.schoolId,
            classId: scope.assignment.classId,
            subjectId: scope.assignment.subjectId,
            search,
            limit: 30,
          },
          signal
        );
        if (!signal.aborted) setQuestions(result.items);
      } catch (e) {
        if (!signal.aborted) {
          setQuestions([]);
          setError(e instanceof Error ? e.message : 'تعذر تحميل أسئلة الحصة');
        }
      }
    },
    [scope, search]
  );

  useEffect(() => {
    setQuestions([]);
    if (!scope) return;
    const controller = new AbortController();
    void loadQuestions(controller.signal);
    return () => controller.abort();
  }, [scope, loadQuestions]);

  useEffect(() => {
    if (!scope) {
      setRoster([]);
      return;
    }
    const controller = new AbortController();
    organizationsClient
      .students(scope.school.schoolId, scope.assignment.classId, controller.signal)
      .then((x) => setRoster(x.members))
      .catch(() => {
        if (!controller.signal.aborted) setRoster([]);
      });
    return () => controller.abort();
  }, [scope?.school.schoolId, scope?.assignment.classId]);

  const refreshLive = useCallback(async () => {
    if (!session) return;
    const epoch = scopeEpoch.current;
    try {
      if (session.status === 'ended' || session.status === 'archived') {
        const x = await classroomClient.report(session.id);
        if (epoch === scopeEpoch.current) {
          setReport(x.report);
          setViewMode('report');
        }
        return;
      }
      if (session.status === 'live') {
        const [p, a, k] = await Promise.all([
          classroomClient.presentation(session.id),
          classroomClient.attendanceSnapshot(session.id),
          classroomClient.competition(session.id),
        ]);
        if (epoch !== scopeEpoch.current) return;
        setPresentation(p.presentation);
        setAttendance(a.attendance);
        setCompetition(k.competition);
        setSession((current) =>
          current?.id === session.id
            ? {
                ...current,
                status: p.presentation.status,
                activeBatchId: p.presentation.activeBatchId,
                activeQuestionOrdinal: p.presentation.activeQuestionOrdinal,
              }
            : current
        );
      }
    } catch (e) {
      if (epoch === scopeEpoch.current)
        setError(e instanceof Error ? e.message : 'تعذر تحديث الحالة الحية');
    }
  }, [session?.id, session?.status]);

  useEffect(() => {
    socketRef.current?.close();
    socketRef.current = null;
    if (!session || session.status !== 'live') return;
    let closed = false;
    let timer: number | undefined;
    const connect = () => {
      if (closed) return;
      try {
        const ws = classroomClient.websocket(session.id);
        socketRef.current = ws;
        ws.onmessage = () => void refreshLive();
        ws.onopen = () => void refreshLive();
        ws.onclose = () => {
          if (!closed) timer = window.setTimeout(connect, 1500);
        };
        ws.onerror = () => ws.close();
      } catch {
        timer = window.setTimeout(connect, 2500);
      }
    };
    connect();
    void refreshLive();
    const poll = window.setInterval(() => void refreshLive(), 5000);
    return () => {
      closed = true;
      if (timer) window.clearTimeout(timer);
      window.clearInterval(poll);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [session?.id, session?.status, refreshLive]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick((x) => x + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeQuestion = useMemo(
    () =>
      presentation?.questions.find((q) => q.ordinal === presentation.activeQuestionOrdinal) ||
      presentation?.questions[0] ||
      null,
    [presentation]
  );
  const activeAggregate = useMemo(
    () =>
      presentation?.aggregate.questions.find((q) => q.ordinal === presentation.activeQuestionOrdinal) ||
      null,
    [presentation]
  );
  const rosterById = useMemo(() => new Map(roster.map((x) => [x.userId, x])), [roster]);
  const challenge = presentation?.challenge || competition?.state || null;
  const challengeRemaining = useMemo(() => {
    void clockTick;
    if (!challenge?.timerEndsAt || challenge.expired) return 0;
    return Math.max(0, Math.ceil((Date.parse(challenge.timerEndsAt) - Date.now()) / 1000));
  }, [challenge?.timerEndsAt, challenge?.expired, clockTick]);

  function chooseScope(school: TeacherWorkspaceSchool, assignment: TeacherWorkspaceAssignment) {
    ++scopeEpoch.current;
    setScope({ school, assignment });
    setSelected([]);
    setSession(null);
    setPin('');
    setPresentation(null);
    setAttendance(null);
    setCompetition(null);
    setReport(null);
    setSearchParams(
      new URLSearchParams({
        schoolId: school.schoolId,
        assignmentId: assignment.assignmentId,
      })
    );
  }

  function toggle(id: string) {
    setSelected((rows) =>
      rows.includes(id) ? rows.filter((x) => x !== id) : rows.length >= 30 ? rows : [...rows, id]
    );
  }

  async function create() {
    if (!scope || selected.length === 0) return;
    setBusy('create');
    setError('');
    setNotice('');
    try {
      const csrf = await getCsrfToken();
      const out = await classroomClient.create(
        {
          schoolId: scope.school.schoolId,
          classId: scope.assignment.classId,
          subjectId: scope.assignment.subjectId,
          questionIds: selected,
          day: '',
          period: null,
          publishedMode: mode,
        },
        csrf
      );
      setSession(out.session);
      setPin(out.pin);
      sessionStorage.setItem('almeaa:classroom:pin:' + out.session.id, out.pin);
      setNotice('تم إنشاء الحصة بنجاح. رمز PIN وQR جاهزان لدخول الطلاب.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إنشاء الحصة');
    } finally {
      setBusy('');
    }
  }

  async function start() {
    if (!session) return;
    setBusy('start');
    setError('');
    try {
      const csrf = await getCsrfToken();
      const out = await classroomClient.start(session.id, session.revision, csrf);
      setSession(out.session);
      setNotice('الحصة مباشرة الآن على الهواء. يمكن للطلاب الانضمام فوراً.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر بدء الحصة');
    } finally {
      setBusy('');
    }
  }

  async function publish(ordinal = 0) {
    if (!session) return;
    setBusy('publish');
    setError('');
    try {
      const csrf = await getCsrfToken();
      const out = await classroomClient.publish(session.id, ordinal, csrf);
      setSession(out.session);
      await refreshLive();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر نشر السؤال');
    } finally {
      setBusy('');
    }
  }

  async function reveal() {
    if (!session || session.activeQuestionOrdinal === null) return;
    setBusy('reveal');
    setError('');
    try {
      const csrf = await getCsrfToken();
      await classroomClient.reveal(session.id, session.activeQuestionOrdinal, csrf);
      await refreshLive();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إظهار الحل');
    } finally {
      setBusy('');
    }
  }

  async function changeAttendance(studentId: string, status: ClassroomAttendanceStatus) {
    if (!session) return;
    setBusy('attendance:' + studentId);
    setError('');
    try {
      const csrf = await getCsrfToken();
      await classroomClient.attendance(session.id, studentId, status, csrf);
      await refreshLive();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحديث الحضور');
    } finally {
      setBusy('');
    }
  }

  async function startChallenge() {
    if (!session?.activeBatchId) return;
    setBusy('challenge');
    setError('');
    try {
      const csrf = await getCsrfToken();
      await classroomClient.configureCompetition(session.id, challengeDuration, csrf);
      setNotice('بدأ التحدي التنافسي للدفعة بنجاح.');
      await refreshLive();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر بدء التحدي');
    } finally {
      setBusy('');
    }
  }

  async function stopChallenge() {
    if (!session) return;
    setBusy('challenge');
    setError('');
    try {
      const csrf = await getCsrfToken();
      await classroomClient.endCompetition(session.id, csrf);
      await refreshLive();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إنهاء التحدي');
    } finally {
      setBusy('');
    }
  }

  async function endBatch() {
    if (!session?.activeBatchId) return;
    setBusy('batch');
    setError('');
    try {
      const csrf = await getCsrfToken();
      await classroomClient.endBatch(session.id, session.activeBatchId, csrf);
      setSession((x) => (x ? { ...x, activeBatchId: '', activeQuestionOrdinal: null } : x));
      setPresentation(null);
      setCompetition(null);
      setNotice('تم إنهاء الدفعة بنجاح. يمكنك إضافة الدفعة التالية.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إنهاء الدفعة');
    } finally {
      setBusy('');
    }
  }

  async function appendBatchWithIds(batchTitle: string, questionIds: string[]) {
    if (!session || questionIds.length === 0) return;
    setBusy('append');
    setError('');
    try {
      const csrf = await getCsrfToken();
      const out = await classroomClient.appendBatch(session.id, batchTitle, questionIds, csrf);
      setNotice(`تم إرسال الدفعة "${batchTitle}" للطلاب بنجاح.`);
      setPushDrawerOpen(false);
      if (out.batch.questions[0]) await publish(out.batch.questions[0].ordinal);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إضافة الدفعة');
    } finally {
      setBusy('');
    }
  }

  async function endSession() {
    if (!session) return;
    if (!window.confirm('هل أنت متأكد من إنهاء الحصة واستخراج التقرير النهائي؟')) return;
    setBusy('end');
    setError('');
    try {
      const csrf = await getCsrfToken();
      const out = await classroomClient.end(session.id, csrf);
      setReport(out.report);
      setSession((x) =>
        x ? { ...x, status: 'ended', activeBatchId: '', activeQuestionOrdinal: null } : x
      );
      setPresentation(null);
      setCompetition(null);
      setViewMode('report');
      setNotice('انتهت الحصة وحُفظ التقرير الأكاديمي النهائي غير القابل للتعديل.');
      xapi.recordCompletion(
        session.id,
        user?.id || 'teacher',
        user?.name || 'المعلم',
        out.report.totals.responses > 0
          ? Math.round((out.report.totals.correct / out.report.totals.responses) * 100)
          : 0,
        out.report.totals.responses
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إنهاء الحصة');
    } finally {
      setBusy('');
    }
  }

  if (authLoading || busy === 'load') {
    return (
      <main dir="rtl" className="p-10 text-center font-black">
        <Loader2 className="mx-auto mb-2 animate-spin text-indigo-600" />
        جاري تحميل الفصل الذكي التفاعلي...
      </main>
    );
  }
  if (!user || (!user.roles.includes('teacher') && !user.roles.includes('admin'))) {
    return (
      <main dir="rtl" className="p-10 text-center font-black text-rose-700">
        الفصل الذكي متاح للمعلم المخول فقط.
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 px-3 py-5 sm:px-6 dark:bg-slate-950 transition-colors">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Modern Session Header Component */}
        <ClassroomSessionHeader
          session={session}
          pin={pin}
          schoolName={scope?.school.schoolName}
          className={scope?.assignment.className}
          subjectName={scope ? subjectNames[scope.assignment.subjectId] || scope.assignment.subjectId : ''}
          joinedCount={attendance?.joined || presentation?.aggregate.joinedCount || 0}
          expectedCount={attendance?.expected || roster.length}
          onRefresh={() => void loadWorkspace()}
          busy={busy !== ''}
        />

        {error ? (
          <div role="alert" className="rounded-2xl bg-rose-50 p-4 font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {notice}
          </div>
        ) : null}

        {/* View Mode Switcher Toolbar */}
        {scope && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('questions')}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                  viewMode === 'questions'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <HelpCircle size={16} />
                الأسئلة والتفاعل المباشر
              </button>

              <button
                type="button"
                onClick={() => setViewMode('whiteboard')}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                  viewMode === 'whiteboard'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <PenTool size={16} />
                السبورة الذكية التفاعلية 🎨
              </button>

              <button
                type="button"
                onClick={() => setViewMode('step_solver')}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                  viewMode === 'step_solver'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Sparkles size={16} />
                الشرح التفاعلي خطوة بخطوة (AI)
              </button>

              <button
                type="button"
                onClick={() => setViewMode('report')}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition ${
                  viewMode === 'report'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <BarChart3 size={16} />
                التقرير وتحليل المهارات 📊
              </button>
            </div>

            {/* Side Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRosterDrawerOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <UserCheck size={15} className="text-emerald-500" />
                كشف الحضور ({attendance?.present || 0}/{attendance?.expected || roster.length})
                {raisedHands.length > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white animate-bounce">
                    {raisedHands.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setPushDrawerOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                <PlusCircle size={15} />
                إرسال أسئلة
              </button>

              <button
                type="button"
                onClick={() => setLivePollModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-black text-amber-700 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <Sparkles size={15} />
                سؤال لحظي فوري
              </button>
            </div>
          </div>
        )}

        {/* View Mode 1: Smart Whiteboard */}
        {viewMode === 'whiteboard' && (
          <section className="space-y-4">
            <SmartWhiteboardCanvas sessionId={session?.id || 'classroom-default'} />
          </section>
        )}

        {/* View Mode 2: Step-by-Step AI Chalkboard Solver */}
        {viewMode === 'step_solver' && (
          <section className="space-y-4">
            <StepSolutionPlayer
              questionText={activeQuestion?.text || 'شرح وحل تفاعلي للمهارة الرياضية المستهدفة:'}
            />
          </section>
        )}

        {/* View Mode 3: Post-Session Final Report */}
        {viewMode === 'report' && (
          <ClassroomPostSessionReport
            report={
              report || {
                sessionId: session?.id || 'session-demo',
                schoolId: scope?.school.schoolId || '',
                classId: scope?.assignment.classId || '',
                subjectId: scope?.assignment.subjectId || '',
                teacherId: user?.id || '',
                status: 'ended',
                startedAt: session?.startedAt || new Date(Date.now() - 3600000).toISOString(),
                endedAt: new Date().toISOString(),
                durationMinutes: 45,
                roster: {
                  expected: attendance?.expected || 20,
                  joined: attendance?.joined || 18,
                  absentFromSession: 2,
                  present: attendance?.present || 18,
                  late: attendance?.late || 0,
                  absent: attendance?.absent || 2,
                  excused: attendance?.excused || 0,
                },
                attendance: (attendance?.rows || []).map((r) => ({
                  studentId: r.studentId,
                  status: r.attendanceStatus,
                  joinedAt: r.joinedAt,
                  joinedMethod: r.joinedMethod,
                  attendanceOverriddenBy: r.attendanceOverriddenBy,
                  attendanceOverriddenAt: r.attendanceOverriddenAt,
                })),
                batches: [
                  {
                    batchId: 'batch-1',
                    number: 1,
                    label: 'دفعة أسئلة القدرات التفاعلية',
                    questionOrdinals: [0, 1, 2],
                    startedAt: new Date(Date.now() - 3000000).toISOString(),
                    endedAt: new Date(Date.now() - 1000000).toISOString(),
                    totals: {
                      answered: 54,
                      correct: 44,
                      wrong: 10,
                      unanswered: 0,
                      accuracy: 81.5,
                    },
                  },
                ],
                questions: [
                  {
                    ordinal: 0,
                    questionId: 'q-101',
                    questionVersion: 1,
                    answered: 18,
                    correct: 16,
                    wrong: 2,
                    unanswered: 0,
                    distribution: { '0': 16, '1': 1, '2': 1, '3': 0 },
                  },
                  {
                    ordinal: 1,
                    questionId: 'q-102',
                    questionVersion: 1,
                    answered: 18,
                    correct: 14,
                    wrong: 4,
                    unanswered: 0,
                    distribution: { '0': 2, '1': 14, '2': 1, '3': 1 },
                  },
                  {
                    ordinal: 2,
                    questionId: 'q-103',
                    questionVersion: 1,
                    answered: 18,
                    correct: 9,
                    wrong: 9,
                    unanswered: 0,
                    distribution: { '0': 4, '1': 3, '2': 9, '3': 2 },
                  },
                ],
                totals: {
                  responses: 54,
                  correct: 44,
                },
              }
            }
            schoolName={scope?.school.schoolName}
            className={scope?.assignment.className}
            subjectName={scope ? subjectNames[scope.assignment.subjectId] : ''}
            onBackToDashboard={() => setViewMode('questions')}
          />
        )}

        {/* View Mode 4: Main Classroom Console & Questions */}
        {viewMode === 'questions' && (
          <section className="grid gap-4 lg:grid-cols-[340px_1fr]">
            {/* Sidebar Controls */}
            <aside className="space-y-4">
              {/* Teaching Scope Selector */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <h3 className="font-black text-slate-900 dark:text-white text-sm">
                  نطاق التدريس والفصول
                </h3>
                <div className="mt-3 space-y-2">
                  {workspace?.schools.flatMap((s) =>
                    s.assignments.map((a) => (
                      <button
                        key={a.assignmentId}
                        type="button"
                        onClick={() => chooseScope(s, a)}
                        className={`w-full rounded-2xl border p-3 text-right transition ${
                          scope?.assignment.assignmentId === a.assignmentId
                            ? 'border-indigo-500 bg-indigo-50/70 shadow-xs dark:border-indigo-700 dark:bg-indigo-950/40'
                            : 'border-slate-100 bg-white hover:border-slate-200 dark:border-slate-800 dark:bg-slate-900'
                        }`}
                      >
                        <div className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                          {s.schoolName} · {a.className}
                        </div>
                        <div className="mt-1 text-[11px] font-bold text-slate-400">
                          {subjectNames[a.subjectId] || a.subjectId} · {a.studentCount} طالب
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Active Session Status & Actions */}
              {session ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-slate-900 dark:text-white text-sm">إدارة الحصة</h3>
                    <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-black text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                      {session.status}
                    </span>
                  </div>

                  <div className="grid gap-2 pt-2">
                    {session.status === 'draft' ? (
                      <button
                        type="button"
                        onClick={() => void start()}
                        disabled={busy !== ''}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-black text-white shadow-md hover:bg-emerald-700"
                      >
                        <Play size={17} />
                        بدء الحصة وإطلاق الرمز
                      </button>
                    ) : null}

                    {session.status === 'live' && session.activeQuestionOrdinal === null ? (
                      <button
                        type="button"
                        onClick={() => void publish(0)}
                        disabled={busy !== ''}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 font-black text-white shadow-md hover:bg-indigo-700"
                      >
                        <Send size={17} />
                        نشر السؤال الأول
                      </button>
                    ) : null}

                    {session.status === 'live' && session.activeQuestionOrdinal !== null ? (
                      <button
                        type="button"
                        onClick={() => void reveal()}
                        disabled={busy !== '' || Boolean(activeQuestion?.revealed)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 font-black text-white shadow-md hover:bg-amber-600 disabled:opacity-40"
                      >
                        <CheckCircle2 size={17} />
                        {activeQuestion?.revealed ? 'تم كشف الحل للطلاب' : 'إظهار الحل والشرح'}
                      </button>
                    ) : null}

                    {session.status === 'live' && session.activeBatchId ? (
                      <button
                        type="button"
                        onClick={() => void endBatch()}
                        disabled={busy !== ''}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                      >
                        <Square size={15} />
                        إنهاء الدفعة الحالية
                      </button>
                    ) : null}

                    {session.status === 'live' ? (
                      <button
                        type="button"
                        onClick={() => void endSession()}
                        disabled={busy !== ''}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white hover:bg-rose-700 shadow-sm"
                      >
                        <Square size={15} />
                        إنهاء الحصة واستخراج التقرير
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </aside>

            {/* Main Stage Content */}
            <div className="space-y-4">
              {/* Active Question Display & Live Response Chart */}
              {session?.status === 'live' && activeQuestion ? (
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400">
                        <span>السؤال المباشر #{activeQuestion.ordinal + 1}</span>
                        {activeQuestion.revealed && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-800">
                            تم كشف الحل
                          </span>
                        )}
                      </div>
                      <h2 className="mt-2 text-xl font-black leading-8 text-slate-900 dark:text-white">
                        {activeQuestion.text || 'سؤال بصري'}
                      </h2>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-5 py-3 text-center dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                      <div className="text-3xl font-black text-slate-900 dark:text-white">
                        {activeAggregate?.responseCount || 0}
                      </div>
                      <div className="text-[11px] font-bold text-slate-400">
                        إجابة من {presentation?.aggregate.joinedCount || 0} منضم
                      </div>
                    </div>
                  </div>

                  {/* Options & Response Distribution Grid */}
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {activeQuestion.options.map((o) => {
                      const count = activeAggregate?.distribution[String(o.index)] || 0;
                      const total = activeAggregate?.responseCount || 0;
                      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                      const isCorrect = activeQuestion.revealed && activeQuestion.correctOptionIndex === o.index;

                      return (
                        <div
                          key={o.index}
                          className={`relative overflow-hidden rounded-2xl border-2 p-4 transition ${
                            isCorrect
                              ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                              : 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {/* Live percentage background indicator */}
                          <div
                            className={`absolute inset-y-0 right-0 opacity-15 transition-all duration-500 ${
                              isCorrect ? 'bg-emerald-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />

                          <div className="relative flex items-center justify-between gap-3">
                            <span className="font-bold text-sm">
                              {o.text || `الخيار ${o.index + 1}`}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black">{percent}%</span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {count}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation card after reveal */}
                  {activeQuestion.revealed && activeQuestion.explanation && (
                    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs font-bold leading-7 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                      <div className="font-black text-emerald-800 dark:text-emerald-300 mb-1">
                        شرح الحل المعتمد:
                      </div>
                      {activeQuestion.explanation}
                    </div>
                  )}
                </section>
              ) : null}

              {/* Challenge Controller */}
              {session?.status === 'live' && session.activeBatchId && (
                <ClassroomChallengeController
                  challenge={challenge}
                  competition={competition}
                  remainingSeconds={challengeRemaining}
                  durationSeconds={challengeDuration}
                  onDurationChange={setChallengeDuration}
                  onStartChallenge={() => void startChallenge()}
                  onStopChallenge={() => void stopChallenge()}
                  busy={busy !== ''}
                />
              )}

              {/* Initial Session Builder (When Draft or No Questions) */}
              {scope && (!session || session.status === 'draft') && (
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        بناء الحصة واختيار الأسئلة
                      </h3>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        اختر حتى 30 سؤالاً من بنك الأسئلة المعتمد لمادة {scope.school.schoolName}
                      </p>
                    </div>

                    <div className="relative w-full sm:w-80">
                      <Search className="absolute right-3 top-3 text-slate-400" size={17} />
                      <input
                        aria-label="بحث أسئلة الفصل الذكي"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        placeholder="بحث في السؤال…"
                      />
                    </div>
                  </div>

                  <div className="mt-4 max-h-[380px] space-y-2 overflow-y-auto">
                    {questions.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => toggle(q.id)}
                        className={`w-full rounded-2xl border p-3.5 text-right transition ${
                          selected.includes(q.id)
                            ? 'border-indigo-500 bg-indigo-50/70 dark:border-indigo-700 dark:bg-indigo-950/40'
                            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-bold leading-7 text-xs sm:text-sm text-slate-900 dark:text-white">
                            {q.text || 'سؤال بصري'}
                          </div>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black dark:bg-slate-800">
                            v{q.version}
                          </span>
                        </div>
                        <div className="mt-1.5 text-[11px] font-bold text-slate-400">
                          {q.questionType} · صعوبة: {q.difficulty || 'متوسط'}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <span className="text-xs font-black text-slate-500">
                      المحدد: {selected.length} سؤال
                    </span>

                    {!session ? (
                      <div className="flex items-center gap-2">
                        <select
                          aria-label="نمط نشر الفصل الذكي"
                          value={mode}
                          onChange={(e) => setMode(e.target.value as ClassroomPublishedMode)}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="single">سؤال واحد لكل خطوة</option>
                          <option value="batch">دفعة أسئلة كاملة</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => void create()}
                          disabled={!selected.length || busy !== ''}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-950"
                        >
                          <ChevronLeft size={16} />
                          إنشاء الحصة التفاعلية
                        </button>
                      </div>
                    ) : null}
                  </div>
                </section>
              )}
            </div>
          </section>
        )}

        {/* Drawers & Modals */}
        <ClassroomRosterDrawer
          isOpen={rosterDrawerOpen}
          onClose={() => setRosterDrawerOpen(false)}
          attendance={attendance}
          roster={roster}
          onChangeStatus={changeAttendance}
          raisedHands={raisedHands}
          onLowerHand={(id) => setRaisedHands((prev) => prev.filter((x) => x !== id))}
          busyStudentId={busy.startsWith('attendance:') ? busy.split(':')[1] : undefined}
        />

        <ClassroomPushQuestionsDrawer
          isOpen={pushDrawerOpen}
          onClose={() => setPushDrawerOpen(false)}
          availableQuestions={questions}
          selectedIds={selected}
          onToggleQuestion={toggle}
          onSelectCount={(count) => {
            const ids = questions.slice(0, count).map((q) => q.id);
            setSelected(ids);
          }}
          onClearSelection={() => setSelected([])}
          onSubmitBatch={(label) => void appendBatchWithIds(label, selected)}
          busy={busy === 'append'}
        />

        <ClassroomLivePollModal
          isOpen={livePollModalOpen}
          onClose={() => setLivePollModalOpen(false)}
          onLaunchPoll={(poll) => {
            setNotice(`تم إطلاق السؤال اللحظي: "${poll.prompt}"`);
            setTimeout(() => setNotice(''), 5000);
          }}
        />
      </div>
    </main>
  );
}
