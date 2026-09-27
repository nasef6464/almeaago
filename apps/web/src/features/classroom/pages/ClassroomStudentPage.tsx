import{CheckCircle2,Loader2,Radio,RefreshCcw,Wifi,WifiOff}from'lucide-react';
import{useCallback,useEffect,useRef,useState}from'react';
import{useParams}from'react-router-dom';
import{useAuth}from'../../auth/state/AuthProvider';
import{classroomClient}from'../api/classroom-client';
import type{ClassroomStudentState}from'../api/classroom-types';

export function ClassroomStudentPage(){
 const{sessionId=''}=useParams();const{user,loading,getCsrfToken}=useAuth();
 const[state,setState]=useState<ClassroomStudentState|null>(null);const[busy,setBusy]=useState(true);const[action,setAction]=useState('');const[error,setError]=useState('');const[connected,setConnected]=useState(false);const socketRef=useRef<WebSocket|null>(null);

 const refresh=useCallback(async()=>{if(!sessionId)return;try{const out=await classroomClient.current(sessionId);setState(out.state);setError('')}catch(e){setError(e instanceof Error?e.message:'تعذر تحميل حالة الحصة')}finally{setBusy(false)}},[sessionId]);

 useEffect(()=>{if(loading||!user||!sessionId)return;let cancelled=false;(async()=>{setBusy(true);try{const csrf=await getCsrfToken();await classroomClient.join(sessionId,csrf)}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'تعذر الانضمام للحصة')}if(!cancelled)await refresh()})();return()=>{cancelled=true}},[loading,user,sessionId,getCsrfToken,refresh]);

 useEffect(()=>{
  socketRef.current?.close();socketRef.current=null;if(!sessionId||!user||!state||state.status!=='live')return;
  let stopped=false;let retry:number|undefined;
  const connect=()=>{if(stopped)return;try{const ws=classroomClient.websocket(sessionId);socketRef.current=ws;ws.onopen=()=>{setConnected(true)};ws.onmessage=()=>void refresh();ws.onclose=()=>{setConnected(false);if(!stopped)retry=window.setTimeout(connect,1500)};ws.onerror=()=>ws.close()}catch{setConnected(false);retry=window.setTimeout(connect,2000)}};
  connect();const poll=window.setInterval(()=>void refresh(),5000);
  return()=>{stopped=true;if(retry)window.clearTimeout(retry);window.clearInterval(poll);socketRef.current?.close();setConnected(false)}
 },[sessionId,user,state?.status,refresh]);

 async function answer(ordinal:number,index:number){if(!sessionId)return;setAction(`${ordinal}:${index}`);setError('');try{const csrf=await getCsrfToken();await classroomClient.answer(sessionId,ordinal,index,csrf);await refresh()}catch(e){setError(e instanceof Error?e.message:'تعذر حفظ الإجابة')}finally{setAction('')}}

 if(loading||busy)return <main dir="rtl" className="p-10 text-center font-black"><Loader2 className="mx-auto mb-2 animate-spin"/>جاري دخول الحصة...</main>;
 if(!user||!user.roles.includes('student'))return <main dir="rtl" className="p-10 text-center font-black text-rose-700">هذه الشاشة للطالب فقط.</main>;
 return <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-50 px-3 py-5 sm:px-6"><div className="mx-auto max-w-3xl space-y-4">
  <header className="rounded-3xl bg-slate-950 p-5 text-white"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-cyan-300"><Radio size={17}/><span className="text-xs font-black">LIVE CLASSROOM</span></div><h1 className="mt-2 text-2xl font-black">الحصة التفاعلية</h1></div><div className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${connected?'bg-emerald-500/20 text-emerald-200':'bg-amber-500/20 text-amber-200'}`}>{connected?<Wifi size={15}/>:<WifiOff size={15}/>} {connected?'متصل لحظيًا':'إعادة اتصال تلقائية'}</div></div></header>
  {error?<div role="alert" className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}<button type="button" onClick={()=>void refresh()} className="mr-2 inline-flex items-center gap-1 underline"><RefreshCcw size={14}/>تحديث</button></div>:null}
  {state?.status==='ended'||state?.status==='archived'?<section className="rounded-3xl border bg-white p-8 text-center shadow-sm"><CheckCircle2 className="mx-auto text-emerald-600" size={42}/><h2 className="mt-3 text-2xl font-black">انتهت الحصة</h2><p className="mt-2 text-sm text-gray-500">حُفظت إجاباتك في التقرير النهائي للحصة.</p></section>:state?.questions.length?<div className="space-y-4">{state.questions.map(q=><section key={q.ordinal} className="rounded-3xl border bg-white p-5 shadow-sm"><div className="text-xs font-black text-indigo-600">السؤال #{q.ordinal+1}</div><h2 className="mt-2 text-xl font-black leading-8 text-gray-900">{q.text||'سؤال بصري'}</h2><div className="mt-5 grid gap-3">{q.options.map(o=>{const selected=q.selectedOptionIndex===o.index;const correct=q.revealed&&q.correctOptionIndex===o.index;const wrong=q.revealed&&selected&&!correct;return <button key={o.index} type="button" disabled={q.revealed||action!==''} onClick={()=>void answer(q.ordinal,o.index)} className={`rounded-2xl border-2 p-4 text-right font-black transition disabled:cursor-default ${correct?'border-emerald-500 bg-emerald-50 text-emerald-800':wrong?'border-rose-400 bg-rose-50 text-rose-700':selected?'border-indigo-500 bg-indigo-50 text-indigo-800':'border-gray-100 bg-white hover:border-indigo-200'}`}><span className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs">{o.index+1}</span>{o.text||`الخيار ${o.index+1}`}{action===`${q.ordinal}:${o.index}`?<Loader2 className="float-left animate-spin" size={17}/>:null}</button>})}</div>{q.revealed?<div className="mt-5 rounded-2xl bg-emerald-50 p-4"><div className="font-black text-emerald-800">تم كشف الحل بواسطة المعلم</div>{q.explanation?<p className="mt-2 text-sm font-bold leading-7 text-emerald-700">{q.explanation}</p>:null}</div>:<p className="mt-4 text-xs font-bold text-gray-400">يمكنك تعديل إجابتك ما دام السؤال مفتوحًا ولم يُكشف الحل.</p>}</section>)}</div>:<section className="rounded-3xl border border-dashed bg-white p-10 text-center shadow-sm"><Radio className="mx-auto text-gray-300" size={40}/><h2 className="mt-3 text-xl font-black text-gray-800">بانتظار السؤال</h2><p className="mt-2 text-sm text-gray-500">ستظهر الدفعة أو السؤال فور نشره من المعلم.</p></section>}
 </div></main>;
}
