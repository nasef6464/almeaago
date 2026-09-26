export type ReviewTab = 'saved' | 'mistakes' | 'all';

export interface SkillProgress {
  pathId: string;
  subjectId: string;
  skillId: string;
  mastery: number;
  status: 'weak' | 'average' | 'good' | 'mastered';
  attempts: number;
  evidenceCount: number;
  lastEvidenceAt: string;
  recommendedAction: string;
}

export interface SkillProgressPage {
  items: SkillProgress[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ReviewCard {
  cardId: string;
  questionId: string;
  questionVersion: number;
  pathId: string;
  subjectId: string;
  reviewType: 'error_recovery' | 'mastery_review' | 'saved_review';
  savedForReview: boolean;
  savedAt: string | null;
  hasMistake: boolean;
  nextReviewAt: string;
  skillIds: string[];
  updatedAt: string;
}

export interface ReviewQuestion {
  id: string;
  version: number;
  type: string;
  text: string;
  imageAssetId: string;
  imageAlt: string;
  optionsEmbeddedInImage: boolean;
  videoUrl: string;
  difficulty: string;
  options: Array<{ index: number; text: string; assetId: string }>;
  correctOptionIndex?: number;
  explanation: string;
  hint: string;
  solvingStrategy: string;
}

export interface ReviewItem {
  card: ReviewCard;
  question: ReviewQuestion;
}

export interface ReviewPage {
  items: ReviewItem[];
  page: number;
  limit: number;
  hasMore: boolean;
}

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

async function request<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(BASE + path, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...init.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'تعذر تنفيذ الطلب' }));
    throw new Error(body.message || 'تعذر تنفيذ الطلب');
  }
  return response.json() as Promise<T>;
}

export const learningClient = {
  reviewLibrary(
    tab: ReviewTab,
    pathId: string,
    subjectId: string,
    page = 1,
    limit = 20,
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({
      tab,
      pathId,
      page: String(page),
      limit: String(limit),
    });
    if (subjectId) params.set('subjectId', subjectId);
    return request<ReviewPage>(`/api/v1/review/library?${params.toString()}`, { signal });
  },

  saveReview(questionId: string, csrfToken: string) {
    return request<{ success: boolean }>(
      `/api/v1/review/questions/${encodeURIComponent(questionId)}/saved`,
      {
        method: 'PUT',
        headers: { 'X-CSRF-Token': csrfToken },
      },
    );
  },

  unsaveReview(questionId: string, csrfToken: string) {
    return request<{ success: boolean }>(
      `/api/v1/review/questions/${encodeURIComponent(questionId)}/saved`,
      {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': csrfToken },
      },
    );
  },

  progress(pathId: string, subjectId: string, page = 1, limit = 20, signal?: AbortSignal) {
    const params = new URLSearchParams({
      pathId,
      page: String(page),
      limit: String(limit),
    });
    if (subjectId) params.set('subjectId', subjectId);
    return request<SkillProgressPage>(`/api/v1/mastery/progress?${params.toString()}`, { signal });
  },

  nextAction(pathId: string, subjectId: string, signal?: AbortSignal) {
    const params = new URLSearchParams({ pathId });
    if (subjectId) params.set('subjectId', subjectId);
    return request<{ item: SkillProgress | null }>(
      `/api/v1/mastery/next-action?${params.toString()}`,
      { signal },
    );
  },
};
