import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../types/frontend';
import { 
  loginUser, 
  registerUser, 
  requestForgotPassword, 
  executePasswordReset 
} from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
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

  // Load existing credentials from localStorage on cold-start
  useEffect(() => {
    const savedToken = localStorage.getItem('deal_token');
    const savedUser = localStorage.getItem('deal_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('deal_token');
        localStorage.removeItem('deal_user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loginUser(email, password);
      setToken(data.token);
      setUser(data.data.user);
      localStorage.setItem('deal_token', data.token);
      localStorage.setItem('deal_user', JSON.stringify(data.data.user));
    } catch (err: any) {
      let msg = err.response?.data?.message || err.message || 'Login failed. Please retry.';
      if (err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
        msg = 'Unable to connect to the server. Please try again.';
      }
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await registerUser(username, email, password);
      setToken(data.token);
      setUser(data.data.user);
      localStorage.setItem('deal_token', data.token);
      localStorage.setItem('deal_user', JSON.stringify(data.data.user));
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
      localStorage.removeItem('deal_token');
      localStorage.removeItem('deal_user');
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
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
