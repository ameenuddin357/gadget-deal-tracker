import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types/frontend';
import { loginUser, registerUser } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
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

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loginUser(email, password);
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('deal_token', data.token);
      localStorage.setItem('deal_user', JSON.stringify(data.user));
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Login failed. Please retry.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await registerUser(username, email, password);
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('deal_token', data.token);
      localStorage.setItem('deal_user', JSON.stringify(data.user));
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Registration failed. Please retry.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('deal_token');
    localStorage.removeItem('deal_user');
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, register, logout, clearError }}>
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
