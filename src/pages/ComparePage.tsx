import React, { useEffect, useState } from 'react';
import { fetchProducts, fetchProductDetails, fetchPriceHistory } from '../services/api';
import { Product, StorePricing } from '../types/frontend';
import { formatINR, isRealSpec, getRetailerTrendInfo, extractParsedSpecs, ParsedSpecs } from '../utils/currency';
import { MAX_COMPARE_PRODUCTS, getCompareProductIds, saveCompareProductIds, clearAllCompareProducts } from '../utils/compare';
import { getDisplayProductType } from '../utils/productType';
import { 
  Scale, Trash2, ArrowRightLeft, Store, X, Plus, AlertCircle, ShoppingBag, 
  ExternalLink, CheckCircle, RefreshCw, ChevronRight, Award, Tag, Info, Layers
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400";

interface CompareItemData {
  product: Product;
  offers: StorePricing[];
  priceHistory: any[];
  parsedSpecs: ParsedSpecs;
}

const ComparePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract query parameters and location state
  const searchParams = new URLSearchParams(location.search);
  const incomingMode = location.state?.mode || searchParams.get('mode');
  const incomingProductIdRaw = location.state?.productId || searchParams.get('productId') || searchParams.get('id');
  const incomingProductId = incomingProductIdRaw ? parseInt(String(incomingProductIdRaw), 10) : null;

  // Single Source of Truth for Compare Mode: 'product' = Compare Products, 'retailer' = Compare Retailers
  const [activeMode, setActiveMode] = useState<'product' | 'retailer'>(() => {
    if (incomingMode === 'retailer' || incomingMode === 'retailers') return 'retailer';
    if (incomingMode === 'product' || incomingMode === 'products') return 'product';
    try {
      const saved = localStorage.getItem('deal_compare_ids');
      if (saved) {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids) && ids.length === 1) return 'retailer';
      }
    } catch {}
    return 'product';
  });

  const [selectedRetailerProductId, setSelectedRetailerProductId] = useState<number | null>(() => {
    if (incomingProductId && !isNaN(incomingProductId)) return incomingProductId;
    try {
      const saved = localStorage.getItem('deal_compare_ids');
      if (saved) {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids) && ids.length > 0) return ids[0];
      }
    } catch {}
    return null;
  });

  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    let ids: number[] = getCompareProductIds();
    if (incomingProductId && !isNaN(incomingProductId) && !ids.includes(incomingProductId)) {
      ids = [incomingProductId, ...ids].slice(0, MAX_COMPARE_PRODUCTS);
    }
    return ids;
  });

  const [productsData, setProductsData] = useState<Record<number, CompareItemData>>({});
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // Pending Product preservation state for capacity flow
  const [pendingProduct, setPendingProduct] = useState<Product | null>(() => {
    const p = (location.state as any)?.pendingCompareProduct || (location.state as any)?.pendingProduct;
    if (p && p.product_id) {
      return p;
    }
    return null;
  });

  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // Sync navigation/route parameters
  useEffect(() => {
    loadProductsForSelector();

    const statePending = (location.state as any)?.pendingCompareProduct || (location.state as any)?.pendingProduct;
    if (statePending && statePending.product_id) {
      setPendingProduct(statePending);
    }

    if (incomingProductId && !isNaN(incomingProductId)) {
      setSelectedRetailerProductId(incomingProductId);
      setSelectedIds(prev => {
        if (!prev.includes(incomingProductId) && prev.length < MAX_COMPARE_PRODUCTS) {
          const updated = [incomingProductId, ...prev].slice(0, MAX_COMPARE_PRODUCTS);
          saveCompareProductIds(updated);
          return updated;
        }
        return prev;
      });
      if (incomingMode === 'retailer' || incomingMode === 'retailers') {
        setActiveMode('retailer');
      }
    } else if (incomingMode === 'retailer' || incomingMode === 'retailers') {
      setActiveMode('retailer');
    } else if (incomingMode === 'product' || incomingMode === 'products') {
      setActiveMode('product');
    }
  }, [location.search, location.state]);

  // If pending product is already in selectedIds, clear it to avoid duplicate suggestion
  useEffect(() => {
    if (pendingProduct && selectedIds.includes(pendingProduct.product_id)) {
      setPendingProduct(null);
    }
  }, [pendingProduct, selectedIds]);

  // Save to localStorage & fetch missing item details
  useEffect(() => {
    saveCompareProductIds(selectedIds);
    
    if (selectedIds.length > 0 && !selectedRetailerProductId) {
      setSelectedRetailerProductId(selectedIds[0]);
    }

    selectedIds.forEach(id => {
      if (!productsData[id]) {
        loadProductDetail(id);
      }
    });
  }, [selectedIds]);

  const loadProductsForSelector = async () => {
    try {
      const res = await fetchProducts(1, 50, undefined, searchQuery);
      setAllProducts(res.products);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProductsForSelector();
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadProductDetail = async (id: number) => {
    setLoading(true);
    setFetchError(null);
    try {
      const details = await fetchProductDetails(id);
      let historyData: any[] = [];
      try {
        historyData = await fetchPriceHistory(id);
      } catch (err) {
        console.error('Price history load failed for compare item', id, err);
      }

      const parsedSpecs = extractParsedSpecs(details.product);

      setProductsData(prev => ({
        ...prev,
        [id]: {
          product: details.product,
          offers: details.storesPricing || [],
          priceHistory: historyData || [],
          parsedSpecs
        }
      }));
    } catch (e: any) {
      console.error(e);
      setFetchError('Unable to load comparison data.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    selectedIds.forEach(id => loadProductDetail(id));
  };

  const addProduct = (id: number) => {
    // REQUIREMENT 3: SAME PRODUCT ADDED TWICE / DUPLICATE HANDLING
    if (selectedIds.includes(id)) {
      const existingName = productsData[id]?.product?.name || 'This product';
      // Do NOT create duplicate column. Automatically switch to Retailer Comparison context
      setSelectedRetailerProductId(id);
      setActiveMode('retailer');
      setBannerMessage(`"${existingName}" is already selected — switched to Retailer Comparison.`);
      setShowSelector(false);
      setSearchQuery('');
      setTimeout(() => setBannerMessage(null), 5000);
      return;
    }

    if (selectedIds.length >= MAX_COMPARE_PRODUCTS) {
      alert(`You can compare up to ${MAX_COMPARE_PRODUCTS} products at once.`);
      return;
    }

    const updated = [...selectedIds, id];
    setSelectedIds(updated);
    if (updated.length > 1 && activeMode === 'retailer' && selectedIds.length === 1) {
      setActiveMode('product');
    }
    setShowSelector(false);
    setSearchQuery('');
  };

  const removeProduct = (id: number) => {
    const updated = selectedIds.filter(i => i !== id);
    setSelectedIds(updated);
    if (selectedRetailerProductId === id) {
      setSelectedRetailerProductId(updated[0] || null);
    }
    if (updated.length === 1) {
      setActiveMode('retailer');
      setSelectedRetailerProductId(updated[0]);
    }
  };

  const handleAddPendingProduct = () => {
    if (!pendingProduct) return;
    const pid = pendingProduct.product_id;
    if (selectedIds.includes(pid)) {
      setPendingProduct(null);
      return;
    }
    if (selectedIds.length >= MAX_COMPARE_PRODUCTS) {
      return;
    }
    const updated = [...selectedIds, pid];
    setSelectedIds(updated);
    saveCompareProductIds(updated);
    if (updated.length > 1 && activeMode === 'retailer') {
      setActiveMode('product');
    }
    setPendingProduct(null);
  };

  const clearAll = () => {
    setSelectedIds([]);
    setProductsData({});
    setSelectedRetailerProductId(null);
    setActiveMode('product');
    setPendingProduct(null);
    clearAllCompareProducts();
  };

  const compareItems = selectedIds.map(id => productsData[id]).filter(Boolean);

  // Focus product for Retailer Comparison mode
  const activeRetailerItem = selectedRetailerProductId && productsData[selectedRetailerProductId] 
    ? productsData[selectedRetailerProductId]
    : compareItems[0];

  // Price calculations across products for Product Comparison
  const productPricesMap: Record<number, number | undefined> = {};
  let overallMinPrice = Infinity;
  let overallMaxPrice = -Infinity;

  compareItems.forEach(item => {
    const validPrices = item.offers
      .map(o => parseFloat(o.price as any))
      .filter(p => !isNaN(p) && p > 0);
    
    if (validPrices.length > 0) {
      const minP = Math.min(...validPrices);
      productPricesMap[item.product.product_id] = minP;
      if (minP < overallMinPrice) overallMinPrice = minP;
      if (minP > overallMaxPrice) overallMaxPrice = minP;
    }
  });

  return (
    <div className="flex-1 flex flex-col gap-4 sm:gap-6 font-sans w-full max-w-full min-w-0">
      {/* Sticky Header / Page Controls */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex flex-col gap-3 sm:gap-4">
          
          {/* Top Row: Title + Count / Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Scale className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0" />
                  <span>{activeMode === 'retailer' ? 'Compare Retailers' : 'Compare Products'}</span>
                </h1>
                {activeMode === 'product' && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {selectedIds.length} of {MAX_COMPARE_PRODUCTS} selected
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {activeMode === 'retailer'
                  ? 'Compare retailer prices for the same product and find the best available deal.'
                  : 'Compare products side-by-side to find the best choice for you.'}
              </p>
            </div>

            {/* Desktop & Tablet Action Buttons */}
            <div className="hidden sm:flex items-center gap-2 sm:gap-3 flex-wrap shrink-0">
              {selectedIds.length < MAX_COMPARE_PRODUCTS && (
                <button
                  onClick={() => navigate('/products')}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs shrink-0 min-h-[44px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Product</span>
                </button>
              )}

              {selectedIds.length > 0 && (
                <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 min-h-[44px]">
                  <button
                    onClick={() => setActiveMode('product')}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[36px] ${
                      activeMode === 'product'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Compare Products
                  </button>
                  <button
                    onClick={() => setActiveMode('retailer')}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[36px] ${
                      activeMode === 'retailer'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Compare Retailers
                  </button>
                </div>
              )}

              {selectedIds.length > 0 && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-h-[44px] border border-rose-100"
                  title="Clear comparison list"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile Dedicated Controls Bar (<sm) */}
          <div className="flex sm:hidden flex-col gap-2 pt-1 border-t border-slate-100">
            {/* Mode Switcher Buttons */}
            {selectedIds.length > 0 && (
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1 w-full">
                <button
                  onClick={() => setActiveMode('product')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all text-center min-h-[44px] flex items-center justify-center ${
                    activeMode === 'product'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Compare Products
                </button>
                <button
                  onClick={() => setActiveMode('retailer')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all text-center min-h-[44px] flex items-center justify-center ${
                    activeMode === 'retailer'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Compare Retailers
                </button>
              </div>
            )}

            {/* Actions Row: Add Product + Clear All */}
            <div className="flex items-center gap-2 justify-between w-full">
              {selectedIds.length < MAX_COMPARE_PRODUCTS ? (
                <button
                  onClick={() => navigate('/products')}
                  className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 active:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product ({selectedIds.length}/{MAX_COMPARE_PRODUCTS})</span>
                </button>
              ) : (
                <div className="flex-1 text-[11px] text-slate-500 font-medium bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-center min-h-[44px] flex items-center justify-center">
                  Maximum {MAX_COMPARE_PRODUCTS} products compared
                </div>
              )}

              {selectedIds.length > 0 && (
                <button
                  onClick={clearAll}
                  className="min-h-[44px] px-3.5 py-2 bg-rose-50 active:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 border border-rose-100"
                  title="Clear comparison list"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 w-full max-w-full min-w-0">
        {/* Pending Product Banner */}
        {pendingProduct && !selectedIds.includes(pendingProduct.product_id) && (
          selectedIds.length >= MAX_COMPARE_PRODUCTS ? (
            /* Comparison is full (4/4) - Waiting to add */
            <div className="mb-6 bg-amber-50 border border-amber-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-slate-800 shadow-xs animate-in fade-in">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                <img
                  src={pendingProduct.image_url || FALLBACK_IMAGE}
                  alt={pendingProduct.name}
                  className="w-12 h-12 rounded-xl object-contain bg-white border border-amber-200 p-1 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-md border border-amber-300">
                      Waiting to add
                    </span>
                    <span className="text-xs text-amber-700 font-medium">({selectedIds.length}/{MAX_COMPARE_PRODUCTS} full)</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate mt-0.5" title={pendingProduct.name}>
                    {pendingProduct.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Your comparison is full. Remove one product to make room.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => setPendingProduct(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-amber-100/80 rounded-xl transition-colors cursor-pointer min-h-[44px] flex items-center gap-1.5"
                  title="Dismiss pending product"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Dismiss</span>
                </button>
              </div>
            </div>
          ) : (
            /* Comparison has room (e.g. 3/4) - Ready to add */
            <div className="mb-6 bg-emerald-50 border border-emerald-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-slate-800 shadow-xs animate-in fade-in">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                <img
                  src={pendingProduct.image_url || FALLBACK_IMAGE}
                  alt={pendingProduct.name}
                  className="w-12 h-12 rounded-xl object-contain bg-white border border-emerald-200 p-1 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Ready to add
                    </span>
                    <span className="text-xs text-emerald-700 font-medium">({selectedIds.length}/{MAX_COMPARE_PRODUCTS})</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate mt-0.5" title={pendingProduct.name}>
                    <span className="text-emerald-800 font-bold">{pendingProduct.name}</span> can now be added.
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Slot available. Add it now to view side-by-side specifications and deals.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => setPendingProduct(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-emerald-100/80 rounded-xl transition-colors cursor-pointer min-h-[44px]"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={handleAddPendingProduct}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-xs cursor-pointer min-h-[44px] flex items-center gap-1.5 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add to Compare</span>
                </button>
              </div>
            </div>
          )
        )}

        {/* Duplicate or Mode Switch Banner */}
        {bannerMessage && (
          <div className="mb-6 bg-indigo-900 text-white px-4 py-3 rounded-xl flex items-center justify-between text-xs sm:text-sm shadow-md animate-fade-in">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-300 shrink-0" />
              <span>{bannerMessage}</span>
            </div>
            <button 
              onClick={() => setBannerMessage(null)}
              className="text-indigo-200 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error State */}
        {fetchError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center max-w-lg mx-auto my-8">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900 mb-1">{fetchError}</h3>
            <p className="text-xs text-slate-500 mb-4">Check your network connection and try again.</p>
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && compareItems.length === 0 && !fetchError && (
          <div className="p-12 text-center text-slate-500">
            <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-medium">Loading comparison data...</p>
          </div>
        )}

        {/* EMPTY STATE */}
        {selectedIds.length === 0 && !loading && !fetchError && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-14 text-center shadow-xs max-w-2xl mx-auto my-4 sm:my-8">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-inner">
              <ArrowRightLeft className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Start comparing products</h2>
            <p className="text-slate-500 mb-6 sm:mb-8 text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
              Add products from Search Gadgets or use Compare on a product details page.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/products')}
                className="inline-flex items-center px-5 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors gap-2 text-xs sm:text-sm cursor-pointer shadow-xs w-full sm:w-auto justify-center min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                Add Product to Compare
              </button>
              <button
                onClick={() => navigate('/products')}
                className="inline-flex items-center px-5 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-colors gap-2 text-xs sm:text-sm cursor-pointer w-full sm:w-auto justify-center min-h-[44px]"
              >
                <ShoppingBag className="w-4 h-4" />
                Search Gadgets
              </button>
            </div>
          </div>
        )}

        {/* ACTIVE COMPARISON CONTENT */}
        {compareItems.length > 0 && !fetchError && (
          <div className="space-y-6 sm:space-y-8">
            
            {/* ========================================================== */}
            {/* MODE B: RETAILER COMPARISON VIEW */}
            {/* ========================================================== */}
            {activeMode === 'retailer' && activeRetailerItem && (
              <div className="space-y-4 sm:space-y-6">
                
                {/* Product Switcher: Compact Scrollable Chips (scrollbar hidden) */}
                {compareItems.length > 1 && (
                  <div
                    className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full [&::-webkit-scrollbar]:hidden"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">Product:</span>
                    {compareItems.map(item => (
                      <button
                        key={item.product.product_id}
                        onClick={() => setSelectedRetailerProductId(item.product.product_id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border min-h-[36px] ${
                          selectedRetailerProductId === item.product.product_id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate max-w-[140px] sm:max-w-[180px]">{item.product.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Hero Retailer Banner */}
                {(() => {
                  const validOffers = activeRetailerItem.offers
                    .filter(o => o.price && !isNaN(parseFloat(o.price as any)))
                    .sort((a, b) => parseFloat(a.price as any) - parseFloat(b.price as any));

                  const lowestOffer = validOffers[0];
                  const highestOffer = validOffers[validOffers.length - 1];
                  const lowestPrice = lowestOffer ? parseFloat(lowestOffer.price as any) : 0;
                  const highestPrice = highestOffer ? parseFloat(highestOffer.price as any) : 0;
                  const savings = highestPrice > lowestPrice ? highestPrice - lowestPrice : 0;

                  return (
                    <div className="bg-indigo-900 text-white rounded-2xl p-4 sm:p-8 shadow-md border border-indigo-800">
                      {/* Product Header & Best Price Highlights */}
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                          <Link
                            to={`/products/${activeRetailerItem.product.product_id}`}
                            className="block w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-xl p-1.5 sm:p-2 shrink-0 border border-indigo-700 cursor-pointer overflow-hidden"
                            title={`View details for ${activeRetailerItem.product.name}`}
                          >
                            <img
                              referrerPolicy="no-referrer"
                              src={activeRetailerItem.product.image_url || FALLBACK_IMAGE}
                              alt={activeRetailerItem.product.name}
                              onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                              className="w-full h-full object-contain mix-blend-multiply hover:scale-105 transition-transform duration-300"
                            />
                          </Link>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                              Retailer Comparison Mode
                            </span>
                            <Link to={`/products/${activeRetailerItem.product.product_id}`} className="block mt-0.5" title={`View details for ${activeRetailerItem.product.name}`}>
                              <h2 className="text-base sm:text-xl font-bold text-white leading-snug hover:text-indigo-100 hover:underline transition-colors line-clamp-2">
                                {activeRetailerItem.product.name}
                              </h2>
                            </Link>
                            <p className="text-xs text-indigo-200 mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-white">{activeRetailerItem.product.brand}</span>
                              <span>•</span>
                              <span>{getDisplayProductType(activeRetailerItem.product)}</span>
                            </p>
                          </div>
                        </div>

                        {/* Best Price Summary Card */}
                        {lowestOffer && (
                          <div className="w-full md:w-auto bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-3.5 sm:p-4 shrink-0 min-w-[220px]">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-0.5">
                              <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>🏆 Best Price Offer</span>
                            </div>
                            <div className="text-xl sm:text-2xl font-black text-white">
                              {formatINR(lowestPrice)}
                            </div>
                            <div className="text-xs text-emerald-300 font-medium mt-0.5">
                              Available at <span className="font-bold text-white">{lowestOffer.store_name}</span>
                            </div>
                            {savings > 0 && (
                              <div className="mt-2 pt-2 border-t border-emerald-800/60 text-[11px] font-semibold text-emerald-300">
                                You save {formatINR(savings)} vs highest offer
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Retailers List Section */}
                      <div className="mt-6 sm:mt-8">
                        <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Store className="w-4 h-4 text-indigo-300" />
                          <span>Active Retailer Offers ({validOffers.length})</span>
                        </h3>

                        {validOffers.length > 0 ? (
                          <div className="bg-white text-slate-900 rounded-xl overflow-hidden shadow-xs border border-indigo-800">
                            
                            {/* MOBILE RETAILER CARDS (<md) */}
                            <div className="block md:hidden divide-y divide-slate-100">
                              {validOffers.map((offer, idx) => {
                                const isCheapest = idx === 0;
                                const priceNum = parseFloat(offer.price as any);
                                const diffFromHighest = highestPrice - priceNum;
                                const trendInfo = getRetailerTrendInfo(offer, activeRetailerItem.priceHistory);

                                const isValidUrl = offer.product_url && 
                                  (offer.product_url.startsWith('http://') || offer.product_url.startsWith('https://'));

                                return (
                                  <div key={offer.price_id} className={`p-4 flex flex-col gap-3 ${isCheapest ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}`}>
                                    
                                    {/* Store Name + Badge */}
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        {isValidUrl ? (
                                          <a
                                            href={offer.product_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 cursor-pointer transition-colors shrink-0"
                                            title={`Visit ${offer.store_name}`}
                                          >
                                            {offer.store_name.substring(0, 2)}
                                          </a>
                                        ) : (
                                          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0">
                                            {offer.store_name.substring(0, 2)}
                                          </div>
                                        )}
                                        {isValidUrl ? (
                                          <a
                                            href={offer.product_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-bold text-slate-900 hover:text-indigo-600 hover:underline transition-colors cursor-pointer inline-flex items-center gap-1 text-sm truncate"
                                            title={`Visit ${offer.store_name}`}
                                          >
                                            <span className="truncate">{offer.store_name}</span>
                                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                          </a>
                                        ) : (
                                          <span className="font-bold text-slate-900 text-sm truncate">{offer.store_name}</span>
                                        )}
                                      </div>

                                      {isCheapest && (
                                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0">
                                          🏆 Best Price
                                        </span>
                                      )}
                                    </div>

                                    {/* Price & Savings */}
                                    <div className="flex items-baseline justify-between gap-2">
                                      <div>
                                        <div className="text-[11px] text-slate-500 font-medium">Price</div>
                                        <div className="text-xl font-bold text-slate-900">{formatINR(priceNum)}</div>
                                      </div>
                                      <div className="text-right">
                                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                                          <CheckCircle className="w-3 h-3 text-emerald-600" /> In Stock
                                        </span>
                                        {diffFromHighest > 0 && (
                                          <div className="text-[11px] text-emerald-600 font-bold mt-0.5">
                                            Save {formatINR(diffFromHighest)} vs highest
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Trend info if present */}
                                    {trendInfo && (trendInfo.type === 'down' || trendInfo.type === 'up') && (
                                      <div className="text-xs">
                                        {trendInfo.type === 'down' ? (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                                            ↓ {trendInfo.percentage.toFixed(1)}% price drop
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                                            ↑ {trendInfo.percentage.toFixed(1)}% increase
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {/* Action Button */}
                                    {isValidUrl ? (
                                      <a
                                        href={offer.product_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 active:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                                      >
                                        <span>Buy Now</span>
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    ) : (
                                      <div className="text-center text-xs text-slate-400 py-1 italic">
                                        Direct link unavailable
                                      </div>
                                    )}

                                  </div>
                                );
                              })}
                            </div>

                            {/* DESKTOP VIEW: TABLE (>=md) */}
                            <div className="hidden md:block overflow-x-auto">
                              <table className="w-full text-left border-collapse min-w-[650px]">
                                <thead>
                                  <tr className="bg-slate-100 text-slate-600 text-xs uppercase font-bold border-b border-slate-200">
                                    <th className="p-3.5">Retailer</th>
                                    <th className="p-3.5">Current Price</th>
                                    <th className="p-3.5">Price Trend</th>
                                    <th className="p-3.5">Savings vs Highest</th>
                                    <th className="p-3.5">Availability</th>
                                    <th className="p-3.5 text-right">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                  {validOffers.map((offer, idx) => {
                                    const isCheapest = idx === 0;
                                    const priceNum = parseFloat(offer.price as any);
                                    const diffFromHighest = highestPrice - priceNum;
                                    const trendInfo = getRetailerTrendInfo(offer, activeRetailerItem.priceHistory);

                                    const isValidUrl = offer.product_url && 
                                      (offer.product_url.startsWith('http://') || offer.product_url.startsWith('https://'));

                                    return (
                                      <tr key={offer.price_id} className={isCheapest ? 'bg-emerald-50/40' : 'hover:bg-slate-50'}>
                                        <td className="p-3.5 font-semibold text-slate-900">
                                          <div className="flex items-center gap-2">
                                            {isValidUrl ? (
                                              <a
                                                href={offer.product_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 cursor-pointer transition-colors"
                                                title={`Visit ${offer.store_name}`}
                                              >
                                                {offer.store_name.substring(0, 2)}
                                              </a>
                                            ) : (
                                              <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                                                {offer.store_name.substring(0, 2)}
                                              </div>
                                            )}
                                            {isValidUrl ? (
                                              <a
                                                href={offer.product_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-semibold text-slate-900 hover:text-indigo-600 hover:underline transition-colors cursor-pointer inline-flex items-center gap-1"
                                                title={`Visit ${offer.store_name}`}
                                              >
                                                <span>{offer.store_name}</span>
                                                <ExternalLink className="w-3 h-3 text-slate-400" />
                                              </a>
                                            ) : (
                                              <span>{offer.store_name}</span>
                                            )}
                                            {isCheapest && (
                                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                                🏆 Best Price
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="p-3.5 font-bold text-slate-900">
                                          {formatINR(priceNum)}
                                        </td>
                                        <td className="p-3.5">
                                          {trendInfo && (trendInfo.type === 'down' || trendInfo.type === 'up') && (
                                            <div>
                                              {trendInfo.type === 'down' && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                                                  ↓ {trendInfo.percentage.toFixed(1)}% <span className="font-normal text-[10px] text-emerald-700/80">since last recorded price</span>
                                                </span>
                                              )}
                                              {trendInfo.type === 'up' && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                                                  ↑ {trendInfo.percentage.toFixed(1)}% <span className="font-normal text-[10px] text-rose-700/80">since last recorded price</span>
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </td>
                                        <td className="p-3.5 text-xs text-slate-600 font-medium">
                                          {diffFromHighest > 0 && (
                                            <span className="text-emerald-600 font-bold">Save {formatINR(diffFromHighest)}</span>
                                          )}
                                        </td>
                                        <td className="p-3.5 text-xs">
                                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                                            <CheckCircle className="w-3 h-3 text-emerald-600" /> In Stock
                                          </span>
                                        </td>
                                        <td className="p-3.5 text-right">
                                          {isValidUrl ? (
                                            <a
                                              href={offer.product_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                                            >
                                              <span>Buy Now</span>
                                              <ExternalLink className="w-3 h-3" />
                                            </a>
                                          ) : null}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <div className="p-6 bg-white/10 rounded-xl text-center text-xs text-indigo-200">
                            No active store offers currently recorded for this item.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

              </div>
            )}

            {/* ========================================================== */}
            {/* MODE A: COMPARE PRODUCTS */}
            {/* ========================================================== */}
            {activeMode === 'product' && (
              <div className="w-full max-w-full min-w-0">
                
                {/* -------------------------------------------------------- */}
                {/* MOBILE DEDICATED STACKED VIEW (<md) */}
                {/* -------------------------------------------------------- */}
                <div className="block md:hidden space-y-4 w-full max-w-full min-w-0">
                  
                  {/* 1. Selected Products Summary Grid */}
                  <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Selected Products ({compareItems.length}/{MAX_COMPARE_PRODUCTS})
                      </span>
                      {compareItems.length < MAX_COMPARE_PRODUCTS && (
                        <button
                          onClick={() => navigate('/products')}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add More</span>
                        </button>
                      )}
                    </div>

                    {/* Compact 2-column or 1-column Product Cards */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {compareItems.map(item => {
                        const minPrice = productPricesMap[item.product.product_id];
                        const isOverallCheapest = minPrice !== undefined && minPrice === overallMinPrice && compareItems.length > 1;

                        return (
                          <div
                            key={item.product.product_id}
                            className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex flex-col justify-between relative group"
                          >
                            {/* Remove Button (44px minimum interactive touch target) */}
                            <button
                              type="button"
                              onClick={() => removeProduct(item.product.product_id)}
                              className="absolute -top-1.5 -right-1.5 min-w-[44px] min-h-[44px] p-2 flex items-center justify-center cursor-pointer z-10 text-slate-400 active:text-rose-600 group/remove"
                              aria-label={`Remove ${item.product.name} from comparison`}
                              title={`Remove ${item.product.name}`}
                            >
                              <span className="w-7 h-7 rounded-full bg-white/95 border border-slate-200 shadow-2xs flex items-center justify-center group-active/remove:bg-rose-50 group-active/remove:text-rose-600 group-active/remove:border-rose-200 transition-colors">
                                <X className="w-3.5 h-3.5" />
                              </span>
                            </button>

                            <div>
                              <Link
                                to={`/products/${item.product.product_id}`}
                                className="block w-full aspect-4/3 bg-white rounded-lg p-1.5 mb-2 flex items-center justify-center border border-slate-100 overflow-hidden"
                              >
                                <img
                                  referrerPolicy="no-referrer"
                                  src={item.product.image_url || FALLBACK_IMAGE}
                                  alt={item.product.name}
                                  onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                                  className="w-full h-full object-contain mix-blend-multiply"
                                />
                              </Link>

                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block truncate">
                                {item.product.brand}
                              </span>
                              <Link to={`/products/${item.product.product_id}`}>
                                <h4 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2 mt-0.5">
                                  {item.product.name}
                                </h4>
                              </Link>
                            </div>

                            <div className="mt-2 pt-2 border-t border-slate-200/60 flex flex-col gap-1">
                              <div className="flex items-baseline justify-between gap-1">
                                <span className={`text-xs font-black ${isOverallCheapest ? 'text-emerald-700' : 'text-slate-900'}`}>
                                  {minPrice !== undefined ? formatINR(minPrice) : '—'}
                                </span>
                                {isOverallCheapest && (
                                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                                    Best
                                  </span>
                                )}
                              </div>
                              <Link
                                to={`/products/${item.product.product_id}`}
                                className="text-[11px] font-semibold text-indigo-600 hover:underline inline-flex items-center gap-0.5 mt-0.5"
                              >
                                Details &rarr;
                              </Link>
                            </div>
                          </div>
                        );
                      })}

                      {/* Add Slot if less than 4 */}
                      {Array.from({ length: Math.min(1, MAX_COMPARE_PRODUCTS - compareItems.length) }).map((_, idx) => (
                        <button
                          key={`empty-mobile-${idx}`}
                          onClick={() => navigate('/products')}
                          className="min-h-[140px] border-2 border-dashed border-slate-200 active:border-indigo-400 rounded-xl flex flex-col items-center justify-center gap-1.5 p-3 text-center bg-slate-50/50"
                        >
                          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-indigo-600 flex items-center justify-center">
                            <Plus className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-slate-700">Add Product</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Stacked Attribute Comparison Cards */}
                  <div className="space-y-3">
                    
                    {/* ATTRIBUTE: Current Best Price & Difference */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Current Best Price</span>
                      </h4>
                      <div className="divide-y divide-slate-100">
                        {compareItems.map(item => {
                          const minPrice = productPricesMap[item.product.product_id];
                          const isOverallCheapest = minPrice !== undefined && minPrice === overallMinPrice && compareItems.length > 1;
                          const diff = minPrice !== undefined && overallMinPrice !== Infinity ? minPrice - overallMinPrice : undefined;

                          return (
                            <div key={item.product.product_id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-slate-900 truncate">{item.product.name}</div>
                                <div className="text-[11px] text-slate-500">{item.product.brand}</div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="flex items-center gap-1 justify-end">
                                  <span className={`text-sm font-black ${isOverallCheapest ? 'text-emerald-700' : 'text-slate-900'}`}>
                                    {minPrice !== undefined ? formatINR(minPrice) : 'Unavailable'}
                                  </span>
                                  {isOverallCheapest && (
                                    <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                                      🏆 Best
                                    </span>
                                  )}
                                </div>
                                {diff !== undefined && compareItems.length > 1 && (
                                  <div className="text-[10px] font-semibold mt-0.5">
                                    {diff === 0 ? (
                                      <span className="text-emerald-600">Lowest in comparison</span>
                                    ) : (
                                      <span className="text-slate-500">+{formatINR(diff)} higher</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ATTRIBUTE: Cheapest Retailer */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Cheapest Retailer</span>
                      </h4>
                      <div className="divide-y divide-slate-100">
                        {compareItems.map(item => {
                          const cheapestOffer = item.offers
                            .filter(o => o.price && !isNaN(parseFloat(o.price as any)))
                            .sort((a, b) => parseFloat(a.price as any) - parseFloat(b.price as any))[0];

                          return (
                            <div key={item.product.product_id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-slate-900 truncate">{item.product.name}</div>
                              </div>
                              <div className="text-right shrink-0">
                                {cheapestOffer ? (
                                  <div className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                                    {cheapestOffer.store_name} ({formatINR(cheapestOffer.price)})
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">N/A</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ATTRIBUTE: Category */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Category</span>
                      </h4>
                      <div className="divide-y divide-slate-100">
                        {compareItems.map(item => (
                          <div key={item.product.product_id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                            <div className="text-xs font-bold text-slate-900 truncate flex-1">{item.product.name}</div>
                            <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                              {getDisplayProductType(item.product)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SPECIFICATIONS: Display */}
                    {compareItems.some(i => i.parsedSpecs.display) && (
                      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Display</h4>
                        <div className="divide-y divide-slate-100">
                          {compareItems.map(item => (
                            <div key={item.product.product_id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                              <div className="text-xs font-bold text-slate-900 truncate flex-1">{item.product.name}</div>
                              <span className="text-xs text-slate-700 font-medium shrink-0 text-right">
                                {item.parsedSpecs.display || '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SPECIFICATIONS: Processor */}
                    {compareItems.some(i => i.parsedSpecs.processor) && (
                      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Processor</h4>
                        <div className="divide-y divide-slate-100">
                          {compareItems.map(item => (
                            <div key={item.product.product_id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                              <div className="text-xs font-bold text-slate-900 truncate flex-1">{item.product.name}</div>
                              <span className="text-xs text-slate-700 font-medium shrink-0 text-right max-w-[50%] truncate">
                                {item.parsedSpecs.processor || '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SPECIFICATIONS: RAM */}
                    {compareItems.some(i => i.parsedSpecs.ram) && (
                      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">RAM</h4>
                        <div className="divide-y divide-slate-100">
                          {compareItems.map(item => (
                            <div key={item.product.product_id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                              <div className="text-xs font-bold text-slate-900 truncate flex-1">{item.product.name}</div>
                              <span className="text-xs text-slate-700 font-medium shrink-0 text-right">
                                {item.parsedSpecs.ram || '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SPECIFICATIONS: Storage */}
                    {compareItems.some(i => i.parsedSpecs.storage) && (
                      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Storage</h4>
                        <div className="divide-y divide-slate-100">
                          {compareItems.map(item => (
                            <div key={item.product.product_id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                              <div className="text-xs font-bold text-slate-900 truncate flex-1">{item.product.name}</div>
                              <span className="text-xs text-slate-700 font-medium shrink-0 text-right">
                                {item.parsedSpecs.storage || '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SPECIFICATIONS: GPU */}
                    {compareItems.some(i => i.parsedSpecs.gpu) && (
                      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">GPU / Graphics</h4>
                        <div className="divide-y divide-slate-100">
                          {compareItems.map(item => (
                            <div key={item.product.product_id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                              <div className="text-xs font-bold text-slate-900 truncate flex-1">{item.product.name}</div>
                              <span className="text-xs text-slate-700 font-medium shrink-0 text-right max-w-[50%] truncate">
                                {item.parsedSpecs.gpu || '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SPECIFICATIONS: OS */}
                    {compareItems.some(i => i.parsedSpecs.os) && (
                      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Operating System</h4>
                        <div className="divide-y divide-slate-100">
                          {compareItems.map(item => (
                            <div key={item.product.product_id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                              <div className="text-xs font-bold text-slate-900 truncate flex-1">{item.product.name}</div>
                              <span className="text-xs text-slate-700 font-medium shrink-0 text-right">
                                {item.parsedSpecs.os || '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SPECIFICATIONS: Specs Summary */}
                    {compareItems.some(i => isRealSpec(i.product.specs_summary)) && (
                      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Specifications Summary</h4>
                        <div className="divide-y divide-slate-100">
                          {compareItems.map(item => (
                            <div key={item.product.product_id} className="py-3 first:pt-0 last:pb-0 flex flex-col gap-1">
                              <div className="text-xs font-bold text-slate-900">{item.product.name}</div>
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {isRealSpec(item.product.specs_summary) ? item.product.specs_summary : '—'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ATTRIBUTE: Availability */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Availability</span>
                      </h4>
                      <div className="divide-y divide-slate-100">
                        {compareItems.map(item => (
                          <div key={item.product.product_id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                            <div className="text-xs font-bold text-slate-900 truncate flex-1">{item.product.name}</div>
                            {item.offers.length > 0 ? (
                              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded shrink-0">
                                In stock ({item.offers.length} stores)
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic shrink-0">No active offers</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* RETAILER OFFERS BY PRODUCT (Nested Mobile Cards) */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Retailer Offers</span>
                      </h4>
                      <div className="space-y-4">
                        {compareItems.map(item => (
                          <div key={item.product.product_id} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                            <div className="font-bold text-xs text-slate-900 truncate mb-2 pb-1.5 border-b border-slate-200">
                              {item.product.name}
                            </div>
                            {item.offers.length > 0 ? (
                              <div className="space-y-2">
                                {item.offers.map(offer => {
                                  const isValidUrl = offer.product_url && 
                                    (offer.product_url.startsWith('http://') || offer.product_url.startsWith('https://'));

                                  return (
                                    <div key={offer.price_id} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="text-xs font-bold text-slate-800 truncate">{offer.store_name}</div>
                                        <div className="text-xs font-bold text-indigo-700">{formatINR(offer.price)}</div>
                                      </div>
                                      {isValidUrl ? (
                                        <a
                                          href={offer.product_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="min-h-[36px] px-3 py-1.5 bg-indigo-600 active:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-colors shrink-0 shadow-2xs"
                                        >
                                          <span>Buy</span>
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic shrink-0">No link</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400 italic py-1 text-center">
                                No active offers recorded
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                </div>

                {/* -------------------------------------------------------- */}
                {/* DESKTOP MATRIX TABLE (>=md) — PRESERVED UNCHANGED */}
                {/* -------------------------------------------------------- */}
                <div className="hidden md:block bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      
                      {/* Header Row: Product Images & Titles */}
                      <thead>
                        <tr>
                          <th className="w-52 p-6 border-b border-slate-200 bg-slate-50 align-top">
                            <div className="flex flex-col h-full justify-between">
                              <div>
                                <h3 className="font-bold text-slate-800 text-lg mb-0.5">Product Comparison</h3>
                                <p className="text-xs text-slate-500 font-medium">{compareItems.length} of 4 items selected</p>
                              </div>
                              {compareItems.length < 4 && (
                                <button
                                  onClick={() => navigate('/products')}
                                  className="mt-6 w-full py-2.5 bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                                >
                                  <Plus className="w-4 h-4" /> Add Product
                                </button>
                              )}
                            </div>
                          </th>
                          
                          {compareItems.map((item) => (
                            <th key={item.product.product_id} className="w-72 p-6 border-b border-slate-200 border-l border-slate-100 align-top relative group bg-white">
                              <button 
                                onClick={() => removeProduct(item.product.product_id)}
                                className="absolute top-4 right-4 w-7 h-7 bg-slate-100 text-slate-400 hover:bg-rose-100 hover:text-rose-600 rounded-full flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                                title="Remove from comparison"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              
                              <div className="flex flex-col h-full">
                                <Link 
                                  to={`/products/${item.product.product_id}`}
                                  className="block w-full aspect-square bg-slate-50 rounded-xl p-4 mb-3 flex items-center justify-center border border-slate-100 overflow-hidden cursor-pointer"
                                  title={`View details for ${item.product.name}`}
                                >
                                  <img 
                                    referrerPolicy="no-referrer"
                                    src={item.product.image_url || FALLBACK_IMAGE}
                                    alt={item.product.name}
                                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                                    className="w-full h-full object-contain mix-blend-multiply hover:scale-105 transition-transform duration-300"
                                  />
                                </Link>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-0.5">
                                  {item.product.brand}
                                </span>
                                <Link to={`/products/${item.product.product_id}`} className="block mb-2" title={`View details for ${item.product.name}`}>
                                  <h4 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 hover:text-indigo-600 hover:underline transition-colors">
                                    {item.product.name}
                                  </h4>
                                </Link>
                                <Link 
                                  to={`/products/${item.product.product_id}`}
                                  className="mt-auto text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                                >
                                  View full details &rarr;
                                </Link>
                              </div>
                            </th>
                          ))}
                          
                          {/* Fill empty columns up to 4 */}
                          {Array.from({ length: 4 - compareItems.length }).map((_, i) => (
                            <th key={`empty-${i}`} className="w-72 p-6 border-b border-slate-200 border-l border-slate-100 bg-slate-50/50">
                              <button
                                onClick={() => navigate('/products')}
                                className="w-full h-full min-h-[220px] border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all group cursor-pointer p-4 text-center"
                              >
                                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-slate-200 text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-300 transition-colors shadow-2xs">
                                  <Plus className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                                  + Add Product
                                </span>
                                <span className="text-[11px] text-slate-400 font-normal leading-tight">
                                  Choose a product from Search Gadgets
                                </span>
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {/* Category Row */}
                        <tr>
                          <td className="p-4 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider">Category</td>
                          {compareItems.map(item => (
                            <td key={item.product.product_id} className="p-4 border-l border-slate-100 text-sm">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {getDisplayProductType(item.product)}
                              </span>
                            </td>
                          ))}
                          {Array.from({ length: 4 - compareItems.length }).map((_, i) => (
                            <td key={`empty-cat-${i}`} className="p-4 border-l border-slate-100 bg-slate-50/50"></td>
                          ))}
                        </tr>

                        {/* Best Current Price Row */}
                        <tr>
                          <td className="p-4 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider">Current Best Price</td>
                          {compareItems.map(item => {
                            const minPrice = productPricesMap[item.product.product_id];
                            const isOverallCheapest = minPrice !== undefined && minPrice === overallMinPrice && compareItems.length > 1;

                            return (
                              <td key={item.product.product_id} className={`p-4 border-l border-slate-100 ${isOverallCheapest ? 'bg-emerald-50/40' : ''}`}>
                                {minPrice !== undefined ? (
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-lg font-bold ${isOverallCheapest ? 'text-emerald-700' : 'text-slate-900'}`}>
                                        {formatINR(minPrice)}
                                      </span>
                                      {isOverallCheapest && (
                                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                                          🏆 Best Price
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">Unavailable</span>
                                )}
                              </td>
                            );
                          })}
                          {Array.from({ length: 4 - compareItems.length }).map((_, i) => (
                            <td key={`empty-price-${i}`} className="p-4 border-l border-slate-100 bg-slate-50/50"></td>
                          ))}
                        </tr>

                        {/* Price Difference Row */}
                        {compareItems.length > 1 && (
                          <tr>
                            <td className="p-4 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider">Price Difference</td>
                            {compareItems.map(item => {
                              const minPrice = productPricesMap[item.product.product_id];
                              const diff = minPrice !== undefined && overallMinPrice !== Infinity ? minPrice - overallMinPrice : undefined;

                              return (
                                <td key={item.product.product_id} className="p-4 border-l border-slate-100 text-xs font-semibold">
                                  {diff === 0 ? (
                                    <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">Lowest price in comparison</span>
                                  ) : diff !== undefined && diff > 0 ? (
                                    <span className="text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                      +{formatINR(diff)} higher
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                              );
                            })}
                            {Array.from({ length: 4 - compareItems.length }).map((_, i) => (
                              <td key={`empty-diff-${i}`} className="p-4 border-l border-slate-100 bg-slate-50/50"></td>
                            ))}
                          </tr>
                        )}

                        {/* Cheapest Retailer Row */}
                        <tr>
                          <td className="p-4 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider">Cheapest Retailer</td>
                          {compareItems.map(item => {
                            const cheapestOffer = item.offers
                              .filter(o => o.price && !isNaN(parseFloat(o.price as any)))
                              .sort((a, b) => parseFloat(a.price as any) - parseFloat(b.price as any))[0];

                            return (
                              <td key={item.product.product_id} className="p-4 border-l border-slate-100 text-xs font-medium text-slate-800">
                                {cheapestOffer ? (
                                  <span className="font-bold text-indigo-700">{cheapestOffer.store_name}</span>
                                ) : (
                                  <span className="text-slate-400">N/A</span>
                                )}
                              </td>
                            );
                          })}
                          {Array.from({ length: 4 - compareItems.length }).map((_, i) => (
                            <td key={`empty-store-${i}`} className="p-4 border-l border-slate-100 bg-slate-50/50"></td>
                          ))}
                        </tr>

                        {/* Specification Comparison Rows */}
                        {compareItems.some(i => i.parsedSpecs.processor) && (
                          <tr>
                            <td className="p-4 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider align-top">Processor</td>
                            {compareItems.map(item => (
                              <td key={item.product.product_id} className="p-4 border-l border-slate-100 text-xs text-slate-700 align-top">
                                {item.parsedSpecs.processor || null}
                              </td>
                            ))}
                            {Array.from({ length: 4 - compareItems.length }).map((_, i) => (
                              <td key={`empty-proc-${i}`} className="p-4 border-l border-slate-100 bg-slate-50/50"></td>
                            ))}
                          </tr>
                        )}

                        {compareItems.some(i => i.parsedSpecs.ram) && (
                          <tr>
                            <td className="p-4 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider align-top">RAM</td>
                            {compareItems.map(item => (
                              <td key={item.product.product_id} className="p-4 border-l border-slate-100 text-xs text-slate-700 align-top">
                                {item.parsedSpecs.ram || null}
                              </td>
                            ))}
                            {Array.from({ length: 4 - compareItems.length }).map((_, i) => (
                              <td key={`empty-ram-${i}`} className="p-4 border-l border-slate-100 bg-slate-50/50"></td>
                            ))}
                          </tr>
                        )}

                        {compareItems.some(i => i.parsedSpecs.storage) && (
                          <tr>
                            <td className="p-4 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider align-top">Storage</td>
                            {compareItems.map(item => (
                              <td key={item.product.product_id} className="p-4 border-l border-slate-100 text-xs text-slate-700 align-top">
                                {item.parsedSpecs.storage || null}
                              </td>
                            ))}
                            {Array.from({ length: 4 - compareItems.length }).map((_, i) => (
                              <td key={`empty-storage-${i}`} className="p-4 border-l border-slate-100 bg-slate-50/50"></td>
                            ))}
                          </tr>
                        )}

                        {compareItems.some(i => i.parsedSpecs.display) && (
                          <tr>
                            <td className="p-4 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider align-top">Display</td>
                            {compareItems.map(item => (
                              <td key={item.product.product_id} className="p-4 border-l border-slate-100 text-xs text-slate-700 align-top">
                                {item.parsedSpecs.display || null}
                              </td>
                            ))}
                            {Array.from({ length: 4 - compareItems.length }).map((_, i) => (
                              <td key={`empty-disp-${i}`} className="p-4 border-l border-slate-100 bg-slate-50/50"></td>
                            ))}
                          </tr>
                        )}

                        {compareItems.some(i => i.parsedSpecs.gpu) && (
                          <tr>
                            <td className="p-4 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider align-top">GPU / Graphics</td>
                            {compareItems.map(item => (
                              <td key={item.product.product_id} className="p-4 border-l border-slate-100 text-xs text-slate-700 align-top">
                                {item.parsedSpecs.gpu || null}
                              </td>
                            ))}
                            {Array.from({ length: 4 - compareItems.length }).map((_, i) => (
                              <td key={`empty-gpu-${i}`} className="p-4 border-l border-slate-100 bg-slate-50/50"></td>
                            ))}
                          </tr>
                        )}

                        {compareItems.some(i => i.parsedSpecs.os) && (
                          <tr>
                            <td className="p-4 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider align-top">OS</td>
                            {compareItems.map(item => (
                              <td key={item.product.product_id} className="p-4 border-l border-slate-100 text-xs text-slate-700 align-top">
                                {item.parsedSpecs.os || null}
                              </td>
                            ))}
                            {Array.from({ length: 4 - compareItems.length }).map((_, i) => (
                              <td key={`empty-os-${i}`} className="p-4 border-l border-slate-100 bg-slate-50/50"></td>
                            ))}
                          </tr>
                        )}

                        {/* Full Specifications Summary */}
                        {compareItems.some(i => isRealSpec(i.product.specs_summary)) && (
                          <tr>
                            <td className="p-4 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider align-top">Specifications Summary</td>
                            {compareItems.map(item => (
                              <td key={item.product.product_id} className="p-4 border-l border-slate-100 text-xs text-slate-600 align-top leading-relaxed">
                                {isRealSpec(item.product.specs_summary) ? (
                                  <p className="line-clamp-4">{item.product.specs_summary}</p>
                                ) : null}
                              </td>
                            ))}
                            {Array.from({ length: 4 - compareItems.length }).map((_, i) => (
                              <td key={`empty-rawspec-${i}`} className="p-4 border-l border-slate-100 bg-slate-50/50"></td>
                            ))}
                          </tr>
                        )}

                        {/* Availability Row */}
                        <tr>
                          <td className="p-4 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider align-top">Availability</td>
                          {compareItems.map(item => (
                            <td key={item.product.product_id} className="p-4 border-l border-slate-100 text-xs align-top">
                              {item.offers.length > 0 ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                  <CheckCircle className="w-3 h-3 text-emerald-600" /> In stock at {item.offers.length} stores
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">No active offers</span>
                              )}
                            </td>
                          ))}
                          {Array.from({ length: 4 - compareItems.length }).map((_, i) => (
                            <td key={`empty-[avail]-${i}`} className="p-4 border-l border-slate-100 bg-slate-50/50"></td>
                          ))}
                        </tr>

                        {/* Retailer Offers Matrix Row */}
                        <tr>
                          <td className="p-4 bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider align-top">Retailer Offers</td>
                          {compareItems.map(item => (
                            <td key={item.product.product_id} className="p-4 border-l border-slate-100 align-top">
                              {item.offers.length > 0 ? (
                                <div className="space-y-2">
                                  {item.offers.map(offer => {
                                    const isValidUrl = offer.product_url && 
                                      (offer.product_url.startsWith('http://') || offer.product_url.startsWith('https://'));

                                    return (
                                      <div key={offer.price_id} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                                        <div className="min-w-0 pr-2">
                                          <div className="text-xs font-bold text-slate-800 truncate">{offer.store_name}</div>
                                          <div className="text-xs font-bold text-slate-900">{formatINR(offer.price)}</div>
                                        </div>
                                        {isValidUrl ? (
                                          <a
                                            href={offer.product_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded flex items-center gap-1 transition-colors shrink-0"
                                          >
                                            <span>Buy</span>
                                            <ExternalLink className="w-2.5 h-2.5" />
                                          </a>
                                        ) : (
                                          <span className="text-[10px] text-slate-400 italic">Link unavailable</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic">No active offers</span>
                              )}
                            </td>
                          ))}
                          {Array.from({ length: 4 - compareItems.length }).map((_, i) => (
                            <td key={`empty-offers-${i}`} className="p-4 border-l border-slate-100 bg-slate-50/50"></td>
                          ))}
                        </tr>

                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}
      </div>

      {/* Catalogue Product Selection Modal */}
      {showSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-base sm:text-lg">Add Product to Compare</h3>
                <p className="text-xs text-slate-500">Select a product from the database catalogue</p>
              </div>
              <button 
                onClick={() => setShowSelector(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <ShoppingBag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search products by title, brand, or model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl text-sm transition-all outline-none"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3">
              {allProducts.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No products found matching "{searchQuery}"
                </div>
              ) : (
                <div className="space-y-1.5">
                  {allProducts.map(p => {
                    const isSelected = selectedIds.includes(p.product_id);
                    return (
                      <div 
                        key={p.product_id}
                        className={`flex items-center gap-4 p-3 rounded-xl transition-colors border ${
                          isSelected 
                            ? 'bg-indigo-50/60 border-indigo-200 cursor-pointer' 
                            : 'bg-white border-slate-100 hover:bg-slate-50 cursor-pointer'
                        }`}
                        onClick={() => addProduct(p.product_id)}
                      >
                        <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 p-1 shrink-0 flex items-center justify-center">
                          <img 
                            referrerPolicy="no-referrer"
                            src={p.image_url || FALLBACK_IMAGE} 
                            alt={p.name}
                            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                            className="w-full h-full object-contain mix-blend-multiply"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold uppercase text-indigo-600 tracking-wider">{p.brand}</span>
                          <h4 className="font-semibold text-slate-900 text-sm truncate">{p.name}</h4>
                          <span className="text-xs text-slate-500">{p.category_name}</span>
                        </div>
                        <div className="shrink-0">
                          {isSelected ? (
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-md flex items-center gap-1">
                              Selected &rarr;
                            </span>
                          ) : (
                            <button className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
                              <Plus className="w-3.5 h-3.5" />
                              <span>Select</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparePage;
