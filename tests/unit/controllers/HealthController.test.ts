import { Request, Response } from 'express';
import { HealthController } from '../../../src/controllers/HealthController';
import { getPrismaClient } from '../../../src/config/prisma';
import { getRedisClient } from '../../../src/config/redis';
import { getQueueManager } from '../../../src/queues/QueueManager';

// Mock dependencies
jest.mock('../../../src/config/prisma');
jest.mock('../../../src/config/redis');
jest.mock('../../../src/queues/QueueManager');

describe('HealthController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockPrismaClient: any;
  let mockRedisClient: any;
  let mockQueueManager: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock request and response
    mockRequest = {
      method: 'GET',
      url: '/api/health',
      headers: {},
      get: jest.fn().mockReturnValue('test-user-agent')
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    // Setup mock Prisma client
    mockPrismaClient = {
      $queryRaw: jest.fn(),
      $disconnect: jest.fn()
    };
    (getPrismaClient as jest.Mock).mockReturnValue(mockPrismaClient);

    // Setup mock Redis client
    mockRedisClient = {
      ping: jest.fn(),
      isReady: true
    };
    (getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);

    // Setup mock Queue manager
    mockQueueManager = {
      isHealthy: jest.fn(),
      getAllQueueStats: jest.fn()
    };
    (getQueueManager as jest.Mock).mockReturnValue(mockQueueManager);
  });

  describe('check', () => {
    it('should return healthy status when all services are healthy', async () => {
      // Mock successful health checks
      mockPrismaClient.$queryRaw.mockResolvedValue([{ result: 1 }]);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockQueueManager.isHealthy.mockResolvedValue(true);
      mockQueueManager.getAllQueueStats.mockResolvedValue({
        'click-processing': { waiting: 0, active: 0, completed: 100 },
        'cache-sync': { waiting: 0, active: 0, completed: 50 }
      });

      await HealthController.check(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          healthy: true,
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          memory: expect.any(Object),
          version: expect.any(String),
          environment: expect.any(String),
          services: {
            database: {
              provider: 'prisma',
              healthy: true
            },
            redis: {
              healthy: true
            },
            queues: {
              healthy: true
            }
          },
          overall: 'healthy'
        }
      });
    });

    it('should return unhealthy status when database is down', async () => {
      // Mock database failure
      mockPrismaClient.$queryRaw.mockRejectedValue(new Error('Database connection failed'));
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockQueueManager.isHealthy.mockResolvedValue(true);

      await HealthController.check(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        data: {
          healthy: false,
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          memory: expect.any(Object),
          version: expect.any(String),
          environment: expect.any(String),
          services: {
            database: {
              provider: 'prisma',
              healthy: false
            },
            redis: {
              healthy: true
            },
            queues: {
              healthy: true
            }
          },
          overall: 'unhealthy'
        }
      });
    });

    it('should return unhealthy status when Redis is down', async () => {
      // Mock Redis failure
      mockPrismaClient.$queryRaw.mockResolvedValue([{ result: 1 }]);
      mockRedisClient.ping.mockRejectedValue(new Error('Redis connection failed'));
      mockQueueManager.isHealthy.mockResolvedValue(true);

      await HealthController.check(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        data: {
          healthy: false,
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          memory: expect.any(Object),
          version: expect.any(String),
          environment: expect.any(String),
          services: {
            database: {
              provider: 'prisma',
              healthy: true
            },
            redis: {
              healthy: false
            },
            queues: {
              healthy: true
            }
          },
          overall: 'unhealthy'
        }
      });
    });

    it('should return unhealthy status when queues are down', async () => {
      // Mock queue failure
      mockPrismaClient.$queryRaw.mockResolvedValue([{ result: 1 }]);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockQueueManager.isHealthy.mockResolvedValue(false);

      await HealthController.check(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        data: {
          healthy: false,
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          memory: expect.any(Object),
          version: expect.any(String),
          environment: expect.any(String),
          services: {
            database: {
              provider: 'prisma',
              healthy: true
            },
            redis: {
              healthy: true
            },
            queues: {
              healthy: false
            }
          },
          overall: 'unhealthy'
        }
      });
    });

    it('should handle Redis not ready state', async () => {
      // Mock Redis not ready
      mockPrismaClient.$queryRaw.mockResolvedValue([{ result: 1 }]);
      mockRedisClient.isReady = false;
      mockRedisClient.ping.mockRejectedValue(new Error('Redis not ready'));
      mockQueueManager.isHealthy.mockResolvedValue(true);

      await HealthController.check(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        data: {
          healthy: false,
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          memory: expect.any(Object),
          version: expect.any(String),
          environment: expect.any(String),
          services: {
            database: {
              provider: 'prisma',
              healthy: true
            },
            redis: {
              healthy: false
            },
            queues: {
              healthy: true
            }
          },
          overall: 'unhealthy'
        }
      });
    });

    it('should include queue statistics when available', async () => {
      // Mock successful health checks with queue stats
      mockPrismaClient.$queryRaw.mockResolvedValue([{ result: 1 }]);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockQueueManager.isHealthy.mockResolvedValue(true);
      mockQueueManager.getAllQueueStats.mockResolvedValue({
        'click-processing': { waiting: 5, active: 2, completed: 1000 },
        'cache-sync': { waiting: 0, active: 1, completed: 500 },
        'expired-url-cleanup': { waiting: 0, active: 0, completed: 50 }
      });

      await HealthController.check(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      const responseData = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseData.data.healthy).toBe(true);
      expect(responseData.data.services.queues.healthy).toBe(true);
    });

    it('should handle queue manager errors gracefully', async () => {
      // Mock queue manager error
      mockPrismaClient.$queryRaw.mockResolvedValue([{ result: 1 }]);
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockQueueManager.isHealthy.mockRejectedValue(new Error('Queue manager error'));

      await HealthController.check(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      const responseData = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseData.data.services.queues.healthy).toBe(false);
      expect(responseData.data.overall).toBe('unhealthy');
    });
  });
}); 