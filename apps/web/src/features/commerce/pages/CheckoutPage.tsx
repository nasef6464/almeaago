import {BadgeCheck,ChevronLeft,CreditCard,Loader2,Percent,ReceiptText,ShieldCheck} from 'lucide-react';
import {useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';

import {useAuth} from '../../auth/state/AuthProvider';
import {commerceClient} from '../api/commerce-client';
import type {CommerceDiscountPreview,CommercePaymentMethod,CommercePaymentRequest,CommerceProduct} from '../api/commerce-types';

const money=(minor:number,currency:string)=>new Intl.NumberFormat('ar-SA',{style:'currency',currency}).format(minor/100);
function checkoutKey(productId:string){
 const k=`commerce-checkout:${productId}`;let value=sessionStorage.getItem(k);
 if(!value){value=crypto.randomUUID();sessionStorage.setItem(k,value)}
 return value;
}

export function CheckoutPage(){
 const{user,loading:authLoading,getCsrfToken}=useAuth();
 const[params]=useSearchParams();const productId=params.get('productId')||'';
 const[product,setProduct]=useState<CommerceProduct|null>(null);
 const[requests,setRequests]=useState<CommercePaymentRequest[]>([]);
 const[current,setCurrent]=useState<CommercePaymentRequest|null>(null);
 const[discountCode,setDiscountCode]=useState('');const[preview,setPreview]=useState<CommerceDiscountPreview|null>(null);
 const[method,setMethod]=useState<CommercePaymentMethod>('card');
 const[busy,setBusy]=useState(true);const[saving,setSaving]=useState(false);const[previewing,setPreviewing]=useState(false);
 const[error,setError]=useState('');const[notice,setNotice]=useState('');

 useEffect(()=>{if(authLoading||!user||!productId)return;const c=new AbortController();setBusy(true);setError('');
  Promise.all([commerceClient.catalogProduct(productId,c.signal),commerceClient.myPaymentRequests(1,20,c.signal)])
   .then(([p,r])=>{setProduct(p.product);setRequests(r.items);setCurrent(r.items.find(x=>x.productId===productId&&x.status==='pending')||null)})
   .catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل بيانات الشراء')})
   .finally(()=>{if(!c.signal.aborted)setBusy(false)});return()=>c.abort()
 },[authLoading,productId,user]);

 const displayed=useMemo(()=>current?{original:current.originalAmountMinor,discount:current.discountAmountMinor,final:current.finalAmountMinor,currency:current.currency}:preview&&preview.valid?{original:preview.originalAmountMinor,discount:preview.discountAmountMinor,final:preview.finalAmountMinor,currency:preview.currency}:product?{original:product.priceMinor,discount:0,final:product.priceMinor,currency:product.currency}:null,[current,preview,product]);

 async function applyDiscount(){
  const code=discountCode.trim();if(!product||!code){setPreview(null);return}
  setPreviewing(true);setError('');setNotice('');
  try{const r=await commerceClient.previewDiscount(product.id,code);setPreview(r.preview);if(!r.preview.valid)setNotice(r.preview.message||'كود الخصم غير متاح لهذا المنتج.')}
  catch(e){setError(e instanceof Error?e.message:'تعذر فحص كود الخصم')}
  finally{setPreviewing(false)}
 }

 async function submit(){
  if(!product||current)return;setSaving(true);setError('');setNotice('');
  try{
   const csrf=await getCsrfToken();
   const r=await commerceClient.createCheckout({productId:product.id,discountCode:preview?.valid?preview.code:'',paymentMethod:method,idempotencyKey:checkoutKey(product.id)},csrf);
   setCurrent(r.request);setRequests(v=>[r.request,...v.filter(x=>x.id!==r.request.id)]);
   setNotice(r.request.gatewayMode==='manual_review'?'تم إنشاء طلب الدفع. لن يُفتح المحتوى قبل اعتماد الخادم للطلب.':'تم إنشاء طلب الدفع. سيُفتح المحتوى فقط بعد callback موثوق من مزود الدفع.');
  }catch(e){setError(e instanceof Error?e.message:'تعذر إنشاء طلب الدفع')}
  finally{setSaving(false)}
 }

 if(authLoading||busy)return <main className="p-10 text-center font-black">جاري تحميل الدفع...</main>;
 if(!user)return <main className="p-10 text-center font-black text-rose-700">يلزم تسجيل الدخول لإتمام الشراء.</main>;
 if(!productId||!product)return <main className="p-10 text-center font-black text-rose-700">{error||'المنتج غير متاح.'}</main>;
 if(product.accessMode!=='paid')return <main className="p-10 text-center font-black text-emerald-700">هذا المنتج لا يحتاج طلب دفع.</main>;

 return <main dir="rtl" className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-6 sm:px-6"><div className="mx-auto max-w-3xl space-y-4">
  <header className="rounded-3xl bg-slate-950 p-5 text-white"><div className="flex items-center gap-2 text-amber-400"><CreditCard size={20}/><span className="text-xs font-black">SECURE CHECKOUT</span></div><h1 className="mt-2 text-2xl font-black">طلب شراء {product.name}</h1><p className="mt-2 text-sm leading-7 text-slate-300">السعر والعملة والخصم يعاد احتسابهم من الخادم عند إنشاء الطلب؛ المتصفح لا يرسل قيمة سعر معتمدة.</p></header>
  {error?<div role="alert" className="rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}</div>:null}{notice?<div className="rounded-xl bg-emerald-50 p-3 font-bold text-emerald-800">{notice}</div>:null}
  <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black text-indigo-600">{product.code}</div><h2 className="mt-1 text-xl font-black">{product.name}</h2><p className="mt-1 text-sm text-gray-500">{product.description}</p></div><div className="text-left text-lg font-black">{money(product.priceMinor,product.currency)}</div></div></section>
  {!current?<section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
   <label className="space-y-2"><span className="flex items-center gap-2 text-sm font-black"><Percent size={16}/>كود الخصم</span><div className="flex gap-2"><input aria-label="كود الخصم" value={discountCode} onChange={e=>{setDiscountCode(e.target.value.toUpperCase());setPreview(null)}} className="min-w-0 flex-1 rounded-xl border p-2.5 font-mono"/><button type="button" disabled={previewing||!discountCode.trim()} onClick={()=>void applyDiscount()} className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 font-black text-indigo-800 disabled:opacity-40">{previewing?<Loader2 size={17} className="animate-spin"/>:'تطبيق'}</button></div></label>
   {preview?<div className={`rounded-xl p-3 text-sm font-bold ${preview.valid?'bg-emerald-50 text-emerald-800':'bg-amber-50 text-amber-900'}`}>{preview.valid?`تم تطبيق ${preview.code}: خصم ${money(preview.discountAmountMinor,preview.currency)}`:preview.message}</div>:null}
   <label className="space-y-2"><span className="text-sm font-black">وسيلة الدفع</span><select aria-label="وسيلة الدفع" value={method} onChange={e=>setMethod(e.target.value as CommercePaymentMethod)} className="w-full rounded-xl border p-2.5"><option value="card">بطاقة</option><option value="transfer">تحويل بنكي</option><option value="wallet">محفظة</option></select></label>
   {displayed?<div className="space-y-2 rounded-xl bg-gray-50 p-4 text-sm"><div className="flex justify-between"><span>السعر الأصلي</span><strong>{money(displayed.original,displayed.currency)}</strong></div><div className="flex justify-between"><span>الخصم</span><strong>{money(displayed.discount,displayed.currency)}</strong></div><div className="flex justify-between border-t pt-2 text-base"><span className="font-black">المبلغ النهائي</span><strong>{money(displayed.final,displayed.currency)}</strong></div></div>:null}
   <button type="button" disabled={saving} onClick={()=>void submit()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-black text-white disabled:opacity-40">{saving?<Loader2 size={18} className="animate-spin"/>:<ShieldCheck size={18}/>}إنشاء طلب دفع آمن</button>
  </section>:<section data-testid="payment-request-status" className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-amber-950"><div className="flex items-center gap-2 font-black"><ReceiptText size={19}/>طلب الدفع قيد المراجعة</div><p className="mt-2 text-sm leading-7">الحالة: {current.status} · المبلغ: {money(current.finalAmountMinor,current.currency)} · المزود: {current.providerCode}</p><p className="mt-2 text-xs font-bold">لن يتم منح الوصول من الواجهة. الاعتماد اليدوي أو webhook الموقّع فقط يمكنه إنشاء Entitlement.</p></section>}
  <section className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-center gap-2 font-black"><BadgeCheck size={18}/>طلباتك الأخيرة</div><div className="mt-3 space-y-2">{requests.length===0?<p className="text-sm font-bold text-gray-500">لا توجد طلبات سابقة.</p>:requests.slice(0,5).map(r=><div key={r.id} className="flex items-center justify-between rounded-xl bg-gray-50 p-3 text-sm"><span className="font-bold">{r.productName}</span><span className="font-black">{r.status} · {money(r.finalAmountMinor,r.currency)}</span></div>)}</div></section>
  <Link to="/" className="inline-flex items-center gap-1 text-sm font-black text-indigo-700">العودة للمنصة <ChevronLeft size={16}/></Link>
 </div></main>;
}
