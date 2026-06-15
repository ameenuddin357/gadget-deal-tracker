import { Request, Response, NextFunction } from 'express';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';

/**
 * WATCHLIST RELATIONS - GET USER PERSONAL WATCHLIST BOOKMARKS
 * GET /api/v1/watchlist
 */
export const getWatchlist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Read authorized user ID from JWT verification payload
    const userId = req.user!.userId;

    const sql = `
      SELECT 
        w.watchlist_id, 
        w.added_at, 
        p.product_id, 
        p.name AS product_name, 
        p.brand, 
        p.specs_summary, 
        p.image_url, 
        min_p.lowest_live_price,
        min_p.store_name AS purchase_outlet
      FROM watchlist w
      JOIN products p ON w.product_id = p.product_id
      LEFT JOIN (
        SELECT DISTINCT ON (product_id) product_id, price AS lowest_live_price, s.name AS store_name
        FROM product_prices pp
        JOIN stores s ON pp.store_id = s.store_id
        WHERE pp.is_available = TRUE
        ORDER BY product_id, pp.price ASC
      ) min_p ON p.product_id = min_p.product_id
      WHERE w.user_id = $1
      ORDER BY w.added_at DESC;
    `;

    const result = await db.query(sql, [userId]);

    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      data: {
        watchlist: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * WATCHLIST RELATIONS - ADD ADVERTISED GADGET TO PERSON WATCHLIST
 * POST /api/v1/watchlist
 */
export const addToWatchlist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { productId } = req.body;

    if (!productId) {
      return next(new AppError('Please provide raw productId in post payload.', 400));
    }

    // Verify catalog entry exists prior to writing connection tuple
    const productCheck = await db.query('SELECT product_id FROM products WHERE product_id = $1;', [productId]);
    if (productCheck.rows.length === 0) {
      return next(new AppError('No catalog product found matching this identifier.', 404));
    }

    // Attempt to write the bookmark linkage safely
    const sql = `
      INSERT INTO watchlist (user_id, product_id)
      VALUES ($1, $2)
      RETURNING watchlist_id, added_at, user_id, product_id;
    `;

    const result = await db.query(sql, [userId, productId]);

    res.status(201).json({
      status: 'success',
      message: 'Product added to watchlist success.',
      data: {
        watchlistEntry: result.rows[0]
      }
    });
  } catch (err: any) {
    // If user tries to add duplicate record, Postgres composite unique throws 23505 constraint error
    if (err.code === '23505') {
      return next(new AppError('This gadget is already on your watchlist catalog.', 400));
    }
    next(err);
  }
};

/**
 * WATCHLIST RELATIONS - DELETE WATCHED GADGET FROM USER DASHBOARD LIST
 * DELETE /api/v1/watchlist/:id
 */
export const removeFromWatchlist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const watchlistId = parseInt(req.params.id, 10);

    if (isNaN(watchlistId)) {
      return next(new AppError('Invalid watchlist identifier.', 400));
    }

    // Authenticate delete action - prevent users from deleting bookmarks owned by others (Crucial placement security!)
    const ownerCheck = await db.query('SELECT user_id FROM watchlist WHERE watchlist_id = $1;', [watchlistId]);

    if (ownerCheck.rows.length === 0) {
      return next(new AppError('Bookmark record not found.', 404));
    }

    if (ownerCheck.rows[0].user_id !== userId) {
      return next(new AppError('Unauthorized. You do not hold ownership permission over this bookmark.', 403));
    }

    const deleteSql = 'DELETE FROM watchlist WHERE watchlist_id = $1;';
    await db.query(deleteSql, [watchlistId]);

    res.status(200).json({
      status: 'success',
      message: 'Product successfully removed from your watchlist.'
    });
  } catch (err) {
    next(err);
  }
};
