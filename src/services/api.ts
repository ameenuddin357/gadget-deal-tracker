import axios from 'axios';
import { Product, StorePricing, WatchlistEntry, PriceAlert, User } from '../types/frontend';
import * as db from './mockData';

const API_BASE_URL = '/api';

// Create safe Axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
});

// Attach JWT token automatically to outgoing requests if configured
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('deal_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (err) => {
  return Promise.reject(err);
});

// Helper to get active user ID safely from context/localStorage
const getActiveUserId = (): number => {
  const userStr = localStorage.getItem('deal_user');
  if (userStr) {
    try {
      const u = JSON.parse(userStr) as User;
      return u.userId;
    } catch {}
  }
  return 999; // Default sandbox user ID
};

/**
 * Authentication Queries
 */
export const loginUser = async (email: string, password: string): Promise<{ token: string; user: User }> => {
  try {
    const res = await apiClient.post('/auth/login', { email, password });
    if (res.data && res.data.status === 'success' && res.data.data) {
      return res.data.data;
    }
    return res.data;
  } catch (error) {
    console.warn("API Server unreached/error. Falling back to frontend mock authentication.", error);
    
    // Fallback Mock authentication
    const users: any[] = JSON.parse(localStorage.getItem('deal_users') || '[]');
    const matched = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    
    if (!matched) {
      throw new Error("Invalid email or password combination. Try 'admin@dealtracker.com' with 'password123'.");
    }

    const payload = {
      token: "mock-jwt-token-xyz-123456",
      user: {
        userId: matched.userId,
        username: matched.username,
        email: matched.email,
        role: matched.role || 'user'
      }
    };
    return payload;
  }
};

export const registerUser = async (username: string, email: string, password: string): Promise<{ token: string; user: User }> => {
  try {
    const res = await apiClient.post('/auth/register', { username, email, password });
    if (res.data && res.data.status === 'success' && res.data.data) {
      return res.data.data;
    }
    return res.data;
  } catch (error) {
    console.warn("API Server unreached/error. Registering on frontend mock catalog store.", error);

    const users: any[] = JSON.parse(localStorage.getItem('deal_users') || '[]');
    const dup = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (dup) {
      throw new Error("An account with this email address already exists.");
    }

    const newUser = {
      userId: Math.floor(Math.random() * 500000) + 1000,
      username,
      email,
      password,
      role: 'user'
    };

    users.push(newUser);
    localStorage.setItem('deal_users', JSON.stringify(users));

    return {
      token: "mock-jwt-token-xyz-654321",
      user: {
        userId: newUser.userId,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      }
    };
  }
};

/**
 * Product Queries
 */
export const fetchProducts = async (search?: string, category?: string): Promise<Product[]> => {
  try {
    const res = await apiClient.get('/products', { params: { search, category } });
    if (res.data && res.data.status === 'success' && res.data.data) {
      return res.data.data.products;
    }
    return Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    console.debug("Backend Products API failed. Fetching from LocalStorage mock catalog.", error);
    let items = db.getDBProducts();
    
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.specs_summary.toLowerCase().includes(q));
    }
    if (category) {
      items = items.filter(p => p.category_name.toLowerCase() === category.toLowerCase());
    }
    return items;
  }
};

export const fetchProductDetails = async (id: number): Promise<{ product: Product; storesPricing: StorePricing[] }> => {
  try {
    const res = await apiClient.get(`/products/${id}`);
    if (res.data && res.data.status === 'success' && res.data.data) {
      return res.data.data;
    }
    return res.data;
  } catch (error) {
    console.debug(`Backend Product Detail API (${id}) failed. Extracting from Local Database.`, error);
    const detail = db.getDBProductById(id);
    if (!detail) {
      throw new Error("Target gadget could not be found.");
    }
    return detail;
  }
};

/**
 * Watchlist Operations
 */
export const fetchWatchlist = async (): Promise<WatchlistEntry[]> => {
  try {
    const res = await apiClient.get('/watchlist');
    if (res.data && res.data.status === 'success' && res.data.data) {
      return res.data.data.watchlist;
    }
    return Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    console.debug("Backend Watchlist API failed. Reading from persistent Local Database.", error);
    return db.getDBWatchlist(getActiveUserId());
  }
};

export const addToWatchlist = async (productId: number): Promise<WatchlistEntry> => {
  try {
    // Send both variants of naming keys to accommodate backend request.body parsers
    const res = await apiClient.post('/watchlist', { productId, product_id: productId });
    if (res.data && res.data.status === 'success' && res.data.data) {
      return res.data.data.watchlistEntry;
    }
    return res.data;
  } catch (error) {
    console.debug("Backend Watchlist Add failed. Syncing local list.", error);
    return db.addToDBWatchlist(getActiveUserId(), productId);
  }
};

export const removeFromWatchlist = async (watchlistId: number): Promise<void> => {
  try {
    await apiClient.delete(`/watchlist/${watchlistId}`);
  } catch (error) {
    console.debug("Backend Watchlist Delete failed; updating offline cache list.", error);
    db.removeFromDBWatchlist(getActiveUserId(), watchlistId);
  }
};

/**
 * Price Alert Operations
 */
export const fetchPriceAlerts = async (): Promise<PriceAlert[]> => {
  try {
    const res = await apiClient.get('/alerts');
    if (res.data && res.data.status === 'success' && res.data.data) {
      return res.data.data.alerts;
    }
    return Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    console.debug("Backend Price Alerts API failed. Retrieving from local DB storage.", error);
    return db.getDBAlerts(getActiveUserId());
  }
};

export const createPriceAlert = async (productId: number, targetPrice: number): Promise<PriceAlert> => {
  try {
    // Send both camelCase and snake_case body variants to avoid parsing mismatches
    const res = await apiClient.post('/alerts', { 
      productId, 
      product_id: productId, 
      targetPrice, 
      target_price: targetPrice 
    });
    if (res.data && res.data.status === 'success' && res.data.data) {
      return res.data.data.alert;
    }
    return res.data;
  } catch (error) {
    console.debug("Backend Create Alert failed. Inserting in local DB storage.", error);
    return db.createDBAlert(getActiveUserId(), productId, targetPrice);
  }
};

export const removePriceAlert = async (alertId: number): Promise<void> => {
  try {
    await apiClient.delete(`/alerts/${alertId}`);
  } catch (error) {
    console.debug("Backend Delete Alert failed. Purging from local DB storage.", error);
    db.deleteDBAlert(getActiveUserId(), alertId);
  }
};

/**
 * Historical Price Tracking Queries
 */
export const fetchPriceHistory = async (productId: number): Promise<any[]> => {
  try {
    const res = await apiClient.get(`/products/${productId}/history`);
    return res.data;
  } catch {
    return db.getDBPriceHistory(productId);
  }
};

/**
 * 6-Hour Scheduled Scraper Invoker
 */
export const triggerSixHourScheduler = async (): Promise<{ updatedCount: number; alertsTriggeredCount: number; triggers: any[] }> => {
  try {
    const res = await apiClient.post('/scheduler/update');
    return res.data;
  } catch {
    return db.runSixHourPriceScheduler();
  }
};

/**
 * Search History DB Operations
 */
export const fetchSearchHistory = async (): Promise<string[]> => {
  try {
    const res = await apiClient.get('/history');
    if (res.data && res.data.status === 'success' && res.data.data) {
      return res.data.data.history.map((h: any) => h.query);
    }
    return [];
  } catch (error) {
    console.debug("Backend Search History fetch failed. Reading from localstorage fallback.", error);
    try {
      const saved = localStorage.getItem('deal_search_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }
};

export const addSearchHistory = async (query: string, product?: Product): Promise<void> => {
  try {
    if (!query || query.trim() === '') return;
    const payload: any = { query };
    if (product) {
      payload.productName = product.name;
      payload.productImage = product.image_url;
      payload.lowestPrice = product.cheapest_price;
      payload.storeName = product.store_name;
    }
    await apiClient.post('/history', payload);
  } catch (error) {
    console.debug("Backend Search History post failed. Storing locally.", error);
  }
};

export const deleteSearchQueryFromDB = async (query: string): Promise<void> => {
  try {
    await apiClient.delete('/history/item', { data: { query } });
  } catch (error) {
    console.debug("Backend Search History delete item failed.", error);
  }
};

export const clearSearchHistoryFromDB = async (): Promise<void> => {
  try {
    await apiClient.delete('/history');
  } catch (error) {
    console.debug("Backend Search History clear failed.", error);
  }
};

export interface DetailedSearchHistoryItem {
  history_id: number;
  product_id: number | null;
  search_term: string;
  product_name: string | null;
  product_image: string | null;
  lowest_price: number | null;
  store_name: string | null;
  searched_at: string;
}

export const fetchDetailedSearchHistory = async (): Promise<DetailedSearchHistoryItem[]> => {
  try {
    const res = await apiClient.get('/history');
    if (res.data && res.data.status === 'success' && res.data.data) {
      const history = res.data.data.history;
      localStorage.setItem('deal_detailed_search_history', JSON.stringify(history));
      return history;
    }
    return [];
  } catch (error) {
    console.debug("Backend Detailed Search History fetch failed. Reading local fallback.", error);
    try {
      const saved = localStorage.getItem('deal_detailed_search_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }
};
