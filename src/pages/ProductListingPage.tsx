import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  fetchProducts, 
  addSearchHistory 
} from '../services/api';
import { SearchHistoryComponent } from '../components/SearchHistoryComponent';
import { Product } from '../types/frontend';
import { formatINR } from '../utils/currency';
import { Search, Filter, ShoppingCart, Info, Bookmark, AlertCircle, ArrowUpRight, History, Trash2, ArrowUpDown, Shuffle, ChevronLeft, ChevronRight, X } from 'lucide-react';

const CATEGORIES = ["All", "Laptops", "Smartphones", "Tablets", "Audio", "Smart Wearables"];
const STORES = ["All Stores", "Amazon India", "Flipkart", "Croma", "Reliance Digital"];

export default function ProductListingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStore, setSelectedStore] = useState('All Stores');
  const [sortBy, setSortBy] = useState<string>('cheapest'); // cheapest, dearest, name-az

  // History Refresh Trigger to notify the sub-component when a new search is registered
  const [historyTrigger, setHistoryTrigger] = useState(0);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4; // Compact size to demonstration pagination easily on mock and real lists

  // Reload products upon selection triggers
  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setError(null);
      try {
        const cat = selectedCategory === 'All' ? undefined : selectedCategory;
        const items = await fetchProducts(searchTerm, cat);
        setProducts(items);
        setCurrentPage(1); // reset to page 1 on search change
      } catch (err: any) {
        setError("Error communicating with PostgreSQL indices products list.");
      } finally {
        setLoading(false);
      }
    }

    const delayDebounce = setTimeout(() => {
      loadProducts();
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm, selectedCategory]);

  // Update search history in PostgreSQL and localStorage when search is issued
  const addToSearchHistory = async (term: string) => {
    if (!term || term.trim() === '') return;
    const cleanTerm = term.trim();

    // Find first product in search results to save rich history
    const matchingProduct = products.find(p => 
      p.name.toLowerCase().includes(cleanTerm.toLowerCase()) ||
      p.brand.toLowerCase().includes(cleanTerm.toLowerCase())
    ) || products[0];

    // Persistent backend database update (fails-safe gracefully if unauthorized or disconnected)
    try {
      await addSearchHistory(cleanTerm, matchingProduct);
      // Trigger the search history component to pull latest records
      setHistoryTrigger(prev => prev + 1);
    } catch (err) {
      console.debug("Backend search history save bypassed.", err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addToSearchHistory(searchTerm);
  };

  const handleSelectHistoryItem = (term: string) => {
    setSearchTerm(term);
  };

  // 1. FILTERING (Frontend Multidimensional filtering)
  const filteredProducts = products.filter(p => {
    if (selectedStore === 'All Stores') return true;
    
    // Check if the product has a deal corresponding to the selected store
    if (p.store_name && p.store_name.toLowerCase() === selectedStore.toLowerCase()) {
      return true;
    }
    // Also support fallback scenario where there's no flat store path, checking standard fallback arrays if any
    return false;
  });

  // 2. SORTING ENGINE
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const priceA = a.cheapest_price ?? 0;
    const priceB = b.cheapest_price ?? 0;

    if (sortBy === 'cheapest') {
      return priceA - priceB;
    } else if (sortBy === 'dearest') {
      return priceB - priceA;
    } else if (sortBy === 'name-az') {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  // 3. PAGINATION MATH
  const totalItems = sortedProducts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = sortedProducts.slice(startIndex, startIndex + itemsPerPage);

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

  return (
    <div className="flex-1 flex flex-col gap-6">
      
      {/* Title Header text banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-800 tracking-tight">
            Comprehensive Tech Catalog
          </h1>
          <p className="text-xs text-slate-500">
            Search electronic devices, trace price metrics across retail channels, and optimize investments.
          </p>
        </div>
        <div className="bg-indigo-50 text-indigo-700 border border-indigo-150 rounded-xl px-3 py-1.5 font-mono text-[10px] font-bold self-start sm:self-center">
          Active Catalogue: {totalItems} items matching
        </div>
      </div>

      {/* Control filters dashboard panel */}
      <div className="flex flex-col gap-4">
        <form onSubmit={handleSearchSubmit} className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Search Input bar */}
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="inp-deal-search"
              type="text"
              placeholder="Search e.g. iPhone, S24, Sony, Macbook..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onBlur={() => addToSearchHistory(searchTerm)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50/50"
            />
            {searchTerm && (
              <button 
                type="button" 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto">
            {/* Sorting SELECT */}
            <div className="flex items-center gap-1 shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="sel-catalog-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-650 font-mono"
              >
                <option value="cheapest">Cheapest First</option>
                <option value="dearest">Highest Price First</option>
                <option value="name-az">Name (A to Z)</option>
              </select>
            </div>
          </div>
        </form>

        {/* Categories filters bar */}
        <div className="bg-white border border-slate-200/80 px-4 py-3 rounded-xl shadow-xs flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            
            {/* Category horizontal scroll */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full scrollbar-none py-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold shrink-0">Categories:</span>
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  id={`btn-cat-${category.toLowerCase().replace(' ', '-')}`}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition-all shrink-0 cursor-pointer border ${
                    selectedCategory === category
                      ? 'bg-slate-900 border-slate-950 text-white font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Store Horizontal Filters scroll */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full border-t border-slate-100 pt-3 scrollbar-none">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold shrink-0">Outlet Store:</span>
            {STORES.map(store => (
              <button
                key={store}
                id={`btn-store-${store.toLowerCase().replace(' ', '-')}`}
                onClick={() => setSelectedStore(store)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition-all shrink-0 cursor-pointer border ${
                  selectedStore === store
                    ? 'bg-indigo-600 border-indigo-700 text-white font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-950'
                }`}
              >
                {store}
              </button>
            ))}
          </div>

          {/* Search History Chips Section */}
          <SearchHistoryComponent 
            onSelectTerm={handleSelectHistoryItem} 
            refreshTrigger={historyTrigger} 
          />
        </div>
      </div>

      {/* Main product mesh panel */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-24 bg-slate-50 rounded-2xl border border-slate-200/80">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[11px] font-mono text-slate-400">Loading electronic indices, please wait...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span className="text-xs font-medium">{error}</span>
        </div>
      ) : paginatedProducts.length === 0 ? (
        <div className="bg-white border border-slate-200/80 p-12 rounded-2xl text-center flex flex-col items-center gap-3 shadow-xs">
          <ShoppingCart className="w-10 h-10 text-slate-300 animate-bounce" />
          <h3 className="text-sm font-bold text-slate-700 font-display">No Matches Discovered</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            We couldn't locate any gadgets in this filter combination. Try clearing your search parameters or selecting "All Stores".
          </p>
          <button 
            onClick={() => { setSearchTerm(''); setSelectedCategory('All'); setSelectedStore('All Stores'); setSortBy('cheapest'); }}
            className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-xs font-bold py-1.5 px-3.5 rounded-lg transition-all"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {paginatedProducts.map(p => (
              <div key={p.product_id} className="bg-white border border-slate-200/80 hover:border-indigo-200 hover:shadow-xs transition-all rounded-2xl p-4 flex flex-col justify-between group">
                
                {/* Product Thumbnail image frame */}
                <div className="relative aspect-square w-full rounded-xl bg-slate-50 overflow-hidden border border-slate-101 mb-4">
                  <img
                    referrerPolicy="no-referrer"
                    src={p.image_url}
                    alt={p.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-all duration-300"
                  />
                  <span className="absolute top-2.5 left-2.5 bg-indigo-600/90 text-white font-mono text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md">
                    {p.category_name}
                  </span>
                </div>

                {/* Text Info */}
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="text-[10px] font-mono text-slate-400 uppercase font-semibold flex items-center justify-between">
                    <span>{p.brand}</span>
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[8px] font-bold">
                      {p.model_no || 'Standard'}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                    {p.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-normal line-clamp-2">
                    {p.specs_summary}
                  </p>
                </div>

                {/* Price Tag bar & Detail Button */}
                <div className="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] font-mono text-slate-400 uppercase">Live Best Offer</div>
                    <div className="text-xs font-bold font-mono text-slate-800 flex flex-col">
                      {p.cheapest_price !== undefined ? (
                        <>
                          <span className="text-sm font-extrabold text-indigo-600">{formatINR(p.cheapest_price)}</span>
                          <span className="text-[9px] text-slate-400 font-semibold truncate max-w-[95px]">via {p.store_name || 'Amazon'}</span>
                        </>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400">Scraping...</span>
                      )}
                    </div>
                  </div>

                  <Link
                    to={`/products/${p.product_id}`}
                    className="cursor-pointer bg-slate-900 border border-slate-950 text-white hover:bg-slate-800 active:bg-slate-950 transition-all font-mono text-[10px] font-bold px-3 py-2 rounded-lg flex items-center gap-1 shadow-xs"
                  >
                    <span>Examine Deal</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>

              </div>
            ))}
          </div>

          {/* Simple & Bulletproof Pagination Controller */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200/80 pt-4 mt-2">
              <span className="text-xs text-slate-500 font-mono">
                Showing <strong className="text-slate-800">{startIndex + 1}</strong> to{" "}
                <strong className="text-slate-800">{Math.min(startIndex + itemsPerPage, totalItems)}</strong> of{" "}
                <strong className="text-slate-800">{totalItems}</strong> entries
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-lg border text-xs font-mono font-bold flex items-center gap-1 transition-all ${
                    currentPage === 1
                      ? 'bg-slate-50 border-slate-150 text-slate-350 cursor-not-allowed'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Prev</span>
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setCurrentPage(idx + 1); window.scrollTo({ top: 120, behavior: 'smooth' }); }}
                      className={`h-8 w-8 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        currentPage === idx + 1
                          ? 'bg-indigo-600 text-white font-extrabold border border-indigo-700'
                          : 'bg-white border border-slate-205 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-lg border text-xs font-mono font-bold flex items-center gap-1 transition-all ${
                    currentPage === totalPages
                      ? 'bg-slate-50 border-slate-150 text-slate-350 cursor-not-allowed'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
