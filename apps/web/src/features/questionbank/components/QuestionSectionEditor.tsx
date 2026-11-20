import { useEffect, useRef, useState } from 'react';
import type { TaxonomySkillSection } from '../../content/api/content-types';
import { questionBankClient } from '../api/questionbank-client';

export function QuestionSectionEditor({questionId,subjectId,sections,getCsrfToken}: {questionId:string;subjectId:string;sections:TaxonomySkillSection[];getCsrfToken:()=>Promise<string>}) {
  const [section,setSection]=useState('');
  const [saved,setSaved]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [loadFailed,setLoadFailed]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [reload,setReload]=useState(0);
  const saving=useRef(false);
  const controller=useRef<AbortController|null>(null);
  const available=sections.filter(item=>item.subjectId===subjectId);
  useEffect(()=>{
    const c=new AbortController();controller.current=c;
    setLoading(true);setLoadFailed(false);setError('');setMessage('');
    questionBankClient.section(questionId,c.signal).then(data=>{if (!c.signal.aborted){setSection(data.sectionId||'');setSaved(data.sectionId||'');}})
      .catch(()=>{if(!c.signal.aborted){setLoadFailed(true);setError('تعذر تحميل قسم السؤال.');}})
      .finally(()=>{if(!c.signal.aborted)setLoading(false);});
    return ()=>{c.abort();if(controller.current===c)controller.current=null;};
  },[questionId,subjectId,reload]);
  async function save(){
    if(saving.current || loading || loadFailed || section===saved || (section && !available.some(item=>item.id===section)))return;
    saving.current=true;setBusy(true);setError('');setMessage('');
    const c=controller.current;
    try {
      const csrf=await getCsrfToken();
      if(!c || c.signal.aborted)return;
      const result=await questionBankClient.setSection(questionId,section,csrf,c.signal);
      if(!c.signal.aborted){setSaved(result.sectionId||'');setMessage('حُفظ قسم السؤال.');}
    } catch {if(c && !c.signal.aborted)setError('تعذر حفظ القسم. تأكد من اختيار قسم نشط في مادة السؤال.');}
    finally {saving.current=false;if(c && !c.signal.aborted)setBusy(false);}
  }
  return <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
    <label className="block text-sm font-bold">قسم السؤال<select value={section} onChange={event=>{setSection(event.target.value);setMessage('');}} disabled={loading||busy||loadFailed} className="mt-2 w-full rounded-lg border bg-white p-2 text-sm"><option value="">بدون قسم</option>{section&&!available.some(item=>item.id===section)&&<option value={section} disabled>القسم الحالي غير متاح</option>}{available.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <p className="text-xs text-slate-600">يستخدم القسم لتحديد أسئلة الاختبار الذاتي، وهو مستقل عن مهارات السؤال وأقسام المحاكي.</p>
    {error&&<p role="alert" className="text-xs text-red-700">{error} {loadFailed&&<button type="button" onClick={()=>setReload(value=>value+1)} className="underline">إعادة التحميل</button>}</p>}
    {message&&<p role="status" className="text-xs text-emerald-700">{message}</p>}
    <button type="button" onClick={()=>void save()} disabled={loading||busy||loadFailed||section===saved||Boolean(section&&!available.some(item=>item.id===section))} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">حفظ قسم السؤال</button>
  </div>;
}
