import { Pool } from 'pg';
import { UrlRepository as IUrlRepository, UrlEntity } from '../types';
import { Url } from '../models/Url';
import { getDatabase } from '../config/database';

export class UrlRepository implements IUrlRepository {
  private pool: Pool;

  constructor() {
    this.pool = getDatabase();
  }

  async create(urlData: Omit<UrlEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<UrlEntity> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO urls (original_url, short_slug, click_count, user_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      const values = [
        urlData.originalUrl,
        urlData.shortSlug,
        urlData.clickCount,
        urlData.userId || null
      ];

      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Failed to create URL record');
      }

      return Url.fromDatabaseRow(result.rows[0]);
    } catch (error: unknown) {
      // Handle unique constraint violation (duplicate slug)
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        'constraint' in error &&
        (error as { code: string; constraint: string }).code === '23505' &&
        (error as { code: string; constraint: string }).constraint === 'urls_short_slug_key'
      ) {
        throw new Error(`Short slug '${urlData.shortSlug}' already exists`);
      }
      
      console.error('Error creating URL:', error);
      throw new Error(`Failed to create URL: ${error instanceof Error ? error.message : String(error)}`);
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
      console.error('Error finding URL by slug:', error);
      throw new Error(`Failed to find URL by slug: ${error instanceof Error ? error.message : String(error)}`);
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
      console.error('Error finding URL by ID:', error);
      throw new Error(`Failed to find URL by ID: ${error instanceof Error ? error.message : String(error)}`);
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
      console.error('Error finding URL by original URL:', error);
      throw new Error(`Failed to find URL by original URL: ${error instanceof Error ? error.message : String(error)}`);
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
        throw new Error(`URL with slug '${slug}' not found`);
      }
    } catch (error: unknown) {
      console.error('Error incrementing click count:', error);
      throw new Error(`Failed to increment click count: ${error instanceof Error ? error.message : String(error)}`);
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
        throw new Error(`URL with slug '${slug}' not found`);
      }
    } catch (error: unknown) {
      console.error('Error bulk incrementing click count:', error);
      throw new Error(`Failed to bulk increment click count: ${error instanceof Error ? error.message : String(error)}`);
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
      console.error('Error finding URLs by user ID:', error);
      throw new Error(`Failed to find URLs by user ID: ${error instanceof Error ? error.message : String(error)}`);
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
      console.error('Error getting total URL count:', error);
      throw new Error(`Failed to get total URL count: ${error instanceof Error ? error.message : String(error)}`);
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
      console.error('Error getting total click count:', error);
      throw new Error(`Failed to get total click count: ${error instanceof Error ? error.message : String(error)}`);
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
      console.error('Error getting popular URLs:', error);
      throw new Error(`Failed to get popular URLs: ${error instanceof Error ? error.message : String(error)}`);
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
      console.error('Error getting recent URLs:', error);
      throw new Error(`Failed to get recent URLs: ${error instanceof Error ? error.message : String(error)}`);
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
        throw new Error(`URL with id '${id}' not found`);
      }
    } catch (error: unknown) {
      console.error('Error deleting URL by ID:', error);
      throw new Error(`Failed to delete URL: ${error instanceof Error ? error.message : String(error)}`);
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
        throw new Error(`URL with slug '${slug}' not found`);
      }
    } catch (error: unknown) {
      console.error('Error deleting URL by slug:', error);
      throw new Error(`Failed to delete URL: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }

  // Batch operations for potential future use
  async createMany(urls: Omit<UrlEntity, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<UrlEntity[]> {
    if (urls.length === 0) {
      return [];
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const createdUrls: UrlEntity[] = [];
      
      for (const urlData of urls) {
        const query = `
          INSERT INTO urls (original_url, short_slug, click_count, user_id)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;
        
        const values = [
          urlData.originalUrl,
          urlData.shortSlug,
          urlData.clickCount,
          urlData.userId || null
        ];

        const result = await client.query(query, values);
        if (result.rows.length > 0) {
          createdUrls.push(Url.fromDatabaseRow(result.rows[0]));
        }
      }
      
      await client.query('COMMIT');
      return createdUrls;
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      console.error('Error creating multiple URLs:', error);
      throw new Error(`Failed to create URLs: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }
} 