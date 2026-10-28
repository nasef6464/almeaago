import { useEffect, useState } from 'react';
import type { AdminTaxonomyPath, AdminTaxonomySubject, PathDisplayInput, SubjectDisplayInput } from '../api/taxonomy-admin-client';

export function TaxonomyDisplayEditor({path,subject,pending,savePath,saveSubject}:{path:AdminTaxonomyPath;subject:AdminTaxonomySubject|null;pending:boolean;savePath:(input:PathDisplayInput)=>Promise<boolean>;saveSubject:(input:SubjectDisplayInput)=>Promise<boolean>}){
  const [navbar,setNavbar]=useState(path.showInNavbar!==false);
  const [home,setHome]=useState(path.showInHome!==false);
  const [stage,setStage]=useState<'auto'|'required'|'none'>(path.settings?.stageSelection??'auto');
  const [label,setLabel]=useState(path.settings?.stageLabel??'');
  const [mock,setMock]=useState(path.settings?.showMockExamCard!==false);
  const [icon,setIcon]=useState(subject?.icon??'');
  const [color,setColor]=useState(subject?.color??'');
  useEffect(()=>{setIcon(subject?.icon??'');setColor(subject?.color??'')},[subject?.id,subject?.icon,subject?.color]);
  return <section className="space-y-3 rounded-3xl border bg-white p-5 shadow-sm">
    <h3 className="font-black">إعدادات العرض في التنقل</h3>
    <label className="flex items-center gap-2"><input type="checkbox" checked={navbar} onChange={e=>setNavbar(e.target.checked)}/>إظهار المسار في القائمة العلوية</label>
    <label className="flex items-center gap-2"><input type="checkbox" checked={home} onChange={e=>setHome(e.target.checked)}/>إظهار المسار في الصفحة الرئيسية</label>
    <label className="flex items-center gap-2"><input type="checkbox" checked={mock} onChange={e=>setMock(e.target.checked)}/>إظهار بطاقة الاختبارات المحاكية</label>
    <label className="block text-sm">اختيار المرحلة<select aria-label="سياسة اختيار المرحلة" value={stage} onChange={e=>setStage(e.target.value as 'auto'|'required'|'none')} className="mx-2 rounded-xl border p-2"><option value="auto">تلقائي</option><option value="required">مطلوب</option><option value="none">بدون اختيار مرحلة</option></select></label>
    <label className="block text-sm">تسمية المرحلة<input aria-label="تسمية المرحلة" value={label} maxLength={120} onChange={e=>setLabel(e.target.value)} className="mx-2 rounded-xl border p-2"/></label>
    <button type="button" disabled={pending} onClick={()=>void savePath({showInNavbar:navbar,showInHome:home,settings:{showMockExamCard:mock,stageSelection:stage,...(label.trim()?{stageLabel:label.trim()}:{})}})} className="rounded-xl bg-indigo-700 px-4 py-2 font-bold text-white disabled:opacity-50">حفظ عرض المسار</button>
    {subject?<div className="grid gap-2 border-t pt-3 sm:grid-cols-3">
      <label className="text-sm">رمز المادة<input aria-label="رمز المادة في التنقل" value={icon} onChange={e=>setIcon(e.target.value)} className="mt-1 w-full rounded-xl border p-2"/></label>
      <label className="text-sm">لون المادة<input aria-label="لون المادة في التنقل" value={color} onChange={e=>setColor(e.target.value)} placeholder="indigo أو #6366f1" className="mt-1 w-full rounded-xl border p-2"/></label>
      <button type="button" disabled={pending} onClick={()=>void saveSubject({icon,color})} className="rounded-xl bg-amber-600 px-4 py-2 font-bold text-white disabled:opacity-50">حفظ عرض المادة</button>
    </div>:null}
  </section>;
}
