import type { notificationClient } from '../../../notifications/api/notification-client';
import type { NotificationDelivery } from '../../../notifications/api/notification-types';

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  readAt?: number;
  createdAt: string;
}
export interface NotificationSnapshot {
  notifications: InAppNotification[];
  unreadCount: number | null;
  loading: boolean;
  isConnected: boolean;
  error: string;
  saving: boolean;
}
export const emptyNotificationSnapshot = (): NotificationSnapshot => ({
  notifications: [], unreadCount: null, loading: false, isConnected: false, error: '', saving: false,
});
const mapDelivery = (row: NotificationDelivery): InAppNotification => ({
  id: row.id, title: row.title, body: row.body, createdAt: row.createdAt,
  readAt: row.readAt ? Date.parse(row.readAt) : undefined,
});
const validCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** One authenticated lifetime. Go SSE sends invalidation metadata, not delivery bodies. */
export function createNotificationSession({ client, getCsrfToken, createEventSource }: {
  client: Pick<typeof notificationClient, 'inbox' | 'unread' | 'markRead' | 'markAllRead' | 'streamURL'>;
  getCsrfToken: () => Promise<string>;
  createEventSource?: (url: string, options: EventSourceInit) => EventSource;
}) {
  let state = emptyNotificationSnapshot();
  let disposed = false;
  let version = 0;
  let countVersion = 0;
  let request: AbortController | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<NotificationSnapshot>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  };
  const failure = (error: unknown) => update({ error: error instanceof Error ? error.message : 'تعذر تحديث الإشعارات' });
  async function refresh() {
    if (disposed) return;
    const current = ++version;
    const currentCount = ++countVersion;
    request?.abort();
    const controller = new AbortController();
    request = controller;
    update({ loading: true, error: '' });
    // Keep independent endpoint failures visible without discarding successful data.
    const [inbox, unread] = await Promise.allSettled([
      client.inbox(1, 20, controller.signal), client.unread(controller.signal),
    ]);
    if (disposed || current !== version) return;
    if (inbox.status === 'fulfilled') update({ notifications: inbox.value.items.map(mapDelivery) });
    else failure(inbox.reason);
    if (unread.status === 'fulfilled') {
      if (currentCount === countVersion && validCount(unread.value.unreadCount)) update({ unreadCount: unread.value.unreadCount });
    } else failure(unread.reason);
    update({ loading: false });
  }
  async function refreshCount() {
    const current = ++countVersion;
    try {
      const response = await client.unread();
      if (current === countVersion && validCount(response.unreadCount)) update({ unreadCount: response.unreadCount });
    } catch (error) { if (current === countVersion) failure(error); }
  }
  async function save(id?: string) {
    if (disposed || state.saving || (id && !state.notifications.some(row => row.id === id && !row.readAt))) return;
    update({ saving: true, error: '' });
    // A GET begun before this write must never overwrite the saved result.
    ++version;
    request?.abort();
    update({ loading: false });
    try {
      const csrf = await getCsrfToken();
      if (disposed) return;
      if (id) {
        const { notification } = await client.markRead(id, csrf);
        if (disposed) return;
        ++version;
        request?.abort();
        update({ notifications: state.notifications.map(row => row.id === id ? mapDelivery(notification) : row), loading: false });
        await refreshCount();
      } else {
        await client.markAllRead(csrf);
        if (disposed) return;
        // Do not mark newly arrived deliveries read merely because read-all succeeded.
        await refresh();
      }
    } catch (error) { failure(error); }
    finally { update({ saving: false }); }
  }
  const stream = createEventSource?.(client.streamURL(), { withCredentials: true });
  const connected = () => { update({ isConnected: true }); void refresh(); };
  const notification = () => { void refresh(); };
  const unreadCount = (event: Event) => {
    if (disposed) return;
    try {
      const data: unknown = JSON.parse((event as MessageEvent).data);
      if (data && typeof data === 'object' && 'count' in data && validCount(data.count)) {
        ++countVersion;
        update({ unreadCount: data.count });
      }
    } catch { /* Malformed events cannot replace known server state. */ }
  };
  stream?.addEventListener('connected', connected);
  stream?.addEventListener('notification', notification);
  stream?.addEventListener('unread_count', unreadCount);
  if (stream) stream.onerror = () => update({ isConnected: false });
  return {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh,
    markRead: (id: string) => save(id),
    markAllRead: () => save(),
    dispose() {
      disposed = true;
      ++version;
      ++countVersion;
      request?.abort();
      stream?.removeEventListener('connected', connected);
      stream?.removeEventListener('notification', notification);
      stream?.removeEventListener('unread_count', unreadCount);
      if (stream) { stream.onerror = null; stream.close(); }
      listeners.clear();
    },
  };
}
