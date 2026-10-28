// Isolated source-component renderer under shared layout constraints. This is
// NOT the original whole application and does not certify its surrounding shell.
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {AuthProvider,useAuth} from '../../src/features/auth/state/AuthProvider';
import {AdminDashboardShell} from '../../src/features/content/components/AdminDashboardShell';
import {HomepageManager} from './generated/HomepageManager';
import '../../src/app/styles.css';
function Reference(){const {user,loading}=useAuth();return <AdminDashboardShell>{!loading&&user?.roles.includes('admin')?<HomepageManager/>:null}</AdminDashboardShell>;}
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><Reference/></AuthProvider></BrowserRouter>);
