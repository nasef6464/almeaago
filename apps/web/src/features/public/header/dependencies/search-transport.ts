export type SearchType = 'all' | 'lesson' | 'question' | 'course';
export interface SearchRow { id: string; title: string; subtitle: string; route: string }
export interface SearchPayload {
  q: string;
  type: SearchType;
  results: { courses: SearchRow[]; lessons: SearchRow[]; questions: SearchRow[] };
}
interface SearchQuery { q: string; type: SearchType; limit: number }
export function createSearchClient(base = '', transport: typeof fetch = fetch) {
  return {
    async search(input: SearchQuery, signal?: AbortSignal): Promise<SearchPayload> {
      const q = input.q.trim();
      if (!q || q.length > 120 || !['all', 'course', 'lesson', 'question'].includes(input.type) || !Number.isInteger(input.limit) || input.limit < 1 || input.limit > 20) {
        throw new Error('تعذر البحث: عبارة أو نوع أو حد نتائج غير صالح');
      }
      const params = new URLSearchParams({ q, type: input.type, limit: String(input.limit) });
      const response = await transport(`${base.replace(/\/$/, '')}/api/v1/search?${params}`, {
        credentials: 'include', signal, headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.message === 'string' ? body.message : 'تعذر البحث الآن. أعد المحاولة.');
      }
      const body: unknown = await response.json();
      if (!isSearchPayload(body)) throw new Error('تعذر قراءة نتائج البحث');
      return body;
    },
  };
}
function isSearchPayload(value: unknown): value is SearchPayload {
  if (!value || typeof value !== 'object' || !('results' in value) || !value.results || typeof value.results !== 'object') return false;
  const results = value.results as Record<string, unknown>;
  return ['courses', 'lessons', 'questions'].every(group => Array.isArray(results[group]) && results[group].every((row: unknown) => {
    if (!row || typeof row !== 'object') return false;
    return ['id', 'title', 'subtitle', 'route'].every(key => typeof (row as Record<string, unknown>)[key] === 'string');
  }));
}
interface SearchState { loading: boolean; payload: SearchPayload | null; error: string }
/** Cancels both network work and stale response/error publication after query changes. */
export function createSearchSession(client: Pick<ReturnType<typeof createSearchClient>, 'search'>, publish: (state: SearchState) => void) {
  let version = 0;
  let controller: AbortController | null = null;
  const empty = (): SearchState => ({ loading: false, payload: null, error: '' });
  return {
    async search(query: string, type: SearchType) {
      const current = ++version;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      publish({ loading: true, payload: null, error: '' });
      try {
        const payload = await client.search({ q: query, type, limit: 20 }, request.signal);
        if (current === version) publish({ loading: false, payload, error: '' });
      } catch (error) {
        if (current === version) publish({ loading: false, payload: null, error: error instanceof Error ? error.message : 'تعذر البحث الآن. أعد المحاولة.' });
      }
    },
    cancel(reset = true) {
      ++version;
      controller?.abort();
      controller = null;
      if (reset) publish(empty());
    },
  };
}
