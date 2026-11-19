import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchWatchlist, removeFromWatchlist } from '../services/api';
import { WatchlistEntry } from '../types/frontend';
import { formatINR, isRealSpec } from '../utils/currency';
import { Sparkline } from '../components/Sparkline';
import { Bookmark, ClipboardList, Trash2, ArrowRight, ExternalLink, RefreshCw, AlertCircle, BookmarkX, Plus } from 'lucide-react';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400";

const isValidHttpUrl = (url?: string | null): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

  async function loadWatchlist(isInitial = false) {
    if (isInitial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const items = await fetchWatchlist();
      setWatchlist(items);
      window.dispatchEvent(new Event('watchlist-updated'));
    } catch (err: any) {
      setError("Unable to sync active watchlist records with database.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadWatchlist(true);
  }, []);

  const handleRemove = async (watchlistId: number) => {
    setIsDeletingId(watchlistId);
    try {
      await removeFromWatchlist(watchlistId);
      // Fast state filter updates
      setWatchlist(prev => prev.filter(item => item.watchlist_id !== watchlistId));
      window.dispatchEvent(new Event('watchlist-updated'));
    } catch (err) {
      setError("Error purging item from local indices.");
    } finally {
      setIsDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-mono text-slate-500">Querying active watchlists...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-4 sm:gap-6">
      
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-display font-bold text-slate-800 tracking-tight">
            Saved Gadgets
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Monitored gadgets with current best deal rates and partner merchant tags.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/products"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all shrink-0 min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </Link>

          <button
            id="btn-sync-watcher"
            onClick={() => loadWatchlist(false)}
            disabled={refreshing || loading}
            className="cursor-pointer bg-white border border-slate-200 hover:bg-slate-50 p-2 sm:p-2.5 rounded-xl transition-all shadow-xs shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-60"
            title="Refresh Saved Gadgets"
            aria-label="Refresh Saved Gadgets"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main layout contents */}
      {watchlist.length === 0 ? (
        <div className="bg-white border border-slate-200/80 p-8 sm:p-12 rounded-2xl text-center flex flex-col items-center gap-4 shadow-xs max-w-lg mx-auto w-full my-4 sm:my-6">
          <div className="h-14 w-14 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-center">
            <Bookmark className="w-6 h-6 text-slate-400" />
          </div>
          <div className="flex flex-col gap-1 max-w-sm">
            <h3 className="text-base font-bold text-slate-800">You have no saved gadgets yet.</h3>
            <p className="text-xs text-slate-500 leading-normal">
              Find a gadget in Search Gadgets and add it to Saved Gadgets.
            </p>
          </div>
          <Link
            to="/products"
            className="mt-2 bg-indigo-600 hover:bg-indigo-700 font-medium text-xs py-2.5 px-5 rounded-xl text-white shadow-xs flex items-center gap-1.5 transition-all min-h-[44px]"
          >
            <span>Search Gadgets</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-5">
          {watchlist.map((item: any) => (
            <div 
              key={item.watchlist_id} 
              className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-5 shadow-xs flex flex-col justify-between gap-3 sm:gap-3.5 transition-all group hover:border-indigo-200"
            >
              
              {/* Top row: Thumb + Brand/Title/Specs + Actions */}
              <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                {/* Thumb */}
                <Link
                  to={`/products/${item.product_id}`}
                  className="block h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-slate-50 overflow-hidden border border-slate-100 shrink-0 cursor-pointer"
                  title={`View details for ${item.product_name}`}
                >
                  <img 
                    referrerPolicy="no-referrer" 
                    src={item.image_url || FALLBACK_IMAGE} 
                    alt={item.product_name} 
                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                    className="h-full w-full object-contain p-1 hover:scale-105 transition-transform duration-300 mix-blend-multiply" 
                  />
                </Link>

                {/* Text specs */}
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.brand}</span>
                  <Link to={`/products/${item.product_id}`} className="block mt-0.5" title={`View details for ${item.product_name}`}>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-2 leading-snug hover:text-indigo-600 hover:underline transition-colors break-words">
                      {item.product_name}
                    </h3>
                  </Link>
                  {isRealSpec(item.specs_summary) && (
                    <p className="text-[10px] text-slate-400 leading-normal line-clamp-1 italic mt-0.5">
                      {item.specs_summary}
                    </p>
                  )}
                </div>

                {/* Action Buttons Column */}
                <div className="flex flex-col items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    id={`btn-del-watch-${item.watchlist_id}`}
                    onClick={() => handleRemove(item.watchlist_id)}
                    disabled={isDeletingId === item.watchlist_id}
                    className="cursor-pointer bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 p-2 sm:p-2.5 rounded-xl transition-all shadow-xs min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
                    title="Remove from Saved Gadgets"
                    aria-label="Remove from Saved Gadgets"
                  >
                    {isDeletingId === item.watchlist_id ? (
                      <span className="h-4 w-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <BookmarkX className="w-4 h-4" />
                    )}
                  </button>

                  {isValidHttpUrl(item.product_url) ? (
                    <a
                      id={`btn-ext-retailer-${item.watchlist_id}`}
                      href={item.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-slate-50 border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 p-2 sm:p-2.5 rounded-xl text-xs font-mono font-medium flex items-center justify-center shadow-xs transition-colors min-h-[44px] min-w-[44px] cursor-pointer"
                      title={`Open ${item.product_name} at ${item.purchase_outlet || 'retailer'}`}
                      aria-label={`Open ${item.product_name} at ${item.purchase_outlet || 'retailer'}`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="bg-slate-50 border border-slate-200 text-slate-300 cursor-not-allowed p-2 sm:p-2.5 rounded-xl text-xs font-mono font-medium flex items-center justify-center shadow-xs min-h-[44px] min-w-[44px] opacity-60"
                      title="Retailer link unavailable"
                      aria-label="Retailer link unavailable"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom row: Live Price + Tracking status / Sparkline + Retailer */}
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 shrink-0 min-w-0">
                <div className="min-w-0">
                  <span className="text-[9px] text-slate-400 uppercase block font-semibold tracking-wider">Live Best Price</span>
                  <div className="text-sm sm:text-base font-sans font-bold text-indigo-600 truncate">
                    {item.lowest_live_price !== undefined && item.lowest_live_price !== null ? formatINR(item.lowest_live_price) : 'Price unavailable'}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] text-slate-400 shrink-0 min-w-0 max-w-[65%] justify-end">
                  <Sparkline history={item.price_history} width={56} height={20} />
                  <span className="truncate max-w-[110px] sm:max-w-[150px] text-right">
                    via <span className="font-semibold text-slate-700">{item.purchase_outlet || 'Retailer'}</span>
                  </span>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
