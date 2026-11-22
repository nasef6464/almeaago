import { Activity, BarChart3, ChevronDown, ChevronLeft, ClipboardList, Loader2, Target, Users, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { organizationsClient, type RosterMember, type SchoolContext } from '../api/organizations-client';

type SupervisorTab='overview'|'students'|'live-sessions'|'tests'|'live-monitoring'|'skills'|'reports';
const tabs:{id:SupervisorTab;label:string;icon:typeof Users}[]=[
 {id:'overview',label:'الملخص العام',icon:BarChart3},
 {id:'students',label:'تعلم الطلاب وجاهزيتهم',icon:Users},
 {id:'live-sessions',label:'الحصص المباشرة',icon:Video},
 {id:'tests',label:'الاختبارات والتحليل',icon:ClipboardList},
 {id:'live-monitoring',label:'المراقبة الحية',icon:Activity},
 {id:'skills',label:'خريطة المهارات',icon:Target},
 {id:'reports',label:'تقارير الأداء',icon:ClipboardList},
];
const enabledTabs=new Set<SupervisorTab>(['overview','students']);
const groups=[
 {label:'الرئيسية',ids:['overview']},
 {label:'الطلاب والحصص',ids:['students','live-sessions']},
 {label:'الاختبارات والمراقبة',ids:['tests','live-monitoring']},
 {label:'المهارات والتقارير',ids:['skills','reports']},
];
const PAGE_SIZE=20;

export function SupervisorDashboardPage(){
 const {user,loading:authLoading}=useAuth();
 const [params,setParams]=useSearchParams();
 const requested=params.get('tab');
 const tab:SupervisorTab=tabs.some(item=>item.id===requested&&enabledTabs.has(item.id))?requested as SupervisorTab:'students';
 const activeGroup=groups.find(group=>group.ids.includes(tab))?.label||'';
 const [expandedGroup,setExpandedGroup]=useState(activeGroup);
 useEffect(()=>{setExpandedGroup(activeGroup)},[activeGroup]);
 const authorized=Boolean(user?.roles.includes('supervisor'));
 const [contexts,setContexts]=useState<SchoolContext[]>([]);
 const [scopeOwner,setScopeOwner]=useState('');
 const [schoolId,setSchoolId]=useState('');
 const [scopeBusy,setScopeBusy]=useState(true);
 const [scopeError,setScopeError]=useState('');
 const [scopeReload,setScopeReload]=useState(0);
 const [roster,setRoster]=useState<RosterMember[]>([]);
 const [rosterSchoolId,setRosterSchoolId]=useState('');
 const [rosterBusy,setRosterBusy]=useState(false);
 const [rosterError,setRosterError]=useState('');
 const [rosterReload,setRosterReload]=useState(0);
 const [search,setSearch]=useState('');
 const [page,setPage]=useState(1);
 const [total,setTotal]=useState(0);
 const visibleContexts=scopeOwner===user?.id?contexts:[];
 const currentSchool=visibleContexts.find(item=>item.schoolId===schoolId);
 const visibleRoster=!scopeBusy&&!scopeError&&!rosterError&&rosterSchoolId===schoolId?roster:[];

 useEffect(()=>{
  // A refreshed role/relationship scope invalidates every previously fetched student.
  const controller=new AbortController();
  setContexts([]);setScopeOwner('');setRoster([]);setRosterSchoolId('');
  setTotal(0);setRosterError('');setScopeError('');
  if(authLoading||!authorized){setSchoolId('');setScopeBusy(false);return()=>controller.abort();}
  setScopeBusy(true);
  organizationsClient.contexts(controller.signal)
   .then(response=>{
    if(controller.signal.aborted)return;
    const allowed=response.contexts.filter(item=>item.role==='supervisor');
    setContexts(allowed);setScopeOwner(user?.id||'');
    setSchoolId(current=>allowed.some(item=>item.schoolId===current)?current:allowed[0]?.schoolId||'');
   })
   .catch(cause=>{
    if(controller.signal.aborted)return;
    setContexts([]);setScopeOwner('');
    setScopeError(cause instanceof Error?cause.message:'تعذر تحميل نطاق الإشراف');
   })
   .finally(()=>{if(!controller.signal.aborted)setScopeBusy(false);});
  return()=>controller.abort();
 },[authLoading,authorized,user?.id,scopeReload]);

 useEffect(()=>{
  const controller=new AbortController();
  if(page===1){setRoster([]);setRosterSchoolId('');setTotal(0);}
  setRosterError('');
  if(scopeBusy||scopeError||!currentSchool||!authorized||tab!=='students'){
   setRosterBusy(false);return()=>controller.abort();
  }
  setRosterBusy(true);
  organizationsClient.supervisorRoster(schoolId,search,page,controller.signal)
   .then(response=>{
    if(controller.signal.aborted)return;
    const members=response.members.filter(member=>member.roles.includes('student'));
    setRoster(previous=>page===1?members:[...previous,...members]);
    setTotal(response.pagination.total);
    setRosterSchoolId(schoolId);
   })
   .catch(cause=>{
    if(controller.signal.aborted)return;
    if(page===1){setRoster([]);setRosterSchoolId('');}
    setRosterError(cause instanceof Error?cause.message:'تعذر تحميل الطلاب');
   })
   .finally(()=>{if(!controller.signal.aborted)setRosterBusy(false);});
  return()=>controller.abort();
 },[scopeBusy,scopeError,currentSchool?.schoolId,schoolId,authorized,tab,search,page,rosterReload]);

 function selectTab(next:SupervisorTab){
  if(!enabledTabs.has(next))return;
  if(next==='students')setPage(1);
  setParams(previous=>{
   const updated=new URLSearchParams(previous);
   if(next==='students')updated.delete('tab');else updated.set('tab',next);
   return updated;
  });
 }
 if(authLoading)return <main dir="rtl" className="p-10 text-center font-black">جاري التحقق من الحساب...</main>;
 if(!authorized)return <main dir="rtl" className="p-10 text-center font-black text-rose-700">هذه الصفحة مخصصة للمشرف.</main>;

 return <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-5 sm:px-6 sm:py-7">
  <div className="mx-auto max-w-6xl space-y-5">
   <header className="rounded-2xl border bg-white p-5 sm:p-7">
    <h1 className="text-xl font-bold text-gray-900">لوحة الإشراف</h1>
    <p className="mt-1 text-xs text-gray-500">متابعة الفصول والمهارات والتقارير</p>
   </header>
   <nav aria-label="أقسام لوحة المشرف" dir="rtl" className="space-y-3 rounded-2xl border bg-white p-3">
    {groups.map(group=><details key={group.label} open={expandedGroup===group.label} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-2">
     <summary onClick={event=>{event.preventDefault();setExpandedGroup(current=>current===group.label?'':group.label)}}
      className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm font-black text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 [&::-webkit-details-marker]:hidden">
      {group.label}<ChevronDown aria-hidden="true" size={16} className={`shrink-0 transition-transform ${expandedGroup===group.label?'rotate-180':''}`}/>
     </summary>
     <div className="space-y-2 pt-2">
      {tabs.filter(item=>group.ids.includes(item.id)).map(item=>{
       const Icon=item.icon;
       return <button key={item.id} type="button" onClick={()=>selectTab(item.id)}
        disabled={!enabledTabs.has(item.id)}
        aria-current={tab===item.id?'page':undefined}
        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-right transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tab===item.id?'border-indigo-200 bg-indigo-50 text-indigo-800':'border-slate-200 bg-white text-slate-700 hover:border-indigo-200'}`}>
        <span className="shrink-0 text-indigo-600"><Icon size={20}/></span><span className="min-w-0 flex-1 text-sm font-bold">{item.label}</span>
       </button>;
      })}
     </div>
    </details>)}
   </nav>
   <nav aria-label="مسار الصفحة" dir="rtl" className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-500 print:hidden">
    <button type="button" onClick={()=>selectTab('overview')} className="min-h-11 rounded-lg px-1 font-bold text-indigo-700 hover:underline">لوحة الإشراف</button>
    {groups.find(group=>group.ids.includes(tab)&&group.ids.length>1)?<>
     <ChevronLeft aria-hidden="true" size={12}/><span>{groups.find(group=>group.ids.includes(tab))?.label}</span>
    </>:null}
    <ChevronLeft aria-hidden="true" size={12}/><span aria-current="page" className="font-bold text-slate-800">{tabs.find(item=>item.id===tab)?.label}</span>
   </nav>
   {scopeError?<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
    {scopeError}<button type="button" onClick={()=>setScopeReload(n=>n+1)} className="ms-3 rounded-lg border px-3 py-1">إعادة المحاولة</button>
   </div>:null}
   {scopeBusy?<div className="flex items-center gap-2 p-5 text-sm"><Loader2 size={16} className="animate-spin" />جاري تحميل النطاقات...</div>:null}
   {!scopeBusy&&!scopeError&&!visibleContexts.length?<div className="rounded-xl border bg-white p-5 text-sm">لا توجد مدرسة أو فصول مسندة لهذا الحساب حاليًا.</div>:null}
   {!scopeBusy&&!scopeError&&visibleContexts.length>0?<section className="space-y-4 rounded-2xl border bg-white p-4 sm:p-6">
    <label className="block text-sm font-bold text-gray-800">المدرسة
     <select aria-label="المدرسة" value={schoolId} onChange={event=>{setSchoolId(event.target.value);setRosterSchoolId('');setRoster([]);setTotal(0);setPage(1);}}
      className="mt-2 block w-full rounded-xl border border-gray-300 bg-white p-2 sm:max-w-sm">
      {visibleContexts.map(context=><option key={context.schoolId} value={context.schoolId}>{context.schoolName}</option>)}
     </select>
    </label>
    {tab==='overview'?<div className="rounded-xl border p-4">
     <h2 className="font-bold">الملخص العام</h2>
     <p className="mt-2 text-sm">{currentSchool?.schoolName}</p>
     <button type="button" onClick={()=>selectTab('students')} className="mt-3 rounded-lg border px-3 py-2 text-sm font-bold">افتح التعلم والجاهزية</button>
    </div>:null}
    {tab==='students'?<div className="space-y-3">
     <h2 className="text-lg font-bold">تعلم الطلاب وجاهزيتهم</h2>
     <label className="block text-sm font-bold">بحث عن طالب
      <input aria-label="بحث عن طالب" value={search} onChange={event=>{setSearch(event.target.value);setPage(1);setRosterSchoolId('');}}
       className="mt-2 block w-full rounded-xl border border-gray-300 p-2 sm:max-w-md" placeholder="اسم الطالب أو البريد الإلكتروني" />
     </label>
     {rosterBusy?<div className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" />جاري تحميل الطلاب...</div>:null}
     {rosterError?<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
      {rosterError}<button type="button" onClick={()=>setRosterReload(n=>n+1)} className="ms-3 rounded-lg border px-3 py-1">إعادة المحاولة</button>
     </div>:null}
     {!rosterBusy&&!rosterError&&!visibleRoster.length?<p className="text-sm text-gray-500">لا يوجد طلاب ضمن نطاق الإشراف الحالي.</p>:null}
     {visibleRoster.length>0?<div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[320px] text-right text-sm">
       <thead className="bg-gray-50"><tr><th className="p-3">اسم الطالب</th><th className="p-3">البريد الإلكتروني</th></tr></thead>
       <tbody>{visibleRoster.map(member=><tr key={member.userId} className="border-t"><td className="p-3 font-bold">{member.name}</td><td className="p-3">{member.email}</td></tr>)}</tbody>
      </table>
     </div>:null}
     {total>PAGE_SIZE&&!rosterError?<div role="group" aria-label="عرض الطلاب" className="flex flex-wrap items-center justify-center gap-3 py-3 text-sm">
      <span className="text-gray-500">عرض {visibleRoster.length} من {total}</span>
      {visibleRoster.length<total?<button type="button" disabled={rosterBusy} onClick={()=>setPage(n=>n+1)} className="rounded-xl bg-indigo-50 px-4 py-2 font-bold text-indigo-700 disabled:opacity-40">عرض المزيد</button>:null}
      {page>1?<button type="button" onClick={()=>{setPage(1);setRoster([]);setRosterSchoolId('');}} className="rounded-xl border px-4 py-2 font-bold">عرض أقل</button>:null}
     </div>:null}
    </div>:null}
   </section>:null}
  </div>
 </main>;
}
