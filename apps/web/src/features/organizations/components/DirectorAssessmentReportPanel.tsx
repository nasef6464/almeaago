import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { organizationsClient, type DirectorAssessmentReport } from '../api/organizations-client';
import { DirectorAssessmentLearnersPanel } from './DirectorAssessmentLearnersPanel';

export function DirectorAssessmentReportPanel({schoolId,assessmentId,title,canViewLearners,onClose}:{
  schoolId:string;assessmentId:string;title:string;canViewLearners:boolean;onClose:()=>void;
}){
  const [report,setReport]=useState<DirectorAssessmentReport|null>(null);
  const [tab,setTab]=useState<'summary'|'learners'|'analysis'>('summary');
  const [revision,setRevision]=useState(0);
  const [learnerPreset,setLearnerPreset]=useState<'all'|'not_completed'|'needs_support'>('all');
  const [learnerRevision,setLearnerRevision]=useState(0);
  const openLearners=(status:'all'|'not_completed'|'needs_support')=>{
    if(!canViewLearners)return;
    setLearnerPreset(status);setLearnerRevision(value=>value+1);setTab('learners');
  };
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const closeButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setReport(null);setError('');
    organizationsClient.directorAssessmentReport(schoolId,assessmentId,controller.signal)
      .then(result=>{if(!controller.signal.aborted)setReport(result)})
      .catch(()=>{if(!controller.signal.aborted)setError('تعذر تحميل ملخص الاختبار أو لا تملك صلاحية عرضه.')})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    closeButton.current?.focus();
    return()=>controller.abort();
  },[assessmentId,schoolId,revision]);
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
        <nav aria-label="أقسام نتائج الاختبار" className="flex flex-wrap gap-2 border-b pb-3">
          <button type="button" aria-pressed={tab==='summary'} onClick={()=>setTab('summary')} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab==='summary'?'bg-indigo-700 text-white':'border bg-white text-indigo-700'}`}>الملخص</button>
          {canViewLearners?<button type="button" aria-pressed={tab==='learners'} onClick={()=>openLearners('all')} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab==='learners'?'bg-indigo-700 text-white':'border bg-white text-indigo-700'}`}>نتائج الطلاب</button>:null}
          <button type="button" aria-pressed={tab==='analysis'} onClick={()=>setTab('analysis')} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab==='analysis'?'bg-indigo-700 text-white':'border bg-white text-indigo-700'}`}>المواد والمهارات</button>
        </nav>
        {tab==='summary'?<><h4 className="text-base font-black text-indigo-800">الملخص</h4>
        {loading?<p role="status" className="rounded-xl border bg-slate-50 p-4 text-sm">جار تحميل نتائج الاختبار…</p>:null}
        {error?<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error} <button type="button" className="underline" onClick={()=>setRevision(value=>value+1)}>إعادة المحاولة</button></div>:null}
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
          <section aria-label="متابعة التسليم" className="space-y-2 rounded-xl border bg-sky-50/50 p-4">
            <div className="flex flex-wrap justify-between gap-2 text-sm"><strong>متابعة التسليم</strong><span>{report.participation.completed} من {report.audience.targeted}</span></div>
            {report.audience.targeted>0?<div role="progressbar" aria-label="نسبة التسليم" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0,Math.min(100,Math.round(report.participation.completed*100/report.audience.targeted)))} className="h-2 overflow-hidden rounded-full bg-slate-200"><div style={{width:Math.max(0,Math.min(100,Math.round(report.participation.completed*100/report.audience.targeted)))+'%'}} className="h-full rounded-full bg-indigo-600"/></div>:<p className="text-sm text-slate-600">لا يوجد طلاب مستهدفون ضمن هذا النطاق.</p>}
            <p className="text-xs text-slate-600">عدم التسليم ليس حكمًا بضعف الطالب. الحضور وإتقان المهارة لهما أدلتهما المستقلة.</p>
          </section>
          {report.participation.completed===0?<p className="rounded-xl bg-sky-50 p-4 text-sm">لا توجد نتائج مدرسية مسجلة لهذا الاختبار حتى الآن.</p>:null}
          {canViewLearners?<div className="flex flex-wrap gap-2">
            <button type="button" onClick={()=>openLearners('not_completed')} className="rounded-xl border bg-white px-3 py-2 text-sm font-bold">من لم يسلّم؟</button>
            <button type="button" onClick={()=>openLearners('needs_support')} className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-800">من يحتاج دعمًا في هذا الاختبار؟</button>
          </div>:null}
          {!report.coverage.complete?<p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">التقرير يعرض النتائج المحفوظة فقط. بيانات من بدأوا الاختبار وتحليل المواد والمهارات ليست مكتملة بعد؛ لذلك لا نعرض أرقامًا تقديرية لها.</p>:null}
          <p className="text-xs leading-6 text-slate-500">{canViewLearners?'نتائج الطلاب متاحة عبر التبويب الخاص بها. إجراءات تعديل أو نسخ أو إعادة فتح الاختبار تُنقل في الدفعة التالية.':'تفاصيل الطلاب وإجراءات تعديل أو نسخ أو إعادة فتح الاختبار تُنقل في الدفعة التالية بعد اعتماد صلاحياتها.'}</p>
        </>:null}
        </>:tab==='learners'&&canViewLearners?
          <DirectorAssessmentLearnersPanel key={`${schoolId}:${assessmentId}:${learnerPreset}:${learnerRevision}`} schoolId={schoolId} assessmentId={assessmentId} initialStatus={learnerPreset}/>
        :tab==='analysis'?<>
          {loading?<p role="status" className="p-4">جارٍ حساب نتائج جميع المستهدفين…</p>:null}
          {error?<div role="alert" className="rounded-xl bg-rose-50 p-4">تعذر تحميل ملخص الاختبار أو لا تملك صلاحية عرضه. <button type="button" className="underline" onClick={()=>setRevision(value=>value+1)}>إعادة المحاولة</button></div>:null}
          {report&&!loading&&!error?<div className="min-w-0 space-y-4" dir="rtl">
            <p className="text-sm text-slate-600">المادة أولًا، ثم أقسامها ومهاراتها. القسم الواحد قد يضم أسئلة من أكثر من مادة.</p>
            {report.subjects.length===0&&report.subjectBreakdowns.length===0?<p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">لا توجد بيانات مواد مصنفة في النتائج المحفوظة.</p>:<p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">تفاصيل المواد المحفوظة تتطلب استكمال عقد بيانات التحليل المدرسي قبل عرضها.</p>}
            {!report.coverage.subjects.complete?<p className="text-xs text-amber-800">الأدلة المصنفة متاحة لـ {report.coverage.subjects.withEvidence} من {report.coverage.subjects.completed} نتيجة مدرسية؛ الأدلة الناقصة لا تُحسب صفرًا ولا تنسب لمادة افتراضية.</p>:null}
          </div>:null}
        </>:null}
      </div>
    </section>
  </div>;
}
