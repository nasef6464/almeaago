const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export type LessonDiscussionItem = { id: string; parentId: string; authorId: string; authorName: string; body: string; createdAt: string };
export type LessonDiscussionPage = { items: LessonDiscussionItem[]; page: number; hasMore: boolean };
export class LessonDiscussionError extends Error { constructor(message: string, public readonly status: number) { super(message); } }

function url(courseId: string, lessonId: string) {
  return `${API_BASE}/api/v1/learning-spaces/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/discussion`;
}

async function read<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = '';
    try { const data: unknown = await response.json(); if (data && typeof data === 'object') { const obj = data as { message?: unknown; error?: { message?: unknown } }; const candidate = obj.error?.message || obj.message; if (typeof candidate === 'string') message = candidate; } } catch { /* use fallback */ }
    throw new LessonDiscussionError(message || 'تعذر تحميل أو حفظ المناقشة.', response.status);
  }
  return response.json() as Promise<T>;
}

export const lessonDiscussionClient = {
  list(courseId: string, lessonId: string, page: number, signal?: AbortSignal) {
    return fetch(`${url(courseId, lessonId)}?page=${page}&limit=30`, { credentials: 'include', cache: 'no-store', signal }).then(read<LessonDiscussionPage>);
  },
  create(courseId: string, lessonId: string, body: string, parentId: string, requestId: string, csrf: string, signal?: AbortSignal) {
    return fetch(url(courseId, lessonId), { method: 'POST', credentials: 'include', signal, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ body, requestId, ...(parentId ? { parentId } : {}) }) }).then(read<{ item: LessonDiscussionItem }>);
  },
};
