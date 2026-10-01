import{Bell,CheckCheck,Loader2,RefreshCcw}from'lucide-react';
import{useEffect,useState}from'react';
import{useAuth}from'../../auth/state/AuthProvider';
import{notificationClient}from'../api/notification-client';
import type{NotificationDelivery,NotificationPreferences}from'../api/notification-types';

export function NotificationInboxPage(){
 const{user,loading:authLoading,getCsrfToken}=useAuth();
 const[items,setItems]=useState<NotificationDelivery[]>([]);
 const[unread,setUnread]=useState(0);
 const[busy,setBusy]=useState(true);
 const[action,setAction]=useState('');
 const[preferences,setPreferences]=useState<NotificationPreferences|null>(null);
 const[live,setLive]=useState<'connecting'|'connected'|'reconnecting'>('connecting');
 const[error,setError]=useState('');
 const[reload,setReload]=useState(0);

 useEffect(()=>{
  if(authLoading||!user)return;
  const c=new AbortController();setBusy(true);setError('');
  Promise.all([notificationClient.inbox(1,50,c.signal),notificationClient.unread(c.signal)])
   .then(([page,count])=>{setItems(page.items);setUnread(count.unreadCount)})
   .catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل الإشعارات')})
   .finally(()=>{if(!c.signal.aborted)setBusy(false)});
  return()=>c.abort();
 },[authLoading,reload,user]);

 useEffect(()=>{
  if(authLoading||!user?.roles.includes('parent')){setPreferences(null);return}
  const c=new AbortController();
  notificationClient.preferences(c.signal)
   .then(row=>setPreferences(row.preferences))
   .catch(()=>{if(!c.signal.aborted)setPreferences(null)});
  return()=>c.abort();
 },[authLoading,user]);

 useEffect(()=>{
  if(authLoading||!user||typeof EventSource==='undefined')return;
  const stream=new EventSource(notificationClient.streamURL(),{withCredentials:true});
  const connected=()=>setLive('connected');
  const refresh=()=>setReload(value=>value+1);
  stream.addEventListener('connected',connected);
  stream.addEventListener('notification',refresh);
  stream.onerror=()=>setLive('reconnecting');
  return()=>{stream.removeEventListener('connected',connected);stream.removeEventListener('notification',refresh);stream.close()};
 },[authLoading,user]);

 async function markRead(item:NotificationDelivery){
  if(item.readAt)return;
  setAction(item.id);setError('');
  try{const csrf=await getCsrfToken();await notificationClient.markRead(item.id,csrf);setItems(rows=>rows.map(row=>row.id===item.id?{...row,readAt:new Date().toISOString()}:row));setUnread(value=>Math.max(0,value-1))}
  catch(e){setError(e instanceof Error?e.message:'تعذر تحديث الإشعار')}
  finally{setAction('')}
 }
 async function markAll(){
  setAction('all');setError('');
  try{const csrf=await getCsrfToken();await notificationClient.markAllRead(csrf);const now=new Date().toISOString();setItems(rows=>rows.map(row=>({...row,readAt:row.readAt||now})));setUnread(0)}
  catch(e){setError(e instanceof Error?e.message:'تعذر تعليم الكل كمقروء')}
  finally{setAction('')}
 }
 async function toggleParentDigest(){
  if(!preferences)return;
  setAction('preferences');setError('');
  try{
   const csrf=await getCsrfToken();
   const out=await notificationClient.updatePreferences({
    parentWhatsAppDigestEnabled:!preferences.parentWhatsAppDigestEnabled,
    expectedRevision:preferences.revision,
   },csrf);
   setPreferences(out.preferences);
  }catch(e){setError(e instanceof Error?e.message:'تعذر تحديث تفضيل تقرير واتساب')}
  finally{setAction('')}
 }

 if(authLoading)return <main dir="rtl" className="p-10 text-center font-black">جاري التحقق من الحساب...</main>;
 if(!user)return <main dir="rtl" className="p-10 text-center font-black text-rose-700">سجّل الدخول لعرض الإشعارات.</main>;

 return <main dir="rtl" data-testid="learner-notification-inbox" className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-6 sm:px-6"><div className="mx-auto max-w-3xl space-y-4">
  <header className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-2xl bg-indigo-50 p-3 text-indigo-700"><Bell size={22}/></div><div><div className="flex flex-wrap items-center gap-2"><div className="text-[11px] font-black text-indigo-600">لوحة الطالب / الدعم والمتابعة</div><h1 className="text-2xl font-black text-gray-900">الإشعارات</h1><span data-testid="notification-live-state" className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">{live==='connected'?'تحديث لحظي':'إعادة اتصال تلقائية'}</span></div><p className="mt-1 text-sm font-bold text-gray-500">{unread>0?`${unread} جديد`:'لا توجد إشعارات جديدة'}</p></div></div><div className="flex gap-2"><button type="button" onClick={()=>setReload(x=>x+1)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-black"><RefreshCcw size={15}/>تحديث</button><button type="button" onClick={()=>void markAll()} disabled={action==='all'||unread===0} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-black text-white disabled:opacity-40">{action==='all'?<Loader2 size={15} className="animate-spin"/>:<CheckCheck size={15}/>}تعليم الكل مقروء</button></div></div></header>
  {error?<div role="alert" className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}</div>:null}
  {preferences?<section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-black text-emerald-950">تقرير ولي الأمر الأسبوعي عبر واتساب</div><p className="mt-1 text-xs font-bold leading-6 text-emerald-800">اشتراك اختياري محدد لهذا التقرير فقط. يتطلب رقم هاتف ومزود واتساب مهيأ؛ تفعيل الخيار لا يعني نجاح إرسال خارجي.</p></div><button type="button" aria-pressed={preferences.parentWhatsAppDigestEnabled} disabled={action==='preferences'} onClick={()=>void toggleParentDigest()} className={`rounded-xl px-4 py-2 text-sm font-black disabled:opacity-40 ${preferences.parentWhatsAppDigestEnabled?'bg-emerald-700 text-white':'border border-emerald-300 bg-white text-emerald-800'}`}>{preferences.parentWhatsAppDigestEnabled?'مفعّل — إيقاف':'غير مفعّل — تفعيل'}</button></div></section>:null}
  <section aria-label="قائمة الإشعارات" className="overflow-hidden rounded-3xl border bg-white shadow-sm">{busy?<div className="flex items-center justify-center gap-2 p-10 font-bold text-gray-500"><Loader2 size={18} className="animate-spin"/>جاري التحميل...</div>:items.length===0?<div className="p-10 text-center"><Bell className="mx-auto text-gray-300" size={38}/><h2 className="mt-3 font-black text-gray-800">لا توجد إشعارات</h2><p className="mt-1 text-sm text-gray-500">ستظهر هنا الإشعارات الداخلية المرسلة إلى حسابك.</p></div>:<div className="divide-y">{items.map(item=><button key={item.id} type="button" onClick={()=>void markRead(item)} className={`block w-full p-4 text-right transition hover:bg-gray-50 ${item.readAt?'bg-white':'bg-indigo-50/50'}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="font-black text-gray-900">{item.title}</div><p className="mt-1 text-sm leading-7 text-gray-600">{item.body}</p><div className="mt-2 text-[11px] font-bold text-gray-400">{new Date(item.createdAt).toLocaleString('ar-SA')}</div></div><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt?'bg-gray-200':'bg-indigo-600'}`}/></div>{action===item.id?<Loader2 size={14} className="mt-2 animate-spin text-indigo-600"/>:null}</button>)}</div>}</section>
 </div></main>;
}
