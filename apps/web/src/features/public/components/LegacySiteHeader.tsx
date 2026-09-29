import {Bell,BookOpen,ChevronDown,LogIn,Menu,Radio,X} from 'lucide-react';
import {useEffect,useMemo,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';

import {contentClient} from '../../content/api/content-client';
import type {TaxonomyCore} from '../../content/api/content-types';
import {useAuth} from '../../auth/state/AuthProvider';
import {dashboardPathFor} from '../../auth/utils/dashboard-path';

type AuthMode='login'|'signup';

export function LegacySiteHeader({onAuth}:{onAuth(mode:AuthMode):void}){
  const{user}=useAuth();
  const location=useLocation();
  const[menuOpen,setMenuOpen]=useState(false);
  const[activeDropdown,setActiveDropdown]=useState<string|null>(null);
  const[expandedPath,setExpandedPath]=useState<string|null>(null);
  const[taxonomy,setTaxonomy]=useState<TaxonomyCore>({paths:[],subjects:[]});
  const dashboardHref=user?dashboardPathFor(user):'';

  useEffect(()=>{
    const controller=new AbortController();
    contentClient.taxonomyCore(controller.signal).then(setTaxonomy).catch(()=>{});
    return()=>controller.abort();
  },[]);

  useEffect(()=>{
    setMenuOpen(false);
    setActiveDropdown(null);
    setExpandedPath(null);
  },[location.pathname,location.search]);

  const paths=useMemo(
    ()=>[...taxonomy.paths].sort((a,b)=>a.sortOrder-b.sortOrder).slice(0,4),
    [taxonomy.paths],
  );

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white shadow-sm font-sans">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3 sm:h-20">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <button
              type="button"
              className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 md:hidden"
              onClick={()=>setMenuOpen(value=>!value)}
              aria-label={menuOpen?'إغلاق القائمة':'فتح القائمة'}
              aria-expanded={menuOpen}
            >
              {menuOpen?<X size={24}/>:<Menu size={24}/>}
            </button>

            <Link to="/" className="group flex min-w-0 items-center gap-2.5">
              <div className="flex min-w-0 flex-col justify-center leading-tight">
                <div className="flex min-w-0 items-center text-lg font-black text-amber-500 sm:text-2xl">
                  <span className="text-blue-900">منصة</span><span className="mx-1">المئة</span>
                </div>
                <span className="mt-0.5 text-[10px] font-bold leading-none tracking-tight text-gray-400 sm:text-xs">قدرات & تحصيلي</span>
              </div>
            </Link>
          </div>

          <nav aria-label="التنقل الرئيسي" className="hidden items-center gap-1 md:flex">
            <div className="relative px-3 py-2">
              <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-700 transition-colors hover:text-amber-500">الرئيسية</Link>
            </div>

            {paths.map(path=>{
              const subjects=taxonomy.subjects.filter(subject=>subject.pathId===path.id).slice(0,8);
              return (
                <div
                  key={path.id}
                  className="group relative px-3 py-2"
                  onMouseEnter={()=>setActiveDropdown(path.id)}
                  onMouseLeave={()=>setActiveDropdown(null)}
                >
                  <Link to={`/learning?pathId=${encodeURIComponent(path.id)}`} className="flex items-center gap-2 text-sm font-bold text-gray-700 transition-colors hover:text-amber-500">
                    <BookOpen size={16} className="text-gray-400 transition-colors group-hover:text-amber-500"/>
                    {path.name}
                    {subjects.length?<ChevronDown size={14}/>:null}
                  </Link>
                  {subjects.length&&activeDropdown===path.id?(
                    <div className="absolute right-0 top-full z-50 w-72 rounded-2xl border border-slate-100 border-t-2 border-t-amber-500 bg-white py-2.5 shadow-2xl animate-fade-in">
                      {subjects.map(subject=>(
                        <Link
                          key={subject.id}
                          to={`/learning?pathId=${encodeURIComponent(path.id)}&subjectId=${encodeURIComponent(subject.id)}`}
                          className="mx-2 block rounded-lg px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          {subject.name}
                        </Link>
                      ))}
                      <div className="mx-3 my-1.5 h-px bg-slate-100"/>
                      <Link to={`/learning?pathId=${encodeURIComponent(path.id)}`} className="mx-2 block rounded-lg px-3 py-2 text-xs font-black text-indigo-600 hover:bg-indigo-50">
                        استعراض كامل {path.name} ←
                      </Link>
                    </div>
                  ):null}
                </div>
              );
            })}

            <div className="relative px-3 py-2"><Link to="/assessments" className="flex items-center gap-2 text-sm font-bold text-gray-700 transition-colors hover:text-amber-500">اختبارات</Link></div>
            <div className="relative px-3 py-2"><Link to="/about" className="flex items-center gap-2 text-sm font-bold text-gray-700 transition-colors hover:text-amber-500">عن المنصة</Link></div>
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {user?(
              <>
                <Link to={dashboardHref} className="hidden rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white sm:inline-flex">لوحتي</Link>
                <Link to={user.roles.includes('teacher')?'/school-teacher-dashboard':'/classroom/join'} aria-label="الفصل الذكي" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition hover:bg-gray-50"><Radio size={18}/></Link>
                <Link to="/notifications" aria-label="الإشعارات" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition hover:bg-gray-50"><Bell size={18}/></Link>
                <div className="hidden max-w-32 truncate text-sm font-bold text-gray-700 xl:block">{user.name}</div>
              </>
            ):(
              <button type="button" onClick={()=>onAuth('login')} className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-600 sm:px-4">
                <LogIn size={18}/><span className="hidden sm:inline">تسجيل الدخول</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {menuOpen?(
        <nav aria-label="التنقل الرئيسي للجوال" className="fixed inset-0 top-16 z-40 overflow-y-auto bg-white pb-20 animate-fade-in sm:top-20 md:hidden">
          <div className="mx-auto max-w-7xl p-4">
            {user?<Link to={dashboardHref} className="mb-4 block rounded-xl bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700">لوحتي</Link>:null}
            <Link to="/" className="mb-2 block rounded-xl px-4 py-3 text-base font-black text-gray-800 hover:bg-gray-50">الرئيسية</Link>
            {paths.map(path=>{
              const subjects=taxonomy.subjects.filter(subject=>subject.pathId===path.id).slice(0,10);
              const open=expandedPath===path.id;
              return (
                <div key={path.id} className="mb-2 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Link to={`/learning?pathId=${encodeURIComponent(path.id)}`} className="min-w-0 flex-1 px-4 py-3 text-base font-black text-gray-800">{path.name}</Link>
                    {subjects.length?<button type="button" onClick={()=>setExpandedPath(value=>value===path.id?null:path.id)} className="ml-2 rounded-lg p-2 text-gray-500" aria-label={`مواد ${path.name}`}><ChevronDown size={18} className={open?'rotate-180 transition-transform':'transition-transform'}/></button>:null}
                  </div>
                  {open?(
                    <div className="border-t border-slate-100 px-3 py-2">
                      {subjects.map(subject=><Link key={subject.id} to={`/learning?pathId=${encodeURIComponent(path.id)}&subjectId=${encodeURIComponent(subject.id)}`} className="block rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">• {subject.name}</Link>)}
                    </div>
                  ):null}
                </div>
              );
            })}
            <Link to="/assessments" className="mb-2 block rounded-xl px-4 py-3 text-base font-black text-gray-800 hover:bg-gray-50">اختبارات</Link>
            <Link to="/about" className="mb-2 block rounded-xl px-4 py-3 text-base font-black text-gray-800 hover:bg-gray-50">عن المنصة</Link>
            <Link to="/faq" className="mb-2 block rounded-xl px-4 py-3 text-base font-black text-gray-800 hover:bg-gray-50">الأسئلة الشائعة</Link>
            {!user?<button type="button" onClick={()=>{setMenuOpen(false);onAuth('login')}} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-bold text-white"><LogIn size={18}/>تسجيل الدخول</button>:null}
          </div>
        </nav>
      ):null}
    </header>
  );
}
