import type {
  AiAdminCopilotResult,
  AiAdminReadiness,
  AiInteractionPage,
  AiProvider,
  AiProviderSetting,
  AiProviderTestResult,
  AiProviderWrite,
  AiQuestionAssistResult,
  AiHelpLevel,
  AiUsageSummary,
} from './ai-types';

export interface AiChatInput {
  message: string;
  tutorSessionId?: string;
  image?: { data: string; mimeType: string };
  history?: Array<{ sender: string; text: string }>;
  context?: { pathId?: string; skillId?: string; examId?: string };
}

export interface AiChatResult {
  text: string;
  reply: string;
  suggestions?: string[];
  personalized?: boolean;
  weaknessesCount?: number;
  provider?: AiProvider;
  model?: string;
  usedFallback?: boolean;
  recommendedLinks?: Array<{ label: string; href: string; skillId: string }>;
}

export interface GeneratedQuestion {
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
  skills: string[];
}

export interface AiGenerateAssessmentResult {
  questions: GeneratedQuestion[];
  provider: AiProvider;
  model: string;
  latencyMs: number;
}

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
async function request<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const response = await fetch(BASE + path, {
    ...init,
    credentials: 'include',
    signal,
    headers: { Accept: 'application/json', ...init.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'تعذر تنفيذ طلب الذكاء الاصطناعي' }));
    throw new Error(body.message || 'تعذر تنفيذ طلب الذكاء الاصطناعي');
  }
  return response.json() as Promise<T>;
}

export const aiClient = {
  providers: (signal?: AbortSignal) => request<{ items: AiProviderSetting[] }>('/api/v1/ai/admin/providers', {}, signal),
  updateProvider: (provider: AiProvider, write: AiProviderWrite, csrf: string) =>
    request<{ provider: AiProviderSetting }>('/api/v1/ai/admin/providers/' + encodeURIComponent(provider), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify(write),
    }),
  testProvider: (provider: AiProvider, csrf: string) =>
    request<{ result: AiProviderTestResult }>('/api/v1/ai/admin/providers/' + encodeURIComponent(provider) + '/test', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrf },
    }),
  interactions: (page = 1, limit = 50, signal?: AbortSignal) =>
    request<AiInteractionPage>(`/api/v1/ai/admin/interactions?page=${page}&limit=${limit}`, {}, signal),
  usage: (signal?: AbortSignal) => request<{ usage: AiUsageSummary }>('/api/v1/ai/admin/usage', {}, signal),
  readiness: (signal?: AbortSignal) => request<{ readiness: AiAdminReadiness }>('/api/v1/ai/admin/readiness', {}, signal),
  copilot: (message: string, csrf: string) =>
    request<{ result: AiAdminCopilotResult }>('/api/v1/ai/admin/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ message }),
    }),
  questionAssistant: (input: { reviewCardId: string; helpLevel: AiHelpLevel; message: string }, csrf: string) =>
    request<{ result: AiQuestionAssistResult }>('/api/v1/ai/question-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify(input),
    }),
  chat: (input: AiChatInput, csrf?: string, signal?: AbortSignal) =>
    request<AiChatResult>('/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      },
      body: JSON.stringify(input),
    }, signal),
  generateAssessment: async (
    input: { promptText?: string; schoolId?: string; media?: { data: string; mimeType: string }; file?: File },
    csrf: string,
    signal?: AbortSignal,
  ) => {
    if (input.file) {
      const formData = new FormData();
      formData.append('file', input.file);
      if (input.promptText) formData.append('prompt', input.promptText);
      if (input.schoolId) formData.append('schoolId', input.schoolId);
      return request<AiGenerateAssessmentResult>(
        '/api/v1/ai/generate-assessment',
        {
          method: 'POST',
          headers: {
            'X-CSRF-Token': csrf,
          },
          body: formData,
        },
        signal,
      );
    }
    return request<AiGenerateAssessmentResult>(
      '/api/v1/ai/generate-assessment',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
        },
        body: JSON.stringify({
          promptText: input.promptText,
          schoolId: input.schoolId,
          media: input.media,
        }),
      },
      signal,
    );
  },
};
