/**
 * Standardized Product Type Classification Utility
 * 
 * Maps products deterministically into granular user-facing product types:
 * - Laptops
 * - Monitors
 * - Smartwatches
 * - Phones
 * - Tablets
 * - Headphones
 * - (Future types supported: Televisions, Desktop Computers, Earbuds, Speakers, Fitness Bands)
 */

export const KNOWN_MONITOR_BRANDS = [
  'benq',
  'frontech',
  'zebronics',
  'foxin',
  'aoc',
  'zebster',
  'geonix',
  'intex',
  'philips',
  'gigabyte',
  'kreo',
  'riitek15.6',
  '21.45',
  '49',
  'lg24u411a-bn',
  'ea124'
];

/**
 * Returns a SQL expression (CASE ... END) evaluating to the product type string.
 * Uses table alias 'p' for products and 'c' for categories.
 */
export function getProductTypeSqlExpression(productTableAlias = 'p', categoryTableAlias = 'c'): string {
  const p = productTableAlias;
  const c = categoryTableAlias;

  return `CASE
    -- 1. Smartwatches
    WHEN ${c}.name = 'Smart Wearables' OR ${p}.name ILIKE '%smartwatch%' OR ${p}.name ILIKE '%smart watch%' OR ${p}.name ILIKE '%galaxy fit%' THEN 'Smartwatches'
    
    -- 2. Audio Equipment / Headphones (excluding laptops)
    WHEN ${c}.name = 'Audio Equipment' OR (${c}.name != 'Laptops & Desktops' AND (${p}.name ILIKE '%headphone%' OR ${p}.name ILIKE '%wh-1000%' OR ${p}.name ILIKE '%earphone%')) THEN 'Headphones'
    
    -- 3. Phones
    WHEN ${c}.name = 'Smartphones & Tablets' AND (${p}.name ILIKE '%iphone%' OR ${p}.name ILIKE '%galaxy s%' OR ${p}.name ILIKE '%phone%' OR ${p}.name ILIKE '%s24%') THEN 'Phones'
    
    -- 4. Tablets
    WHEN ${c}.name = 'Smartphones & Tablets' AND (${p}.name ILIKE '%ipad%' OR ${p}.name ILIKE '%tablet%' OR ${p}.name ILIKE '%tab %' OR (${p}.name ILIKE '%pad%' AND ${p}.name NOT ILIKE '%ideapad%')) THEN 'Tablets'
    
    -- 5. Laptops (Explicit laptop series, keywords, models)
    WHEN ${c}.name = 'Laptops & Desktops' AND (
      ${p}.name ILIKE '%laptop%' OR ${p}.name ILIKE '%macbook%' OR ${p}.name ILIKE '%notebook%' OR
      ${p}.name ILIKE '%chromebook%' OR ${p}.name ILIKE '%ideapad%' OR ${p}.name ILIKE '%vivobook%' OR
      ${p}.name ILIKE '%zenbook%' OR ${p}.name ILIKE '%victus%' OR ${p}.name ILIKE '%tuf%' OR
      ${p}.name ILIKE '%rog%' OR ${p}.name ILIKE '%loq%' OR ${p}.name ILIKE '%alienware%' OR
      ${p}.name ILIKE '%predator%' OR ${p}.name ILIKE '%helios%' OR ${p}.name ILIKE '%surface%' OR
      ${p}.name ILIKE '%inspiron%' OR ${p}.name ILIKE '%vostro%' OR ${p}.name ILIKE '%aspire%' OR
      ${p}.name ILIKE '%galaxy book%' OR ${p}.name ILIKE '%omnibook%' OR ${p}.name ILIKE '%thin 15%' OR
      ${p}.name ILIKE '%thin a15%' OR ${p}.name ILIKE '%pulse%' OR ${p}.name ILIKE '%erazer%' OR
      ${p}.name ILIKE '%omen%' OR ${p}.name ILIKE '%ebook%' OR ${p}.name ILIKE '%infinix%' OR
      ${p}.name ILIKE '%hp 14%' OR ${p}.name ILIKE '%hp 15%' OR ${p}.name ILIKE '%dell 15%' OR
      ${p}.name ILIKE '%dell dc%' OR ${p}.name ILIKE '%dell xps%' OR ${p}.name ILIKE '%lenovo v15%' OR
      (${p}.name ILIKE '%legion%' AND ${p}.name NOT ILIKE '%monitor%')
    ) THEN 'Laptops'

    -- 6. Monitors
    WHEN ${c}.name = 'Laptops & Desktops' AND (
      ${p}.name ILIKE '%monitor%' OR ${p}.name ILIKE '%studio display%' OR ${p}.name ILIKE '%viewsonic%' OR
      ${p}.name ILIKE '%ultrawide%' OR ${p}.name ILIKE '%240hz%' OR ${p}.name ILIKE '%144hz%' OR ${p}.name ILIKE '%100hz%' OR
      ${p}.name ILIKE '%wqhd%' OR ${p}.name ILIKE '%dqhd%' OR
      LOWER(${p}.brand) IN ('benq', 'frontech', 'zebronics', 'foxin', 'aoc', 'zebster', 'geonix', 'intex', 'philips', 'gigabyte', 'kreo', 'riitek15.6', '21.45', '49', 'lg24u411a-bn', 'ea124') OR
      (${p}.name ILIKE '%panel%' AND ${p}.name NOT ILIKE '%laptop%') OR
      ${p}.name ILIKE '%s3 flat%' OR ${p}.name ILIKE '%curved screen%'
    ) THEN 'Monitors'
    
    -- Fallback within category
    WHEN ${c}.name = 'Laptops & Desktops' THEN 'Laptops'
    WHEN ${c}.name = 'Smart Wearables' THEN 'Smartwatches'
    WHEN ${c}.name = 'Audio Equipment' THEN 'Headphones'
    WHEN ${c}.name = 'Smartphones & Tablets' THEN 'Phones'
    WHEN ${c}.name = 'Televisions' THEN 'Televisions'
    
    ELSE 'Other'
  END`;
}

/**
 * Returns the numeric bucket (1..7) for Recommended/Featured diversification
 */
export function getRecommendedBucketSqlExpression(productTableAlias = 'p', categoryTableAlias = 'c'): string {
  const typeExpr = getProductTypeSqlExpression(productTableAlias, categoryTableAlias);
  return `CASE (${typeExpr})
    WHEN 'Headphones' THEN 1
    WHEN 'Laptops' THEN 2
    WHEN 'Phones' THEN 3
    WHEN 'Monitors' THEN 4
    WHEN 'Tablets' THEN 5
    WHEN 'Smartwatches' THEN 6
    ELSE 7
  END`;
}

/**
 * Maps incoming query string (e.g. "laptops", "Laptops", "monitors", "Monitors & Displays", etc.)
 * to canonical product type, or null if "All" or unrecognized.
 */
export function normalizeProductType(typeQuery?: string): string | null {
  if (!typeQuery || typeof typeQuery !== 'string') return null;
  const lower = typeQuery.trim().toLowerCase();

  if (lower === 'all' || lower === '' || lower === 'all products') return null;
  if (lower === 'laptop' || lower === 'laptops') return 'Laptops';
  if (lower === 'monitor' || lower === 'monitors' || lower === 'displays') return 'Monitors';
  if (lower === 'smartwatch' || lower === 'smartwatches' || lower === 'wearable' || lower === 'wearables') return 'Smartwatches';
  if (lower === 'phone' || lower === 'phones' || lower === 'smartphone' || lower === 'smartphones') return 'Phones';
  if (lower === 'tablet' || lower === 'tablets' || lower === 'ipad' || lower === 'ipads') return 'Tablets';
  if (lower === 'headphone' || lower === 'headphones' || lower === 'audio' || lower === 'earbuds' || lower === 'earphones') return 'Headphones';
  if (lower === 'television' || lower === 'televisions' || lower === 'tv' || lower === 'tvs') return 'Televisions';
  if (lower === 'desktop' || lower === 'desktops' || lower === 'desktop computers') return 'Desktop Computers';

  // Direct case normalization
  const titleCased = lower.charAt(0).toUpperCase() + lower.slice(1);
  return titleCased;
}
