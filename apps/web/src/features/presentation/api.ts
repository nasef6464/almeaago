import type { PlatformFontSettings } from './types';
const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
async function request(init: RequestInit = {}): Promise<PlatformFontSettings> {
 const response = await fetch(`${API_BASE}/api/v1/content/platform-font-settings`, { ...init, credentials: 'include', headers: { Accept: 'application/json', ...init.headers } });
 if (!response.ok) {
  let message = 'تعذر تحميل أو حفظ إعدادات الخطوط.';
  try { const body = await response.json() as { message?: string }; message = body.message || message; } catch { /* use readable fallback */ }
  throw new Error(message);
 }
 return response.json() as Promise<PlatformFontSettings>;
}
export const api = {
 getPlatformFontSettings: () => request(),
 updatePlatformFontSettings: (settings: PlatformFontSettings, csrf: string) => request({ method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(settings) }),
};
