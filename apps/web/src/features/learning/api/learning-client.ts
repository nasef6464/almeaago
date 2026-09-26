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

export interface ReviewPracticeQuestion {
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
}

export interface ReviewPracticeItem {
  card: ReviewCard;
  question: ReviewPracticeQuestion;
}

export interface ReviewPracticePage {
  items: ReviewPracticeItem[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ReviewAnswerResult {
  submissionId: string;
  cardId: string;
  questionId: string;
  questionVersion: number;
  selectedOptionIndex: number;
  correct: boolean;
  evidenceType: 'remediation' | 'mastery_review';
  quality: number;
  correctOptionIndex: number;
  explanation: string;
  hint: string;
  solvingStrategy: string;
  reviewTypeAfter: 'error_recovery' | 'mastery_review' | 'saved_review';
  nextReviewAt: string;
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

  reviewPractice(
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
    return request<ReviewPracticePage>(`/api/v1/review/practice?${params.toString()}`, { signal });
  },

  answerReview(
    cardId: string,
    input: {
      submissionKey: string;
      expectedUpdatedAt: string;
      selectedOptionIndex: number;
    },
    csrfToken: string,
  ) {
    return request<{ result: ReviewAnswerResult }>(
      `/api/v1/review/cards/${encodeURIComponent(cardId)}/answer`,
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


export type LessonProgressContextType='course'|'foundation';
export type LessonProgressStatus='not_started'|'in_progress'|'completed';
export interface LessonProgress {
  lessonId:string;
  contextType:LessonProgressContextType;
  courseId:string;
  topicId:string;
  status:LessonProgressStatus;
  positionSeconds:number;
  completedAt:string|null;
  updatedAt:string|null;
}
export interface LessonProgressContextInput {
  contextType:LessonProgressContextType;
  courseId:string;
  topicId:string;
}
function lessonProgressQuery(input:LessonProgressContextInput){
  const p=new URLSearchParams({contextType:input.contextType});
  if(input.courseId)p.set('courseId',input.courseId);
  if(input.topicId)p.set('topicId',input.topicId);
  return p.toString();
}

export const lessonProgressClient={
  get(lessonId:string,input:LessonProgressContextInput,signal?:AbortSignal){
    return request<{progress:LessonProgress}>(
      `/api/v1/learning-progress/lessons/${encodeURIComponent(lessonId)}?${lessonProgressQuery(input)}`,
      {signal},
    );
  },
  saveVideo(lessonId:string,input:LessonProgressContextInput,positionSeconds:number,csrfToken:string){
    return request<{progress:LessonProgress}>(
      `/api/v1/learning-progress/lessons/${encodeURIComponent(lessonId)}/video`,
      {
        method:'PUT',
        headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},
        body:JSON.stringify({...input,positionSeconds}),
      },
    );
  },
  complete(lessonId:string,input:LessonProgressContextInput,csrfToken:string){
    return request<{progress:LessonProgress}>(
      `/api/v1/learning-progress/lessons/${encodeURIComponent(lessonId)}/complete`,
      {
        method:'POST',
        headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},
        body:JSON.stringify(input),
      },
    );
  },
};
