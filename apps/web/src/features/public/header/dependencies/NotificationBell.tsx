import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, Check, CheckCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../../../auth/state/AuthProvider';
import { notificationClient } from '../../../notifications/api/notification-client';
import { createNotificationSession, emptyNotificationSnapshot } from './notification-session';

/** Source presentation; authenticated Go transport is isolated per user and role lifetime. */
export const NotificationBell: React.FC = () => {
  const { user, loading: authLoading, getCsrfToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [snapshot, setSnapshot] = useState(emptyNotificationSnapshot);
  const panelRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<ReturnType<typeof createNotificationSession> | null>(null);
  const tokenRef = useRef(getCsrfToken);
  tokenRef.current = getCsrfToken;
  const identity = user ? `${user.id}:${user.role}:${[...user.roles].sort().join(',')}` : '';
  const [snapshotIdentity, setSnapshotIdentity] = useState(identity);

  useEffect(() => {
    setIsOpen(false);
    setSnapshot(emptyNotificationSnapshot());
    setSnapshotIdentity(identity);
    if (authLoading || !identity) return;
    const session = createNotificationSession({
      client: notificationClient,
      getCsrfToken: () => tokenRef.current(),
      createEventSource: typeof EventSource === 'undefined' ? undefined : (url, options) => new EventSource(url, options),
    });
    sessionRef.current = session;
    const unsubscribe = session.subscribe(() => setSnapshot(session.snapshot()));
    void session.refresh();
    return () => { unsubscribe(); session.dispose(); sessionRef.current = null; };
  }, [authLoading, identity]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setIsOpen(value => !value);
    if (!isOpen) void sessionRef.current?.refresh();
  };
  // Avoid rendering another account's state before effect cleanup after logout/role changes.
  if (authLoading || !user || snapshotIdentity !== identity) return null;
  const { notifications, unreadCount, loading, isConnected, error, saving } = snapshot;
  const unread = notifications.filter((n) => !n.readAt);

  return (
    <div className="relative" ref={panelRef}>
      {/* ── زر الجرس ── */}
      <button
        onClick={handleOpen}
        aria-label="الإشعارات"
        className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
      >
        <Bell
          size={22}
          className={`transition-colors ${unreadCount !== null && unreadCount > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}
        />
        {/* Badge */}
        {unreadCount !== null && unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black shadow">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {/* مؤشر الاتصال */}
        {isConnected && (
          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border-2 border-white dark:border-gray-900" />
        )}
      </button>

      {/* ── Panel ── */}
      {isOpen && (
        <div className="absolute left-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/10">
            <h3 className="font-black text-gray-900 dark:text-white text-sm flex items-center gap-2">
              <Bell size={16} className="text-indigo-600" />
              الإشعارات
              {unread.length > 0 && (
                <span className="bg-red-100 text-red-700 text-[11px] font-black px-2 py-0.5 rounded-full">
                  {unread.length} جديد
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {unread.length > 0 && (
                <button
                  onClick={() => void sessionRef.current?.markAllRead()}
                  disabled={saving}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  title="تعليم الكل كمقروء"
                >
                  <CheckCheck size={13} />
                  قراءة الكل
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white">
                <X size={16} />
              </button>
            </div>
          </div>

          {error && <div role="alert" className="px-4 py-2 text-xs text-red-600">{error}</div>}
          {/* القائمة */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={24} className="text-indigo-600 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">
                <Bell size={32} className="mx-auto mb-2 opacity-30" />
                لا توجد إشعارات
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-white/5">
                {notifications.map((notif) => (
                  <li
                    key={notif.id}
                    className={`px-4 py-3 flex items-start gap-3 cursor-pointer transition-colors ${
                      !notif.readAt ? 'bg-indigo-50/60 dark:bg-indigo-900/20 hover:bg-indigo-50 dark:hover:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                    onClick={() => !notif.readAt && sessionRef.current?.markRead(notif.id)}
                  >
                    {/* نقطة غير مقروء */}
                    <div className="mt-1.5 shrink-0">
                      {notif.readAt ? (
                        <Check size={14} className="text-gray-300" />
                      ) : (
                        <span className="block w-2.5 h-2.5 rounded-full bg-indigo-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-black truncate ${!notif.readAt ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{notif.body}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(notif.createdAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
