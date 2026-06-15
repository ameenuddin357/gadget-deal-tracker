import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchWatchlist, removeFromWatchlist } from '../services/api';
import { WatchlistEntry } from '../types/frontend';
import { formatINR } from '../utils/currency';
import { Bookmark, ClipboardList, Trash2, ArrowRight, ExternalLink, RefreshCw, AlertCircle, BookmarkX } from 'lucide-react';

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-800 tracking-tight">
            My Watchlist Workspace
          </h1>
          <p className="text-xs text-slate-500">
            Monitored gadgets with current best deal rates and partner merchant tags.
          </p>
        </div>

        <button
          id="btn-sync-watcher"
          onClick={loadWatchlist}
          className="cursor-pointer bg-white border border-slate-200 hover:bg-slate-50 p-2 rounded-xl transition-all shadow-xs"
          title="Force Synced Scrapes"
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main layout contents */}
      {watchlist.length === 0 ? (
        <div className="bg-white border border-slate-200/80 p-12 rounded-2xl text-center flex flex-col items-center gap-4 shadow-xs">
          <div className="h-14 w-14 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-center">
            <Bookmark className="w-6 h-6 text-slate-400" />
          </div>
          <div className="flex flex-col gap-1 max-w-sm">
            <h3 className="text-sm font-bold text-slate-700">Watchlist is Empty</h3>
            <p className="text-xs text-slate-500 leading-normal">
              You haven't assigned any tech gadgets to your watchlist matrix yet. Explore our listing catalogs to begin tracking.
            </p>
          </div>
          <Link
            to="/products"
            className="mt-2 bg-indigo-600 hover:bg-indigo-700 font-mono text-xs font-semibold py-2.5 px-5 rounded-xl text-white shadow-xs flex items-center gap-1.5 transition-all"
          >
            <span>Explore Catalyst Catalogue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {watchlist.map(item => (
            <div key={item.watchlist_id} className="bg-white border border-slate-200/80 rounded-2xl p-4 md:p-5 shadow-xs flex justify-between gap-5 transition-all group hover:border-indigo-200">
              
              <div className="flex gap-4">
                {/* Thumb */}
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-slate-50 overflow-hidden border border-slate-100 shrink-0">
                  <img referrerPolicy="no-referrer" src={item.image_url} alt={item.product_name} className="h-full w-full object-cover group-hover:scale-105 transition-all" />
                </div>

                {/* Text specs */}
                <div className="flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">{item.brand} catalog</span>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 mt-0.5">
                      {item.product_name}
                    </h3>
                    <p className="text-[10px] text-slate-400 leading-normal line-clamp-1 italic mt-0.5">
                      {item.specs_summary}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 border-t border-slate-50 pt-2 shrink-0">
                    <div>
                      <span className="text-[9px] font-mono text-slate-400 uppercase">Live Index Price</span>
                      <div className="text-sm font-sans font-bold text-indigo-600">
                        {item.lowest_live_price !== undefined ? formatINR(item.lowest_live_price) : 'Scraping...'}
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400">
                      Via <span className="font-semibold text-slate-600">{item.purchase_outlet || 'Outlet'}</span>
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
