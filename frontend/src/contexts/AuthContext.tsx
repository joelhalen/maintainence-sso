import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../api/client';
import { User, Permission } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (...permissions: Permission[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const getStoredAuth = (): AuthState => {
  try {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('auth_user');
    if (token && user) return { token, user: JSON.parse(user) };
  } catch {}
  return { token: null, user: null };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(getStoredAuth);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    setAuth({ token: data.token, user: data.user });
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setAuth({ token: null, user: null });
    window.location.href = '/login';
  }, []);

  const hasPermission = useCallback(
    (p: Permission) => auth.user?.role?.permissions?.includes(p) ?? false,
    [auth.user]
  );

  const hasAnyPermission = useCallback(
    (...ps: Permission[]) => ps.some((p) => auth.user?.role?.permissions?.includes(p) ?? false),
    [auth.user]
  );

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, hasPermission, hasAnyPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
