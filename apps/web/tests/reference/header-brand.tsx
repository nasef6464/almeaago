// Brand anchor from original components/Header.tsx, blob
// c4e45e5d9bd485538036e98f70eac42471a8fa71, lines 478–504.
// Only transport and variable initialization are adapted. The source brand anchor
// remains byte-for-byte presentation-equivalent; static sibling controls below mirror
// the Legacy header footprint so flex shrink is tested under the same responsive shell.
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Link} from 'react-router-dom';
import {Bell,LogIn,Moon,Search,ShoppingCart} from 'lucide-react';
import {useHomepageSettings} from '../../src/features/presentation/useHomepageSettings';
import {PlatformFontBootstrap} from '../../src/features/presentation/PlatformFontBootstrap';
import '../../src/app/styles.css';
function Reference(){
  const homepageSettings=useHomepageSettings();
  const brandLogoUrl=String(homepageSettings?.brand?.logoUrl || '').trim();
  const brandLogoAlt=String(homepageSettings?.brand?.logoAlt || 'منصة المئة').trim();
  const brandLogoText=String(homepageSettings?.brand?.logoText || 'منصة').trim();
  const brandLogoAccentText=String(homepageSettings?.brand?.logoAccentText || 'المئة').trim();
  const role=new URLSearchParams(location.search).get('role')==='guest'?'guest':'admin';
  const heroHeight=Math.max(1,Number(new URLSearchParams(location.search).get('heroHeight')||1000));
  return <><PlatformFontBootstrap/><header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm font-sans dark:bg-gray-950 dark:border-gray-800"><div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8"><div className="flex justify-between items-center h-16 sm:h-20 gap-3"><div className="flex items-center gap-2 sm:gap-4 min-w-0"><span className="md:hidden w-10 shrink-0"/>
            <Link to="/" className="flex items-center gap-2.5 min-w-0 group">
              {brandLogoUrl ? (
                <img
                  src={brandLogoUrl}
                  alt={brandLogoAlt}
                  className="h-9 w-9 sm:h-11 sm:w-11 rounded-full object-contain bg-white border border-amber-100 shadow-sm shrink-0"
                />
              ) : null}
              <div className="flex flex-col justify-center min-w-0 leading-tight">
                <div className="text-lg sm:text-2xl font-black text-amber-500 flex items-center min-w-0">
                  <span className="text-blue-900 dark:text-blue-400">{brandLogoText}</span>
                  <span className="mx-1">{brandLogoAccentText}</span>
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-400 tracking-tight leading-none mt-0.5">
                  قدرات &amp; تحصيلي
                </span>
              </div>
            </Link>
  </div>
  {role==='admin'?(
    <nav className="hidden md:flex items-center gap-1" aria-label="جارٍ تجهيز قائمة المنصة">
      <div className="flex items-center gap-3 px-3 py-2">
        {Array.from({length:4}).map((_,index)=>(
          <span key={index} className={`h-4 animate-pulse rounded-full bg-gray-100 ${index===0?'w-16':index===1?'w-24':'w-20'}`}/>
        ))}
      </div>
    </nav>
  ):null}
  <div className="flex items-center gap-2 sm:gap-3 shrink-0" aria-hidden="true">
    <button type="button" tabIndex={-1} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600"><Moon size={18}/></button>
    <span className="text-gray-500"><Search size={20}/></span>
    <span className="relative text-gray-500"><ShoppingCart size={20}/><span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">0</span></span>
    {role==='admin'?(
      <div className="flex items-center gap-1 sm:gap-2 bg-slate-50 pl-1 pr-1 sm:pr-3 py-1 rounded-full border border-slate-200/80 shadow-xs">
        <span className="relative flex items-center justify-center w-10 h-10 rounded-full"><Bell size={22} className="text-gray-500"/></span>
        <span className="hidden sm:block h-5 w-px bg-slate-200"/>
        <span className="flex items-center gap-2">
          <span className="hidden lg:block text-right"><span className="block text-[10px] text-gray-400 font-medium leading-none">حسابي</span><span className="block max-w-[200px] truncate text-xs font-black leading-tight text-gray-800">مدير المنصة</span></span>
          <span className="block w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-white bg-slate-200 shadow-sm shrink-0"/>
        </span>
      </div>
    ):(
      <span className="flex items-center gap-2 bg-emerald-500 text-white px-3 sm:px-4 py-2 rounded-lg font-bold"><LogIn size={18}/><span className="hidden sm:inline">تسجيل الدخول</span></span>
    )}
  </div>
  </div></div></header><main className="overflow-x-hidden bg-white font-tajawal text-gray-900">
    {/* The original anchor extends just below the sticky header at 390px.
        Reproduce the real landing hero paint underneath at the same measured
        source-compatible section height so flex overflow sees identical paint. */}
    <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/70 via-white to-white pb-24 pt-12" style={{height:heroHeight}}>
      <div className="pointer-events-none absolute left-0 top-0 z-0 h-full w-full overflow-hidden">
        <div className="legacy-blob absolute right-[-5%] top-[-10%] h-96 w-96 rounded-full bg-amber-200/40 opacity-30 blur-3xl mix-blend-multiply"/>
        <div className="legacy-blob legacy-delay-2000 absolute left-[-10%] top-[20%] h-96 w-96 rounded-full bg-blue-200/40 opacity-30 blur-3xl mix-blend-multiply"/>
        <div className="legacy-blob legacy-delay-4000 absolute bottom-[-10%] right-[20%] h-96 w-96 rounded-full bg-purple-200/40 opacity-30 blur-3xl mix-blend-multiply"/>
      </div>
    </section>
  </main></>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><Reference/></BrowserRouter>);
