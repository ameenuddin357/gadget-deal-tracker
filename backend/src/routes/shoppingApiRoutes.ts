import { Router, Request, Response, NextFunction } from 'express';
import db from '../config/db.ts';
import { RapidApiService } from '../services/rapidApiService.ts';
import { GoogleShoppingService } from '../services/googleShoppingService.ts';
import { FlipkartApiService } from '../services/flipkartApiService.ts';
import { AppError } from '../middleware/errorHandler.ts';

const router = Router();

/**
 * Format currency value to standard Indian Rupees notation (INR) as a helper for easier response integration
 */
function toINRString(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * GET /api/search?q=
 * Real-time searches electronic gadgets using query key strings, fetches current retail indexes across multiple stores, 
 * persists them securely inside PostgreSQL database indexes, and returns detailed matching datasets.
 */
router.get('/search', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const queryTerm = req.query.q as string;
    if (!queryTerm || queryTerm.trim().length === 0) {
      res.status(400).json({
        status: 'fail',
        message: 'Search query parameter "q" is required.'
      });
      return;
    }

    const keyword = queryTerm.trim();
    
    // Trigger concurrent sync operations across all configured services
    await Promise.all([
      RapidApiService.searchAndSyncProducts(keyword).catch(err => {
        console.error('[Amazon Sync Error] Muted in search route:', err.message);
        return [];
      }),
      GoogleShoppingService.searchAndSyncGoogleShopping(keyword).catch(err => {
        console.error('[Google Shopping Sync Error] Muted in search route:', err.message);
        return [];
      }),
      FlipkartApiService.searchAndSyncFlipkart(keyword).catch(err => {
        console.error('[Flipkart Sync Error] Muted in search route:', err.message);
        return [];
      })
    ]);

    // Retrieve the fully merged product database list with complete store listings from Postgres
    let productsList = await RapidApiService.checkLocalCache(keyword);

    if (!productsList || productsList.length === 0) {
      try {
        const searchWildcard = `%${keyword}%`;
        const localCheck = await db.query(
          `SELECT p.product_id, p.name, p.brand, p.model_no, p.slug, p.image_url, p.specs_summary, c.name AS category_name
           FROM products p
           JOIN categories c ON p.category_id = c.category_id
           WHERE p.name ILIKE $1 OR p.brand ILIKE $1 OR p.specs_summary ILIKE $1`,
          [searchWildcard]
        );
        
        productsList = [];
        const now = Date.now();
        const cacheTtlDays = parseInt(process.env.CACHE_TTL_DAYS || '30', 10);
        const staleThresholdMs = cacheTtlDays * 24 * 60 * 60 * 1000;

        for (const row of localCheck.rows) {
          const priceCheck = await db.query(
            `SELECT pp.price, pp.original_price, pp.product_url, pp.is_available, pp.last_scraped_at, s.name AS store_name
             FROM product_prices pp
             JOIN stores s ON pp.store_id = s.store_id
             WHERE pp.product_id = $1`,
            [row.product_id]
          );
          
          const storesPricing = priceCheck.rows.map((pr: any) => {
            const scrapedAt = new Date(pr.last_scraped_at).getTime();
            const isStale = (now - scrapedAt) > staleThresholdMs;
            return {
              store_name: pr.store_name,
              price: parseFloat(pr.price),
              original_price: parseFloat(pr.original_price),
              discount: pr.original_price > pr.price ? ((pr.original_price - pr.price) / pr.original_price) * 100 : 0,
              product_url: pr.product_url,
              last_scraped_at: pr.last_scraped_at,
              is_stale: isStale
            };
          });
          
          const productIsStale = storesPricing.some((sp: any) => sp.is_stale);
          const oldestScrapedAt = storesPricing.reduce((oldest: string, current: any) => {
            if (!oldest) return current.last_scraped_at;
            return new Date(current.last_scraped_at).getTime() < new Date(oldest).getTime() ? current.last_scraped_at : oldest;
          }, '');

          productsList.push({
            ...row,
            storesPricing,
            is_stale: productIsStale,
            last_scraped_at: oldestScrapedAt
          });
        }
      } catch (err) {
        console.error('[Route Direct Query Fallback Error]', err);
        productsList = [];
      }
    }

    // Format final currency outputs in Indian Rupees (₹)
    const formattedProducts = productsList.map(p => {
      const storesPricingWithCurrency = (p.storesPricing || []).map((sp: any) => ({
        ...sp,
        price_formatted: toINRString(sp.price),
        original_price_formatted: toINRString(sp.original_price)
      }));

      // Find lowest price to surface immediately
      const lowestPrice = storesPricingWithCurrency.length > 0 
        ? Math.min(...storesPricingWithCurrency.map((sp: any) => sp.price)) 
        : 0;

      return {
        ...p,
        storesPricing: storesPricingWithCurrency,
        lowest_price: lowestPrice,
        lowest_price_formatted: toINRString(lowestPrice)
      };
    });

    res.status(200).json({
      status: 'success',
      count: formattedProducts.length,
      data: {
        products: formattedProducts
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id/prices
 * Retrieves active stores, domain metadata, rating levels, and catalog price parameters 
 * corresponding to a specific product database identifier.
 */
router.get('/products/:id/prices', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      res.status(400).json({ status: 'fail', message: 'Invalid product key parameter id.' });
      return;
    }

    const querySql = `
      SELECT pp.price_id, pp.price, pp.original_price, pp.discount, pp.product_url, pp.is_available, pp.last_scraped_at,
             s.name AS store_name, s.domain AS store_domain, s.rating AS store_rating, s.logo_url AS store_logo
      FROM product_prices pp
      JOIN stores s ON pp.store_id = s.store_id
      WHERE pp.product_id = $1
      ORDER BY pp.price ASC;
    `;
    const result = await db.query(querySql, [productId]);

    // Format currency properties
    const now = Date.now();
    const cacheTtlDays = parseInt(process.env.CACHE_TTL_DAYS || '30', 10);
    const staleThresholdMs = cacheTtlDays * 24 * 60 * 60 * 1000;

    const pricesList = result.rows.map((row: any) => {
      const scrapedAt = new Date(row.last_scraped_at).getTime();
      const isStale = (now - scrapedAt) > staleThresholdMs;
      return {
        ...row,
        price: parseFloat(row.price),
        original_price: parseFloat(row.original_price),
        price_formatted: toINRString(parseFloat(row.price)),
        original_price_formatted: toINRString(parseFloat(row.original_price)),
        is_stale: isStale
      };
    });

    res.status(200).json({
      status: 'success',
      results: pricesList.length,
      data: {
        prices: pricesList
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id/best-price
 * Computes, isolates, and delivers the lowest priced store listing that is currently active and available.
 */
router.get('/products/:id/best-price', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      res.status(400).json({ status: 'fail', message: 'Invalid product key parameter id.' });
      return;
    }

    const querySql = `
      SELECT pp.price_id, pp.price, pp.original_price, pp.discount, pp.product_url, pp.is_available, pp.last_scraped_at,
             s.name AS store_name, s.domain AS store_domain, s.rating AS store_rating, s.logo_url AS store_logo,
             p.name AS product_name, p.brand AS product_brand
      FROM product_prices pp
      JOIN stores s ON pp.store_id = s.store_id
      JOIN products p ON pp.product_id = p.product_id
      WHERE pp.product_id = $1 AND pp.is_available = TRUE
      ORDER BY pp.price ASC
      LIMIT 1;
    `;
    const result = await db.query(querySql, [productId]);

    if (result.rows.length === 0) {
      res.status(404).json({
        status: 'fail',
        message: 'No available store pricing records found for this product.'
      });
      return;
    }

    const bestDeal = result.rows[0];
    const numericPrice = parseFloat(bestDeal.price);
    const numericOriginalPrice = parseFloat(bestDeal.original_price);

    res.status(200).json({
      status: 'success',
      data: {
        product_id: productId,
        product_name: bestDeal.product_name,
        brand: bestDeal.product_brand,
        best_price: numericPrice,
        best_price_formatted: toINRString(numericPrice),
        original_price: numericOriginalPrice,
        original_price_formatted: toINRString(numericOriginalPrice),
        discount_percentage: parseFloat(bestDeal.discount),
        store_name: bestDeal.store_name,
        store_domain: bestDeal.store_domain,
        store_rating: parseFloat(bestDeal.store_rating),
        store_logo: bestDeal.store_logo,
        product_url: bestDeal.product_url,
        last_scraped_at: bestDeal.last_scraped_at
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id/history
 * Returns the price history timeline points, facilitating graph representations on the product views.
 */
router.get('/products/:id/history', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      res.status(400).json({ status: 'fail', message: 'Invalid product key parameter id.' });
      return;
    }

    const querySql = `
      SELECT ph.price, ph.recorded_at AS date, s.name AS "storeName"
      FROM price_history ph
      JOIN stores s ON ph.store_id = s.store_id
      WHERE ph.product_id = $1
      ORDER BY ph.recorded_at ASC
      LIMIT 30;
    `;
    const result = await db.query(querySql, [productId]);
    
    const formattedHistory = result.rows.map((row: any) => ({
      price: parseFloat(row.price),
      date: row.date,
      storeName: row.storeName,
      price_formatted: toINRString(parseFloat(row.price))
    }));

    res.status(200).json(formattedHistory);
  } catch (err) {
    next(err);
  }
});

export default router;
