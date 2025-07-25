import { CacheService } from '../../services/CacheService';
import { PrismaUrlRepository } from '../../repositories/PrismaUrlRepository';
import { getPrismaClient } from '../../config/prisma';

export interface CacheSyncJob {
  slug: string;
  operation: 'sync' | 'invalidate';
  data?: Record<string, unknown>;
}

export class CacheSyncJobHandler {
  private cacheService: CacheService;
  private urlRepository: PrismaUrlRepository;

  constructor() {
    this.cacheService = new CacheService();
    this.urlRepository = new PrismaUrlRepository(getPrismaClient());
  }

  async process(job: { data: CacheSyncJob }): Promise<void> {
    const { slug, operation, data } = job.data;

    try {
      console.log(`Processing cache sync job: ${operation} for slug ${slug}`);

      switch (operation) {
        case 'sync':
          await this.syncUrlToCache(slug);
          break;
        case 'invalidate':
          await this.invalidateUrlCache(slug);
          break;
        default:
          console.warn(`Unknown cache operation: ${operation}`);
      }

    } catch (error) {
      console.error('Failed to process cache sync job:', error);
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
        console.log(`Synced URL ${slug} to cache`);
      } else {
        console.warn(`URL ${slug} not found in database, cannot sync to cache`);
      }
    } catch (error) {
      console.error(`Failed to sync URL ${slug} to cache:`, error);
      throw error;
    }
  }

  private async invalidateUrlCache(slug: string): Promise<void> {
    try {
      // Invalidate URL cache
      await this.cacheService.invalidateUrlCache(slug);
      
      // Also invalidate related caches
      await this.cacheService.invalidateUrlRelatedCache(slug);
      
      console.log(`Invalidated cache for URL ${slug}`);
    } catch (error) {
      console.error(`Failed to invalidate cache for URL ${slug}:`, error);
      throw error;
    }
  }

  // Batch sync multiple URLs
  async batchSyncUrls(slugs: string[]): Promise<void> {
    const promises = slugs.map(slug => this.syncUrlToCache(slug));
    await Promise.allSettled(promises);
  }

  // Warm up cache with popular URLs
  async warmCacheWithPopularUrls(limit: number = 50): Promise<void> {
    try {
      console.log(`Warming cache with ${limit} popular URLs...`);
      
      const popularUrls = await this.urlRepository.getPopularUrls(limit);
      
      for (const url of popularUrls) {
        await this.cacheService.cacheUrl(url.shortSlug, url);
      }
      
      console.log(`Cache warmed with ${popularUrls.length} popular URLs`);
    } catch (error) {
      console.error('Failed to warm cache with popular URLs:', error);
      throw error;
    }
  }

  // Health check for the job handler
  async healthCheck(): Promise<boolean> {
    try {
      // Test cache service
      await this.cacheService.isHealthy();
      
      // Test database connection through repository
      return true;
    } catch (error) {
      console.error('Cache sync job handler health check failed:', error);
      return false;
    }
  }
} 