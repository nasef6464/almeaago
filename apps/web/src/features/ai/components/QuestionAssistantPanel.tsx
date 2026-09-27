import{BrainCircuit,Loader2,MessageCircleQuestion,Sparkles}from'lucide-react';
import{useState}from'react';

import{useAuth}from'../../auth/state/AuthProvider';
import{aiClient}from'../api/ai-client';
import type{AiHelpLevel,AiQuestionAssistResult}from'../api/ai-types';

const levels:Array<[AiHelpLevel,string]>= [
 ['hint','تلميح'],['stronger_hint','تلميح أقوى'],['concept','الفكرة'],['steps','خطوات'],['follow_up','سؤال متابعة'],
];

export function QuestionAssistantPanel({reviewCardId}:{reviewCardId:string}){
 const{getCsrfToken}=useAuth();
 const[level,setLevel]=useState<AiHelpLevel>('hint');
 const[message,setMessage]=useState('');
 const[result,setResult]=useState<AiQuestionAssistResult|null>(null);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState('');

 async function ask(nextLevel:AiHelpLevel=level){
  setLevel(nextLevel);setBusy(true);setError('');
  try{
   const csrf=await getCsrfToken();
   const response=await aiClient.questionAssistant({reviewCardId,helpLevel:nextLevel,message:message.trim()},csrf);
   setResult(response.result);
  }catch(e){setError(e instanceof Error?e.message:'تعذر تشغيل مساعد السؤال')}
  finally{setBusy(false)}
 }

 return <section data-testid="question-assistant" className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm sm:p-5">
  <div className="flex items-start gap-3"><div className="rounded-2xl bg-indigo-600 p-2.5 text-white"><BrainCircuit size={20}/></div><div><h3 className="font-black text-indigo-950">مساعد السؤال</h3><p className="mt-1 text-xs font-bold leading-6 text-indigo-700">مساعدة تدريجية من سياق السؤال الموثوق فقط. لا تغيّر الدرجة أو حقيقة الإتقان.</p></div></div>
  <div className="mt-4 flex flex-wrap gap-2">{levels.map(([id,label])=><button key={id} type="button" disabled={busy} onClick={()=>void ask(id)} className={`rounded-xl border px-3 py-2 text-xs font-black transition disabled:opacity-40 ${level===id?'border-indigo-600 bg-indigo-600 text-white':'border-indigo-100 bg-white text-indigo-800'}`}>{label}</button>)}</div>
  <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input aria-label="سؤال متابعة للمساعد" maxLength={500} value={message} onChange={e=>setMessage(e.target.value)} placeholder="اكتب سؤالًا قصيرًا اختياريًا..." className="min-w-0 flex-1 rounded-xl border border-indigo-100 bg-white p-2.5 text-sm"/><button type="button" disabled={busy} onClick={()=>void ask()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40">{busy?<Loader2 size={16} className="animate-spin"/>:<MessageCircleQuestion size={16}/>}اسأل</button></div>
  {error?<div role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>:null}
  {result?<div className="mt-4 rounded-2xl border border-indigo-100 bg-white p-4"><div className="flex flex-wrap items-center gap-2 text-xs font-black text-indigo-700"><Sparkles size={14}/><span>{result.usedFallback?'شرح موثوق احتياطي':`AI · ${result.provider}`}</span>{result.cacheHit?<span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">cache</span>:null}</div><p className="mt-3 whitespace-pre-wrap text-sm font-bold leading-8 text-gray-800">{result.text}</p></div>:null}
 </section>;
}
