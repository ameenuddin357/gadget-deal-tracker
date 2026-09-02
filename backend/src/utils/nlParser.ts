import { GoogleGenAI, Type } from '@google/genai';
import { generateContentWithModelFallback } from './geminiHelper.ts';

export interface ParsedQuery {
  originalQuery: string;
  keywords: string;
  category: string | null;
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
    return { originalQuery: '', keywords: '', category: null, minPrice: null, maxPrice: null };
  }

  const orig = query.trim();
  let q = orig.toLowerCase();

  let minPrice: number | null = null;
  let maxPrice: number | null = null;
  let category: string | null = null;

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

  // 4. Category Mapping
  const fullQ = orig.toLowerCase();
  if (/\b(galaxy watch)\b/i.test(fullQ)) {
    category = 'Smart Wearables';
  } else if (/\b(gaming laptop|gaming laptops|laptop|laptops|notebook|notebooks|macbook|chromebook|desktop|desktops)\b/i.test(fullQ)) {
    category = 'Laptops & Desktops';
  } else if (/\b(android phones|android phone|iphone|smartphone|smartphones|phone|phones|mobile|mobiles|tablet|tablets|ipad)\b/i.test(fullQ)) {
    category = 'Smartphones & Tablets';
  } else if (/\b(headphone|headphones|earbuds|earphones|earphone|headset|headsets|speaker|speakers|soundbar|anc)\b/i.test(fullQ)) {
    category = 'Audio Equipment';
  } else if (/\b(smartwatch|smart watch|smartwatches|wearable|wearables|fitness band|watch)\b/i.test(fullQ)) {
    category = 'Smart Wearables';
  }

  // 5. Keyword Cleaning
  let keywords = q;
  if (category) {
    const genericCatWords = [
      'android', 'phones', 'phone', 'mobiles', 'mobile', 'smartphones', 'smartphone', 'tablets', 'tablet',
      'laptops', 'laptop', 'notebooks', 'notebook', 'desktops', 'desktop',
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
    minPrice,
    maxPrice
  };
}

export async function parseNaturalLanguageQuery(query: string): Promise<ParsedQuery> {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return { originalQuery: '', keywords: '', category: null, minPrice: null, maxPrice: null };
  }

  const cleanQuery = query.trim();
  const cacheKey = cleanQuery.toLowerCase();

  if (queryCache.has(cacheKey)) {
    return queryCache.get(cacheKey)!;
  }

  const fallback = deterministicParse(cleanQuery);

  if (!process.env.GEMINI_API_KEY) {
    queryCache.set(cacheKey, fallback);
    return fallback;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const geminiPromise = generateContentWithModelFallback(ai, {
      contents: `Parse the following Indian shopping query into structured JSON filter values for an e-commerce catalogue:
Query: "${cleanQuery}"

Categories must strictly be one of:
- "Laptops & Desktops"
- "Smartphones & Tablets"
- "Audio Equipment"
- "Smart Wearables"
- null (if query does not specify a product category)

Convert currency expressions (e.g. 1.3 lakh = 130000, 30k = 30000, 5000 = 5000) into integer numbers.
Extract non-category brand or spec keywords (e.g., "gaming", "asus", "samsung", "sony", "iphone").`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keywords: { type: Type.STRING },
            category: { type: Type.STRING, nullable: true },
            minPrice: { type: Type.INTEGER, nullable: true },
            maxPrice: { type: Type.INTEGER, nullable: true }
          },
          required: ['keywords']
        }
      }
    });

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
    const response = await Promise.race([geminiPromise, timeoutPromise]);

    if (response && response.text) {
      const parsed = JSON.parse(response.text.trim());
      const category = (parsed.category && VALID_CATEGORIES.includes(parsed.category)) ? parsed.category : fallback.category;
      const result: ParsedQuery = {
        originalQuery: cleanQuery,
        keywords: typeof parsed.keywords === 'string' ? parsed.keywords.trim() : fallback.keywords,
        category,
        minPrice: typeof parsed.minPrice === 'number' ? parsed.minPrice : fallback.minPrice,
        maxPrice: typeof parsed.maxPrice === 'number' ? parsed.maxPrice : fallback.maxPrice
      };
      queryCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    // Fallback to deterministic parser
  }

  queryCache.set(cacheKey, fallback);
  return fallback;
}
