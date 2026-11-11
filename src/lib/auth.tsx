import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { User } from './types';

export interface OtpRequestResult {
  message: string;
  resend_after: number;
  /** "terminal" only when running locally without SMTP: the code is printed in the npm run dev terminal */
  delivery: 'email' | 'terminal';
}

interface AuthValue {
  user: User | null;
  loading: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  /** Step 1 of login: email a one-time code. */
  requestOtp: (email: string) => Promise<OtpRequestResult>;
  /** Step 2 of login: check the code and start the session. */
  verifyOtp: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutEverywhere: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: User }>('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    const onUnauthorized = () => setUser(null);
    window.addEventListener('pfm:unauthorized', onUnauthorized);
    return () => window.removeEventListener('pfm:unauthorized', onUnauthorized);
  }, []);

  const requestOtp = useCallback((email: string) => api<OtpRequestResult>('/auth/request-otp', 'POST', { email }), []);

  const verifyOtp = useCallback(async (email: string, code: string) => {
    const d = await api<{ user: User }>('/auth/verify-otp', 'POST', { email, code });
    setUser(d.user);
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', 'POST').catch(() => {});
    setUser(null);
  }, []);

  const logoutEverywhere = useCallback(async () => {
    await api('/auth/logout-all', 'POST');
    setUser(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      canEdit: user?.role === 'admin' || user?.role === 'editor',
      isAdmin: user?.role === 'admin',
      requestOtp,
      verifyOtp,
      logout,
      logoutEverywhere,
    }),
    [user, loading, requestOtp, verifyOtp, logout, logoutEverywhere],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
