import { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler } from '../../../src/middleware/errorHandler';
import { InvalidUrlError, SlugGenerationError } from '../../../src/types';

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      url: '/test',
      headers: {},
      get: jest.fn().mockReturnValue('test-user-agent')
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  describe('notFoundHandler', () => {
    it('should return 404 status and error message', () => {
      notFoundHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining('not found'),
          timestamp: expect.any(String)
        }
      });
    });
  });

  describe('errorHandler', () => {
    it('should handle InvalidUrlError with 400 status', () => {
      const error = new InvalidUrlError('Invalid URL provided');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: 'Invalid URL provided',
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle SlugGenerationError with 500 status', () => {
      const error = new SlugGenerationError('Failed to generate unique slug');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'SLUG_GENERATION_ERROR',
          message: 'Failed to generate unique slug',
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle generic Error with 500 status', () => {
      const error = new Error('Generic error message');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Generic error message',
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle errors without message', () => {
      const error = new Error();
      
      errorHandler(error, mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: expect.any(String),
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle non-Error objects', () => {
      const error = 'String error';
      
      errorHandler(error as any, mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: expect.any(String),
          timestamp: expect.any(String)
        }
      });
    });
  });
}); 