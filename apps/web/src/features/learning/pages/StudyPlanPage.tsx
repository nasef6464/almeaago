import {
  Archive,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Loader2,
  PlayCircle,
  RotateCcw,
  Save,
  Target,
  Trash2,
} from 'lucide-react';
import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';

import {useAuth} from '../../auth/state/AuthProvider';
import {contentClient} from '../../content/api/content-client';
import type {LearnerCourseSummary,TaxonomyCore} from '../../content/api/content-types';
import {
  studyPlanClient,
  type StudyPlan,
  type StudyPlanItem,
  type StudyPlanStatus,
  type StudyPlanWeekday,
  type StudyPlanWrite,
} from '../api/learning-client';

const dayOptions:Array<{id:StudyPlanWeekday;label:string}>=[
  {id:'saturday',label:'السبت'},{id:'sunday',label:'الأحد'},{id:'monday',label:'الإثنين'},
  {id:'tuesday',label:'الثلاثاء'},{id:'wednesday',label:'الأربعاء'},
  {id:'thursday',label:'الخميس'},{id:'friday',label:'الجمعة'},
];

function dateKey(offset=0){
  const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);return d.toISOString().slice(0,10);
}
function draftFor(pathId=''):StudyPlanWrite{
  return {name:'',pathId,subjectIds:[],courseIds:[],startDate:dateKey(),endDate:dateKey(13),skipCompletedQuizzes:true,offDays:[],dailyMinutes:90,preferredStartTime:'17:00',status:'active'};
}
function phaseLabel(value:StudyPlanItem['phase']){
  if(value==='foundation')return 'تأسيس';if(value==='practice')return 'تدريب';return 'مراجعة';
}
function taskIcon(type:StudyPlanItem['itemType']){
  if(type==='lesson')return <BookOpen size={18}/>;
  if(type==='assessment')return <PlayCircle size={18}/>;
  return <FileText size={18}/>;
}
function taskLink(item:StudyPlanItem,plan:StudyPlan){
  if(item.itemType==='lesson'&&item.courseId)return `/learning/courses/${item.courseId}`;
  if(item.itemType==='assessment'){
    const p=new URLSearchParams({pathId:plan.pathId,subjectId:item.subjectId,slot:item.assessmentSlot||'tests'});
    if(item.courseId)p.set('courseId',item.courseId);
    return `/assessments?${p.toString()}`;
  }
  return '';
}

export function StudyPlanPage(){
  const{user,loading:authLoading,getCsrfToken}=useAuth();
  const[taxonomy,setTaxonomy]=useState<TaxonomyCore>({paths:[],subjects:[]});
  const[pathId,setPathId]=useState('');
  const[statusView,setStatusView]=useState<StudyPlanStatus>('active');
  const[hasPlans,setHasPlans]=useState(false);
  const[current,setCurrent]=useState<StudyPlan|null>(null);
  const[draft,setDraft]=useState<StudyPlanWrite>(draftFor());
  const[courseSubjectId,setCourseSubjectId]=useState('');
  const[courseOptions,setCourseOptions]=useState<LearnerCourseSummary[]>([]);
  const[busy,setBusy]=useState(true);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  const[notice,setNotice]=useState('');
  const[reload,setReload]=useState(0);
  const[scheduleView,setScheduleView]=useState<'today'|'week'|'all'>('today');

  useEffect(()=>{const c=new AbortController();contentClient.taxonomyCore(c.signal).then(x=>{setTaxonomy(x);if(!pathId&&x.paths.length){setPathId(x.paths[0].id);setDraft(draftFor(x.paths[0].id))}}).catch(()=>setError('تعذر تحميل المسارات.'));return()=>c.abort()},[]);
  const subjects=useMemo(()=>taxonomy.subjects.filter(x=>x.pathId===pathId),[pathId,taxonomy.subjects]);

  useEffect(()=>{
    if(!pathId||authLoading||!user){setBusy(false);return}
    const c=new AbortController();setBusy(true);setError('');
    studyPlanClient.list(pathId,statusView,1,20,c.signal).then(async result=>{
      const first=result.items[0];
      if(!first){
        if(!c.signal.aborted){setHasPlans(false);setCurrent(null);setDraft(draftFor(pathId))}
        return;
      }
      const detail=await studyPlanClient.get(first.id,c.signal);
      if(c.signal.aborted)return;
      setHasPlans(true);
      const next=detail.plan;setCurrent(next);
      setDraft({name:next.name,pathId:next.pathId,subjectIds:next.subjectIds,courseIds:next.courseIds,startDate:next.startDate,endDate:next.endDate,skipCompletedQuizzes:next.skipCompletedQuizzes,offDays:next.offDays,dailyMinutes:next.dailyMinutes,preferredStartTime:next.preferredStartTime,status:next.status});
    }).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل الخطط')}).finally(()=>{if(!c.signal.aborted)setBusy(false)});
    return()=>c.abort();
  },[authLoading,pathId,reload,statusView,user]);

  useEffect(()=>{
    if(!courseSubjectId||!pathId){setCourseOptions([]);return}
    const c=new AbortController();
    contentClient.learningSpace(pathId,courseSubjectId,50,c.signal).then(x=>setCourseOptions(x.courses.items)).catch(()=>setCourseOptions([]));
    return()=>c.abort();
  },[courseSubjectId,pathId]);

  function changePath(value:string){
    setPathId(value);setCurrent(null);setCourseSubjectId('');setCourseOptions([]);setDraft(draftFor(value));setNotice('');setError('');
  }
  function toggleSubject(id:string){
    setCourseSubjectId('');
    setCourseOptions([]);
    setDraft(x=>({...x,subjectIds:x.subjectIds.includes(id)?x.subjectIds.filter(v=>v!==id):[...x.subjectIds,id],courseIds:[]}));
  }
  function toggleCourse(id:string){
    setDraft(x=>({...x,courseIds:x.courseIds.includes(id)?x.courseIds.filter(v=>v!==id):[...x.courseIds,id]}));
  }
  function toggleOffDay(id:StudyPlanWeekday){
    setDraft(x=>({...x,offDays:x.offDays.includes(id)?x.offDays.filter(v=>v!==id):[...x.offDays,id]}));
  }
  function reset(){
    if(current)setDraft({name:current.name,pathId:current.pathId,subjectIds:current.subjectIds,courseIds:current.courseIds,startDate:current.startDate,endDate:current.endDate,skipCompletedQuizzes:current.skipCompletedQuizzes,offDays:current.offDays,dailyMinutes:current.dailyMinutes,preferredStartTime:current.preferredStartTime,status:current.status});
    else setDraft(draftFor(pathId));
    setError('');setNotice('');
  }
  async function save(){
    if(!draft.name.trim()){setError('اكتب اسم الخطة.');return}
    if(!draft.startDate||!draft.endDate){setError('حدد تاريخ البداية والنهاية.');return}
    setSaving(true);setError('');setNotice('');
    try{
      const csrf=await getCsrfToken();
      const payload={...draft,name:draft.name.trim(),pathId,status:'active' as const};
      const out=current&&current.status==='active'?await studyPlanClient.update(current,payload,csrf):await studyPlanClient.create(payload,csrf);
      setCurrent(out.plan);setNotice('تم حفظ الخطة وتوليد الجدول.');setReload(x=>x+1);
    }catch(e){setError(e instanceof Error?e.message:'تعذر حفظ الخطة')}
    finally{setSaving(false)}
  }
  async function archive(){
    if(!current)return;setSaving(true);setError('');
    try{const csrf=await getCsrfToken();await studyPlanClient.update(current,{...draft,status:'archived'},csrf);setNotice('تمت أرشفة الخطة.');setReload(x=>x+1)}
    catch(e){setError(e instanceof Error?e.message:'تعذر أرشفة الخطة')}
    finally{setSaving(false)}
  }
  async function remove(){
    if(!current)return;setSaving(true);setError('');
    try{const csrf=await getCsrfToken();await studyPlanClient.delete(current.id,csrf);setCurrent(null);setNotice('تم حذف الخطة.');setReload(x=>x+1)}
    catch(e){setError(e instanceof Error?e.message:'تعذر حذف الخطة')}
    finally{setSaving(false)}
  }

  const today=dateKey();
  const weekEnd=dateKey(6);
  const visibleItems=useMemo(()=>{
    const items=current?.items||[];
    if(scheduleView==='today')return items.filter(x=>x.scheduledDate===today);
    if(scheduleView==='week')return items.filter(x=>x.scheduledDate>=today&&x.scheduledDate<=weekEnd);
    return items;
  },[current,scheduleView,today,weekEnd]);
  const grouped=useMemo(()=>{const m=new Map<string,StudyPlanItem[]>();for(const item of visibleItems){const arr=m.get(item.scheduledDate)||[];arr.push(item);m.set(item.scheduledDate,arr)}return Array.from(m.entries())},[visibleItems]);
  const completed=current?.items.filter(x=>x.completed).length||0;
  const progress=current?.items.length?Math.round(completed/current.items.length*100):0;

  if(authLoading||busy)return <main className="p-10 text-center font-black">جاري تحميل الخطة...</main>;
  if(!user||!user.roles.includes('student'))return <main className="p-10 text-center font-black text-rose-700">هذه الشاشة مخصصة للطالب.</main>;

  return <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-6 sm:px-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-3xl bg-gradient-to-l from-indigo-700 to-purple-700 p-5 text-white shadow-sm sm:p-7">
        <div className="flex items-center gap-2 text-indigo-100"><Target size={20}/><span className="text-xs font-black">STUDY PLAN</span></div>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">خطتي الدراسية</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-indigo-100">جدول يومي من مراجع المحتوى والاختبارات الحقيقية، بدون نسخ الدروس أو الأسئلة داخل الخطة.</p>
      </header>

      <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[1fr_auto]">
        <select aria-label="مسار الخطة" value={pathId} onChange={e=>changePath(e.target.value)} className="rounded-xl border p-2.5 font-bold"><option value="">اختر المسار</option>{taxonomy.paths.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <div className="grid grid-cols-2 rounded-xl bg-gray-100 p-1">
          {(['active','archived'] as StudyPlanStatus[]).map(value=><button key={value} type="button" onClick={()=>setStatusView(value)} className={`rounded-lg px-4 py-2 text-sm font-black ${statusView===value?'bg-white shadow-sm text-indigo-700':'text-gray-500'}`}>{value==='active'?'نشطة':'مؤرشفة'}</button>)}
        </div>
      </section>

      {error?<div className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}</div>:null}
      {notice?<div className="rounded-xl bg-emerald-50 p-3 font-bold text-emerald-700">{notice}</div>:null}

      {statusView==='active'?<section className="space-y-4 rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-black">إعداد الخطة</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2"><span className="text-xs font-black text-gray-600">اسم الخطة</span><input aria-label="اسم الخطة" value={draft.name} maxLength={160} onChange={e=>setDraft(x=>({...x,name:e.target.value}))} className="w-full rounded-xl border p-2.5 font-bold"/></label>
          <label className="space-y-1"><span className="text-xs font-black text-gray-600">من</span><input aria-label="تاريخ البداية" type="date" value={draft.startDate} onChange={e=>setDraft(x=>({...x,startDate:e.target.value}))} className="w-full rounded-xl border p-2.5"/></label>
          <label className="space-y-1"><span className="text-xs font-black text-gray-600">إلى</span><input aria-label="تاريخ النهاية" type="date" value={draft.endDate} onChange={e=>setDraft(x=>({...x,endDate:e.target.value}))} className="w-full rounded-xl border p-2.5"/></label>
          <label className="space-y-1"><span className="text-xs font-black text-gray-600">دقائق يومية</span><input aria-label="الدقائق اليومية" type="number" min={15} max={240} value={draft.dailyMinutes} onChange={e=>setDraft(x=>({...x,dailyMinutes:Number(e.target.value)||90}))} className="w-full rounded-xl border p-2.5"/></label>
          <label className="space-y-1"><span className="text-xs font-black text-gray-600">وقت البدء</span><input aria-label="وقت البدء" type="time" value={draft.preferredStartTime} onChange={e=>setDraft(x=>({...x,preferredStartTime:e.target.value}))} className="w-full rounded-xl border p-2.5"/></label>
        </div>

        <div><div className="mb-2 text-sm font-black">المواد <span className="text-xs font-bold text-gray-400">(فارغ = كل مواد المسار)</span></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{subjects.map(s=><label key={s.id} className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-bold ${draft.subjectIds.includes(s.id)?'border-indigo-300 bg-indigo-50':''}`}><input type="checkbox" checked={draft.subjectIds.includes(s.id)} onChange={()=>toggleSubject(s.id)}/>{s.name}</label>)}</div></div>

        <div className="space-y-2"><div className="text-sm font-black">دورات محددة <span className="text-xs font-bold text-gray-400">(اختياري، التحميل حسب المادة فقط)</span></div><select aria-label="مادة اختيار الدورات" value={courseSubjectId} onChange={e=>setCourseSubjectId(e.target.value)} className="w-full rounded-xl border p-2.5"><option value="">اختر مادة لعرض دوراتها</option>{subjects.filter(s=>draft.subjectIds.length===0||draft.subjectIds.includes(s.id)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>{courseOptions.length?<div className="grid gap-2 sm:grid-cols-2">{courseOptions.map(c=><label key={c.id} className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-bold ${draft.courseIds.includes(c.id)?'border-emerald-300 bg-emerald-50':''}`}><input type="checkbox" checked={draft.courseIds.includes(c.id)} onChange={()=>toggleCourse(c.id)}/>{c.title}</label>)}</div>:null}</div>

        <label className="flex items-center gap-3 rounded-xl border p-3 text-sm font-black"><input type="checkbox" checked={draft.skipCompletedQuizzes} onChange={e=>setDraft(x=>({...x,skipCompletedQuizzes:e.target.checked}))}/>تجاوز الاختبارات المكتملة</label>

        <div><div className="mb-2 text-sm font-black">أيام الراحة</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{dayOptions.map(day=><button key={day.id} type="button" onClick={()=>toggleOffDay(day.id)} className={`rounded-xl border p-3 text-sm font-black ${draft.offDays.includes(day.id)?'border-amber-300 bg-amber-50 text-amber-800':'text-gray-600'}`}>{day.label}</button>)}</div></div>

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={saving||!pathId} onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 font-black text-white disabled:opacity-40">{saving?<Loader2 size={18} className="animate-spin"/>:<Save size={18}/>} {current?'تحديث الخطة':'إنشاء الخطة'}</button>
          <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-black"><RotateCcw size={17}/>إعادة تعيين</button>
          {current?<><button type="button" disabled={saving} onClick={()=>void archive()} className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 font-black text-amber-800"><Archive size={17}/>أرشفة</button><button type="button" disabled={saving} onClick={()=>void remove()} className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 font-black text-rose-700"><Trash2 size={17}/>حذف</button></>:null}
        </div>
      </section>:null}

      {current?<section className="space-y-4">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-2xl font-black">{current.name}</h2><div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-gray-500"><span className="inline-flex items-center gap-1"><CalendarDays size={14}/>{current.startDate} ← {current.endDate}</span><span className="inline-flex items-center gap-1"><Clock3 size={14}/>{current.dailyMinutes} دقيقة يوميًا</span><span>{current.items.length} مهمة</span></div></div><div className="min-w-36 text-center"><div className="text-3xl font-black text-indigo-700">{progress}%</div><div className="text-xs font-bold text-gray-500">{completed} من {current.items.length}</div></div></div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full bg-emerald-500" style={{width:`${progress}%`}}/></div>
        </div>

        <div className="grid grid-cols-3 rounded-2xl border bg-white p-1">
          {([['today','اليوم'],['week','الأسبوع'],['all','الكل']] as const).map(([id,label])=><button key={id} type="button" onClick={()=>setScheduleView(id)} className={`rounded-xl px-3 py-2.5 text-sm font-black ${scheduleView===id?'bg-slate-950 text-white':'text-gray-600'}`}>{label}</button>)}
        </div>

        {grouped.length===0?<div className="rounded-2xl border border-dashed bg-white p-8 text-center font-bold text-gray-500">لا توجد مهام في هذا النطاق الزمني.</div>:grouped.map(([date,items])=><article key={date} className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b bg-gray-50 px-4 py-3 font-black">{new Date(date+'T12:00:00').toLocaleDateString('ar-SA',{weekday:'long',day:'numeric',month:'long'})}</div><div className="divide-y">{items.map(item=>{const href=taskLink(item,current);const row=<div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><div className={`mt-0.5 rounded-xl p-2 ${item.completed?'bg-emerald-50 text-emerald-700':'bg-indigo-50 text-indigo-700'}`}>{item.completed?<CheckCircle2 size={18}/>:taskIcon(item.itemType)}</div><div><div className="font-black">{item.title}</div><div className="mt-1 flex flex-wrap gap-2 text-xs font-bold text-gray-500"><span>{item.scheduledTime}</span><span>{item.durationMinutes} دقيقة</span><span>{phaseLabel(item.phase)}</span>{!item.available?<span className="text-rose-600">غير متاح حاليًا</span>:null}</div></div></div>{item.available&&(href||item.externalUrl)?item.externalUrl?<a href={item.externalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-sm font-black">فتح المورد<ExternalLink size={15}/></a>:<Link to={href} className="rounded-xl bg-indigo-600 px-3 py-2 text-center text-sm font-black text-white">ابدأ المهمة</Link>:null}</div>;return <div key={item.id}>{row}</div>})}</div></article>)}
      </section>:!hasPlans?<div className="rounded-3xl border border-dashed bg-white p-10 text-center font-bold text-gray-500">{statusView==='active'?'لا توجد خطة نشطة لهذا المسار بعد.':'لا توجد خطط مؤرشفة.'}</div>:null}
    </div>
  </main>;
}
