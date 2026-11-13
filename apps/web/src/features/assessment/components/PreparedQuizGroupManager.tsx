import { useEffect, useState } from 'react';
import { authClient } from '../../auth/api/auth-client';
import type { AdminUser } from '../../auth/api/auth-types';
import { preparedQuizAdminClient, type PreparedQuizGroup } from '../api/prepared-quiz-admin-client';

interface Props {
  groups: PreparedQuizGroup[];
  getCsrfToken: () => Promise<string>;
  onGroupsChanged: (groups: PreparedQuizGroup[]) => void;
}
export function PreparedQuizGroupManager({ groups, getCsrfToken, onGroupsChanged }: Props) {
  const [groupId, setGroupId] = useState('');
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [searchedText, setSearchedText] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userPages, setUserPages] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersFailed, setMembersFailed] = useState(false);
  const [reloadMembers, setReloadMembers] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMembers([]); setMemberNames({});
    if (!groupId) return;
    const controller = new AbortController();
    setLoadingMembers(true); setMembersFailed(false); setError('');
    preparedQuizAdminClient.groupMembers(groupId, controller.signal).then(result => {
      setMembers(result?.userIds || []);
      setMemberNames(Object.fromEntries((result?.members || []).map(member => [member.id, `${member.name} — ${member.email}`])));
    }).catch(() => { if (!controller.signal.aborted) { setMembersFailed(true); setError('تعذر تحميل أعضاء المجموعة.'); } })
      .finally(() => { if (!controller.signal.aborted) setLoadingMembers(false); });
    return () => controller.abort();
  }, [groupId, reloadMembers]);
  async function create() {
    if (!name.trim()) { setError('اكتب اسم المجموعة.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await preparedQuizAdminClient.createGroup(name.trim(), await getCsrfToken());
      if (!result?.group) throw new Error('missing group');
      onGroupsChanged([...groups, result.group]); setGroupId(result.group.id); setName(''); setMessage('أُنشئت المجموعة.');
    } catch { setError('تعذر إنشاء المجموعة.'); } finally { setBusy(false); }
  }
  async function find(pageNumber = 1, term = search.trim()) {
    setBusy(true); setError('');
    try {
      const result = await authClient.adminListUsers({ role: 'student', search: term, page: pageNumber, limit: 50 });
      setUsers(result.users || []);
      setSearchedText(term); setUserPage(result.pagination.page); setUserPages(Math.max(1, result.pagination.totalPages));
      setMemberNames(current => ({ ...current, ...Object.fromEntries((result.users || []).map(user => [user.id, `${user.name} — ${user.email}`])) }));
    } catch { setError('تعذر البحث عن الطلاب.'); } finally { setBusy(false); }
  }
  async function changeMember(id: string, add: boolean) {
    if (!groupId || busy || loadingMembers || membersFailed) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await preparedQuizAdminClient.setMember(groupId, id, add, await getCsrfToken());
      setMembers(current => add ? [...new Set([...current, id])] : current.filter(item => item !== id));
      const latest = await preparedQuizAdminClient.groups().catch(() => null);
      if (latest) onGroupsChanged(latest.groups || []);
      setMessage(add ? 'أُضيف الطالب للمجموعة.' : 'أُزيل الطالب من المجموعة.');
    } catch { setError('تعذر تحديث أعضاء المجموعة.'); } finally { setBusy(false); }
  }
  return <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
    <h4 className="text-sm font-bold">إدارة مجموعات الاختبارات</h4>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    <div className="flex gap-2"><input aria-label="اسم المجموعة الجديدة" value={name} onChange={event => setName(event.target.value)} className="min-w-0 flex-1 rounded-lg border p-2 text-sm" placeholder="اسم مجموعة جديدة" /><button type="button" disabled={busy} onClick={() => void create()} className="rounded-lg bg-indigo-600 px-4 text-sm text-white disabled:opacity-50">إنشاء</button></div>
    <label className="block text-sm font-bold">المجموعة<select value={groupId} onChange={event => setGroupId(event.target.value)} disabled={busy} className="mt-1 w-full rounded-lg border p-2"><option value="">اختر مجموعة</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
    {groupId && <div className="space-y-3">
      {loadingMembers ? <p className="text-xs text-gray-600">جارٍ تحميل الأعضاء...</p> : membersFailed ? <button type="button" onClick={() => setReloadMembers(value => value + 1)} className="text-xs font-bold text-indigo-700 underline">إعادة تحميل الأعضاء</button> : <div><p className="text-xs font-bold">الأعضاء ({members.length})</p>{members.some(id => !memberNames[id]) && <p className="mt-1 text-xs text-amber-700">تعذر عرض بيانات بعض الأعضاء؛ ابحث عن الطالب للتأكد من هويته قبل إزالته.</p>}<div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">{members.map((id, index) => <button type="button" key={id} disabled={busy || !memberNames[id]} onClick={() => void changeMember(id, false)} className="rounded-full bg-white px-3 py-1 text-xs text-red-700 disabled:opacity-50">{memberNames[id] || `عضو ${index + 1}`} ×</button>)}</div></div>}
      <div className="flex gap-2"><input aria-label="البحث عن طالب للمجموعة" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 rounded-lg border p-2 text-sm" placeholder="ابحث عن طالب" /><button type="button" disabled={busy || loadingMembers || membersFailed} onClick={() => void find()} className="rounded-lg bg-white px-4 text-sm font-bold text-indigo-700">بحث</button></div>
      <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">{users.map(user => <button type="button" key={user.id} disabled={busy || loadingMembers || membersFailed || members.includes(user.id)} onClick={() => void changeMember(user.id, true)} className="rounded-lg border bg-white px-3 py-2 text-xs disabled:opacity-50">{user.name} — {user.email} {members.includes(user.id) ? '✓' : '+'}</button>)}</div>
      {userPages > 1 && <div className="flex items-center gap-3 text-xs"><button type="button" disabled={busy || userPage <= 1} onClick={() => void find(userPage - 1, searchedText)} className="font-bold text-indigo-700 disabled:opacity-40">السابق</button><span>صفحة {userPage} من {userPages}</span><button type="button" disabled={busy || userPage >= userPages} onClick={() => void find(userPage + 1, searchedText)} className="font-bold text-indigo-700 disabled:opacity-40">التالي</button></div>}
    </div>}
  </div>;
}
