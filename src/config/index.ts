import * as dotenv from 'dotenv';
import * as path from 'path';

// Load base .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
// Load environment-specific .env file with override
if (process.env.NODE_ENV) {
  dotenv.config({ path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV}`), override: true });
}

// Define configuration interfaces
export interface DatabaseConfig {
  connectionString: string;
  provider: 'pg' | 'prisma';
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  database: number;
}

export interface ServerConfig {
  port: number;
  baseUrl: string;
}

export interface NanoidConfig {
  size: number;
  alphabet: string;
}

export interface QueueConfig {
  maintenanceIntervalMs: number;
  healthCheckIntervalMs: number;
  expiredUrlCleanupIntervalMs: number;
  initialCleanupDelayMs: number;
}

export interface AppConfig {
  nodeEnv: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  server: ServerConfig;
  nanoid: NanoidConfig;
  queue: QueueConfig;
}

// Database configuration
export const databaseConfig: DatabaseConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:@localhost:5432/minilink',
  provider: (process.env.DB_PROVIDER as 'pg' | 'prisma') || 'prisma',
};

// Redis configuration
export const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  database: parseInt(process.env.REDIS_DB || '0', 10),
};

// Server configuration
export const serverConfig: ServerConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || '3000'}`,
};

// Nanoid configuration (use safer alphabet from README)
export const nanoidConfig: NanoidConfig = {
  size: parseInt(process.env.NANOID_SIZE || '8', 10),
  alphabet: process.env.NANOID_ALPHABET || 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789',
};

// Queue configuration
export const queueConfig: QueueConfig = {
  maintenanceIntervalMs: parseInt(process.env.QUEUE_MAINTENANCE_INTERVAL_MS || '3600000', 10), // 1 hour
  healthCheckIntervalMs: parseInt(process.env.QUEUE_HEALTH_CHECK_INTERVAL_MS || '300000', 10), // 5 minutes
  expiredUrlCleanupIntervalMs: parseInt(process.env.EXPIRED_URL_CLEANUP_INTERVAL_MS || '21600000', 10), // 6 hours
  initialCleanupDelayMs: parseInt(process.env.INITIAL_CLEANUP_DELAY_MS || '300000', 10), // 5 minutes
};

// Combined configuration
export const config: AppConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  database: databaseConfig,
  redis: redisConfig,
  server: serverConfig,
  nanoid: nanoidConfig,
  queue: queueConfig,
};

// Configuration validation
export function validateConfig(): void {
  // Require DATABASE_URL
  if (!process.env.DATABASE_URL) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }

  // Validate port numbers
  if (isNaN(redisConfig.port) || redisConfig.port <= 0) {
    throw new Error('REDIS_PORT must be a valid positive number');
  }

  if (isNaN(serverConfig.port) || serverConfig.port <= 0) {
    throw new Error('PORT must be a valid positive number');
  }

  if (isNaN(nanoidConfig.size) || nanoidConfig.size <= 0) {
    throw new Error('NANOID_SIZE must be a valid positive number');
  }

  // Validate queue configuration
  if (isNaN(queueConfig.maintenanceIntervalMs) || queueConfig.maintenanceIntervalMs <= 0) {
    throw new Error('QUEUE_MAINTENANCE_INTERVAL_MS must be a valid positive number');
  }

  if (isNaN(queueConfig.healthCheckIntervalMs) || queueConfig.healthCheckIntervalMs <= 0) {
    throw new Error('QUEUE_HEALTH_CHECK_INTERVAL_MS must be a valid positive number');
  }

  if (isNaN(queueConfig.expiredUrlCleanupIntervalMs) || queueConfig.expiredUrlCleanupIntervalMs <= 0) {
    throw new Error('EXPIRED_URL_CLEANUP_INTERVAL_MS must be a valid positive number');
  }

  if (isNaN(queueConfig.initialCleanupDelayMs) || queueConfig.initialCleanupDelayMs <= 0) {
    throw new Error('INITIAL_CLEANUP_DELAY_MS must be a valid positive number');
  }

  // Validate database provider
  if (!['pg', 'prisma'].includes(databaseConfig.provider)) {
    throw new Error('DB_PROVIDER must be either "pg" or "prisma"');
  }

  console.log(`✅ Configuration validation passed (DB Provider: ${databaseConfig.provider})`);
}

export default config; 