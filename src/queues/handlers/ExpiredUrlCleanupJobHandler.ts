import { PrismaUrlRepository } from '../../repositories/PrismaUrlRepository';
import { CacheService } from '../../services/CacheService';
import { logger } from '../../middleware/logger';

export interface ExpiredUrlCleanupJob {
  timestamp: string;
  batchSize?: number;
}

export class ExpiredUrlCleanupJobHandler {
  private urlRepository: PrismaUrlRepository;
  private cacheService: CacheService;

  constructor(urlRepository: PrismaUrlRepository, cacheService: CacheService) {
    this.urlRepository = urlRepository;
    this.cacheService = cacheService;
  }

  async process(job: { data: ExpiredUrlCleanupJob }): Promise<void> {
    const { timestamp, batchSize = 100 } = job.data;

    try {
      logger.info(`Processing expired URL cleanup job`, { timestamp, batchSize });

      // Find expired URLs
      const expiredUrls = await this.findExpiredUrls(batchSize);
      
      if (expiredUrls.length === 0) {
        logger.info('No expired URLs found');
        return;
      }

      logger.info(`Found ${expiredUrls.length} expired URLs to clean up`);

      // Delete expired URLs from database
      await this.deleteExpiredUrls(expiredUrls);

      // Clean up related caches
      await this.cleanupExpiredUrlCaches(expiredUrls);

      logger.info(`Successfully cleaned up ${expiredUrls.length} expired URLs`);

    } catch (error) {
      logger.error('Failed to process expired URL cleanup job', error as Error);
      throw error; // Re-throw to trigger BullMQ retry mechanism
    }
  }

  private async findExpiredUrls(limit: number): Promise<Array<{ id: string; shortSlug: string; originalUrl: string }>> {
    try {
      const expiredUrls = await this.urlRepository.getExpiredUrls(limit);
      
      logger.debug(`Found ${expiredUrls.length} expired URLs`, { limit });
      
      return expiredUrls.map(url => ({
        id: url.id,
        shortSlug: url.shortSlug,
        originalUrl: url.originalUrl,
      }));
    } catch (error) {
      logger.error('Failed to find expired URLs', error as Error, { limit });
      throw error;
    }
  }

  private async deleteExpiredUrls(expiredUrls: Array<{ id: string; shortSlug: string; originalUrl: string }>): Promise<void> {
    try {
      // Delete expired URLs in batches
      const batchSize = 50;
      let totalDeleted = 0;
      
      for (let i = 0; i < expiredUrls.length; i += batchSize) {
        const batch = expiredUrls.slice(i, i + batchSize);
        
        const deletedCount = await this.urlRepository.deleteExpiredUrls();
        totalDeleted += deletedCount;

        logger.debug(`Deleted batch of ${batch.length} expired URLs`, { batchIndex: i / batchSize + 1 });
      }
      
      logger.info(`Total expired URLs deleted from database`, { totalDeleted });
    } catch (error) {
      logger.error('Failed to delete expired URLs', error as Error);
      throw error;
    }
  }

  private async cleanupExpiredUrlCaches(expiredUrls: Array<{ id: string; shortSlug: string; originalUrl: string }>): Promise<void> {
    try {
      // Clean up caches for each expired URL
      const cleanupPromises = expiredUrls.map(async (url) => {
        try {
          // Invalidate URL cache
          await this.cacheService.invalidateUrlCache(url.shortSlug);
          
          // Invalidate click count cache
          await this.cacheService.resetClickCount(url.shortSlug);
          
          // Invalidate original URL cache
          await this.cacheService.invalidateUrlRelatedCache(url.shortSlug, url.originalUrl);
          
        } catch (error) {
          logger.warn(`Failed to cleanup cache for expired URL ${url.shortSlug}`, { 
            shortSlug: url.shortSlug, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      });

      const results = await Promise.allSettled(cleanupPromises);
      
      // Log cleanup results
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;
      
      logger.info(`Cache cleanup completed`, { 
        total: expiredUrls.length, 
        successful, 
        failed 
      });
      
      // Invalidate aggregate caches by clearing popular and recent URLs
      await Promise.allSettled([
        this.cacheService.getCachedPopularUrls().then(() => null).catch(() => null),
        this.cacheService.getCachedRecentUrls().then(() => null).catch(() => null),
        this.cacheService.getCachedSystemStats().then(() => null).catch(() => null),
      ]);
      
    } catch (error) {
      logger.error('Failed to cleanup expired URL caches', error as Error);
      // Don't throw - cache cleanup failures shouldn't break the main cleanup process
    }
  }

  // Health check for the job handler
  async healthCheck(): Promise<boolean> {
    try {
      // Test database connection through repository
      await this.urlRepository.getTotalUrlCount();
      
      // Test cache service
      await this.cacheService.isHealthy();
      
      return true;
    } catch (error) {
      logger.error('Expired URL cleanup job handler health check failed', error as Error);
      return false;
    }
  }
} 