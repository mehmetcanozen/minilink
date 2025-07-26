import { CacheService } from '../../services/CacheService';
import { PrismaUrlRepository } from '../../repositories/PrismaUrlRepository';
import { logger } from '../../middleware/logger';

export interface CacheSyncJob {
  slug: string;
  operation: 'sync' | 'invalidate';
  data?: Record<string, unknown>;
}

export class CacheSyncJobHandler {
  private cacheService: CacheService;
  private urlRepository: PrismaUrlRepository;

  constructor(cacheService: CacheService, urlRepository: PrismaUrlRepository) {
    this.cacheService = cacheService;
    this.urlRepository = urlRepository;
  }

  async process(job: { data: CacheSyncJob }): Promise<void> {
    const { slug, operation } = job.data;

    try {
      logger.info(`Processing cache sync job`, { operation, slug });

      switch (operation) {
        case 'sync':
          await this.syncUrlToCache(slug);
          break;
        case 'invalidate':
          await this.invalidateUrlCache(slug);
          break;
        default:
          logger.warn(`Unknown cache operation`, { operation, slug });
      }

    } catch (error) {
      logger.error('Failed to process cache sync job', error as Error, { operation, slug });
      throw error;
    }
  }

  private async syncUrlToCache(slug: string): Promise<void> {
    try {
      // Get URL from database
      const url = await this.urlRepository.findBySlug(slug);
      
      if (url) {
        // Cache the URL
        await this.cacheService.cacheUrl(slug, url);
        logger.info(`Synced URL to cache`, { slug });
      } else {
        logger.warn(`URL not found in database, cannot sync to cache`, { slug });
      }
    } catch (error) {
      logger.error(`Failed to sync URL to cache`, error as Error, { slug });
      throw error;
    }
  }

  private async invalidateUrlCache(slug: string): Promise<void> {
    try {
      // Invalidate URL cache
      await this.cacheService.invalidateUrlCache(slug);
      
      // Also invalidate related caches
      await this.cacheService.invalidateUrlRelatedCache(slug);
      
      logger.info(`Invalidated cache for URL`, { slug });
    } catch (error) {
      logger.error(`Failed to invalidate cache for URL`, error as Error, { slug });
      throw error;
    }
  }

  // Batch sync multiple URLs
  async batchSyncUrls(slugs: string[]): Promise<void> {
    try {
      const promises = slugs.map(slug => this.syncUrlToCache(slug));
      const results = await Promise.allSettled(promises);
      
      // Log results
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;
      
      logger.info(`Batch sync completed`, { 
        total: slugs.length, 
        successful, 
        failed 
      });
    } catch (error) {
      logger.error('Failed to batch sync URLs', error as Error, { slugCount: slugs.length });
      throw error;
    }
  }

  // Warm up cache with popular URLs
  async warmCacheWithPopularUrls(limit: number = 50): Promise<void> {
    try {
      logger.info(`Warming cache with popular URLs`, { limit });
      
      const popularUrls = await this.urlRepository.getPopularUrls(limit);
      
      for (const url of popularUrls) {
        await this.cacheService.cacheUrl(url.shortSlug, url);
      }
      
      logger.info(`Cache warmed with popular URLs`, { 
        requested: limit, 
        actual: popularUrls.length 
      });
    } catch (error) {
      logger.error('Failed to warm cache with popular URLs', error as Error, { limit });
      throw error;
    }
  }

  // Health check for the job handler
  async healthCheck(): Promise<boolean> {
    try {
      // Test cache service
      await this.cacheService.isHealthy();
      
      // Test database connection through repository
      await this.urlRepository.getTotalUrlCount();
      
      return true;
    } catch (error) {
      logger.error('Cache sync job handler health check failed', error as Error);
      return false;
    }
  }
} 