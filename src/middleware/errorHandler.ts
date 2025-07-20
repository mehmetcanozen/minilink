import { Request, Response, NextFunction } from 'express';
import { InvalidUrlError, UrlNotFoundError, SlugGenerationError, ErrorResponse } from '../types';

// Error handling middleware - must be the last middleware
export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
  console.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Handle known application errors
  if (error instanceof InvalidUrlError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'INVALID_URL',
        message: error.message,
      },
    };
    res.status(400).json(response);
    return;
  }

  if (error instanceof UrlNotFoundError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'URL_NOT_FOUND',
        message: error.message,
      },
    };
    res.status(404).json(response);
    return;
  }

  if (error instanceof SlugGenerationError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'SLUG_GENERATION_ERROR',
        message: 'Unable to generate unique identifier. Please try again.',
      },
    };
    res.status(500).json(response);
    return;
  }

  // Handle database connection errors
  if (error.message.includes('Database') || error.message.includes('connection')) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Service temporarily unavailable. Please try again later.',
      },
    };
    res.status(503).json(response);
    return;
  }

  // Handle authorization errors
  if (error.message.includes('Unauthorized')) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: error.message,
      },
    };
    res.status(403).json(response);
    return;
  }

  // Handle rate limiting errors (for future implementation)
  if (error.message.includes('Rate limit')) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
      },
    };
    res.status(429).json(response);
    return;
  }

  // Default server error
  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    },
  };

  res.status(500).json(response);
}

// Not found middleware - for routes that don't exist
export function notFoundHandler(req: Request, res: Response): void {
  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  };

  res.status(404).json(response);
}

// Async error wrapper - wraps async route handlers to catch errors
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
} 