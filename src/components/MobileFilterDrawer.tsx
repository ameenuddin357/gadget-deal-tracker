import React, { useState, useEffect } from 'react';
import { X, Check, SlidersHorizontal } from 'lucide-react';
import { SearchHistoryComponent } from './SearchHistoryComponent';

interface CategoryItem {
  label: string;
  queryValue: string;
}

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  selectedCategory: string;
  stores: string[];
  selectedStore: string;
  budgetPresets: { label: string; max: string }[];
  minPrice: string;
  maxPrice: string;
  totalItems?: number;
  onApply: (applied: { category: string; store: string; minPrice: string; maxPrice: string }) => void;
  onSelectHistoryItem: (term: string) => void;
  historyTrigger: number;
}

export default function MobileFilterDrawer({
  isOpen,
  onClose,
  categories,
  selectedCategory,
  stores,
  selectedStore,
  budgetPresets,
  minPrice,
  maxPrice,
  onApply,
  onSelectHistoryItem,
  historyTrigger,
}: MobileFilterDrawerProps) {
  // Local draft state for isolation until user commits
  const [draftCategory, setDraftCategory] = useState(selectedCategory);
  const [draftStore, setDraftStore] = useState(selectedStore);
  const [draftMinPrice, setDraftMinPrice] = useState(minPrice);
  const [draftMaxPrice, setDraftMaxPrice] = useState(maxPrice);

  // Sync draft state with committed props whenever drawer opens
  useEffect(() => {
    if (isOpen) {
      setDraftCategory(selectedCategory);
      setDraftStore(selectedStore);
      setDraftMinPrice(minPrice);
      setDraftMaxPrice(maxPrice);
    }
  }, [isOpen, selectedCategory, selectedStore, minPrice, maxPrice]);

  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key (discards uncommitted draft)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasDraftFilters = 
    draftCategory !== 'All' || 
    draftStore !== 'All Stores' || 
    draftMinPrice !== '' || 
    draftMaxPrice !== '';

  const handleResetDraft = () => {
    setDraftCategory('All');
    setDraftStore('All Stores');
    setDraftMinPrice('');
    setDraftMaxPrice('');
  };

  const handleApplyCommit = () => {
    onApply({
      category: draftCategory,
      store: draftStore,
      minPrice: draftMinPrice,
      maxPrice: draftMaxPrice,
    });
    onClose();
  };

  return (
    <div 
      id="mobile-filter-drawer-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Filter Products"
      className="fixed inset-0 z-50 flex flex-col justify-end md:hidden"
    >
      {/* Backdrop - Clicking discards draft */}
      <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div className="relative z-10 bg-white rounded-t-2xl shadow-2xl border-t border-slate-200 w-full max-h-[88vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-150 flex items-center justify-center text-indigo-600">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">Filters</h2>
              <p className="text-[11px] text-slate-500 font-normal">Narrow your gadget search</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-close-filter-drawer"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close filters"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5 divide-y divide-slate-100">
          
          {/* 1. Product Type / Category */}
          <div className="flex flex-col gap-2">
            <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">
              Product Type
            </span>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((catItem) => {
                const isSelected = draftCategory === catItem.label;
                return (
                  <button
                    key={catItem.label}
                    type="button"
                    onClick={() => setDraftCategory(catItem.label)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer min-h-[40px] ${
                      isSelected
                        ? 'bg-slate-900 text-white font-semibold shadow-xs'
                        : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-indigo-400" />}
                    <span>{catItem.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Store */}
          <div className="flex flex-col gap-2 pt-4">
            <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">
              Retailer Store
            </span>
            <div className="flex flex-wrap gap-1.5">
              {stores.map((store) => {
                const isSelected = draftStore === store;
                return (
                  <button
                    key={store}
                    type="button"
                    onClick={() => setDraftStore(store)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer min-h-[40px] ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                        : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                    <span>{store}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Budget Presets */}
          <div className="flex flex-col gap-2 pt-4">
            <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">
              Budget Presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              {budgetPresets.map((preset) => {
                const isActive = (!draftMinPrice && draftMaxPrice === preset.max) || (!draftMinPrice && !draftMaxPrice && preset.max === '');
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setDraftMinPrice('');
                      setDraftMaxPrice(preset.max);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer min-h-[40px] ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isActive && <Check className="w-3 h-3 text-emerald-200" />}
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Custom Price Range */}
          <div className="flex flex-col gap-2 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">
                Custom Price Range (₹)
              </span>
              {(draftMinPrice || draftMaxPrice) && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftMinPrice('');
                    setDraftMaxPrice('');
                  }}
                  className="text-[11px] text-slate-500 hover:text-rose-600 font-semibold cursor-pointer min-h-[32px] px-1"
                >
                  Clear Price
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Min Price</label>
                <input
                  type="number"
                  placeholder="₹ Min"
                  value={draftMinPrice}
                  onChange={(e) => setDraftMinPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Max Price</label>
                <input
                  type="number"
                  placeholder="₹ Max"
                  value={draftMaxPrice}
                  onChange={(e) => setDraftMaxPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* 5. Recent Search History */}
          <div className="pt-4">
            <SearchHistoryComponent
              onSelectTerm={(term) => {
                onSelectHistoryItem(term);
                onClose();
              }}
              refreshTrigger={historyTrigger}
            />
          </div>

        </div>

        {/* Drawer Sticky Footer with Show Results Action */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/90 backdrop-blur-xs flex items-center gap-2 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          {hasDraftFilters && (
            <button
              type="button"
              id="btn-mobile-drawer-clear"
              onClick={handleResetDraft}
              className="px-4 py-3 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition-colors cursor-pointer min-h-[44px]"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            id="btn-mobile-drawer-apply"
            onClick={handleApplyCommit}
            className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            <span>Show Results</span>
          </button>
        </div>

      </div>
    </div>
  );
}
