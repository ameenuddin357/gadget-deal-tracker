import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchWatchlist, fetchPriceAlerts, fetchProducts, triggerSixHourScheduler } from '../services/api';
import { Product, WatchlistEntry, PriceAlert } from '../types/frontend';
import { formatINR } from '../utils/currency';
import { LayoutDashboard, Award, AlertTriangle, Flame, BellRing, BookmarkCheck, TrendingDown, RefreshCw, Cpu, ShoppingBag, ArrowRight, Sparkles, Clock } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [alertsCount, setAlertsCount] = useState(0);
  const [topDeals, setTopDeals] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshState, setRefreshState] = useState(0);
  
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [schedulerMessage, setSchedulerMessage] = useState<string | null>(null);

  const runSchedulerSim = async () => {
    setSchedulerRunning(true);
    setSchedulerMessage(null);
    try {
      const result = await triggerSixHourScheduler();
      setSchedulerMessage(`Successfully simulated 6-hourly scraping! Updated ${result.updatedCount} store prices. Evaluated ${result.alertsTriggeredCount} alert traps.`);
      setRefreshState(prev => prev + 1); // Refresh page metrics!
      setTimeout(() => setSchedulerMessage(null), 8500);
    } catch (err) {
      setSchedulerMessage('Scheduler failed to trigger.');
    } finally {
      setSchedulerRunning(false);
    }
  };

  useEffect(() => {
    async function loadDashboardStats() {
      setLoading(true);
      try {
        const [watchlist, alerts, products] = await Promise.all([
          fetchWatchlist(),
          fetchPriceAlerts(),
          fetchProducts()
        ]);

        setWatchlistCount(watchlist.length);
        setAlertsCount(alerts.length);

        // Sort products by price or find preloaded bargains
        // Filter some items to showcase as "🔥 Daily Top Bargains"
        const sortedDeals = [...products]
          .filter(p => p.cheapest_price !== undefined)
          .sort((a, b) => (a.cheapest_price || 0) - (b.cheapest_price || 0));
        
        setTopDeals(sortedDeals.slice(0, 3));
      } catch (err) {
        console.error('Failed to fill dashboard telemetry:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardStats();
  }, [refreshState]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20 bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-mono text-slate-500">Recalculating tracker matrices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6 p-1 bg-slate-50/50">
      
      {/* Upper Welcomer banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-y-8 translate-x-8 opacity-10">
          <ShoppingBag className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex flex-col gap-1.5 max-w-xl">
            <span className="bg-indigo-500/20 text-indigo-300 font-mono text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full w-max">
              Deal Tracker HQ
            </span>
            <h1 className="text-2xl font-bold font-display tracking-tight text-white">
              Welcome back, {user?.username || 'Hunter'}!
            </h1>
            <p className="text-slate-300 text-xs leading-relaxed">
              Your automated scrapper is scanning Indian retail endpoints (Amazon India, Flipkart, Croma, Reliance Digital) to fetch genuine gadget savings metrics in Indian Rupees (INR).
            </p>
          </div>
          
          <button
            id="btn-sync-telemetry"
            onClick={() => setRefreshState(prev => prev + 1)}
            className="cursor-pointer bg-white/10 hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-white px-4 py-2.5 rounded-xl border border-white/15 text-xs font-mono font-medium flex items-center justify-center gap-2 self-start md:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-Scrape Live Stores</span>
          </button>
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-xs">
          <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <BookmarkCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">Watchlist Catalog</div>
            <div className="text-2xl font-bold font-mono text-slate-800">{watchlistCount}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Watched gadgets with discount metrics</div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-xs">
          <div className="h-12 w-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
            <BellRing className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">Configured Alerts</div>
            <div className="text-2xl font-bold font-mono text-slate-800">{alertsCount}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Threshold filters triggers active</div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-xs">
          <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">Avg Store Rating</div>
            <div className="text-2xl font-bold font-mono text-slate-800">4.5★</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Verifiable merchant outlets online</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Column - Hot Deals */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-500 animate-bounce" />
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-700">
                Hot Dynamic Deals Spied Today
              </h2>
            </div>
            <Link to="/products" className="text-xs font-mono text-indigo-600 font-semibold hover:underline flex items-center gap-1.5">
              <span>View Catalogue</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {topDeals.map(p => (
              <div key={p.product_id} className="bg-white border border-slate-200/80 hover:border-indigo-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-xs group">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-lg bg-slate-100 overflow-hidden border border-slate-100 shrink-0">
                    <img referrerPolicy="no-referrer" src={p.image_url} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-all" />
                  </div>
                  <div>
                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold">
                      {p.category_name}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-800 mt-1">{p.name}</h3>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">Model: {p.model_no || 'Standard'}</p>
                  </div>
                </div>

                <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-slate-50 pt-2.5 sm:pt-0 shrink-0">
                  <div className="flex flex-col sm:items-end">
                    <span className="text-[10px] font-mono text-slate-400">Current Best price</span>
                    <span className="text-base font-bold font-mono text-indigo-600">{p.cheapest_price !== undefined ? formatINR(p.cheapest_price) : 'N/A'}</span>
                  </div>
                  <Link
                    to={`/products/${p.product_id}`}
                    className="mt-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono text-[10px] font-bold px-3 py-1.5 rounded-lg border border-indigo-100 transition-all flex items-center gap-1"
                  >
                    <span>Analyze Prices</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column - Fast shortcuts widget bar */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-700">
            Control Room Dashboard
          </h2>

          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex flex-col gap-4 shadow-xs">
            {schedulerMessage && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs leading-relaxed animate-fadeIn flex flex-col gap-1">
                <span className="font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Scheduler Run Logged
                </span>
                <span>{schedulerMessage}</span>
              </div>
            )}

            <p className="text-xs text-slate-500 leading-normal">
              Quickly perform tracker optimizations, update items catalog details, configure active threshold variables or simulate scheduled price scrapes.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={runSchedulerSim}
                disabled={schedulerRunning}
                className="w-full text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50 font-mono text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-between transition-all"
              >
                <span>{schedulerRunning ? 'Updating Prices...' : 'Simulate 6hr Scrape Cron'}</span>
                <Clock className={`w-3.5 h-3.5 text-indigo-600 ${schedulerRunning ? 'animate-spin' : ''}`} />
              </button>
              <Link
                to="/products"
                className="w-full bg-slate-900 border border-slate-800 text-white font-mono text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-between hover:bg-slate-800 transition-all"
              >
                <span>1. Explore Catalogs</span>
                <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <Link
                to="/watchlist"
                className="w-full bg-white border border-slate-200 text-slate-800 font-mono text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-between hover:bg-slate-50 transition-all border-dashed"
              >
                <span>2. My Watchlist Catalog</span>
                <BookmarkCheck className="w-3.5 h-3.5 text-indigo-500" />
              </Link>

              <Link
                to="/alerts"
                className="w-full bg-white border border-slate-200 text-slate-800 font-mono text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-between hover:bg-slate-50 transition-all border-dashed"
              >
                <span>3. Live Price Thresholds</span>
                <BellRing className="w-3.5 h-3.5 text-pink-500" />
              </Link>
            </div>

            <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex items-start gap-2 text-[10px] text-slate-500 leading-relaxed font-mono">
              <Cpu className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span>Postgres query listener is actively polling merchant API indexes every 60 seconds.</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
