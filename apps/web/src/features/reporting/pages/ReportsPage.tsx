import{BarChart3,Download,FileText,Loader2,RefreshCcw,Target,Users}from'lucide-react';
import{useEffect,useMemo,useState}from'react';

import{useAuth}from'../../auth/state/AuthProvider';
import{organizationsClient,type SchoolClass,type SchoolContext}from'../../organizations/api/organizations-client';
import{reportingClient}from'../api/reporting-client';
import type{ReportingOverview,ReportingQuery,ReportingResultPage}from'../api/reporting-types';

function score(value:number){return `${Math.round(value)}%`}
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}

export function ReportsPage(){
 const{user,loading:authLoading}=useAuth();
 const[contexts,setContexts]=useState<SchoolContext[]>([]);
 const[classes,setClasses]=useState<SchoolClass[]>([]);
 const[schoolId,setSchoolId]=useState('');
 const[classId,setClassId]=useState('');
 const[overview,setOverview]=useState<ReportingOverview|null>(null);
 const[results,setResults]=useState<ReportingResultPage|null>(null);
 const[busy,setBusy]=useState(true);
 const[exporting,setExporting]=useState(false);
 const[error,setError]=useState('');
 const[reload,setReload]=useState(0);

 const isAdmin=Boolean(user?.roles.includes('admin'));
 const isStudent=Boolean(user?.roles.includes('student')&&!isAdmin);
 const supported=Boolean(user&&(isAdmin||isStudent||user.roles.includes('teacher')||user.roles.includes('supervisor')||user.roles.includes('school_admin')));
 const needsSchool=Boolean(user&&!isAdmin&&!isStudent);

 useEffect(()=>{
  if(authLoading||!user||!needsSchool)return;
  const controller=new AbortController();
  organizationsClient.contexts(controller.signal).then(out=>{
   const rows=out.contexts.filter(x=>['teacher','supervisor','school_admin'].includes(x.role));
   setContexts(rows);
   setSchoolId(current=>current&&rows.some(x=>x.schoolId===current)?current:(rows[0]?.schoolId||''));
  }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل نطاقات المدارس')});
  return()=>controller.abort();
 },[authLoading,needsSchool,user]);

 useEffect(()=>{
  if(!needsSchool||!schoolId){setClasses([]);setClassId('');return}
  const controller=new AbortController();
  organizationsClient.classes(schoolId,controller.signal).then(out=>{
   setClasses(out.classes);
   setClassId(current=>current&&out.classes.some(x=>x.id===current)?current:'');
  }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل الفصول')});
  return()=>controller.abort();
 },[needsSchool,schoolId]);

 const query=useMemo<ReportingQuery>(()=>{
  if(isAdmin||isStudent)return{};
  return{schoolId,classId:classId||undefined};
 },[classId,isAdmin,isStudent,schoolId]);

 useEffect(()=>{
  if(authLoading||!user||!supported||(needsSchool&&!schoolId))return;
  const controller=new AbortController();setBusy(true);setError('');
  Promise.all([reportingClient.overview(query,controller.signal),reportingClient.results(query,1,20,controller.signal)])
   .then(([o,r])=>{setOverview(o);setResults(r)})
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل التقارير')})
   .finally(()=>{if(!controller.signal.aborted)setBusy(false)});
  return()=>controller.abort();
 },[authLoading,needsSchool,query,reload,schoolId,supported,user]);

 async function exportCsv(){
  setExporting(true);setError('');
  try{const blob=await reportingClient.exportCsv(query);download(blob,schoolId?'school-assessment-results.csv':'assessment-results.csv')}
  catch(e){setError(e instanceof Error?e.message:'تعذر تصدير التقرير')}
  finally{setExporting(false)}
 }

 if(authLoading)return <main dir="rtl" className="p-10 text-center font-black">جاري التحقق من الحساب...</main>;
 if(!user)return <main dir="rtl" className="p-10 text-center font-black text-rose-700">سجّل الدخول لعرض التقارير.</main>;
 if(!supported)return <main dir="rtl" className="p-10 text-center font-black text-rose-700">لا يوجد نطاق تقارير لهذا الدور.</main>;

 return <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-5 sm:px-6"><div className="mx-auto max-w-7xl space-y-5">
  <header className="rounded-3xl bg-gradient-to-br from-indigo-700 to-slate-950 p-5 text-white shadow-lg sm:p-7">
   <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-xs font-black text-indigo-200">REPORTING</div><h1 className="mt-2 text-2xl font-black sm:text-3xl">{isStudent?'تقريري':'التقارير والتحليلات'}</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-indigo-100">قراءات bounded من الحقائق المملوكة للدومينات. الأرقام المعروضة لا تنشئ حالة تعليمية جديدة ولا تغيّر نتيجة أو إتقان.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setReload(x=>x+1)} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-sm font-black"><RefreshCcw size={15}/>تحديث</button>{overview?.scope.canExport?<button type="button" onClick={()=>void exportCsv()} disabled={exporting} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-900 disabled:opacity-50">{exporting?<Loader2 size={15} className="animate-spin"/>:<Download size={15}/>}CSV</button>:null}</div></div>
  </header>

  {needsSchool?<section className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-2"><label className="text-sm font-black text-gray-700">المدرسة<select aria-label="مدرسة التقرير" value={schoolId} onChange={e=>{setSchoolId(e.target.value);setClassId('')}} className="mt-2 w-full rounded-xl border p-2.5 font-bold"><option value="">اختر مدرسة</option>{contexts.map(row=><option key={row.schoolId} value={row.schoolId}>{row.schoolName}</option>)}</select></label><label className="text-sm font-black text-gray-700">الفصل<select aria-label="فصل التقرير" value={classId} onChange={e=>setClassId(e.target.value)} className="mt-2 w-full rounded-xl border p-2.5 font-bold"><option value="">كل النطاق المسموح</option>{classes.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label></section>:null}

  {error?<div role="alert" className="rounded-2xl bg-rose-50 p-4 font-bold text-rose-700">{error}</div>:null}
  {busy?<div className="flex items-center justify-center gap-2 rounded-3xl border bg-white p-12 font-bold text-gray-500"><Loader2 size={18} className="animate-spin"/>جاري تحميل التقرير...</div>:overview?<>
   <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <Metric icon={Users} label="الطلاب في النطاق" value={String(overview.scope.studentCount)} note={overview.scope.isTruncated?`العينة الحالية ${overview.scope.sampledStudentCount}`:'النطاق ضمن الحد'}/>
    <Metric icon={FileText} label="النتائج" value={String(overview.assessment.resultCount)} note={overview.assessment.resultsTruncated?`حساب المتوسط من أحدث ${overview.assessment.sampledResultCount}`:'كل النتائج ضمن العينة'}/>
    <Metric icon={BarChart3} label="متوسط الدرجة" value={score(overview.assessment.averageScore)} note={`نجاح ${score(overview.assessment.passRate)}`}/>
    <Metric icon={Target} label="مهارات ضعيفة" value={String(overview.weakestSkills.length)} note="تظهر بعد 3 أدلة على الأقل"/>
   </section>

   {overview.scope.isTruncated||overview.assessment.resultsTruncated||overview.assessment.attemptsTruncated?<div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-900">هذا التقرير يستخدم حدود قراءة معلنة لحماية الأداء. العدد الكلي محفوظ منفصلًا عن العينة، ولا يتم تقديم المتوسط العيني على أنه كامل إذا كانت النتائج truncated.</div>:null}

   <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
    <div className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-black">أضعف المهارات في العينة</h2>{overview.weakestSkills.length?<div className="mt-4 space-y-3">{overview.weakestSkills.map(row=><article key={row.skillId} className="rounded-2xl border bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-black">{row.skillName}</div><div className="mt-1 text-xs font-bold text-gray-500">{row.evidenceCount} دليل · {row.affectedStudents} طالب</div></div><span className="rounded-xl bg-rose-50 px-3 py-2 font-black text-rose-700">{score(row.mastery)}</span></div></article>)}</div>:<div className="mt-4 rounded-2xl bg-emerald-50 p-5 text-sm font-bold text-emerald-700">لا توجد مهارة تحقق شرط الأدلة والضعف في العينة الحالية.</div>}</div>

    <div className="overflow-hidden rounded-3xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-lg font-black">أحدث النتائج</h2><p className="mt-1 text-xs font-bold text-gray-500">تفاصيل نتيجة مختصرة فقط؛ لا إجابات طالب أو answer keys.</p></div>{results?.items.length?<div className="divide-y">{results.items.map(row=><article key={row.attemptId} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="font-black">{row.studentName?row.studentName+' · ':''}{row.title}</div><div className="mt-1 text-xs font-bold text-gray-500">{new Date(row.finalizedAt).toLocaleString('ar-SA')} · صحيح {row.correctAnswers} · خطأ {row.wrongAnswers} · دون إجابة {row.unanswered}</div></div><div className="rounded-xl bg-indigo-50 px-4 py-2 text-xl font-black text-indigo-700">{score(row.score)}</div></article>)}</div>:<div className="p-8 text-center text-sm font-bold text-gray-500">لا توجد نتائج في النطاق الحالي.</div>}</div>
   </section>
  </>:null}
 </div></main>;
}

function Metric({icon:Icon,label,value,note}:{icon:typeof Users;label:string;value:string;note:string}){
 return <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-xs font-black text-gray-500"><Icon size={15}/>{label}</div><div className="mt-2 text-2xl font-black text-gray-900">{value}</div><div className="mt-1 text-[11px] font-bold text-gray-400">{note}</div></div>
}
