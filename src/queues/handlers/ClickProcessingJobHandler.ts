import { CacheService } from '../../services/CacheService';
import { PrismaUrlRepository } from '../../repositories/PrismaUrlRepository';
import { logger } from '../../middleware/logger';

export interface ClickProcessingJob {
  slug: string;
  userAgent?: string;
  ip?: string;
  timestamp: string;
}

export class ClickProcessingJobHandler {
  private cacheService: CacheService;
  private urlRepository: PrismaUrlRepository;

  constructor(cacheService: CacheService, urlRepository: PrismaUrlRepository) {
    this.cacheService = cacheService;
    this.urlRepository = urlRepository;
  }

  async process(job: { data: ClickProcessingJob }): Promise<void> {
    const { slug, userAgent, ip, timestamp } = job.data;

    try {
      logger.debug(`Processing click for slug: ${slug}`, { userAgent, ip, timestamp });

      // Increment Redis click count for this slug
      const newClickCount = await this.cacheService.incrementClickCount(slug);

      // Check if we should sync to database (every 10 clicks or every 5 minutes)
      const shouldSync = await this.shouldSyncToDatabase(slug, newClickCount);

      if (shouldSync) {
        await this.syncClickCountToDatabase(slug, newClickCount);
        
        // Reset Redis counter after successful sync
        await this.cacheService.resetClickCount(slug);
        
        logger.info(`Synced ${newClickCount} clicks for slug ${slug} to database`);
      }

      // Log analytics data (optional - for future analytics features)
      await this.logAnalytics(slug, userAgent, ip, timestamp);

    } catch (error) {
      logger.error('Failed to process click job', error as Error, { slug, userAgent, ip });
      throw error; // Re-throw to trigger BullMQ retry mechanism
    }
  }

  private async shouldSyncToDatabase(slug: string, clickCount: number): Promise<boolean> {
    // Sync every 10 clicks
    if (clickCount >= 10) {
      return true;
    }

    // Sync at least every 5 minutes (300 seconds)
    const lastSyncKey = `last_sync:${slug}`;
    const lastSync = await this.cacheService.getCachedData(lastSyncKey);
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);

    if (!lastSync || parseInt(lastSync) < fiveMinutesAgo) {
      // Update last sync timestamp
      await this.cacheService.setCachedData(lastSyncKey, now.toString(), 600); // 10 min TTL
      return true;
    }

    return false;
  }

  private async syncClickCountToDatabase(slug: string, incrementAmount: number): Promise<void> {
    if (incrementAmount <= 0) return;

    try {
      await this.urlRepository.bulkIncrementClickCount(slug, incrementAmount);
      
      // Invalidate URL cache to ensure fresh data on next request
      await this.cacheService.invalidateUrlCache(slug);
      
      logger.debug(`Synced click count for slug ${slug}`, { incrementAmount });
    } catch (error) {
      logger.error(`Failed to sync click count for slug ${slug}`, error as Error, { incrementAmount });
      throw error;
    }
  }

  private async logAnalytics(slug: string, userAgent?: string, ip?: string, timestamp?: string): Promise<void> {
    try {
      // For now, just log to console. In the future, this could store detailed analytics
      const anonymizedIP = ip ? this.anonymizeIP(ip) : 'unknown';
      const browserInfo = userAgent ? this.extractBrowserInfo(userAgent) : 'unknown';
      
      logger.debug(`Analytics: ${slug} | ${anonymizedIP} | ${browserInfo} | ${timestamp}`, {
        slug,
        anonymizedIP,
        browserInfo,
        timestamp,
      });
      
      // TODO: Store in analytics table or send to analytics service
      
    } catch (error) {
      // Don't throw here - analytics failures shouldn't break click processing
      logger.warn('Failed to log analytics', { slug, error: error instanceof Error ? error.message : String(error) });
    }
  }

  private anonymizeIP(ip: string): string {
    // Simple IP anonymization (remove last octet for IPv4)
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }
    // For IPv6 or other formats, just return first few characters
    return ip.substring(0, Math.min(8, ip.length)) + 'xxx';
  }

  private extractBrowserInfo(userAgent: string): string {
    // Simple browser detection
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  }

  // Batch sync multiple slugs (for efficiency)
  async batchSyncClickCounts(slugCounts: { slug: string; count: number }[]): Promise<void> {
    const promises = slugCounts.map(({ slug, count }) => 
      this.syncClickCountToDatabase(slug, count)
    );
    
    const results = await Promise.allSettled(promises);
    
    // Log results
    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;
    
    logger.info(`Batch sync completed`, { 
      total: slugCounts.length, 
      successful, 
      failed 
    });
  }

  // Health check for the job handler
  async healthCheck(): Promise<boolean> {
    try {
      // Test cache service
      await this.cacheService.isHealthy();
      
      // Test database connection through repository
      // This is a simple test - in production you might want a dedicated health check method
      return true;
      
    } catch (error) {
      logger.error('Click processing job handler health check failed', error as Error);
      return false;
    }
  }
} 