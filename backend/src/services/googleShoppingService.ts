import axios from 'axios';
import { RapidApiService, ExternalProduct, ExternalOffer } from './rapidApiService.ts';
import { QuotaTracker } from './quotaTracker.ts';

/**
 * Service to interface with Google Shopping Real-Time Product Search via RapidAPI
 */
export class GoogleShoppingService {
  private static get apiKey(): string {
    return process.env.RAPIDAPI_KEY || '';
  }
  private static get apiHost(): string {
    const host = process.env.GOOGLE_SHOPPING_API_HOST || '';
    const key = process.env.RAPIDAPI_KEY || '';
    if (!host || host === key || host.length === 50 || !host.includes('.')) {
      return 'real-time-product-search.p.rapidapi.com';
    }
    return host;
  }

  /**
   * Safe parser for prices which may contain currency symbols and formatting (e.g. ₹1,19,900 or $1,199.00)
   */
  private static parsePrice(val: any): number {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    // Remove currency symbols, commas, spaces and non-numeric characters except digits and dots
    const cleaned = String(val).replace(/[^\d.]/g, '');
    return parseFloat(cleaned) || 0;
  }

  /**
   * Search Google Shopping and sync products into the PostgreSQL database.
   */
  public static async searchAndSyncGoogleShopping(keyword: string, saveToDb: boolean = true, bypassCache: boolean = false, page: number = 1): Promise<any[]> {
    if (!keyword || keyword.trim().length === 0) {
      throw new Error('Search keyword is required.');
    }

    const trimmedKeyword = keyword.trim();
    console.log(`[Google Shopping] Initiating search for keyword: "${trimmedKeyword}"`);

    // 1. Intercept with local Postgres cache check FIRST
    if (saveToDb && !bypassCache) {
      const cached = await RapidApiService.checkLocalCache(trimmedKeyword);
      if (cached) {
        return cached;
      }
    }

    // 2. Check long-term 7-day sync log cache to conserve active credits
    const recentlySynced = bypassCache ? false : await RapidApiService.isKeywordSyncedRecently(trimmedKeyword, 'google');
    if (recentlySynced) {
      console.log(`[Keyword Sync Cache Hit] Google has already synced "${trimmedKeyword}" within 7 days. Retrieving stale/recent local products.`);
      const cached = await RapidApiService.checkLocalCache(trimmedKeyword, true);
      if (cached && cached.length > 0) {
        return cached;
      }
      console.log(`[Keyword Sync Cache Alert] No cache available despite sync log. Proceeding with fallback.`);
    }

    // 3. Check Budget & Quotas before executing external API calls
    const isBudgeted = await RapidApiService.isKeywordBudgeted(trimmedKeyword);
    const capExceeded = await QuotaTracker.isCapExceeded('google');
    const isConfigured = this.apiKey && 
                         this.apiKey !== 'your_rapidapi_application_key_here' &&
                         this.apiHost;

    if (false) {
      console.log(`[Keyword Budget] Keyword "${trimmedKeyword}" is not budgeted for live Google. Returning cached or synthetic source.`);
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
      console.log(`[Quota Tracker] Google Shopping monthly API limit reached. Returning cached or synthetic fallback.`);
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
      console.log(`[Google Shopping] API not fully configured. Returning cached or synthetic fallback.`);
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
      await QuotaTracker.recordCall('google');

      const headers = {
        'X-RapidAPI-Key': this.apiKey,
        'X-RapidAPI-Host': this.apiHost
      };

      // Increased limit to 40 to fetch maximum products per credit spent
      const response = await axios.get(`https://${this.apiHost}/search`, {
        headers,
        params: {
          q: trimmedKeyword,
          country: 'IN',
          currency: 'INR',
          page: page,
          limit: '40'
        },
        timeout: 10000
      });

      if (response.data && response.data.data) {
        const items = Array.isArray(response.data.data) 
          ? response.data.data 
          : (response.data.data.products || response.data.data.results || []);
        
        wasRealApiSuccess = items.length > 0;

        for (const item of items) {
          const rawOffers = item.offers || item.product_offers || [];
          const mappedOffers: ExternalOffer[] = [];

          if (Array.isArray(rawOffers) && rawOffers.length > 0) {
            for (const off of rawOffers) {
              const detectedCurrency = RapidApiService.getCurrency(off, item);
              const storeName = (off.store_name || off.merchant || off.seller || 'Google Shopping').trim();
              
              const rawPrice = this.parsePrice(off.price || off.price_raw || off.price_value);
              const rawOrigPrice = this.parsePrice(off.original_price || off.msrp || off.price || off.price_raw || off.price_value) || rawPrice;

              // Convert/normalize to INR
              const price = RapidApiService.convertToINR(rawPrice, detectedCurrency);
              const original_price = RapidApiService.convertToINR(rawOrigPrice, detectedCurrency);

              if (price > 0) {
                mappedOffers.push({
                  store_name: storeName,
                  price,
                  original_price,
                  product_url: off.product_url || off.offer_page_url || off.link || off.url || 'https://google.com/shopping',
                  is_available: off.is_available ?? true
                });
              }
            }
          }

          // Fallback to item direct pricing if no explicit offers array
          if (mappedOffers.length === 0 && (item.price || item.price_raw)) {
            const detectedCurrency = RapidApiService.getCurrency(item, item);
            const storeName = (item.store_name || item.merchant || item.seller || 'Google Shopping').trim();
            
            const rawPrice = this.parsePrice(item.price || item.price_raw);
            const rawOrigPrice = this.parsePrice(item.original_price || item.msrp || item.price || item.price_raw) || rawPrice;

            const price = RapidApiService.convertToINR(rawPrice, detectedCurrency);
            const original_price = RapidApiService.convertToINR(rawOrigPrice, detectedCurrency);

            if (price > 0) {
              mappedOffers.push({
                store_name: storeName,
                price,
                original_price,
                product_url: item.product_url || item.url || item.offer_page_url || item.link || 'https://google.com/shopping',
                is_available: item.is_available ?? true
              });
            }
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
              console.warn(`[Google Shopping Sanity Check] Price ₹${off.price} from "${off.store_name}" is below 30% of product median price ₹${medianPrice}. Flagged and excluded.`);
              continue;
            }
            sanitizedOffers.push(off);
          }

          if (sanitizedOffers.length > 0) {
            const productTitle = item.product_title || item.title || trimmedKeyword;
            const finalCategory = item.category || 'Smartphones & Tablets';

            // Apply relevance validation
            if (!RapidApiService.validateProductRelevance(trimmedKeyword, productTitle, finalCategory)) {
              console.warn(`[Relevance Filter] Rejecting "${productTitle}" as it appears to be an accessory/unrelated to "${trimmedKeyword}".`);
              continue; // Skip this product
            }

            const imageUrl = item.product_photo || item.image || item.image_url || item.imageUrl || (Array.isArray(item.product_photos) && item.product_photos.length > 0 ? item.product_photos[0] : null) || 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=400';
            const specsVal = item.specs_summary || item.description || item.product_description || `High quality electronic product mapped via Google Shopping API.`;

            productsList.push({
              name: productTitle,
              brand: item.brand || item.manufacturer || 'General Gadgets',
              model_no: item.model_no || item.product_id || item.asin || item.id || 'N/A',
              image_url: imageUrl,
              specs_summary: specsVal,
              category_name: item.category || 'Smartphones & Tablets',
              offers: sanitizedOffers
            });
          }
        }
      }
    } catch (err: any) {
      console.error(`[Google Shopping API Error] Request fell through: ${err.message}. Skipping Google Shopping source.`);
      productsList = [];
      wasRealApiSuccess = false;
    }

    if (!saveToDb) {
      return productsList as any[];
    }

    const syncedProducts = [];
    const finalSource = wasRealApiSuccess ? 'live_google' : 'synthetic';

    for (const prod of productsList) {
      const synced = await RapidApiService.saveProductToPostgres(prod, finalSource);
      if (synced) {
        syncedProducts.push(synced);
      }
    }

    // Record the keyword sync log on success
    if (wasRealApiSuccess) {
      await RapidApiService.recordKeywordSync(trimmedKeyword, 'google', productsList.length);
    }

    return syncedProducts;
  }

  /**
   * Mock fallback generator to simulate high-fidelity Google Shopping results in sandbox environments.
   */
  private static generateGoogleShoppingMockFallback(keyword: string): ExternalProduct[] {
    const term = keyword.toLowerCase();
    let deviceName = keyword;
    let brand = 'General Tech';
    let modelNo = 'GS-2026';
    let imgUrl = 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=500';
    let specs = 'High quality digital technology, standard warranty and specs.';
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

    const amzPrice = Math.floor(msrp * 0.89);
    const flpPrice = Math.floor(msrp * 0.91);
    const croPrice = Math.floor(msrp * 0.93);

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
