import React,{useEffect,useState} from 'react';
import {ChevronRight} from 'lucide-react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {useStudentExperience} from '../../../learning/navigation';
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
 const[catalogPath,setCatalogPath]=useState(pathId);const[selectedPath,setSelectedPath]=useState('');const[rows,setRows]=useState<PublicProduct[]>([]);const[busy,setBusy]=useState(true);const[error,setError]=useState('');const[retry,setRetry]=useState(0);const[selected,setSelected]=useState<CartItem|null>(null);
 useEffect(()=>{const c=new AbortController();setCatalogPath(pathId);setRows([]);setBusy(true);setError('');setSelected(null);(async()=>{const products:PublicProduct[]=[];for(let page=1;page<=10000;page++){const r=await publicCommerceClient.catalog(page,c.signal,pathId);products.push(...r.items);if(!r.hasMore)break}if(!c.signal.aborted)setRows(products.filter(p=>p.productType!=='course'))})().catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'تعذر تحميل العروض والباقات')}).finally(()=>{if(!c.signal.aborted)setBusy(false)});return()=>c.abort()},[pathId,retry]);
 const visibleRows=catalogPath===pathId?rows:[];const currentBusy=busy||catalogPath!==pathId;
 const name=path?.name||'';const color=String(path?.color||'#4f46e5');
 const backToPath=()=>{const q=new URLSearchParams(params);q.delete('tab');q.delete('package');navigate(`/category/${encodeURIComponent(pathId)}${q.size?`?${q}`:''}`)};
 const preview=(id:string)=>{const q=new URLSearchParams(params);q.set('tab','packages');q.set('package',id);navigate(`/category/${encodeURIComponent(pathId)}?${q}`)};
 return <div data-testid="path-packages-page" data-path-id={pathId} className="bg-gray-50 min-h-screen pb-20" dir="rtl">
  <header className="text-white py-7 sm:py-9 text-center relative overflow-hidden" style={{backgroundColor:colors[color]||(/^#[0-9a-f]{3,8}$/i.test(color)?color:'#4f46e5')}}>
   <div className="max-w-7xl mx-auto px-4 relative z-10">
    <button onClick={backToPath} className="flex items-center gap-2 justify-center mx-auto text-white/80 hover:text-white mb-6 transition-colors"><ChevronRight size={20}/> عودة للمسار</button>
    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black mb-4 leading-tight break-words">عروض وباقات {name}</h1><p className="text-white/80 text-lg">اختر الباقة الأنسب لك</p>
   </div>
  </header>
  <div className="max-w-5xl mx-auto px-4 py-8">
   {currentBusy?<div role="status" className="text-center py-12 text-gray-500">جارٍ تحميل العروض والباقات...</div>:error?<div role="alert" className="text-center py-12 text-rose-700">{error}<button onClick={()=>setRetry(v=>v+1)} className="mx-auto mt-4 block rounded-xl border border-rose-200 px-4 py-2 font-bold">إعادة المحاولة</button></div>:visibleRows.length===0?<div className="text-center py-12 text-gray-500">لا توجد عروض حالياً.</div>:<div className="mt-16 border-t border-gray-200 pt-16" id="packages">
    <div className="text-center mb-10"><h2 className="text-2xl sm:text-3xl font-black text-gray-800 mb-4 leading-tight">العروض والباقات</h2><p className="text-gray-500">اختر الباقة المناسبة لك للبدء في مسار {name}</p></div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{visibleRows.map(pkg=>{const types=pkg.contentTypes||[];const tone=tones[types.includes('all')?'all':types[0]]||tones.courses;const scopeLabel=types.map(x=>contentLabels[x]||x).join(' + ');return <div key={pkg.id} data-testid="path-package-card" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden border-2 border-transparent hover:border-indigo-400 hover:shadow-xl transition-all cursor-pointer flex flex-col">
     <div className={`${tone.header} text-white p-5 sm:p-6 text-center`}><h3 className="text-xl sm:text-2xl font-black mb-2 leading-tight break-words">{pkg.name}</h3><div className="text-2xl sm:text-3xl font-bold">{pkg.priceMinor/100} {pkg.currency}</div>{scopeLabel?<div className="mt-3 flex flex-wrap justify-center gap-2"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${tone.badge}`}>{scopeLabel}</span></div>:null}</div>
     <div className="p-5 sm:p-6 flex-1 flex flex-col"><p className={`mb-4 rounded-2xl border px-4 py-3 text-sm leading-7 text-slate-700 ${tone.panel}`}>{pkg.description||`هذه الباقة مخصصة لمسار ${name}.`}</p><ul className="mb-6 space-y-2 flex-1 text-sm text-gray-600"/>
      <button type="button" onClick={()=>preview(pkg.id)} className="mb-3 w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50">معاينة الباقة</button>
      <button onClick={()=>{setSelectedPath(pathId);setSelected({id:pkg.id,type:'package',title:pkg.name,price:pkg.priceMinor/100,currency:pkg.currency})}} className={`w-full rounded-xl py-3 font-bold transition-all ${tone.action} shadow-lg motion-safe:animate-pulse`}>اشترك الآن</button>
     </div>
    </div>})}</div>
   </div>}
  </div>
  {selected&&selectedPath===pathId?<PaymentModal isOpen onClose={()=>setSelected(null)} item={selected} type="package"/>:null}
 </div>
}
