import {ArrowRight,BookOpenCheck,CheckCircle2,ChevronLeft,ChevronRight,FileText,Loader2,Play,Target} from 'lucide-react';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Link,Navigate,useNavigate,useSearchParams} from 'react-router-dom';
import {useAuth} from '../../auth/state/AuthProvider';
import {contentClient} from '../../content/api/content-client';
import type {LearningSpace,TaxonomyCore} from '../../content/api/content-types';
import {assessmentPlacementClient} from '../api/assessment-placement-client';
import type {AssessmentPlacementSlot,LearnerAssessmentPlacement} from '../api/assessment-types';
const slotLabels:Record<AssessmentPlacementSlot,string>={training:'تدريبات',tests:'اختبارات',foundation:'التأسيس',course:'الدورات'};
const placementKey=(id:string)=>{const k=`assessment-placement-start:${id}`;let v=sessionStorage.getItem(k);if(!v){v=crypto.randomUUID();sessionStorage.setItem(k,v)}return v};
const accessLabel=(row:LearnerAssessmentPlacement)=>{
 if(row.accessAllowed)return row.canStart?'ابدأ الاختبار':'استُنفدت المحاولات';
 if(row.accessReason==='directed_assignment_required')return 'خاص بتكليف مباشر';
 if(row.accessReason==='course_context_required')return 'يتطلب وصول الدورة';
 return 'يتطلب تفعيل باقة أو صلاحية';
};
export function AssessmentAvailabilityPage({ embedded }: { embedded?: boolean } = {}){const{user,loading:authLoading,getCsrfToken}=useAuth();const navigate=useNavigate();const[params]=useSearchParams();const[taxonomy,setTaxonomy]=useState<TaxonomyCore>({paths:[],subjects:[]});const[pathId,setPathId]=useState(params.get('pathId')||'');const[subjectId,setSubjectId]=useState(params.get('subjectId')||'');const[slot,setSlot]=useState<AssessmentPlacementSlot>(()=>{const requested=params.get('slot');return requested&&Object.prototype.hasOwnProperty.call(slotLabels,requested)?requested as AssessmentPlacementSlot:'tests'});const[courseId,setCourseId]=useState(params.get('courseId')||'');const[topicId,setTopicId]=useState(params.get('topicId')||'');const[space,setSpace]=useState<LearningSpace|null>(null);const[rows,setRows]=useState<LearnerAssessmentPlacement[]>([]);const[page,setPage]=useState(1);const[hasMore,setHasMore]=useState(false);const[busy,setBusy]=useState(false);const[starting,setStarting]=useState('');const[error,setError]=useState('');const[listFailed,setListFailed]=useState(false);const startingRef=useRef('');
useEffect(()=>{const c=new AbortController();contentClient.taxonomyCore(c.signal).then(setTaxonomy).catch(()=>{});return()=>c.abort()},[]);
const subjects=useMemo(()=>taxonomy.subjects.filter(x=>!pathId||x.pathId===pathId),[pathId,taxonomy.subjects]);useEffect(()=>{if(subjectId&&!subjects.some(x=>x.id===subjectId)){setSubjectId('');setCourseId('');setTopicId('')}},[subjectId,subjects]);
useEffect(()=>{if(!pathId||!subjectId||(slot!=='course'&&slot!=='foundation')){setSpace(null);return}const c=new AbortController();setSpace(null);contentClient.learningSpace(pathId,subjectId,50,c.signal).then(r=>{if(!c.signal.aborted)setSpace(r)}).catch(()=>{if(!c.signal.aborted)setSpace(null)});return()=>c.abort()},[pathId,slot,subjectId]);
useEffect(()=>{setPage(1);if(slot!=='course')setCourseId('');if(slot!=='foundation')setTopicId('')},[slot]);
const contextReady=Boolean(pathId&&subjectId&&((slot==='course'&&courseId)||(slot==='foundation'&&topicId)||slot==='training'||slot==='tests'));
useEffect(()=>{if(authLoading||!user||!user.roles.includes('student')||!contextReady){setRows([]);setHasMore(false);setBusy(false);setListFailed(false);return}const c=new AbortController();setBusy(true);setRows([]);setHasMore(false);setListFailed(false);setError('');assessmentPlacementClient.available({page,limit:30,slot,pathId,subjectId,courseId:slot==='course'?courseId:undefined,topicId:slot==='foundation'?topicId:undefined},c.signal).then(r=>{if(c.signal.aborted)return;setRows(r.items);setHasMore(r.hasMore)}).catch(e=>{if(!c.signal.aborted){setRows([]);setHasMore(false);setListFailed(true);setError(e instanceof Error?e.message:'تعذر تحميل الاختبارات المتاحة')}}).finally(()=>{if(!c.signal.aborted)setBusy(false)});return()=>c.abort()},[authLoading,contextReady,courseId,page,pathId,slot,subjectId,topicId,user]);
async function start(row:LearnerAssessmentPlacement){if(startingRef.current||!row.accessAllowed||!row.canStart)return;startingRef.current=row.placementId;setStarting(row.placementId);setError('');try{const csrf=await getCsrfToken();const r=await assessmentPlacementClient.start(row.placementId,placementKey(row.placementId),csrf);sessionStorage.removeItem(`assessment-placement-start:${row.placementId}`);navigate(`/assessment-attempts/${r.attempt.id}`)}catch(e){setError(e instanceof Error?e.message:'تعذر بدء الاختبار')}finally{startingRef.current='';setStarting('')}}
if(authLoading)return <div className="p-10 text-center font-black">جاري التحقق من الجلسة...</div>;
if(!embedded && (!user || user.roles.includes('student'))){
  return <Navigate to="/dashboard?tab=assessments" replace />;
}
if(!user||!user.roles.includes('student'))return <div className="p-10 text-center font-black text-rose-700">هذه الشاشة مخصصة للطالب.</div>;

const ContainerTag = embedded ? 'div' : 'main';

return <ContainerTag dir="rtl" className={`mx-auto max-w-5xl space-y-6 ${embedded ? 'p-0 w-full' : 'px-3 pb-20 pt-5 sm:px-6'}`}>
  <header className="flex items-center gap-4">
    {!embedded ? (
      <Link to="/dashboard" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition" aria-label="العودة للوحة الطالب"><ArrowRight size={24}/></Link>
    ) : null}
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black">
        <span className="rounded-full bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800/60 px-3 py-1.5 text-amber-700 dark:text-amber-300">اختبارات المنصة</span>
        <Link to={embedded ? "/dashboard?tab=assignments" : "/assessment-assignments"} className="rounded-full border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">الاختبارات الموجهة</Link>
        <Link to={embedded ? "/dashboard?tab=results" : "/assessment-results"} className="rounded-full border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800">نتائجي</Link>
      </div>
      <h1 className="text-xl font-bold leading-tight text-gray-800 dark:text-white sm:text-2xl">اختبارات المنصة</h1>
      <p className="mt-1 text-sm font-bold text-gray-500 dark:text-slate-400">اختر مكان التعلم نفسه، ثم ابدأ فقط الاختبارات التي يصرح بها الخادم لهذا السياق.</p>
    </div>
  </header>

  <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <Link to={embedded ? "/dashboard?tab=assignments" : "/assessment-assignments"} className="flex items-center justify-between rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/40 p-4 text-indigo-700 dark:text-indigo-300 shadow-sm transition hover:bg-indigo-100 dark:hover:bg-indigo-900/50">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white dark:bg-slate-800 shadow-sm"><Target size={20}/></div><div><h2 className="text-sm font-black">اختبارات موجهة لك</h2><p className="mt-1 text-xs font-bold text-indigo-500 dark:text-indigo-400">تكليفات مباشرة من المدرسة أو المعلم.</p></div></div>
      <span className="rounded-lg bg-white/70 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-bold">افتح</span>
    </Link>
    <Link to={embedded ? "/dashboard?tab=results" : "/assessment-results"} className="flex items-center justify-between rounded-xl border border-emerald-100 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-emerald-700 dark:text-emerald-300 shadow-sm transition hover:bg-emerald-100 dark:hover:bg-emerald-900/50">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white dark:bg-slate-800 shadow-sm"><FileText size={20}/></div><div><h2 className="text-sm font-black">سجل اختباراتي</h2><p className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">نتائج ومحاولاتك السابقة المسموح بعرضها.</p></div></div>
      <span className="rounded-lg bg-white/70 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-bold">افتح السجل</span>
    </Link>
  </section>

  <section className="overflow-hidden rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
    <div className="bg-slate-900 dark:bg-slate-950 p-3 text-center text-base font-bold text-white">اختبارات المنصة</div>
    <div className="space-y-4 p-4 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <select aria-label="المسار" value={pathId} onChange={e=>{setPathId(e.target.value);setSubjectId('');setCourseId('');setTopicId('');setSpace(null);setPage(1)}} className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 font-bold text-gray-700 dark:text-slate-100"><option value="">اختر المسار</option>{taxonomy.paths.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select aria-label="المادة" value={subjectId} disabled={!pathId} onChange={e=>{setSubjectId(e.target.value);setCourseId('');setTopicId('');setSpace(null);setPage(1)}} className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 font-bold text-gray-700 dark:text-slate-100 disabled:bg-gray-50 dark:disabled:bg-slate-900/50"><option value="">اختر المادة</option>{subjects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select aria-label="نوع مكان التعلم" value={slot} onChange={e=>{setSlot(e.target.value as AssessmentPlacementSlot);setCourseId('');setTopicId('');setPage(1)}} className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 font-bold text-gray-700 dark:text-slate-100">{Object.entries(slotLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
        {slot==='course'?<select aria-label="الدورة" value={courseId} onChange={e=>{setCourseId(e.target.value);setPage(1)}} className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 font-bold text-gray-700 dark:text-slate-100 sm:col-span-2 lg:col-span-3"><option value="">اختر دورة</option>{space?.courses.items.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select>:null}
        {slot==='foundation'?<select aria-label="موضوع التأسيس" value={topicId} onChange={e=>{setTopicId(e.target.value);setPage(1)}} className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 font-bold text-gray-700 dark:text-slate-100 sm:col-span-2 lg:col-span-3"><option value="">اختر موضوع تأسيس</option>{space?.foundation.items.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select>:null}
      </div>
      {((slot==='course'&&space?.courses.hasMore)||(slot==='foundation'&&space?.foundation.hasMore))?<div className="rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/50 p-3 text-xs font-bold text-amber-800 dark:text-amber-300">قائمة المحتوى نفسها محدودة إلى 50 عنصرًا؛ أماكن الاختبارات لا تحمل inventory كاملًا في المتصفح.</div>:null}
    </div>
  </section>

  {error?<div className="rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 p-3 font-bold text-rose-700 dark:text-rose-300">{error}</div>:null}

  {!contextReady?<div className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 p-8 text-center">
    <BookOpenCheck size={28} className="mx-auto text-indigo-500"/>
    <h2 className="mt-3 font-black text-gray-900 dark:text-white">حدد المسار والمادة أولًا</h2>
    <p className="mt-1 text-sm font-bold text-gray-500 dark:text-slate-400">بعد اختيار السياق تظهر فقط اختبارات التعلم المتاحة لك.</p>
  </div>:busy?<div className="rounded-2xl bg-white dark:bg-slate-900 p-8 text-center font-bold text-gray-500 dark:text-slate-400">جاري تحميل الاختبارات...</div>:listFailed?null:rows.length===0?<div className="rounded-2xl border border-dashed border-indigo-200 dark:border-indigo-900/50 bg-white/70 dark:bg-slate-900/70 px-5 py-8 text-center">
    <CheckCircle2 size={28} className="mx-auto text-emerald-500"/>
    <h2 className="mt-2 font-black text-gray-900 dark:text-white">لا توجد اختبارات مطلوبة هنا الآن</h2>
    <p className="mt-1 text-xs font-bold text-gray-500 dark:text-slate-400">عند نشر اختبار لهذا المكان وبصلاحية مناسبة سيظهر هنا تلقائيًا.</p>
  </div>:<section className="grid gap-4 md:grid-cols-2">{rows.map(row=>{
    const displayTitle = (row.title || 'اختبار تقييمي')
      .replace(/:\s*(undefined|null)/gi, ': مهارات عامة')
      .replace(/\b(undefined|null)\b/gi, 'مهارات عامة');
    return (
    <article key={row.placementId} className="flex flex-col rounded-2xl border border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="text-base font-black leading-snug text-gray-900 dark:text-white"><span className="inline-block rounded-xl border border-indigo-200/80 dark:border-indigo-800/80 bg-indigo-50/90 dark:bg-indigo-950/70 px-3 py-0.5 font-extrabold text-indigo-950 dark:text-indigo-200">{displayTitle}</span></h2><p className="mt-1.5 inline-block rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 text-[11px] font-black text-indigo-700 dark:text-indigo-300">{slotLabels[row.slot]}</p></div>
      <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black ${row.accessAllowed?'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300':'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'}`}>{row.accessAllowed?(row.canStart?'متاح':'مكتمل المحاولات'):'مقيد'}</span>
    </div>
    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-gray-500 dark:text-slate-400">
      <span className="rounded-lg bg-gray-50 dark:bg-slate-800 px-2.5 py-1">المحاولات {row.attemptCount} من {row.maxAttempts}</span>
      <span className="rounded-lg bg-gray-50 dark:bg-slate-800 px-2.5 py-1">الإصدار v{row.assessmentVersion}</span>
    </div>
    {!row.accessAllowed?<p className="mt-4 rounded-xl border border-amber-100 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs font-bold leading-6 text-amber-800 dark:text-amber-300">الوصول لهذا الاختبار يتحقق من Commerce على الخادم عند العرض وعند بدء المحاولة.</p>:null}
    <div className="mt-auto pt-4">
      <button type="button" disabled={!row.accessAllowed||!row.canStart||Boolean(starting)} onClick={()=>void start(row)} className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white transition disabled:opacity-40 ${row.accessAllowed?'bg-indigo-600 hover:bg-indigo-700':'bg-slate-500'}`}>{starting===row.placementId?<Loader2 size={18} className="animate-spin"/>:<Play size={18}/>} {accessLabel(row)}</button>
    </div>
  </article>
    );
  })}</section>}

  <div className="flex items-center justify-between">
    <button type="button" disabled={page<=1} onClick={()=>setPage(x=>Math.max(1,x-1))} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-black text-gray-800 dark:text-slate-200 disabled:opacity-40"><ChevronRight size={17}/>السابق</button>
    <span className="text-sm font-black text-gray-500 dark:text-slate-400">صفحة {page}</span>
    <button type="button" disabled={!hasMore} onClick={()=>setPage(x=>x+1)} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-black text-gray-800 dark:text-slate-200 disabled:opacity-40">التالي<ChevronLeft size={17}/></button>
  </div>
</ContainerTag>}