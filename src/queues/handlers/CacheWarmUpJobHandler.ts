import { CacheService } from '../../services/CacheService';
import { PrismaUrlRepository } from '../../repositories/PrismaUrlRepository';
import { logger } from '../../middleware/logger';

export interface CacheWarmUpJob {
  timestamp: string;
  batchSize?: number;
}

export class CacheWarmUpJobHandler {
  private cacheService: CacheService;
  private urlRepository: PrismaUrlRepository;

  constructor(cacheService: CacheService, urlRepository: PrismaUrlRepository) {
    this.cacheService = cacheService;
    this.urlRepository = urlRepository;
  }

  async process(job: { data: CacheWarmUpJob }): Promise<void> {
    try {
      const { batchSize = 50 } = job.data;
      
      logger.info(`Starting cache warm-up`, { batchSize });
      
      // Get popular URLs from database
      const popularUrls = await this.urlRepository.getPopularUrls(batchSize);
      
      if (popularUrls.length === 0) {
        logger.info('No popular URLs found for cache warm-up');
        return;
      }

      // Cache each popular URL
      for (const url of popularUrls) {
        await this.cacheService.cacheUrl(url.shortSlug, url);
      }

      // Cache the popular URLs list itself
      await this.cacheService.cachePopularUrls(popularUrls);

      // Get recent URLs as well
      const recentUrls = await this.urlRepository.getRecentUrls(batchSize);
      await this.cacheService.cacheRecentUrls(recentUrls);

      // Cache system stats
      const totalUrls = await this.urlRepository.getTotalUrlCount();
      const totalClicks = await this.urlRepository.getTotalClickCount();
      
      await this.cacheService.cacheSystemStats({
        totalUrls,
        totalClicks,
        popularUrlsCount: popularUrls.length,
        recentUrlsCount: recentUrls.length,
        lastUpdated: new Date().toISOString(),
      });

      logger.info(`Cache warm-up completed successfully`, { 
        popularUrls: popularUrls.length, 
        recentUrls: recentUrls.length,
        totalUrls,
        totalClicks
      });
    } catch (error) {
      logger.error('Cache warm-up failed', error as Error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - try to get cached system stats
      const stats = await this.cacheService.getCachedSystemStats();
      return stats !== null;
    } catch (error) {
      logger.error('Cache warm-up health check failed', error as Error);
      return false;
    }
  }
} 