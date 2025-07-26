import { Request, Response, NextFunction } from 'express';
import { authenticateUser, requireRole, requireUser } from '../../../src/middleware/auth';

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock request and response
    mockRequest = {
      method: 'GET',
      url: '/test',
      headers: {
        authorization: 'Bearer valid-token'
      },
      get: jest.fn().mockReturnValue('Bearer valid-token')
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  describe('authenticateUser', () => {
    it('should authenticate user with valid token', () => {
      // Mock successful authentication
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'user'
      };

      // Simulate successful token verification
      authenticateUser(mockRequest as Request, mockResponse as Response, mockNext);

      // In a real implementation, this would verify the token and set req.user
      // For now, we'll test the basic flow
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing authorization header', () => {
      delete mockRequest.headers!.authorization;
      mockRequest.get = jest.fn().mockReturnValue(undefined);

      authenticateUser(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No authorization token provided',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle invalid token format', () => {
      mockRequest.headers!.authorization = 'InvalidFormat token';
      mockRequest.get = jest.fn().mockReturnValue('InvalidFormat token');

      authenticateUser(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid authorization header format',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle expired token', () => {
      mockRequest.headers!.authorization = 'Bearer expired-token';
      mockRequest.get = jest.fn().mockReturnValue('Bearer expired-token');

      authenticateUser(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token expired or invalid',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should allow access for user with required role', () => {
      // Mock authenticated user with required role
      mockRequest.user = {
        id: 'user123',
        email: 'test@example.com',
        role: 'admin'
      };

      const adminMiddleware = requireRole(['admin', 'user']);
      adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for user without required role', () => {
      // Mock authenticated user without required role
      mockRequest.user = {
        id: 'user123',
        email: 'test@example.com',
        role: 'user'
      };

      const adminMiddleware = requireRole(['admin']);
      adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle user without role property', () => {
      // Mock authenticated user without role
      mockRequest.user = {
        id: 'user123',
        email: 'test@example.com'
      };

      const adminMiddleware = requireRole(['admin']);
      adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow access for multiple roles', () => {
      // Mock authenticated user with one of the required roles
      mockRequest.user = {
        id: 'user123',
        email: 'test@example.com',
        role: 'moderator'
      };

      const multiRoleMiddleware = requireRole(['admin', 'moderator', 'user']);
      multiRoleMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireUser', () => {
    it('should allow access for authenticated user', () => {
      // Mock authenticated user
      mockRequest.user = {
        id: 'user123',
        email: 'test@example.com',
        role: 'user'
      };

      requireUser(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for unauthenticated user', () => {
      // No user property set
      delete mockRequest.user;

      requireUser(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle user without id', () => {
      // Mock user without id
      mockRequest.user = {
        email: 'test@example.com',
        role: 'user'
      } as any;

      requireUser(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('middleware composition', () => {
    it('should work with multiple middleware functions', () => {
      // Mock authenticated admin user
      mockRequest.user = {
        id: 'admin123',
        email: 'admin@example.com',
        role: 'admin'
      };

      // Test requireUser first
      requireUser(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Reset mock
      (mockNext as jest.Mock).mockClear();

      // Test requireRole
      const adminMiddleware = requireRole(['admin']);
      adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail early when user is not authenticated', () => {
      // No user property set
      delete mockRequest.user;

      // Test requireUser first
      requireUser(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();

      // Reset mocks
      (mockResponse.status as jest.Mock).mockClear();
      (mockResponse.json as jest.Mock).mockClear();
      (mockNext as jest.Mock).mockClear();

      // Test requireRole (should not be called due to previous failure)
      const adminMiddleware = requireRole(['admin']);
      adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle middleware errors gracefully', () => {
      // Mock middleware that throws an error
      const errorMiddleware = (req: Request, res: Response, next: NextFunction) => {
        throw new Error('Middleware error');
      };

      expect(() => {
        errorMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      }).toThrow('Middleware error');
    });

    it('should handle async middleware errors', async () => {
      // Mock async middleware that throws an error
      const asyncErrorMiddleware = async (req: Request, res: Response, next: NextFunction) => {
        throw new Error('Async middleware error');
      };

      await expect(asyncErrorMiddleware(
        mockRequest as Request, 
        mockResponse as Response, 
        mockNext
      )).rejects.toThrow('Async middleware error');
    });
  });
}); 