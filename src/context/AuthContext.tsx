import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../types/frontend';
import { 
  loginUser, 
  registerUser, 
  requestForgotPassword, 
  executePasswordReset,
  fetchWatchlist,
  fetchPriceAlerts,
  fetchCurrentUser
} from '../services/api';
import { getCompareProductIds } from '../utils/compare';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  watchlistCount: number;
  compareCount: number;
  alertCount: number;
  refreshWatchlistCount: () => Promise<void>;
  refreshAlertsCount: () => Promise<void>;
  refreshCompareCount: () => void;
  refreshAllCounts: () => Promise<void>;
  login: (email: string, password: string) => Promise<any>;
  register: (username: string, email: string, password: string) => Promise<any>;
  requestPasswordReset: (email: string) => Promise<{ status: string; message: string }>;
  submitPasswordReset: (token: string, email: string, newPassword: string) => Promise<{ status: string; message: string }>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [watchlistCount, setWatchlistCount] = useState<number>(0);
  const [compareCount, setCompareCount] = useState<number>(0);
  const [alertCount, setAlertCount] = useState<number>(0);

  const refreshCompareCount = useCallback(() => {
    try {
      const ids = getCompareProductIds();
      setCompareCount(ids.length);
    } catch {
      setCompareCount(0);
    }
  }, []);

  const refreshWatchlistCount = useCallback(async () => {
    const savedToken = localStorage.getItem('deal_token');
    if (!savedToken) {
      setWatchlistCount(0);
      return;
    }
    try {
      const items = await fetchWatchlist();
      if (Array.isArray(items)) {
        setWatchlistCount(items.length);
      }
    } catch {
      // Keep existing count on transient error
    }
  }, []);

  const refreshAlertsCount = useCallback(async () => {
    const savedToken = localStorage.getItem('deal_token');
    if (!savedToken) {
      setAlertCount(0);
      return;
    }
    try {
      const alerts = await fetchPriceAlerts();
      if (Array.isArray(alerts)) {
        const activeAlerts = alerts.filter(a => a.is_active !== false);
        setAlertCount(activeAlerts.length);
      }
    } catch {
      // Keep existing count on transient error
    }
  }, []);

  const refreshAllCounts = useCallback(async () => {
    refreshCompareCount();
    await Promise.allSettled([refreshWatchlistCount(), refreshAlertsCount()]);
  }, [refreshCompareCount, refreshWatchlistCount, refreshAlertsCount]);

  // Load existing credentials from localStorage on cold-start and revalidate with authoritative backend
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const savedToken = localStorage.getItem('deal_token');
      const savedUser = localStorage.getItem('deal_user');

      if (savedToken) {
        // Optimistically set state from local storage for immediate UI layout responsiveness
        if (savedUser) {
          try {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
          } catch {
            // Safe JSON fallback
          }
        }

        // Authoritatively re-validate credentials and role against GET /api/auth/me
        try {
          const verifiedUser = await fetchCurrentUser();
          if (isMounted) {
            setUser(verifiedUser);
            setToken(savedToken);
            localStorage.setItem('deal_user', JSON.stringify(verifiedUser));
          }
        } catch {
          if (isMounted) {
            // Token is expired, invalid, or user was deleted
            setToken(null);
            setUser(null);
            localStorage.removeItem('deal_token');
            localStorage.removeItem('deal_user');
          }
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch counts on user login/status change
  useEffect(() => {
    if (user) {
      refreshAllCounts();
    } else {
      setWatchlistCount(0);
      setAlertCount(0);
      refreshCompareCount();
    }
  }, [user, refreshAllCounts, refreshCompareCount]);

  // Listen to custom cross-component update events
  useEffect(() => {
    refreshCompareCount();

    const handleCompareUpdate = () => refreshCompareCount();
    const handleWatchlistUpdate = () => refreshWatchlistCount();
    const handleAlertsUpdate = () => refreshAlertsCount();

    window.addEventListener('deal-compare-updated', handleCompareUpdate);
    window.addEventListener('watchlist-updated', handleWatchlistUpdate);
    window.addEventListener('alerts-updated', handleAlertsUpdate);
    window.addEventListener('storage', handleCompareUpdate);

    return () => {
      window.removeEventListener('deal-compare-updated', handleCompareUpdate);
      window.removeEventListener('watchlist-updated', handleWatchlistUpdate);
      window.removeEventListener('alerts-updated', handleAlertsUpdate);
      window.removeEventListener('storage', handleCompareUpdate);
    };
  }, [refreshCompareCount, refreshWatchlistCount, refreshAlertsCount]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loginUser(email, password);
      setToken(data.token);
      setUser(data.data.user);
      localStorage.setItem('deal_token', data.token);
      localStorage.setItem('deal_user', JSON.stringify(data.data.user));
      return data;
    } catch (err: any) {
      let msg = err.response?.data?.message || err.message || 'Login failed. Please retry.';
      if (err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
        msg = 'Unable to connect to the server. Please try again.';
      }
      setError(msg);
      const customErr: any = new Error(msg);
      if (err.code || err.response?.data?.code) {
        customErr.code = err.code || err.response?.data?.code;
      }
      throw customErr;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await registerUser(username, email, password);
      // When email verification is disabled, backend issues auth token and user
      if (res.token && res.data?.user) {
        setToken(res.token);
        setUser(res.data.user);
        localStorage.setItem('deal_token', res.token);
        localStorage.setItem('deal_user', JSON.stringify(res.data.user));
      }
      return res;
    } catch (err: any) {
      let msg = err.response?.data?.message || err.message || 'Registration failed. Please retry.';
      if (err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
        msg = 'Unable to connect to the server. Please try again.';
      }
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    setError(null);
    try {
      const res = await requestForgotPassword(email);
      return res;
    } catch (err: any) {
      let msg = err.response?.data?.message || err.message || 'Failed to request password reset.';
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const submitPasswordReset = useCallback(async (resetToken: string, email: string, newPassword: string) => {
    setError(null);
    try {
      const res = await executePasswordReset(resetToken, email, newPassword);
      return res;
    } catch (err: any) {
      let msg = err.response?.data?.message || err.message || 'Password reset failed.';
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      setToken(null);
      setUser(null);
      setWatchlistCount(0);
      setAlertCount(0);
      localStorage.removeItem('deal_token');
      localStorage.removeItem('deal_user');
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setWatchlistCount(0);
    setAlertCount(0);
    localStorage.removeItem('deal_token');
    localStorage.removeItem('deal_user');
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      error, 
      watchlistCount,
      compareCount,
      alertCount,
      refreshWatchlistCount,
      refreshAlertsCount,
      refreshCompareCount,
      refreshAllCounts,
      login, 
      register, 
      requestPasswordReset,
      submitPasswordReset,
      logout, 
      clearError 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be invoked inside an AuthProvider wrapper.');
  }
  return context;
}
