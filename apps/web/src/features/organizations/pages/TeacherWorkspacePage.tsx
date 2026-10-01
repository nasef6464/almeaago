import{BarChart3,BookOpenCheck,LayoutDashboard,Presentation,School,Target,Trophy}from'lucide-react';
import{useEffect,useState}from'react';
import{Link}from'react-router-dom';
import{useAuth}from'../../auth/state/AuthProvider';
import{organizationsClient,type TeacherWorkspace}from'../../organizations/api/organizations-client';

const items=[
 {to:'/school-teacher-dashboard/classroom',label:'إدارة الحصص والجدول',icon:Presentation},
 {to:'/admin-dashboard/questions',label:'بنك التحضير المسبق',icon:Target},
 {to:'/reports',label:'تقارير الحصص والمهارات',icon:BarChart3},
 {to:'/reports',label:'رادار فجوات الفصول',icon:BarChart3},
 {to:'/admin-dashboard/assessments',label:'اختبارات المدرسة',icon:BookOpenCheck},
];
export function TeacherWorkspacePage(){
 const{user,loading}=useAuth();const[workspace,setWorkspace]=useState<TeacherWorkspace|null>(null);const[error,setError]=useState('');
 useEffect(()=>{if(loading||!user)return;const c=new AbortController();organizationsClient.teacherWorkspace(c.signal).then(setWorkspace).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل مساحة المعلم')});return()=>c.abort()},[loading,user]);
 if(loading)return <main dir="rtl" className="p-10 text-center font-black">جاري تحميل مساحة المعلم...</main>;
 if(!user||(!user.roles.includes('teacher')&&!user.roles.includes('admin')))return <main dir="rtl" className="p-10 text-center font-black text-rose-700">هذه المساحة للمعلم المخول.</main>;
 if(error)return <main dir="rtl" className="p-10 text-center font-black text-rose-700">{error}</main>;
 if(!workspace)return <main dir="rtl" className="p-10 text-center font-black">جاري تحميل نطاق التدريس...</main>;
 const school=workspace.schools[0];
 return <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 px-3 py-5 sm:px-6" data-testid="teacher-workspace"><div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[300px_1fr]">
  <aside className="rounded-3xl border bg-white py-6 shadow-sm"><div className="mb-5 px-6"><div className="flex items-center gap-2 text-xs font-bold text-indigo-700"><School size={14}/>مساحة مدرسة مستقلة (B2B)</div><h1 className="mt-1 text-lg font-black">لوحة معلم المدرسة</h1><p className="mt-1 text-xs font-bold text-gray-500">{school?.schoolName||'لا توجد مدرسة مسندة'}</p></div><nav aria-label="تنقل لوحة معلم المدرسة" className="space-y-1 px-3"><Link to="/school-teacher-dashboard" className="flex items-center gap-3 rounded-xl border-r-4 border-indigo-600 bg-indigo-50 px-4 py-2.5 text-xs font-black text-indigo-700"><LayoutDashboard size={19}/>نظرة عامة</Link>{items.map(({to,label,icon:Icon})=><Link key={label} to={to} className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50"><Icon size={19}/>{label}</Link>)}<span className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-400" aria-disabled="true"><Trophy size={19}/>شهادات التقدير والتحفيز</span></nav></aside>
  <section className="space-y-5"><header className="rounded-3xl bg-gradient-to-l from-indigo-700 to-slate-950 p-6 text-white shadow-xl"><p className="text-xs font-black text-indigo-200">مساحة المعلم</p><h2 className="mt-2 text-2xl font-black">مرحباً {user.name}</h2><p className="mt-2 text-sm font-bold text-indigo-100">إدارة يومك الدراسي من نطاقات التدريس التي يمنحها الخادم.</p></header>
  {!school?<div className="rounded-3xl border border-dashed bg-white p-8 text-center font-bold text-gray-500">لا توجد مهمة تدريس مدرسية فعالة لهذا الحساب.</div>:<><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-4"><div className="text-xs font-bold text-gray-500">الفصول المسندة</div><div className="mt-2 text-2xl font-black">{school.assignments.length}</div></div><div className="rounded-2xl border bg-white p-4"><div className="text-xs font-bold text-gray-500">الطلاب ضمن النطاق</div><div className="mt-2 text-2xl font-black">{school.assignments.reduce((n,a)=>n+a.studentCount,0)}</div></div><div className="rounded-2xl border bg-white p-4"><div className="text-xs font-bold text-gray-500">المدرسة</div><div className="mt-2 font-black">{school.schoolName}</div></div></div><section className="rounded-3xl border bg-white p-5 shadow-sm"><h3 className="font-black">فصولي وموادي</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{school.assignments.map(a=><article key={a.assignmentId} className="rounded-2xl bg-slate-50 p-4"><div className="font-black">{a.className}</div><div className="mt-1 text-xs font-bold text-gray-500">{a.studentCount} طالب</div><Link to="/school-teacher-dashboard/classroom" className="mt-3 inline-flex rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white">فتح الفصل الذكي</Link></article>)}</div></section></>}</section>
 </div></main>;
}
