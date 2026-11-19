import { Router } from 'express';
import { 
  register, 
  login, 
  forgotPassword, 
  validateResetToken, 
  resetPassword,
  getMe,
  verifyEmail,
  resendVerification
} from '../controllers/authController.ts';
import { authRateLimiter, verificationResendLimiter } from '../middleware/rateLimiter.ts';
import { protect } from '../middleware/auth.ts';

const router = Router();

// Apply dedicated rate limiting on authentication routes
router.use(authRateLimiter);

// Endpoint routes mapped to respective controller methods
// GET /api/auth/me -> returns database-verified current user details
router.get('/me', protect, getMe);

// POST /api/auth/register -> creates user profiles (requires email verification)
router.post('/register', register);

// POST /api/auth/login -> logs users in (requires is_verified=true)
router.post('/login', login);

// POST /api/auth/verify-email -> verifies email token and marks is_verified=true
router.post('/verify-email', verifyEmail);

// POST /api/auth/resend-verification -> generates and resends verification token
router.post('/resend-verification', verificationResendLimiter, resendVerification);

// POST /api/auth/forgot-password -> sends password reset email
router.post('/forgot-password', forgotPassword);

// GET /api/auth/reset-password/validate -> validates reset token pre-flight
router.get('/reset-password/validate', validateResetToken);

// POST /api/auth/reset-password -> resets password with valid token
router.post('/reset-password', resetPassword);

export default router;
