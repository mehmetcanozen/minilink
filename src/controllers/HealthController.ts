import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import { logger } from '../middleware/logger';
import { config } from '../config';
import { getRedisClient } from '../config/redis';
import { getPrismaClient } from '../config/prisma';


export class HealthController {
  static async check(req: Request, res: Response): Promise<void> {
    try {
      const healthData: Record<string, unknown> = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.nodeEnv,
      };

      // Check database health
      let databaseHealthy = false;
      let databaseProvider = 'unknown';
      
      try {
        if (config.database.provider === 'prisma') {
          databaseProvider = 'prisma';
          const prisma = getPrismaClient();
          await prisma.$queryRaw`SELECT 1`;
          databaseHealthy = true;
        } else {
          databaseProvider = 'pg';
          const { getDatabase } = await import('../config/database');
          const pool = getDatabase();
          await pool.query('SELECT 1');
          databaseHealthy = true;
        }
      } catch (error) {
        logger.error('Database health check failed', error as Error);
        databaseHealthy = false;
      }

      // Check Redis health
      let redisHealthy = false;
      try {
        const redis = getRedisClient();
        await redis.ping();
        redisHealthy = true;
      } catch (error) {
        logger.error('Redis health check failed', error as Error);
        redisHealthy = false;
      }

      // Check queue health
      let queuesHealthy = false;
      try {
        const { getQueueManager } = await import('../queues/QueueManager');
        const queueManager = getQueueManager();
        const queueHealth = await queueManager.isHealthy();
        queuesHealthy = queueHealth;
        healthData.queues = { healthy: queueHealth };
      } catch (error) {
        logger.error('Queue health check failed', error as Error);
        queuesHealthy = false;
      }

      // Overall health status
      const overallHealthy = databaseHealthy && redisHealthy && queuesHealthy;
      const statusCode = overallHealthy ? 200 : 503;

      healthData.services = {
        database: { provider: databaseProvider, healthy: databaseHealthy },
        redis: { healthy: redisHealthy },
        queues: { healthy: queuesHealthy },
      };

      healthData.overall = overallHealthy ? 'healthy' : 'unhealthy';

      const response: ApiResponse<Record<string, unknown>> = {
        success: overallHealthy,
        data: healthData,
      };

      logger.info('Health check completed', {
        database: { provider: databaseProvider, healthy: databaseHealthy },
        redis: { healthy: redisHealthy },
        queues: { healthy: queuesHealthy },
        overall: overallHealthy,
      });

      res.status(statusCode).json(response);
    } catch (error) {
      logger.error('Health check error', error as Error);
      
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: 'Health check failed',
          timestamp: new Date().toISOString(),
        },
      };
      
      res.status(503).json(response);
    }
  }
} 