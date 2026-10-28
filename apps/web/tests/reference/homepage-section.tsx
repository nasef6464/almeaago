// Component-only source/target renderer; no production route or DOM hiding.
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {AuthProvider,useAuth} from '../../src/features/auth/state/AuthProvider';
import {AdminDashboardShell} from '../../src/features/content/components/AdminDashboardShell';
import {HomepageManager as SourceBrand} from './generated/Homepage-source-brand';
import {HomepageManager as SourceHero} from './generated/Homepage-source-hero';
import {HomepageManager as GoBrand} from './generated/Homepage-go-brand';
import {HomepageManager as GoHero} from './generated/Homepage-go-hero';
import '../../src/app/styles.css';
const query=new URLSearchParams(location.search);
const Component=query.get('variant')==='source'?(query.get('section')==='brand'?SourceBrand:SourceHero):(query.get('section')==='brand'?GoBrand:GoHero);
function Reference(){const {user,loading}=useAuth();return <AdminDashboardShell>{!loading&&user?.roles.includes('admin')?<Component/>:null}</AdminDashboardShell>;}
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><Reference/></AuthProvider></BrowserRouter>);
