import { createClient } from 'redis';
import { redisConfig } from './index';
import { logger } from '../middleware/logger';

type RedisClient = ReturnType<typeof createClient>;

class RedisConnectionError extends Error {
  constructor(message: string) {
    super(`Redis Connection Error: ${message}`);
    this.name = 'RedisConnectionError';
  }
}

// Module-level singleton Redis client
const client: RedisClient = createClient({
  socket: {
    host: redisConfig.host,
    port: redisConfig.port,
  },
  password: redisConfig.password,
  database: redisConfig.database,
});

client.on('error', (err: Error) => {
  logger.error('Redis Client Error', err);
});

client.on('connect', () => {
  logger.info('Redis client connected');
});

client.on('ready', () => {
  logger.info('Redis client ready');
});

client.on('end', () => {
  logger.info('Redis client disconnected');
});

export async function connectRedis(): Promise<void> {
  try {
    await client.connect();
    logger.info('Redis connection established successfully');
  } catch (error) {
    logger.error('Failed to connect to Redis', error as Error);
    throw new RedisConnectionError(`Failed to connect to Redis: ${error}`);
  }
}

export async function disconnectRedis(): Promise<void> {
  try {
    await client.disconnect();
    logger.info('Redis connection closed successfully');
  } catch (error) {
    logger.error('Error closing Redis connection', error as Error);
    throw new RedisConnectionError(`Failed to close Redis connection: ${error}`);
  }
}

export function getRedisClient(): RedisClient {
  return client;
}

export async function testRedisConnection(): Promise<boolean> {
  try {
    await client.ping();
    logger.info('Redis connection test successful');
    return true;
  } catch (error) {
    logger.error('Redis connection test failed', error as Error);
    return false;
  }
}

// Redis cache utilities
export class RedisCache {
  private client: RedisClient;

  constructor() {
    this.client = getRedisClient();
  }

  // Basic key-value operations
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error(`Redis SET error for key ${key}`, error as Error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error(`Redis GET error for key ${key}`, error as Error);
      throw error;
    }
  }

  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}`, error as Error);
      throw error;
    }
  }

  // JSON operations for complex objects
  async setJSON(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await this.set(key, jsonValue, ttlSeconds);
    } catch (error) {
      logger.error(`Redis SET JSON error for key ${key}`, error as Error);
      throw error;
    }
  }

  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const value = await this.get(key);
      return value ? JSON.parse(value) as T : null;
    } catch (error) {
      logger.error(`Redis GET JSON error for key ${key}`, error as Error);
      throw error;
    }
  }

  // Increment operations for click counting
  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error(`Redis INCR error for key ${key}`, error as Error);
      throw error;
    }
  }

  async incrBy(key: string, increment: number): Promise<number> {
    try {
      return await this.client.incrBy(key, increment);
    } catch (error) {
      logger.error(`Redis INCRBY error for key ${key}`, error as Error);
      throw error;
    }
  }

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return Boolean(result);
    } catch (error) {
      logger.error(`Redis EXISTS error for key ${key}`, error as Error);
      throw error;
    }
  }

  // Set expiration
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, seconds);
      return Boolean(result);
    } catch (error) {
      logger.error(`Redis EXPIRE error for key ${key}`, error as Error);
      throw error;
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      // Test basic operations
      const testKey = 'health_check';
      await this.set(testKey, 'test', 10);
      const result = await this.get(testKey);
      await this.del(testKey);
      return result === 'test';
    } catch (error) {
      logger.error('Redis health check failed', error as Error);
      return false;
    }
  }
}

// Create cache instance
export function createRedisCache(): RedisCache {
  return new RedisCache();
}

export default client; 