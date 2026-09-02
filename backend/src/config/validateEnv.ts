/**
 * Validate required environment variables and log clear non-crashing warnings if they are missing or still placeholder values.
 */
export function validateEnvironment(): void {
  const apiKey = process.env.RAPIDAPI_KEY;
  const googleHost = process.env.GOOGLE_SHOPPING_API_HOST;
  const flipkartHost = process.env.FLIPKART_API_HOST;
  const jwtSecret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  const placeholderKey = 'your_rapidapi_application_key_here';

  console.log('[Env Validator] Starting environment configuration checks...');

  if (isProduction && (!jwtSecret || jwtSecret.trim() === '' || jwtSecret === 'your_jwt_signing_token_key_change_me_in_production')) {
    console.error('❌ CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing or set to placeholder in production environment!');
  }

  if (!apiKey || apiKey.trim() === '' || apiKey === placeholderKey) {
    console.warn('⚠️  RAPIDAPI_KEY is not set or set to placeholder. External API synchronization is inactive.');
  }

  if (!googleHost || googleHost.trim() === '') {
    console.warn('⚠️  GOOGLE_SHOPPING_API_HOST is not set. Google Shopping sync is inactive.');
  }

  if (!flipkartHost || flipkartHost.trim() === '' || flipkartHost.includes('<flipkart-host-placeholder>')) {
    console.warn('⚠️  FLIPKART_API_HOST is not set or set to placeholder. Flipkart sync is inactive.');
  }
}
