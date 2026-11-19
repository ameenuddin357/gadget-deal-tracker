import axios from 'axios';
import { 
  Product, StorePricing, WatchlistEntry, PriceAlert, User, AdminReport,
  AdminProduct, AdminPagination, AdminProductListResponse, AdminCategory, AdminStore,
  CreateAdminProductPayload, UpdateAdminProductPayload,
  AdminProductOffersResponse, AdminRetailerOffer, CreateAdminOfferPayload, UpdateAdminOfferPayload,
  AdminSyncStatusData
} from '../types/frontend';

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
  async err => {
    const config = err.config;
    if (
      config &&
      (config.method === 'get' || !config.method) &&
      !config._retry &&
      (err.response?.status === 503 || !err.response)
    ) {
      config._retry = true;
      await new Promise(r => setTimeout(r, 400));
      return apiClient(config);
    }

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

export const fetchCurrentUser = async (): Promise<User> => {
  const res = await apiClient.get('/auth/me');
  return res.data.data.user;
};

export const registerUser = async (username: string, email: string, password: string) => {
  const res = await apiClient.post('/auth/register', { username, email, password });
  return res.data;
};

export const verifyEmail = async (token: string) => {
  const res = await apiClient.post('/auth/verify-email', { token });
  return res.data;
};

export const resendVerificationEmail = async (email: string) => {
  const res = await apiClient.post('/auth/resend-verification', { email });
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

export const fetchProducts = async (
  page = 1,
  limit = 12,
  category?: string,
  search?: string,
  minPrice?: number,
  maxPrice?: number,
  sort?: string,
  store?: string,
  type?: string
) => {
  const params: any = { page, limit };
  if (category) params.category = category;
  if (type && type !== 'All') params.type = type;
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

export const updatePriceAlert = async (alertId: number, targetPrice: number) => {
  const res = await apiClient.put(`/alerts/${alertId}`, { targetPrice });
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

export const fetchAdminReport = async (): Promise<AdminReport> => {
  const res = await apiClient.get('/admin/report');
  return res.data.data;
};

export const fetchAdminProducts = async (params?: {
  search?: string;
  status?: 'all' | 'active' | 'inactive';
  page?: number;
  limit?: number;
}): Promise<AdminProductListResponse> => {
  const queryParams: Record<string, string | number> = {};
  if (params?.search) queryParams.search = params.search;
  if (params?.status) queryParams.status = params.status;
  if (params?.page) queryParams.page = params.page;
  if (params?.limit) queryParams.limit = params.limit;

  const res = await apiClient.get('/admin/products', { params: queryParams });
  return {
    products: res.data.data.products,
    pagination: res.data.pagination,
    results: res.data.results
  };
};

export const createAdminProduct = async (payload: CreateAdminProductPayload): Promise<{ product: AdminProduct }> => {
  const res = await apiClient.post('/admin/products', payload);
  return res.data.data;
};

export const updateAdminProduct = async (productId: number, payload: UpdateAdminProductPayload): Promise<{ product: AdminProduct }> => {
  const res = await apiClient.patch(`/admin/products/${productId}`, payload);
  return res.data.data;
};

export const deactivateAdminProduct = async (productId: number): Promise<any> => {
  const res = await apiClient.patch(`/admin/products/${productId}/deactivate`);
  return res.data.data;
};

export const reactivateAdminProduct = async (productId: number): Promise<any> => {
  const res = await apiClient.patch(`/admin/products/${productId}/reactivate`);
  return res.data.data;
};

export const fetchAdminCategories = async (): Promise<AdminCategory[]> => {
  const res = await apiClient.get('/admin/categories');
  return res.data.data.categories;
};

export const fetchAdminStores = async (): Promise<AdminStore[]> => {
  const res = await apiClient.get('/admin/stores');
  return res.data.data.stores;
};

export const fetchAdminProductOffers = async (productId: number): Promise<AdminProductOffersResponse> => {
  const res = await apiClient.get(`/admin/products/${productId}/offers`);
  return res.data.data;
};

export const createAdminProductOffer = async (
  productId: number,
  payload: CreateAdminOfferPayload
): Promise<{ offer: AdminRetailerOffer }> => {
  const res = await apiClient.post(`/admin/products/${productId}/offers`, payload);
  return res.data.data;
};

export const updateAdminOffer = async (
  priceId: number | string,
  payload: UpdateAdminOfferPayload
): Promise<{ offer: AdminRetailerOffer; changed: boolean; priceChanged: boolean }> => {
  const res = await apiClient.patch(`/admin/offers/${priceId}`, payload);
  return res.data.data;
};

export const setAdminOfferAvailability = async (
  priceId: number | string,
  isAvailable: boolean
): Promise<{ offer: AdminRetailerOffer }> => {
  const res = await apiClient.patch(`/admin/offers/${priceId}/availability`, { is_available: isAvailable });
  return res.data.data;
};

export const fetchAdminSyncStatus = async (): Promise<AdminSyncStatusData> => {
  const res = await apiClient.get('/admin/sync-status');
  return res.data.data;
};

export const updateAdminEmail = async (payload: {
  currentPassword: string;
  newEmail: string;
  confirmEmail: string;
}): Promise<{ status: string; message: string; data?: { user: any } }> => {
  const res = await apiClient.patch('/admin/account/email', payload);
  return res.data;
};

