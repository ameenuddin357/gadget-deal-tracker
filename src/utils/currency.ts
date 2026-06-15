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
