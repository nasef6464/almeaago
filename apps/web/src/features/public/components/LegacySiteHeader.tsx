import {Award,Bell,BookOpen,ChevronDown,Gift,LogIn,Menu,Radio,X} from 'lucide-react';
import {useHomepageSettings} from '../../presentation/useHomepageSettings';
import {useEffect,useMemo,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';

import {contentClient} from '../../content/api/content-client';
import type {TaxonomyCore} from '../../content/api/content-types';
import {useAuth} from '../../auth/state/AuthProvider';
import {dashboardPathFor} from '../../auth/utils/dashboard-path';
import {buildHeaderNavigation} from './headerNavigation';
import type {HeaderNode} from './headerNavigation';

type AuthMode='login'|'signup';

export function LegacySiteHeader({onAuth}:{onAuth(mode:AuthMode):void}){
  const{user}=useAuth();
  const homepage=useHomepageSettings();
  const brand=homepage.brand;
  const logoUrl=String(brand?.logoUrl || '').trim();
  const logoAlt=String(brand?.logoAlt || 'منصة المئة').trim();
  const logoText=String(brand?.logoText || 'منصة').trim();
  const logoAccentText=String(brand?.logoAccentText || 'المئة').trim();
  const nav=homepage.navigation;
  const location=useLocation();
  const[menuOpen,setMenuOpen]=useState(false);
  const[activeDropdown,setActiveDropdown]=useState<string|null>(null);
  const[expandedPath,setExpandedPath]=useState<string|null>(null);
  const[activeStage,setActiveStage]=useState<string|null>(null);
  const[expandedMobileStage,setExpandedMobileStage]=useState<string|null>(null);
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
    setActiveStage(null);
    setExpandedMobileStage(null);
  },[location.pathname,location.search]);

  const navigationMenu=useMemo(()=>buildHeaderNavigation(taxonomy,nav),[taxonomy,nav]);

  const renderDesktopChild=(child:HeaderNode)=>{
    if(child.kind==='divider')return <div key={child.id} className="mx-3 my-2 h-px bg-slate-100"/>;
    if(child.kind==='level')return <div key={child.id} className="mx-2 my-1" onMouseEnter={()=>{if(child.children?.length)setActiveStage(child.id)}}>
      <button type="button" onClick={()=>setActiveStage(value=>value===child.id?null:child.id)}
        className="flex w-full items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-right text-xs font-black text-indigo-950">
        <span>📂 {child.label}</span><ChevronDown size={14} className={activeStage===child.id?'rotate-180':''}/>
      </button>
      {activeStage===child.id?<div className="mr-3 border-r-2 border-indigo-300 pr-2">
        {child.children?.map(subject=><Link key={subject.id} to={subject.href} className="block rounded-lg px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700">• {subject.label}</Link>)}
        <Link to={child.href} className="block px-3 py-2 text-xs font-black text-indigo-600">استعراض كامل {child.label} ←</Link>
      </div>:null}
    </div>;
    return <Link key={child.id} to={child.href}
      className={`mx-2 flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold hover:bg-indigo-50 ${child.kind==='mock-exam'?'bg-purple-50 text-purple-800':child.kind==='package'?'bg-amber-50 text-amber-800':'text-slate-700'}`}>
      <span className="flex items-center gap-2">{child.kind==='mock-exam'?<Award size={14}/>:child.kind==='package'?<Gift size={14}/>:null}{child.label}</span>
      {child.kind==='mock-exam'?<span className="text-[10px]">محاكاة</span>:child.kind==='package'?<span className="text-[10px]">عرض</span>:null}
    </Link>;
  };

  const renderMobileChild=(child:HeaderNode)=>{
    if(child.kind==='divider')return null;
    if(child.kind==='level')return <div key={child.id} className="my-1">
      <button type="button" onClick={()=>setExpandedMobileStage(value=>value===child.id?null:child.id)} className="flex w-full items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-right text-xs font-black text-indigo-950">
        📂 {child.label}<ChevronDown size={14} className={expandedMobileStage===child.id?'rotate-180':''}/>
      </button>
      {expandedMobileStage===child.id?<div className="mr-3 border-r-2 border-indigo-300 pr-2">
        {child.children?.map(subject=><Link key={subject.id} to={subject.href} className="block px-3 py-2 text-sm text-slate-700">• {subject.label}</Link>)}
        <Link to={child.href} className="block px-3 py-2 text-xs font-black text-indigo-600">استعراض كامل {child.label} ←</Link>
      </div>:null}
    </div>;
    return <Link key={child.id} to={child.href} className={`block rounded-lg px-3 py-2 text-sm font-bold ${child.kind==='mock-exam'?'bg-purple-50 text-purple-800':child.kind==='package'?'bg-amber-50 text-amber-800':'text-slate-700'}`}>{child.label}</Link>;
  };

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
              {logoUrl?<img src={logoUrl} alt={logoAlt} className="h-9 w-9 sm:h-11 sm:w-11 rounded-full object-contain bg-white border border-amber-100 shadow-sm shrink-0"/>:null}
              <div className="flex min-w-0 flex-col justify-center leading-tight">
                <div className="flex min-w-0 items-center text-lg font-black text-amber-500 sm:text-2xl">
                  <span className="text-blue-900 dark:text-blue-400">{logoText}</span><span className="mx-1">{logoAccentText}</span>
                </div>
                <span className="mt-0.5 text-[10px] font-bold leading-none tracking-tight text-gray-400 sm:text-xs">قدرات & تحصيلي</span>
              </div>
            </Link>
          </div>

          <nav aria-label="التنقل الرئيسي" className="hidden items-center gap-1 md:flex">
            {navigationMenu.map(item=><div key={item.id} className="group relative px-2 py-2"
              onMouseEnter={()=>{setActiveDropdown(item.id);setActiveStage(null)}} onMouseLeave={()=>setActiveDropdown(null)}>
              <Link to={item.href} className="flex items-center gap-2 whitespace-nowrap text-sm font-bold text-gray-700 transition-colors hover:text-amber-500">
                {item.kind==='path'?<BookOpen size={16} className="text-gray-400"/>:null}
                {item.label}{item.children?.length?<ChevronDown size={14}/>:null}
              </Link>
              {item.children?.length&&activeDropdown===item.id?<div className="absolute right-0 top-full z-50 max-h-[75vh] w-80 overflow-y-auto rounded-2xl border border-slate-100 border-t-2 border-t-amber-500 bg-white py-2.5 shadow-2xl">
                {item.children.map(renderDesktopChild)}
              </div>:null}
            </div>)}
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
            {navigationMenu.map(item=>{
              const open=expandedPath===item.id;
              return <div key={item.id} className="mb-2 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <Link to={item.href} className="min-w-0 flex-1 px-4 py-3 text-base font-black text-gray-800">{item.label}</Link>
                  {item.children?.length?<button type="button" onClick={()=>setExpandedPath(value=>value===item.id?null:item.id)} className="ml-2 rounded-lg p-2 text-gray-500" aria-label={`تفاصيل ${item.label}`} aria-expanded={open}><ChevronDown size={18} className={open?'rotate-180':''}/></button>:null}
                </div>
                {item.children?.length&&open?<div className="space-y-1 border-t border-slate-100 px-3 py-2">{item.children.map(renderMobileChild)}</div>:null}
              </div>;
            })}
            {!user?<button type="button" onClick={()=>{setMenuOpen(false);onAuth('login')}} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-bold text-white"><LogIn size={18}/>تسجيل الدخول</button>:null}
          </div>
        </nav>
      ):null}
    </header>
  );
}
