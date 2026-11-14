import { useState } from 'react';

type Note = { id: string; text: string };

// Local notes are private to this browser, user, course and lesson. They are
// deliberately not represented as messages to the instructor.
export function CourseLessonNotes({ userId, courseId, lessonId, isDarkMode }: {
  userId: string; courseId: string; lessonId: string; isDarkMode: boolean;
}) {
  const key = `almeaa_private_lesson_notes:${JSON.stringify([userId, courseId, lessonId])}`;
  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed.filter((n): n is Note => typeof n?.id === 'string' && typeof n?.text === 'string') : [];
    } catch { return []; }
  });
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  function save() {
    const text = draft.trim();
    if (!text) return;
    const next = [{ id: crypto.randomUUID(), text }, ...notes];
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setNotes(next);
      setDraft('');
      setError('');
    } catch { setError('تعذر حفظ الملاحظة على هذا الجهاز.'); }
  }
  return (
    <div className="space-y-4">
      <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
        النقاش مع المدرب غير متاح حاليًا. يمكنك حفظ ملاحظات خاصة على هذا الجهاز؛ لا تُرسل إلى المدرب.
      </p>
      <label className="block text-xs font-bold" htmlFor="private-lesson-note">ملاحظة خاصة لهذا الدرس</label>
      <textarea id="private-lesson-note" rows={3} value={draft} onChange={event => setDraft(event.target.value)}
        className={`w-full rounded-2xl border p-3.5 text-sm ${isDarkMode ? 'border-slate-700 bg-slate-900 text-white' : 'border-gray-200 bg-gray-50 text-gray-900'}`} />
      <button type="button" disabled={!draft.trim()} onClick={save}
        className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">حفظ ملاحظة خاصة</button>
      {error && <p role="alert" className="text-xs font-bold text-rose-700">{error}</p>}
      {notes.length === 0 ? <p className="text-xs text-slate-500">لا توجد ملاحظات خاصة لهذا الدرس.</p> : (
        <ul className="space-y-2">{notes.map(note => <li key={note.id} className="whitespace-pre-wrap rounded-xl border p-3 text-sm">{note.text}</li>)}</ul>
      )}
    </div>
  );
}
