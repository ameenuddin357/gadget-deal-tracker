/**
 * Centralized Compare Products Configuration & Storage Utilities
 * Single source of truth for compare product limit, storage management, and state checks.
 */

export const MAX_COMPARE_PRODUCTS = 4;
export const COMPARE_STORAGE_KEY = 'deal_compare_ids';

/**
 * Retrieve the current sanitized list of compared product IDs from storage.
 * Guarantees no duplicates and maximum length of MAX_COMPARE_PRODUCTS (4).
 */
export function getCompareProductIds(): number[] {
  try {
    const saved = localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      const unique = Array.from(new Set(parsed.map(Number).filter(n => !isNaN(n) && n > 0)));
      return unique.slice(0, MAX_COMPARE_PRODUCTS);
    }
  } catch (e) {
    console.error('Failed to parse compare IDs from storage', e);
  }
  return [];
}

/**
 * Persist the list of compare product IDs to storage and notify all listening components.
 * Enforces maximum capacity of MAX_COMPARE_PRODUCTS (4).
 */
export function saveCompareProductIds(ids: number[]): number[] {
  try {
    const unique = Array.from(new Set(ids.map(Number).filter(n => !isNaN(n) && n > 0))).slice(0, MAX_COMPARE_PRODUCTS);
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(unique));
    window.dispatchEvent(new Event('deal-compare-updated'));
    return unique;
  } catch (e) {
    console.error('Failed to save compare IDs to storage', e);
    return [];
  }
}

/**
 * Check if a specific product ID is currently in the comparison list.
 */
export function isProductInCompare(productId: number): boolean {
  if (!productId || isNaN(productId)) return false;
  const current = getCompareProductIds();
  return current.includes(productId);
}

/**
 * Check if the comparison list has reached its maximum capacity.
 */
export function isCompareListFull(): boolean {
  const current = getCompareProductIds();
  return current.length >= MAX_COMPARE_PRODUCTS;
}

export interface AddCompareResult {
  success: boolean;
  isAlreadyAdded: boolean;
  isFull: boolean;
  ids: number[];
  count: number;
}

/**
 * Add a product to the comparison list.
 * If already in the list, succeeds without duplicate.
 * If list is already full (4 items) and product is not in list, returns isFull: true without adding.
 */
export function addProductToCompare(productId: number): AddCompareResult {
  if (!productId || isNaN(productId)) {
    const current = getCompareProductIds();
    return { success: false, isAlreadyAdded: false, isFull: current.length >= MAX_COMPARE_PRODUCTS, ids: current, count: current.length };
  }

  const current = getCompareProductIds();

  // If already in compare, preserve state (do not treat as error)
  if (current.includes(productId)) {
    return {
      success: true,
      isAlreadyAdded: true,
      isFull: current.length >= MAX_COMPARE_PRODUCTS,
      ids: current,
      count: current.length
    };
  }

  // Reject if compare list is already at capacity
  if (current.length >= MAX_COMPARE_PRODUCTS) {
    return {
      success: false,
      isAlreadyAdded: false,
      isFull: true,
      ids: current,
      count: current.length
    };
  }

  const updated = [...current, productId];
  const saved = saveCompareProductIds(updated);
  return {
    success: true,
    isAlreadyAdded: false,
    isFull: saved.length >= MAX_COMPARE_PRODUCTS,
    ids: saved,
    count: saved.length
  };
}

/**
 * Remove a product from the comparison list.
 */
export function removeProductFromCompare(productId: number): number[] {
  if (!productId || isNaN(productId)) return getCompareProductIds();
  const current = getCompareProductIds();
  const updated = current.filter(id => id !== productId);
  return saveCompareProductIds(updated);
}

export interface ToggleCompareResult {
  action: 'added' | 'removed' | 'full';
  ids: number[];
  count: number;
  isFull: boolean;
}

/**
 * Toggle product in comparison list.
 * If present -> removes it.
 * If not present and count < 4 -> adds it.
 * If not present and count >= 4 -> returns action 'full' without modifying list.
 */
export function toggleProductInCompare(productId: number): ToggleCompareResult {
  if (!productId || isNaN(productId)) {
    const current = getCompareProductIds();
    return { action: 'full', ids: current, count: current.length, isFull: current.length >= MAX_COMPARE_PRODUCTS };
  }

  const current = getCompareProductIds();

  if (current.includes(productId)) {
    const updated = removeProductFromCompare(productId);
    return {
      action: 'removed',
      ids: updated,
      count: updated.length,
      isFull: updated.length >= MAX_COMPARE_PRODUCTS
    };
  }

  if (current.length >= MAX_COMPARE_PRODUCTS) {
    return {
      action: 'full',
      ids: current,
      count: current.length,
      isFull: true
    };
  }

  const res = addProductToCompare(productId);
  return {
    action: res.success ? 'added' : 'full',
    ids: res.ids,
    count: res.count,
    isFull: res.isFull
  };
}

/**
 * Atomically replace an existing compared product with a new/pending product.
 * Guarantees that:
 * - old product is verified to exist in the current list
 * - new product replaces the exact slot of the old product
 * - comparison count strictly remains <= MAX_COMPARE_PRODUCTS (4)
 * - deduplication is enforced
 * - updated list is saved to localStorage and 'deal-compare-updated' event is dispatched
 */
export function replaceCompareProduct(oldProductId: number, newProductId: number): {
  success: boolean;
  ids: number[];
  count: number;
} {
  if (!oldProductId || isNaN(oldProductId) || !newProductId || isNaN(newProductId)) {
    const current = getCompareProductIds();
    return { success: false, ids: current, count: current.length };
  }

  const current = getCompareProductIds();
  const oldIndex = current.indexOf(oldProductId);
  if (oldIndex === -1) {
    return { success: false, ids: current, count: current.length };
  }

  // If new product is already in the list, just remove the old product if different
  if (current.includes(newProductId)) {
    if (oldProductId === newProductId) {
      return { success: true, ids: current, count: current.length };
    }
    const filtered = current.filter(id => id !== oldProductId);
    const saved = saveCompareProductIds(filtered);
    return { success: true, ids: saved, count: saved.length };
  }

  // Replace old product with new product in-place
  const updated = [...current];
  updated[oldIndex] = newProductId;

  const unique = Array.from(new Set(updated.map(Number).filter(n => !isNaN(n) && n > 0))).slice(0, MAX_COMPARE_PRODUCTS);
  const saved = saveCompareProductIds(unique);

  return {
    success: true,
    ids: saved,
    count: saved.length
  };
}

/**
 * Clear all products from compare list.
 */
export function clearAllCompareProducts(): void {
  saveCompareProductIds([]);
}
