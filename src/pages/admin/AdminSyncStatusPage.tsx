import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, 
  ShieldCheck, Database, Calendar, Lock, ExternalLink, 
  Search, Package, Layers, Activity, Clock, Sliders
} from 'lucide-react';
import { fetchAdminSyncStatus } from '../../services/api';
import { AdminSyncStatusData } from '../../types/frontend';

/**
 * Formats an ISO date-time into a human-readable string without misleading relative terms.
 * Example: "11 Aug 2026, 01:20 PM"
 */
function formatDateTime(isoString?: string | null, fallback: string = 'Never recorded'): string {
  if (!isoString) return fallback;
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return fallback;
  }
}

/**
 * Formats a billing cycle range.
 * Example: "6 Sep 2026 – 6 Oct 2026"
 */
function formatCycleRange(startIso?: string, endIso?: string): string {
  if (!startIso || !endIso) return '—';
  try {
    const s = new Date(startIso);
    const e = new Date(endIso);
    const sFmt = s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const eFmt = e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${sFmt} – ${eFmt}`;
  } catch {
    return `${startIso} – ${endIso}`;
  }
}

/**
 * Human-friendly source label mapping
 */
function getSourceDisplayName(rawSource: string): string {
  switch (rawSource.toLowerCase()) {
    case 'google':
    case 'live_google':
      return 'Google Shopping';
    case 'amazon':
    case 'live_amazon':
      return 'Amazon Real-Time';
    case 'flipkart':
    case 'live_flipkart':
      return 'Flipkart API';
    case 'synthetic':
      return 'Synthetic / Seeded';
    case 'manual':
      return 'Manual / Admin-added';
    default:
      return rawSource;
  }
}

export default function AdminSyncStatusPage() {
  const [data, setData] = useState<AdminSyncStatusData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Rotation keyword search filter
  const [keywordSearch, setKeywordSearch] = useState<string>('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const loadStatus = async (isManualRefresh: boolean = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetchAdminSyncStatus();
      setData(res);
      if (isManualRefresh) {
        showToast('Sync telemetry and safety budgets refreshed.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load sync telemetry.';
      setError(msg);
      if (isManualRefresh) {
        showToast(msg, 'error');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadStatus(false);
  }, []);

  // Filtered rotation keywords
  const filteredKeywords = useMemo(() => {
    if (!data?.rotation_catalogue?.keywords) return [];
    if (!keywordSearch.trim()) return data.rotation_catalogue.keywords;
    const q = keywordSearch.toLowerCase().trim();
    return data.rotation_catalogue.keywords.filter(
      k => k.keyword.toLowerCase().includes(q)
    );
  }, [data?.rotation_catalogue?.keywords, keywordSearch]);

  // Loading state
  if (loading && !data) {
    return (
      <div 
        id="sync-status-loading"
        className="py-24 sm:py-32 flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-xs sm:text-sm font-semibold text-slate-700">
          Loading sync telemetry & provider safety budgets...
        </p>
        <span className="text-[11px] text-slate-400 mt-1">Verifying administrative access & querying telemetry metrics</span>
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div 
        id="sync-status-error"
        className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center"
      >
        <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Failed to Load Sync Telemetry</h2>
        <p className="text-xs text-slate-600 mb-6">{error}</p>
        <button
          type="button"
          onClick={() => loadStatus(false)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
        >
          Retry Telemetry Query
        </button>
      </div>
    );
  }

  const overview = data?.overview;
  const billingCycle = data?.billing_cycle;
  const sources = data?.sources || [];
  const syncSnapshots = data?.sync_snapshots || [];
  const rotationCatalogue = data?.rotation_catalogue;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      
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

      {/* 1. Header & Navigation Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link 
              to="/admin" 
              className="hover:text-indigo-600 transition-colors flex items-center gap-1 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Admin Dashboard</span>
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Sync Status</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Sync Status</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
              Admin Protected
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Monitor product-source activity, API safety budgets, and sync telemetry.
          </p>
        </div>

        {/* Refresh Status Action */}
        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <button
            id="btn-refresh-sync-status"
            type="button"
            onClick={() => loadStatus(true)}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shadow-2xs disabled:opacity-60 min-h-[40px]"
            title="Refetch read-only telemetry metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Status'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Overview Cards */}
      <section aria-labelledby="heading-sync-overview">
        <h2 id="heading-sync-overview" className="sr-only">Sync Telemetry Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          
          {/* Total Products */}
          <div 
            id="card-sync-total-products"
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
                {overview?.total_products?.toLocaleString() ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Total recorded items in database catalogue
              </p>
            </div>
          </div>

          {/* Manual-Control Offers */}
          <div 
            id="card-sync-manual-offers"
            className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Manual-Control Offers</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <Lock className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {overview?.manual_overrides_locked ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Protected from external scraping updates
              </p>
            </div>
          </div>

          {/* Rotation Keywords */}
          <div 
            id="card-sync-rotation-keywords"
            className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Rotation Keywords</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {overview?.total_rotation_keywords ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Catalogue keywords available for sync
              </p>
            </div>
          </div>

          {/* Billing Reset */}
          <div 
            id="card-sync-billing-reset"
            className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Billing Reset</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {billingCycle?.days_until_reset !== undefined ? `${billingCycle.days_until_reset} days` : '—'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                {formatCycleRange(billingCycle?.start_date, billingCycle?.end_date)}
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* 3. Manual Override Protection Banner */}
      <section 
        id="section-manual-override-banner"
        className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
      >
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-purple-900 text-sm">Manual Control Protection</span>
            <p className="text-purple-700 mt-0.5">
              {overview?.manual_overrides_locked === 1 
                ? '1 retailer offer is protected by Manual Control.'
                : `${overview?.manual_overrides_locked ?? 0} retailer offers are protected by Manual Control.`} Protected offers will not be overwritten by automatic scrapers or API ingestion.
            </p>
          </div>
        </div>
        <Link
          to="/admin/offers"
          id="btn-link-manage-offers"
          className="self-start sm:self-center px-3 py-1.5 rounded-xl bg-white border border-purple-200 hover:bg-purple-50 text-purple-800 font-semibold transition-colors flex items-center gap-1.5 shadow-2xs shrink-0"
        >
          <span>Manage Retailer Offers</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </section>

      {/* 4. Source Activity & Safety Budgets Section */}
      <section 
        id="section-source-activity"
        aria-labelledby="heading-source-activity"
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
          <div>
            <h2 id="heading-source-activity" className="text-base font-bold text-slate-900">
              Source Activity & API Safety Budgets
            </h2>
            <p className="text-xs text-slate-500">
              Real-time activity telemetry and application-configured consumption caps for search providers.
            </p>
          </div>
          <span className="text-[11px] text-slate-400 italic">
            These are app-configured safety limits, not official provider quotas.
          </span>
        </div>

        {/* 3 Source Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {sources.map((src) => {
            const used = src.calls_used_this_cycle;
            const cap = src.configured_app_cap;
            const remaining = src.calls_remaining;
            const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
            const isRecorded = src.activity_status === 'RECORDED_ACTIVITY';

            return (
              <div 
                key={src.source}
                id={`card-source-${src.source}`}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-5"
              >
                {/* Source Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{src.display_name}</h3>
                    <span className="text-[11px] font-mono text-slate-400">provider_id: {src.source}</span>
                  </div>
                  {/* Status Badge: Strictly neutral styling */}
                  <span 
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${
                      isRecorded
                        ? 'bg-slate-100 text-slate-700 border-slate-300'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {isRecorded ? 'Recorded Activity' : 'No Recorded Activity'}
                  </span>
                </div>

                {/* API Safety Budget Box */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">API Safety Budget</span>
                    <span className="font-mono text-slate-500 text-[11px]">{pct.toFixed(0)}% used</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        pct > 80 ? 'bg-amber-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Used This Cycle</span>
                      <span className="font-semibold text-slate-800">{used} / {cap}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Calls Remaining</span>
                      <span className="font-bold text-emerald-600">{remaining}</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-tight pt-1">
                    These are app-configured safety limits, not official provider quotas.
                  </p>
                </div>

                {/* Telemetry Timestamps */}
                <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-500 flex items-center gap-1 shrink-0">
                      <Activity className="w-3 h-3 text-slate-400" />
                      <span>Last Recorded API Call:</span>
                    </span>
                    <span className="font-medium text-slate-800 text-right">
                      {formatDateTime(src.last_recorded_call_at, 'Never recorded')}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-500 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Last Sync Snapshot:</span>
                    </span>
                    <span className="font-medium text-slate-800 text-right">
                      {formatDateTime(src.last_sync_snapshot_at, 'No recorded activity')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-50 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Sliders className="w-3 h-3 text-slate-400" />
                      <span>Calibration Offset:</span>
                    </span>
                    <span className="font-mono text-slate-700">{src.calibration_offset}</span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Source Breakdown & Distribution */}
      <section 
        id="section-source-breakdown"
        aria-labelledby="heading-source-breakdown"
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs"
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div>
            <h2 id="heading-source-breakdown" className="text-base font-bold text-slate-900">
              Catalogue Source Breakdown
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribution of catalogue items across external ingestion channels and local entry sources.
            </p>
          </div>
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
            <Database className="w-4 h-4" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(overview?.source_breakdown || []).map((item) => {
            const count = item.count;
            const total = overview?.total_products || 1;
            const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0';

            return (
              <div 
                key={item.source}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 flex flex-col justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-slate-800 block truncate">
                    {getSourceDisplayName(item.source)}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{item.source}</span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-slate-900">{count}</span>
                  <span className="text-[11px] font-mono text-slate-500">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Latest Keyword Sync Snapshots Section */}
      <section 
        id="section-sync-snapshots"
        aria-labelledby="heading-sync-snapshots"
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs"
      >
        <div className="pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h2 id="heading-sync-snapshots" className="text-base font-bold text-slate-900">
              Latest Keyword Sync Snapshots
            </h2>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              {syncSnapshots.length} records
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Latest stored snapshot for each keyword/source pair.
          </p>
        </div>

        {syncSnapshots.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No keyword sync snapshots currently recorded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Keyword</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Results</th>
                  <th className="py-2.5 px-3 text-right">Last Sync Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {syncSnapshots.map((item, idx) => (
                  <tr key={`${item.keyword}-${item.source}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {item.keyword}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                        {getSourceDisplayName(item.source)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      {item.result_count} items
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 font-mono text-[11px]">
                      {formatDateTime(item.last_synced_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 7. Rotation Keyword Catalogue Section */}
      <section 
        id="section-rotation-catalogue"
        aria-labelledby="heading-rotation-catalogue"
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="heading-rotation-catalogue" className="text-base font-bold text-slate-900">
                Rotation Keywords
              </h2>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                {rotationCatalogue?.total_keywords ?? 0} keywords
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Keywords available for controlled product-sync rotation.
            </p>
          </div>

          {/* Search box for keywords */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={keywordSearch}
              onChange={(e) => setKeywordSearch(e.target.value)}
              placeholder="Filter rotation keywords..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 bg-white"
            />
          </div>
        </div>

        {/* Summary Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-600 font-medium">Total Keywords</span>
            <span className="text-sm font-bold text-slate-900">{rotationCatalogue?.total_keywords ?? 0}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-600 font-medium">Rotation Entries Synced</span>
            <span className="text-sm font-bold text-indigo-600">{rotationCatalogue?.with_last_synced_at ?? 0}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-600 font-medium">Not Yet Rotated</span>
            <span className="text-sm font-bold text-slate-700">{rotationCatalogue?.without_last_synced_at ?? 0}</span>
          </div>
        </div>

        {/* Keyword list container */}
        <div className="border border-slate-100 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
          {filteredKeywords.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching keywords found.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px] tracking-wider z-10">
                <tr>
                  <th className="py-2.5 px-3">Keyword</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Last Synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredKeywords.map((item, idx) => (
                  <tr key={`${item.keyword}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      {item.keyword}
                    </td>
                    <td className="py-2 px-3 text-slate-500">
                      {item.category_name}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-400 font-mono text-[11px]">
                      {item.last_synced_at ? formatDateTime(item.last_synced_at) : 'Not yet synced'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

    </div>
  );
}
