import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDetailedSearchHistory, deleteSearchQueryFromDB, clearSearchHistoryFromDB } from '../services/api';
import { DetailedSearchHistoryItem } from '../types/frontend';
import { formatINR } from '../utils/currency';
import { History, Trash2, ArrowRight, Clock, Search, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { format, isToday, isYesterday, isValid } from 'date-fns';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400";

const formatHistoryTimestamp = (dateVal?: string | null | Date): string => {
  if (!dateVal) return 'Date unavailable';
  try {
    const date = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
    if (!isValid(date)) return 'Date unavailable';
    
    if (isToday(date)) {
      return `Today, ${format(date, 'h:mm a')}`;
    }
    if (isYesterday(date)) {
      return `Yesterday, ${format(date, 'h:mm a')}`;
    }
    const currentYear = new Date().getFullYear();
    const dateYear = date.getFullYear();
    if (dateYear === currentYear) {
      return format(date, 'MMM dd, h:mm a');
    }
    return format(date, 'MMM dd, yyyy');
  } catch {
    return 'Date unavailable';
  }
};

const HistoryPage: React.FC = () => {
  const [history, setHistory] = useState<DetailedSearchHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingQuery, setDeletingQuery] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [clearing, setClearing] = useState<boolean>(false);

  useEffect(() => {
    loadHistory(true);
  }, []);

  const loadHistory = async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const data = await getDetailedSearchHistory();
      setHistory(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch search history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDeleteItem = async (query: string) => {
    if (!query || deletingQuery) return;
    setDeletingQuery(query);
    setError(null);
    try {
      await deleteSearchQueryFromDB(query);
      const normalized = query.trim().toLowerCase();
      setHistory(prev => prev.filter(item => {
        const itemQ = (item.query || item.search_term || '').trim().toLowerCase();
        return itemQ !== normalized;
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to delete history item.');
    } finally {
      setDeletingQuery(null);
    }
  };

  const executeClearAll = async () => {
    setClearing(true);
    setError(null);
    try {
      await clearSearchHistoryFromDB();
      setHistory([]);
      setShowClearConfirm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to clear search history.');
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center p-8">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium text-slate-500">Loading search history...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-4 sm:gap-6 w-full max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0" />
            <span>Search History</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Your recent searches and discovered products.</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {history.length > 0 && (
            <>
              {showClearConfirm ? (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 p-1.5 rounded-xl">
                  <span className="text-xs font-semibold text-rose-800 px-1">Clear all?</span>
                  <button
                    id="btn-confirm-clear-history"
                    type="button"
                    onClick={executeClearAll}
                    disabled={clearing}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-semibold transition-colors min-h-[36px] flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    {clearing ? <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Yes, Clear'}
                  </button>
                  <button
                    id="btn-cancel-clear-history"
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    disabled={clearing}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors min-h-[36px] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  id="btn-clear-search-history"
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 bg-rose-50 hover:bg-rose-100 active:bg-rose-150 text-rose-600 border border-rose-150 rounded-xl text-xs sm:text-sm font-semibold transition-colors shrink-0 min-h-[44px] cursor-pointer shadow-xs"
                  title="Clear all search history"
                  aria-label="Clear all search history"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>Clear All</span>
                </button>
              )}
            </>
          )}

          <button
            id="btn-refresh-history"
            type="button"
            onClick={() => loadHistory(false)}
            disabled={refreshing || loading}
            className="cursor-pointer bg-white border border-slate-200 hover:bg-slate-50 p-2.5 rounded-xl transition-all shadow-xs shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-60"
            title="Refresh Search History"
            aria-label="Refresh Search History"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => loadHistory(true)}
            className="text-xs font-semibold text-rose-800 underline hover:no-underline ml-2 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Listing / Empty State */}
      {history.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 sm:p-12 text-center shadow-xs max-w-lg mx-auto w-full my-4 sm:my-6 flex flex-col items-center">
          <div className="h-14 w-14 sm:h-16 sm:w-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mb-4 text-indigo-600 shadow-xs">
            <Search className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-1.5">No Search History</h2>
          <p className="text-slate-500 max-w-sm mx-auto mb-6 text-xs sm:text-sm leading-relaxed">
            You haven't searched for any gadgets yet. Your search history will appear here.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors gap-2 text-xs sm:text-sm shadow-xs min-h-[44px]"
          >
            <span>Start Exploring</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {history.map((item, idx) => {
            const rawQuery = item.query || item.search_term || '';
            const timestampDisplay = formatHistoryTimestamp(item.searched_at || item.last_searched_at || item.created_at);
            const isDeletingThis = deletingQuery === rawQuery;

            return (
              <div 
                key={item.history_id || `${rawQuery}-${idx}`} 
                id={`history-card-${idx}`}
                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Header: Query text & Timestamp & Delete */}
                <div className="flex items-center justify-between gap-2.5 pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Search className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="font-semibold text-slate-900 text-xs sm:text-sm truncate" title={rawQuery}>
                      "{rawQuery}"
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <span className="text-[10px] sm:text-xs text-slate-400 flex items-center gap-1 whitespace-nowrap">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{timestampDisplay}</span>
                    </span>
                    <button 
                      id={`btn-del-history-${idx}`}
                      type="button"
                      onClick={() => handleDeleteItem(rawQuery)}
                      disabled={isDeletingThis}
                      className="text-slate-400 hover:text-rose-500 active:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 disabled:opacity-50"
                      title={`Remove "${rawQuery}" from search history`}
                      aria-label={`Remove "${rawQuery}" from search history`}
                    >
                      {isDeletingThis ? (
                        <span className="h-4 w-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Body Preview: Matched Product OR Search Topic */}
                {item.product_id ? (
                  <div className="flex-1 bg-slate-50/80 rounded-xl p-3 sm:p-3.5 border border-slate-150 flex items-center gap-3 sm:gap-4">
                    <Link 
                      to={`/products/${item.product_id}`}
                      className="block w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-lg p-1.5 shrink-0 border border-slate-100 cursor-pointer overflow-hidden group"
                      title={`View details for ${item.product_name || 'Product'}`}
                      aria-label={`View details for ${item.product_name || 'Product'}`}
                    >
                      <img 
                        referrerPolicy="no-referrer"
                        src={item.product_image || FALLBACK_IMAGE} 
                        alt={item.product_name || 'Product preview'}
                        onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                        className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link 
                        to={`/products/${item.product_id}`} 
                        className="block mb-1 group/title focus:outline-none" 
                        title={`View details for ${item.product_name || 'Product'}`}
                      >
                        <h3 className="font-medium text-slate-900 text-xs sm:text-sm line-clamp-2 leading-snug group-hover/title:text-indigo-600 group-hover/title:underline transition-colors break-words">
                          {item.product_name || 'Matched Product'}
                        </h3>
                      </Link>
                      {item.lowest_price !== undefined && item.lowest_price !== null ? (
                        <div className="text-emerald-600 font-bold text-xs sm:text-sm">{formatINR(item.lowest_price)}</div>
                      ) : (
                        <div className="text-slate-400 text-xs font-medium">Price unavailable</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 bg-slate-50/80 rounded-xl p-3 sm:p-3.5 border border-slate-150 flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0 font-semibold border border-indigo-100">
                      <Search className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider block">Search Topic</span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate block">
                        {rawQuery}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Actions Row */}
                <div className="flex items-center gap-2 sm:gap-3 mt-3 pt-3 border-t border-slate-100">
                  <Link
                    id={`btn-search-again-${idx}`}
                    to={`/products?search=${encodeURIComponent(rawQuery)}`}
                    className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors text-center inline-flex items-center justify-center min-h-[44px] shadow-xs"
                    title={`Search again for "${rawQuery}"`}
                  >
                    Search Again
                  </Link>
                  {item.product_id && (
                    <Link
                      id={`btn-view-details-${idx}`}
                      to={`/products/${item.product_id}`}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1 min-h-[44px] shadow-xs"
                      title={`View details for ${item.product_name || 'Product'}`}
                    >
                      <span>View Details</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
