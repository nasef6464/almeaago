import {Activity,CheckCircle2,Loader2,Plus,RefreshCcw,School,Target,Users} from 'lucide-react';
import {useEffect,useMemo,useState} from 'react';
import {useAuth} from '../../auth/state/AuthProvider';
import {contentClient} from '../../content/api/content-client';
import type {TaxonomyFull} from '../../content/api/content-types';
import {organizationsClient,type RosterMember,type SchoolClass,type SchoolContext} from '../../organizations/api/organizations-client';
import {interventionClient,type InterventionOutcome,type InterventionStatus,type SchoolIntervention} from '../api/learning-client';

function accuracy(v:number|null|undefined){return v==null?'—':`${v.toFixed(1)}%`}
function localISO(v:string){return v?new Date(v).toISOString():null}

export function SchoolInterventionsPage(){
  const{user,loading:authLoading,getCsrfToken}=useAuth();
  const[contexts,setContexts]=useState<SchoolContext[]>([]);
  const[schoolId,setSchoolId]=useState('');
  const[classes,setClasses]=useState<SchoolClass[]>([]);
  const[classId,setClassId]=useState('');
  const[students,setStudents]=useState<RosterMember[]>([]);
  const[studentId,setStudentId]=useState('');
  const[taxonomy,setTaxonomy]=useState<TaxonomyFull>({paths:[],subjects:[],skills:[]});
  const[pathId,setPathId]=useState('');
  const[subjectId,setSubjectId]=useState('');
  const[skillId,setSkillId]=useState('');
  const[minimumEvidence,setMinimumEvidence]=useState(3);
  const[threshold,setThreshold]=useState('65');
  const[followUp,setFollowUp]=useState('');
  const[status,setStatus]=useState<InterventionStatus>('active');
  const[rows,setRows]=useState<SchoolIntervention[]>([]);
  const[hasMore,setHasMore]=useState(false);
  const[outcomes,setOutcomes]=useState<Record<string,InterventionOutcome>>({});
  const[busy,setBusy]=useState(true);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');
  const[notice,setNotice]=useState('');
  const[reload,setReload]=useState(0);

  const isSupervisor=Boolean(user?.roles.includes('supervisor'));
  const selectedContext=contexts.find(x=>x.schoolId===schoolId);
  const canManage=Boolean(
    selectedContext && (
      selectedContext.role==='supervisor' ||
      selectedContext.permissions.includes('SCHOOL_INTERVENTIONS_MANAGE')
    )
  );

  useEffect(()=>{
    if(authLoading||!user)return;
    const c=new AbortController();setBusy(true);
    Promise.all([organizationsClient.contexts(c.signal),contentClient.taxonomyFull(c.signal)])
      .then(([org,tax])=>{
        const allowed=org.contexts.filter(x=>x.role==='supervisor'||x.permissions.includes('SCHOOL_INTERVENTIONS_VIEW')||x.permissions.includes('SCHOOL_INTERVENTIONS_MANAGE'));
        setContexts(allowed);setTaxonomy(tax);
        if(allowed.length)setSchoolId(x=>x||allowed[0].schoolId);
        if(tax.paths.length)setPathId(x=>x||tax.paths[0].id);
      })
      .catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل نطاق المدرسة')})
      .finally(()=>{if(!c.signal.aborted)setBusy(false)});
    return()=>c.abort();
  },[authLoading,user]);

  useEffect(()=>{
    if(!schoolId){setClasses([]);setClassId('');return}
    const c=new AbortController();
    organizationsClient.classes(schoolId,c.signal).then(r=>{
      setClasses(r.classes);setClassId(x=>r.classes.some(v=>v.id===x)?x:(r.classes[0]?.id||''));
    }).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل الفصول')});
    return()=>c.abort();
  },[schoolId]);

  useEffect(()=>{
    if(!schoolId||!classId){setStudents([]);setStudentId('');return}
    const c=new AbortController();
    organizationsClient.students(schoolId,classId,c.signal).then(r=>{
      setStudents(r.members);setStudentId(x=>r.members.some(v=>v.userId===x)?x:(r.members[0]?.userId||''));
    }).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل طلاب الفصل')});
    return()=>c.abort();
  },[classId,schoolId]);

  const subjects=useMemo(()=>taxonomy.subjects.filter(x=>x.pathId===pathId),[pathId,taxonomy.subjects]);
  const skills=useMemo(()=>taxonomy.skills.filter(x=>x.subjectId===subjectId),[subjectId,taxonomy.skills]);
  useEffect(()=>{if(subjectId&&!subjects.some(x=>x.id===subjectId)){setSubjectId('');setSkillId('')}},[subjectId,subjects]);
  useEffect(()=>{if(skillId&&!skills.some(x=>x.id===skillId))setSkillId('')},[skillId,skills]);

  useEffect(()=>{
    if(!schoolId||(isSupervisor&&!classId)){setRows([]);setHasMore(false);return}
    const c=new AbortController();setBusy(true);setError('');
    interventionClient.staff(schoolId,classId,status,1,50,c.signal).then(r=>{setRows(r.items);setHasMore(r.hasMore)})
      .catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل التدخلات')})
      .finally(()=>{if(!c.signal.aborted)setBusy(false)});
    return()=>c.abort();
  },[classId,isSupervisor,reload,schoolId,status]);

  async function create(){
    if(!canManage||!schoolId||!classId||!studentId||!pathId||!subjectId||!skillId){setError('أكمل المدرسة والفصل والطالب والمسار والمادة والمهارة.');return}
    setSaving(true);setError('');setNotice('');
    try{
      const csrf=await getCsrfToken();
      await interventionClient.create({
        schoolId,classId,studentId,pathId,subjectId,skillId,
        followUpAt:followUp?localISO(followUp):null,
        remediationThreshold:threshold===''?null:Number(threshold),
        minimumEvidence,
      },csrf);
      setNotice('تم إنشاء التدخل وخطة علاج الطالب لمدة 14 يومًا.');
      setReload(x=>x+1);
    }catch(e){setError(e instanceof Error?e.message:'تعذر إنشاء التدخل')}
    finally{setSaving(false)}
  }

  async function measure(row:SchoolIntervention){
    setSaving(true);setError('');
    try{
      const csrf=await getCsrfToken();
      const r=await interventionClient.measure(row,csrf);
      setOutcomes(x=>({...x,[row.id]:r.outcome}));setReload(x=>x+1);
    }catch(e){setError(e instanceof Error?e.message:'تعذر قياس نتيجة التدخل')}
    finally{setSaving(false)}
  }

  async function complete(row:SchoolIntervention){
    setSaving(true);setError('');
    try{
      const csrf=await getCsrfToken();
      await interventionClient.patch(row,{status:'completed',followUpAt:row.followUpAt,remediationThreshold:row.remediationThreshold,minimumEvidence:row.minimumEvidence},csrf);
      setReload(x=>x+1);
    }catch(e){setError(e instanceof Error?e.message:'تعذر إكمال التدخل')}
    finally{setSaving(false)}
  }

  if(authLoading||busy&&contexts.length===0)return <main className="p-10 text-center font-black">جاري تحميل التدخلات...</main>;
  if(!user||(!user.roles.includes('school_admin')&&!user.roles.includes('supervisor')&&!user.roles.includes('admin')))return <main className="p-10 text-center font-black text-rose-700">لا تملك صلاحية تدخلات المدرسة.</main>;

  return <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-6 sm:px-6"><div className="mx-auto max-w-6xl space-y-5">
    <header className="rounded-3xl bg-slate-950 p-5 text-white sm:p-7"><div className="flex items-center gap-2 text-amber-400"><Activity size={20}/><span className="text-xs font-black">SCHOOL INTERVENTIONS</span></div><h1 className="mt-2 text-2xl font-black">التدخلات والخطط العلاجية</h1><p className="mt-2 text-sm leading-7 text-slate-300">تدخل مرتبط بطالب + فصل + مهارة، ويولد خطة دراسة علاجية من مراجع Learning الحالية.</p></header>
    {error?<div className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}</div>:null}{notice?<div className="rounded-xl bg-emerald-50 p-3 font-bold text-emerald-700">{notice}</div>:null}

    <section className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-3">
      <label className="space-y-1"><span className="text-xs font-black">المدرسة</span><select aria-label="المدرسة" value={schoolId} onChange={e=>setSchoolId(e.target.value)} className="w-full rounded-xl border p-2.5">{contexts.map(x=><option key={x.schoolId} value={x.schoolId}>{x.schoolName}</option>)}</select></label>
      <label className="space-y-1"><span className="text-xs font-black">الفصل</span><select aria-label="الفصل" value={classId} onChange={e=>setClassId(e.target.value)} className="w-full rounded-xl border p-2.5"><option value="">اختر الفصل</option>{classes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label className="space-y-1"><span className="text-xs font-black">الحالة</span><select aria-label="حالة التدخل" value={status} onChange={e=>setStatus(e.target.value as InterventionStatus)} className="w-full rounded-xl border p-2.5"><option value="active">نشطة</option><option value="completed">مكتملة</option><option value="cancelled">ملغاة</option></select></label>
    </section>

    {canManage?<section className="space-y-4 rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-center gap-2"><Plus size={19}/><h2 className="font-black">تدخل جديد</h2></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1"><span className="text-xs font-black">الطالب</span><select aria-label="الطالب" value={studentId} onChange={e=>setStudentId(e.target.value)} className="w-full rounded-xl border p-2.5"><option value="">اختر الطالب</option>{students.map(x=><option key={x.userId} value={x.userId}>{x.name}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs font-black">المسار</span><select aria-label="مسار التدخل" value={pathId} onChange={e=>{setPathId(e.target.value);setSubjectId('');setSkillId('')}} className="w-full rounded-xl border p-2.5"><option value="">اختر المسار</option>{taxonomy.paths.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs font-black">المادة</span><select aria-label="مادة التدخل" value={subjectId} onChange={e=>{setSubjectId(e.target.value);setSkillId('')}} className="w-full rounded-xl border p-2.5"><option value="">اختر المادة</option>{subjects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs font-black">المهارة</span><select aria-label="مهارة التدخل" value={skillId} onChange={e=>setSkillId(e.target.value)} className="w-full rounded-xl border p-2.5"><option value="">اختر المهارة</option>{skills.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="space-y-1"><span className="text-xs font-black">الحد العلاجي %</span><input aria-label="الحد العلاجي" type="number" min={0} max={100} value={threshold} onChange={e=>setThreshold(e.target.value)} className="w-full rounded-xl border p-2.5"/></label>
        <label className="space-y-1"><span className="text-xs font-black">أقل عدد أدلة</span><input aria-label="أقل عدد أدلة" type="number" min={1} max={100} value={minimumEvidence} onChange={e=>setMinimumEvidence(Math.max(1,Number(e.target.value)||3))} className="w-full rounded-xl border p-2.5"/></label>
        <label className="space-y-1 sm:col-span-2"><span className="text-xs font-black">موعد المتابعة</span><input aria-label="موعد المتابعة" type="datetime-local" value={followUp} onChange={e=>setFollowUp(e.target.value)} className="w-full rounded-xl border p-2.5"/></label>
      </div>
      <button type="button" disabled={saving} onClick={()=>void create()} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 font-black text-slate-950 disabled:opacity-40">{saving?<Loader2 size={18} className="animate-spin"/>:<Plus size={18}/>}إنشاء خطة علاج</button>
    </section>:null}

    <section className="overflow-hidden rounded-2xl border bg-white"><div className="flex items-center justify-between border-b p-4"><div className="flex items-center gap-2 font-black"><School size={18}/>التدخلات الحالية</div><button type="button" onClick={()=>setReload(x=>x+1)} className="rounded-lg border p-2" aria-label="تحديث"><RefreshCcw size={16}/></button></div>{hasMore?<div className="bg-amber-50 p-3 text-xs font-bold text-amber-800">هناك تدخلات أخرى؛ هذه القائمة bounded إلى 50 سجلًا.</div>:null}{busy?<div className="p-8 text-center font-bold text-gray-500">جاري التحميل...</div>:rows.length===0?<div className="p-8 text-center font-bold text-gray-500">لا توجد تدخلات في هذا النطاق.</div>:<div className="divide-y">{rows.map(row=>{const outcome=outcomes[row.id];return <article key={row.id} className="p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="font-black">مهارة {row.skillId}</span><span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-black text-indigo-700">{row.status}</span></div><div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-gray-500"><span>Baseline: {accuracy(row.baseline.accuracy)} ({row.baseline.evidenceCount} أدلة)</span><span>خطة: {row.studyPlanId}</span>{row.followUpAt?<span>متابعة: {new Date(row.followUpAt).toLocaleString('ar-SA')}</span>:null}</div>{(outcome||row.outcome)?<div className="mt-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">النتيجة: {accuracy((outcome?.intervention.outcome||row.outcome)?.accuracy)} {outcome?.confidence==='measured'&&outcome.delta!=null?<span>· التحسن {outcome.delta.toFixed(1)} نقطة</span>:<span>· الأدلة غير كافية للحكم</span>}</div>:null}</div><div className="flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={()=>void measure(row)} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-black"><Target size={15}/>قياس النتيجة</button>{row.status==='active'&&canManage?<button type="button" disabled={saving} onClick={()=>void complete(row)} className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800"><CheckCircle2 size={15}/>إكمال</button>:null}</div></div></article>})}</div>}</section>
  </div></main>;
}
