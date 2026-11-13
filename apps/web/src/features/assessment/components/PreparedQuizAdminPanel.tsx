import { useEffect, useState } from 'react';
import { authClient } from '../../auth/api/auth-client';
import type { AdminUser } from '../../auth/api/auth-types';
import { preparedQuizAdminClient, type PreparedQuizGroup, type PreparedQuizStage } from '../api/prepared-quiz-admin-client';
import { PreparedQuizGroupManager } from './PreparedQuizGroupManager';

const blankStage = (): PreparedQuizStage => ({ mode: 'saher', audienceType: 'public', userIds: [], groupIds: [] });
function dateForInput(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(Date.parse(iso) - 1);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function deadline(date: string) {
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day + 1).toISOString();
}

export function PreparedQuizAdminPanel({ assessmentId, getCsrfToken }: { assessmentId: string; getCsrfToken: () => Promise<string> }) {
  const [stage, setStage] = useState<PreparedQuizStage>(blankStage);
  const [dueDate, setDueDate] = useState('');
  const [active, setActive] = useState(false);
  const [saved, setSaved] = useState(false);
  const [groups, setGroups] = useState<PreparedQuizGroup[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [knownUsers, setKnownUsers] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [searchedText, setSearchedText] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userPages, setUserPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [manageGroups, setManageGroups] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadFailed(false); setError('');
    Promise.all([preparedQuizAdminClient.get(assessmentId, controller.signal), preparedQuizAdminClient.groups(controller.signal)])
      .then(([result, groupResult]) => {
        const next = result?.stage || blankStage();
        setStage({ ...next, userIds: next.userIds || [], groupIds: next.groupIds || [] });
        setDueDate(dateForInput(next.dueExclusive)); setActive(Boolean(result?.active)); setSaved(Boolean(result));
        setKnownUsers(Object.fromEntries((result?.targetUsers || []).map(user => [user.id, `${user.name} — ${user.email}`])));
        setGroups(groupResult?.groups || []);
      })
      .catch(() => { if (!controller.signal.aborted) setLoadFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [assessmentId, reload]);

  async function findStudents(pageNumber = 1, term = search.trim()) {
    setBusy(true); setError('');
    try {
      const page = await authClient.adminListUsers({ role: 'student', search: term, page: pageNumber, limit: 50 });
      setUsers(page.users || []);
      setSearchedText(term); setUserPage(page.pagination.page); setUserPages(Math.max(1, page.pagination.totalPages));
      setKnownUsers(current => ({ ...current, ...Object.fromEntries((page.users || []).map(user => [user.id, user.name])) }));
    } catch { setError('تعذر البحث عن الطلاب.'); } finally { setBusy(false); }
  }
  function edit(patch: Partial<PreparedQuizStage>) { setStage(current => ({ ...current, ...patch })); setSaved(false); setMessage(''); }
  function toggle(field: 'userIds' | 'groupIds', id: string) {
    edit({ [field]: stage[field].includes(id) ? stage[field].filter(value => value !== id) : [...stage[field], id] });
  }
  async function save() {
    if (stage.audienceType === 'targeted' && !stage.userIds.length && !stage.groupIds.length) { setError('اختر طالبًا أو مجموعة واحدة على الأقل.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const payload = { ...stage, dueExclusive: deadline(dueDate) };
      await preparedQuizAdminClient.save(assessmentId, payload, await getCsrfToken());
      setStage(payload); setSaved(true); setMessage('حُفظت إعدادات الاختبار الجاهز.');
    } catch { setError('تعذر حفظ الإعدادات. تحقق من الاختيارات وحاول مرة أخرى.'); } finally { setBusy(false); }
  }
  async function toggleActive() {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await preparedQuizAdminClient.setEnabled(assessmentId, !active, await getCsrfToken());
      setActive(Boolean(result?.enabled)); setMessage(result?.enabled ? 'أتيح الاختبار للجمهور المحدد.' : 'أوقفت إتاحة الاختبار.');
    } catch { setError('تعذر تغيير الإتاحة. تأكد من اعتماد الاختبار ونشره ووجود أسئلة وموعد صالح.'); } finally { setBusy(false); }
  }
  if (loading) return <p className="text-sm text-gray-500">جارٍ تحميل إعدادات الاختبار الجاهز...</p>;
  if (loadFailed) return <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">تعذر تحميل إعدادات الاختبار الجاهز. <button type="button" onClick={() => setReload(value => value + 1)} className="font-bold underline">إعادة المحاولة</button></div>;
  return <div className="space-y-4 border-t border-gray-100 pt-5">
    <h3 className="font-bold text-gray-800">إتاحة اختبار جاهز</h3>
    <p className="text-xs text-gray-600">اختر الطلاب أو المجموعات الذين يظهر لهم الاختبار، أو أتحه لجميع الطلاب.</p>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
    <fieldset disabled={active || busy} className="space-y-4 disabled:opacity-60">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold">نوع الاختبار<select value={stage.mode} onChange={event => edit({ mode: event.target.value as PreparedQuizStage['mode'] })} className="mt-1 w-full rounded-lg border p-2"><option value="saher">ساهر</option><option value="central">مركزي</option></select></label>
        <label className="text-sm font-bold">متاح حتى (اختياري)<input type="date" value={dueDate} onChange={event => { setDueDate(event.target.value); setSaved(false); setMessage(''); }} className="mt-1 w-full rounded-lg border p-2" /></label>
      </div>
      <label className="text-sm font-bold">الجمهور<select value={stage.audienceType} onChange={event => edit({ audienceType: event.target.value as PreparedQuizStage['audienceType'], userIds: [], groupIds: [] })} className="mt-1 w-full rounded-lg border p-2"><option value="public">جميع الطلاب</option><option value="targeted">طلاب أو مجموعات محددة</option></select></label>
      {stage.audienceType === 'targeted' && <div className="space-y-3 rounded-xl bg-gray-50 p-4">
        <div className="text-sm font-bold">المجموعات</div>
        {groups.length ? <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">{groups.map(group => <label key={group.id} className="rounded-lg border bg-white px-3 py-2 text-xs"><input type="checkbox" checked={stage.groupIds.includes(group.id)} onChange={() => toggle('groupIds', group.id)} /> {group.name} ({group.memberCount})</label>)}</div> : <p className="text-xs text-gray-500">لا توجد مجموعات متاحة.</p>}
        <div className="text-sm font-bold">الطلاب</div>
        <div className="flex gap-2"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث باسم الطالب أو بريده" className="min-w-0 flex-1 rounded-lg border p-2 text-sm" /><button type="button" onClick={() => void findStudents()} className="rounded-lg bg-indigo-100 px-4 text-sm font-bold text-indigo-700">بحث</button></div>
        <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">{users.map(user => <label key={user.id} className="rounded-lg border bg-white px-3 py-2 text-xs"><input type="checkbox" checked={stage.userIds.includes(user.id)} onChange={() => toggle('userIds', user.id)} /> {user.name} — {user.email}</label>)}</div>
        {userPages > 1 && <div className="flex items-center gap-3 text-xs"><button type="button" disabled={busy || userPage <= 1} onClick={() => void findStudents(userPage - 1, searchedText)} className="font-bold text-indigo-700 disabled:opacity-40">السابق</button><span>صفحة {userPage} من {userPages}</span><button type="button" disabled={busy || userPage >= userPages} onClick={() => void findStudents(userPage + 1, searchedText)} className="font-bold text-indigo-700 disabled:opacity-40">التالي</button></div>}
        {stage.userIds.length > 0 && <div className="space-y-1">{stage.userIds.some(id => !knownUsers[id]) && <p className="text-xs text-amber-700">ابحث عن الطالب لتأكيد هويته قبل إزالة اختياره.</p>}<div className="flex flex-wrap gap-2">{stage.userIds.map((id, index) => <button type="button" key={id} disabled={!knownUsers[id]} onClick={() => toggle('userIds', id)} className="rounded-full bg-indigo-100 px-3 py-1 text-xs text-indigo-700 disabled:opacity-50">{knownUsers[id] || `طالب محدد ${index + 1}`} ×</button>)}</div></div>}
      </div>}
      <button type="button" onClick={() => void save()} className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-bold text-indigo-700">حفظ الإعدادات</button>
    </fieldset>
    <button type="button" onClick={() => setManageGroups(value => !value)} className="text-sm font-bold text-indigo-700 underline">{manageGroups ? 'إغلاق إدارة المجموعات' : 'إدارة مجموعات الاختبارات'}</button>
    {manageGroups && <PreparedQuizGroupManager groups={groups} getCsrfToken={getCsrfToken} onGroupsChanged={setGroups} />}
    <div className="flex flex-wrap items-center gap-3"><span className="text-sm font-bold">الحالة: {active ? 'متاح' : 'غير متاح'}</span><button type="button" onClick={() => void toggleActive()} disabled={busy || (!active && !saved)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{active ? 'إيقاف الإتاحة' : 'إتاحة الاختبار'}</button></div>
  </div>;
}
