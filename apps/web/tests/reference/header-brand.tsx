// Brand anchor from original components/Header.tsx, blob
// c4e45e5d9bd485538036e98f70eac42471a8fa71, lines 478–504.
// Only transport and variable initialization are adapted. This certifies the
// brand anchor, not the surrounding header, navigation, or authentication UI.
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Link} from 'react-router-dom';
import {useHomepageSettings} from '../../src/features/presentation/useHomepageSettings';
import {PlatformFontBootstrap} from '../../src/features/presentation/PlatformFontBootstrap';
import '../../src/app/styles.css';
function Reference(){
  const homepageSettings=useHomepageSettings();
  const brandLogoUrl=String(homepageSettings?.brand?.logoUrl || '').trim();
  const brandLogoAlt=String(homepageSettings?.brand?.logoAlt || 'منصة المئة').trim();
  const brandLogoText=String(homepageSettings?.brand?.logoText || 'منصة').trim();
  const brandLogoAccentText=String(homepageSettings?.brand?.logoAccentText || 'المئة').trim();
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
  </div></div></div></header></>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><Reference/></BrowserRouter>);
