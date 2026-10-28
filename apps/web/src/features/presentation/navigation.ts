export const PLATFORM_FONTS_ADMIN_HREF = '/admin-dashboard#/admin-dashboard?tab=platform-fonts';

// Legacy AdminDashboard reads the hash query before the outer query. Preserve
// that contract and keep the existing direct Go route as a compatible alias.
export function isPlatformFontsLocation(location: {pathname: string; search: string; hash: string}): boolean {
 const path=location.pathname.replace(/\/+$/, '');
 if(path==='/admin-dashboard/platform-fonts') return true;
 if(path!=='/admin-dashboard') return false;
 const hashQuery=location.hash.includes('?')?location.hash.split('?')[1]:'';
 return new URLSearchParams(hashQuery || location.search).get('tab')==='platform-fonts';
}
