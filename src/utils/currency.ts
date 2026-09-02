/**
 * Indian Rupee (INR) currency formatting utility using standard 'en-IN' locale
 * e.g., 150000 becomes ₹1,50,000
 */
export function formatINR(value: number): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '₹0';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0, // Indian tech items are traditionally priced as whole numbers
  }).format(value);
}

export interface DiscountInfo {
  isValid: boolean;
  discountPercentage: number;
  originalPrice: number;
  currentPrice: number;
}

export function getDiscountInfo(currentPrice?: number | string | null, originalPrice?: number | string | null): DiscountInfo {
  const curr = typeof currentPrice === 'string' ? parseFloat(currentPrice) : (currentPrice ?? NaN);
  const orig = typeof originalPrice === 'string' ? parseFloat(originalPrice) : (originalPrice ?? NaN);

  if (
    isNaN(curr) ||
    isNaN(orig) ||
    !isFinite(curr) ||
    !isFinite(orig) ||
    curr <= 0 ||
    orig <= 0 ||
    orig <= curr
  ) {
    return { isValid: false, discountPercentage: 0, originalPrice: orig, currentPrice: curr };
  }

  // Check if original price is absurd (e.g. > curr * 3)
  if (orig > curr * 3) {
    return { isValid: false, discountPercentage: 0, originalPrice: orig, currentPrice: curr };
  }

  const discount = ((orig - curr) / orig) * 100;

  // Do NOT show discount badge when discount <= 0 or > 90%
  if (discount <= 0 || discount > 90) {
    return { isValid: false, discountPercentage: 0, originalPrice: orig, currentPrice: curr };
  }

  return {
    isValid: true,
    discountPercentage: Math.round(discount),
    originalPrice: orig,
    currentPrice: curr,
  };
}

export interface RetailerTrendInfo {
  type: 'down' | 'up' | 'same';
  percentage: number;
  previousPrice: number;
}

export function getRetailerTrendInfo(
  pricing: { price: number | string; store_name: string },
  priceHistory: Array<{ price: number | string; date: string; store_name?: string }>
): RetailerTrendInfo | null {
  if (!pricing || !pricing.store_name) return null;
  const currentPrice = typeof pricing.price === 'number' ? pricing.price : parseFloat(pricing.price);
  if (isNaN(currentPrice) || currentPrice <= 0) return null;

  if (!Array.isArray(priceHistory) || priceHistory.length === 0) return null;

  // Filter history for this retailer
  const storeHistory = priceHistory
    .filter(h => h.store_name && h.store_name.toLowerCase() === pricing.store_name.toLowerCase())
    .map(h => ({
      price: typeof h.price === 'number' ? h.price : parseFloat(h.price),
      date: new Date(h.date).getTime()
    }))
    .filter(h => !isNaN(h.price) && h.price > 0 && !isNaN(h.date))
    .sort((a, b) => b.date - a.date); // Newest first

  if (storeHistory.length === 0) {
    return null;
  }

  let previousPrice: number | null = null;

  if (storeHistory.length === 1) {
    // Single historical record
    if (Math.abs(storeHistory[0].price - currentPrice) < 0.01) {
      // Single record equals current price => no previous record exists
      return null;
    }
    previousPrice = storeHistory[0].price;
  } else {
    // Multiple records exist
    if (Math.abs(storeHistory[0].price - currentPrice) < 0.01) {
      previousPrice = storeHistory[1].price;
    } else {
      previousPrice = storeHistory[0].price;
    }
  }

  if (previousPrice === null || isNaN(previousPrice) || previousPrice <= 0) {
    return null;
  }

  const diff = currentPrice - previousPrice;
  if (Math.abs(diff) < 0.01) {
    return {
      type: 'same',
      percentage: 0,
      previousPrice
    };
  }

  const percentage = (Math.abs(diff) / previousPrice) * 100;
  if (isNaN(percentage) || !isFinite(percentage)) {
    return null;
  }

  return {
    type: diff < 0 ? 'down' : 'up',
    percentage,
    previousPrice
  };
}

export function isRealSpec(specs?: string | null): boolean {
  if (!specs || !specs.trim()) return false;
  const lower = specs.toLowerCase().trim();
  if (
    lower.includes('high quality') ||
    lower.includes('mapped via') ||
    lower.includes('standard retail specifications') ||
    lower.includes('standard warranty') ||
    lower.includes('electronic product')
  ) {
    return false;
  }
  return true;
}

export interface ParsedSpecs {
  brand: string;
  category: string;
  processor?: string;
  ram?: string;
  storage?: string;
  display?: string;
  gpu?: string;
  os?: string;
  hasGenuineSpecs: boolean;
  rawSummary?: string;
}

export interface ParsedSpecFields {
  processor?: string;
  ram?: string;
  storage?: string;
  display?: string;
  gpu?: string;
  battery?: string;
  os?: string;
  camera?: string;
}

export function parseProductSpecs(product: { name: string; specs_summary?: string | null; description?: string | null } | null): ParsedSpecFields {
  if (!product) return {};
  
  const isReal = isRealSpec(product.specs_summary);
  const rawSummary = isReal ? (product.specs_summary || '') : '';
  const desc = product.description || '';
  const name = product.name || '';
  const fullText = `${name} ${rawSummary} ${desc}`;

  const fields: ParsedSpecFields = {};

  // Processor
  const procMatch = fullText.match(/(Intel\s+Core\s+Ultra\s+\d+[-\s]?\d*\w*|Intel\s+Core\s+i[3579][-\s]?\d*\w*|AMD\s+Ryzen\s+[9753]\s+\d+\w*|Apple\s+M[1234]\s*(?:Pro|Max|Ultra)?|Snapdragon\s+[8764](?:\s*Gen\s*\d+)?(?:\s*s)?(?:\s*Plus)?|Dimensity\s+\d+|Exynos\s+\d+|A17\s+Pro|A16\s+Bionic|A15\s+Bionic|A18\s+Pro|Tensor\s+G[1234]|MediaTek\s+\w+|Celeron\s+\w+|Pentium\s+\w+)/i);
  if (procMatch) {
    fields.processor = procMatch[1].trim();
  }

  // RAM
  const ramMatch = fullText.match(/(\d+\s*GB\s*(?:DDR[45]|LPDDR[45]|RAM|Unified\s+Memory)?)/i);
  if (ramMatch) {
    const ramVal = parseInt(ramMatch[1], 10);
    if (!isNaN(ramVal) && ramVal <= 64 && (fullText.toLowerCase().includes('ram') || fullText.toLowerCase().includes('ddr') || fullText.toLowerCase().includes('memory') || ramVal <= 32)) {
      fields.ram = ramMatch[1].trim();
    }
  }

  // Storage
  const storageMatch = fullText.match(/(\d+\s*(?:TB|GB)\s*(?:SSD|NVMe|PCIe|Storage|ROM|eMMC)?)/i);
  if (storageMatch) {
    const storageVal = parseInt(storageMatch[1], 10);
    const isTb = storageMatch[0].toLowerCase().includes('tb');
    if (isTb || storageVal >= 64 || fullText.toLowerCase().includes('ssd') || fullText.toLowerCase().includes('rom')) {
      fields.storage = storageMatch[1].trim();
    }
  }

  // Display
  const displayMatch = fullText.match(/(\d+\.\d+["”]?\s*(?:\(\d+\.\d+"\))?\s*(?:Full\s*HD|QHD|OLED|AMOLED|IPS|Retina|XDR|120Hz|144Hz|165Hz|\d+x\d+)?|\d+\s*inch|\d+\s*cm)/i);
  if (displayMatch) {
    fields.display = displayMatch[1].trim();
  }

  // GPU
  const gpuMatch = fullText.match(/(NVIDIA\s+GeForce\s+RTX\s+\d+|NVIDIA\s+GeForce\s+GTX\s+\d+|GeForce\s+RTX\s+\d+|RTX\s+\d+|Radeon\s+RX\s+\d+|Intel\s+Arc\s+\w+|M[1234]\s*(?:Pro|Max)?\s*GPU|\d+-core\s*GPU)/i);
  if (gpuMatch) {
    fields.gpu = gpuMatch[1].trim();
  }

  // Battery
  const batteryMatch = fullText.match(/(\d+\s*mAh(?:\s*battery)?|\d+\s*mWh(?:\s*battery)?|\d+-hour\s*battery)/i);
  if (batteryMatch) {
    fields.battery = batteryMatch[1].trim();
  }

  // OS
  const osMatch = fullText.match(/(Windows\s*11(?:\s*Home|\s*Pro)?|Windows\s*10|macOS|Android\s*\d*|iOS\s*\d*|iPadOS\s*\d*|ChromeOS)/i);
  if (osMatch) {
    fields.os = osMatch[1].trim();
  }

  // Camera
  const cameraMatch = fullText.match(/(\d+MP(?:\s*(?:camera|setup|sensor|main|telephoto|ultrawide))?|\d+MP\s*\+\s*\d+MP)/i);
  if (cameraMatch) {
    fields.camera = cameraMatch[1].trim();
  }

  return fields;
}

export function getDynamicQuickQuestions(
  product: { name: string; specs_summary?: string | null; description?: string | null; cheapest_price?: number } | null,
  storesPricing: Array<{ is_available?: boolean; price?: number | string; product_url?: string }> = [],
  level: number = 0
): string[] {
  if (!product) return ["What's the current price?"];

  const questions: string[] = [];
  const activeOffers = storesPricing.filter(s => s.is_available !== false && (typeof s.price === 'number' ? s.price > 0 : parseFloat(String(s.price)) > 0));
  const currentPrice = product.cheapest_price || (activeOffers.length > 0 ? (typeof activeOffers[0].price === 'number' ? activeOffers[0].price : parseFloat(String(activeOffers[0].price))) : undefined);
  const specDetails = parseProductSpecs(product);

  if (level === 0) {
    if (currentPrice !== undefined && currentPrice > 0) questions.push("What's the current price?");
    if (activeOffers.length >= 1) questions.push('Where can I buy it?');
    if (activeOffers.length >= 2) questions.push('Which store is cheapest?');
    if (specDetails.ram) questions.push('How much RAM does it have?');
    if (specDetails.processor) questions.push('What processor does it have?');
    if (specDetails.storage) questions.push('How much storage does it have?');
    if (specDetails.gpu) questions.push('What GPU does it have?');
    if (specDetails.display) questions.push('What display does it have?');
    if (specDetails.battery) questions.push('What is the battery capacity?');
    if (specDetails.camera) questions.push('What are the camera specs?');
  } else if (level === 1) {
    if (currentPrice !== undefined && currentPrice > 0) questions.push("What's the current price?");
    if (activeOffers.length >= 2) questions.push('Which store is cheapest?');
    questions.push('How much has the price changed?');
    questions.push('What was the previous price?');
    if (activeOffers.length >= 1) questions.push('Where can I buy it?');
  } else if (level === 2) {
    questions.push("What's the price trend?");
    questions.push('Compare with recent average');
    questions.push('What is the lowest recorded price?');
    if (currentPrice !== undefined && currentPrice > 0) questions.push("What's the current price?");
    if (activeOffers.length >= 2) questions.push('Which store is cheapest?');
  } else if (level === 3) {
    questions.push('Buy or Wait?');
    questions.push('Why?');
    questions.push("What's the price trend?");
    if (activeOffers.length >= 2) questions.push('Which store is cheapest?');
    questions.push('Is this near the historical low?');
  }

  if (questions.length === 0) {
    questions.push("What's the current price?");
  }

  return Array.from(new Set(questions)).slice(0, 6);
}

export function extractParsedSpecs(product: { name: string; brand?: string; category_name?: string; specs_summary?: string | null }): ParsedSpecs {
  const name = product.name || '';
  const rawSummary = isRealSpec(product.specs_summary) ? (product.specs_summary || '') : '';
  const fullText = `${name} ${rawSummary}`;

  // Processor extraction
  const procMatch = fullText.match(/(Intel\s+Core\s+Ultra\s+\d+-\d+\w*|Intel\s+Core\s+i[3579]-\w+|AMD\s+Ryzen\s+[9753]\s+\d+\w*|\d{4}HX|\d{4}H|Apple\s+M[1234]\s*(?:Pro|Max)?|Snapdragon\s+[876]\s+Gen\s+\d+)/i);
  // RAM extraction
  const ramMatch = fullText.match(/(\d+\s*GB\s*(?:DDR[45]|LPDDR[45])?)/i);
  // Storage extraction
  const storageMatch = fullText.match(/(\d+\s*(?:TB|GB)\s*(?:SSD|NVMe)?)/i);
  // Display extraction
  const displayMatch = fullText.match(/(\d+\.\d+["”]?\s*(?:\(\d+\.\d+"\))?\s*(?:Full HD|QHD|Wide Quad HD|OLED|IPS|\d+\s*Hz)?|\d+\s*Hz)/i);
  // GPU extraction
  const gpuMatch = fullText.match(/(NVIDIA\s+GeForce\s+RTX\s+\d+|NVIDIA\s+GeForce\s+GTX\s+\d+|GeForce\s+RTX\s+\d+|RTX\s+\d+|Radeon\s+RX\s+\d+)/i);
  // OS extraction
  const osMatch = fullText.match(/(Windows\s+11(?:\s+Home|\s+Pro)?|Windows\s+10|macOS|Android\s+\d+|iOS\s+\d+)/i);

  return {
    brand: product.brand || 'N/A',
    category: product.category_name || 'Uncategorized',
    processor: procMatch ? procMatch[1].trim() : undefined,
    ram: ramMatch ? ramMatch[1].trim() : undefined,
    storage: storageMatch ? storageMatch[1].trim() : undefined,
    display: displayMatch ? displayMatch[1].trim() : undefined,
    gpu: gpuMatch ? gpuMatch[1].trim() : undefined,
    os: osMatch ? osMatch[1].trim() : undefined,
    hasGenuineSpecs: isRealSpec(product.specs_summary) || Boolean(procMatch || ramMatch || storageMatch),
    rawSummary: rawSummary.trim() || undefined
  };
}

