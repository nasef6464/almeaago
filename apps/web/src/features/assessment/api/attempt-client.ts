export interface AttemptQuestion {
  id: string;
  version: number;
  sectionId: string;
  sortOrder: number;
  points: number;
  type: string;
  text: string;
  imageAssetId: string;
  imageAlt: string;
  optionsEmbeddedInImage: boolean;
  videoUrl: string;
  difficulty: string;
  options: Array<{ index: number; text: string; assetId: string }>;
}

export interface SavedAnswer {
  questionId: string;
  selectedOptionIndex: number | null;
  textAnswer: string;
  timeSpentSeconds: number;
  markedForReview: boolean;
  lastSavedAt: string;
}

export interface Attempt {
  id: string;
  assessmentId: string;
  assessmentVersion: number;
  attemptNumber: number;
  status: 'in_progress' | 'submitted' | 'expired' | 'abandoned';
  title: string;
  startedAt: string;
  expiresAt: string | null;
  submittedAt: string | null;
  showProgressBar: boolean;
  requireAnswerBeforeNext: boolean;
  allowQuestionReview: boolean;
  randomizeOptions: boolean;
  questions: AttemptQuestion[];
  answers: SavedAnswer[];
}

export interface Result {
  attemptId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  passed: boolean;
  timeSpentSeconds: number;
  finalizedAt: string;
}

export interface ResultListItem extends Result {
  assessmentId: string;
  assessmentVersion: number;
  title: string;
  attemptNumber: number;
  showResultsReport: boolean;
}

export interface ResultPage {
  items: ResultListItem[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ReviewQuestion {
  questionId: string;
  questionVersion: number;
  sectionId: string;
  sortOrder: number;
  points: number;
  type: string;
  text: string;
  imageAssetId: string;
  imageAlt: string;
  optionsEmbeddedInImage: boolean;
  videoUrl: string;
  difficulty: string;
  options: Array<{ index: number; text: string; assetId: string }>;
  selectedOptionIndex: number | null;
  correctOptionIndex?: number;
  answered: boolean;
  correct: boolean;
  markedForReview: boolean;
  timeSpentSeconds: number;
  explanation?: string;
  hint?: string;
  solvingStrategy?: string;
}

export interface ResultDetail {
  result: Result;
  assessmentId: string;
  assessmentVersion: number;
  title: string;
  attemptNumber: number;
  allowQuestionReview: boolean;
  showAnswers: boolean;
  showExplanations: boolean;
  showResultsReport: boolean;
  questions?: ReviewQuestion[];
}

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

async function req<T>(path: string, init: RequestInit = {}) {
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

export const attemptClient = {
  start: (assessmentId: string, startKey: string, csrf: string) =>
    req<{ attempt: Attempt }>(`/api/v1/assessments/${assessmentId}/attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ startKey }),
    }),

  get: (id: string) =>
    req<{ attempt: Attempt }>(`/api/v1/assessment-attempts/${id}`),

  save: (
    id: string,
    questionId: string,
    selectedOptionIndex: number | null,
    markedForReview: boolean,
    csrf: string,
  ) =>
    req<{ attempt: Attempt }>(
      `/api/v1/assessment-attempts/${id}/answers/${questionId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({
          selectedOptionIndex,
          textAnswer: '',
          timeSpentSeconds: 0,
          markedForReview,
        }),
      },
    ),

  submit: (id: string, submissionKey: string, csrf: string) =>
    req<{ result: Result }>(`/api/v1/assessment-attempts/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ submissionKey }),
    }),

  result: (id: string) =>
    req<{ result: Result }>(`/api/v1/assessment-attempts/${id}/result`),

  results: (page = 1, limit = 20) =>
    req<ResultPage>(
      `/api/v1/assessment-attempts/results?page=${page}&limit=${limit}`,
    ),

  review: (id: string) =>
    req<{ detail: ResultDetail }>(
      `/api/v1/assessment-attempts/${encodeURIComponent(id)}/review`,
    ),
};
