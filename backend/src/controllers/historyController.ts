import { Request, Response, NextFunction } from 'express';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';

/**
 * SEARCH HISTORY - GET RECENT USER SEARCHES (UP TO 20 DETAILED ENTRIES)
 * Deduplicated by normalized search query, keeping the most recent entry with its product data.
 * GET /api/history
 */
export const getSearchHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const sql = `
      SELECT 
        sub.history_id, 
        sub.product_id,
        sub.search_term,
        sub.query,
        sub.product_name,
        sub.product_image,
        sub.lowest_price,
        sub.store_name,
        sub.searched_at,
        sub.searched_at AS last_searched_at
      FROM (
        SELECT DISTINCT ON (LOWER(TRIM(REGEXP_REPLACE(COALESCE(search_term, query, ''), '\\s+', ' ', 'g'))))
          history_id,
          product_id,
          COALESCE(search_term, query) AS search_term,
          COALESCE(search_term, query) AS query,
          product_name,
          product_image,
          lowest_price,
          store_name,
          searched_at
        FROM search_history
        WHERE user_id = $1
          AND TRIM(COALESCE(search_term, query, '')) <> ''
        ORDER BY 
          LOWER(TRIM(REGEXP_REPLACE(COALESCE(search_term, query, ''), '\\s+', ' ', 'g'))), 
          searched_at DESC, 
          history_id DESC
      ) sub
      ORDER BY sub.searched_at DESC
      LIMIT 20;
    `;

    const result = await db.query(sql, [userId]);

    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      data: {
        history: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * SEARCH HISTORY - RECORD A NEW USER SEARCH QUERY
 * POST /api/history
 */
export const recordSearch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { 
      query, 
      searchTerm, 
      productName, 
      product_name, 
      productImage, 
      product_image, 
      lowestPrice, 
      lowest_price, 
      storeName, 
      store_name,
      productId,
      product_id
    } = req.body;

    const rawQuery = (searchTerm || query || '');
    if (typeof rawQuery !== 'string' || rawQuery.trim().length === 0) {
      return next(new AppError('Search query parameter is missing or empty.', 400));
    }

    const activeQuery = rawQuery.trim().replace(/\s+/g, ' ').slice(0, 200);
    const normalizedQuery = activeQuery.toLowerCase();

    let activeProductName = typeof (productName || product_name) === 'string' ? (productName || product_name).slice(0, 255) : null;
    let activeProductImage = typeof (productImage || product_image) === 'string' ? (productImage || product_image).slice(0, 500) : null;
    
    let rawLowestPrice = lowestPrice !== undefined ? lowestPrice : (lowest_price !== undefined ? lowest_price : null);
    let activeLowestPrice: number | null = null;
    if (rawLowestPrice !== null && rawLowestPrice !== undefined) {
      const pNum = parseFloat(rawLowestPrice);
      if (!isNaN(pNum) && pNum >= 0 && pNum <= 10000000) activeLowestPrice = pNum;
    }

    let activeStoreName = typeof (storeName || store_name) === 'string' ? (storeName || store_name).slice(0, 100) : null;
    
    let rawProductId = productId || product_id || null;
    let activeProductId: number | null = null;
    if (rawProductId !== null && rawProductId !== undefined) {
      const pIdNum = parseInt(rawProductId, 10);
      if (!isNaN(pIdNum) && pIdNum > 0 && pIdNum <= 2147483647) activeProductId = pIdNum;
    }

    if (!activeProductId && activeQuery) {
      try {
        const matchRes = await db.query(`
          SELECT p.product_id, p.name as product_name, p.image_url as product_image, min_p.cheapest_price as lowest_price, min_p.store_name
          FROM products p
          JOIN categories c ON p.category_id = c.category_id
          LEFT JOIN (
            SELECT DISTINCT ON (product_id) product_id, price AS cheapest_price, s.name AS store_name
            FROM product_prices pp
            JOIN stores s ON pp.store_id = s.store_id
            WHERE pp.is_available = TRUE
            ORDER BY product_id, pp.price ASC
          ) min_p ON p.product_id = min_p.product_id
          WHERE (p.name ILIKE $1 OR p.brand ILIKE $1 OR p.specs_summary ILIKE $1 OR c.name ILIKE $1)
          ORDER BY min_p.cheapest_price ASC NULLS LAST
          LIMIT 1;
        `, [`%${activeQuery}%`]);

        if (matchRes.rows.length > 0) {
          const match = matchRes.rows[0];
          activeProductId = match.product_id;
          activeProductName = match.product_name;
          activeProductImage = match.product_image;
          activeLowestPrice = match.lowest_price;
          activeStoreName = match.store_name;
        }
      } catch (err) {}
    }

    // Duplication Guard: Check if an existing normalized record exists for this user across history
    const checkSql = `
      SELECT history_id 
      FROM search_history 
      WHERE user_id = $1 
        AND LOWER(TRIM(REGEXP_REPLACE(COALESCE(search_term, query, ''), '\\s+', ' ', 'g'))) = $2
      ORDER BY searched_at DESC 
      LIMIT 1;
    `;
    const checkRes = await db.query(checkSql, [userId, normalizedQuery]);

    let finalRecord;

    if (checkRes.rows.length > 0) {
      // Update existing record timestamp and fresh discovered details
      const existingId = checkRes.rows[0].history_id;
      const updateSql = `
        UPDATE search_history 
        SET searched_at = CURRENT_TIMESTAMP,
            search_term = $1,
            query = $1,
            product_name = COALESCE($2, product_name),
            product_image = COALESCE($3, product_image),
            lowest_price = COALESCE($4, lowest_price),
            store_name = COALESCE($5, store_name),
            product_id = COALESCE($6, product_id)
        WHERE history_id = $7
        RETURNING history_id, product_id, search_term, query, searched_at, product_name, product_image, lowest_price, store_name;
      `;
      const updateRes = await db.query(updateSql, [
        activeQuery,
        activeProductName, 
        activeProductImage, 
        activeLowestPrice, 
        activeStoreName, 
        activeProductId,
        existingId
      ]);
      finalRecord = updateRes.rows[0];
    } else {
      // Normal insert
      const insertSql = `
        INSERT INTO search_history (user_id, search_term, query, product_name, product_image, lowest_price, store_name, product_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING history_id, product_id, search_term, query, searched_at, product_name, product_image, lowest_price, store_name;
      `;
      const insertRes = await db.query(insertSql, [
        userId, 
        activeQuery, 
        activeQuery, 
        activeProductName, 
        activeProductImage, 
        activeLowestPrice, 
        activeStoreName,
        activeProductId
      ]);
      finalRecord = insertRes.rows[0];
    }

    res.status(201).json({
      status: 'success',
      message: 'Search query recorded successfully.',
      data: {
        record: finalRecord
      }
    });
  } catch (err: any) {
    if (err.code === '23503') {
      try {
        const rawQ = (req.body.searchTerm || req.body.query || '').trim().replace(/\s+/g, ' ').slice(0, 200);
        const insertSql = `
          INSERT INTO search_history (user_id, search_term, query, product_name, product_image, lowest_price, store_name, product_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
          RETURNING history_id, product_id, search_term, query, searched_at, product_name, product_image, lowest_price, store_name;
        `;
        const insertRes = await db.query(insertSql, [
          req.user!.userId, 
          rawQ, 
          rawQ, 
          req.body.productName || req.body.product_name || null, 
          req.body.productImage || req.body.product_image || null, 
          req.body.lowestPrice !== undefined ? req.body.lowestPrice : (req.body.lowest_price !== undefined ? req.body.lowest_price : null), 
          req.body.storeName || req.body.store_name || null
        ]);
        
        res.status(201).json({
          status: 'success',
          message: 'Search query recorded successfully (without linked product).',
          data: {
            record: insertRes.rows[0]
          }
        });
        return;
      } catch (retryErr) {
        next(retryErr);
        return;
      }
    }
    next(err);
  }
};

/**
 * SEARCH HISTORY - REMOVE A SPECIFIC SEARCH QUERY
 * DELETE /api/history/item
 */
export const deleteSearchQuery = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return next(new AppError('Search query parameter to delete is missing.', 400));
    }

    const normalized = query.trim().replace(/\s+/g, ' ').toLowerCase();

    const sql = `
      DELETE FROM search_history 
      WHERE user_id = $1 
        AND LOWER(TRIM(REGEXP_REPLACE(COALESCE(search_term, query, ''), '\\s+', ' ', 'g'))) = $2;
    `;
    await db.query(sql, [userId, normalized]);

    res.status(200).json({
      status: 'success',
      message: 'Search term removed from history.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * SEARCH HISTORY - CLEAR ALL HISTORY FOR USER
 * DELETE /api/history
 */
export const clearSearchHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const sql = 'DELETE FROM search_history WHERE user_id = $1;';
    await db.query(sql, [userId]);

    res.status(200).json({
      status: 'success',
      message: 'Search history cleared successfully.'
    });
  } catch (err) {
    next(err);
  }
};
