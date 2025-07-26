import { Pool } from 'pg';
import { databaseConfig } from './index';
import { logger } from '../middleware/logger';

class DatabaseConnectionError extends Error {
  constructor(message: string) {
    super(`Database Connection Error: ${message}`);
    this.name = 'DatabaseConnectionError';
  }
}

// Create a connection pool using DATABASE_URL
const pool = new Pool({
  connectionString: databaseConfig.connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export async function connectDatabase(): Promise<void> {
  try {
    const client = await pool.connect();
    logger.info('Database connection established successfully');
    client.release();
  } catch (error) {
    logger.error('Failed to connect to database', error as Error);
    throw new DatabaseConnectionError(`Failed to connect to database: ${error}`);
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await pool.end();
    logger.info('Database connection closed successfully');
  } catch (error) {
    logger.error('Error closing database connection', error as Error);
    throw new DatabaseConnectionError(`Failed to close database connection: ${error}`);
  }
}

export function getDatabase() {
  return pool;
}

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    logger.info('Database connection test successful', { currentTime: result.rows[0] });
    return true;
  } catch (error) {
    logger.error('Database connection test failed', error as Error);
    return false;
  }
}

export default pool; 