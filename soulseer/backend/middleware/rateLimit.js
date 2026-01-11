/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting request frequency
 */

import logger from '../utils/logger.js';

// Store rate limit data in memory (in production, use Redis)
const rateLimits = new Map();

/**
 * Clean up old rate limit entries
 */
function cleanup() {
  const now = Date.now();
  for (const [key, data] of rateLimits.entries()) {
    if (data.resetTime < now) {
      rateLimits.delete(key);
    }
  }
}

// Run cleanup every minute
setInterval(cleanup, 60000);

/**
 * Create rate limiter
 */
export const createRateLimiter = ({
  windowMs = 60000, // Time window in milliseconds (default: 1 minute)
  maxRequests = 100, // Max requests per window
  message = 'Too many requests, please try again later',
  keyGenerator = (req) => req.ip // Function to generate unique key
} = {}) => {
  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const resetTime = now + windowMs;

    // Get or create rate limit data
    let data = rateLimits.get(key);

    if (!data || data.resetTime < now) {
      data = {
        count: 0,
        resetTime
      };
      rateLimits.set(key, data);
    }

    // Check if limit exceeded
    if (data.count >= maxRequests) {
      logger.warn('Rate limit exceeded', { key, count: data.count, maxRequests });
      
      return res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil((data.resetTime - now) / 1000)
      });
    }

    // Increment counter
    data.count++;
    rateLimits.set(key, data);

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - data.count);
    res.setHeader('X-RateLimit-Reset', Math.ceil(data.resetTime / 1000));

    next();
  };
};

// Predefined rate limiters for different routes

/**
 * General API rate limiter (100 requests per minute)
 */
export const apiLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 100,
  message: 'Too many API requests, please slow down'
});

/**
 * Auth rate limiter (5 requests per minute) - stricter for auth endpoints
 */
export const authLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 5,
  message: 'Too many authentication attempts, please try again later',
  keyGenerator: (req) => `${req.ip}-auth`
});

/**
 * Session rate limiter (10 requests per minute) - for session operations
 */
export const sessionLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 10,
  message: 'Too many session requests, please slow down',
  keyGenerator: (req) => `${req.ip}-session`
});

/**
 * Payment rate limiter (5 requests per minute) - stricter for payments
 */
export const paymentLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 5,
  message: 'Too many payment attempts, please try again later',
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.dbUserId ? `${req.dbUserId}-payment` : `${req.ip}-payment`;
  }
});

/**
 * Post creation rate limiter (3 posts per minute)
 */
export const postLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 3,
  message: 'Too many posts, please slow down',
  keyGenerator: (req) => {
    return req.dbUserId ? `${req.dbUserId}-post` : `${req.ip}-post`;
  }
});

/**
 * Message rate limiter (20 messages per minute)
 */
export const messageLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 20,
  message: 'Too many messages, please slow down',
  keyGenerator: (req) => {
    return req.dbUserId ? `${req.dbUserId}-message` : `${req.ip}-message`;
  }
});

/**
 * Search rate limiter (30 searches per minute)
 */
export const searchLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 30,
  message: 'Too many searches, please slow down'
});

export default {
  createRateLimiter,
  apiLimiter,
  authLimiter,
  sessionLimiter,
  paymentLimiter,
  postLimiter,
  messageLimiter,
  searchLimiter
};