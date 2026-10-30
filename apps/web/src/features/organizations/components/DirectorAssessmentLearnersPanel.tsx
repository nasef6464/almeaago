import { useEffect, useState } from 'react';

import {organizationsClient,type DirectorAssessmentLearnerPage,type DirectorAssessmentLearnerResult,type DirectorAssessmentLearnerStatus} from '../api/organizations-client';

type Query={page:number;status:DirectorAssessmentLearnerStatus;search:string};
const number=(value:number)=>value.toLocaleString('ar-SA',{maximumFractionDigits:2});

function LearnerResult({schoolId,assessmentId,attemptId,onClose}:{schoolId:string;assessmentId:string;attemptId:string;onClose:()=>void}){
  const [state,setState]=useState<{result?:DirectorAssessmentLearnerResult['result'];error?:string;loading:boolean}>({loading:true});
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setState({loading:true});
    organizationsClient.directorAssessmentLearnerResult(schoolId,assessmentId,attemptId,controller.signal)
      .then(({result})=>{if(!controller.signal.aborted)setState({loading:false,result})})
      .catch(()=>{if(!controller.signal.aborted)setState({loading:false,error:'تعذر تحميل النتيجة المحفوظة.'})});
    return()=>controller.abort();
  },[schoolId,assessmentId,attemptId,revision]);
  const result=state.result;
  return <section role="region" aria-label="تفاصيل نتيجة الطالب" className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-black text-indigo-900">النتيجة المحفوظة للطالب</h4><button type="button" className="rounded-lg border bg-white px-3 py-2 text-sm" onClick={onClose}>إغلاق النتيجة</button></div>
    {state.loading?<p role="status">جارٍ تحميل النتيجة…</p>:null}
    {state.error?<div role="alert"><p>{state.error}</p><button type="button" className="rounded-lg border bg-white px-3 py-2" onClick={()=>setRevision(n=>n+1)}>إعادة تحميل النتيجة</button></div>:null}
    {result?<>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        {[
          ['الدرجة الإجمالية',`${number(result.score)}٪`],['رقم المحاولة',number(result.attemptNumber)],
          ['الإجابات الصحيحة',number(result.correctAnswers)],['الإجابات الخاطئة',number(result.wrongAnswers)],
          ['دون إجابة',number(result.unanswered)],['إجمالي الأسئلة',number(result.totalQuestions)],
        ].map(([label,value])=><p key={label} className="rounded-lg border bg-white p-2"><span className="block text-xs text-slate-500">{label}</span><strong>{value}</strong></p>)}
      </div>
      <p className="text-sm font-semibold text-slate-700">{result.passed?'اجتاز الاختبار':'يحتاج دعمًا وفق النتيجة المحفوظة'}</p>
      {[
        {title:'تحليل أقسام الاختبار',rows:result.sectionResults},
        {title:'تحليل المهارات',rows:result.skillsAnalysis},
      ].map(group=><section key={group.title} className="space-y-2"><h5 className="font-bold text-slate-800">{group.title}</h5>
        {group.rows.length?<ul className="grid gap-2 sm:grid-cols-2">{group.rows.map(row=><li key={row.id} className="min-w-0 rounded-xl border bg-white p-3 text-sm"><strong className="break-words">{row.name}</strong><p className="mt-1 text-slate-600">الإتقان: {number(row.score)}٪ · صحيح {number(row.correctAnswers)} من {number(row.totalQuestions)}</p></li>)}</ul>:<p className="text-sm text-slate-600">لا توجد بيانات محفوظة لهذا التفصيل.</p>}
      </section>)}
      <p className="text-xs text-slate-500">التفاصيل المعروضة مأخوذة من نتيجة مُرسلة محفوظة فقط؛ لا تُعرض مفاتيح الإجابات.</p>
    </>:null}
  </section>;
}

export function DirectorAssessmentLearnersPanel({schoolId,assessmentId,initialStatus='all'}:{schoolId:string;assessmentId:string;initialStatus?:DirectorAssessmentLearnerStatus}){
  const [query,setQuery]=useState<Query>({page:1,status:initialStatus,search:''});
  const [draftSearch,setDraftSearch]=useState('');
  const [revision,setRevision]=useState(0);
  const [selected,setSelected]=useState<string|null>(null);
  const [state,setState]=useState<{key:string;data?:DirectorAssessmentLearnerPage;error?:string}>({key:''});
  const key=JSON.stringify([schoolId,assessmentId,query,revision]);
  useEffect(()=>{
    const controller=new AbortController();setState({key});
    organizationsClient.directorAssessmentLearners(schoolId,assessmentId,{...query,limit:12},controller.signal)
      .then(data=>{if(!controller.signal.aborted)setState({key,data})})
      .catch(()=>{if(!controller.signal.aborted)setState({key,error:'تعذر تحميل الطلاب.'})});
    return()=>controller.abort();
  },[assessmentId,key,query,schoolId]);
  const data=state.key===key?state.data:undefined;
  const error=state.key===key?state.error:undefined;
  const change=(patch:Partial<Query>)=>{setSelected(null);setQuery(current=>({...current,...patch}))};
  return <section role="region" aria-label="نتائج الطلاب" className="min-w-0 space-y-4 rounded-2xl border bg-white p-3 sm:p-4">
    <h3 className="font-black text-indigo-800">نتائج الطلاب</h3>
    <p className="text-sm leading-6 text-slate-600">آخر نتيجة مُرسلة لكل طالب مستهدف. «لم يؤدِّ» تعني عدم وجود نتيجة مدرسية، و«يحتاج دعمًا» تعتمد على قرار الاجتياز المحفوظ لا على حد درجات مفترض.</p>
    <div className="flex flex-wrap gap-3">
      <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">حالة الأداء
        <select aria-label="حالة الأداء" value={query.status} onChange={event=>change({status:event.target.value as DirectorAssessmentLearnerStatus,page:1})} className="max-w-full rounded-xl border p-2 font-normal">
          <option value="all">جميع المستهدفين</option><option value="completed">أكملوا الاختبار</option><option value="not_completed">لم يؤدوا الاختبار</option><option value="needs_support">يحتاجون دعمًا</option>
        </select>
      </label>
      <form className="flex min-w-0 flex-1 flex-wrap gap-2" onSubmit={event=>{event.preventDefault();change({page:1,search:draftSearch.trim()})}}>
        <input aria-label="بحث عن طالب" value={draftSearch} onChange={event=>setDraftSearch(event.target.value)} maxLength={120} placeholder="اسم الطالب أو معرفه" className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"/>
        <button type="submit" className="rounded-xl border px-4 py-2 text-sm font-bold">بحث</button>
      </form>
    </div>
    {!data&&!error?<p role="status">جارٍ تحميل الطلاب…</p>:null}
    {error?<div role="alert"><p>{error}</p><button type="button" onClick={()=>setRevision(n=>n+1)} className="rounded-xl border px-3 py-2">إعادة المحاولة</button></div>:null}
    {data?<>
      <p role="status" className="text-sm text-slate-600">{number(data.pagination.total)} طالب مطابق · الصفحة {number(data.pagination.page)} من {number(Math.max(1,data.pagination.totalPages))}</p>
      {data.learners.length===0?<p className="text-sm">لا يوجد طلاب مطابقون.</p>:<div className="max-w-full overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[540px] text-right text-sm"><caption className="sr-only">آخر نتائج الطلاب المستهدفين</caption>
          <thead className="bg-slate-50"><tr><th className="p-3">الطالب</th><th className="p-3">الحالة</th><th className="p-3">الدرجة</th><th className="p-3">المحاولة</th><th className="p-3">التفاصيل</th></tr></thead>
          <tbody>{data.learners.map(row=><tr key={row.studentId} className="border-t"><td className="p-3 font-semibold">{row.name||row.studentId}</td><td className="p-3">{row.result?(row.result.passed===false?'يحتاج دعمًا':'أكمل'):'لم يؤدِّ'}</td><td className="p-3">{row.result?`${number(row.result.score)}٪`:'—'}</td><td className="p-3">{row.result?number(row.result.attemptNumber):'—'}</td><td className="p-3">{row.result?<button type="button" onClick={()=>setSelected(row.result!.id)} className="whitespace-nowrap rounded-lg border border-indigo-300 px-2 py-1 font-bold text-indigo-700">عرض النتيجة</button>:'—'}</td></tr>)}</tbody>
        </table>
      </div>}
      <nav aria-label="صفحات الطلاب" className="flex flex-wrap gap-2"><button type="button" disabled={query.page<=1} onClick={()=>change({page:query.page-1})} className="rounded-xl border px-3 py-2 text-sm disabled:opacity-40">السابق</button><button type="button" disabled={query.page>=data.pagination.totalPages} onClick={()=>change({page:query.page+1})} className="rounded-xl border px-3 py-2 text-sm disabled:opacity-40">التالي</button></nav>
    </>:null}
    {selected?<LearnerResult key={selected} schoolId={schoolId} assessmentId={assessmentId} attemptId={selected} onClose={()=>setSelected(null)}/>:null}
  </section>;
}
