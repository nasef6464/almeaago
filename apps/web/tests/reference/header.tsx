// Header component comparison only, not the original whole application shell.
// Both variants share real providers, data, fonts, body size and sticky scroll state.
import {createRoot} from 'react-dom/client';
import {useEffect,useState} from 'react';

declare global {
 interface Window {
  __setHeaderVariant?: (variant:'source'|'go')=>void;
 }
}
import {BrowserRouter} from 'react-router-dom';
import {AuthProvider,useAuth} from '../../src/features/auth/state/AuthProvider';
import {StudentNavigationProvider,StudentPathBar,useStudentExperience} from '../../src/features/learning/navigation';
import {PlatformFontBootstrap} from '../../src/features/presentation/PlatformFontBootstrap';
import {Header as Original} from './generated/Header';
import {Header as Go} from '../../src/features/public/header/OriginalHeader';
import '../../src/app/styles.css';
function Reference(){
 const auth=useAuth();const navigation=useStudentExperience();
 const [source,setSource]=useState(new URLSearchParams(location.search).get('variant')!=='go');
 useEffect(()=>{
  window.__setHeaderVariant=(variant)=>setSource(variant==='source');
  return ()=>{delete window.__setHeaderVariant};
 },[]);
 return <><PlatformFontBootstrap/>
  <div data-header-variant="source" data-visible={source?'true':'false'} style={{display:source?'contents':'none'}}><Original/></div>
  <div data-header-variant="go" data-visible={source?'false':'true'} style={{display:source?'none':'contents'}}><Go/></div>
  <StudentPathBar/>
  <main data-testid="header-reference-body" data-variant={source?'source':'go'} data-ready={!auth.loading&&!navigation.loading?'true':'false'} style={{minHeight:'200vh'}}/>
 </>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><StudentNavigationProvider><Reference/></StudentNavigationProvider></AuthProvider></BrowserRouter>);
