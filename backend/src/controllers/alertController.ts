import { Request, Response, NextFunction } from 'express';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';

/**
 * CLIENT PRICE DROPPING ALERTS - REGISTER CUSTOM WARNING THRESHOLDS
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
    if (isNaN(numericalPrice) || numericalPrice <= 0 || numericalPrice > 10000000) {
      return next(new AppError('Target price must equal a valid positive amount up to ₹1,00,00,000.', 400));
    }

    // Verify target product does exist
    const productCheck = await db.query('SELECT name FROM products WHERE product_id = $1;', [pId]);
    if (productCheck.rows.length === 0) {
      return next(new AppError('Catalog gadget does not exist in our system.', 404));
    }

    // Insert alert conditions safely
    const sql = `
      INSERT INTO price_alerts (user_id, product_id, target_price)
      VALUES ($1, $2, $3)
      RETURNING alert_id, user_id, product_id, target_price, is_active, alert_sent, created_at;
    `;

    const result = await db.query(sql, [userId, pId, numericalPrice]);

    res.status(201).json({
      status: 'success',
      message: `Price drop alert for ${productCheck.rows[0].name} registered successfully at $${numericalPrice}.`,
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
        min_p.lowest_live_price
      FROM price_alerts pa
      JOIN products p ON pa.product_id = p.product_id
      LEFT JOIN (
        SELECT DISTINCT ON (product_id) product_id, price AS lowest_live_price
        FROM product_prices
        WHERE is_available = TRUE
        ORDER BY product_id, price ASC
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
      return next(new AppError('Invalid alert parameter.', 400));
    }

    // Verify resource ownership to prevent horizontal permission escalation attacks
    const alertResult = await db.query('SELECT user_id FROM price_alerts WHERE alert_id = $1;', [alertId]);

    if (alertResult.rows.length === 0) {
      return next(new AppError('No alert settings found matching this indicator.', 404));
    }

    if (alertResult.rows[0].user_id !== userId) {
      return next(new AppError('Forbidden. You do not hold ownership authority over this alert.', 403));
    }

    await db.query('DELETE FROM price_alerts WHERE alert_id = $1;', [alertId]);

    res.status(200).json({
      status: 'success',
      message: 'Pricing drop alert removed successfully from tracking profiles.'
    });
  } catch (err) {
    next(err);
  }
};
