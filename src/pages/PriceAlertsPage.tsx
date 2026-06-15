import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPriceAlerts, removePriceAlert } from '../services/api';
import { PriceAlert } from '../types/frontend';
import { formatINR } from '../utils/currency';
import { BellRing, Trash2, ArrowRight, TrendingDown, RefreshCw, AlertCircle, BellOff, Hourglass, Sparkles } from 'lucide-react';

export default function PriceAlertsPage() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

  async function loadAlerts() {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchPriceAlerts();
      setAlerts(items);
    } catch (err: any) {
      setError("Unable to map price triggers coordinates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleDelete = async (alertId: number) => {
    setIsDeletingId(alertId);
    try {
      await removePriceAlert(alertId);
      setAlerts(prev => prev.filter(item => item.alert_id !== alertId));
    } catch (err) {
      setError("Failed to delete alert threshold filter.");
    } finally {
      setIsDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-mono text-slate-500">Querying trigger coordinates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6">
      
      {/* Title Subheader bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-800 tracking-tight">
            Live Price Threshold Triggers
          </h1>
          <p className="text-xs text-slate-500">
            Automated alerts matching user target limits against current scraped store values.
          </p>
        </div>

        <button
          id="btn-sync-alerts"
          onClick={loadAlerts}
          className="cursor-pointer bg-white border border-slate-200 hover:bg-slate-50 p-2 rounded-xl transition-all shadow-xs"
          title="Force-Poll Triggers"
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

      {/* Primary Alert card collection */}
      {alerts.length === 0 ? (
        <div className="bg-white border border-slate-200/80 p-12 rounded-2xl text-center flex flex-col items-center gap-4 shadow-xs">
          <div className="h-14 w-14 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-center">
            <BellRing className="w-6 h-6 text-slate-400" />
          </div>
          <div className="flex flex-col gap-1 max-w-sm">
            <h3 className="text-sm font-bold text-slate-700">No Custom Alerts Programmed</h3>
            <p className="text-xs text-slate-500 leading-normal">
              You haven't set any gadget discount alerts yet. We can track specific price thresholds and trigger immediate signals.
            </p>
          </div>
          <Link
            to="/products"
            className="mt-2 bg-indigo-600 hover:bg-indigo-700 font-mono text-xs font-semibold py-2.5 px-5 rounded-xl text-white shadow-xs flex items-center gap-1.5 transition-all"
          >
            <span>Set Product Tracker Alert</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {alerts.map(item => {
            // Determine if the live lowest price is equal to or less than the user's targeted price
            const isPriceMet = item.lowest_live_price !== undefined && item.lowest_live_price <= item.target_price;

            return (
              <div
                key={item.alert_id}
                className={`bg-white border hover:shadow-xs rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all ${
                  isPriceMet ? 'border-emerald-300 bg-emerald-50/5' : 'border-slate-200/80 hover:border-indigo-200'
                }`}
              >
                
                {/* Product Name Thumb */}
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl bg-slate-50 overflow-hidden border border-slate-100 shrink-0">
                    <img referrerPolicy="no-referrer" src={item.image_url} alt={item.product_name} className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">{item.brand} catalog</span>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-1">
                      {item.product_name}
                    </h3>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      Target Ceiling limit: <span className="font-semibold text-slate-700">{formatINR(item.target_price)}</span>
                    </div>
                  </div>
                </div>

                {/* Status Trigger, Current Best, Delete Button Group */}
                <div className="flex flex-row items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-slate-50 pt-3 md:pt-0">
                  
                  {/* Current merchant status */}
                  <div className="flex flex-col md:items-end">
                    <span className="text-[9px] font-mono text-slate-400 uppercase">Live Pricing Today</span>
                    <span className="text-xs sm:text-sm font-sans font-bold text-slate-800">
                      {item.lowest_live_price !== undefined ? formatINR(item.lowest_live_price) : 'Scraping...'}
                    </span>
                  </div>

                  {/* Status Indicator pill */}
                  <div>
                    {isPriceMet ? (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-150 font-mono text-[9px] uppercase font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 animate-pulse">
                        <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>PRICE MET 🔥</span>
                      </span>
                    ) : (
                      <span className="bg-amber-50 text-amber-800 border border-amber-200/80 font-mono text-[9px] uppercase font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                        <Hourglass className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>MONITORING ⏰</span>
                      </span>
                    )}
                  </div>

                  {/* Purger button */}
                  <button
                    id={`btn-del-alert-${item.alert_id}`}
                    onClick={() => handleDelete(item.alert_id)}
                    disabled={isDeletingId === item.alert_id}
                    className="cursor-pointer bg-white border border-slate-150 text-slate-400 hover:text-rose-600 hover:border-rose-100 hover:bg-rose-50/50 p-2 rounded-xl transition-all shadow-xs"
                    title="Purge Alert Trigger"
                  >
                    {isDeletingId === item.alert_id ? (
                      <span className="h-3.5 w-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <BellOff className="w-3.5 h-3.5" />
                    )}
                  </button>

                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
