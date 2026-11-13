import { useEffect, useState } from 'react';
import type { TaxonomySkillSection } from '../../content/api/content-types';
import { questionBankClient } from '../api/questionbank-client';

export function QuestionSectionEditor({ questionId, subjectId, sections, getCsrfToken }: { questionId: string; subjectId: string; sections: TaxonomySkillSection[]; getCsrfToken: () => Promise<string> }) {
  const [section, setSection] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const available = sections.filter(item => item.subjectId === subjectId);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadFailed(false); setError(''); setMessage('');
    questionBankClient.section(questionId, controller.signal).then(data => { setSection(data.sectionId || ''); setSaved(data.sectionId || ''); })
      .catch(() => { if (!controller.signal.aborted) { setLoadFailed(true); setError('تعذر تحميل قسم السؤال.'); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [questionId, reload]);
  async function save() {
    setBusy(true); setError(''); setMessage('');
    try { const result = await questionBankClient.setSection(questionId, section, await getCsrfToken()); setSaved(result.sectionId || ''); setMessage('حُفظ قسم السؤال.'); }
    catch { setError('تعذر حفظ القسم. تأكد من اختيار قسم نشط في مادة السؤال.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
    <label className="block text-sm font-bold">قسم السؤال<select value={section} onChange={event => { setSection(event.target.value); setMessage(''); }} disabled={loading || busy || loadFailed} className="mt-2 w-full rounded-lg border bg-white p-2 text-sm"><option value="">بدون قسم</option>{section && !available.some(item => item.id === section) && <option value={section} disabled>القسم الحالي غير متاح</option>}{available.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <p className="text-xs text-slate-600">يستخدم القسم لتحديد أسئلة الاختبار الذاتي، وهو مستقل عن مهارات السؤال.</p>
    {error && <p role="alert" className="text-xs text-red-700">{error} {loadFailed && <button type="button" onClick={() => setReload(value => value + 1)} className="underline">إعادة التحميل</button>}</p>}
    {message && <p role="status" className="text-xs text-emerald-700">{message}</p>}
    <button type="button" onClick={() => void save()} disabled={loading || busy || loadFailed || section === saved} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">حفظ قسم السؤال</button>
  </div>;
}
