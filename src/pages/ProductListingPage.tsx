import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { fetchProducts, addSearchHistory, addToWatchlist, createPriceAlert } from '../services/api';
import { SearchHistoryComponent } from '../components/SearchHistoryComponent';
import { Product } from '../types/frontend';
import { formatINR } from '../utils/currency';
import { Search, ShoppingCart, AlertCircle, ArrowUpRight, ArrowUpDown, X, ChevronLeft, ChevronRight, BookmarkCheck, Scale, BellRing, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ["All", "Laptops & Desktops", "Smartphones & Tablets", "Audio Equipment", "Smart Wearables"];
const STORES = ["All Stores", "Amazon India", "Flipkart", "Croma", "Reliance Digital"];
const BUDGET_PRESETS = [
  { label: 'All Prices', max: '' },
  { label: 'Under ₹5,000', max: '5000' },
  { label: 'Under ₹10,000', max: '10000' },
  { label: 'Under ₹25,000', max: '25000' },
  { label: 'Under ₹50,000', max: '50000' },
  { label: 'Under ₹1,00,000', max: '100000' },
];
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400";

export default function ProductListingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState<any>(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  // Filter & Search States
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'All');
  const [selectedStore, setSelectedStore] = useState(searchParams.get('store') || 'All Stores');
  const [sortBy, setSortBy] = useState<string>(() => {
    const paramSort = searchParams.get('sort');
    if (paramSort === 'cheapest') return 'price_asc';
    if (paramSort === 'dearest') return 'price_desc';
    if (paramSort === 'name-az') return 'name_asc';
    return paramSort || 'price_asc';
  });
  const [minPrice, setMinPrice] = useState<string>(searchParams.get('min_price') || '');
  const [maxPrice, setMaxPrice] = useState<string>(searchParams.get('max_price') || '');

  const [historyTrigger, setHistoryTrigger] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const lastSavedTerm = useRef<string>('');

  // Sync state with URL search parameters on navigation
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlSearch = params.get('search');
    const urlCategory = params.get('category');
    const urlStore = params.get('store');
    const urlMin = params.get('min_price');
    const urlMax = params.get('max_price');
    const urlSort = params.get('sort');

    if (urlSearch !== null) {
      setSearchTerm(urlSearch);
      if (urlCategory === null) {
        setSelectedCategory('All');
      }
    }
    if (urlCategory !== null) setSelectedCategory(urlCategory);
    if (urlStore !== null) setSelectedStore(urlStore);
    if (urlMin !== null) setMinPrice(urlMin);
    if (urlMax !== null) setMaxPrice(urlMax);
    if (urlSort !== null) {
      if (urlSort === 'cheapest') setSortBy('price_asc');
      else if (urlSort === 'dearest') setSortBy('price_desc');
      else if (urlSort === 'name-az') setSortBy('name_asc');
      else setSortBy(urlSort);
    }
  }, [location.search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, minPrice, maxPrice, sortBy, selectedStore]);

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setError(null);
      try {
        const cat = selectedCategory === 'All' ? undefined : selectedCategory;
        const res = await fetchProducts(
          currentPage, 
          itemsPerPage, 
          cat, 
          searchTerm, 
          minPrice ? parseInt(minPrice) : undefined, 
          maxPrice ? parseInt(maxPrice) : undefined, 
          sortBy,
          selectedStore
        );
        const items = res.products;
        setTotalItems(res.pagination.totalItems);
        setTotalPages(res.pagination.totalPages);
        setProducts(items);
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
        setError("Error loading product catalog.");
      } finally {
        setLoading(false);
      }
    }

    const delayDebounce = setTimeout(() => {
      loadProducts();
    }, 400);

    return () => clearTimeout(delayDebounce);
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
  };

  const handleSelectHistoryItem = (term: string) => {
    setSearchTerm(term);
    setSelectedCategory('All');
  };

  const filteredProducts = products;

  const startIndex = (currentPage - 1) * itemsPerPage;

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  };

  const handleQuickWatchlist = async (e: React.MouseEvent, productId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login', { state: { from: location, message: 'Please log in to use your watchlist.' } });
      return;
    }
    try {
      await addToWatchlist(productId);
      alert('Added to your watchlist!');
    } catch (err: any) {
      alert(err.message || 'Failed to add to watchlist');
    }
  };

  const handleQuickCompare = (e: React.MouseEvent, productId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login', { state: { from: { pathname: '/compare' }, message: 'Please log in to use product comparison.' } });
      return;
    }
    try {
      const saved = localStorage.getItem('deal_compare_ids');
      let ids = saved ? JSON.parse(saved) : [];
      if (!ids.includes(productId)) {
        if (ids.length >= 4) {
          alert('You can only compare up to 4 items at once.');
          return;
        }
        ids.push(productId);
        localStorage.setItem('deal_compare_ids', JSON.stringify(ids));
      }
      navigate('/compare');
    } catch (err) {}
  };

  const handleQuickAlert = (e: React.MouseEvent, productId: number, currentPrice?: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login', { state: { from: location, message: 'Please log in to create price alerts.' } });
      return;
    }
    const target = window.prompt(`Set a target price for this product:\nCurrent price: ${currentPrice ? formatINR(currentPrice) : 'Unavailable'}\n\nEnter target (INR):`);
    if (target) {
      const targetVal = parseFloat(target);
      if (!isNaN(targetVal) && targetVal > 0) {
        createPriceAlert(productId, targetVal).then(() => {
          alert('Price alert created!');
        }).catch((err) => alert(err.message || 'Failed to create alert'));
      }
    }
  };

  const renderZeroResult = () => {
    const rawTerm = searchTerm.trim();
    const effectiveMaxPrice = maxPrice ? parseFloat(maxPrice) : (interpretation?.maxPrice ?? null);
    const effectiveMinPrice = minPrice ? parseFloat(minPrice) : (interpretation?.minPrice ?? null);
    const hasPriceConstraint = effectiveMaxPrice !== null || effectiveMinPrice !== null;

    const parsedCat = selectedCategory !== 'All' ? selectedCategory : (interpretation?.category || null);
    const parsedKw = interpretation?.keywords || rawTerm;

    let title = "No matching products found";
    let subtitle = "We couldn't locate any gadgets matching this filter combination. Try adjusting or clearing your search.";
    let caseType: 'PRICE' | 'KEYWORD' | 'CATEGORY' | 'GENERIC' = 'GENERIC';

    if (hasPriceConstraint) {
      caseType = 'PRICE';
      let subject = 'products';
      if (parsedKw && parsedKw.toLowerCase().includes('gaming')) {
        subject = 'gaming laptops';
      } else if (parsedCat === 'Smartphones & Tablets' || rawTerm.toLowerCase().includes('phone') || rawTerm.toLowerCase().includes('mobile')) {
        subject = 'phones';
      } else if (parsedCat === 'Laptops & Desktops' || rawTerm.toLowerCase().includes('laptop')) {
        subject = 'laptops';
      } else if (parsedCat === 'Smart Wearables' || rawTerm.toLowerCase().includes('watch') || rawTerm.toLowerCase().includes('smartwatch')) {
        subject = 'smartwatches';
      } else if (parsedCat === 'Audio Equipment' || rawTerm.toLowerCase().includes('headphone') || rawTerm.toLowerCase().includes('audio')) {
        subject = 'audio equipment';
      } else if (parsedCat) {
        subject = parsedCat.toLowerCase();
      }

      const priceStr = effectiveMaxPrice ? formatINR(effectiveMaxPrice) : (effectiveMinPrice ? formatINR(effectiveMinPrice) : '');
      const priceCondition = effectiveMaxPrice ? `under ${priceStr}` : (effectiveMinPrice ? `above ${priceStr}` : '');

      title = `No ${subject} found ${priceCondition}`.trim();
      subtitle = subject === 'phones' 
        ? "We don't currently have smartphones in this price range in our catalogue."
        : "Try increasing your budget or clearing the price filter.";
    } else if (rawTerm) {
      caseType = 'KEYWORD';
      title = `No products found for “${rawTerm}”`;
      subtitle = "Try another product name, brand, or category.";
    } else if (selectedCategory !== 'All') {
      caseType = 'CATEGORY';
      title = `No ${selectedCategory} products are currently available in our catalogue.`;
      subtitle = "Try browsing other categories or adjusting your filters.";
    }

    const handleIncreaseBudget = () => {
      setMinPrice('');
      setMaxPrice('');
      if (interpretation?.maxPrice || interpretation?.minPrice) {
        if (interpretation.category) {
          setSelectedCategory(interpretation.category);
        }
        if (interpretation.keywords) {
          setSearchTerm(interpretation.keywords);
        } else {
          setSearchTerm('');
        }
      } else if (rawTerm) {
        if (rawTerm.toLowerCase().includes('under') || rawTerm.toLowerCase().includes('below')) {
          const cleaned = rawTerm.replace(/under\s+\d+(\.\d+)?(\s*(lakh|k))?/gi, '').replace(/below\s+\d+(\.\d+)?(\s*(lakh|k))?/gi, '').trim();
          setSearchTerm(cleaned);
        }
      }
    };

    const handleClearFilters = () => {
      setSelectedCategory('All');
      setSelectedStore('All Stores');
      setMinPrice('');
      setMaxPrice('');
    };

    const handleClearSearch = () => {
      setSearchTerm('');
      setSelectedCategory('All');
      setSelectedStore('All Stores');
      setMinPrice('');
      setMaxPrice('');
    };

    return (
      <div id="div-zero-result-card" className="bg-white border border-slate-200 p-12 rounded-2xl text-center flex flex-col items-center gap-5 shadow-xs max-w-2xl mx-auto my-4">
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-2xs">
          <ShoppingCart className="w-8 h-8 text-indigo-500" />
        </div>

        <div className="flex flex-col gap-2 max-w-lg">
          <h3 id="txt-zero-result-title" className="text-xl font-bold text-slate-900 tracking-tight">{title}</h3>
          <p id="txt-zero-result-subtitle" className="text-sm text-slate-500 leading-relaxed">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
          {caseType === 'PRICE' && (
            <>
              <button 
                id="btn-increase-budget"
                type="button"
                onClick={handleIncreaseBudget}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                Increase Budget
              </button>
              <button 
                id="btn-clear-filters"
                type="button"
                onClick={handleClearFilters}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-5 rounded-xl text-xs transition-all cursor-pointer"
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
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl text-xs transition-all shadow-xs cursor-pointer"
            >
              Clear Search
            </button>
          )}

          {(caseType === 'CATEGORY' || caseType === 'GENERIC') && (
            <button 
              id="btn-reset-filters"
              type="button"
              onClick={handleClearSearch}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl text-xs transition-all shadow-xs cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-6 font-sans">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Gadget Catalogue
          </h1>
          <p className="text-sm text-slate-500">
            Search products, compare verified retailer prices, and find better deals.
          </p>
        </div>
        <div className="bg-indigo-50 text-indigo-700 border border-indigo-150 rounded-lg px-4 py-2 text-sm font-semibold self-start sm:self-center flex items-center gap-2 shadow-sm shrink-0">
          <Search className="w-4 h-4" />
          {totalItems} items matching
        </div>
      </div>

      {/* AI Deal Advisor Product Selection Prompt Banner */}
      {searchParams.get('ai_advisor') === 'true' && (
        <div id="banner-ai-advisor-prompt" className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xl shrink-0">
              🤖
            </div>
            <div>
              <p className="text-sm font-bold text-slate-100">
                Choose a product to ask the AI Deal Advisor
              </p>
              <p className="text-xs text-slate-300 mt-0.5">
                Select any product below to view its price history, store comparisons, and interactive AI Deal Advisor chat.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const newParams = new URLSearchParams(location.search);
              newParams.delete('ai_advisor');
              navigate({ search: newParams.toString() }, { replace: true });
            }}
            className="text-slate-400 hover:text-white text-xs font-semibold px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors shrink-0 cursor-pointer self-end sm:self-center"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <form onSubmit={handleSearchSubmit} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="relative w-full md:max-w-md">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              id="inp-deal-search"
              type="text"
              placeholder="Search e.g. iPhone, S24, Sony, Macbook..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onBlur={() => addToSearchHistory(searchTerm)}
              className="w-full pl-12 pr-10 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 transition-all"
            />
            {searchTerm && (
              <button 
                type="button" 
                onClick={() => setSearchTerm('')} 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-full p-1 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto">
            <div className="flex items-center gap-2 shrink-0 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <ArrowUpDown className="w-4 h-4 text-slate-500" />
              <select
                id="sel-catalog-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-sm bg-transparent focus:outline-none font-medium text-slate-700 cursor-pointer pr-1"
              >
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="price_drop">Biggest Price Drop</option>
                <option value="discount_desc">Highest Discount</option>
                <option value="name_asc">Name: A to Z</option>
              </select>
            </div>
          </div>
        </form>

        <div className="bg-white border border-slate-200 px-5 py-4 rounded-xl shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 w-full pb-1">
              <span className="text-xs text-slate-500 uppercase font-semibold shrink-0 mr-1 w-full sm:w-auto">Category:</span>
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                    selectedCategory === category
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {category}
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
                  onClick={() => setSelectedStore(store)}
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
                      setMinPrice('');
                      setMaxPrice(preset.max);
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
                  className="w-20 px-2 py-1 text-xs bg-transparent focus:outline-none font-medium text-slate-700 text-center"
                />
                <span className="text-slate-300">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-20 px-2 py-1 text-xs bg-transparent focus:outline-none font-medium text-slate-700 text-center"
                />
                {(minPrice || maxPrice) && (
                  <button
                    type="button"
                    onClick={() => { setMinPrice(''); setMaxPrice(''); }}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                    title="Clear price filter"
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

      {interpretation && (interpretation.category || interpretation.minPrice || interpretation.maxPrice) && (
        <div id="nl-search-interpretation-bar" className="flex items-center gap-2.5 px-4 py-3 bg-indigo-50/80 border border-indigo-150 rounded-xl text-xs text-indigo-950 shadow-2xs">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="font-semibold text-slate-700">Searching for:</span>
          <div className="flex flex-wrap items-center gap-2">
            {interpretation.category && (
              <span className="bg-white px-2.5 py-1 rounded-md border border-indigo-200 text-indigo-800 font-bold text-[11px] shadow-2xs">
                {interpretation.category}
              </span>
            )}
            {(interpretation.minPrice || interpretation.maxPrice) && (
              <span className="bg-white px-2.5 py-1 rounded-md border border-indigo-200 text-emerald-800 font-bold text-[11px] shadow-2xs">
                Budget: {interpretation.minPrice ? formatINR(interpretation.minPrice) : 'Any'} – {interpretation.maxPrice ? formatINR(interpretation.maxPrice) : 'Any'}
              </span>
            )}
            {interpretation.keywords && interpretation.keywords !== '' && (
              <span className="bg-white px-2.5 py-1 rounded-md border border-indigo-200 text-slate-700 text-[11px] shadow-2xs">
                Keywords: "{interpretation.keywords}"
              </span>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 animate-pulse">
              <div className="w-full aspect-square bg-slate-100 rounded-xl"></div>
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
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-8 rounded-2xl flex flex-col items-center justify-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 shrink-0" />
          <span className="text-sm font-semibold">{error}</span>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        renderZeroResult()
      ) : (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map(p => (
              <Link key={p.product_id} to={`/products/${p.product_id}`} className="bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all rounded-2xl p-5 flex flex-col h-full group relative">
                
                {/* Action Overlay */}
                <div className="absolute top-7 right-7 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button onClick={(e) => handleQuickWatchlist(e, p.product_id)} className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-colors" title="Add to Watchlist">
                    <BookmarkCheck className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => handleQuickCompare(e, p.product_id)} className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-colors" title="Compare">
                    <Scale className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => handleQuickAlert(e, p.product_id, p.cheapest_price)} className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 shadow-sm transition-colors" title="Price Alert">
                    <BellRing className="w-4 h-4" />
                  </button>
                </div>

                <div className="relative aspect-square w-full rounded-xl bg-slate-50 p-4 overflow-hidden border border-slate-100 mb-5 flex items-center justify-center">
                  <img
                    referrerPolicy="no-referrer"
                    src={p.image_url || FALLBACK_IMAGE}
                    alt={p.name}
                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500 mix-blend-multiply"
                  />
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start z-10">
                    <span className="bg-slate-900/90 backdrop-blur-sm text-white text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md shadow-xs">
                      {p.category_name}
                    </span>
                    {p.price_drop_pct && p.price_drop_pct > 0 ? (
                      <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                        ↓ {p.price_drop_pct}% Drop
                      </span>
                    ) : p.discount_pct && p.discount_pct > 0 ? (
                      <span className="bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                        {p.discount_pct}% OFF
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <div className="text-[11px] text-slate-500 uppercase font-semibold flex items-center justify-between mb-2">
                    <span className="text-indigo-600">{p.brand}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
                    {p.name}
                  </h3>
                </div>

                <div className="border-t border-slate-100 pt-4 mt-auto">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current Best</div>
                      {p.cheapest_price !== undefined ? (
                        <div className="flex flex-col">
                          <span className="text-xl font-extrabold text-slate-900">{formatINR(p.cheapest_price)}</span>
                          <span className="text-xs text-slate-500 font-medium truncate max-w-[120px] flex items-center gap-1 mt-0.5">
                            via {p.store_name || 'Retailer'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-slate-400">Price unavailable</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 group-hover:bg-indigo-600 rounded-lg transition-colors">
                      <span className="text-xs font-bold text-slate-500 group-hover:text-white transition-colors hidden sm:block">View Deal</span>
                      <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                </div>

              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 pt-6 mt-4 gap-4">
              <span className="text-sm text-slate-500 font-medium bg-white px-4 py-2 border border-slate-200 rounded-lg">
                Showing <strong className="text-slate-900">{startIndex + 1}</strong> - <strong className="text-slate-900">{Math.min(startIndex + itemsPerPage, totalItems)}</strong> of <strong className="text-slate-900">{totalItems}</strong>
              </span>
              <div className="flex items-center gap-2">
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
                  <span className="hidden sm:inline">Prev</span>
                </button>
                <div className="flex items-center gap-1.5 mx-2">
                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setCurrentPage(idx + 1); window.scrollTo({ top: 120, behavior: 'smooth' }); }}
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
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
