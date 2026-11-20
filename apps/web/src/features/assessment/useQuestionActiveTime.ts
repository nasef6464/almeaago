import { useCallback, useEffect, useRef } from 'react';

type Clock = { attemptId: string; questionId: string; elapsedMs: number; startedAt: number | null; storageKey: string };

// Keep a monotonic, per-question local checkpoint so a reload or temporary
// disconnection does not reset the accumulated duration. Only visible,
// focused time is counted; the server remains the attempt deadline authority.
export function useQuestionActiveTime(userId: string, attemptId: string, questionId: string, savedSeconds: number, enabled: boolean) {
  const clock = useRef<Clock | null>(null);
  const checkpoint = useCallback(() => {
    const current = clock.current;
    if (!current) return 0;
    if (current.startedAt !== null) {
      const now = performance.now();
      current.elapsedMs += Math.max(0, now - current.startedAt);
      current.startedAt = now;
    }
    const seconds = Math.min(86400, Math.floor(current.elapsedMs / 1000));
    try {
      const raw = JSON.parse(sessionStorage.getItem(current.storageKey) || '{}') as Record<string, number>;
      raw[current.questionId] = Math.max(Number(raw[current.questionId]) || 0, seconds);
      sessionStorage.setItem(current.storageKey, JSON.stringify(raw));
    } catch { /* timing still works in memory when storage is unavailable */ }
    return seconds;
  }, []);

  useEffect(() => {
    if (!enabled || !userId || !attemptId || !questionId) { clock.current = null; return; }
    const storageKey = `assessment-question-time:${userId}:${attemptId}`;
    let local = 0;
    try {
      const raw = JSON.parse(sessionStorage.getItem(storageKey) || '{}') as Record<string, number>;
      local = Math.min(86400, Math.max(0, Number(raw[questionId]) || 0));
    } catch { /* start with the saved server value */ }
    const active = () => document.visibilityState === 'visible' && document.hasFocus();
    clock.current = { attemptId, questionId, storageKey, elapsedMs: Math.max(local, savedSeconds || 0) * 1000, startedAt: active() ? performance.now() : null };
    const syncActivity = () => {
      checkpoint();
      if (clock.current) clock.current.startedAt = active() ? performance.now() : null;
    };
    document.addEventListener('visibilitychange', syncActivity);
    window.addEventListener('focus', syncActivity);
    window.addEventListener('blur', syncActivity);
    window.addEventListener('pagehide', checkpoint);
    const timer = window.setInterval(checkpoint, 5000);
    return () => {
      checkpoint();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', syncActivity);
      window.removeEventListener('focus', syncActivity);
      window.removeEventListener('blur', syncActivity);
      window.removeEventListener('pagehide', checkpoint);
      clock.current = null;
    };
    // Server answer updates must not restart the local clock for this question.
  }, [attemptId, questionId, userId, enabled, checkpoint]);
  return checkpoint;
}
