import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { fetchProducts, addSearchHistory, addToWatchlist, removeFromWatchlist, fetchWatchlist, fetchPriceAlerts } from '../services/api';
import { SearchHistoryComponent } from '../components/SearchHistoryComponent';
import MobileFilterDrawer from '../components/MobileFilterDrawer';
import PriceAlertModal from '../components/PriceAlertModal';
import CompareLimitModal from '../components/CompareLimitModal';
import { Product, PriceAlert, WatchlistEntry } from '../types/frontend';
import { formatINR } from '../utils/currency';
import { MAX_COMPARE_PRODUCTS, getCompareProductIds, toggleProductInCompare } from '../utils/compare';
import { 
  Search, ShoppingCart, AlertCircle, ArrowUpRight, ArrowUpDown, X, 
  ChevronLeft, ChevronRight, Bookmark, BookmarkCheck, Scale, BellRing, Sparkles, SlidersHorizontal, RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CATEGORY_ITEMS = [
  { label: 'All', queryValue: 'All' },
  { label: 'Laptops', queryValue: 'Laptops' },
  { label: 'Monitors', queryValue: 'Monitors' },
  { label: 'Smartwatches', queryValue: 'Smartwatches' },
  { label: 'Phones', queryValue: 'Phones' },
  { label: 'Tablets', queryValue: 'Tablets' },
  { label: 'Headphones', queryValue: 'Headphones' },
];

const STORES = ['All Stores', 'Amazon India', 'Flipkart', 'Croma', 'Reliance Digital'];

const BUDGET_PRESETS = [
  { label: 'All Prices', max: '' },
  { label: 'Under ₹5,000', max: '5000' },
  { label: 'Under ₹10,000', max: '10000' },
  { label: 'Under ₹25,000', max: '25000' },
  { label: 'Under ₹50,000', max: '50000' },
  { label: 'Under ₹1,00,000', max: '100000' },
];

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400';

function normalizeCategoryFromUrl(cat: string | null): string {
  if (!cat || cat === 'All') return 'All';
  const lower = cat.toLowerCase();
  if (lower === 'laptop' || lower === 'laptops') return 'Laptops';
  if (lower === 'monitor' || lower === 'monitors') return 'Monitors';
  if (lower === 'smartwatch' || lower === 'smartwatches' || lower.includes('wearable')) return 'Smartwatches';
  if (lower === 'phone' || lower === 'phones' || lower.includes('smartphone')) return 'Phones';
  if (lower === 'tablet' || lower === 'tablets' || lower.includes('ipad')) return 'Tablets';
  if (lower === 'headphone' || lower === 'headphones' || lower.includes('audio')) return 'Headphones';
  if (lower.includes('desktop') || lower.includes('tv') || lower.includes('television')) return 'All';
  return cat;
}

function normalizeSortFromUrl(s: string | null): string {
  if (!s || s === 'featured' || s === 'default' || s === 'recommended') return 'featured';
  if (s === 'cheapest') return 'price_asc';
  if (s === 'dearest') return 'price_desc';
  if (s === 'name-az') return 'name_asc';
  return s;
}

export default function ProductListingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Read initial values from URL query parameters (supporting both ?type= and legacy ?category=)
  const initialParams = new URLSearchParams(location.search);
  const [searchTerm, setSearchTerm] = useState(() => initialParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(() => normalizeCategoryFromUrl(initialParams.get('type') || initialParams.get('category')));
  const [selectedStore, setSelectedStore] = useState(() => initialParams.get('store') || 'All Stores');
  const [sortBy, setSortBy] = useState<string>(() => normalizeSortFromUrl(initialParams.get('sort')));
  const [minPrice, setMinPrice] = useState<string>(() => initialParams.get('min_price') || '');
  const [maxPrice, setMaxPrice] = useState<string>(() => initialParams.get('max_price') || '');
  const [currentPage, setCurrentPage] = useState<number>(() => {
    const pageVal = parseInt(initialParams.get('page') || '1', 10);
    return !isNaN(pageVal) && pageVal > 0 ? pageVal : 1;
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState<any>(null);

  // Quick Action States
  const [watchlistMap, setWatchlistMap] = useState<Map<number, number>>(new Map()); // productId -> watchlist_id
  const [compareProductIds, setCompareProductIds] = useState<number[]>(() => getCompareProductIds());
  const [alertsMap, setAlertsMap] = useState<Map<number, PriceAlert>>(new Map()); // productId -> PriceAlert
  const [selectedAlertProduct, setSelectedAlertProduct] = useState<Product | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isCompareLimitModalOpen, setIsCompareLimitModalOpen] = useState(false);
  const [pendingLimitProduct, setPendingLimitProduct] = useState<Product | null>(null);

  // Mobile Filter Drawer state
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [historyTrigger, setHistoryTrigger] = useState(0);

  const itemsPerPage = 12;
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const lastSavedTerm = useRef<string>('');

  // Calculate active filters count
  const activeFilterCount = 
    (selectedCategory !== 'All' ? 1 : 0) + 
    (selectedStore !== 'All Stores' ? 1 : 0) + 
    (minPrice !== '' || maxPrice !== '' ? 1 : 0);

  // Commit and sync filters/sort/page state to URL query parameters
  const commitFilterState = useCallback((updates: Partial<{
    search: string;
    category: string;
    type: string;
    store: string;
    min_price: string;
    max_price: string;
    sort: string;
    page: number;
  }>) => {
    const nextSearch = updates.search !== undefined ? updates.search : searchTerm;
    const nextType = updates.type !== undefined ? updates.type : (updates.category !== undefined ? updates.category : selectedCategory);
    const nextStore = updates.store !== undefined ? updates.store : selectedStore;
    const nextMin = updates.min_price !== undefined ? updates.min_price : minPrice;
    const nextMax = updates.max_price !== undefined ? updates.max_price : maxPrice;
    const nextSort = updates.sort !== undefined ? updates.sort : sortBy;
    const nextPage = updates.page !== undefined ? updates.page : 1;

    setSearchTerm(nextSearch);
    setSelectedCategory(nextType);
    setSelectedStore(nextStore);
    setMinPrice(nextMin);
    setMaxPrice(nextMax);
    setSortBy(nextSort);
    setCurrentPage(nextPage);

    const params = new URLSearchParams();
    if (nextSearch && nextSearch.trim()) params.set('search', nextSearch.trim());
    if (nextType && nextType !== 'All') {
      params.set('type', nextType);
    }
    if (nextStore && nextStore !== 'All Stores') params.set('store', nextStore);
    if (nextMin) params.set('min_price', nextMin);
    if (nextMax) params.set('max_price', nextMax);
    if (nextSort && nextSort !== 'featured') params.set('sort', nextSort);
    if (nextPage > 1) params.set('page', nextPage.toString());

    // Preserve special non-filter params like ai_advisor
    const currentParams = new URLSearchParams(location.search);
    if (currentParams.get('ai_advisor') === 'true') {
      params.set('ai_advisor', 'true');
    }

    const newQuery = params.toString() ? `?${params.toString()}` : '';
    if (location.search !== newQuery) {
      navigate({ search: newQuery }, { replace: true });
    }
  }, [searchTerm, selectedCategory, selectedStore, minPrice, maxPrice, sortBy, location.search, navigate]);

  // Sync state from URL when navigating (e.g. Back button from Product Details)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlSearch = params.get('search') || '';
    const urlCat = normalizeCategoryFromUrl(params.get('type') || params.get('category'));
    const urlStore = params.get('store') || 'All Stores';
    const urlMin = params.get('min_price') || '';
    const urlMax = params.get('max_price') || '';
    const urlSort = normalizeSortFromUrl(params.get('sort'));
    const urlPage = parseInt(params.get('page') || '1', 10) || 1;

    setSearchTerm(urlSearch);
    setSelectedCategory(urlCat);
    setSelectedStore(urlStore);
    setMinPrice(urlMin);
    setMaxPrice(urlMax);
    setSortBy(urlSort);
    setCurrentPage(urlPage);
  }, [location.search]);

  // Sync Watchlist & Price Alerts state when user is logged in
  const syncWatchlist = useCallback(async () => {
    if (!user) {
      setWatchlistMap(new Map());
      return;
    }
    try {
      const items = await fetchWatchlist();
      const map = new Map<number, number>();
      if (Array.isArray(items)) {
        items.forEach((item: WatchlistEntry) => {
          map.set(item.product_id, item.watchlist_id);
        });
      }
      setWatchlistMap(map);
    } catch {}
  }, [user]);

  const syncPriceAlerts = useCallback(async () => {
    if (!user) {
      setAlertsMap(new Map());
      return;
    }
    try {
      const alerts = await fetchPriceAlerts();
      const map = new Map<number, PriceAlert>();
      if (Array.isArray(alerts)) {
        alerts.forEach((alertItem: PriceAlert) => {
          if (alertItem.is_active !== false) {
            map.set(alertItem.product_id, alertItem);
          }
        });
      }
      setAlertsMap(map);
    } catch {}
  }, [user]);

  const syncCompareIds = useCallback(() => {
    try {
      setCompareProductIds(getCompareProductIds());
    } catch {
      setCompareProductIds([]);
    }
  }, []);

  useEffect(() => {
    syncWatchlist();
    syncPriceAlerts();
    syncCompareIds();

    const handleWatchlistUpdated = () => syncWatchlist();
    const handleAlertsUpdated = () => syncPriceAlerts();
    const handleCompareUpdated = () => syncCompareIds();

    window.addEventListener('watchlist-updated', handleWatchlistUpdated);
    window.addEventListener('alerts-updated', handleAlertsUpdated);
    window.addEventListener('deal-compare-updated', handleCompareUpdated);
    window.addEventListener('storage', handleCompareUpdated);

    return () => {
      window.removeEventListener('watchlist-updated', handleWatchlistUpdated);
      window.removeEventListener('alerts-updated', handleAlertsUpdated);
      window.removeEventListener('deal-compare-updated', handleCompareUpdated);
      window.removeEventListener('storage', handleCompareUpdated);
    };
  }, [user, syncWatchlist, syncPriceAlerts, syncCompareIds]);

  // Load products based on current committed state
  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      setLoading(true);
      setError(null);
      try {
        const typeQuery = selectedCategory === 'All' ? undefined : selectedCategory;
        const res = await fetchProducts(
          currentPage, 
          itemsPerPage, 
          undefined, // category
          searchTerm, 
          minPrice ? parseInt(minPrice, 10) : undefined, 
          maxPrice ? parseInt(maxPrice, 10) : undefined, 
          sortBy === 'featured' ? undefined : sortBy,
          selectedStore,
          typeQuery
        );

        if (!isMounted) return;

        setProducts(res.products);
        setTotalItems(res.pagination.totalItems);
        setTotalPages(res.pagination.totalPages);
        setInterpretation(res.interpretation);

        const cleanTerm = searchTerm.trim();
        if (cleanTerm && cleanTerm.length >= 2 && cleanTerm.toLowerCase() !== lastSavedTerm.current.toLowerCase()) {
          lastSavedTerm.current = cleanTerm;
          try {
            await addSearchHistory(cleanTerm);
            setHistoryTrigger(prev => prev + 1);
          } catch (err) {}
        }
      } catch (err: any) {
        if (isMounted) setError('Error loading product catalog.');
      } finally {
        if (isMounted) {
          setLoading(false);

          // Restore scroll position on back navigation
          const isRestoring = sessionStorage.getItem('catalogue_restoring');
          const savedPos = sessionStorage.getItem('catalogue_scroll_pos');
          if (isRestoring === 'true' && savedPos) {
            sessionStorage.removeItem('catalogue_restoring');
            sessionStorage.removeItem('catalogue_scroll_pos');
            const top = parseInt(savedPos, 10);
            if (!isNaN(top) && top > 0) {
              requestAnimationFrame(() => {
                window.scrollTo({ top, behavior: 'instant' });
              });
            }
          }
        }
      }
    }

    const delayDebounce = setTimeout(() => {
      loadProducts();
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(delayDebounce);
    };
  }, [searchTerm, selectedCategory, minPrice, maxPrice, currentPage, sortBy, selectedStore]);

  const addToSearchHistory = async (term: string) => {
    if (!term || term.trim() === '') return;
    const cleanTerm = term.trim();
    if (cleanTerm.toLowerCase() === lastSavedTerm.current.toLowerCase()) return;
    lastSavedTerm.current = cleanTerm;

    try {
      await addSearchHistory(cleanTerm);
      setHistoryTrigger(prev => prev + 1);
    } catch (err) {}
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addToSearchHistory(searchTerm);
    commitFilterState({ search: searchTerm, page: 1 });
  };

  const handleSelectHistoryItem = (term: string) => {
    commitFilterState({ search: term, category: 'All', page: 1 });
  };

  const handleResetAllFilters = () => {
    commitFilterState({
      category: 'All',
      store: 'All Stores',
      min_price: '',
      max_price: '',
      page: 1,
    });
  };

  const handleApplyMobileDrawer = (draft: { category: string; store: string; minPrice: string; maxPrice: string }) => {
    commitFilterState({
      category: draft.category,
      store: draft.store,
      min_price: draft.minPrice,
      max_price: draft.maxPrice,
      page: 1,
    });
  };

  const handleSortChange = (newSort: string) => {
    commitFilterState({ sort: newSort, page: 1 });
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      commitFilterState({ page: currentPage - 1 });
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      commitFilterState({ page: currentPage + 1 });
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  };

  const handleProductCardClick = () => {
    sessionStorage.setItem('catalogue_scroll_pos', window.scrollY.toString());
    sessionStorage.setItem('catalogue_restoring', 'true');
  };

  // Quick Action Handlers
  const handleToggleWatchlist = async (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login', { state: { from: location, message: 'Please log in to save items to Saved Gadgets.' } });
      return;
    }
    const existingWatchlistId = watchlistMap.get(product.product_id);
    if (existingWatchlistId !== undefined) {
      try {
        await removeFromWatchlist(existingWatchlistId);
        setWatchlistMap(prev => {
          const next = new Map(prev);
          next.delete(product.product_id);
          return next;
        });
        window.dispatchEvent(new Event('watchlist-updated'));
      } catch (err: any) {
        alert(err.message || 'Failed to remove from watchlist');
      }
    } else {
      try {
        const res = await addToWatchlist(product.product_id);
        const newId = res?.data?.watchlist_id || res?.watchlist_id || Date.now();
        setWatchlistMap(prev => {
          const next = new Map(prev);
          next.set(product.product_id, newId);
          return next;
        });
        window.dispatchEvent(new Event('watchlist-updated'));
      } catch (err: any) {
        alert(err.message || 'Failed to add to watchlist');
      }
    }
  };

  const handleToggleCompare = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const pid = product.product_id;
      const isAlreadyIn = compareProductIds.includes(pid);

      if (!isAlreadyIn && compareProductIds.length >= MAX_COMPARE_PRODUCTS) {
        setPendingLimitProduct(product);
        setIsCompareLimitModalOpen(true);
        return;
      }

      const res = toggleProductInCompare(pid);
      if (res.action === 'full') {
        setPendingLimitProduct(product);
        setIsCompareLimitModalOpen(true);
      } else {
        setCompareProductIds(res.ids);
      }
    } catch (err) {
      console.error('Failed to toggle compare item', err);
    }
  };

  const handleOpenAlertModal = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login', { state: { from: location, message: 'Please log in to set price drop alerts.' } });
      return;
    }
    setSelectedAlertProduct(product);
    setIsAlertModalOpen(true);
  };

  const renderZeroResult = () => {
    const rawTerm = searchTerm.trim();
    const effectiveMaxPrice = maxPrice ? parseFloat(maxPrice) : (interpretation?.maxPrice ?? null);
    const effectiveMinPrice = minPrice ? parseFloat(minPrice) : (interpretation?.minPrice ?? null);
    const hasPriceConstraint = effectiveMaxPrice !== null || effectiveMinPrice !== null;

    const parsedCat = selectedCategory !== 'All' ? selectedCategory : (interpretation?.category || null);
    const parsedKw = interpretation?.keywords || rawTerm;

    let title = 'No matching products found';
    let subtitle = "We couldn't locate any gadgets matching this filter combination. Try adjusting or clearing your search.";
    let caseType: 'PRICE' | 'KEYWORD' | 'CATEGORY' | 'GENERIC' = 'GENERIC';

    if (hasPriceConstraint) {
      caseType = 'PRICE';
      let subject = 'products';
      if (parsedKw && parsedKw.toLowerCase().includes('gaming')) {
        subject = 'gaming laptops';
      } else if (parsedCat === 'Phones' || rawTerm.toLowerCase().includes('phone') || rawTerm.toLowerCase().includes('mobile')) {
        subject = 'phones';
      } else if (parsedCat === 'Tablets' || rawTerm.toLowerCase().includes('tablet') || rawTerm.toLowerCase().includes('ipad')) {
        subject = 'tablets';
      } else if (parsedCat === 'Laptops' || rawTerm.toLowerCase().includes('laptop')) {
        subject = 'laptops';
      } else if (parsedCat === 'Monitors' || rawTerm.toLowerCase().includes('monitor')) {
        subject = 'monitors';
      } else if (parsedCat === 'Smartwatches' || rawTerm.toLowerCase().includes('watch') || rawTerm.toLowerCase().includes('smartwatch')) {
        subject = 'smartwatches';
      } else if (parsedCat === 'Headphones' || rawTerm.toLowerCase().includes('headphone') || rawTerm.toLowerCase().includes('audio')) {
        subject = 'headphones';
      } else if (parsedCat) {
        subject = parsedCat.toLowerCase();
      }

      const priceStr = effectiveMaxPrice ? formatINR(effectiveMaxPrice) : (effectiveMinPrice ? formatINR(effectiveMinPrice) : '');
      const priceCondition = effectiveMaxPrice ? `under ${priceStr}` : (effectiveMinPrice ? `above ${priceStr}` : '');

      title = `No ${subject} found ${priceCondition}`.trim();
      subtitle = subject === 'phones' 
        ? "We don't currently have smartphones in this price range in our catalogue."
        : 'Try increasing your budget or clearing the price filter.';
    } else if (rawTerm) {
      caseType = 'KEYWORD';
      title = `No products found for “${rawTerm}”`;
      subtitle = 'Try another product name, brand, or category.';
    } else if (selectedCategory !== 'All') {
      caseType = 'CATEGORY';
      title = `No ${selectedCategory} products are currently available in our catalogue.`;
      subtitle = 'Try browsing other categories or adjusting your filters.';
    }

    const handleIncreaseBudget = () => {
      let nextCat = selectedCategory;
      let nextSearch = searchTerm;
      if (interpretation?.maxPrice || interpretation?.minPrice) {
        if (interpretation.category) {
          nextCat = normalizeCategoryFromUrl(interpretation.category);
        }
        if (interpretation.keywords) {
          nextSearch = interpretation.keywords;
        } else {
          nextSearch = '';
        }
      } else if (rawTerm) {
        if (rawTerm.toLowerCase().includes('under') || rawTerm.toLowerCase().includes('below')) {
          nextSearch = rawTerm.replace(/under\s+\d+(\.\d+)?(\s*(lakh|k))?/gi, '').replace(/below\s+\d+(\.\d+)?(\s*(lakh|k))?/gi, '').trim();
        }
      }
      commitFilterState({ search: nextSearch, category: nextCat, min_price: '', max_price: '', page: 1 });
    };

    const handleClearFilters = () => {
      commitFilterState({
        category: 'All',
        store: 'All Stores',
        min_price: '',
        max_price: '',
        page: 1,
      });
    };

    const handleClearSearch = () => {
      commitFilterState({
        search: '',
        category: 'All',
        store: 'All Stores',
        min_price: '',
        max_price: '',
        page: 1,
      });
    };

    return (
      <div id="div-zero-result-card" className="bg-white border border-slate-200 p-6 sm:p-12 rounded-2xl text-center flex flex-col items-center gap-4 sm:gap-5 shadow-xs max-w-2xl w-full mx-auto my-2 sm:my-4">
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-2xs">
          <ShoppingCart className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-500" />
        </div>

        <div className="flex flex-col gap-1.5 sm:gap-2 max-w-lg">
          <h3 id="txt-zero-result-title" className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{title}</h3>
          <p id="txt-zero-result-subtitle" className="text-xs sm:text-sm text-slate-500 leading-relaxed">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 mt-2">
          {caseType === 'PRICE' && (
            <>
              <button 
                id="btn-increase-budget"
                type="button"
                onClick={handleIncreaseBudget}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 sm:px-5 rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5 min-h-[40px]"
              >
                Increase Budget
              </button>
              <button 
                id="btn-clear-filters"
                type="button"
                onClick={handleClearFilters}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 sm:px-5 rounded-xl text-xs transition-all cursor-pointer min-h-[40px]"
              >
                Clear Filters
              </button>
            </>
          )}

          {caseType === 'KEYWORD' && (
            <button 
              id="btn-clear-search"
              type="button"
              onClick={handleClearSearch}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl text-xs transition-all shadow-xs cursor-pointer min-h-[40px]"
            >
              Clear Search
            </button>
          )}

          {(caseType === 'CATEGORY' || caseType === 'GENERIC') && (
            <button 
              id="btn-reset-filters"
              type="button"
              onClick={handleClearSearch}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl text-xs transition-all shadow-xs cursor-pointer min-h-[40px]"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>
    );
  };

  const startIndex = (currentPage - 1) * itemsPerPage;

  return (
    <div className="flex-1 flex flex-col gap-4 sm:gap-6 font-sans w-full max-w-full">
      
      {/* Compact Responsive Catalogue Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Search Gadgets
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xl">
            Search products, compare verified retailer prices, and find better deals.
          </p>
        </div>
        <div className="bg-indigo-50 text-indigo-700 border border-indigo-150 rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold self-start sm:self-center flex items-center gap-1.5 shadow-2xs shrink-0">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
          <span>{totalItems} items matching</span>
        </div>
      </div>

      {/* AI Deal Advisor Product Selection Prompt Banner */}
      {initialParams.get('ai_advisor') === 'true' && (
        <div id="banner-ai-advisor-prompt" className="bg-slate-900 text-white p-3.5 sm:p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-lg sm:text-xl shrink-0">
              🤖
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-100">
                Choose a product to ask the AI Deal Advisor
              </p>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
                Select any product below to view its price history, store comparisons, and interactive AI Deal Advisor chat.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const newParams = new URLSearchParams(location.search);
              newParams.delete('ai_advisor');
              navigate({ search: newParams.toString() ? `?${newParams.toString()}` : '' }, { replace: true });
            }}
            className="text-slate-400 hover:text-white text-xs font-semibold px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors shrink-0 cursor-pointer self-end sm:self-center min-h-[32px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search and Filter Trigger Workspace */}
      <div className="flex flex-col gap-3">
        
        {/* Search Bar + Sort Container */}
        <form onSubmit={handleSearchSubmit} className="bg-white border border-slate-200 p-3 sm:p-4 rounded-xl shadow-xs flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between md:gap-4">
          
          {/* Main Search Input */}
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2" />
            <input
              id="inp-deal-search"
              type="text"
              placeholder="Search e.g. iPhone, S24, Sony, Macbook..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onBlur={() => {
                if (searchTerm.trim()) {
                  addToSearchHistory(searchTerm);
                  commitFilterState({ search: searchTerm, page: 1 });
                }
              }}
              className="w-full pl-10 sm:pl-12 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 transition-all min-h-[42px]"
            />
            {searchTerm && (
              <button 
                type="button" 
                onClick={() => {
                  setSearchTerm('');
                  commitFilterState({ search: '', page: 1 });
                }} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-full p-1 transition-colors cursor-pointer"
                title="Clear search input"
                aria-label="Clear search input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Filter Trigger + Sort Row (Visible < md) */}
          <div className="flex md:hidden items-center gap-2 w-full">
            {/* Mobile Filter Drawer Button */}
            <button
              type="button"
              id="btn-mobile-open-filters"
              onClick={() => setIsMobileFilterOpen(true)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer min-h-[44px] ${
                activeFilterCount > 0
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-indigo-600 text-white leading-tight">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Mobile Sort Dropdown */}
            <div className="flex-1 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 min-h-[44px]">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                id="sel-catalog-sort-mobile"
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="text-xs bg-transparent focus:outline-none font-semibold text-slate-700 cursor-pointer w-full py-2 truncate"
                aria-label="Sort products"
              >
                <option value="featured">Recommended</option>
                <option value="price_asc">Low → High</option>
                <option value="price_desc">High → Low</option>
                <option value="price_drop">Biggest Drop</option>
                <option value="discount_desc">Top Discount</option>
                <option value="name_asc">A → Z</option>
              </select>
            </div>
          </div>

          {/* Desktop Sort Selector (Visible >= md) */}
          <div className="hidden md:flex items-center gap-4 w-auto shrink-0">
            <div className="flex items-center gap-2 shrink-0 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <ArrowUpDown className="w-4 h-4 text-slate-500" />
              <select
                id="sel-catalog-sort"
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="text-sm bg-transparent focus:outline-none font-medium text-slate-700 cursor-pointer pr-1"
                aria-label="Sort products"
              >
                <option value="featured">Recommended</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="price_drop">Biggest Price Drop</option>
                <option value="discount_desc">Highest Discount</option>
                <option value="name_asc">Name: A to Z</option>
              </select>
            </div>
          </div>

        </form>

        {/* Mobile Active Filter Chips & Edit Filters Row (Visible < md when activeFilterCount > 0) */}
        {activeFilterCount > 0 && (
          <div className="flex flex-col gap-2 md:hidden bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
            {/* Active Chips Row */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
              <span className="text-slate-400 font-bold uppercase text-[10px] shrink-0 mr-1">Active:</span>
              
              {selectedCategory !== 'All' && (
                <span className="inline-flex items-center gap-1 bg-slate-900 text-white px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 shadow-2xs">
                  <span>{selectedCategory}</span>
                  <button
                    type="button"
                    onClick={() => commitFilterState({ type: 'All', page: 1 })}
                    className="hover:text-rose-300 transition-colors cursor-pointer p-0.5"
                    title="Remove product type filter"
                    aria-label="Remove product type filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}

              {selectedStore !== 'All Stores' && (
                <span className="inline-flex items-center gap-1 bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 shadow-2xs">
                  <span>{selectedStore}</span>
                  <button
                    type="button"
                    onClick={() => commitFilterState({ store: 'All Stores', page: 1 })}
                    className="hover:text-indigo-200 transition-colors cursor-pointer p-0.5"
                    title="Remove store filter"
                    aria-label="Remove store filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}

              {(minPrice || maxPrice) && (
                <span className="inline-flex items-center gap-1 bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 shadow-2xs">
                  <span>₹{minPrice || '0'} – ₹{maxPrice || 'Any'}</span>
                  <button
                    type="button"
                    onClick={() => commitFilterState({ min_price: '', max_price: '', page: 1 })}
                    className="hover:text-emerald-200 transition-colors cursor-pointer p-0.5"
                    title="Remove price filter"
                    aria-label="Remove price filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
            </div>

            {/* Edit Filters & Clear All Actions Row */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/80">
              <button
                type="button"
                id="btn-edit-filters"
                onClick={() => setIsMobileFilterOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer min-h-[44px]"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                <span>Edit Filters</span>
              </button>

              <button
                type="button"
                id="btn-clear-all-filters"
                onClick={handleResetAllFilters}
                className="inline-flex items-center gap-1 px-3 py-2 text-rose-600 hover:text-rose-700 text-xs font-bold uppercase cursor-pointer min-h-[44px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            </div>
          </div>
        )}

        {/* Desktop Filter Panel (Preserved for >= md screens) */}
        <div className="hidden md:flex bg-white border border-slate-200 px-5 py-4 rounded-xl shadow-sm flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 w-full pb-1">
              <span className="text-xs text-slate-500 uppercase font-semibold shrink-0 mr-1 w-full sm:w-auto">Product Type:</span>
              {CATEGORY_ITEMS.map(catItem => (
                <button
                  key={catItem.label}
                  onClick={() => commitFilterState({ type: catItem.label, page: 1 })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                    selectedCategory === catItem.label
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {catItem.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 uppercase font-semibold shrink-0 mr-1 w-full sm:w-auto">Store:</span>
              {STORES.map(store => (
                <button
                  key={store}
                  onClick={() => commitFilterState({ store, page: 1 })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                    selectedStore === store
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {store}
                </button>
              ))}
            </div>
          </div>

          {/* Budget Presets and Custom Price Range */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto pb-1 lg:pb-0">
              <span className="text-xs text-slate-500 uppercase font-semibold shrink-0 mr-1 w-full sm:w-auto">Budget:</span>
              {BUDGET_PRESETS.map(preset => {
                const isActive = (!minPrice && maxPrice === preset.max) || (!minPrice && !maxPrice && preset.max === '');
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      commitFilterState({ min_price: '', max_price: preset.max, page: 1 });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full lg:w-auto justify-end">
              <span className="text-xs text-slate-500 uppercase font-semibold shrink-0 mr-1">Custom Range (₹):</span>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  onBlur={() => commitFilterState({ min_price: minPrice, page: 1 })}
                  className="w-20 px-2 py-1 text-xs bg-transparent focus:outline-none font-medium text-slate-700 text-center"
                />
                <span className="text-slate-300">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  onBlur={() => commitFilterState({ max_price: maxPrice, page: 1 })}
                  className="w-20 px-2 py-1 text-xs bg-transparent focus:outline-none font-medium text-slate-700 text-center"
                />
                {(minPrice || maxPrice) && (
                  <button
                    type="button"
                    onClick={() => commitFilterState({ min_price: '', max_price: '', page: 1 })}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                    title="Clear price filter"
                    aria-label="Clear price filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <SearchHistoryComponent 
            onSelectTerm={handleSelectHistoryItem} 
            refreshTrigger={historyTrigger} 
          />
        </div>

      </div>

      {/* Mobile Filter Drawer */}
      <MobileFilterDrawer
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        categories={CATEGORY_ITEMS}
        selectedCategory={selectedCategory}
        stores={STORES}
        selectedStore={selectedStore}
        budgetPresets={BUDGET_PRESETS}
        minPrice={minPrice}
        maxPrice={maxPrice}
        totalItems={totalItems}
        onApply={handleApplyMobileDrawer}
        onSelectHistoryItem={handleSelectHistoryItem}
        historyTrigger={historyTrigger}
      />

      {/* Natural Language Search Interpretation Bar */}
      {interpretation && (interpretation.category || interpretation.minPrice || interpretation.maxPrice) && (
        <div id="nl-search-interpretation-bar" className="flex items-center gap-2 sm:gap-2.5 px-3.5 py-2.5 sm:px-4 sm:py-3 bg-indigo-50/80 border border-indigo-150 rounded-xl text-xs text-indigo-950 shadow-2xs">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="font-semibold text-slate-700 shrink-0">Searching for:</span>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {interpretation.category && (
              <span className="bg-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border border-indigo-200 text-indigo-800 font-bold text-[10px] sm:text-[11px] shadow-2xs">
                {normalizeCategoryFromUrl(interpretation.category)}
              </span>
            )}
            {(interpretation.minPrice || interpretation.maxPrice) && (
              <span className="bg-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border border-indigo-200 text-emerald-800 font-bold text-[10px] sm:text-[11px] shadow-2xs">
                Budget: {interpretation.minPrice ? formatINR(interpretation.minPrice) : 'Any'} – {interpretation.maxPrice ? formatINR(interpretation.maxPrice) : 'Any'}
              </span>
            )}
            {interpretation.keywords && interpretation.keywords !== '' && (
              <span className="bg-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border border-indigo-200 text-slate-700 text-[10px] sm:text-[11px] shadow-2xs">
                Keywords: "{interpretation.keywords}"
              </span>
            )}
          </div>
        </div>
      )}

      {/* Catalogue Product Grid / States */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 sm:gap-4 animate-pulse">
              <div className="w-full h-48 sm:h-52 md:aspect-square bg-slate-100 rounded-xl"></div>
              <div className="h-4 bg-slate-100 rounded w-1/3"></div>
              <div className="h-5 bg-slate-100 rounded w-5/6"></div>
              <div className="h-4 bg-slate-100 rounded w-1/2"></div>
              <div className="mt-auto border-t border-slate-100 pt-3 flex justify-between">
                <div className="h-6 bg-slate-100 rounded w-1/2"></div>
                <div className="h-4 bg-slate-100 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 sm:p-8 rounded-2xl flex flex-col items-center justify-center gap-3 text-center max-w-lg mx-auto w-full">
          <AlertCircle className="w-8 h-8 text-rose-500 shrink-0" />
          <span className="text-sm font-semibold">{error}</span>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition-colors cursor-pointer min-h-[36px]"
          >
            Retry Loading
          </button>
        </div>
      ) : products.length === 0 ? (
        renderZeroResult()
      ) : (
        <div className="flex flex-col gap-6 sm:gap-8">
          
          {/* Responsive Product Grid: 1 col on mobile, 2 col on tablet, 3-4 col on desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {products.map(p => {
              const isSaved = watchlistMap.has(p.product_id);
              const isComparing = compareProductIds.includes(p.product_id);
              const isCompareFull = !isComparing && compareProductIds.length >= MAX_COMPARE_PRODUCTS;
              const productAlert = alertsMap.get(p.product_id);
              const hasAlert = !!productAlert;

              return (
                <Link 
                  key={p.product_id} 
                  to={`/products/${p.product_id}`}
                  onClick={handleProductCardClick}
                  className="bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all rounded-2xl p-4 sm:p-5 flex flex-col h-full group relative"
                >
                  
                  {/* Desktop Hover Action Overlay: Kept for Desktop Experience */}
                  <div className="hidden md:flex absolute top-7 right-7 flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button 
                      onClick={(e) => handleToggleWatchlist(e, p)} 
                      className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs transition-colors cursor-pointer border ${
                        isSaved 
                          ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700' 
                          : 'bg-white/95 backdrop-blur-xs border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200'
                      }`}
                      title={isSaved ? 'Remove from Saved Gadgets' : 'Add to Saved Gadgets'}
                      aria-label="Toggle Saved Gadgets"
                    >
                      {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={(e) => handleToggleCompare(e, p)} 
                      className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs transition-colors cursor-pointer border ${
                        isComparing 
                          ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700' 
                          : isCompareFull
                            ? 'bg-amber-50/95 backdrop-blur-xs border-amber-300 text-amber-600 hover:bg-amber-100'
                            : 'bg-white/95 backdrop-blur-xs border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200'
                      }`}
                      title={
                        isComparing 
                          ? 'Remove from Compare' 
                          : isCompareFull 
                            ? `Compare list full (${compareProductIds.length}/${MAX_COMPARE_PRODUCTS}) - Click to manage` 
                            : 'Compare Prices'
                      }
                      aria-label={isComparing ? 'Remove from Compare' : isCompareFull ? 'Compare list full' : 'Toggle Compare'}
                    >
                      <Scale className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleOpenAlertModal(e, p)} 
                      className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs transition-colors cursor-pointer border ${
                        hasAlert 
                          ? 'bg-rose-500 text-white border-rose-500 hover:bg-rose-600' 
                          : 'bg-white/95 backdrop-blur-xs border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200'
                      }`}
                      title={hasAlert ? `Price Alert active (${formatINR(productAlert.target_price)})` : 'Set Price Alert'}
                      aria-label="Price Alert"
                    >
                      <BellRing className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Responsive Product Image Wrapper (176px mobile, 208px tablet, square desktop) */}
                  <div className="relative h-44 sm:h-52 md:aspect-square w-full rounded-xl bg-slate-50 p-3 sm:p-4 overflow-hidden border border-slate-100 mb-3 sm:mb-4 flex items-center justify-center shrink-0">
                    <img
                      referrerPolicy="no-referrer"
                      src={p.image_url || FALLBACK_IMAGE}
                      alt={p.name}
                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500 mix-blend-multiply"
                    />
                    {(p.price_drop_pct && p.price_drop_pct > 0) || (p.discount_pct && p.discount_pct > 0) ? (
                      <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 flex flex-col gap-1 sm:gap-1.5 items-start z-10">
                        {p.price_drop_pct && p.price_drop_pct > 0 ? (
                          <span className="bg-emerald-600 text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md shadow-xs flex items-center gap-1">
                            ↓ {p.price_drop_pct}% Drop
                          </span>
                        ) : p.discount_pct && p.discount_pct > 0 ? (
                          <span className="bg-amber-600 text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md shadow-xs">
                            {p.discount_pct}% OFF
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {/* Product Card Text */}
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="text-[11px] text-slate-500 uppercase font-semibold flex items-center justify-between mb-1">
                      <span className="text-indigo-600 truncate">{p.brand}</span>
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug sm:leading-tight mb-2 group-hover:text-indigo-600 transition-colors min-w-0">
                      {p.name}
                    </h3>
                  </div>

                  {/* Price and Details Section */}
                  <div className="border-t border-slate-100 pt-3 mt-auto flex flex-col gap-2.5">
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                          Current Best
                        </div>
                        {p.cheapest_price !== undefined ? (
                          <div className="flex flex-col">
                            <span className="text-base sm:text-xl font-extrabold text-slate-900 leading-tight">
                              {formatINR(p.cheapest_price)}
                            </span>
                            <span className="text-[11px] sm:text-xs text-slate-500 font-medium truncate max-w-[130px] sm:max-w-[150px] flex items-center gap-1 mt-0.5">
                              via {p.store_name || 'Retailer'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs sm:text-sm font-medium text-slate-400">Price unavailable</span>
                        )}
                      </div>

                      <div 
                        className="flex items-center gap-1 sm:gap-1.5 px-3 py-2 bg-slate-50 group-hover:bg-indigo-600 rounded-xl transition-colors shrink-0 min-h-[44px] min-w-[44px] justify-center"
                        aria-label={`View deal for ${p.name}`}
                      >
                        <span className="text-xs font-bold text-slate-500 group-hover:text-white transition-colors hidden sm:block">
                          View Deal
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                      </div>
                    </div>

                    {/* Mobile Quick Action Row: Touch-friendly action buttons (< md) */}
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 md:hidden">
                      <button
                        type="button"
                        onClick={(e) => handleToggleWatchlist(e, p)}
                        className={`flex items-center justify-center gap-1 py-2 px-1 rounded-xl border text-[11px] font-semibold transition-all min-h-[44px] active:scale-95 cursor-pointer ${
                          isSaved
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                        title={isSaved ? 'Saved in Saved Gadgets' : 'Save to Saved Gadgets'}
                      >
                        {isSaved ? <BookmarkCheck className="w-3.5 h-3.5 shrink-0 text-indigo-600" /> : <Bookmark className="w-3.5 h-3.5 shrink-0 text-slate-400" />}
                        <span className="truncate">{isSaved ? 'Saved' : 'Save'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleToggleCompare(e, p)}
                        className={`flex items-center justify-center gap-1 py-2 px-1 rounded-xl border text-[11px] font-semibold transition-all min-h-[44px] active:scale-95 cursor-pointer ${
                          isComparing
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                            : isCompareFull
                              ? 'bg-amber-50/80 border-amber-200 text-amber-700 hover:bg-amber-100'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                        title={
                          isComparing 
                            ? 'Added to Compare' 
                            : isCompareFull 
                              ? `Compare list full (${compareProductIds.length}/${MAX_COMPARE_PRODUCTS}) - Tap to manage` 
                              : 'Compare Product'
                        }
                      >
                        <Scale className={`w-3.5 h-3.5 shrink-0 ${isComparing ? 'text-indigo-600' : isCompareFull ? 'text-amber-600' : 'text-slate-400'}`} />
                        <span className="truncate">{isComparing ? 'Added' : isCompareFull ? 'Full 4/4' : 'Compare'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleOpenAlertModal(e, p)}
                        className={`flex items-center justify-center gap-1 py-2 px-1 rounded-xl border text-[11px] font-semibold transition-all min-h-[44px] active:scale-95 cursor-pointer ${
                          hasAlert
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                        title={hasAlert ? `Active Alert (${formatINR(productAlert.target_price)})` : 'Set Price Alert'}
                      >
                        <BellRing className={`w-3.5 h-3.5 shrink-0 ${hasAlert ? 'text-rose-600' : 'text-slate-400'}`} />
                        <span className="truncate">{hasAlert ? 'Alert On' : 'Alert'}</span>
                      </button>
                    </div>

                  </div>

                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-slate-200 pt-4 sm:pt-6 mt-2 sm:mt-4">
              
              {/* Mobile & Tablet Compact Pagination (< lg) */}
              <div className="flex lg:hidden items-center justify-between gap-3 w-full">
                <button
                  type="button"
                  id="btn-prev-page-mobile"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all min-h-[44px] shrink-0 ${
                    currentPage === 1
                      ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer'
                  }`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>

                <div className="text-xs font-bold text-slate-700 text-center min-w-0">
                  <span>Page {currentPage} of {totalPages}</span>
                  <div className="text-[10px] text-slate-400 font-normal">
                    {totalItems} items
                  </div>
                </div>

                <button
                  type="button"
                  id="btn-next-page-mobile"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all min-h-[44px] shrink-0 ${
                    currentPage === totalPages
                      ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer'
                  }`}
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Desktop Full Numbered Pagination (>= lg) */}
              <div className="hidden lg:flex items-center justify-between gap-4 flex-wrap">
                <span className="text-sm text-slate-500 font-medium bg-white px-4 py-2 border border-slate-200 rounded-lg shrink-0">
                  Showing <strong className="text-slate-900">{startIndex + 1}</strong> - <strong className="text-slate-900">{Math.min(startIndex + itemsPerPage, totalItems)}</strong> of <strong className="text-slate-900">{totalItems}</strong>
                </span>
                
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-lg border text-sm font-semibold flex items-center gap-1.5 transition-all ${
                      currentPage === 1
                        ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm cursor-pointer'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Prev</span>
                  </button>
                  
                  <div className="flex items-center gap-1.5 mx-2 overflow-x-auto max-w-sm py-1">
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          commitFilterState({ page: idx + 1 });
                          window.scrollTo({ top: 120, behavior: 'smooth' });
                        }}
                        className={`h-9 w-9 rounded-lg text-sm font-bold transition-all shadow-sm cursor-pointer ${
                          currentPage === idx + 1
                            ? 'bg-indigo-600 text-white border-indigo-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-lg border text-sm font-semibold flex items-center gap-1.5 transition-all ${
                      currentPage === totalPages
                        ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm cursor-pointer'
                    }`}
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* Reusable Price Alert Modal */}
      <PriceAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => {
          setIsAlertModalOpen(false);
          setSelectedAlertProduct(null);
        }}
        product={selectedAlertProduct}
        existingAlert={selectedAlertProduct ? alertsMap.get(selectedAlertProduct.product_id) : undefined}
        onAlertSaved={() => {
          syncPriceAlerts();
        }}
      />

      {/* Reusable Compare Limit Capacity Modal */}
      <CompareLimitModal
        isOpen={isCompareLimitModalOpen}
        onClose={() => {
          setIsCompareLimitModalOpen(false);
          setPendingLimitProduct(null);
        }}
        pendingProduct={pendingLimitProduct}
        currentCount={compareProductIds.length}
        onReplaceSuccess={(updatedIds) => {
          setCompareProductIds(updatedIds);
        }}
      />
    </div>
  );
}
