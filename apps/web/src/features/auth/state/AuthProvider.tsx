import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { authClient } from '../api/auth-client';
import type { AuthUser } from '../api/auth-types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<AuthUser>;
  signInNationalId(nationalId: string, password: string): Promise<AuthUser>;
  signInPhone(phone: string, password: string): Promise<AuthUser>;
  signUp(name: string, email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  forgotPassword(email: string): ReturnType<typeof authClient.forgotPassword>;
  resetPassword(token: string, password: string): ReturnType<typeof authClient.resetPassword>;
  verifyEmail(token: string): ReturnType<typeof authClient.verifyEmail>;
  resendEmailVerification(): ReturnType<typeof authClient.resendEmailVerification>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    authClient
      .me()
      .then(({ user: currentUser }) => {
        if (!cancelled) {
          setUser(currentUser);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const ensureCsrf = useCallback(async () => {
    if (csrfToken) {
      return csrfToken;
    }
    const result = await authClient.csrf();
    setCsrfToken(result.csrfToken);
    return result.csrfToken;
  }, [csrfToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,

      async signIn(email, password) {
        const result = await authClient.login(email, password);
        setUser(result.user);
        setCsrfToken(result.csrfToken);
        return result.user;
      },

      async signInNationalId(nationalId, password) {
        const result = await authClient.loginNationalId(nationalId, password);
        setUser(result.user);
        setCsrfToken(result.csrfToken);
        return result.user;
      },

      async signInPhone(phone, password) {
        const result = await authClient.loginPhone(phone, password);
        setUser(result.user);
        setCsrfToken(result.csrfToken);
        return result.user;
      },

      async signUp(name, email, password) {
        const result = await authClient.register(name, email, password);
        setUser(result.user);
        setCsrfToken(result.csrfToken);
        return result.user;
      },

      async signOut() {
        const token = await ensureCsrf();
        await authClient.logout(token);
        setUser(null);
        setCsrfToken('');
      },

      forgotPassword(email) {
        return authClient.forgotPassword(email);
      },

      resetPassword(token, password) {
        return authClient.resetPassword(token, password);
      },

      async verifyEmail(token) {
        const result = await authClient.verifyEmail(token);
        setUser((current) => (current?.id === result.user.id ? result.user : current));
        return result;
      },

      async resendEmailVerification() {
        const token = await ensureCsrf();
        return authClient.resendEmailVerification(token);
      },
    }),
    [csrfToken, ensureCsrf, loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
