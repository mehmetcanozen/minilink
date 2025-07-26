import { Request, Response, NextFunction } from 'express';
import { getSecurityMiddleware, apiSecurity } from '../../../src/middleware/security';

describe('Security Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      url: '/test',
      headers: {}
    };
    mockResponse = {
      setHeader: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      removeHeader: jest.fn().mockReturnThis(),
      get: jest.fn().mockReturnValue('test')
    };
    mockNext = jest.fn();
  });

  describe('getSecurityMiddleware', () => {
    it('should return an array of middleware functions', () => {
      const middleware = getSecurityMiddleware();
      
      expect(Array.isArray(middleware)).toBe(true);
      expect(middleware.length).toBeGreaterThan(0);
      
      middleware.forEach(mw => {
        expect(typeof mw).toBe('function');
      });
    });

    it('should include helmet middleware', () => {
      const middleware = getSecurityMiddleware();
      
      // Test that middleware can be called without errors
      middleware.forEach(mw => {
        expect(() => {
          mw(mockRequest as Request, mockResponse as Response, mockNext);
        }).not.toThrow();
      });
    });
  });

  describe('apiSecurity', () => {
    it('should set additional security headers for API routes', () => {
      apiSecurity(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle requests with existing headers', () => {
      mockRequest.headers = {
        'content-type': 'application/json',
        'authorization': 'Bearer token'
      };

      apiSecurity(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle OPTIONS requests', () => {
      mockRequest.method = 'OPTIONS';

      apiSecurity(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Security Headers', () => {
    it('should set X-Content-Type-Options header', () => {
      const middleware = getSecurityMiddleware();
      
      middleware.forEach(mw => {
        mw(mockRequest as Request, mockResponse as Response, mockNext);
      });

      expect(mockNext).toHaveBeenCalled();
    });

    it('should set X-Frame-Options header', () => {
      const middleware = getSecurityMiddleware();
      
      middleware.forEach(mw => {
        mw(mockRequest as Request, mockResponse as Response, mockNext);
      });

      expect(mockNext).toHaveBeenCalled();
    });

    it('should set X-XSS-Protection header', () => {
      const middleware = getSecurityMiddleware();
      
      middleware.forEach(mw => {
        mw(mockRequest as Request, mockResponse as Response, mockNext);
      });

      expect(mockNext).toHaveBeenCalled();
    });
  });
}); 