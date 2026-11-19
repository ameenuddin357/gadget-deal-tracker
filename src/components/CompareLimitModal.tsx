import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, X, ArrowRight, ArrowRightLeft, ArrowLeft, RefreshCw, Check } from 'lucide-react';
import { Product } from '../types/frontend';
import { MAX_COMPARE_PRODUCTS, getCompareProductIds, replaceCompareProduct } from '../utils/compare';
import { fetchProductDetails } from '../services/api';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=200';

interface CompareLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingProduct?: Product | null;
  currentCount?: number;
  onReplaceSuccess?: (updatedIds: number[]) => void;
}

export default function CompareLimitModal({
  isOpen,
  onClose,
  pendingProduct,
  currentCount = MAX_COMPARE_PRODUCTS,
  onReplaceSuccess,
}: CompareLimitModalProps) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'menu' | 'replace'>('menu');
  const [comparedProducts, setComparedProducts] = useState<Product[]>([]);
  const [loadingCompared, setLoadingCompared] = useState<boolean>(false);
  const [replacingId, setReplacingId] = useState<number | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset view state whenever modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setViewMode('menu');
      setReplacingId(null);
      setErrorMessage(null);
      return;
    }

    const ids = getCompareProductIds();
    if (ids.length === 0) {
      setComparedProducts([]);
      return;
    }

    let isMounted = true;
    setLoadingCompared(true);

    // Fetch details for currently selected products so names and thumbnails are ready
    Promise.all(
      ids.map(id =>
        fetchProductDetails(id)
          .then(res => res?.product || null)
          .catch(() => null)
      )
    )
      .then(results => {
        if (isMounted) {
          const valid = results.filter(Boolean) as Product[];
          // If some failed, fallback with stub ID items so all IDs can still be replaced
          const existingIds = new Set(valid.map(p => p.product_id));
          ids.forEach(id => {
            if (!existingIds.has(id)) {
              valid.push({
                product_id: id,
                name: `Product #${id}`,
                brand: 'Device',
                slug: `product-${id}`,
                image_url: FALLBACK_IMAGE,
                specs_summary: '',
                category_name: 'Electronics'
              });
            }
          });
          setComparedProducts(valid);
          setLoadingCompared(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoadingCompared(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Close on Escape key
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

  const handleGoToReview = () => {
    onClose();
    navigate('/compare', {
      state: {
        pendingCompareProduct: pendingProduct || null,
        pendingProduct: pendingProduct || null
      }
    });
  };

  const handleExecuteReplace = (oldProduct: Product) => {
    if (!pendingProduct) return;
    setReplacingId(oldProduct.product_id);
    setErrorMessage(null);

    try {
      const result = replaceCompareProduct(oldProduct.product_id, pendingProduct.product_id);
      if (result.success) {
        // Dispatch custom replacement event for toast feedback with dynamic old and new product names
        window.dispatchEvent(
          new CustomEvent('deal-compare-replaced', {
            detail: {
              oldProductName: oldProduct.name || `Product #${oldProduct.product_id}`,
              newProductName: pendingProduct.name || `Product #${pendingProduct.product_id}`,
              oldProductId: oldProduct.product_id,
              newProductId: pendingProduct.product_id
            }
          })
        );

        if (onReplaceSuccess) {
          onReplaceSuccess(result.ids);
        }
        onClose();
      } else {
        setErrorMessage('Failed to replace product in comparison. Please try again.');
      }
    } catch (err) {
      console.error('Failed to replace compare product', err);
      setErrorMessage('An unexpected error occurred while replacing product.');
    } finally {
      setReplacingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-limit-modal-title"
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom duration-300 border border-slate-100 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* VIEW 1: Main Menu View */}
        {viewMode === 'menu' && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                  <Scale className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 id="compare-limit-modal-title" className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                    Compare list is full
                  </h2>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 mt-0.5">
                    Maximum capacity reached ({currentCount}/{MAX_COMPARE_PRODUCTS})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Informative Text */}
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              You can compare up to <strong className="text-slate-900 font-bold">{MAX_COMPARE_PRODUCTS} products</strong> at a time.
            </p>

            {/* Target Pending Product Preview */}
            {pendingProduct && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center gap-3">
                <img
                  src={pendingProduct.image_url || FALLBACK_IMAGE}
                  alt={pendingProduct.name}
                  className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200 p-1 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">To add:</div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 truncate" title={pendingProduct.name}>
                    {pendingProduct.name}
                  </div>
                  {pendingProduct.brand && (
                    <div className="text-[11px] text-slate-500 truncate">{pendingProduct.brand}</div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100">
              {pendingProduct && (
                <button
                  type="button"
                  onClick={() => setViewMode('replace')}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition-all shadow-xs cursor-pointer min-h-[44px] flex items-center justify-center gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Replace a Product</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleGoToReview}
                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer min-h-[44px] flex items-center justify-center gap-2"
              >
                <Scale className="w-4 h-4 text-slate-600" />
                <span>Review Comparison</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 text-slate-500 hover:text-slate-800 font-medium rounded-xl text-xs sm:text-sm transition-colors cursor-pointer min-h-[40px]"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* VIEW 2: Replace a Product Selection View */}
        {viewMode === 'replace' && (
          <>
            {/* Replace View Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => setViewMode('menu')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 min-h-[36px]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* New Pending Item Banner */}
            {pendingProduct && (
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 flex items-center gap-3">
                <img
                  src={pendingProduct.image_url || FALLBACK_IMAGE}
                  alt={pendingProduct.name}
                  className="w-10 h-10 rounded-lg object-contain bg-white border border-indigo-100 p-1 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Adding:</div>
                  <div className="text-xs sm:text-sm font-bold text-indigo-950 truncate" title={pendingProduct.name}>
                    {pendingProduct.name}
                  </div>
                </div>
              </div>
            )}

            {/* Error Banner if replacement fails */}
            {errorMessage && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 flex items-center gap-2">
                <span className="font-semibold">{errorMessage}</span>
              </div>
            )}

            {/* Prompt */}
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                Choose one product to replace:
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                The selected product will be replaced with <span className="font-semibold text-slate-700">{pendingProduct?.name || 'the new product'}</span>.
              </p>
            </div>

            {/* List of 4 Currently Compared Products */}
            <div className="flex flex-col gap-2 max-h-[42vh] overflow-y-auto pr-0.5">
              {loadingCompared && comparedProducts.length === 0 ? (
                <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                  <span className="text-xs">Loading compared items...</span>
                </div>
              ) : (
                comparedProducts.map((p) => {
                  const isCurrentReplacing = replacingId === p.product_id;
                  return (
                    <div
                      key={p.product_id}
                      className="flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <img
                          src={p.image_url || FALLBACK_IMAGE}
                          alt={p.name}
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg object-contain bg-slate-50 border border-slate-100 p-1 shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-semibold text-slate-900 line-clamp-2 leading-tight" title={p.name}>
                            {p.name}
                          </div>
                          {p.brand && (
                            <div className="text-[10px] text-slate-500 truncate mt-0.5">{p.brand}</div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleExecuteReplace(p)}
                        disabled={isCurrentReplacing}
                        className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[44px] min-w-[76px] flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                      >
                        {isCurrentReplacing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>Replace</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer / Cancel */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setViewMode('menu')}
                className="py-2.5 px-4 text-slate-600 hover:text-slate-900 font-medium rounded-xl text-xs sm:text-sm transition-colors cursor-pointer min-h-[40px]"
              >
                Back to Options
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer min-h-[40px]"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
