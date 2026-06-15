import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchProductDetails, addToWatchlist, createPriceAlert, fetchWatchlist, fetchPriceAlerts, fetchPriceHistory } from '../services/api';
import { Product, StorePricing } from '../types/frontend';
import { formatINR } from '../utils/currency';
import { ArrowLeft, BellRing, BookmarkCheck, Star, ExternalLink, Calendar, Plus, CheckCircle, AlertCircle, ShoppingBag, ShieldAlert, TrendingDown } from 'lucide-react';

export default function ProductDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [storesPricing, setStoresPricing] = useState<StorePricing[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User Actions interactions feedback state
  const [isWatching, setIsWatching] = useState(false);
  const [alertTargetPrice, setAlertTargetPrice] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingWatch, setSubmittingWatch] = useState(false);
  const [submittingAlert, setSubmittingAlert] = useState(false);

  useEffect(() => {
    async function loadProductDetails() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const prodId = parseInt(id, 10);
        if (isNaN(prodId)) {
          throw new Error("Invalid URL parameter ID identifier.");
        }

        const data = await fetchProductDetails(prodId);
        setProduct(data.product);
        setStoresPricing(data.storesPricing || []);

        // Load 7-day historical pricing
        const historyData = await fetchPriceHistory(prodId);
        setPriceHistory(historyData || []);

        // Check if item is already present in watchlist if logged in
        if (user) {
          const watcher = await fetchWatchlist();
          const found = watcher.some(w => w.product_id === prodId);
          setIsWatching(found);
        }
      } catch (err: any) {
        setError(err.message || "Failed to parse PostgreSQL query database records.");
      } finally {
        setLoading(false);
      }
    }
    loadProductDetails();
  }, [id, user]);

  const handleAddToWatch = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!product) return;

    setSubmittingWatch(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      await addToWatchlist(product.product_id);
      setIsWatching(true);
      setActionSuccess(`Success! "${product.name}" has been logged into your watchlist catalog.`);
    } catch (err: any) {
      setActionError(err.message || 'Duplicate watchlist item or entry failed.');
    } finally {
      setSubmittingWatch(false);
    }
  };

  const handleCreateThresholdAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    if (!product) return;

    const priceNum = parseFloat(alertTargetPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setActionError("Please provide a positive numerical value for the target alert threshold price.");
      return;
    }

    setSubmittingAlert(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      await createPriceAlert(product.product_id, priceNum);
      setAlertTargetPrice('');
      setActionSuccess(`Bargain alert established! We will notify you when price dips to ${formatINR(priceNum)}.`);
    } catch (err: any) {
      setActionError(err.message || 'Error occurred while saving alert variables.');
    } finally {
      setSubmittingAlert(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-mono text-slate-500 font-medium">Extracting retail pricing indexes...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex-1 p-8 max-w-xl mx-auto flex flex-col items-center justify-center text-center gap-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs mt-10">
        <ShieldAlert className="w-12 h-12 text-rose-500" />
        <h3 className="text-sm font-bold text-slate-800">Product Not Found</h3>
        <p className="text-xs text-slate-500">
          {error || "We could not find the target gadget records in the database indices."}
        </p>
        <Link to="/products" className="bg-indigo-600 hover:bg-indigo-700 transition-all font-mono text-xs font-semibold py-2 px-4 rounded-xl text-white">
          Return to Catalogue
        </Link>
      </div>
    );
  }

  // Calculate highest store discount
  const bestDiscountPr = storesPricing.reduce((max, cur) => cur.discount > max.discount ? cur : max, storesPricing[0]);

  return (
    <div className="flex-1 flex flex-col gap-6 animate-fadeIn">
      
      {/* Back to listings button link */}
      <div>
        <Link to="/products" className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-slate-800 transition-all">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return To Catalogue</span>
        </Link>
      </div>

      {/* Operation Feedback toast alert */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs flex items-start gap-2.5 shadow-sm">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="font-medium">{actionSuccess}</div>
        </div>
      )}

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs flex items-start gap-2.5 shadow-sm">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div className="font-medium">{actionError}</div>
        </div>
      )}

      {/* Main product visual specs and controller card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col lg:flex-row gap-8">
        
        {/* Left Aspect Column - Product Mockup image */}
        <div className="w-full lg:w-2/5 aspect-square bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center shrink-0">
          <img
            referrerPolicy="no-referrer"
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Right Details Column Info */}
        <div className="flex-1 flex flex-col justify-between gap-6">
          <div className="flex flex-col gap-4">
            
            {/* Category tag and stock indicator */}
            <div className="flex items-center gap-2">
              <span className="bg-indigo-50 text-indigo-700 font-mono text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md border border-indigo-100">
                {product.category_name}
              </span>
              <span className="bg-slate-100 text-slate-500 font-mono text-[10px] uppercase font-semibold px-2 py-1 rounded-md">
                SKU: {product.model_no || 'N/A'}
              </span>
            </div>

            {/* Spec Title text */}
            <div>
              <span className="text-xs font-mono text-slate-400 font-bold uppercase">{product.brand} Gadgets</span>
              <h1 className="text-xl md:text-2xl font-display font-bold text-slate-900 tracking-tight mt-0.5">
                {product.name}
              </h1>
            </div>

            {/* Technical Specifications */}
            <div>
              <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
                Hardware Specifications Summary
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 font-sans">
                {product.specs_summary}
              </p>
            </div>

          </div>

          <div className="border-t border-slate-100 pt-5 flex flex-col sm:flex-row items-center gap-3">
            
            {/* Add to watchlist controller */}
            <button
              id="btn-add-details-watchlist"
              onClick={handleAddToWatch}
              disabled={submittingWatch || isWatching}
              className={`w-full sm:w-auto cursor-pointer font-mono text-xs font-semibold py-3 px-5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs border ${
                isWatching
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 cursor-default'
                  : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 active:bg-slate-100'
              }`}
            >
              <BookmarkCheck className={`w-4 h-4 ${isWatching ? 'text-emerald-600' : 'text-slate-500'}`} />
              <span>{isWatching ? 'In My Watchlist' : 'Add to Watchlist'}</span>
            </button>

            {/* Price notification triggers form */}
            {!isWatching && !user && (
              <span className="text-[10px] font-mono text-slate-400 italic">
                * Please <Link to="/login" className="text-indigo-600 underline">login</Link> to configure target variables.
              </span>
            )}

          </div>
        </div>

      </div>

      {/* 7-Day Price History chart */}
      {priceHistory.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-emerald-600" />
              <span>7-Day Lowest Price Trend Tracker</span>
            </h2>
            <span className="text-[10px] font-mono font-medium text-slate-400">
              Crawl Interval: Every 6 Hours
            </span>
          </div>

          <div className="relative pt-6 pb-2 px-1">
            {/* Elegant relative-height bars */}
            <div className="h-44 w-full flex items-end justify-between gap-3 md:gap-5">
              {priceHistory.map((day, dIdx) => {
                const pricesOnly = priceHistory.map(h => h.price);
                const maxVal = Math.max(...pricesOnly) * 1.05;
                const minVal = Math.min(...pricesOnly) * 0.95;
                const valueRange = maxVal - minVal || 1;
                const heightPercent = ((day.price - minVal) / valueRange) * 100;
                
                return (
                  <div key={dIdx} className="flex-1 flex flex-col items-center gap-2 group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-2 bg-slate-900 text-white rounded px-2.5 py-1 text-[9px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                      {day.storeName}: {formatINR(day.price)}
                    </div>
                    
                    {/* Visual bar container */}
                    <div className="w-full bg-slate-50 border border-slate-100 rounded-lg h-24 relative flex items-end">
                      <div 
                        style={{ height: `${Math.max(12, heightPercent)}%` }}
                        className="w-full bg-indigo-500 hover:bg-emerald-500 rounded-md transition-all relative flex justify-center"
                      >
                        <span className="absolute -top-5 font-mono text-[9px] font-semibold text-slate-600 select-none">
                          {formatINR(day.price)}
                        </span>
                      </div>
                    </div>

                    <span className="text-[9px] font-mono text-slate-400">
                      {new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Compare Merchant Retail Price lists options */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Merchant comparison lists column */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-700">
              Stores Pricing Comparison Chart (INR)
            </h2>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs flex flex-col">
            {storesPricing.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Pricing matrix is empty. No live scrap matches in databases index.
              </div>
            ) : (
              storesPricing.map((pricing) => (
                <div
                  key={pricing.price_id}
                  className={`p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 last:border-b-0 transition-colors hover:bg-slate-50/50 ${
                    pricing.price === product.cheapest_price ? 'bg-indigo-50/10' : ''
                  }`}
                >
                  
                  {/* Shop label */}
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-150 flex items-center justify-center font-mono font-bold text-xs uppercase text-slate-500 select-none shrink-0 border-indigo-100 text-indigo-700 bg-indigo-50/50">
                      {pricing.store_name.slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-800">{pricing.store_name}</span>
                        {pricing.price === product.cheapest_price && (
                          <span className="bg-indigo-100 text-indigo-700 font-mono text-[8px] uppercase font-bold px-1.5 rounded-sm">
                            Best Offer
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        <span className="text-[10px] font-mono text-slate-500">{pricing.store_rating} Merchant Rating</span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing elements */}
                  <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-slate-100 pt-2.5 md:pt-0">
                    <div className="flex flex-col md:items-end">
                      
                      {/* Price / Discount tag */}
                      <div className="flex items-center gap-2">
                        {pricing.discount > 0 && (
                          <span className="text-[10px] font-mono font-semibold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-md">
                            -{formatINR(pricing.discount)} off
                          </span>
                        )}
                        <span className="text-sm font-bold font-mono text-slate-800">
                          {formatINR(pricing.price)}
                        </span>
                      </div>

                      {/* Original benchmark price */}
                      <div className="text-[10px] text-slate-400 font-mono">
                        {pricing.discount > 0 && (
                          <span>Original: <del>{formatINR(pricing.original_price)}</del></span>
                        )}
                      </div>

                    </div>

                    {/* Store redirect link */}
                    <a
                      href={pricing.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg text-[10px] font-mono font-medium flex items-center gap-1 shadow-xs transition-all shrink-0"
                    >
                      <span>Buy Store</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>

        {/* Dynamic customized Price Alerts Form Column */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-pink-500" />
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-700">
              Create Price Alert
            </h2>
          </div>

          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex flex-col gap-4 shadow-xs">
            <p className="text-xs text-slate-500 leading-normal">
              Establish a dynamic targeted threshold. Once scrapers discover store indexes equal to or below your target limit, we send alert triggers instantly.
            </p>

            <form onSubmit={handleCreateThresholdAlert} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label id="lbl-target-alert" className="text-[10px] font-mono text-slate-500 uppercase font-bold">
                  Target Pricing Limit (INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-450 font-bold">₹</span>
                  <input
                    id="inp-target-alert-val"
                    type="number"
                    step="1"
                    placeholder="e.g. 135000"
                    value={alertTargetPrice}
                    onChange={(e) => setAlertTargetPrice(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 text-xs rounded-lg border border-slate-200 font-mono bg-slate-50/50 text-slate-800"
                    required
                  />
                </div>
              </div>

              <button
                id="btn-create-target-alert"
                type="submit"
                disabled={submittingAlert}
                className="cursor-pointer w-full bg-slate-900 border border-slate-950 text-white font-mono text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xs"
              >
                {submittingAlert ? (
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Alert Filter</span>
                  </>
                )}
              </button>
            </form>

            <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-500 font-mono">
              <Star className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 fill-amber-500" />
              <div>
                <span>Current best index is: <b className="text-indigo-600">{product.cheapest_price !== undefined ? formatINR(product.cheapest_price) : 'N/A'}</b> via {product.store_name}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
