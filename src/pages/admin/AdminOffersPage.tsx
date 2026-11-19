import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Search, Plus, Edit2, ExternalLink, Eye, EyeOff, 
  AlertCircle, CheckCircle2, AlertTriangle, Store, Tag, 
  RefreshCw, X, SlidersHorizontal, ShieldCheck, Layers, 
  HardDrive, Info, Check, ChevronDown
} from 'lucide-react';
import { 
  fetchAdminProducts, 
  fetchAdminStores, 
  fetchAdminProductOffers, 
  createAdminProductOffer, 
  updateAdminOffer, 
  setAdminOfferAvailability 
} from '../../services/api';
import { 
  AdminProduct, 
  AdminStore, 
  AdminOfferProduct, 
  AdminRetailerOffer, 
  CreateAdminOfferPayload, 
  UpdateAdminOfferPayload 
} from '../../types/frontend';
import { formatINR } from '../../utils/currency';

/**
 * Detects if a query string clearly represents a product ID search form:
 * Examples: "315", "#315", "product 315", "Product #315", "product # 315"
 * Returns the parsed positive integer product ID, or null if the query is not an ID search.
 */
function parseProductIdQuery(query: string): number | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(?:product\s*#?|#)?\s*(\d+)$/i);
  if (match && match[1]) {
    const id = parseInt(match[1], 10);
    if (!isNaN(id) && id > 0) {
      return id;
    }
  }
  return null;
}

type SearchResultProduct = AdminProduct | (AdminOfferProduct & { category_name?: string });

export default function AdminOffersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlProductId = searchParams.get('productId');

  // Stores lookup
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [storesLoading, setStoresLoading] = useState<boolean>(true);

  // Product search state
  const [productSearchInput, setProductSearchInput] = useState<string>('');
  const [productSearchResults, setProductSearchResults] = useState<SearchResultProduct[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState<boolean>(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Selected product & offers
  const [selectedProduct, setSelectedProduct] = useState<AdminOfferProduct | null>(null);
  const [offers, setOffers] = useState<AdminRetailerOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState<boolean>(false);
  const [offersError, setOffersError] = useState<string | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingOffer, setEditingOffer] = useState<AdminRetailerOffer | null>(null);
  const [availabilityOffer, setAvailabilityOffer] = useState<{
    offer: AdminRetailerOffer;
    targetAvailable: boolean;
  } | null>(null);

  // Global operation state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // 1. Fetch stores once on mount
  useEffect(() => {
    let isMounted = true;
    const loadStores = async () => {
      try {
        const data = await fetchAdminStores();
        if (isMounted) setStores(data || []);
      } catch (err) {
        console.error('Failed to load stores lookup:', err);
      } finally {
        if (isMounted) setStoresLoading(false);
      }
    };
    loadStores();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Load product offers helper
  const loadProductOffers = useCallback(async (productId: number) => {
    setLoadingOffers(true);
    setOffersError(null);
    try {
      const data = await fetchAdminProductOffers(productId);
      setSelectedProduct(data.product);
      setOffers(data.offers || []);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load retailer offers.';
      setOffersError(msg);
      setSelectedProduct(null);
      setOffers([]);
    } finally {
      setLoadingOffers(false);
    }
  }, []);

  // 3. Handle URL productId sync on mount or param change
  useEffect(() => {
    if (urlProductId) {
      const pId = parseInt(urlProductId, 10);
      if (!isNaN(pId) && pId > 0) {
        loadProductOffers(pId);
      }
    }
  }, [urlProductId, loadProductOffers]);

  // 4. Product Search debounced handler
  const handleProductSearchChange = (val: string) => {
    setProductSearchInput(val);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = val.trim();
    if (!trimmed) {
      setProductSearchResults([]);
      setIsSearchingProducts(false);
      setIsSearchDropdownOpen(false);
      return;
    }

    setIsSearchingProducts(true);
    setIsSearchDropdownOpen(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const directId = parseProductIdQuery(trimmed);
        if (directId !== null) {
          // Resolve directly via existing GET /api/admin/products/:productId/offers
          try {
            const res = await fetchAdminProductOffers(directId);
            if (res?.product) {
              setProductSearchResults([res.product]);
            } else {
              setProductSearchResults([]);
            }
          } catch {
            setProductSearchResults([]);
          }
        } else {
          const res = await fetchAdminProducts({ search: trimmed, limit: 8, status: 'all' });
          setProductSearchResults(res.products || []);
        }
      } catch (err) {
        console.error('Failed to search admin products:', err);
        setProductSearchResults([]);
      } finally {
        setIsSearchingProducts(false);
      }
    }, 350);
  };

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Select a product from search
  const handleSelectProduct = (prod: SearchResultProduct) => {
    setIsSearchDropdownOpen(false);
    setProductSearchInput('');
    setSearchParams({ productId: String(prod.product_id) });
    loadProductOffers(prod.product_id);
  };

  // Clear selected product
  const handleClearSelectedProduct = () => {
    setSelectedProduct(null);
    setOffers([]);
    setOffersError(null);
    setSearchParams({});
    setProductSearchInput('');
  };

  // Format scraped date helper
  const formatScrapedDate = (isoString?: string | null) => {
    if (!isoString) return 'Never auto-synced';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      
      {/* Toast Notification */}
      {toast && (
        <div 
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs sm:text-sm font-semibold transition-all ${
            toast.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header & Navigation Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link 
              to="/admin" 
              className="hover:text-indigo-600 transition-colors flex items-center gap-1 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Admin Dashboard</span>
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Retailer Offers</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Retailer Offer Management</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
              Admin Protected
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Inspect, add, and adjust merchant pricing, availability, and manual override ownership by product.
          </p>
        </div>

        {selectedProduct && (
          <button
            type="button"
            onClick={() => loadProductOffers(selectedProduct.product_id)}
            disabled={loadingOffers}
            className="self-start sm:self-auto px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs min-h-[38px] disabled:opacity-50"
            title="Refresh offers"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loadingOffers ? 'animate-spin' : ''}`} />
            <span>Refresh Offers</span>
          </button>
        )}
      </div>

      {/* STEP 1: Product Search / Selection Area */}
      <section 
        aria-labelledby="heading-product-selection"
        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative"
      >
        <div className="mb-3">
          <h2 id="heading-product-selection" className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">1</span>
            <span>Select Product</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Search the catalogue by product name, brand, model, or Product ID (e.g. #315) to manage its merchant prices.
          </p>
        </div>

        {/* Search input with live dropdown */}
        <div ref={searchContainerRef} className="relative">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="input-product-search"
              type="text"
              value={productSearchInput}
              onChange={(e) => handleProductSearchChange(e.target.value)}
              onFocus={() => {
                if (productSearchResults.length > 0) setIsSearchDropdownOpen(true);
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (productSearchResults.length === 1) {
                    handleSelectProduct(productSearchResults[0]);
                    return;
                  }
                  const directId = parseProductIdQuery(productSearchInput);
                  if (directId !== null) {
                    if (searchTimeoutRef.current) {
                      clearTimeout(searchTimeoutRef.current);
                    }
                    setIsSearchingProducts(true);
                    setIsSearchDropdownOpen(true);
                    try {
                      const res = await fetchAdminProductOffers(directId);
                      if (res?.product) {
                        handleSelectProduct(res.product);
                      } else {
                        setProductSearchResults([]);
                      }
                    } catch {
                      setProductSearchResults([]);
                    } finally {
                      setIsSearchingProducts(false);
                    }
                  }
                }
              }}
              placeholder="Type to search product by name, brand, model, or ID (#315)..."
              className="w-full pl-9.5 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {productSearchInput && (
              <button
                type="button"
                onClick={() => {
                  setProductSearchInput('');
                  setProductSearchResults([]);
                  setIsSearchDropdownOpen(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Dropdown Results */}
          {isSearchDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-72 overflow-y-auto divide-y divide-slate-100">
              {isSearchingProducts ? (
                <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <span>Searching catalogue...</span>
                </div>
              ) : productSearchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No matching products found for "{productSearchInput}".
                </div>
              ) : (
                productSearchResults.map((prod) => (
                  <button
                    key={prod.product_id}
                    type="button"
                    onClick={() => handleSelectProduct(prod)}
                    className="w-full text-left p-3 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                          {prod.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          #{prod.product_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700">{prod.brand}</span>
                        {prod.model_no && <span>• Model: {prod.model_no}</span>}
                        {prod.category_name && <span>• {prod.category_name}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        prod.is_active 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {prod.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600">
                        {prod.data_source}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Selected Product Summary Card */}
        {selectedProduct && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    {selectedProduct.name}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                    #{selectedProduct.product_id}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                    selectedProduct.is_active 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {selectedProduct.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-sm bg-slate-200 text-slate-700 shrink-0">
                    Source: {selectedProduct.data_source}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span>Brand: <strong className="text-slate-800">{selectedProduct.brand}</strong></span>
                  {selectedProduct.model_no && (
                    <span>Model: <strong className="text-slate-800">{selectedProduct.model_no}</strong></span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={handleClearSelectedProduct}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors min-h-[36px]"
                >
                  Change Product
                </button>
              </div>
            </div>

            {/* Inactive Product Amber Warning Banner */}
            {!selectedProduct.is_active && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-semibold">Notice: Inactive Product Catalogue Status. </span>
                  This product is currently inactive. Its retailer offers can still be managed, but the product remains hidden from the public catalogue until reactivated in Product Management.
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* STEP 2: Product Retailer Offers Management Section */}
      <section 
        aria-labelledby="heading-offers-management"
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
          <div>
            <h2 id="heading-offers-management" className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">2</span>
              <span>Retailer Offers</span>
              {selectedProduct && (
                <span className="text-xs font-normal text-slate-500">
                  ({offers.length} {offers.length === 1 ? 'offer' : 'offers'})
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage store prices, merchant URLs, availability, and ingestion protection.
            </p>
          </div>

          {selectedProduct && (
            <button
              type="button"
              id="btn-add-retailer-offer"
              onClick={() => {
                setModalError(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors min-h-[42px]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Retailer Offer</span>
            </button>
          )}
        </div>

        {/* State A: No product selected */}
        {!selectedProduct && !loadingOffers && (
          <div className="py-14 px-4 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3">
              <Store className="w-6 h-6" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
              Select a product to manage its retailer offers.
            </h3>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
              Search the catalogue above to view, add, or update retailer pricing.
            </p>
          </div>
        )}

        {/* State B: Loading offers */}
        {loadingOffers && (
          <div className="py-16 text-center flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="mt-3 text-xs font-semibold text-slate-600">Loading retailer offers...</p>
          </div>
        )}

        {/* State C: Offers load error */}
        {offersError && !loadingOffers && (
          <div className="py-8 px-4 max-w-md mx-auto text-center">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 text-red-600 mx-auto flex items-center justify-center mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-800 mb-1">Failed to load offers</p>
            <p className="text-xs text-slate-500 mb-4">{offersError}</p>
            {selectedProduct && (
              <button
                type="button"
                onClick={() => loadProductOffers(selectedProduct.product_id)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* State D: Product selected, but 0 offers */}
        {selectedProduct && !loadingOffers && !offersError && offers.length === 0 && (
          <div className="py-12 px-4 text-center flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <Tag className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">No retailer offers yet.</h3>
            <p className="text-xs text-slate-500 mb-4 max-w-sm">
              This product currently has no pricing entries from any merchant.
            </p>
            <button
              type="button"
              onClick={() => {
                setModalError(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors min-h-[40px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Retailer Offer</span>
            </button>
          </div>
        )}

        {/* State E: Product selected with offers */}
        {selectedProduct && !loadingOffers && !offersError && offers.length > 0 && (
          <div>
            {/* Desktop Table View (>= lg) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/75">
                    <th className="py-3 px-3.5">Retailer</th>
                    <th className="py-3 px-3.5">Price</th>
                    <th className="py-3 px-3.5">Status</th>
                    <th className="py-3 px-3.5">Control</th>
                    <th className="py-3 px-3.5">Sync Info</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {offers.map((offer) => {
                    const priceNum = typeof offer.price === 'string' ? parseFloat(offer.price) : offer.price;
                    const origPriceNum = offer.original_price !== null ? (typeof offer.original_price === 'string' ? parseFloat(offer.original_price) : offer.original_price) : null;
                    const discountNum = typeof offer.discount === 'string' ? parseFloat(offer.discount) : offer.discount;

                    return (
                      <tr key={offer.price_id} className="hover:bg-slate-50/75 transition-colors">
                        {/* Retailer Info */}
                        <td className="py-3.5 px-3.5">
                          <div className="flex items-center gap-3">
                            {offer.store_logo_url ? (
                              <img 
                                src={offer.store_logo_url} 
                                alt={offer.store_name}
                                className="w-7 h-7 object-contain rounded-md border border-slate-200 bg-white p-0.5 shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-bold text-xs">
                                {offer.store_name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 truncate">
                                  {offer.store_name}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  #{offer.price_id}
                                </span>
                              </div>
                              <a
                                href={offer.product_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 mt-0.5 truncate max-w-[200px]"
                                title={offer.product_url}
                              >
                                <span>{offer.store_domain}</span>
                                <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                              </a>
                            </div>
                          </div>
                        </td>

                        {/* Price Info */}
                        <td className="py-3.5 px-3.5">
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-900 text-sm">
                              {formatINR(priceNum)}
                            </div>
                            {origPriceNum !== null && origPriceNum > priceNum && (
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="line-through text-slate-400">
                                  {formatINR(origPriceNum)}
                                </span>
                                {discountNum > 0 && (
                                  <span className="font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-sm text-[10px]">
                                    {Math.round(discountNum)}% off
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Availability Status */}
                        <td className="py-3.5 px-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            offer.is_available 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${offer.is_available ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                            <span>{offer.is_available ? 'Available' : 'Unavailable'}</span>
                          </span>
                        </td>

                        {/* Control Mode */}
                        <td className="py-3.5 px-3.5">
                          {offer.manual_override ? (
                            <div className="space-y-0.5">
                              <span 
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200"
                                title="Admin changes are protected from automatic price overwrites."
                              >
                                <ShieldCheck className="w-3 h-3 text-purple-600" />
                                <span>Manual Control</span>
                              </span>
                              <p className="text-[10px] text-slate-400">Protected from auto-sync</p>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span 
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200"
                                title="This offer may be updated by automated ingestion."
                              >
                                <RefreshCw className="w-3 h-3 text-sky-600" />
                                <span>Auto Sync</span>
                              </span>
                              <p className="text-[10px] text-slate-400">Eligible for auto ingestion</p>
                            </div>
                          )}
                        </td>

                        {/* Sync Info */}
                        <td className="py-3.5 px-3.5 text-[11px] text-slate-500">
                          {formatScrapedDate(offer.last_scraped_at)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setModalError(null);
                                setEditingOffer(offer);
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors min-h-[34px]"
                              title="Edit commercial price/URL"
                            >
                              <Edit2 className="w-3 h-3 text-slate-500" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAvailabilityOffer({
                                  offer,
                                  targetAvailable: !offer.is_available
                                });
                              }}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors min-h-[34px] ${
                                offer.is_available
                                  ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-100/70 text-amber-800'
                                  : 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 text-emerald-800'
                              }`}
                            >
                              {offer.is_available ? (
                                <>
                                  <EyeOff className="w-3 h-3 text-amber-600" />
                                  <span>Mark Unavailable</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3 h-3 text-emerald-600" />
                                  <span>Make Available</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Tablet & Mobile Stacked Cards (< lg) */}
            <div className="lg:hidden space-y-3">
              {offers.map((offer) => {
                const priceNum = typeof offer.price === 'string' ? parseFloat(offer.price) : offer.price;
                const origPriceNum = offer.original_price !== null ? (typeof offer.original_price === 'string' ? parseFloat(offer.original_price) : offer.original_price) : null;
                const discountNum = typeof offer.discount === 'string' ? parseFloat(offer.discount) : offer.discount;

                return (
                  <div 
                    key={offer.price_id}
                    className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
                  >
                    {/* Top Row: Store & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {offer.store_logo_url ? (
                          <img 
                            src={offer.store_logo_url} 
                            alt={offer.store_name}
                            className="w-8 h-8 object-contain rounded-md border border-slate-200 bg-white p-0.5 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-bold text-xs">
                            {offer.store_name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-sm truncate">
                              {offer.store_name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              #{offer.price_id}
                            </span>
                          </div>
                          <a
                            href={offer.product_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:underline flex items-center gap-1 truncate max-w-[200px]"
                          >
                            <span>{offer.store_domain}</span>
                            <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                          </a>
                        </div>
                      </div>

                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 ${
                        offer.is_available 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${offer.is_available ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        <span>{offer.is_available ? 'Available' : 'Unavailable'}</span>
                      </span>
                    </div>

                    {/* Middle: Price & Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <div>
                        <div className="font-bold text-slate-900 text-base">
                          {formatINR(priceNum)}
                        </div>
                        {origPriceNum !== null && origPriceNum > priceNum && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="line-through text-slate-400">
                              {formatINR(origPriceNum)}
                            </span>
                            {discountNum > 0 && (
                              <span className="font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-sm text-[10px]">
                                {Math.round(discountNum)}% off
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        {offer.manual_override ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            <ShieldCheck className="w-3 h-3 text-purple-600" />
                            <span>Manual Control</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                            <RefreshCw className="w-3 h-3 text-sky-600" />
                            <span>Auto Sync</span>
                          </span>
                        )}
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatScrapedDate(offer.last_scraped_at)}
                        </p>
                      </div>
                    </div>

                    {/* Bottom: Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setModalError(null);
                          setEditingOffer(offer);
                        }}
                        className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAvailabilityOffer({
                            offer,
                            targetAvailable: !offer.is_available
                          });
                        }}
                        className={`w-full py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors min-h-[44px] ${
                          offer.is_available
                            ? 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800'
                            : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {offer.is_available ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                            <span>Make Unavailable</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Make Available</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD RETAILER OFFER */}
      {/* ========================================================================= */}
      {isAddModalOpen && selectedProduct && (
        <AddOfferModal
          product={selectedProduct}
          existingOffers={offers}
          stores={stores}
          storesLoading={storesLoading}
          isSubmitting={isSubmitting}
          modalError={modalError}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={async (payload) => {
            setIsSubmitting(true);
            setModalError(null);
            try {
              await createAdminProductOffer(selectedProduct.product_id, payload);
              showToast('Retailer offer created successfully under Manual Control.');
              setIsAddModalOpen(false);
              await loadProductOffers(selectedProduct.product_id);
            } catch (err: any) {
              const msg = err?.response?.data?.message || err?.message || 'Failed to create retailer offer.';
              setModalError(msg);
            } finally {
              setIsSubmitting(false);
            }
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT RETAILER OFFER */}
      {/* ========================================================================= */}
      {editingOffer && selectedProduct && (
        <EditOfferModal
          offer={editingOffer}
          isSubmitting={isSubmitting}
          modalError={modalError}
          onClose={() => setEditingOffer(null)}
          onSubmit={async (payload) => {
            setIsSubmitting(true);
            setModalError(null);
            try {
              const res = await updateAdminOffer(editingOffer.price_id, payload);
              if (res.changed) {
                showToast('Retailer offer updated successfully.');
              } else {
                showToast('No changes detected. Offer remains unchanged.');
              }
              setEditingOffer(null);
              await loadProductOffers(selectedProduct.product_id);
            } catch (err: any) {
              const msg = err?.response?.data?.message || err?.message || 'Failed to update retailer offer.';
              setModalError(msg);
            } finally {
              setIsSubmitting(false);
            }
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* DIALOG 3: AVAILABILITY CONFIRMATION (MAKE AVAILABLE / MARK UNAVAILABLE) */}
      {/* ========================================================================= */}
      {availabilityOffer && selectedProduct && (
        <AvailabilityDialog
          offer={availabilityOffer.offer}
          targetAvailable={availabilityOffer.targetAvailable}
          isProductActive={selectedProduct.is_active}
          isSubmitting={isSubmitting}
          onClose={() => setAvailabilityOffer(null)}
          onConfirm={async () => {
            setIsSubmitting(true);
            try {
              await setAdminOfferAvailability(
                availabilityOffer.offer.price_id, 
                availabilityOffer.targetAvailable
              );
              showToast(
                availabilityOffer.targetAvailable
                  ? 'Retailer offer is now available for comparisons.'
                  : 'Retailer offer marked unavailable.'
              );
              setAvailabilityOffer(null);
              await loadProductOffers(selectedProduct.product_id);
            } catch (err: any) {
              const msg = err?.response?.data?.message || err?.message || 'Failed to update offer availability.';
              showToast(msg, 'error');
            } finally {
              setIsSubmitting(false);
            }
          }}
        />
      )}

    </div>
  );
}

// ============================================================================
// SUB-COMPONENT: ADD OFFER MODAL
// ============================================================================
interface AddOfferModalProps {
  product: AdminOfferProduct;
  existingOffers: AdminRetailerOffer[];
  stores: AdminStore[];
  storesLoading: boolean;
  isSubmitting: boolean;
  modalError: string | null;
  onClose: () => void;
  onSubmit: (payload: CreateAdminOfferPayload) => Promise<void>;
}

function AddOfferModal({
  product,
  existingOffers,
  stores,
  storesLoading,
  isSubmitting,
  modalError,
  onClose,
  onSubmit
}: AddOfferModalProps) {
  // Existing store IDs for this product to exclude / disable
  const existingStoreIds = new Set(existingOffers.map((o) => o.store_id));
  const availableStores = stores.filter((s) => !existingStoreIds.has(s.store_id));

  const [storeId, setStoreId] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [originalPrice, setOriginalPrice] = useState<string>('');
  const [productUrl, setProductUrl] = useState<string>('');
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const sId = parseInt(storeId, 10);
    if (isNaN(sId) || sId <= 0) {
      setLocalError('Please select a retailer store.');
      return;
    }

    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) {
      setLocalError('Selling price must be a positive number greater than zero.');
      return;
    }

    let op: number | null = null;
    if (originalPrice.trim() !== '') {
      const parsedOp = parseFloat(originalPrice);
      if (isNaN(parsedOp) || parsedOp <= 0) {
        setLocalError('Original/list price must be a positive number.');
        return;
      }
      if (parsedOp < p) {
        setLocalError('Original/list price must be greater than or equal to the selling price.');
        return;
      }
      op = parsedOp;
    }

    const trimmedUrl = productUrl.trim();
    if (!trimmedUrl) {
      setLocalError('Product URL is required.');
      return;
    }
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setLocalError('Product URL must begin with http:// or https://.');
      return;
    }

    onSubmit({
      store_id: sId,
      price: p,
      original_price: op,
      product_url: trimmedUrl,
      is_available: isAvailable
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Add Retailer Offer</h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-sm">
              Product: <strong className="text-slate-800">{product.name}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {(modalError || localError) && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{modalError || localError}</span>
            </div>
          )}

          {/* Retailer Store Select */}
          <div>
            <label htmlFor="select-offer-store" className="block text-xs font-bold text-slate-800 mb-1.5">
              Retailer Store <span className="text-red-500">*</span>
            </label>
            {storesLoading ? (
              <div className="text-xs text-slate-500 py-2">Loading stores list...</div>
            ) : availableStores.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                All registered retailer stores already have an offer for this product. You can edit existing offers instead.
              </div>
            ) : (
              <div className="relative">
                <select
                  id="select-offer-store"
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                >
                  <option value="">Select a retailer</option>
                  {stores.map((s) => {
                    const alreadyHas = existingStoreIds.has(s.store_id);
                    return (
                      <option 
                        key={s.store_id} 
                        value={s.store_id}
                        disabled={alreadyHas}
                      >
                        {s.name} ({s.domain}){alreadyHas ? ' — (Offer already exists)' : ''}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Selling Price & Original Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="input-offer-price" className="block text-xs font-bold text-slate-800 mb-1.5">
                Selling Price (₹) <span className="text-red-500">*</span>
              </label>
              <input
                id="input-offer-price"
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 29999"
                disabled={isSubmitting}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label htmlFor="input-offer-original-price" className="block text-xs font-bold text-slate-800 mb-1.5">
                Original / List Price (₹) <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="input-offer-original-price"
                type="number"
                step="0.01"
                min="0.01"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="e.g. 34999"
                disabled={isSubmitting}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Product URL */}
          <div>
            <label htmlFor="input-offer-url" className="block text-xs font-bold text-slate-800 mb-1.5">
              Product URL <span className="text-red-500">*</span>
            </label>
            <input
              id="input-offer-url"
              type="url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="https://www.example.com/item"
              disabled={isSubmitting}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            <p className="text-[11px] text-slate-400 mt-1">Must start with http:// or https://</p>
          </div>

          {/* Availability Toggle */}
          <div className="pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                disabled={isSubmitting}
                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-slate-800">
                Offer is immediately available for price comparison
              </span>
            </label>
          </div>

          {/* Info note */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
            <span>Admin-created offers are automatically marked with <strong>Manual Control</strong> to protect pricing from automatic ingestion overwrites.</span>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || availableStores.length === 0}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 min-h-[40px] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Creating Offer...</span>
                </>
              ) : (
                <span>Add Retailer Offer</span>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENT: EDIT OFFER MODAL
// ============================================================================
interface EditOfferModalProps {
  offer: AdminRetailerOffer;
  isSubmitting: boolean;
  modalError: string | null;
  onClose: () => void;
  onSubmit: (payload: UpdateAdminOfferPayload) => Promise<void>;
}

function EditOfferModal({
  offer,
  isSubmitting,
  modalError,
  onClose,
  onSubmit
}: EditOfferModalProps) {
  const initialPriceStr = String(offer.price);
  const initialOrigPriceStr = offer.original_price !== null ? String(offer.original_price) : '';
  const initialUrlStr = offer.product_url;

  const [price, setPrice] = useState<string>(initialPriceStr);
  const [originalPrice, setOriginalPrice] = useState<string>(initialOrigPriceStr);
  const [productUrl, setProductUrl] = useState<string>(initialUrlStr);
  const [localError, setLocalError] = useState<string | null>(null);

  // Compute whether any field changed
  const isPriceChanged = parseFloat(price) !== parseFloat(initialPriceStr);
  const isOrigPriceChanged = (() => {
    const trimmed = originalPrice.trim();
    if (trimmed === '' && offer.original_price === null) return false;
    if (trimmed === '' && offer.original_price !== null) return true;
    if (trimmed !== '' && offer.original_price === null) return true;
    return parseFloat(trimmed) !== parseFloat(String(offer.original_price));
  })();
  const isUrlChanged = productUrl.trim() !== initialUrlStr.trim();
  const hasChanges = isPriceChanged || isOrigPriceChanged || isUrlChanged;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!hasChanges) {
      // Safe no-op close
      onClose();
      return;
    }

    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) {
      setLocalError('Selling price must be a positive number greater than zero.');
      return;
    }

    let op: number | null = null;
    const trimmedOp = originalPrice.trim();
    if (trimmedOp !== '') {
      const parsedOp = parseFloat(trimmedOp);
      if (isNaN(parsedOp) || parsedOp <= 0) {
        setLocalError('Original/list price must be a positive number.');
        return;
      }
      if (parsedOp < p) {
        setLocalError('Original/list price must be greater than or equal to the selling price.');
        return;
      }
      op = parsedOp;
    } else {
      // Intentionally cleared -> null
      op = null;
    }

    const trimmedUrl = productUrl.trim();
    if (!trimmedUrl) {
      setLocalError('Product URL is required.');
      return;
    }
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setLocalError('Product URL must begin with http:// or https://.');
      return;
    }

    // Build payload with only fields relevant
    const payload: UpdateAdminOfferPayload = {};
    if (isPriceChanged) payload.price = p;
    if (isOrigPriceChanged) payload.original_price = op;
    if (isUrlChanged) payload.product_url = trimmedUrl;

    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Edit Retailer Offer</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Offer ID: <span className="font-mono font-semibold text-slate-700">#{offer.price_id}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {(modalError || localError) && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{modalError || localError}</span>
            </div>
          )}

          {/* Auto-Sync Informational Warning Banner */}
          {!offer.manual_override && (
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-semibold">Auto-Sync Note: </span>
                Changing the price, list price, or merchant URL will switch this offer to Manual Control. Automatic ingestion will no longer overwrite these fields.
              </div>
            </div>
          )}

          {/* Retailer Info — READ ONLY */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Retailer Store (Read-Only)
            </span>
            <div className="flex items-center gap-2.5">
              {offer.store_logo_url ? (
                <img 
                  src={offer.store_logo_url} 
                  alt={offer.store_name}
                  className="w-6 h-6 object-contain rounded border border-slate-200 bg-white p-0.5 shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                  {offer.store_name.charAt(0)}
                </div>
              )}
              <span className="text-xs font-bold text-slate-800">{offer.store_name}</span>
              <span className="text-xs text-slate-500">({offer.store_domain})</span>
            </div>
          </div>

          {/* Selling Price & Original Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="input-edit-price" className="block text-xs font-bold text-slate-800 mb-1.5">
                Selling Price (₹) <span className="text-red-500">*</span>
              </label>
              <input
                id="input-edit-price"
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label htmlFor="input-edit-original-price" className="block text-xs font-bold text-slate-800 mb-1.5">
                Original / List Price (₹)
              </label>
              <input
                id="input-edit-original-price"
                type="number"
                step="0.01"
                min="0.01"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="Leave empty for None"
                disabled={isSubmitting}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <p className="text-[10px] text-slate-400 mt-1">Clear this input to remove the list price.</p>
            </div>
          </div>

          {/* Product URL */}
          <div>
            <label htmlFor="input-edit-url" className="block text-xs font-bold text-slate-800 mb-1.5">
              Product URL <span className="text-red-500">*</span>
            </label>
            <input
              id="input-edit-url"
              type="url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !hasChanges}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 min-h-[40px] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Saving Changes...</span>
                </>
              ) : !hasChanges ? (
                <span>No Changes to Save</span>
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

// ============================================================================
// SUB-COMPONENT: AVAILABILITY CONFIRMATION DIALOG
// ============================================================================
interface AvailabilityDialogProps {
  offer: AdminRetailerOffer;
  targetAvailable: boolean;
  isProductActive: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

function AvailabilityDialog({
  offer,
  targetAvailable,
  isProductActive,
  isSubmitting,
  onClose,
  onConfirm
}: AvailabilityDialogProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in duration-150">
        
        <div className="p-6">
          <div className="flex items-start gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              targetAvailable 
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                : 'bg-amber-50 text-amber-600 border border-amber-100'
            }`}>
              {targetAvailable ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                {targetAvailable ? 'Make Retailer Offer Available' : 'Mark Retailer Offer Unavailable'}
              </h3>
              <p className="text-xs text-slate-500">
                Store: <strong className="text-slate-700">{offer.store_name}</strong> • Current Price: <strong className="text-slate-700">{formatINR(Number(offer.price))}</strong>
              </p>
            </div>
          </div>

          {/* Explanation */}
          <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 leading-relaxed space-y-2">
            {targetAvailable ? (
              <>
                <p>
                  This retailer offer will become eligible for public price comparisons when the product itself is active.
                </p>
                {!isProductActive && (
                  <p className="text-amber-700 font-medium">
                    Note: The product is currently inactive, so making this offer available will not make the product publicly visible yet.
                  </p>
                )}
              </>
            ) : (
              <p>
                Marking this retailer offer unavailable hides this offer from public price comparisons. Price history and retailer information are preserved.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 min-h-[40px] disabled:opacity-50 ${
                targetAvailable
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Updating...</span>
                </>
              ) : targetAvailable ? (
                <span>Make Available</span>
              ) : (
                <span>Mark Unavailable</span>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
