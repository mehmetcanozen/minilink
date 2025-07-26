import { generateSlugs } from '../../utils/slugGenerator';
import { getRedisClient } from '../../config/redis';
import { logger } from '../../middleware/logger';

export interface ShortCodePoolJob {
  count: number;
  priority?: number;
}

export class ShortCodePoolJobHandler {
  private readonly POOL_KEY = 'short_code_pool';
  private readonly MIN_POOL_SIZE = 100;
  private readonly MAX_POOL_SIZE = 1000;

  constructor() {
    // No initialization needed - we'll get the client when needed
  }

  async process(job: { data: ShortCodePoolJob }): Promise<void> {
    const { count } = job.data;

    try {
      logger.info(`Generating ${count} short codes for pool`);

      // Generate new slugs
      const newSlugs = generateSlugs(count);
      
      // Add to Redis pool
      await this.addSlugsToPool(newSlugs);
      
      // Check if we need to generate more
      await this.ensurePoolSize();
      
      const poolSize = await this.getPoolSize();
      logger.info(`Generated ${newSlugs.length} short codes`, { poolSize });

    } catch (error) {
      logger.error('Failed to process short code pool job', error as Error, { count });
      throw error;
    }
  }

  private async addSlugsToPool(slugs: string[]): Promise<void> {
    try {
      const redis = getRedisClient();
      
      // Add each slug to the pool with a TTL of 24 hours
      for (const slug of slugs) {
        await redis.setEx(`${this.POOL_KEY}:${slug}`, 24 * 60 * 60, 'available');
      }
      
      // Update pool size counter
      const currentSize = await this.getPoolSize();
      await redis.set(`${this.POOL_KEY}:size`, currentSize + slugs.length);
      
      logger.debug(`Added ${slugs.length} slugs to pool`, { newSize: currentSize + slugs.length });
    } catch (error) {
      logger.error('Failed to add slugs to pool', error as Error, { slugCount: slugs.length });
      throw error;
    }
  }

  private async getPoolSize(): Promise<number> {
    try {
      const redis = getRedisClient();
      const size = await redis.get(`${this.POOL_KEY}:size`);
      return size ? parseInt(size, 10) : 0;
    } catch (error) {
      logger.error('Failed to get pool size', error as Error);
      return 0;
    }
  }

  private async ensurePoolSize(): Promise<void> {
    try {
      const currentSize = await this.getPoolSize();
      
      if (currentSize < this.MIN_POOL_SIZE) {
        const needed = this.MIN_POOL_SIZE - currentSize;
        logger.info(`Pool size below minimum, scheduling generation of ${needed} more codes`, { 
          currentSize, 
          minSize: this.MIN_POOL_SIZE, 
          needed 
        });
        
        // Schedule another job to generate more codes
        const { getQueueManager } = await import('../QueueManager');
        const queueManager = getQueueManager();
        
        await queueManager.addJob(
          'short-code-pool',
          'generate-more-codes',
          { count: needed },
          { priority: 1, delay: 5000 } // 5 second delay
        );
      }
    } catch (error) {
      logger.error('Failed to ensure pool size', error as Error);
    }
  }

  // Get a slug from the pool
  async getSlugFromPool(): Promise<string | null> {
    try {
      const redis = getRedisClient();
      
      // Get a random slug from the pool
      const keys = await redis.keys(`${this.POOL_KEY}:*`);
      const availableKeys = keys.filter((key: string) => !key.endsWith(':size'));
      
      if (availableKeys.length === 0) {
        logger.warn('No slugs available in pool');
        return null;
      }
      
      const randomKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
      const slug = randomKey.replace(`${this.POOL_KEY}:`, '');
      
      // Remove from pool (atomic operation)
      const removed = await redis.del(randomKey);
      
      if (removed > 0) {
        // Update pool size
        const currentSize = await this.getPoolSize();
        await redis.set(`${this.POOL_KEY}:size`, Math.max(0, currentSize - 1));
        
        logger.debug(`Retrieved slug from pool`, { slug, remainingSize: Math.max(0, currentSize - 1) });
        return slug;
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to get slug from pool', error as Error);
      return null;
    }
  }

  // Get pool statistics
  async getPoolStats(): Promise<{
    size: number;
    minSize: number;
    maxSize: number;
    keys: string[];
  }> {
    try {
      const redis = getRedisClient();
      const size = await this.getPoolSize();
      const keys = await redis.keys(`${this.POOL_KEY}:*`);
      const availableKeys = keys.filter((key: string) => !key.endsWith(':size'));
      
      const stats = {
        size,
        minSize: this.MIN_POOL_SIZE,
        maxSize: this.MAX_POOL_SIZE,
        keys: availableKeys.map((key: string) => key.replace(`${this.POOL_KEY}:`, '')),
      };
      
      logger.debug('Pool stats retrieved', stats);
      return stats;
    } catch (error) {
      logger.error('Failed to get pool stats', error as Error);
      return {
        size: 0,
        minSize: this.MIN_POOL_SIZE,
        maxSize: this.MAX_POOL_SIZE,
        keys: [],
      };
    }
  }

  // Initialize the pool on startup
  async initializePool(): Promise<void> {
    try {
      const currentSize = await this.getPoolSize();
      
      if (currentSize < this.MIN_POOL_SIZE) {
        const needed = this.MIN_POOL_SIZE - currentSize;
        logger.info(`Initializing short code pool with ${needed} codes`, { currentSize, needed });
        
        // Generate initial batch
        const initialSlugs = generateSlugs(needed);
        await this.addSlugsToPool(initialSlugs);
        
        const finalSize = await this.getPoolSize();
        logger.info(`Pool initialized successfully`, { finalSize });
      } else {
        logger.info(`Pool already has sufficient codes`, { currentSize, minSize: this.MIN_POOL_SIZE });
      }
    } catch (error) {
      logger.error('Failed to initialize pool', error as Error);
    }
  }
} 