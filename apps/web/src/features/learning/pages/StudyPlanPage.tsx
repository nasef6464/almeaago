import {
  Archive,
  ArrowRight,
  BookOpen,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
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
  interventionClient,
  studyPlanClient,
  type SchoolIntervention,
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
  const[interventions,setInterventions]=useState<SchoolIntervention[]>([]);
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
    if(authLoading||!user||!user.roles.includes('student')){setInterventions([]);return}
    const c=new AbortController();
    interventionClient.mine('active',1,20,c.signal).then(r=>setInterventions(r.items)).catch(()=>setInterventions([]));
    return()=>c.abort();
  },[authLoading,reload,user]);

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
  const selectedPath=taxonomy.paths.find(x=>x.id===pathId)||null;

  if(authLoading||busy)return <main className="p-10 text-center font-black">جاري تحميل الخطة...</main>;
  if(!user||!user.roles.includes('student'))return <main className="p-10 text-center font-black text-rose-700">هذه الشاشة مخصصة للطالب.</main>;

  return <main dir="rtl" className="mx-auto max-w-6xl space-y-6 px-3 pb-20 pt-5 sm:px-6">
    <header className="flex items-center gap-3 sm:gap-4">
      <Link to="/" className="text-gray-500 transition hover:text-gray-700" aria-label="العودة للوحة الطالب">
        <ArrowRight size={24}/>
      </Link>
      <div>
        <h1 className="text-2xl font-black leading-tight text-indigo-900">خططي</h1>
        <p className="mt-1 text-sm font-bold text-gray-500">ابدأ بمهمة اليوم، والباقي نمشيه معك خطوة بخطوة.</p>
      </div>
    </header>

    <section>
      <label className="mb-3 block text-base font-black text-gray-800">اختر المسار أولاً:</label>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1.5 shadow-inner">
        {taxonomy.paths.map(path=><button
          key={path.id}
          type="button"
          onClick={()=>changePath(path.id)}
          className={`rounded-xl px-5 py-4 text-base font-black transition-all ${pathId===path.id?'scale-[1.02] bg-emerald-500 text-white shadow-md':'text-gray-500 hover:bg-gray-200/50 hover:text-gray-700'}`}
        >خطة {path.name}</button>)}
      </div>
      <div className="mx-auto mt-3 grid max-w-sm grid-cols-2 rounded-xl bg-gray-100 p-1">
        {(['active','archived'] as StudyPlanStatus[]).map(value=><button key={value} type="button" onClick={()=>setStatusView(value)} className={`rounded-lg px-4 py-2 text-sm font-black ${statusView===value?'bg-white text-indigo-700 shadow-sm':'text-gray-500'}`}>{value==='active'?'نشطة':'مؤرشفة'}</button>)}
      </div>
    </section>

    {error?<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>:null}
    {notice?<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{notice}</div>:null}

    {interventions.length>0?<section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="flex items-center gap-2 font-black text-amber-900"><Target size={18}/>خطط علاج المدرسة</div>
      {interventions.map(row=><div key={row.id} className="rounded-2xl bg-white p-3 text-sm shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-black">مهارة {row.skillId}</div><span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-black text-indigo-700">{row.status}</span></div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-gray-500"><span>Baseline: {row.baseline.accuracy==null?'—':row.baseline.accuracy.toFixed(1)+'%'}</span><span>خطة الدراسة: {row.studyPlanId}</span>{row.followUpAt?<span>المتابعة: {new Date(row.followUpAt).toLocaleString('ar-SA')}</span>:null}</div>
      </div>)}
    </section>:null}

    {statusView==='active'?<details className="group" open={!current}>
      <summary className="mb-2 cursor-pointer list-none rounded-2xl border border-gray-200 bg-white p-4 text-center font-bold text-indigo-700 shadow-sm transition hover:bg-gray-50">
        ⚙️ إعدادات الخطة (إنشاء وتعديل)
      </summary>
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="border-b border-gray-100 bg-gray-50 p-5 text-center sm:p-8">
          <h2 className="text-2xl font-black text-emerald-600">{current?`تعديل خطة ${selectedPath?.name||''}`:`إضافة خطة ${selectedPath?.name||''}`}</h2>
          <p className="mt-2 text-sm text-gray-500">املأ البيانات التالية لإنشاء أو تعديل الخطة الدراسية الوقتية.</p>
        </div>
        <div className="space-y-6 p-4 sm:p-8">
          <div>
            <label className="mb-2 block text-sm font-bold text-gray-700">اسم الخطة الدراسية</label>
            <input aria-label="اسم الخطة" value={draft.name} maxLength={160} onChange={e=>setDraft(x=>({...x,name:e.target.value}))} placeholder="مثال: الخطة المكثفة لشهر مارس" className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-right outline-none transition focus:border-emerald-400 focus:bg-white"/>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm leading-7 text-amber-800">
            يمكنك اختيار مواد من نفس المسار، ويمكنك أيضًا تخصيص الخطة على دورات محددة. إذا لم تختر دورات بعينها، يعتمد النظام على المحتوى المتاح داخل النطاق المصرح به.
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <label className="mb-3 block text-sm font-bold text-gray-700">اختر المواد</label>
              <div className="grid gap-3 sm:grid-cols-2">{subjects.map(s=><label key={s.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-4 text-right transition ${draft.subjectIds.includes(s.id)?'border-emerald-400 bg-emerald-50 text-emerald-700':'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                <input aria-label={`اختر مادة ${s.name}`} type="checkbox" checked={draft.subjectIds.includes(s.id)} onChange={()=>toggleSubject(s.id)} className="h-4 w-4"/>
                <span><span className="block font-bold">{s.name}</span><span className="mt-1 block text-xs text-gray-400">مادة داخل {selectedPath?.name||'المسار'}</span></span>
              </label>)}</div>
            </div>
            <div>
              <label className="mb-3 block text-sm font-bold text-gray-700">اختر الدورات</label>
              <select aria-label="مادة اختيار الدورات" value={courseSubjectId} onChange={e=>setCourseSubjectId(e.target.value)} className="mb-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-bold">
                <option value="">اختر مادة لعرض دوراتها</option>
                {subjects.filter(s=>draft.subjectIds.length===0||draft.subjectIds.includes(s.id)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {courseOptions.length?<div className="grid max-h-72 gap-3 overflow-y-auto sm:grid-cols-2">{courseOptions.map(course=><label key={course.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-4 text-right transition ${draft.courseIds.includes(course.id)?'border-indigo-400 bg-indigo-50 text-indigo-700':'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                <input aria-label={`اختر دورة ${course.title}`} type="checkbox" checked={draft.courseIds.includes(course.id)} onChange={()=>toggleCourse(course.id)} className="h-4 w-4"/>
                <span><span className="block break-words font-bold">{course.title}</span><span className="mt-1 block text-xs text-gray-400">{course.instructorName}</span></span>
              </label>)}</div>:<div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">اختر مادة لعرض الدورات المتاحة فقط عند الحاجة.</div>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label><span className="mb-2 block text-sm font-bold text-gray-700">تاريخ البداية</span><input aria-label="تاريخ البداية" type="date" value={draft.startDate} onChange={e=>setDraft(x=>({...x,startDate:e.target.value}))} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"/></label>
            <label><span className="mb-2 block text-sm font-bold text-gray-700">تاريخ النهاية</span><input aria-label="تاريخ النهاية" type="date" value={draft.endDate} onChange={e=>setDraft(x=>({...x,endDate:e.target.value}))} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"/></label>
            <label><span className="mb-2 block text-sm font-bold text-gray-700">عدد دقائق المذاكرة اليومية</span><input aria-label="الدقائق اليومية" type="number" min={15} max={240} value={draft.dailyMinutes} onChange={e=>setDraft(x=>({...x,dailyMinutes:Number(e.target.value)||90}))} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"/></label>
            <label><span className="mb-2 block text-sm font-bold text-gray-700">وقت بدء جلسة المذاكرة</span><input aria-label="وقت البدء" type="time" value={draft.preferredStartTime} onChange={e=>setDraft(x=>({...x,preferredStartTime:e.target.value}))} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4"/></label>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white/80 p-4"><div className="text-xs font-bold text-emerald-700">النافذة الوقتية اليومية</div><div className="mt-1 text-lg font-black text-emerald-800">{draft.preferredStartTime}</div></div>
            <div className="rounded-2xl bg-white/80 p-4"><div className="text-xs font-bold text-emerald-700">مدة الخطة</div><div className="mt-1 text-sm font-black text-emerald-800">{draft.startDate||'—'} ← {draft.endDate||'—'}</div></div>
            <div className="rounded-2xl bg-white/80 p-4"><div className="text-xs font-bold text-emerald-700">أيام الإجازة</div><div className="mt-1 text-lg font-black text-emerald-800">{draft.offDays.length}</div></div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
            <input type="checkbox" checked={draft.skipCompletedQuizzes} onChange={e=>setDraft(x=>({...x,skipCompletedQuizzes:e.target.checked}))} className="mt-1 h-4 w-4"/>
            <span><span className="block font-bold text-gray-800">تخطي الاختبارات المنجزة</span><span className="mt-1 block text-sm text-gray-500">إذا كان عندك اختبارات أنهيتها سابقًا، فلن تدخل ضمن الخطة الجديدة.</span></span>
          </label>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold text-gray-800">أيام الإجازة في الأسبوع</h3><p className="text-sm text-gray-500">اختر أيام الراحة داخل الخطة الوقتية.</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{draft.offDays.length}</span></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{dayOptions.map(day=><button key={day.id} type="button" onClick={()=>toggleOffDay(day.id)} className={`rounded-2xl border px-3 py-4 text-center transition ${draft.offDays.includes(day.id)?'border-amber-300 bg-amber-50 text-amber-700':'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}><div className="font-bold">{day.label}</div></button>)}</div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button type="button" disabled={saving||!pathId} onClick={()=>void save()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 font-bold text-white transition hover:bg-emerald-600 disabled:opacity-40">{saving?<Loader2 size={18} className="animate-spin"/>:<BookOpen size={18}/>} {current?'تحديث الخطة الدراسية':'إنشاء الخطة الدراسية'}</button>
            <button type="button" onClick={reset} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-100 px-6 py-4 font-bold text-gray-700 transition hover:bg-gray-200"><RotateCcw size={18}/>إعادة تعيين / إلغاء</button>
            {current?<><button type="button" disabled={saving} onClick={()=>void archive()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-6 py-4 font-bold text-amber-700 transition hover:bg-amber-100"><Archive size={18}/>أرشفة الخطة</button><button type="button" disabled={saving} onClick={()=>void remove()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-6 py-4 font-bold text-red-700 transition hover:bg-red-100"><Trash2 size={18}/>حذف الخطة</button></>:null}
          </div>
        </div>
      </section>
    </details>:null}

    {current?<section className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white shadow-xl">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div><h2 className="mb-2 text-3xl font-black">{current.name}</h2><div className="flex flex-wrap items-center gap-3 text-sm font-medium text-indigo-100"><span className="flex items-center gap-1.5"><Calendar size={16}/>من {current.startDate} إلى {current.endDate}</span><span className="opacity-50">•</span><span className="flex items-center gap-1.5"><Clock size={16}/>{current.dailyMinutes} دقيقة يومياً</span><span className="opacity-50">•</span><span className="flex items-center gap-1.5"><Target size={16}/>{current.items.length} مهمة إجمالاً</span></div></div>
          <div className="min-w-[200px]"><div className="flex items-end justify-between gap-2 md:justify-end"><span className="mb-1 font-bold text-indigo-100">نسبة الإنجاز</span><span className="text-4xl font-black">{progress}%</span></div><div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-black/20"><div className="h-full rounded-full bg-emerald-400 transition-all duration-700" style={{width:`${progress}%`}}/></div></div>
        </div>
        <div className="relative z-10 mt-6 flex items-center gap-2 border-t border-white/10 pt-6 text-sm font-bold text-indigo-100"><CheckCircle2 size={16} className="text-emerald-400"/>الاستمرارية تصنع الفرق، واصل التقدم!</div>
      </div>

      <section className="rounded-2xl bg-white/60 p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3"><Calendar size={22} className="text-indigo-600"/><h3 className="text-lg font-black text-gray-800">الجدول الزمني</h3></div>
          <div className="flex gap-1.5 rounded-2xl border border-gray-100 bg-gray-50 p-1">{([['today','اليوم'],['week','الأسبوع'],['all','الكل']] as const).map(([id,label])=><button key={id} type="button" onClick={()=>setScheduleView(id)} className={`rounded-xl px-3 py-1.5 text-xs font-black transition-all ${scheduleView===id?'bg-indigo-600 text-white shadow-sm':'text-gray-500 hover:bg-gray-100'}`}>{label}</button>)}</div>
        </div>

        {grouped.length===0?<div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm font-bold text-gray-500">لا توجد مهام في هذا النطاق الزمني.</div>:<div className="space-y-8">{grouped.map(([date,items])=><article key={date} className="relative pt-2">
          <div className={`sticky top-0 z-10 mb-3 flex items-center justify-between rounded-xl border px-4 py-2 font-bold shadow-sm ${date===today?'border-indigo-700 bg-indigo-600 text-white':'border-gray-200 bg-gray-100 text-gray-700'}`}>
            <span>{new Date(date+'T12:00:00').toLocaleDateString('ar-SA',{weekday:'long',day:'numeric',month:'long'})}</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-black">{items.filter(x=>x.completed).length}/{items.length} ✓</span>
          </div>
          <div className="relative mr-3 space-y-2 border-r-2 border-gray-100 pr-4">{items.map(item=>{const href=taskLink(item,current);return <div key={item.id} className="relative">
            <div className={`absolute -right-[23px] top-3.5 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm ${item.completed?'bg-emerald-500':'bg-amber-400'}`}/>
            <div className={`rounded-2xl px-3 py-2.5 ring-1 ${item.completed?'bg-gray-50/50 opacity-60 ring-gray-100':'bg-white ring-gray-100 shadow-sm'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1"><div className="mb-1.5 flex flex-wrap items-center gap-1.5"><span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">{item.scheduledTime}</span><span className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-black text-gray-600">{phaseLabel(item.phase)}</span><span className="text-[10px] font-bold text-gray-400">{item.durationMinutes} دقيقة</span>{!item.available?<span className="text-[10px] font-bold text-rose-600">غير متاح حاليًا</span>:null}</div><h4 className={`text-sm font-black leading-snug ${item.completed?'text-gray-400 line-through':'text-gray-800'}`}>{item.title}</h4>{item.available&&(href||item.externalUrl)?item.externalUrl?<a href={item.externalUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-600"><FileText size={11}/>فتح المهمة</a>:<Link to={href} className="mt-2 inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-600">{taskIcon(item.itemType)} فتح المهمة</Link>:null}</div>
                <div className={`shrink-0 rounded-full p-1.5 ${item.completed?'bg-emerald-50 text-emerald-500':'bg-gray-50 text-gray-300'}`}>{item.completed?<CheckCircle2 size={18}/>:<Circle size={18}/>}</div>
              </div>
            </div>
          </div>})}</div>
        </article>)}</div>}
      </section>
    </section>:!hasPlans?<div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center font-bold text-gray-500">{statusView==='active'?'لا توجد خطة نشطة لهذا المسار بعد.':'لا توجد خطط مؤرشفة.'}</div>:null}
  </main>;
}
