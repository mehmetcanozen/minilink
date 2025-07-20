import dotenv from 'dotenv';
import { AppConfig, DatabaseConfig } from '../types';
import path from 'path';

// Load environment variables from .env.development
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

class ConfigurationError extends Error {
  constructor(message: string) {
    super(`Configuration Error: ${message}`);
    this.name = 'ConfigurationError';
  }
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new ConfigurationError(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvVarAsNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new ConfigurationError(`Missing required environment variable: ${key}`);
  }
  
  const numValue = value ? parseInt(value, 10) : defaultValue!;
  if (isNaN(numValue)) {
    throw new ConfigurationError(`Environment variable ${key} must be a valid number`);
  }
  
  return numValue;
}

function createDatabaseConfig(): DatabaseConfig {
  // If DATABASE_URL is provided, use it; otherwise construct from individual components
  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl) {
    // Parse DATABASE_URL for individual components (for type consistency)
    const url = new URL(databaseUrl);
    return {
      url: databaseUrl,
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1), // Remove leading '/'
      username: url.username,
      password: url.password,
    };
  }

  // Fallback to individual environment variables
  return {
    host: getEnvVar('DB_HOST', 'localhost'),
    port: getEnvVarAsNumber('DB_PORT', 5432),
    database: getEnvVar('DB_NAME'),
    username: getEnvVar('DB_USER'),
    password: getEnvVar('DB_PASSWORD'),
  };
}

function createAppConfig(): AppConfig {
  return {
    port: getEnvVarAsNumber('PORT', 3000),
    nodeEnv: getEnvVar('NODE_ENV', 'development'),
    baseUrl: getEnvVar('BASE_URL', 'http://localhost:3000'),
    database: createDatabaseConfig(),
    nanoid: {
      alphabet: getEnvVar('NANOID_ALPHABET', '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'),
      length: getEnvVarAsNumber('NANOID_LENGTH', 7),
    },
  };
}

// Create and export the configuration instance
export const config = createAppConfig();

// Export configuration validation function
export function validateConfig(): void {
  try {
    // Test database configuration
    if (!config.database.host || !config.database.database || !config.database.username) {
      throw new ConfigurationError('Database configuration is incomplete');
    }

    // Test NanoID configuration
    if (config.nanoid.length < 4 || config.nanoid.length > 20) {
      throw new ConfigurationError('NANOID_LENGTH must be between 4 and 20 characters');
    }

    if (config.nanoid.alphabet.length < 10) {
      throw new ConfigurationError('NANOID_ALPHABET must contain at least 10 characters');
    }

    // Test port configuration
    if (config.port < 1 || config.port > 65535) {
      throw new ConfigurationError('PORT must be between 1 and 65535');
    }

    console.log('Configuration validation successful');
  } catch (error) {
    console.error('Configuration validation failed:', error);
    throw error;
  }
}

// Export individual configuration sections for convenience
export const databaseConfig = config.database;
export const serverConfig = {
  port: config.port,
  nodeEnv: config.nodeEnv,
  baseUrl: config.baseUrl,
};
export const nanoidConfig = config.nanoid; 