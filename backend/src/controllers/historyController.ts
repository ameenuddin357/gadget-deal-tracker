import { Request, Response, NextFunction } from 'express';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';

/**
 * SEARCH HISTORY - GET RECENT USER SEARCHES (UP TO 20 DETAILED ENTRIES)
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
      ORDER BY searched_at DESC
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

    const activeQuery = (searchTerm || query || '').trim();

    if (!activeQuery || activeQuery.length === 0) {
      return next(new AppError('Search query parameter is missing or empty.', 400));
    }

    const activeProductName = productName || product_name || null;
    const activeProductImage = productImage || product_image || null;
    const activeLowestPrice = lowestPrice !== undefined ? lowestPrice : (lowest_price !== undefined ? lowest_price : null);
    const activeStoreName = storeName || store_name || null;
    const activeProductId = productId || product_id || null;

    // Duplication Guard: Prevent duplicate search listings within a 5-minute timeframe by updating timestamp
    const checkSql = `
      SELECT history_id 
      FROM search_history 
      WHERE user_id = $1 AND (LOWER(search_term) = LOWER($2) OR LOWER(query) = LOWER($2)) 
        AND searched_at > NOW() - INTERVAL '5 minutes'
      ORDER BY searched_at DESC 
      LIMIT 1;
    `;
    const checkRes = await db.query(checkSql, [userId, activeQuery]);

    let finalRecord;

    if (checkRes.rows.length > 0) {
      // Update existing record timestamp and detail values
      const existingId = checkRes.rows[0].history_id;
      const updateSql = `
        UPDATE search_history 
        SET searched_at = CURRENT_TIMESTAMP,
            product_name = COALESCE($1, product_name),
            product_image = COALESCE($2, product_image),
            lowest_price = COALESCE($3, lowest_price),
            store_name = COALESCE($4, store_name),
            product_id = COALESCE($5, product_id)
        WHERE history_id = $6
        RETURNING history_id, product_id, search_term, searched_at, product_name, product_image, lowest_price, store_name;
      `;
      const updateRes = await db.query(updateSql, [
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
        RETURNING history_id, product_id, search_term, searched_at, product_name, product_image, lowest_price, store_name;
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
  } catch (err) {
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

    if (!query) {
      return next(new AppError('Search query parameter to delete is missing.', 400));
    }

    const sql = 'DELETE FROM search_history WHERE user_id = $1 AND (LOWER(search_term) = LOWER($2) OR LOWER(query) = LOWER($2));';
    await db.query(sql, [userId, query.trim()]);

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
