import { Request, Response, NextFunction } from 'express';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { getProductTypeSqlExpression } from '../utils/productClassifier.ts';
import { NormalizationService } from '../services/normalizationService.ts';

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
 * Helper to generate URL-safe alphanumeric slugs.
 */
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

/**
 * GET /api/admin/products
 * Lists products for administration with search, status filtering, and pagination.
 * Includes retailer offer counts, available counts, and lowest available prices.
 */
export const getAdminProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, status = 'all', page = '1', limit = '20' } = req.query;

    let pageNum = parseInt(page as string, 10);
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

    let limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum < 1) limitNum = 20;
    if (limitNum > 100) limitNum = 100;

    const offset = (pageNum - 1) * limitNum;
    const queryParams: any[] = [];
    const filterClauses: string[] = [];

    // Filter by product active status
    const statusStr = (typeof status === 'string' ? status : 'all').toLowerCase().trim();
    if (statusStr === 'active') {
      filterClauses.push('p.is_active = TRUE');
    } else if (statusStr === 'inactive') {
      filterClauses.push('p.is_active = FALSE');
    }

    // Search across name, brand, model_no, and slug
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      queryParams.push(term);
      const paramIdx = queryParams.length;
      filterClauses.push(
        `(p.name ILIKE $${paramIdx} OR p.brand ILIKE $${paramIdx} OR p.model_no ILIKE $${paramIdx} OR p.slug ILIKE $${paramIdx})`
      );
    }

    const whereSql = filterClauses.length > 0 ? `WHERE ${filterClauses.join(' AND ')}` : '';

    // Calculate total matching records for pagination metadata
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM products p
      JOIN categories c ON p.category_id = c.category_id
      ${whereSql};
    `;
    const countRes = await db.query(countSql, queryParams);
    const totalItems = countRes.rows[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / limitNum);

    // Fetch paginated admin products with aggregated offer counts
    const typeClassificationSql = getProductTypeSqlExpression('p', 'c');
    const dataParams = [...queryParams, limitNum, offset];
    const limitParamIdx = dataParams.length - 1;
    const offsetParamIdx = dataParams.length;

    const dataSql = `
      SELECT 
        p.product_id,
        p.name,
        p.brand,
        p.model_no,
        p.slug,
        p.canonical_slug,
        p.storage_variant,
        p.color_variant,
        p.category_id,
        c.name AS category_name,
        (${typeClassificationSql}) AS product_type,
        p.data_source,
        p.image_url,
        p.description,
        p.specs_summary,
        p.release_date,
        p.is_active,
        p.created_at,
        COALESCE(offer_stats.retailer_offer_count, 0)::int AS retailer_offer_count,
        COALESCE(offer_stats.available_offer_count, 0)::int AS available_offer_count,
        offer_stats.lowest_available_price
      FROM products p
      JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN (
        SELECT 
          product_id,
          COUNT(*)::int AS retailer_offer_count,
          COUNT(*) FILTER (WHERE is_available = TRUE)::int AS available_offer_count,
          MIN(price) FILTER (WHERE is_available = TRUE) AS lowest_available_price
        FROM product_prices
        GROUP BY product_id
      ) offer_stats ON p.product_id = offer_stats.product_id
      ${whereSql}
      ORDER BY p.product_id DESC
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx};
    `;

    const dataRes = await db.query(dataSql, dataParams);

    res.status(200).json({
      status: 'success',
      results: dataRes.rows.length,
      pagination: {
        page: pageNum,
        currentPage: pageNum,
        limit: limitNum,
        totalItems,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      data: {
        products: dataRes.rows
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/products
 * Transactionally creates a new product, initial retailer offer, and initial price history observation.
 */
export const createAdminProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const {
    name,
    brand,
    category_id,
    model_no,
    canonical_slug,
    storage_variant,
    color_variant,
    image_url,
    description,
    specs_summary,
    release_date,
    store_id,
    price,
    original_price,
    product_url,
    is_available
  } = req.body;

  // 1. Strict input validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return next(new AppError('Product name is required and must be non-empty.', 400));
  }
  if (!brand || typeof brand !== 'string' || brand.trim().length === 0) {
    return next(new AppError('Brand is required and must be non-empty.', 400));
  }

  const catIdNum = parseInt(category_id, 10);
  if (isNaN(catIdNum) || catIdNum <= 0) {
    return next(new AppError('Valid positive integer category_id is required.', 400));
  }

  const storeIdNum = parseInt(store_id, 10);
  if (isNaN(storeIdNum) || storeIdNum <= 0) {
    return next(new AppError('Valid positive integer store_id is required for the initial offer.', 400));
  }

  const priceNum = Number(price);
  if (isNaN(priceNum) || !isFinite(priceNum) || priceNum <= 0) {
    return next(new AppError('Price must be a positive finite numeric amount.', 400));
  }

  let origPriceNum: number | null = null;
  if (original_price !== undefined && original_price !== null && String(original_price).trim() !== '') {
    origPriceNum = Number(original_price);
    if (isNaN(origPriceNum) || !isFinite(origPriceNum) || origPriceNum < priceNum) {
      return next(new AppError('Original price must be greater than or equal to the selling price.', 400));
    }
  }

  if (!product_url || typeof product_url !== 'string' || !isValidUrl(product_url.trim())) {
    return next(new AppError('A valid HTTP or HTTPS product_url is required for the initial offer.', 400));
  }

  if (image_url && typeof image_url === 'string' && image_url.trim().length > 0 && !isValidUrl(image_url.trim())) {
    return next(new AppError('Optional image_url must be a valid HTTP or HTTPS URL.', 400));
  }

  if (release_date && typeof release_date === 'string' && release_date.trim().length > 0 && isNaN(Date.parse(release_date))) {
    return next(new AppError('Invalid release_date format. Please provide a valid date string (e.g. YYYY-MM-DD).', 400));
  }

  let client;
  try {
    client = await db.getClient();
    await client.query('BEGIN;');

    // 2. Confirm referenced category exists
    const catCheck = await client.query('SELECT category_id FROM categories WHERE category_id = $1;', [catIdNum]);
    if (catCheck.rows.length === 0) {
      await client.query('ROLLBACK;');
      return next(new AppError('Referenced category does not exist.', 404));
    }

    // 3. Confirm referenced retailer store exists
    const storeCheck = await client.query('SELECT store_id FROM stores WHERE store_id = $1;', [storeIdNum]);
    if (storeCheck.rows.length === 0) {
      await client.query('ROLLBACK;');
      return next(new AppError('Referenced retailer store does not exist.', 404));
    }

    // 4. Generate deterministic collision-safe slug
    const cleanName = name.trim();
    const cleanBrand = brand.trim();
    const parsed = NormalizationService.parseProductDetails(cleanName, cleanBrand);

    let baseSlug = parsed.variantSlug || slugify(`${cleanBrand}-${cleanName}`);
    if (!baseSlug) baseSlug = `product-${Date.now()}`;

    let candidateSlug = baseSlug;
    let counter = 2;
    while (true) {
      const existing = await client.query('SELECT product_id FROM products WHERE slug = $1 LIMIT 1;', [candidateSlug]);
      if (existing.rows.length === 0) break;
      candidateSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    const finalCanonicalSlug = canonical_slug && typeof canonical_slug === 'string' && canonical_slug.trim().length > 0
      ? canonical_slug.trim()
      : (parsed.canonicalSlug || candidateSlug);

    const finalStorage = storage_variant && typeof storage_variant === 'string' && storage_variant.trim().length > 0
      ? storage_variant.trim()
      : parsed.storageVariant;

    const finalColor = color_variant && typeof color_variant === 'string' && color_variant.trim().length > 0
      ? color_variant.trim()
      : parsed.colorVariant;

    const finalModelNo = model_no && typeof model_no === 'string' && model_no.trim().length > 0 ? model_no.trim() : null;
    const finalImageUrl = image_url && typeof image_url === 'string' && image_url.trim().length > 0 ? image_url.trim() : null;
    const finalDescription = description && typeof description === 'string' && description.trim().length > 0 ? description.trim() : null;
    const finalSpecs = specs_summary && typeof specs_summary === 'string' && specs_summary.trim().length > 0 ? specs_summary.trim() : null;
    const finalReleaseDate = release_date && typeof release_date === 'string' && release_date.trim().length > 0 ? release_date.trim() : null;

    // 5. Insert product row (always manual data_source and is_active = TRUE)
    const insertProductSql = `
      INSERT INTO products (
        name, brand, category_id, model_no, slug, canonical_slug,
        storage_variant, color_variant, image_url, description,
        specs_summary, release_date, data_source, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'manual', TRUE, NOW())
      RETURNING *;
    `;
    const prodRes = await client.query(insertProductSql, [
      cleanName,
      cleanBrand,
      catIdNum,
      finalModelNo,
      candidateSlug,
      finalCanonicalSlug,
      finalStorage,
      finalColor,
      finalImageUrl,
      finalDescription,
      finalSpecs,
      finalReleaseDate
    ]);
    const createdProduct = prodRes.rows[0];
    const newProductId = createdProduct.product_id;

    // 6. Insert initial retailer offer (product_prices)
    // NOTE: discount is a PostgreSQL GENERATED STORED column; DO NOT include it in the INSERT list
    const finalAvailable = is_available === undefined ? true : Boolean(is_available);
    const cleanProductUrl = product_url.trim();

    const insertPriceSql = `
      INSERT INTO product_prices (
        product_id, store_id, price, original_price, product_url, is_available, manual_override, last_scraped_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
      RETURNING *;
    `;
    const priceRes = await client.query(insertPriceSql, [
      newProductId,
      storeIdNum,
      priceNum,
      origPriceNum,
      cleanProductUrl,
      finalAvailable
    ]);
    const createdOffer = priceRes.rows[0];

    // 7. Insert initial genuine price observation into price_history
    const insertHistorySql = `
      INSERT INTO price_history (
        product_id, store_id, price, recorded_at
      ) VALUES ($1, $2, $3, NOW())
      RETURNING *;
    `;
    const histRes = await client.query(insertHistorySql, [
      newProductId,
      storeIdNum,
      priceNum
    ]);
    const createdHistory = histRes.rows[0];

    // 8. Commit atomic transaction
    await client.query('COMMIT;');

    res.status(201).json({
      status: 'success',
      message: 'Product and initial retailer offer created successfully.',
      data: {
        product: createdProduct,
        initialOffer: createdOffer,
        initialHistory: createdHistory
      }
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK;');
    next(err);
  } finally {
    if (client) client.release();
  }
};

/**
 * PATCH /api/admin/products/:productId
 * Updates metadata fields of an existing product.
 * Modifies ONLY product metadata (not pricing, stores, offers, data_source, or is_active).
 */
export const updateAdminProductMetadata = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pId = parseInt(req.params.productId, 10);
    if (isNaN(pId) || pId <= 0) {
      return next(new AppError('Invalid numeric product identifier.', 400));
    }

    // Verify product exists
    const existingRes = await db.query('SELECT * FROM products WHERE product_id = $1;', [pId]);
    if (existingRes.rows.length === 0) {
      return next(new AppError('Product not found.', 404));
    }
    const currentProduct = existingRes.rows[0];

    const {
      name,
      brand,
      category_id,
      model_no,
      canonical_slug,
      storage_variant,
      color_variant,
      image_url,
      description,
      specs_summary,
      release_date
    } = req.body;

    const updates: { col: string; val: any }[] = [];

    // 1. Name and slug update handling
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return next(new AppError('Product name must be a non-empty string.', 400));
      }
      const cleanName = name.trim();
      updates.push({ col: 'name', val: cleanName });

      if (cleanName !== currentProduct.name) {
        const currentBrand = brand && typeof brand === 'string' && brand.trim().length > 0 ? brand.trim() : currentProduct.brand;
        const parsed = NormalizationService.parseProductDetails(cleanName, currentBrand);
        let baseSlug = parsed.variantSlug || slugify(`${currentBrand}-${cleanName}`);
        if (!baseSlug) baseSlug = `product-${pId}`;

        let candidateSlug = baseSlug;
        let counter = 2;
        while (true) {
          const existing = await db.query(
            'SELECT product_id FROM products WHERE slug = $1 AND product_id != $2 LIMIT 1;',
            [candidateSlug, pId]
          );
          if (existing.rows.length === 0) break;
          candidateSlug = `${baseSlug}-${counter}`;
          counter++;
        }
        updates.push({ col: 'slug', val: candidateSlug });
      }
    }

    // 2. Brand
    if (brand !== undefined) {
      if (typeof brand !== 'string' || brand.trim().length === 0) {
        return next(new AppError('Brand must be a non-empty string.', 400));
      }
      updates.push({ col: 'brand', val: brand.trim() });
    }

    // 3. Category validation
    if (category_id !== undefined) {
      const catIdNum = parseInt(category_id, 10);
      if (isNaN(catIdNum) || catIdNum <= 0) {
        return next(new AppError('category_id must be a valid positive integer.', 400));
      }
      const catCheck = await db.query('SELECT category_id FROM categories WHERE category_id = $1;', [catIdNum]);
      if (catCheck.rows.length === 0) {
        return next(new AppError('Referenced category does not exist.', 404));
      }
      updates.push({ col: 'category_id', val: catIdNum });
    }

    // 4. Model number
    if (model_no !== undefined) {
      updates.push({ col: 'model_no', val: model_no && typeof model_no === 'string' ? model_no.trim() : null });
    }

    // 5. Canonical slug
    if (canonical_slug !== undefined) {
      updates.push({ col: 'canonical_slug', val: canonical_slug && typeof canonical_slug === 'string' ? canonical_slug.trim() : null });
    }

    // 6. Variants
    if (storage_variant !== undefined) {
      updates.push({ col: 'storage_variant', val: storage_variant && typeof storage_variant === 'string' ? storage_variant.trim() : 'N/A' });
    }
    if (color_variant !== undefined) {
      updates.push({ col: 'color_variant', val: color_variant && typeof color_variant === 'string' ? color_variant.trim() : 'N/A' });
    }

    // 7. Image URL
    if (image_url !== undefined) {
      if (image_url && typeof image_url === 'string' && image_url.trim().length > 0) {
        if (!isValidUrl(image_url.trim())) {
          return next(new AppError('image_url must be a valid HTTP or HTTPS URL.', 400));
        }
        updates.push({ col: 'image_url', val: image_url.trim() });
      } else {
        updates.push({ col: 'image_url', val: null });
      }
    }

    // 8. Description & Specs
    if (description !== undefined) {
      updates.push({ col: 'description', val: description && typeof description === 'string' ? description.trim() : null });
    }
    if (specs_summary !== undefined) {
      updates.push({ col: 'specs_summary', val: specs_summary && typeof specs_summary === 'string' ? specs_summary.trim() : null });
    }

    // 9. Release Date
    if (release_date !== undefined) {
      if (release_date && typeof release_date === 'string' && release_date.trim().length > 0) {
        if (isNaN(Date.parse(release_date))) {
          return next(new AppError('Invalid release_date format.', 400));
        }
        updates.push({ col: 'release_date', val: release_date.trim() });
      } else {
        updates.push({ col: 'release_date', val: null });
      }
    }

    if (updates.length === 0) {
      return next(new AppError('No valid metadata fields were provided for update.', 400));
    }

    const setClauses = updates.map((u, i) => `${u.col} = $${i + 1}`).join(', ');
    const params = updates.map(u => u.val);
    params.push(pId);

    const updateSql = `
      UPDATE products
      SET ${setClauses}
      WHERE product_id = $${params.length}
      RETURNING *;
    `;
    const updateRes = await db.query(updateSql, params);

    res.status(200).json({
      status: 'success',
      message: 'Product metadata updated successfully.',
      data: {
        product: updateRes.rows[0]
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/products/:productId/deactivate
 * Soft-deactivates a product (is_active = FALSE).
 * Preserves all price records, history, watchlists, and alerts.
 */
export const deactivateAdminProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pId = parseInt(req.params.productId, 10);
    if (isNaN(pId) || pId <= 0) {
      return next(new AppError('Invalid numeric product identifier.', 400));
    }

    // Verify product exists
    const checkRes = await db.query('SELECT product_id, name, is_active FROM products WHERE product_id = $1;', [pId]);
    if (checkRes.rows.length === 0) {
      return next(new AppError('Product not found.', 404));
    }

    const product = checkRes.rows[0];

    // Idempotent: if already inactive, return clean response without modification
    if (!product.is_active) {
      res.status(200).json({
        status: 'success',
        message: 'Product is already inactive.',
        data: {
          product_id: pId,
          name: product.name,
          is_active: false
        }
      });
      return;
    }

    const updateRes = await db.query(
      'UPDATE products SET is_active = FALSE WHERE product_id = $1 RETURNING product_id, name, is_active;',
      [pId]
    );

    res.status(200).json({
      status: 'success',
      message: 'Product deactivated successfully.',
      data: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/products/:productId/reactivate
 * Reactivates a product (is_active = TRUE).
 * Does not alter retailer offer availability.
 */
export const reactivateAdminProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pId = parseInt(req.params.productId, 10);
    if (isNaN(pId) || pId <= 0) {
      return next(new AppError('Invalid numeric product identifier.', 400));
    }

    // Verify product exists
    const checkRes = await db.query('SELECT product_id, name, is_active FROM products WHERE product_id = $1;', [pId]);
    if (checkRes.rows.length === 0) {
      return next(new AppError('Product not found.', 404));
    }

    const product = checkRes.rows[0];

    // Idempotent: if already active, return clean response without modification
    if (product.is_active) {
      res.status(200).json({
        status: 'success',
        message: 'Product is already active.',
        data: {
          product_id: pId,
          name: product.name,
          is_active: true
        }
      });
      return;
    }

    const updateRes = await db.query(
      'UPDATE products SET is_active = TRUE WHERE product_id = $1 RETURNING product_id, name, is_active;',
      [pId]
    );

    res.status(200).json({
      status: 'success',
      message: 'Product reactivated successfully.',
      data: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/categories
 * Lists all categories ordered by name for admin product lookups.
 */
export const getAdminCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await db.query(
      'SELECT category_id, name, slug FROM categories ORDER BY name ASC;'
    );

    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      data: {
        categories: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/stores
 * Lists all stores ordered by name for admin initial offer product lookups.
 */
export const getAdminStores = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await db.query(
      'SELECT store_id, name, domain, api_enabled FROM stores ORDER BY name ASC;'
    );

    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      data: {
        stores: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
};
