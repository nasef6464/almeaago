import type {HomepageSettings} from './homepage-types';
import type { PlatformFontSettings } from './types';
const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
async function request<T = PlatformFontSettings>(init: RequestInit = {}, path = 'platform-font-settings'): Promise<T> {
 const response = await fetch(`${API_BASE}/api/v1/content/${path}`, { ...init, credentials: 'include', headers: { Accept: 'application/json', ...init.headers } });
 if (!response.ok) {
  let message = 'تعذر تحميل أو حفظ إعدادات الخطوط.';
  try { const body = await response.json() as { message?: string }; message = body.message || message; } catch { /* use readable fallback */ }
  throw new Error(message);
 }
 return response.json() as Promise<T>;
}
export const api = {
 getPlatformFontSettings: () => request(),
 getHomepageSettings: () => request<HomepageSettings>({}, 'homepage-settings'),
 updateHomepageSettings: (settings: HomepageSettings, csrf: string) => request<HomepageSettings>({method:'PATCH', headers:{'Content-Type':'application/json','X-CSRF-Token':csrf}, body:JSON.stringify(settings)}, 'homepage-settings'),
 updatePlatformFontSettings: (settings: PlatformFontSettings, csrf: string) => request({ method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(settings) }),
};
