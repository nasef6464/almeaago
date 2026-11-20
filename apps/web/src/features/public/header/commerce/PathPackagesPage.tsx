import React,{useEffect,useState} from 'react';
import {ChevronRight} from 'lucide-react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {useStudentExperience} from '../../../learning/navigation';
import {safeReturnPath,returnPathLabel} from '../../../assessment/navigation/returnPath';
import {publicCommerceClient,type PublicProduct} from './commerce-public-client';
import {PaymentModal} from './PaymentModal';
import type {CartItem} from './cart-model';

const contentLabels:Record<string,string>={all:'باقة شاملة',courses:'الدورات',foundation:'التأسيس',banks:'التدريب',tests:'الاختبارات',mock_exams:'الاختبارات المحاكية',library:'المكتبة'};
const colors:Record<string,string>={purple:'#7c3aed',violet:'#7c3aed',blue:'#2563eb',sky:'#0284c7',cyan:'#0891b2',teal:'#0d9488',emerald:'#10b981',green:'#16a34a',lime:'#65a30d',yellow:'#ca8a04',amber:'#f59e0b',orange:'#ea580c',red:'#dc2626',rose:'#f43f5e',pink:'#db2777',fuchsia:'#c026d3',indigo:'#4f46e5',slate:'#475569',gray:'#6b7280'};
const tones:Record<string,{header:string;badge:string;panel:string;action:string}>={
 all:{header:'bg-gradient-to-br from-indigo-600 to-violet-600',badge:'bg-white/20 text-white',panel:'border-indigo-100 bg-indigo-50',action:'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'},
 foundation:{header:'bg-gradient-to-br from-blue-600 to-indigo-600',badge:'bg-white/20 text-white',panel:'border-blue-100 bg-blue-50',action:'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'},
 banks:{header:'bg-gradient-to-br from-emerald-600 to-teal-600',badge:'bg-white/20 text-white',panel:'border-emerald-100 bg-emerald-50',action:'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100'},
 tests:{header:'bg-gradient-to-br from-amber-500 to-orange-500',badge:'bg-white/25 text-white',panel:'border-amber-100 bg-amber-50',action:'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-100'},
 library:{header:'bg-gradient-to-br from-slate-700 to-slate-900',badge:'bg-white/20 text-white',panel:'border-slate-100 bg-slate-50',action:'bg-slate-900 text-white hover:bg-black shadow-slate-100'},
 courses:{header:'bg-gradient-to-br from-sky-600 to-blue-600',badge:'bg-white/20 text-white',panel:'border-sky-100 bg-sky-50',action:'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-100'},
};

// Presentation copied from GenericPathPage's public packages tab. Relationships
// come from the scoped Commerce catalog; this view never infers package access.
export function PathPackagesPage({pathId}:{pathId:string}){
 const {paths}=useStudentExperience();const path=paths.find(x=>x.id===pathId);const navigate=useNavigate();const[params]=useSearchParams();
 const subjectFilter=params.get('subjectId')||'';const contentFilter=params.get('contentType')||'';const hasFilter=Boolean(subjectFilter||contentFilter);
 const validFilter=!contentFilter||['foundation','banks','tests','library','courses','mock_exams'].includes(contentFilter);
 const scope=JSON.stringify([pathId,subjectFilter,contentFilter]);
 const[catalogScope,setCatalogScope]=useState('');const[selectedScope,setSelectedScope]=useState('');const[rows,setRows]=useState<PublicProduct[]>([]);const[busy,setBusy]=useState(true);const[error,setError]=useState('');const[retry,setRetry]=useState(0);const[selected,setSelected]=useState<CartItem|null>(null);
 useEffect(()=>{const c=new AbortController();setCatalogScope(scope);setRows([]);setBusy(true);setError('');setSelected(null);if(!validFilter){setError('تعذر تحديد المادة ونوع المحتوى المطلوبين.');setBusy(false);return()=>c.abort()}(async()=>{const products:PublicProduct[]=[];for(let page=1;page<=10000;page++){const r=await publicCommerceClient.catalog(page,c.signal,pathId,subjectFilter,contentFilter);products.push(...r.items);if(!r.hasMore)break}if(!c.signal.aborted)setRows(products.filter(p=>p.productType!=='course'))})().catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل العروض والباقات')}).finally(()=>{if(!c.signal.aborted)setBusy(false)});return()=>c.abort()},[pathId,subjectFilter,contentFilter,scope,validFilter,retry]);
 const visibleRows=catalogScope===scope?rows:[];const currentBusy=busy||catalogScope!==scope;
 const name=path?.name||'';const color=String(path?.color||'#4f46e5');
 const returnTo=safeReturnPath(params.get('returnTo'));
 const backToPath=()=>{const q=new URLSearchParams(params);q.delete('tab');q.delete('package');q.delete('subjectId');q.delete('contentType');q.delete('returnTo');navigate(`/category/${encodeURIComponent(pathId)}${q.size?`?${q}`:''}`)};
 const preview=(id:string)=>{const q=new URLSearchParams(params);q.set('tab','packages');q.set('package',id);navigate(`/category/${encodeURIComponent(pathId)}?${q}`)};
 const closePreview=()=>{const q=new URLSearchParams(params);q.delete('package');navigate(`/category/${encodeURIComponent(pathId)}?${q}`)};
 const showAllPackages=()=>{const q=new URLSearchParams(params);q.delete('subjectId');q.delete('contentType');q.delete('package');navigate(`/category/${encodeURIComponent(pathId)}?${q}`)};
 const previewed=visibleRows.find(pkg=>pkg.id===params.get('package'));
 useEffect(()=>{if(!previewed)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')closePreview()};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[previewed,params,pathId]);
 return <div data-testid="path-packages-page" data-path-id={pathId} className="bg-gray-50 min-h-screen pb-20" dir="rtl">
  <header className="text-white py-7 sm:py-9 text-center relative overflow-hidden" style={{backgroundColor:colors[color]||(/^#[0-9a-f]{3,8}$/i.test(color)?color:'#4f46e5')}}>
   <div className="max-w-7xl mx-auto px-4 relative z-10">
    <button onClick={backToPath} className="flex items-center gap-2 justify-center mx-auto text-white/80 hover:text-white mb-6 transition-colors"><ChevronRight size={20}/> عودة للمسار</button>
    {returnTo&&<button type="button" onClick={()=>navigate(returnTo)} className="mb-4 rounded-xl border border-white/50 px-4 py-2 text-sm font-bold">{returnPathLabel(returnTo)}</button>}
    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black mb-4 leading-tight break-words">عروض وباقات {name}</h1><p className="text-white/80 text-lg">{hasFilter?'باقات تغطي المحتوى المحدد':'اختر الباقة الأنسب لك'}</p>
    {hasFilter&&<button type="button" onClick={showAllPackages} className="mt-4 rounded-xl border border-white/50 px-4 py-2 text-sm font-bold">عرض كل باقات المسار</button>}
   </div>
  </header>
  <div className="max-w-5xl mx-auto px-4 py-8">
   {!currentBusy&&!error&&params.get('package')&&!previewed&&<div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">هذه الباقة غير متاحة ضمن العرض الحالي. <button type="button" onClick={closePreview} className="underline">إغلاق</button></div>}
   {currentBusy?<div role="status" className="text-center py-12 text-gray-500">جارٍ تحميل العروض والباقات...</div>:error?<div role="alert" className="text-center py-12 text-rose-700">{error}<button onClick={()=>setRetry(v=>v+1)} className="mx-auto mt-4 block rounded-xl border border-rose-200 px-4 py-2 font-bold">إعادة المحاولة</button></div>:visibleRows.length===0?<div className="text-center py-12 text-gray-500">{hasFilter?'لا توجد باقات منشورة تغطي هذا المحتوى حاليًا.':'لا توجد عروض حالياً.'}</div>:<div className="mt-16 border-t border-gray-200 pt-16" id="packages">
    <div className="text-center mb-10"><h2 className="text-2xl sm:text-3xl font-black text-gray-800 mb-4 leading-tight">العروض والباقات</h2><p className="text-gray-500">اختر الباقة المناسبة لك للبدء في مسار {name}</p></div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{visibleRows.map(pkg=>{const types=pkg.contentTypes||[];const tone=tones[types.includes('all')?'all':types[0]]||tones.courses;const scopeLabel=types.map(x=>contentLabels[x]||x).join(' + ');return <div key={pkg.id} data-testid="path-package-card" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-2 border-transparent hover:border-indigo-400 hover:shadow-xl transition-all cursor-pointer flex flex-col">
     <div className={`${tone.header} text-white p-5 sm:p-6 text-center`}><h3 className="text-xl sm:text-2xl font-black mb-2 leading-tight break-words">{pkg.name}</h3><div className="text-2xl sm:text-3xl font-bold">{pkg.priceMinor/100} {pkg.currency}</div>{scopeLabel?<div className="mt-3 flex flex-wrap justify-center gap-2"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${tone.badge}`}>{scopeLabel}</span></div>:null}</div>
     <div className="p-5 sm:p-6 flex-1 flex flex-col"><p className={`mb-4 rounded-2xl border px-4 py-3 text-sm leading-7 text-slate-700 ${tone.panel}`}>{pkg.description||`هذه الباقة مخصصة لمسار ${name}.`}</p><ul className="mb-6 space-y-2 flex-1 text-sm text-gray-600"/>
      <button type="button" onClick={()=>preview(pkg.id)} className="mb-3 w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50">معاينة الباقة</button>
      <button onClick={()=>{setSelectedScope(scope);setSelected({id:pkg.id,type:'package',title:pkg.name,price:pkg.priceMinor/100,currency:pkg.currency})}} className={`w-full rounded-xl py-3 font-bold transition-all ${tone.action} shadow-lg motion-safe:animate-pulse`}>اشترك الآن</button>
     </div>
    </div>})}</div>
   </div>}
  </div>
  {previewed&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={`معاينة ${previewed.name}`}>
   <div className="w-full max-w-lg rounded-2xl bg-white p-6 text-right shadow-2xl">
    <div className="flex items-start justify-between gap-3"><h2 className="break-words text-xl font-black text-slate-900">{previewed.name}</h2><button type="button" autoFocus onClick={closePreview} aria-label="إغلاق معاينة الباقة" className="rounded-lg border px-3 py-1.5 font-bold">×</button></div>
    {previewed.description&&<p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{previewed.description}</p>}
    {previewed.contentTypes?.length?<p className="mt-4 text-sm font-bold text-slate-700">المحتوى: {previewed.contentTypes.map(kind=>contentLabels[kind]||kind).join('، ')}</p>:null}
    <p className="mt-4 font-black text-indigo-700">{new Intl.NumberFormat('ar-SA',{style:'currency',currency:previewed.currency}).format(previewed.priceMinor/100)}</p>
    <button type="button" onClick={()=>{setSelectedScope(scope);setSelected({id:previewed.id,type:'package',title:previewed.name,price:previewed.priceMinor/100,currency:previewed.currency});closePreview()}} className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 font-black text-white">اشترك الآن</button>
   </div>
  </div>}
  {selected&&selectedScope===scope?<PaymentModal isOpen onClose={()=>setSelected(null)} item={selected} type="package"/>:null}
 </div>
}
