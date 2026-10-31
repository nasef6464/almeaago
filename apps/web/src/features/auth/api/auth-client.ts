import type { AdminUser, AdminUsersPage, AdminUsersSummary, AuthResult, AuthUser, MessageResult } from './auth-types';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

interface ErrorBody {
  message?: string;
  error?: string | {
    message?: string;
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    // Legacy's request() preserves plain-text failures and string error
    // envelopes. Reading JSON only silently discards both on public forms.
    const rawError = await response.text().catch(() => '');
    let serverMessage = '';
    if (rawError) {
      try {
        const parsed: unknown = JSON.parse(rawError);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const body = parsed as ErrorBody;
          const error = body.error;
          serverMessage =
            (typeof error === 'object' && error !== null && typeof error.message === 'string'
              ? error.message
              : '') ||
            (typeof body.message === 'string' ? body.message : '') ||
            (typeof error === 'string' ? error : '');
        } else {
          serverMessage = rawError.slice(0, 240);
        }
      } catch {
        serverMessage = rawError.slice(0, 240);
      }
    }

    const message =
      serverMessage ||
      (response.status === 401
        ? 'بيانات الدخول غير صحيحة'
        : response.status === 429
          ? 'محاولات كثيرة. حاول مرة أخرى بعد قليل.'
          : 'تعذر تنفيذ الطلب الآن.');

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const authClient = {
  register(name: string, email: string, password: string) {
    return request<AuthResult>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  login(email: string, password: string) {
    return request<AuthResult>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  loginNationalId(nationalId: string, password: string) {
    return request<AuthResult>('/api/v1/auth/login/national-id', {
      method: 'POST',
      body: JSON.stringify({ nationalId, password }),
    });
  },

  loginPhone(phone: string, password: string) {
    return request<AuthResult>('/api/v1/auth/login/phone-password', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    });
  },

  startWhatsAppOTP(phone: string) {
    return request<{ message: string; expiresInSeconds: number }>('/api/v1/auth/whatsapp/start', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  verifyWhatsAppOTP(phone: string, code: string) {
    return request<AuthResult>('/api/v1/auth/whatsapp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    });
  },

  googleStartURL(returnTo = '/') {
    const params = new URLSearchParams({ returnTo });
    return `${API_BASE}/api/v1/auth/google/start?${params.toString()}`;
  },

  me() {
    return request<{ user: AuthUser }>('/api/v1/auth/me');
  },

  csrf() {
    return request<{ csrfToken: string }>('/api/v1/auth/csrf');
  },

  logout(csrfToken: string) {
    return request<void>('/api/v1/auth/logout', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
    });
  },

  forgotPassword(email: string) {
    return request<MessageResult>('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPassword(token: string, password: string) {
    return request<MessageResult>('/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  verifyEmail(token: string) {
    return request<{ user: AuthUser; message: string }>('/api/v1/auth/email/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  resendEmailVerification(csrfToken: string) {
    return request<MessageResult>('/api/v1/auth/email/resend', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
    });
  },

  adminListUsers(query: { page?: number; limit?: number; role?: string; search?: string; isActive?: boolean; platformTrainer?: boolean } = {}, signal?: AbortSignal) {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.role && query.role !== 'all') params.set('role', query.role);
    if (query.search) params.set('search', query.search);
    if (query.isActive !== undefined) params.set('isActive', String(query.isActive));
    if (query.platformTrainer) params.set('platformTrainer', 'true');
    return request<AdminUsersPage>(`/api/v1/auth/admin/users?${params.toString()}`, { signal });
  },

  adminUsersSummary(signal?: AbortSignal) {
    return request<AdminUsersSummary>('/api/v1/auth/admin/users/summary', { signal });
  },

  adminUpdateUser(id: string, patch: Record<string, unknown>, csrfToken: string) {
    return request<{ user: AdminUser }>(`/api/v1/auth/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify(patch),
    });
  },

  adminCreateUser(data: Record<string, unknown>, csrfToken: string) {
    return request<{ user: AdminUser }>('/api/v1/auth/admin/users', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify(data),
    });
  },

  adminDeleteUser(id: string, csrfToken: string) {
    return request<{ message: string }>(`/api/v1/auth/admin/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': csrfToken },
    });
  },

  adminBulkStatus(userIds: string[], isActive: boolean, csrfToken: string) {
    return request<{ results: Array<{ id: string; ok: boolean; error?: string }> }>('/api/v1/auth/admin/users/bulk-status', {
      method: 'PATCH',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ userIds, isActive }),
    });
  },
};
