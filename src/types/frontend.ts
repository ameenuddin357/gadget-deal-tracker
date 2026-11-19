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
  product_type?: string;
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
  product_url?: string;
  price_history?: Array<{ price: number; date: string }>;
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
  purchase_outlet?: string;
  product_url?: string;
  price_history?: Array<{ price: number; date: string }>;
}

export interface DetailedSearchHistoryItem {
  history_id?: number;
  query: string;
  search_term?: string;
  searched_at?: string;
  last_searched_at?: string;
  created_at?: string;
  product_id?: number;
  product_name?: string;
  product_image?: string;
  lowest_price?: number;
  store_name?: string;
}

export interface AdminSourceBreakdown {
  source: string;
  count: number;
}

export interface AdminCategoryBreakdown {
  category_name: string;
  count: number;
}

export interface AdminQuotaService {
  monthly_cap: number;
  calls_used_this_cycle: number;
  calls_remaining: number;
  offset_value?: number;
  days_until_reset: number;
}

export interface AdminQuotaDashboard {
  amazon?: AdminQuotaService;
  google?: AdminQuotaService;
  flipkart?: AdminQuotaService;
  billing_cycle_start?: string;
  billing_cycle_end?: string;
}

export interface AdminReport {
  total_products: number;
  source_breakdown: AdminSourceBreakdown[];
  category_breakdown: AdminCategoryBreakdown[];
  quota_dashboard: AdminQuotaDashboard;
}

export interface AdminProduct {
  product_id: number;
  name: string;
  brand: string;
  model_no?: string | null;
  slug: string;
  canonical_slug?: string | null;
  storage_variant?: string | null;
  color_variant?: string | null;
  category_id: number;
  category_name: string;
  product_type: string;
  data_source: string;
  image_url?: string | null;
  description?: string | null;
  specs_summary?: string | null;
  release_date?: string | null;
  is_active: boolean;
  created_at: string;
  retailer_offer_count: number;
  available_offer_count: number;
  lowest_available_price: number | string | null;
}

export interface AdminPagination {
  page: number;
  currentPage: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface AdminProductListResponse {
  products: AdminProduct[];
  pagination: AdminPagination;
  results: number;
}

export interface AdminCategory {
  category_id: number;
  name: string;
  slug: string;
}

export interface AdminStore {
  store_id: number;
  name: string;
  domain: string;
  api_enabled: boolean;
}

export interface CreateAdminProductPayload {
  name: string;
  brand: string;
  category_id: number;
  model_no?: string;
  canonical_slug?: string;
  storage_variant?: string;
  color_variant?: string;
  image_url?: string;
  description?: string;
  specs_summary?: string;
  release_date?: string;
  // Initial retailer offer fields (atomic requirement):
  store_id: number;
  price: number;
  original_price?: number | null;
  product_url: string;
  is_available?: boolean;
}

export interface UpdateAdminProductPayload {
  name?: string;
  brand?: string;
  category_id?: number;
  model_no?: string | null;
  canonical_slug?: string | null;
  storage_variant?: string | null;
  color_variant?: string | null;
  image_url?: string | null;
  description?: string | null;
  specs_summary?: string | null;
  release_date?: string | null;
}

export interface AdminOfferProduct {
  product_id: number;
  name: string;
  brand: string;
  model_no?: string | null;
  is_active: boolean;
  data_source: string;
}

export interface AdminRetailerOffer {
  price_id: number | string;
  product_id: number;
  store_id: number;
  store_name: string;
  store_domain: string;
  store_logo_url?: string | null;
  store_api_enabled: boolean;
  price: number | string;
  original_price: number | string | null;
  discount: number | string;
  product_url: string;
  is_available: boolean;
  manual_override: boolean;
  last_scraped_at: string | null;
  created_at: string;
}

export interface AdminProductOffersResponse {
  product: AdminOfferProduct;
  offers: AdminRetailerOffer[];
}

export interface CreateAdminOfferPayload {
  store_id: number;
  price: number;
  original_price?: number | null;
  product_url: string;
  is_available?: boolean;
}

export interface UpdateAdminOfferPayload {
  price?: number;
  original_price?: number | null;
  product_url?: string;
}

export interface AdminSyncSourceBreakdownItem {
  source: string;
  count: number;
}

export interface AdminSyncOverview {
  total_products: number;
  source_breakdown: AdminSyncSourceBreakdownItem[];
  manual_overrides_locked: number;
  total_rotation_keywords: number;
}

export interface AdminSyncBillingCycle {
  start_date: string;
  end_date: string;
  days_until_reset: number;
}

export interface AdminSyncSourceItem {
  source: 'amazon' | 'google' | 'flipkart' | string;
  display_name: string;
  activity_status: 'RECORDED_ACTIVITY' | 'NO_RECORDED_ACTIVITY';
  configured_app_cap: number;
  calls_used_this_cycle: number;
  calls_remaining: number;
  calibration_offset: number;
  last_recorded_call_at: string | null;
  last_sync_snapshot_at: string | null;
}

export interface AdminSyncSnapshotItem {
  keyword: string;
  source: string;
  last_synced_at: string;
  result_count: number;
}

export interface AdminRotationKeywordItem {
  keyword: string;
  category_name: string;
  last_synced_at: string | null;
}

export interface AdminRotationCatalogue {
  total_keywords: number;
  with_last_synced_at: number;
  without_last_synced_at: number;
  keywords: AdminRotationKeywordItem[];
}

export interface AdminSyncStatusData {
  overview: AdminSyncOverview;
  billing_cycle: AdminSyncBillingCycle;
  sources: AdminSyncSourceItem[];
  sync_snapshots: AdminSyncSnapshotItem[];
  rotation_catalogue: AdminRotationCatalogue;
}

export interface AdminSyncStatusResponse {
  status: string;
  data: AdminSyncStatusData;
}

