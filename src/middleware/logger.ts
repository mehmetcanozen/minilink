import { Request, Response, NextFunction } from 'express';

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  // Log the incoming request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    contentLength: req.get('Content-Length'),
  });

  // Override res.end to log the response
  const originalEnd = res.end;
  res.end = function(chunk?: unknown, encoding?: unknown): Response {
    const duration = Date.now() - startTime;
    
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode}`, {
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
  // Remove Express signature
  res.removeHeader('X-Powered-By');
  
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  next();
}

// CORS middleware (for future API usage)
export function corsHeaders(req: Request, res: Response, next: NextFunction): void {
  // Allow specific origins in production, all in development
  const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] // Replace with your actual domain
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];
  
  const origin = req.get('Origin');
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
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
}

// Request size limiter
export function requestSizeLimit(maxSize: string = '10mb') {
  return (req: Request, res: Response, next: NextFunction): void => {
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

// Rate limiting preparation (basic implementation)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function basicRateLimit(options: { windowMs: number; maxRequests: number } = { windowMs: 60000, maxRequests: 100 }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - options.windowMs;
    
    // Clean up old entries
    for (const [key, data] of requestCounts.entries()) {
      if (data.resetTime < windowStart) {
        requestCounts.delete(key);
      }
    }
    
    // Get or create client data
    let clientData = requestCounts.get(clientId);
    if (!clientData || clientData.resetTime < windowStart) {
      clientData = { count: 0, resetTime: now + options.windowMs };
      requestCounts.set(clientId, clientData);
    }
    
    // Check rate limit
    if (clientData.count >= options.maxRequests) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
        },
      });
      return;
    }
    
    // Increment counter
    clientData.count++;
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', options.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (options.maxRequests - clientData.count).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(clientData.resetTime / 1000).toString());
    
    next();
  };
}

// JSON parsing middleware with error handling
export function jsonParser(req: Request, res: Response, next: NextFunction): void {
  if (req.get('Content-Type')?.includes('application/json')) {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        if (body) {
          req.body = JSON.parse(body);
        } else {
          req.body = {};
        }
      } catch {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Invalid JSON in request body',
          },
        });
        return;
      }
      
      next();
    });
    
    req.on('error', () => {
      res.status(400).json({
        success: false,
        error: {
          code: 'REQUEST_ERROR',
          message: 'Error reading request body',
        },
      });
    });
  } else {
    req.body = {};
    next();
  }
}

// Health check middleware
export function healthCheck(req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
    },
  });
} 