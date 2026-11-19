import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Package, ShoppingBag, Database, Activity, 
  RefreshCw, AlertCircle, Calendar, CheckCircle2, Clock, 
  Layers, HardDrive, Cpu, ExternalLink, ArrowUpRight,
  Mail, X, Eye, EyeOff
} from 'lucide-react';
import { fetchAdminReport, updateAdminEmail } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AdminReport } from '../../types/frontend';

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [report, setReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Admin Change Email modal state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>('');
  const [confirmEmail, setConfirmEmail] = useState<string>('');
  const [isSubmittingEmail, setIsSubmittingEmail] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const handleEmailChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingEmail) return;

    setModalError(null);

    const trimmedNew = newEmail.trim().toLowerCase();
    const trimmedConfirm = confirmEmail.trim().toLowerCase();

    if (!currentPassword) {
      setModalError('Please enter your current password.');
      return;
    }

    if (!trimmedNew || !trimmedConfirm) {
      setModalError('Please enter and confirm your new email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedNew)) {
      setModalError('Please provide a valid new email address.');
      return;
    }

    if (trimmedNew !== trimmedConfirm) {
      setModalError('New email and confirmation email do not match.');
      return;
    }

    if (user?.email && trimmedNew === user.email.trim().toLowerCase()) {
      setModalError('New email must be different from your current email.');
      return;
    }

    setIsSubmittingEmail(true);

    try {
      await updateAdminEmail({
        currentPassword,
        newEmail: trimmedNew,
        confirmEmail: trimmedConfirm
      });

      // On success:
      // - logout
      // - clear deal_token and deal_user
      // - redirect to /login with flash notice:
      //   "Admin email changed successfully. Please sign in with your new email."
      logout();
      localStorage.removeItem('deal_token');
      localStorage.removeItem('deal_user');
      navigate('/login', {
        state: {
          message: 'Admin email changed successfully. Please sign in with your new email.'
        },
        replace: true
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update email. Please verify your credentials and try again.';
      setModalError(msg);
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const loadReport = async (isManualRefresh = false) => {
    if (isManualRefresh && isRefreshing) {
      return;
    }
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await fetchAdminReport();
      setReport(data);
      if (isManualRefresh) {
        showToast('Dashboard metrics refreshed successfully.', 'success');
      }
    } catch (err: any) {
      const msg = err?.message || err?.error || 'Failed to load administrator report. Please try again.';
      setError(msg);
      if (isManualRefresh) {
        showToast('Failed to refresh dashboard metrics.', 'error');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  // Derive counts cleanly from source_breakdown accounting for all data_source records
  const sourceBreakdown = report?.source_breakdown || [];

  let googleCount = 0;
  let amazonCount = 0;
  let manualCount = 0;
  let seededCount = 0;
  let otherCount = 0;

  sourceBreakdown.forEach((item) => {
    const rawSrc = (item.source || '').toLowerCase().trim();
    const count = Number(item.count) || 0;
    if (rawSrc === 'live_google' || rawSrc === 'google') {
      googleCount += count;
    } else if (rawSrc === 'live_amazon' || rawSrc === 'amazon') {
      amazonCount += count;
    } else if (rawSrc === 'manual') {
      manualCount += count;
    } else if (rawSrc === 'synthetic' || rawSrc === 'seed' || rawSrc === 'seeded') {
      seededCount += count;
    } else {
      otherCount += count;
    }
  });

  const manualSeededCombinedCount = manualCount + seededCount;
  const computedTotal = googleCount + amazonCount + manualCount + seededCount + otherCount;
  const totalProducts = report?.total_products ?? computedTotal;

  const externalIngestionSourcesCount = (googleCount > 0 ? 1 : 0) + (amazonCount > 0 ? 1 : 0);

  const sourceDisplayItems = [
    {
      key: 'google',
      label: 'Google',
      count: googleCount,
      colorClass: 'bg-blue-500',
      pct: totalProducts > 0 ? (googleCount / totalProducts) * 100 : 0
    },
    {
      key: 'amazon',
      label: 'Amazon',
      count: amazonCount,
      colorClass: 'bg-amber-500',
      pct: totalProducts > 0 ? (amazonCount / totalProducts) * 100 : 0
    },
    {
      key: 'manual',
      label: 'Manual',
      count: manualCount,
      colorClass: 'bg-purple-500',
      pct: totalProducts > 0 ? (manualCount / totalProducts) * 100 : 0
    },
    {
      key: 'seeded',
      label: 'Seeded Baseline',
      count: seededCount,
      colorClass: 'bg-slate-500',
      pct: totalProducts > 0 ? (seededCount / totalProducts) * 100 : 0
    },
    ...(otherCount > 0 ? [{
      key: 'other',
      label: 'Other Sources',
      count: otherCount,
      colorClass: 'bg-zinc-400',
      pct: totalProducts > 0 ? (otherCount / totalProducts) * 100 : 0
    }] : [])
  ];

  // Format date helper
  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div 
        id="admin-loading-container"
        className="py-20 sm:py-28 flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-xs sm:text-sm font-semibold text-slate-600">
          Loading system telemetry & catalogue metrics...
        </p>
        <span className="text-[11px] text-slate-400 mt-1">Verifying administrative authorization</span>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div 
        id="admin-error-container"
        className="py-12 sm:py-16 max-w-xl mx-auto px-4"
      >
        <div className="bg-white border border-red-200 rounded-2xl p-6 sm:p-8 shadow-xs text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Unable to Load Admin Report</h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
            {error}
          </p>
          <button
            id="btn-admin-retry"
            type="button"
            onClick={() => loadReport(false)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-xs min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Connection</span>
          </button>
        </div>
      </div>
    );
  }

  const quota = report?.quota_dashboard;

  return (
    <div id="admin-dashboard-page" className="flex-1 flex flex-col gap-6 sm:gap-8 font-sans pb-8">
      
      {/* Toast Notification */}
      {toast && (
        <div 
          role="status"
          aria-live="polite"
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 w-auto max-w-[calc(100%-32px)] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs sm:text-sm font-semibold transition-all ${
            toast.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 1. Header Banner & Identity */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span 
                id="badge-admin-access"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span>Admin Access</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>System Operational</span>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              Manage catalogue data, retailer sources, and system health.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center">
            <button
              id="btn-admin-refresh"
              type="button"
              onClick={() => {
                if (!isRefreshing) {
                  loadReport(true);
                }
              }}
              disabled={isRefreshing}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed min-h-[40px]"
              title="Refresh Telemetry Metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Metrics'}</span>
            </button>
          </div>
        </div>

        {/* Transient warning banner if refresh encounters issue */}
        {error && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center justify-between gap-2">
            <span>{error}</span>
            <button 
              onClick={() => loadReport(true)}
              className="font-bold underline hover:text-amber-900 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* 2. Overview Metric Cards */}
      <section aria-labelledby="heading-overview-cards">
        <h2 id="heading-overview-cards" className="sr-only">Catalogue Overview Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          
          {/* Total Products Card */}
          <div 
            id="card-total-products"
            className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Products</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {totalProducts.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Recorded catalogue inventory, including inactive items
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                Public catalogue visibility may be lower as inactive or unavailable items are excluded.
              </p>
            </div>
          </div>

          {/* Amazon Products Card */}
          <div 
            id="card-amazon-products"
            className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Amazon Source</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {amazonCount.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {totalProducts > 0 ? `${((amazonCount / totalProducts) * 100).toFixed(1)}% of total catalogue` : '0% of catalogue'}
              </p>
            </div>
          </div>

          {/* Google Products Card */}
          <div 
            id="card-google-products"
            className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Google Source</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {googleCount.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {totalProducts > 0 ? `${((googleCount / totalProducts) * 100).toFixed(1)}% of total catalogue` : '0% of catalogue'}
              </p>
            </div>
          </div>

          {/* Manual / Seeded Products Card */}
          <div 
            id="card-synthetic-products"
            className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Manual / Seeded</span>
              <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                <Database className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {manualSeededCombinedCount.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Admin additions + initial seed records
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {totalProducts > 0 ? `${((manualSeededCombinedCount / totalProducts) * 100).toFixed(1)}% of catalogue` : '0% baseline'}
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* 3. Product Sources & Database Categories Breakdown (2-Column Grid on Tablet/Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Section: Product Sources */}
        <section 
          id="section-product-sources"
          aria-labelledby="heading-product-sources"
          className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col"
        >
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <div>
              <h2 id="heading-product-sources" className="text-base font-bold text-slate-900">
                Product Sources
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ingested catalogue breakdown by origin
              </p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div className="flex flex-col gap-4 flex-1 justify-around">
            {sourceDisplayItems.map((item) => (
              <div key={item.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.colorClass}`}></span>
                    <span className="font-semibold text-slate-800">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{item.count}</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      ({item.pct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${item.colorClass} rounded-full transition-all duration-500`} 
                    style={{ width: `${Math.min(100, item.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>External Ingestion Sources: {externalIngestionSourcesCount}</span>
            <span>Total Recorded: {totalProducts}</span>
          </div>
        </section>

        {/* Section: Database Categories */}
        <section 
          id="section-database-categories"
          aria-labelledby="heading-database-categories"
          className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col"
        >
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 id="heading-database-categories" className="text-base font-bold text-slate-900">
                  Database Categories
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  Internal
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Broad internal database categories across stored product records (distinct from public product types)
              </p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <Database className="w-4 h-4" />
            </div>
          </div>

          <div className="flex flex-col gap-3 flex-1">
            {(!report?.category_breakdown || report.category_breakdown.length === 0) ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No category breakdown available
              </div>
            ) : (
              report.category_breakdown.map((cat, idx) => {
                const count = Number(cat.count) || 0;
                const pct = totalProducts > 0 ? ((count / totalProducts) * 100).toFixed(1) : '0';
                return (
                  <div key={idx} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 truncate max-w-[200px] sm:max-w-xs">
                        {cat.category_name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-slate-900">{count}</span>
                        <span className="text-slate-400 font-mono text-[11px]">({pct}%)</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Database Table: categories</span>
            <span>Total Categories: {report?.category_breakdown?.length || 0}</span>
          </div>
        </section>

      </div>

      {/* 4. Section: API Usage (Quota Dashboard) */}
      <section 
        id="section-api-usage"
        aria-labelledby="heading-api-usage"
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="heading-api-usage" className="text-base font-bold text-slate-900">
                API Usage
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                ₹0 Budget Guard
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              RapidAPI monthly quota conservation and remaining allocations
            </p>
          </div>

          {/* Billing cycle timeframe indicators */}
          {(quota?.billing_cycle_start || quota?.billing_cycle_end) && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Cycle: <strong className="text-slate-700">{formatDate(quota?.billing_cycle_start)}</strong> — <strong className="text-slate-700">{formatDate(quota?.billing_cycle_end)}</strong>
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Amazon API Quota */}
          <div 
            id="quota-card-amazon"
            className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-900">Amazon API</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  {quota?.amazon?.days_until_reset ?? '—'} days left
                </span>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Calls Used</span>
                  <span className="font-semibold text-slate-800">{quota?.amazon?.calls_used_this_cycle ?? 0}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Calls Remaining</span>
                  <span className="font-bold text-emerald-600">{quota?.amazon?.calls_remaining ?? 0}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Monthly Cap</span>
                  <span className="font-mono text-slate-800">{quota?.amazon?.monthly_cap ?? 0}</span>
                </div>
              </div>
            </div>

            <div>
              {/* Progress bar */}
              {(() => {
                const used = quota?.amazon?.calls_used_this_cycle ?? 0;
                const cap = quota?.amazon?.monthly_cap ?? 1;
                const pct = Math.min(100, (used / cap) * 100);
                return (
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span>Usage</span>
                      <span>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Google Shopping API Quota */}
          <div 
            id="quota-card-google"
            className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-900">Google Shopping API</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  {quota?.google?.days_until_reset ?? '—'} days left
                </span>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Calls Used</span>
                  <span className="font-semibold text-slate-800">{quota?.google?.calls_used_this_cycle ?? 0}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Calls Remaining</span>
                  <span className="font-bold text-emerald-600">{quota?.google?.calls_remaining ?? 0}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Monthly Cap</span>
                  <span className="font-mono text-slate-800">{quota?.google?.monthly_cap ?? 0}</span>
                </div>
              </div>
            </div>

            <div>
              {/* Progress bar */}
              {(() => {
                const used = quota?.google?.calls_used_this_cycle ?? 0;
                const cap = quota?.google?.monthly_cap ?? 1;
                const pct = Math.min(100, (used / cap) * 100);
                return (
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span>Usage</span>
                      <span>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Flipkart API Quota */}
          <div 
            id="quota-card-flipkart"
            className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-900">Flipkart API</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  {quota?.flipkart?.days_until_reset ?? '—'} days left
                </span>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Calls Used</span>
                  <span className="font-semibold text-slate-800">{quota?.flipkart?.calls_used_this_cycle ?? 0}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Calls Remaining</span>
                  <span className="font-bold text-emerald-600">{quota?.flipkart?.calls_remaining ?? 0}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Monthly Cap</span>
                  <span className="font-mono text-slate-800">{quota?.flipkart?.monthly_cap ?? 0}</span>
                </div>
              </div>
            </div>

            <div>
              {/* Progress bar */}
              {(() => {
                const used = quota?.flipkart?.calls_used_this_cycle ?? 0;
                const cap = quota?.flipkart?.monthly_cap ?? 1;
                const pct = Math.min(100, (used / cap) * 100);
                return (
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span>Usage</span>
                      <span>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

        </div>
      </section>

      {/* 5. Section: Quick Actions (Placeholders for upcoming phases) */}
      <section 
        id="section-quick-actions"
        aria-labelledby="heading-quick-actions"
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs"
      >
        <div className="pb-4 mb-4 border-b border-slate-100">
          <h2 id="heading-quick-actions" className="text-base font-bold text-slate-900">
            Quick Actions
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Administrative operations and catalogue management tools
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          
          {/* Action 1: Manage Products */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800">Manage Products</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Create, edit, deactivate, or reactivate catalogue products and manage product metadata.
              </p>
            </div>
            <Link
              to="/admin/products"
              id="btn-admin-manage-products"
              className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
            >
              <span>Manage Products</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Action 2: Manage Retailer Offers */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800">Manage Retailer Offers</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Inspect merchant prices, affiliate store links, and availability records.
              </p>
            </div>
            <Link
              to="/admin/offers"
              id="btn-admin-manage-offers"
              className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
            >
              <span>Manage Offers</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Action 3: Sync Status */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-800">Sync Status</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Monitor product-source activity, API safety budgets, and sync telemetry.
              </p>
            </div>
            <Link
              to="/admin/sync"
              id="btn-admin-sync-status"
              className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
            >
              <span>Sync Status</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>
      </section>

      {/* Section: Admin Account Settings */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Admin Account Settings</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage administrator credentials and contact email.
            </p>
          </div>
          <button
            type="button"
            id="btn-admin-open-change-email"
            onClick={() => {
              setIsEmailModalOpen(true);
              setModalError(null);
              setCurrentPassword('');
              setNewEmail('');
              setConfirmEmail('');
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer min-h-[44px] shadow-xs"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Change Email</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-center">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Current Admin Email</span>
            <span className="text-sm font-mono font-medium text-slate-800 mt-1 break-all" id="admin-current-email-display">
              {user?.email || '—'}
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-center">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Account Role</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                Administrator
              </span>
              <span className="text-[11px] text-slate-500 font-mono">ID: #{user?.userId || '—'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Change Email Modal */}
      {isEmailModalOpen && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-change-email-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
        >
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="modal-change-email-title" className="text-sm font-bold text-slate-900">Change Admin Email</h3>
                  <p className="text-[11px] text-slate-500">Enter your current password and new email</p>
                </div>
              </div>
              <button
                type="button"
                id="btn-admin-close-email-modal"
                onClick={() => {
                  if (!isSubmittingEmail) setIsEmailModalOpen(false);
                }}
                disabled={isSubmittingEmail}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEmailChangeSubmit} className="p-5 flex flex-col gap-4">
              {modalError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-tight">{modalError}</span>
                </div>
              )}

              {/* Current Password Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    id="input-admin-current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    disabled={isSubmittingEmail}
                    className="w-full pl-3 pr-10 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* New Email Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  New Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  id="input-admin-new-email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="admin@example.com"
                  disabled={isSubmittingEmail}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                  required
                />
              </div>

              {/* Confirm New Email Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Confirm New Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  id="input-admin-confirm-email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="Repeat new email"
                  disabled={isSubmittingEmail}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                  required
                />
              </div>

              <div className="text-[11px] text-slate-500 bg-amber-50 border border-amber-200/70 p-2.5 rounded-xl">
                ⚠️ Updating your email will log you out immediately. You will need to sign in with your new email.
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  id="btn-admin-cancel-email"
                  onClick={() => setIsEmailModalOpen(false)}
                  disabled={isSubmittingEmail}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer min-h-[40px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-admin-submit-email"
                  disabled={isSubmittingEmail}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer min-h-[40px] shadow-xs"
                >
                  {isSubmittingEmail ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Email</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
