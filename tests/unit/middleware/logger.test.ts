import { Request, Response, NextFunction } from 'express';
import { 
  requestLogger, 
  corsHeaders, 
  requestSizeLimit, 
  jsonParser,
  logger 
} from '../../../src/middleware/logger';

// Mock the logger
jest.mock('../../../src/middleware/logger', () => {
  const originalModule = jest.requireActual('../../../src/middleware/logger');
  return {
    ...originalModule,
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }
  };
});

describe('Logger Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      url: '/test',
      headers: {
        'user-agent': 'test-agent',
        'x-forwarded-for': '192.168.1.1'
      },
      ip: '127.0.0.1',
      get: jest.fn().mockImplementation((header: string) => {
        if (header === 'User-Agent') return mockRequest.headers!['user-agent'];
        if (header === 'Referer') return mockRequest.headers!['referer'];
        if (header === 'Content-Length') return mockRequest.headers!['content-length'];
        return undefined;
      })
    };
    mockResponse = {
      statusCode: 200,
      get: jest.fn().mockReturnValue('100'),
      setHeader: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  describe('requestLogger', () => {
    it('should log request information', () => {
      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle requests without user-agent', () => {
      delete mockRequest.headers!['user-agent'];
      
      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle requests without x-forwarded-for', () => {
      delete mockRequest.headers!['x-forwarded-for'];
      
      requestLogger(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('corsHeaders', () => {
    it('should set CORS headers', () => {
      const setHeaderSpy = jest.spyOn(mockResponse, 'setHeader');

      corsHeaders(mockRequest as Request, mockResponse as Response, mockNext);

      expect(setHeaderSpy).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      expect(setHeaderSpy).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      expect(setHeaderSpy).toHaveBeenCalledWith('Access-Control-Max-Age', '86400');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requestSizeLimit', () => {
    it('should create middleware with specified limit', () => {
      const middleware = requestSizeLimit('1mb');
      expect(typeof middleware).toBe('function');
    });

    it('should handle requests within size limit', () => {
      const middleware = requestSizeLimit('1mb');
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('jsonParser', () => {
    it('should parse JSON requests', () => {
      const jsonData = { test: 'data' };
      mockRequest.body = JSON.stringify(jsonData);
      mockRequest.headers!['content-type'] = 'application/json';

      jsonParser(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle non-JSON requests', () => {
      mockRequest.headers!['content-type'] = 'text/plain';

      jsonParser(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle requests without content-type', () => {
      delete mockRequest.headers!['content-type'];

      jsonParser(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
}); 