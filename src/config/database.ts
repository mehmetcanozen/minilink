import { Pool, Client } from 'pg';
import { databaseConfig } from './index';

class DatabaseConnectionError extends Error {
  constructor(message: string) {
    super(`Database Connection Error: ${message}`);
    this.name = 'DatabaseConnectionError';
  }
}

// Create a connection pool for better performance and connection management
const pool = new Pool({
  host: databaseConfig.host,
  port: databaseConfig.port,
  database: databaseConfig.database,
  user: databaseConfig.username,
  password: databaseConfig.password,
  // Connection pool configuration
  max: 20, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Database connection functions
export async function connectDatabase(): Promise<void> {
  try {
    const client = await pool.connect();
    console.log('Database connection established successfully');
    client.release();
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw new DatabaseConnectionError(`Failed to connect to database: ${error}`);
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await pool.end();
    console.log('Database connection closed successfully');
  } catch (error) {
    console.error('Error closing database connection:', error);
    throw new DatabaseConnectionError(`Failed to close database connection: ${error}`);
  }
}

// Get database client from pool
export function getDatabase() {
  return pool;
}

// Test database connection
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    console.log('Database connection test successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

// Initialize database schema (migrations)
export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create URLs table
    const createUrlsTable = `
      CREATE TABLE IF NOT EXISTS urls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        original_url TEXT NOT NULL,
        short_slug VARCHAR(20) NOT NULL UNIQUE,
        click_count INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        user_id UUID NULL -- For future authentication
      );
    `;

    // Create indexes for better performance
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_urls_short_slug ON urls(short_slug);',
      'CREATE INDEX IF NOT EXISTS idx_urls_original_url ON urls(original_url);',
      'CREATE INDEX IF NOT EXISTS idx_urls_created_at ON urls(created_at);',
      'CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls(user_id) WHERE user_id IS NOT NULL;'
    ];

    // Create trigger function for updating updated_at timestamp
    const createTriggerFunction = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;

    // Create trigger for updating updated_at on URL updates
    const createTrigger = `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_urls_updated_at') THEN
          CREATE TRIGGER update_urls_updated_at
            BEFORE UPDATE ON urls
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END $$;
    `;

    // Execute all SQL statements
    await client.query(createUrlsTable);
    console.log('URLs table created successfully');

    for (const indexQuery of createIndexes) {
      await client.query(indexQuery);
    }
    console.log('Database indexes created successfully');

    await client.query(createTriggerFunction);
    await client.query(createTrigger);
    console.log('Database triggers created successfully');

    await client.query('COMMIT');
    console.log('Database initialization completed successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database initialization failed:', error);
    throw new DatabaseConnectionError(`Database initialization failed: ${error}`);
  } finally {
    client.release();
  }
}

export default pool; 