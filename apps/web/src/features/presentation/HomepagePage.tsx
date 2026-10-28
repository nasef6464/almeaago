import {useAuth} from '../auth/state/AuthProvider';
import {HomepageManager} from './HomepageManager';
export function HomepagePage(){const {user,loading}=useAuth();if(loading)return <p>جاري التحميل...</p>;if(!user?.roles.includes('admin'))return <p>لا تملك صلاحية إدارة الصفحة الرئيسية.</p>;return <HomepageManager/>;}
