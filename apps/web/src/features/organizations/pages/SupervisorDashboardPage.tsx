import { Activity, BarChart3, ChevronDown, ChevronLeft, ClipboardList, Loader2, Target, Users, Video } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { reportingClient } from '../../reporting/api/reporting-client';
import type { ReportingOverview } from '../../reporting/api/reporting-types';
import { organizationsClient, type RosterMember, type SchoolContext } from '../api/organizations-client';
import { ClassReportPanel } from '../components/ClassReportPanel';
import { ClassSkillsMapPanel } from '../components/ClassSkillsMapPanel';
import { LiveSessionsManager } from '../components/LiveSessionsManager';
import { StudentIntelligenceProfile } from '../components/StudentIntelligenceProfile';
import { SupervisorTestsManager } from '../components/SupervisorTestsManager';

type SupervisorTab = 'overview' | 'students' | 'live-sessions' | 'tests' | 'live-monitoring' | 'skills' | 'reports';

const tabs: { id: SupervisorTab; label: string; icon: typeof Users }[] = [
  { id: 'overview', label: 'الملخص العام', icon: BarChart3 },
  { id: 'students', label: 'تعلم الطلاب وجاهزيتهم', icon: Users },
  { id: 'live-sessions', label: 'الحصص المباشرة', icon: Video },
  { id: 'tests', label: 'الاختبارات والتحليل', icon: ClipboardList },
  { id: 'live-monitoring', label: 'المراقبة الحية', icon: Activity },
  { id: 'skills', label: 'خريطة المهارات', icon: Target },
  { id: 'reports', label: 'تقارير الأداء', icon: ClipboardList },
];

const enabledTabs = new Set<SupervisorTab>([
  'overview',
  'students',
  'live-sessions',
  'tests',
  'live-monitoring',
  'skills',
  'reports',
]);

const groups = [
  { label: 'الرئيسية', ids: ['overview'] },
  { label: 'الطلاب والحصص', ids: ['students', 'live-sessions'] },
  { label: 'الاختبارات والمراقبة', ids: ['tests', 'live-monitoring'] },
  { label: 'المهارات والتقارير', ids: ['skills', 'reports'] },
];

const PAGE_SIZE = 20;

export function SupervisorDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: SupervisorTab = tabs.some((item) => item.id === requested && enabledTabs.has(item.id))
    ? (requested as SupervisorTab)
    : 'students';
  const activeGroup = groups.find((group) => group.ids.includes(tab))?.label || '';
  const [userExpandedGroup, setUserExpandedGroup] = useState<string | null>(null);
  const [prevTab, setPrevTab] = useState(tab);
  const [prevParams, setPrevParams] = useState(params.toString());

  if (prevParams !== params.toString()) {
    setPrevParams(params.toString());
    setUserExpandedGroup(null);
  }
  if (prevTab !== tab) {
    setPrevTab(tab);
    setUserExpandedGroup(null);
  }

  const expandedGroup = userExpandedGroup !== null ? userExpandedGroup : activeGroup;
  const authorized = Boolean(user?.roles.includes('supervisor'));
  const [contexts, setContexts] = useState<SchoolContext[]>([]);
  const [scopeOwner, setScopeOwner] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [scopeBusy, setScopeBusy] = useState(true);
  const [scopeError, setScopeError] = useState('');
  const [scopeReload, setScopeReload] = useState(0);

  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [rosterSchoolId, setRosterSchoolId] = useState('');
  const [rosterBusy, setRosterBusy] = useState(false);
  const [rosterError, setRosterError] = useState('');
  const [rosterReload, setRosterReload] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [overviewReport, setOverviewReport] = useState<ReportingOverview | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const visibleContexts = scopeOwner === user?.id ? contexts : [];
  const currentSchool = visibleContexts.find((item) => item.schoolId === schoolId);
  const visibleRoster = !scopeBusy && !scopeError && !rosterError && rosterSchoolId === schoolId ? roster : [];

  useEffect(() => {
    const controller = new AbortController();
    setContexts([]);
    setScopeOwner('');
    setRoster([]);
    setRosterSchoolId('');
    setTotal(0);
    setRosterError('');
    setScopeError('');
    if (authLoading || !authorized) {
      setSchoolId('');
      setScopeBusy(false);
      return () => controller.abort();
    }
    setScopeBusy(true);
    organizationsClient
      .contexts(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        const allowed = response.contexts.filter((item) => item.role === 'supervisor');
        setContexts(allowed);
        setScopeOwner(user?.id || '');
        setSchoolId((current) => (allowed.some((item) => item.schoolId === current) ? current : allowed[0]?.schoolId || ''));
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setContexts([]);
        setScopeOwner('');
        setScopeError(cause instanceof Error ? cause.message : 'تعذر تحميل نطاق الإشراف');
      })
      .finally(() => {
        if (!controller.signal.aborted) setScopeBusy(false);
      });
    return () => controller.abort();
  }, [authLoading, authorized, user?.id, scopeReload]);

  useEffect(() => {
    const controller = new AbortController();
    if (page === 1) {
      setRoster([]);
      setRosterSchoolId('');
      setTotal(0);
    }
    setRosterError('');
    if (scopeBusy || scopeError || !currentSchool || !authorized || tab !== 'students') {
      setRosterBusy(false);
      return () => controller.abort();
    }
    setRosterBusy(true);
    organizationsClient
      .supervisorRoster(schoolId, search, page, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        const members = response.members.filter((member) => member.roles.includes('student'));
        setRoster((previous) => (page === 1 ? members : [...previous, ...members]));
        setTotal(response.pagination.total);
        setRosterSchoolId(schoolId);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        if (page === 1) {
          setRoster([]);
          setRosterSchoolId('');
        }
        setRosterError(cause instanceof Error ? cause.message : 'تعذر تحميل الطلاب');
      })
      .finally(() => {
        if (!controller.signal.aborted) setRosterBusy(false);
      });
    return () => controller.abort();
  }, [scopeBusy, scopeError, currentSchool?.schoolId, schoolId, authorized, tab, search, page, rosterReload]);

  useEffect(() => {
    if (!schoolId || !authorized || !['tests', 'skills', 'reports'].includes(tab)) {
      return;
    }
    const controller = new AbortController();
    organizationsClient
      .classes(schoolId, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setClasses(res.classes.map((c) => ({ id: c.id, name: c.name })));
      })
      .catch(() => {
        if (!controller.signal.aborted) setClasses([]);
      });
    return () => controller.abort();
  }, [schoolId, authorized, tab]);

  useEffect(() => {
    if (!schoolId || !authorized || !['overview', 'skills', 'reports'].includes(tab)) {
      return;
    }
    const controller = new AbortController();
    reportingClient
      .overview({ schoolId }, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setOverviewReport(res);
      })
      .catch(() => {
        if (!controller.signal.aborted) setOverviewReport(null);
      });
    return () => controller.abort();
  }, [schoolId, authorized, tab]);

  const mappedStudentsForSkills = useMemo(() => {
    const avg = overviewReport?.assessment?.averageScore != null ? Math.round(overviewReport.assessment.averageScore) : 0;
    const hasSkills = Boolean(overviewReport?.weakestSkills && overviewReport.weakestSkills.length > 0);
    return visibleRoster.map((m) => {
      const cls = classes.find((c) => m.classIds?.includes(c.id));
      return {
        id: m.userId,
        name: m.name,
        className: cls?.name || 'الفصل العام',
        average: avg,
        status: avg >= 60 ? 'active' : 'needs_support',
        resultsList: hasSkills
          ? [
              {
                skillsAnalysis: (overviewReport?.weakestSkills || []).map((sk) => ({
                  skill: sk.skillName,
                  mastery: sk.mastery,
                })),
              },
            ]
          : [],
      };
    });
  }, [visibleRoster, classes, overviewReport]);

  const mappedStudentsForReports = useMemo(() => {
    const avg = overviewReport?.assessment?.averageScore != null ? Math.round(overviewReport.assessment.averageScore) : 0;
    return visibleRoster.map((m) => {
      const cls = classes.find((c) => m.classIds?.includes(c.id));
      return {
        id: m.userId,
        name: m.name,
        className: cls?.name || 'الفصل العام',
        average: avg,
        attempts: overviewReport?.assessment.attemptCount ?? 0,
        status: avg >= 60 ? 'مستقر' : avg > 0 ? 'يحتاج دعم' : 'غير متوفر',
        weakSkills: (overviewReport?.weakestSkills || []).map((sk) => sk.skillName),
        resultsList: [],
      };
    });
  }, [visibleRoster, classes, overviewReport]);

  const groupSnapshots = useMemo(() => {
    const avg = overviewReport?.assessment?.averageScore != null ? Math.round(overviewReport.assessment.averageScore) : 0;
    const failed = overviewReport?.assessment.failed ?? 0;
    if (classes.length > 0) {
      return classes.map((c) => {
        const classStudents = visibleRoster.filter((m) => m.classIds?.includes(c.id));
        return {
          id: c.id,
          name: c.name,
          studentCount: classStudents.length,
          average: avg,
          weakStudents: failed,
        };
      });
    }
    return [
      {
        id: currentSchool?.schoolId || 'default',
        name: currentSchool?.schoolName || 'الفصل العام',
        studentCount: visibleRoster.length,
        average: avg,
        weakStudents: failed,
      },
    ];
  }, [classes, visibleRoster, currentSchool, overviewReport]);

  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    const member = visibleRoster.find((m) => m.userId === selectedStudentId);
    if (!member) return null;
    const cls = classes.find((c) => member.classIds?.includes(c.id));
    const avg = overviewReport?.assessment?.averageScore != null ? Math.round(overviewReport.assessment.averageScore) : 0;
    const hasSkills = Boolean(overviewReport?.weakestSkills && overviewReport.weakestSkills.length > 0);
    return {
      id: member.userId,
      name: member.name,
      email: member.email,
      className: cls?.name || 'الفصل العام',
      schoolName: currentSchool?.schoolName || '',
      gradeName: 'المرحلة الثانوية',
      average: avg,
      attempts: overviewReport?.assessment.attemptCount ?? 0,
      latestScore: avg,
      previousScore: avg,
      latestQuiz: overviewReport?.assessment.attemptCount ? 'اختبار تشخيصي' : 'لا يوجد اختبارات بعد',
      weakSkills: (overviewReport?.weakestSkills || []).map((sk) => sk.skillName),
      followUpReason: avg > 0 && avg < 60 ? 'يحتاج دعم في المهارات الأساسية' : avg >= 60 ? 'مستوى متقدم ومستقر' : 'متابعة دورية',
      status: avg === 0 ? 'good' : avg < 50 ? 'danger' : avg < 70 ? 'watch' : 'good',
      resultsList: hasSkills
        ? [
            {
              score: avg,
              quizTitle: 'اختبار تشخيصي',
              date: new Date().toLocaleDateString('ar-SA'),
              skillsAnalysis: (overviewReport?.weakestSkills || []).map((sk) => ({
                skill: sk.skillName,
                mastery: sk.mastery,
              })),
            },
          ]
        : [],
    };
  }, [selectedStudentId, visibleRoster, classes, currentSchool, overviewReport]);

  function selectTab(next: SupervisorTab) {
    if (!enabledTabs.has(next)) return;
    if (next === 'students') setPage(1);
    setUserExpandedGroup(null);
    setParams((previous) => {
      const updated = new URLSearchParams(previous);
      if (next === 'students') updated.delete('tab');
      else updated.set('tab', next);
      return updated;
    });
  }

  if (authLoading) return <main dir="rtl" className="p-10 text-center font-black">جاري التحقق من الحساب...</main>;
  if (!authorized) return <main dir="rtl" className="p-10 text-center font-black text-rose-700">هذه الصفحة مخصصة للمشرف.</main>;

  return (
    <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-5 sm:px-6 sm:py-7">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-2xl border bg-white p-5 sm:p-7">
          <h1 className="text-xl font-bold text-gray-900">لوحة الإشراف</h1>
          <p className="mt-1 text-xs text-gray-500">متابعة الفصول والمهارات والتقارير</p>
        </header>

        <nav aria-label="أقسام لوحة المشرف" dir="rtl" className="space-y-3 rounded-2xl border bg-white p-3">
          {groups.map((group) => (
            <details
              key={group.label}
              open={expandedGroup === group.label}
              className="rounded-2xl border border-slate-100 bg-slate-50/70 p-2"
            >
              <summary
                onClick={(event) => {
                  event.preventDefault();
                  setUserExpandedGroup(expandedGroup === group.label ? '' : group.label);
                }}
                className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm font-black text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 [&::-webkit-details-marker]:hidden"
              >
                {group.label}
                <ChevronDown
                  aria-hidden="true"
                  size={16}
                  className={`shrink-0 transition-transform ${expandedGroup === group.label ? 'rotate-180' : ''}`}
                />
              </summary>
              <div className="space-y-2 pt-2">
                {tabs
                  .filter((item) => group.ids.includes(item.id))
                  .map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectTab(item.id)}
                        disabled={!enabledTabs.has(item.id)}
                        aria-current={tab === item.id ? 'page' : undefined}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-right transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          tab === item.id
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200'
                        }`}
                      >
                        <span className="shrink-0 text-indigo-600">
                          <Icon size={20} />
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-bold">{item.label}</span>
                      </button>
                    );
                  })}
              </div>
            </details>
          ))}
        </nav>

        <nav aria-label="مسار الصفحة" dir="rtl" className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-500 print:hidden">
          <button type="button" onClick={() => selectTab('overview')} className="min-h-11 rounded-lg px-1 font-bold text-indigo-700 hover:underline">
            لوحة الإشراف
          </button>
          {groups.find((group) => group.ids.includes(tab) && group.ids.length > 1) ? (
            <>
              <ChevronLeft aria-hidden="true" size={12} />
              <span>{groups.find((group) => group.ids.includes(tab))?.label}</span>
            </>
          ) : null}
          <ChevronLeft aria-hidden="true" size={12} />
          <span aria-current="page" className="font-bold text-slate-800">
            {tabs.find((item) => item.id === tab)?.label}
          </span>
        </nav>

        {scopeError ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            {scopeError}
            <button type="button" onClick={() => setScopeReload((n) => n + 1)} className="ms-3 rounded-lg border px-3 py-1">
              إعادة المحاولة
            </button>
          </div>
        ) : null}

        {scopeBusy ? (
          <div className="flex items-center gap-2 p-5 text-sm">
            <Loader2 size={16} className="animate-spin" />
            جاري تحميل النطاقات...
          </div>
        ) : null}

        {!scopeBusy && !scopeError && !visibleContexts.length ? (
          <div className="rounded-xl border bg-white p-5 text-sm">لا توجد مدرسة أو فصول مسندة لهذا الحساب حاليًا.</div>
        ) : null}

        {!scopeBusy && !scopeError && visibleContexts.length > 0 ? (
          <section className="space-y-4 rounded-2xl border bg-white p-4 sm:p-6">
            {actionFeedback ? (
              <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 text-xs font-bold text-indigo-900 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white font-black text-xs">✓</span>
                  <span>{actionFeedback}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActionFeedback(null)}
                  className="text-indigo-600 hover:text-indigo-800 text-xs font-black cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            ) : null}

            <label className="block text-sm font-bold text-gray-800">
              المدرسة
              <select
                aria-label="المدرسة"
                value={schoolId}
                onChange={(event) => {
                  setSchoolId(event.target.value);
                  setRosterSchoolId('');
                  setRoster([]);
                  setTotal(0);
                  setPage(1);
                }}
                className="mt-2 block w-full rounded-xl border border-gray-300 bg-white p-2 sm:max-w-sm"
              >
                {visibleContexts.map((context) => (
                  <option key={context.schoolId} value={context.schoolId}>
                    {context.schoolName}
                  </option>
                ))}
              </select>
            </label>

            {/* ===== OVERVIEW TAB ===== */}
            {tab === 'overview' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                    <div className="flex items-center justify-between text-indigo-600">
                      <Users size={20} />
                      <span className="text-[11px] font-bold">الطلاب</span>
                    </div>
                    <div className="mt-2 text-2xl font-black text-indigo-950">
                      {overviewReport?.scope.studentCount ?? visibleRoster.length}
                    </div>
                    <div className="mt-0.5 text-xs text-indigo-700">إجمالي طلاب المدرسة</div>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <div className="flex items-center justify-between text-emerald-600">
                      <BarChart3 size={20} />
                      <span className="text-[11px] font-bold">المتوسط</span>
                    </div>
                    <div className="mt-2 text-2xl font-black text-emerald-950">
                      {overviewReport?.assessment.averageScore ? `${Math.round(overviewReport.assessment.averageScore)}%` : '—'}
                    </div>
                    <div className="mt-0.5 text-xs text-emerald-700">متوسط درجات الطلاب</div>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                    <div className="flex items-center justify-between text-blue-600">
                      <ClipboardList size={20} />
                      <span className="text-[11px] font-bold">الاختبارات</span>
                    </div>
                    <div className="mt-2 text-2xl font-black text-blue-950">
                      {overviewReport?.assessment.attemptCount ?? 0}
                    </div>
                    <div className="mt-0.5 text-xs text-blue-700">محاولات الاختبارات</div>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                    <div className="flex items-center justify-between text-amber-600">
                      <Target size={20} />
                      <span className="text-[11px] font-bold">الفصول</span>
                    </div>
                    <div className="mt-2 text-2xl font-black text-amber-950">
                      {classes.length || visibleContexts.length}
                    </div>
                    <div className="mt-0.5 text-xs text-amber-700">فصول تحت الإشراف</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="text-base font-bold text-gray-900">الوصول السريع للأقسام</h3>
                  <p className="mt-1 text-xs text-gray-500">انتقل مباشرة إلى مهام الإشراف والمتابعة الميدانية</p>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { id: 'students' as SupervisorTab, title: 'تعلم الطلاب وجاهزيتهم', desc: 'متابعة سجل الطلاب والمهارات والتحصيل', icon: Users, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
                      { id: 'tests' as SupervisorTab, title: 'الاختبارات والتحليل', desc: 'إدارة وتوجيه الاختبارات المدرسية والتشخيصية', icon: ClipboardList, color: 'text-blue-600 bg-blue-50 border-blue-100' },
                      { id: 'skills' as SupervisorTab, title: 'خريطة المهارات', desc: 'تحليل الفجوات ونسب التمكن ونقاط الدعم', icon: Target, color: 'text-amber-600 bg-amber-50 border-amber-100' },
                      { id: 'reports' as SupervisorTab, title: 'تقارير الأداء', desc: 'تقارير معتمدة ومقارنة الفصول وتصدير CSV', icon: BarChart3, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                      { id: 'live-sessions' as SupervisorTab, title: 'الحصص المباشرة', desc: 'جدول الحصص التفاعلية ومشاركات الطلاب', icon: Video, color: 'text-purple-600 bg-purple-50 border-purple-100' },
                      { id: 'live-monitoring' as SupervisorTab, title: 'المراقبة الحية', desc: 'متابعة حية للاختبارات النشطة اللحظية', icon: Activity, color: 'text-rose-600 bg-rose-50 border-rose-100' },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectTab(item.id)}
                          className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-right transition-all hover:border-indigo-300 hover:bg-slate-50"
                        >
                          <div className={`rounded-xl border p-2.5 ${item.color}`}>
                            <Icon size={20} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-gray-900">{item.title}</div>
                            <div className="mt-0.5 text-xs text-gray-500">{item.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {/* ===== STUDENTS TAB ===== */}
            {tab === 'students' ? (
              <div className="space-y-3">
                <h2 className="text-lg font-bold">تعلم الطلاب وجاهزيتهم</h2>
                <label className="block text-sm font-bold">
                  بحث عن طالب
                  <input
                    aria-label="بحث عن طالب"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                      setRosterSchoolId('');
                    }}
                    className="mt-2 block w-full rounded-xl border border-gray-300 p-2 sm:max-w-md"
                    placeholder="اسم الطالب أو البريد الإلكتروني"
                  />
                </label>
                {rosterBusy ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 size={16} className="animate-spin" />
                    جاري تحميل الطلاب...
                  </div>
                ) : null}
                {rosterError ? (
                  <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
                    {rosterError}
                    <button type="button" onClick={() => setRosterReload((n) => n + 1)} className="ms-3 rounded-lg border px-3 py-1">
                      إعادة المحاولة
                    </button>
                  </div>
                ) : null}
                {!rosterBusy && !rosterError && !visibleRoster.length ? (
                  <p className="text-sm text-gray-500">لا يوجد طلاب ضمن نطاق الإشراف الحالي.</p>
                ) : null}
                {visibleRoster.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full min-w-[320px] text-right text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-3">اسم الطالب</th>
                          <th className="p-3">البريد الإلكتروني</th>
                          <th className="p-3">الإجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRoster.map((member) => (
                          <tr key={member.userId} className="border-t">
                            <td className="p-3 font-bold">{member.name}</td>
                            <td className="p-3">{member.email}</td>
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() => setSelectedStudentId(member.userId)}
                                className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                              >
                                الملف والمهارات
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {total > PAGE_SIZE && !rosterError ? (
                  <div role="group" aria-label="عرض الطلاب" className="flex flex-wrap items-center justify-center gap-3 py-3 text-sm">
                    <span className="text-gray-500">
                      عرض {visibleRoster.length} من {total}
                    </span>
                    {visibleRoster.length < total ? (
                      <button
                        type="button"
                        disabled={rosterBusy}
                        onClick={() => setPage((n) => n + 1)}
                        className="rounded-xl bg-indigo-50 px-4 py-2 font-bold text-indigo-700 disabled:opacity-40"
                      >
                        عرض المزيد
                      </button>
                    ) : null}
                    {page > 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPage(1);
                          setRoster([]);
                          setRosterSchoolId('');
                        }}
                        className="rounded-xl border px-4 py-2 font-bold"
                      >
                        عرض أقل
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* ===== LIVE SESSIONS TAB ===== */}
            {tab === 'live-sessions' ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                    <Video className="text-indigo-600" size={22} />
                    الحصص التفاعلية المباشرة
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    متابعة وجدولة الحصص المباشرة عبر منصات Zoom وTeams وMeet
                  </p>
                </div>
                <LiveSessionsManager schoolId={schoolId} />
              </div>
            ) : null}

            {/* ===== TESTS TAB ===== */}
            {tab === 'tests' ? (
              <div className="space-y-4">
                <SupervisorTestsManager
                  schoolId={schoolId}
                  classes={classes}
                  students={visibleRoster.map((m) => ({
                    id: m.userId,
                    name: m.name,
                    className: classes.find((c) => m.classIds?.includes(c.id))?.name || 'الفصل العام',
                  }))}
                  roleMode="supervisor"
                  onAssignToStudent={(studentId) => {
                    setSelectedStudentId(studentId);
                  }}
                />
              </div>
            ) : null}

            {/* ===== LIVE MONITORING TAB ===== */}
            {tab === 'live-monitoring' ? (
              <div className="space-y-6">
                <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-6 flex flex-col gap-4 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="flex items-center gap-2 text-xl font-black text-gray-900">
                        <Activity className="animate-pulse text-rose-500" size={24} />
                        شاشة المراقبة الحية للاختبارات
                      </h2>
                      <p className="mt-1 text-sm font-medium text-gray-500">
                        تابع تقدم الطلاب في الاختبارات النشطة حالياً لحظة بلحظة
                      </p>
                    </div>
                    <div className="flex w-fit items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
                      متصل (0 نشط)
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="col-span-1 py-12 text-center text-gray-500 md:col-span-2 lg:col-span-3">
                      <Activity className="mx-auto mb-2 text-slate-300" size={36} />
                      <p className="font-bold">لا يوجد اختبارات نشطة حالياً.</p>
                      <p className="mt-1 text-xs text-gray-400">ستظهر الاختبارات الجارية تلقائياً بمجرد بدء الطلاب لأي اختبار مدرسي موجه.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* ===== SKILLS TAB ===== */}
            {tab === 'skills' ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                    <Target className="text-indigo-600" size={22} />
                    خريطة المهارات وتحليل الفجوات
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    متابعة تمكن الطلاب من مهارات القدرات والتحصيلي ومؤشرات الدعم المطلوب
                  </p>
                </div>
                <ClassSkillsMapPanel
                  students={mappedStudentsForSkills}
                  groupSnapshots={groupSnapshots}
                  onSelectStudent={(id) => setSelectedStudentId(id)}
                />
              </div>
            ) : null}

            {/* ===== REPORTS TAB ===== */}
            {tab === 'reports' ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                    <ClipboardList className="text-indigo-600" size={22} />
                    تقارير الأداء المعتمدة وتوزيع المستويات
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    إحصائيات تفصيلية ومقارنة تحصيل الفصول والمهارات الحرجة
                  </p>
                </div>
                <ClassReportPanel
                  students={mappedStudentsForReports}
                  groupSnapshots={groupSnapshots}
                  overallAverage={overviewReport?.assessment.averageScore ?? 0}
                  onSelectStudent={(id) => setSelectedStudentId(id)}
                  onExportCSV={async () => {
                    try {
                      const blob = await reportingClient.exportCsv({ schoolId });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `تقرير_المشرف_${schoolId}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      const header = ['اسم الطالب', 'الفصل', 'المتوسط', 'الحالة'].join(',');
                      const rows = mappedStudentsForReports.map((s) => `"${s.name}","${s.className}",${s.average},"${s.status}"`);
                      const blob = new Blob(['\uFEFF' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `تقرير_المشرف_${schoolId}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  onPrint={() => window.print()}
                />
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ===== STUDENT PROFILE MODAL ===== */}
        {selectedStudent ? (
          <StudentIntelligenceProfile
            student={selectedStudent}
            classAverage={overviewReport?.assessment.averageScore ?? 75}
            classTotalStudents={visibleRoster.length}
            onClose={() => setSelectedStudentId(null)}
            onSendAlert={() => {
              const name = selectedStudent?.name || 'الطالب';
              setSelectedStudentId(null);
              setActionFeedback(`تم تسجيل تنبيه المتابعة الأكاديمية للطالب "${name}" وإدراجه في خطة التدخل المدرسي.`);
            }}
            onAssignTest={() => {
              setSelectedStudentId(null);
              selectTab('tests');
            }}
          />
        ) : null}
      </div>
    </main>
  );
}
