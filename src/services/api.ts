import axios from 'axios';
import { Product, StorePricing, WatchlistEntry, PriceAlert, User } from '../types/frontend';

const API_BASE_URL = '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 25000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('deal_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (err) => Promise.reject(err));

apiClient.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('deal_token');
      localStorage.removeItem('deal_user');
      window.dispatchEvent(new Event('auth-expired'));
    } else if (!err.response || err.response.status >= 500) {
      console.error("API call failed:", err.response?.data || err.message);
    }
    throw err.response?.data || err;
  }
);

export const loginUser = async (email: string, password: string) => {
  const res = await apiClient.post('/auth/login', { email, password });
  return res.data;
};

export const registerUser = async (username: string, email: string, password: string) => {
  const res = await apiClient.post('/auth/register', { username, email, password });
  return res.data;
};

export const requestForgotPassword = async (email: string) => {
  const res = await apiClient.post('/auth/forgot-password', { email });
  return res.data;
};

export const validatePasswordResetToken = async (token: string, email?: string) => {
  const res = await apiClient.get('/auth/reset-password/validate', {
    params: { token, email }
  });
  return res.data;
};

export const executePasswordReset = async (token: string, email: string, newPassword: string) => {
  const res = await apiClient.post('/auth/reset-password', { token, email, newPassword });
  return res.data;
};

export const fetchDashboardStats = async () => {
  const res = await apiClient.get('/dashboard/stats');
  return res.data.data;
};

export const fetchDashboardDeals = async () => {
  const res = await apiClient.get('/dashboard/best-deals');
  return res.data.data?.deals || [];
};

export const fetchDashboardDrops = async () => {
  const res = await apiClient.get('/dashboard/price-drops');
  return res.data.data?.priceDrops || [];
};

export const fetchProducts = async (page = 1, limit = 12, category?: string, search?: string, minPrice?: number, maxPrice?: number, sort?: string, store?: string) => {
  const params: any = { page, limit };
  if (category) params.category = category;
  if (search) params.search = search;
  if (minPrice) params.min_price = minPrice;
  if (maxPrice) params.max_price = maxPrice;
  if (sort) params.sort = sort;
  if (store && store !== 'All Stores') params.store = store;

  const res = await apiClient.get('/products', { params });
  const pagination = res.data.pagination || res.data.data?.pagination || { totalItems: 0, currentPage: 1, totalPages: 1, limit };
  return { 
    products: res.data.data?.products || [], 
    pagination,
    interpretation: res.data.data?.interpretation || null
  };
};

export const fetchProductDetails = async (id: number) => {
  const res = await apiClient.get(`/products/${id}`);
  return res.data.data;
};

export const fetchWatchlist = async () => {
  const res = await apiClient.get('/watchlist');
  return res.data.data.watchlist || [];
};

export const addToWatchlist = async (productId: number) => {
  const res = await apiClient.post('/watchlist', { productId });
  return res.data;
};

export const removeFromWatchlist = async (watchlistId: number) => {
  await apiClient.delete(`/watchlist/${watchlistId}`);
};

export const fetchPriceAlerts = async () => {
  const res = await apiClient.get('/alerts');
  return res.data.data.alerts || [];
};

export const createPriceAlert = async (productId: number, targetPrice: number) => {
  const res = await apiClient.post('/alerts', { productId, targetPrice });
  return res.data;
};

export const deletePriceAlert = async (alertId: number) => {
  await apiClient.delete(`/alerts/${alertId}`);
};

export const fetchPriceHistory = async (productId: number) => {
  try {
    const res = await apiClient.get(`/products/${productId}/history`);
    return Array.isArray(res.data.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
  } catch (err: any) {
    console.warn(`Price history fetch failed for product ${productId}:`, err?.message || err);
    return [];
  }
};

export const fetchProductAiRecommendation = async (productId: number) => {
  const res = await apiClient.get(`/products/${productId}/ai-recommendation`, { timeout: 30000 });
  return res.data;
};

export const sendProductAiChat = async (
  productId: number,
  question: string,
  history?: { role: 'user' | 'assistant'; content: string }[]
) => {
  const res = await apiClient.post(`/products/${productId}/ai-chat`, { question, history }, { timeout: 30000 });
  return res.data;
};

export const getDetailedSearchHistory = async () => {
  const res = await apiClient.get('/history');
  return res.data.data.history || [];
};

export const addSearchHistory = async (query: string) => {
  if (!query) return;
  try {
    await apiClient.post('/history', { query });
  } catch (err) {}
};

export const deleteSearchQueryFromDB = async (query: string) => {
  await apiClient.delete('/history/item', { data: { query } });
};

export const clearSearchHistoryFromDB = async () => {
  await apiClient.delete('/history');
};
