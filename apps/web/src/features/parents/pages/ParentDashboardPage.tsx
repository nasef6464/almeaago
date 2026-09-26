import{BookOpen,CalendarDays,ChevronLeft,Clock3,FileText,Loader2,RefreshCcw,Target,Users}from'lucide-react';
import{useEffect,useMemo,useState}from'react';
import{useAuth}from'../../auth/state/AuthProvider';
import{parentsClient}from'../api/parents-client';
import type{ParentChildSummary,ParentDashboard,ParentResultPage,ParentWeeklyReport}from'../api/parents-types';

type Tab='overview'|'results'|'skills'|'report';

function scoreTone(score:number){
 if(score>=80)return'bg-emerald-50 text-emerald-700 border-emerald-100';
 if(score>=60)return'bg-amber-50 text-amber-800 border-amber-100';
 return'bg-rose-50 text-rose-700 border-rose-100';
}
function score(score:number){return `${Math.round(score)}%`}
function date(value:string){return new Date(value).toLocaleDateString('ar-SA',{year:'numeric',month:'short',day:'numeric'})}

export function ParentDashboardPage(){
 const{user,loading:authLoading}=useAuth();
 const[data,setData]=useState<ParentDashboard|null>(null);
 const[tab,setTab]=useState<Tab>('overview');
 const[selectedId,setSelectedId]=useState('');
 const[results,setResults]=useState<ParentResultPage|null>(null);
 const[weekly,setWeekly]=useState<ParentWeeklyReport|null>(null);
 const[busy,setBusy]=useState(true);
 const[detailBusy,setDetailBusy]=useState(false);
 const[error,setError]=useState('');
 const[reload,setReload]=useState(0);

 useEffect(()=>{
  if(authLoading||!user||!user.roles.includes('parent'))return;
  const controller=new AbortController();setBusy(true);setError('');
  parentsClient.dashboard(1,20,controller.signal)
   .then(row=>{setData(row);setSelectedId(current=>row.children.some(x=>x.studentId===current)?current:(row.children[0]?.studentId||''))})
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل متابعة الأبناء')})
   .finally(()=>{if(!controller.signal.aborted)setBusy(false)});
  return()=>controller.abort();
 },[authLoading,reload,user]);

 useEffect(()=>{
  if(tab!=='results'||!selectedId)return;
  const controller=new AbortController();setDetailBusy(true);setError('');
  parentsClient.results(selectedId,1,20,controller.signal)
   .then(setResults)
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل النتائج')})
   .finally(()=>{if(!controller.signal.aborted)setDetailBusy(false)});
  return()=>controller.abort();
 },[selectedId,tab]);

 useEffect(()=>{
  if(tab!=='report')return;
  const controller=new AbortController();setDetailBusy(true);setError('');
  parentsClient.weeklyReport(1,20,controller.signal)
   .then(setWeekly)
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل التقرير الأسبوعي')})
   .finally(()=>{if(!controller.signal.aborted)setDetailBusy(false)});
  return()=>controller.abort();
 },[tab,reload]);

 const selected=useMemo(()=>data?.children.find(x=>x.studentId===selectedId)||data?.children[0]||null,[data,selectedId]);
 const priority=useMemo(()=>data?.children.flatMap(child=>child.weakSkills.map(skill=>({child,skill}))).sort((a,b)=>a.skill.mastery-b.skill.mastery).slice(0,3)||[],[data]);

 if(authLoading||busy)return <main dir="rtl" className="p-10 text-center font-black">جاري تحميل لوحة ولي الأمر...</main>;
 if(!user||!user.roles.includes('parent'))return <main dir="rtl" className="p-10 text-center font-black text-rose-700">هذه الصفحة مخصصة لولي الأمر.</main>;

 return <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-5 sm:px-6"><div className="mx-auto max-w-6xl space-y-5">
  <header className="rounded-3xl bg-gradient-to-br from-emerald-600 to-slate-950 p-5 text-white shadow-lg sm:p-7">
   <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><div className="text-xs font-black text-emerald-100">لوحة ولي الأمر</div><h1 className="mt-2 text-2xl font-black sm:text-3xl">متابعة الأبناء ببساطة</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-emerald-50">درجة، مهارة تحتاج متابعة، وخطوة واحدة واضحة. البيانات هنا تخص الأبناء المرتبطين بحسابك فقط.</p></div><button type="button" aria-label="تحديث لوحة ولي الأمر" onClick={()=>setReload(x=>x+1)} className="inline-flex self-start items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-black hover:bg-white/20"><RefreshCcw size={16}/>تحديث</button></div>
  </header>

  {error?<div role="alert" className="rounded-2xl bg-rose-50 p-4 font-bold text-rose-700">{error}</div>:null}

  <nav aria-label="أقسام لوحة ولي الأمر" className="grid grid-cols-2 gap-2 rounded-2xl border bg-white p-2 shadow-sm sm:grid-cols-4">
   {([
    ['overview','متابعة الأبناء',Users],['results','نتائج الأبناء',FileText],['skills','المهارات الضعيفة',Target],['report','تقرير الأسبوع',CalendarDays],
   ] as const).map(([id,label,Icon])=><button key={id} type="button" onClick={()=>setTab(id)} className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-black transition ${tab===id?'bg-emerald-600 text-white':'text-gray-600 hover:bg-gray-50'}`}><Icon size={16}/>{label}</button>)}
  </nav>

  {!data||data.children.length===0?<section className="rounded-3xl border bg-white p-10 text-center shadow-sm"><Users className="mx-auto text-gray-300" size={44}/><h2 className="mt-3 text-xl font-black text-gray-900">لا يوجد أبناء مرتبطون بالحساب</h2><p className="mt-2 text-sm leading-7 text-gray-500">تظهر المتابعة بعد إنشاء علاقة ولي أمر ↔ طالب نشطة من الجهة المخولة. لا تعرض هذه الصفحة أي طالب خارج العلاقات المعتمدة.</p></section>:<>
   <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs font-bold text-gray-500">الأبناء المرتبطون</div><div className="mt-2 text-2xl font-black">{data.summary.totalChildren}</div></div>
    <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs font-bold text-gray-500">اختبارات 7 أيام</div><div className="mt-2 text-2xl font-black text-blue-700">{data.summary.weeklyAssessmentCount}</div></div>
    <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs font-bold text-gray-500">متوسط الأسبوع</div><div className="mt-2 text-2xl font-black text-emerald-700">{score(data.summary.weeklyAverageScore)}</div></div>
    <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs font-bold text-gray-500">مهارات تحتاج متابعة</div><div className="mt-2 text-2xl font-black text-amber-700">{data.summary.weakSkills}</div></div>
   </section>

   {data.hasMore?<div className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">توجد علاقات أخرى؛ الصفحة الحالية تعرض أول 20 طالبًا فقط للحفاظ على قراءة bounded.</div>:null}

   {tab==='overview'?<div className="space-y-5">
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
     {data.children.map(child=><ChildCard key={child.studentId} child={child} onResults={()=>{setSelectedId(child.studentId);setTab('results')}} onSkills={()=>{setSelectedId(child.studentId);setTab('skills')}}/>)}
    </section>
    <section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Target size={19} className="text-amber-600"/><h2 className="font-black">أولوية المتابعة الآن</h2></div>{priority.length?<div className="mt-4 grid gap-3 md:grid-cols-3">{priority.map(({child,skill})=><div key={child.studentId+skill.skillId} className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><div className="text-xs font-black text-amber-700">{child.name}</div><div className="mt-1 font-black text-gray-900">{skill.skillName}</div><div className="mt-2 text-2xl font-black text-amber-800">{score(skill.mastery)}</div><p className="mt-2 text-xs font-bold leading-6 text-gray-600">{skill.recommendedAction}</p></div>)}</div>:<div className="mt-4 rounded-2xl bg-emerald-50 p-5 text-sm font-bold text-emerald-700">لا توجد مهارة أقل من حد الأداء الجيد في البيانات الحالية.</div>}</section>
   </div>:null}

   {tab==='results'?<section className="rounded-3xl border bg-white shadow-sm"><div className="border-b p-4 sm:p-5"><h2 className="text-xl font-black">نتائج الأبناء</h2><p className="mt-1 text-sm text-gray-500">ملخص النتيجة فقط؛ لا تعرض لوحة ولي الأمر إجابات الطالب أو مفاتيح الإجابة.</p><ChildSelector children={data.children} selectedId={selectedId} onSelect={setSelectedId}/></div>{detailBusy?<Loading/>:<div className="divide-y">{results?.items.length?results.items.map(row=><article key={row.attemptId} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="font-black">{row.title}</div><div className="mt-1 text-xs font-bold text-gray-500">المحاولة {row.attemptNumber} · {date(row.finalizedAt)} · {Math.round(row.timeSpentSeconds/60)} دقيقة</div><div className="mt-2 text-xs font-bold text-gray-500">صحيح {row.correctAnswers} · خطأ {row.wrongAnswers} · دون إجابة {row.unanswered}</div></div><div className={`rounded-2xl border px-4 py-3 text-xl font-black ${scoreTone(row.score)}`}>{score(row.score)}</div></article>):<div className="p-8 text-center text-sm font-bold text-gray-500">لا توجد نتائج مسجلة لهذا الطالب.</div>}</div>}</section>:null}

   {tab==='skills'?<section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5"><div><h2 className="text-xl font-black">المهارات التي تحتاج متابعة</h2><p className="mt-1 text-sm text-gray-500">مبنية على الحالة الحالية في Learning، وتعرض الخطوة الحتمية المسجلة بدل إنشاء توصية جديدة في الواجهة.</p><ChildSelector children={data.children} selectedId={selectedId} onSelect={setSelectedId}/></div>{selected?.weakSkills.length?<div className="mt-5 grid gap-3 md:grid-cols-2">{selected.weakSkills.map(item=><article key={item.skillId} className="rounded-2xl border bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-black">{item.skillName}</div><div className="mt-1 text-xs font-bold text-gray-500">{item.status} · {item.evidenceCount} دليل</div></div><span className={`rounded-xl border px-3 py-2 font-black ${scoreTone(item.mastery)}`}>{score(item.mastery)}</span></div><div className="mt-3 rounded-xl bg-white p-3 text-sm font-bold leading-7 text-indigo-800">{item.recommendedAction}</div></article>)}</div>:<div className="mt-5 rounded-2xl bg-emerald-50 p-5 text-sm font-bold text-emerald-700">لا توجد مهارات أقل من 75% لهذا الطالب في الحالة الحالية.</div>}</section>:null}

   {tab==='report'?<section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start gap-3"><CalendarDays className="mt-1 text-indigo-600" size={20}/><div><h2 className="text-xl font-black">التقرير الأسبوعي المبسط</h2><p className="mt-1 text-sm leading-7 text-gray-500">نافذة آخر 7 أيام من البيانات الموثقة. هذه المرحلة تعرض التقرير فقط؛ إرسال البريد/واتساب يتبع Communication ولا يتم تنفيذه من Parents.</p></div></div>{detailBusy?<Loading/>:<div className="mt-5 space-y-3">{weekly?.children.length?weekly.children.map(row=><article key={row.studentId} className="rounded-2xl border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-black">{row.name}</div><div className="mt-1 text-xs font-bold text-gray-500">{row.assessmentCount} اختبار · {row.studyMinutes} دقيقة تقييم خلال الأسبوع</div></div><div className={`self-start rounded-xl border px-3 py-2 font-black sm:self-auto ${scoreTone(row.averageScore)}`}>{score(row.averageScore)}</div></div>{row.weakSkills.length?<div className="mt-3 flex flex-wrap gap-2">{row.weakSkills.map(skill=><span key={skill.skillId} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">{skill.skillName} {score(skill.mastery)}</span>)}</div>:null}<div className="mt-3 rounded-xl bg-indigo-50 p-3 text-sm font-bold text-indigo-800">{row.nextAction||'استمرار المتابعة الهادئة وإعادة القياس عند توفر دليل جديد.'}</div></article>):<div className="p-8 text-center text-sm font-bold text-gray-500">لا توجد بيانات أسبوعية للأبناء المرتبطين.</div>}</div>}</section>:null}
  </>}
 </div></main>;
}

function ChildSelector({children,selectedId,onSelect}:{children:ParentChildSummary[];selectedId:string;onSelect:(id:string)=>void}){
 return <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{children.map(child=><button key={child.studentId} type="button" onClick={()=>onSelect(child.studentId)} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-black ${selectedId===child.studentId?'border-emerald-600 bg-emerald-50 text-emerald-800':'bg-white text-gray-600'}`}>{child.name}</button>)}</div>;
}

function ChildCard({child,onResults,onSkills}:{child:ParentChildSummary;onResults:()=>void;onSkills:()=>void}){
 const latest=child.recentResults[0];
 return <article data-testid="parent-child-card" className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-emerald-100 font-black text-emerald-800">{child.avatarUrl?<img src={child.avatarUrl} alt="" className="h-full w-full object-cover"/>:child.name.slice(0,1)}</div><div><h2 className="font-black">{child.name}</h2><div className="mt-1 text-xs font-bold text-gray-400">{child.schoolIds.length?'مرتبط ضمن نطاق مدرسي':'علاقة ولي أمر مباشرة'}</div></div></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-blue-50 p-3"><div className="text-[11px] font-bold text-blue-700">آخر نتيجة</div><div className="mt-1 text-xl font-black text-blue-900">{latest?score(latest.score):'—'}</div></div><div className="rounded-2xl bg-slate-50 p-3"><div className="flex items-center gap-1 text-[11px] font-bold text-gray-500"><Clock3 size={12}/>وقت التقييم أسبوعيًا</div><div className="mt-1 text-xl font-black">{child.weeklyStudyMinutes} د</div></div></div><div className="mt-3 rounded-xl bg-indigo-50 p-3 text-xs font-bold leading-6 text-indigo-800">{child.nextAction||'لا توجد خطوة علاجية مطلوبة حاليًا.'}</div><div className="mt-4 flex gap-2"><button type="button" onClick={onResults} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white">النتائج<ChevronLeft size={14}/></button><button type="button" onClick={onSkills} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border px-3 py-2 text-xs font-black text-gray-700"><BookOpen size={14}/>المهارات</button></div></article>;
}

function Loading(){return <div className="flex items-center justify-center gap-2 p-8 font-bold text-gray-500"><Loader2 size={18} className="animate-spin"/>جاري التحميل...</div>}
