import { Pool } from 'pg';
import { config } from '../../src/config';

let testPool: Pool;

export async function setupTestDatabase(): Promise<Pool> {
  if (testPool) {
    return testPool;
  }

  // Parse connection string to extract database components
  const connectionString = config.database.connectionString;
  const url = new URL(connectionString);
  
  // Create a test database connection
  testPool = new Pool({
    host: url.hostname,
    port: parseInt(url.port, 10),
    database: url.pathname.slice(1) + '_test', // Remove leading slash and add _test suffix
    user: url.username,
    password: url.password,
    max: 5, // Lower connection limit for tests
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 1000,
  });

  return testPool;
}

export async function teardownTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.end();
  }
}

export async function cleanDatabase(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('TRUNCATE TABLE urls CASCADE');
  } finally {
    client.release();
  }
}

export async function seedTestData(pool: Pool, urls: any[]): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const url of urls) {
      await client.query(`
        INSERT INTO urls (id, original_url, short_slug, click_count, created_at, updated_at, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        url.id,
        url.originalUrl,
        url.shortSlug,
        url.clickCount,
        url.createdAt,
        url.updatedAt,
        url.userId || null
      ]);
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Mock repository factory for unit tests
export function createMockRepository() {
  return {
    create: jest.fn(),
    findBySlug: jest.fn(),
    findById: jest.fn(),
    findByOriginalUrl: jest.fn(),
    incrementClickCount: jest.fn(),
    findByUserId: jest.fn(),
    getTotalUrlCount: jest.fn(),
    getTotalClickCount: jest.fn(),
    getPopularUrls: jest.fn(),
    getRecentUrls: jest.fn(),
    deleteById: jest.fn(),
    deleteBySlug: jest.fn(),
    createMany: jest.fn()
  };
} 