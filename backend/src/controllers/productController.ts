import { Request, Response, NextFunction } from 'express';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';

/**
 * PRODUCT CATALOG - LIST ALL PRODUCTS WITH THEIR CURRENT CHEAPEST STORE PRICE
 * GET /api/v1/products
 */
export const getAllProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Setup Pagination values (standard safety parameter in placements)
    const limit = parseInt(req.query.limit as string || '10', 10);
    const page = parseInt(req.query.page as string || '1', 10);
    const offset = (page - 1) * limit;

    // Optional filters matching key indexed paths
    const categoryId = req.query.category_id;
    const brand = req.query.brand;

    let queryParams: any[] = [];
    let filterClauses: string[] = [];

    if (categoryId) {
      queryParams.push(categoryId);
      filterClauses.push(`p.category_id = $${queryParams.length}`);
    }

    if (brand) {
      queryParams.push(brand);
      filterClauses.push(`p.brand = $${queryParams.length}`);
    }

    const whereString = filterClauses.length > 0 
      ? `WHERE ${filterClauses.join(' AND ')}` 
      : '';

    // SQL retrieves canonical products along with their cheapest scrawl price.
    // Uses standard Postgres SQL subquery mechanisms.
    const querySql = `
      SELECT 
        p.product_id, 
        p.name, 
        p.brand, 
        p.model_no, 
        p.slug, 
        p.image_url, 
        p.specs_summary, 
        c.name AS category_name,
        min_p.cheapest_price,
        min_p.store_name
      FROM products p
      JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN (
        SELECT DISTINCT ON (product_id) product_id, price AS cheapest_price, s.name AS store_name
        FROM product_prices pp
        JOIN stores s ON pp.store_id = s.store_id
        WHERE pp.is_available = TRUE
        ORDER BY product_id, pp.price ASC
      ) min_p ON p.product_id = min_p.product_id
      ${whereString}
      ORDER BY p.product_id ASC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2};
    `;

    queryParams.push(limit, offset);

    const result = await db.query(querySql, queryParams);

    // Grab total rows matching same filters to serve frontend metadata ratios
    let countParams = queryParams.slice(0, queryParams.length - 2);
    const countSql = `SELECT COUNT(*) FROM products p ${whereString};`;
    const countResult = await db.query(countSql, countParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);

    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      pagination: {
        totalItems: totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        limit
      },
      data: {
        products: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PRODUCT CATALOG - GET DETAILED PRODUCT DESCRIPTION AND LIVE PRICINGS PER PARTNER STORE
 * GET /api/v1/products/:id
 */
export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const productId = parseInt(req.params.id, 10);

    if (isNaN(productId)) {
      return next(new AppError('Invalid numeric product parameter.', 400));
    }

    // Retrieve central specifications
    const productSql = `
      SELECT p.*, c.name AS category_name
      FROM products p
      JOIN categories c ON p.category_id = c.category_id
      WHERE p.product_id = $1;
    `;
    const productResult = await db.query(productSql, [productId]);

    if (productResult.rows.length === 0) {
      return next(new AppError('No gadget catalog entry found matching this identifier.', 404));
    }

    const product = productResult.rows[0];

    // Find all live vendor store prices sorted cheapest first
    const pricesSql = `
      SELECT pp.price_id, pp.price, pp.original_price, pp.discount, pp.product_url, pp.is_available, pp.last_scraped_at, s.name AS store_name, s.rating AS store_rating, s.logo_url AS store_logo
      FROM product_prices pp
      JOIN stores s ON pp.store_id = s.store_id
      WHERE pp.product_id = $1
      ORDER BY pp.price ASC;
    `;
    const pricesResult = await db.query(pricesSql, [productId]);

    res.status(200).json({
      status: 'success',
      data: {
        product,
        storesPricing: pricesResult.rows
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PRODUCT CATALOG - SEARCH PRODUCTS WITH PARAMS (BENIGN PG PATTERN: ILIKE)
 * GET /api/v1/products/search/:query
 */
export const searchProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const searchTerm = req.params.query;

    if (!searchTerm || searchTerm.trim().length === 0) {
      return next(new AppError('Empty query search parameters.', 400));
    }

    // Direct, placement-friendly index-ready search filters
    // Use ILIKE with wildcards on name, brand, or specifications summary
    const sql = `
      SELECT p.product_id, p.name, p.brand, p.slug, p.image_url, p.specs_summary, c.name as category_name
      FROM products p
      JOIN categories c ON p.category_id = c.category_id
      WHERE p.name ILIKE $1 
         OR p.brand ILIKE $1 
         OR p.specs_summary ILIKE $1
      ORDER BY p.name ASC
      LIMIT 15;
    `;

    // Wrapping query value safely protects DB structures from escaping attacks
    const searchWildcard = `%${searchTerm.trim()}%`;
    const result = await db.query(sql, [searchWildcard]);

    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      data: {
        products: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
};
