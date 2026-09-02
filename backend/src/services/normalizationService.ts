export interface ProductDetails {
  brand: string;
  coreName: string;
  canonicalSlug: string;
  storageVariant: string;
  colorVariant: string;
  variantSlug: string;
}

export class NormalizationService {
  private static brands = [
    'apple', 'samsung', 'google', 'oneplus', 'xiaomi', 'realme', 'oppo', 'vivo', 'asus', 'sony',
    'dell', 'hp', 'lenovo', 'acer', 'microsoft', 'boat', 'noise', 'boult', 'redmi', 'motorola', 'moto', 'lg', 'nothing'
  ];

  private static colors = [
    'space gray', 'space grey', 'titanium gray', 'titanium black', 'titanium yellow', 'titanium violet',
    'titanium', 'natural titanium', 'white titanium', 'black titanium', 'blue titanium',
    'deep purple', 'sierra blue', 'midnight', 'starlight', 'cosmic', 'blue', 'black', 'white',
    'gold', 'silver', 'purple', 'green', 'yellow', 'red', 'rose gold', 'coral', 'space black'
  ];

  /**
   * Normalizes standard colors to a group/alias to identify similar color variants
   */
  public static normalizeColorGroup(color: string): string {
    const lower = color.toLowerCase();
    if (lower === 'n/a') return 'n/a';
    
    if (lower.includes('black') || lower.includes('midnight') || lower.includes('space gray') || lower.includes('space grey') || lower.includes('charcoal')) {
      return 'Black/Gray';
    }
    if (lower.includes('white') || lower.includes('silver') || lower.includes('starlight')) {
      return 'White/Silver';
    }
    if (lower.includes('titanium')) {
      if (lower.includes('black') || lower.includes('gray') || lower.includes('grey')) {
        return 'Black/Gray';
      }
      return 'Titanium';
    }
    if (lower.includes('blue')) return 'Blue';
    if (lower.includes('gold')) return 'Gold';
    if (lower.includes('green')) return 'Green';
    if (lower.includes('purple')) return 'Purple';
    if (lower.includes('red')) return 'Red';
    if (lower.includes('yellow')) return 'Yellow';
    
    return color; // Return raw color if no standard group matches
  }

  /**
   * Parse a product name and extract brand, core name, canonical slug, storage, and color variants.
   */
  public static parseProductDetails(rawName: string, inputBrand?: string): ProductDetails {
    const name = rawName.trim();

    // 1. Detect Brand
    let brand = (inputBrand || '').trim();
    let brandLower = brand.toLowerCase();

    if (!brand || brandLower === 'general gadgets' || brandLower === 'synthetic' || brandLower === 'n/a' || brandLower === 'general') {
      const matchedBrand = this.brands.find(b => new RegExp(`\\b${b}\\b`, 'i').test(name));
      if (matchedBrand) {
        brand = matchedBrand.charAt(0).toUpperCase() + matchedBrand.slice(1);
      } else {
        const firstWord = name.split(/\s+/)[0];
        if (firstWord) {
          brand = firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
        } else {
          brand = 'General';
        }
      }
    }

    // 2. Extract Storage Variant (e.g. 128GB, 256GB, 1TB)
    let storageVariant = 'N/A';
    const storageRegex = /\b(\d+)\s*(gb|tb)\b/gi;
    let matches: RegExpExecArray | null;
    const storageOptions: { value: number; unit: string; raw: string }[] = [];

    while ((matches = storageRegex.exec(name)) !== null) {
      const val = parseInt(matches[1], 10);
      const unit = matches[2].toLowerCase();
      storageOptions.push({ value: val, unit, raw: matches[0] });
    }

    if (storageOptions.length > 0) {
      // SortDescending by actual storage capacity in MB
      const getMbValue = (opt: { value: number; unit: string }) => {
        if (opt.unit === 'tb') return opt.value * 1024 * 1024;
        return opt.value * 1024;
      };

      storageOptions.sort((a, b) => getMbValue(b) - getMbValue(a));

      // Prefer option marked as storage/rom or in brackets
      const preferred = storageOptions.find(opt => {
        const idx = name.indexOf(opt.raw);
        const surrounding = name.slice(Math.max(0, idx - 15), Math.min(name.length, idx + opt.raw.length + 15)).toLowerCase();
        return surrounding.includes('storage') || surrounding.includes('rom') || surrounding.includes('internal');
      });

      const finalStorage = preferred || storageOptions[0];
      storageVariant = `${finalStorage.value}${finalStorage.unit.toLowerCase()}`;
    }

    // 3. Extract Color Variant
    let colorVariant = 'N/A';
    const sortedColors = [...this.colors].sort((a, b) => b.length - a.length);
    for (const color of sortedColors) {
      const regex = new RegExp(`\\b${color}\\b`, 'i');
      if (regex.test(name)) {
        colorVariant = color.toLowerCase();
        break;
      }
    }

    // 4. Extract Core Name (Strip Brand, bracketed info, storage keywords, color keywords, extra terms)
    let coreName = name;

    // Strip everything inside brackets or parentheses
    coreName = coreName.replace(/\s*[([].*?[\])]/g, ' ');

    // Strip brand if it's at the start
    const brandRegex = new RegExp(`^${brand}\\b`, 'i');
    coreName = coreName.replace(brandRegex, ' ');

    // Strip storage keywords (e.g., "128GB", "256 GB") and terms like storage, rom, ram
    coreName = coreName.replace(/\b\d+\s*(gb|tb|mb|ram|rom)\b/gi, ' ');
    coreName = coreName.replace(/\b(storage|internal|rom|ram)\b/gi, ' ');

    // Strip color keywords
    for (const color of sortedColors) {
      const regex = new RegExp(`\\b${color}\\b`, 'gi');
      coreName = coreName.replace(regex, ' ');
    }

    // Strip extra terms
    const extraTerms = ['renewed', 'refurbished', 'unlocked', 'cellular', 'wi-fi', 'wifi', '5g', '4g', 'lte', 'dual sim', 'single sim'];
    for (const extra of extraTerms) {
      const regex = new RegExp(`\\b${extra}\\b`, 'gi');
      coreName = coreName.replace(regex, ' ');
    }

    // Clean punctuation and multiple spaces
    coreName = coreName.replace(/[^a-zA-Z0-9\s]/g, ' ');
    coreName = coreName.replace(/\s+/g, ' ').trim();

    // Capitalize brand properly
    const finalBrand = brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();

    // Canonical Slug: brand-coreName-normalized
    const cleanCoreSlug = coreName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const cleanBrandSlug = finalBrand.toLowerCase();
    const canonicalSlug = `${cleanBrandSlug}-${cleanCoreSlug}`.replace(/(^-|-$)/g, '');

    // Variant Slug: canonicalSlug + storage + color
    const variantSlugParts = [canonicalSlug];
    if (storageVariant !== 'N/A') {
      variantSlugParts.push(storageVariant);
    }
    if (colorVariant !== 'N/A') {
      variantSlugParts.push(colorVariant.replace(/\s+/g, '-'));
    }
    const variantSlug = variantSlugParts.join('-').toLowerCase().replace(/[^a-z0-9-]+/g, '-');

    return {
      brand: finalBrand,
      coreName,
      canonicalSlug,
      storageVariant,
      colorVariant: colorVariant !== 'N/A' ? colorVariant.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'N/A',
      variantSlug
    };
  }
}
