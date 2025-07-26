import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// Enhanced security middleware using Helmet
export const enhancedSecurity = helmet({
  // Content Security Policy - Production hardened
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'", 
        "https://cdn.jsdelivr.net", // Bootstrap CDN
        "https://cdnjs.cloudflare.com" // Font Awesome CDN
        // Removed 'unsafe-inline' for production security
      ],
      scriptSrc: [
        "'self'", 
        "https://cdn.jsdelivr.net", // QR Code library
        "https://cdnjs.cloudflare.com"
        // Removed 'unsafe-inline' and 'unsafe-eval' for production security
      ],
      fontSrc: [
        "'self'",
        "https://cdnjs.cloudflare.com", // Font Awesome fonts
        "data:" // Allow data: URIs for fonts
      ],
      imgSrc: [
        "'self'",
        "data:", // Allow data: URIs for images (QR codes)
        "https:" // Allow HTTPS images
      ],
      connectSrc: ["'self'"], // Removed ws: and wss: for production
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },

  // Cross-Origin Embedder Policy - Enable for better security
  crossOriginEmbedderPolicy: { policy: "require-corp" },

  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: { policy: "same-origin" },

  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: { policy: "cross-origin" },

  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },

  // Frameguard (X-Frame-Options)
  frameguard: { action: 'deny' },

  // Hide Powered-By header
  hidePoweredBy: true,

  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },

  // IE No Open
  ieNoOpen: true,

  // No Sniff (X-Content-Type-Options)
  noSniff: true,

  // Origin Agent Cluster
  originAgentCluster: true,

  // Permitted Cross-Domain Policies
  permittedCrossDomainPolicies: false,

  // Referrer Policy
  referrerPolicy: { policy: "no-referrer" },

  // X-XSS-Protection
  xssFilter: true,
});

// Additional custom security middleware
export function additionalSecurity(req: Request, res: Response, next: NextFunction): void {
  try {
    // Remove Server header
    res.removeHeader('Server');
    
    // Set additional custom headers
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Expect-CT', 'max-age=86400, enforce');
    
    // Set Cache-Control for static assets vs dynamic content
    if (req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/images/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    next();
  } catch (error) {
    logger.error('Error in additionalSecurity middleware', error as Error);
    next();
  }
}

// Development vs Production security configuration
export function getSecurityMiddleware() {
  if (process.env.NODE_ENV === 'production') {
    return [enhancedSecurity, additionalSecurity];
  } else {
    // More relaxed CSP for development
    return [
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https:"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"],
            fontSrc: ["'self'", "https:", "data:"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'", "ws:", "wss:"], // Allow WebSocket for dev tools
          },
        },
        hsts: false, // Disable HSTS in development
        crossOriginEmbedderPolicy: false, // Disable for development compatibility
      }),
      additionalSecurity
    ];
  }
}

// Security headers for API responses
export function apiSecurity(req: Request, res: Response, next: NextFunction): void {
  try {
    // JSON-specific security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Prevent caching of API responses
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    next();
  } catch (error) {
    logger.error('Error in apiSecurity middleware', error as Error);
    next();
  }
} 