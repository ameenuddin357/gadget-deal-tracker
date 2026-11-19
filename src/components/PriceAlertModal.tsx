import React, { useState, useEffect } from 'react';
import { PriceAlert, Product } from '../types/frontend';
import { formatINR, validatePriceAlertTarget } from '../utils/currency';
import { createPriceAlert, updatePriceAlert, deletePriceAlert } from '../services/api';
import { BellRing, X, AlertCircle, CheckCircle2, Trash2, ArrowDownRight } from 'lucide-react';

interface PriceAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  existingAlert?: PriceAlert | null;
  onAlertSaved?: () => void;
}

export default function PriceAlertModal({
  isOpen,
  onClose,
  product,
  existingAlert,
  onAlertSaved,
}: PriceAlertModalProps) {
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize or reset target price when modal opens
  useEffect(() => {
    if (isOpen && product) {
      setError(null);
      setSuccessMessage(null);
      if (existingAlert && existingAlert.target_price) {
        setTargetPrice(String(existingAlert.target_price));
      } else if (product.cheapest_price) {
        // Suggested default 10% discount
        const suggested = Math.round(product.cheapest_price * 0.9);
        setTargetPrice(String(suggested));
      } else {
        setTargetPrice('');
      }
    }
  }, [isOpen, product, existingAlert]);

  if (!isOpen || !product) return null;

  const currentPrice = product.cheapest_price || 0;

  const handleApplyPreset = (pct: number) => {
    if (!currentPrice) return;
    const target = Math.round(currentPrice * (1 - pct / 100));
    setTargetPrice(String(target));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    setError(null);
    setSuccessMessage(null);

    const validation = validatePriceAlertTarget(targetPrice, currentPrice);
    if (!validation.isValid) {
      setError(validation.error || 'Please enter a valid target price.');
      return;
    }

    const targetVal = parseFloat(targetPrice);
    setLoading(true);

    try {
      if (existingAlert && existingAlert.alert_id) {
        await updatePriceAlert(existingAlert.alert_id, targetVal);
      } else {
        await createPriceAlert(product.product_id, targetVal);
      }

      window.dispatchEvent(new Event('alerts-updated'));
      setSuccessMessage(`Alert active! We will notify you when price drops to ${formatINR(targetVal)}.`);
      onAlertSaved?.();
      
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to save price alert. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingAlert || !existingAlert.alert_id) return;
    setLoading(true);
    setError(null);
    try {
      await deletePriceAlert(existingAlert.alert_id);
      window.dispatchEvent(new Event('alerts-updated'));
      setSuccessMessage('Price alert removed successfully.');
      onAlertSaved?.();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete alert.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-alert-modal-title"
    >
      <div 
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <h2 id="price-alert-modal-title" className="text-base font-bold text-slate-900 tracking-tight">
                {existingAlert ? 'Manage Price Alert' : 'Set Price Alert'}
              </h2>
              <p className="text-[11px] text-slate-500">
                Get notified when this item reaches your budget.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Snippet */}
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <div className="w-14 h-14 bg-white rounded-lg p-1 border border-slate-200 flex items-center justify-center shrink-0">
            <img
              referrerPolicy="no-referrer"
              src={product.image_url}
              alt={product.name}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">
              {product.brand}
            </span>
            <h4 className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug">
              {product.name}
            </h4>
            <div className="text-xs font-bold text-slate-900 mt-0.5">
              Current Best:{' '}
              <span className="text-indigo-600">{currentPrice ? formatINR(currentPrice) : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Existing Alert Notice */}
        {existingAlert && (
          <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
            <BellRing className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Active alert currently set at <strong className="font-bold">{formatINR(existingAlert.target_price)}</strong>
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="target-price-input" className="text-xs font-bold text-slate-700">
              Target Price (INR)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-slate-400 font-bold text-sm">₹</span>
              <input
                id="target-price-input"
                type="number"
                value={targetPrice}
                onChange={(e) => {
                  setTargetPrice(e.target.value);
                  setError(null);
                }}
                placeholder={currentPrice ? String(Math.round(currentPrice * 0.9)) : '40000'}
                className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                autoFocus
              />
            </div>
          </div>

          {/* Quick Target Presets */}
          {currentPrice > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Quick Discount Targets:
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {[5, 10, 15, 20].map((pct) => {
                  const targetVal = Math.round(currentPrice * (1 - pct / 100));
                  const isSelected = targetPrice === String(targetVal);
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleApplyPreset(pct)}
                      className={`py-1.5 px-1 rounded-lg text-center text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="block text-[10px] text-slate-400 font-normal">-{pct}%</span>
                      <span className="block text-[11px] font-bold">₹{Math.round(targetVal / 1000)}k</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error / Success Feedback */}
          {error && (
            <div className="flex items-start gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2.5 pt-2">
            {existingAlert && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer min-h-[42px]"
                title="Delete this alert"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer min-h-[42px]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || Boolean(successMessage)}
              className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition-all shadow-xs cursor-pointer min-h-[42px] flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : existingAlert ? (
                'Update Alert'
              ) : (
                'Create Alert'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
