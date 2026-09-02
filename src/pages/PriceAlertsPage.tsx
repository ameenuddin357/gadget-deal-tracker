import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPriceAlerts, deletePriceAlert } from '../services/api';
import { PriceAlert } from '../types/frontend';
import { formatINR } from '../utils/currency';
import { Sparkline } from '../components/Sparkline';
import { BellRing, Trash2, ArrowRight, Activity, ExternalLink, CheckCircle, Plus } from 'lucide-react';
import { format } from 'date-fns';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400";

const PriceAlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await fetchPriceAlerts();
      setAlerts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch your price alerts.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (alertId: number) => {
    if (!window.confirm('Are you sure you want to remove this alert?')) return;
    try {
      await deletePriceAlert(alertId);
      setAlerts(alerts.filter((a) => a.alert_id !== alertId));
    } catch (err: any) {
      alert(err.message || 'Failed to remove alert');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium text-slate-500">Loading your alerts...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:h-20 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BellRing className="w-6 h-6 text-indigo-600 shrink-0" />
              Price Alerts
            </h1>
            <p className="text-sm text-slate-500">We'll email you when these hit your target.</p>
          </div>

          <Link
            to="/products"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Price Alert</span>
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-600 p-4 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {alerts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm max-w-lg mx-auto">
            <BellRing className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">No price alerts yet.</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-8 text-sm leading-relaxed">
              Find a product and set a target price to receive an email when the price reaches your target.
            </p>
            <Link
              to="/products"
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors gap-2 text-sm shadow-xs"
            >
              Browse Tech Catalogue
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {alerts.map((alert: any) => {
              const currentPrice = alert.lowest_live_price ? parseFloat(alert.lowest_live_price) : null;
              const target = parseFloat(alert.target_price);
              const distance = currentPrice ? currentPrice - target : null;
              
              let statusLabel = 'Active';
              let statusColor = 'bg-blue-100 text-blue-700';
              if (alert.alert_sent) {
                statusLabel = 'Triggered';
                statusColor = 'bg-emerald-100 text-emerald-700';
              } else if (!alert.is_active) {
                statusLabel = 'Disabled';
                statusColor = 'bg-slate-100 text-slate-700';
              } else if (distance && distance <= 0) {
                statusLabel = 'Target Reached!';
                statusColor = 'bg-emerald-100 text-emerald-700';
              }

              return (
                <div key={alert.alert_id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start p-5 gap-4">
                    <Link 
                      to={`/products/${alert.product_id}`}
                      className="block w-20 h-20 bg-slate-50 rounded-xl p-2 shrink-0 border border-slate-100 cursor-pointer overflow-hidden"
                      title={`View details for ${alert.product_name}`}
                    >
                      <img 
                        referrerPolicy="no-referrer"
                        src={alert.image_url || FALLBACK_IMAGE} 
                        alt={alert.product_name}
                        onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                        className="w-full h-full object-contain mix-blend-multiply hover:scale-105 transition-transform duration-300"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-medium text-slate-500">{alert.brand}</span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <Link to={`/products/${alert.product_id}`} className="font-semibold text-slate-900 text-sm line-clamp-2 hover:text-indigo-600 hover:underline transition-colors mb-2" title={`View details for ${alert.product_name}`}>
                        {alert.product_name}
                      </Link>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-slate-400">
                          Set on {format(new Date(alert.created_at), 'MMM dd, yyyy')}
                        </p>
                        <Sparkline history={alert.price_history} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 border-t border-slate-100 p-4 mt-auto">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <span className="text-xs font-medium text-slate-500 block mb-1">Target Price</span>
                        <span className="text-lg font-bold text-slate-900">{formatINR(target)}</span>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-slate-500 block mb-1">Current Price</span>
                        <span className={`text-lg font-bold ${distance && distance <= 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {currentPrice ? formatINR(currentPrice) : 'Unavailable'}
                        </span>
                      </div>
                    </div>
                    
                    {currentPrice && distance !== null && distance > 0 && !alert.alert_sent && (
                      <div className="mb-4 text-xs font-medium text-slate-500 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" />
                        <span>{formatINR(distance)} above target</span>
                      </div>
                    )}
                    
                    {alert.alert_sent && (
                      <div className="mb-4 text-xs font-medium text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-2 py-1.5 rounded">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Notification emailed!</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 pt-2">
                      <button
                        onClick={() => handleDelete(alert.alert_id)}
                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                        title="Delete Alert"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <Link
                        to={`/products/${alert.product_id}`}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors flex items-center gap-1"
                      >
                        View Deal <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceAlertsPage;
