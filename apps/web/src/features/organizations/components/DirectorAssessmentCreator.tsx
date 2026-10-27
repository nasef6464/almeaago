import { useEffect, useRef, useState, type FormEvent } from 'react';

import type { TaxonomyPath, TaxonomySubject } from '../../content/api/content-types';
import {
  organizationsClient,
  type DirectorAssessmentQuestion,
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
  const [targetScope,setTargetScope]=useState<'class'|'school'>('class');
  const [classId,setClassId]=useState('');
  const [pathId,setPathId]=useState('');
  const [subjectId,setSubjectId]=useState('');
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(1);
  const [questions,setQuestions]=useState<DirectorAssessmentQuestion[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
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

  function changePath(next:string){setPathId(next);setSubjectId('');setSelected([]);setSearch('');setPage(1)}
  function changeSubject(next:string){setSubjectId(next);setSelected([]);setSearch('');setPage(1)}
  function toggle(id:string){setSelected(prev=>prev.includes(id)?prev.filter(q=>q!==id):[...prev,id])}

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(saving||!title.trim()||!pathId||!subjectId||selected.length===0||(targetScope==='class'&&!classId))return;
    setSaving(true);setError('');
    try{
      const csrf=await getCsrfToken();
      await organizationsClient.createDirectorAssessment(schoolId,{
        title:title.trim(),targetScope,classId:targetScope==='school'?'':classId,pathId,subjectId,questionIds:selected,
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
      <label className="min-w-0 text-xs font-black text-slate-700">المستهدف<select aria-label="نطاق اختبار المدرسة" value={targetScope} onChange={e=>setTargetScope(e.target.value as 'class'|'school')} className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2 text-sm"><option value="class">فصل محدد</option><option value="school">طلاب المدرسة كاملة</option></select></label>
      {targetScope==='class'?<label className="min-w-0 text-xs font-black text-slate-700">الفصل<select aria-label="فصل الاختبار المدرسي" required value={classId} onChange={e=>setClassId(e.target.value)} className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2 text-sm"><option value="">اختر الفصل</option>{classes.map(c=><option key={c.classId} value={c.classId}>{c.className}</option>)}</select></label>:null}
      <label className="min-w-0 text-xs font-black text-slate-700">المسار<select aria-label="مسار الاختبار المدرسي" required value={pathId} onChange={e=>changePath(e.target.value)} className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2 text-sm"><option value="">اختر المسار</option>{paths.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="min-w-0 text-xs font-black text-slate-700">المادة<select aria-label="مادة الاختبار المدرسي" required value={subjectId} onChange={e=>changeSubject(e.target.value)} disabled={!pathId} className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2 text-sm"><option value="">اختر المادة</option>{subjects.filter(s=>s.pathId===pathId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="min-w-0 text-xs font-black text-slate-700">بحث عن السؤال<input aria-label="بحث الأسئلة المعتمدة" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} disabled={!subjectId} className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2 text-sm" placeholder="الكود أو جزء من السؤال"/></label>
    </div>
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
    <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={saving||!title.trim()||!pathId||!subjectId||selected.length===0||(targetScope==='class'&&!classId)} className="rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-black text-white disabled:opacity-40">{saving?'جار نشر اختبار المدرسة…':'إنشاء ونشر للطلاب المستهدفين'}</button><p className="text-xs text-slate-600">الاختبار خاص بالمدرسة؛ لا يُنشر على المنصة العامة.</p></div>
  </form>;
}
