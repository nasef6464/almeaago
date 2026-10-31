import {
  Archive,
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileImage,
  Filter,
  HelpCircle,
  ImagePlus,
  ImageUp,
  Loader2,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  UploadCloud,
  Video,
  Volume2,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/state/AuthProvider';
import { contentClient } from '../../content/api/content-client';
import type { TaxonomyFull } from '../../content/api/content-types';
import { QuestionAssetImage } from '../../learning/components/QuestionAssetImage';
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
  const [searchParams] = useSearchParams();
  const selectedSkillId = searchParams.get('skillId')?.trim() || '';
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
  const [create, setCreate] = useState({
    questionCode: '',
    pathId: '',
    subjectId: '',
    type: 'mcq' as QuestionType,
    text: '',
    difficulty: 'Medium',
    examType: '',
    source: 'manual',
    explanation: '',
    hint: '',
    solvingStrategy: '',
    videoUrl: '',
    imageAssetId: '',
    imageAlt: '',
    optionsEmbeddedInImage: false,
    passage: '',
    showPassage: false,
    showAiContext: false,
    showVoiceExplanation: false,
    aiReadableText: '',
    aiSpeechText: '',
    aiVisualDescription: '',
    voiceNotes: '',
    mainSkillId: '',
    subSkillId: '',
    correctOptionIndex: 0,
    options: ['', '', '', ''],
  });

  function autoGenerateCode() {
    const code = `Q-${Date.now().toString().slice(-6)}`;
    setCreate((prev) => ({ ...prev, questionCode: code }));
  }
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
  const scopedFilters=useMemo(()=>selectedSkillId?{...filters,skillIds:[selectedSkillId]}:filters,[filters,selectedSkillId]);
  const selectedSkillName=taxonomy.skills.find(x=>x.id===selectedSkillId)?.name;

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
      questionBankClient.list(scopedFilters,c.signal),
      questionBankClient.coverage(scopedFilters,c.signal),
    ]).then(([page,cov])=>{
      setRows(page.items);setHasMore(page.hasMore);
      setCoverage({
        questionsTotal:cov.questionsTotal,approved:cov.approved,pendingReview:cov.pendingReview,unlinked:cov.unlinked,
        mainSkillCoverage:cov.mainSkillCoverage,subSkillCoverage:cov.subSkillCoverage,
      });
    }).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل بنك الأسئلة')})
      .finally(()=>{if(!c.signal.aborted)setBusy(false)});
    return()=>c.abort();
  },[authLoading,scopedFilters,isAdmin,isTeacher,reload,user]);

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

  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  function updateOption(index:number,value:string){
    setCreate(x=>({...x,options:x.options.map((v,i)=>i===index?value:v)}));
  }

  async function handleImageFile(file: File) {
    setMediaFile(file);
    const localUrl = URL.createObjectURL(file);
    setImagePreviewUrl(localUrl);

    let code = create.questionCode.trim();
    if (!code) {
      code = `Q-${Date.now().toString().slice(-6)}`;
      setCreate((prev) => ({ ...prev, questionCode: code }));
    }

    await run('media', async (csrf) => {
      const asset = await questionBankClient.uploadAsset(file, code, 'question_image', csrf);
      setMediaAsset(asset);
      setCreate((prev) => ({ ...prev, imageAssetId: asset.id }));
    }, 'تم لصق الصورة ورفعها بنجاح.');
  }

  function handlePasteImage(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.files);
    const image = files.find((f) => f.type.startsWith('image/'));
    if (image) {
      e.preventDefault();
      void handleImageFile(image);
    }
  }

  function removeImage() {
    setMediaFile(null);
    setMediaAsset(null);
    setImagePreviewUrl('');
    setCreate((prev) => ({ ...prev, imageAssetId: '' }));
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

    const sourceMeta: Record<string, unknown> = {};
    if (create.passage.trim()) {
      sourceMeta.passage = create.passage.trim();
    }

    const aiContext: Record<string, unknown> = {};
    if (create.aiReadableText.trim()) aiContext.readableText = create.aiReadableText.trim();
    if (create.aiSpeechText.trim()) aiContext.speechText = create.aiSpeechText.trim();
    if (create.aiVisualDescription.trim()) aiContext.visualDescription = create.aiVisualDescription.trim();
    if (create.optionsEmbeddedInImage) {
      aiContext.optionTexts = create.options.map((opt, i) => opt.trim() || ['أ', 'ب', 'ج', 'د'][i] || String(i + 1));
    }

    const voiceExplanation: Record<string, unknown> = {};
    if (create.voiceNotes.trim()) voiceExplanation.notes = create.voiceNotes.trim();

    await run('create',async csrf=>{
      const result=await questionBankClient.create({
        questionCode:create.questionCode.trim(),
        ownerType:isAdmin?'platform':'teacher',
        ownerId:isAdmin?'':user?.id||'',
        assignedTeacherId:isAdmin?'':user?.id||'',
        version:{
          pathId:create.pathId,subjectId:create.subjectId,type:create.type,text:create.text.trim(),
          imageAssetId:create.imageAssetId,imageAlt:create.imageAlt.trim(),optionsEmbeddedInImage:create.optionsEmbeddedInImage,
          correctOptionIndex:create.type==='essay'?null:Math.min(create.correctOptionIndex,Math.max(0,options.length-1)),
          explanation:create.explanation.trim(),hint:create.hint.trim(),solvingStrategy:create.solvingStrategy.trim(),
          videoUrl:create.videoUrl.trim(),sourceMeta,aiContext,voiceExplanation,
          difficulty:create.difficulty,examType:create.examType.trim(),source:create.source.trim(),year:null,revisionNote:'',
          options,skillLinks,
        },
      },csrf);
      setDetail(result.question);setShowCreate(false);setMediaAsset(null);setMediaFile(null);setImagePreviewUrl('');
      setCreate({
        questionCode:'',pathId:'',subjectId:'',type:'mcq',text:'',difficulty:'Medium',examType:'',source:'manual',
        explanation:'',hint:'',solvingStrategy:'',videoUrl:'',imageAssetId:'',imageAlt:'',optionsEmbeddedInImage:false,
        passage:'',showPassage:false,showAiContext:false,showVoiceExplanation:false,aiReadableText:'',aiSpeechText:'',
        aiVisualDescription:'',voiceNotes:'',mainSkillId:'',subSkillId:'',correctOptionIndex:0,options:['','','','']
      });
      setReload(x=>x+1);
    },'تم إنشاء السؤال كمسودة بإصدار أول مكتمل الحقول.');
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

    {selectedSkillId?<section aria-label="نطاق المهارة المحددة" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-bold text-indigo-900">
      <span>الأسئلة المرتبطة بالمهارة: {selectedSkillName || 'مهارة محددة'}</span>
      <Link to="/admin-dashboard/questions" className="rounded-xl border border-indigo-300 bg-white px-3 py-2 text-indigo-700">عرض جميع الأسئلة</Link>
    </section>:null}

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

    {showCreate ? (
      <section
        onPaste={handlePasteImage}
        className="rounded-3xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm sm:p-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-amber-700">AUTHORING · UNIFIED BUILDER</p>
            <h2 className="text-xl font-black">منشئ الأسئلة الموحد (يدعم لصق الصور مباشرة Ctrl+V وفيديو الشرح وسياق AI)</h2>
          </div>
          <button type="button" aria-label="إغلاق إنشاء السؤال" onClick={() => setShowCreate(false)}>
            <XCircle size={20} />
          </button>
        </div>

        {/* حقل القطعة القرائية (استيعاب المقروء) - اختياري */}
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black text-amber-900">
              <BookOpen size={16} className="text-amber-700" />
              <span>النص القرائي / قطعة الفهم (استيعاب المقروء - اختياري)</span>
            </div>
            <button
              type="button"
              onClick={() => setCreate((prev) => ({ ...prev, showPassage: !prev.showPassage }))}
              className="text-xs font-black text-amber-800 hover:underline cursor-pointer"
            >
              {create.showPassage ? 'إخفاء القطعة' : '+ إضافة قطعة للسؤال'}
            </button>
          </div>
          {create.showPassage ? (
            <textarea
              rows={4}
              value={create.passage}
              onChange={(e) => setCreate({ ...create, passage: e.target.value })}
              placeholder="أدخل نص القطعة أو المقال القرائي هنا. سيظهر للطالب في لوحة استيعاب المقروء المخصصة..."
              className="w-full rounded-xl border border-amber-300 bg-white p-3 text-sm font-medium leading-relaxed outline-none focus:border-amber-500"
            />
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex gap-2">
                <input
                  aria-label="كود السؤال الجديد"
                  value={create.questionCode}
                  onChange={(e) => setCreate({ ...create, questionCode: e.target.value })}
                  placeholder="الكود الثابت (مثال: Q-ALG-01)"
                  className="min-w-0 flex-1 rounded-xl border p-2.5 font-bold"
                />
                <button
                  type="button"
                  onClick={autoGenerateCode}
                  className="rounded-xl border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-black text-indigo-700 hover:bg-indigo-50 shrink-0"
                  title="توليد كود تلقائي"
                >
                  كود تلقائي
                </button>
              </div>
              <select
                aria-label="نوع السؤال الجديد"
                value={create.type}
                onChange={(e) => setCreate({ ...create, type: e.target.value as QuestionType })}
                className="rounded-xl border p-2.5"
              >
                {Object.entries(typeLabel).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                aria-label="مسار السؤال الجديد"
                value={create.pathId}
                onChange={(e) =>
                  setCreate({ ...create, pathId: e.target.value, subjectId: '', mainSkillId: '', subSkillId: '' })
                }
                className="rounded-xl border p-2.5"
              >
                <option value="">اختر المسار</option>
                {taxonomy.paths.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="مادة السؤال الجديد"
                value={create.subjectId}
                onChange={(e) => setCreate({ ...create, subjectId: e.target.value, mainSkillId: '', subSkillId: '' })}
                className="rounded-xl border p-2.5"
              >
                <option value="">اختر المادة</option>
                {createSubjects.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                aria-label="المهارة الرئيسية للسؤال"
                value={create.mainSkillId}
                onChange={(e) => setCreate({ ...create, mainSkillId: e.target.value, subSkillId: '' })}
                className="rounded-xl border p-2.5"
              >
                <option value="">المهارة الرئيسية</option>
                {createMainSkills.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="المهارة الفرعية للسؤال"
                value={create.subSkillId}
                onChange={(e) => setCreate({ ...create, subSkillId: e.target.value })}
                className="rounded-xl border p-2.5"
              >
                <option value="">مهارة فرعية اختيارية</option>
                {createSubSkills.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>

            {/* رابط فيديو الشرح + خيار الخيارات داخل الصورة */}
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Video size={14} className="text-blue-600" />
                  رابط فيديو شرح السؤال (اختياري)
                </label>
                <input
                  type="url"
                  value={create.videoUrl}
                  onChange={(e) => setCreate({ ...create, videoUrl: e.target.value })}
                  placeholder="https://... فيديو شرح حل المسألة"
                  className="w-full rounded-xl border p-2 text-xs font-medium"
                />
              </div>
              <div className="flex items-end">
                <label className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={create.optionsEmbeddedInImage}
                    onChange={(e) => setCreate({ ...create, optionsEmbeddedInImage: e.target.checked })}
                    className="h-4 w-4 rounded accent-indigo-600"
                  />
                  <span>الاختيارات وقيمها داخل صورة السؤال</span>
                </label>
              </div>
            </div>

            <textarea
              aria-label="نص السؤال الجديد"
              value={create.text}
              onPaste={handlePasteImage}
              onChange={(e) => setCreate({ ...create, text: e.target.value })}
              placeholder="نص السؤال — يمكنك لصق صورة السؤال مباشرة هنا بالضغط على Ctrl+V"
              className="min-h-24 w-full rounded-xl border p-3 leading-relaxed"
            />
            {create.type !== 'essay' ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {create.options.map((v, i) => (
                  <label key={i} className="text-xs font-bold">
                    الخيار {['أ', 'ب', 'ج', 'د'][i] || i + 1}
                    <div className="mt-1 flex gap-2">
                      <input
                        aria-label={`نص الخيار ${i + 1}`}
                        value={v}
                        onChange={(e) => updateOption(i, e.target.value)}
                        placeholder={create.optionsEmbeddedInImage ? `قيمة الخيار في الصورة (أو الرمز)` : `محتوى الخيار ${i + 1}`}
                        className="min-w-0 flex-1 rounded-xl border p-2 text-xs"
                      />
                      <input
                        aria-label={`الإجابة الصحيحة ${i + 1}`}
                        type="radio"
                        name="correct-option"
                        checked={create.correctOptionIndex === i}
                        onChange={() => setCreate({ ...create, correctOptionIndex: i })}
                        className="accent-emerald-600"
                      />
                    </div>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <textarea
              aria-label="شرح السؤال الجديد"
              value={create.explanation}
              onChange={(e) => setCreate({ ...create, explanation: e.target.value })}
              placeholder="الشرح واستراتيجية الحل خطوة بخطوة"
              className="min-h-16 w-full rounded-xl border p-3 text-xs"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                aria-label="تلميح السؤال الجديد"
                value={create.hint}
                onChange={(e) => setCreate({ ...create, hint: e.target.value })}
                placeholder="التلميح الذهبي"
                className="rounded-xl border p-2 text-xs"
              />
              <input
                aria-label="استراتيجية الحل"
                value={create.solvingStrategy}
                onChange={(e) => setCreate({ ...create, solvingStrategy: e.target.value })}
                placeholder="استراتيجية الحل السريع في قياس"
                className="rounded-xl border p-2 text-xs"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                aria-label="صعوبة السؤال الجديد"
                value={create.difficulty}
                onChange={(e) => setCreate({ ...create, difficulty: e.target.value })}
                placeholder="مستوى الصعوبة (Easy, Medium, Hard)"
                className="rounded-xl border p-2 text-xs"
              />
              <input
                aria-label="مصدر السؤال الجديد"
                value={create.source}
                onChange={(e) => setCreate({ ...create, source: e.target.value })}
                placeholder="المصدر (تجميعات 1445، تجريبي، محاكي)"
                className="rounded-xl border p-2 text-xs"
              />
            </div>

            {/* سياق الذكاء الاصطناعي والمساعد الذكي */}
            <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-violet-950">
                  <Bot size={15} className="text-violet-700" />
                  <span>سياق المساعد الذكي والصوت (AI Context)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCreate((prev) => ({ ...prev, showAiContext: !prev.showAiContext }))}
                  className="text-xs font-black text-violet-700 hover:underline cursor-pointer flex items-center gap-1"
                >
                  {create.showAiContext ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {create.showAiContext ? 'إخفاء' : 'تخصيص بيانات AI'}
                </button>
              </div>

              {create.showAiContext ? (
                <div className="space-y-2 pt-1 text-xs">
                  <div>
                    <label className="mb-1 block font-bold text-slate-700">النص الدقيق للذكاء الاصطناعي (بدون كشف الحل)</label>
                    <textarea
                      rows={2}
                      value={create.aiReadableText}
                      onChange={(e) => setCreate({ ...create, aiReadableText: e.target.value })}
                      placeholder="نص السؤال الكامل لفهم المسألة وشرحها دون حرق الإجابة الصحيحة..."
                      className="w-full rounded-xl border border-violet-200 bg-white p-2 text-xs"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block font-bold text-slate-700">النص المخصص للنطق الصوتي</label>
                      <input
                        value={create.aiSpeechText}
                        onChange={(e) => setCreate({ ...create, aiSpeechText: e.target.value })}
                        placeholder="مثال: الجذر التربيعي لـ تسعة وأربعين"
                        className="w-full rounded-xl border border-violet-200 bg-white p-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-bold text-slate-700">وصف العناصر البصرية (الرسم/الشكل)</label>
                      <input
                        value={create.aiVisualDescription}
                        onChange={(e) => setCreate({ ...create, aiVisualDescription: e.target.value })}
                        placeholder="وصف الرسم أو الأبعاد فقط بدون الحل..."
                        className="w-full rounded-xl border border-violet-200 bg-white p-2 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block font-bold text-slate-700">ملاحظات أو رابط الشرح الصوتي للمعلم</label>
                    <input
                      value={create.voiceNotes}
                      onChange={(e) => setCreate({ ...create, voiceNotes: e.target.value })}
                      placeholder="رابط تسجيل صوتي أو ملاحظات..."
                      className="w-full rounded-xl border border-violet-200 bg-white p-2 text-xs"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {/* بطاقة صورة السؤال مع اللصق المباشر والمعاينة الفورية */}
            <div className="rounded-2xl border border-violet-200 bg-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageUp size={18} className="text-violet-700" />
                  <h3 className="font-black text-sm">صورة السؤال — لصق أو رفع فوري</h3>
                </div>
                {imagePreviewUrl || mediaAsset || create.imageAssetId ? (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800"
                  >
                    <Trash2 size={14} /> حذف الصورة
                  </button>
                ) : null}
              </div>

              {imagePreviewUrl || mediaAsset || create.imageAssetId ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-violet-100 bg-slate-50 p-2 text-center">
                  <img
                    src={imagePreviewUrl || (mediaAsset ? URL.createObjectURL(mediaFile!) : '')}
                    alt={create.imageAlt || 'معاينة صورة السؤال'}
                    className="mx-auto max-h-48 rounded-lg object-contain shadow-xs"
                  />
                  {create.imageAssetId ? (
                    <p className="mt-2 text-xs font-bold text-emerald-700">✓ تم الرفع والتثبيت في R2 ({create.imageAssetId})</p>
                  ) : null}
                </div>
              ) : (
                <div
                  onPaste={handlePasteImage}
                  className="mt-3 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/30 p-4 text-center transition hover:bg-violet-50/60"
                >
                  <ImagePlus size={28} className="text-violet-400" />
                  <p className="mt-1 text-xs font-black text-violet-900">الصق الصورة هنا مباشرة (Ctrl + V)</p>
                  <p className="text-[11px] text-gray-500">أو يمكنك اختيار ملف من جهازك</p>
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-bold text-violet-700 shadow-xs hover:bg-violet-50">
                    <UploadCloud size={14} /> اختر ملف صورة
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleImageFile(file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              <input
                aria-label="وصف صورة السؤال"
                value={create.imageAlt}
                onChange={(e) => setCreate({ ...create, imageAlt: e.target.value })}
                placeholder="وصف بديل للصورة (اختياري)"
                className="mt-2 w-full rounded-xl border p-2 text-xs"
              />
            </div>

            <button
              type="button"
              disabled={pending === 'create' || pending === 'media'}
              onClick={() => void createQuestion()}
              className="w-full rounded-xl bg-slate-950 py-3 font-black text-white shadow-sm transition hover:bg-slate-900 disabled:opacity-50 cursor-pointer"
            >
              {pending === 'create' ? 'جارٍ الحفظ...' : 'حفظ السؤال كمسودة'}
            </button>
          </div>
        </div>
      </section>
    ) : null}

    <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <article className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between"><h2 className="font-black">الأسئلة المطابقة</h2>{busy?<Loader2 className="animate-spin text-violet-700" size={18}/>:<span className="text-xs font-bold text-gray-400">{rows.length}{hasMore?'+' : ''}</span>}</div>
        <div className="mt-4 overflow-hidden rounded-2xl border"><div className="hidden bg-gray-50 px-3 py-2 text-xs font-black text-gray-500 md:grid md:grid-cols-[1.2fr_1fr_1fr_auto_1fr_auto] md:items-center md:gap-3"><span>الكود</span><span>النوع</span><span>الحالة</span><span>النسخة</span><span>أدلة</span><span /></div><div className="divide-y">{rows.map(row=><article key={row.id} className="grid grid-cols-2 gap-2 p-3 text-sm md:grid-cols-[1.2fr_1fr_1fr_auto_1fr_auto] md:items-center md:gap-3"><div className="min-w-0 truncate font-black text-gray-900">{row.questionCode}</div><div className="text-xs font-bold text-gray-500 md:text-sm md:font-normal">{typeLabel[row.type]}</div><span className="w-fit rounded-full bg-gray-50 px-2 py-1 text-[11px] font-black text-gray-600 ring-1 ring-gray-200">{statusLabel[row.workflowStatus]}</span><div className="text-xs font-black text-gray-500 md:text-sm">v{row.currentVersion}</div><div className="min-w-0 truncate text-[11px] font-bold text-gray-400">{row.hasImage?'صورة · ':''}{row.hasVideo?'فيديو · ':''}{row.hasExplanation?'شرح':''}{!row.hasImage&&!row.hasVideo&&!row.hasExplanation?'بدون وسائط إضافية':''}</div><button type="button" onClick={()=>void openQuestion(row.id)} className="justify-self-end rounded-xl border bg-white px-3 py-2 text-xs font-black">فتح</button></article>)}</div></div>{!busy&&rows.length===0?<div className="p-8 text-center text-sm text-gray-500">لا توجد أسئلة مطابقة.</div>:null}
      </article>

      <article className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-black">تفاصيل ومراجعة السؤال</h2>
        {!detail ? (
          <div className="mt-4 rounded-2xl border border-dashed p-8 text-center text-sm text-gray-500">
            اضغط على «فتح» بجانب أي سؤال لمراجعة نصه وخياراته وصورته ومهاراته.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-violet-700">
                  {detail.questionCode} · v{detail.currentVersion}
                </span>
                <div className="flex items-center gap-1.5">
                  {detail.version.optionsEmbeddedInImage ? (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-800">
                      خيارات بالصورة
                    </span>
                  ) : null}
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black shadow-xs">
                    {statusLabel[detail.workflowStatus]}
                  </span>
                </div>
              </div>
              <h3 className="mt-2 text-base font-black leading-relaxed">
                {detail.version.text || 'سؤال بصري / صورة'}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                <span>{typeLabel[detail.version.type]}</span>
                <span>•</span>
                <span>الصعوبة: {detail.version.difficulty || 'متوسط'}</span>
                {detail.version.source ? (
                  <>
                    <span>•</span>
                    <span>المصدر: {detail.version.source}</span>
                  </>
                ) : null}
              </div>
            </div>

            {/* قطعة استيعاب المقروء إذا وجدت */}
            {(detail.version.sourceMeta as any)?.passage ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs leading-relaxed text-amber-950">
                <div className="flex items-center gap-1.5 font-black text-amber-900 mb-1.5">
                  <BookOpen size={14} className="text-amber-700" />
                  <span>قطعة استيعاب المقروء (النص القرائي المعتمد):</span>
                </div>
                <p className="whitespace-pre-line font-medium text-slate-800 bg-white/70 p-2.5 rounded-xl border border-amber-100">
                  {(detail.version.sourceMeta as any).passage}
                </p>
              </div>
            ) : null}

            {/* صورة السؤال الحقيقية */}
            {detail.version.imageAssetId ? (
              <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white p-3 shadow-xs">
                <p className="mb-2 text-xs font-black text-violet-800">صورة السؤال المعتمدة:</p>
                <QuestionAssetImage
                  assetId={detail.version.imageAssetId}
                  alt={detail.questionCode}
                  className="mx-auto max-h-64 rounded-xl object-contain"
                />
              </div>
            ) : null}

            {/* فيديو شرح السؤال إذا وجد */}
            {detail.version.videoUrl ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-3 text-xs font-bold text-blue-900">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                    <Play size={14} className="fill-current" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-blue-950">فيديو شرح حل المسألة</p>
                    <p className="text-[11px] text-blue-700 font-medium truncate">{detail.version.videoUrl}</p>
                  </div>
                </div>
                <a
                  href={detail.version.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-700 transition"
                >
                  فتح الفيديو <ExternalLink size={12} />
                </a>
              </div>
            ) : null}

            {/* الخيارات والإجابة الصحيحة */}
            {detail.options && detail.options.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-black text-gray-500">الخيارات والإجابة المعتمدة:</p>
                <div className="grid gap-2">
                  {detail.options.map((opt, i) => {
                    const isCorrect = i === detail.version.correctOptionIndex;
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-between rounded-xl border p-2.5 text-xs font-bold transition-colors ${
                          isCorrect
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-xs'
                            : 'border-gray-200 bg-white text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                              isCorrect ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {['أ', 'ب', 'ج', 'د'][i] || i + 1}
                          </span>
                          <span>{opt.text || `خيار ${i + 1}`}</span>
                        </div>
                        {isCorrect ? (
                          <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">
                            الإجابة الصحيحة ✓
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* الشرح واستراتيجية الحل */}
            {detail.version.explanation ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-xs leading-relaxed text-indigo-950">
                <b className="text-indigo-900">الشرح وتوضيح الإجابة:</b> {detail.version.explanation}
              </div>
            ) : null}

            {detail.version.solvingStrategy ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-2.5 text-xs leading-relaxed text-emerald-950">
                <b className="text-emerald-900">استراتيجية الحل السريع في قياس:</b> {detail.version.solvingStrategy}
              </div>
            ) : null}

            {detail.version.hint ? (
              <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-2.5 text-xs leading-relaxed text-amber-900">
                <b className="text-amber-800">التلميح:</b> {detail.version.hint}
              </div>
            ) : null}

            {/* سياق الذكاء الاصطناعي والصوت إن وجد */}
            {detail.version.aiContext && Object.keys(detail.version.aiContext).length > 0 ? (
              <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 text-xs space-y-1.5 text-violet-950">
                <div className="flex items-center gap-1.5 font-black text-violet-900">
                  <Bot size={14} className="text-violet-700" />
                  <span>بيانات المساعد الذكي والصوت (AI Context):</span>
                </div>
                {(detail.version.aiContext as any).readableText ? (
                  <p><span className="font-bold text-slate-700">نص المسألة للـ AI:</span> {(detail.version.aiContext as any).readableText}</p>
                ) : null}
                {(detail.version.aiContext as any).speechText ? (
                  <p><span className="font-bold text-slate-700">النطق الصوتي:</span> {(detail.version.aiContext as any).speechText}</p>
                ) : null}
                {(detail.version.aiContext as any).visualDescription ? (
                  <p><span className="font-bold text-slate-700">الوصف البصري:</span> {(detail.version.aiContext as any).visualDescription}</p>
                ) : null}
              </div>
            ) : null}

            {/* المهارات المرتبطة */}
            {detail.skillLinks && detail.skillLinks.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-black text-gray-500">المهارات المرتبطة بالسؤال:</p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.skillLinks.map((sl, i) => {
                    const skName = taxonomy.skills.find((x) => x.id === sl.skillId)?.name || sl.skillId;
                    return (
                      <span
                        key={i}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                          sl.relationType === 'main'
                            ? 'bg-violet-100 text-violet-800 ring-1 ring-violet-200'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {sl.relationType === 'main' ? '★ مهارة رئيسة: ' : 'مهارة فرعية: '}
                        {skName}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              {detail.workflowStatus === 'draft' || detail.workflowStatus === 'rejected' ? (
                <button
                  type="button"
                  onClick={() => void workflow('pending_review')}
                  className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-slate-950 hover:bg-amber-400 cursor-pointer"
                >
                  إرسال للمراجعة
                </button>
              ) : null}
              {isAdmin && detail.workflowStatus === 'pending_review' ? (
                <>
                  <button
                    type="button"
                    onClick={() => void workflow('approved')}
                    className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white hover:bg-emerald-600 cursor-pointer"
                  >
                    اعتماد السؤال
                  </button>
                  <button
                    type="button"
                    onClick={() => void workflow('rejected')}
                    className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-black text-white hover:bg-rose-600 cursor-pointer"
                  >
                    رفض
                  </button>
                </>
              ) : null}
              {isAdmin && detail.workflowStatus !== 'archived' ? (
                <button
                  type="button"
                  onClick={() => void workflow('archived')}
                  className="rounded-xl border px-3 py-2 text-xs font-black hover:bg-gray-50 cursor-pointer"
                >
                  <Archive size={14} className="inline ml-1" /> أرشفة
                </button>
              ) : null}
            </div>
          </div>
        )}
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
