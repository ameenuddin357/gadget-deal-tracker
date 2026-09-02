export interface User {
  userId: number;
  username: string;
  email: string;
  role: string;
}

export interface Product {
  product_id: number;
  name: string;
  brand: string;
  model_no?: string;
  slug: string;
  image_url: string;
  specs_summary: string;
  category_name: string;
  cheapest_price?: number;
  original_price?: number;
  price_drop_pct?: number;
  discount_pct?: number;
  store_name?: string;
  is_stale?: boolean;
  last_scraped_at?: string;
}

export interface StorePricing {
  price_id: number;
  price: number;
  original_price: number;
  discount: number;
  product_url: string;
  is_available: boolean;
  last_scraped_at: string;
  store_name: string;
  store_rating: number;
  store_logo?: string;
  is_stale?: boolean;
}

export interface WatchlistEntry {
  watchlist_id: number;
  added_at: string;
  product_id: number;
  product_name: string;
  brand: string;
  specs_summary: string;
  image_url: string;
  lowest_live_price?: number;
  purchase_outlet?: string;
}

export interface PriceAlert {
  alert_id: number;
  target_price: number;
  is_active: boolean;
  alert_sent: boolean;
  created_at: string;
  product_id: number;
  product_name: string;
  brand: string;
  image_url: string;
  lowest_live_price?: number;
}

export interface DetailedSearchHistoryItem {
  query: string;
  last_searched_at: string;
  product_id?: number;
  product_name?: string;
  product_image?: string;
  lowest_price?: number;
}

