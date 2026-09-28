import{Activity,BrainCircuit,CheckCircle2,FlaskConical,Gauge,Loader2,MessageCircleQuestion,RefreshCcw,Save,ShieldAlert,Zap}from'lucide-react';
import{useEffect,useMemo,useState}from'react';
import{useAuth}from'../../auth/state/AuthProvider';
import{aiClient}from'../api/ai-client';
import type{AiAdminCopilotResult,AiAdminReadiness,AiInteraction,AiProvider,AiProviderSetting,AiUsageSummary}from'../api/ai-types';

const labels:Record<AiProvider,string>={
 gemini:'Gemini',openrouter:'OpenRouter',qwen:'Qwen',deepseek:'DeepSeek',openai:'OpenAI',ollama:'Ollama',lmstudio:'LM Studio',
};

export function AiAdminPage(){
 const{user,loading:authLoading,getCsrfToken}=useAuth();
 const[providers,setProviders]=useState<AiProviderSetting[]>([]);
 const[interactions,setInteractions]=useState<AiInteraction[]>([]);
 const[usage,setUsage]=useState<AiUsageSummary|null>(null);
 const[readiness,setReadiness]=useState<AiAdminReadiness|null>(null);
 const[copilotMessage,setCopilotMessage]=useState('ما أهم شيء يحتاج انتباهي الآن؟');
 const[copilot,setCopilot]=useState<AiAdminCopilotResult|null>(null);
 const[busy,setBusy]=useState(true);
 const[saving,setSaving]=useState('');
 const[notice,setNotice]=useState('');
 const[error,setError]=useState('');
 const[reload,setReload]=useState(0);

 useEffect(()=>{
  if(authLoading||!user||!user.roles.includes('admin'))return;
  const c=new AbortController();setBusy(true);setError('');
  Promise.all([aiClient.providers(c.signal),aiClient.interactions(1,50,c.signal),aiClient.usage(c.signal),aiClient.readiness(c.signal)])
   .then(([p,i,u,r])=>{setProviders(p.items);setInteractions(i.items);setUsage(u.usage);setReadiness(r.readiness)})
   .catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل إدارة الذكاء الاصطناعي')})
   .finally(()=>{if(!c.signal.aborted)setBusy(false)});
  return()=>c.abort();
 },[authLoading,reload,user]);

 const summary=useMemo(()=>({
  enabled:providers.filter(x=>x.enabled).length,
  configured:providers.filter(x=>x.secretConfigured).length,
  today:usage?.today.requestCount||0,
  tokens:usage?.today.totalTokens||0,
  fallback:usage?.fallback24h||0,
  errors:usage?.error24h||0,
 }),[providers,usage]);

 function patch(provider:AiProvider,field:keyof AiProviderSetting,value:unknown){
  setProviders(rows=>rows.map(row=>row.provider===provider?{...row,[field]:value}:row));
 }

 async function save(row:AiProviderSetting){
  setSaving('save:'+row.provider);setError('');setNotice('');
  try{
   const csrf=await getCsrfToken();
   const res=await aiClient.updateProvider(row.provider,{
    enabled:row.enabled,model:row.model.trim(),baseUrl:row.baseUrl.trim(),priority:Number(row.priority),
    maxOutputTokens:Number(row.maxOutputTokens),expectedRevision:row.revision,
   },csrf);
   setProviders(rows=>rows.map(x=>x.provider===row.provider?res.provider:x));
   setNotice(`تم حفظ إعدادات ${labels[row.provider]}.`);
  }catch(e){setError(e instanceof Error?e.message:'تعذر حفظ المزود')}
  finally{setSaving('')}
 }

 async function test(row:AiProviderSetting){
  setSaving('test:'+row.provider);setError('');setNotice('');
  try{
   const csrf=await getCsrfToken();
   const res=await aiClient.testProvider(row.provider,csrf);
   setNotice(`اختبار ${labels[row.provider]} نجح عبر ${res.result.model}.`);
   setReload(x=>x+1);
  }catch(e){setError(e instanceof Error?e.message:'تعذر اختبار المزود')}
  finally{setSaving('')}
 }

 async function askCopilot(){
  const message=copilotMessage.trim();if(!message)return;
  setSaving('copilot');setError('');setNotice('');
  try{
   const csrf=await getCsrfToken();
   const res=await aiClient.copilot(message,csrf);
   setCopilot(res.result);setReadiness(res.result.readiness);
  }catch(e){setError(e instanceof Error?e.message:'تعذر تشغيل مساعد المدير')}
  finally{setSaving('')}
 }

 if(authLoading||busy)return <main dir="rtl" className="p-10 text-center font-black">جاري تحميل إدارة الذكاء الاصطناعي...</main>;
 if(!user||!user.roles.includes('admin'))return <main dir="rtl" className="p-10 text-center font-black text-rose-700">هذه الشاشة لمدير المنصة فقط.</main>;

 return <main dir="rtl" className="mx-auto max-w-7xl space-y-5">
  <header className="rounded-3xl bg-gradient-to-br from-indigo-950 to-slate-950 p-5 text-white sm:p-7">
   <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-indigo-300"><BrainCircuit size={18}/><span className="text-xs font-black">AI DOMAIN</span></div><h1 className="mt-2 text-2xl font-black">إدارة المساعد الذكي</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">ترتيب مزودات fallback، حالة الدائرة، وحدود الإخراج. مفاتيح المزودات تبقى إعدادات خادم ولا تُعاد للمتصفح.</p></div><button type="button" onClick={()=>setReload(x=>x+1)} className="inline-flex self-start items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-sm font-black"><RefreshCcw size={15}/>تحديث</button></div>
  </header>

  {error?<div role="alert" className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}</div>:null}
  {notice?<div className="rounded-xl bg-emerald-50 p-3 font-bold text-emerald-700">{notice}</div>:null}

  <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
   {[
    ['مفعلة',summary.enabled],['Runtime صريح',summary.configured],['طلبات اليوم',summary.today],['Tokens اليوم',summary.tokens],['Fallback 24h',summary.fallback],['أخطاء 24h',summary.errors],
   ].map(([label,value])=><div key={String(label)} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-2xl font-black">{Number(value).toLocaleString('en-US')}</div><div className="mt-1 text-xs font-bold text-gray-500">{label}</div></div>)}
  </section>

  <section className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
   <article data-testid="ai-readiness" className="rounded-3xl border bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Gauge size={18} className="text-indigo-600"/><h2 className="font-black">جاهزية AI</h2></div><span className={`rounded-full px-3 py-1 text-xs font-black ${readiness?.status==='ready'?'bg-emerald-50 text-emerald-700':readiness?.status==='degraded'?'bg-amber-50 text-amber-800':'bg-slate-100 text-slate-700'}`}>{readiness?.status||'—'}</span></div>
    <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-gray-600"><div className="rounded-xl bg-slate-50 p-3">اليوم <b>{readiness?.todayRequests||0}</b> / {readiness?.globalDailyLimit||0}</div><div className="rounded-xl bg-slate-50 p-3">حد المستخدم <b>{readiness?.userDailyLimit||0}</b></div><div className="rounded-xl bg-slate-50 p-3">Configured <b>{readiness?.configuredProviders||0}</b></div><div className="rounded-xl bg-slate-50 p-3">Open circuits <b>{readiness?.openCircuits.length||0}</b></div></div>
    <div className="mt-3 space-y-2">{readiness?.notes.map(note=><div key={note} className="rounded-xl bg-amber-50 p-2.5 text-xs font-bold leading-6 text-amber-800">{note}</div>)}</div>
   </article>
   <article data-testid="ai-admin-copilot" className="rounded-3xl border bg-white p-5 shadow-sm">
    <div className="flex items-center gap-2"><MessageCircleQuestion size={18} className="text-indigo-600"/><h2 className="font-black">مساعد المدير التشخيصي</h2></div>
    <p className="mt-1 text-xs font-bold leading-6 text-gray-500">قراءة فقط فوق مؤشرات AI وOperations الحالية. لا ينفذ أي إجراء إداري أو مدمّر.</p>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input aria-label="سؤال مساعد المدير" maxLength={800} value={copilotMessage} onChange={e=>setCopilotMessage(e.target.value)} className="min-w-0 flex-1 rounded-xl border p-3 text-sm" /><button type="button" onClick={()=>void askCopilot()} disabled={saving==='copilot'||!copilotMessage.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40">{saving==='copilot'?<Loader2 size={16} className="animate-spin"/>:<Zap size={16}/>}شخّص</button></div>
    {copilot?<div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4"><div className="text-xs font-black text-indigo-700">{copilot.usedFallback?'Trusted diagnostic fallback':`AI · ${copilot.provider}`}</div><p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-8 text-gray-800">{copilot.text}</p></div>:null}
   </article>
  </section>

  <section className="grid gap-4 xl:grid-cols-2">
   {providers.map(row=>{
    const circuitOpen=Boolean(row.health.openUntil&&new Date(row.health.openUntil).getTime()>Date.now());
    return <article key={row.provider} className="rounded-3xl border bg-white p-5 shadow-sm">
     <div className="flex items-start justify-between gap-3"><div><div className="text-lg font-black">{labels[row.provider]}</div><div className="mt-1 text-xs font-bold text-gray-500">priority {row.priority} · revision {row.revision}</div></div><div className="flex flex-wrap justify-end gap-2">{row.secretConfigured?<span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">Runtime configured</span>:<span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">بدون مفتاح/Runtime</span>}{circuitOpen?<span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700">Circuit open</span>:null}</div></div>
     <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="space-y-1"><span className="text-xs font-black">الموديل</span><input aria-label={`موديل ${labels[row.provider]}`} value={row.model} onChange={e=>patch(row.provider,'model',e.target.value)} className="w-full rounded-xl border p-2.5"/></label>
      <label className="space-y-1"><span className="text-xs font-black">الأولوية</span><input aria-label={`أولوية ${labels[row.provider]}`} type="number" min={1} max={1000} value={row.priority} onChange={e=>patch(row.provider,'priority',Number(e.target.value))} className="w-full rounded-xl border p-2.5"/></label>
      <label className="space-y-1"><span className="text-xs font-black">حد الإخراج</span><input aria-label={`حد إخراج ${labels[row.provider]}`} type="number" min={64} max={2000} value={row.maxOutputTokens} onChange={e=>patch(row.provider,'maxOutputTokens',Number(e.target.value))} className="w-full rounded-xl border p-2.5"/></label>
      <label className="flex items-center gap-2 rounded-xl border p-2.5"><input aria-label={`تفعيل ${labels[row.provider]}`} type="checkbox" checked={row.enabled} onChange={e=>patch(row.provider,'enabled',e.target.checked)}/><span className="text-sm font-black">مفعل في fallback chain</span></label>
     </div>
     <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-bold text-gray-600"><div>Base URL: <span className="font-mono">{row.baseUrl||'server-local runtime'}</span></div><div className="mt-1">Failures: {row.health.consecutiveFailures}{row.health.lastError?` · آخر خطأ: ${row.health.lastError}`:''}</div></div>
     <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={()=>void save(row)} disabled={Boolean(saving)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white disabled:opacity-40">{saving==='save:'+row.provider?<Loader2 size={15} className="animate-spin"/>:<Save size={15}/>}حفظ</button><button type="button" onClick={()=>void test(row)} disabled={Boolean(saving)||!row.secretConfigured} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-black disabled:opacity-40">{saving==='test:'+row.provider?<Loader2 size={15} className="animate-spin"/>:<FlaskConical size={15}/>}اختبار المزود</button></div>
    </article>
   })}
  </section>

  <section className="overflow-hidden rounded-3xl border bg-white shadow-sm"><div className="flex items-center gap-2 border-b p-4"><Activity size={18} className="text-indigo-600"/><h2 className="font-black">سجل التفاعلات</h2></div>{interactions.length===0?<div className="p-8 text-center text-sm font-bold text-gray-500">لا توجد تفاعلات مسجلة.</div>:<div className="divide-y">{interactions.map(row=><article key={row.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="font-black">{row.capability||row.endpoint}</div><div className="mt-1 text-xs font-bold text-gray-500">{row.provider} · {row.model||'—'} · {row.latencyMs}ms · tokens {row.totalTokens}</div>{row.errorCategory?<div className="mt-1 text-xs font-bold text-rose-700">{row.errorCategory}</div>:null}</div><div className="flex items-center gap-2">{row.status==='success'?<CheckCircle2 size={16} className="text-emerald-600"/>:<ShieldAlert size={16} className={row.status==='fallback'?'text-amber-600':'text-rose-600'}/>}<span className="rounded-xl border px-3 py-2 text-xs font-black">{row.status}{row.cacheHit?' · cache':''}</span></div></article>)}</div>}</section>
 </main>;
}
