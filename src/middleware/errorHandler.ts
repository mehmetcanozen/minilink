import { Request, Response, NextFunction } from 'express';
import { InvalidUrlError, UrlNotFoundError, SlugGenerationError, ApiResponse } from '../types';

// Error handling middleware
export function errorHandler(err: Error, req: Request, res: Response): void {
  console.error('Error:', err);

  // Handle custom errors
  if (err instanceof InvalidUrlError) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'INVALID_URL',
        message: err.message,
      },
    };
    res.status(400).json(response);
    return;
  }

  if (err instanceof UrlNotFoundError) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'URL_NOT_FOUND',
        message: err.message,
      },
    };
    res.status(404).json(response);
    return;
  }

  if (err instanceof SlugGenerationError) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'SLUG_GENERATION_ERROR',
        message: err.message,
      },
    };
    res.status(500).json(response);
    return;
  }

  // Handle database errors
  if (err.message.includes('duplicate key') || err.message.includes('already exists')) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'DUPLICATE_ERROR',
        message: 'Resource already exists',
      },
    };
    res.status(409).json(response);
    return;
  }

  // Handle unauthorized errors
  if (err.message.includes('Unauthorized')) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized access',
      },
    };
    res.status(401).json(response);
    return;
  }

  // Handle rate limiting errors
  if (err.message.includes('Too many requests')) {
    const response: ApiResponse<null> = {
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
  const response: ApiResponse<null> = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  };
  res.status(500).json(response);
}

// 404 handler for unmatched routes
export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiResponse<null> = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  };
  res.status(404).json(response);
}

// Async handler wrapper to catch errors in async route handlers
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
} 