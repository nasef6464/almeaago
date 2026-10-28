import { useEffect, useRef, useState, type FormEvent } from 'react';

import type { TaxonomyPath, TaxonomySubject } from '../../content/api/content-types';
import {
  organizationsClient,
  type DirectorAssessmentQuestion,
  type DirectorAssessmentCandidate,
  type DirectorAssessmentSettings,
} from '../api/organizations-client';

interface Props {
  schoolId:string;
  classes:{classId:string;className:string}[];
  paths:TaxonomyPath[];
  subjects:TaxonomySubject[];
  getCsrfToken:()=>Promise<string>;
  onCreated:()=>void;
  onClose:()=>void;
}

// Mounted per school and opened section: late responses from A cannot commit
// into B (or A again after an intervening visit).
export function DirectorAssessmentCreator({schoolId,classes,paths,subjects,getCsrfToken,onCreated,onClose}:Props){
  const [title,setTitle]=useState('');
  const [targetScope,setTargetScope]=useState<'class'|'classes'|'school'|'selected'>('class');
  const [classId,setClassId]=useState('');
  const [classIds,setClassIds]=useState<string[]>([]);
  const [studentIds,setStudentIds]=useState<string[]>([]);
  const [selectedCandidates,setSelectedCandidates]=useState<Record<string,DirectorAssessmentCandidate>>({});
  const [studentSearch,setStudentSearch]=useState('');
  const [studentPage,setStudentPage]=useState(1);
  const [candidates,setCandidates]=useState<DirectorAssessmentCandidate[]>([]);
  const [studentHasMore,setStudentHasMore]=useState(false);
  const [studentLoading,setStudentLoading]=useState(false);
  const [studentError,setStudentError]=useState('');
  const [pathId,setPathId]=useState('');
  const [subjectId,setSubjectId]=useState('');
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(1);
  const [questions,setQuestions]=useState<DirectorAssessmentQuestion[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [settings,setSettings]=useState<DirectorAssessmentSettings>({
    maxAttempts:3,passingScore:60,timeLimitMinutes:60,optionLayout:'auto',randomizeQuestions:true,randomizeOptions:false,
    showProgressBar:true,requireAnswerBeforeNext:false,allowQuestionReview:true,showAnswers:true,showResultsReport:true,showExplanations:true,
  });
  const [loading,setLoading]=useState(false);
  const [hasMore,setHasMore]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [pickerError,setPickerError]=useState('');
  const alive=useRef(true);
  const requestKey=useRef(crypto.randomUUID());

  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
  useEffect(()=>{
    const controller=new AbortController();
    setQuestions([]);setHasMore(false);setPickerError('');setLoading(false);
    if(!pathId||!subjectId)return()=>controller.abort();
    setLoading(true);
    const timer=setTimeout(()=>{
      organizationsClient.directorAssessmentQuestions(schoolId,pathId,subjectId,search.trim(),page,controller.signal)
        .then(page=>{if(!controller.signal.aborted&&alive.current){setQuestions(page.items);setHasMore(page.hasMore)}})
        .catch(err=>{if(!controller.signal.aborted&&alive.current)setPickerError(err instanceof Error?err.message:'تعذر تحميل الأسئلة المعتمدة')})
        .finally(()=>{if(!controller.signal.aborted&&alive.current)setLoading(false)});
    },250);
    return()=>{clearTimeout(timer);controller.abort()};
  },[schoolId,pathId,subjectId,search,page]);

  useEffect(()=>{
    const controller=new AbortController();
    setCandidates([]);setStudentHasMore(false);setStudentError('');setStudentLoading(false);
    if(targetScope!=='selected')return()=>controller.abort();
    setStudentLoading(true);
    const timer=setTimeout(()=>{
      organizationsClient.directorAssessmentEligibleStudents(schoolId,studentSearch.trim(),studentPage,controller.signal)
        .then(result=>{if(!controller.signal.aborted&&alive.current){setCandidates(result.items);setStudentHasMore(result.hasMore)}})
        .catch(err=>{if(!controller.signal.aborted&&alive.current)setStudentError(err instanceof Error?err.message:'تعذر تحميل الطلاب')})
        .finally(()=>{if(!controller.signal.aborted&&alive.current)setStudentLoading(false)});
    },200);
    return()=>{clearTimeout(timer);controller.abort()};
  },[schoolId,targetScope,studentSearch,studentPage]);

  function changePath(next:string){setPathId(next);setSubjectId('');setSelected([]);setSearch('');setPage(1)}
  function changeSubject(next:string){setSubjectId(next);setSelected([]);setSearch('');setPage(1)}
  function toggle(id:string){setSelected(prev=>prev.includes(id)?prev.filter(q=>q!==id):[...prev,id])}
  function toggleClass(id:string){setClassIds(prev=>prev.includes(id)?prev.filter(value=>value!==id):[...prev,id])}
  function toggleStudent(candidate:DirectorAssessmentCandidate){
    setSelectedCandidates(prev=>({...prev,[candidate.studentId]:candidate}));
    setStudentIds(prev=>prev.includes(candidate.studentId)?prev.filter(id=>id!==candidate.studentId):[...prev,candidate.studentId]);
  }

  const validAudience=targetScope==='school'||(targetScope==='class'&&Boolean(classId))||(targetScope==='classes'&&classIds.length>=2)||(targetScope==='selected'&&(classIds.length+studentIds.length)>0);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(saving||!title.trim()||!pathId||!subjectId||selected.length===0||!validAudience)return;
    setSaving(true);setError('');
    try{
      const csrf=await getCsrfToken();
      await organizationsClient.createDirectorAssessment(schoolId,{
        title:title.trim(),targetScope,classId:targetScope==='class'?classId:'',classIds:targetScope==='classes'||targetScope==='selected'?classIds:[],studentIds:targetScope==='selected'?studentIds:[],pathId,subjectId,questionIds:selected,settings,
      },csrf,requestKey.current);
      if(!alive.current)return;
      requestKey.current=crypto.randomUUID();
      onCreated();
    }catch(e){if(alive.current)setError(e instanceof Error?e.message:'تعذر إنشاء الاختبار')}
    finally{if(alive.current)setSaving(false)}
  }

  return <form onSubmit={event=>void submit(event)} aria-label="نموذج إنشاء اختبار مدرسي" className="mt-5 min-w-0 space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black text-indigo-950">إنشاء اختبار من الأسئلة المعتمدة</h3><button type="button" onClick={onClose} className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold">إلغاء</button></div>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <label className="min-w-0 text-xs font-black text-slate-700">عنوان الاختبار<input aria-label="عنوان الاختبار المدرسي" required minLength={2} maxLength={240} value={title} onChange={e=>setTitle(e.target.value)} className="mt-1.5 w-full min-w-0 rounded-xl border bg-white px-3 py-2 text-sm" placeholder="مثال: اختبار الرياضيات - الفصل الأول"/></label>
      <label className="min-w-0 text-xs font-black text-slate-700">المستهدف<select aria-label="نطاق اختبار المدرسة" value={targetScope} onChange={e=>setTargetScope(e.target.value as 'class'|'classes'|'school'|'selected')} className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2 text-sm"><option value="class">فصل محدد</option><option value="classes">فصول متعددة — اختبار مركزي</option><option value="selected">فصول وطلاب محددون بالاسم</option><option value="school">طلاب المدرسة كاملة</option></select></label>
      {targetScope==='class'?<label className="min-w-0 text-xs font-black text-slate-700">الفصل<select aria-label="فصل الاختبار المدرسي" required value={classId} onChange={e=>setClassId(e.target.value)} className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2 text-sm"><option value="">اختر الفصل</option>{classes.map(c=><option key={c.classId} value={c.classId}>{c.className}</option>)}</select></label>:null}
      {targetScope==='classes'||targetScope==='selected'?<fieldset aria-label="الفصول المستهدفة للاختبار المركزي" className="min-w-0 space-y-2 rounded-xl border border-indigo-200 bg-white p-3 sm:col-span-2 xl:col-span-3"><legend className="px-1 text-xs font-black text-slate-700">{targetScope==='classes'?'اختر فصلين على الأقل':'اختر فصولًا إن رغبت'} — {classIds.length} محدد</legend><div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">{classes.map(c=><label key={c.classId} className="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm"><input aria-label={`اختيار الفصل ${c.className}`} type="checkbox" checked={classIds.includes(c.classId)} onChange={()=>toggleClass(c.classId)} className="h-4 w-4 shrink-0"/><span className="min-w-0 break-words">{c.className}</span></label>)}</div>{targetScope==='classes'&&classes.length<2?<p role="status" className="text-xs text-amber-800">يلزم وجود فصلين نشطين على الأقل لإنشاء اختبار مركزي لعدة فصول.</p>:null}</fieldset>:null}
      {targetScope==='selected'?<fieldset aria-label="اختيار الطلاب بالاسم" className="min-w-0 space-y-3 rounded-xl border border-indigo-200 bg-white p-3 sm:col-span-2 xl:col-span-3"><legend className="px-1 text-xs font-black text-slate-700">الطلاب بالاسم — يمكن الجمع بينهم وبين الفصول</legend>
        <label className="block text-xs font-bold">ابحث عن طالب<input aria-label="بحث طلاب الاختبار" value={studentSearch} onChange={event=>{setStudentSearch(event.target.value);setStudentPage(1)}} className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2 text-sm" placeholder="اسم الطالب"/></label>
        <p className="text-xs font-black text-indigo-700">تم اختيار {studentIds.length} طالب</p>
        {studentIds.length>0?<div aria-label="الطلاب المختارون" className="flex flex-wrap gap-2">{studentIds.map(id=><button type="button" key={id} onClick={()=>setStudentIds(prev=>prev.filter(candidate=>candidate!==id))} className="max-w-full break-words rounded-lg bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-900">{selectedCandidates[id]?.name||id} ×</button>)}</div>:null}
        {studentLoading?<p role="status" className="text-xs text-slate-500">جار تحميل الطلاب…</p>:null}
        {studentError?<p role="alert" className="text-xs text-rose-700">{studentError}</p>:null}
        <div className="grid max-h-48 min-w-0 gap-2 overflow-y-auto sm:grid-cols-2">{candidates.map(candidate=><label key={candidate.studentId} className="flex min-w-0 items-center gap-2 rounded-lg border p-2 text-sm"><input aria-label={`اختيار الطالب ${candidate.name}`} type="checkbox" checked={studentIds.includes(candidate.studentId)} onChange={()=>toggleStudent(candidate)}/><span className="min-w-0 break-words">{candidate.name}<small className="block text-slate-500">{candidate.className}</small></span></label>)}</div>
        <div className="flex items-center justify-between gap-2 text-xs font-bold"><button type="button" disabled={studentPage===1||studentLoading} onClick={()=>setStudentPage(p=>p-1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">السابق للطلاب</button><span>صفحة الطلاب {studentPage}</span><button type="button" disabled={!studentHasMore||studentLoading} onClick={()=>setStudentPage(p=>p+1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">التالي للطلاب</button></div>
      </fieldset>:null}
      <label className="min-w-0 text-xs font-black text-slate-700">المسار<select aria-label="مسار الاختبار المدرسي" required value={pathId} onChange={e=>changePath(e.target.value)} className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2 text-sm"><option value="">اختر المسار</option>{paths.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="min-w-0 text-xs font-black text-slate-700">المادة<select aria-label="مادة الاختبار المدرسي" required value={subjectId} onChange={e=>changeSubject(e.target.value)} disabled={!pathId} className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2 text-sm"><option value="">اختر المادة</option>{subjects.filter(s=>s.pathId===pathId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="min-w-0 text-xs font-black text-slate-700">بحث عن السؤال<input aria-label="بحث الأسئلة المعتمدة" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} disabled={!subjectId} className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2 text-sm" placeholder="الكود أو جزء من السؤال"/></label>
    </div>
    <fieldset aria-label="إعدادات الاختبار المدرسي" className="min-w-0 space-y-3 rounded-xl border border-indigo-200 bg-white p-3"><legend className="px-1 text-xs font-black text-slate-800">إعدادات الاختبار — مثل منشئ الاختبارات القديم</legend>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-bold text-slate-700">درجة النجاح (%)<input aria-label="درجة النجاح للاختبار" type="number" min={0} max={100} step={1} required value={settings.passingScore} onChange={e=>setSettings(prev=>({...prev,passingScore:Number(e.target.value)}))} className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2 text-sm"/></label>
        <label className="text-xs font-bold text-slate-700">الوقت (دقائق؛ 0 بلا حد)<input aria-label="مدة الاختبار بالدقائق" type="number" min={0} max={1440} required value={settings.timeLimitMinutes} onChange={e=>setSettings(prev=>({...prev,timeLimitMinutes:Number(e.target.value)}))} className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2 text-sm"/></label>
        <label className="text-xs font-bold text-slate-700">المحاولات المسموحة<input aria-label="عدد محاولات الاختبار" type="number" min={1} max={100} required value={settings.maxAttempts} onChange={e=>setSettings(prev=>({...prev,maxAttempts:Number(e.target.value)}))} className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2 text-sm"/></label>
        <label className="text-xs font-bold text-slate-700">توزيع الاختيارات<select aria-label="طريقة عرض اختيارات الاختبار" value={settings.optionLayout} onChange={e=>setSettings(prev=>({...prev,optionLayout:e.target.value as DirectorAssessmentSettings['optionLayout']}))} className="mt-1 w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm"><option value="auto">تلقائي</option><option value="two_columns">اختياران في الصف</option><option value="horizontal">أفقي للشاشات الواسعة</option></select></label>
      </div>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {([
          ['randomizeQuestions','خلط ترتيب أسئلة الاختبار'],
          ['randomizeOptions','خلط ترتيب الإجابات'],
          ['showProgressBar','إظهار شريط التقدم'],
          ['requireAnswerBeforeNext','منع تخطي السؤال دون إجابة'],
          ['allowQuestionReview','السماح بمراجعة الأسئلة'],
          ['showAnswers','إظهار الإجابات بعد الاختبار'],
          ['showResultsReport','إظهار تقرير الطالب بعد الانتهاء'],
          ['showExplanations','إظهار الشرح بعد الاختبار'],
        ] as const).map(([key,label])=><label key={key} className="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold text-slate-700"><input type="checkbox" aria-label={label} checked={settings[key]} onChange={e=>setSettings(prev=>({...prev,[key]:e.target.checked}))} className="h-4 w-4 shrink-0"/><span className="min-w-0 break-words">{label}</span></label>)}
      </div>
      <p className="text-xs text-slate-500">عرض اختيارين أو عرض أفقي يطبّق على المساحات المناسبة؛ على الجوال تظل الاختيارات عمودية.</p>
    </fieldset>
    <div className="min-w-0 rounded-xl border border-indigo-100 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black">الأسئلة المعتمدة فقط</p><span className="text-xs font-black text-indigo-700">تم اختيار {selected.length} سؤال</span></div>
      {loading?<p role="status" className="mt-3 text-xs text-slate-500">جار تحميل الأسئلة…</p>:null}
      {pickerError?<p role="alert" className="mt-3 text-xs font-bold text-rose-700">{pickerError}</p>:null}
      {!subjectId?<p className="mt-3 text-xs text-slate-500">اختر المسار والمادة لعرض الأسئلة.</p>:null}
      {subjectId&&!loading&&!pickerError&&questions.length===0?<p className="mt-3 text-xs text-slate-500">لا توجد أسئلة معتمدة مطابقة.</p>:null}
      <div className="mt-3 grid max-h-80 min-w-0 gap-2 overflow-y-auto">{questions.map(q=><label key={q.id} className="flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-3 hover:bg-slate-50"><input type="checkbox" checked={selected.includes(q.id)} onChange={()=>toggle(q.id)} aria-label={`اختيار السؤال ${q.questionCode}`} className="mt-1 h-4 w-4 shrink-0"/><span className="min-w-0 flex-1"><strong className="block break-words text-xs text-indigo-800">{q.questionCode}</strong><span className="mt-1 block break-words text-sm text-slate-700">{q.text||q.imageAlt||'سؤال مصور'}</span>{q.imageUrl?<img src={q.imageUrl} alt={q.imageAlt||`صورة ${q.questionCode}`} loading="lazy" className="mt-2 max-h-44 max-w-full rounded-lg object-contain"/>:null}</span></label>)}</div>
      {subjectId?<div className="mt-3 flex items-center justify-between gap-2 text-xs font-bold"><button type="button" disabled={page===1||loading} onClick={()=>setPage(v=>v-1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">السابق</button><span>صفحة {page}</span><button type="button" disabled={!hasMore||loading} onClick={()=>setPage(v=>v+1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">التالي</button></div>:null}
    </div>
    {error?<p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>:null}
    <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={saving||!title.trim()||!pathId||!subjectId||selected.length===0||!validAudience} className="rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-black text-white disabled:opacity-40">{saving?'جار نشر اختبار المدرسة…':'إنشاء ونشر للطلاب المستهدفين'}</button><p className="text-xs text-slate-600">الاختبار خاص بالمدرسة؛ لا يُنشر على المنصة العامة.</p></div>
  </form>;
}
