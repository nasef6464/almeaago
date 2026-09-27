import{KeyRound,Loader2,Radio}from'lucide-react';
import{useState}from'react';
import{useNavigate}from'react-router-dom';
import{useAuth}from'../../auth/state/AuthProvider';
import{classroomClient}from'../api/classroom-client';

export function ClassroomJoinPage(){
 const{user,loading,getCsrfToken}=useAuth();const navigate=useNavigate();const[pin,setPin]=useState('');const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 async function join(){if(!/^\d{6}$/.test(pin))return;setBusy(true);setError('');try{const csrf=await getCsrfToken();const out=await classroomClient.joinByPin(pin,csrf);navigate('/classroom/'+out.session.id)}catch(e){setError(e instanceof Error?e.message:'تعذر الانضمام للحصة')}finally{setBusy(false)}}
 if(loading)return <main dir="rtl" className="p-10 text-center font-black">جاري التحقق...</main>;
 if(!user||!user.roles.includes('student'))return <main dir="rtl" className="p-10 text-center font-black text-rose-700">هذه الوجهة للطالب المسجل.</main>;
 return <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-slate-950 px-4 py-12 text-white"><section className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-2xl"><Radio className="mx-auto text-cyan-300" size={34}/><h1 className="mt-4 text-3xl font-black">انضم للفصل الذكي</h1><p className="mt-2 text-sm leading-7 text-slate-300">أدخل رمز الحصة المكوّن من 6 أرقام. الخادم يتحقق من عضويتك الفعلية في نفس المدرسة والفصل.</p><div className="mt-6"><label htmlFor="classroom-pin" className="sr-only">رمز الفصل الذكي</label><input id="classroom-pin" inputMode="numeric" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} className="w-full rounded-2xl border border-white/20 bg-white px-4 py-4 text-center text-3xl font-black tracking-[.3em] text-slate-950" dir="ltr" placeholder="000000"/></div>{error?<div role="alert" className="mt-3 rounded-xl bg-rose-500/15 p-3 text-sm font-bold text-rose-200">{error}</div>:null}<button type="button" onClick={()=>void join()} disabled={busy||pin.length!==6} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 disabled:opacity-40">{busy?<Loader2 size={18} className="animate-spin"/>:<KeyRound size={18}/>}انضمام للحصة</button></section></main>;
}
