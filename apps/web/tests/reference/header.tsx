// Header component comparison only, not the original whole application shell.
// Both variants share real providers, data, fonts, body size and sticky scroll state.
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {AuthProvider,useAuth} from '../../src/features/auth/state/AuthProvider';
import {StudentNavigationProvider,StudentPathBar,useStudentExperience} from '../../src/features/learning/navigation';
import {PlatformFontBootstrap} from '../../src/features/presentation/PlatformFontBootstrap';
import {Header as Original} from './generated/Header';
import {Header as Go} from '../../src/features/public/header/OriginalHeader';
import '../../src/app/styles.css';
function Reference(){
 const auth=useAuth();const navigation=useStudentExperience();
 const source=new URLSearchParams(location.search).get('variant')!=='go';
 return <><PlatformFontBootstrap/>{source?<Original/>:<Go/>}<StudentPathBar/>
 <main data-testid="header-reference-body" data-ready={!auth.loading&&!navigation.loading?'true':'false'} style={{minHeight:'200vh'}}/>
 </>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><StudentNavigationProvider><Reference/></StudentNavigationProvider></AuthProvider></BrowserRouter>);
