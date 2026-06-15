import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  fetchDetailedSearchHistory, 
  deleteSearchQueryFromDB, 
  clearSearchHistoryFromDB, 
  DetailedSearchHistoryItem 
} from '../services/api';
import { formatINR } from '../utils/currency';
import { 
  History, 
  Trash2, 
  Search, 
  ArrowRight, 
  RefreshCw, 
  AlertCircle, 
  Calendar, 
  Clock, 
  Tag, 
  Store, 
  ShoppingBag,
  ExternalLink
} from 'lucide-react';

export default function HistoryPage() {
  const [historyItems, setHistoryItems] = useState<DetailedSearchHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function loadHistory() {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchDetailedSearchHistory();
      // Show most recent searches first (already sorted by server DESC, but we safeguard here)
      setHistoryItems(items);
    } catch (err: any) {
      setError("Unable to retrieve search memory from server database.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDeleteItem = async (itemId: number, term: string) => {
    setDeletingId(itemId);
    try {
      await deleteSearchQueryFromDB(term);
      setHistoryItems(prev => prev.filter(item => item.history_id !== itemId));
    } catch (err) {
      setError("Failed to delete search history item.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to permanently clear your search memory history? This cannot be undone.")) {
      return;
    }
    try {
      setHistoryItems([]);
      await clearSearchHistoryFromDB();
    } catch (err) {
      setError("Failed to clear search history.");
    }
  };

  const formatSearchDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const optionsDate: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      };
      const optionsTime: Intl.DateTimeFormatOptions = { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
      };
      return {
        date: date.toLocaleDateString('en-IN', optionsDate),
        time: date.toLocaleTimeString('en-IN', optionsTime)
      };
    } catch {
      return { date: dateStr, time: '' };
    }
  };

  if (loading) {
    return (
      <div id="history-loading-spinner" className="flex-1 flex items-center justify-center py-24 bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-mono text-slate-500">Retrieving search history records...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="history-page-root" className="flex-1 flex flex-col gap-6">
      
      {/* Upper header action bar */}
      <div id="history-page-header" className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-800 tracking-tight">
            Search History Workspace
          </h1>
          <p className="text-xs text-slate-500">
            Audit logs of search terms, matching products, snapshot queries, and lowest discovered price indexes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {historyItems.length > 0 && (
            <button
              id="clear-all-history-page-btn"
              onClick={handleClearAll}
              className="cursor-pointer bg-white text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-150 py-2 px-3 text-xs font-mono font-medium rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
              title="Purge search database"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete All</span>
            </button>
          )}

          <button
            id="history-page-refresh-btn"
            onClick={loadHistory}
            className="cursor-pointer bg-white border border-slate-200 hover:bg-slate-50 p-2 rounded-xl transition-all shadow-xs"
            title="Reload Search history database"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {error && (
        <div id="history-error-banner" className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Database Search Log listing */}
      {historyItems.length === 0 ? (
        <div id="history-empty-state-card" className="bg-white border border-slate-200/80 p-12 rounded-2xl text-center flex flex-col items-center gap-4 shadow-xs">
          <div className="h-14 w-14 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-center">
            <History className="w-6 h-6 text-slate-400" />
          </div>
          <div className="flex flex-col gap-1 max-w-sm">
            <h3 className="text-sm font-bold text-slate-700">Search History is Empty</h3>
            <p className="text-xs text-slate-500 leading-normal">
              You haven't checked any specific keywords on this browser catalog. Type terms in the Catalogue search bar to construct matching historical parameters.
            </p>
          </div>
          <Link
            to="/products"
            id="empty-state-catalogue-lnk"
            className="mt-2 bg-indigo-600 hover:bg-indigo-700 font-mono text-xs font-semibold py-2.5 px-5 rounded-xl text-white shadow-xs flex items-center gap-1.5 transition-all animate-bounce-slow"
          >
            <span>Scan Catalog Products</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div id="history-items-grid" className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {historyItems.map((item, index) => {
            const dt = formatSearchDateTime(item.searched_at);
            const hasProduct = !!item.product_name;

            return (
              <div 
                key={item.history_id} 
                id={`history-item-card-${item.history_id}`}
                className="bg-white border border-slate-200/80 rounded-2xl p-4 md:p-5 shadow-xs flex flex-col justify-between gap-4 transition-all group hover:border-indigo-200 hover:shadow-md"
              >
                {/* Header Information */}
                <div className="flex justify-between items-start gap-3">
                  <div className="flex gap-4">
                    {/* Thumbnail Asset image or package icon */}
                    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-slate-50 overflow-hidden border border-slate-100 flex items-center justify-center shrink-0">
                      {item.product_image ? (
                        <img 
                          referrerPolicy="no-referrer" 
                          src={item.product_image} 
                          alt={item.product_name || "Query thumbnail"} 
                          className="h-full w-full object-cover group-hover:scale-105 transition-all" 
                        />
                      ) : (
                        <Search className="w-6 h-6 text-slate-300" />
                      )}
                    </div>

                    {/* Meta descriptions */}
                    <div className="flex flex-col">
                      {/* Search Term Tag Badge */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] sm:text-[11px] font-mono font-bold bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.0 py-0.5 rounded-md flex items-center gap-1">
                          <Search className="w-2.5 h-2.5" />
                          <span>"{item.search_term}"</span>
                        </span>
                      </div>

                      {/* Matching Product description */}
                      <h3 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-1 mt-1.5">
                        {item.product_name || "No direct product catalog matching"}
                      </h3>

                      {/* DateTime Stamp badges */}
                      <div className="flex items-center gap-2.5 text-slate-400 mt-1 font-mono text-[9px] sm:text-[10px]">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-300" />
                          <span>{dt.date}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-300" />
                          <span>{dt.time}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Single Delete Action trigger */}
                  <button
                    id={`delete-history-btn-${item.history_id}`}
                    onClick={() => handleDeleteItem(item.history_id, item.search_term)}
                    disabled={deletingId === item.history_id}
                    className="cursor-pointer text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-50 transition-all self-start shrink-0"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Foot indicators and Quick Navigation redirection CTA */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-3.5">
                  <div className="flex flex-col gap-0.5">
                    {/* Lowest Price Tag value */}
                    <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">Lowest Discovered Rate</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-slate-700">
                        {item.lowest_price !== null ? formatINR(Number(item.lowest_price)) : "N/A"}
                      </span>
                      {item.store_name && (
                        <span className="text-[9px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Store className="w-2.5 h-2.5" />
                          <span>{item.store_name}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details anchor linking */}
                  <div className="flex items-center">
                    {item.product_id ? (
                      <Link
                        to={`/products/${item.product_id}`}
                        id={`view-details-lnk-${item.history_id}`}
                        className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs"
                      >
                        <span>View Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : (
                      <Link
                        to={`/products?search=${encodeURIComponent(item.search_term)}`}
                        id={`search-catalog-lnk-${item.history_id}`}
                        className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-semibold bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors border border-slate-200"
                      >
                        <span>Search Catalog</span>
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                      </Link>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
