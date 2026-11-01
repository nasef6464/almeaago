// Full pinned Legacy Header, not an approximation of its flex siblings.
// header-reference.mjs verifies the original blob and adapts imports only.
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {AuthProvider,useAuth} from '../../src/features/auth/state/AuthProvider';
import {StudentNavigationProvider,useStudentExperience} from '../../src/features/learning/navigation';
import {PlatformFontBootstrap} from '../../src/features/presentation/PlatformFontBootstrap';
import {Header} from './generated/Header';
import '../../src/app/styles.css';

function Reference(){
  const auth=useAuth();
  const navigation=useStudentExperience();
  const heroHeight=Math.max(1,Number(new URLSearchParams(location.search).get('heroHeight')||1000));
  return <><PlatformFontBootstrap/><Header/>
    <main data-testid="header-brand-reference-body" data-ready={!auth.loading&&!navigation.loading?'true':'false'} className="overflow-x-hidden bg-white font-tajawal text-gray-900">
      {/* Preserve the real landing paint beneath mobile header overflow. */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/70 via-white to-white pb-24 pt-12" style={{height:heroHeight}}>
        <div className="pointer-events-none absolute left-0 top-0 z-0 h-full w-full overflow-hidden">
          <div className="legacy-blob absolute right-[-5%] top-[-10%] h-96 w-96 rounded-full bg-amber-200/40 opacity-30 blur-3xl mix-blend-multiply"/>
          <div className="legacy-blob legacy-delay-2000 absolute left-[-10%] top-[20%] h-96 w-96 rounded-full bg-blue-200/40 opacity-30 blur-3xl mix-blend-multiply"/>
          <div className="legacy-blob legacy-delay-4000 absolute bottom-[-10%] right-[20%] h-96 w-96 rounded-full bg-purple-200/40 opacity-30 blur-3xl mix-blend-multiply"/>
        </div>
      </section>
    </main>
  </>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><StudentNavigationProvider><Reference/></StudentNavigationProvider></AuthProvider></BrowserRouter>);
