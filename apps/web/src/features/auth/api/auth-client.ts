import type { AuthResult, AuthUser, MessageResult } from './auth-types';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

interface ErrorBody {
  message?: string;
  error?: {
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
    let body: ErrorBody = {};
    try {
      body = (await response.json()) as ErrorBody;
    } catch {
      body = {};
    }

    const message =
      body.error?.message ||
      body.message ||
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
};
