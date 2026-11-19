/**
 * Validate required environment variables and fail fast if critical security secrets are missing or placeholder.
 */
export function validateEnvironment(): void {
  const apiKey = process.env.RAPIDAPI_KEY;
  const googleHost = process.env.GOOGLE_SHOPPING_API_HOST;
  const flipkartHost = process.env.FLIPKART_API_HOST;
  const jwtSecret = process.env.JWT_SECRET;

  const placeholderKey = 'your_rapidapi_application_key_here';
  const defaultJwtPlaceholder = 'your_jwt_signing_token_key_change_me_in_production';
  const exampleJwtPlaceholder = 'replace_with_a_long_random_secret';

  console.log('[Env Validator] Starting environment configuration checks...');

  // JWT_SECRET is required in ALL environments for secure authentication & RBAC
  if (!jwtSecret || jwtSecret.trim() === '') {
    throw new Error(
      'CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing or empty. A secure JWT_SECRET must be configured in your environment.'
    );
  }

  if (jwtSecret === defaultJwtPlaceholder || jwtSecret === exampleJwtPlaceholder) {
    throw new Error(
      'CRITICAL SECURITY ERROR: JWT_SECRET is set to an insecure placeholder. A dedicated, random secret must be configured in your environment.'
    );
  }

  if (jwtSecret.length < 32) {
    throw new Error(
      `CRITICAL SECURITY ERROR: JWT_SECRET is too short (${jwtSecret.length} characters). JWT signing secrets must be at least 32 characters long (prefer 48–64+ random characters for production). Please set a secure private JWT_SECRET in your environment settings.`
    );
  }

  const emailVerificationEnabled = process.env.EMAIL_VERIFICATION_ENABLED === 'true';

  if (emailVerificationEnabled) {
    const emailVerificationSecret = process.env.EMAIL_VERIFICATION_SECRET;
    const defaultVerifyPlaceholder = 'replace_with_a_separate_long_random_secret_for_email_verification';

    // EMAIL_VERIFICATION_SECRET validation: separate from JWT_SECRET
    if (!emailVerificationSecret || emailVerificationSecret.trim() === '') {
      throw new Error(
        'CRITICAL SECURITY ERROR: EMAIL_VERIFICATION_SECRET environment variable is missing or empty. A dedicated secret must be configured in your environment for email verification tokens when EMAIL_VERIFICATION_ENABLED=true.'
      );
    }

    if (emailVerificationSecret === defaultVerifyPlaceholder) {
      throw new Error(
        'CRITICAL SECURITY ERROR: EMAIL_VERIFICATION_SECRET is set to an insecure placeholder. A dedicated, random secret must be configured in your environment.'
      );
    }

    if (emailVerificationSecret.length < 32) {
      throw new Error(
        `CRITICAL SECURITY ERROR: EMAIL_VERIFICATION_SECRET is too short (${emailVerificationSecret.length} characters). Verification signing secrets must be at least 32 characters long. Please configure a dedicated EMAIL_VERIFICATION_SECRET.`
      );
    }

    if (emailVerificationSecret === jwtSecret) {
      throw new Error(
        'CRITICAL SECURITY ERROR: EMAIL_VERIFICATION_SECRET must NOT match JWT_SECRET. Email verification tokens must be cryptographically separate from authentication tokens.'
      );
    }
  } else {
    console.log('[Env Validator] Email verification is currently disabled (EMAIL_VERIFICATION_ENABLED !== "true").');
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
