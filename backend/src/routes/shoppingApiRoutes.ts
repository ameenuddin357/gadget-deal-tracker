import { Router, Request, Response, NextFunction } from 'express';
import db from '../config/db.ts';
import { RapidApiService } from '../services/rapidApiService.ts';
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
    const syncedProducts = await RapidApiService.searchAndSyncProducts(keyword);

    // Format final currency outputs in Indian Rupees (₹)
    const formattedProducts = syncedProducts.map(p => {
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
    const pricesList = result.rows.map((row: any) => ({
      ...row,
      price: parseFloat(row.price),
      original_price: parseFloat(row.original_price),
      price_formatted: toINRString(parseFloat(row.price)),
      original_price_formatted: toINRString(parseFloat(row.original_price))
    }));

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
