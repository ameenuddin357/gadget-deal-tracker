import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  fetchProductDetails, 
  addToWatchlist, 
  createPriceAlert, 
  updatePriceAlert,
  deletePriceAlert,
  fetchWatchlist, 
  fetchPriceAlerts, 
  addSearchHistory, 
  fetchPriceHistory, 
  fetchProductAiRecommendation, 
  sendProductAiChat 
} from '../services/api';
import { Product, StorePricing, PriceAlert } from '../types/frontend';
import { 
  formatINR, 
  formatAxisPrice,
  getDiscountInfo, 
  isRealSpec, 
  getRetailerTrendInfo, 
  getDynamicQuickQuestions,
  validatePriceAlertTarget
} from '../utils/currency';
import { MAX_COMPARE_PRODUCTS, getCompareProductIds, addProductToCompare, isProductInCompare } from '../utils/compare';
import { getDisplayProductType } from '../utils/productType';
import CompareLimitModal from '../components/CompareLimitModal';
import { ArrowLeft, BellRing, BookmarkCheck, Star, ExternalLink, Plus, ShoppingBag, TrendingDown, Clock, ShieldCheck, Activity, AlertCircle, ArrowRightLeft, Scale, Lock, LogIn, CheckCircle, Trash2, Info } from 'lucide-react';
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
      <div id="ai-deal-advisor-card" className="mt-3 sm:mt-4 bg-slate-900 text-white p-3.5 sm:p-4 rounded-xl shadow-xs border border-slate-800 flex flex-col gap-3 transition-all w-full max-w-full overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">🤖</span>
            <div className="min-w-0">
              <h3 id="txt-ai-advisor-title" className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5 truncate">
                AI Deal Advisor
              </h3>
              <span className="text-[10px] text-slate-400 font-normal block truncate">Real-time price intelligence</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-800/50 p-3 sm:p-3.5 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 shrink-0">
              <Lock className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-200">Log in to analyze this deal with AI.</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">Get personalized buy/wait recommendations and dynamic deal intelligence.</p>
            </div>
          </div>
          <button
            id="btn-ai-advisor-login"
            onClick={() => navigate('/login', { state: { from: { pathname: `/products/${productId}`, state: { scrollToAi: true } }, message: 'Please log in to use AI Deal Advisor.' } })}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-xs min-h-[44px] sm:min-h-0"
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
    <div id="ai-deal-advisor-card" className="mt-4 bg-slate-900 text-white p-3.5 sm:p-4 rounded-xl shadow-xs border border-slate-800 flex flex-col gap-3 transition-all w-full max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">🤖</span>
          <div className="min-w-0">
            <h3 id="txt-ai-advisor-title" className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5 truncate">
              AI Deal Advisor
            </h3>
            <span className="text-[10px] text-slate-400 font-normal block truncate">Real-time price intelligence</span>
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
        <div className="flex flex-col gap-2 bg-slate-800/40 p-3 rounded-lg border border-slate-800/60 text-xs w-full min-w-0">
          <div className="flex items-center justify-between border-b border-slate-700/50 pb-2 mb-1">
            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
              {level === 0 ? 'Limited price history' : level === 1 ? 'Level 1 · Limited history' : 'Level 2 · Short-term trend'}
            </span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full min-w-0">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-slate-400">Current price:</span>
              <span className="font-semibold text-slate-200 truncate">{currentPriceFormatted}</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-slate-400">Best retailer:</span>
              <span className="font-semibold text-slate-200 truncate">{bestRetailerName}</span>
            </div>
            {trackingStartedFormatted && (
              <div className="flex flex-col min-w-0 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400">Tracking started:</span>
                <span className="font-semibold text-slate-200 truncate">{trackingStartedFormatted}</span>
              </div>
            )}
          </div>
          
          {recommendation?.data?.insightText && (
            <div className="flex flex-col mt-1 min-w-0">
              <span className="text-[10px] text-slate-400">Price insight:</span>
              <span className="font-medium text-slate-200 break-words">{recommendation.data.insightText}</span>
            </div>
          )}

          <p className="text-[10px] text-slate-400 mt-2 leading-relaxed break-words">
            {level === 0
              ? (recommendation?.message || "Price history is still being collected for this product. As more genuine price data is recorded, smarter Buy/Wait insights will become available.")
              : (recommendation?.data?.subText || "More price history is needed for a reliable Buy/Wait recommendation.")}
          </p>
        </div>
      ) : recommendation?.error ? (
        <p id="txt-ai-advisor-unavailable" className="text-xs text-slate-400 leading-relaxed py-0.5 break-words">
          {recommendation?.message || "AI recommendation temporarily unavailable."}
        </p>
      ) : recommendation?.data ? (
        <div className="flex flex-col gap-2 bg-slate-800/40 p-2.5 rounded-lg border border-slate-800/60 w-full min-w-0">
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
          <p id="txt-ai-advisor-reasoning" className="text-xs text-slate-300 leading-snug break-words">
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
      <div className="flex flex-col gap-1.5 pt-1 w-full min-w-0">
        <span className="text-[11px] font-semibold text-slate-400">Ask about this deal:</span>
        <div className="flex flex-wrap gap-1.5 w-full">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              id={`btn-quick-q-${idx}`}
              onClick={() => handleAskQuestion(q)}
              disabled={isAsking}
              className="text-[11px] bg-slate-800/90 hover:bg-slate-700/80 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-700/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left cursor-pointer break-words max-w-full leading-snug"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Container */}
      {messages.length > 0 && (
        <div id="ai-chat-messages" ref={chatContainerRef} className="max-h-48 overflow-y-auto flex flex-col gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs my-1 w-full min-w-0">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} w-full`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[88%] px-3 py-1.5 rounded-xl text-xs leading-relaxed break-words ${
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
                <div className="break-words">{m.content}</div>
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
        className="flex items-center gap-2 pt-1 w-full max-w-full min-w-0"
      >
        <input
          id="input-ai-chat-question"
          type="text"
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          placeholder="Ask about this deal..."
          disabled={isAsking}
          className="flex-1 min-w-0 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
        />
        <button
          id="btn-ai-chat-send"
          type="submit"
          disabled={!inputQuestion.trim() || isAsking}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors flex items-center justify-center shrink-0 min-w-[55px] min-h-[36px] cursor-pointer disabled:cursor-not-allowed"
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

  // Genuine historical span in days based ONLY on actual backend price_history observations (not generated/carried-forward chart points)
  const has1YearHistory = useMemo(() => {
    if (!priceHistory) return false;

    const validTimestamps = priceHistory
      .map(h => h.date ? new Date(h.date).getTime() : null)
      .filter((t): t is number => t !== null && !isNaN(t))
      .sort((a, b) => a - b);

    if (validTimestamps.length < 2) return false;

    const earliestTime = validTimestamps[0];
    const latestTime = validTimestamps[validTimestamps.length - 1];

    const spanDays = (latestTime - earliestTime) / (1000 * 60 * 60 * 24);

    return spanDays >= 365;
  }, [priceHistory]);

  // Safe fallback: If user was on 1 Year (365) and navigates to a product without >=365 days of genuine history, fallback to 30 Days
  useEffect(() => {
    if (historyPeriod === 365 && !has1YearHistory) {
      setHistoryPeriod(30);
    }
  }, [historyPeriod, has1YearHistory]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isWatched, setIsWatched] = useState<boolean>(false);
  const [addingWatchlist, setAddingWatchlist] = useState<boolean>(false);
  
  const [isInCompare, setIsInCompare] = useState<boolean>(false);

  const [existingAlert, setExistingAlert] = useState<PriceAlert | null>(null);
  const [isEditingAlert, setIsEditingAlert] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [removingAlert, setRemovingAlert] = useState<boolean>(false);
  const [alertTargetPrice, setAlertTargetPrice] = useState<string>('');
  const [submittingAlert, setSubmittingAlert] = useState<boolean>(false);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [isCompareLimitModalOpen, setIsCompareLimitModalOpen] = useState<boolean>(false);
  const [isCompareFull, setIsCompareFull] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;
    const syncCompareState = () => {
      try {
        const pid = parseInt(id, 10);
        const inComp = isProductInCompare(pid);
        setIsInCompare(inComp);
        const currentIds = getCompareProductIds();
        setIsCompareFull(!inComp && currentIds.length >= MAX_COMPARE_PRODUCTS);
      } catch {
        setIsInCompare(false);
        setIsCompareFull(false);
      }
    };

    syncCompareState();
    window.addEventListener('deal-compare-updated', syncCompareState);
    window.addEventListener('storage', syncCompareState);
    return () => {
      window.removeEventListener('deal-compare-updated', syncCompareState);
      window.removeEventListener('storage', syncCompareState);
    };
  }, [id]);

  const handleCompareClick = () => {
    if (!product) return;

    // SECOND CLICK: When already in comparison list, navigate directly to Compare page
    if (isInCompare) {
      navigate('/compare');
      return;
    }

    // FIRST CLICK: Add to compare list without navigating
    try {
      const pid = product.product_id;
      const res = addProductToCompare(pid);

      if (!res.success && res.isFull) {
        setIsCompareLimitModalOpen(true);
        return;
      }

      setIsInCompare(true);
    } catch (e) {
      console.error('Failed to update compare list', e);
    }
  };

  const syncUserData = useCallback(async () => {
    if (!user || !id) {
      setIsWatched(false);
      setExistingAlert(null);
      return;
    }
    const pid = parseInt(id, 10);
    try {
      const [watchlistData, alertsData] = await Promise.all([
        fetchWatchlist().catch(() => []),
        fetchPriceAlerts().catch(() => [])
      ]);

      const inWatchlist = Array.isArray(watchlistData) && watchlistData.some((w: any) => w.product_id === pid);
      setIsWatched(inWatchlist);

      const activeAlert = Array.isArray(alertsData) ? alertsData.find((a: any) => a.product_id === pid && a.is_active !== false) : null;
      if (activeAlert) {
        setExistingAlert(activeAlert);
        setAlertTargetPrice(String(activeAlert.target_price));
      } else {
        setExistingAlert(null);
      }
    } catch (e) {
      console.error('Failed to sync personal user state', e);
    }
  }, [id, user]);

  useEffect(() => {
    if (!id) return;
    const loadDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const detailsRes = await fetchProductDetails(parseInt(id, 10));
        setProduct(detailsRes.product);
        setStoresPricing(detailsRes.storesPricing || []);

        // Fetch history
        try {
          const historyData = await fetchPriceHistory(parseInt(id, 10));
          setPriceHistory(historyData);
        } catch (e) {
          console.error('Failed to load price history', e);
        }

        // Fetch user personal status
        await syncUserData();

      } catch (err: any) {
        setError(err.message || 'Failed to load product details.');
      } finally {
        setLoading(false);
      }
    };
    loadDetails();
  }, [id, syncUserData]);

  useEffect(() => {
    window.addEventListener('alerts-updated', syncUserData);
    window.addEventListener('watchlist-updated', syncUserData);
    return () => {
      window.removeEventListener('alerts-updated', syncUserData);
      window.removeEventListener('watchlist-updated', syncUserData);
    };
  }, [syncUserData]);

  const handleWatchlistClick = async () => {
    // SECOND CLICK: If already on watchlist, navigate directly to Watchlist page
    if (isWatched) {
      navigate('/watchlist');
      return;
    }

    if (!user) {
      navigate('/login', { state: { from: location, message: 'Please log in to view your Saved Gadgets.' } });
      return;
    }
    if (!product) return;
    setAddingWatchlist(true);
    try {
      await addToWatchlist(product.product_id);
      setIsWatched(true);
      window.dispatchEvent(new Event('watchlist-updated'));
    } catch (err: any) {
      if (err?.message?.toLowerCase()?.includes('already')) {
        setIsWatched(true);
      } else {
        alert(err.message || 'Failed to add to watchlist');
      }
    } finally {
      setAddingWatchlist(false);
    }
  };

  const handleSavePriceAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: location, message: 'Please log in to manage price alerts.' } });
      return;
    }
    if (!product) return;

    setAlertError(null);
    setAlertSuccess(null);

    // Validate using shared price alert validator
    const availableStores = storesPricing.filter(s => s.is_available !== false && (typeof s.price === 'number' ? s.price > 0 : parseFloat(String(s.price)) > 0));
    const effectiveLowest = product.cheapest_price || (availableStores.length > 0 ? (typeof availableStores[0].price === 'number' ? availableStores[0].price : parseFloat(String(availableStores[0].price))) : null);

    const validation = validatePriceAlertTarget(alertTargetPrice, effectiveLowest);
    if (!validation.isValid) {
      setAlertError(validation.error || 'Please enter a valid target price.');
      return;
    }

    const targetVal = parseFloat(alertTargetPrice);
    setSubmittingAlert(true);

    try {
      if (existingAlert) {
        // Edit existing alert without creating duplicate
        const res = await updatePriceAlert(existingAlert.alert_id, targetVal);
        const updated = res?.data?.alert || { ...existingAlert, target_price: targetVal, is_active: true };
        setExistingAlert(updated);
        setIsEditingAlert(false);
        setAlertSuccess(`Price alert target updated successfully to ${formatINR(targetVal)}.`);
      } else {
        // Create new alert
        const res = await createPriceAlert(product.product_id, targetVal);
        const created = res?.data?.alert || { alert_id: Date.now(), product_id: product.product_id, target_price: targetVal, is_active: true };
        setExistingAlert(created);
        setIsEditingAlert(false);
        setAlertSuccess(`Price alert successfully created at ${formatINR(targetVal)}! We will notify you via email.`);
      }
      window.dispatchEvent(new Event('alerts-updated'));
    } catch (err: any) {
      setAlertError(err.message || 'Failed to save price alert.');
    } finally {
      setSubmittingAlert(false);
    }
  };

  const handleRemoveAlert = async () => {
    if (!existingAlert?.alert_id) return;
    setRemovingAlert(true);
    setAlertError(null);
    try {
      await deletePriceAlert(existingAlert.alert_id);
      setExistingAlert(null);
      setIsEditingAlert(false);
      setShowDeleteConfirm(false);
      setAlertTargetPrice('');
      setAlertSuccess(null);
      window.dispatchEvent(new Event('alerts-updated'));
    } catch (err: any) {
      setAlertError(err?.message || 'Unable to remove the price alert. Please try again.');
    } finally {
      setRemovingAlert(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center p-8">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium text-slate-500">Loading product details...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="py-20 flex flex-col items-center justify-center p-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Product Not Found</h2>
          <p className="text-slate-500 mb-6">{error || 'We could not locate this product in our catalogue.'}</p>
          <Link to="/products" className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            Return to Search Gadgets
          </Link>
        </div>
      </div>
    );
  }

  // --- PRICE HISTORY NORMALIZATION & LAST-KNOWN BASELINE PIPELINE ---
  const rawStorePrices = storesPricing
    .map(s => typeof s.price === 'number' ? s.price : parseFloat(String(s.price)))
    .filter(p => !isNaN(p) && p > 0);
  const currentLowPrice = rawStorePrices.length > 0 
    ? Math.min(...rawStorePrices) 
    : (product?.cheapest_price && product.cheapest_price > 0 ? product.cheapest_price : undefined);

  // 1. Normalize and validate all recorded historical observations from PostgreSQL
  const validHistoryPoints = (priceHistory || [])
    .map(h => {
      const parsedPrice = typeof h.price === 'number' ? h.price : parseFloat(String(h.price));
      const parsedDate = h.date ? new Date(h.date) : null;
      return {
        date: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null,
        price: !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : null,
        store: h.store_name || 'Store'
      };
    })
    .filter((p): p is { date: Date; price: number; store: string } => p.date !== null && p.price !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // 2. Group all observations by day (YYYY-MM-DD), picking the lowest retailer price on that day
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const allDailyMap: Record<string, number> = {};

  validHistoryPoints.forEach(pt => {
    const key = format(pt.date, 'yyyy-MM-dd');
    // For past completed days, retain lowest recorded observation for that day
    if (key < todayKey) {
      if (allDailyMap[key] === undefined || pt.price < allDailyMap[key]) {
        allDailyMap[key] = pt.price;
      }
    } else {
      // For today, if no live store pricing is known yet, record historical point as temporary fallback
      if (allDailyMap[key] === undefined) {
        allDailyMap[key] = pt.price;
      }
    }
  });

  // If we have legitimate historical tracking points, the PRESENT/today endpoint MUST represent the genuine current best live price
  // This correctly preserves same-day price drops and same-day price increases without hiding live reality.
  if (validHistoryPoints.length > 0 && currentLowPrice !== undefined && !isNaN(currentLowPrice) && currentLowPrice > 0) {
    allDailyMap[todayKey] = currentLowPrice;
  }

  const allDailyObservations = Object.entries(allDailyMap)
    .map(([dayKey, price]) => ({ dayKey, price }))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));

  // 3. Construct selected-period visualization series using LAST-KNOWN-PRICE BASELINE logic
  const cutoffDate = subDays(new Date(), historyPeriod);
  const cutoffDayKey = format(cutoffDate, 'yyyy-MM-dd');

  let dedupedChartData: Array<{ dateStr: string; price: number; isCarriedForward?: boolean }> = [];

  if (allDailyObservations.length > 0) {
    // Find latest valid observation at or before cutoffDate
    const preCutoffObs = allDailyObservations
      .filter(obs => obs.dayKey <= cutoffDayKey)
      .pop();

    // Find observations inside the selected period
    const inPeriodObs = allDailyObservations.filter(obs => obs.dayKey > cutoffDayKey);

    // Starting baseline: use latest pre-cutoff price if available; otherwise first in-period price or only known price
    let activePrice: number = preCutoffObs
      ? preCutoffObs.price
      : (inPeriodObs.length > 0 ? inPeriodObs[0].price : allDailyObservations[allDailyObservations.length - 1].price);

    // If pre-cutoff observation exists, window starts at cutoffDate. Otherwise start from earliest known observation
    // NEVER extend the line backward before the first ever known observation date.
    const startDayKey = preCutoffObs ? cutoffDayKey : (inPeriodObs[0]?.dayKey || allDailyObservations[0].dayKey);

    let curr = new Date(startDayKey + 'T00:00:00');
    if (isNaN(curr.getTime())) {
      curr = new Date(cutoffDate);
    }
    curr.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    while (curr <= end) {
      const currDayKey = format(curr, 'yyyy-MM-dd');
      const displayKey = format(curr, 'MMM dd');

      if (allDailyMap[currDayKey] !== undefined) {
        activePrice = allDailyMap[currDayKey];
        dedupedChartData.push({
          dateStr: displayKey,
          price: activePrice,
          isCarriedForward: false
        });
      } else {
        dedupedChartData.push({
          dateStr: displayKey,
          price: activePrice,
          isCarriedForward: true
        });
      }
      curr.setDate(curr.getDate() + 1);
    }
  }

  // 4. Compute Period-Synchronized Metrics from the active normalized dataset
  const periodPrices = dedupedChartData.map(d => d.price).filter(p => !isNaN(p) && p > 0);
  const periodLow = periodPrices.length > 0 ? Math.min(...periodPrices) : currentLowPrice;
  const periodHigh = periodPrices.length > 0 ? Math.max(...periodPrices) : currentLowPrice;
  const periodAvg = periodPrices.length > 0 
    ? Math.round(periodPrices.reduce((a, b) => a + b, 0) / periodPrices.length)
    : currentLowPrice;

  // Selected period trend calculation
  let periodPctChange: number | null = null;
  if (periodPrices.length >= 2) {
    const oldestPrice = periodPrices[0];
    const newestPrice = periodPrices[periodPrices.length - 1];
    if (oldestPrice > 0) {
      periodPctChange = ((newestPrice - oldestPrice) / oldestPrice) * 100;
    }
  }

  const oldestDateStr = validHistoryPoints.length > 0 
    ? format(validHistoryPoints[0].date, 'MMM dd, yyyy') 
    : (product?.created_at ? format(new Date(product.created_at), 'MMM dd, yyyy') : 'recently');

  // Custom Dot Renderer: Avoids misleading 28/30/365 dots when only 1 observation exists
  const renderCustomDot = (props: any) => {
    const { cx, cy, index, payload } = props;
    if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return null;

    // When there is only 1 genuine observation, do NOT render individual dots for every carried forward day
    // Only render markers at the genuine observation start point and today's endpoint
    if (validHistoryPoints.length === 1) {
      if (index === 0 || index === dedupedChartData.length - 1) {
        return (
          <circle
            key={`dot-${index}`}
            cx={cx}
            cy={cy}
            r={4}
            fill="#4f46e5"
            stroke="#ffffff"
            strokeWidth={2}
          />
        );
      }
      return null;
    }

    // For multiple observations: only show dots on genuine recorded observations or endpoints
    if (!payload?.isCarriedForward || index === 0 || index === dedupedChartData.length - 1) {
      return (
        <circle
          key={`dot-${index}`}
          cx={cx}
          cy={cy}
          r={3.5}
          fill="#4f46e5"
          stroke="#ffffff"
          strokeWidth={1.5}
        />
      );
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col gap-4 sm:gap-6 font-sans w-full max-w-full overflow-hidden">
      {/* Top Navigation */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-3 sm:px-4 shadow-xs sticky top-0 z-30">
        <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer shrink-0 min-h-[44px] py-2 px-3 rounded-xl hover:bg-slate-100 border border-slate-200/70 shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              id="btn-product-ai-advisor-jump"
              onClick={() => {
                const el = document.getElementById('ai-deal-advisor-card');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 text-white hover:bg-slate-800 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs min-h-[44px]"
              title="Ask AI Deal Advisor"
            >
              <span className="text-sm leading-none">🤖</span>
              <span className="hidden sm:inline">AI Deal Advisor</span>
              <span className="sm:hidden text-xs font-semibold">Advisor</span>
            </button>

            <button
              onClick={handleWatchlistClick}
              disabled={addingWatchlist}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed min-h-[44px] min-w-[44px] border ${
                isWatched 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-2xs'
              }`}
              title={isWatched ? 'In Saved Gadgets' : 'Add to Saved Gadgets'}
            >
              <BookmarkCheck className={`w-4 h-4 shrink-0 ${isWatched ? 'text-emerald-500' : 'text-slate-400'}`} />
              <span className="hidden md:inline">{addingWatchlist ? 'Saving...' : isWatched ? 'Saved' : 'Save'}</span>
            </button>

            <button
              id="btn-product-details-compare"
              onClick={handleCompareClick}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shrink-0 min-h-[44px] ${
                isInCompare 
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100' 
                  : isCompareFull
                    ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
              }`}
              title={
                isInCompare 
                  ? "In Compare (Click to View Comparison)" 
                  : isCompareFull 
                    ? "Compare list full (4/4) - Tap to replace" 
                    : "Add to Compare"
              }
            >
              <ArrowRightLeft className="w-4 h-4 shrink-0" />
              <span>{isInCompare ? 'In Compare' : isCompareFull ? 'Compare (4/4)' : 'Compare'}</span>
            </button>

            <button
              onClick={() => {
                if (existingAlert) {
                  navigate('/alerts');
                } else {
                  const el = document.getElementById('set-price-alert-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0 min-h-[44px] min-w-[44px] border ${
                existingAlert
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
              }`}
              title={existingAlert ? 'Price Alert Active' : 'Set Price Alert'}
            >
              <BellRing className={`w-4 h-4 shrink-0 ${existingAlert ? 'text-emerald-500' : 'text-rose-500'}`} />
              <span className="hidden md:inline">{existingAlert ? 'Alert Set' : 'Price Alert'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:gap-8">
        
        {/* Main Product Hero */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 md:p-8 flex flex-col md:flex-row gap-5 sm:gap-6 md:gap-8 shadow-sm">
          <div className="w-full md:w-1/3 flex-shrink-0 bg-white border border-slate-100 rounded-xl p-3 sm:p-4 flex items-center justify-center h-48 sm:h-64 md:h-80 max-w-full overflow-hidden">
            <img
              referrerPolicy="no-referrer"
              src={product.image_url || FALLBACK_IMAGE}
              alt={product.name}
              onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
              className="max-h-full max-w-full object-contain mix-blend-multiply"
            />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-2 mb-2 sm:mb-3 flex-wrap">
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-md border border-indigo-100">
                {product.brand}
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md">
                {getDisplayProductType(product)}
              </span>
            </div>
            <h1 className="text-base sm:text-2xl lg:text-3xl font-bold text-slate-900 mb-2.5 sm:mb-4 leading-snug sm:leading-tight break-words">
              {product.name}
            </h1>
            {isRealSpec(product.specs_summary) && (
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-3 sm:mb-6 line-clamp-3 break-words">
                {product.specs_summary}
              </p>
            )}
            
            <div className="mt-auto flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
                <div className="bg-slate-50 border border-slate-100 p-3 sm:p-4 rounded-xl flex flex-col justify-center min-w-0">
                  <span className="text-xs font-medium text-slate-500 block mb-0.5 sm:mb-1">Current Best Price</span>
                  <span className="text-xl sm:text-2xl font-bold text-emerald-600 truncate">
                    {currentLowPrice !== undefined ? formatINR(currentLowPrice) : 'Unavailable'}
                  </span>
                  {validHistoryPoints.length === 1 && (
                    <span className="block text-[11px] text-slate-400 mt-0.5 sm:mt-1 font-normal truncate">
                      Price tracking started {oldestDateStr}
                    </span>
                  )}
                </div>
                <div className="bg-slate-50 border border-slate-100 p-3 sm:p-4 rounded-xl flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 sm:gap-3 min-w-0">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-slate-500 block mb-0.5 sm:mb-1 whitespace-nowrap">Best Retailer</span>
                    {storesPricing[0] && storesPricing[0].product_url && (storesPricing[0].product_url.startsWith('http://') || storesPricing[0].product_url.startsWith('https://')) ? (
                      <a
                        href={storesPricing[0].product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm sm:text-base xl:text-lg font-semibold text-slate-800 hover:text-indigo-600 hover:underline transition-colors cursor-pointer inline-flex items-center gap-1.5 max-w-full truncate"
                        title={`Visit ${storesPricing[0].store_name}`}
                      >
                        <span className="truncate">{storesPricing[0]?.store_name}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-sm sm:text-base xl:text-lg font-semibold text-slate-800 truncate block">
                        {storesPricing[0]?.store_name || 'N/A'}
                      </span>
                    )}
                  </div>
                  {storesPricing[0] && storesPricing[0].product_url && (storesPricing[0].product_url.startsWith('http://') || storesPricing[0].product_url.startsWith('https://')) && (
                    <a
                      id="btn-product-buy-now"
                      href={storesPricing[0].product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2.5 xl:py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer w-full xl:w-auto shrink-0 min-h-[44px]"
                    >
                      <span>Buy Now</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* AI Buy Now / Wait Deal Advisor Card */}
            <AiDealAdvisorCard productId={product.product_id} product={product} storesPricing={storesPricing} priceHistoryCount={priceHistory.length} />
          </div>
        </div>

        {/* Price History Section - Supports 0, 1, and 2+ records */}
        <div id="price-history-section" className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-6 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 mb-4 sm:mb-6">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 shrink-0" />
                  <span>Best Price History</span>
                </h2>
                {validHistoryPoints.length === 1 && (
                  <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200">
                    Limited History · 1 observation
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Lowest tracked price across available retailers.
              </p>
            </div>

            {validHistoryPoints.length > 0 && (
              <div className="flex items-center bg-slate-100 p-1 rounded-lg gap-1 self-start sm:self-auto">
                <button
                  id="btn-history-period-7d"
                  key="7"
                  onClick={() => setHistoryPeriod(7)}
                  className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer min-h-[36px] flex items-center justify-center ${
                    historyPeriod === 7 
                      ? 'bg-white text-slate-900 shadow-xs font-semibold' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  7 Days
                </button>
                <button
                  id="btn-history-period-30d"
                  key="30"
                  onClick={() => setHistoryPeriod(30)}
                  className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer min-h-[36px] flex items-center justify-center ${
                    historyPeriod === 30 
                      ? 'bg-white text-slate-900 shadow-xs font-semibold' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  30 Days
                </button>
                {has1YearHistory && (
                  <button
                    id="btn-history-period-1y"
                    key="365"
                    onClick={() => setHistoryPeriod(365)}
                    className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer min-h-[36px] flex items-center justify-center ${
                      historyPeriod === 365 
                        ? 'bg-white text-slate-900 shadow-xs font-semibold' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    1 Year
                  </button>
                )}
              </div>
            )}
          </div>

          {validHistoryPoints.length === 0 ? (
            /* Zero History State */
            <div className="py-8 sm:py-10 px-3 sm:px-4 flex flex-col items-center justify-center text-center bg-slate-50/70 border-2 border-dashed border-slate-200 rounded-xl">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-2.5 sm:mb-3 text-indigo-600">
                <Activity className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 mb-1">Price tracking has started</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 max-w-md mb-3 sm:mb-4 leading-relaxed">
                Historical price changes and trend charts will appear as more price observations are recorded across retailers over time.
              </p>
              {currentLowPrice !== undefined && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 font-semibold shadow-xs">
                  <span>Current Best Price:</span>
                  <span className="text-emerald-600 font-bold">{formatINR(currentLowPrice)}</span>
                </div>
              )}
            </div>
          ) : (
            /* 1+ History Records Chart & Metrics */
            <>
              {validHistoryPoints.length === 1 && (
                <div className="mb-3 px-3 py-2 bg-indigo-50/60 border border-indigo-100/80 rounded-lg text-xs text-indigo-900 flex items-center gap-2 leading-relaxed">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    {currentLowPrice !== undefined && Math.abs(currentLowPrice - validHistoryPoints[0].price) > 0.01
                      ? `Tracking started at ${formatINR(validHistoryPoints[0].price)} on ${oldestDateStr}. Current price is ${formatINR(currentLowPrice)}.`
                      : `Only one recorded price so far (${formatINR(validHistoryPoints[0].price)} recorded on ${oldestDateStr}). Displaying steady baseline.`}
                  </span>
                </div>
              )}

              <div className="h-52 sm:h-72 w-full max-w-full overflow-hidden">
                {dedupedChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dedupedChartData} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="dateStr" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#64748b' }} 
                        minTickGap={20}
                        dy={6}
                      />
                      <YAxis 
                        domain={[
                          (dataMin: number) => {
                            if (typeof dataMin !== 'number' || isNaN(dataMin)) return 'auto';
                            return Math.max(0, Math.floor(dataMin * 0.95));
                          },
                          (dataMax: number) => {
                            if (typeof dataMax !== 'number' || isNaN(dataMax)) return 'auto';
                            return Math.ceil(dataMax * 1.05);
                          }
                        ]}
                        width={56}
                        axisLine={false} 
                        tickLine={false} 
                        tickMargin={4}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={formatAxisPrice}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#0f172a', 
                          borderRadius: '8px', 
                          border: 'none', 
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          color: '#fff',
                          fontSize: '12px',
                          padding: '8px 12px'
                        }}
                        itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                        formatter={(value: number) => [formatINR(value), 'Price']}
                        labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#4f46e5" 
                        strokeWidth={2.5}
                        dot={renderCustomDot} 
                        activeDot={{ r: 5, strokeWidth: 0, fill: '#4f46e5' }}
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
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-4 mt-4 sm:mt-8 pt-3.5 sm:pt-6 border-t border-slate-100">
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1 font-medium">Lowest Price</p>
                  <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">{periodLow ? formatINR(periodLow) : '-'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1 font-medium">Highest Price</p>
                  <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">{periodHigh ? formatINR(periodHigh) : '-'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1 font-medium">Average Price</p>
                  <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">{periodAvg ? formatINR(periodAvg) : '-'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1 font-medium">
                    {historyPeriod === 365 ? '1-Year' : historyPeriod === 30 ? '30-Day' : '7-Day'} Trend
                  </p>
                  {periodPctChange !== null && dedupedChartData.length >= 2 ? (
                    <p className={`font-bold text-xs sm:text-sm truncate ${periodPctChange < 0 ? 'text-emerald-600' : periodPctChange > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                      {periodPctChange > 0 ? `+${periodPctChange.toFixed(1)}%` : periodPctChange < 0 ? `${periodPctChange.toFixed(1)}%` : 'Stable (0.0%)'}
                    </p>
                  ) : (
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 italic truncate">Started {oldestDateStr}</p>
                  )}
                </div>
                <div className="min-w-0 col-span-2 sm:col-span-1">
                  <p className="text-[11px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1 font-medium">Current Status</p>
                  {validHistoryPoints.length < 2 ? (
                    <p className="font-semibold text-slate-500 text-xs mt-0.5">Tracking Started</p>
                  ) : currentLowPrice !== undefined && periodLow !== undefined ? (
                    <p className={`font-bold text-xs sm:text-sm truncate ${currentLowPrice <= periodLow ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {currentLowPrice <= periodLow ? 'At Lowest Price!' : `+${formatINR(currentLowPrice - periodLow)}`}
                    </p>
                  ) : (
                    <p className="font-bold text-slate-900 text-xs sm:text-sm">-</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className={`grid grid-cols-1 ${storesPricing.length > 0 ? 'lg:grid-cols-3' : ''} gap-4 sm:gap-8`}>
          {/* Retailer Offers */}
          {storesPricing.length > 0 && (
            <div id="compare-retailers-section" className="lg:col-span-2 flex flex-col gap-3 sm:gap-4 scroll-mt-24">
              <button
                type="button"
                onClick={() => {
                  if (product) {
                    navigate(`/compare?mode=retailers&productId=${product.product_id}`, {
                      state: { mode: 'retailers', productId: product.product_id }
                    });
                  }
                }}
                className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 text-left cursor-pointer hover:text-indigo-600 transition-colors w-fit group"
                title="Compare Retailers"
              >
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 group-hover:text-indigo-600 transition-colors" />
                <span>Compare Retailers</span>
              </button>
              
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="divide-y divide-slate-100">
                  {storesPricing.map((pricing, idx) => {
                    const isBestPrice = idx === 0 || pricing.price === storesPricing[0].price;
                    const parsedPrice = parseFloat(pricing.price as any);
                    const discountInfo = getDiscountInfo(pricing.price, pricing.original_price);
                    const trendInfo = getRetailerTrendInfo(pricing, priceHistory);
                    const hasValidUrl = Boolean(
                      pricing.product_url && (pricing.product_url.startsWith('http://') || pricing.product_url.startsWith('https://'))
                    );
                    
                    return (
                      <div key={pricing.price_id} className={`p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 transition-colors hover:bg-slate-50 ${isBestPrice ? 'bg-indigo-50/30' : ''}`}>
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                          {hasValidUrl ? (
                            <a
                              href={pricing.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center font-bold text-slate-500 text-xs sm:text-sm uppercase transition-colors cursor-pointer shrink-0"
                              title={`Visit ${pricing.store_name}`}
                            >
                              {pricing.store_name.substring(0, 2)}
                            </a>
                          ) : (
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-500 text-xs sm:text-sm uppercase shrink-0">
                              {pricing.store_name.substring(0, 2)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1 flex-wrap">
                              {hasValidUrl ? (
                                <a
                                  href={pricing.product_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs sm:text-base font-semibold text-slate-900 hover:text-indigo-600 hover:underline transition-colors cursor-pointer inline-flex items-center gap-1 max-w-full truncate"
                                  title={`Visit ${pricing.store_name}`}
                                >
                                  <span className="truncate">{pricing.store_name}</span>
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                </a>
                              ) : (
                                <span className="text-xs sm:text-base font-semibold text-slate-900 truncate">{pricing.store_name}</span>
                              )}
                              {isBestPrice && (
                                <span className="bg-indigo-100 text-indigo-700 text-[9px] sm:text-[10px] uppercase font-bold px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
                                  Best Price
                                </span>
                              )}
                            </div>
                            {pricing.last_scraped_at && (
                              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500">
                                <Clock className="w-3 h-3 shrink-0" />
                                <span className="truncate">Updated {new Date(pricing.last_scraped_at).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 sm:w-auto w-full border-t sm:border-t-0 border-slate-100 pt-2.5 sm:pt-0 mt-0.5 sm:mt-0">
                          <div className="flex flex-col items-start sm:items-end min-w-0">
                            <div className="flex items-baseline gap-1.5 sm:gap-2">
                              {discountInfo.isValid && (
                                <span className="text-[10px] sm:text-xs font-semibold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">
                                  -{discountInfo.discountPercentage}%
                                </span>
                              )}
                              <span className="text-base sm:text-lg font-bold text-slate-900">{formatINR(parsedPrice)}</span>
                            </div>
                            {discountInfo.isValid && (
                              <span className="text-[11px] sm:text-xs text-slate-400 line-through mt-0.5">{formatINR(discountInfo.originalPrice)}</span>
                            )}
                            {trendInfo && (trendInfo.type === 'down' || trendInfo.type === 'up') && (
                              <div className="mt-1">
                                {trendInfo.type === 'down' && (
                                  <span 
                                    className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-md"
                                    title={`Previous recorded price: ${formatINR(trendInfo.previousPrice)}`}
                                  >
                                    ↓ {trendInfo.percentage.toFixed(1)}% <span className="font-normal text-[9px] sm:text-[10px] text-emerald-700/80 hidden sm:inline">since last recorded price</span>
                                  </span>
                                )}
                                {trendInfo.type === 'up' && (
                                  <span 
                                    className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-rose-600 bg-rose-50 px-1.5 sm:px-2 py-0.5 rounded-md"
                                    title={`Previous recorded price: ${formatINR(trendInfo.previousPrice)}`}
                                  >
                                    ↑ {trendInfo.percentage.toFixed(1)}% <span className="font-normal text-[9px] sm:text-[10px] text-rose-700/80 hidden sm:inline">since last recorded price</span>
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
                              className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 min-h-[44px] sm:min-h-0"
                            >
                              <span>Buy Now</span>
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

          {/* Price Alerts Section */}
          <div id="set-price-alert-section" className="flex flex-col gap-3 sm:gap-4 scroll-mt-24">
            {existingAlert && !isEditingAlert ? (
              <button
                type="button"
                onClick={() => navigate('/alerts')}
                className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 text-left cursor-pointer hover:text-emerald-700 transition-colors w-fit group"
                title="View all Price Alerts"
              >
                <BellRing className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 group-hover:scale-105 transition-transform shrink-0" />
                <span className="group-hover:underline">Price Alert Active</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('alert-target-price-input');
                  if (input) {
                    input.focus();
                  } else {
                    const el = document.getElementById('set-price-alert-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 text-left cursor-pointer hover:text-rose-600 transition-colors w-fit group"
              >
                <BellRing className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500 group-hover:scale-105 transition-transform shrink-0" />
                <span>{isEditingAlert ? 'Edit Price Alert' : 'Set Price Alert'}</span>
              </button>
            )}
            
            <div className="bg-white border border-slate-200 p-4 sm:p-6 rounded-2xl shadow-sm">
              {existingAlert && !isEditingAlert ? (
                /* Recognized Active Alert UI */
                <div className="flex flex-col gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 p-3 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs font-semibold text-emerald-800 uppercase tracking-wider">Price Alert Active</p>
                      <p className="text-xs sm:text-sm font-medium text-emerald-950 mt-0.5">
                        Current target: <strong className="font-bold text-emerald-900">{formatINR(existingAlert.target_price)}</strong>
                      </p>
                    </div>
                    <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                      Tracking
                    </span>
                  </div>

                  {alertSuccess && (
                    <div className="bg-slate-50 border border-slate-200 text-slate-700 p-3 sm:p-3.5 rounded-xl text-xs font-medium flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{alertSuccess}</span>
                    </div>
                  )}

                  <p className="text-xs text-slate-500 leading-relaxed">
                    We are actively tracking prices for this product. You will receive an email as soon as the price drops to or below <strong className="text-slate-700 font-semibold">{formatINR(existingAlert.target_price)}</strong>.
                  </p>

                  {alertError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 sm:p-3.5 rounded-xl text-xs font-medium flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <span>{alertError}</span>
                    </div>
                  )}

                  {showDeleteConfirm ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
                      <div className="flex items-center gap-2 text-xs font-semibold text-rose-800">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Remove this price alert?</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={removingAlert}
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 sm:flex-initial px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed min-h-[40px] flex items-center justify-center"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={removingAlert}
                          onClick={handleRemoveAlert}
                          className="flex-1 sm:flex-initial px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-xs min-h-[40px]"
                        >
                          {removingAlert ? (
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          <span>{removingAlert ? 'Removing...' : 'Remove'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1 sm:pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAlertTargetPrice(String(existingAlert.target_price));
                          setAlertError(null);
                          setAlertSuccess(null);
                          setIsEditingAlert(true);
                        }}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs min-h-[44px]"
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        <span>Edit Alert</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAlertError(null);
                          setShowDeleteConfirm(true);
                        }}
                        className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer min-h-[44px] flex items-center justify-center"
                      >
                        Remove Alert
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Alert Creation / Editing Form */
                <form onSubmit={handleSavePriceAlert} className="flex flex-col gap-3.5 sm:gap-4">
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {isEditingAlert 
                      ? 'Update your target price threshold below. We will notify you when the price reaches this amount.'
                      : 'Get an email notification instantly when the price drops to or below your target limit.'}
                  </p>

                  {alertError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 sm:p-3.5 rounded-xl text-xs font-medium flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <span>{alertError}</span>
                    </div>
                  )}

                  {alertSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 sm:p-3.5 rounded-xl text-xs font-medium flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{alertSuccess}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Target Price (INR)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                      <input
                        id="alert-target-price-input"
                        type="number"
                        min="1"
                        value={alertTargetPrice}
                        onChange={(e) => {
                          setAlertTargetPrice(e.target.value);
                          if (alertError) setAlertError(null);
                        }}
                        className="w-full pl-8 pr-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none font-medium text-slate-900 text-sm sm:text-base min-h-[44px]"
                        placeholder={currentLowPrice ? `e.g. ${Math.round(currentLowPrice * 0.85)}` : 'e.g. 50000'}
                        required
                      />
                    </div>
                    {currentLowPrice && (
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        Current best: <strong className="text-slate-700">{formatINR(currentLowPrice)}</strong> (Minimum target: {formatINR(Math.ceil(currentLowPrice * 0.10))})
                      </p>
                    )}
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                    <button
                      type="submit"
                      disabled={submittingAlert}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold py-2.5 sm:py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 shadow-xs min-h-[44px] text-xs sm:text-sm"
                    >
                      {submittingAlert ? (
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      ) : (
                        <>
                          <BellRing className="w-4 h-4" />
                          <span>{isEditingAlert ? 'Save Target Price' : 'Create Email Alert'}</span>
                        </>
                      )}
                    </button>
                    {isEditingAlert && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingAlert(false);
                          setAlertError(null);
                          if (existingAlert) {
                            setAlertTargetPrice(String(existingAlert.target_price));
                          }
                        }}
                        className="px-4 py-2.5 sm:py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer min-h-[44px] flex items-center justify-center"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              )}
              
              <div className="mt-4 sm:mt-6 pt-3.5 sm:pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Activity className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">Current best price: <strong className="text-slate-800">{currentLowPrice ? formatINR(currentLowPrice) : 'N/A'}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compare Limit Modal */}
      <CompareLimitModal
        isOpen={isCompareLimitModalOpen}
        onClose={() => setIsCompareLimitModalOpen(false)}
        pendingProduct={product}
        onReplaceSuccess={() => {
          setIsInCompare(true);
        }}
      />
    </div>
  );
};

export default ProductDetailsPage;
