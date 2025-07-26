import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from './logger';

/**
 * Rate limiting configuration interface
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string | object;
  statusCode?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Create a rate limiter with the specified configuration
 */
export function createRateLimiter(config: RateLimitConfig) {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.maxRequests,
    message: config.message || {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.',
        timestamp: new Date().toISOString(),
      },
    },
    statusCode: config.statusCode || 429,
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    skipFailedRequests: config.skipFailedRequests || false,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')?.substring(0, 100),
        limit: config.maxRequests,
        windowMs: config.windowMs,
      });
      
      res.status(config.statusCode || 429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later.',
          timestamp: new Date().toISOString(),
          retryAfter: Math.ceil(config.windowMs / 1000),
        },
      });
    },
  });
}

/**
 * Predefined rate limiters for different use cases
 */

// URL creation rate limiter (strict)
export const createUrlRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
  message: {
    success: false,
    error: {
      code: 'URL_CREATION_RATE_LIMIT',
      message: 'Too many URL creation requests. Please wait before creating more URLs.',
      timestamp: new Date().toISOString(),
    },
  },
});

// General API rate limiter
export const generalRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
});

// Admin rate limiter (more restrictive)
export const adminRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 requests per minute
});

// Redirect rate limiter (high traffic)
export const redirectRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 1000, // 1000 requests per minute
});

// Authentication rate limiter (very strict)
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT',
      message: 'Too many authentication attempts. Please try again later.',
      timestamp: new Date().toISOString(),
    },
  },
});

// Health check rate limiter (moderate)
export const healthCheckRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
});

/**
 * Dynamic rate limiter based on user role
 */
export function createRoleBasedRateLimit(role: 'user' | 'admin' | 'public') {
  const limits = {
    user: { windowMs: 60 * 1000, maxRequests: 100 },
    admin: { windowMs: 60 * 1000, maxRequests: 200 },
    public: { windowMs: 60 * 1000, maxRequests: 50 },
  };
  
  return createRateLimiter(limits[role]);
}

/**
 * IP-based rate limiter for suspicious activity
 */
export const suspiciousActivityRateLimit = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 10, // 10 requests per 5 minutes
  message: {
    success: false,
    error: {
      code: 'SUSPICIOUS_ACTIVITY',
      message: 'Suspicious activity detected. Please try again later.',
      timestamp: new Date().toISOString(),
    },
  },
});

/**
 * Custom rate limiter for specific endpoints
 */
export function createCustomRateLimit(
  windowMs: number,
  maxRequests: number,
  options: Partial<RateLimitConfig> = {}
) {
  return createRateLimiter({
    windowMs,
    maxRequests,
    ...options,
  });
} 