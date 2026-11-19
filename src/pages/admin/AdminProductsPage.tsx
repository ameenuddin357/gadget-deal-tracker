import React, { useEffect, useState, useTransition, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Search, Filter, RefreshCw, AlertCircle, 
  CheckCircle2, Package, Tag, Store, ExternalLink, Edit2, 
  EyeOff, Eye, X, ChevronLeft, ChevronRight, AlertTriangle,
  SlidersHorizontal, Check, Info
} from 'lucide-react';
import { 
  fetchAdminProducts, 
  createAdminProduct, 
  updateAdminProduct, 
  deactivateAdminProduct, 
  reactivateAdminProduct, 
  fetchAdminCategories, 
  fetchAdminStores 
} from '../../services/api';
import { 
  AdminProduct, 
  AdminPagination, 
  AdminCategory, 
  AdminStore, 
  CreateAdminProductPayload, 
  UpdateAdminProductPayload 
} from '../../types/frontend';
import { formatINR } from '../../utils/currency';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400';

/**
 * Filter out noisy machine-generated model strings (catalogid, productid, gpcid)
 * and aggressively truncate long values for clean display in compact rows.
 */
const formatDisplayModelNo = (model?: string | null): string | null => {
  if (!model) return null;
  const trimmed = model.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('catalogid') || 
    lower.includes('productid') || 
    lower.includes('gpcid') || 
    lower.includes('item_') ||
    lower.startsWith('sku_')
  ) {
    return null;
  }
  if (trimmed.length > 16) {
    return `${trimmed.slice(0, 14)}…`;
  }
  return trimmed;
};

export default function AdminProductsPage() {
  // Primary catalogue state
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [pagination, setPagination] = useState<AdminPagination>({
    page: 1,
    currentPage: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchInput, setSearchInput] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Lookup data for dropdowns
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [stores, setStores] = useState<AdminStore[]>([]);

  // Modals & Action States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [deactivatingProduct, setDeactivatingProduct] = useState<AdminProduct | null>(null);
  const [reactivatingProduct, setReactivatingProduct] = useState<AdminProduct | null>(null);

  // Form operation states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Debounce search input
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setActiveSearch(val.trim());
      setCurrentPage(1);
    }, 400);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    setCurrentPage(1);
  };

  const handleStatusChange = (status: 'all' | 'active' | 'inactive') => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  // Toast helper
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Fetch Lookups (categories & stores)
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [cats, strs] = await Promise.all([
          fetchAdminCategories(),
          fetchAdminStores(),
        ]);
        setCategories(cats || []);
        setStores(strs || []);
      } catch (err) {
        console.error('Failed to load admin category/store lookups:', err);
      }
    };
    loadLookups();
  }, []);

  // Fetch Products
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminProducts({
        search: activeSearch || undefined,
        status: statusFilter,
        page: currentPage,
        limit: 20,
      });
      setProducts(res.products);
      setPagination(res.pagination);
    } catch (err: any) {
      const msg = err?.message || err?.error || 'Failed to load products. Please check connection and retry.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [activeSearch, statusFilter, currentPage]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Handle Deactivation
  const handleConfirmDeactivate = async () => {
    if (!deactivatingProduct) return;
    setIsSubmitting(true);
    try {
      await deactivateAdminProduct(deactivatingProduct.product_id);
      showToast(`Product "${deactivatingProduct.name}" has been deactivated.`);
      setDeactivatingProduct(null);
      loadProducts();
    } catch (err: any) {
      const msg = err?.message || err?.error || 'Failed to deactivate product.';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Reactivation
  const handleConfirmReactivate = async () => {
    if (!reactivatingProduct) return;
    setIsSubmitting(true);
    try {
      await reactivateAdminProduct(reactivatingProduct.product_id);
      showToast(`Product "${reactivatingProduct.name}" reactivated successfully.`);
      setReactivatingProduct(null);
      loadProducts();
    } catch (err: any) {
      const msg = err?.message || err?.error || 'Failed to reactivate product.';
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Source Badge Formatter
  const renderSourceBadge = (source: string) => {
    switch (source) {
      case 'manual':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Manual
          </span>
        );
      case 'live_google':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Google
          </span>
        );
      case 'live_amazon':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Amazon
          </span>
        );
      case 'synthetic':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            Synthetic
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200 capitalize">
            {source.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 sm:gap-8 font-sans pb-12 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* Toast Notification */}
      {toast && (
        <div 
          id="admin-toast-banner"
          role="status"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
            toast.type === 'success' 
              ? 'bg-emerald-900 text-white border-emerald-700' 
              : 'bg-rose-900 text-white border-rose-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button 
            onClick={() => setToast(null)} 
            className="ml-2 text-white/70 hover:text-white"
            aria-label="Close notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <Link 
            to="/admin" 
            id="link-back-admin"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 mb-2 transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Admin Dashboard</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Admin Product Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
            Manage catalogue products, metadata, availability status, and manual additions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <button
            type="button"
            id="btn-refresh-products"
            onClick={() => loadProducts()}
            disabled={loading}
            aria-label="Refresh product list"
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors shadow-xs disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          <button
            type="button"
            id="btn-add-product"
            onClick={() => {
              setModalError(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="input-admin-search"
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by product name, brand, or model..."
            className="w-full pl-9 pr-8 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all min-h-[44px]"
          />
          {searchInput && (
            <button
              type="button"
              id="btn-clear-admin-search"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              aria-label="Clear search query"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start md:self-center">
          {(['all', 'active', 'inactive'] as const).map((st) => (
            <button
              key={st}
              id={`filter-status-${st}`}
              type="button"
              onClick={() => handleStatusChange(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all min-h-[36px] ${
                statusFilter === st
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Counts / Record Scope Summary */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">
            {pagination.totalItems} {pagination.totalItems === 1 ? 'product' : 'products'}
          </span>
          <span>•</span>
          <span>
            {statusFilter === 'all' 
              ? 'All active and inactive records' 
              : statusFilter === 'active' 
                ? 'Active catalog items only' 
                : 'Inactive / hidden items only'}
          </span>
        </div>

        {pagination.totalItems > 0 && (
          <div className="hidden sm:block">
            Showing {((currentPage - 1) * pagination.limit) + 1}–
            {Math.min(currentPage * pagination.limit, pagination.totalItems)} of {pagination.totalItems}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading && products.length === 0 ? (
        // Loading Skeleton
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        // Error Card
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-3">
          <AlertCircle className="w-8 h-8 text-rose-600" />
          <h3 className="text-sm font-bold text-rose-900">Failed to Retrieve Products</h3>
          <p className="text-xs text-rose-700 max-w-md">{error}</p>
          <button
            type="button"
            id="btn-retry-products"
            onClick={() => loadProducts()}
            className="mt-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors min-h-[40px]"
          >
            Retry Connection
          </button>
        </div>
      ) : products.length === 0 ? (
        // Empty State
        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-3">
          <Package className="w-12 h-12 text-slate-300 stroke-1" />
          <h3 className="text-base font-bold text-slate-900">No Products Found</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            {searchInput || statusFilter !== 'all'
              ? 'No catalog items match your current search criteria or status filter.'
              : 'No products are currently recorded in the database catalogue.'}
          </p>
          {(searchInput || statusFilter !== 'all') && (
            <button
              type="button"
              id="btn-reset-filters"
              onClick={() => {
                setSearchInput('');
                setActiveSearch('');
                setStatusFilter('all');
                setCurrentPage(1);
              }}
              className="mt-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-semibold transition-colors min-h-[40px]"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE (>= 1280px) */}
          <div className="hidden xl:block bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <table className="w-full table-fixed text-left border-collapse" id="admin-products-table">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-[38%]">Product</th>
                  <th className="py-3.5 px-4 w-[18%]">Category</th>
                  <th className="py-3.5 px-4 w-[18%]">Price & Offers</th>
                  <th className="py-3.5 px-4 text-center w-[10%]">Status</th>
                  <th className="py-3.5 px-4 text-right w-[16%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {products.map((p) => {
                  const lowestPriceNum = typeof p.lowest_available_price === 'string' 
                    ? parseFloat(p.lowest_available_price) 
                    : p.lowest_available_price;

                  const displayModel = formatDisplayModelNo(p.model_no);

                  return (
                    <tr 
                      key={p.product_id}
                      id={`admin-product-row-${p.product_id}`}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Product Column with integrated Source & ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/80 p-1 flex items-center justify-center shrink-0 overflow-hidden mt-0.5">
                            <img
                              referrerPolicy="no-referrer"
                              src={p.image_url || FALLBACK_IMAGE}
                              alt={p.name}
                              onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-slate-900 block truncate text-xs sm:text-sm" title={p.name}>
                              {p.name}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 truncate">
                              <span className="font-medium text-slate-700 shrink-0">{p.brand}</span>
                              {displayModel && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="truncate text-slate-400" title={p.model_no || ''}>
                                    Mod: {displayModel}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {renderSourceBadge(p.data_source)}
                              <span className="text-[10px] text-slate-400 font-mono">
                                #{p.product_id}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category & Classification Column */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-800 block truncate" title={p.category_name}>
                          {p.category_name}
                        </span>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 truncate max-w-full">
                          {p.product_type}
                        </span>
                      </td>

                      {/* Price & Offers Column */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 truncate">
                          {lowestPriceNum && !isNaN(lowestPriceNum) ? (
                            formatINR(lowestPriceNum)
                          ) : (
                            <span className="text-slate-400 font-normal">No active offer</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 whitespace-nowrap">
                          {p.available_offer_count} active / {p.retailer_offer_count} total
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="py-3.5 px-4 text-center">
                        {p.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions Column */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            id={`btn-edit-product-${p.product_id}`}
                            onClick={() => {
                              setModalError(null);
                              setEditingProduct(p);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-colors shadow-2xs"
                            title={`Edit ${p.name}`}
                            aria-label={`Edit ${p.name}`}
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                            <span>Edit</span>
                          </button>

                          {p.is_active ? (
                            <button
                              type="button"
                              id={`btn-deactivate-product-${p.product_id}`}
                              onClick={() => setDeactivatingProduct(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50/70 hover:bg-rose-100 border border-rose-200/80 transition-colors shadow-2xs"
                              title={`Deactivate ${p.name}`}
                              aria-label={`Deactivate ${p.name}`}
                            >
                              <EyeOff className="w-3.5 h-3.5 text-rose-600" />
                              <span>Deactivate</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              id={`btn-reactivate-product-${p.product_id}`}
                              onClick={() => setReactivatingProduct(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100 border border-emerald-200/80 transition-colors shadow-2xs"
                              title={`Reactivate ${p.name}`}
                              aria-label={`Reactivate ${p.name}`}
                            >
                              <Eye className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Reactivate</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* TABLET / COMPACT CARD VIEW (640px – 1279px) */}
          <div className="hidden sm:grid xl:hidden grid-cols-1 gap-3">
            {products.map((p) => {
              const lowestPriceNum = typeof p.lowest_available_price === 'string' 
                ? parseFloat(p.lowest_available_price) 
                : p.lowest_available_price;

              return (
                <div 
                  key={p.product_id}
                  id={`admin-product-tablet-card-${p.product_id}`}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200/80 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        referrerPolicy="no-referrer"
                        src={p.image_url || FALLBACK_IMAGE}
                        alt={p.name}
                        onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {p.is_active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            Inactive
                          </span>
                        )}
                        {renderSourceBadge(p.data_source)}
                        <span className="text-[10px] text-slate-400 font-mono">#{p.product_id}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 truncate max-w-md">
                        {p.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {p.brand} • {p.category_name} ({p.product_type})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900">
                        {lowestPriceNum && !isNaN(lowestPriceNum) ? (
                          formatINR(lowestPriceNum)
                        ) : (
                          <span className="text-slate-400 font-normal">No active offer</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {p.available_offer_count}/{p.retailer_offer_count} offers
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        id={`btn-tablet-edit-${p.product_id}`}
                        onClick={() => {
                          setModalError(null);
                          setEditingProduct(p);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs min-h-[38px] transition-colors"
                        title={`Edit ${p.name}`}
                        aria-label={`Edit ${p.name}`}
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit</span>
                      </button>

                      {p.is_active ? (
                        <button
                          type="button"
                          id={`btn-tablet-deactivate-${p.product_id}`}
                          onClick={() => setDeactivatingProduct(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-semibold shadow-2xs min-h-[38px] transition-colors"
                          title={`Deactivate ${p.name}`}
                          aria-label={`Deactivate ${p.name}`}
                        >
                          <EyeOff className="w-3.5 h-3.5 text-rose-600" />
                          <span>Deactivate</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          id={`btn-tablet-reactivate-${p.product_id}`}
                          onClick={() => setReactivatingProduct(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold shadow-2xs min-h-[38px] transition-colors"
                          title={`Reactivate ${p.name}`}
                          aria-label={`Reactivate ${p.name}`}
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Reactivate</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* MOBILE STACKED CARDS (< 640px) */}
          <div className="grid sm:hidden grid-cols-1 gap-3.5">
            {products.map((p) => {
              const lowestPriceNum = typeof p.lowest_available_price === 'string' 
                ? parseFloat(p.lowest_available_price) 
                : p.lowest_available_price;

              return (
                <div
                  key={p.product_id}
                  id={`admin-product-mobile-card-${p.product_id}`}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col gap-3.5"
                >
                  {/* Top: Status, Source, ID */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {p.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Inactive
                        </span>
                      )}
                      {renderSourceBadge(p.data_source)}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      ID #{p.product_id}
                    </span>
                  </div>

                  {/* Main: Thumbnail, Name, Brand, Classification */}
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200/80 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        referrerPolicy="no-referrer"
                        src={p.image_url || FALLBACK_IMAGE}
                        alt={p.name}
                        onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                        {p.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                        <span className="font-semibold text-slate-700">{p.brand}</span>
                        <span>•</span>
                        <span>{p.category_name}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-50 text-indigo-700">
                          {p.product_type}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing and Offers Row */}
                  <div className="flex items-center justify-between bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Lowest Rate</span>
                      <span className="font-bold text-slate-900">
                        {lowestPriceNum && !isNaN(lowestPriceNum) ? (
                          formatINR(lowestPriceNum)
                        ) : (
                          <span className="text-slate-400 font-normal">No active offer</span>
                        )}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">Retailers</span>
                      <span className="font-semibold text-slate-700">
                        {p.available_offer_count} active / {p.retailer_offer_count} total
                      </span>
                    </div>
                  </div>

                  {/* Actions Row: 44px touch targets */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      id={`btn-mobile-edit-${p.product_id}`}
                      onClick={() => {
                        setModalError(null);
                        setEditingProduct(p);
                      }}
                      className="w-full min-h-[44px] py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit</span>
                    </button>

                    {p.is_active ? (
                      <button
                        type="button"
                        id={`btn-mobile-deactivate-${p.product_id}`}
                        onClick={() => setDeactivatingProduct(p)}
                        className="w-full min-h-[44px] py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <EyeOff className="w-3.5 h-3.5 text-rose-500" />
                        <span>Deactivate</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        id={`btn-mobile-reactivate-${p.product_id}`}
                        onClick={() => setReactivatingProduct(p)}
                        className="w-full min-h-[44px] py-2.5 px-3 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Reactivate</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* RESPONSIVE PAGINATION */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 mt-2">
              
              {/* Mobile pagination controls */}
              <div className="flex sm:hidden items-center justify-between w-full">
                <button
                  type="button"
                  id="btn-mobile-pagination-prev"
                  disabled={!pagination.hasPrevPage}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center gap-1 shadow-2xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Prev</span>
                </button>

                <span className="text-xs font-medium text-slate-600">
                  Page {pagination.currentPage} of {pagination.totalPages}
                </span>

                <button
                  type="button"
                  id="btn-mobile-pagination-next"
                  disabled={!pagination.hasNextPage}
                  onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center gap-1 shadow-2xs"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Desktop pagination controls */}
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  Page <span className="font-semibold text-slate-900">{pagination.currentPage}</span> of{' '}
                  <span className="font-semibold text-slate-900">{pagination.totalPages}</span>
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  type="button"
                  id="btn-pagination-prev"
                  disabled={!pagination.hasPrevPage}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center shadow-2xs"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page number pills */}
                {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, idx) => {
                  let pageNum: number;
                  if (pagination.totalPages <= 7) {
                    pageNum = idx + 1;
                  } else if (currentPage <= 4) {
                    pageNum = idx + 1;
                  } else if (currentPage >= pagination.totalPages - 3) {
                    pageNum = pagination.totalPages - 6 + idx;
                  } else {
                    pageNum = currentPage - 3 + idx;
                  }

                  return (
                    <button
                      key={pageNum}
                      type="button"
                      id={`btn-pagination-page-${pageNum}`}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-h-[40px] min-w-[40px] px-3 py-2 text-xs font-semibold rounded-xl transition-all shadow-2xs ${
                        currentPage === pageNum
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  id="btn-pagination-next"
                  disabled={!pagination.hasNextPage}
                  onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center shadow-2xs"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* ADD PRODUCT MODAL                                       */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <AddProductModal
          categories={categories}
          stores={stores}
          isSubmitting={isSubmitting}
          errorMessage={modalError}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={async (payload) => {
            setIsSubmitting(true);
            setModalError(null);
            try {
              const res = await createAdminProduct(payload);
              showToast(`Product "${res.product?.name || payload.name}" created successfully.`);
              setIsAddModalOpen(false);
              loadProducts();
            } catch (err: any) {
              const msg = err?.message || err?.error || 'Failed to create product. Please check fields and retry.';
              setModalError(msg);
            } finally {
              setIsSubmitting(false);
            }
          }}
        />
      )}

      {/* ======================================================== */}
      {/* EDIT PRODUCT MODAL (METADATA ONLY)                      */}
      {/* ======================================================== */}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          categories={categories}
          isSubmitting={isSubmitting}
          errorMessage={modalError}
          onClose={() => setEditingProduct(null)}
          onSubmit={async (payload) => {
            setIsSubmitting(true);
            setModalError(null);
            try {
              await updateAdminProduct(editingProduct.product_id, payload);
              showToast(`Product "${payload.name || editingProduct.name}" updated successfully.`);
              setEditingProduct(null);
              loadProducts();
            } catch (err: any) {
              const msg = err?.message || err?.error || 'Failed to update product specifications.';
              setModalError(msg);
            } finally {
              setIsSubmitting(false);
            }
          }}
        />
      )}

      {/* ======================================================== */}
      {/* DEACTIVATE CONFIRMATION MODAL                           */}
      {/* ======================================================== */}
      {deactivatingProduct && (
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <EyeOff className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Deactivate Product?
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Deactivating <strong className="text-slate-900 font-semibold">{deactivatingProduct.name}</strong> will hide it from the public catalogue.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 mt-3 leading-relaxed">
              Historical price data, retailer offers, user watchlists, and price drop alerts are safely preserved.
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                id="btn-cancel-deactivate"
                disabled={isSubmitting}
                onClick={() => setDeactivatingProduct(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-deactivate"
                disabled={isSubmitting}
                onClick={handleConfirmDeactivate}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors min-h-[44px] flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deactivating...</span>
                  </>
                ) : (
                  <span>Deactivate Product</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* REACTIVATE CONFIRMATION MODAL                           */}
      {/* ======================================================== */}
      {reactivatingProduct && (
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <Eye className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Reactivate Product?
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Reactivate <strong className="text-slate-900 font-semibold">{reactivatingProduct.name}</strong> in the admin catalogue.
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 mt-3 leading-relaxed flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Reactivation restores product active status. Public catalogue visibility will also require at least one in-stock retailer offer.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                id="btn-cancel-reactivate"
                disabled={isSubmitting}
                onClick={() => setReactivatingProduct(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-reactivate"
                disabled={isSubmitting}
                onClick={handleConfirmReactivate}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors min-h-[44px] flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Reactivating...</span>
                  </>
                ) : (
                  <span>Reactivate Product</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/**
 * Add Product Modal Component with Section 1 (Product Details) and Section 2 (Initial Offer)
 */
function AddProductModal({
  categories,
  stores,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}: {
  categories: AdminCategory[];
  stores: AdminStore[];
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (payload: CreateAdminProductPayload) => void;
}) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [modelNo, setModelNo] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [description, setDescription] = useState('');
  const [specsSummary, setSpecsSummary] = useState('');
  const [storageVariant, setStorageVariant] = useState('');
  const [colorVariant, setColorVariant] = useState('');

  // Section 2: Initial Retailer Offer
  const [storeId, setStoreId] = useState<number | ''>('');
  const [price, setPrice] = useState<string>('');
  const [originalPrice, setOriginalPrice] = useState<string>('');
  const [productUrl, setProductUrl] = useState<string>('');
  const [isAvailable, setIsAvailable] = useState<boolean>(true);

  // Local client validation error
  const [clientError, setClientError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);

    // Section 1 validation
    if (!name.trim()) {
      setClientError('Product Name is required.');
      return;
    }
    if (!brand.trim()) {
      setClientError('Brand is required.');
      return;
    }
    if (!categoryId) {
      setClientError('Please select a product Category.');
      return;
    }

    // Section 2 validation
    if (!storeId) {
      setClientError('Please select an Initial Retailer store.');
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setClientError('Valid Selling Price (> 0) in INR is required.');
      return;
    }

    let origPriceNum: number | undefined = undefined;
    if (originalPrice.trim()) {
      origPriceNum = parseFloat(originalPrice);
      if (isNaN(origPriceNum) || origPriceNum < priceNum) {
        setClientError('Original Price, if provided, must be greater than or equal to Selling Price.');
        return;
      }
    }

    if (!productUrl.trim() || (!productUrl.startsWith('http://') && !productUrl.startsWith('https://'))) {
      setClientError('Valid Merchant Product URL starting with http:// or https:// is required.');
      return;
    }

    if (imageUrl.trim() && (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
      setClientError('Image URL must start with http:// or https://.');
      return;
    }

    const payload: CreateAdminProductPayload = {
      name: name.trim(),
      brand: brand.trim(),
      category_id: Number(categoryId),
      model_no: modelNo.trim() || undefined,
      image_url: imageUrl.trim() || undefined,
      release_date: releaseDate.trim() || undefined,
      description: description.trim() || undefined,
      specs_summary: specsSummary.trim() || undefined,
      storage_variant: storageVariant.trim() || undefined,
      color_variant: colorVariant.trim() || undefined,
      store_id: Number(storeId),
      price: priceNum,
      original_price: origPriceNum ?? null,
      product_url: productUrl.trim(),
      is_available: isAvailable,
    };

    onSubmit(payload);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Add New Product</h3>
              <p className="text-[11px] text-slate-500">Atomic entry with product specifications and initial retailer offer.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Messages */}
        {(clientError || errorMessage) && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{clientError || errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* ================= SECTION 1 ================= */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Package className="w-3.5 h-3.5 text-indigo-600" />
              <span>Section 1: Product Specifications</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Apple iPhone 15 Pro"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Brand <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g., Apple, Samsung, Sony"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category <span className="text-rose-600">*</span>
                </label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
                >
                  <option value="" disabled>Select a category</option>
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Model Number (Optional)
                </label>
                <input
                  type="text"
                  value={modelNo}
                  onChange={(e) => setModelNo(e.target.value)}
                  placeholder="e.g., A3106, SM-S928B"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Storage Variant (Optional)
                </label>
                <input
                  type="text"
                  value={storageVariant}
                  onChange={(e) => setStorageVariant(e.target.value)}
                  placeholder="e.g., 256GB, 512GB, 16GB RAM"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Color Variant (Optional)
                </label>
                <input
                  type="text"
                  value={colorVariant}
                  onChange={(e) => setColorVariant(e.target.value)}
                  placeholder="e.g., Natural Titanium, Phantom Black"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/gadget.jpg"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Release Date (Optional)
                </label>
                <input
                  type="date"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Specs Summary (Optional)
              </label>
              <input
                type="text"
                value={specsSummary}
                onChange={(e) => setSpecsSummary(e.target.value)}
                placeholder="e.g., 6.7 OLED 120Hz, A17 Pro, 48MP, 4422mAh"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product description and specifications overview..."
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          {/* ================= SECTION 2 ================= */}
          <div className="space-y-3.5 pt-3 border-t border-slate-200">
            <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Store className="w-3.5 h-3.5 text-indigo-600" />
              <span>Section 2: Initial Retailer Offer (Required)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Retailer Store <span className="text-rose-600">*</span>
                </label>
                <select
                  required
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
                >
                  <option value="" disabled>Select a retailer</option>
                  {stores.map((s) => (
                    <option key={s.store_id} value={s.store_id}>
                      {s.name} — {s.domain}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Selling Price (₹ INR) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g., 79900"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Original / List Price (₹ INR, Optional)
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  placeholder="e.g., 89900"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
                />
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2.5 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={isAvailable}
                    onChange={(e) => setIsAvailable(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-xs font-medium text-slate-700">
                    Product currently in stock & available
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Merchant Product URL <span className="text-rose-600">*</span>
              </label>
              <input
                type="url"
                required
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://www.amazon.in/dp/example..."
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-submit-create-product"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors min-h-[44px] flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Product</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Edit Product Modal Component (Metadata Only — No Offer Editing)
 */
function EditProductModal({
  product,
  categories,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}: {
  product: AdminProduct;
  categories: AdminCategory[];
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (payload: UpdateAdminProductPayload) => void;
}) {
  const [name, setName] = useState(product.name || '');
  const [brand, setBrand] = useState(product.brand || '');
  const [categoryId, setCategoryId] = useState<number>(product.category_id);
  const [modelNo, setModelNo] = useState(product.model_no || '');
  const [imageUrl, setImageUrl] = useState(product.image_url || '');
  const [releaseDate, setReleaseDate] = useState(
    product.release_date ? product.release_date.split('T')[0] : ''
  );
  const [description, setDescription] = useState(product.description || '');
  const [specsSummary, setSpecsSummary] = useState(product.specs_summary || '');
  const [storageVariant, setStorageVariant] = useState(product.storage_variant || '');
  const [colorVariant, setColorVariant] = useState(product.color_variant || '');
  const [canonicalSlug, setCanonicalSlug] = useState(product.canonical_slug || '');

  const [clientError, setClientError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);

    if (!name.trim()) {
      setClientError('Product Name is required.');
      return;
    }
    if (!brand.trim()) {
      setClientError('Brand is required.');
      return;
    }
    if (!categoryId) {
      setClientError('Please select a Category.');
      return;
    }

    if (imageUrl.trim() && (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
      setClientError('Image URL must start with http:// or https://.');
      return;
    }

    const payload: UpdateAdminProductPayload = {
      name: name.trim(),
      brand: brand.trim(),
      category_id: Number(categoryId),
      model_no: modelNo.trim() || null,
      image_url: imageUrl.trim() || null,
      release_date: releaseDate.trim() || null,
      description: description.trim() || null,
      specs_summary: specsSummary.trim() || null,
      storage_variant: storageVariant.trim() || null,
      color_variant: colorVariant.trim() || null,
      canonical_slug: canonicalSlug.trim() || null,
    };

    onSubmit(payload);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Edit Product Specifications</h3>
              <p className="text-[11px] text-slate-500">Update metadata and classification for #{product.product_id}.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {(clientError || errorMessage) && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{clientError || errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Brand <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category <span className="text-rose-600">*</span>
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
              >
                {categories.map((c) => (
                  <option key={c.category_id} value={c.category_id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Model Number
              </label>
              <input
                type="text"
                value={modelNo}
                onChange={(e) => setModelNo(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Storage Variant
              </label>
              <input
                type="text"
                value={storageVariant}
                onChange={(e) => setStorageVariant(e.target.value)}
                placeholder="e.g. 128GB, 256GB"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Color Variant
              </label>
              <input
                type="text"
                value={colorVariant}
                onChange={(e) => setColorVariant(e.target.value)}
                placeholder="e.g. Silver, Black"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Image URL
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Release Date
              </label>
              <input
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Specs Summary
            </label>
            <input
              type="text"
              value={specsSummary}
              onChange={(e) => setSpecsSummary(e.target.value)}
              placeholder="e.g., 6.1 OLED, 48MP Camera"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Canonical Slug (Optional)
            </label>
            <input
              type="text"
              value={canonicalSlug}
              onChange={(e) => setCanonicalSlug(e.target.value)}
              placeholder="e.g., apple-iphone-15-pro"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white min-h-[44px]"
            />
          </div>

          {/* Notice: Offer editing explicitly omitted in Phase 2C.2 */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Retailer prices, merchant URLs, and stock status are managed under Retailer Offer Management.</span>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-submit-edit-product"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors min-h-[44px] flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
