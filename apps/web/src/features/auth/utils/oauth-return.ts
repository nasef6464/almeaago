// OAuth browser navigation stays within this origin. Standalone auth finishes at
// the authenticated user's existing role dashboard.
export function oauthReturnPath(value: string | null, dashboardPath: string): string {
  if (value === '/login' || value === '/signup') return dashboardPath;
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20\x7f]/.test(value)) return '/';
  return value;
}
