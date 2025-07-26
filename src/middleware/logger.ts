import { Request, Response, NextFunction } from 'express';
import express from 'express';

// Structured logging interfaces and utilities
export interface LogLevel {
  ERROR: 'error';
  WARN: 'warn';
  INFO: 'info';
  DEBUG: 'debug';
}

export const LOG_LEVELS: LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
};

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  error?: Error;
  context?: Record<string, unknown>;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatLog(level: string, message: string, error?: Error, context?: Record<string, unknown>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      error: error || undefined,
      context: context || undefined,
    };
  }

  private output(entry: LogEntry): void {
    if (this.isDevelopment) {
      // Development: Pretty console output
      const prefix = `[${entry.timestamp}] ${entry.level.toUpperCase()}:`;
      console.log(prefix, entry.message);
      
      if (entry.error) {
        console.error(entry.error);
      }
      
      if (entry.context) {
        console.log('Context:', entry.context);
      }
    } else {
      // Production: JSON structured logging
      console.log(JSON.stringify(entry));
    }
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    const entry = this.formatLog(LOG_LEVELS.ERROR, message, error, context);
    this.output(entry);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    const entry = this.formatLog(LOG_LEVELS.WARN, message, undefined, context);
    this.output(entry);
  }

  info(message: string, context?: Record<string, unknown>): void {
    const entry = this.formatLog(LOG_LEVELS.INFO, message, undefined, context);
    this.output(entry);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.isDevelopment) {
      const entry = this.formatLog(LOG_LEVELS.DEBUG, message, undefined, context);
      this.output(entry);
    }
  }
}

// Export structured logger instance
export const logger = new Logger();

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  // Log the incoming request
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    contentLength: req.get('Content-Length'),
  });

  // Override res.end to log the response
  const originalEnd = res.end;
  res.end = function(chunk?: unknown, encoding?: unknown): Response {
    const duration = Date.now() - startTime;
    
    logger.info(`${req.method} ${req.url} - ${res.statusCode}`, {
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      ip: req.ip,
    });

    // Call the original end method
    originalEnd.call(this, chunk, encoding as BufferEncoding);
    return this;
  };

  next();
}

// Security headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  try {
    // Remove Express signature
    res.removeHeader('X-Powered-By');
    
    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    
    next();
  } catch (error) {
    logger.error('Error in securityHeaders middleware', error as Error);
    next();
  }
}

// CORS middleware - Fixed configuration
export function corsHeaders(req: Request, res: Response, next: NextFunction): void {
  try {
    // Allow specific origins in production, all in development
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? ['https://yourdomain.com'] // Replace with your actual domain
      : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];
    
    const origin = req.get('Origin');
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      // Only set credentials to true if origin is specific (not *)
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    next();
  } catch (error) {
    logger.error('Error in corsHeaders middleware', error as Error);
    next();
  }
}

// Request size limiter
export function requestSizeLimit(maxSize: string = '10mb') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const contentLength = req.get('Content-Length');
      
      if (contentLength) {
        const sizeInBytes = parseInt(contentLength, 10);
        const maxSizeInBytes = parseSize(maxSize);
        
        if (sizeInBytes > maxSizeInBytes) {
          res.status(413).json({
            success: false,
            error: {
              code: 'REQUEST_TOO_LARGE',
              message: `Request size exceeds limit of ${maxSize}`,
            },
          });
          return;
        }
      }
      
      next();
    } catch (error) {
      logger.error('Error in requestSizeLimit middleware', error as Error);
      next();
    }
  };
}

// Helper function to parse size strings like '10mb', '1kb', etc.
function parseSize(size: string): number {
  const units: { [key: string]: number } = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024,
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]*)$/);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  
  return Math.floor(value * (units[unit] || 1));
}

// Rate limiting has been moved to src/middleware/rateLimiting.ts
// This file now focuses on logging, security headers, and request parsing

// Express JSON parser middleware - Replaces custom jsonParser
export const jsonParser = express.json({ 
  limit: '10mb',
  strict: true,
  type: 'application/json'
});

// Express URL-encoded parser middleware
export const urlencodedParser = express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
});

 