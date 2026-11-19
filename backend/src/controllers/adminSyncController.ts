import { Request, Response, NextFunction } from 'express';
import db from '../config/db.ts';
import { QuotaTracker } from '../services/quotaTracker.ts';

/**
 * Controller to provide read-only sync and API quota telemetry for the Admin Sync Status dashboard.
 * Strictly READ ONLY: No INSERT, UPDATE, or DELETE statements are executed.
 * Does NOT trigger external API calls or product sync operations.
 */
export const getAdminSyncStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Concurrently fetch all read-only metrics from database & QuotaTracker
    const [
      totalProductsRes,
      sourceBreakdownRes,
      manualOverridesRes,
      apiCallsAggRes,
      syncLogAggRes,
      syncSnapshotsRes,
      scheduledKeywordsRes,
      quotaStats
    ] = await Promise.all([
      db.query('SELECT COUNT(*)::int as count FROM products'),
      db.query(
        `SELECT COALESCE(data_source, 'synthetic') as source, COUNT(*)::int as count 
         FROM products 
         GROUP BY COALESCE(data_source, 'synthetic') 
         ORDER BY count DESC`
      ),
      db.query('SELECT COUNT(*)::int as count FROM product_prices WHERE manual_override = TRUE'),
      db.query(
        `SELECT source, MAX(created_at) as last_call_at, COUNT(*)::int as total_calls 
         FROM api_call_logs 
         GROUP BY source`
      ),
      db.query(
        `SELECT source, MAX(last_synced_at) as last_sync_at, COUNT(*)::int as total_syncs 
         FROM keyword_sync_log 
         GROUP BY source`
      ),
      db.query(
        `SELECT keyword, source, last_synced_at, result_count 
         FROM keyword_sync_log 
         ORDER BY last_synced_at DESC`
      ),
      db.query(
        `SELECT keyword, category_name, last_synced_at 
         FROM scheduled_keywords 
         ORDER BY keyword`
      ),
      QuotaTracker.getStatsReadOnly()
    ]);

    // 2. Format overview metrics
    const totalProducts = Number(totalProductsRes.rows[0]?.count || 0);
    const sourceBreakdown = sourceBreakdownRes.rows.map(row => ({
      source: row.source,
      count: Number(row.count)
    }));
    const manualOverridesLocked = Number(manualOverridesRes.rows[0]?.count || 0);
    const totalRotationKeywords = scheduledKeywordsRes.rows.length;

    // 3. Map historical telemetry by source
    const callAggMap: Record<string, { lastCallAt: string | null; totalCalls: number }> = {};
    for (const row of apiCallsAggRes.rows) {
      callAggMap[row.source] = {
        lastCallAt: row.last_call_at ? new Date(row.last_call_at).toISOString() : null,
        totalCalls: Number(row.total_calls)
      };
    }

    const syncAggMap: Record<string, { lastSyncAt: string | null; totalSyncs: number }> = {};
    for (const row of syncLogAggRes.rows) {
      syncAggMap[row.source] = {
        lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at).toISOString() : null,
        totalSyncs: Number(row.total_syncs)
      };
    }

    // 4. Build factual source telemetry (strictly google, amazon, flipkart)
    const sourceConfigs: Array<{
      source: 'google' | 'amazon' | 'flipkart';
      display_name: string;
    }> = [
      { source: 'google', display_name: 'Google Shopping (RapidAPI)' },
      { source: 'amazon', display_name: 'Amazon Real-Time (RapidAPI)' },
      { source: 'flipkart', display_name: 'Flipkart API' }
    ];

    const sources = sourceConfigs.map(cfg => {
      const srcKey = cfg.source;
      const callData = callAggMap[srcKey];
      const syncData = syncAggMap[srcKey];

      // Factual activity status: RECORDED_ACTIVITY if historical calls/syncs exist, else NO_RECORDED_ACTIVITY
      const hasActivity = Boolean((callData && callData.totalCalls > 0) || (syncData && syncData.totalSyncs > 0));
      const activity_status = hasActivity ? 'RECORDED_ACTIVITY' : 'NO_RECORDED_ACTIVITY';

      // Current cycle quota metrics from QuotaTracker
      const configured_app_cap = Number(quotaStats.caps[srcKey] || 0);
      const calls_used_this_cycle = Number(quotaStats.billingCycleCounts[srcKey] || 0);
      const calls_remaining = Math.max(0, configured_app_cap - calls_used_this_cycle);
      const calibration_offset = Number(quotaStats.offsets[srcKey] || 0);

      return {
        source: srcKey,
        display_name: cfg.display_name,
        activity_status,
        configured_app_cap,
        calls_used_this_cycle,
        calls_remaining,
        calibration_offset,
        last_recorded_call_at: callData ? callData.lastCallAt : null,
        last_sync_snapshot_at: syncData ? syncData.lastSyncAt : null
      };
    });

    // 5. Format sync snapshots from keyword_sync_log (UPSERT snapshot)
    const syncSnapshots = syncSnapshotsRes.rows.map(row => ({
      keyword: row.keyword,
      source: row.source,
      last_synced_at: row.last_synced_at ? new Date(row.last_synced_at).toISOString() : null,
      result_count: row.result_count !== null ? Number(row.result_count) : 0
    }));

    // 6. Format rotation catalogue from scheduled_keywords
    const rotationKeywords = scheduledKeywordsRes.rows.map(row => ({
      keyword: row.keyword,
      category_name: row.category_name,
      last_synced_at: row.last_synced_at ? new Date(row.last_synced_at).toISOString() : null
    }));

    const withLastSyncedAt = rotationKeywords.filter(k => k.last_synced_at !== null).length;
    const withoutLastSyncedAt = rotationKeywords.filter(k => k.last_synced_at === null).length;

    // 7. Send strictly read-only response
    res.status(200).json({
      status: 'success',
      data: {
        overview: {
          total_products: totalProducts,
          source_breakdown: sourceBreakdown,
          manual_overrides_locked: manualOverridesLocked,
          total_rotation_keywords: totalRotationKeywords
        },
        billing_cycle: {
          start_date: quotaStats.billingCycleStart,
          end_date: quotaStats.billingCycleEnd,
          days_until_reset: quotaStats.daysUntilReset
        },
        sources,
        sync_snapshots: syncSnapshots,
        rotation_catalogue: {
          total_keywords: totalRotationKeywords,
          with_last_synced_at: withLastSyncedAt,
          without_last_synced_at: withoutLastSyncedAt,
          keywords: rotationKeywords
        }
      }
    });
  } catch (err) {
    next(err);
  }
};
