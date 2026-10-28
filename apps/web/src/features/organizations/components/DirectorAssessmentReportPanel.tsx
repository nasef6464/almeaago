import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { organizationsClient, type DirectorAssessmentReport } from '../api/organizations-client';
import { DirectorAssessmentLearnersPanel } from './DirectorAssessmentLearnersPanel';

export function DirectorAssessmentReportPanel({schoolId,assessmentId,title,canViewLearners,onClose}:{
  schoolId:string;assessmentId:string;title:string;canViewLearners:boolean;onClose:()=>void;
}){
  const [report,setReport]=useState<DirectorAssessmentReport|null>(null);
  const [tab,setTab]=useState<'summary'|'learners'>('summary');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const closeButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setReport(null);setError('');
    organizationsClient.directorAssessmentReport(schoolId,assessmentId,controller.signal)
      .then(result=>{if(!controller.signal.aborted)setReport(result)})
      .catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'تعذر تحميل نتائج الاختبار')})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    closeButton.current?.focus();
    return()=>controller.abort();
  },[assessmentId,schoolId]);
  useEffect(()=>{
    function escape(event:KeyboardEvent){if(event.key==='Escape')onClose()}
    window.addEventListener('keydown',escape);
    return()=>window.removeEventListener('keydown',escape);
  },[onClose]);

  const format=(number:number|null,suffix='')=>number===null?'لا توجد نتائج بعد':`${number.toLocaleString('ar-SA',{maximumFractionDigits:2})}${suffix}`;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 sm:p-6" dir="rtl" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section role="dialog" aria-modal="true" aria-label={`النتائج والإدارة — ${title}`} className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b p-4 sm:p-5">
        <div className="min-w-0"><h3 className="break-words text-lg font-black text-slate-900">النتائج والإدارة</h3><p className="mt-1 break-words text-sm text-slate-600">{title}</p></div>
        <button ref={closeButton} type="button" aria-label="إغلاق نتائج الاختبار" onClick={onClose} className="rounded-xl border p-2 text-slate-700 hover:bg-slate-50"><X size={20}/></button>
      </header>
      <div className="min-w-0 space-y-4 overflow-y-auto p-4 sm:p-5">
        {canViewLearners?<nav aria-label="أقسام نتائج الاختبار" className="flex flex-wrap gap-2 border-b pb-3">
          <button type="button" aria-pressed={tab==='summary'} onClick={()=>setTab('summary')} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab==='summary'?'bg-indigo-700 text-white':'border bg-white text-indigo-700'}`}>الملخص</button>
          <button type="button" aria-pressed={tab==='learners'} onClick={()=>setTab('learners')} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab==='learners'?'bg-indigo-700 text-white':'border bg-white text-indigo-700'}`}>نتائج الطلاب</button>
        </nav>:null}
        {tab==='summary'?<><h4 className="text-base font-black text-indigo-800">الملخص</h4>
        {loading?<p role="status" className="rounded-xl border bg-slate-50 p-4 text-sm">جار تحميل نتائج الاختبار…</p>:null}
        {error?<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>:null}
        {report&&!loading&&!error?<>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="ملخص نتائج الاختبار">
            {[
              {label:'الطلاب المستهدفون',value:format(report.audience.targeted)},
              {label:'أكملوا الاختبار',value:format(report.participation.completed)},
              {label:'لم يكملوا الاختبار',value:format(report.participation.notCompleted)},
              {label:'متوسط الدرجات',value:format(report.scores.average,'%')},
              {label:'نسبة الاجتياز',value:format(report.scores.passRate,'%')},
              {label:'أعلى درجة',value:format(report.scores.highest,'%')},
              {label:'أقل درجة',value:format(report.scores.lowest,'%')},
            ].map(metric=><article key={metric.label} className="min-w-0 rounded-xl border bg-slate-50 p-3 sm:p-4"><p className="text-xs font-bold text-slate-600">{metric.label}</p><p className="mt-2 break-words text-lg font-black text-slate-900">{metric.value}</p></article>)}
          </div>
          {!report.coverage.complete?<p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">التقرير يعرض النتائج المحفوظة فقط. بيانات من بدأوا الاختبار وتحليل المواد والمهارات ليست مكتملة بعد؛ لذلك لا نعرض أرقامًا تقديرية لها.</p>:null}
          <p className="text-xs leading-6 text-slate-500">{canViewLearners?'نتائج الطلاب متاحة عبر التبويب الخاص بها. إجراءات تعديل أو نسخ أو إعادة فتح الاختبار تُنقل في الدفعة التالية.':'تفاصيل الطلاب وإجراءات تعديل أو نسخ أو إعادة فتح الاختبار تُنقل في الدفعة التالية بعد اعتماد صلاحياتها.'}</p>
        </>:null}
        </>:canViewLearners?<DirectorAssessmentLearnersPanel key={`${schoolId}:${assessmentId}`} schoolId={schoolId} assessmentId={assessmentId}/>:null}
      </div>
    </section>
  </div>;
}
