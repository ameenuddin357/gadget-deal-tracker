import axios from 'axios';
import db from '../config/db.ts';
import { QuotaTracker } from './quotaTracker.ts';
import { NormalizationService } from './normalizationService.ts';

/**
 * Detect the currency of each offer from the API response or infer from store's country/domain
 */
function detectCurrency(off: any, item: any): string {
  const rawCurrency = (
    off.currency ||
    off.currency_code ||
    off.price_currency ||
    off.currencyCode ||
    item.currency ||
    item.currency_code ||
    item.price_currency ||
    item.currencyCode ||
    ''
  ).toString().toUpperCase().trim();

  if (rawCurrency) {
    if (rawCurrency === 'USD' || rawCurrency === '$' || rawCurrency.includes('USD')) return 'USD';
    if (rawCurrency === 'INR' || rawCurrency === '₹' || rawCurrency === 'RS' || rawCurrency.includes('INR')) return 'INR';
    if (rawCurrency === 'GBP' || rawCurrency === '£' || rawCurrency.includes('GBP')) return 'GBP';
    if (rawCurrency === 'EUR' || rawCurrency === '€' || rawCurrency.includes('EUR')) return 'EUR';
    return rawCurrency;
  }

  const storeLower = (off.store_name || off.merchant || '').toLowerCase();
  const urlLower = (off.product_url || off.offer_page_url || off.link || '').toLowerCase();

  // If URL or store belongs to India
  if (
    urlLower.includes('.in') || 
    urlLower.includes('.co.in') || 
    storeLower.includes('india') || 
    storeLower.includes('flipkart') || 
    storeLower.includes('croma') || 
    storeLower.includes('reliance')
  ) {
    return 'INR';
  }

  // If URL or store belongs to US / International
  if (
    urlLower.includes('.com') || 
    urlLower.includes('.org') || 
    storeLower.includes('us') || 
    storeLower.includes('walmart') || 
    storeLower.includes('best buy') || 
    storeLower.includes('target') ||
    storeLower.includes('ebay')
  ) {
    return 'USD';
  }

  if (urlLower.includes('.co.uk') || storeLower.includes('uk')) {
    return 'GBP';
  }

  if (urlLower.includes('.eu') || storeLower.includes('euro')) {
    return 'EUR';
  }

  return 'INR';
}

/**
 * Calculate median of numeric prices
 */
function getMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[half];
  }
  return (sorted[half - 1] + sorted[half]) / 2.0;
}

// Detailed Interface for incoming scraped/queried product data
export interface ExternalOffer {
  store_name: string;
  price: number;
  original_price: number;
  product_url: string;
  is_available: boolean;
}

export interface ExternalProduct {
  name: string;
  brand: string;
  model_no: string;
  image_url: string;
  specs_summary: string;
  category_name: string;
  offers: ExternalOffer[];
}

/**
 * Service to interface with RapidAPI Shopping APIs
 * Handles Axios connections, header validations, parsing, and automated saving to PostgreSQL.
 */
export class RapidApiService {
  private static apiKey = process.env.RAPIDAPI_KEY || '';
  private static apiHost = process.env.RAPIDAPI_HOST || 'real-time-amazon-data.p.rapidapi.com';

  /**
   * Safe parser for currency and store countries to return standard ISO code (INR, USD, EUR, GBP)
   */
  public static getCurrency(off: any, item: any): string {
    const rawCurrency = (
      off?.currency ||
      off?.currency_code ||
      off?.price_currency ||
      off?.currencyCode ||
      item?.currency ||
      item?.currency_code ||
      item?.price_currency ||
      item?.currencyCode ||
      ''
    ).toString().toUpperCase().trim();

    if (rawCurrency) {
      if (rawCurrency === 'USD' || rawCurrency === '$' || rawCurrency.includes('USD')) return 'USD';
      if (rawCurrency === 'INR' || rawCurrency === '₹' || rawCurrency === 'RS' || rawCurrency.includes('INR')) return 'INR';
      if (rawCurrency === 'GBP' || rawCurrency === '£' || rawCurrency.includes('GBP')) return 'GBP';
      if (rawCurrency === 'EUR' || rawCurrency === '€' || rawCurrency.includes('EUR')) return 'EUR';
      return rawCurrency;
    }

    const storeLower = (off?.store_name || off?.merchant || item?.store_name || item?.merchant || '').toLowerCase();
    const urlLower = (off?.product_url || off?.offer_page_url || off?.link || item?.url || item?.product_url || '').toLowerCase();

    if (
      urlLower.includes('.in') || 
      urlLower.includes('.co.in') || 
      storeLower.includes('india') || 
      storeLower.includes('flipkart') || 
      storeLower.includes('croma') || 
      storeLower.includes('reliance')
    ) {
      return 'INR';
    }

    if (
      urlLower.includes('.com') || 
      urlLower.includes('.org') || 
      storeLower.includes('us') || 
      storeLower.includes('walmart') || 
      storeLower.includes('best buy') || 
      storeLower.includes('target') ||
      storeLower.includes('ebay')
    ) {
      return 'USD';
    }

    if (urlLower.includes('.co.uk') || storeLower.includes('uk')) {
      return 'GBP';
    }

    if (urlLower.includes('.eu') || storeLower.includes('euro')) {
      return 'EUR';
    }

    return 'INR';
  }

  /**
   * Convert any foreign price value into INR using a standard static exchange rate
   */
  /**
   * Validates if the fetched product is actually relevant to the search query.
   * Helps reject accessories when searching for laptops, phones, etc.
   */
  public static validateProductRelevance(searchKeyword: string, productTitle: string, category: string): boolean {
    const title = productTitle.toLowerCase();
    const query = searchKeyword.toLowerCase();

    // If searching for laptops
    if (query.includes('laptop') || query.includes('macbook') || query.includes('notebook')) {
      const accessoryKeywords = [
        'bag', 'backpack', 'sleeve', 'case', 'cover', 'skin',
        'stand', 'cooling pad', 'cooler',
        'charger', 'adapter', 'power supply', 'battery',
        'mouse', 'keyboard', 'keycap', 'wrist rest',
        'screen protector', 'guard', 'film',
        'docking station', 'hub'
      ];
      for (const accessory of accessoryKeywords) {
        // Use word boundaries if possible, but simple inclusion is safer for some
        if (new RegExp(`\\b${accessory}\\b`).test(title)) {
          // It's likely an accessory.
          return false;
        }
      }
    }
    
    // If searching for phones
    if (query.includes('phone') || query.includes('iphone') || query.includes('galaxy') || query.includes('smartphone')) {
      const accessoryKeywords = [
        'case', 'cover', 'skin', 'protector', 'tempered glass',
        'charger', 'adapter', 'cable', 'wire',
        'mount', 'holder', 'stand',
        'lens'
      ];
      for (const accessory of accessoryKeywords) {
        if (new RegExp(`\\b${accessory}\\b`).test(title)) {
          return false;
        }
      }
    }

    return true;
  }

  public static convertToINR(price: number, currency: string): number {
    const rateMap: { [key: string]: number } = {
      'INR': 1,
      'USD': 83.5,
      'EUR': 90.5,
      'GBP': 106.0
    };
    const rate = rateMap[currency.toUpperCase()] || 1;
    return price * rate;
  }

  /**
   * COGNITIVE CACHING ENGINE: Intercept with PostgreSQL lookup
   * Exposes a shared caching layer for all integrated scrapers
   */
  public static async checkLocalCache(keyword: string, ignoreStaleness: boolean = false): Promise<any[] | null> {
    if (!keyword || keyword.trim().length === 0) return null;
    const trimmedKeyword = keyword.trim();
    
    let client;
    try {
      client = await db.getClient();
    } catch (err: any) {
      console.warn('[PostgreSQL Warn] Database connection down. Skipping cache lookup:', err.message);
      return null;
    }

    try {
      const searchWildcard = `%${trimmedKeyword}%`;
      const localCheck = await client.query(
        `SELECT p.product_id, p.name, p.brand, p.model_no, p.slug, p.image_url, p.specs_summary, p.data_source, c.name AS category_name
         FROM products p
         JOIN categories c ON p.category_id = c.category_id
         WHERE p.name ILIKE $1 OR p.brand ILIKE $1 OR p.specs_summary ILIKE $1`,
        [searchWildcard]
      );

      if (localCheck.rows.length > 0) {
        console.log(`[Cache Check] Found ${localCheck.rows.length} matching products in local database for keyword: "${trimmedKeyword}"`);
        
        const cacheResults = [];
        let allPricesFresh = true;

        for (const row of localCheck.rows) {
          const priceCheck = await client.query(
            `SELECT pp.price, pp.original_price, pp.product_url, pp.is_available, pp.last_scraped_at, s.name AS store_name
             FROM product_prices pp
             JOIN stores s ON pp.store_id = s.store_id
             WHERE pp.product_id = $1`,
            [row.product_id]
          );

          if (priceCheck.rows.length === 0) {
            allPricesFresh = false;
            break;
          }

          const now = Date.now();
          const cacheTtlDays = parseInt(process.env.CACHE_TTL_DAYS || '30', 10);
          const staleThresholdMs = cacheTtlDays * 24 * 60 * 60 * 1000; // pricing freshness cache

          if (!ignoreStaleness) {
            for (const priceRow of priceCheck.rows) {
              const scrapedAt = new Date(priceRow.last_scraped_at).getTime();
              if (now - scrapedAt > staleThresholdMs) {
                allPricesFresh = false;
                break;
              }
            }
          }

          if (!allPricesFresh) {
            break;
          }

          const storesPricing = priceCheck.rows.map((pr: any) => {
            const scrapedAt = new Date(pr.last_scraped_at).getTime();
            const isStale = (now - scrapedAt) > staleThresholdMs;
            return {
              store_name: pr.store_name,
              price: parseFloat(pr.price),
              original_price: parseFloat(pr.original_price),
              discount: pr.original_price > pr.price ? ((pr.original_price - pr.price) / pr.original_price) * 100 : 0,
              product_url: pr.product_url,
              last_scraped_at: pr.last_scraped_at,
              is_stale: isStale
            };
          });

          const productIsStale = storesPricing.some((sp: any) => sp.is_stale);
          const oldestScrapedAt = storesPricing.reduce((oldest: string, current: any) => {
            if (!oldest) return current.last_scraped_at;
            return new Date(current.last_scraped_at).getTime() < new Date(oldest).getTime() ? current.last_scraped_at : oldest;
          }, '');

          cacheResults.push({
            ...row,
            storesPricing,
            is_stale: productIsStale,
            last_scraped_at: oldestScrapedAt
          });
        }

        if (allPricesFresh && cacheResults.length > 0) {
          const cacheTtlDays = parseInt(process.env.CACHE_TTL_DAYS || '30', 10);
          console.log(`[Cache Hit] All matching products are fully cached and within ${cacheTtlDays}-day limits. Skipping API credit consumption!`);
          return cacheResults;
        } else {
          const cacheTtlDays = parseInt(process.env.CACHE_TTL_DAYS || '30', 10);
          console.log(`[Cache Stale] Matching products found but pricing is stale (> ${cacheTtlDays} days) or missing. Executing refresh.`);
        }
      }
    } catch (err: any) {
      console.error('[Cache Check Error] Failed to evaluate DB cache:', err.message);
    } finally {
      if (client) {
        try {
          client.release();
        } catch {}
      }
    }
    return null;
  }

  /**
   * Search and compare product pricing on RapidAPI (Amazon, Walmart, Google Shopping, etc.)
   * @param keyword - Search query keyword (e.g. "iPhone 15 Pro Max")
   */
  public static async searchAndSyncProducts(keyword: string, saveToDb: boolean = true, bypassCache: boolean = false, page: number = 1): Promise<any[]> {
    if (!keyword || keyword.trim().length === 0) {
      throw new Error('Search keyword is required.');
    }

    const trimmedKeyword = keyword.trim();
    console.log(`[RapidAPI] Initiating search for keyword: "${trimmedKeyword}"`);

    // 1. Intercept with local Postgres caching
    if (saveToDb && !bypassCache) {
      const cached = await this.checkLocalCache(trimmedKeyword);
      if (cached) {
        return cached;
      }
    }

    // 2. Check long-term 7-day sync log cache to conserve active credits
    const recentlySynced = bypassCache ? false : await this.isKeywordSyncedRecently(trimmedKeyword, 'amazon');
    if (recentlySynced) {
      console.log(`[Keyword Sync Cache Hit] Amazon has already synced "${trimmedKeyword}" within 7 days. Retrieving stale/recent local products.`);
      const cached = await this.checkLocalCache(trimmedKeyword, true);
      if (cached && cached.length > 0) {
        return cached;
      }
      console.log(`[Keyword Sync Cache Alert] No cache available despite sync log. Proceeding with fallback.`);
    }

    // 3. Check Budget & Quotas before executing external API calls
    const isBudgeted = await this.isKeywordBudgeted(trimmedKeyword);
    const capExceeded = await QuotaTracker.isCapExceeded('amazon');
    const isConfigured = this.apiKey && this.apiKey !== 'your_rapidapi_application_key_here' && this.apiHost;

    if (false) {
      console.log(`[Keyword Budget] Keyword "${trimmedKeyword}" is not budgeted for live Amazon. Returning cached or synthetic source.`);
      const staleCached = await this.checkLocalCache(trimmedKeyword, true);
      if (staleCached && staleCached.length > 0) {
        return staleCached;
      }
      const fallbackList = [];
      if (!saveToDb) return fallbackList;
      const syncedProducts = [];
      for (const prod of fallbackList) {
        const synced = await this.saveProductToPostgres(prod, 'synthetic');
        if (synced) syncedProducts.push(synced);
      }
      return syncedProducts;
    }

    if (capExceeded) {
      console.log(`[Quota Tracker] Amazon monthly API limit reached. Returning cached or synthetic fallback.`);
      const staleCached = await this.checkLocalCache(trimmedKeyword, true);
      if (staleCached && staleCached.length > 0) {
        return staleCached;
      }
      const fallbackList = [];
      if (!saveToDb) return fallbackList;
      const syncedProducts = [];
      for (const prod of fallbackList) {
        const synced = await this.saveProductToPostgres(prod, 'synthetic');
        if (synced) syncedProducts.push(synced);
      }
      return syncedProducts;
    }

    if (!isConfigured) {
      console.log(`[RapidAPI Configuration] Amazon API is not fully configured. Returning cached or synthetic fallback.`);
      const staleCached = await this.checkLocalCache(trimmedKeyword, true);
      if (staleCached && staleCached.length > 0) {
        return staleCached;
      }
      const fallbackList = [];
      if (!saveToDb) return fallbackList;
      const syncedProducts = [];
      for (const prod of fallbackList) {
        const synced = await this.saveProductToPostgres(prod, 'synthetic');
        if (synced) syncedProducts.push(synced);
      }
      return syncedProducts;
    }

    let productsList: ExternalProduct[] = [];
    let wasRealApiSuccess = false;

    try {
      // Track and record API call
      await QuotaTracker.recordCall('amazon');

      // Build the headers
      const headers = {
        'X-RapidAPI-Key': this.apiKey,
        'X-RapidAPI-Host': this.apiHost
      };

      // We query Real-Time Amazon from RapidAPI with a MAX limit of 40 to optimize each call
      const response = await axios.get(`https://${this.apiHost}/search`, {
        headers,
        params: {
          query: trimmedKeyword,
          country: 'IN', // Target India retail stores if supported
          limit: '40',
          page: page
        },
        timeout: 10000
      });

      if (response.data && response.data.data) {
        const items = response.data.data.products || response.data.data.results || [];
        wasRealApiSuccess = items.length > 0;
        
        for (const item of items) {
          const rawOffers = item.offers || (item.product_price ? [{
            price: item.product_price.replace(/[^0-9.]/g, ''),
            original_price: item.product_original_price ? item.product_original_price.replace(/[^0-9.]/g, '') : null,
            store_name: item.currency === 'USD' ? 'Amazon US' : 'Amazon India',
            currency: item.currency,
            product_url: item.product_url,
            is_available: true
          }] : []);
          const mappedOffers: ExternalOffer[] = [];

          for (const off of rawOffers) {
            let currency = this.getCurrency(off, item);
            let rawPrice = parseFloat(off.price || off.price_raw) || 0;
            let rawOriginalPrice = parseFloat(off.original_price || off.msrp || off.price) || 0;
            
            // 1. Non-numeric or missing price validation
            if (isNaN(rawPrice) || rawPrice <= 0 || !isFinite(rawPrice)) {
              continue;
            }

            // 2. Prevent repeated exchange-rate multiplication
            // Removed amount-based guessing to strictly rely on API metadata.

            const price = this.convertToINR(rawPrice, currency);
            const original_price = this.convertToINR(rawOriginalPrice, currency);

            // 3. Obviously impossible values for a gadget tracker (e.g. > 10,000,000 INR)
            if (price > 10000000) {
              console.warn(`[Sanity Safeguard Flag] Flagged price ₹${price}. Value exceeds maximum plausible threshold (10,000,000 INR). Skipping.`);
              continue;
            }

            const rawStoreName = off.store_name || off.merchant;
            const storeName = rawStoreName ? rawStoreName.trim() : 'Amazon India';

            mappedOffers.push({
              store_name: storeName,
              price,
              original_price,
              product_url: off.product_url || off.offer_page_url || off.link || 'https://amazon.in',
              is_available: off.is_available ?? true
            });
          }

          // Apply safeguard sanity check: filter out prices under 30% of the median price
          const validPrices = mappedOffers.map(o => o.price).filter(p => p > 0);
          const medianPrice = getMedian(validPrices);
          
          const sanitizedOffers: ExternalOffer[] = [];
          for (const off of mappedOffers) {
            if (medianPrice > 0 && off.price < 0.3 * medianPrice) {
              console.warn(`[Sanity Safeguard Flag] Flagged offer from "${off.store_name}" for review. Price ₹${off.price} is under 30% of product's median price ₹${medianPrice}. Skipping insertion.`);
              continue;
            }
            sanitizedOffers.push(off);
          }

          if (sanitizedOffers.length > 0) {
            const finalName = item.product_title || item.title || trimmedKeyword;
            const finalCategory = item.category || 'Smartphones & Tablets';
            
            // Apply relevance validation
            if (!this.validateProductRelevance(trimmedKeyword, finalName, finalCategory)) {
              console.warn(`[Relevance Filter] Rejecting "${finalName}" as it appears to be an accessory/unrelated to "${trimmedKeyword}".`);
              continue; // Skip this product
            }
            
            productsList.push({
              name: finalName,
              brand: item.brand || item.manufacturer || 'General Gadgets',
              model_no: item.model_no || item.asin || 'N/A',
              image_url: item.product_photo || item.image || 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400',
              specs_summary: item.specs_summary || item.description || `High quality premium product with standard retail specifications.`,
              category_name: item.category || 'Smartphones & Tablets',
              offers: sanitizedOffers
            });
          }
        }
      }
    } catch (err: any) {
      console.error(`[RapidAPI Error] API Request fell through: ${err.message}. Falling back to high-fidelity seed engine.`);
      productsList = [];
      wasRealApiSuccess = false;
    }

    if (!saveToDb) {
      return productsList as any[];
    }

    // Now, synchronize all retrieved/processed external products to the PostgreSQL Database
    const syncedProducts = [];
    const finalSource = wasRealApiSuccess ? 'live_amazon' : 'synthetic';

    for (const prod of productsList) {
      const synced = await this.saveProductToPostgres(prod, finalSource);
      if (synced) syncedProducts.push(synced);
    }

    // Record the keyword sync log on success
    if (wasRealApiSuccess) {
      await this.recordKeywordSync(trimmedKeyword, 'amazon', productsList.length);
    }

    return syncedProducts;
  }

  /**
   * Bulk sync mechanism for seeded categories to grow the catalog automatically.
   * Respects rate limits by implementing a delay between searchAndSyncProducts calls.
   */
  public static async syncCategoryBulk(categoryKeywords: string[], source: 'amazon' | 'google' | 'flipkart' | 'all' = 'all', bypassCache: boolean = true): Promise<any[]> {
    const dailyBudget = parseInt(process.env.DAILY_SYNC_BUDGET || '10', 10);
    let keywordsToSync = [...categoryKeywords];

    // If keywords list is empty or generic, pull our daily rotation batch from scheduled_keywords
    if (keywordsToSync.length === 0) {
      let client;
      try {
        client = await db.getClient();
        const res = await client.query(
          `SELECT keyword FROM scheduled_keywords 
           ORDER BY last_synced_at ASC NULLS FIRST 
           LIMIT $1`,
          [dailyBudget]
        );
        if (res.rows.length > 0) {
          keywordsToSync = res.rows.map((r: any) => r.keyword);
        }
      } catch (err: any) {
        console.error('[Bulk Sync Fetch Error] Failed to fetch scheduled keywords:', err.message);
      } finally {
        if (client) client.release();
      }
    }

    console.log(`[Bulk Sync] Starting bulk sync for ${keywordsToSync.length} keywords on source: ${source} (bypassCache: ${bypassCache})...`);
    const results: any[] = [];
    
    let newCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const isAmazonConfigured = process.env.RAPIDAPI_KEY && 
                               process.env.RAPIDAPI_KEY !== 'your_rapidapi_application_key_here' &&
                               process.env.RAPIDAPI_HOST;

    const isGoogleConfigured = process.env.RAPIDAPI_KEY && 
                               process.env.RAPIDAPI_KEY !== 'your_rapidapi_application_key_here' &&
                               process.env.GOOGLE_SHOPPING_API_HOST;

    const isFlipkartConfigured = process.env.RAPIDAPI_KEY && 
                                 process.env.RAPIDAPI_KEY !== 'your_rapidapi_application_key_here' &&
                                 process.env.FLIPKART_API_HOST && 
                                 !process.env.FLIPKART_API_HOST.includes('<flipkart-host-placeholder>');

    // Lazy load other sync services to avoid circular dependencies in TypeScript
    const { GoogleShoppingService } = await import('./googleShoppingService.ts');
    const { FlipkartApiService } = await import('./flipkartApiService.ts');

    const successfullySyncedKeywords: string[] = [];

    for (const kw of keywordsToSync) {
      let kwSyncedSuccess = false;
      try {
        console.log(`[Bulk Sync] Syncing keyword: "${kw}"`);
        
        if (source === 'amazon' || source === 'all') {
          if (isAmazonConfigured) {
            if (await QuotaTracker.isCapExceeded('amazon')) {
              skippedCount++;
            } else {
              
              let synced = [];
              for (let page = 1; page <= 2; page++) {
                if (await QuotaTracker.isCapExceeded('amazon')) break;
                const pageSynced = await this.searchAndSyncProducts(kw, true, bypassCache, page);
                synced.push(...pageSynced);
                if (pageSynced.length === 0) break;
              }

              for (const p of synced) {
                if (p.isNewProduct) {
                  newCount++;
                } else {
                  updatedCount++;
                }
              }
              results.push(...synced);
              kwSyncedSuccess = true;
            }
          } else {
            console.warn(`[Bulk Sync] Amazon is not fully configured, skipping search for "${kw}".`);
            skippedCount++;
          }
        }
        
        if (source === 'google' || source === 'all') {
          if (isGoogleConfigured) {
            if (await QuotaTracker.isCapExceeded('google')) {
              skippedCount++;
            } else {
              
              let synced = [];
              for (let page = 1; page <= 2; page++) {
                if (await QuotaTracker.isCapExceeded('google')) break;
                const pageSynced = await GoogleShoppingService.searchAndSyncGoogleShopping(kw, true, bypassCache, page);
                synced.push(...pageSynced);
                if (pageSynced.length === 0) break;
              }

              for (const p of synced) {
                if (p.isNewProduct) {
                  newCount++;
                } else {
                  updatedCount++;
                }
              }
              results.push(...synced);
              kwSyncedSuccess = true;
            }
          } else {
            console.warn(`[Bulk Sync] Google Shopping is not fully configured, skipping search for "${kw}".`);
            skippedCount++;
          }
        }
        
        if (source === 'flipkart') {
          if (isFlipkartConfigured) {
            if (await QuotaTracker.isCapExceeded('flipkart')) {
              skippedCount++;
            } else {
              
              let synced = [];
              for (let page = 1; page <= 2; page++) {
                if (await QuotaTracker.isCapExceeded('flipkart')) break;
                const pageSynced = await FlipkartApiService.searchAndSyncFlipkart(kw, true, bypassCache, page);
                synced.push(...pageSynced);
                if (pageSynced.length === 0) break;
              }

              for (const p of synced) {
                if (p.isNewProduct) {
                  newCount++;
                } else {
                  updatedCount++;
                }
              }
              results.push(...synced);
              kwSyncedSuccess = true;
            }
          } else {
            console.warn(`[Bulk Sync] Flipkart is not fully configured, skipping search for "${kw}".`);
            skippedCount++;
          }
        }

        if (kwSyncedSuccess) {
          successfullySyncedKeywords.push(kw);
        }
      } catch (err: any) {
        console.error(`[Bulk Sync Error] Failed to sync keyword "${kw}":`, err.message);
        skippedCount++;
      }
      
      // Delay for 2.5 seconds between keywords to respect free-tier API rate limits uniformly across all sources
      await new Promise(resolve => setTimeout(resolve, 2500));
    }

    if (successfullySyncedKeywords.length > 0) {
      await this.updateKeywordLastSyncedAt(successfullySyncedKeywords);
    }
    
    console.log(`[Scheduler] Run complete: ${newCount} new products added, ${updatedCount} existing products updated, ${skippedCount} skipped (cache/quota).`);
    console.log(`[Bulk Sync] Completed bulk sync. Synced ${results.length} total products.`);
    return results;
  }

  /**
   * Aggressively normalizes a product name to eliminate minor differences in formatting, 
   * bracket specifications, colors, storage capacities, etc.
   */
  public static normalizeProductName(name: string): string {
    if (!name) return '';
    let normalized = name.toLowerCase();

    // 1. Remove everything inside brackets (e.g., "(128GB, Black)", "[Renewed]")
    normalized = normalized.replace(/\s*[([].*?[\])]/g, ' ');

    // 2. Remove specific capacity/RAM specifications
    normalized = normalized.replace(/\b\d+\s*(gb|tb|mb|ram|rom)\b/gi, ' ');
    
    // 3. Remove common colors
    const colors = [
      'space gray', 'space grey', 'titanium gray', 'titanium black', 'titanium yellow', 'titanium violet',
      'titanium', 'natural titanium', 'white titanium', 'black titanium', 'blue titanium',
      'deep purple', 'sierra blue', 'midnight', 'starlight', 'cosmic', 'blue', 'black', 'white', 
      'gold', 'silver', 'purple', 'green', 'yellow', 'red', 'rose gold', 'coral'
    ];
    for (const color of colors) {
      const regex = new RegExp(`\\b${color}\\b`, 'gi');
      normalized = normalized.replace(regex, ' ');
    }

    // 4. Remove extra terms
    const extras = ['renewed', 'refurbished', 'unlocked', 'cellular', 'wi-fi', 'wifi', '5g', '4g', 'lte'];
    for (const extra of extras) {
      const regex = new RegExp(`\\b${extra}\\b`, 'gi');
      normalized = normalized.replace(regex, ' ');
    }

    // 5. Keep only alphanumeric words and spaces
    normalized = normalized.replace(/[^a-z0-9]/g, ' ');

    // 6. Clean up multiple spaces and trim
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Check if a keyword and source pair has been synced recently (within configured days).
   */
  public static async isKeywordSyncedRecently(keyword: string, source: string): Promise<boolean> {
    const days = parseInt(process.env.CACHE_TTL_DAYS || '30', 10);
    let client;
    try {
      client = await db.getClient();
      const res = await client.query(
        `SELECT last_synced_at FROM keyword_sync_log 
         WHERE LOWER(keyword) = LOWER($1) AND LOWER(source) = LOWER($2) 
         AND last_synced_at > NOW() - ($3 || ' days')::INTERVAL`,
        [keyword.trim(), source, days]
      );
      return res.rows.length > 0;
    } catch (err: any) {
      console.error(`[Keyword Sync Log Check Error] ${err.message}`);
      return false;
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Record a successful sync for a keyword and source in the sync log.
   */
  public static async recordKeywordSync(keyword: string, source: string, resultCount: number): Promise<void> {
    let client;
    try {
      client = await db.getClient();
      await client.query(
        `INSERT INTO keyword_sync_log (keyword, source, last_synced_at, result_count)
         VALUES ($1, $2, NOW(), $3)
         ON CONFLICT (keyword, source) 
         DO UPDATE SET last_synced_at = NOW(), result_count = EXCLUDED.result_count`,
        [keyword.trim(), source, resultCount]
      );
      console.log(`[Keyword Sync Log] Recorded successful sync for "${keyword}" on source "${source}". Result count: ${resultCount}`);
    } catch (err: any) {
      console.error(`[Keyword Sync Log Record Error] ${err.message}`);
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Check if a keyword is budgeted in our scheduled rotation.
   */
  public static async isKeywordBudgeted(keyword: string): Promise<boolean> {
    let client;
    try {
      client = await db.getClient();
      const res = await client.query(
        'SELECT 1 FROM scheduled_keywords WHERE LOWER(keyword) = LOWER($1) LIMIT 1',
        [keyword.trim()]
      );
      return res.rows.length > 0;
    } catch (err: any) {
      console.error(`[Keyword Budget Check Error] ${err.message}`);
      return false;
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Update last_synced_at inside scheduled_keywords to track rotation progress.
   */
  public static async updateKeywordLastSyncedAt(keywords: string[]): Promise<void> {
    if (keywords.length === 0) return;
    let client;
    try {
      client = await db.getClient();
      await client.query(
        'UPDATE scheduled_keywords SET last_synced_at = NOW() WHERE keyword = ANY($1)',
        [keywords]
      );
      console.log(`[Scheduled Keywords] Updated last_synced_at for: ${keywords.join(', ')}`);
    } catch (err: any) {
      console.error(`[Scheduled Keywords Update Error] ${err.message}`);
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Helper function to insert or update product data into PostgreSQL database.
   * Leverages TRANSACTION and ACID-integrity properties.
   */
  public static async saveProductToPostgres(prod: ExternalProduct, dataSource: string = 'synthetic'): Promise<any> {
    if (prod.brand) prod.brand = prod.brand.substring(0, 99);
    if (prod.model_no) prod.model_no = prod.model_no.substring(0, 99);
    if (prod.name) prod.name = prod.name.substring(0, 250);

    let client;
    try {
      client = await db.getClient();
    } catch (err: any) {
      console.warn('[PostgreSQL Warn] Database connection down. Storing product in-memory only:', err.message);
      const parsed = NormalizationService.parseProductDetails(prod.name, prod.brand);
      return {
        product_id: Math.floor(Math.random() * 1000) + 100,
        name: prod.name,
        brand: parsed.brand,
        model_no: prod.model_no,
        slug: parsed.variantSlug,
        canonical_slug: parsed.canonicalSlug,
        storage_variant: parsed.storageVariant,
        color_variant: parsed.colorVariant,
        image_url: prod.image_url,
        description: `${prod.name} (In-Memory Fallback)`,
        specs_summary: prod.specs_summary,
        category_name: prod.category_name,
        data_source: dataSource,
        storesPricing: prod.offers.map((off, idx) => ({
          store_name: off.store_name,
          price: off.price,
          original_price: off.original_price,
          discount: off.original_price > off.price ? ((off.original_price - off.price) / off.original_price) * 100 : 0,
          product_url: off.product_url
        }))
      };
    }
    try {
      await client.query('BEGIN'); // Start Transaction

      // 1. Resolve Category Identifier (or seed standard category)
      const categorySlug = prod.category_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      let categoryId: number;

      const catCheck = await client.query(
        'SELECT category_id FROM categories WHERE slug = $1',
        [categorySlug]
      );

      if (catCheck.rows.length > 0) {
        categoryId = catCheck.rows[0].category_id;
      } else {
        const catInsert = await client.query(
          'INSERT INTO categories (name, slug, description) VALUES ($1, $2, $3) RETURNING category_id',
          [prod.category_name, categorySlug, `${prod.category_name} tech gadgets and electronic equipment.`]
        );
        categoryId = catInsert.rows[0].category_id;
      }

      // 2. Resolve Product Identifier (Upsert or Select on name/slug with normalizations)
      const parsed = NormalizationService.parseProductDetails(prod.name, prod.brand);
      const productSlug = parsed.variantSlug;
      const canonicalSlug = parsed.canonicalSlug;
      const storageVariant = parsed.storageVariant;
      const colorVariant = parsed.colorVariant;
      let productId: number;
      let isNew = false;

      const prodCheck = await client.query(
        `SELECT product_id, data_source FROM products 
         WHERE slug = $1 
            OR (canonical_slug = $2 AND storage_variant = $3 AND color_variant = $4)
            OR name ILIKE $5`,
        [productSlug, canonicalSlug, storageVariant, colorVariant, prod.name]
      );

      if (prodCheck.rows.length > 0) {
        productId = prodCheck.rows[0].product_id;
        const existingSource = prodCheck.rows[0].data_source;
        // Upgrade synthetic sources to live sources when live data comes in
        const finalSource = (dataSource && dataSource !== 'synthetic') ? dataSource : (existingSource || 'synthetic');
        
        // Optional: Update specifications summary / image_url and backfill missing normalization values
        await client.query(
          `UPDATE products 
           SET image_url = $1, specs_summary = $2, data_source = $3,
               canonical_slug = COALESCE(canonical_slug, $4),
               storage_variant = COALESCE(storage_variant, $5),
               color_variant = COALESCE(color_variant, $6)
           WHERE product_id = $7`,
          [prod.image_url, prod.specs_summary, finalSource, canonicalSlug, storageVariant, colorVariant, productId]
        );
      } else {
        isNew = true;
        const prodInsert = await client.query(
          `INSERT INTO products (category_id, name, brand, model_no, slug, canonical_slug, storage_variant, color_variant, image_url, description, specs_summary, release_date, data_source) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_DATE, $12) RETURNING product_id`,
          [categoryId, prod.name, parsed.brand, prod.model_no, productSlug, canonicalSlug, storageVariant, colorVariant, prod.image_url, `${prod.name} scrawled via active API.`, prod.specs_summary, dataSource]
        );
        productId = prodInsert.rows[0].product_id;
      }

      // 3. Insert and compare store pricing listings
      const processedPrices = [];
      for (const off of prod.offers) {
        // Resolve online store database reference
        const storeDomain = off.store_name.toLowerCase().replace(/[^a-z0-9]+/g, '') + '.com';
        let storeId: number;

        const storeCheck = await client.query(
          'SELECT store_id FROM stores WHERE name = $1 OR domain = $2',
          [off.store_name, storeDomain]
        );

        if (storeCheck.rows.length > 0) {
          storeId = storeCheck.rows[0].store_id;
        } else {
          const storeInsert = await client.query(
            `INSERT INTO stores (name, domain, logo_url, rating, api_enabled) 
             VALUES ($1, $2, $3, $4, TRUE) RETURNING store_id`,
            [off.store_name, storeDomain, 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=100', 4.5]
          );
          storeId = storeInsert.rows[0].store_id;
        }

        // Upsert current pricing snapshots
        await client.query(
          `INSERT INTO product_prices (product_id, store_id, price, original_price, product_url, is_available, last_scraped_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (product_id, store_id) 
           DO UPDATE SET 
             price = EXCLUDED.price, 
             original_price = EXCLUDED.original_price, 
             product_url = EXCLUDED.product_url,
             last_scraped_at = NOW()`,
          [productId, storeId, off.price, off.original_price, off.product_url, off.is_available]
        );

        // Also track price history log for analysis
        await client.query(
          `INSERT INTO price_history (product_id, store_id, price, recorded_at)
           VALUES ($1, $2, $3, NOW())`,
          [productId, storeId, off.price]
        ).catch(() => {
          // If the history table has slight structural differences or is locked, suppress history log error inside transaction
        });

        processedPrices.push({
          store_name: off.store_name,
          price: off.price,
          original_price: off.original_price,
          discount: off.original_price > off.price ? ((off.original_price - off.price) / off.original_price) * 100 : 0,
          product_url: off.product_url
        });
      }

      await client.query('COMMIT'); // Persist Transaction

      // Return unified detailed synced model
      const finalResult = await client.query(
        `SELECT p.*, c.name as category_name
         FROM products p
         JOIN categories c ON p.category_id = c.category_id
         WHERE p.product_id = $1`,
        [productId]
      );

      return {
        ...finalResult.rows[0],
        storesPricing: processedPrices,
        isNewProduct: isNew
      };
    } catch (err) {
      await client.query('ROLLBACK'); // Abort on error to prevent partial database pollution
      console.error('[Transaction Failed] Rollback executed:', err);
      return null;
    } finally {
      client.release(); // Return client to the pool
    }
  }

  /**
   * High-Fidelity local generator to create live, detailed comparisons for Indian eCommerce stores.
   * Guarantees amazing results when no API keys are loaded.
   */
  private static generateHighFidelityFallback(keyword: string): ExternalProduct[] {
    const term = keyword.toLowerCase();
    
    // Core item dictionary to provide exact smart electronic products
    let deviceName = keyword;
    let brand = 'General Tech';
    let modelNo = 'MX-2026';
    let imgUrl = 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=500';
    let specs = 'RAM: 8GB, Storage: 256GB, High power processing chip.';
    let category = 'Smartphones & Tablets';
    let msrp = 69999;

    if (term.includes('iphone')) {
      brand = 'Apple';
      deviceName = 'Apple iPhone 15 Pro Max';
      modelNo = 'A3106';
      imgUrl = 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=500';
      specs = 'RAM: 8GB, Storage: 512GB, Titanium alloy build, Apple A17 Pro Chipset, Display: 6.7" OLED';
      category = 'Smartphones & Tablets';
      msrp = 159900;
    } else if (term.includes('s24') || term.includes('samsung')) {
      brand = 'Samsung';
      deviceName = 'Samsung Galaxy S24 Ultra';
      modelNo = 'SM-S928U';
      imgUrl = 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500';
      specs = 'RAM: 12GB, Storage: 256GB, Titanium Gray frame, Snapdragon 8 Gen 3 processor, S-Pen Stylus';
      category = 'Smartphones & Tablets';
      msrp = 129999;
    } else if (term.includes('macbook') || term.includes('laptop')) {
      brand = 'Apple';
      deviceName = 'MacBook Air 15-inch M3';
      modelNo = 'A3114';
      imgUrl = 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500';
      specs = 'RAM: 16GB, Storage: 512GB, 8-Core CPU and 10-Core GPU, Fanless aluminum casing';
      category = 'Laptops & Desktops';
      msrp = 139900;
    } else if (term.includes('watch') || term.includes('wearable')) {
      brand = 'Apple';
      deviceName = 'Apple Watch Ultra 2';
      modelNo = 'A2986';
      imgUrl = 'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=500';
      specs = 'Storage: 64GB, GPS dual-frequency tracker, 3000-nits Retina screen, Active health monitors';
      category = 'Smart Wearables';
      msrp = 89900;
    } else if (term.includes('sony') || term.includes('headphone') || term.includes('audio')) {
      brand = 'Sony';
      deviceName = 'Sony WH-1000XM5 ANC Headset';
      modelNo = 'WH1000XM5';
      imgUrl = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500';
      specs = 'Active Noise Cancellation, Bluetooth 5.2, 30h battery, smart controls';
      category = 'Audio Equipment';
      msrp = 29990;
    }

    // Generate price arrays with genuine relative discounts for our 4 target Indian Stores
    // Amazon India is often cheapest, followed by Croma, etc.
    const amzPrice = Math.floor(msrp * 0.90);
    const flpPrice = Math.floor(msrp * 0.92);
    const croPrice = Math.floor(msrp * 0.94);
    const rldPrice = Math.floor(msrp * 0.91);

    const offers: ExternalOffer[] = [
      {
        store_name: 'Amazon India',
        price: amzPrice,
        original_price: msrp,
        product_url: `https://www.amazon.in/s?k=${encodeURIComponent(deviceName)}`,
        is_available: true
      },
      {
        store_name: 'Flipkart',
        price: flpPrice,
        original_price: msrp,
        product_url: `https://www.flipkart.com/search?q=${encodeURIComponent(deviceName)}`,
        is_available: true
      },
      {
        store_name: 'Croma',
        price: croPrice,
        original_price: msrp,
        product_url: `https://www.croma.com/search/?text=${encodeURIComponent(deviceName)}`,
        is_available: true
      },
      {
        store_name: 'Reliance Digital',
        price: rldPrice,
        original_price: msrp,
        product_url: `https://www.reliancedigital.in/search?q=${encodeURIComponent(deviceName)}`,
        is_available: true
      }
    ];

    return [
      {
        name: deviceName,
        brand,
        model_no: modelNo,
        image_url: imgUrl,
        specs_summary: specs,
        category_name: category,
        offers
      }
    ];
  }
}
