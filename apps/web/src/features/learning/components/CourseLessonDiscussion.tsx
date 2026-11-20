import { useEffect, useRef, useState } from 'react';
import { lessonDiscussionClient, LessonDiscussionError, type LessonDiscussionItem } from '../api/lesson-discussion-client';

export function CourseLessonDiscussion({ courseId, lessonId, isDarkMode, getCsrfToken }: { courseId: string; lessonId: string; isDarkMode: boolean; getCsrfToken: () => Promise<string> }) {
  const [items, setItems] = useState<LessonDiscussionItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<LessonDiscussionItem | null>(null);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(false);
  const writing = useRef(false);
  const request = useRef<AbortController | null>(null);
  const writeRequest = useRef<AbortController | null>(null);
  const pendingMessage = useRef<{ fingerprint: string; requestId: string } | null>(null);

  async function load(nextPage = 1) {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError('');
    try {
      const result = await lessonDiscussionClient.list(courseId, lessonId, nextPage, controller.signal);
      if (controller.signal.aborted || !mounted.current) return;
      if (result.page !== nextPage || !Array.isArray(result.items) || typeof result.hasMore !== 'boolean') throw new Error('تعذر التحقق من المناقشات.');
      setItems(previous => nextPage === 1 ? result.items : [...previous, ...result.items.filter(item => !previous.some(old => old.id === item.id))]);
      setPage(nextPage); setHasMore(result.hasMore);
    } catch (reason) { if (!controller.signal.aborted && mounted.current) { setItems([]); setHasMore(false); setError(reason instanceof Error ? reason.message : 'تعذر تحميل المناقشات.'); } }
    finally { if (!controller.signal.aborted && mounted.current) setLoading(false); }
  }
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; request.current?.abort(); writeRequest.current?.abort(); }; }, [courseId, lessonId]);

  async function submit() {
    const body = draft.trim();
    if (!body || writing.current || loading) return;
    writing.current = true; setSaving(true); setError('');
    const controller = new AbortController(); writeRequest.current = controller;
    try {
      const fingerprint = JSON.stringify([body, replyTo?.id || '']);
      if (pendingMessage.current?.fingerprint !== fingerprint) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        pendingMessage.current = { fingerprint, requestId: Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('') };
      }
      const csrf = await getCsrfToken();
      if (controller.signal.aborted || !mounted.current) return;
      const result = await lessonDiscussionClient.create(courseId, lessonId, body, replyTo?.id || '', pendingMessage.current.requestId, csrf, controller.signal);
      if (controller.signal.aborted || !mounted.current) return;
      if (!result.item || typeof result.item.id !== 'string') throw new Error('تعذر التحقق من استجابة الإرسال؛ أعد المحاولة.');
      setItems(previous => [...previous.filter(item => item.id !== result.item.id), result.item]);
      pendingMessage.current = null; setDraft(''); setReplyTo(null);
    } catch (reason) { if (!controller.signal.aborted && mounted.current) { if (reason instanceof LessonDiscussionError && [401,403,404].includes(reason.status)) { setItems([]); setHasMore(false); } setError(reason instanceof Error ? reason.message : 'تعذر إرسال المناقشة.'); } }
    finally { writing.current = false; if (mounted.current) setSaving(false); }
  }
  return <section aria-label="مناقشات الدرس" className={`space-y-4 border-t pt-5 ${isDarkMode ? 'border-slate-700 text-slate-100' : 'border-gray-200 text-gray-900'}`}>
    <h3 className="text-sm font-black">مناقشات الدرس</h3>
    <p className="text-xs text-slate-500">تظهر المشاركات للمصرح لهم بمناقشة هذا الدرس.</p>
    {replyTo && <p className="text-xs font-bold">رد على: {replyTo.authorName} <button type="button" disabled={saving} onClick={() => setReplyTo(null)} className="text-indigo-600 disabled:opacity-50">إلغاء الرد</button></p>}
    <label className="block text-xs font-bold" htmlFor="lesson-discussion-text">اكتب سؤالك أو مناقشتك</label>
    <textarea id="lesson-discussion-text" rows={3} maxLength={2000} disabled={saving} value={draft} onChange={event => setDraft(event.target.value)} className={`w-full rounded-2xl border p-3 text-sm ${isDarkMode ? 'border-slate-700 bg-slate-900 text-white' : 'border-gray-200 bg-gray-50 text-gray-900'}`} />
    <button type="button" disabled={saving || loading || !draft.trim()} onClick={() => void submit()} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">{saving ? 'جارٍ الإرسال...' : 'إرسال'}</button>
    {error && <div role="alert" className="text-xs font-bold text-rose-700">{error} <button type="button" onClick={() => void load(page)} className="underline">إعادة تحميل المناقشات</button></div>}
    {loading ? <p className="text-xs text-slate-500">جارٍ تحميل المناقشات...</p> : items.length === 0 && !error ? <p className="text-xs text-slate-500">لا توجد مناقشات لهذا الدرس بعد.</p> : null}
    <ul className="space-y-2">{items.map(item => {
      const parent = item.parentId ? items.find(candidate => candidate.id === item.parentId) : null;
      return <li key={item.id} className={`rounded-xl border p-3 text-sm ${item.parentId ? 'mr-5' : ''}`}>
        {item.parentId && <p className="mb-2 text-xs text-slate-500">رد على: {parent ? parent.body.slice(0, 80) : 'مناقشة سابقة غير معروضة في هذه الصفحة'}</p>}
        <p className="text-xs font-bold">{item.authorName}</p><p className="mt-2 whitespace-pre-wrap break-words">{item.body}</p>
        {!item.parentId && <button type="button" disabled={saving} onClick={() => setReplyTo(item)} className="mt-2 text-xs font-bold text-indigo-600 disabled:opacity-50">رد</button>}
      </li>;
    })}</ul>
    {hasMore && !loading && <button type="button" onClick={() => void load(page + 1)} className="text-xs font-bold text-indigo-600">عرض المزيد</button>}
  </section>;
}
