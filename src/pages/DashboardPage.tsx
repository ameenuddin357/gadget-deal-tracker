import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Tag, TrendingDown, CheckCircle, Search, Bell, Monitor, Smartphone, 
  Laptop, Headphones, BookmarkCheck, BellRing, AlertCircle, RefreshCw, Sparkles, ArrowRight,
  Tablet, Watch
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchWatchlist, fetchPriceAlerts, fetchDashboardStats, fetchDashboardDeals, fetchDashboardDrops } from '../services/api';
import { formatINR, getDiscountInfo } from '../utils/currency';
import { WatchlistEntry, PriceAlert } from '../types/frontend';

interface DashboardStats {
  totalProducts: number;
  totalRetailers: number;
  activeAlerts: number;
}

interface Deal {
  product_id: number;
  name: string;
  brand: string;
  image_url: string;
  price: string;
  original_price: string;
  store_name: string;
  discount_percentage: string;
}

interface PriceDrop {
  product_id: number;
  name: string;
  brand: string;
  image_url: string;
  current_price: string;
  previous_price: string;
  store_name: string;
  drop_percentage: string;
}

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400";

const DashboardPage: React.FC = () => {
  const { user, alertCount } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bestDeals, setBestDeals] = useState<Deal[]>([]);
  const [priceDrops, setPriceDrops] = useState<PriceDrop[]>([]);
  
  const [userWatchlist, setUserWatchlist] = useState<WatchlistEntry[]>([]);
  const [userAlerts, setUserAlerts] = useState<PriceAlert[]>([]);

  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setDashboardError(null);
    try {
      const [statsData, dealsData, dropsData] = await Promise.all([
        fetchDashboardStats().catch(() => null),
        fetchDashboardDeals().catch(() => []),
        fetchDashboardDrops().catch(() => []),
      ]);

      if (statsData) setStats(statsData);
      setBestDeals(dealsData || []);
      setPriceDrops(dropsData || []);
      
      if (!statsData && (!dealsData || dealsData.length === 0) && (!dropsData || dropsData.length === 0)) {
        setDashboardError('Unable to load full dashboard metrics. Please refresh.');
      }
    } catch (error: any) {
      console.error('Failed to load dashboard data', error);
      setDashboardError(error?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (user) {
      const fetchPersonalData = async () => {
        try {
          const wlRes = await fetchWatchlist();
          setUserWatchlist(wlRes.slice(0, 4)); // Get up to 4 recent watchlist items
          
          const alRes = await fetchPriceAlerts();
          setUserAlerts(alRes.slice(0, 4)); // Get up to 4 recent price alerts
        } catch (error: any) {
          if (
            error?.status === 'fail' ||
            error?.statusCode === 401 ||
            error?.message?.toLowerCase()?.includes('token') ||
            error?.message?.toLowerCase()?.includes('logged in') ||
            error?.message?.toLowerCase()?.includes('auth') ||
            error?.message?.toLowerCase()?.includes('sign in')
          ) {
            return;
          }
          console.warn('Failed to fetch personal data', error);
        }
      };
      fetchPersonalData();

      const handleAlertsUpdate = () => fetchPersonalData();
      const handleWatchlistUpdate = () => fetchPersonalData();
      window.addEventListener('alerts-updated', handleAlertsUpdate);
      window.addEventListener('watchlist-updated', handleWatchlistUpdate);
      return () => {
        window.removeEventListener('alerts-updated', handleAlertsUpdate);
        window.removeEventListener('watchlist-updated', handleWatchlistUpdate);
      };
    }
  }, [user]);

  if (loading) {
    return (
      <div className="py-16 sm:py-24 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-9 h-9 sm:w-10 sm:h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-xs sm:text-sm font-semibold text-slate-500">Loading gadget deals & insights...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-4 sm:gap-6 lg:gap-8 font-sans">
      
      {/* Error state banner if API fails */}
      {dashboardError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{dashboardError}</span>
          </div>
          <button 
            onClick={loadDashboardData} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition-colors shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 1. Hero Section */}
      <section className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-5 sm:p-10 lg:p-14 shadow-2xs relative overflow-hidden">
        <div className="max-w-3xl mx-auto flex flex-col items-center text-center">
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] sm:text-xs font-semibold mb-3 sm:mb-4">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Smart Price Comparison</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-2.5 sm:mb-4">
            Track gadget prices.<br className="hidden sm:block" /> Find better deals.
          </h1>
          
          <p className="text-xs sm:text-base lg:text-lg text-slate-500 max-w-xl mx-auto mb-5 sm:mb-8 leading-relaxed">
            Track verified product prices across major retailers, set price alerts, and find better deals.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-4 w-full sm:w-auto">
            <Link 
              to="/products" 
              id="btn-hero-explore-deals"
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-xs sm:text-sm shadow-xs min-h-[44px]"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Explore Deals</span>
            </Link>
            <Link 
              to="/alerts" 
              id="btn-hero-price-alert"
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-xs sm:text-sm min-h-[44px]"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
              <span>Set a Price Alert</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Stats Section - Compact 3-Column Strip */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3 sm:p-6">
        <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
          <div className="px-1 sm:px-4">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 truncate">
              Products
            </p>
            <p className="text-lg sm:text-3xl font-extrabold text-slate-900">
              {stats?.totalProducts ?? 0}
            </p>
          </div>
          <div className="px-1 sm:px-4">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 truncate">
              Retailers
            </p>
            <p className="text-lg sm:text-3xl font-extrabold text-slate-900">
              {stats?.totalRetailers ?? 0}
            </p>
          </div>
          <div className="px-1 sm:px-4">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1 truncate">
              Price Alerts
            </p>
            <p className="text-lg sm:text-3xl font-extrabold text-indigo-600">
              {user ? (alertCount !== undefined ? alertCount : (stats?.activeAlerts ?? 0)) : 0}
            </p>
          </div>
        </div>
      </section>

      {/* 3. AI Deal Advisor Entry Point Banner */}
      <section>
        <div 
          id="card-ai-advisor-banner"
          onClick={() => navigate('/products?ai_advisor=true')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/products?ai_advisor=true');
            }
          }}
          tabIndex={0}
          role="button"
          aria-label="Ask AI Advisor - Choose any product from our catalogue"
          className="bg-slate-900 hover:bg-slate-900/95 border border-slate-800 text-white rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 shadow-sm cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xl sm:text-2xl shrink-0">
              🤖
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-100">AI Deal Advisor</h3>
                <span className="text-[9px] sm:text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  Price Intelligence
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 sm:mt-1 leading-snug">
                Not sure whether to buy or wait? Choose any product from our catalogue to ask the AI Deal Advisor.
              </p>
            </div>
          </div>
          <button
            id="btn-dashboard-ai-advisor"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/products?ai_advisor=true');
            }}
            className="w-full sm:w-auto px-4 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap shadow-xs cursor-pointer focus:outline-none min-h-[38px]"
          >
            <span>🤖 Ask AI Advisor</span>
            <span>&rarr;</span>
          </button>
        </div>
      </section>

      {/* 4. Personalized Section (Watchlist & Alerts) */}
      {user && (userWatchlist.length > 0 || userAlerts.length > 0) && (
        <section className={`grid grid-cols-1 ${userWatchlist.length > 0 && userAlerts.length > 0 ? 'lg:grid-cols-2' : ''} gap-4 sm:gap-6`}>
          {userWatchlist.length > 0 && (
            <div className="bg-white rounded-2xl shadow-2xs border border-slate-200 p-4 sm:p-6 flex flex-col">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  <Link 
                    to="/watchlist" 
                    className="flex items-center gap-2 hover:text-indigo-600 transition-colors cursor-pointer group"
                  >
                    <BookmarkCheck className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 group-hover:scale-105 transition-transform" />
                    <span>Saved Gadgets</span>
                  </Link>
                </h2>
                <Link to="/watchlist" className="text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer">
                  View all &rarr;
                </Link>
              </div>
              
              <div className="flex flex-col gap-2 sm:gap-3 flex-1">
                {userWatchlist.map(item => (
                  <Link 
                    key={item.watchlist_id} 
                    to={`/products/${item.product_id}`} 
                    className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer"
                  >
                    <img 
                      src={item.image_url || FALLBACK_IMAGE} 
                      alt={item.product_name} 
                      referrerPolicy="no-referrer" 
                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                      className="w-10 h-10 sm:w-12 sm:h-12 object-contain mix-blend-multiply bg-white rounded-lg border border-slate-100 p-1 shrink-0" 
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{item.product_name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{item.brand}</p>
                    </div>
                    {item.lowest_live_price && (
                      <span className="font-bold text-slate-900 text-xs sm:text-sm whitespace-nowrap">{formatINR(item.lowest_live_price)}</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
          
          {userAlerts.length > 0 && (
            <div className="bg-white rounded-2xl shadow-2xs border border-slate-200 p-4 sm:p-6 flex flex-col">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  <Link 
                    to="/alerts" 
                    className="flex items-center gap-2 hover:text-rose-600 transition-colors cursor-pointer group"
                  >
                    <BellRing className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500 group-hover:scale-105 transition-transform" />
                    <span>Active Price Alerts</span>
                  </Link>
                </h2>
                <Link to="/alerts" className="text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer">
                  Manage &rarr;
                </Link>
              </div>

              <div className="flex flex-col gap-2 sm:gap-3 flex-1">
                {userAlerts.map(alert => (
                  <Link 
                    key={alert.alert_id} 
                    to={`/products/${alert.product_id}`} 
                    className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer"
                  >
                    <img 
                      src={alert.image_url || FALLBACK_IMAGE} 
                      alt={alert.product_name} 
                      referrerPolicy="no-referrer" 
                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                      className="w-10 h-10 sm:w-12 sm:h-12 object-contain mix-blend-multiply bg-white rounded-lg border border-slate-100 p-1 shrink-0" 
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{alert.product_name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] sm:text-xs font-semibold bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded-md">
                          Target: {formatINR(alert.target_price)}
                        </span>
                        {alert.lowest_live_price && (
                          <span className="text-[10px] sm:text-xs text-slate-500 font-medium">
                            Current: {formatINR(alert.lowest_live_price)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 5. Today's Best Deals - 2 Column Mobile Grid, 4 Column Desktop */}
      {bestDeals.length > 0 && (
        <section className="flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Tag className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500" />
              <span>Today's Best Deals</span>
            </h2>
            <Link to="/products" className="text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              <span>View all</span>
              <span>&rarr;</span>
            </Link>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6">
            {bestDeals.map(deal => {
              const discountInfo = getDiscountInfo(deal.price, deal.original_price);
              return (
                <Link 
                  key={deal.product_id} 
                  to={`/products/${deal.product_id}`}
                  className="group bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all p-3 sm:p-4 flex flex-col h-full relative"
                >
                  {/* Image Box */}
                  <div className="relative h-28 sm:h-40 md:aspect-square w-full rounded-xl bg-slate-50 p-2 sm:p-3 overflow-hidden border border-slate-100 mb-2 sm:mb-3 flex items-center justify-center shrink-0">
                    {discountInfo.isValid && (
                      <span className="absolute top-2 left-2 bg-rose-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-xs z-10">
                        -{discountInfo.discountPercentage}%
                      </span>
                    )}
                    <img 
                      src={deal.image_url || FALLBACK_IMAGE} 
                      alt={deal.name} 
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300 mix-blend-multiply"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 flex flex-col min-w-0">
                    <p className="text-[10px] sm:text-xs font-semibold text-indigo-600 uppercase tracking-wide truncate mb-0.5">
                      {deal.brand}
                    </p>
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 leading-tight mb-2 group-hover:text-indigo-600 transition-colors min-w-0">
                      {deal.name}
                    </h3>
                  </div>

                  {/* Price & Store */}
                  <div className="border-t border-slate-100 pt-2 mt-auto flex flex-col gap-0.5">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-sm sm:text-base font-bold text-slate-900">{formatINR(deal.price)}</span>
                      {discountInfo.isValid && (
                        <span className="text-[10px] sm:text-xs text-slate-400 line-through">{formatINR(discountInfo.originalPrice)}</span>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                      via <span className="font-semibold text-slate-700">{deal.store_name}</span>
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. Biggest Price Drops - Compact Horizontal List on Mobile */}
      {priceDrops.length > 0 && (
        <section className="flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
              <span>Biggest Price Drops</span>
            </h2>
            <Link to="/products" className="text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              <span>View all</span>
              <span>&rarr;</span>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
            {priceDrops.map(drop => (
              <Link 
                key={drop.product_id} 
                to={`/products/${drop.product_id}`}
                className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:border-indigo-300 hover:shadow-xs transition-all group"
              >
                <div className="w-14 h-14 sm:w-18 sm:h-18 bg-slate-50 rounded-xl p-1.5 sm:p-2 shrink-0 border border-slate-100 flex items-center justify-center">
                  <img 
                    src={drop.image_url || FALLBACK_IMAGE} 
                    alt={drop.name} 
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                    className="max-h-full max-w-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] sm:text-xs font-semibold text-indigo-600 uppercase tracking-wide truncate mb-0.5">
                    {drop.brand}
                  </p>
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1 group-hover:text-indigo-600 transition-colors" title={drop.name}>
                    {drop.name}
                  </h3>
                  <div className="flex items-baseline gap-1.5 mt-1 flex-wrap">
                    <span className="text-emerald-600 font-bold text-xs sm:text-sm">{formatINR(drop.current_price)}</span>
                    <span className="text-[10px] sm:text-xs text-slate-400 line-through">{formatINR(drop.previous_price)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-emerald-50 text-emerald-700">
                      ↓ {Math.round(parseFloat(drop.drop_percentage))}% Drop
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">
                      via {drop.store_name}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 7. Browse by Category - Responsive Grid (2 cols mobile, 3 cols tablet, 6 cols desktop) */}
      <section className="flex flex-col gap-3 sm:gap-4">
        <h2 className="text-base sm:text-xl font-bold text-slate-900 text-center sm:text-left">
          Browse by Category
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
          <Link 
            to="/products?type=Laptops" 
            className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 flex flex-col items-center justify-center gap-2 sm:gap-2.5 hover:border-indigo-500 hover:shadow-2xs transition-all text-slate-700 hover:text-indigo-600 group min-h-[90px] sm:min-h-[120px]"
          >
            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl group-hover:bg-indigo-50 transition-colors text-indigo-600">
              <Laptop className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="font-bold text-xs sm:text-sm text-center">Laptops</span>
          </Link>

          <Link 
            to="/products?type=Monitors" 
            className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 flex flex-col items-center justify-center gap-2 sm:gap-2.5 hover:border-indigo-500 hover:shadow-2xs transition-all text-slate-700 hover:text-indigo-600 group min-h-[90px] sm:min-h-[120px]"
          >
            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl group-hover:bg-indigo-50 transition-colors text-indigo-600">
              <Monitor className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="font-bold text-xs sm:text-sm text-center">Monitors</span>
          </Link>

          <Link 
            to="/products?type=Smartwatches" 
            className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 flex flex-col items-center justify-center gap-2 sm:gap-2.5 hover:border-indigo-500 hover:shadow-2xs transition-all text-slate-700 hover:text-indigo-600 group min-h-[90px] sm:min-h-[120px]"
          >
            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl group-hover:bg-indigo-50 transition-colors text-indigo-600">
              <Watch className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="font-bold text-xs sm:text-sm text-center">Smartwatches</span>
          </Link>

          <Link 
            to="/products?type=Phones" 
            className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 flex flex-col items-center justify-center gap-2 sm:gap-2.5 hover:border-indigo-500 hover:shadow-2xs transition-all text-slate-700 hover:text-indigo-600 group min-h-[90px] sm:min-h-[120px]"
          >
            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl group-hover:bg-indigo-50 transition-colors text-indigo-600">
              <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="font-bold text-xs sm:text-sm text-center">Phones</span>
          </Link>

          <Link 
            to="/products?type=Tablets" 
            className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 flex flex-col items-center justify-center gap-2 sm:gap-2.5 hover:border-indigo-500 hover:shadow-2xs transition-all text-slate-700 hover:text-indigo-600 group min-h-[90px] sm:min-h-[120px]"
          >
            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl group-hover:bg-indigo-50 transition-colors text-indigo-600">
              <Tablet className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="font-bold text-xs sm:text-sm text-center">Tablets</span>
          </Link>

          <Link 
            to="/products?type=Headphones" 
            className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 flex flex-col items-center justify-center gap-2 sm:gap-2.5 hover:border-indigo-500 hover:shadow-2xs transition-all text-slate-700 hover:text-indigo-600 group min-h-[90px] sm:min-h-[120px]"
          >
            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl group-hover:bg-indigo-50 transition-colors text-indigo-600">
              <Headphones className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="font-bold text-xs sm:text-sm text-center">Headphones</span>
          </Link>
        </div>
      </section>

      {/* 8. How It Works - Compact Dark Card */}
      <section className="bg-slate-900 rounded-2xl sm:rounded-3xl p-5 sm:p-10 lg:p-12 text-white">
        <div className="text-center mb-5 sm:mb-10">
          <h2 className="text-lg sm:text-2xl lg:text-3xl font-bold text-white mb-1.5 sm:mb-2">How It Works</h2>
          <p className="text-xs sm:text-sm text-slate-400">Never miss a deal with our simple 3-step tracking system</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-8">
          <div className="flex items-start sm:flex-col sm:items-center text-left sm:text-center gap-3.5 sm:gap-4 bg-slate-800/60 sm:bg-transparent p-3.5 sm:p-0 rounded-xl border border-slate-700/50 sm:border-0">
            <div className="w-10 h-10 sm:w-14 sm:h-14 bg-slate-800 rounded-xl flex items-center justify-center shrink-0 border border-slate-700 text-indigo-400">
              <Search className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
            <div>
              <h3 className="text-xs sm:text-base font-bold text-white mb-0.5 sm:mb-1">1. Find a Product</h3>
              <p className="text-[11px] sm:text-xs text-slate-300 sm:text-slate-400 leading-snug">
                Browse our catalog of gadgets or search for the specific tech item you want to buy.
              </p>
            </div>
          </div>

          <div className="flex items-start sm:flex-col sm:items-center text-left sm:text-center gap-3.5 sm:gap-4 bg-slate-800/60 sm:bg-transparent p-3.5 sm:p-0 rounded-xl border border-slate-700/50 sm:border-0">
            <div className="w-10 h-10 sm:w-14 sm:h-14 bg-slate-800 rounded-xl flex items-center justify-center shrink-0 border border-slate-700 text-indigo-400">
              <Monitor className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
            <div>
              <h3 className="text-xs sm:text-base font-bold text-white mb-0.5 sm:mb-1">2. Set Target Price</h3>
              <p className="text-[11px] sm:text-xs text-slate-300 sm:text-slate-400 leading-snug">
                Choose the price you are willing to pay and set a price alert on any product page.
              </p>
            </div>
          </div>

          <div className="flex items-start sm:flex-col sm:items-center text-left sm:text-center gap-3.5 sm:gap-4 bg-slate-800/60 sm:bg-transparent p-3.5 sm:p-0 rounded-xl border border-slate-700/50 sm:border-0">
            <div className="w-10 h-10 sm:w-14 sm:h-14 bg-slate-800 rounded-xl flex items-center justify-center shrink-0 border border-slate-700 text-indigo-400">
              <Bell className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
            <div>
              <h3 className="text-xs sm:text-base font-bold text-white mb-0.5 sm:mb-1">3. Get Notified</h3>
              <p className="text-[11px] sm:text-xs text-slate-300 sm:text-slate-400 leading-snug">
                Receive instant notifications when the price drops to your target across any major retailer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Final CTA - Compact & High-Impact */}
      <section className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-6 sm:p-10 text-center flex flex-col items-center gap-3 sm:gap-4 shadow-2xs">
        <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900">
          Ready to save on your next gadget?
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md">
          Start comparing live prices across verified retailers and set custom alerts.
        </p>
        <Link 
          to="/products" 
          id="btn-final-cta-start-tracking"
          className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2 min-h-[44px]"
        >
          <span>Start Tracking Prices</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

    </div>
  );
};

export default DashboardPage;

