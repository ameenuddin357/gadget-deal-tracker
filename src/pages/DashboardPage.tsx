import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tag, TrendingDown, CheckCircle, Search, Bell, Monitor, Smartphone, Laptop, Headphones, Activity, BookmarkCheck, BellRing, AlertCircle, RefreshCw } from 'lucide-react';
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
  const { user } = useAuth();
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
          // If token expired or auth failed, interceptor will trigger 'auth-expired'
          // Do not log error for expired/unauthorized sessions
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
    }
  }, [user]);

  const formatINR = (value: string | number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(typeof value === 'string' ? parseFloat(value) : value);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-16">
      {/* Hero Section */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 flex flex-col items-center text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight mb-6">
            Track gadget prices.<br className="hidden sm:block" /> Find better deals.
          </h1>
          <p className="text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Track verified product prices across major retailers, set price alerts, and find better deals.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Link 
              to="/products" 
              className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Search className="w-5 h-5" />
              Explore Deals
            </Link>
            <Link 
              to="/alerts" 
              className="w-full sm:w-auto px-8 py-3.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Bell className="w-5 h-5" />
              Set a Price Alert
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 grid grid-cols-2 md:grid-cols-3 gap-6 divide-x divide-slate-100">
          <div className="text-center">
            <p className="text-xs sm:text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Products Tracked</p>
            <p className="text-3xl sm:text-4xl font-bold text-slate-900">{stats?.totalProducts ?? 0}</p>
          </div>
          <div className="text-center">
            <p className="text-xs sm:text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Retailers</p>
            <p className="text-3xl sm:text-4xl font-bold text-slate-900">{stats?.totalRetailers ?? 0}</p>
          </div>
          <div className="text-center col-span-2 md:col-span-1 border-t md:border-t-0 pt-6 md:pt-0 mt-6 md:mt-0 divide-slate-100">
            <p className="text-xs sm:text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Active Price Alerts</p>
            <p className="text-3xl sm:text-4xl font-bold text-indigo-600">{stats?.activeAlerts ?? 0}</p>
          </div>
        </div>
      </section>

      {/* AI Deal Advisor Entry Point Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-2xl shrink-0">
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">AI Deal Advisor</h3>
                <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  Price Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Not sure whether to buy or wait? Choose any product from our catalogue to ask the AI Deal Advisor.
              </p>
            </div>
          </div>
          <Link
            id="btn-dashboard-ai-advisor"
            to="/products?ai_advisor=true"
            className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 shrink-0 whitespace-nowrap shadow-xs cursor-pointer"
          >
            <span>🤖 Ask AI Advisor</span>
            <span>&rarr;</span>
          </Link>
        </div>
      </section>

      {/* Personalized Section */}
      {user && (userWatchlist.length > 0 || userAlerts.length > 0) && (
        <section className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 grid grid-cols-1 ${userWatchlist.length > 0 && userAlerts.length > 0 ? 'lg:grid-cols-2' : ''} gap-8`}>
          {userWatchlist.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <BookmarkCheck className="w-5 h-5 text-indigo-500" />
                  Your Watchlist
                </h2>
                <Link to="/watchlist" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                  View all &rarr;
                </Link>
              </div>
              
              <div className="flex flex-col gap-3 flex-1">
                {userWatchlist.map(item => (
                  <Link key={item.watchlist_id} to={`/products/${item.product_id}`} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
                    <img src={item.image_url || "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400"} alt={item.product_name} referrerPolicy="no-referrer" className="w-12 h-12 object-contain mix-blend-multiply bg-white rounded border border-slate-100 p-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.product_name}</p>
                      <p className="text-xs text-slate-500 truncate">{item.brand}</p>
                    </div>
                    {item.lowest_live_price && (
                      <span className="font-semibold text-slate-900 text-sm whitespace-nowrap">{formatINR(item.lowest_live_price)}</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
          
          {userAlerts.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-rose-500" />
                  Active Price Alerts
                </h2>
                <Link to="/alerts" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                  Manage alerts &rarr;
                </Link>
              </div>

              <div className="flex flex-col gap-3 flex-1">
                {userAlerts.map(alert => (
                  <Link key={alert.alert_id} to={`/products/${alert.product_id}`} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
                    <img src={alert.image_url || "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400"} alt={alert.product_name} referrerPolicy="no-referrer" className="w-12 h-12 object-contain mix-blend-multiply bg-white rounded border border-slate-100 p-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{alert.product_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded">Target: {formatINR(alert.target_price)}</span>
                        {alert.lowest_live_price && (
                          <span className="text-xs text-slate-500">Current: {formatINR(alert.lowest_live_price)}</span>
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

      {/* Today's Best Deals */}
      {bestDeals.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Tag className="w-6 h-6 text-rose-500" />
              Today's Best Deals
            </h2>
            <Link to="/products" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              View all deals &rarr;
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {bestDeals.map(deal => {
              const discountInfo = getDiscountInfo(deal.price, deal.original_price);
              return (
                <Link 
                  key={deal.product_id} 
                  to={`/products/${deal.product_id}`}
                  className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col"
                >
                  <div className="relative aspect-square p-6 bg-slate-50 flex items-center justify-center">
                    {discountInfo.isValid && (
                      <span className="absolute top-3 left-3 bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-md">
                        -{discountInfo.discountPercentage}%
                      </span>
                    )}
                    <img 
                      src={deal.image_url || FALLBACK_IMAGE} 
                      alt={deal.name} 
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 mix-blend-multiply"
                    />
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <p className="text-xs font-medium text-slate-500 mb-1">{deal.brand}</p>
                    <h3 className="font-semibold text-slate-900 text-sm mb-3 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                      {deal.name}
                    </h3>
                    <div className="mt-auto">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-lg font-bold text-slate-900">{formatINR(deal.price)}</span>
                        {discountInfo.isValid && (
                          <span className="text-xs text-slate-400 line-through">{formatINR(discountInfo.originalPrice)}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        via <span className="font-medium text-slate-700">{deal.store_name}</span>
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Biggest Price Drops */}
      {priceDrops.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingDown className="w-6 h-6 text-emerald-500" />
              Biggest Price Drops
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {priceDrops.map(drop => (
              <Link 
                key={drop.product_id} 
                to={`/products/${drop.product_id}`}
                className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md transition-all duration-200"
              >
                <div className="w-20 h-20 bg-slate-50 rounded-lg p-2 shrink-0">
                  <img 
                    src={drop.image_url || FALLBACK_IMAGE} 
                    alt={drop.name} 
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                    className="w-full h-full object-contain mix-blend-multiply"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-900 text-sm truncate mb-1" title={drop.name}>
                    {drop.name}
                  </h3>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-emerald-600 font-bold text-sm">{formatINR(drop.current_price)}</span>
                    <span className="text-xs text-slate-400 line-through">{formatINR(drop.previous_price)}</span>
                  </div>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                    Dropped {Math.round(parseFloat(drop.drop_percentage))}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Popular Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
        <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">Browse by Category</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/products?category=Smartphones%20%26%20Tablets" className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3 hover:border-indigo-500 hover:shadow-sm transition-all text-slate-600 hover:text-indigo-600 group">
            <div className="p-3 bg-slate-50 rounded-full group-hover:bg-indigo-50 transition-colors">
              <Smartphone className="w-8 h-8" />
            </div>
            <span className="font-medium text-sm">Smartphones</span>
          </Link>
          <Link to="/products?category=Laptops%20%26%20Desktops" className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3 hover:border-indigo-500 hover:shadow-sm transition-all text-slate-600 hover:text-indigo-600 group">
            <div className="p-3 bg-slate-50 rounded-full group-hover:bg-indigo-50 transition-colors">
              <Laptop className="w-8 h-8" />
            </div>
            <span className="font-medium text-sm">Laptops</span>
          </Link>
          <Link to="/products?category=Smart%20Wearables" className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3 hover:border-indigo-500 hover:shadow-sm transition-all text-slate-600 hover:text-indigo-600 group">
            <div className="p-3 bg-slate-50 rounded-full group-hover:bg-indigo-50 transition-colors">
              <Monitor className="w-8 h-8" />
            </div>
            <span className="font-medium text-sm">Smartwatches</span>
          </Link>
          <Link to="/products?category=Audio%20Equipment" className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3 hover:border-indigo-500 hover:shadow-sm transition-all text-slate-600 hover:text-indigo-600 group">
            <div className="p-3 bg-slate-50 rounded-full group-hover:bg-indigo-50 transition-colors">
              <Headphones className="w-8 h-8" />
            </div>
            <span className="font-medium text-sm">Audio</span>
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-slate-900 mt-20 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-slate-400">Never miss a deal with our simple tracking system</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 border border-slate-700 text-indigo-400">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">1. Find a Product</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Browse our extensive catalog of gadgets or search for the specific item you want to buy.
              </p>
            </div>
            <div className="flex flex-col items-center text-center relative">
              <div className="hidden md:block absolute top-8 -left-1/2 w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 border border-slate-700 text-indigo-400 relative z-10">
                <Monitor className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">2. Set Target Price</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Choose the price you are willing to pay and set a price alert on the product page.
              </p>
            </div>
            <div className="flex flex-col items-center text-center relative">
              <div className="hidden md:block absolute top-8 -left-1/2 w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 border border-slate-700 text-indigo-400 relative z-10">
                <Bell className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">3. Get Notified</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                We'll email you immediately when the price drops to your target across any major retailer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-6">Ready to save on your next gadget?</h2>
        <Link 
          to="/products" 
          className="inline-flex items-center justify-center px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-all duration-200 gap-2 shadow-sm"
        >
          Start Tracking Prices
        </Link>
      </section>
    </div>
  );
};

export default DashboardPage;
