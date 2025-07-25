import { createClient } from 'redis';

// Use a more flexible type to avoid complex Redis generic issues
type RedisClient = ReturnType<typeof createClient>;

class RedisConnectionError extends Error {
  constructor(message: string) {
    super(`Redis Connection Error: ${message}`);
    this.name = 'RedisConnectionError';
  }
}

// Redis client instance
let redisClient: RedisClient | null = null;

// Redis configuration
export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  database: parseInt(process.env.REDIS_DB || '0', 10),
};

// Create Redis client
export function createRedisClient(): RedisClient {
  const client = createClient({
    socket: {
      host: redisConfig.host,
      port: redisConfig.port,
    },
    password: redisConfig.password,
    database: redisConfig.database,
  });

  // Error handling
  client.on('error', (err: Error) => {
    console.error('Redis Client Error:', err);
  });

  client.on('connect', () => {
    console.log('Redis client connected');
  });

  client.on('ready', () => {
    console.log('Redis client ready');
  });

  client.on('end', () => {
    console.log('Redis client disconnected');
  });

  return client;
}

// Connect to Redis
export async function connectRedis(): Promise<void> {
  try {
    if (!redisClient) {
      redisClient = createRedisClient();
    }
    
    await redisClient.connect();
    console.log('Redis connection established successfully');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw new RedisConnectionError(`Failed to connect to Redis: ${error}`);
  }
}

// Disconnect from Redis
export async function disconnectRedis(): Promise<void> {
  try {
    if (redisClient) {
      await redisClient.disconnect();
      redisClient = null;
      console.log('Redis connection closed successfully');
    }
  } catch (error) {
    console.error('Error closing Redis connection:', error);
    throw new RedisConnectionError(`Failed to close Redis connection: ${error}`);
  }
}

// Get Redis client
export function getRedisClient(): RedisClient {
  if (!redisClient) {
    throw new RedisConnectionError('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
}

// Test Redis connection
export async function testRedisConnection(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.ping();
    console.log('Redis connection test successful');
    return true;
  } catch (error) {
    console.error('Redis connection test failed:', error);
    return false;
  }
}

// Redis cache utilities
export class RedisCache {
  private client: RedisClient;

  constructor(client: RedisClient) {
    this.client = client;
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
      console.error(`Redis SET error for key ${key}:`, error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error);
      throw error;
    }
  }

  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (error) {
      console.error(`Redis DEL error for key ${key}:`, error);
      throw error;
    }
  }

  // JSON operations for complex objects
  async setJSON(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await this.set(key, jsonValue, ttlSeconds);
    } catch (error) {
      console.error(`Redis SET JSON error for key ${key}:`, error);
      throw error;
    }
  }

  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const value = await this.get(key);
      return value ? JSON.parse(value) as T : null;
    } catch (error) {
      console.error(`Redis GET JSON error for key ${key}:`, error);
      throw error;
    }
  }

  // Increment operations for click counting
  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      console.error(`Redis INCR error for key ${key}:`, error);
      throw error;
    }
  }

  async incrBy(key: string, increment: number): Promise<number> {
    try {
      return await this.client.incrBy(key, increment);
    } catch (error) {
      console.error(`Redis INCRBY error for key ${key}:`, error);
      throw error;
    }
  }

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Redis EXISTS error for key ${key}:`, error);
      throw error;
    }
  }

  // Set expiration
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      console.error(`Redis EXPIRE error for key ${key}:`, error);
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
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}

// Create cache instance
export function createRedisCache(): RedisCache {
  return new RedisCache(getRedisClient());
}

export default redisClient; 