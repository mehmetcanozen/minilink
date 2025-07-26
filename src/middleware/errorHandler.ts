import { Request, Response, NextFunction } from 'express';
import { 
  InvalidUrlError, 
  UrlNotFoundError, 
  SlugGenerationError, 
  RepositoryError,
  DatabaseConnectionError,
  DuplicateResourceError,
  ResourceNotFoundError,
  ApiResponse 
} from '../types';
import { logger } from './logger';

// Helper function to create error responses with timestamp
function createErrorResponse(code: string, message: string): ApiResponse<null> {
  return {
    success: false,
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
    },
  };
}

// Error handling middleware
export function errorHandler(err: Error, req: Request, res: Response): void {
  // Use structured logging instead of console.error
  logger.error('Unhandled error in request', err, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Handle custom errors
  if (err instanceof InvalidUrlError) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'INVALID_URL',
        message: err.message,
        timestamp: new Date().toISOString(),
      },
    };
    res.status(400).json(response);
    return;
  }

  if (err instanceof UrlNotFoundError) {
    res.status(404).json(createErrorResponse('URL_NOT_FOUND', err.message));
    return;
  }

  if (err instanceof SlugGenerationError) {
    res.status(500).json(createErrorResponse('SLUG_GENERATION_ERROR', err.message));
    return;
  }

  // Handle repository errors
  if (err instanceof RepositoryError) {
    res.status(500).json(createErrorResponse('REPOSITORY_ERROR', err.message));
    return;
  }

  if (err instanceof DatabaseConnectionError) {
    res.status(503).json(createErrorResponse('DATABASE_CONNECTION_ERROR', err.message));
    return;
  }

  if (err instanceof DuplicateResourceError) {
    res.status(409).json(createErrorResponse('DUPLICATE_ERROR', err.message));
    return;
  }

  if (err instanceof ResourceNotFoundError) {
    res.status(404).json(createErrorResponse('RESOURCE_NOT_FOUND', err.message));
    return;
  }

  // Handle Prisma database errors with specific error codes
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as unknown as { code: string; message: string }; // Type assertion for Prisma error
    
    switch (prismaError.code) {
      case 'P2002': { // Unique constraint violation
        res.status(409).json(createErrorResponse('DUPLICATE_ERROR', 'Resource already exists (e.g., short code or original URL)'));
        return;
      }
      
      case 'P2025': { // Record not found
        res.status(404).json(createErrorResponse('URL_NOT_FOUND', 'The requested resource was not found'));
        return;
      }
      
      case 'P2003': { // Foreign key constraint violation
        res.status(400).json(createErrorResponse('RELATED_RESOURCE_ERROR', 'Related resource not found'));
        return;
      }
      
      default:
        // Log unknown Prisma errors for debugging
        logger.warn('Unhandled Prisma error', { code: prismaError.code, message: prismaError.message });
        break;
    }
  }

  // Handle database errors (fallback for non-Prisma errors)
  if (err.message.includes('duplicate key') || err.message.includes('already exists')) {
    res.status(409).json(createErrorResponse('DUPLICATE_ERROR', 'Resource already exists'));
    return;
  }

  // Handle unauthorized errors
  if (err.message.includes('Unauthorized')) {
    res.status(401).json(createErrorResponse('UNAUTHORIZED', 'Unauthorized access'));
    return;
  }

  // Handle rate limiting errors
  if (err.message.includes('Too many requests')) {
    res.status(429).json(createErrorResponse('RATE_LIMITED', 'Too many requests. Please try again later.'));
    return;
  }

  // Default server error - Generic message for production
  const isProduction = process.env.NODE_ENV === 'production';
  const message = isProduction 
    ? 'An unexpected internal server error occurred.' 
    : err.message;
  res.status(500).json(createErrorResponse('INTERNAL_ERROR', message));
}

// 404 handler for unmatched routes
export function notFoundHandler(req: Request, res: Response): void {
  logger.info('Route not found', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  res.status(404).json(createErrorResponse('NOT_FOUND', `Route ${req.method} ${req.path} not found`));
}

// Async handler wrapper to catch errors in async route handlers
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
} 