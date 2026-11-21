import { useEffect, useRef, useState } from 'react';
import { contentClient } from '../../content/api/content-client';
import type { LearnerCourseSummary, LearnerLibrarySummary } from '../../content/api/content-types';

type Item = LearnerCourseSummary | LearnerLibrarySummary;
type Extra<T> = { scope: string; page: number; items: T[]; hasMore: boolean; loading: boolean; error: string };

export function useLearnerResourcePages<T extends Item>(scope: string, path: string, subject: string, kind: 'courses' | 'library', initial?: { items: T[]; hasMore: boolean }) {
  const [state, setState] = useState<Extra<T> | null>(null);
  const request = useRef<AbortController | null>(null);
  const current = useRef(scope);
  current.current = scope;
  useEffect(() => { setState(null); return () => { request.current?.abort(); request.current = null; }; }, [scope, initial]);
  const extra = state?.scope === scope ? state : null;
  const hasMore = initial ? (extra?.hasMore ?? initial.hasMore) : false;
  const items = initial ? [...initial.items, ...(extra?.items || [])] : [];
  async function loadMore() {
    if (!initial || !hasMore || request.current) return;
    const controller = new AbortController(); request.current = controller;
    const page = (extra?.page || 1) + 1;
    setState({ scope, page: extra?.page || 1, items: extra?.items || [], hasMore: true, loading: true, error: '' });
    try {
      const result = await contentClient.learnerResourcePage<T>(path, subject, kind, page, controller.signal);
      if (controller.signal.aborted || current.current !== scope) return;
      if (result.pathId !== path || result.subjectId !== subject || result.page !== page || !Array.isArray(result.items) || typeof result.hasMore !== 'boolean') throw new Error('تعذر التحقق من المحتوى المحمل.');
      const previous = extra?.items || [];
      const known = new Set([...initial.items, ...previous].map(item => item.id));
      const added = result.items.filter(item => { if (known.has(item.id)) return false; known.add(item.id); return true; });
      setState({ scope, page, items: [...previous, ...added], hasMore: result.hasMore, loading: false, error: '' });
    } catch (error) {
      if (!controller.signal.aborted && current.current === scope) setState({ scope, page: extra?.page || 1, items: extra?.items || [], hasMore: true, loading: false, error: error instanceof Error ? error.message : 'تعذر تحميل المزيد.' });
    } finally { if (request.current === controller) request.current = null; }
  }
  return { items, hasMore, loading: extra?.loading || false, error: extra?.error || '', loadMore };
}
