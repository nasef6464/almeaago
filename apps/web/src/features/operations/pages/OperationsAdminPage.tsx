import{Activity,AlertTriangle,CheckCircle2,Database,Loader2,RefreshCcw,ScrollText,Server,ShieldAlert,XCircle}from'lucide-react';
import{useEffect,useState}from'react';

import{useAuth}from'../../auth/state/AuthProvider';
import{operationsClient}from'../api/operations-client';
import type{AuditPage,AuditStatus,OperationsReadiness}from'../api/operations-types';

const statusText={ready:'جاهزية التطبيق معتمدة',ready_with_notes:'جاهزية مع ملاحظات خارجية',blocked:'جاهزية محجوبة'};
const auditText:Record<AuditStatus,string>={success:'ناجح',blocked:'محجوب',failed:'فشل'};
function tone(ok:boolean){return ok?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}

export function OperationsAdminPage(){
 const{user,loading:authLoading}=useAuth();
 const[readiness,setReadiness]=useState<OperationsReadiness|null>(null);
 const[audit,setAudit]=useState<AuditPage|null>(null);
 const[busy,setBusy]=useState(true);
 const[error,setError]=useState('');
 const[reload,setReload]=useState(0);
 const[status,setStatus]=useState<AuditStatus|''>('');
 const[action,setAction]=useState('');
 const[resourceType,setResourceType]=useState('');

 useEffect(()=>{
  if(authLoading||!user?.roles.includes('admin'))return;
  const controller=new AbortController();setBusy(true);setError('');
  Promise.all([
   operationsClient.readiness(controller.signal),
   operationsClient.audit({page:1,limit:50,status,action:action.trim()||undefined,resourceType:resourceType.trim()||undefined},controller.signal),
  ]).then(([ready,logs])=>{setReadiness(ready);setAudit(logs)})
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل مركز العمليات')})
   .finally(()=>{if(!controller.signal.aborted)setBusy(false)});
  return()=>controller.abort();
 },[action,authLoading,reload,resourceType,status,user]);

 if(authLoading)return <main dir="rtl" className="p-10 text-center font-black">جاري التحقق من الحساب...</main>;
 if(!user)return <main dir="rtl" className="p-10 text-center font-black text-rose-700">سجّل الدخول لعرض مركز العمليات.</main>;
 if(!user.roles.includes('admin'))return <main dir="rtl" className="p-10 text-center font-black text-rose-700">مركز العمليات متاح لمدير المنصة فقط.</main>;

 return <main dir="rtl" className="min-h-[calc(100vh-4rem)] bg-gray-50"><div className="mx-auto max-w-7xl space-y-5">
  <header className="rounded-3xl bg-gradient-to-br from-slate-950 to-indigo-900 p-5 text-white shadow-lg sm:p-7">
   <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-xs font-black text-indigo-200">OPERATIONS</div><h1 className="mt-2 text-2xl font-black sm:text-3xl">مركز العمليات والتدقيق</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-indigo-100">قراءة تشغيلية فقط من أدلة PostgreSQL وRedis والتكوين. لا تُقدَّم ملاحظة أو تكامل غير مثبت كحالة ناجحة.</p></div><button type="button" onClick={()=>setReload(x=>x+1)} className="inline-flex self-start items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-sm font-black"><RefreshCcw size={15}/>تحديث</button></div>
  </header>

  {error?<div role="alert" className="rounded-2xl bg-rose-50 p-4 font-bold text-rose-700">{error}</div>:null}
  {busy?<div className="flex items-center justify-center gap-2 rounded-3xl border bg-white p-12 font-bold text-gray-500"><Loader2 size={18} className="animate-spin"/>جاري تحميل أدلة التشغيل...</div>:readiness&&audit?<>
   <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <Metric icon={Database} label="PostgreSQL" value={readiness.dependencies.postgres?'متصل':'غير متاح'} ok={readiness.dependencies.postgres}/>
    <Metric icon={Server} label="Redis" value={readiness.dependencies.redis?'متصل':'غير متاح'} ok={readiness.dependencies.redis}/>
    <Metric icon={ShieldAlert} label="Audit خلال 24 ساعة" value={`${readiness.counts.auditBlocked24h} محجوب · ${readiness.counts.auditFailed24h} فشل`} ok={readiness.counts.auditFailed24h===0}/>
    <Metric icon={Activity} label="الإشعارات" value={`${readiness.counts.notificationPending} انتظار · ${readiness.counts.notificationFailed} فشل`} ok={readiness.counts.notificationFailed===0}/>
   </section>

   <section data-testid="release-evidence" className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-5 shadow-sm">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
     <div><div className="text-xs font-black text-indigo-600">RELEASE EVIDENCE</div><h2 className="mt-1 text-lg font-black text-slate-950">هوية الإصدار وأدلة الاعتماد</h2><p className="mt-1 max-w-3xl text-xs font-bold leading-6 text-slate-600">سلامة التطبيق لا تساوي اعتماد الإنتاج. هذه البطاقة تفصل الهوية المعلنة عن أدلة النشر والاستعادة والأداء والحوكمة التي تحتاج إثباتًا خارجيًا.</p></div>
     <div className="rounded-2xl bg-white px-4 py-3 text-left shadow-sm" dir="ltr"><div className="text-[10px] font-black text-slate-400">RELEASE SHA</div><div className="mt-1 font-mono text-sm font-black text-slate-900">{readiness.releaseIdentity.commitSha||'not declared'}</div><div className="mt-1 text-[10px] font-bold text-slate-500">{readiness.releaseIdentity.environment||'unknown env'}{readiness.releaseIdentity.deploymentProvider?` · ${readiness.releaseIdentity.deploymentProvider}`:''}</div></div>
    </div>
    <div className="mt-4 rounded-2xl bg-white p-4 text-xs font-bold leading-6 text-slate-700"><span className="font-black">حالة الهوية:</span> {readiness.releaseIdentity.proof} · {readiness.releaseIdentity.detail}</div>
    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">{readiness.releaseEvidence.map(item=><div key={item.id} className="rounded-2xl border bg-white p-3"><div className="text-[11px] font-black text-slate-900">{item.id}</div><div className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-black ${item.status==='declared'||item.status==='configured_not_verified'?'bg-amber-50 text-amber-800':'bg-slate-100 text-slate-600'}`}>{item.status}</div><p className="mt-2 text-[10px] font-bold leading-5 text-slate-500">{item.detail}</p></div>)}</div>
    <div className="mt-3 text-[11px] font-black text-indigo-800">قرار الإصدار الداخلي: {readiness.releaseDecision}</div>
   </section>

   <section className="grid gap-5 xl:grid-cols-2">
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
     <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black">جاهزية التشغيل</h2><p className="mt-1 text-xs font-bold text-gray-500">فحص لحظي وليس شهادة إطلاق.</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${readiness.status==='blocked'?'bg-rose-50 text-rose-700':'bg-amber-50 text-amber-800'}`}>{statusText[readiness.status]}</span></div>
     <div className="mt-4 space-y-2">{readiness.integrations.map(item=><div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><div className="text-sm font-black">{item.detail}</div><div className="mt-1 text-[11px] font-bold text-gray-400">{item.required?'مطلوب حسب التكوين':'تكامل اختياري/حسب النشر'}</div></div><div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${tone(item.configured)}`}>{item.configured?<CheckCircle2 size={13}/>:<XCircle size={13}/>} {item.configured?'مهيأ':'غير مثبت'}</div></div>)}</div>
    </div>
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
     <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-amber-700" size={20}/><div><h2 className="font-black text-amber-950">دليل النسخ الاحتياطي والاستعادة</h2><p className="mt-2 text-sm font-bold leading-7 text-amber-900">{readiness.backupRestoreDetail}</p><div className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-amber-800">{readiness.backupRestoreProof}</div></div></div>
     <div className="mt-5 grid grid-cols-2 gap-2 text-center"><div className="rounded-xl bg-white p-3"><div className="text-[11px] font-bold text-gray-500">فصول مباشرة</div><div className="mt-1 text-xl font-black">{readiness.counts.liveClassrooms}</div></div><div className="rounded-xl bg-white p-3"><div className="text-[11px] font-bold text-gray-500">مزودو AI المفعّلون</div><div className="mt-1 text-xl font-black">{readiness.counts.enabledAiProviders}</div></div></div>
    </div>
   </section>

   <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
    <div className="border-b p-5"><div className="flex items-center gap-2"><ScrollText size={18}/><h2 className="text-lg font-black">سجل التدقيق</h2></div><p className="mt-1 text-xs font-bold text-gray-500">قراءة إدارية bounded؛ السجل الأصلي لا يُعدّل من هذه الشاشة.</p>
     <div className="mt-4 grid gap-2 md:grid-cols-3"><select aria-label="حالة التدقيق" value={status} onChange={e=>setStatus(e.target.value as AuditStatus|'')} className="rounded-xl border p-2.5 text-sm font-bold"><option value="">كل الحالات</option><option value="success">ناجح</option><option value="blocked">محجوب</option><option value="failed">فشل</option></select><input aria-label="إجراء التدقيق" value={action} onChange={e=>setAction(e.target.value)} placeholder="action exact" className="rounded-xl border p-2.5 text-sm font-bold"/><input aria-label="نوع المورد" value={resourceType} onChange={e=>setResourceType(e.target.value)} placeholder="resource type exact" className="rounded-xl border p-2.5 text-sm font-bold"/></div>
    </div>
    <div className="border-b bg-slate-50 px-5 py-3 text-xs font-black text-slate-600">الإجمالي {audit.total} · محجوب 24س {audit.blockedCount24h} · فشل 24س {audit.failedCount24h}</div>
    {audit.items.length?<div className="divide-y">{audit.items.map(item=><article key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center"><div className="min-w-0"><div className="truncate font-black">{item.action}</div><div className="mt-1 text-xs font-bold text-gray-500">{item.resourceType}{item.resourceId?` · ${item.resourceId}`:''} · {item.actorName||item.actorUserId||'system'}</div><div className="mt-1 text-[11px] font-bold text-gray-400">{new Date(item.createdAt).toLocaleString('ar-SA')}</div></div><span className={`self-start rounded-full px-3 py-1 text-xs font-black md:self-auto ${item.status==='success'?'bg-emerald-50 text-emerald-700':item.status==='blocked'?'bg-amber-50 text-amber-800':'bg-rose-50 text-rose-700'}`}>{auditText[item.status]}</span></article>)}</div>:<div className="p-8 text-center text-sm font-bold text-gray-500">لا توجد سجلات تطابق الفلاتر الحالية.</div>}
   </section>
  </>:null}
 </div></main>;
}

function Metric({icon:Icon,label,value,ok}:{icon:typeof Database;label:string;value:string;ok:boolean}){return <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-xs font-black text-gray-500"><Icon size={15}/>{label}</div><div className={`mt-2 text-lg font-black ${ok?'text-emerald-700':'text-rose-700'}`}>{value}</div></div>}
