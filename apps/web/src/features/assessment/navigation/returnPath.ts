export function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return '';
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded)) return '';
    const parsed = new URL(value, window.location.origin);
    return parsed.origin === window.location.origin ? parsed.pathname + parsed.search + parsed.hash : '';
  } catch { return ''; }
}

export function returnPathLabel(path: string): string {
  if (path.startsWith('/learning/courses/')) return 'العودة إلى الدرس';
  if (path.startsWith('/course/')) return 'العودة إلى الدورة';
  return 'العودة لموضوع التأسيس';
}
