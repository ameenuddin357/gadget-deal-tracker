import { Request, Response, NextFunction } from 'express';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';

/**
 * Validates whether a string is a well-formed HTTP or HTTPS URL.
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * GET /api/admin/products/:productId/offers
 * Admin-only: Returns ALL offers for the requested product (available, unavailable, automatic, manual override).
 * Works for both active and inactive products.
 */
export const getAdminProductOffers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const productIdNum = Number(req.params.productId);
    if (!Number.isInteger(productIdNum) || productIdNum <= 0) {
      return next(new AppError('Invalid product ID.', 400));
    }

    // 1. Confirm product exists
    const prodRes = await db.query(
      `SELECT product_id, name, brand, model_no, is_active, data_source
       FROM products
       WHERE product_id = $1;`,
      [productIdNum]
    );

    if (prodRes.rows.length === 0) {
      return next(new AppError('Product not found.', 404));
    }

    const product = prodRes.rows[0];

    // 2. Fetch all retailer offers for this product
    const offersRes = await db.query(
      `SELECT 
         pp.price_id,
         pp.product_id,
         pp.store_id,
         s.name AS store_name,
         s.domain AS store_domain,
         s.logo_url AS store_logo_url,
         s.api_enabled AS store_api_enabled,
         pp.price,
         pp.original_price,
         pp.discount,
         pp.product_url,
         pp.is_available,
         pp.manual_override,
         pp.last_scraped_at,
         pp.created_at
       FROM product_prices pp
       JOIN stores s ON pp.store_id = s.store_id
       WHERE pp.product_id = $1
       ORDER BY pp.is_available DESC, pp.price ASC, s.name ASC;`,
      [productIdNum]
    );

    res.status(200).json({
      status: 'success',
      data: {
        product: {
          product_id: product.product_id,
          name: product.name,
          brand: product.brand,
          model_no: product.model_no,
          is_active: product.is_active,
          data_source: product.data_source
        },
        offers: offersRes.rows
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/products/:productId/offers
 * Admin-only: Creates a new retailer offer for a product.
 * Sets manual_override = TRUE, last_scraped_at = NULL, and creates an atomic initial price_history observation.
 * Protects against duplicate offers (product_id, store_id).
 */
export const createAdminProductOffer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let client;
  try {
    const productIdNum = Number(req.params.productId);
    if (!Number.isInteger(productIdNum) || productIdNum <= 0) {
      return next(new AppError('Invalid product ID.', 400));
    }

    const { store_id, price, original_price, product_url, is_available } = req.body;

    // Validate store_id
    const storeIdNum = Number(store_id);
    if (!Number.isInteger(storeIdNum) || storeIdNum <= 0) {
      return next(new AppError('Valid integer store_id is required.', 400));
    }

    // Validate price
    if (price === undefined || price === null || price === '') {
      return next(new AppError('Price is required.', 400));
    }
    const priceNum = typeof price === 'string' ? parseFloat(price) : Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return next(new AppError('Price must be a positive finite number.', 400));
    }

    // Validate original_price
    let origPriceNum: number | null = null;
    if (original_price !== undefined && original_price !== null && original_price !== '') {
      origPriceNum = typeof original_price === 'string' ? parseFloat(original_price) : Number(original_price);
      if (!Number.isFinite(origPriceNum) || origPriceNum < priceNum) {
        return next(new AppError('Original price must be greater than or equal to the selling price.', 400));
      }
    }

    // Validate product_url
    if (!product_url || typeof product_url !== 'string' || !isValidUrl(product_url.trim())) {
      return next(new AppError('Valid product URL starting with http:// or https:// is required.', 400));
    }
    const cleanProductUrl = product_url.trim();

    // Validate is_available
    let finalAvailable = true;
    if (is_available !== undefined) {
      if (typeof is_available !== 'boolean') {
        return next(new AppError('is_available must be a boolean.', 400));
      }
      finalAvailable = is_available;
    }

    client = await db.getClient();

    // 1. Verify product exists
    const prodRes = await client.query(
      'SELECT product_id FROM products WHERE product_id = $1;',
      [productIdNum]
    );
    if (prodRes.rows.length === 0) {
      return next(new AppError('Product not found.', 404));
    }

    // 2. Verify store exists
    const storeRes = await client.query(
      'SELECT store_id FROM stores WHERE store_id = $1;',
      [storeIdNum]
    );
    if (storeRes.rows.length === 0) {
      return next(new AppError('Store not found.', 404));
    }

    // 3. Duplicate protection check before attempting insert
    const existingOfferRes = await client.query(
      'SELECT price_id FROM product_prices WHERE product_id = $1 AND store_id = $2;',
      [productIdNum, storeIdNum]
    );
    if (existingOfferRes.rows.length > 0) {
      return next(
        new AppError(
          'An offer from this retailer already exists for this product. Edit the existing offer instead.',
          409
        )
      );
    }

    // 4. Atomic transaction: create offer and record initial price observation
    await client.query('BEGIN;');

    const insertPriceSql = `
      INSERT INTO product_prices (
        product_id, store_id, price, original_price, product_url,
        is_available, manual_override, last_scraped_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, NULL, NOW())
      RETURNING *;
    `;
    const priceRes = await client.query(insertPriceSql, [
      productIdNum,
      storeIdNum,
      priceNum,
      origPriceNum,
      cleanProductUrl,
      finalAvailable
    ]);
    const createdOffer = priceRes.rows[0];

    const insertHistorySql = `
      INSERT INTO price_history (
        product_id, store_id, price, recorded_at
      ) VALUES ($1, $2, $3, NOW())
      RETURNING *;
    `;
    const histRes = await client.query(insertHistorySql, [
      productIdNum,
      storeIdNum,
      priceNum
    ]);
    const createdHistory = histRes.rows[0];

    await client.query('COMMIT;');

    res.status(201).json({
      status: 'success',
      message: 'Retailer offer created successfully.',
      data: {
        offer: createdOffer,
        initialHistory: createdHistory
      }
    });
  } catch (err: any) {
    if (client) {
      try {
        await client.query('ROLLBACK;');
      } catch (rbErr) {
        console.error('Error rolling back offer creation:', rbErr);
      }
    }
    // Catch PostgreSQL unique violation 23505 as concurrent race-condition fallback
    if (err.code === '23505') {
      return next(
        new AppError(
          'An offer from this retailer already exists for this product. Edit the existing offer instead.',
          409
        )
      );
    }
    next(err);
  } finally {
    if (client) client.release();
  }
};

/**
 * PATCH /api/admin/offers/:priceId
 * Admin-only: Updates commercial fields (price, original_price, product_url) of an offer.
 * Strictly allows only: price, original_price, product_url in req.body.
 * Sets manual_override = TRUE if and only if commercial fields actually change.
 * If submitted values are identical to existing stored values (true no-op):
 *   Preserves manual_override (remains unchanged, e.g. FALSE), does not insert price_history, returns 200 with changed: false.
 * Supports { "original_price": null } to remove/clear list price (discount becomes 0, no price_history inserted).
 * Preserves last_scraped_at across all operations.
 * Atomically inserts a price_history row IF and ONLY IF numerical selling price changed (|diff| > 0.01).
 */
export const updateAdminOffer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let client;
  try {
    const priceIdNum = Number(req.params.priceId);
    if (!Number.isInteger(priceIdNum) || priceIdNum <= 0) {
      return next(new AppError('Invalid offer ID.', 400));
    }

    const bodyKeys = Object.keys(req.body || {});
    if (bodyKeys.length === 0) {
      return next(
        new AppError(
          'Please supply at least one editable field: price, original_price, or product_url.',
          400
        )
      );
    }

    // Strict allowlist: only price, original_price, and product_url are accepted
    const ALLOWED_FIELDS = new Set(['price', 'original_price', 'product_url']);
    const disallowedFields = bodyKeys.filter((k) => !ALLOWED_FIELDS.has(k));
    if (disallowedFields.length > 0) {
      return next(
        new AppError(
          `Field(s) not allowed: ${disallowedFields.join(', ')}. Only price, original_price, and product_url can be updated on this endpoint. For availability, use PATCH /api/admin/offers/:priceId/availability.`,
          400
        )
      );
    }

    const hasPrice = 'price' in req.body;
    const hasOrigPrice = 'original_price' in req.body;
    const hasUrl = 'product_url' in req.body;

    // Preliminary validation before DB transaction
    if (hasPrice) {
      if (req.body.price === null || req.body.price === '') {
        return next(new AppError('Price cannot be empty or null.', 400));
      }
      const p =
        typeof req.body.price === 'string' && req.body.price.trim() !== ''
          ? parseFloat(req.body.price)
          : Number(req.body.price);
      if (!Number.isFinite(p) || p <= 0) {
        return next(new AppError('Price must be a positive finite number.', 400));
      }
    }

    if (hasOrigPrice && req.body.original_price !== null) {
      const op =
        typeof req.body.original_price === 'string' && req.body.original_price.trim() !== ''
          ? parseFloat(req.body.original_price)
          : Number(req.body.original_price);
      if (!Number.isFinite(op) || op <= 0) {
        return next(
          new AppError('Original price must be a positive finite number or null.', 400)
        );
      }
    }

    if (hasUrl) {
      if (
        !req.body.product_url ||
        typeof req.body.product_url !== 'string' ||
        !isValidUrl(req.body.product_url.trim())
      ) {
        return next(
          new AppError('Valid product URL starting with http:// or https:// is required.', 400)
        );
      }
    }

    client = await db.getClient();
    await client.query('BEGIN;');

    // 1. Lock existing offer row for update
    const lockRes = await client.query(
      `SELECT price_id, product_id, store_id, price, original_price, discount, product_url,
              is_available, manual_override, last_scraped_at, created_at
       FROM product_prices
       WHERE price_id = $1
       FOR UPDATE;`,
      [priceIdNum]
    );

    if (lockRes.rows.length === 0) {
      await client.query('ROLLBACK;');
      return next(new AppError('Offer not found.', 404));
    }

    const existing = lockRes.rows[0];
    const oldPriceNum = parseFloat(existing.price);
    const oldOrigPriceNum =
      existing.original_price !== null ? parseFloat(existing.original_price) : null;
    const oldUrl = existing.product_url;

    // 2. Compute effective values
    let effectivePrice = oldPriceNum;
    if (hasPrice) {
      const p =
        typeof req.body.price === 'string'
          ? parseFloat(req.body.price)
          : Number(req.body.price);
      effectivePrice = p;
    }

    let effectiveOrigPrice = oldOrigPriceNum;
    if (hasOrigPrice) {
      if (req.body.original_price === null) {
        effectiveOrigPrice = null;
      } else {
        const op =
          typeof req.body.original_price === 'string'
            ? parseFloat(req.body.original_price)
            : Number(req.body.original_price);
        effectiveOrigPrice = op;
      }
    }

    let effectiveUrl = oldUrl;
    if (hasUrl) {
      effectiveUrl = req.body.product_url.trim();
    }

    // Validate original_price >= price constraint
    if (effectiveOrigPrice !== null && effectiveOrigPrice < effectivePrice) {
      await client.query('ROLLBACK;');
      return next(
        new AppError(
          'Original price must be greater than or equal to the selling price.',
          400
        )
      );
    }

    // 3. Determine genuine changes
    const priceChanged = hasPrice && Math.abs(oldPriceNum - effectivePrice) > 0.01;

    let origPriceChanged = false;
    if (hasOrigPrice) {
      if (oldOrigPriceNum === null && effectiveOrigPrice === null) {
        origPriceChanged = false;
      } else if (oldOrigPriceNum === null || effectiveOrigPrice === null) {
        origPriceChanged = true;
      } else {
        origPriceChanged = Math.abs(oldOrigPriceNum - effectiveOrigPrice) > 0.01;
      }
    }

    const urlChanged = hasUrl && oldUrl !== effectiveUrl;
    const changed = priceChanged || origPriceChanged || urlChanged;

    // 4. True No-Op: preserve manual_override, last_scraped_at, price_history
    if (!changed) {
      await client.query('COMMIT;');
      res.status(200).json({
        status: 'success',
        message: 'No changes detected. Offer remains unchanged.',
        data: {
          offer: existing,
          changed: false,
          priceChanged: false
        }
      });
      return;
    }

    // 5. Real commercial change claims manual ownership (manual_override = TRUE)
    if (priceChanged) {
      await client.query(
        `INSERT INTO price_history (product_id, store_id, price, recorded_at)
         VALUES ($1, $2, $3, NOW());`,
        [existing.product_id, existing.store_id, effectivePrice]
      );
    }

    // Update commercial fields and claim manual override, keeping last_scraped_at intact
    const updateRes = await client.query(
      `UPDATE product_prices
       SET price = $1,
           original_price = $2,
           product_url = $3,
           manual_override = TRUE
       WHERE price_id = $4
       RETURNING *;`,
      [effectivePrice, effectiveOrigPrice, effectiveUrl, priceIdNum]
    );
    const updatedOffer = updateRes.rows[0];

    await client.query('COMMIT;');

    res.status(200).json({
      status: 'success',
      message: 'Retailer offer updated successfully.',
      data: {
        offer: updatedOffer,
        changed: true,
        priceChanged
      }
    });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK;');
      } catch (rbErr) {
        console.error('Error rolling back offer update:', rbErr);
      }
    }
    next(err);
  } finally {
    if (client) client.release();
  }
};

/**
 * PATCH /api/admin/offers/:priceId/availability
 * Admin-only: Toggles or sets availability (is_available) of an offer.
 * Idempotent: Does not alter price, original_price, product_url, manual_override, or last_scraped_at.
 * Does NOT record any price_history.
 */
export const setAdminOfferAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const priceIdNum = Number(req.params.priceId);
    if (!Number.isInteger(priceIdNum) || priceIdNum <= 0) {
      return next(new AppError('Invalid offer ID.', 400));
    }

    const bodyKeys = Object.keys(req.body || {});
    if (bodyKeys.length === 0 || !('is_available' in req.body)) {
      return next(new AppError('Please supply is_available boolean field.', 400));
    }
    const disallowed = bodyKeys.filter((k) => k !== 'is_available');
    if (disallowed.length > 0) {
      return next(
        new AppError(
          `Field(s) not allowed: ${disallowed.join(', ')}. Only is_available is allowed on this endpoint.`,
          400
        )
      );
    }

    const { is_available } = req.body;
    if (typeof is_available !== 'boolean') {
      return next(new AppError('is_available must be an exact boolean.', 400));
    }

    const updateRes = await db.query(
      `UPDATE product_prices
       SET is_available = $1
       WHERE price_id = $2
       RETURNING *;`,
      [is_available, priceIdNum]
    );

    if (updateRes.rows.length === 0) {
      return next(new AppError('Offer not found.', 404));
    }

    res.status(200).json({
      status: 'success',
      message: `Offer marked as ${is_available ? 'available' : 'unavailable'} successfully.`,
      data: {
        offer: updateRes.rows[0]
      }
    });
  } catch (err) {
    next(err);
  }
};
