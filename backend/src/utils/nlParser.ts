// Phase 3A.1A: Strictly deterministic, local regex-based query parsing for zero-cost catalogue search.
// Gemini AI is preserved exclusively for authenticated AI Recommendation & AI Chat endpoints.

export interface ParsedQuery {
  originalQuery: string;
  keywords: string;
  category: string | null;
  productType: string | null;
  minPrice: number | null;
  maxPrice: number | null;
}

const queryCache = new Map<string, ParsedQuery>();

const VALID_CATEGORIES = [
  'Laptops & Desktops',
  'Smartphones & Tablets',
  'Audio Equipment',
  'Smart Wearables'
];

export function parseAmount(numStr: string, unitStr?: string): number | null {
  if (!numStr) return null;
  const cleanNum = numStr.replace(/[^0-9.]/g, '');
  const val = parseFloat(cleanNum);
  if (isNaN(val)) return null;

  const unit = (unitStr || '').toLowerCase().trim();
  if (['lakh', 'lacs', 'lac', 'l'].includes(unit)) {
    return Math.round(val * 100000);
  } else if (['k', 'thousand'].includes(unit)) {
    return Math.round(val * 1000);
  }
  return Math.round(val);
}

export function deterministicParse(query: string): ParsedQuery {
  if (!query || typeof query !== 'string') {
    return { originalQuery: '', keywords: '', category: null, productType: null, minPrice: null, maxPrice: null };
  }

  const orig = query.trim();
  let q = orig.toLowerCase();

  let minPrice: number | null = null;
  let maxPrice: number | null = null;
  let category: string | null = null;
  let productType: string | null = null;

  // 1. Range match e.g. "between 20000 and 40000" or "between 20k and 40k" or "from 20000 to 40000"
  const rangeRegex = /(?:between|from)\s+(?:rs\.?|inr|₹)?\s*([0-9.,]+)\s*(lakh|lacs|lac|l|k|thousand)?\s+(?:and|to|-)\s+(?:rs\.?|inr|₹)?\s*([0-9.,]+)\s*(lakh|lacs|lac|l|k|thousand)?/i;
  const rangeMatch = q.match(rangeRegex);
  if (rangeMatch) {
    minPrice = parseAmount(rangeMatch[1], rangeMatch[2]);
    maxPrice = parseAmount(rangeMatch[3], rangeMatch[4]);
    q = q.replace(rangeMatch[0], ' ').trim();
  } else {
    // 2. Max price match e.g. "under 1.3 lakh", "below 30000", "upto 50k", "under ₹50000"
    const maxRegex = /(?:under|below|less than|upto|up to|within|max|budget|cheap)\s+(?:rs\.?|inr|₹)?\s*([0-9.,]+)\s*(lakh|lacs|lac|l|k|thousand)?/i;
    const maxMatch = q.match(maxRegex);
    if (maxMatch) {
      maxPrice = parseAmount(maxMatch[1], maxMatch[2]);
      q = q.replace(maxMatch[0], ' ').trim();
    }

    // 3. Min price match e.g. "above 5000", "over 20k", "more than 1 lakh"
    const minRegex = /(?:above|more than|over|min|starting|from)\s+(?:rs\.?|inr|₹)?\s*([0-9.,]+)\s*(lakh|lacs|lac|l|k|thousand)?/i;
    const minMatch = q.match(minRegex);
    if (minMatch) {
      minPrice = parseAmount(minMatch[1], minMatch[2]);
      q = q.replace(minMatch[0], ' ').trim();
    }
  }

  // 4. Explicit Product Type & Category Mapping
  const fullQ = orig.toLowerCase();
  if (/\b(gaming laptop|gaming laptops|laptop|laptops|notebook|notebooks|macbook|macbooks|chromebook|chromebooks)\b/i.test(fullQ)) {
    productType = 'Laptops';
    category = 'Laptops & Desktops';
  } else if (/\b(monitor|monitors|display|displays|curved screen|ultrawide)\b/i.test(fullQ)) {
    productType = 'Monitors';
    category = 'Laptops & Desktops';
  } else if (/\b(android phones|android phone|iphone|iphones|smartphone|smartphones|phone|phones|mobile|mobiles)\b/i.test(fullQ)) {
    productType = 'Phones';
    category = 'Smartphones & Tablets';
  } else if (/\b(tablet|tablets|ipad|ipads)\b/i.test(fullQ)) {
    productType = 'Tablets';
    category = 'Smartphones & Tablets';
  } else if (/\b(smartwatch|smart watch|smartwatches|fitness band|galaxy fit|galaxy watch|wearable|wearables)\b/i.test(fullQ)) {
    productType = 'Smartwatches';
    category = 'Smart Wearables';
  } else if (/\b(headphone|headphones|earbuds|earphones|earphone|headset|headsets)\b/i.test(fullQ)) {
    productType = 'Headphones';
    category = 'Audio Equipment';
  } else if (/\b(television|televisions|tv|tvs)\b/i.test(fullQ)) {
    productType = 'Televisions';
    category = 'Televisions';
  } else if (/\b(desktop|desktops)\b/i.test(fullQ)) {
    category = 'Laptops & Desktops';
  } else if (/\b(audio|speaker|speakers|soundbar|soundbars|anc)\b/i.test(fullQ)) {
    category = 'Audio Equipment';
  } else if (/\b(watch|watches)\b/i.test(fullQ)) {
    category = 'Smart Wearables';
  }

  // 5. Keyword Cleaning
  let keywords = q;
  if (category || productType) {
    const genericCatWords = [
      'android', 'phones', 'phone', 'mobiles', 'mobile', 'smartphones', 'smartphone', 'tablets', 'tablet',
      'laptops', 'laptop', 'notebooks', 'notebook', 'desktops', 'desktop',
      'monitors', 'monitor', 'displays', 'display',
      'headphones', 'headphone', 'earbuds', 'earphones', 'earphone', 'headsets', 'headset', 'speakers', 'speaker',
      'smartwatch', 'smartwatches', 'wearables', 'wearable'
    ];
    const words = keywords.split(/\s+/).filter(Boolean);
    const filtered = words.filter(w => !genericCatWords.includes(w.toLowerCase()));
    keywords = filtered.join(' ');
  }

  return {
    originalQuery: orig,
    keywords: keywords.trim(),
    category,
    productType,
    minPrice,
    maxPrice
  };
}

export async function parseNaturalLanguageQuery(query: string): Promise<ParsedQuery> {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return { originalQuery: '', keywords: '', category: null, productType: null, minPrice: null, maxPrice: null };
  }

  const cleanQuery = query.trim();
  const cacheKey = cleanQuery.toLowerCase();

  if (queryCache.has(cacheKey)) {
    return queryCache.get(cacheKey)!;
  }

  // Phase 3A.1A: Always use fast, zero-cost deterministic local parsing for public catalog search.
  // Gemini AI is strictly reserved for authenticated AI Recommendation and AI Chat features.
  const result = deterministicParse(cleanQuery);
  queryCache.set(cacheKey, result);
  return result;
}
