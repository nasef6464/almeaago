import { Award, BarChart3, BookOpenCheck, LayoutDashboard, Presentation, School, Target, Trophy, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { organizationsClient, type TeacherWorkspace } from '../api/organizations-client';

// Same order and labels as the approved SchoolTeacherDashboard in Legacy.
// A disabled entry is deliberately not a link to an unrelated platform-admin route.
const sections = [
  { id: 'learning-evidence', label: 'التعلم والجاهزية', icon: Target },
  { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
  { id: 'smart-classroom', label: 'إدارة الحصص والجدول', icon: Presentation },
  { id: 'prepared-questions', label: 'بنك التحضير المسبق', icon: Target },
  { id: 'reports', label: 'تقارير الحصص', icon: BarChart3 },
  { id: 'skills-radar', label: 'مهارات الحصص', icon: Award },
  { id: 'assessments', label: 'اختباراتي وتكليفاتي', icon: BookOpenCheck },
  { id: 'certificates', label: 'شهادات التقدير والتحفيز', icon: Trophy },
] as const;

const groups = [
  { label: 'الرئيسية', ids: ['overview'] },
  { label: 'الحصص وتحضير الأسئلة', ids: ['smart-classroom', 'prepared-questions'] },
  { label: 'الاختبارات والتكليفات', ids: ['assessments'] },
  { label: 'المهارات والتقارير', ids: ['learning-evidence', 'skills-radar', 'reports'] },
  { label: 'الشهادات', ids: ['certificates'] },
] as const;

function classroomURL(schoolId: string, assignmentId: string) {
  return '/school-teacher-dashboard/classroom?' + new URLSearchParams({ schoolId, assignmentId }).toString();
}

export function TeacherWorkspacePage() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workspace, setWorkspace] = useState<TeacherWorkspace | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const isTeacher = Boolean(user?.roles.includes('teacher'));
  const requestedSchoolId = searchParams.get('schoolId') || '';

  useEffect(() => {
    if (authLoading) return;
    if (!isTeacher) {
      setWorkspace(null);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    setWorkspace(null);
    setError('');
    organizationsClient.teacherWorkspace(controller.signal)
      .then(result => {
        if (!controller.signal.aborted) setWorkspace(result);
      })
      .catch(cause => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'تعذر تحميل مساحة المعلم');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [authLoading, isTeacher, user?.id, retry]);

  if (authLoading) return <main dir="rtl" className="p-10 text-center font-black">جاري تحميل مساحة المعلم...</main>;
  if (!isTeacher) return <main dir="rtl" className="p-10 text-center font-black text-rose-700">هذه المساحة للمعلم المخول.</main>;
  if (busy) return <main dir="rtl" className="p-10 text-center font-black">جاري تحميل نطاق التدريس...</main>;
  if (error) return <main dir="rtl" className="p-10 text-center">
    <p role="alert" className="font-black text-rose-700">{error}</p>
    <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-4 rounded-xl bg-indigo-700 px-4 py-2 font-bold text-white">إعادة المحاولة</button>
  </main>;
  if (!workspace) return null;

  const school = requestedSchoolId
    ? workspace.schools.find(item => item.schoolId === requestedSchoolId)
    : workspace.schools[0];
  const hasUnknownSchool = Boolean(requestedSchoolId && !school);
  const students = school?.assignments.reduce((total, assignment) => total + assignment.studentCount, 0) || 0;

  return <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 px-3 py-5 sm:px-6" data-testid="teacher-workspace">
    <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[300px_1fr]">
      <aside className="rounded-3xl border bg-white py-6 shadow-sm">
        <div className="mb-5 px-6">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold text-indigo-700"><School size={14} />مساحة المدرسة</div>
          <h1 className="text-lg font-black">لوحة معلم المدرسة</h1>
          <p className="mt-1 text-xs font-bold text-gray-500">{school?.schoolName || 'لا توجد مدرسة مسندة'}</p>
          {workspace.schools.length > 1 || hasUnknownSchool ? <div className="mt-3">
            <label htmlFor="teacher-school" className="mb-1 block text-xs font-bold text-slate-600">المدرسة الحالية</label>
            <select id="teacher-school" value={school?.schoolId || ''} onChange={event => {
              setSearchParams(previous => {
                const next = new URLSearchParams(previous);
                next.set('schoolId', event.target.value);
                return next;
              });
            }} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold">
              {hasUnknownSchool ? <option value="">اختر مدرسة</option> : null}
              {workspace.schools.map(item => <option key={item.schoolId} value={item.schoolId}>{item.schoolName}</option>)}
            </select>
          </div> : null}
          {workspace.personas.platformTrainer && workspace.personas.schoolTeacher ? <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-xs font-black">
            <span aria-disabled="true" className="rounded-lg px-2 py-2 text-center text-slate-500">المنصة</span>
            <span className="rounded-lg bg-white px-2 py-2 text-center text-indigo-700 shadow-sm">المدرسة</span>
          </div> : null}
        </div>
        <nav aria-label="تنقل لوحة معلم المدرسة" className="space-y-3 px-3">
          {groups.map((group, index) => <details key={group.label} open={index === 0 ? true : undefined} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-2">
            <summary className="cursor-pointer list-none rounded-lg px-2 py-2 text-sm font-black text-slate-700">{group.label}</summary>
            <div className="space-y-1 pt-2">
              {group.ids.map(id => {
                const item = sections.find(section => section.id === id);
                if (!item) return null;
                const Icon = item.icon;
                const classes = 'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-right text-xs font-bold ';
                if (id === 'overview') return <Link key={id} aria-current="page" to={'/school-teacher-dashboard' + (school ? '?schoolId=' + encodeURIComponent(school.schoolId) : '')} className={classes + 'border-indigo-200 bg-indigo-50 text-indigo-800'}><Icon size={19} />{item.label}</Link>;
                if (id === 'smart-classroom' && school?.assignments.length) return <Link key={id} to={classroomURL(school.schoolId, school.assignments[0].assignmentId)} className={classes + 'border-slate-200 bg-white text-slate-700'}><Icon size={19} />{item.label}</Link>;
                return <span key={id} aria-disabled="true" className={classes + 'border-slate-200 bg-white text-slate-400'}><Icon size={19} />{item.label}</span>;
              })}
            </div>
          </details>)}
        </nav>
      </aside>

      <section className="min-w-0 space-y-5">
        {hasUnknownSchool ? <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 font-black text-amber-900">المدرسة المحددة لم تعد ضمن تكليفاتك</div>
          : !school ? <div className="rounded-2xl border border-dashed bg-white p-8 text-center font-bold text-gray-500">لا توجد مهمة تدريس مدرسية فعالة لهذا الحساب.</div>
          : <>
            <header className="rounded-3xl bg-gradient-to-l from-indigo-800 via-indigo-900 to-slate-900 p-6 text-white shadow-lg">
              <span className="rounded-md bg-indigo-500/30 px-2.5 py-1 text-xs font-black text-indigo-200">مساحة تعليمية مدرسية معتمدة</span>
              <h2 className="mt-3 text-2xl font-black sm:text-3xl">مرحباً بك، {user?.name || 'أستاذ المادة'} 👋</h2>
              <p className="mt-2 text-xs leading-6 text-indigo-100 sm:text-sm">من هنا تدير فصولك المسندة في {school.schoolName}، وتبدأ الحصص التفاعلية، وتتابع الفجوات الصفية.</p>
            </header>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border bg-white p-5"><UsersRound size={20} className="text-emerald-600" /><div className="mt-2 text-xs font-bold text-slate-500">طلاب فصولي</div><div className="mt-2 text-2xl font-black">{students}</div></div>
              <div className="rounded-2xl border bg-white p-5"><Presentation size={20} className="text-indigo-600" /><div className="mt-2 text-xs font-bold text-slate-500">الحصص الذكية</div><div className="mt-2 text-sm font-black">—</div></div>
              <div className="rounded-2xl border bg-white p-5"><BookOpenCheck size={20} className="text-amber-600" /><div className="mt-2 text-xs font-bold text-slate-500">اختبارات المدرسة</div><div className="mt-2 text-sm font-black text-slate-500">—</div></div>
              <div className="rounded-2xl border bg-white p-5"><School size={20} className="text-purple-600" /><div className="mt-2 text-xs font-bold text-slate-500">المدرسة الحالية</div><div className="mt-2 truncate text-sm font-black">{school.schoolName}</div></div>
            </div>
            <section className="rounded-3xl border bg-white p-6">
              <h3 className="text-base font-black">فصولي المسندة وجدول الحصص</h3>
              {school.assignments.length ? <div className="mt-4 grid gap-4 md:grid-cols-2">
                {school.assignments.map(assignment => <article key={assignment.assignmentId} className="rounded-2xl border bg-slate-50/50 p-5">
                  <h4 className="text-base font-black">{assignment.className}</h4>
                  <p className="mt-1 text-xs font-bold text-emerald-700">{assignment.studentCount} طالب</p>
                  <Link to={classroomURL(school.schoolId, assignment.assignmentId)} className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white">بدء حصة ذكية لهذا الفصل</Link>
                </article>)}
              </div> : <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-slate-500">لا توجد فصول مسندة لهذه المدرسة.</p>}
            </section>
          </>}
      </section>
    </div>
  </main>;
}
