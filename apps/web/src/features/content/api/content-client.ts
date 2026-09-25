import type {
  ContentListFilters,
  CourseSummary,
  FoundationTopicSummary,
  LibrarySummary,
  LessonSummary,
  PageResult,
  TaxonomyCore,
} from './content-types';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

interface ErrorBody {
  message?: string;
  error?: { message?: string };
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    let body: ErrorBody = {};
    try {
      body = (await response.json()) as ErrorBody;
    } catch {
      body = {};
    }

    throw new Error(
      body.error?.message ||
        body.message ||
        (response.status === 401
          ? 'يلزم تسجيل الدخول.'
          : response.status === 403
            ? 'لا تملك صلاحية هذا النطاق.'
            : 'تعذر تحميل البيانات الآن.'),
    );
  }

  return (await response.json()) as T;
}

function listQuery(filters: ContentListFilters) {
  const params = new URLSearchParams();
  params.set('page', String(filters.page || 1));
  params.set('limit', String(filters.limit || 50));
  if (filters.pathId) params.set('pathId', filters.pathId);
  if (filters.subjectId) params.set('subjectId', filters.subjectId);
  if (filters.search) params.set('search', filters.search);
  if (filters.workflowStatus) params.set('workflowStatus', filters.workflowStatus);
  return params.toString();
}

export const contentClient = {
  taxonomyCore(signal?: AbortSignal) {
    return request<TaxonomyCore>('/api/v1/taxonomy/bootstrap?phase=core', signal);
  },

  courses(filters: ContentListFilters, signal?: AbortSignal) {
    return request<PageResult<CourseSummary>>(
      `/api/v1/courses?${listQuery(filters)}`,
      signal,
    );
  },

  lessons(filters: ContentListFilters, signal?: AbortSignal) {
    return request<PageResult<LessonSummary>>(
      `/api/v1/lessons?${listQuery(filters)}`,
      signal,
    );
  },

  library(filters: ContentListFilters, signal?: AbortSignal) {
    return request<PageResult<LibrarySummary>>(
      `/api/v1/library?${listQuery(filters)}`,
      signal,
    );
  },

  foundation(filters: ContentListFilters, signal?: AbortSignal) {
    const params = new URLSearchParams();
    params.set('page', String(filters.page || 1));
    params.set('limit', String(filters.limit || 50));
    if (filters.pathId) params.set('pathId', filters.pathId);
    if (filters.subjectId) params.set('subjectId', filters.subjectId);
    if (filters.search) params.set('search', filters.search);
    return request<PageResult<FoundationTopicSummary>>(
      `/api/v1/foundation/topics?${params.toString()}`,
      signal,
    );
  },
};
