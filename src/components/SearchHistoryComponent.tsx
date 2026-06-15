import React, { useEffect, useState } from 'react';
import { History, Trash2, X, Loader2 } from 'lucide-react';
import { 
  fetchSearchHistory, 
  deleteSearchQueryFromDB, 
  clearSearchHistoryFromDB 
} from '../services/api';

interface SearchHistoryComponentProps {
  onSelectTerm: (term: string) => void;
  // Triggered when search is performed elsewhere, allowing the parent to notify this component to refresh its state
  refreshTrigger?: number;
}

export const SearchHistoryComponent: React.FC<SearchHistoryComponentProps> = ({
  onSelectTerm,
  refreshTrigger = 0,
}) => {
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch search history on mount and whenever external trigger changes
  useEffect(() => {
    let active = true;
    async function loadHistory() {
      setLoading(true);
      setError(null);
      try {
        const dbHistory = await fetchSearchHistory();
        if (active) {
          setHistory(dbHistory);
          // Sync local storage as backup fallback
          localStorage.setItem('deal_search_history', JSON.stringify(dbHistory));
        }
      } catch (err: any) {
        console.warn("Failed to fetch search history from API server:", err);
        if (active) {
          // Read from localStorage fallback
          try {
            const saved = localStorage.getItem('deal_search_history');
            if (saved) {
              setHistory(JSON.parse(saved));
            }
          } catch {
            setHistory([]);
          }
          // Non-blocking warning state
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadHistory();
    return () => {
      active = false;
    };
  }, [refreshTrigger]);

  const handleDeleteItem = async (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Optimistic local state update
    const updated = history.filter(item => item !== term);
    setHistory(updated);
    try {
      localStorage.setItem('deal_search_history', JSON.stringify(updated));
      await deleteSearchQueryFromDB(term);
    } catch (err) {
      console.warn("Error deleting item from search history:", err);
    }
  };

  const handleClearAll = async () => {
    setHistory([]);
    try {
      localStorage.removeItem('deal_search_history');
      await clearSearchHistoryFromDB();
    } catch (err) {
      console.warn("Error clearing search history:", err);
    }
  };

  if (loading && history.length === 0) {
    return (
      <div className="flex items-center gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
        <Loader2 className="w-3 h-3 text-indigo-500 animate-spin" />
        <span className="font-mono">Syncing search memory...</span>
      </div>
    );
  }

  if (history.length === 0) {
    return null;
  }

  return (
    <div id="search-history-container" className="flex items-center flex-wrap gap-2 border-t border-slate-100 pt-3 text-[11px]">
      <div className="flex items-center gap-1 text-slate-400 font-mono text-[10px] uppercase font-semibold">
        <History className="w-3 h-3 text-indigo-400" />
        <span>Recent Searches:</span>
      </div>
      
      <div id="search-history-chips-list" className="flex flex-wrap items-center gap-1.5 flex-1 select-none">
        {history.map((term, index) => (
          <div
            key={`${term}-${index}`}
            id={`history-chip-${index}`}
            className="group flex items-center bg-slate-100 hover:bg-indigo-50/60 border border-slate-200/60 hover:border-indigo-200 text-slate-600 rounded-md transition-all text-[11px] font-sans shadow-sm"
          >
            <button
              type="button"
              id={`history-chip-btn-${index}`}
              onClick={() => onSelectTerm(term)}
              className="cursor-pointer px-2 py-0.5 font-medium hover:text-indigo-600 transition-colors text-[11px]"
              title={`Recall search for "${term}"`}
            >
              {term}
            </button>
            <button
              type="button"
              id={`history-chip-delete-${index}`}
              onClick={(e) => handleDeleteItem(term, e)}
              className="cursor-pointer pr-1.5 pl-0.5 py-1 text-slate-400 hover:text-rose-600 transition-colors"
              title={`Remove "${term}" from history`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        {loading && (
          <Loader2 className="w-3 h-3 text-indigo-400 animate-spin ml-1" />
        )}
      </div>

      <button 
        type="button"
        id="clear-all-history-btn"
        onClick={handleClearAll}
        className="cursor-pointer text-slate-450 hover:text-rose-600 flex items-center gap-0.5 ml-auto text-[10px] font-mono font-bold"
        title="Wipe entire database search records clean"
      >
        <Trash2 className="w-3 h-3" />
        <span>Clear</span>
      </button>
    </div>
  );
};
