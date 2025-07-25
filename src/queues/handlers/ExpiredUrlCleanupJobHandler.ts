import { PrismaUrlRepository } from '../../repositories/PrismaUrlRepository';
import { getPrismaClient } from '../../config/prisma';
import { CacheService } from '../../services/CacheService';

export interface ExpiredUrlCleanupJob {
  timestamp: string;
  batchSize?: number;
}

export class ExpiredUrlCleanupJobHandler {
  private urlRepository: PrismaUrlRepository;
  private cacheService: CacheService;

  constructor() {
    this.urlRepository = new PrismaUrlRepository(getPrismaClient());
    this.cacheService = new CacheService();
  }

  async process(job: { data: ExpiredUrlCleanupJob }): Promise<void> {
    const { timestamp, batchSize = 100 } = job.data;

    try {
      console.log(`Processing expired URL cleanup job at ${timestamp}`);

      // Find expired URLs
      const expiredUrls = await this.findExpiredUrls(batchSize);
      
      if (expiredUrls.length === 0) {
        console.log('No expired URLs found');
        return;
      }

      console.log(`Found ${expiredUrls.length} expired URLs to clean up`);

      // Delete expired URLs from database
      await this.deleteExpiredUrls(expiredUrls);

      // Clean up related caches
      await this.cleanupExpiredUrlCaches(expiredUrls);

      console.log(`Successfully cleaned up ${expiredUrls.length} expired URLs`);

    } catch (error) {
      console.error('Failed to process expired URL cleanup job:', error);
      throw error; // Re-throw to trigger BullMQ retry mechanism
    }
  }

  private async findExpiredUrls(limit: number): Promise<Array<{ id: string; shortSlug: string; originalUrl: string }>> {
    try {
      const prisma = getPrismaClient();
      
      // Use raw SQL to find expired URLs (since Prisma client might not have expiresAt field yet)
      const expiredUrls = await prisma.$queryRaw<Array<{ id: string; short_slug: string; original_url: string }>>`
        SELECT id, short_slug, original_url 
        FROM urls 
        WHERE expires_at IS NOT NULL 
        AND expires_at < NOW() 
        ORDER BY expires_at ASC 
        LIMIT ${limit}
      `;

      return expiredUrls.map(url => ({
        id: url.id,
        shortSlug: url.short_slug,
        originalUrl: url.original_url,
      }));
    } catch (error) {
      console.error('Failed to find expired URLs:', error);
      throw error;
    }
  }

  private async deleteExpiredUrls(expiredUrls: Array<{ id: string; shortSlug: string; originalUrl: string }>): Promise<void> {
    try {
      const prisma = getPrismaClient();
      
      // Delete expired URLs in batches
      const batchSize = 50;
      for (let i = 0; i < expiredUrls.length; i += batchSize) {
        const batch = expiredUrls.slice(i, i + batchSize);
        
        await prisma.url.deleteMany({
          where: {
            id: {
              in: batch.map(url => url.id),
            },
          },
        });

        console.log(`Deleted batch of ${batch.length} expired URLs`);
      }
    } catch (error) {
      console.error('Failed to delete expired URLs:', error);
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
          console.warn(`Failed to cleanup cache for expired URL ${url.shortSlug}:`, error);
        }
      });

      await Promise.allSettled(cleanupPromises);
      
      // Invalidate aggregate caches by clearing popular and recent URLs
      await Promise.allSettled([
        this.cacheService.getCachedPopularUrls().then(() => null).catch(() => null),
        this.cacheService.getCachedRecentUrls().then(() => null).catch(() => null),
        this.cacheService.getCachedSystemStats().then(() => null).catch(() => null),
      ]);
      
    } catch (error) {
      console.error('Failed to cleanup expired URL caches:', error);
      // Don't throw - cache cleanup failures shouldn't break the main cleanup process
    }
  }

  // Health check for the job handler
  async healthCheck(): Promise<boolean> {
    try {
      // Test database connection through repository
      const prisma = getPrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      
      // Test cache service
      await this.cacheService.isHealthy();
      
      return true;
    } catch (error) {
      console.error('Expired URL cleanup job handler health check failed:', error);
      return false;
    }
  }
} 