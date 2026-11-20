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
  if ((path.startsWith('/category/') || path.startsWith('/learning?')) && !new URL(path, window.location.origin).searchParams.has('topic')) return 'العودة إلى ساحة التعلم';
  return 'العودة لموضوع التأسيس';
}
