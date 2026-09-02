import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDetailedSearchHistory, deleteSearchQueryFromDB, clearSearchHistoryFromDB } from '../services/api';
import { DetailedSearchHistoryItem } from '../types/frontend';
import { formatINR } from '../utils/currency';
import { History, Trash2, ArrowRight, Clock, Search, XCircle, SearchX } from 'lucide-react';
import { format } from 'date-fns';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400";

const HistoryPage: React.FC = () => {
  const [history, setHistory] = useState<DetailedSearchHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await getDetailedSearchHistory();
      setHistory(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch search history.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (query: string) => {
    try {
      await deleteSearchQueryFromDB(query);
      setHistory(history.filter(item => item.query !== query));
    } catch (err: any) {
      alert('Failed to delete history item');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear your entire search history?')) return;
    try {
      await clearSearchHistoryFromDB();
      setHistory([]);
    } catch (err: any) {
      alert('Failed to clear history');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium text-slate-500">Loading search history...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:h-20 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <History className="w-6 h-6 text-indigo-600 shrink-0" />
              Search History
            </h1>
            <p className="text-sm text-slate-500">Your recent searches and discovered products.</p>
          </div>
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-sm font-medium transition-colors shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 p-4 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {history.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">No Search History</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-8">
              You haven't searched for any gadgets yet. Your search history will appear here.
            </p>
            <Link
              to="/products"
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Start Exploring
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {history.map((item, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-slate-900">"{item.query}"</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.last_searched_at ? format(new Date(item.last_searched_at), 'MMM dd, p') : 'Unknown'}
                    </span>
                    <button 
                      onClick={() => handleDeleteItem(item.query)}
                      className="text-slate-400 hover:text-rose-500 transition-colors"
                      title="Remove from history"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {item.product_id ? (
                  <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-4">
                    <Link 
                      to={`/products/${item.product_id}`}
                      className="block w-16 h-16 bg-white rounded-lg p-2 shrink-0 border border-slate-100 cursor-pointer overflow-hidden"
                      title={`View details for ${item.product_name}`}
                    >
                      <img 
                        referrerPolicy="no-referrer"
                        src={item.product_image || FALLBACK_IMAGE} 
                        alt={item.product_name}
                        onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                        className="w-full h-full object-contain mix-blend-multiply hover:scale-105 transition-transform duration-300"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/products/${item.product_id}`} className="block mb-1" title={`View details for ${item.product_name}`}>
                        <h3 className="font-medium text-slate-900 text-sm line-clamp-1 hover:text-indigo-600 hover:underline transition-colors">{item.product_name}</h3>
                      </Link>
                      {item.lowest_price !== undefined && item.lowest_price !== null ? (
                        <div className="text-emerald-600 font-bold">{formatINR(item.lowest_price)}</div>
                      ) : (
                        <div className="text-slate-400 text-xs">Price unavailable</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0 font-semibold">
                      <Search className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">Search Topic</span>
                      <span className="text-sm font-semibold text-slate-800 truncate block">{item.query || item.search_term}</span>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                  <Link
                    to={`/products?search=${encodeURIComponent(item.query || item.search_term || '')}`}
                    className="flex-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-center"
                  >
                    Search Again
                  </Link>
                  {item.product_id && (
                    <Link
                      to={`/products/${item.product_id}`}
                      className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
                    >
                      View Details
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
