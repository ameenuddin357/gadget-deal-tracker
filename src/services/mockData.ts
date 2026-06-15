import { Product, StorePricing, WatchlistEntry, PriceAlert } from '../types/frontend';

// Standard Initial Gadget Database Model representing physical placement catalog
export const INITIAL_PRODUCTS: Product[] = [
  {
    product_id: 1,
    name: "MacBook Pro 14-inch M3",
    brand: "Apple",
    model_no: "MRX33HN/A",
    slug: "macbook-pro-14-m3",
    image_url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80",
    specs_summary: "M3 chip, 8-Core CPU, 10-Core GPU, 8GB unified memory, 512GB SSD Storage, Liquid Retina XDR screen.",
    category_name: "Laptops"
  },
  {
    product_id: 2,
    name: "iPhone 15 Pro Max",
    brand: "Apple",
    model_no: "MU773HN/A",
    slug: "iphone-15-pro-max",
    image_url: "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=600&q=80",
    specs_summary: "A17 Pro chip, Titanium alloy design, 6.7-inch Super Retina XDR display, 5x Telephoto Optical zoom camera.",
    category_name: "Smartphones"
  },
  {
    product_id: 3,
    name: "iPad Air 11-inch M2",
    brand: "Apple",
    model_no: "MV213HN/A",
    slug: "ipad-air-m2",
    image_url: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=600&q=80",
    specs_summary: "M2 Apple processor, Liquid Retina IPS display, compatible with Apple Pencil Pro/Magic Keyboard, 128GB.",
    category_name: "Tablets"
  },
  {
    product_id: 4,
    name: "Sony WH-1000XM5 ANC",
    brand: "Sony",
    model_no: "WH1000XM5/B",
    slug: "sony-wh-1000xm5",
    image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
    specs_summary: "Industry-leading Active Noise Cancellation headphones, Auto NC Optimizer, 30-hour runtime battery life, Crisp calls.",
    category_name: "Audio"
  },
  {
    product_id: 5,
    name: "Dell XPS 13 OLED 9340",
    brand: "Dell",
    model_no: "XPS9340-INR",
    slug: "dell-xps-13-9340",
    image_url: "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=600&q=80",
    specs_summary: "Intel Core Ultra 7 processor, 13.4-inch OLED touch display, 16GB LPDDR5X RAM, 1TB high-speed NVMe PCIe SSD.",
    category_name: "Laptops"
  },
  {
    product_id: 6,
    name: "Samsung Galaxy S24 Ultra",
    brand: "Samsung",
    model_no: "SM-S928UZKEXIN",
    slug: "samsung-galaxy-s24-ultra",
    image_url: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=600&q=80",
    specs_summary: "Snapdragon 8 Gen 3, S-Pen included, titanium finish frame, 200MP camera setup, 120Hz AMOLED 2X display.",
    category_name: "Smartphones"
  },
  {
    product_id: 7,
    name: "Samsung Galaxy Watch 6 Pro",
    brand: "Samsung",
    model_no: "SM-R960NZKAXIN",
    slug: "galaxy-watch-6-pro",
    image_url: "https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?auto=format&fit=crop&w=600&q=80",
    specs_summary: "Classic rotating bezel, LTE connectivity, body composition scanner, advanced ECG sleep tracker, dual physical buttons.",
    category_name: "Smart Wearables"
  }
];

// Seeded active store pricings in Indian Rupees (INR) across the specified 4 stores
export const INITIAL_PRICES: Record<number, StorePricing[]> = {
  1: [ // MacBook Pro
    { price_id: 101, price: 144900, original_price: 169900, discount: 25000, product_url: "https://amazon.in/dp/B0CM5N6X1A", is_available: true, last_scraped_at: "2026-06-12T05:12:00Z", store_name: "Amazon India", store_rating: 4.8 },
    { price_id: 102, price: 139900, original_price: 169900, discount: 30000, product_url: "https://flipkart.com/macbook-pro", is_available: true, last_scraped_at: "2026-06-12T04:22:00Z", store_name: "Flipkart", store_rating: 4.5 },
    { price_id: 103, price: 146900, original_price: 169900, discount: 23000, product_url: "https://croma.com/macbook-pro", is_available: true, last_scraped_at: "2026-06-11T23:44:00Z", store_name: "Croma", store_rating: 4.3 },
    { price_id: 104, price: 142900, original_price: 169900, discount: 27000, product_url: "https://reliancedigital.in/macbook-pro", is_available: true, last_scraped_at: "2026-06-12T02:00:00Z", store_name: "Reliance Digital", store_rating: 4.4 }
  ],
  2: [ // iPhone
    { price_id: 201, price: 148900, original_price: 159900, discount: 11000, product_url: "https://amazon.in/dp/B0CMPR78", is_available: true, last_scraped_at: "2026-06-12T06:01:00Z", store_name: "Amazon India", store_rating: 4.8 },
    { price_id: 202, price: 144900, original_price: 159900, discount: 15000, product_url: "https://flipkart.com/iphone-15-pro-max", is_available: true, last_scraped_at: "2026-06-12T01:30:00Z", store_name: "Flipkart", store_rating: 4.5 },
    { price_id: 203, price: 146900, original_price: 159900, discount: 13000, product_url: "https://reliancedigital.in/iphone-15", is_available: true, last_scraped_at: "2026-06-12T01:10:00Z", store_name: "Reliance Digital", store_rating: 4.4 }
  ],
  3: [ // iPad Air
    { price_id: 301, price: 54900, original_price: 59900, discount: 5000, product_url: "https://amazon.in/dp/B0CMPR99", is_available: true, last_scraped_at: "2026-06-12T05:30:00Z", store_name: "Amazon India", store_rating: 4.8 },
    { price_id: 302, price: 53900, original_price: 59900, discount: 6000, product_url: "https://flipkart.com/ipad-air-m2", is_available: true, last_scraped_at: "2026-06-12T04:15:00Z", store_name: "Flipkart", store_rating: 4.5 },
    { price_id: 303, price: 55900, original_price: 59900, discount: 4000, product_url: "https://croma.com/ipad-air", is_available: true, last_scraped_at: "2026-06-12T02:00:00Z", store_name: "Croma", store_rating: 4.3 }
  ],
  4: [ // Sony ANC Headphones
    { price_id: 401, price: 26900, original_price: 34900, discount: 8000, product_url: "https://amazon.in/dp/B09XSDJ3", is_available: true, last_scraped_at: "2026-06-12T06:45:00Z", store_name: "Amazon India", store_rating: 4.8 },
    { price_id: 402, price: 25900, original_price: 34900, discount: 9000, product_url: "https://flipkart.com/sony-headphones-xm5", is_available: true, last_scraped_at: "2026-06-12T05:22:00Z", store_name: "Flipkart", store_rating: 4.5 },
    { price_id: 403, price: 27500, original_price: 34900, discount: 7400, product_url: "https://croma.com/sony-headphones", is_available: true, last_scraped_at: "2026-06-12T03:10:00Z", store_name: "Croma", store_rating: 4.3 },
    { price_id: 404, price: 26499, original_price: 34900, discount: 8401, product_url: "https://reliancedigital.in/sony-xm5", is_available: true, last_scraped_at: "2026-06-12T03:50:00Z", store_name: "Reliance Digital", store_rating: 4.4 }
  ],
  5: [ // Dell XPS 13
    { price_id: 501, price: 139900, original_price: 149900, discount: 10000, product_url: "https://croma.com/dell-xps-13", is_available: true, last_scraped_at: "2026-06-12T04:55:00Z", store_name: "Croma", store_rating: 4.3 },
    { price_id: 502, price: 134900, original_price: 149900, discount: 15000, product_url: "https://amazon.in/dp/B0D1XPX3", is_available: true, last_scraped_at: "2026-06-12T01:10:00Z", store_name: "Amazon India", store_rating: 4.8 },
    { price_id: 503, price: 136900, original_price: 149900, discount: 13000, product_url: "https://reliancedigital.in/dell-xps", is_available: true, last_scraped_at: "2026-06-12T03:00:00Z", store_name: "Reliance Digital", store_rating: 4.4 }
  ],
  6: [ // Galaxy S24 Ultra
    { price_id: 601, price: 119900, original_price: 129900, discount: 10000, product_url: "https://amazon.in/dp/B0D5S24U1", is_available: true, last_scraped_at: "2026-06-12T06:50:00Z", store_name: "Amazon India", store_rating: 4.8 },
    { price_id: 602, price: 118900, original_price: 129900, discount: 11000, product_url: "https://flipkart.com/galaxy-s24-ultra", is_available: true, last_scraped_at: "2026-06-12T03:40:00Z", store_name: "Flipkart", store_rating: 4.5 },
    { price_id: 603, price: 121900, original_price: 129900, discount: 8000, product_url: "https://reliancedigital.in/s24-ultra", is_available: true, last_scraped_at: "2026-06-11T20:55:00Z", store_name: "Reliance Digital", store_rating: 4.4 }
  ],
  7: [ // Galaxy Watch 6 classic
    { price_id: 701, price: 29900, original_price: 34900, discount: 5000, product_url: "https://amazon.in/dp/B0CSGW6C", is_available: true, last_scraped_at: "2026-06-12T06:55:00Z", store_name: "Amazon India", store_rating: 4.8 },
    { price_id: 702, price: 28900, original_price: 34900, discount: 6000, product_url: "https://flipkart.com/galaxy-watch-6-pro", is_available: true, last_scraped_at: "2026-06-12T02:15:00Z", store_name: "Flipkart", store_rating: 4.5 }
  ]
};

// Simulated historical price trends over the last 7 days for each product
export interface HistoricalPrice {
  productId: number;
  date: string;
  price: number;
  storeName: string;
}

export const generateSeededPriceHistory = (): HistoricalPrice[] => {
  const history: HistoricalPrice[] = [];
  const days = 7;
  
  INITIAL_PRODUCTS.forEach(product => {
    const listPr = INITIAL_PRICES[product.product_id] || [];
    if (listPr.length === 0) return;
    
    // Pick the cheapest base price
    const minItem = listPr.reduce((min, cur) => cur.price < min.price ? cur : min, listPr[0]);
    let currentPrice = minItem.price;

    for (let i = days; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      // Simulate slight realistic daily fluctuations of +/- 2%
      const fluctuation = 1 + (Math.sin(product.product_id + i * 1.5) * 0.02);
      history.push({
        productId: product.product_id,
        date: dateStr,
        price: Math.round(currentPrice * fluctuation),
        storeName: minItem.store_name
      });
    }
  });
  
  return history;
};

// Initial state initialization for offline client fallback DB
export const initializeLocalStorageDB = () => {
  if (!localStorage.getItem('deal_products')) {
    localStorage.setItem('deal_products', JSON.stringify(INITIAL_PRODUCTS));
  }
  if (!localStorage.getItem('deal_prices')) {
    localStorage.setItem('deal_prices', JSON.stringify(INITIAL_PRICES));
  }
  if (!localStorage.getItem('deal_watchlist')) {
    localStorage.setItem('deal_watchlist', JSON.stringify([]));
  }
  if (!localStorage.getItem('deal_alerts')) {
    localStorage.setItem('deal_alerts', JSON.stringify([]));
  }
  if (!localStorage.getItem('deal_users')) {
    localStorage.setItem('deal_users', JSON.stringify([
      { userId: 999, username: "admin", email: "admin@dealtracker.in", password: "password123", role: "admin" }
    ]));
  }
  if (!localStorage.getItem('deal_price_history')) {
    localStorage.setItem('deal_price_history', JSON.stringify(generateSeededPriceHistory()));
  }
};

// Seed db instantly upon import load
initializeLocalStorageDB();

export const getDBProducts = (): Product[] => {
  const products: Product[] = JSON.parse(localStorage.getItem('deal_products') || '[]');
  const prices: Record<number, StorePricing[]> = JSON.parse(localStorage.getItem('deal_prices') || '{}');
  
  return products.map(p => {
    const listPr = prices[p.product_id] || [];
    const availablePrices = listPr.filter(item => item.is_available);
    const cheapest = availablePrices.reduce((min, cur) => cur.price < min.price ? cur : min, availablePrices[0] || { price: 0, store_name: "None" });
    
    return {
      ...p,
      cheapest_price: cheapest ? cheapest.price : undefined,
      store_name: cheapest ? cheapest.store_name : undefined
    };
  });
};

export const getDBProductById = (id: number): { product: Product; storesPricing: StorePricing[] } | null => {
  const products: Product[] = JSON.parse(localStorage.getItem('deal_products') || '[]');
  const prices: Record<number, StorePricing[]> = JSON.parse(localStorage.getItem('deal_prices') || '{}');

  const product = products.find(p => p.product_id === id);
  if (!product) return null;

  const storesPricing = prices[id] || [];
  return { product, storesPricing };
};

export const getDBWatchlist = (userId: number): WatchlistEntry[] => {
  const list: any[] = JSON.parse(localStorage.getItem('deal_watchlist') || '[]');
  const products = getDBProducts();

  return list
    .filter(item => item.user_id === userId)
    .map(item => {
      const p = products.find(x => x.product_id === item.product_id);
      return {
        watchlist_id: item.watchlist_id,
        added_at: item.added_at,
        product_id: item.product_id,
        product_name: p?.name || 'Unknown Item',
        brand: p?.brand || '',
        specs_summary: p?.specs_summary || '',
        image_url: p?.image_url || '',
        lowest_live_price: p?.cheapest_price,
        purchase_outlet: p?.store_name
      };
    });
};

export const addToDBWatchlist = (userId: number, productId: number): WatchlistEntry => {
  const list: any[] = JSON.parse(localStorage.getItem('deal_watchlist') || '[]');
  
  const existing = list.find(x => x.user_id === userId && x.product_id === productId);
  if (existing) {
    throw new Error('This gadget is already on your watchlist catalog.');
  }

  const newEntry = {
    watchlist_id: Math.floor(Math.random() * 1000000),
    user_id: userId,
    product_id: productId,
    added_at: new Date().toISOString()
  };

  list.push(newEntry);
  localStorage.setItem('deal_watchlist', JSON.stringify(list));

  const p = getDBProducts().find(x => x.product_id === productId);
  return {
    watchlist_id: newEntry.watchlist_id,
    added_at: newEntry.added_at,
    product_id: productId,
    product_name: p?.name || 'Unknown Item',
    brand: p?.brand || '',
    specs_summary: p?.specs_summary || '',
    image_url: p?.image_url || '',
    lowest_live_price: p?.cheapest_price,
    purchase_outlet: p?.store_name
  };
};

export const removeFromDBWatchlist = (userId: number, watchlistId: number): void => {
  let list: any[] = JSON.parse(localStorage.getItem('deal_watchlist') || '[]');
  list = list.filter(item => !(item.watchlist_id === watchlistId && item.user_id === userId));
  localStorage.setItem('deal_watchlist', JSON.stringify(list));
};

export const getDBAlerts = (userId: number): PriceAlert[] => {
  const list: any[] = JSON.parse(localStorage.getItem('deal_alerts') || '[]');
  const products = getDBProducts();

  return list
    .filter(item => item.user_id === userId)
    .map(item => {
      const p = products.find(x => x.product_id === item.product_id);
      return {
        alert_id: item.alert_id,
        target_price: item.target_price,
        is_active: item.is_active,
        alert_sent: item.alert_sent,
        created_at: item.created_at,
        product_id: item.product_id,
        product_name: p?.name || 'Unknown Item',
        brand: p?.brand || '',
        image_url: p?.image_url || '',
        lowest_live_price: p?.cheapest_price
      };
    });
};

export const createDBAlert = (userId: number, productId: number, targetPrice: number): PriceAlert => {
  const list: any[] = JSON.parse(localStorage.getItem('deal_alerts') || '[]');

  const newAlert = {
    alert_id: Math.floor(Math.random() * 1000000),
    user_id: userId,
    product_id: productId,
    target_price: targetPrice,
    is_active: true,
    alert_sent: false,
    created_at: new Date().toISOString()
  };

  list.push(newAlert);
  localStorage.setItem('deal_alerts', JSON.stringify(list));

  const p = getDBProducts().find(x => x.product_id === productId);
  return {
    alert_id: newAlert.alert_id,
    target_price: targetPrice,
    is_active: true,
    alert_sent: false,
    created_at: newAlert.created_at,
    product_id: productId,
    product_name: p?.name || 'Unknown Item',
    brand: p?.brand || '',
    image_url: p?.image_url || '',
    lowest_live_price: p?.cheapest_price
  };
};

export const deleteDBAlert = (userId: number, alertId: number): void => {
  let list: any[] = JSON.parse(localStorage.getItem('deal_alerts') || '[]');
  list = list.filter(item => !(item.alert_id === alertId && item.user_id === userId));
  localStorage.setItem('deal_alerts', JSON.stringify(list));
};

// Retrieve price history records for charts
export const getDBPriceHistory = (productId: number): HistoricalPrice[] => {
  const log: HistoricalPrice[] = JSON.parse(localStorage.getItem('deal_price_history') || '[]');
  return log.filter(item => item.productId === productId).sort((a,b) => a.date.localeCompare(b.date));
};

/**
 * 6-Hour Scheduled Scraper Simulator
 * Modifies store prices dynamically by +/- 5% to model active crawl runs,
 * logs price alterations in the price history index, and cross-checks active
 * user Price Alerts to dispatch notifications if any lower thresholds are crossed.
 */
export const runSixHourPriceScheduler = (): { updatedCount: number; alertsTriggeredCount: number; triggers: any[] } => {
  const prices: Record<number, StorePricing[]> = JSON.parse(localStorage.getItem('deal_prices') || '{}');
  const history: HistoricalPrice[] = JSON.parse(localStorage.getItem('deal_price_history') || '[]');
  const alerts: any[] = JSON.parse(localStorage.getItem('deal_alerts') || '[]');
  
  let updatedCount = 0;
  const todayStr = new Date().toISOString().split('T')[0];

  Object.keys(prices).forEach(key => {
    const prodId = parseInt(key, 10);
    const storePricings = prices[prodId] || [];
    
    storePricings.forEach(pricing => {
      // Shift price within +/- 5%
      const multiplier = 0.95 + (Math.random() * 0.1);
      const originalPrice = pricing.original_price || (pricing.price * 1.1);
      const newPrice = Math.round(pricing.price * multiplier);
      
      // Keep within realistic parameters (price <= originalPrice)
      if (newPrice < originalPrice) {
        pricing.price = newPrice;
        pricing.discount = originalPrice - newPrice;
      }
      pricing.last_scraped_at = new Date().toISOString();
      updatedCount++;
    });
    
    // Save cheapest into history for visual graphs
    const cheapestItem = storePricings.reduce((min, cur) => cur.price < min.price ? cur : min, storePricings[0]);
    if (cheapestItem) {
      // Avoid duplicated dates for today's run — overwrite or append
      const existingHistIdx = history.findIndex(h => h.productId === prodId && h.date === todayStr);
      if (existingHistIdx >= 0) {
        history[existingHistIdx].price = cheapestItem.price;
        history[existingHistIdx].storeName = cheapestItem.store_name;
      } else {
        history.push({
          productId: prodId,
          date: todayStr,
          price: cheapestItem.price,
          storeName: cheapestItem.store_name
        });
      }
    }
  });

  // Save changes to LocalStorage
  localStorage.setItem('deal_prices', JSON.stringify(prices));
  localStorage.setItem('deal_price_history', JSON.stringify(history));

  // Re-fetch products with updated prices
  const products = getDBProducts();

  // Evaluate alerts
  let alertsTriggeredCount = 0;
  const triggeredLogs: any[] = [];

  alerts.forEach(alert => {
    if (alert.is_active && !alert.alert_sent) {
      const p = products.find(x => x.product_id === alert.product_id);
      if (p && p.cheapest_price !== undefined && p.cheapest_price <= alert.target_price) {
        alert.alert_sent = true;
        alertsTriggeredCount++;
        triggeredLogs.push({
          alert_id: alert.alert_id,
          product_name: p.name,
          target_price: alert.target_price,
          current_price: p.cheapest_price,
          store_name: p.store_name
        });
      }
    }
  });

  if (alertsTriggeredCount > 0) {
    localStorage.setItem('deal_alerts', JSON.stringify(alerts));
  }

  return {
    updatedCount,
    alertsTriggeredCount,
    triggers: triggeredLogs
  };
};
