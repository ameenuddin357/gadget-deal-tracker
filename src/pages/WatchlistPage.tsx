import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchWatchlist, removeFromWatchlist } from '../services/api';
import { WatchlistEntry } from '../types/frontend';
import { formatINR, isRealSpec } from '../utils/currency';
import { Sparkline } from '../components/Sparkline';
import { Bookmark, ClipboardList, Trash2, ArrowRight, ExternalLink, RefreshCw, AlertCircle, BookmarkX, Plus } from 'lucide-react';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400";

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

  async function loadWatchlist() {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchWatchlist();
      setWatchlist(items);
    } catch (err: any) {
      setError("Unable to sync active watchlist records with databases client.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWatchlist();
  }, []);

  const handleRemove = async (watchlistId: number) => {
    setIsDeletingId(watchlistId);
    try {
      await removeFromWatchlist(watchlistId);
      // Fast state filter updates
      setWatchlist(prev => prev.filter(item => item.watchlist_id !== watchlistId));
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
    <div className="flex-1 flex flex-col gap-6">
      
      {/* Upper header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-800 tracking-tight">
            My Watchlist Workspace
          </h1>
          <p className="text-xs text-slate-500">
            Monitored gadgets with current best deal rates and partner merchant tags.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/products"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </Link>

          <button
            id="btn-sync-watcher"
            onClick={loadWatchlist}
            className="cursor-pointer bg-white border border-slate-200 hover:bg-slate-50 p-2 rounded-xl transition-all shadow-xs shrink-0"
            title="Refresh Watchlist"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
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
        <div className="bg-white border border-slate-200/80 p-12 rounded-2xl text-center flex flex-col items-center gap-4 shadow-xs max-w-lg mx-auto w-full my-6">
          <div className="h-14 w-14 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-center">
            <Bookmark className="w-6 h-6 text-slate-400" />
          </div>
          <div className="flex flex-col gap-1 max-w-sm">
            <h3 className="text-base font-bold text-slate-800">Your watchlist is empty.</h3>
            <p className="text-xs text-slate-500 leading-normal">
              Find a product in the catalogue and add it to your watchlist.
            </p>
          </div>
          <Link
            to="/products"
            className="mt-2 bg-indigo-600 hover:bg-indigo-700 font-medium text-xs py-2.5 px-5 rounded-xl text-white shadow-xs flex items-center gap-1.5 transition-all"
          >
            <span>Browse Tech Catalogue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {watchlist.map((item: any) => (
            <div key={item.watchlist_id} className="bg-white border border-slate-200/80 rounded-2xl p-4 md:p-5 shadow-xs flex justify-between gap-5 transition-all group hover:border-indigo-200">
              
              <div className="flex gap-4 flex-1 min-w-0">
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
                <div className="flex flex-col justify-between flex-1 min-w-0">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.brand}</span>
                  <Link to={`/products/${item.product_id}`} className="block mt-0.5" title={`View details for ${item.product_name}`}>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-1 hover:text-indigo-600 hover:underline transition-colors">
                      {item.product_name}
                    </h3>
                  </Link>
                    {isRealSpec(item.specs_summary) && (
                      <p className="text-[10px] text-slate-400 leading-normal line-clamp-1 italic mt-0.5">
                        {item.specs_summary}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-50 pt-2 shrink-0">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase block font-semibold">Live Best Price</span>
                      <div className="text-sm font-sans font-bold text-indigo-600">
                        {item.lowest_live_price !== undefined && item.lowest_live_price !== null ? formatINR(item.lowest_live_price) : 'Price unavailable'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Sparkline history={item.price_history} />
                      <span className="text-[10px] text-slate-400">
                        via <span className="font-semibold text-slate-600">{item.purchase_outlet || 'Retailer'}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Column */}
              <div className="flex flex-col justify-between items-end shrink-0">
                <button
                  id={`btn-del-watch-${item.watchlist_id}`}
                  onClick={() => handleRemove(item.watchlist_id)}
                  disabled={isDeletingId === item.watchlist_id}
                  className="cursor-pointer bg-white border border-slate-150 text-slate-400 hover:text-rose-600 hover:border-rose-100 hover:bg-rose-50/50 p-2 rounded-xl transition-all shadow-xs"
                  title="Purge Watched Widget"
                >
                  {isDeletingId === item.watchlist_id ? (
                    <span className="h-3.5 w-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <BookmarkX className="w-3.5 h-3.5" />
                  )}
                </button>

                <Link
                  to={`/products/${item.product_id}`}
                  className="bg-slate-50 border border-slate-150 text-slate-600 hover:bg-slate-150 p-2 rounded-xl text-xs font-mono font-medium flex items-center justify-center gap-1 shadow-xs transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
