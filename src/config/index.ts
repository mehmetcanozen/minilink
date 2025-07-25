import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.development
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

// Define configuration interfaces
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  provider: 'pg' | 'prisma'; // Choose database implementation
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

export interface AppConfig {
  nodeEnv: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  server: ServerConfig;
  nanoid: NanoidConfig;
}

// Database configuration
export const databaseConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'minilink',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  provider: (process.env.DB_PROVIDER as 'pg' | 'prisma') || 'prisma', // Default to Prisma
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

// Nanoid configuration
export const nanoidConfig: NanoidConfig = {
  size: parseInt(process.env.NANOID_SIZE || '8', 10),
  alphabet: process.env.NANOID_ALPHABET || '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
};

// Combined configuration
export const config: AppConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  database: databaseConfig,
  redis: redisConfig,
  server: serverConfig,
  nanoid: nanoidConfig,
};

// Configuration validation
export function validateConfig(): void {
  const requiredEnvVars = [
    'DB_HOST',
    'DB_PORT', 
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate port numbers
  if (isNaN(databaseConfig.port) || databaseConfig.port <= 0) {
    throw new Error('DB_PORT must be a valid positive number');
  }

  if (isNaN(redisConfig.port) || redisConfig.port <= 0) {
    throw new Error('REDIS_PORT must be a valid positive number');
  }

  if (isNaN(serverConfig.port) || serverConfig.port <= 0) {
    throw new Error('PORT must be a valid positive number');
  }

  if (isNaN(nanoidConfig.size) || nanoidConfig.size <= 0) {
    throw new Error('NANOID_SIZE must be a valid positive number');
  }

  // Validate database provider
  if (!['pg', 'prisma'].includes(databaseConfig.provider)) {
    throw new Error('DB_PROVIDER must be either "pg" or "prisma"');
  }

  console.log(`✅ Configuration validation passed (DB Provider: ${databaseConfig.provider})`);
}

export default config; 