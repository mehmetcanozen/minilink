import { Pool } from 'pg';
import { UrlRepository as IUrlRepository, UrlEntity } from '../types';
import { Url } from '../models/Url';
import { getDatabase } from '../config/database';
import { logger } from '../middleware/logger';

// Custom error types for better error handling
export class RepositoryError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class DatabaseConnectionError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'DatabaseConnectionError';
  }
}

export class DuplicateResourceError extends Error {
  constructor(message: string, public readonly resource?: string) {
    super(message);
    this.name = 'DuplicateResourceError';
  }
}

export class ResourceNotFoundError extends Error {
  constructor(message: string, public readonly resource?: string) {
    super(message);
    this.name = 'ResourceNotFoundError';
  }
}

export class UrlRepository implements IUrlRepository {
  private pool: Pool;

  constructor() {
    this.pool = getDatabase();
  }

  async create(urlData: Omit<UrlEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<UrlEntity> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO urls (original_url, short_slug, click_count, expires_at, user_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      
      const values = [
        urlData.originalUrl,
        urlData.shortSlug,
        urlData.clickCount,
        urlData.expiresAt || null,
        urlData.userId || null
      ];

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        throw new RepositoryError('Failed to create URL record');
      }

      return Url.fromDatabaseRow(result.rows[0]);
    } catch (error: unknown) {
      // Handle unique constraint violation (duplicate slug)
      if (this.isPostgreSQLError(error) && error.code === '23505') {
        if (error.constraint === 'urls_short_slug_key') {
          throw new DuplicateResourceError(`Short slug '${urlData.shortSlug}' already exists`, urlData.shortSlug);
        }
      }
      
      logger.error('Error creating URL', error as Error, { shortSlug: urlData.shortSlug });
      throw new RepositoryError(`Failed to create URL: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    } finally {
      client.release();
    }
  }

  async findBySlug(slug: string): Promise<UrlEntity | null> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM urls
        WHERE short_slug = $1
      `;
      
      const result = await client.query(query, [slug]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return Url.fromDatabaseRow(result.rows[0]);
    } catch (error: unknown) {
      logger.error('Error finding URL by slug', error as Error, { slug });
      throw new RepositoryError(`Failed to find URL by slug: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<UrlEntity | null> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM urls
        WHERE id = $1
      `;
      
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return Url.fromDatabaseRow(result.rows[0]);
    } catch (error: unknown) {
      logger.error('Error finding URL by ID', error as Error, { id });
      throw new RepositoryError(`Failed to find URL by ID: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    } finally {
      client.release();
    }
  }

  async findByOriginalUrl(originalUrl: string): Promise<UrlEntity | null> {
    const client = await this.pool.connect();
    
    try {
      // Normalize the URL for comparison
      const normalizedUrl = Url.normalizeUrl(originalUrl);
      
      const query = `
        SELECT * FROM urls
        WHERE original_url = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const result = await client.query(query, [normalizedUrl]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return Url.fromDatabaseRow(result.rows[0]);
    } catch (error: unknown) {
      logger.error('Error finding URL by original URL', error as Error, { originalUrl });
      throw new RepositoryError(`Failed to find URL by original URL: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    } finally {
      client.release();
    }
  }

  async incrementClickCount(slug: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        UPDATE urls
        SET click_count = click_count + 1,
            updated_at = NOW()
        WHERE short_slug = $1
        RETURNING *
      `;
      
      const result = await client.query(query, [slug]);
      
      if (result.rows.length === 0) {
        throw new ResourceNotFoundError(`URL with slug '${slug}' not found`, slug);
      }
    } catch (error: unknown) {
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      
      logger.error('Error incrementing click count', error as Error, { slug });
      throw new RepositoryError(`Failed to increment click count: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    } finally {
      client.release();
    }
  }

  // Bulk increment click count by a specific amount
  async bulkIncrementClickCount(slug: string, incrementAmount: number): Promise<void> {
    if (incrementAmount <= 0) return;

    const client = await this.pool.connect();
    
    try {
      const query = `
        UPDATE urls
        SET click_count = click_count + $2,
            updated_at = NOW()
        WHERE short_slug = $1
        RETURNING *
      `;
      
      const result = await client.query(query, [slug, incrementAmount]);
      
      if (result.rows.length === 0) {
        throw new ResourceNotFoundError(`URL with slug '${slug}' not found`, slug);
      }
    } catch (error: unknown) {
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      
      logger.error('Error bulk incrementing click count', error as Error, { slug, incrementAmount });
      throw new RepositoryError(`Failed to bulk increment click count: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    } finally {
      client.release();
    }
  }

  // Additional utility methods for better functionality

  async findByUserId(userId: string, limit: number = 50, offset: number = 0): Promise<UrlEntity[]> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM urls
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      
      const result = await client.query(query, [userId, limit, offset]);
      
      return result.rows.map(row => Url.fromDatabaseRow(row));
    } catch (error: unknown) {
      logger.error('Error finding URLs by user ID', error as Error, { userId, limit, offset });
      throw new RepositoryError(`Failed to find URLs by user ID: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    } finally {
      client.release();
    }
  }

  async getTotalUrlCount(): Promise<number> {
    const client = await this.pool.connect();
    
    try {
      const query = 'SELECT COUNT(*) as total FROM urls';
      const result = await client.query(query);
      
      return parseInt(result.rows[0].total, 10);
    } catch (error: unknown) {
      logger.error('Error getting total URL count', error as Error);
      throw new RepositoryError(`Failed to get total URL count: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    } finally {
      client.release();
    }
  }

  async getTotalClickCount(): Promise<number> {
    const client = await this.pool.connect();
    
    try {
      const query = 'SELECT SUM(click_count) as total FROM urls';
      const result = await client.query(query);
      
      return parseInt(result.rows[0].total, 10) || 0;
    } catch (error: unknown) {
      logger.error('Error getting total click count', error as Error);
      throw new RepositoryError(`Failed to get total click count: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    } finally {
      client.release();
    }
  }

  async getPopularUrls(limit: number = 10): Promise<UrlEntity[]> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM urls
        WHERE click_count > 0
        ORDER BY click_count DESC, created_at DESC
        LIMIT $1
      `;
      
      const result = await client.query(query, [limit]);
      
      return result.rows.map(row => Url.fromDatabaseRow(row));
    } catch (error: unknown) {
      logger.error('Error getting popular URLs', error as Error, { limit });
      throw new RepositoryError(`Failed to get popular URLs: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    } finally {
      client.release();
    }
  }

  async getRecentUrls(limit: number = 10): Promise<UrlEntity[]> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM urls
        ORDER BY created_at DESC
        LIMIT $1
      `;
      
      const result = await client.query(query, [limit]);
      
      return result.rows.map(row => Url.fromDatabaseRow(row));
    } catch (error: unknown) {
      logger.error('Error getting recent URLs', error as Error, { limit });
      throw new RepositoryError(`Failed to get recent URLs: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    } finally {
      client.release();
    }
  }

  async getExpiredUrls(limit: number = 100): Promise<UrlEntity[]> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM urls
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
        ORDER BY expires_at ASC
        LIMIT $1
      `;
      
      const result = await client.query(query, [limit]);
      
      return result.rows.map(row => Url.fromDatabaseRow(row));
    } catch (error: unknown) {
      logger.error('Error getting expired URLs', error as Error, { limit });
      throw new RepositoryError(`Failed to get expired URLs: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    } finally {
      client.release();
    }
  }

  async deleteExpiredUrls(): Promise<number> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        DELETE FROM urls
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
      `;
      
      const result = await client.query(query);
      
      logger.info('Deleted expired URLs', { count: result.rowCount || 0 });
      return result.rowCount || 0;
    } catch (error: unknown) {
      logger.error('Error deleting expired URLs', error as Error);
      throw new RepositoryError(`Failed to delete expired URLs: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    } finally {
      client.release();
    }
  }

  async deleteById(id: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = 'DELETE FROM urls WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rowCount === null || result.rowCount === 0) {
        throw new ResourceNotFoundError(`URL with id '${id}' not found`, id);
      }
    } catch (error: unknown) {
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      
      logger.error('Error deleting URL by ID', error as Error, { id });
      throw new RepositoryError(`Failed to delete URL: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    } finally {
      client.release();
    }
  }

  async deleteBySlug(slug: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = 'DELETE FROM urls WHERE short_slug = $1';
      const result = await client.query(query, [slug]);
      
      if (result.rowCount === null || result.rowCount === 0) {
        throw new ResourceNotFoundError(`URL with slug '${slug}' not found`, slug);
      }
    } catch (error: unknown) {
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      
      logger.error('Error deleting URL by slug', error as Error, { slug });
      throw new RepositoryError(`Failed to delete URL: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    } finally {
      client.release();
    }
  }

  // PERFORMANCE IMPROVEMENT: Optimized bulk operations
  async createMany(urls: Omit<UrlEntity, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<UrlEntity[]> {
    if (urls.length === 0) {
      return [];
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Use a single INSERT statement with multiple VALUES for better performance
      const placeholders: string[] = [];
      const values: unknown[] = [];
      let placeholderIndex = 1;
      
      for (const urlData of urls) {
        placeholders.push(`($${placeholderIndex}, $${placeholderIndex + 1}, $${placeholderIndex + 2}, $${placeholderIndex + 3}, $${placeholderIndex + 4})`);
        values.push(
          urlData.originalUrl,
          urlData.shortSlug,
          urlData.clickCount,
          urlData.expiresAt || null,
          urlData.userId || null
        );
        placeholderIndex += 5;
      }
      
      const query = `
        INSERT INTO urls (original_url, short_slug, click_count, expires_at, user_id)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (short_slug) DO NOTHING
        RETURNING *
      `;
      
      const result = await client.query(query, values);
      
      await client.query('COMMIT');
      
      logger.info('Bulk created URLs', { 
        requested: urls.length, 
        created: result.rows.length,
        skipped: urls.length - result.rows.length 
      });
      
      return result.rows.map(row => Url.fromDatabaseRow(row));
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      logger.error('Error creating multiple URLs', error as Error, { count: urls.length });
      throw new RepositoryError(`Failed to create URLs: ${error instanceof Error ? error.message : String(error)}`, error as Error);
    } finally {
      client.release();
    }
  }

  // Helper method to check if error is a PostgreSQL error
  private isPostgreSQLError(error: unknown): error is { code: string; constraint?: string; message: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code: string }).code === 'string'
    );
  }

  // Cleanup method for graceful shutdown
  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      logger.info('PostgreSQL repository disconnected successfully');
    } catch (error: unknown) {
      logger.error('Error disconnecting PostgreSQL repository', error as Error);
      throw new RepositoryError('Failed to disconnect PostgreSQL repository', error as Error);
    }
  }
} 