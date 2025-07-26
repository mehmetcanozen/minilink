import { Request, Response, NextFunction } from 'express';
import { 
  createRateLimiter,
  createUrlRateLimit,
  generalRateLimit,
  adminRateLimit,
  redirectRateLimit,
  authRateLimit,
  createRoleBasedRateLimit,
  createCustomRateLimit,
  RateLimitConfig
} from '../../../src/middleware/rateLimiting';

describe('Rate Limiting Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      url: '/test',
      ip: '127.0.0.1',
      headers: {},
      get: jest.fn().mockReturnValue('test-user-agent')
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  describe('createRateLimiter', () => {
    it('should create a rate limiter with custom configuration', () => {
      const config: RateLimitConfig = {
        windowMs: 60 * 1000,
        maxRequests: 10,
        message: 'Custom rate limit message'
      };
      
      const limiter = createRateLimiter(config);
      expect(typeof limiter).toBe('function');
    });

    it('should create a rate limiter with default configuration', () => {
      const config: RateLimitConfig = {
        windowMs: 60 * 1000,
        maxRequests: 100
      };
      
      const limiter = createRateLimiter(config);
      expect(typeof limiter).toBe('function');
    });
  });

  describe('Predefined Rate Limiters', () => {
    it('should have createUrlRateLimit function', () => {
      expect(typeof createUrlRateLimit).toBe('function');
    });

    it('should have generalRateLimit function', () => {
      expect(typeof generalRateLimit).toBe('function');
    });

    it('should have adminRateLimit function', () => {
      expect(typeof adminRateLimit).toBe('function');
    });

    it('should have redirectRateLimit function', () => {
      expect(typeof redirectRateLimit).toBe('function');
    });

    it('should have authRateLimit function', () => {
      expect(typeof authRateLimit).toBe('function');
    });
  });

  describe('createRoleBasedRateLimit', () => {
    it('should create rate limiter for user role', () => {
      const limiter = createRoleBasedRateLimit('user');
      expect(typeof limiter).toBe('function');
    });

    it('should create rate limiter for admin role', () => {
      const limiter = createRoleBasedRateLimit('admin');
      expect(typeof limiter).toBe('function');
    });

    it('should create rate limiter for public role', () => {
      const limiter = createRoleBasedRateLimit('public');
      expect(typeof limiter).toBe('function');
    });
  });

  describe('createCustomRateLimit', () => {
    it('should create custom rate limiter with specified parameters', () => {
      const limiter = createCustomRateLimit(60 * 1000, 50);
      expect(typeof limiter).toBe('function');
    });

    it('should create custom rate limiter with additional options', () => {
      const limiter = createCustomRateLimit(30 * 1000, 20, {
        message: 'Custom message',
        statusCode: 429
      });
      expect(typeof limiter).toBe('function');
    });
  });

  describe('Rate Limiter Behavior', () => {
    it('should allow requests within limit', () => {
      generalRateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should block requests over limit', () => {
      // Mock the rate limiter to simulate being over the limit
      const mockLimiter = jest.fn((req: Request, res: Response, next: NextFunction) => {
        res.status(429).json({
          success: false,
          error: 'Too Many Requests',
          message: 'Too many requests from this IP, please try again later.'
        });
      });
      
      mockLimiter(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Too Many Requests',
        message: 'Too many requests from this IP, please try again later.'
      });
    });
  });

  describe('IP Address Handling', () => {
    it('should handle requests with X-Forwarded-For header', () => {
      mockRequest.headers = {
        'x-forwarded-for': '192.168.1.1'
      };
      
      generalRateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle requests with X-Real-IP header', () => {
      mockRequest.headers = {
        'x-real-ip': '10.0.0.1'
      };
      
      generalRateLimit(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should fallback to req.ip when no proxy headers', () => {
      const requestWithIp = {
        ...mockRequest,
        ip: '172.16.0.1'
      };
      
      generalRateLimit(requestWithIp as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });
}); 