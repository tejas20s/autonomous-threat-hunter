import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, setAuthToken, getStoredToken } from '../api/client';
import type { AuthUser } from '../types';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isAnalyst: boolean;
  isViewer: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from stored token on mount
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      setAuthToken(token);
      api.getMe()
        .then((me) => {
          setUser({
            token,
            username: me.username,
            role: me.role as AuthUser['role'],
            full_name: me.full_name,
          });
        })
        .catch(() => {
          // Token invalid — clear
          setAuthToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const authUser = await api.login(username, password);
    setAuthToken(authUser.token, (authUser as any).refresh_token);
    setUser(authUser);
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch {}
    setAuthToken(null);
    setUser(null);
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAdmin: user?.role === 'Admin',
    isAnalyst: user?.role === 'Admin' || user?.role === 'Analyst',
    isViewer: user?.role === 'Viewer',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
