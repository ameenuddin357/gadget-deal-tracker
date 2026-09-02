import axios from 'axios';
import { RapidApiService, ExternalProduct, ExternalOffer } from './rapidApiService.ts';
import { QuotaTracker } from './quotaTracker.ts';

/**
 * Service to interface with Flipkart Search via RapidAPI
 */
export class FlipkartApiService {
  private static get apiKey(): string {
    return process.env.RAPIDAPI_KEY || '';
  }
  private static get apiHost(): string {
    const host = process.env.FLIPKART_API_HOST || '';
    const key = process.env.RAPIDAPI_KEY || '';
    if (!host || host === key || host.length === 50 || !host.includes('.') || host.includes('<flipkart-host-placeholder>')) {
      return 'flipkart-apis.p.rapidapi.com';
    }
    return host;
  }

  /**
   * Search Flipkart API and sync products into the PostgreSQL database.
   */
  public static async searchAndSyncFlipkart(keyword: string, saveToDb: boolean = true, bypassCache: boolean = false, page: number = 1): Promise<any[]> {
    if (!keyword || keyword.trim().length === 0) {
      throw new Error('Search keyword is required.');
    }

    const trimmedKeyword = keyword.trim();
    console.log(`[Flipkart API] Initiating search for keyword: "${trimmedKeyword}"`);

    // 1. Intercept with local Postgres cache check FIRST
    if (saveToDb && !bypassCache) {
      const cached = await RapidApiService.checkLocalCache(trimmedKeyword);
      if (cached) {
        return cached;
      }
    }

    // 2. Check long-term 7-day sync log cache to conserve active credits
    const recentlySynced = await RapidApiService.isKeywordSyncedRecently(trimmedKeyword, 'flipkart');
    if (recentlySynced) {
      console.log(`[Keyword Sync Cache Hit] Flipkart has already synced "${trimmedKeyword}" within 7 days. Retrieving stale/recent local products.`);
      const cached = await RapidApiService.checkLocalCache(trimmedKeyword, true);
      if (cached && cached.length > 0) {
        return cached;
      }
      console.log(`[Keyword Sync Cache Alert] No cache available despite sync log. Proceeding with fallback.`);
    }

    // 3. Check Budget & Quotas before executing external API calls
    const isBudgeted = await RapidApiService.isKeywordBudgeted(trimmedKeyword);
    const capExceeded = await QuotaTracker.isCapExceeded('flipkart');
    const isConfigured = this.apiKey && 
                         this.apiKey !== 'your_rapidapi_application_key_here' &&
                         this.apiHost && 
                         !this.apiHost.includes('<flipkart-host-placeholder>');

    if (false) {
      console.log(`[Keyword Budget] Keyword "${trimmedKeyword}" is not budgeted for live Flipkart. Returning cached or synthetic source.`);
      const staleCached = await RapidApiService.checkLocalCache(trimmedKeyword, true);
      if (staleCached && staleCached.length > 0) {
        return staleCached;
      }
      const fallbackList = [];
      if (!saveToDb) return fallbackList;
      const syncedProducts = [];
      for (const prod of fallbackList) {
        const synced = await RapidApiService.saveProductToPostgres(prod, 'synthetic');
        if (synced) syncedProducts.push(synced);
      }
      return syncedProducts;
    }

    if (capExceeded) {
      console.log(`[Quota Tracker] Flipkart monthly API limit reached. Returning cached or synthetic fallback.`);
      const staleCached = await RapidApiService.checkLocalCache(trimmedKeyword, true);
      if (staleCached && staleCached.length > 0) {
        return staleCached;
      }
      const fallbackList = [];
      if (!saveToDb) return fallbackList;
      const syncedProducts = [];
      for (const prod of fallbackList) {
        const synced = await RapidApiService.saveProductToPostgres(prod, 'synthetic');
        if (synced) syncedProducts.push(synced);
      }
      return syncedProducts;
    }

    if (!isConfigured) {
      console.log(`[Flipkart API] API not fully configured. Returning cached or synthetic fallback.`);
      const staleCached = await RapidApiService.checkLocalCache(trimmedKeyword, true);
      if (staleCached && staleCached.length > 0) {
        return staleCached;
      }
      const fallbackList = [];
      if (!saveToDb) return fallbackList;
      const syncedProducts = [];
      for (const prod of fallbackList) {
        const synced = await RapidApiService.saveProductToPostgres(prod, 'synthetic');
        if (synced) syncedProducts.push(synced);
      }
      return syncedProducts;
    }

    let productsList: ExternalProduct[] = [];
    let wasRealApiSuccess = false;

    try {
      // Record API call
      await QuotaTracker.recordCall('flipkart');

      const headers = {
        'X-RapidAPI-Key': this.apiKey,
        'X-RapidAPI-Host': this.apiHost
      };

      console.log(`[DEBUG Flipkart Request] URL: https://${this.apiHost}/product-search, Host Header: ${headers['X-RapidAPI-Host']}`);

      // Set max limit of 40 to optimize results per call
      const response = await axios.get(`https://${this.apiHost}/product-search`, {
        headers,
        params: {
          q: trimmedKeyword,
          limit: '40',
          page: page
        },
        timeout: 10000
      });

      if (response.data && response.data.data) {
        const items = Array.isArray(response.data.data) 
          ? response.data.data 
          : (response.data.data.products || response.data.data.results || []);

        wasRealApiSuccess = items.length > 0;

        for (const item of items) {
          const mappedOffers: ExternalOffer[] = [];

          // Read currency and properties directly from item using exact fields
          const detectedCurrency = RapidApiService.getCurrency(item, item);
          const storeName = (item.store_name || item.seller || item.merchant || 'Flipkart').trim();
          
          const rawPrice = parseFloat(item.price || item.selling_price || item.current_price || item.price_raw) || 0;
          const rawOrigPrice = parseFloat(item.mrp || item.original_price || item.list_price || item.price_before_discount || item.price) || rawPrice;

          // Convert to INR
          const price = RapidApiService.convertToINR(rawPrice, detectedCurrency);
          const original_price = RapidApiService.convertToINR(rawOrigPrice, detectedCurrency);
          const productUrl = item.url || item.product_url || item.link || 'https://flipkart.com';

          if (price > 0) {
            mappedOffers.push({
              store_name: storeName,
              price,
              original_price,
              product_url: productUrl,
              is_available: item.is_available ?? true
            });
          }

          // Apply standard sanity filter: ignore prices under 30% of median price
          const validPrices = mappedOffers.map(o => o.price).filter(p => p > 0);
          const sortedPrices = [...validPrices].sort((a, b) => a - b);
          let medianPrice = 0;
          if (sortedPrices.length > 0) {
            const half = Math.floor(sortedPrices.length / 2);
            medianPrice = sortedPrices.length % 2 !== 0 
              ? sortedPrices[half] 
              : (sortedPrices[half - 1] + sortedPrices[half]) / 2.0;
          }

          const sanitizedOffers: ExternalOffer[] = [];
          for (const off of mappedOffers) {
            if (medianPrice > 0 && off.price < 0.3 * medianPrice) {
              console.warn(`[Flipkart Sanity Check] Price ₹${off.price} from "${off.store_name}" is below 30% of product median price ₹${medianPrice}. Flagged and excluded.`);
              continue;
            }
            sanitizedOffers.push(off);
          }

          if (sanitizedOffers.length > 0) {
            const finalName = item.title || item.product_title || trimmedKeyword;
            const finalCategory = item.category || 'Smartphones & Tablets';

            // Apply relevance validation
            if (!RapidApiService.validateProductRelevance(trimmedKeyword, finalName, finalCategory)) {
              console.warn(`[Relevance Filter] Rejecting "${finalName}" as it appears to be an accessory/unrelated to "${trimmedKeyword}".`);
              continue; // Skip this product
            }

            productsList.push({
              name: finalName,
              brand: item.brand || item.manufacturer || 'General Gadgets',
              model_no: item.model_no || item.product_id || item.id || 'N/A',
              image_url: item.image || item.image_url || item.imageUrl || item.product_photo || 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400',
              specs_summary: item.specs_summary || item.description || item.product_description || `High quality electronic product mapped via Flipkart API.`,
              category_name: item.category || 'Smartphones & Tablets',
              offers: sanitizedOffers
            });
          }
        }
      }
    } catch (err: any) {
      console.error(`[Flipkart API Error] Request fell through: ${err.message}. Skipping Flipkart source.`);
      productsList = [];
      wasRealApiSuccess = false;
    }

    if (!saveToDb) {
      return productsList as any[];
    }

    const syncedProducts = [];
    const finalSource = wasRealApiSuccess ? 'live_flipkart' : 'synthetic';

    for (const prod of productsList) {
      const synced = await RapidApiService.saveProductToPostgres(prod, finalSource);
      if (synced) {
        syncedProducts.push(synced);
      }
    }

    // Record successful sync log
    if (wasRealApiSuccess) {
      await RapidApiService.recordKeywordSync(trimmedKeyword, 'flipkart', productsList.length);
    }

    return syncedProducts;
  }

  /**
   * Mock fallback generator to simulate high-fidelity Flipkart results.
   */
  private static generateFlipkartMockFallback(keyword: string): ExternalProduct[] {
    const term = keyword.toLowerCase();
    let deviceName = keyword;
    let brand = 'General Tech';
    let modelNo = 'FK-2026';
    let imgUrl = 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=500';
    let specs = 'High quality digital technology, standard warranty and specs mapped via Flipkart API.';
    let category = 'Smartphones & Tablets';
    let msrp = 54999;

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
    }

    const flpPrice = Math.floor(msrp * 0.88); // Flipkart competitive price

    const offers: ExternalOffer[] = [
      {
        store_name: 'Flipkart',
        price: flpPrice,
        original_price: msrp,
        product_url: `https://www.flipkart.com/search?q=${encodeURIComponent(deviceName)}`,
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
