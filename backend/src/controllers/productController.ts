import { Request, Response, NextFunction } from 'express';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { parseNaturalLanguageQuery, ParsedQuery } from '../utils/nlParser.ts';
import { GoogleGenAI, Type } from '@google/genai';
import { generateContentWithModelFallback } from '../utils/geminiHelper.ts';

// In-memory cache for AI deal recommendations
// Key: productId
// Value: { cacheKey: string, expiresAt: number, payload: any }
export const aiRecommendationCache = new Map<number, { cacheKey: string; expiresAt: number; payload: any }>();

// Server-side rate limit store for free-text AI chat (10 messages per product per user/session per rolling 24 hours)
const chatRateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkAndIncrementRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = chatRateLimitMap.get(identifier);

  if (!entry || now > entry.resetAt) {
    chatRateLimitMap.set(identifier, { count: 1, resetAt: now + (24 * 60 * 60 * 1000) });
    return true;
  }

  if (entry.count >= 10) {
    return false;
  }

  entry.count += 1;
  return true;
}

export interface PriceHistoryCheckResult {
  hasEnough: boolean;
  historyRows: any[];
  currentPrice: number;
  earliestTs: number;
  latestTs: number;
  daySpanMs: number;
}

export interface PriceHistoryLevelResult {
  level: 0 | 1 | 2 | 3;
  historyRows: any[];
  currentPrice: number;
  earliestTs: number;
  latestTs: number;
  daySpanMs: number;
  daySpanDays: number;
  // Level 1 metrics:
  prevPrice?: number;
  priceChange?: number;
  priceChangePct?: number;
  // Level 2 metrics:
  avgPrice?: number;
  lowestPrice?: number;
  highestPrice?: number;
  diffFromAvgPct?: number;
}

/**
 * Determines the available price-history level for a product using exact timestamp coverage:
 * LEVEL 0 — INSUFFICIENT DATA (< 2 genuine history records)
 * LEVEL 1 — BASIC PRICE CHANGE (>= 2 genuine records, < 7 days coverage)
 * LEVEL 2 — SHORT-TERM TREND (>= 2 genuine records, 7 to < 30 days coverage)
 * LEVEL 3 — FULL BUY/WAIT ANALYSIS (>= 2 genuine records, >= 30 days coverage)
 */
export const getPriceHistoryLevel = async (productId: number): Promise<PriceHistoryLevelResult> => {
  const historySql = `
    SELECT ph.price, ph.recorded_at as date
    FROM price_history ph
    WHERE ph.product_id = $1
    ORDER BY ph.recorded_at ASC;
  `;
  const historyResult = await db.query(historySql, [productId]);
  const historyRows = historyResult.rows;

  const priceSql = `
    SELECT MIN(price) as current_price
    FROM product_prices
    WHERE product_id = $1 AND is_available = TRUE;
  `;
  const priceResult = await db.query(priceSql, [productId]);
  const currentPriceRaw = priceResult.rows[0]?.current_price;
  const currentPrice = currentPriceRaw !== null && currentPriceRaw !== undefined ? parseFloat(currentPriceRaw) : NaN;

  const timestamps = historyRows
    .map((r: any) => new Date(r.date).getTime())
    .filter((t: number) => !isNaN(t));

  if (timestamps.length < 2 || isNaN(currentPrice)) {
    return {
      level: 0,
      historyRows: historyRows || [],
      currentPrice,
      earliestTs: timestamps[0] || NaN,
      latestTs: timestamps[0] || NaN,
      daySpanMs: 0,
      daySpanDays: 0
    };
  }

  const earliestTs = Math.min(...timestamps);
  const latestTs = Math.max(...timestamps);
  const daySpanMs = latestTs - earliestTs;
  const daySpanDays = Math.round(daySpanMs / (24 * 60 * 60 * 1000));
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  let level: 0 | 1 | 2 | 3 = 0;
  if (daySpanMs < sevenDaysMs) {
    level = 1;
  } else if (daySpanMs < thirtyDaysMs) {
    level = 2;
  } else {
    level = 3;
  }

  // Level 1 metrics
  const pricesList = historyRows.map((r: any) => parseFloat(r.price)).filter((p: number) => !isNaN(p));
  const prevPrice = pricesList.length >= 2 ? pricesList[pricesList.length - 2] : (pricesList[0] || currentPrice);
  const priceChange = currentPrice - prevPrice;
  const priceChangePct = prevPrice !== 0 ? (priceChange / prevPrice) * 100 : 0;

  // Level 2 metrics
  const allPrices = [...pricesList, currentPrice];
  const lowestPrice = Math.min(...allPrices);
  const highestPrice = Math.max(...allPrices);
  const avgPrice = Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length);
  const diffFromAvgPct = avgPrice !== 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;

  return {
    level,
    historyRows,
    currentPrice,
    earliestTs,
    latestTs,
    daySpanMs,
    daySpanDays,
    prevPrice,
    priceChange,
    priceChangePct,
    avgPrice,
    lowestPrice,
    highestPrice,
    diffFromAvgPct
  };
};

/**
 * Unified server-side 30-day price history eligibility checker wrapper.
 */
export const hasEnoughPriceHistory = async (productId: number): Promise<PriceHistoryCheckResult> => {
  const levelRes = await getPriceHistoryLevel(productId);
  return {
    hasEnough: levelRes.level === 3,
    historyRows: levelRes.historyRows,
    currentPrice: levelRes.currentPrice,
    earliestTs: levelRes.earliestTs,
    latestTs: levelRes.latestTs,
    daySpanMs: levelRes.daySpanMs
  };
};

export interface QuestionClassification {
  intent: 'historical_analysis' | 'current_price' | 'retailer_lookup' | 'specification_lookup' | 'tracking_info' | 'catalogue_wide' | 'unsupported';
  isHistorical: boolean;
}

/**
 * Classifies user chat questions to determine if historical price/timing analysis is required.
 */
export function classifyQuestionIntent(question: string): QuestionClassification {
  const lower = question.trim().toLowerCase();

  // Catalogue-wide query check
  if (
    (lower.includes('best laptop under') ||
     lower.includes('best phone under') ||
     lower.includes('entire website') ||
     lower.includes('other products') ||
     lower.includes('compare with other items in catalog')) &&
    !lower.includes('this product')
  ) {
    return { intent: 'catalogue_wide', isHistorical: false };
  }

  // Future prediction check
  if (
    lower.includes('what will the price be') ||
    lower.includes('price next month') ||
    lower.includes('price tomorrow') ||
    lower.includes('predict future price') ||
    lower.includes('price next week') ||
    lower.includes('will the price drop') ||
    lower.includes('will the price fall') ||
    lower.includes('will price drop') ||
    lower.includes('will price fall') ||
    lower.includes('will the price increase') ||
    lower.includes('will the price rise')
  ) {
    return { intent: 'historical_analysis', isHistorical: true };
  }

// Specific Non-Historical Current Fact Checks
  const isSpecLookup =
    lower.includes('processor') ||
    lower.includes('cpu') ||
    lower.includes('ram') ||
    lower.includes('storage') ||
    lower.includes('ssd') ||
    lower.includes('gpu') ||
    lower.includes('graphics') ||
    lower.includes('specs') ||
    lower.includes('specification') ||
    lower.includes('screen') ||
    lower.includes('display') ||
    lower.includes('camera') ||
    lower.includes('battery') ||
    lower.includes('os') ||
    lower.includes('operating system');

  const isTrackingLookup =
    lower.includes('tracking start') ||
    lower.includes('when did tracking') ||
    lower.includes('how long tracked') ||
    lower.includes('when started tracking') ||
    lower.includes('when was tracking started');

  const isCurrentPriceLookup =
    lower.includes('current price') ||
    lower.includes('what is the current price') ||
    lower.includes("what's the current price") ||
    lower.includes('what is current price') ||
    lower.includes("what's current price") ||
    lower.includes('what is the price') ||
    lower.includes("what's the price") ||
    lower.includes('how much does it cost') ||
    lower.includes('how much is it') ||
    lower.includes('price now');

  const isRetailerLookup =
    (lower.includes('cheapest store') ||
     lower.includes('lowest price store') ||
     lower.includes('which store') ||
     lower.includes('what store') ||
     lower.includes('what stores') ||
     lower.includes('where to buy') ||
     lower.includes('where can i buy') ||
     lower.includes('where can i purchase') ||
     lower.includes('where is it available') ||
     lower.includes('where is this available') ||
     lower.includes('which retailer') ||
     lower.includes('cheapest retailer') ||
     lower.includes('retailer') ||
     lower.includes('purchase link') ||
     lower.includes('buy link') ||
     lower.includes('how can i buy') ||
     lower.includes('cheapest option')) &&
    !lower.includes('history') &&
    !lower.includes('trend');

  if (isCurrentPriceLookup) return { intent: 'current_price', isHistorical: false };
  if (isRetailerLookup) return { intent: 'retailer_lookup', isHistorical: false };
  if (isSpecLookup) return { intent: 'specification_lookup', isHistorical: false };
  if (isTrackingLookup) return { intent: 'tracking_info', isHistorical: false };

  // Historical / Timing / Recommendation Queries
  const historicalPhrases = [
    'should i buy',
    'should i wait',
    'buy or wait',
    'good time',
    'good deal',
    'great deal',
    'price drop',
    'price fall',
    'price increase',
    'price rise',
    'price trend',
    'trending',
    'lowest price',
    'highest price',
    'recorded price',
    'recent average',
    'below average',
    'above average',
    'worth buying',
    'worth it',
    'buy now',
    'why',
    'recommendation'
  ];

  const isHistorical = historicalPhrases.some(p => lower.includes(p)) ||
    (lower.includes('wait') || lower.includes('trend') || lower.includes('history'));

  if (isHistorical) {
    return { intent: 'historical_analysis', isHistorical: true };
  }

  return { intent: 'unsupported', isHistorical: false };
}

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
    // 1. Setup Pagination values (strictly clamped and sanitized against negative/overflow values)
    const rawLimit = parseInt(req.query.limit as string || '10', 10);
    const rawPage = parseInt(req.query.page as string || '1', 10);
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 10 : rawLimit), 100);
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const offset = (page - 1) * limit;

    // Optional filters matching key indexed paths
    const categoryId = req.query.category_id;
    const brand = req.query.brand;
    const searchRaw = req.query.search as string | undefined;
    const categoryRaw = req.query.category as string | undefined;
    const minPriceRaw = req.query.min_price as string | undefined;
    const maxPriceRaw = req.query.max_price as string | undefined;
    const sort = req.query.sort as string;
    const store = req.query.store as string;

    let nlParsed: ParsedQuery | null = null;
    if (searchRaw && searchRaw.trim().length > 0) {
      nlParsed = await parseNaturalLanguageQuery(searchRaw.slice(0, 200));
    }

    const effectiveCategory = categoryRaw && categoryRaw.trim().length > 0 ? categoryRaw.trim().slice(0, 100) : (nlParsed?.category || undefined);

    let effectiveMinPrice: number | undefined = undefined;
    if (minPriceRaw !== undefined && minPriceRaw !== '') {
      const pMin = parseFloat(minPriceRaw);
      if (!isNaN(pMin) && pMin >= 0 && pMin <= 10000000) effectiveMinPrice = pMin;
    } else if (nlParsed?.minPrice !== null && nlParsed?.minPrice !== undefined) {
      if (nlParsed.minPrice >= 0 && nlParsed.minPrice <= 10000000) effectiveMinPrice = nlParsed.minPrice;
    }

    let effectiveMaxPrice: number | undefined = undefined;
    if (maxPriceRaw !== undefined && maxPriceRaw !== '') {
      const pMax = parseFloat(maxPriceRaw);
      if (!isNaN(pMax) && pMax >= 0 && pMax <= 10000000) effectiveMaxPrice = pMax;
    } else if (nlParsed?.maxPrice !== null && nlParsed?.maxPrice !== undefined) {
      if (nlParsed.maxPrice >= 0 && nlParsed.maxPrice <= 10000000) effectiveMaxPrice = nlParsed.maxPrice;
    }

    // If both min and max price are provided and inverted, normalize gracefully
    if (effectiveMinPrice !== undefined && effectiveMaxPrice !== undefined && effectiveMinPrice > effectiveMaxPrice) {
      const temp = effectiveMinPrice;
      effectiveMinPrice = effectiveMaxPrice;
      effectiveMaxPrice = temp;
    }

    const effectiveKeywords = nlParsed ? nlParsed.keywords : (searchRaw ? searchRaw.trim().slice(0, 200) : '');

    let queryParams: any[] = [];
    let subqueryWhere = 'WHERE pp.is_available = TRUE';

    if (store && store !== 'All Stores' && typeof store === 'string') {
      queryParams.push(`%${store.trim().slice(0, 100)}%`);
      subqueryWhere += ` AND s.name ILIKE $${queryParams.length}`;
    }

    let filterClauses: string[] = ['min_p.cheapest_price IS NOT NULL'];

    if (categoryId) {
      const catIdNum = parseInt(categoryId as string, 10);
      if (!isNaN(catIdNum) && catIdNum > 0 && catIdNum <= 2147483647) {
        queryParams.push(catIdNum);
        filterClauses.push(`p.category_id = $${queryParams.length}`);
      }
    }

    if (brand && typeof brand === 'string') {
      queryParams.push(brand.trim().slice(0, 100));
      filterClauses.push(`p.brand = $${queryParams.length}`);
    }

    if (effectiveCategory) {
      queryParams.push(`%${effectiveCategory}%`);
      filterClauses.push(`(c.name ILIKE $${queryParams.length} OR c.slug ILIKE $${queryParams.length})`);
    }

    if (effectiveKeywords && effectiveKeywords.length > 0) {
      const tokens = effectiveKeywords.split(/\s+/).filter(Boolean);
      tokens.forEach(token => {
        queryParams.push(`%${token}%`);
        filterClauses.push(`(p.name ILIKE $${queryParams.length} OR p.brand ILIKE $${queryParams.length} OR p.specs_summary ILIKE $${queryParams.length})`);
      });
    }

    if (effectiveMinPrice !== undefined) {
      queryParams.push(effectiveMinPrice);
      filterClauses.push(`min_p.cheapest_price >= $${queryParams.length}`);
    }

    if (effectiveMaxPrice !== undefined) {
      queryParams.push(effectiveMaxPrice);
      filterClauses.push(`min_p.cheapest_price <= $${queryParams.length}`);
    }

    const whereString = filterClauses.length > 0 
      ? `WHERE ${filterClauses.join(' AND ')}` 
      : '';

    let orderByClause = 'ORDER BY p.product_id DESC';
    if (sort === 'price_asc' || sort === 'cheapest') {
      orderByClause = 'ORDER BY min_p.cheapest_price ASC NULLS LAST, p.product_id DESC';
    } else if (sort === 'price_desc' || sort === 'dearest') {
      orderByClause = 'ORDER BY min_p.cheapest_price DESC NULLS LAST, p.product_id DESC';
    } else if (sort === 'price_drop') {
      orderByClause = 'ORDER BY price_drop_pct DESC, min_p.cheapest_price ASC, p.product_id DESC';
    } else if (sort === 'discount_desc') {
      orderByClause = 'ORDER BY discount_pct DESC, min_p.cheapest_price ASC, p.product_id DESC';
    } else if (sort === 'name_asc' || sort === 'name-az') {
      orderByClause = 'ORDER BY p.name ASC, p.product_id DESC';
    }

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
        min_p.store_name,
        min_p.original_price,
        COALESCE(
          CASE 
            WHEN hist_p.highest_hist_price IS NOT NULL 
             AND min_p.cheapest_price IS NOT NULL 
             AND hist_p.highest_hist_price > min_p.cheapest_price 
            THEN ROUND(((hist_p.highest_hist_price - min_p.cheapest_price) / hist_p.highest_hist_price) * 100, 2)
            ELSE 0
          END, 0
        ) AS price_drop_pct,
        COALESCE(
          CASE 
            WHEN min_p.original_price IS NOT NULL 
             AND min_p.cheapest_price IS NOT NULL 
             AND min_p.original_price > min_p.cheapest_price 
             AND min_p.original_price <= min_p.cheapest_price * 3 
             AND ((min_p.original_price - min_p.cheapest_price) / min_p.original_price) < 0.90
            THEN ROUND(((min_p.original_price - min_p.cheapest_price) / min_p.original_price) * 100, 2)
            ELSE 0
          END, 0
        ) AS discount_pct
      FROM products p
      JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN (
        SELECT DISTINCT ON (product_id) product_id, price AS cheapest_price, original_price, s.name AS store_name
        FROM product_prices pp
        JOIN stores s ON pp.store_id = s.store_id
        ${subqueryWhere}
        ORDER BY product_id, pp.price ASC
      ) min_p ON p.product_id = min_p.product_id
      LEFT JOIN (
        SELECT product_id, MAX(price) AS highest_hist_price
        FROM price_history
        GROUP BY product_id
      ) hist_p ON p.product_id = hist_p.product_id
      ${whereString}
      ${orderByClause}
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2};
    `;

    queryParams.push(limit, offset);

    const result = await db.query(querySql, queryParams);

    const mappedProducts = result.rows.map((row: any) => ({
      ...row,
      cheapest_price: row.cheapest_price !== null && row.cheapest_price !== undefined ? parseFloat(row.cheapest_price) : undefined,
      original_price: row.original_price !== null && row.original_price !== undefined ? parseFloat(row.original_price) : undefined,
      price_drop_pct: row.price_drop_pct ? parseFloat(row.price_drop_pct) : 0,
      discount_pct: row.discount_pct ? parseFloat(row.discount_pct) : 0
    }));

    // Grab total rows matching same filters to serve frontend metadata ratios
    let countParams = queryParams.slice(0, queryParams.length - 2);
    const countSql = `
      SELECT COUNT(*) 
      FROM products p 
      JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN (
        SELECT DISTINCT ON (product_id) product_id, price AS cheapest_price, original_price, s.name AS store_name
        FROM product_prices pp
        JOIN stores s ON pp.store_id = s.store_id
        ${subqueryWhere}
        ORDER BY product_id, pp.price ASC
      ) min_p ON p.product_id = min_p.product_id
      ${whereString};
    `;
    const countResult = await db.query(countSql, countParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);

    res.status(200).json({
      status: 'success',
      results: mappedProducts.length,
      pagination: {
        totalItems: totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        limit
      },
      data: {
        products: mappedProducts,
        interpretation: nlParsed
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
      WHERE pp.product_id = $1 AND pp.is_available = TRUE
      ORDER BY pp.price ASC;
    `;
    const pricesResult = await db.query(pricesSql, [productId]);

    const now = Date.now();
    const cacheTtlDays = parseInt(process.env.CACHE_TTL_DAYS || '30', 10);
    const staleThresholdMs = cacheTtlDays * 24 * 60 * 60 * 1000;

    const mappedPricing = pricesResult.rows.map((row: any) => {
      const scrapedAt = new Date(row.last_scraped_at).getTime();
      const isStale = (now - scrapedAt) > staleThresholdMs;
      return {
        ...row,
        price: parseFloat(row.price),
        original_price: parseFloat(row.original_price),
        is_stale: isStale
      };
    });

    const isProductStale = mappedPricing.some(mp => mp.is_stale);
    const oldestScrapedAt = mappedPricing.reduce((oldest: string, current: any) => {
      if (!oldest) return current.last_scraped_at;
      return new Date(current.last_scraped_at).getTime() < new Date(oldest).getTime() ? current.last_scraped_at : oldest;
    }, '');

    const enrichedProduct = {
      ...product,
      is_stale: isProductStale,
      last_scraped_at: oldestScrapedAt
    };

    res.status(200).json({
      status: 'success',
      data: {
        product: enrichedProduct,
        storesPricing: mappedPricing
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

    const nlParsed = await parseNaturalLanguageQuery(searchTerm.slice(0, 200));

    let effectiveMinPrice: number | undefined = undefined;
    if (req.query.min_price !== undefined && req.query.min_price !== '') {
      const pMin = parseFloat(req.query.min_price as string);
      if (!isNaN(pMin) && pMin >= 0 && pMin <= 10000000) effectiveMinPrice = pMin;
    } else if (nlParsed?.minPrice !== null && nlParsed?.minPrice !== undefined) {
      if (nlParsed.minPrice >= 0 && nlParsed.minPrice <= 10000000) effectiveMinPrice = nlParsed.minPrice;
    }

    let effectiveMaxPrice: number | undefined = undefined;
    if (req.query.max_price !== undefined && req.query.max_price !== '') {
      const pMax = parseFloat(req.query.max_price as string);
      if (!isNaN(pMax) && pMax >= 0 && pMax <= 10000000) effectiveMaxPrice = pMax;
    } else if (nlParsed?.maxPrice !== null && nlParsed?.maxPrice !== undefined) {
      if (nlParsed.maxPrice >= 0 && nlParsed.maxPrice <= 10000000) effectiveMaxPrice = nlParsed.maxPrice;
    }

    if (effectiveMinPrice !== undefined && effectiveMaxPrice !== undefined && effectiveMinPrice > effectiveMaxPrice) {
      const temp = effectiveMinPrice;
      effectiveMinPrice = effectiveMaxPrice;
      effectiveMaxPrice = temp;
    }

    const effectiveKeywords = nlParsed ? nlParsed.keywords : searchTerm.trim().slice(0, 200);

    let queryParams: any[] = [];
    let filterClauses: string[] = ['min_p.cheapest_price IS NOT NULL'];

    if (nlParsed?.category) {
      queryParams.push(`%${nlParsed.category}%`);
      filterClauses.push(`(c.name ILIKE $${queryParams.length})`);
    }

    if (effectiveKeywords && effectiveKeywords.length > 0) {
      const tokens = effectiveKeywords.split(/\s+/).filter(Boolean);
      tokens.forEach(token => {
        queryParams.push(`%${token}%`);
        filterClauses.push(`(p.name ILIKE $${queryParams.length} OR p.brand ILIKE $${queryParams.length} OR p.specs_summary ILIKE $${queryParams.length})`);
      });
    }

    if (effectiveMinPrice !== undefined) {
      queryParams.push(effectiveMinPrice);
      filterClauses.push(`min_p.cheapest_price >= $${queryParams.length}`);
    }

    if (effectiveMaxPrice !== undefined) {
      queryParams.push(effectiveMaxPrice);
      filterClauses.push(`min_p.cheapest_price <= $${queryParams.length}`);
    }

    const whereString = `WHERE ${filterClauses.join(' AND ')}`;

    const sql = `
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
      ORDER BY p.name ASC
      LIMIT 15;
    `;

    const result = await db.query(sql, queryParams);

    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      data: {
        products: result.rows,
        interpretation: nlParsed
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getProductPriceHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      return next(new AppError('Invalid product identifier.', 400));
    }

    const sql = `
      SELECT ph.price, ph.recorded_at as date, s.name as store_name
      FROM price_history ph
      JOIN stores s ON ph.store_id = s.store_id
      WHERE ph.product_id = $1
      ORDER BY ph.recorded_at ASC;
    `;
    const result = await db.query(sql, [productId]);

    res.status(200).json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PRODUCT CATALOG - GET AI BUY NOW / WAIT RECOMMENDATION FOR PRODUCT
 * GET /api/v1/products/:id/ai-recommendation
 */
export const getProductAiRecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      return next(new AppError('Invalid product identifier.', 400));
    }

    const levelRes = await getPriceHistoryLevel(productId);

    // LEVEL 0 — INSUFFICIENT DATA
    if (levelRes.level === 0) {
      res.status(200).json({
        status: 'success',
        level: 0,
        eligible: false,
        trackingStartedAt: levelRes.earliestTs && !isNaN(levelRes.earliestTs) ? new Date(levelRes.earliestTs).toISOString() : null,
        message: 'Price history is still being collected for this product. As more genuine price data is recorded, smarter Buy/Wait insights will become available.'
      });
      return;
    }

    // LEVEL 1 — BASIC PRICE CHANGE
    if (levelRes.level === 1) {
      const { currentPrice, prevPrice, priceChange, priceChangePct } = levelRes;
      let insightText = '';
      if (priceChange! < 0) {
        insightText = `↓ ${Math.abs(priceChangePct!).toFixed(1)}% since previous recorded price.`;
      } else if (priceChange! > 0) {
        insightText = `↑ ${priceChangePct!.toFixed(1)}% since previous recorded price.`;
      } else {
        insightText = 'Price is unchanged since the previous recorded price.';
      }

      res.status(200).json({
        status: 'success',
        level: 1,
        eligible: false,
        data: {
          level: 1,
          currentPrice,
          prevPrice,
          priceChange,
          priceChangePct,
          insightText,
          subText: 'More history is needed for a reliable Buy/Wait recommendation.'
        }
      });
      return;
    }

    // LEVEL 2 — SHORT-TERM TREND
    if (levelRes.level === 2) {
      const { currentPrice, avgPrice, diffFromAvgPct, daySpanDays, lowestPrice } = levelRes;
      let insightText = '';
      const days = daySpanDays || 7;
      if (diffFromAvgPct! < 0) {
        insightText = `Current price is ${Math.abs(diffFromAvgPct!).toFixed(1)}% below the available ${days}-day average.`;
      } else if (currentPrice === lowestPrice) {
        insightText = 'Current price is close to the lowest recorded price in the available history.';
      } else if (diffFromAvgPct! > 0) {
        insightText = `Current price is ${diffFromAvgPct!.toFixed(1)}% above the available ${days}-day average.`;
      } else {
        insightText = `Price has changed by ${Math.abs(diffFromAvgPct!).toFixed(1)}% over the available tracking period (${days} days).`;
      }

      res.status(200).json({
        status: 'success',
        level: 2,
        eligible: false,
        data: {
          level: 2,
          currentPrice,
          avgPrice,
          diffFromAvgPct,
          daySpanDays: days,
          lowestPrice,
          insightText,
          subText: '30 days of genuine history are required for the full Buy/Wait recommendation.'
        }
      });
      return;
    }

    // LEVEL 3 — FULL BUY/WAIT ANALYSIS
    const { historyRows, currentPrice, latestTs } = levelRes;
    const cacheKey = `${productId}_L3_${currentPrice}_${latestTs}_${historyRows.length}`;
    const now = Date.now();
    const cached = aiRecommendationCache.get(productId);

    if (cached && cached.cacheKey === cacheKey && now < cached.expiresAt) {
      res.status(200).json(cached.payload);
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(200).json({
        status: 'success',
        level: 3,
        eligible: true,
        error: true,
        message: 'AI recommendation temporarily unavailable.'
      });
      return;
    }

    const pricesList = historyRows.map((r: any) => parseFloat(r.price)).filter((p: number) => !isNaN(p));
    const allPrices = [...pricesList, currentPrice];
    const lowestPrice = Math.min(...allPrices);
    const highestPrice = Math.max(...allPrices);
    const averagePrice = Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length);

    const historyPayload = historyRows.map((r: any) => ({
      date: new Date(r.date).toISOString().split('T')[0],
      price: parseFloat(r.price)
    }));

    const geminiInput = {
      currentPrice,
      history: historyPayload,
      lowestPrice,
      highestPrice,
      averagePrice
    };

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const systemInstruction = `You are a price-history analysis assistant.

Analyze ONLY the price data provided in the request.

Do not use outside market knowledge.
Do not speculate about future prices.
Do not predict exact future prices.
Do not invent missing historical data.
Do not mention facts that were not supplied.

Your task is to determine whether the current price appears relatively favorable compared with the provided historical price data.

Return valid JSON only.`;

      const prompt = `Here is the genuine price history data for the product:\n${JSON.stringify(geminiInput, null, 2)}`;

      let response: any = null;
      try {
        response = await generateContentWithModelFallback(ai, {
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                recommendation: {
                  type: Type.STRING,
                  enum: ['buy_now', 'wait']
                },
                reasoning: {
                  type: Type.STRING,
                  description: 'One concise sentence describing why based strictly on the provided numbers.'
                },
                confidence: {
                  type: Type.STRING,
                  enum: ['low', 'medium', 'high']
                }
              },
              required: ['recommendation', 'reasoning', 'confidence']
            }
          }
        });
      } catch (aiErr) {
        console.warn('[AI Recommendation] Gemini call failed or rate limit exceeded:', aiErr);
        res.status(200).json({
          status: 'success',
          level: 3,
          eligible: true,
          error: true,
          message: 'AI recommendation temporarily unavailable.'
        });
        return;
      }

      let parsed: any = null;
      try {
        const rawText = response.text ? response.text.trim() : '';
        parsed = JSON.parse(rawText);
      } catch (e) {
        // Failed JSON parsing
      }

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !['buy_now', 'wait'].includes(parsed.recommendation) ||
        !['low', 'medium', 'high'].includes(parsed.confidence) ||
        typeof parsed.reasoning !== 'string' ||
        parsed.reasoning.trim().length === 0 ||
        parsed.reasoning.length > 300
      ) {
        res.status(200).json({
          status: 'success',
          level: 3,
          eligible: true,
          error: true,
          message: 'AI recommendation temporarily unavailable.'
        });
        return;
      }

      const forbiddenClaims = ['will fall', 'will drop', 'will increase', 'will become cheaper', 'next week', 'tomorrow'];
      const lowerReasoning = parsed.reasoning.toLowerCase();
      if (forbiddenClaims.some(claim => lowerReasoning.includes(claim))) {
        res.status(200).json({
          status: 'success',
          level: 3,
          eligible: true,
          error: true,
          message: 'AI recommendation temporarily unavailable.'
        });
        return;
      }

      const successPayload = {
        status: 'success',
        level: 3,
        eligible: true,
        data: {
          level: 3,
          recommendation: parsed.recommendation as 'buy_now' | 'wait',
          reasoning: parsed.reasoning.trim(),
          confidence: parsed.confidence as 'low' | 'medium' | 'high'
        }
      };

      aiRecommendationCache.set(productId, {
        cacheKey,
        expiresAt: now + (24 * 60 * 60 * 1000),
        payload: successPayload
      });

      res.status(200).json(successPayload);
    } catch (geminiErr) {
      console.error('Gemini API call error in getProductAiRecommendation:', geminiErr);
      res.status(200).json({
        status: 'success',
        level: 3,
        eligible: true,
        error: true,
        message: 'AI recommendation temporarily unavailable.'
      });
    }
  } catch (err) {
    next(err);
  }
};

// Helper function to extract structured spec fields safely from backend product data
function parseProductSpecsBackend(product: { name: string; specs_summary?: string | null; description?: string | null }) {
  if (!product) return {};
  
  const specs = product.specs_summary || '';
  const isReal = specs && 
    !specs.toLowerCase().includes('high quality') && 
    !specs.toLowerCase().includes('mapped via') && 
    !specs.toLowerCase().includes('standard retail') && 
    !specs.toLowerCase().includes('electronic product');
  
  const rawSummary = isReal ? specs : '';
  const desc = product.description || '';
  const name = product.name || '';
  const fullText = `${name} ${rawSummary} ${desc}`;

  const fields: Record<string, string> = {};

  const procMatch = fullText.match(/(Intel\s+Core\s+Ultra\s+\d+[-\s]?\d*\w*|Intel\s+Core\s+i[3579][-\s]?\d*\w*|AMD\s+Ryzen\s+[9753]\s+\d+\w*|Apple\s+M[1234]\s*(?:Pro|Max|Ultra)?|Snapdragon\s+[8764](?:\s*Gen\s*\d+)?(?:\s*s)?(?:\s*Plus)?|Dimensity\s+\d+|Exynos\s+\d+|A17\s+Pro|A16\s+Bionic|A15\s+Bionic|A18\s+Pro|Tensor\s+G[1234]|MediaTek\s+\w+|Celeron\s+\w+|Pentium\s+\w+)/i);
  if (procMatch) fields.processor = procMatch[1].trim();

  const ramMatch = fullText.match(/(\d+\s*GB\s*(?:DDR[45]|LPDDR[45]|RAM|Unified\s+Memory)?)/i);
  if (ramMatch) {
    const ramVal = parseInt(ramMatch[1], 10);
    if (!isNaN(ramVal) && ramVal <= 64 && (fullText.toLowerCase().includes('ram') || fullText.toLowerCase().includes('ddr') || fullText.toLowerCase().includes('memory') || ramVal <= 32)) {
      fields.ram = ramMatch[1].trim();
    }
  }

  const storageMatch = fullText.match(/(\d+\s*(?:TB|GB)\s*(?:SSD|NVMe|PCIe|Storage|ROM|eMMC)?)/i);
  if (storageMatch) {
    const storageVal = parseInt(storageMatch[1], 10);
    const isTb = storageMatch[0].toLowerCase().includes('tb');
    if (isTb || storageVal >= 64 || fullText.toLowerCase().includes('ssd') || fullText.toLowerCase().includes('rom')) {
      fields.storage = storageMatch[1].trim();
    }
  }

  const displayMatch = fullText.match(/(\d+\.\d+["”]?\s*(?:\(\d+\.\d+"\))?\s*(?:Full\s*HD|QHD|OLED|AMOLED|IPS|Retina|XDR|120Hz|144Hz|165Hz|\d+x\d+)?|\d+\s*inch|\d+\s*cm)/i);
  if (displayMatch) fields.display = displayMatch[1].trim();

  const gpuMatch = fullText.match(/(NVIDIA\s+GeForce\s+RTX\s+\d+|NVIDIA\s+GeForce\s+GTX\s+\d+|GeForce\s+RTX\s+\d+|RTX\s+\d+|Radeon\s+RX\s+\d+|Intel\s+Arc\s+\w+|M[1234]\s*(?:Pro|Max)?\s*GPU|\d+-core\s*GPU)/i);
  if (gpuMatch) fields.gpu = gpuMatch[1].trim();

  const batteryMatch = fullText.match(/(\d+\s*mAh(?:\s*battery)?|\d+\s*mWh(?:\s*battery)?|\d+-hour\s*battery)/i);
  if (batteryMatch) fields.battery = batteryMatch[1].trim();

  const osMatch = fullText.match(/(Windows\s*11(?:\s*Home|\s*Pro)?|Windows\s*10|macOS|Android\s*\d*|iOS\s*\d*|iPadOS\s*\d*|ChromeOS)/i);
  if (osMatch) fields.os = osMatch[1].trim();

  const cameraMatch = fullText.match(/(\d+MP(?:\s*(?:camera|setup|sensor|main|telephoto|ultrawide))?|\d+MP\s*\+\s*\d+MP)/i);
  if (cameraMatch) fields.camera = cameraMatch[1].trim();

  return fields;
}

// In-memory cache for AI Chat responses
export const aiChatCache = new Map<string, { cacheKey: string; expiresAt: number; answer: string }>();

/**
 * PRODUCT CATALOG - PRODUCT-SPECIFIC AI DEAL ADVISOR CHATBOT
 * POST /api/v1/products/:id/ai-chat
 */
export const handleProductAiChat = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      return next(new AppError('Invalid product identifier.', 400));
    }

    const { question, history } = req.body;
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return next(new AppError('Question string is required.', 400));
    }

    const trimmedQuestion = question.trim().slice(0, 500);
    const lowerQuestion = trimmedQuestion.toLowerCase();

    // 1. Classify Question Intent
    const classification = classifyQuestionIntent(trimmedQuestion);

    if (classification.intent === 'catalogue_wide') {
      res.status(200).json({
        status: 'success',
        answer: "I can analyze deal data for this specific product. For catalogue-wide recommendations across multiple gadgets, please use the Tech Catalogue filters."
      });
      return;
    }

    // 2. Fetch Product & Price History Levels
    const levelRes = await getPriceHistoryLevel(productId);
    const { level } = levelRes;

    const originalJson = res.json;
    res.json = function(data: any) {
      if (data && data.status === 'success' && data.answer) {
        data.level = level;
        data.isHistorical = classification.isHistorical;
      }
      return originalJson.call(this, data);
    };

    const isTimingQuery =
      lowerQuestion.includes('should i buy') ||
      lowerQuestion.includes('should i wait') ||
      lowerQuestion.includes('buy or wait') ||
      lowerQuestion.includes('buy now') ||
      lowerQuestion.includes('is it a good time') ||
      lowerQuestion.includes('good deal') ||
      lowerQuestion.includes('great deal') ||
      lowerQuestion.includes('worth buying') ||
      lowerQuestion.includes('worth it') ||
      (classification.isHistorical && (lowerQuestion.includes('buy') || lowerQuestion.includes('wait') || lowerQuestion.includes('recommend')));

    // LEVEL 0: Block timing/recommendation questions
    if (level === 0 && isTimingQuery) {
      res.status(200).json({
        status: 'success',
        answer: 'Price history is still being collected for this product. As more genuine price data is recorded, smarter Buy/Wait insights will become available.'
      });
      return;
    }

    // LEVEL 1: Block Buy/Wait recommendations, answer with factual price change
    if (level === 1) {
      if (isTimingQuery) {
        const changeStr = levelRes.priceChange! < 0
          ? `The price has decreased ${Math.abs(levelRes.priceChangePct!).toFixed(1)}% since the previous recorded price.`
          : levelRes.priceChange! > 0
          ? `The price has increased ${levelRes.priceChangePct!.toFixed(1)}% since the previous recorded price.`
          : `The price is unchanged since the previous recorded price.`;

        res.status(200).json({
          status: 'success',
          answer: `Only limited price history is available, so I can't reliably recommend buying or waiting yet. ${changeStr}`
        });
        return;
      }

      if (lowerQuestion.includes('price change') || lowerQuestion.includes('previous recorded price')) {
        res.status(200).json({
          status: 'success',
          answer: `The current price is ₹${levelRes.currentPrice.toLocaleString('en-IN')}, compared to the previous recorded price of ₹${levelRes.prevPrice?.toLocaleString('en-IN') || levelRes.currentPrice.toLocaleString('en-IN')}.`
        });
        return;
      }
    }

    // LEVEL 2: Block Buy/Wait recommendations, answer with short-term trend
    if (level === 2) {
      if (isTimingQuery) {
        res.status(200).json({
          status: 'success',
          answer: "There's some short-term price history available, but not enough for a reliable Buy/Wait recommendation yet."
        });
        return;
      }

      if (lowerQuestion.includes('price trend') || lowerQuestion.includes('how is the price trending') || lowerQuestion.includes('trending')) {
        const days = levelRes.daySpanDays || 7;
        const trendStr = levelRes.diffFromAvgPct! < 0
          ? `Currently, the price is ${Math.abs(levelRes.diffFromAvgPct!).toFixed(1)}% below the observed ${days}-day average of ₹${levelRes.avgPrice?.toLocaleString('en-IN')}.`
          : levelRes.diffFromAvgPct! > 0
          ? `Currently, the price is ${levelRes.diffFromAvgPct!.toFixed(1)}% above the observed ${days}-day average of ₹${levelRes.avgPrice?.toLocaleString('en-IN')}.`
          : `Currently, the price is equal to the observed ${days}-day average of ₹${levelRes.avgPrice?.toLocaleString('en-IN')}.`;

        res.status(200).json({
          status: 'success',
          answer: `Over the available ${days}-day tracking period: ${trendStr}`
        });
        return;
      }

      if (lowerQuestion.includes('compare with recent average') || lowerQuestion.includes('recent average')) {
        res.status(200).json({
          status: 'success',
          answer: `The current price is ₹${levelRes.currentPrice.toLocaleString('en-IN')}, compared to the observed ${levelRes.daySpanDays || 7}-day average of ₹${levelRes.avgPrice?.toLocaleString('en-IN')}.`
        });
        return;
      }

      if (lowerQuestion.includes('lowest recorded price') || lowerQuestion.includes('historical low')) {
        res.status(200).json({
          status: 'success',
          answer: `The lowest recorded price in the available history is ₹${levelRes.lowestPrice?.toLocaleString('en-IN')}, compared to the current price of ₹${levelRes.currentPrice.toLocaleString('en-IN')}.`
        });
        return;
      }
    }

    // 3. Server-Side Rate Limiting for AI Calls (10 messages per product per user/session per rolling 24 hours)
    const authedUserId = (req as any).user?.userId || (req as any).user?.user_id;
    const userIdentifier = authedUserId
      ? `user_${authedUserId}_${productId}`
      : `session_${req.ip || req.headers['x-forwarded-for'] || 'anon'}_${productId}`;

    if (!checkAndIncrementRateLimit(userIdentifier)) {
      res.status(200).json({
        status: 'success',
        answer: "You've reached today's AI question limit for this product. Please try again later."
      });
      return;
    }

    // Fetch Product details & Active store prices
    const productSql = `
      SELECT p.*, c.name AS category_name
      FROM products p
      JOIN categories c ON p.category_id = c.category_id
      WHERE p.product_id = $1;
    `;
    const productResult = await db.query(productSql, [productId]);
    if (productResult.rows.length === 0) {
      return next(new AppError('Product not found.', 404));
    }
    const product = productResult.rows[0];

    const pricesSql = `
      SELECT pp.price, pp.original_price, pp.discount, pp.product_url, pp.is_available, s.name AS store_name
      FROM product_prices pp
      JOIN stores s ON pp.store_id = s.store_id
      WHERE pp.product_id = $1 AND pp.is_available = TRUE
      ORDER BY pp.price ASC;
    `;
    const pricesResult = await db.query(pricesSql, [productId]);
    const storeOffers = pricesResult.rows.map((row: any) => ({
      store: row.store_name,
      price: parseFloat(row.price),
      original_price: row.original_price ? parseFloat(row.original_price) : undefined,
      url: row.product_url
    }));

    const cheapestOffer = storeOffers[0];
    const currentPrice = cheapestOffer ? cheapestOffer.price : levelRes.currentPrice;

    const buyUrlNote = (cheapestOffer && cheapestOffer.url && (cheapestOffer.url.startsWith('http://') || cheapestOffer.url.startsWith('https://')))
      ? ` You can check the listing on ${cheapestOffer.store} for more details.`
      : '';

    // Direct Factual Question Handling for Common Lookups (Fast Deterministic Bypass)
    if (
      lowerQuestion.includes('current price') ||
      lowerQuestion.includes('what is current price') ||
      lowerQuestion.includes("what's the current price") ||
      lowerQuestion.includes('what is the price') ||
      lowerQuestion.includes("what's the price") ||
      lowerQuestion.includes('how much does it cost') ||
      lowerQuestion.includes('how much is it') ||
      lowerQuestion.includes('price now')
    ) {
      res.status(200).json({
        status: 'success',
        answer: `The current lowest available price for ${product.name} is ₹${currentPrice.toLocaleString('en-IN')}${cheapestOffer ? ' on ' + cheapestOffer.store : ''}.`
      });
      return;
    }

    if (
      lowerQuestion.includes('cheapest store') ||
      lowerQuestion.includes('which store is cheapest') ||
      lowerQuestion.includes('cheapest retailer') ||
      lowerQuestion.includes('which retailer is cheapest') ||
      lowerQuestion.includes('lowest price store') ||
      lowerQuestion.includes('best store') ||
      lowerQuestion.includes('cheapest option')
    ) {
      if (storeOffers.length >= 2) {
        res.status(200).json({
          status: 'success',
          answer: `The cheapest store currently is ${cheapestOffer.store} at ₹${cheapestOffer.price.toLocaleString('en-IN')}.`
        });
      } else if (storeOffers.length === 1) {
        res.status(200).json({
          status: 'success',
          answer: `Currently listed on ${cheapestOffer.store} at ₹${cheapestOffer.price.toLocaleString('en-IN')}.`
        });
      } else {
        res.status(200).json({
          status: 'success',
          answer: `Store pricing comparison is unavailable for this product.`
        });
      }
      return;
    }

    if (
      lowerQuestion.includes('where can i buy') ||
      lowerQuestion.includes('where to buy') ||
      lowerQuestion.includes('purchase link') ||
      lowerQuestion.includes('buy link') ||
      lowerQuestion.includes('where can i purchase') ||
      lowerQuestion.includes('how can i buy')
    ) {
      if (cheapestOffer && cheapestOffer.url && (cheapestOffer.url.startsWith('http://') || cheapestOffer.url.startsWith('https://'))) {
        res.status(200).json({
          status: 'success',
          answer: `You can purchase ${product.name} on ${cheapestOffer.store} for ₹${currentPrice.toLocaleString('en-IN')}.`,
          storeUrl: cheapestOffer.url,
          storeName: cheapestOffer.store
        });
      } else {
        res.status(200).json({
          status: 'success',
          answer: `A direct purchase link is currently unavailable for this product.`
        });
      }
      return;
    }

    if (lowerQuestion.includes('processor') || lowerQuestion.includes('cpu')) {
      const specFields = parseProductSpecsBackend(product);
      if (specFields.processor) {
        res.status(200).json({ status: 'success', answer: `${product.name} is powered by ${specFields.processor}.` });
      } else {
        res.status(200).json({ status: 'success', answer: `Processor information isn't available in our tracked data.${buyUrlNote}` });
      }
      return;
    }

    if (lowerQuestion.includes('ram') || lowerQuestion.includes('memory')) {
      const specFields = parseProductSpecsBackend(product);
      if (specFields.ram) {
        res.status(200).json({ status: 'success', answer: `${product.name} comes with ${specFields.ram}.` });
      } else {
        res.status(200).json({ status: 'success', answer: `RAM information isn't available in our tracked data.${buyUrlNote}` });
      }
      return;
    }

    if (lowerQuestion.includes('storage') || lowerQuestion.includes('ssd') || lowerQuestion.includes('rom')) {
      const specFields = parseProductSpecsBackend(product);
      if (specFields.storage) {
        res.status(200).json({ status: 'success', answer: `${product.name} offers ${specFields.storage}.` });
      } else {
        res.status(200).json({ status: 'success', answer: `Storage information isn't available in our tracked data.${buyUrlNote}` });
      }
      return;
    }

    if (lowerQuestion.includes('gpu') || lowerQuestion.includes('graphics')) {
      const specFields = parseProductSpecsBackend(product);
      if (specFields.gpu) {
        res.status(200).json({ status: 'success', answer: `${product.name} features ${specFields.gpu}.` });
      } else {
        res.status(200).json({ status: 'success', answer: `Graphics card (GPU) information isn't available in our tracked data.${buyUrlNote}` });
      }
      return;
    }

    if (lowerQuestion.includes('display') || lowerQuestion.includes('screen')) {
      const specFields = parseProductSpecsBackend(product);
      if (specFields.display) {
        res.status(200).json({ status: 'success', answer: `${product.name} features a ${specFields.display}.` });
      } else {
        res.status(200).json({ status: 'success', answer: `Display information isn't available in our tracked data.${buyUrlNote}` });
      }
      return;
    }

    if (lowerQuestion.includes('battery')) {
      const specFields = parseProductSpecsBackend(product);
      if (specFields.battery) {
        res.status(200).json({ status: 'success', answer: `${product.name} is equipped with a ${specFields.battery}.` });
      } else {
        res.status(200).json({ status: 'success', answer: `Battery information isn't available in our tracked data.${buyUrlNote}` });
      }
      return;
    }

    if (lowerQuestion.includes('os') || lowerQuestion.includes('operating system')) {
      const specFields = parseProductSpecsBackend(product);
      if (specFields.os) {
        res.status(200).json({ status: 'success', answer: `${product.name} runs ${specFields.os}.` });
      } else {
        res.status(200).json({ status: 'success', answer: `Operating system information isn't available in our tracked data.${buyUrlNote}` });
      }
      return;
    }

    if (lowerQuestion.includes('camera')) {
      const specFields = parseProductSpecsBackend(product);
      if (specFields.camera) {
        res.status(200).json({ status: 'success', answer: `${product.name} features a ${specFields.camera}.` });
      } else {
        res.status(200).json({ status: 'success', answer: `Camera information isn't available in our tracked data.${buyUrlNote}` });
      }
      return;
    }

    if (lowerQuestion.includes('tracking start') || lowerQuestion.includes('when did tracking')) {
      const earliestStr = levelRes.earliestTs ? new Date(levelRes.earliestTs).toISOString().split('T')[0] : 'N/A';
      res.status(200).json({
        status: 'success',
        answer: `Price tracking for ${product.name} started on ${earliestStr}.`
      });
      return;
    }

    // Short-term Cache check
    const normalizedKey = `${productId}_L${level}_${trimmedQuestion.toLowerCase().replace(/[^a-z0-9]/g, '')}_${currentPrice}_${levelRes.latestTs}`;
    const now = Date.now();
    const cachedEntry = aiChatCache.get(normalizedKey);
    if (cachedEntry && cachedEntry.expiresAt > now) {
      res.status(200).json({
        status: 'success',
        answer: cachedEntry.answer
      });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(200).json({
        status: 'success',
        answer: 'AI Deal Advisor is temporarily unavailable.'
      });
      return;
    }

    // Context preparation for Gemini
    const historyRows = levelRes.historyRows || [];
    const pricesList = historyRows.map((r: any) => parseFloat(r.price)).filter((p: number) => !isNaN(p));
    const allPrices = isNaN(currentPrice) ? pricesList : [...pricesList, currentPrice];
    const lowestPrice = allPrices.length > 0 ? Math.min(...allPrices) : currentPrice;
    const highestPrice = allPrices.length > 0 ? Math.max(...allPrices) : currentPrice;
    const averagePrice = allPrices.length > 0 ? Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length) : currentPrice;

    let engineRecommendation = 'buy_now';
    let engineReasoning = 'Current price is close to the recorded historical low.';
    let engineConfidence = 'medium';

    if (level === 3 && !isNaN(currentPrice)) {
      if (currentPrice > averagePrice * 1.05) {
        engineRecommendation = 'wait';
        engineReasoning = `Current price (₹${currentPrice.toLocaleString('en-IN')}) is above the recorded 30-day average of ₹${averagePrice.toLocaleString('en-IN')}.`;
      } else {
        engineRecommendation = 'buy_now';
        engineReasoning = `Current price (₹${currentPrice.toLocaleString('en-IN')}) is favorable relative to the recorded 30-day average of ₹${averagePrice.toLocaleString('en-IN')}.`;
      }
    }

    const priceHistorySummary = {
      history_level: level,
      record_count: historyRows.length,
      history_coverage_days: levelRes.daySpanDays,
      has_30_day_history: level === 3,
      earliest_date: levelRes.earliestTs ? new Date(levelRes.earliestTs).toISOString().split('T')[0] : 'N/A',
      latest_date: levelRes.latestTs ? new Date(levelRes.latestTs).toISOString().split('T')[0] : 'N/A',
      lowest_recorded_price: lowestPrice,
      highest_recorded_price: highestPrice,
      average_recorded_price: averagePrice
    };

    const contextPayload = {
      product_id: product.product_id,
      product_name: product.name,
      brand: product.brand,
      category: product.category_name,
      description: product.description,
      specifications: product.specifications || {},
      current_cheapest_price: currentPrice,
      cheapest_store: cheapestOffer ? cheapestOffer.store : 'N/A',
      active_store_offers: storeOffers.map(o => ({
        store: o.store,
        price: o.price,
        original_price: o.original_price,
        buy_url: o.url
      })),
      price_history_summary: priceHistorySummary,
      buy_wait_engine_recommendation: level === 3 ? {
        recommendation: engineRecommendation,
        reasoning: engineReasoning,
        confidence: engineConfidence
      } : null
    };

    const formattedHistory = Array.isArray(history)
      ? history.slice(-4).map((h: any) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${String(h.content).slice(0, 300)}`).join('\n')
      : '';

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const systemInstruction = `You are a product-specific price intelligence assistant for Gadget Tracker Pro.

Answer questions ONLY using the product and price data supplied in this request.

Do not use outside market knowledge.
Do not predict exact future prices or speculate on future price drops.
Do not invent missing data, product specifications, or retailer information.
Do not claim a price will definitely rise or fall.
NEVER respond to a factual current-data question (such as current price, cheapest store, purchase link, specifications, or tracking start date) with "Not enough price history". Price history level ONLY restricts historical analysis and buy/wait recommendations.
If history level is less than 3 (${level}), you MUST NOT provide, imply, suggest, or indirectly state a buy/wait recommendation.
If user asks for timing recommendations (buy/wait/why), align strictly with the supplied buy_wait_engine_recommendation (only available at level 3).
Keep answers concise (1-3 sentences maximum), factual, and directly helpful.

Return valid JSON: { "answer": "your concise response here" }`;

      const prompt = `Product and Price Context:\n${JSON.stringify(contextPayload, null, 2)}\n\nConversation History:\n${formattedHistory}\n\nUser Question: ${trimmedQuestion}`;

      let response: any = null;
      try {
        response = await generateContentWithModelFallback(ai, {
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                answer: {
                  type: Type.STRING,
                  description: 'Concise 1-3 sentence factual response based strictly on supplied context.'
                }
              },
              required: ['answer']
            }
          }
        });
      } catch (aiErr) {
        console.warn('[AI Chat] Gemini call failed or rate limit exceeded:', aiErr);
        res.status(200).json({
          status: 'success',
          answer: 'AI Deal Advisor is temporarily unavailable due to rate limits. Please try again shortly.'
        });
        return;
      }

      let parsed: any = null;
      try {
        const rawText = response.text ? response.text.trim() : '';
        parsed = JSON.parse(rawText);
      } catch (e) {
        // Failed JSON parsing
      }

      if (!parsed || typeof parsed.answer !== 'string' || parsed.answer.trim().length === 0 || parsed.answer.length > 500) {
        res.status(200).json({
          status: 'success',
          answer: 'AI Deal Advisor is temporarily unavailable.'
        });
        return;
      }

      const cleanAnswer = parsed.answer.trim();
      const forbiddenClaims = ['will fall', 'will drop next week', 'will decrease tomorrow', 'guaranteed discount'];
      if (forbiddenClaims.some(claim => cleanAnswer.toLowerCase().includes(claim))) {
        res.status(200).json({
          status: 'success',
          answer: 'AI Deal Advisor is temporarily unavailable.'
        });
        return;
      }

      aiChatCache.set(normalizedKey, {
        cacheKey: normalizedKey,
        expiresAt: now + (60 * 60 * 1000),
        answer: cleanAnswer
      });

      res.status(200).json({
        status: 'success',
        answer: cleanAnswer
      });
    } catch (geminiErr) {
      console.error('Gemini API call error in handleProductAiChat:', geminiErr);
      res.status(200).json({
        status: 'success',
        answer: 'AI Deal Advisor is temporarily unavailable.'
      });
    }
  } catch (err) {
    next(err);
  }
};

