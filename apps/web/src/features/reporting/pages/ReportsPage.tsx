import{ArrowRight,BarChart3,CalendarDays,CheckCircle2,Compass,Download,FileText,Loader2,RefreshCcw,Sparkles,Target,Users}from'lucide-react';
import{useEffect,useMemo,useState}from'react';
import{Link}from'react-router-dom';

import{useAuth}from'../../auth/state/AuthProvider';
import{contentClient}from'../../content/api/content-client';
import type{TaxonomyCore}from'../../content/api/content-types';
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
 const[dateFrom,setDateFrom]=useState('');
 const[dateTo,setDateTo]=useState('');
 const[overview,setOverview]=useState<ReportingOverview|null>(null);
 const[results,setResults]=useState<ReportingResultPage|null>(null);
 const[busy,setBusy]=useState(true);
 const[exporting,setExporting]=useState(false);
 const[error,setError]=useState('');
 const[reload,setReload]=useState(0);
 const[taxonomy,setTaxonomy]=useState<TaxonomyCore>({paths:[],subjects:[]});
 const[pathId,setPathId]=useState('');
 const[subjectId,setSubjectId]=useState('');

 const isAdmin=Boolean(user?.roles.includes('admin'));
 const isStudent=Boolean(user?.roles.includes('student')&&!isAdmin);
 const supported=Boolean(user&&(isAdmin||isStudent||user.roles.includes('teacher')||user.roles.includes('supervisor')||user.roles.includes('school_admin')));
 const needsSchool=Boolean(user&&!isAdmin&&!isStudent);

 const studentSubjects=useMemo(()=>taxonomy.subjects.filter(row=>!pathId||row.pathId===pathId),[pathId,taxonomy.subjects]);

 useEffect(()=>{
  if(authLoading||!user||!isStudent)return;
  const controller=new AbortController();
  contentClient.taxonomyCore(controller.signal).then(setTaxonomy).catch(()=>{});
  return()=>controller.abort();
 },[authLoading,isStudent,user]);

 useEffect(()=>{
  if(subjectId&&!studentSubjects.some(row=>row.id===subjectId))setSubjectId('');
 },[studentSubjects,subjectId]);

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
  const period={dateFrom:dateFrom||undefined,dateTo:dateTo||undefined};
  if(isStudent)return{...period,pathId:pathId||undefined,subjectId:subjectId||undefined};
  if(isAdmin)return period;
  return{...period,schoolId,classId:classId||undefined};
 },[classId,dateFrom,dateTo,isAdmin,isStudent,pathId,schoolId,subjectId]);

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

 if(isStudent){
  const now=new Date();
  const toKey=(value:Date)=>value.toISOString().slice(0,10);
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
  const quarterStart=new Date(now.getFullYear(),now.getMonth()-2,1);
  const activePreset=!dateFrom&&!dateTo?'all':dateFrom===toKey(monthStart)&&dateTo===toKey(now)?'month':dateFrom===toKey(quarterStart)&&dateTo===toKey(now)?'quarter':'custom';
  const applyPreset=(preset:'month'|'quarter'|'all')=>{
   if(preset==='all'){setDateFrom('');setDateTo('');return}
   setDateFrom(toKey(preset==='month'?monthStart:quarterStart));
   setDateTo(toKey(now));
  };
  const masteryTone=(value:number)=>value<50
   ?{label:'ابدأ بها',wrap:'border-rose-100 bg-rose-50',text:'text-rose-700',bar:'bg-rose-500'}
   :value<75
    ?{label:'راجعها قريبًا',wrap:'border-amber-100 bg-amber-50',text:'text-amber-700',bar:'bg-amber-500'}
    :{label:'مطمئنة',wrap:'border-emerald-100 bg-emerald-50',text:'text-emerald-700',bar:'bg-emerald-500'};

  return <main id="reports-print-area" dir="rtl" className="mx-auto max-w-6xl space-y-6 px-3 pb-20 pt-5 sm:px-6">
   <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-3 sm:gap-4">
     <Link to="/dashboard" className="text-gray-500 transition hover:text-gray-700" aria-label="العودة للوحة الطالب"><ArrowRight size={24}/></Link>
     <div><h1 className="text-xl font-bold leading-tight text-gray-800 sm:text-2xl">تقارير الأداء</h1><p className="text-sm text-gray-500">تحليل مبسط لمستواك من نتائجك وأدلة الإتقان التي يسمح بها الخادم.</p></div>
    </div>
    <div className="flex flex-wrap gap-2">
     <button type="button" onClick={()=>setReload(x=>x+1)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm"><RefreshCcw size={15}/>تحديث</button>
     {overview?.scope.canExport?<button type="button" onClick={()=>void exportCsv()} disabled={exporting} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-black text-emerald-700 shadow-sm disabled:opacity-50">{exporting?<Loader2 size={15} className="animate-spin"/>:<Download size={15}/>}CSV</button>:null}
    </div>
   </header>

   <section className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${pathId?'border-emerald-200/90 bg-gradient-to-l from-emerald-50/60 via-white to-slate-50/50':'border-amber-200/90 bg-gradient-to-l from-amber-50/60 via-white to-slate-50/50'}`}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
     <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ${pathId?'bg-emerald-500':'bg-amber-500'}`}><Compass size={22}/></div>
      <div className="min-w-0 flex-1">
       <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-black ${pathId?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-800'}`}>{pathId?'تقاريرك مرتبة حسب مسارك':'اختر مسارك لتضييق التقرير'}</span>
       <h2 className="mt-1 text-sm font-black leading-snug text-gray-900 sm:text-base">{pathId?`نركز الآن على ${taxonomy.paths.find(row=>row.id===pathId)?.name||'المسار المختار'}${subjectId?` — ${studentSubjects.find(row=>row.id===subjectId)?.name||''}`:''}.`:'يمكنك إبقاء التقرير شاملًا أو تحديد المسار والمادة.'}</h2>
       <p className="mt-0.5 text-xs font-bold text-gray-500">التصفية ترسل path/subject فقط إلى Reporting API؛ لا يعاد بناء إتقان أو نتيجة داخل المتصفح.</p>
      </div>
     </div>
     <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[440px]">
      <select aria-label="مسار التقرير" value={pathId} onChange={e=>{setPathId(e.target.value);setSubjectId('')}} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-black text-gray-700"><option value="">كل المسارات</option>{taxonomy.paths.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select>
      <select aria-label="مادة التقرير" value={subjectId} disabled={!pathId} onChange={e=>setSubjectId(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-black text-gray-700 disabled:bg-gray-50"><option value="">كل مواد المسار</option>{studentSubjects.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select>
     </div>
    </div>
   </section>

   <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
     <div><div className="mb-1 inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-600"><CalendarDays size={14}/>الفترة الزمنية</div><p className="text-xs font-bold text-gray-500">نفس الفترة تطبق على الملخص والنتائج وCSV.</p></div>
     <div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>applyPreset('month')} className={`rounded-xl px-3 py-2 text-xs font-black ${activePreset==='month'?'bg-indigo-600 text-white':'bg-slate-100 text-slate-700'}`}>هذا الشهر</button>
      <button type="button" onClick={()=>applyPreset('quarter')} className={`rounded-xl px-3 py-2 text-xs font-black ${activePreset==='quarter'?'bg-indigo-600 text-white':'bg-slate-100 text-slate-700'}`}>آخر 3 أشهر</button>
      <button type="button" onClick={()=>applyPreset('all')} className={`rounded-xl px-3 py-2 text-xs font-black ${activePreset==='all'?'bg-indigo-600 text-white':'bg-slate-100 text-slate-700'}`}>كل الفترات</button>
     </div>
    </div>
    <details className="mt-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
     <summary className="cursor-pointer text-xs font-black text-slate-700">فترة مخصصة</summary>
     <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-black text-gray-600">من<input aria-label="بداية فترة التقرير" type="date" value={dateFrom} max={dateTo||undefined} onChange={e=>setDateFrom(e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-2.5 font-bold"/></label>
      <label className="text-xs font-black text-gray-600">إلى<input aria-label="نهاية فترة التقرير" type="date" value={dateTo} min={dateFrom||undefined} onChange={e=>setDateTo(e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-2.5 font-bold"/></label>
     </div>
    </details>
    {dateFrom||dateTo?<div className="mt-3 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800">الفترة المطبقة: {dateFrom||'البداية'} — {dateTo||'اليوم'}</div>:null}
   </section>

   {error?<div role="alert" className="rounded-2xl bg-rose-50 p-4 font-bold text-rose-700">{error}</div>:null}
   {busy?<div className="flex items-center justify-center gap-2 rounded-3xl border bg-white p-12 font-bold text-gray-500"><Loader2 size={18} className="animate-spin"/>جاري تحميل التقرير...</div>:overview?<>
    <section className="rounded-3xl border-0 bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-xl sm:p-6">
     <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black text-emerald-50"><Sparkles size={14}/>قراءة سريعة للتقرير</div>
     <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-white/20 bg-white/10 p-4"><div className="text-xs font-bold text-teal-100">أهم مؤشر</div><div className="mt-2 text-3xl font-black">{score(overview.assessment.averageScore)}</div><div className="mt-1 text-xs font-bold text-teal-100">متوسط الأداء</div></div>
      <div className="rounded-2xl border border-white/20 bg-white/10 p-4 sm:col-span-1"><div className="text-xs font-bold text-teal-100">أولوية المراجعة الآن</div><div className="mt-2 text-lg font-black leading-7">{overview.weakestSkills[0]?.skillName||'لا توجد مهارة ضعيفة مؤكدة'}</div></div>
      <div className="rounded-2xl border border-white/20 bg-white/10 p-4"><div className="text-xs font-bold text-teal-100">حالة النتائج</div><div className="mt-2 text-xl font-black">{overview.assessment.passed} ناجحة</div><div className="mt-1 text-xs font-bold text-teal-100">من {overview.assessment.resultCount} نتيجة</div></div>
     </div>
    </section>

    <section className="grid grid-cols-3 gap-3">
     <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-center"><div className="text-2xl font-black text-indigo-700">{score(overview.assessment.passRate)}</div><div className="mt-1 text-[11px] font-bold text-indigo-600">نسبة النجاح</div></div>
     <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center"><div className="text-2xl font-black text-emerald-700">{overview.assessment.passed}</div><div className="mt-1 text-[11px] font-bold text-emerald-600">نتائج ناجحة</div></div>
     <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-center"><div className="text-2xl font-black text-rose-700">{overview.weakestSkills.length}</div><div className="mt-1 text-[11px] font-bold text-rose-600">مهارات تبدأ بها</div></div>
    </section>

    {overview.scope.isTruncated||overview.assessment.resultsTruncated||overview.assessment.attemptsTruncated?<div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-900">هذا التقرير يستخدم حدود قراءة معلنة لحماية الأداء. الأرقام المعروضة تخص العينة المعلنة عند اتساع النطاق.</div>:null}

    <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
     <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-2 inline-flex rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-500">حالة إتقان المهارات الحالية</div><h2 className="text-xl font-black text-gray-900">المهارات التي تبدأ بها</h2></div><Link to="/plan" className="self-start rounded-xl bg-white px-3 py-2 text-xs font-black text-indigo-700 ring-1 ring-indigo-100 hover:bg-indigo-50">افتح خطتي</Link></div>
     <div className="mt-5 space-y-2">
      {overview.weakestSkills.length?overview.weakestSkills.map(row=>{const tone=masteryTone(row.mastery);return <article key={row.skillId} className={`rounded-2xl border p-3 ${tone.wrap}`}>
       <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full bg-white/70 px-3 py-1 text-[11px] font-black ${tone.text}`}>{tone.label}</span><span className="text-[11px] font-bold text-gray-500">{row.evidenceCount} دليل</span></div><div className="mt-2 font-black leading-7 text-gray-900">{row.skillName}</div><div className="mt-1 text-xs font-bold text-gray-500">متأثر بها {row.affectedStudents} طالب ضمن النطاق الحالي.</div></div>
        <div className="flex items-center gap-3"><div className={`w-14 text-center text-2xl font-black ${tone.text}`}>{score(row.mastery)}</div><div className="h-2 w-24 overflow-hidden rounded-full bg-white/80"><div className={`h-full rounded-full ${tone.bar}`} style={{width:`${Math.max(0,Math.min(100,row.mastery))}%`}}/></div></div>
       </div>
      </article>}):<div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm font-bold leading-7 text-gray-500"><CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={24}/>لا توجد مهارة تحقق شرط الأدلة والضعف في النطاق الحالي.</div>}
     </div>
    </section>

    <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
     <div className="flex items-center justify-between gap-3 border-b p-5"><div><h2 className="text-lg font-black">أحدث النتائج</h2><p className="mt-1 text-xs font-bold text-gray-500">ملخص نتيجة فقط؛ لا إجابات ولا answer keys.</p></div><Link to="/assessment-results" className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">اختباراتي</Link></div>
     {results?.items.length?<div className="divide-y">{results.items.map(row=><article key={row.attemptId} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="font-black">{row.title}</div><div className="mt-1 text-xs font-bold text-gray-500">{new Date(row.finalizedAt).toLocaleString('ar-SA')} · صحيح {row.correctAnswers} · خطأ {row.wrongAnswers} · دون إجابة {row.unanswered}</div></div><Link to={`/assessment-results/${row.attemptId}`} className="rounded-xl bg-indigo-50 px-4 py-2 text-center text-xl font-black text-indigo-700">{score(row.score)}</Link></article>)}</div>:<div className="p-8 text-center text-sm font-bold text-gray-500">لا توجد نتائج في النطاق الحالي.</div>}
    </section>
   </>:null}
  </main>;
 }

 return <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-5 sm:px-6"><div className="mx-auto max-w-7xl space-y-5">
  <header className="rounded-3xl bg-gradient-to-br from-indigo-700 to-slate-950 p-5 text-white shadow-lg sm:p-7">
   <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-xs font-black text-indigo-200">REPORTING</div><h1 className="mt-2 text-2xl font-black sm:text-3xl">{isStudent?'تقريري':'التقارير والتحليلات'}</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-indigo-100">قراءات bounded من الحقائق المملوكة للدومينات. الأرقام المعروضة لا تنشئ حالة تعليمية جديدة ولا تغيّر نتيجة أو إتقان.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setReload(x=>x+1)} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-sm font-black"><RefreshCcw size={15}/>تحديث</button>{overview?.scope.canExport?<button type="button" onClick={()=>void exportCsv()} disabled={exporting} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-900 disabled:opacity-50">{exporting?<Loader2 size={15} className="animate-spin"/>:<Download size={15}/>}CSV</button>:null}</div></div>
  </header>

  {needsSchool?<section className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-2"><label className="text-sm font-black text-gray-700">المدرسة<select aria-label="مدرسة التقرير" value={schoolId} onChange={e=>{setSchoolId(e.target.value);setClassId('')}} className="mt-2 w-full rounded-xl border p-2.5 font-bold"><option value="">اختر مدرسة</option>{contexts.map(row=><option key={row.schoolId} value={row.schoolId}>{row.schoolName}</option>)}</select></label><label className="text-sm font-black text-gray-700">الفصل<select aria-label="فصل التقرير" value={classId} onChange={e=>setClassId(e.target.value)} className="mt-2 w-full rounded-xl border p-2.5 font-bold"><option value="">كل النطاق المسموح</option>{classes.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label></section>:null}

  <section className="rounded-2xl border bg-white p-4 shadow-sm">
   <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 text-indigo-600" size={18}/><div><h2 className="text-sm font-black text-gray-800">الفترة الزمنية</h2><p className="mt-1 text-xs font-bold leading-6 text-gray-500">اختياري. يطبق النطاق نفسه على النظرة العامة والنتائج وCSV، ويظل التصفية داخل حدود الصلاحية الحالية.</p></div></div>
   <div className="mt-3 grid gap-3 sm:grid-cols-2">
    <label className="text-xs font-black text-gray-600">من<input aria-label="بداية فترة التقرير" type="date" value={dateFrom} max={dateTo||undefined} onChange={e=>setDateFrom(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 font-bold"/></label>
    <label className="text-xs font-black text-gray-600">إلى<input aria-label="نهاية فترة التقرير" type="date" value={dateTo} min={dateFrom||undefined} onChange={e=>setDateTo(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 font-bold"/></label>
   </div>
   {dateFrom||dateTo?<div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800"><span>الفترة المطبقة: {dateFrom||'البداية'} — {dateTo||'اليوم'}</span><button type="button" onClick={()=>{setDateFrom('');setDateTo('')}} className="rounded-lg bg-white px-2.5 py-1 font-black">مسح الفترة</button></div>:null}
  </section>

  {error?<div role="alert" className="rounded-2xl bg-rose-50 p-4 font-bold text-rose-700">{error}</div>:null}
  {busy?<div className="flex items-center justify-center gap-2 rounded-3xl border bg-white p-12 font-bold text-gray-500"><Loader2 size={18} className="animate-spin"/>جاري تحميل التقرير...</div>:overview?<>
   <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <Metric icon={Users} label="الطلاب في النطاق" value={String(overview.scope.studentCount)} note={overview.scope.isTruncated?`العينة الحالية ${overview.scope.sampledStudentCount}`:'النطاق ضمن الحد'}/>
    <Metric icon={FileText} label={overview.scope.isTruncated?'نتائج عينة الطلاب':'النتائج'} value={String(overview.assessment.resultCount)} note={overview.assessment.resultsTruncated?`حساب المتوسط من أحدث ${overview.assessment.sampledResultCount}`:(overview.scope.isTruncated?'العدد داخل عينة الطلاب المعلنة':'كل النتائج ضمن النطاق')}/>
    <Metric icon={BarChart3} label="متوسط الدرجة" value={score(overview.assessment.averageScore)} note={`نجاح ${score(overview.assessment.passRate)}`}/>
    <Metric icon={Target} label="مهارات ضعيفة" value={String(overview.weakestSkills.length)} note="تظهر بعد 3 أدلة على الأقل"/>
   </section>

   {overview.scope.isTruncated||overview.assessment.resultsTruncated||overview.assessment.attemptsTruncated?<div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-900">هذا التقرير يستخدم حدود قراءة معلنة لحماية الأداء. إجمالي الطلاب محفوظ منفصلًا عن العينة، وأرقام النتائج/المتوسط في النظرة العامة تخص عينة الطلاب المعلنة عند اتساع النطاق؛ قائمة النتائج والتصدير يعيدان تطبيق صلاحية النطاق كاملة بشكل مستقل.</div>:null}

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
