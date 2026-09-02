import { Router } from 'express';
import { protect, restrictTo } from '../middleware/auth.ts';
import { RapidApiService } from '../services/rapidApiService.ts';
import { GoogleShoppingService } from '../services/googleShoppingService.ts';
import { QuotaTracker } from '../services/quotaTracker.ts';
import { NormalizationService } from '../services/normalizationService.ts';
import db from '../config/db.ts';

const router = Router();

// Protect all admin routes with JWT security and restrict to admin users
router.use(protect);
router.use(restrictTo('admin'));

/**
 * POST /api/v1/admin/merge-variants
 * Manually forces a pass to identify distinct storage/color variants under the same base product and merge them to the canonical slug.
 */
router.post('/merge-variants', async (req, res, next) => {
  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    const remainingProds = await client.query('SELECT product_id, name, brand FROM products WHERE canonical_slug IS NULL');
    for (const rp of remainingProds.rows) {
      const parsed = NormalizationService.parseProductDetails(rp.name, rp.brand);
      const slugCheck = await client.query('SELECT product_id FROM products WHERE slug = $1 AND product_id != $2', [parsed.variantSlug, rp.product_id]);
      const finalSlug = slugCheck.rows.length > 0 ? `${parsed.variantSlug}-${rp.product_id}` : parsed.variantSlug;
      await client.query(
        `UPDATE products 
         SET canonical_slug = $1, storage_variant = $2, color_variant = $3, slug = $4 
         WHERE product_id = $5`,
        [parsed.canonicalSlug, parsed.storageVariant, parsed.colorVariant, finalSlug, rp.product_id]
      );
    }
    await client.query('COMMIT');
    res.status(200).json({ status: 'success', message: 'Successfully merged and normalized all product records.' });
  } catch (err: any) {
    if (client) await client.query('ROLLBACK');
    next(err);
  } finally {
    if (client) client.release();
  }
});

/**
 * GET /api/v1/admin/report
 */
router.get('/report', async (req, res, next) => {
  try {
    const totalProductsRes = await db.query('SELECT COUNT(*)::int as count FROM products');
    const totalProducts = totalProductsRes.rows[0]?.count || 0;
    const sourceBreakdownRes = await db.query(
      `SELECT COALESCE(data_source, 'synthetic') as source, COUNT(*)::int as count 
       FROM products GROUP BY COALESCE(data_source, 'synthetic')`
    );
    const categoryBreakdownRes = await db.query(
      `SELECT c.name as category_name, COUNT(p.product_id)::int as count 
       FROM products p JOIN categories c ON p.category_id = c.category_id GROUP BY c.name`
    );
    const quotaStats = await QuotaTracker.getStats();
    res.status(200).json({
      status: 'success',
      data: {
        total_products: totalProducts,
        source_breakdown: sourceBreakdownRes.rows,
        category_breakdown: categoryBreakdownRes.rows,
        quota_dashboard: {
          amazon: { monthly_cap: quotaStats.caps.amazon, calls_used_this_cycle: quotaStats.billingCycleCounts.amazon, calls_remaining: Math.max(0, quotaStats.caps.amazon - quotaStats.billingCycleCounts.amazon), offset_value: quotaStats.offsets.amazon, days_until_reset: quotaStats.daysUntilReset },
          google: { monthly_cap: quotaStats.caps.google, calls_used_this_cycle: quotaStats.billingCycleCounts.google, calls_remaining: Math.max(0, quotaStats.caps.google - quotaStats.billingCycleCounts.google), offset_value: quotaStats.offsets.google, days_until_reset: quotaStats.daysUntilReset },
          flipkart: { monthly_cap: quotaStats.caps.flipkart, calls_used_this_cycle: quotaStats.billingCycleCounts.flipkart, calls_remaining: Math.max(0, quotaStats.caps.flipkart - quotaStats.billingCycleCounts.flipkart), offset_value: quotaStats.offsets.flipkart, days_until_reset: quotaStats.daysUntilReset },
          billing_cycle_start: quotaStats.billingCycleStart,
          billing_cycle_end: quotaStats.billingCycleEnd
        }
      }
    });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/quota/calibrate
 */
router.post('/quota/calibrate', async (req, res, next) => {
  try {
    const { amazon_actual, google_actual, flipkart_actual } = req.body;
    const results: Record<string, any> = {};
    const sources: ('amazon' | 'google' | 'flipkart')[] = ['amazon', 'google', 'flipkart'];
    for (const src of sources) {
      const field = `${src}_actual`;
      if (req.body[field] !== undefined) {
        const actualVal = parseInt(req.body[field], 10);
        if (!isNaN(actualVal) && actualVal >= 0) {
          const systemTracked = await QuotaTracker.getCallsInCurrentBillingCycle(src, true);
          const requiredOffset = actualVal - systemTracked;
          await QuotaTracker.setCalibrationOffset(src, requiredOffset);
          results[src] = { systemTracked, offsetSet: requiredOffset, totalReflected: actualVal };
        }
      }
    }
    res.status(200).json({ status: 'success', message: 'Quota calibration successfully performed.', data: { calibrations: results } });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/sync
 * Controlled manual synchronization of products.
 * Request Body: { source: 'amazon' | 'google', keyword: string, maxPages: number }
 */
router.post('/sync', async (req, res, next) => {
  try {
    const { source, keyword, maxPages = 1 } = req.body;
    
    if (!source || !keyword) {
      return res.status(400).json({ status: 'error', message: 'Source and keyword are required.' });
    }

    if (source === 'flipkart') {
      return res.status(400).json({ status: 'error', message: 'Flipkart integration is currently unavailable.' });
    }

    if (source !== 'amazon' && source !== 'google') {
      return res.status(400).json({ status: 'error', message: 'Invalid source. Use amazon or google.' });
    }
    
    const pages = Math.min(Math.max(1, parseInt(maxPages, 10)), 3); // enforce max 3
    let apiCallsMade = 0;
    let productsReturned = 0;
    let newProductsAdded = 0;
    let existingProductsMatched = 0;
    let pricesUpdated = 0;
    
    // Check if configured
    if (source === 'amazon') {
      const isConfigured = process.env.RAPIDAPI_KEY && process.env.RAPIDAPI_KEY !== 'your_rapidapi_application_key_here' && process.env.RAPIDAPI_HOST;
      if (!isConfigured) return res.status(400).json({ status: 'error', message: 'Amazon API not configured.' });
    } else {
      const isConfigured = process.env.RAPIDAPI_KEY && process.env.RAPIDAPI_KEY !== 'your_rapidapi_application_key_here' && process.env.GOOGLE_SHOPPING_API_HOST;
      if (!isConfigured) return res.status(400).json({ status: 'error', message: 'Google Shopping API not configured.' });
    }

    let synced = [];
    
    for (let page = 1; page <= pages; page++) {
      if (await QuotaTracker.isCapExceeded(source)) {
        break; // Stop immediately
      }
      
      apiCallsMade++;
      
      let pageSynced = [];
      try {
        if (source === 'amazon') {
          pageSynced = await RapidApiService.searchAndSyncProducts(keyword, true, true, page);
        } else {
          const { GoogleShoppingService } = await import('../services/googleShoppingService.ts');
          pageSynced = await GoogleShoppingService.searchAndSyncGoogleShopping(keyword, true, true, page);
        }
      } catch (e) {
        console.error('[Admin Sync] API Error:', e.message);
        break; // Stop on error
      }
      
      if (!pageSynced || pageSynced.length === 0) break;
      
      productsReturned += pageSynced.length; // Approximate, as invalid are rejected in the service
      synced.push(...pageSynced);
    }
    
    for (const p of synced) {
      if (p.isNewProduct) {
        newProductsAdded++;
      } else {
        existingProductsMatched++;
        pricesUpdated++; // Assume price updated for existing match
      }
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        source,
        keyword,
        apiCallsMade,
        productsReturned,
        newProductsAdded,
        existingProductsMatched,
        pricesUpdated,
        invalidProductsRejected: 0,
        duplicatesSkipped: 0
      }
    });

  } catch (err) {
    next(err);
  }
});

export default router;
