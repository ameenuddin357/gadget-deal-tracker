import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchProductDetails, addToWatchlist, createPriceAlert, fetchWatchlist, fetchPriceAlerts, addSearchHistory, fetchPriceHistory, fetchProductAiRecommendation, sendProductAiChat } from '../services/api';
import { Product, StorePricing } from '../types/frontend';
import { formatINR, getDiscountInfo, isRealSpec, getRetailerTrendInfo, getDynamicQuickQuestions } from '../utils/currency';
import { ArrowLeft, BellRing, BookmarkCheck, Star, ExternalLink, Plus, ShoppingBag, TrendingDown, Clock, ShieldCheck, Activity, AlertCircle, ArrowRightLeft, Scale, Lock, LogIn } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, isAfter } from 'date-fns';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400";

interface AiDealAdvisorCardProps {
  productId: number;
  product?: Product | null;
  storesPricing?: StorePricing[];
  priceHistoryCount?: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  level?: number;
  isHistorical?: boolean;
  storeUrl?: string;
  storeName?: string;
}

const AiDealAdvisorCard: React.FC<AiDealAdvisorCardProps> = ({ productId, product, storesPricing = [], priceHistoryCount = 0 }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [recommendation, setRecommendation] = useState<{
    eligible: boolean;
    level?: number;
    error?: boolean;
    message?: string;
    data?: {
      recommendation: 'buy_now' | 'wait';
      reasoning: string;
      confidence: 'low' | 'medium' | 'high';
    };
  } | null>(null);

  // Chatbot State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState<string>('');
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const chatContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let isMounted = true;
    const loadRecommendation = async () => {
      setLoading(true);
      try {
        const res = await fetchProductAiRecommendation(productId);
        if (isMounted) {
          setRecommendation(res);
        }
      } catch (err) {
        if (isMounted) {
          setRecommendation({
            eligible: true,
            error: true,
            message: 'AI recommendation temporarily unavailable.'
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadRecommendation();
    setMessages([]);
    setInputQuestion('');
    return () => { isMounted = false; };
  }, [productId, user]);

  if (!user) {
    return (
      <div id="ai-deal-advisor-card" className="mt-4 bg-slate-900 text-white p-4 rounded-xl shadow-xs border border-slate-800 flex flex-col gap-3 transition-all">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-base">🤖</span>
            <div>
              <h3 id="txt-ai-advisor-title" className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                AI Deal Advisor
              </h3>
              <span className="text-[10px] text-slate-400 font-normal">Real-time price intelligence</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-800/50 p-3.5 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 shrink-0">
              <Lock className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-200">Log in to analyze this deal with AI.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Get personalized buy/wait recommendations and dynamic deal intelligence.</p>
            </div>
          </div>
          <button
            id="btn-ai-advisor-login"
            onClick={() => navigate('/login', { state: { from: { pathname: `/products/${productId}`, state: { scrollToAi: true } }, message: 'Please log in to use AI Deal Advisor.' } })}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-xs"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log In</span>
          </button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isAsking]);

  const handleAskQuestion = async (q: string) => {
    const questionText = q.trim();
    if (!questionText || isAsking) return;

    const userMsgId = 'msg-' + Date.now();
    const userMessage: ChatMessage = { id: userMsgId, role: 'user', content: questionText };

    setMessages(prev => [...prev, userMessage]);
    setInputQuestion('');
    setIsAsking(true);

    const currentHistory = messages.slice(-4).map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await sendProductAiChat(productId, questionText, currentHistory);
      const botAnswer = res.answer || 'AI Deal Advisor is temporarily unavailable.';

      const botMsgId = 'msg-bot-' + Date.now();
      setMessages(prev => [...prev, { 
        id: botMsgId, 
        role: 'assistant', 
        content: botAnswer,
        level: res.level,
        isHistorical: res.isHistorical,
        storeUrl: res.storeUrl,
        storeName: res.storeName
      }]);
    } catch (err) {
      const botMsgId = 'msg-bot-err-' + Date.now();
      setMessages(prev => [...prev, { id: botMsgId, role: 'assistant', content: 'AI Deal Advisor is temporarily unavailable.' }]);
    } finally {
      setIsAsking(false);
    }
  };

  const level = (recommendation as any)?.level !== undefined ? (recommendation as any).level : (priceHistoryCount >= 2 ? 1 : 0);

  const quickQuestions = getDynamicQuickQuestions(
    product || null,
    storesPricing,
    level
  );

  const activeOffers = storesPricing.filter(s => s.is_available !== false && (typeof s.price === 'number' ? s.price > 0 : parseFloat(String(s.price)) > 0));
  const cheapestOffer = [...activeOffers].sort((a, b) => {
    const aPrice = typeof a.price === 'number' ? a.price : parseFloat(String(a.price));
    const bPrice = typeof b.price === 'number' ? b.price : parseFloat(String(b.price));
    return aPrice - bPrice;
  })[0] || storesPricing[0];

  const cheapestOfferPrice = cheapestOffer 
    ? (typeof cheapestOffer.price === 'number' ? cheapestOffer.price : parseFloat(String(cheapestOffer.price)))
    : undefined;

  const currentPriceVal = product?.cheapest_price !== undefined && product?.cheapest_price !== null && product?.cheapest_price > 0
    ? product.cheapest_price
    : cheapestOfferPrice;

  const currentPriceFormatted = currentPriceVal !== undefined && currentPriceVal !== null && !isNaN(currentPriceVal) && currentPriceVal > 0
    ? formatINR(currentPriceVal)
    : 'N/A';

  const bestRetailerName = cheapestOffer?.store_name 
    || (cheapestOffer as any)?.store?.name 
    || storesPricing[0]?.store_name 
    || product?.store_name 
    || 'No active retailer';

  const trackingStartedDate = (recommendation as any)?.trackingStartedAt 
    ? new Date((recommendation as any).trackingStartedAt) 
    : (product?.last_scraped_at ? new Date(product.last_scraped_at) : null);

  const trackingStartedFormatted = trackingStartedDate && !isNaN(trackingStartedDate.getTime())
    ? format(trackingStartedDate, 'MMM d, yyyy')
    : null;

  return (
    <div id="ai-deal-advisor-card" className="mt-4 bg-slate-900 text-white p-4 rounded-xl shadow-xs border border-slate-800 flex flex-col gap-3 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <div>
            <h3 id="txt-ai-advisor-title" className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              AI Deal Advisor
            </h3>
            <span className="text-[10px] text-slate-400 font-normal">Real-time price intelligence</span>
          </div>
        </div>
      </div>

      {/* Main Buy/Wait Summary Section */}
      {loading ? (
        <div id="ai-advisor-loading" className="flex items-center gap-2 text-xs text-slate-400 py-1">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
          <span>Analyzing price history...</span>
        </div>
      ) : level === 0 || level === 1 || level === 2 ? (
        <div className="flex flex-col gap-2 bg-slate-800/40 p-3 rounded-lg border border-slate-800/60 text-xs">
          <div className="flex items-center justify-between border-b border-slate-700/50 pb-2 mb-1">
            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
              {level === 0 ? 'Limited price history' : level === 1 ? 'Level 1 · Limited history' : 'Level 2 · Short-term trend'}
            </span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400">Current price:</span>
              <span className="font-semibold text-slate-200">{currentPriceFormatted}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400">Best retailer:</span>
              <span className="font-semibold text-slate-200">{bestRetailerName}</span>
            </div>
            {trackingStartedFormatted && (
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400">Tracking started:</span>
                <span className="font-semibold text-slate-200">{trackingStartedFormatted}</span>
              </div>
            )}
          </div>
          
          {recommendation?.data?.insightText && (
            <div className="flex flex-col mt-1">
              <span className="text-[10px] text-slate-400">Price insight:</span>
              <span className="font-medium text-slate-200">{recommendation.data.insightText}</span>
            </div>
          )}

          <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
            {level === 0
              ? (recommendation?.message || "Price history is still being collected for this product. As more genuine price data is recorded, smarter Buy/Wait insights will become available.")
              : (recommendation?.data?.subText || "More price history is needed for a reliable Buy/Wait recommendation.")}
          </p>
        </div>
      ) : recommendation?.error ? (
        <p id="txt-ai-advisor-unavailable" className="text-xs text-slate-400 leading-relaxed py-0.5">
          {recommendation?.message || "AI recommendation temporarily unavailable."}
        </p>
      ) : recommendation?.data ? (
        <div className="flex flex-col gap-2 bg-slate-800/40 p-2.5 rounded-lg border border-slate-800/60">
          <div className="flex items-center gap-2">
            {recommendation.data.recommendation === 'buy_now' ? (
              <span id="badge-ai-buy-now" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase tracking-wide">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                BUY NOW
              </span>
            ) : (
              <span id="badge-ai-wait" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black uppercase tracking-wide">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                WAIT
              </span>
            )}
          </div>
          <p id="txt-ai-advisor-reasoning" className="text-xs text-slate-300 leading-snug">
            "{recommendation.data.reasoning}"
          </p>
          {recommendation.data.confidence && (
            <div className="pt-0.5 flex items-center">
              <span id="txt-ai-advisor-confidence" className="text-[11px] font-medium text-slate-400 bg-slate-800/90 px-2 py-0.5 rounded-md border border-slate-700/60">
                Confidence: <strong className="text-slate-100 capitalize">{recommendation.data.confidence}</strong>
              </span>
            </div>
          )}
        </div>
      ) : null}

      {/* Predefined Quick Questions */}
      <div className="flex flex-col gap-1.5 pt-1">
        <span className="text-[11px] font-semibold text-slate-400">Ask about this deal:</span>
        <div className="flex flex-wrap gap-1.5">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              id={`btn-quick-q-${idx}`}
              onClick={() => handleAskQuestion(q)}
              disabled={isAsking}
              className="text-[11px] bg-slate-800/90 hover:bg-slate-700/80 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-700/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Container */}
      {messages.length > 0 && (
        <div id="ai-chat-messages" ref={chatContainerRef} className="max-h-48 overflow-y-auto flex flex-col gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs my-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] px-3 py-1.5 rounded-xl text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-slate-800 text-slate-200 border border-slate-700/80 rounded-bl-none'
                }`}
              >
                {m.role === 'assistant' && m.isHistorical && m.level !== undefined && (
                  <div className="text-[9px] uppercase font-bold text-indigo-400 tracking-wider mb-1 flex items-center gap-1">
                    {m.level === 1 ? 'Level 1 · Limited history' : m.level === 2 ? 'Level 2 · Short-term trend' : m.level === 3 ? 'Level 3 · 30+ day history' : 'Limited price history'}
                  </div>
                )}
                <div>{m.content}</div>
                {m.storeUrl && (
                  <div className="mt-2 pt-1.5 border-t border-slate-700/60">
                    <a
                      href={m.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[11px] font-semibold transition-colors"
                    >
                      <span>View on {m.storeName || 'Store'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isAsking && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400 italic px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
              <span>Analyzing...</span>
            </div>
          )}
        </div>
      )}

      {/* Interactive Question Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAskQuestion(inputQuestion);
        }}
        className="flex items-center gap-2 pt-1"
      >
        <input
          id="input-ai-chat-question"
          type="text"
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          placeholder="Ask about this deal..."
          disabled={isAsking}
          className="flex-1 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
        />
        <button
          id="btn-ai-chat-send"
          type="submit"
          disabled={!inputQuestion.trim() || isAsking}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center min-w-[55px] cursor-pointer disabled:cursor-not-allowed"
        >
          {isAsking ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
};

const ProductDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const stateObj = location.state as any;
    if (stateObj?.scrollToAi || stateObj?.from?.state?.scrollToAi || location.search.includes('ai_advisor=true')) {
      setTimeout(() => {
        const el = document.getElementById('ai-deal-advisor-card');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 300);
    }
  }, [location]);

  const [product, setProduct] = useState<Product | null>(null);
  const [storesPricing, setStoresPricing] = useState<StorePricing[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [historyPeriod, setHistoryPeriod] = useState<number>(7); // 7 days by default

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isWatched, setIsWatched] = useState<boolean>(false);
  const [addingWatchlist, setAddingWatchlist] = useState<boolean>(false);
  
  const [isInCompare, setIsInCompare] = useState<boolean>(false);
  const [compareFeedback, setCompareFeedback] = useState<string | null>(null);

  const [alertTargetPrice, setAlertTargetPrice] = useState<string>('');
  const [submittingAlert, setSubmittingAlert] = useState<boolean>(false);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    try {
      const saved = localStorage.getItem('deal_compare_ids');
      if (saved) {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids)) {
          setIsInCompare(ids.includes(parseInt(id, 10)));
        }
      }
    } catch {}
  }, [id]);

  const handleCompareToggle = () => {
    if (!user) {
      navigate('/login', { state: { from: location, message: 'Please log in to use product comparison.' } });
      return;
    }
    if (!product) return;
    try {
      const saved = localStorage.getItem('deal_compare_ids');
      let ids: number[] = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(ids)) ids = [];

      const pid = product.product_id;
      if (ids.includes(pid)) {
        setCompareFeedback('Already in Compare.');
        setTimeout(() => setCompareFeedback(null), 3500);
        return;
      }

      if (ids.length >= 4) {
        setCompareFeedback('Compare workspace full (max 4 products).');
        setTimeout(() => setCompareFeedback(null), 3500);
        return;
      }

      const updated = [...ids, pid];
      localStorage.setItem('deal_compare_ids', JSON.stringify(updated));
      setIsInCompare(true);
      setCompareFeedback('Added to Compare workspace!');
      setTimeout(() => setCompareFeedback(null), 3500);
    } catch (e) {
      console.error('Failed to update compare list', e);
    }
  };

  useEffect(() => {
    if (!id) return;
    const loadDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const detailsRes = await fetchProductDetails(parseInt(id, 10));
        setProduct(detailsRes.product);
        setStoresPricing(detailsRes.storesPricing || []);

        // Fetch history and user watchlist if available
        try {
          const historyData = await fetchPriceHistory(parseInt(id, 10));
          setPriceHistory(historyData);
        } catch (e) {
          console.error('Failed to load price history', e);
        }

        if (user) {
          try {
            const watchlistData = await fetchWatchlist();
            const isInWatchlist = watchlistData.some((w: any) => w.product_id === parseInt(id, 10));
            setIsWatched(isInWatchlist);
          } catch (e) {
            console.error('Failed to load watchlist status', e);
          }
        }

      } catch (err: any) {
        setError(err.message || 'Failed to load product details.');
      } finally {
        setLoading(false);
      }
    };
    loadDetails();
  }, [id, user]);

  const handleAddToWatchlist = async () => {
    if (!user) {
      navigate('/login', { state: { from: location, message: 'Please log in to use your watchlist.' } });
      return;
    }
    if (!product) return;
    setAddingWatchlist(true);
    try {
      await addToWatchlist(product.product_id);
      setIsWatched(true);
    } catch (err: any) {
      alert(err.message || 'Failed to add to watchlist');
    } finally {
      setAddingWatchlist(false);
    }
  };

  const handleCreateThresholdAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: location, message: 'Please log in to create price alerts.' } });
      return;
    }
    if (!product || !alertTargetPrice) return;
    const targetVal = parseFloat(alertTargetPrice);
    if (isNaN(targetVal) || targetVal <= 0) {
      alert('Please enter a valid target price greater than 0.');
      return;
    }
    setSubmittingAlert(true);
    setAlertSuccess(null);
    try {
      await createPriceAlert(product.product_id, targetVal);
      setAlertSuccess('Price alert successfully created! We will notify you via email.');
      setAlertTargetPrice('');
    } catch (err: any) {
      alert(err.message || 'Failed to create alert');
    } finally {
      setSubmittingAlert(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium text-slate-500">Loading product details...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Product Not Found</h2>
          <p className="text-slate-500 mb-6">{error || 'We could not locate this product in our catalogue.'}</p>
          <Link to="/products" className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            Return to Catalogue
          </Link>
        </div>
      </div>
    );
  }

  // Check if product genuinely has a price-history record at least 365 days old
  const has365DayHistory = priceHistory.some(h => {
    if (!h.date) return false;
    const ageInDays = (Date.now() - new Date(h.date).getTime()) / (1000 * 60 * 60 * 24);
    return ageInDays >= 365;
  });

  // Filter history data based on selected period (7, 30, or 365 days)
  const cutoffDate = subDays(new Date(), historyPeriod);
  const filteredHistory = priceHistory.filter(h => isAfter(new Date(h.date), cutoffDate));
  
  // Extract genuine points within the period
  const genuinePoints = filteredHistory
    .map(h => ({
      date: new Date(h.date),
      price: parseFloat(h.price),
      store: h.store_name
    }))
    .filter(p => !isNaN(p.price))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Group genuine points by YYYY-MM-DD (picking lowest genuine price on a given day)
  const genuineByDay: Record<string, number> = {};
  genuinePoints.forEach(pt => {
    const key = format(pt.date, 'yyyy-MM-dd');
    if (genuineByDay[key] === undefined || pt.price < genuineByDay[key]) {
      genuineByDay[key] = pt.price;
    }
  });

  // Construct chart visualization series (for visualization ONLY, carrying forward latest known price for missing days)
  let dedupedChartData: Array<{ dateStr: string; price: number; isCarriedForward?: boolean }> = [];

  if (genuinePoints.length > 0) {
    const today = new Date();
    const startDate = isAfter(cutoffDate, genuinePoints[0].date) ? cutoffDate : genuinePoints[0].date;
    
    let lastKnownPrice: number | null = null;
    let curr = new Date(startDate);
    curr.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);

    while (curr <= end) {
      const dayKey = format(curr, 'yyyy-MM-dd');
      const displayKey = format(curr, 'MMM dd');

      if (genuineByDay[dayKey] !== undefined) {
        lastKnownPrice = genuineByDay[dayKey];
        dedupedChartData.push({
          dateStr: displayKey,
          price: lastKnownPrice
        });
      } else if (lastKnownPrice !== null) {
        // Carry forward most recent known price for visualization only (never saved to DB or used for metrics)
        dedupedChartData.push({
          dateStr: displayKey,
          price: lastKnownPrice,
          isCarriedForward: true
        });
      }
      curr.setDate(curr.getDate() + 1);
    }
  }

  // Calculate summary stats strictly from genuine stored price history
  const currentLowPrice = storesPricing.length > 0 ? Math.min(...storesPricing.map(s => parseFloat(s.price as any))) : undefined;
  const historicalPrices = priceHistory.map(h => parseFloat(h.price)).filter(p => !isNaN(p));
  const historicalLow = historicalPrices.length > 0 ? Math.min(...historicalPrices) : currentLowPrice;
  const historicalHigh = historicalPrices.length > 0 ? Math.max(...historicalPrices) : currentLowPrice;
  
  let avgPrice = undefined;
  if (historicalPrices.length > 0) {
    avgPrice = historicalPrices.reduce((a, b) => a + b, 0) / historicalPrices.length;
  }

  // Calculate percentage change in selected period using genuine filtered history
  let periodPctChange: number | null = null;
  if (genuinePoints.length >= 2) {
    const oldest = genuinePoints[0].price;
    const newest = genuinePoints[genuinePoints.length - 1].price;
    if (oldest > 0) {
      periodPctChange = ((newest - oldest) / oldest) * 100;
    }
  }

  const oldestDateStr = priceHistory.length > 0 
    ? format(new Date(priceHistory[0].date), 'MMM dd, yyyy') 
    : (product?.created_at ? format(new Date(product.created_at), 'MMM dd, yyyy') : 'today');

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      {/* Top Navigation */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-product-ai-advisor-jump"
              onClick={() => {
                const el = document.getElementById('ai-deal-advisor-card');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 text-white hover:bg-slate-800 rounded-lg text-sm font-semibold transition-colors cursor-pointer shadow-xs shrink-0"
            >
              <span className="text-sm">🤖</span>
              <span className="hidden sm:inline">Ask AI Deal Advisor</span>
            </button>

            <button
              onClick={handleAddToWatchlist}
              disabled={addingWatchlist || isWatched}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shrink-0 ${
                isWatched 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default' 
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 cursor-pointer'
              }`}
            >
              <BookmarkCheck className={`w-4 h-4 ${isWatched ? 'text-emerald-500' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">{addingWatchlist ? 'Saving...' : isWatched ? 'On Watchlist' : 'Add to Watchlist'}</span>
            </button>

            <button
              onClick={handleCompareToggle}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer shrink-0 ${
                isInCompare 
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{isInCompare ? 'In Compare' : 'Compare'}</span>
            </button>

            <button
              onClick={() => {
                const el = document.getElementById('set-price-alert-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg text-sm font-semibold transition-colors cursor-pointer shrink-0"
            >
              <BellRing className="w-4 h-4 text-rose-500" />
              <span className="hidden sm:inline">Set Price Alert</span>
            </button>

            {isInCompare && (
              <button
                onClick={() => navigate('/compare')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors ml-1 cursor-pointer underline underline-offset-2 shrink-0"
              >
                View Compare &rarr;
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {compareFeedback && (
          <div className="bg-indigo-900 text-white text-xs sm:text-sm font-medium px-4 py-3 rounded-xl flex items-center justify-between shadow-md">
            <span>{compareFeedback}</span>
            <button
              onClick={() => navigate('/compare')}
              className="bg-white text-indigo-900 font-bold px-3 py-1 rounded-lg text-xs hover:bg-indigo-50 transition-colors cursor-pointer"
            >
              Go to Compare &rarr;
            </button>
          </div>
        )}
        
        {/* Main Product Hero */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row gap-8 shadow-sm">
          <div className="md:w-1/3 flex-shrink-0 bg-white border border-slate-100 rounded-xl p-4 flex items-center justify-center aspect-square md:aspect-auto md:h-80">
            <img
              referrerPolicy="no-referrer"
              src={product.image_url || FALLBACK_IMAGE}
              alt={product.name}
              onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
              className="w-full h-full object-contain mix-blend-multiply"
            />
          </div>
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-md border border-indigo-100">
                {product.brand}
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md">
                {product.category_name}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4 leading-tight">
              {product.name}
            </h1>
            {isRealSpec(product.specs_summary) && (
              <p className="text-sm text-slate-500 leading-relaxed mb-6 line-clamp-3">
                {product.specs_summary}
              </p>
            )}
            
            <div className="mt-auto grid grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                <span className="text-xs font-medium text-slate-500 block mb-1">Current Best Price</span>
                <span className="text-2xl font-bold text-emerald-600">
                  {currentLowPrice !== undefined ? formatINR(currentLowPrice) : 'Unavailable'}
                </span>
                {priceHistory.length === 1 && (
                  <span className="block text-[11px] text-slate-400 mt-1 font-normal">
                    Price tracking started on {oldestDateStr}
                  </span>
                )}
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-500 block mb-1">Best Retailer</span>
                  <span className="text-lg font-semibold text-slate-800">
                    {storesPricing[0]?.store_name || 'N/A'}
                  </span>
                </div>
                {storesPricing[0] && storesPricing[0].product_url && (storesPricing[0].product_url.startsWith('http://') || storesPricing[0].product_url.startsWith('https://')) && (
                  <a
                    href={storesPricing[0].product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors shadow-sm shrink-0"
                  >
                    Buy Now
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* AI Buy Now / Wait Deal Advisor Card */}
            <AiDealAdvisorCard productId={product.product_id} product={product} storesPricing={storesPricing} priceHistoryCount={priceHistory.length} />
          </div>
        </div>

        {/* Price History Section */}
        {priceHistory.length >= 2 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-indigo-500" />
                Price History
              </h2>
              <div className="flex items-center bg-slate-100 p-1 rounded-lg gap-1">
                <button
                  key="7"
                  onClick={() => setHistoryPeriod(7)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                    historyPeriod === 7 
                      ? 'bg-white text-slate-900 shadow-sm font-semibold' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  7 Days
                </button>
                <button
                  key="30"
                  onClick={() => setHistoryPeriod(30)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                    historyPeriod === 30 
                      ? 'bg-white text-slate-900 shadow-sm font-semibold' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  30 Days
                </button>
                <div className="relative group">
                  <button
                    key="365"
                    disabled={!has365DayHistory}
                    onClick={() => {
                      if (has365DayHistory) setHistoryPeriod(365);
                    }}
                    title={!has365DayHistory ? "Available once 1 year of price data is collected." : "View 1 Year History"}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      !has365DayHistory
                        ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-100/60'
                        : historyPeriod === 365
                          ? 'bg-white text-slate-900 shadow-sm font-semibold cursor-pointer'
                          : 'text-slate-500 hover:text-slate-700 cursor-pointer'
                    }`}
                  >
                    1 Year
                  </button>
                  {!has365DayHistory && (
                    <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block z-20 w-60 p-2 bg-slate-900 text-white text-[11px] rounded-md shadow-lg text-center pointer-events-none">
                      Available once 1 year of price data is collected.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="h-72 w-full">
              {dedupedChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dedupedChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="dateStr" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#64748b' }} 
                      dy={10}
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [formatINR(value), 'Price']}
                      labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#4f46e5" 
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} 
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#4f46e5' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <Activity className="w-8 h-8 text-slate-400 mb-3" />
                  <p className="text-sm font-medium text-slate-600">No records found for selected period.</p>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8 pt-6 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-500 mb-1 font-medium">Historical Lowest</p>
                <p className="font-bold text-slate-900 text-sm">{historicalLow ? formatINR(historicalLow) : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 font-medium">Historical Highest</p>
                <p className="font-bold text-slate-900 text-sm">{historicalHigh ? formatINR(historicalHigh) : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 font-medium">Average Price</p>
                <p className="font-bold text-slate-900 text-sm">{avgPrice ? formatINR(avgPrice) : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 font-medium">
                  {historyPeriod === 365 ? '1-Year' : `${historyPeriod}-Day`} Trend
                </p>
                {periodPctChange !== null ? (
                  <p className={`font-bold text-sm ${periodPctChange < 0 ? 'text-emerald-600' : periodPctChange > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                    {periodPctChange > 0 ? `+${periodPctChange.toFixed(1)}%` : `${periodPctChange.toFixed(1)}%`}
                  </p>
                ) : (
                  <p className="text-xs font-semibold text-slate-500 italic">Tracking started {oldestDateStr}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 font-medium">Current Status</p>
                {currentLowPrice && historicalLow ? (
                  <p className={`font-bold text-sm ${currentLowPrice <= historicalLow ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {currentLowPrice <= historicalLow ? 'At Lowest Price!' : `+${formatINR(currentLowPrice - historicalLow)}`}
                  </p>
                ) : (
                  <p className="font-bold text-slate-900 text-sm">-</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 ${storesPricing.length > 0 ? 'lg:grid-cols-3' : ''} gap-8`}>
          {/* Retailer Offers */}
          {storesPricing.length > 0 && (
            <div className="lg:col-span-2 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-slate-600" />
                Compare Retailers
              </h2>
              
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="divide-y divide-slate-100">
                  {storesPricing.map((pricing, idx) => {
                    const isBestPrice = idx === 0 || pricing.price === storesPricing[0].price;
                    const parsedPrice = parseFloat(pricing.price as any);
                    const discountInfo = getDiscountInfo(pricing.price, pricing.original_price);
                    const trendInfo = getRetailerTrendInfo(pricing, priceHistory);
                    
                    return (
                      <div key={pricing.price_id} className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-slate-50 ${isBestPrice ? 'bg-indigo-50/30' : ''}`}>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-500 uppercase">
                            {pricing.store_name.substring(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-slate-900">{pricing.store_name}</span>
                              {isBestPrice && (
                                <span className="bg-indigo-100 text-indigo-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                                  Best Price
                                </span>
                              )}
                            </div>
                            {pricing.last_scraped_at && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Clock className="w-3 h-3" />
                                <span>Updated {new Date(pricing.last_scraped_at).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0 mt-1 sm:mt-0">
                          <div className="flex flex-col items-start sm:items-end">
                            <div className="flex items-baseline gap-2">
                              {discountInfo.isValid && (
                                <span className="text-xs font-semibold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">
                                  -{discountInfo.discountPercentage}%
                                </span>
                              )}
                              <span className="text-lg font-bold text-slate-900">{formatINR(parsedPrice)}</span>
                            </div>
                            {discountInfo.isValid && (
                              <span className="text-xs text-slate-400 line-through mt-0.5">{formatINR(discountInfo.originalPrice)}</span>
                            )}
                            {trendInfo && (trendInfo.type === 'down' || trendInfo.type === 'up') && (
                              <div className="mt-1">
                                {trendInfo.type === 'down' && (
                                  <span 
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md"
                                    title={`Previous recorded price: ${formatINR(trendInfo.previousPrice)}`}
                                  >
                                    ↓ {trendInfo.percentage.toFixed(1)}% <span className="font-normal text-[10px] text-emerald-700/80">since last recorded price</span>
                                  </span>
                                )}
                                {trendInfo.type === 'up' && (
                                  <span 
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md"
                                    title={`Previous recorded price: ${formatINR(trendInfo.previousPrice)}`}
                                  >
                                    ↑ {trendInfo.percentage.toFixed(1)}% <span className="font-normal text-[10px] text-rose-700/80">since last recorded price</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {pricing.product_url && (pricing.product_url.startsWith('http://') || pricing.product_url.startsWith('https://')) && (
                            <a
                              href={pricing.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shrink-0"
                            >
                              Buy Now
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Price Alerts */}
          <div id="set-price-alert-section" className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BellRing className="w-5 h-5 text-rose-500" />
              Set Price Alert
            </h2>
            
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
              <p className="text-sm text-slate-600 mb-6">
                Get an email notification instantly when the price drops to or below your target limit.
              </p>
              
              {alertSuccess ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-start gap-3 mb-4">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{alertSuccess}</p>
                </div>
              ) : (
                <form onSubmit={handleCreateThresholdAlert} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Target Price (INR)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                      <input
                        type="number"
                        min="1"
                        value={alertTargetPrice}
                        onChange={(e) => setAlertTargetPrice(e.target.value)}
                        className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none font-medium"
                        placeholder="e.g. 50000"
                        required
                      />
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={submittingAlert}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
                  >
                    {submittingAlert ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <BellRing className="w-4 h-4" />
                        <span>Create Email Alert</span>
                      </>
                    )}
                  </button>
                </form>
              )}
              
              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Activity className="w-4 h-4 text-slate-400" />
                  <span>Current best price: <strong className="text-slate-800">{currentLowPrice ? formatINR(currentLowPrice) : 'N/A'}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsPage;
