import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPriceAlerts, deletePriceAlert } from '../services/api';
import { PriceAlert } from '../types/frontend';
import { formatINR } from '../utils/currency';
import { Sparkline } from '../components/Sparkline';
import { BellRing, Trash2, ArrowRight, Activity, ExternalLink, CheckCircle, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

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

const PriceAlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    loadAlerts(true);
    const handleAlertsUpdate = () => {
      fetchPriceAlerts().then(setAlerts).catch(() => {});
    };
    window.addEventListener('alerts-updated', handleAlertsUpdate);
    return () => {
      window.removeEventListener('alerts-updated', handleAlertsUpdate);
    };
  }, []);

  const loadAlerts = async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const data = await fetchPriceAlerts();
      setAlerts(data);
      window.dispatchEvent(new Event('alerts-updated'));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch your price alerts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDelete = async (alertId: number) => {
    if (deletingId !== null) return;
    setDeletingId(alertId);
    setError(null);
    try {
      await deletePriceAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.alert_id !== alertId));
      window.dispatchEvent(new Event('alerts-updated'));
    } catch (err: any) {
      setError(err?.message || 'Failed to remove price alert. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center p-8">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium text-slate-500">Loading your price alerts...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-4 sm:gap-6 w-full max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BellRing className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0" />
            <span>Price Alerts</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">We'll email you when these hit your target.</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            id="btn-create-price-alert"
            to="/products"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all shrink-0 min-h-[44px]"
            title="Create a new price alert from Search Gadgets"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Create Price Alert</span>
          </Link>

          <button
            id="btn-refresh-alerts"
            type="button"
            onClick={() => loadAlerts(false)}
            disabled={refreshing || loading}
            className="cursor-pointer bg-white border border-slate-200 hover:bg-slate-50 p-2.5 rounded-xl transition-all shadow-xs shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-60"
            title="Refresh Price Alerts"
            aria-label="Refresh Price Alerts"
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
            onClick={() => loadAlerts(true)}
            className="text-xs font-semibold text-rose-800 underline hover:no-underline ml-2 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Alert Listing / Empty State */}
      {alerts.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 sm:p-12 text-center shadow-xs max-w-lg mx-auto w-full my-4 sm:my-6 flex flex-col items-center">
          <div className="h-14 w-14 sm:h-16 sm:w-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mb-4 text-indigo-600 shadow-xs">
            <BellRing className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-1.5">No price alerts yet.</h2>
          <p className="text-slate-500 max-w-sm mx-auto mb-6 text-xs sm:text-sm leading-relaxed">
            Find a product and set a target price to receive an email notification when the price drops to your target.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors gap-2 text-xs sm:text-sm shadow-xs min-h-[44px]"
          >
            <span>Search Gadgets</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {alerts.map((alert: PriceAlert) => {
            const currentPrice = alert.lowest_live_price !== undefined && alert.lowest_live_price !== null
              ? parseFloat(String(alert.lowest_live_price))
              : null;
            const target = parseFloat(String(alert.target_price));
            const distance = currentPrice !== null && !isNaN(currentPrice) ? currentPrice - target : null;
            
            let statusLabel = 'Active';
            let statusColor = 'bg-blue-100 text-blue-700 border border-blue-200';
            if (alert.alert_sent) {
              statusLabel = 'Triggered';
              statusColor = 'bg-emerald-100 text-emerald-700 border border-emerald-200';
            } else if (!alert.is_active) {
              statusLabel = 'Disabled';
              statusColor = 'bg-slate-100 text-slate-600 border border-slate-200';
            } else if (distance !== null && distance <= 0) {
              statusLabel = 'Target Reached!';
              statusColor = 'bg-emerald-100 text-emerald-700 border border-emerald-200';
            }

            const hasValidRetailerUrl = isValidHttpUrl(alert.product_url);
            const isDeleting = deletingId === alert.alert_id;

            return (
              <div 
                key={alert.alert_id} 
                id={`alert-card-${alert.alert_id}`}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-xs hover:shadow-md transition-shadow"
              >
                {/* Product Info Section */}
                <div className="flex items-start p-3.5 sm:p-5 gap-3 sm:gap-4">
                  {/* Product Image: Internal link to Product Details */}
                  <Link 
                    to={`/products/${alert.product_id}`}
                    className="block w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 rounded-xl p-2 shrink-0 border border-slate-100 cursor-pointer overflow-hidden group"
                    title={`View details for ${alert.product_name}`}
                    aria-label={`View details for ${alert.product_name}`}
                  >
                    <img 
                      referrerPolicy="no-referrer"
                      src={alert.image_url || FALLBACK_IMAGE} 
                      alt={alert.product_name}
                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                      className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
                    />
                  </Link>

                  {/* Details Header */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                        {alert.brand || 'GADGET'}
                      </span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shrink-0 ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>

                    {/* Product Title: Internal link to Product Details */}
                    <Link 
                      to={`/products/${alert.product_id}`} 
                      className="block mb-1.5 group/title focus:outline-none" 
                      title={`View details for ${alert.product_name}`}
                    >
                      <h3 className="font-semibold text-slate-900 text-xs sm:text-sm line-clamp-2 leading-snug group-hover/title:text-indigo-600 group-hover/title:underline transition-colors break-words">
                        {alert.product_name}
                      </h3>
                    </Link>

                    {/* Alert Date & Trend */}
                    <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap mt-1">
                      <p className="text-[10px] sm:text-xs text-slate-400 whitespace-nowrap">
                        Set on {format(new Date(alert.created_at), 'MMM dd, yyyy')}
                      </p>
                      <div className="shrink-0">
                        <Sparkline history={alert.price_history} width={56} height={20} />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Price & Status Footer */}
                <div className="bg-slate-50/80 border-t border-slate-150 p-3.5 sm:p-4 mt-auto">
                  <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-3">
                    <div className="min-w-0">
                      <span className="text-[10px] sm:text-xs font-medium text-slate-500 block mb-0.5 truncate">
                        Target Price
                      </span>
                      <span className="text-sm sm:text-base lg:text-lg font-bold text-slate-900 truncate block">
                        {formatINR(target)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] sm:text-xs font-medium text-slate-500 block mb-0.5 truncate">
                        Current Price
                      </span>
                      <span className={`text-sm sm:text-base lg:text-lg font-bold truncate block ${
                        currentPrice !== null && distance !== null && distance <= 0 ? 'text-emerald-600' : 'text-slate-700'
                      }`}>
                        {currentPrice !== null ? formatINR(currentPrice) : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Dynamic Status / Distance Message */}
                  {currentPrice !== null && distance !== null && distance > 0 && !alert.alert_sent && (
                    <div className="mb-3 text-[11px] sm:text-xs font-medium text-slate-600 flex items-center gap-1.5 truncate">
                      <Activity className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">{formatINR(distance)} above target</span>
                    </div>
                  )}

                  {currentPrice !== null && distance !== null && distance <= 0 && !alert.alert_sent && (
                    <div className="mb-3 text-[11px] sm:text-xs font-medium text-emerald-700 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1.5 rounded-lg">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">Target reached! ({formatINR(Math.abs(distance))} below target)</span>
                    </div>
                  )}
                  
                  {alert.alert_sent && (
                    <div className="mb-3 text-[11px] sm:text-xs font-medium text-emerald-700 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1.5 rounded-lg">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Notification emailed!</span>
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="flex items-center justify-between gap-2.5 pt-1">
                    {/* Delete Action (Touch target >= 44px) */}
                    <button
                      id={`btn-del-alert-${alert.alert_id}`}
                      type="button"
                      onClick={() => handleDelete(alert.alert_id)}
                      disabled={isDeleting}
                      className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 bg-white border border-slate-200 hover:border-rose-200 p-2.5 rounded-xl transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 disabled:opacity-50"
                      title={`Delete alert for ${alert.product_name}`}
                      aria-label={`Delete alert for ${alert.product_name}`}
                    >
                      {isDeleting ? (
                        <span className="h-4 w-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>

                    {/* View Deal ↗ External Retailer Link */}
                    {hasValidRetailerUrl ? (
                      <a
                        id={`btn-view-deal-${alert.alert_id}`}
                        href={alert.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-700 active:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-150 border border-indigo-150 px-3.5 sm:px-4 py-2 rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer shrink-0"
                        title={`Open deal for ${alert.product_name} at ${alert.purchase_outlet || 'partner store'}`}
                        aria-label={`Open deal for ${alert.product_name} at ${alert.purchase_outlet || 'partner store'}`}
                      >
                        <span>View Deal</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="text-xs sm:text-sm font-medium text-slate-400 bg-slate-100 border border-slate-200 px-3.5 sm:px-4 py-2 rounded-xl inline-flex items-center justify-center gap-1.5 min-h-[44px] cursor-not-allowed opacity-60 shrink-0"
                        title="Retailer link unavailable"
                        aria-label="Retailer link unavailable"
                      >
                        <span>View Deal</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </button>
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
};

export default PriceAlertsPage;
