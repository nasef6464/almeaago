const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
export interface PreparedQuizStage {
  mode: 'saher' | 'central';
  audienceType: 'public' | 'targeted';
  dueExclusive?: string | null;
  userIds: string[];
  groupIds: string[];
}
export interface PreparedQuizGroup { id: string; name: string; groupType: string; memberCount: number }

async function request<T>(path: string, init: RequestInit = {}, allowMissing = false): Promise<T | null> {
  const response = await fetch(base + path, { ...init, credentials: 'include', headers: { Accept: 'application/json', ...init.headers } });
  if (allowMissing && response.status === 404) return null;
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string; error?: { message?: string } };
    throw new Error(body.error?.message || body.message || 'تعذر تنفيذ العملية.');
  }
  return response.json() as Promise<T>;
}
const stagePath = (id: string) => `/api/v1/assessments/${encodeURIComponent(id)}/prepared-staging`;
export const preparedQuizAdminClient = {
  get: (id: string, signal?: AbortSignal) => request<{ stage: PreparedQuizStage; active: boolean; targetUsers?: Array<{ id: string; name: string; email: string }> }>(stagePath(id), { signal }, true),
  groups: (signal?: AbortSignal) => request<{ groups: PreparedQuizGroup[] }>('/api/v1/assessments/prepared-groups', { signal }),
  createGroup: (name: string, csrf: string) => request<{ group: PreparedQuizGroup }>('/api/v1/assessments/prepared-groups', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ name, groupType: 'PRIVATE_GROUP' }) }),
  groupMembers: (groupId: string, signal?: AbortSignal) => request<{ userIds: string[]; members?: Array<{ id: string; name: string; email: string }> }>(`/api/v1/assessments/prepared-groups/${encodeURIComponent(groupId)}/members`, { signal }),
  setMember: (groupId: string, userId: string, add: boolean, csrf: string) => request<{ ok: boolean }>(`/api/v1/assessments/prepared-groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`, { method: add ? 'PUT' : 'DELETE', headers: { 'X-CSRF-Token': csrf } }),
  save: (id: string, stage: PreparedQuizStage, csrf: string) => request<{ staged: boolean; active: boolean }>(stagePath(id), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(stage) }),
  setEnabled: (id: string, enabled: boolean, csrf: string) => request<{ enabled: boolean }>(`${stagePath(id)}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ enabled }) }),
};
