import { useAuth } from '../auth/state/AuthProvider';
import { PlatformFontsManager } from './PlatformFontsManager';
export function PlatformFontsPage() {
 const {user, loading} = useAuth();
 if (loading) return <p>جاري التحميل...</p>;
 if (!user?.roles.includes('admin')) return <p>لا تملك صلاحية إدارة خطوط المنصة.</p>;
 return <PlatformFontsManager />;
}
