import type {
  ContentListFilters,
  CourseDetail,
  CourseModule,
  CourseSummary,
  CreateCourseInput,
  CreateLessonInput,
  CreateFoundationTopicInput,
  CreateLibraryInput,
  FoundationPlacements,
  FoundationTopicDetail,
  FoundationTopicSummary,
  LibraryDetail,
  LibrarySummary,
  LearnerCourse,
  LearnerLessonDetail,
  LearnerTopic,
  LearningSpace,
  LessonDetail,
  LessonSummary,
  PageResult,
  TaxonomyCore,
  TaxonomyFull,
  UpdateCourseInput,
  UpdateFoundationTopicInput,
  UpdateLessonInput,
  UpdateLibraryInput,
} from './content-types';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

interface ErrorBody {
  message?: string;
  error?: { message?: string };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
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
            : response.status === 409
              ? 'تعارضت العملية مع حالة المحتوى الحالية. حدّث الصفحة وحاول مرة أخرى.'
              : 'تعذر تنفيذ الطلب الآن.'),
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
    return request<TaxonomyCore>('/api/v1/taxonomy/bootstrap?phase=core', { signal });
  },

  taxonomyFull(signal?: AbortSignal) {
    return request<TaxonomyFull>('/api/v1/taxonomy/bootstrap?phase=full', { signal });
  },

  learningSpace(pathId: string, subjectId: string, limit = 50, signal?: AbortSignal) {
    return request<LearningSpace>(
      `/api/v1/learning-spaces/${encodeURIComponent(pathId)}/subjects/${encodeURIComponent(subjectId)}?limit=${limit}`,
      { signal },
    );
  },

  learnerCourse(courseId: string, signal?: AbortSignal) {
    return request<{ course: LearnerCourse }>(
      `/api/v1/learning-spaces/courses/${encodeURIComponent(courseId)}`,
      { signal },
    );
  },

  learnerCourseLesson(courseId: string, lessonId: string, signal?: AbortSignal) {
    return request<{ lesson: LearnerLessonDetail }>(
      `/api/v1/learning-spaces/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`,
      { signal },
    );
  },

  learnerTopic(topicId: string, signal?: AbortSignal) {
    return request<{ topic: LearnerTopic }>(
      `/api/v1/learning-spaces/foundation/${encodeURIComponent(topicId)}`,
      { signal },
    );
  },

  courses(filters: ContentListFilters, signal?: AbortSignal) {
    return request<PageResult<CourseSummary>>(
      `/api/v1/courses?${listQuery(filters)}`,
      { signal },
    );
  },

  lessons(filters: ContentListFilters, signal?: AbortSignal) {
    return request<PageResult<LessonSummary>>(
      `/api/v1/lessons?${listQuery(filters)}`,
      { signal },
    );
  },

  lesson(lessonId: string, signal?: AbortSignal) {
    return request<{ lesson: LessonDetail }>(
      `/api/v1/lessons/${encodeURIComponent(lessonId)}`,
      { signal },
    );
  },

  createLesson(input: CreateLessonInput, csrfToken: string) {
    return request<{ lesson: LessonDetail }>('/api/v1/lessons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify(input),
    });
  },

  updateLesson(lessonId: string, input: UpdateLessonInput, csrfToken: string) {
    return request<{ lesson: LessonDetail }>(
      `/api/v1/lessons/${encodeURIComponent(lessonId)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(input),
      },
    );
  },

  lessonWorkflow(
    lessonId: string,
    expectedRevision: number,
    status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived',
    reviewerNotes: string,
    csrfToken: string,
  ) {
    return request<{ lesson: LessonDetail }>(
      `/api/v1/lessons/${encodeURIComponent(lessonId)}/workflow`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ expectedRevision, status, reviewerNotes }),
      },
    );
  },

  library(filters: ContentListFilters, signal?: AbortSignal) {
    return request<PageResult<LibrarySummary>>(
      `/api/v1/library?${listQuery(filters)}`,
      { signal },
    );
  },

  libraryItem(itemId: string, signal?: AbortSignal) {
    return request<{ item: LibraryDetail }>(
      `/api/v1/library/${encodeURIComponent(itemId)}`,
      { signal },
    );
  },

  createLibraryItem(input: CreateLibraryInput, csrfToken: string) {
    return request<{ item: LibraryDetail }>('/api/v1/library', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify(input),
    });
  },

  updateLibraryItem(itemId: string, input: UpdateLibraryInput, csrfToken: string) {
    return request<{ item: LibraryDetail }>(
      `/api/v1/library/${encodeURIComponent(itemId)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(input),
      },
    );
  },

  libraryWorkflow(
    itemId: string,
    expectedRevision: number,
    status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived',
    reviewerNotes: string,
    csrfToken: string,
  ) {
    return request<{ item: LibraryDetail }>(
      `/api/v1/library/${encodeURIComponent(itemId)}/workflow`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ expectedRevision, status, reviewerNotes }),
      },
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
      { signal },
    );
  },

  foundationTopic(topicId: string, signal?: AbortSignal) {
    return request<{ topic: FoundationTopicDetail }>(
      `/api/v1/foundation/topics/${encodeURIComponent(topicId)}`,
      { signal },
    );
  },

  createFoundationTopic(input: CreateFoundationTopicInput, csrfToken: string) {
    return request<{ topic: FoundationTopicDetail }>('/api/v1/foundation/topics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify(input),
    });
  },

  updateFoundationTopic(
    topicId: string,
    input: UpdateFoundationTopicInput,
    csrfToken: string,
  ) {
    return request<{ topic: FoundationTopicDetail }>(
      `/api/v1/foundation/topics/${encodeURIComponent(topicId)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(input),
      },
    );
  },

  foundationPlacements(topicId: string, signal?: AbortSignal) {
    return request<{ placements: FoundationPlacements }>(
      `/api/v1/foundation/topics/${encodeURIComponent(topicId)}/placements`,
      { signal },
    );
  },

  linkFoundationLesson(
    topicId: string,
    lessonId: string,
    expectedRevision: number,
    sortOrder: number,
    csrfToken: string,
  ) {
    return request<{ topicRevision: number }>(
      `/api/v1/foundation/topics/${encodeURIComponent(topicId)}/lessons/${encodeURIComponent(lessonId)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ expectedRevision, sortOrder, isPreview: false }),
      },
    );
  },

  unlinkFoundationLesson(
    topicId: string,
    lessonId: string,
    expectedRevision: number,
    csrfToken: string,
  ) {
    return request<{ topicRevision: number }>(
      `/api/v1/foundation/topics/${encodeURIComponent(topicId)}/lessons/${encodeURIComponent(lessonId)}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ expectedRevision }),
      },
    );
  },

  linkFoundationLibraryItem(
    topicId: string,
    itemId: string,
    expectedRevision: number,
    sortOrder: number,
    csrfToken: string,
  ) {
    return request<{ topicRevision: number }>(
      `/api/v1/foundation/topics/${encodeURIComponent(topicId)}/library/${encodeURIComponent(itemId)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ expectedRevision, sortOrder, isPreview: false }),
      },
    );
  },

  unlinkFoundationLibraryItem(
    topicId: string,
    itemId: string,
    expectedRevision: number,
    csrfToken: string,
  ) {
    return request<{ topicRevision: number }>(
      `/api/v1/foundation/topics/${encodeURIComponent(topicId)}/library/${encodeURIComponent(itemId)}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ expectedRevision }),
      },
    );
  },

  course(courseId: string, signal?: AbortSignal) {
    return request<{ course: CourseDetail }>(
      `/api/v1/courses/${encodeURIComponent(courseId)}`,
      { signal },
    );
  },

  updateCourse(courseId: string, input: UpdateCourseInput, csrfToken: string) {
    return request<{ course: CourseDetail }>(
      `/api/v1/courses/${encodeURIComponent(courseId)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(input),
      },
    );
  },

  courseModules(courseId: string, signal?: AbortSignal) {
    return request<{ modules: CourseModule[] }>(
      `/api/v1/courses/${encodeURIComponent(courseId)}/modules`,
      { signal },
    );
  },

  createCourseModule(
    courseId: string,
    input: { expectedRevision: number; title: string; description: string; sortOrder: number; status: 'active' },
    csrfToken: string,
  ) {
    return request<{ module: CourseModule; courseRevision: number }>(
      `/api/v1/courses/${encodeURIComponent(courseId)}/modules`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(input),
      },
    );
  },

  updateCourseModule(
    courseId: string,
    moduleId: string,
    input: { expectedRevision: number; title: string; description: string; sortOrder: number; status: 'active' | 'archived' },
    csrfToken: string,
  ) {
    return request<{ module: CourseModule; courseRevision: number }>(
      `/api/v1/courses/${encodeURIComponent(courseId)}/modules/${encodeURIComponent(moduleId)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(input),
      },
    );
  },

  placeCourseLesson(
    courseId: string,
    moduleId: string,
    lessonId: string,
    input: { expectedRevision: number; sortOrder: number; isPreview: boolean },
    csrfToken: string,
  ) {
    return request<{ courseRevision: number }>(
      `/api/v1/courses/${encodeURIComponent(courseId)}/modules/${encodeURIComponent(moduleId)}/lessons/${encodeURIComponent(lessonId)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(input),
      },
    );
  },

  removeCourseLesson(
    courseId: string,
    moduleId: string,
    lessonId: string,
    expectedRevision: number,
    csrfToken: string,
  ) {
    return request<{ courseRevision: number }>(
      `/api/v1/courses/${encodeURIComponent(courseId)}/modules/${encodeURIComponent(moduleId)}/lessons/${encodeURIComponent(lessonId)}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ expectedRevision }),
      },
    );
  },

  createCourse(input: CreateCourseInput, csrfToken: string) {
    return request<{ course: CourseSummary }>('/api/v1/courses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify(input),
    });
  },

  courseWorkflow(
    courseId: string,
    expectedRevision: number,
    status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived',
    reviewerNotes: string,
    csrfToken: string,
  ) {
    return request<{ course: CourseSummary }>(
      `/api/v1/courses/${encodeURIComponent(courseId)}/workflow`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ expectedRevision, status, reviewerNotes }),
      },
    );
  },

  coursePublication(
    courseId: string,
    expectedRevision: number,
    isPublished: boolean,
    csrfToken: string,
  ) {
    return request<{ course: CourseSummary }>(
      `/api/v1/courses/${encodeURIComponent(courseId)}/publication`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ expectedRevision, isPublished }),
      },
    );
  },
};
