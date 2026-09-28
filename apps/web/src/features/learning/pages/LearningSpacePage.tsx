import {BookOpen,FolderTree,Library,Lock,Search} from 'lucide-react';
import {useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {contentClient} from '../../content/api/content-client';
import type {LearningSpace,TaxonomyCore} from '../../content/api/content-types';
import {useAuth} from '../../auth/state/AuthProvider';

type Tab='courses'|'foundation'|'library';

export function LearningSpacePage(){
  const{user,loading:authLoading}=useAuth();
  const[params,setParams]=useSearchParams();
  const[taxonomy,setTaxonomy]=useState<TaxonomyCore>({paths:[],subjects:[]});
  const[pathId,setPathId]=useState(params.get('pathId')||'');
  const[subjectId,setSubjectId]=useState(params.get('subjectId')||'');
  const[tab,setTab]=useState<Tab>((params.get('tab') as Tab)||'courses');
  const[space,setSpace]=useState<LearningSpace|null>(null);
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');
  useEffect(()=>{const c=new AbortController();contentClient.taxonomyCore(c.signal).then(setTaxonomy).catch(()=>{});return()=>c.abort()},[]);
  const subjects=useMemo(()=>taxonomy.subjects.filter(x=>!pathId||x.pathId===pathId),[pathId,taxonomy.subjects]);
  useEffect(()=>{if(subjectId&&!subjects.some(x=>x.id===subjectId))setSubjectId('')},[subjectId,subjects]);
  useEffect(()=>{setParams(p=>{const n=new URLSearchParams(p);pathId?n.set('pathId',pathId):n.delete('pathId');subjectId?n.set('subjectId',subjectId):n.delete('subjectId');n.set('tab',tab);return n},{replace:true})},[pathId,setParams,subjectId,tab]);
  useEffect(()=>{if(!pathId||!subjectId){setSpace(null);return}const c=new AbortController();setBusy(true);setError('');contentClient.learningSpace(pathId,subjectId,50,c.signal).then(setSpace).catch(e=>{if(!c.signal.aborted){setSpace(null);setError(e instanceof Error?e.message:'تعذر تحميل مساحة التعلم')}}).finally(()=>{if(!c.signal.aborted)setBusy(false)});return()=>c.abort()},[pathId,subjectId]);
  if(authLoading)return <main className="p-10 text-center font-black">جاري تحميل مساحة التعلم...</main>;
  if(!user)return <main className="p-10 text-center font-black text-rose-700">سجّل الدخول لفتح مساحة التعلم.</main>;
  const tabs:[Tab,string,typeof BookOpen][]=[['courses','الدورات',BookOpen],['foundation','التأسيس',FolderTree],['library','المكتبة',Library]];
  return <main className="min-h-[calc(100vh-5rem)] bg-gray-50 px-3 py-6 sm:px-6"><div className="mx-auto max-w-6xl space-y-5">
    <section className="rounded-3xl bg-gradient-to-l from-indigo-700 to-blue-700 p-6 text-white shadow-sm"><div className="text-xs font-black text-indigo-100">مساحة التعلم</div><h1 className="mt-1 text-2xl font-black">تعلّم حسب المسار والمادة</h1><p className="mt-2 max-w-2xl text-sm font-bold leading-7 text-indigo-100">الدورات والتأسيس وملفات الدعم المعتمدة تظهر من المصدر الخادمي المحدود، مع بقاء صلاحية الوصول والدفع قرارًا خادميًا.</p></section>
    <section className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-2">
      <label className="relative"><Search className="pointer-events-none absolute right-3 top-3 text-gray-400" size={17}/><select aria-label="المسار" value={pathId} onChange={e=>{setPathId(e.target.value);setSubjectId('')}} className="w-full rounded-xl border bg-gray-50 py-2.5 pl-3 pr-10 font-bold"><option value="">اختر المسار</option>{taxonomy.paths.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <select aria-label="المادة" value={subjectId} disabled={!pathId} onChange={e=>setSubjectId(e.target.value)} className="rounded-xl border bg-gray-50 px-3 py-2.5 font-bold disabled:opacity-50"><option value="">اختر المادة</option>{subjects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
    </section>
    <section className="grid grid-cols-3 gap-2 rounded-2xl border bg-white p-2 shadow-sm">{tabs.map(([id,label,Icon])=><button key={id} onClick={()=>setTab(id)} className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-sm font-black ${tab===id?'bg-indigo-600 text-white':'text-gray-600 hover:bg-gray-50'}`}><Icon size={17}/>{label}</button>)}</section>
    {!pathId||!subjectId?<section className="rounded-2xl border bg-white p-10 text-center font-bold text-gray-500">اختر المسار والمادة لعرض المحتوى.</section>:busy?<section className="rounded-2xl border bg-white p-10 text-center font-black text-gray-500">جاري تحميل المحتوى...</section>:error?<section className="rounded-2xl border border-rose-100 bg-rose-50 p-5 font-bold text-rose-700">{error}</section>:space?<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tab==='courses'?space.courses.items.map(x=><article key={x.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="text-xs font-black text-indigo-600">{x.level||'دورة'}</div><h2 className="mt-2 text-lg font-black">{x.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-500">{x.description}</p><div className="mt-3 text-xs font-bold text-gray-500">{x.instructorName}{x.durationMinutes? ` · ${x.durationMinutes} دقيقة`:''}</div><Link to={`/learning/courses/${x.id}`} className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white">فتح الدورة</Link></article>):tab==='foundation'?space.foundation.items.map(x=><article key={x.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><FolderTree className="text-indigo-600" size={20}/>{x.isLocked?<span className="inline-flex items-center gap-1 text-xs font-black text-amber-700"><Lock size={13}/>مقفل</span>:null}</div><h2 className="mt-3 text-lg font-black">{x.title}</h2><p className="mt-2 text-sm leading-6 text-gray-500">{x.description}</p></article>):space.library.items.map(x=><article key={x.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><Library className="text-indigo-600" size={20}/>{x.isLocked?<Lock className="text-amber-600" size={15}/>:null}</div><h2 className="mt-3 text-lg font-black">{x.title}</h2><p className="mt-2 text-sm leading-6 text-gray-500">{x.description}</p><div className="mt-3 text-xs font-bold text-gray-400">{x.type}</div></article>)}
      {((tab==='courses'&&!space.courses.items.length)||(tab==='foundation'&&!space.foundation.items.length)||(tab==='library'&&!space.library.items.length))?<div className="col-span-full rounded-2xl border bg-white p-10 text-center font-bold text-gray-500">لا يوجد محتوى متاح حاليًا.</div>:null}
    </section>:null}
  </div></main>
}
