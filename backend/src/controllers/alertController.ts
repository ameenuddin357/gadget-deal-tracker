import { Request, Response, NextFunction } from 'express';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';

/**
 * CLIENT PRICE DROPPING ALERTS - REGISTER OR UPDATE CUSTOM WARNING THRESHOLDS
 * POST /api/v1/alerts
 */
export const createAlert = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { productId, targetPrice } = req.body;

    // Standard parameter validations
    if (!productId || targetPrice === undefined || targetPrice === null) {
      return next(new AppError('Please supply product ID and a valid target price threshold.', 400));
    }

    const pId = parseInt(productId, 10);
    if (isNaN(pId) || pId <= 0 || pId > 2147483647) {
      return next(new AppError('Invalid numeric product identifier.', 400));
    }

    const numericalPrice = parseFloat(targetPrice);
    if (isNaN(numericalPrice) || !Number.isFinite(numericalPrice) || numericalPrice <= 0 || numericalPrice > 10000000) {
      return next(new AppError('Target price must equal a valid positive amount up to ₹1,00,00,000.', 400));
    }

    // Verify target product does exist and is active
    const productCheck = await db.query('SELECT name, is_active FROM products WHERE product_id = $1;', [pId]);
    if (productCheck.rows.length === 0) {
      return next(new AppError('Catalog gadget does not exist in our system.', 404));
    }
    if (!productCheck.rows[0].is_active) {
      return next(new AppError('Cannot create price alerts for inactive or discontinued products.', 400));
    }

    // Retrieve current lowest live price for the product to enforce realistic threshold validation
    const priceRes = await db.query(`
      SELECT MIN(price) as lowest_price 
      FROM product_prices 
      WHERE product_id = $1 AND is_available = TRUE;
    `, [pId]);

    const lowestLivePrice = priceRes.rows[0]?.lowest_price ? parseFloat(priceRes.rows[0].lowest_price) : null;

    if (lowestLivePrice !== null && lowestLivePrice > 0) {
      if (numericalPrice >= lowestLivePrice) {
        return next(new AppError(`Target price (₹${numericalPrice.toLocaleString('en-IN')}) must be lower than the current best price (₹${lowestLivePrice.toLocaleString('en-IN')}).`, 400));
      }

      const minReasonableTarget = Math.ceil(lowestLivePrice * 0.10);
      if (numericalPrice < minReasonableTarget) {
        return next(new AppError(`Target price of ₹${numericalPrice.toLocaleString('en-IN')} is unusually low compared with the current price (more than 90% below ₹${lowestLivePrice.toLocaleString('en-IN')}). Please enter a realistic target of at least ₹${minReasonableTarget.toLocaleString('en-IN')}.`, 400));
      }
    }

    // Execute concurrency-safe alert creation/update within a transaction and advisory lock
    const client = await db.getClient();
    let result;
    try {
      await client.query('BEGIN');

      // Acquire two-integer transaction-scoped advisory lock for (user_id, product_id)
      await client.query('SELECT pg_advisory_xact_lock($1::int, $2::int);', [userId, pId]);

      const existingActive = await client.query(
        'SELECT alert_id FROM price_alerts WHERE user_id = $1 AND product_id = $2 AND is_active = TRUE LIMIT 1;',
        [userId, pId]
      );

      if (existingActive.rows.length > 0) {
        result = await client.query(
          `UPDATE price_alerts
           SET target_price = $1, alert_sent = FALSE, is_active = TRUE
           WHERE alert_id = $2 AND user_id = $3
           RETURNING alert_id, user_id, product_id, target_price, is_active, alert_sent, created_at;`,
          [numericalPrice, existingActive.rows[0].alert_id, userId]
        );
      } else {
        result = await client.query(
          `INSERT INTO price_alerts (user_id, product_id, target_price, is_active, alert_sent)
           VALUES ($1, $2, $3, TRUE, FALSE)
           RETURNING alert_id, user_id, product_id, target_price, is_active, alert_sent, created_at;`,
          [userId, pId, numericalPrice]
        );
      }

      await client.query('COMMIT');
    } catch (txnErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txnErr;
    } finally {
      client.release();
    }

    res.status(200).json({
      status: 'success',
      message: `Price drop alert for ${productCheck.rows[0].name} set successfully at ₹${numericalPrice.toLocaleString('en-IN')}.`,
      data: {
        alert: result.rows[0]
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * CLIENT PRICE DROPPING ALERTS - UPDATE SPECIFIC EXISTING ALERT
 * PUT /api/v1/alerts/:id
 */
export const updateAlert = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const alertId = parseInt(req.params.id, 10);
    const { targetPrice } = req.body;

    if (isNaN(alertId) || alertId <= 0 || alertId > 2147483647) {
      return next(new AppError('Invalid alert identifier.', 400));
    }

    if (targetPrice === undefined || targetPrice === null) {
      return next(new AppError('Please supply a valid target price threshold.', 400));
    }

    const numericalPrice = parseFloat(targetPrice);
    if (isNaN(numericalPrice) || !Number.isFinite(numericalPrice) || numericalPrice <= 0 || numericalPrice > 10000000) {
      return next(new AppError('Target price must equal a valid positive amount up to ₹1,00,00,000.', 400));
    }

    // Verify alert exists and belongs to current user
    const alertCheck = await db.query(
      'SELECT alert_id, user_id, product_id FROM price_alerts WHERE alert_id = $1;',
      [alertId]
    );

    if (alertCheck.rows.length === 0) {
      return next(new AppError('Price alert not found.', 404));
    }

    if (alertCheck.rows[0].user_id !== userId) {
      return next(new AppError('Forbidden. You do not hold ownership authority over this alert.', 403));
    }

    const productId = alertCheck.rows[0].product_id;

    // Fetch current lowest live price for the product to enforce validation
    const priceRes = await db.query(`
      SELECT MIN(price) as lowest_price 
      FROM product_prices 
      WHERE product_id = $1 AND is_available = TRUE;
    `, [productId]);

    const lowestLivePrice = priceRes.rows[0]?.lowest_price ? parseFloat(priceRes.rows[0].lowest_price) : null;

    if (lowestLivePrice !== null && lowestLivePrice > 0) {
      if (numericalPrice >= lowestLivePrice) {
        return next(new AppError(`Target price (₹${numericalPrice.toLocaleString('en-IN')}) must be lower than the current best price (₹${lowestLivePrice.toLocaleString('en-IN')}).`, 400));
      }

      const minReasonableTarget = Math.ceil(lowestLivePrice * 0.10);
      if (numericalPrice < minReasonableTarget) {
        return next(new AppError(`Target price of ₹${numericalPrice.toLocaleString('en-IN')} is unusually low compared with the current price (more than 90% below ₹${lowestLivePrice.toLocaleString('en-IN')}). Please enter a realistic target of at least ₹${minReasonableTarget.toLocaleString('en-IN')}.`, 400));
      }
    }

    const updateSql = `
      UPDATE price_alerts
      SET target_price = $1, alert_sent = FALSE, is_active = TRUE
      WHERE alert_id = $2 AND user_id = $3
      RETURNING alert_id, user_id, product_id, target_price, is_active, alert_sent, created_at;
    `;

    const result = await db.query(updateSql, [numericalPrice, alertId, userId]);

    res.status(200).json({
      status: 'success',
      message: 'Price alert target updated successfully.',
      data: {
        alert: result.rows[0]
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * CLIENT PRICE DROPPING ALERTS - GET LIST OF ACTIVE OR EXPIRED ALERTS FOR LOGGED IN USER
 * GET /api/v1/alerts
 */
export const getUserAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const sql = `
      SELECT 
        pa.alert_id, 
        pa.target_price, 
        pa.is_active, 
        pa.alert_sent, 
        pa.created_at, 
        p.product_id,
        p.name AS product_name,
        p.brand,
        p.image_url,
        p.is_active AS product_is_active,
        min_p.lowest_live_price,
        min_p.store_name AS purchase_outlet,
        min_p.product_url
      FROM price_alerts pa
      JOIN products p ON pa.product_id = p.product_id
      LEFT JOIN (
        SELECT DISTINCT ON (product_id) product_id, price AS lowest_live_price, s.name AS store_name, pp.product_url
        FROM product_prices pp
        JOIN stores s ON pp.store_id = s.store_id
        WHERE pp.is_available = TRUE
        ORDER BY product_id, pp.price ASC
      ) min_p ON pa.product_id = min_p.product_id
      WHERE pa.user_id = $1
      ORDER BY pa.created_at DESC;
    `;

    const result = await db.query(sql, [userId]);

    const productIds = result.rows.map((r: any) => r.product_id);
    let historyMap: Record<number, { price: number; date: string }[]> = {};
    if (productIds.length > 0) {
      const historySql = `
        SELECT ph.product_id, ph.price, ph.recorded_at as date
        FROM price_history ph
        WHERE ph.product_id = ANY($1)
        ORDER BY ph.recorded_at ASC;
      `;
      const historyRes = await db.query(historySql, [productIds]);
      historyRes.rows.forEach((h: any) => {
        if (!historyMap[h.product_id]) historyMap[h.product_id] = [];
        historyMap[h.product_id].push({ price: parseFloat(h.price), date: h.date });
      });
    }

    const enrichedAlerts = result.rows.map((r: any) => ({
      ...r,
      price_history: historyMap[r.product_id] || []
    }));

    res.status(200).json({
      status: 'success',
      results: enrichedAlerts.length,
      data: {
        alerts: enrichedAlerts
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * CLIENT PRICE DROPPING ALERTS - DELETE SPECIFIC ACTIVE THRESHOLD RULE
 * DELETE /api/v1/alerts/:id
 */
export const deleteAlert = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const alertId = parseInt(req.params.id, 10);

    if (isNaN(alertId) || alertId <= 0 || alertId > 2147483647) {
      return next(new AppError('Invalid alert identifier.', 400));
    }

    const result = await db.query(
      'DELETE FROM price_alerts WHERE alert_id = $1 AND user_id = $2 RETURNING alert_id;',
      [alertId, userId]
    );

    if (result.rowCount === 0) {
      return next(new AppError('Price alert not found.', 404));
    }

    res.status(200).json({
      status: 'success',
      message: 'Price drop alert removed successfully.'
    });
  } catch (err) {
    next(err);
  }
};
