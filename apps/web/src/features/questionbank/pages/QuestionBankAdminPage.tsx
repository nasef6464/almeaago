import {
  Archive,
  BarChart3,
  CheckCircle2,
  FileImage,
  Filter,
  HelpCircle,
  ImageUp,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Target,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import type { TaxonomyFull } from '../../content/api/content-types';
import {
  questionBankClient,
  type ImportResult,
  type MediaAsset,
  type QuestionDetail,
  type QuestionFilters,
  type QuestionSummary,
  type QuestionType,
  type QuestionWorkflowStatus,
} from '../api/questionbank-client';

const EMPTY_TAXONOMY:TaxonomyFull={paths:[],subjects:[],skills:[]};
const statusLabel:Record<QuestionWorkflowStatus,string>={
  draft:'مسودة',
  pending_review:'بانتظار المراجعة',
  approved:'معتمد',
  rejected:'مرفوض',
  archived:'مؤرشف',
};
const typeLabel:Record<QuestionType,string>={mcq:'اختيار من متعدد',true_false:'صح / خطأ',essay:'مقالي'};

export function QuestionBankAdminPage(){
  const {user,loading:authLoading,getCsrfToken}=useAuth();
  const isAdmin=user?.roles.includes('admin')??false;
  const isTeacher=user?.roles.includes('teacher')??false;
  const [taxonomy,setTaxonomy]=useState<TaxonomyFull>(EMPTY_TAXONOMY);
  const [filters,setFilters]=useState<QuestionFilters>({
    page:1,limit:50,search:'',pathId:'',subjectId:'',mainSkillId:'',linked:'',difficulty:'',type:'',workflowStatus:'',withVideo:'',withExplanation:'',
  });
  const [rows,setRows]=useState<QuestionSummary[]>([]);
  const [hasMore,setHasMore]=useState(false);
  const [coverage,setCoverage]=useState({questionsTotal:0,approved:0,pendingReview:0,unlinked:0,mainSkillCoverage:0,subSkillCoverage:0});
  const [busy,setBusy]=useState(true);
  const [pending,setPending]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [reload,setReload]=useState(0);
  const [detail,setDetail]=useState<QuestionDetail|null>(null);
  const [showCreate,setShowCreate]=useState(false);
  const [create,setCreate]=useState({
    questionCode:'',pathId:'',subjectId:'',type:'mcq' as QuestionType,text:'',difficulty:'medium',examType:'',source:'manual',
    explanation:'',hint:'',solvingStrategy:'',videoUrl:'',imageAssetId:'',imageAlt:'',mainSkillId:'',subSkillId:'',correctOptionIndex:0,
    options:['','','',''],
  });
  const [mediaFile,setMediaFile]=useState<File|null>(null);
  const [mediaAsset,setMediaAsset]=useState<MediaAsset|null>(null);
  const [importBatchId,setImportBatchId]=useState('');
  const [importText,setImportText]=useState('[]');
  const [importResult,setImportResult]=useState<ImportResult|null>(null);
  const [importDryRunPassed,setImportDryRunPassed]=useState(false);

  const subjects=useMemo(()=>taxonomy.subjects.filter(x=>!filters.pathId||x.pathId===filters.pathId),[filters.pathId,taxonomy.subjects]);
  const skills=useMemo(()=>taxonomy.skills.filter(x=>!filters.subjectId||x.subjectId===filters.subjectId),[filters.subjectId,taxonomy.skills]);
  const createSubjects=useMemo(()=>taxonomy.subjects.filter(x=>x.pathId===create.pathId),[create.pathId,taxonomy.subjects]);
  const createSkills=useMemo(()=>taxonomy.skills.filter(x=>x.subjectId===create.subjectId),[create.subjectId,taxonomy.skills]);
  const createMainSkills=useMemo(()=>createSkills.filter(x=>x.kind==='main'),[createSkills]);
  const createSubSkills=useMemo(()=>createSkills.filter(x=>x.kind==='sub'&&x.parentSkillId===create.mainSkillId),[create.mainSkillId,createSkills]);

  useEffect(()=>{
    if(authLoading||!user||(!isAdmin&&!isTeacher))return;
    const c=new AbortController();
    contentClient.taxonomyFull(c.signal).then(setTaxonomy).catch(()=>{});
    return()=>c.abort();
  },[authLoading,isAdmin,isTeacher,user]);

  useEffect(()=>{
    if(authLoading||!user||(!isAdmin&&!isTeacher))return;
    const c=new AbortController();
    setBusy(true);setError('');
    Promise.all([
      questionBankClient.list(filters,c.signal),
      questionBankClient.coverage(filters,c.signal),
    ]).then(([page,cov])=>{
      setRows(page.items);setHasMore(page.hasMore);
      setCoverage({
        questionsTotal:cov.questionsTotal,approved:cov.approved,pendingReview:cov.pendingReview,unlinked:cov.unlinked,
        mainSkillCoverage:cov.mainSkillCoverage,subSkillCoverage:cov.subSkillCoverage,
      });
    }).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل بنك الأسئلة')})
      .finally(()=>{if(!c.signal.aborted)setBusy(false)});
    return()=>c.abort();
  },[authLoading,filters,isAdmin,isTeacher,reload,user]);

  useEffect(()=>{
    if(filters.subjectId&&!subjects.some(x=>x.id===filters.subjectId))setFilters(x=>({...x,subjectId:'',mainSkillId:''}));
  },[filters.subjectId,subjects]);
  useEffect(()=>{
    if(filters.mainSkillId&&!skills.some(x=>x.id===filters.mainSkillId))setFilters(x=>({...x,mainSkillId:''}));
  },[filters.mainSkillId,skills]);

  async function run(key:string,action:(csrf:string)=>Promise<void>,success:string){
    setPending(key);setError('');setNotice('');
    try{const csrf=await getCsrfToken();await action(csrf);if(success)setNotice(success)}
    catch(e){setError(e instanceof Error?e.message:'تعذر تنفيذ العملية')}
    finally{setPending('')}
  }

  async function openQuestion(id:string){
    setPending('detail-'+id);setError('');
    try{const r=await questionBankClient.get(id);setDetail(r.question)}
    catch(e){setError(e instanceof Error?e.message:'تعذر تحميل السؤال')}
    finally{setPending('')}
  }

  function updateOption(index:number,value:string){
    setCreate(x=>({...x,options:x.options.map((v,i)=>i===index?value:v)}));
  }

  async function uploadMedia(){
    if(!mediaFile||!create.questionCode.trim())return setError('أدخل كود السؤال واختر ملفًا قبل الرفع.');
    await run('media',async csrf=>{
      const asset=await questionBankClient.uploadAsset(mediaFile,create.questionCode.trim(),'question_image',csrf);
      setMediaAsset(asset);setCreate(x=>({...x,imageAssetId:asset.id}));
    },'تم التحقق من ملف الصورة وتثبيت مرجع الوسائط.');
  }

  async function createQuestion(){
    if(!create.questionCode.trim()||!create.pathId||!create.subjectId||!create.mainSkillId)return setError('الكود والمسار والمادة والمهارة الرئيسية مطلوبة.');
    const options=create.type==='essay'?[]:create.options.filter(x=>x.trim()).map(text=>({text:text.trim(),assetId:''}));
    if(create.type!=='essay'&&options.length<2)return setError('يلزم خياران على الأقل.');
    const skillLinks=[
      {skillId:create.mainSkillId,relationType:'main' as const},
      ...(create.subSkillId?[{skillId:create.subSkillId,relationType:'sub' as const}]:[]),
    ];
    await run('create',async csrf=>{
      const result=await questionBankClient.create({
        questionCode:create.questionCode.trim(),
        ownerType:isAdmin?'platform':'teacher',
        ownerId:isAdmin?'':user?.id||'',
        assignedTeacherId:isAdmin?'':user?.id||'',
        version:{
          pathId:create.pathId,subjectId:create.subjectId,type:create.type,text:create.text.trim(),
          imageAssetId:create.imageAssetId,imageAlt:create.imageAlt.trim(),optionsEmbeddedInImage:false,
          correctOptionIndex:create.type==='essay'?null:Math.min(create.correctOptionIndex,Math.max(0,options.length-1)),
          explanation:create.explanation.trim(),hint:create.hint.trim(),solvingStrategy:create.solvingStrategy.trim(),
          videoUrl:create.videoUrl.trim(),sourceMeta:{},aiContext:{},voiceExplanation:{},
          difficulty:create.difficulty,examType:create.examType.trim(),source:create.source.trim(),year:null,revisionNote:'',
          options,skillLinks,
        },
      },csrf);
      setDetail(result.question);setShowCreate(false);setMediaAsset(null);setMediaFile(null);
      setCreate(x=>({...x,questionCode:'',text:'',explanation:'',hint:'',solvingStrategy:'',videoUrl:'',imageAssetId:'',imageAlt:'',subSkillId:'',options:['','','',''],correctOptionIndex:0}));
      setReload(x=>x+1);
    },'تم إنشاء السؤال كمسودة بإصدار أول.');
  }

  async function workflow(status:QuestionWorkflowStatus){
    if(!detail)return;
    await run('workflow',async csrf=>{
      const r=await questionBankClient.workflow(detail.id,detail.currentVersion,status,'',csrf);
      setDetail(r.question);setReload(x=>x+1);
    },`تم تحديث حالة السؤال إلى «${statusLabel[status]}».`);
  }

  async function importBatch(dryRun:boolean){
    if(!isAdmin)return;
    let items:unknown[];
    try{const parsed=JSON.parse(importText) as unknown;if(!Array.isArray(parsed))throw new Error();items=parsed}
    catch{return setError('صيغة JSON للاستيراد يجب أن تكون مصفوفة عناصر صالحة.')}
    if(!importBatchId.trim())return setError('أدخل معرف دفعة الاستيراد.');
    await run(dryRun?'import-dry':'import-write',async csrf=>{
      const result=await questionBankClient.importBatch(importBatchId.trim(),dryRun,items,csrf);
      setImportResult(result);setImportDryRunPassed(dryRun&&result.status==='PASS');
      if(!dryRun&&result.status==='IMPORTED'){setReload(x=>x+1);setImportDryRunPassed(false)}
    },dryRun?'اكتمل الفحص الجاف للدفعة.':'تم تنفيذ دفعة الاستيراد بعد الفحص الجاف.');
  }

  if(authLoading)return <main className="p-10 text-center font-black">جاري التحقق من الصلاحيات...</main>;
  if(!isAdmin&&!isTeacher)return <main dir="rtl" className="p-10 text-center font-black text-rose-700">مركز بنك الأسئلة متاح للمشرفين على التأليف فقط.</main>;

  return <main dir="rtl" className="mx-auto max-w-7xl space-y-5 pb-12" data-testid="question-bank-admin">
    <header className="rounded-3xl bg-gradient-to-l from-violet-800 via-slate-900 to-slate-950 p-5 text-white shadow-xl sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="flex items-center gap-2 text-xs font-black text-violet-200"><HelpCircle size={17}/> QUESTION BANK</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">مركز بنك الأسئلة</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">تأليف بإصدارات ثابتة، تصنيف مهاري، مراجعة واعتماد، ووسائط مباشرة إلى R2 بدون تمرير الملفات الكبيرة عبر خادم Go.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setReload(x=>x+1)} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-black"><RefreshCcw size={17}/> تحديث</button><button type="button" onClick={()=>setShowCreate(x=>!x)} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-slate-950"><Plus size={17}/> سؤال جديد</button></div>
      </div>
    </header>

    {error?<div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div>:null}
    {notice?<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 font-bold text-emerald-700">{notice}</div>:null}

    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Stat icon={<BarChart3 size={18}/>} label="إجمالي مطابق" value={coverage.questionsTotal}/>
      <Stat icon={<CheckCircle2 size={18}/>} label="معتمد" value={coverage.approved}/>
      <Stat icon={<Send size={18}/>} label="بانتظار المراجعة" value={coverage.pendingReview}/>
      <Stat icon={<Target size={18}/>} label="غير مرتبط مهاريًا" value={coverage.unlinked}/>
      <Stat icon={<Target size={18}/>} label="تغطية رئيسية" value={coverage.mainSkillCoverage}/>
      <Stat icon={<Target size={18}/>} label="تغطية فرعية" value={coverage.subSkillCoverage}/>
    </section>

    <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2"><Filter size={18} className="text-violet-700"/><h2 className="font-black">بحث وفلاتر خادمية محدودة</h2></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative md:col-span-2"><Search className="absolute right-3 top-3 text-gray-400" size={16}/><input aria-label="بحث بنك الأسئلة" value={filters.search||''} onChange={e=>setFilters(x=>({...x,search:e.target.value,page:1}))} placeholder="الكود أو بيانات السؤال" className="w-full rounded-xl border py-2.5 pr-9 pl-3"/></label>
        <select aria-label="مسار فلتر الأسئلة" value={filters.pathId||''} onChange={e=>setFilters(x=>({...x,pathId:e.target.value,subjectId:'',mainSkillId:'',page:1}))} className="rounded-xl border p-2.5"><option value="">كل المسارات</option>{taxonomy.paths.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select aria-label="مادة فلتر الأسئلة" value={filters.subjectId||''} onChange={e=>setFilters(x=>({...x,subjectId:e.target.value,mainSkillId:'',page:1}))} className="rounded-xl border p-2.5"><option value="">كل المواد</option>{subjects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select aria-label="حالة فلتر الأسئلة" value={filters.workflowStatus||''} onChange={e=>setFilters(x=>({...x,workflowStatus:e.target.value as QuestionWorkflowStatus|'',page:1}))} className="rounded-xl border p-2.5"><option value="">كل الحالات</option>{Object.entries(statusLabel).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
        <select aria-label="نوع فلتر الأسئلة" value={filters.type||''} onChange={e=>setFilters(x=>({...x,type:e.target.value as QuestionType|'',page:1}))} className="rounded-xl border p-2.5"><option value="">كل الأنواع</option>{Object.entries(typeLabel).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
        <select aria-label="مهارة رئيسية فلتر الأسئلة" value={filters.mainSkillId||''} onChange={e=>setFilters(x=>({...x,mainSkillId:e.target.value,page:1}))} className="rounded-xl border p-2.5"><option value="">كل المهارات الرئيسية</option>{skills.filter(x=>x.kind==='main').map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select aria-label="ارتباط مهاري فلتر الأسئلة" value={filters.linked===''?'':String(filters.linked)} onChange={e=>setFilters(x=>({...x,linked:e.target.value===''?'':e.target.value==='true',page:1}))} className="rounded-xl border p-2.5"><option value="">الارتباط المهاري: الكل</option><option value="true">مرتبط</option><option value="false">غير مرتبط</option></select>
      </div>
    </section>

    {showCreate?<section className="rounded-3xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between"><div><p className="text-xs font-black text-amber-700">AUTHORING</p><h2 className="text-xl font-black">إنشاء سؤال بإصدار أول</h2></div><button type="button" aria-label="إغلاق إنشاء السؤال" onClick={()=>setShowCreate(false)}><XCircle size={20}/></button></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2"><input aria-label="كود السؤال الجديد" value={create.questionCode} onChange={e=>setCreate({...create,questionCode:e.target.value})} placeholder="الكود الثابت" className="rounded-xl border p-2.5"/><select aria-label="نوع السؤال الجديد" value={create.type} onChange={e=>setCreate({...create,type:e.target.value as QuestionType})} className="rounded-xl border p-2.5">{Object.entries(typeLabel).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
          <div className="grid gap-2 sm:grid-cols-2"><select aria-label="مسار السؤال الجديد" value={create.pathId} onChange={e=>setCreate({...create,pathId:e.target.value,subjectId:'',mainSkillId:'',subSkillId:''})} className="rounded-xl border p-2.5"><option value="">اختر المسار</option>{taxonomy.paths.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select aria-label="مادة السؤال الجديد" value={create.subjectId} onChange={e=>setCreate({...create,subjectId:e.target.value,mainSkillId:'',subSkillId:''})} className="rounded-xl border p-2.5"><option value="">اختر المادة</option>{createSubjects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <div className="grid gap-2 sm:grid-cols-2"><select aria-label="المهارة الرئيسية للسؤال" value={create.mainSkillId} onChange={e=>setCreate({...create,mainSkillId:e.target.value,subSkillId:''})} className="rounded-xl border p-2.5"><option value="">المهارة الرئيسية</option>{createMainSkills.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select aria-label="المهارة الفرعية للسؤال" value={create.subSkillId} onChange={e=>setCreate({...create,subSkillId:e.target.value})} className="rounded-xl border p-2.5"><option value="">مهارة فرعية اختيارية</option>{createSubSkills.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <textarea aria-label="نص السؤال الجديد" value={create.text} onChange={e=>setCreate({...create,text:e.target.value})} placeholder="نص السؤال (يمكن أن تكون الصورة هي المحتوى الرئيسي)" className="min-h-28 w-full rounded-xl border p-3"/>
          {create.type!=='essay'?<div className="grid gap-2 sm:grid-cols-2">{create.options.map((v,i)=><label key={i} className="text-xs font-bold">الخيار {i+1}<div className="mt-1 flex gap-2"><input aria-label={`نص الخيار ${i+1}`} value={v} onChange={e=>updateOption(i,e.target.value)} className="min-w-0 flex-1 rounded-xl border p-2"/><input aria-label={`الإجابة الصحيحة ${i+1}`} type="radio" name="correct-option" checked={create.correctOptionIndex===i} onChange={()=>setCreate({...create,correctOptionIndex:i})}/></div></label>)}</div>:null}
        </div>
        <div className="space-y-2">
          <textarea aria-label="شرح السؤال الجديد" value={create.explanation} onChange={e=>setCreate({...create,explanation:e.target.value})} placeholder="الشرح" className="min-h-20 w-full rounded-xl border p-3"/>
          <textarea aria-label="تلميح السؤال الجديد" value={create.hint} onChange={e=>setCreate({...create,hint:e.target.value})} placeholder="التلميح" className="min-h-16 w-full rounded-xl border p-3"/>
          <div className="grid gap-2 sm:grid-cols-2"><input aria-label="صعوبة السؤال الجديد" value={create.difficulty} onChange={e=>setCreate({...create,difficulty:e.target.value})} placeholder="difficulty" className="rounded-xl border p-2.5"/><input aria-label="مصدر السؤال الجديد" value={create.source} onChange={e=>setCreate({...create,source:e.target.value})} placeholder="source" className="rounded-xl border p-2.5"/></div>
          <div className="rounded-2xl border border-violet-100 bg-white p-3"><div className="flex items-center gap-2"><ImageUp size={18} className="text-violet-700"/><h3 className="font-black">وسائط السؤال — رفع مباشر</h3></div><input aria-label="ملف صورة السؤال" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setMediaFile(e.target.files?.[0]||null)} className="mt-3 block w-full text-sm"/><input aria-label="وصف صورة السؤال" value={create.imageAlt} onChange={e=>setCreate({...create,imageAlt:e.target.value})} placeholder="وصف بديل للصورة" className="mt-2 w-full rounded-xl border p-2"/><button type="button" disabled={!mediaFile||pending==='media'} onClick={()=>void uploadMedia()} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-black text-white disabled:opacity-40"><UploadCloud size={16}/> رفع وتحقق</button>{mediaAsset?<p className="mt-2 text-xs font-bold text-emerald-700">Asset: {mediaAsset.id} · {mediaAsset.status}</p>:null}</div>
          <button type="button" disabled={pending==='create'} onClick={()=>void createQuestion()} className="w-full rounded-xl bg-slate-950 py-3 font-black text-white disabled:opacity-50">حفظ السؤال كمسودة</button>
        </div>
      </div>
    </section>:null}

    <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <article className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between"><h2 className="font-black">الأسئلة المطابقة</h2>{busy?<Loader2 className="animate-spin text-violet-700" size={18}/>:<span className="text-xs font-bold text-gray-400">{rows.length}{hasMore?'+' : ''}</span>}</div>
        <div className="mt-4 overflow-hidden rounded-2xl border"><div className="hidden bg-gray-50 px-3 py-2 text-xs font-black text-gray-500 md:grid md:grid-cols-[1.2fr_1fr_1fr_auto_1fr_auto] md:items-center md:gap-3"><span>الكود</span><span>النوع</span><span>الحالة</span><span>النسخة</span><span>أدلة</span><span /></div><div className="divide-y">{rows.map(row=><article key={row.id} className="grid grid-cols-2 gap-2 p-3 text-sm md:grid-cols-[1.2fr_1fr_1fr_auto_1fr_auto] md:items-center md:gap-3"><div className="min-w-0 truncate font-black text-gray-900">{row.questionCode}</div><div className="text-xs font-bold text-gray-500 md:text-sm md:font-normal">{typeLabel[row.type]}</div><span className="w-fit rounded-full bg-gray-50 px-2 py-1 text-[11px] font-black text-gray-600 ring-1 ring-gray-200">{statusLabel[row.workflowStatus]}</span><div className="text-xs font-black text-gray-500 md:text-sm">v{row.currentVersion}</div><div className="min-w-0 truncate text-[11px] font-bold text-gray-400">{row.hasImage?'صورة · ':''}{row.hasVideo?'فيديو · ':''}{row.hasExplanation?'شرح':''}{!row.hasImage&&!row.hasVideo&&!row.hasExplanation?'بدون وسائط إضافية':''}</div><button type="button" onClick={()=>void openQuestion(row.id)} className="justify-self-end rounded-xl border bg-white px-3 py-2 text-xs font-black">فتح</button></article>)}</div></div>{!busy&&rows.length===0?<div className="p-8 text-center text-sm text-gray-500">لا توجد أسئلة مطابقة.</div>:null}
      </article>

      <article className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-black">تفاصيل ومراجعة</h2>
        {!detail?<div className="mt-4 rounded-2xl border border-dashed p-8 text-center text-sm text-gray-500">افتح سؤالًا لمراجعة الإصدار الحالي.</div>:<div className="mt-4 space-y-3">
          <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-violet-700">{detail.questionCode} · v{detail.currentVersion}</p><h3 className="mt-2 font-black">{detail.version.text||'سؤال بصري / صورة'}</h3><p className="mt-2 text-xs text-gray-500">{typeLabel[detail.version.type]} · {detail.version.difficulty||'بدون مستوى'} · {statusLabel[detail.workflowStatus]}</p></div>
          {detail.version.imageAssetId?<div className="flex items-center gap-2 rounded-xl border p-3 text-xs font-bold"><FileImage size={17}/> Media asset: {detail.version.imageAssetId}</div>:null}
          <div className="rounded-xl border p-3 text-sm"><b>الشرح:</b> {detail.version.explanation||'—'}</div>
          <div className="flex flex-wrap gap-2">{(detail.workflowStatus==='draft'||detail.workflowStatus==='rejected')?<button type="button" onClick={()=>void workflow('pending_review')} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-slate-950">إرسال للمراجعة</button>:null}{isAdmin&&detail.workflowStatus==='pending_review'?<><button type="button" onClick={()=>void workflow('approved')} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white">اعتماد</button><button type="button" onClick={()=>void workflow('rejected')} className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-black text-white">رفض</button></>:null}{isAdmin&&detail.workflowStatus!=='archived'?<button type="button" onClick={()=>void workflow('archived')} className="rounded-xl border px-3 py-2 text-xs font-black"><Archive size={14} className="inline"/> أرشفة</button>:null}</div>
        </div>}
      </article>
    </section>

    {isAdmin?<section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-sky-700"/><div><p className="text-xs font-black text-sky-700">V2 IMPORT</p><h2 className="font-black">استيراد إداري بفحص جاف أولًا</h2></div></div>
      <p className="mt-2 text-sm leading-7 text-gray-500">هذه الواجهة لا تعيد نمط تحميل ملف XLSX كاملًا في المتصفح. أرسل manifest JSON محدودًا (حتى 100 عنصر) يستخدم أصول WebP موثقة مسبقًا، ثم نفّذ dry-run قبل الكتابة.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_2fr]"><div><input aria-label="معرف دفعة الاستيراد" value={importBatchId} onChange={e=>{setImportBatchId(e.target.value);setImportDryRunPassed(false)}} placeholder="BATCH_2026_001" className="w-full rounded-xl border p-2.5"/>{importResult?<div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs"><b>{importResult.status}</b> · prepared {importResult.prepared}/{importResult.requested}{importResult.issues.length?<p className="mt-2 text-rose-700">{importResult.issues[0]?.code}: {importResult.issues[0]?.message}</p>:null}</div>:null}</div><div><textarea aria-label="JSON عناصر الاستيراد" value={importText} onChange={e=>{setImportText(e.target.value);setImportDryRunPassed(false)}} className="min-h-40 w-full rounded-xl border p-3 font-mono text-xs"/><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={()=>void importBatch(true)} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-black text-white">فحص جاف</button><button type="button" disabled={!importDryRunPassed} onClick={()=>void importBatch(false)} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-40">تنفيذ الدفعة المطابقة</button></div></div></div>
    </section>:null}

    <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-7 text-violet-950"><b>حدود الملكية:</b> Taxonomy يملك شجرة التصنيف، Media يملك دورة حياة الملف وR2، Question Bank يحتفظ بالمعرفات والعلاقات والإصدارات فقط. لا توجد أزرار حذف مدمر للسؤال؛ الأرشفة تحفظ التاريخ والإصدارات.</section>
  </main>;
}

function Stat({icon,label,value}:{icon:ReactNode;label:string;value:number}){
  return <article className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-violet-700">{icon}</div><p className="mt-2 text-xs font-bold text-gray-500">{label}</p><p className="text-2xl font-black">{value}</p></article>;
}
