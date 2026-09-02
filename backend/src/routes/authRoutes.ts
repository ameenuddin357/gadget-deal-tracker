import { Router } from 'express';
import { 
  register, 
  login, 
  forgotPassword, 
  validateResetToken, 
  resetPassword 
} from '../controllers/authController.ts';
import { authRateLimiter } from '../middleware/rateLimiter.ts';

const router = Router();

// Apply dedicated rate limiting on authentication routes
router.use(authRateLimiter);

// Endpoint routes mapped to respective controller methods
// POST /api/auth/register -> creates user profiles
router.post('/register', register);

// POST /api/auth/login -> logs users in
router.post('/login', login);

// POST /api/auth/forgot-password -> sends password reset email
router.post('/forgot-password', forgotPassword);

// GET /api/auth/reset-password/validate -> validates reset token pre-flight
router.get('/reset-password/validate', validateResetToken);

// POST /api/auth/reset-password -> resets password with valid token
router.post('/reset-password', resetPassword);

export default router;
