import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodically prune expired rate limit records (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Creates a standard Express rate limiter middleware.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests from this IP or account, please try again later.',
    keyGenerator = (req: Request) => {
      const forwarded = req.headers['x-forwarded-for'];
      const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip) || 'unknown_ip';
      const userId = (req as any).user?.userId ? `_usr_${(req as any).user.userId}` : '';
      return `${req.baseUrl || req.path}:${ip}${userId}`;
    }
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();
    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      rateLimitStore.set(key, record);
    } else {
      record.count += 1;
    }

    // Set standard rate limit headers
    const remaining = Math.max(0, max - record.count);
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({
        status: 'fail',
        message
      });
      return;
    }

    next();
  };
}

/**
 * Preset rate limiters for distinct resource tiers:
 */

// 1. Authentication Limiter (prevents account creation bots and brute-force logins)
// 60 attempts per 15 minutes per IP
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many authentication attempts. Please try again in 15 minutes.'
});

// 2. AI Deal Advisor & Natural Language Parsing Limiter
// 30 requests per minute
export const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many AI requests. Please slow down.'
});

// 3. User Resource Mutations (Alerts, Watchlist, Search History)
// 60 mutations per minute per user/IP
export const userMutationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many actions recorded. Please slow down.'
});

// 4. Global API Baseline Rate Limiter
// 300 requests per minute per IP
export const globalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message: 'Too many requests. Please slow down.'
});
