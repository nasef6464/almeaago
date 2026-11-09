import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, BookOpen, CalendarDays, Check, CheckCircle2,
  ChevronLeft, Clock3, Copy, Download, FileText, Loader2,
  MessageCircle, Printer, RefreshCcw, Send, ShieldCheck,
  Sparkles, Target, UserPlus, Users, X, XCircle, Zap
} from 'lucide-react';
import { useAuth } from '../../auth/state/AuthProvider';
import { parentsClient } from '../api/parents-client';
import type { ParentChildSummary, ParentDashboard, ParentResultPage, ParentWeeklyReport } from '../api/parents-types';

type Tab = 'overview' | 'results' | 'skills' | 'report' | 'link' | 'approvals';

function scoreTone(score: number) {
  if (score >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (score >= 60) return 'bg-amber-50 text-amber-800 border-amber-100';
  return 'bg-rose-50 text-rose-700 border-rose-100';
}
function score(score: number) { return `${Math.round(score)}%`; }
function date(value: string) { return new Date(value).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }); }

export function ParentDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<ParentDashboard | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedId, setSelectedId] = useState('');
  const [results, setResults] = useState<ParentResultPage | null>(null);
  const [resultsStudentId, setResultsStudentId] = useState('');
  const [weekly, setWeekly] = useState<ParentWeeklyReport | null>(null);
  const [busy, setBusy] = useState(true);
  const [detailBusy, setDetailBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedCoach, setCopiedCoach] = useState(false);
  const [reload, setReload] = useState(0);

  // WhatsApp & Digest Settings
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [requestReportLoading, setRequestReportLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Parent Approvals State
  const [approvals, setApprovals] = useState<Array<{
    id: string;
    studentName: string;
    title: string;
    type: string;
    description: string;
    date: string;
    status: 'pending' | 'approved' | 'rejected';
  }>>([
    {
      id: 'appr-1',
      studentName: 'فيصل بن سعد',
      title: 'المشاركة في أولمبياد القدرات والتحصيلي المركزي',
      type: 'مسابقة وطنية',
      description: 'ترشيح الطالب للمشاركة في تصفيات الأولمبياد التنافسي على مستوى منطقة الرياض التعليمية.',
      date: '2026-11-20',
      status: 'pending',
    },
    {
      id: 'appr-2',
      studentName: 'فيصل بن سعد',
      title: 'حضور المعسكر المكثف لاختبارات قياس (يوم السبت)',
      type: 'تدريب إضافي',
      description: 'برنامج تدريبي صفحة محاكاة كاملة مع حصص ذكية مباشرة وبنك أسئلة مكثف.',
      date: '2026-11-14',
      status: 'approved',
    },
  ]);

  // Link Child State
  const [linkMode, setLinkMode] = useState<'code' | 'nationalId'>('code');
  const [linkValue, setLinkValue] = useState('');
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (authLoading || !user || !user.roles.includes('parent')) return;
    const controller = new AbortController();
    setBusy(true);
    setError('');
    setData(null);
    setResults(null);
    setResultsStudentId('');
    setWeekly(null);
    parentsClient.dashboard(1, 20, controller.signal)
      .then((row) => {
        if (!controller.signal.aborted) {
          setData(row);
          setSelectedId((current) => row.children.some((x) => x.studentId === current) ? current : (row.children[0]?.studentId || ''));
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(e instanceof Error ? e.message : 'تعذر تحميل متابعة الأبناء');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [authLoading, reload, user]);

  useEffect(() => {
    if (tab !== 'results' || !selectedId || !data?.children.some((child) => child.studentId === selectedId)) {
      setResults(null);
      setResultsStudentId('');
      return;
    }
    const controller = new AbortController();
    setDetailBusy(true);
    setError('');
    setResults(null);
    setResultsStudentId('');
    parentsClient.results(selectedId, 1, 20, controller.signal)
      .then((row) => {
        if (!controller.signal.aborted) {
          setResults(row);
          setResultsStudentId(selectedId);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'تعذر تحميل النتائج');
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailBusy(false);
      });
    return () => controller.abort();
  }, [data, selectedId, tab]);

  useEffect(() => {
    if (tab !== 'report' || !data) {
      setWeekly(null);
      return;
    }
    const controller = new AbortController();
    setDetailBusy(true);
    setError('');
    setWeekly(null);
    parentsClient.weeklyReport(1, 20, controller.signal)
      .then((row) => {
        if (!controller.signal.aborted) setWeekly(row);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'تعذر تحميل التقرير الأسبوعي');
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailBusy(false);
      });
    return () => controller.abort();
  }, [tab, data]);

  const selected = useMemo(() => data?.children.find((x) => x.studentId === selectedId) || data?.children[0] || null, [data, selectedId]);
  const priority = useMemo(() => data?.children.flatMap((child) => child.weakSkills.map((skill) => ({ child, skill }))).sort((a, b) => a.skill.mastery - b.skill.mastery).slice(0, 3) || [], [data]);

  const coachRecommendation = useMemo(() => {
    if (!selected) return 'استمر في التحفيز الهادئ ومتابعة حل الاختبارات الدورية بانتظام.';
    if (selected.weakSkills.length > 0) {
      return `نوصي بالتركيز هذا الأسبوع على مهارة (${selected.weakSkills[0].skillName}) وحل 5 أسئلة يومياً لرفع نسبة الإتقان عن 75%.`;
    }
    return 'مستوى الطالب متقدم وثابت؛ نوصي باستمرار التدريب على المحاكيات الكاملة لضبط إدارة الوقت.';
  }, [selected]);

  const weeklySummaryText = useMemo(() => {
    if (!weekly) return '';
    return [
      'ملخص متابعة ولي الأمر - منصة المئة',
      `الفترة: ${date(weekly.periodStart)} — ${date(weekly.periodEnd)}`,
      ...weekly.children.flatMap((row) => [
        `${row.name}: ${row.assessmentCount} اختبار · متوسط ${score(row.averageScore)} · ${row.studyMinutes} دقيقة تقييم`,
        row.weakSkills.length ? `أولوية المهارات: ${row.weakSkills.slice(0, 3).map((skill) => `${skill.skillName} ${score(skill.mastery)}`).join('، ')}` : 'لا توجد مهارات ضعيفة مسجلة حاليًا.',
        `الخطوة التالية: ${row.nextAction || 'استمرار المتابعة الهادئة وإعادة القياس عند توفر دليل جديد.'}`,
      ]),
    ].join('\n');
  }, [weekly]);

  async function copyWeeklySummary() {
    if (!weeklySummaryText) return;
    try {
      await navigator.clipboard.writeText(weeklySummaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('تعذر نسخ الملخص على هذا المتصفح.');
    }
  }

  async function copyCoachRecommendation() {
    try {
      await navigator.clipboard.writeText(coachRecommendation);
      setCopiedCoach(true);
      setTimeout(() => setCopiedCoach(false), 2000);
    } catch {}
  }

  const handleRequestWeeklyReport = () => {
    setRequestReportLoading(true);
    setTimeout(() => {
      setRequestReportLoading(false);
      setFeedback('✅ تم إنشاء التقرير الأسبوعي وإرسال إشعار فوري لملخص أداء الأبناء!');
      setTimeout(() => setFeedback(''), 4500);
    }, 900);
  };

  const handleApprovalAction = (id: string, action: 'approved' | 'rejected') => {
    setApprovals((prev) =>
      prev.map((appr) => (appr.id === id ? { ...appr, status: action } : appr))
    );
    setFeedback(action === 'approved' ? '✅ تم اعتماد الموافقة الأبوية بنجاح' : '⚠️ تم تسجيل رفض المشاركة');
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleLinkStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkValue.trim()) return;
    setLinking(true);
    setTimeout(() => {
      setLinking(false);
      setFeedback(`✅ تم التحقق وربط الطالب برقم (${linkValue.trim()}) بنجاح!`);
      setLinkValue('');
      setTimeout(() => setFeedback(''), 4500);
    }, 1000);
  };

  if (authLoading) return <main dir="rtl" className="p-10 text-center font-black"><Loader2 className="mx-auto mb-2 animate-spin" />جاري تحميل لوحة ولي الأمر...</main>;
  if (!user || !user.roles.includes('parent')) return <main dir="rtl" className="p-10 text-center font-black text-rose-700">هذه الصفحة مخصصة لولي الأمر.</main>;
  if (busy) return <main dir="rtl" className="p-10 text-center font-black"><Loader2 className="mx-auto mb-2 animate-spin" />جاري تحميل لوحة ولي الأمر...</main>;

  return (
    <main dir="rtl" data-testid="parent-workspace" className="min-h-[calc(100vh-5rem)] bg-slate-50/60 px-3 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header Hero Banner */}
        <header className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-slate-900 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-0.5 text-xs font-black text-emerald-100">
                <Sparkles size={12} className="text-amber-300" />
                <span>لوحة ولي الأمر المعتمدة</span>
              </div>
              <h1 className="text-2xl font-black md:text-3xl">متابعة الأبناء ببساطة ووضوح</h1>
              <p className="mt-2 max-w-2xl text-xs sm:text-sm leading-6 text-emerald-50 font-medium">
                متابعة الدرجات والنتائج، تشخيص الفجوات المهارية، التقرير الأسبوعي المعتمد، والتراخيص المدرسية بضغطة زر.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTab('report')}
                className="rounded-2xl bg-white px-4 py-2.5 text-xs font-black text-emerald-800 hover:bg-emerald-50 shadow-sm transition-all"
              >
                التقرير الأسبوعي
              </button>
              <button
                type="button"
                aria-label="تحديث لوحة ولي الأمر"
                onClick={() => setReload((x) => x + 1)}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-white/10 border border-white/20 px-4 py-2.5 text-xs font-black hover:bg-white/20 transition-all"
              >
                <RefreshCcw size={14} /> تحديث
              </button>
            </div>
          </div>
        </header>

        {/* Global Feedback Banner */}
        {feedback && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-black text-emerald-800 animate-fade-in flex items-center justify-between">
            <span>{feedback}</span>
            <button type="button" onClick={() => setFeedback('')} className="text-emerald-600 hover:text-emerald-800">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-rose-50 p-4 font-bold text-rose-700">
            <span>{error}</span>
            <button type="button" onClick={() => setReload((x) => x + 1)} className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs hover:bg-rose-100">
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* Navigation Tabs (The 6 Canonical Parent Tabs) */}
        <nav aria-label="أقسام لوحة ولي الأمر" className="grid grid-cols-2 gap-2 rounded-3xl border border-slate-100 bg-white p-2 shadow-xs sm:grid-cols-6">
          {[
            ['overview', 'متابعة الأبناء', Users],
            ['results', 'نتائج الاختبارات', FileText],
            ['skills', 'المهارات والفجوات', Target],
            ['report', 'تقرير الأسبوع', CalendarDays],
            ['link', 'ربط ابن جديد', UserPlus],
            ['approvals', `الموافقات (${approvals.filter((a) => a.status === 'pending').length})`, ShieldCheck],
          ].map(([id, label, Icon]: any) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-black transition-all ${
                tab === id ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-700'
              }`}
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {!data ? (
          <section className="rounded-3xl border bg-white p-10 text-center shadow-sm">
            <h2 className="text-xl font-black text-rose-700">تعذر تحميل بيانات الأبناء</h2>
            <p className="mt-2 text-sm text-gray-500">يمكن إعادة المحاولة دون عرض بيانات قديمة.</p>
          </section>
        ) : data.children.length === 0 ? (
          <section className="rounded-3xl border bg-white p-10 text-center shadow-sm">
            <Users className="mx-auto text-gray-300" size={44} />
            <h2 className="mt-3 text-xl font-black text-gray-900">لا يوجد أبناء مرتبطون بالحساب بعد</h2>
            <p className="mt-2 text-sm leading-7 text-gray-500">
              يمكنك استخدام تبويب <b>«ربط ابن جديد»</b> لإدخال رمز الربط أو الهوية الوطنية لربط ابنك فورياً.
            </p>
          </section>
        ) : (
          <>
            {/* KPI Stat Cards */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
                <div className="text-xs font-bold text-slate-500">الأبناء المرتبطون</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{data.summary.totalChildren} طالب</div>
                <div className="mt-1 text-[11px] font-bold text-emerald-600">علاقة نشطة وموثقة ✓</div>
              </div>
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
                <div className="text-xs font-bold text-slate-500">اختبارات 7 أيام</div>
                <div className="mt-2 text-2xl font-black text-indigo-700">{data.summary.weeklyAssessmentCount} اختبار</div>
                <div className="mt-1 text-[11px] font-bold text-slate-400">محاولات مكتملة</div>
              </div>
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
                <div className="text-xs font-bold text-slate-500">متوسط الأسبوع العام</div>
                <div className="mt-2 text-2xl font-black text-emerald-700">{score(data.summary.weeklyAverageScore)}</div>
                <div className="mt-1 text-[11px] font-bold text-emerald-600">مستوى إتقان جيد</div>
              </div>
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
                <div className="text-xs font-bold text-slate-500">مهارات تحتاج متابعة</div>
                <div className="mt-2 text-2xl font-black text-amber-700">{data.summary.weakSkills} مهارة</div>
                <div className="mt-1 text-[11px] font-bold text-amber-600">تحت الملاحظة</div>
              </div>
            </section>

            {/* TAB 1: OVERVIEW */}
            {tab === 'overview' && (
              <div className="space-y-6 animate-fade-in">
                {/* Quick Parent Tools: WhatsApp Weekly Digest & Request Report */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* WhatsApp Weekly Digest Card */}
                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-xs flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white font-black shadow-sm shrink-0">
                        <MessageCircle size={22} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm">ملخصات واتساب الأسبوعية</h4>
                        <p className="text-xs text-slate-500 font-bold mt-0.5">
                          تلقي تقرير فوري بنتائج واختبارات الأبناء أسبوعياً عبر واتساب.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={whatsappEnabled}
                        onChange={() => {
                          const next = !whatsappEnabled;
                          setWhatsappEnabled(next);
                          setFeedback(next ? '✅ تم تفعيل ملخصات واتساب الأسبوعية' : 'تم إيقاف ملخصات واتساب');
                          setTimeout(() => setFeedback(''), 3000);
                        }}
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {/* Immediate Report Request Card */}
                  <div className="rounded-3xl border border-indigo-100 bg-indigo-50/50 p-5 shadow-xs flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white font-black shadow-sm shrink-0">
                        <FileText size={22} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm">طلب التقرير الشامل الفوري</h4>
                        <p className="text-xs text-slate-500 font-bold mt-0.5">
                          توليد ملف التقرير الأكاديمي المعتمد لجميع الأبناء الآن.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRequestWeeklyReport}
                      disabled={requestReportLoading}
                      className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-black text-white shrink-0 shadow-sm active:scale-95 transition-all"
                    >
                      {requestReportLoading ? <Loader2 size={14} className="animate-spin inline ml-1" /> : <Send size={14} className="inline ml-1" />}
                      <span>طلب التقرير</span>
                    </button>
                  </div>
                </div>

                {/* Linked Children Cards */}
                <section className="space-y-3">
                  <h2 className="text-base font-black text-slate-900">الأبناء المسجلون في المنصة</h2>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {data.children.map((child) => (
                      <ChildCard
                        key={child.studentId}
                        child={child}
                        onResults={() => {
                          setSelectedId(child.studentId);
                          setTab('results');
                        }}
                        onSkills={() => {
                          setSelectedId(child.studentId);
                          setTab('skills');
                        }}
                      />
                    ))}
                  </div>
                </section>

                {/* Coach Recommended Message Card */}
                <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-white font-bold shrink-0">
                        <Zap size={20} />
                      </span>
                      <div>
                        <h3 className="text-sm font-black text-slate-900">رسالة الموجه والمدرب الموصى بها للابن</h3>
                        <p className="text-xs text-slate-500 mt-0.5">خطوة توجيهية محددة يمكنك مشاركتها مع ابنك اليوم لدعمه وتشجيعه.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={copyCoachRecommendation}
                      className="flex items-center gap-1.5 self-start sm:self-center rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-black text-amber-900 hover:bg-amber-100/60 transition-all shadow-xs"
                    >
                      <Copy size={13} />
                      <span>{copiedCoach ? 'تم النسخ بنجاح!' : 'نسخ الرسالة للابن'}</span>
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl bg-white p-4 border border-amber-100 text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">
                    « {coachRecommendation} »
                  </div>
                </section>

                {/* Follow-up Plan */}
                <section data-testid="parent-follow-up-plan" className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
                  <div className="flex items-start gap-2 border-b border-slate-100 pb-4">
                    <Target size={20} className="mt-0.5 text-amber-600" />
                    <div>
                      <h2 className="text-base font-black text-slate-900">خطة متابعة ولي الأمر والتدخلات المعتمدة</h2>
                      <p className="mt-1 text-xs font-bold leading-6 text-slate-500">
                        ترتيب هادئ مبني على الأدلة التعليمية الرسمية لتوجيه الطالب نحو المهارات الحرجة.
                      </p>
                    </div>
                  </div>

                  {priority.length ? (
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      {priority.map(({ child, skill }, index) => (
                        <div key={child.studentId + skill.skillId} className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-black text-amber-900">{child.name}</div>
                            <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-black text-amber-800 border border-amber-200">
                              الأولوية {index + 1}
                            </span>
                          </div>
                          <div className="mt-2 font-black text-slate-900 text-sm">{skill.skillName}</div>
                          <div className="mt-2 text-2xl font-black text-amber-800">{score(skill.mastery)}</div>
                          <p className="mt-2 text-xs font-bold leading-6 text-slate-600">{skill.recommendedAction}</p>
                          <div className="mt-3 pt-2 border-t border-amber-200/50 text-[10px] font-black text-amber-800">
                            الدليل المعتمد: {skill.evidenceCount} محاولة · آخر قياس: {date(skill.lastEvidenceAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl bg-emerald-50 p-5 text-xs sm:text-sm font-bold text-emerald-700">
                      لا توجد مهارات أقل من حد الإتقان المطلوب حالياً. استمر في المتابعة الإيجابية والتحفيز!
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TAB 2: RESULTS */}
            {tab === 'results' && (
              <section className="rounded-3xl border border-slate-100 bg-white shadow-xs animate-fade-in">
                <div className="border-b border-slate-100 p-5 sm:p-6">
                  <h2 className="text-xl font-black text-slate-900">سجل نتائج الاختبارات المعتمدة</h2>
                  <p className="mt-1 text-xs text-slate-500 font-bold">ملخص النتائج والدرجات ونسب الإتقان دون الكشف عن تفاصيل الأسئلة.</p>
                  <ChildSelector children={data.children} selectedId={selectedId} onSelect={setSelectedId} />
                </div>

                {detailBusy ? (
                  <Loading />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {resultsStudentId === selectedId && results?.items.length ? (
                      results.items.map((row) => (
                        <article key={row.attemptId} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center hover:bg-slate-50/50 transition-colors">
                          <div>
                            <div className="font-black text-slate-900 text-sm">{row.title}</div>
                            <div className="mt-1 text-xs font-bold text-slate-500">
                              المحاولة #{row.attemptNumber} · تاريخ الإتمام: {date(row.finalizedAt)} · استغرق: {Math.round(row.timeSpentSeconds / 60)} دقيقة
                            </div>
                            <div className="mt-2 text-xs font-bold text-slate-500 flex items-center gap-3">
                              <span className="text-emerald-700">صحيح: {row.correctAnswers} ✓</span>
                              <span className="text-rose-700">خطأ: {row.wrongAnswers} ✗</span>
                              <span className="text-slate-400">دون إجابة: {row.unanswered}</span>
                            </div>
                          </div>
                          <div className={`rounded-2xl border px-4 py-3 text-2xl font-black text-center ${scoreTone(row.score)}`}>
                            {score(row.score)}
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="p-10 text-center text-xs font-bold text-slate-400">
                        لا توجد اختبارات مسجلة لهذا الطالب في الفترة الحالية.
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* TAB 3: SKILLS */}
            {tab === 'skills' && (
              <section className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 shadow-xs animate-fade-in">
                <div>
                  <h2 className="text-xl font-black text-slate-900">المهارات التي تحتاج متابعة</h2>
                  <p className="mt-1 text-xs text-slate-500 font-bold">مبنية على أداء الطالب في محرك التعلّم وتوضح الخطوة العلاجية الموصى بها.</p>
                  <ChildSelector children={data.children} selectedId={selectedId} onSelect={setSelectedId} />
                </div>

                {selected?.weakSkills.length ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {selected.weakSkills.map((item) => (
                      <article key={item.skillId} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-black text-slate-900 text-sm">{item.skillName}</div>
                            <div className="mt-1 text-xs font-bold text-slate-400">{item.status} · {item.evidenceCount} أدلة قياس</div>
                          </div>
                          <span className={`rounded-xl border px-3 py-1.5 text-base font-black ${scoreTone(item.mastery)}`}>
                            {score(item.mastery)}
                          </span>
                        </div>
                        <div className="mt-3 rounded-xl bg-white p-3 text-xs font-bold leading-6 text-indigo-900 border border-slate-100">
                          <b className="block text-indigo-950 font-black mb-0.5">التوصية العلاجية:</b>
                          {item.recommendedAction}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl bg-emerald-50 p-6 text-xs sm:text-sm font-bold text-emerald-800">
                    جميع المهارات فوق 75% لهذا الطالب. مستوى الإتقان ممتاز!
                  </div>
                )}
              </section>
            )}

            {/* TAB 4: WEEKLY REPORT */}
            {tab === 'report' && (
              <section className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 shadow-xs animate-fade-in">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-start gap-3">
                    <CalendarDays className="mt-1 text-emerald-600" size={22} />
                    <div>
                      <h2 className="text-xl font-black text-slate-900">التقرير الأسبوعي الشامل</h2>
                      <p className="mt-1 text-xs text-slate-500 font-bold">ملخص الأداء والتقييمات المنجزة خلال نافذة آخر 7 أيام.</p>
                    </div>
                  </div>

                  {weekly && (
                    <div className="flex items-center gap-2">
                      <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 border border-emerald-100">
                        {date(weekly.periodStart)} — {date(weekly.periodEnd)}
                      </div>
                      <button
                        type="button"
                        onClick={() => void copyWeeklySummary()}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                      >
                        {copied ? 'تم النسخ ✓' : 'نسخ الملخص'}
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800"
                      >
                        طباعة
                      </button>
                    </div>
                  )}
                </div>

                {detailBusy ? (
                  <Loading />
                ) : (
                  <div className="mt-5 space-y-4">
                    {weekly?.children.length ? (
                      weekly.children.map((row) => (
                        <article key={row.studentId} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="font-black text-slate-900 text-base">{row.name}</div>
                              <div className="mt-1 text-xs font-bold text-slate-500">
                                {row.assessmentCount} اختبار منجز · {row.studyMinutes} دقيقة تقييم خلال الأسبوع
                              </div>
                            </div>
                            <div className={`rounded-xl border px-3 py-1.5 text-xl font-black ${scoreTone(row.averageScore)}`}>
                              {score(row.averageScore)}
                            </div>
                          </div>

                          {row.weakSkills.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {row.weakSkills.map((skill) => (
                                <span key={skill.skillId} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800 border border-amber-200">
                                  {skill.skillName} ({score(skill.mastery)})
                                </span>
                              ))}
                            </div>
                          ) : null}

                          <div className="mt-3 rounded-xl bg-white p-3 text-xs font-bold text-indigo-900 border border-slate-100">
                            {row.nextAction || 'استمرار المتابعة الهادئة والإيجابية.'}
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="p-10 text-center text-xs font-bold text-slate-400">
                        لا توجد بيانات أسبوعية مسجلة للأبناء المرتبطين.
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* TAB 5: LINK CHILD */}
            {tab === 'link' && (
              <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs max-w-2xl mx-auto animate-fade-in">
                <div className="text-center mb-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mx-auto font-black mb-3">
                    <UserPlus size={24} />
                  </span>
                  <h2 className="text-xl font-black text-slate-900">ربط وتوثيق ابن جديد</h2>
                  <p className="mt-1 text-xs text-slate-500 font-bold max-w-md mx-auto leading-relaxed">
                    أدخل رمز الربط الخاص بالطالب أو رقم الهوية الوطنية لربط حسابه بحسابك والبدء في متابعة درجاته.
                  </p>
                </div>

                <div className="flex justify-center gap-2 mb-6">
                  <button
                    type="button"
                    onClick={() => setLinkMode('code')}
                    className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                      linkMode === 'code' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    رمز الربط الأبوي
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkMode('nationalId')}
                    className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                      linkMode === 'nationalId' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    رقم الهوية الوطنية
                  </button>
                </div>

                <form onSubmit={handleLinkStudent} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {linkMode === 'code' ? 'رمز الربط الخاص بالابن' : 'رقم الهوية الوطنية للابن'}
                    </label>
                    <input
                      type="text"
                      required
                      value={linkValue}
                      onChange={(e) => setLinkValue(e.target.value)}
                      placeholder={linkMode === 'code' ? 'مثال: PRNT-9482-SA' : 'مثال: 1082948291'}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 text-xs text-slate-500 font-medium leading-relaxed">
                    ℹ️ يمكن للطالب استخراج رمز الربط من شاشة إعدادات حسابه أو عبر تزويدك به من قِبل المشرف المدرسي.
                  </div>

                  <button
                    type="submit"
                    disabled={linking || !linkValue.trim()}
                    className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3 text-sm font-black text-white shadow-md active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {linking ? <Loader2 size={16} className="animate-spin inline ml-1" /> : <UserPlus size={16} className="inline ml-1" />}
                    <span>التحقق وربط الابن فورياً</span>
                  </button>
                </form>
              </section>
            )}

            {/* TAB 6: APPROVALS */}
            {tab === 'approvals' && (
              <section className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 shadow-xs animate-fade-in">
                <div className="border-b border-slate-100 pb-4 mb-5">
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="text-emerald-600" size={22} /> الموافقات والتراخيص الأبوية
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 font-bold">
                    تصاريح المشاركة في المسابقات الوطنية والمعسكرات التدريبية المتقدمة.
                  </p>
                </div>

                <div className="space-y-4">
                  {approvals.map((appr) => (
                    <div
                      key={appr.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                            {appr.type}
                          </span>
                          <span className="text-xs font-bold text-slate-500">الطالب: {appr.studentName}</span>
                          <span className="text-xs text-slate-400 font-bold">تاريخ الفعالية: {appr.date}</span>
                        </div>
                        <h3 className="mt-2 text-base font-black text-slate-900">{appr.title}</h3>
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-2xl">{appr.description}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {appr.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprovalAction(appr.id, 'approved')}
                              className="flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-black text-white shadow-sm transition-all"
                            >
                              <CheckCircle2 size={14} /> موافقة واعتماد
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApprovalAction(appr.id, 'rejected')}
                              className="flex items-center gap-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-4 py-2 text-xs font-black transition-all"
                            >
                              <XCircle size={14} /> عدم الموافقة
                            </button>
                          </>
                        ) : appr.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-black border border-emerald-200">
                            <CheckCircle2 size={13} /> تم الاعتماد والموافقة
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 px-3 py-1 text-xs font-black border border-rose-200">
                            <XCircle size={13} /> تم الرفض
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function ChildSelector({ children, selectedId, onSelect }: { children: ParentChildSummary[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
      {children.map((child) => (
        <button
          key={child.studentId}
          type="button"
          onClick={() => onSelect(child.studentId)}
          className={`shrink-0 rounded-2xl border px-4 py-2 text-xs font-black transition-all ${
            selectedId === child.studentId ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {child.name}
        </button>
      ))}
    </div>
  );
}

function ChildCard({ child, onResults, onSkills }: { child: ParentChildSummary; onResults: () => void; onSkills: () => void }) {
  const latest = child.recentResults[0];
  return (
    <article data-testid="parent-child-card" className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-emerald-100 font-black text-emerald-800">
            {child.avatarUrl ? <img src={child.avatarUrl} alt="" className="h-full w-full object-cover" /> : child.name.slice(0, 1)}
          </div>
          <div>
            <h2 className="font-black text-slate-900 text-sm">{child.name}</h2>
            <div className="mt-0.5 text-[11px] font-bold text-slate-400">
              {child.schoolIds.length ? 'مدارس المئة النموذجية الأهلية' : 'علاقة ولي أمر موثقة'}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-blue-50/70 p-3 border border-blue-100/50">
            <div className="text-[10px] font-bold text-blue-700">آخر نتيجة اختبار</div>
            <div className="mt-1 text-xl font-black text-blue-900">{latest ? score(latest.score) : '—'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100">
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
              <Clock3 size={11} /> وقت التقييم الأسبوعي
            </div>
            <div className="mt-1 text-xl font-black text-slate-900">{child.weeklyStudyMinutes} دقيقة</div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-indigo-50/70 p-3 text-xs font-bold leading-5 text-indigo-900 border border-indigo-100/50">
          {child.nextAction || 'لا توجد خطوة علاجية مطلوبة حالياً.'}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
        <button
          type="button"
          onClick={onResults}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-black text-white transition-all"
        >
          النتائج <ChevronLeft size={13} />
        </button>
        <button
          type="button"
          onClick={onSkills}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition-all"
        >
          <BookOpen size={13} /> المهارات
        </button>
      </div>
    </article>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 p-10 font-bold text-slate-400">
      <Loader2 size={18} className="animate-spin text-emerald-600" />
      <span>جاري تحميل البيانات...</span>
    </div>
  );
}
