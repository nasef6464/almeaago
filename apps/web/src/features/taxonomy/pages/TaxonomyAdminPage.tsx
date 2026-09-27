import { Archive, BookOpen, Boxes, ChevronLeft, GraduationCap, Loader2, Plus, RefreshCcw, Save, Target } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../auth/state/AuthProvider';
import {
  taxonomyAdminClient,
  type AdminTaxonomyBootstrap,
  type AdminTaxonomyPath,
  type AdminTaxonomySkill,
  type AdminTaxonomySubject,
  type TaxonomyStatus,
} from '../api/taxonomy-admin-client';

const EMPTY:AdminTaxonomyBootstrap={paths:[],levels:[],subjects:[],skills:[]};
const statusLabels:Record<TaxonomyStatus,string>={active:'نشط',inactive:'غير نشط',archived:'مؤرشف'};

function StatusSelect({value,onChange,label}:{value:TaxonomyStatus;onChange:(value:TaxonomyStatus)=>void;label:string}){
  return <select aria-label={label} value={value} onChange={e=>onChange(e.target.value as TaxonomyStatus)} className="rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs font-black">
    <option value="active">نشط</option><option value="inactive">غير نشط</option><option value="archived">مؤرشف</option>
  </select>;
}

export function TaxonomyAdminPage(){
  const {user,loading:authLoading,getCsrfToken}=useAuth();
  const [data,setData]=useState<AdminTaxonomyBootstrap>(EMPTY);
  const [selectedPathId,setSelectedPathId]=useState('');
  const [selectedSubjectId,setSelectedSubjectId]=useState('');
  const [busy,setBusy]=useState(true);
  const [pending,setPending]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [reload,setReload]=useState(0);
  const [pathDraft,setPathDraft]=useState({code:'',name:'',parentPathId:'',description:'',sortOrder:0});
  const [levelDraft,setLevelDraft]=useState({code:'',name:'',sortOrder:0});
  const [subjectDraft,setSubjectDraft]=useState({code:'',name:'',levelId:'',sortOrder:0});
  const [skillDraft,setSkillDraft]=useState({code:'',name:'',description:'',kind:'main' as 'main'|'sub',parentSkillId:'',sortOrder:0});
  const [edit,setEdit]=useState<{type:'path'|'level'|'subject'|'skill';id:string;name:string;description:string}|null>(null);

  const isAdmin=user?.roles.includes('admin')??false;

  useEffect(()=>{
    if(authLoading||!user||!isAdmin)return;
    const c=new AbortController();setBusy(true);setError('');
    taxonomyAdminClient.bootstrap(c.signal).then(next=>{
      setData(next);
      setSelectedPathId(current=>next.paths.some(x=>x.id===current)?current:(next.paths[0]?.id||''));
    }).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل التصنيف')})
      .finally(()=>{if(!c.signal.aborted)setBusy(false)});
    return()=>c.abort();
  },[authLoading,isAdmin,reload,user]);

  const selectedPath=useMemo(()=>data.paths.find(x=>x.id===selectedPathId)||null,[data.paths,selectedPathId]);
  const levels=useMemo(()=>data.levels.filter(x=>x.pathId===selectedPathId),[data.levels,selectedPathId]);
  const subjects=useMemo(()=>data.subjects.filter(x=>x.pathId===selectedPathId),[data.subjects,selectedPathId]);
  const selectedSubject=useMemo(()=>subjects.find(x=>x.id===selectedSubjectId)||subjects[0]||null,[selectedSubjectId,subjects]);
  const skills=useMemo(()=>data.skills.filter(x=>x.subjectId===selectedSubject?.id),[data.skills,selectedSubject?.id]);
  const mainSkills=useMemo(()=>skills.filter(x=>x.kind==='main'),[skills]);

  useEffect(()=>{
    setSelectedSubjectId(current=>subjects.some(x=>x.id===current)?current:(subjects[0]?.id||''));
    setSubjectDraft(x=>({...x,levelId:levels.some(l=>l.id===x.levelId)?x.levelId:''}));
  },[levels,subjects]);

  useEffect(()=>{
    if(skillDraft.kind==='sub'&&!mainSkills.some(x=>x.id===skillDraft.parentSkillId)){
      setSkillDraft(x=>({...x,parentSkillId:mainSkills[0]?.id||''}));
    }
  },[mainSkills,skillDraft.kind,skillDraft.parentSkillId]);

  async function run(key:string,action:(csrf:string)=>Promise<void>,success:string){
    setPending(key);setError('');setNotice('');
    try{
      const csrf=await getCsrfToken();
      await action(csrf);
      setNotice(success);
      setReload(x=>x+1);
    }catch(e){setError(e instanceof Error?e.message:'تعذر تنفيذ عملية التصنيف')}
    finally{setPending('')}
  }

  async function createPath(){
    if(!pathDraft.code.trim()||!pathDraft.name.trim())return setError('أدخل كود واسم المسار.');
    await run('create-path',csrf=>taxonomyAdminClient.createPath({...pathDraft,code:pathDraft.code.trim(),name:pathDraft.name.trim()},csrf).then(()=>undefined),'تم إنشاء المسار.');
    setPathDraft({code:'',name:'',parentPathId:'',description:'',sortOrder:0});
  }
  async function createLevel(){
    if(!selectedPath||!levelDraft.code.trim()||!levelDraft.name.trim())return setError('اختر مسارًا وأدخل كود واسم المرحلة.');
    await run('create-level',csrf=>taxonomyAdminClient.createLevel({pathId:selectedPath.id,...levelDraft,code:levelDraft.code.trim(),name:levelDraft.name.trim()},csrf).then(()=>undefined),'تم إنشاء المرحلة.');
    setLevelDraft({code:'',name:'',sortOrder:0});
  }
  async function createSubject(){
    if(!selectedPath||!subjectDraft.code.trim()||!subjectDraft.name.trim())return setError('اختر مسارًا وأدخل كود واسم المادة.');
    await run('create-subject',csrf=>taxonomyAdminClient.createSubject({pathId:selectedPath.id,...subjectDraft,code:subjectDraft.code.trim(),name:subjectDraft.name.trim()},csrf).then(()=>undefined),'تم إنشاء المادة.');
    setSubjectDraft({code:'',name:'',levelId:'',sortOrder:0});
  }
  async function createSkill(){
    if(!selectedSubject||!skillDraft.code.trim()||!skillDraft.name.trim())return setError('اختر مادة وأدخل كود واسم المهارة.');
    if(skillDraft.kind==='sub'&&!skillDraft.parentSkillId)return setError('اختر المهارة الرئيسية للمهارة الفرعية.');
    await run('create-skill',csrf=>taxonomyAdminClient.createSkill({subjectId:selectedSubject.id,...skillDraft,code:skillDraft.code.trim(),name:skillDraft.name.trim(),parentSkillId:skillDraft.kind==='main'?'':skillDraft.parentSkillId},csrf).then(()=>undefined),'تم إنشاء المهارة.');
    setSkillDraft({code:'',name:'',description:'',kind:'main',parentSkillId:'',sortOrder:0});
  }

  async function patchStatus(type:'path'|'level'|'subject'|'skill',id:string,status:TaxonomyStatus){
    const method=type==='path'?taxonomyAdminClient.updatePath:type==='level'?taxonomyAdminClient.updateLevel:type==='subject'?taxonomyAdminClient.updateSubject:taxonomyAdminClient.updateSkill;
    await run(`status-${type}-${id}`,csrf=>method(id,{status} as never,csrf).then(()=>undefined),`تم تحديث الحالة إلى «${statusLabels[status]}».`);
  }

  async function saveEdit(){
    if(!edit||!edit.name.trim())return;
    const payload=edit.type==='path'?{name:edit.name.trim(),description:edit.description.trim()}:{name:edit.name.trim()};
    const method=edit.type==='path'?taxonomyAdminClient.updatePath:edit.type==='level'?taxonomyAdminClient.updateLevel:edit.type==='subject'?taxonomyAdminClient.updateSubject:taxonomyAdminClient.updateSkill;
    await run('save-edit',csrf=>method(edit.id,payload as never,csrf).then(()=>undefined),'تم حفظ التعديل.');
    setEdit(null);
  }

  if(authLoading)return <main className="p-10 text-center font-black">جاري التحقق من الصلاحيات...</main>;
  if(!isAdmin)return <main dir="rtl" className="p-10 text-center font-black text-rose-700">إدارة التصنيف متاحة لمدير المنصة فقط.</main>;

  return <main dir="rtl" className="mx-auto max-w-7xl space-y-5 pb-12" data-testid="taxonomy-admin-page">
    <header className="rounded-3xl bg-gradient-to-l from-indigo-800 via-slate-900 to-slate-950 p-5 text-white shadow-xl sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="flex items-center gap-2 text-xs font-black text-indigo-200"><Boxes size={17}/> TAXONOMY ADMIN</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">إدارة المسارات والتصنيف</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">المسارات والمراحل والمواد والمهارات هي بنية تعليمية مركزية. الأكواد والمعرفات ثابتة بعد الإنشاء، والتعطيل أو الأرشفة يحلان محل الحذف المدمر.</p></div>
        <button type="button" onClick={()=>setReload(x=>x+1)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-black"><RefreshCcw size={17}/> تحديث</button>
      </div>
    </header>

    {error?<div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div>:null}
    {notice?<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 font-bold text-emerald-700">{notice}</div>:null}
    {busy?<div className="flex items-center justify-center gap-2 rounded-2xl border bg-white p-8 font-black text-gray-500"><Loader2 className="animate-spin" size={20}/> جاري تحميل شجرة التصنيف...</div>:null}

    <section className="grid gap-3 sm:grid-cols-4">
      <article className="rounded-2xl border bg-white p-4"><Boxes className="text-indigo-700" size={19}/><p className="mt-2 text-xs font-bold text-gray-500">المسارات</p><p className="text-2xl font-black">{data.paths.length}</p></article>
      <article className="rounded-2xl border bg-white p-4"><GraduationCap className="text-sky-700" size={19}/><p className="mt-2 text-xs font-bold text-gray-500">المراحل</p><p className="text-2xl font-black">{data.levels.length}</p></article>
      <article className="rounded-2xl border bg-white p-4"><BookOpen className="text-amber-700" size={19}/><p className="mt-2 text-xs font-bold text-gray-500">المواد</p><p className="text-2xl font-black">{data.subjects.length}</p></article>
      <article className="rounded-2xl border bg-white p-4"><Target className="text-emerald-700" size={19}/><p className="mt-2 text-xs font-bold text-gray-500">المهارات</p><p className="text-2xl font-black">{data.skills.length}</p></article>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1fr_2fr]">
      <div className="space-y-4">
        <article className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between"><div><p className="text-xs font-black text-indigo-600">المسارات</p><h2 className="text-xl font-black">شجرة المسارات</h2></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">{data.paths.filter(x=>x.status==='active').length} نشط</span></div>
          <div className="mt-4 space-y-2">{data.paths.length===0?<p className="rounded-xl border border-dashed p-5 text-center text-sm text-gray-500">لا توجد مسارات بعد.</p>:data.paths.map(path=><button key={path.id} type="button" onClick={()=>setSelectedPathId(path.id)} className={`w-full rounded-2xl border p-3 text-right transition ${selectedPathId===path.id?'border-indigo-300 bg-indigo-50':'border-gray-100 hover:bg-gray-50'}`}><div className="flex items-center gap-2"><span className="min-w-0 flex-1"><b className="block truncate">{path.name}</b><span className="text-xs text-gray-400">{path.code}</span></span><span className="text-[10px] font-black text-gray-500">{statusLabels[path.status]}</span><ChevronLeft size={16}/></div></button>)}</div>
        </article>

        <article className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
          <h2 className="font-black">إضافة مسار</h2>
          <div className="mt-3 grid gap-2">
            <input aria-label="كود المسار الجديد" value={pathDraft.code} onChange={e=>setPathDraft({...pathDraft,code:e.target.value})} placeholder="الكود الثابت مثل QDR" className="rounded-xl border p-2.5"/>
            <input aria-label="اسم المسار الجديد" value={pathDraft.name} onChange={e=>setPathDraft({...pathDraft,name:e.target.value})} placeholder="اسم المسار" className="rounded-xl border p-2.5"/>
            <select aria-label="المسار الأب" value={pathDraft.parentPathId} onChange={e=>setPathDraft({...pathDraft,parentPathId:e.target.value})} className="rounded-xl border p-2.5"><option value="">بدون مسار أب</option>{data.paths.filter(x=>x.status==='active').map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <textarea aria-label="وصف المسار الجديد" value={pathDraft.description} onChange={e=>setPathDraft({...pathDraft,description:e.target.value})} placeholder="وصف مختصر" className="min-h-20 rounded-xl border p-2.5"/>
            <button type="button" disabled={pending==='create-path'} onClick={()=>void createPath()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 py-2.5 font-black text-white disabled:opacity-50"><Plus size={17}/> إنشاء المسار</button>
          </div>
        </article>
      </div>

      <div className="space-y-4">
        {!selectedPath?<div className="rounded-3xl border border-dashed bg-white p-10 text-center font-bold text-gray-500">اختر مسارًا لإدارة المراحل والمواد.</div>:<>
          <article className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black text-indigo-600">{selectedPath.code}</p><h2 className="text-2xl font-black">{selectedPath.name}</h2><p className="mt-1 text-sm text-gray-500">{selectedPath.description||'لا يوجد وصف للمسار.'}</p></div><div className="flex gap-2"><button type="button" aria-label={`تعديل ${selectedPath.name}`} onClick={()=>setEdit({type:'path',id:selectedPath.id,name:selectedPath.name,description:selectedPath.description})} className="rounded-xl border px-3 py-2 text-sm font-black">تعديل</button><StatusSelect label="حالة المسار" value={selectedPath.status} onChange={v=>void patchStatus('path',selectedPath.id,v)}/></div></div>
            {edit?.type==='path'&&edit.id===selectedPath.id?<div className="mt-4 grid gap-2 rounded-2xl bg-gray-50 p-3 sm:grid-cols-[1fr_2fr_auto]"><input aria-label="اسم المسار المعدل" value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})} className="rounded-xl border p-2"/><input aria-label="وصف المسار المعدل" value={edit.description} onChange={e=>setEdit({...edit,description:e.target.value})} className="rounded-xl border p-2"/><button type="button" onClick={()=>void saveEdit()} className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-950 px-4 text-sm font-black text-white"><Save size={15}/> حفظ</button></div>:null}
          </article>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between"><h3 className="font-black">المراحل الدراسية</h3><GraduationCap size={18} className="text-sky-700"/></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input aria-label="كود المرحلة الجديدة" value={levelDraft.code} onChange={e=>setLevelDraft({...levelDraft,code:e.target.value})} placeholder="الكود" className="rounded-xl border p-2"/><input aria-label="اسم المرحلة الجديدة" value={levelDraft.name} onChange={e=>setLevelDraft({...levelDraft,name:e.target.value})} placeholder="اسم المرحلة" className="rounded-xl border p-2"/><button aria-label="إنشاء المرحلة" type="button" onClick={()=>void createLevel()} className="rounded-xl bg-sky-700 px-3 text-white"><Plus size={17}/></button></div>
              <div className="mt-3 space-y-2">{levels.map(level=><div key={level.id} className="rounded-xl border p-3"><div className="flex items-center gap-2"><button type="button" onClick={()=>setEdit({type:'level',id:level.id,name:level.name,description:''})} className="min-w-0 flex-1 text-right"><b className="block truncate">{level.name}</b><span className="text-xs text-gray-400">{level.code}</span></button><StatusSelect label={`حالة المرحلة ${level.name}`} value={level.status} onChange={v=>void patchStatus('level',level.id,v)}/></div>{edit?.type==='level'&&edit.id===level.id?<div className="mt-2 flex gap-2"><input aria-label="اسم المرحلة المعدل" value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})} className="min-w-0 flex-1 rounded-lg border p-2"/><button type="button" onClick={()=>void saveEdit()} className="rounded-lg bg-slate-950 px-3 text-white"><Save size={15}/></button></div>:null}</div>)}</div>
            </article>

            <article className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between"><h3 className="font-black">المواد</h3><BookOpen size={18} className="text-amber-700"/></div>
              <div className="mt-3 grid gap-2"><div className="grid gap-2 sm:grid-cols-2"><input aria-label="كود المادة الجديدة" value={subjectDraft.code} onChange={e=>setSubjectDraft({...subjectDraft,code:e.target.value})} placeholder="الكود" className="rounded-xl border p-2"/><input aria-label="اسم المادة الجديدة" value={subjectDraft.name} onChange={e=>setSubjectDraft({...subjectDraft,name:e.target.value})} placeholder="اسم المادة" className="rounded-xl border p-2"/></div><div className="flex gap-2"><select aria-label="مرحلة المادة الجديدة" value={subjectDraft.levelId} onChange={e=>setSubjectDraft({...subjectDraft,levelId:e.target.value})} className="min-w-0 flex-1 rounded-xl border p-2"><option value="">بدون مرحلة محددة</option>{levels.filter(x=>x.status==='active').map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><button aria-label="إنشاء المادة" type="button" onClick={()=>void createSubject()} className="rounded-xl bg-amber-600 px-3 text-white"><Plus size={17}/></button></div></div>
              <div className="mt-3 space-y-2">{subjects.map(subject=><div key={subject.id} className={`rounded-xl border p-3 ${selectedSubject?.id===subject.id?'border-amber-300 bg-amber-50/40':''}`}><div className="flex items-center gap-2"><button type="button" onClick={()=>setSelectedSubjectId(subject.id)} className="min-w-0 flex-1 text-right"><b className="block truncate">{subject.name}</b><span className="text-xs text-gray-400">{subject.code}{subject.levelId?` · ${levels.find(x=>x.id===subject.levelId)?.name||''}`:''}</span></button><button type="button" aria-label={`تعديل ${subject.name}`} onClick={()=>setEdit({type:'subject',id:subject.id,name:subject.name,description:''})} className="text-xs font-black">تعديل</button><StatusSelect label={`حالة المادة ${subject.name}`} value={subject.status} onChange={v=>void patchStatus('subject',subject.id,v)}/></div>{edit?.type==='subject'&&edit.id===subject.id?<div className="mt-2 flex gap-2"><input aria-label="اسم المادة المعدل" value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})} className="min-w-0 flex-1 rounded-lg border p-2"/><button type="button" onClick={()=>void saveEdit()} className="rounded-lg bg-slate-950 px-3 text-white"><Save size={15}/></button></div>:null}</div>)}</div>
            </article>
          </section>

          <article className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black text-emerald-600">شجرة المهارات</p><h3 className="text-xl font-black">{selectedSubject?selectedSubject.name:'اختر مادة'}</h3></div><select aria-label="المادة المختارة للمهارات" value={selectedSubject?.id||''} onChange={e=>setSelectedSubjectId(e.target.value)} className="rounded-xl border p-2 text-sm font-bold">{subjects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
            {selectedSubject?<div className="mt-4 grid gap-4 lg:grid-cols-[1fr_2fr]">
              <div className="rounded-2xl border bg-gray-50 p-3"><h4 className="font-black">إضافة مهارة</h4><div className="mt-3 grid gap-2"><input aria-label="كود المهارة الجديدة" value={skillDraft.code} onChange={e=>setSkillDraft({...skillDraft,code:e.target.value})} placeholder="الكود الثابت" className="rounded-xl border bg-white p-2"/><input aria-label="اسم المهارة الجديدة" value={skillDraft.name} onChange={e=>setSkillDraft({...skillDraft,name:e.target.value})} placeholder="اسم المهارة" className="rounded-xl border bg-white p-2"/><select aria-label="نوع المهارة الجديدة" value={skillDraft.kind} onChange={e=>setSkillDraft({...skillDraft,kind:e.target.value as 'main'|'sub'})} className="rounded-xl border bg-white p-2"><option value="main">مهارة رئيسية</option><option value="sub">مهارة فرعية</option></select>{skillDraft.kind==='sub'?<select aria-label="المهارة الرئيسية الأب" value={skillDraft.parentSkillId} onChange={e=>setSkillDraft({...skillDraft,parentSkillId:e.target.value})} className="rounded-xl border bg-white p-2"><option value="">اختر المهارة الرئيسية</option>{mainSkills.filter(x=>x.status==='active').map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>:null}<textarea aria-label="وصف المهارة الجديدة" value={skillDraft.description} onChange={e=>setSkillDraft({...skillDraft,description:e.target.value})} placeholder="وصف المهارة" className="min-h-20 rounded-xl border bg-white p-2"/><button type="button" onClick={()=>void createSkill()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2 font-black text-white"><Plus size={17}/> إضافة المهارة</button></div></div>
              <div className="space-y-3">{mainSkills.length===0?<div className="rounded-2xl border border-dashed p-6 text-center text-sm text-gray-500">لا توجد مهارات رئيسية لهذه المادة.</div>:mainSkills.map(main=><div key={main.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={()=>setEdit({type:'skill',id:main.id,name:main.name,description:main.description})} className="min-w-0 flex-1 text-right"><b className="block">{main.name}</b><span className="text-xs text-gray-400">{main.code}</span></button><StatusSelect label={`حالة المهارة ${main.name}`} value={main.status} onChange={v=>void patchStatus('skill',main.id,v)}/></div>{edit?.type==='skill'&&edit.id===main.id?<div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><input aria-label="اسم المهارة المعدل" value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})} className="rounded-lg border p-2"/><input aria-label="وصف المهارة المعدل" value={edit.description} onChange={e=>setEdit({...edit,description:e.target.value})} className="rounded-lg border p-2"/><button type="button" onClick={()=>void saveEdit()} className="rounded-lg bg-slate-950 px-3 text-white"><Save size={15}/></button></div>:null}<div className="mr-4 mt-3 space-y-2 border-r-2 border-emerald-100 pr-3">{skills.filter(x=>x.parentSkillId===main.id).map(sub=><div key={sub.id} className="flex items-center gap-2 rounded-xl bg-emerald-50/50 p-2"><Target size={14} className="text-emerald-700"/><span className="min-w-0 flex-1"><b className="block truncate text-sm">{sub.name}</b><span className="text-[10px] text-gray-400">{sub.code}</span></span><button type="button" aria-label={`تعديل ${sub.name}`} onClick={()=>setEdit({type:'skill',id:sub.id,name:sub.name,description:sub.description})} className="text-xs font-black">تعديل</button><StatusSelect label={`حالة المهارة ${sub.name}`} value={sub.status} onChange={v=>void patchStatus('skill',sub.id,v)}/></div>)}</div></div>)}</div>
            </div>:<div className="mt-4 rounded-xl border border-dashed p-6 text-center text-gray-500">أضف مادة أولًا قبل إدارة المهارات.</div>}
          </article>
        </>}
      </div>
    </section>

    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900"><div className="flex items-start gap-2"><Archive size={18} className="mt-1 shrink-0"/><p><b>قاعدة السلامة:</b> لا توجد أزرار حذف للتصنيف. استخدم غير نشط أو مؤرشف للحفاظ على المعرفات والعلاقات التاريخية. قسم legacy القديم ليس جدولًا مستقلًا في النموذج المستهدف؛ التصنيف الحالي يملك المسار/المرحلة/المادة وشجرة المهارات فقط.</p></div></section>
  </main>;
}
