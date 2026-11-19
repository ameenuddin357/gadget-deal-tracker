/**
 * Product Type Display Helper
 * 
 * Formats a backend-provided product_type into a friendly singular label.
 * backend/src/utils/productClassifier.ts is the SINGLE source of truth
 * for product classification across the entire application.
 * 
 * This file does NOT independently classify products from names, brands,
 * categories, models, or specifications.
 */

export function getDisplayProductType(product?: {
  product_type?: string | null;
} | null): string {
  if (!product || !product.product_type || typeof product.product_type !== 'string') {
    return 'Gadget';
  }

  const raw = product.product_type.trim().toLowerCase();

  switch (raw) {
    case 'laptops':
    case 'laptop':
      return 'Laptop';
    case 'monitors':
    case 'monitor':
      return 'Monitor';
    case 'smartwatches':
    case 'smartwatch':
      return 'Smartwatch';
    case 'phones':
    case 'phone':
      return 'Phone';
    case 'tablets':
    case 'tablet':
      return 'Tablet';
    case 'headphones':
    case 'headphone':
      return 'Headphones';
    case 'televisions':
    case 'television':
    case 'tv':
      return 'Television';
    case 'other':
      return 'Gadget';
    default:
      return product.product_type.trim() || 'Gadget';
  }
}
