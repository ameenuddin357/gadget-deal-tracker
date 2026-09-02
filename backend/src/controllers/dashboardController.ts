import { Request, Response, NextFunction } from 'express';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const productsCount = await db.query('SELECT COUNT(*) FROM products');
    const retailersCount = await db.query('SELECT COUNT(*) FROM stores');
    const alertsCount = await db.query('SELECT COUNT(*) FROM price_alerts WHERE is_active = TRUE');

    res.status(200).json({
      status: 'success',
      data: {
        totalProducts: parseInt(productsCount.rows[0].count),
        totalRetailers: parseInt(retailersCount.rows[0].count),
        activeAlerts: parseInt(alertsCount.rows[0].count)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getBestDeals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sql = `
      SELECT 
        p.product_id, p.name, p.brand, p.image_url,
        pp.price, pp.original_price,
        s.name as store_name,
        ROUND(((pp.original_price - pp.price) / pp.original_price) * 100, 2) as discount_percentage
      FROM products p
      JOIN (
        SELECT DISTINCT ON (product_id) *
        FROM product_prices
        WHERE is_available = TRUE 
          AND original_price > price
          AND original_price <= price * 3
          AND ((original_price - price) / original_price) < 0.90
        ORDER BY product_id, price ASC
      ) pp ON p.product_id = pp.product_id
      JOIN stores s ON pp.store_id = s.store_id
      ORDER BY discount_percentage DESC
      LIMIT 8;
    `;
    const result = await db.query(sql);

    res.status(200).json({
      status: 'success',
      data: {
        deals: result.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getPriceDrops = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sql = `
      SELECT 
        p.product_id, p.name, p.brand, p.image_url,
        curr_p.price as current_price,
        hist_p.highest_price as previous_price,
        s.name as store_name,
        ROUND(((hist_p.highest_price - curr_p.price) / hist_p.highest_price) * 100, 2) as drop_percentage
      FROM products p
      JOIN (
        SELECT DISTINCT ON (product_id) *
        FROM product_prices
        WHERE is_available = TRUE
        ORDER BY product_id, price ASC
      ) curr_p ON p.product_id = curr_p.product_id
      JOIN stores s ON curr_p.store_id = s.store_id
      JOIN (
        SELECT product_id, MAX(price) as highest_price
        FROM price_history
        GROUP BY product_id
      ) hist_p ON p.product_id = hist_p.product_id
      WHERE hist_p.highest_price > curr_p.price
      ORDER BY drop_percentage DESC
      LIMIT 6;
    `;
    const result = await db.query(sql);

    res.status(200).json({
      status: 'success',
      data: {
        priceDrops: result.rows
      }
    });
  } catch (error) {
    next(error);
  }
};
