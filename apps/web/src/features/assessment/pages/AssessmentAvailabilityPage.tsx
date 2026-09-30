import {ArrowRight,BookOpenCheck,CheckCircle2,ChevronLeft,ChevronRight,FileText,Loader2,Play,Target} from 'lucide-react';
import {useEffect,useMemo,useState} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
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
export function AssessmentAvailabilityPage(){const{user,loading:authLoading,getCsrfToken}=useAuth();const navigate=useNavigate();const[params]=useSearchParams();const[taxonomy,setTaxonomy]=useState<TaxonomyCore>({paths:[],subjects:[]});const[pathId,setPathId]=useState(params.get('pathId')||'');const[subjectId,setSubjectId]=useState(params.get('subjectId')||'');const[slot,setSlot]=useState<AssessmentPlacementSlot>((params.get('slot') as AssessmentPlacementSlot)||'tests');const[courseId,setCourseId]=useState(params.get('courseId')||'');const[topicId,setTopicId]=useState(params.get('topicId')||'');const[space,setSpace]=useState<LearningSpace|null>(null);const[rows,setRows]=useState<LearnerAssessmentPlacement[]>([]);const[page,setPage]=useState(1);const[hasMore,setHasMore]=useState(false);const[busy,setBusy]=useState(false);const[starting,setStarting]=useState('');const[error,setError]=useState('');
useEffect(()=>{const c=new AbortController();contentClient.taxonomyCore(c.signal).then(setTaxonomy).catch(()=>{});return()=>c.abort()},[]);
const subjects=useMemo(()=>taxonomy.subjects.filter(x=>!pathId||x.pathId===pathId),[pathId,taxonomy.subjects]);useEffect(()=>{if(subjectId&&!subjects.some(x=>x.id===subjectId)){setSubjectId('');setCourseId('');setTopicId('')}},[subjectId,subjects]);
useEffect(()=>{if(!pathId||!subjectId||(slot!=='course'&&slot!=='foundation')){setSpace(null);return}const c=new AbortController();contentClient.learningSpace(pathId,subjectId,50,c.signal).then(setSpace).catch(()=>setSpace(null));return()=>c.abort()},[pathId,slot,subjectId]);
useEffect(()=>{setPage(1);if(slot!=='course')setCourseId('');if(slot!=='foundation')setTopicId('')},[slot]);
const contextReady=Boolean(pathId&&subjectId&&((slot==='course'&&courseId)||(slot==='foundation'&&topicId)||slot==='training'||slot==='tests'));
useEffect(()=>{if(authLoading||!user||!user.roles.includes('student')||!contextReady){setRows([]);setHasMore(false);return}const c=new AbortController();setBusy(true);setError('');assessmentPlacementClient.available({page,limit:30,slot,pathId,subjectId,courseId:slot==='course'?courseId:undefined,topicId:slot==='foundation'?topicId:undefined},c.signal).then(r=>{setRows(r.items);setHasMore(r.hasMore)}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل الاختبارات المتاحة')}).finally(()=>{if(!c.signal.aborted)setBusy(false)});return()=>c.abort()},[authLoading,contextReady,courseId,page,pathId,slot,subjectId,topicId,user]);
async function start(row:LearnerAssessmentPlacement){setStarting(row.placementId);setError('');try{const csrf=await getCsrfToken();const r=await assessmentPlacementClient.start(row.placementId,placementKey(row.placementId),csrf);navigate(`/assessment-attempts/${r.attempt.id}`)}catch(e){setError(e instanceof Error?e.message:'تعذر بدء الاختبار')}finally{setStarting('')}}
if(authLoading)return <main className="p-10 text-center font-black">جاري التحقق من الجلسة...</main>;if(!user||!user.roles.includes('student'))return <main className="p-10 text-center font-black text-rose-700">هذه الشاشة مخصصة للطالب.</main>;
return <main dir="rtl" className="mx-auto max-w-5xl space-y-6 px-3 pb-20 pt-5 sm:px-6">
  <header className="flex items-center gap-4">
    <Link to="/" className="text-gray-500 transition hover:text-gray-700" aria-label="العودة للوحة الطالب"><ArrowRight size={24}/></Link>
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black">
        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">اختبارات المنصة</span>
        <Link to="/assessment-assignments" className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50">الاختبارات الموجهة</Link>
        <Link to="/assessment-results" className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50">نتائجي</Link>
      </div>
      <h1 className="text-xl font-bold leading-tight text-gray-800 sm:text-2xl">اختبارات المنصة</h1>
      <p className="mt-1 text-sm font-bold text-gray-500">اختر مكان التعلم نفسه، ثم ابدأ فقط الاختبارات التي يصرح بها الخادم لهذا السياق.</p>
    </div>
  </header>

  <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <Link to="/assessment-assignments" className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-indigo-700 shadow-sm transition hover:bg-indigo-100">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm"><Target size={20}/></div><div><h2 className="text-sm font-black">اختبارات موجهة لك</h2><p className="mt-1 text-xs font-bold text-indigo-500">تكليفات مباشرة من المدرسة أو المعلم.</p></div></div>
      <span className="rounded-lg bg-white/70 px-3 py-1.5 text-xs font-bold">افتح</span>
    </Link>
    <Link to="/assessment-results" className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-700 shadow-sm transition hover:bg-emerald-100">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm"><FileText size={20}/></div><div><h2 className="text-sm font-black">سجل اختباراتي</h2><p className="mt-1 text-xs font-bold text-emerald-600">نتائج ومحاولاتك السابقة المسموح بعرضها.</p></div></div>
      <span className="rounded-lg bg-white/70 px-3 py-1.5 text-xs font-bold">افتح السجل</span>
    </Link>
  </section>

  <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
    <div className="bg-slate-900 p-3 text-center text-base font-bold text-white">اختبارات المنصة</div>
    <div className="space-y-4 p-4 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <select aria-label="المسار" value={pathId} onChange={e=>{setPathId(e.target.value);setSubjectId('');setPage(1)}} className="rounded-xl border border-gray-200 bg-white p-3 font-bold text-gray-700"><option value="">اختر المسار</option>{taxonomy.paths.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select aria-label="المادة" value={subjectId} disabled={!pathId} onChange={e=>{setSubjectId(e.target.value);setPage(1)}} className="rounded-xl border border-gray-200 bg-white p-3 font-bold text-gray-700 disabled:bg-gray-50"><option value="">اختر المادة</option>{subjects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select aria-label="نوع مكان التعلم" value={slot} onChange={e=>setSlot(e.target.value as AssessmentPlacementSlot)} className="rounded-xl border border-gray-200 bg-white p-3 font-bold text-gray-700">{Object.entries(slotLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
        {slot==='course'?<select aria-label="الدورة" value={courseId} onChange={e=>{setCourseId(e.target.value);setPage(1)}} className="rounded-xl border border-gray-200 bg-white p-3 font-bold text-gray-700 sm:col-span-2 lg:col-span-3"><option value="">اختر دورة</option>{space?.courses.items.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select>:null}
        {slot==='foundation'?<select aria-label="موضوع التأسيس" value={topicId} onChange={e=>{setTopicId(e.target.value);setPage(1)}} className="rounded-xl border border-gray-200 bg-white p-3 font-bold text-gray-700 sm:col-span-2 lg:col-span-3"><option value="">اختر موضوع تأسيس</option>{space?.foundation.items.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select>:null}
      </div>
      {((slot==='course'&&space?.courses.hasMore)||(slot==='foundation'&&space?.foundation.hasMore))?<div className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">قائمة المحتوى نفسها محدودة إلى 50 عنصرًا؛ أماكن الاختبارات لا تحمل inventory كاملًا في المتصفح.</div>:null}
    </div>
  </section>

  {error?<div className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}</div>:null}

  {!contextReady?<div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
    <BookOpenCheck size={28} className="mx-auto text-indigo-500"/>
    <h2 className="mt-3 font-black text-gray-900">حدد المسار والمادة أولًا</h2>
    <p className="mt-1 text-sm font-bold text-gray-500">بعد اختيار السياق تظهر فقط اختبارات التعلم المتاحة لك.</p>
  </div>:busy?<div className="rounded-2xl bg-white p-8 text-center font-bold text-gray-500">جاري تحميل الاختبارات...</div>:rows.length===0?<div className="rounded-2xl border border-dashed border-indigo-200 bg-white/70 px-5 py-8 text-center">
    <CheckCircle2 size={28} className="mx-auto text-emerald-500"/>
    <h2 className="mt-2 font-black text-gray-900">لا توجد اختبارات مطلوبة هنا الآن</h2>
    <p className="mt-1 text-xs font-bold text-gray-500">عند نشر اختبار لهذا المكان وبصلاحية مناسبة سيظهر هنا تلقائيًا.</p>
  </div>:<section className="grid gap-4 md:grid-cols-2">{rows.map(row=><article key={row.placementId} className="flex flex-col rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="text-base font-black leading-snug text-gray-900"><span className="inline-block rounded-xl border border-indigo-200/80 bg-indigo-50/90 px-3 py-0.5 font-extrabold text-indigo-950">{row.title}</span></h2><p className="mt-1.5 inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-black text-indigo-700">{slotLabels[row.slot]}</p></div>
      <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black ${row.accessAllowed?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{row.accessAllowed?(row.canStart?'متاح':'مكتمل المحاولات'):'مقيد'}</span>
    </div>
    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-gray-500">
      <span className="rounded-lg bg-gray-50 px-2.5 py-1">المحاولات {row.attemptCount} من {row.maxAttempts}</span>
      <span className="rounded-lg bg-gray-50 px-2.5 py-1">الإصدار v{row.assessmentVersion}</span>
    </div>
    {!row.accessAllowed?<p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-6 text-amber-800">الوصول لهذا الاختبار يتحقق من Commerce على الخادم عند العرض وعند بدء المحاولة.</p>:null}
    <div className="mt-auto pt-4">
      <button type="button" disabled={!row.canStart||starting===row.placementId} onClick={()=>void start(row)} className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white transition disabled:opacity-40 ${row.accessAllowed?'bg-indigo-600 hover:bg-indigo-700':'bg-slate-500'}`}>{starting===row.placementId?<Loader2 size={18} className="animate-spin"/>:<Play size={18}/>} {accessLabel(row)}</button>
    </div>
  </article>)}</section>}

  <div className="flex items-center justify-between">
    <button type="button" disabled={page<=1} onClick={()=>setPage(x=>Math.max(1,x-1))} className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-2 font-black disabled:opacity-40"><ChevronRight size={17}/>السابق</button>
    <span className="text-sm font-black text-gray-500">صفحة {page}</span>
    <button type="button" disabled={!hasMore} onClick={()=>setPage(x=>x+1)} className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-2 font-black disabled:opacity-40">التالي<ChevronLeft size={17}/></button>
  </div>
</main>}